const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { createTransaction, reverseTransaction } = require('./pointsTransaction');

const generateExchangeOrderNo = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `EX${y}${m}${d}${h}${mi}${s}${rand}`;
};

const LEVEL_ORDER = { NORMAL: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 };

const validateLevel = (memberLevel, requiredLevel) => {
  if (!requiredLevel) return true;
  return LEVEL_ORDER[memberLevel] >= LEVEL_ORDER[requiredLevel];
};

const checkPerPersonLimit = async (tx, memberId, productId, limit, quantity) => {
  if (!limit) return true;
  const count = await tx.exchangeRecord.count({
    where: {
      memberId,
      productId,
      status: { not: 'CANCELLED' },
    },
  });
  return count + quantity <= limit;
};

const checkDailyLimit = async (tx, memberId, productId, limit, quantity) => {
  if (!limit) return true;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const count = await tx.exchangeRecord.count({
    where: {
      memberId,
      productId,
      status: { not: 'CANCELLED' },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });
  return count + quantity <= limit;
};

const createExchangeOrder = async ({ memberId, productId, quantity = 1, shippingInfo = null, remark = null, operatorId = null }) => {
  return await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, phone: true, status: true, level: true, points: true },
    });

    if (!member) {
      const error = new Error('会员不存在');
      error.status = 404;
      throw error;
    }

    if (member.status === 'SUSPENDED') {
      const error = new Error('该会员已被拉黑，无法兑换');
      error.status = 400;
      throw error;
    }

    if (member.status !== 'ACTIVE') {
      const error = new Error('会员状态异常，无法兑换');
      error.status = 400;
      throw error;
    }

    const product = await tx.shopProduct.findUnique({
      where: { id: productId },
      include: { category: { select: { id: true, name: true } } },
    });

    if (!product) {
      const error = new Error('商品不存在');
      error.status = 404;
      throw error;
    }

    if (product.status !== 'ON_SHELF') {
      const error = new Error('商品未上架');
      error.status = 400;
      throw error;
    }

    if (!validateLevel(member.level, product.requiredLevel)) {
      const error = new Error(`会员等级不足，需要${product.requiredLevel}以上等级`);
      error.status = 400;
      throw error;
    }

    if (product.stock < quantity) {
      const error = new Error('库存不足');
      error.status = 400;
      throw error;
    }

    const totalPoints = (product.pointsCost + product.shippingPoints) * quantity;
    if (member.points < totalPoints) {
      const error = new Error('积分余额不足');
      error.status = 400;
      throw error;
    }

    const canPerPerson = await checkPerPersonLimit(tx, memberId, productId, product.perPersonLimit, quantity);
    if (!canPerPerson) {
      const error = new Error(`超出每人限兑数量（限${product.perPersonLimit}件）`);
      error.status = 400;
      throw error;
    }

    const canDaily = await checkDailyLimit(tx, memberId, productId, product.dailyLimit, quantity);
    if (!canDaily) {
      const error = new Error(`超出每日限兑数量（限${product.dailyLimit}件/天）`);
      error.status = 400;
      throw error;
    }

    const orderNo = generateExchangeOrderNo();

    const txRecord = await createTransaction({
      memberId,
      points: -totalPoints,
      reasonType: 'MALL_EXCHANGE',
      bizOrderNo: orderNo,
      bizOrderType: 'EXCHANGE_ORDER',
      operatorId,
      remark: `兑换商品: ${product.name} x ${quantity}`,
    });

    await tx.shopProduct.update({
      where: { id: productId },
      data: {
        stock: { decrement: quantity },
        soldCount: { increment: quantity },
      },
    });

    const productSnapshot = {
      id: product.id,
      name: product.name,
      description: product.description,
      coverImage: product.coverImage,
      pointsCost: product.pointsCost,
      shippingPoints: product.shippingPoints,
      categoryId: product.categoryId,
      categoryName: product.category?.name,
    };

    const exchangeRecord = await tx.exchangeRecord.create({
      data: {
        memberId,
        productId,
        productSnapshot,
        itemName: product.name,
        pointsCost: product.pointsCost,
        shippingPoints: product.shippingPoints,
        totalPoints,
        quantity,
        orderNo,
        status: 'PENDING_CONFIRM',
        shippingInfo,
        transactionId: txRecord.id,
        operatorId,
        remark,
      },
      include: {
        member: { select: { id: true, name: true, phone: true, level: true } },
        product: { select: { id: true, name: true, coverImage: true } },
        transaction: { select: { id: true, serialNo: true } },
        operator: { select: { id: true, username: true } },
      },
    });

    logger.info('Exchange order created', {
      orderNo,
      memberId,
      productId,
      quantity,
      totalPoints,
    });

    return exchangeRecord;
  });
};

const validateStatusTransition = (fromStatus, toStatus) => {
  const transitions = {
    PENDING_CONFIRM: ['PENDING_SHIP', 'CANCELLED'],
    PENDING_SHIP: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[fromStatus]?.includes(toStatus) || false;
};

const updateExchangeStatus = async (id, { status, remark = null, trackingNo = null, shippingInfo = null, cancelReason = null }, operatorId = null) => {
  return await prisma.$transaction(async (tx) => {
    const record = await tx.exchangeRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, name: true, stock: true } },
        transaction: { select: { id: true, serialNo: true } },
      },
    });

    if (!record) {
      const error = new Error('兑换记录不存在');
      error.status = 404;
      throw error;
    }

    if (!validateStatusTransition(record.status, status)) {
      const error = new Error(`无法从 ${record.status} 变更到 ${status}`);
      error.status = 400;
      throw error;
    }

    const updateData = { status, operatorId };
    if (remark) updateData.remark = remark;
    if (trackingNo) updateData.trackingNo = trackingNo;
    if (shippingInfo) updateData.shippingInfo = shippingInfo;
    if (cancelReason) updateData.cancelReason = cancelReason;

    const now = new Date();
    if (status === 'PENDING_SHIP') updateData.confirmedAt = now;
    if (status === 'SHIPPED') updateData.shippedAt = now;
    if (status === 'COMPLETED') updateData.completedAt = now;

    if (status === 'CANCELLED') {
      updateData.cancelledAt = now;
      updateData.cancelOperatorId = operatorId;

      await tx.shopProduct.update({
        where: { id: record.productId },
        data: {
          stock: { increment: record.quantity },
          soldCount: { decrement: record.quantity },
        },
      });

      if (record.transactionId) {
        await reverseTransaction(record.transactionId, operatorId, cancelReason || '兑换单取消退款');
      }
    }

    const updated = await tx.exchangeRecord.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        member: { select: { id: true, name: true, phone: true, level: true } },
        product: { select: { id: true, name: true, coverImage: true } },
        transaction: { select: { id: true, serialNo: true } },
        operator: { select: { id: true, username: true } },
        cancelOperator: { select: { id: true, username: true } },
      },
    });

    logger.info('Exchange order status updated', {
      orderNo: record.orderNo,
      fromStatus: record.status,
      toStatus: status,
    });

    return updated;
  });
};

const queryExchangeRecords = async (filters = {}) => {
  const {
    page = 1,
    pageSize = 20,
    memberId,
    memberName,
    memberPhone,
    productId,
    status,
    startDate,
    endDate,
  } = filters;

  const where = {};

  if (memberId) where.memberId = parseInt(memberId);
  if (productId) where.productId = parseInt(productId);
  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (memberName || memberPhone) {
    where.member = {};
    if (memberName) where.member.name = { contains: memberName };
    if (memberPhone) where.member.phone = { contains: memberPhone };
  }

  const skip = (page - 1) * pageSize;

  const [total, list] = await Promise.all([
    prisma.exchangeRecord.count({ where }),
    prisma.exchangeRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, name: true, phone: true, level: true } },
        product: { select: { id: true, name: true, coverImage: true } },
        transaction: { select: { id: true, serialNo: true } },
        operator: { select: { id: true, username: true } },
        cancelOperator: { select: { id: true, username: true } },
      },
    }),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

const getExchangeStats = async (filters = {}) => {
  const { startDate, endDate } = filters;
  const where = {};

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [totalOrders, totalPoints, byStatus, byProduct] = await Promise.all([
    prisma.exchangeRecord.count({ where: { ...where, status: { not: 'CANCELLED' } } }),
    prisma.exchangeRecord.aggregate({
      where: { ...where, status: { not: 'CANCELLED' } },
      _sum: { totalPoints: true, quantity: true },
    }),
    prisma.exchangeRecord.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: { totalPoints: true },
    }),
    prisma.exchangeRecord.groupBy({
      by: ['productId', 'itemName'],
      where: { ...where, status: { not: 'CANCELLED' } },
      _count: true,
      _sum: { totalPoints: true, quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 20,
    }),
  ]);

  const productsWithTurnover = await Promise.all(
    byProduct.map(async (p) => {
      const product = await prisma.shopProduct.findUnique({
        where: { id: p.productId },
        select: { stock: true, soldCount: true, lowStockThreshold: true },
      });
      const totalStock = (product?.stock || 0) + (p._sum.quantity || 0);
      const turnover = totalStock > 0 ? ((p._sum.quantity || 0) / totalStock) * 100 : 0;
      return {
        productId: p.productId,
        itemName: p.itemName,
        exchangeCount: p._count,
        totalQuantity: p._sum.quantity || 0,
        totalPoints: p._sum.totalPoints || 0,
        currentStock: product?.stock || 0,
        lowStockThreshold: product?.lowStockThreshold || 0,
        turnoverRate: parseFloat(turnover.toFixed(2)),
      };
    })
  );

  const statusStats = {};
  byStatus.forEach((s) => {
    statusStats[s.status] = {
      count: s._count,
      totalPoints: s._sum.totalPoints || 0,
    };
  });

  const lowStockAllProducts = await prisma.shopProduct.findMany({
    where: {
      status: { not: 'OFF_SHELF' },
    },
    select: {
      id: true,
      name: true,
      coverImage: true,
      stock: true,
      lowStockThreshold: true,
      pointsCost: true,
    },
  });
  const lowStockProducts = lowStockAllProducts
    .filter(p => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);

  return {
    totalOrders,
    totalQuantity: totalPoints._sum.quantity || 0,
    totalPoints: totalPoints._sum.totalPoints || 0,
    statusStats,
    topProducts: productsWithTurnover,
    lowStockProducts,
  };
};

module.exports = {
  createExchangeOrder,
  updateExchangeStatus,
  validateStatusTransition,
  queryExchangeRecords,
  getExchangeStats,
  generateExchangeOrderNo,
};
