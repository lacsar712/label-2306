const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  ShopCategorySchema,
  ShopCategoryUpdateSchema,
  ShopCategoryQuerySchema,
  ShopProductSchema,
  ShopProductUpdateSchema,
  ShopProductQuerySchema,
  ShopProductStatusSchema,
  ShopBrowseQuerySchema,
  ExchangeCreateSchema,
  ExchangeStatusSchema,
  ExchangeRecordQuerySchema,
} = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');
const {
  createExchangeOrder,
  updateExchangeStatus,
  validateStatusTransition,
  queryExchangeRecords,
  getExchangeStats,
} = require('../services/shopService');

router.get('/categories', authenticate, async (req, res) => {
  try {
    const validated = ShopCategoryQuerySchema.parse(req.query);
    const { isEnabled, page, pageSize } = validated;

    const where = {};
    if (isEnabled !== undefined && isEnabled !== '') {
      where.isEnabled = isEnabled === 'true';
    }

    const [list, total] = await Promise.all([
      prisma.shopCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      prisma.shopCategory.count({ where }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching shop categories', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/categories/all', authenticate, async (req, res) => {
  try {
    const list = await prisma.shopCategory.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    });
    res.json(list);
  } catch (error) {
    logger.error('Error fetching all shop categories', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/categories/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const category = await prisma.shopCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) return res.status(404).json({ error: '分类不存在' });
    res.json(category);
  } catch (error) {
    logger.error('Error fetching shop category', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/categories', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = ShopCategorySchema.parse(req.body);
    const category = await prisma.shopCategory.create({
      data: validatedData,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_CREATE',
      entityType: 'SHOP_CATEGORY',
      entityId: category.id,
      afterSnapshot: category,
      req,
      remark: `创建商品分类: ${category.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(category);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_CREATE',
      entityType: 'SHOP_CATEGORY',
      req,
      remark: '创建商品分类失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '分类名称已存在' });
    }
    logger.error('Error creating shop category', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/categories/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const before = await prisma.shopCategory.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '分类不存在' });

    const validatedData = ShopCategoryUpdateSchema.parse(req.body);
    const category = await prisma.shopCategory.update({
      where: { id },
      data: validatedData,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_UPDATE',
      entityType: 'SHOP_CATEGORY',
      entityId: id,
      beforeSnapshot: before,
      afterSnapshot: category,
      req,
      remark: `更新商品分类: ${category.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(category);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_UPDATE',
      entityType: 'SHOP_CATEGORY',
      entityId: req.params.id,
      req,
      remark: '更新商品分类失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '分类名称已存在' });
    }
    logger.error('Error updating shop category', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/categories/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const before = await prisma.shopCategory.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '分类不存在' });

    const productCount = await prisma.shopProduct.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return res.status(400).json({ error: '该分类下仍有商品，无法删除' });
    }

    await prisma.shopCategory.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_DELETE',
      entityType: 'SHOP_CATEGORY',
      entityId: id,
      beforeSnapshot: before,
      req,
      remark: `删除商品分类: ${before.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_CATEGORY_DELETE',
      entityType: 'SHOP_CATEGORY',
      entityId: req.params.id,
      req,
      remark: '删除商品分类失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting shop category', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/products/stats', authenticate, async (req, res) => {
  try {
    const [total, onShelf, offShelf, draft, lowStock] = await Promise.all([
      prisma.shopProduct.count(),
      prisma.shopProduct.count({ where: { status: 'ON_SHELF' } }),
      prisma.shopProduct.count({ where: { status: 'OFF_SHELF' } }),
      prisma.shopProduct.count({ where: { status: 'DRAFT' } }),
      prisma.shopProduct.count({
        where: {
          status: { not: 'OFF_SHELF' },
        },
      }).then(async () => {
        const products = await prisma.shopProduct.findMany({
          where: { status: { not: 'OFF_SHELF' } },
          select: { id: true, stock: true, lowStockThreshold: true },
        });
        return products.filter(p => p.stock <= p.lowStockThreshold).length;
      }),
    ]);

    res.json({ total, onShelf, offShelf, draft, lowStock });
  } catch (error) {
    logger.error('Error fetching shop product stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/products', authenticate, async (req, res) => {
  try {
    const validated = ShopProductQuerySchema.parse(req.query);
    const { search, categoryId, status, isHot, isNew, lowStock, page, pageSize } = validated;

    const where = {};
    if (search) where.name = { contains: search };
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (isHot !== undefined && isHot !== '') where.isHot = isHot === 'true';
    if (isNew !== undefined && isNew !== '') where.isNew = isNew === 'true';

    let filteredIds = null;
    if (lowStock === 'true') {
      const allProducts = await prisma.shopProduct.findMany({
        where: { status: { not: 'OFF_SHELF' } },
        select: { id: true, stock: true, lowStockThreshold: true },
      });
      filteredIds = allProducts
        .filter(p => p.stock <= p.lowStockThreshold)
        .map(p => p.id);
      where.id = { in: filteredIds.length > 0 ? filteredIds : [-1] };
    }

    const [list, total] = await Promise.all([
      prisma.shopProduct.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true } },
          operator: { select: { id: true, username: true } },
        },
      }),
      prisma.shopProduct.count({ where }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching shop products', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/products/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.shopProduct.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        operator: { select: { id: true, username: true } },
        _count: { select: { exchangeRecords: true } },
      },
    });
    if (!product) return res.status(404).json({ error: '商品不存在' });
    res.json(product);
  } catch (error) {
    logger.error('Error fetching shop product', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/products', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = ShopProductSchema.parse(req.body);
    const product = await prisma.shopProduct.create({
      data: {
        ...validatedData,
        operatorId: req.user?.id || null,
      },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_CREATE',
      entityType: 'SHOP_PRODUCT',
      entityId: product.id,
      afterSnapshot: product,
      req,
      remark: `创建商品: ${product.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(product);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_CREATE',
      entityType: 'SHOP_PRODUCT',
      req,
      remark: '创建商品失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating shop product', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/products/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const before = await prisma.shopProduct.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '商品不存在' });

    const validatedData = ShopProductUpdateSchema.parse(req.body);
    const product = await prisma.shopProduct.update({
      where: { id },
      data: validatedData,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_UPDATE',
      entityType: 'SHOP_PRODUCT',
      entityId: id,
      beforeSnapshot: before,
      afterSnapshot: product,
      req,
      remark: `更新商品: ${product.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(product);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_UPDATE',
      entityType: 'SHOP_PRODUCT',
      entityId: req.params.id,
      req,
      remark: '更新商品失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating shop product', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/products/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const before = await prisma.shopProduct.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '商品不存在' });

    const exchangeCount = await prisma.exchangeRecord.count({ where: { productId: id } });
    if (exchangeCount > 0) {
      return res.status(400).json({ error: '该商品已有兑换记录，无法删除' });
    }

    await prisma.shopProduct.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_DELETE',
      entityType: 'SHOP_PRODUCT',
      entityId: id,
      beforeSnapshot: before,
      req,
      remark: `删除商品: ${before.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_DELETE',
      entityType: 'SHOP_PRODUCT',
      entityId: req.params.id,
      req,
      remark: '删除商品失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting shop product', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/products/:id/status', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { status, remark } = ShopProductStatusSchema.parse(req.body);

    const before = await prisma.shopProduct.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: '商品不存在' });

    const product = await prisma.shopProduct.update({
      where: { id },
      data: { status },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_STATUS_CHANGE',
      entityType: 'SHOP_PRODUCT',
      entityId: id,
      beforeSnapshot: before,
      afterSnapshot: product,
      req,
      remark: `商品状态变更: ${before.status} → ${status} ${remark ? '，' + remark : ''}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(product);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'SHOP_PRODUCT_STATUS_CHANGE',
      entityType: 'SHOP_PRODUCT',
      entityId: req.params.id,
      req,
      remark: '商品状态变更失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error changing shop product status', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/browse', authenticate, async (req, res) => {
  try {
    const validated = ShopBrowseQuerySchema.parse(req.query);
    const { categoryId, isHot, isNew, sortBy, sortOrder, page, pageSize } = validated;

    const where = { status: 'ON_SHELF' };
    if (categoryId) where.categoryId = categoryId;
    if (isHot !== undefined && isHot !== '') where.isHot = isHot === 'true';
    if (isNew !== undefined && isNew !== '') where.isNew = isNew === 'true';

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [list, total, categories] = await Promise.all([
      prisma.shopProduct.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.shopProduct.count({ where }),
      prisma.shopCategory.findMany({
        where: { isEnabled: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      categories,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error browsing shop products', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/browse/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.shopProduct.findUnique({
      where: { id, status: 'ON_SHELF' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
    if (!product) return res.status(404).json({ error: '商品不存在或已下架' });
    res.json(product);
  } catch (error) {
    logger.error('Error fetching browse product detail', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/exchange', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { memberId, productId, quantity, shippingInfo, remark } = ExchangeCreateSchema.parse(req.body);

    const result = await createExchangeOrder({
      memberId,
      productId,
      quantity,
      shippingInfo,
      remark,
      operatorId: req.user?.id || null,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'EXCHANGE_ORDER_CREATE',
      entityType: 'EXCHANGE_RECORD',
      entityId: result.id,
      afterSnapshot: { orderNo: result.orderNo, memberId, productId, quantity, totalPoints: result.totalPoints },
      req,
      remark: `创建兑换单: ${result.orderNo}，商品: ${result.itemName}，消耗积分: ${result.totalPoints}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(result);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'EXCHANGE_ORDER_CREATE',
      entityType: 'EXCHANGE_RECORD',
      req,
      remark: '创建兑换单失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating exchange order', { error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.get('/exchanges/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getExchangeStats({ startDate, endDate });
    res.json(data);
  } catch (error) {
    logger.error('Error fetching exchange stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/exchanges', authenticate, async (req, res) => {
  try {
    const validated = ExchangeRecordQuerySchema.parse(req.query);
    const result = await queryExchangeRecords(validated);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching exchange records', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/exchanges/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await prisma.exchangeRecord.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, name: true, phone: true, level: true, points: true } },
        product: { select: { id: true, name: true, coverImage: true, pointsCost: true } },
        transaction: { select: { id: true, serialNo: true, changeValue: true, balanceBefore: true, balanceAfter: true, createdAt: true } },
        operator: { select: { id: true, username: true } },
        cancelOperator: { select: { id: true, username: true } },
      },
    });
    if (!record) return res.status(404).json({ error: '兑换记录不存在' });
    res.json(record);
  } catch (error) {
    logger.error('Error fetching exchange record', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/exchanges/:id/status', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const data = ExchangeStatusSchema.parse(req.body);

    const isCancel = data.status === 'CANCELLED';

    const result = await updateExchangeStatus(id, data, req.user?.id || null);

    await createAuditLog({
      operator: req.user,
      actionType: isCancel ? 'EXCHANGE_ORDER_CANCEL' : 'EXCHANGE_ORDER_STATUS_CHANGE',
      entityType: 'EXCHANGE_RECORD',
      entityId: id,
      afterSnapshot: { orderNo: result.orderNo, status: result.status },
      req,
      remark: isCancel
        ? `取消兑换单: ${result.orderNo}，退回积分: ${result.totalPoints}${data.cancelReason ? '，原因: ' + data.cancelReason : ''}`
        : `兑换单状态变更: ${result.orderNo} → ${result.status}${data.remark ? '，' + data.remark : ''}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'EXCHANGE_ORDER_STATUS_CHANGE',
      entityType: 'EXCHANGE_RECORD',
      entityId: req.params.id,
      req,
      remark: '兑换单状态变更失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating exchange status', { id: req.params.id, error: error.message });
    res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
  }
});

module.exports = router;
