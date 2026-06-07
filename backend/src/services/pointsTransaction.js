const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const generateSerialNo = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PT${y}${m}${d}${h}${mi}${s}${ms}${rand}`;
};

const determineChangeType = (reasonType, points) => {
  if (reasonType === 'FREEZE_OP') return 'FREEZE';
  if (reasonType === 'UNFREEZE_OP') return 'UNFREEZE';
  if (reasonType === 'EXPIRE_CLEAR') return 'EXPIRE';
  if (reasonType === 'REVERSE_OP') return 'REVERSE';
  return points > 0 ? 'ADD' : 'DEDUCT';
};

const createTransaction = async ({
  memberId,
  points,
  reasonType = 'OTHER',
  bizOrderNo = null,
  bizOrderType = null,
  operatorId = null,
  remark = null,
}) => {
  return await prisma.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: { id: memberId },
      select: { id: true, points: true, frozenPoints: true, status: true },
    });

    if (!member) {
      const error = new Error('Member not found');
      error.status = 404;
      throw error;
    }

    const balanceBefore = member.points;
    let balanceAfter = balanceBefore + points;
    let frozenBefore = member.frozenPoints;
    let frozenAfter = frozenBefore;
    const changeType = determineChangeType(reasonType, points);

    if (changeType === 'FREEZE') {
      if (balanceBefore < Math.abs(points)) {
        const error = new Error('Insufficient available points for freezing');
        error.status = 400;
        throw error;
      }
      balanceAfter = balanceBefore + points;
      frozenAfter = frozenBefore + Math.abs(points);
    } else if (changeType === 'UNFREEZE') {
      if (frozenBefore < Math.abs(points)) {
        const error = new Error('Insufficient frozen points for unfreezing');
        error.status = 400;
        throw error;
      }
      balanceAfter = balanceBefore + Math.abs(points);
      frozenAfter = frozenBefore - Math.abs(points);
    } else if (changeType === 'EXPIRE') {
      if (balanceBefore < Math.abs(points)) {
        const error = new Error('Insufficient points for expiration');
        error.status = 400;
        throw error;
      }
      balanceAfter = balanceBefore + points;
    } else {
      if (balanceAfter < 0) {
        const error = new Error('Insufficient points');
        error.status = 400;
        throw error;
      }
    }

    const serialNo = generateSerialNo();

    const transaction = await tx.pointsTransaction.create({
      data: {
        serialNo,
        memberId,
        changeType,
        changeValue: points,
        balanceBefore,
        balanceAfter,
        reasonType,
        bizOrderNo,
        bizOrderType,
        operatorId,
        remark,
      },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        operator: { select: { id: true, username: true } },
      },
    });

    const updateData = { points: balanceAfter };
    if (changeType === 'FREEZE' || changeType === 'UNFREEZE') {
      updateData.frozenPoints = frozenAfter;
    }

    await tx.member.update({
      where: { id: memberId },
      data: updateData,
    });

    logger.info('Points transaction created', {
      serialNo,
      memberId,
      changeType,
      changeValue: points,
      balanceBefore,
      balanceAfter,
      reasonType,
    });

    return transaction;
  });
};

const reverseTransaction = async (transactionId, operatorId = null, remark = null) => {
  return await prisma.$transaction(async (tx) => {
    const originalTx = await tx.pointsTransaction.findUnique({
      where: { id: transactionId },
      include: {
        member: { select: { id: true, name: true, phone: true, points: true, frozenPoints: true } },
        reversedBy: true,
      },
    });

    if (!originalTx) {
      const error = new Error('Transaction not found');
      error.status = 404;
      throw error;
    }

    if (originalTx.reversedBy && originalTx.reversedBy.length > 0) {
      const error = new Error('Transaction has already been reversed');
      error.status = 400;
      throw error;
    }

    if (originalTx.changeType === 'REVERSE') {
      const error = new Error('Cannot reverse a reverse transaction');
      error.status = 400;
      throw error;
    }

    const reversePoints = -originalTx.changeValue;
    const balanceBefore = originalTx.member.points;
    let balanceAfter = balanceBefore + reversePoints;
    let frozenBefore = originalTx.member.frozenPoints;
    let frozenAfter = frozenBefore;

    if (originalTx.changeType === 'FREEZE') {
      balanceAfter = balanceBefore + Math.abs(originalTx.changeValue);
      frozenAfter = frozenBefore - Math.abs(originalTx.changeValue);
      if (frozenAfter < 0) {
        const error = new Error('Insufficient frozen points to reverse freeze');
        error.status = 400;
        throw error;
      }
    } else if (originalTx.changeType === 'UNFREEZE') {
      if (balanceBefore < Math.abs(originalTx.changeValue)) {
        const error = new Error('Insufficient points to reverse unfreeze');
        error.status = 400;
        throw error;
      }
      balanceAfter = balanceBefore - Math.abs(originalTx.changeValue);
      frozenAfter = frozenBefore + Math.abs(originalTx.changeValue);
    } else {
      if (balanceAfter < 0) {
        const error = new Error('Insufficient points for reversal');
        error.status = 400;
        throw error;
      }
    }

    const serialNo = generateSerialNo();

    const reversedTx = await tx.pointsTransaction.create({
      data: {
        serialNo,
        memberId: originalTx.memberId,
        changeType: 'REVERSE',
        changeValue: reversePoints,
        balanceBefore,
        balanceAfter,
        reasonType: 'REVERSE_OP',
        bizOrderNo: originalTx.bizOrderNo,
        bizOrderType: originalTx.bizOrderType,
        operatorId,
        remark: remark || `冲正流水: ${originalTx.serialNo}`,
        reverseOfId: originalTx.id,
      },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        operator: { select: { id: true, username: true } },
        reverseOf: { include: { member: { select: { name: true, phone: true } } } },
      },
    });

    const updateData = { points: balanceAfter };
    if (originalTx.changeType === 'FREEZE' || originalTx.changeType === 'UNFREEZE') {
      updateData.frozenPoints = frozenAfter;
    }
    await tx.member.update({
      where: { id: originalTx.memberId },
      data: updateData,
    });

    logger.info('Points transaction reversed', {
      originalSerialNo: originalTx.serialNo,
      reverseSerialNo: serialNo,
      memberId: originalTx.memberId,
      reversePoints,
    });

    return reversedTx;
  });
};

const queryTransactions = async (filters = {}) => {
  const {
    page = 1,
    pageSize = 20,
    memberId,
    memberName,
    memberPhone,
    changeType,
    reasonType,
    bizOrderNo,
    startDate,
    endDate,
    serialNo,
  } = filters;

  const where = {};

  if (memberId) where.memberId = memberId;
  if (changeType) where.changeType = changeType;
  if (reasonType) where.reasonType = reasonType;
  if (bizOrderNo) where.bizOrderNo = bizOrderNo;
  if (serialNo) where.serialNo = { contains: serialNo };

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
    prisma.pointsTransaction.count({ where }),
    prisma.pointsTransaction.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        operator: { select: { id: true, username: true } },
        reverseOf: {
          select: {
            id: true,
            serialNo: true,
            changeType: true,
            changeValue: true,
            reasonType: true,
            createdAt: true,
          },
        },
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

const getTransactionById = async (id) => {
  return await prisma.pointsTransaction.findUnique({
    where: { id: parseInt(id) },
    include: {
      member: { select: { id: true, name: true, phone: true, level: true, points: true, frozenPoints: true } },
      operator: { select: { id: true, username: true, role: true } },
      reverseOf: {
        include: {
          member: { select: { id: true, name: true, phone: true } },
          operator: { select: { id: true, username: true } },
        },
      },
      reversedBy: {
        include: {
          member: { select: { id: true, name: true, phone: true } },
          operator: { select: { id: true, username: true } },
        },
      },
    },
  });
};

const getMemberTrend = async (memberId, days = 30) => {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days + 1);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const transactions = await prisma.pointsTransaction.findMany({
    where: {
      memberId: parseInt(memberId),
      createdAt: { gte: startDate, lte: endDate },
      changeType: { in: ['ADD', 'DEDUCT', 'REVERSE'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  const dayStats = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dayStats[key] = { date: key, add: 0, deduct: 0, net: 0 };
  }

  for (const tx of transactions) {
    const key = tx.createdAt.toISOString().slice(0, 10);
    if (dayStats[key]) {
      if (tx.changeValue > 0) {
        dayStats[key].add += tx.changeValue;
      } else {
        dayStats[key].deduct += Math.abs(tx.changeValue);
      }
      dayStats[key].net += tx.changeValue;
    }
  }

  return Object.values(dayStats);
};

const getReasonStats = async (filters = {}) => {
  const { memberId, startDate, endDate } = filters;

  const where = {};
  if (memberId) where.memberId = parseInt(memberId);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const stats = await prisma.pointsTransaction.groupBy({
    by: ['reasonType'],
    where,
    _count: true,
    _sum: { changeValue: true },
    orderBy: { _count: { changeValue: 'desc' } },
  });

  return stats.map((s) => ({
    reasonType: s.reasonType,
    count: s._count,
    totalValue: s._sum.changeValue || 0,
  }));
};

const exportTransactionsToCsv = async (filters = {}) => {
  const result = await queryTransactions({ ...filters, page: 1, pageSize: 10000 });

  const headers = [
    '流水号',
    '会员姓名',
    '会员手机号',
    '变动类型',
    '变动值',
    '变动前余额',
    '变动后余额',
    '原因类型',
    '关联业务单号',
    '关联业务类型',
    '操作人',
    '备注',
    '发生时间',
  ];

  const changeTypeMap = {
    ADD: '增加',
    DEDUCT: '扣减',
    FREEZE: '冻结',
    UNFREEZE: '解冻',
    EXPIRE: '过期清零',
    REVERSE: '冲正',
  };

  const reasonTypeMap = {
    MANUAL_ADJUST: '人工调整',
    MALL_EXCHANGE: '商城兑换',
    SIGN_IN_REWARD: '签到奖励',
    ACTIVITY_BONUS: '活动加成',
    ORDER_EARN: '消费获取',
    EXPIRE_CLEAR: '过期清零',
    FREEZE_OP: '冻结操作',
    UNFREEZE_OP: '解冻操作',
    REVERSE_OP: '冲正操作',
    REGISTER_REWARD: '注册奖励',
    OTHER: '其他',
  };

  const rows = result.list.map((tx) => [
    tx.serialNo,
    tx.member?.name || '',
    tx.member?.phone || '',
    changeTypeMap[tx.changeType] || tx.changeType,
    tx.changeValue,
    tx.balanceBefore,
    tx.balanceAfter,
    reasonTypeMap[tx.reasonType] || tx.reasonType,
    tx.bizOrderNo || '',
    tx.bizOrderType || '',
    tx.operator?.username || '',
    tx.remark || '',
    tx.createdAt.toLocaleString('zh-CN', { hour12: false }),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((cell) => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  return '\uFEFF' + csvContent;
};

module.exports = {
  createTransaction,
  reverseTransaction,
  queryTransactions,
  getTransactionById,
  getMemberTrend,
  getReasonStats,
  exportTransactionsToCsv,
  generateSerialNo,
};
