const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  CouponCreateSchema,
  CouponUpdateSchema,
  CouponStatusChangeSchema,
  CouponIssueSchema,
  CouponQuerySchema,
  MemberCouponQuerySchema,
  CouponRedeemSchema,
  CouponRefundSchema,
} = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');
const {
  validateStatusTransition,
  issueCoupons,
  redeemMemberCoupon,
  refundMemberCoupon,
  lockMemberCoupon,
  getCouponStats,
} = require('../services/couponService');

router.get('/stats', authenticate, async (req, res) => {
  try {
    const data = await getCouponStats();
    res.json(data);
  } catch (error) {
    logger.error('Error fetching coupon stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const validated = CouponQuerySchema.parse(req.query);
    const { search, type, status, shelfStatus, page, pageSize } = validated;

    const where = {};
    if (search) where.name = { contains: search };
    if (type) where.type = type;
    if (status) where.status = status;
    if (shelfStatus !== undefined && shelfStatus !== '') {
      where.shelfStatus = shelfStatus === 'true';
    }

    const [list, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, username: true } },
          _count: { select: { memberCoupons: true } },
        },
      }),
      prisma.coupon.count({ where }),
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
    logger.error('Error fetching coupons', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, username: true } },
        issueBatches: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { id: true, username: true } } },
        },
      },
    });
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    res.json(coupon);
  } catch (error) {
    logger.error('Error fetching coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = CouponCreateSchema.parse(req.body);
    const coupon = await prisma.coupon.create({
      data: {
        ...validatedData,
        validFrom: validatedData.validFrom ? new Date(validatedData.validFrom) : null,
        validTo: validatedData.validTo ? new Date(validatedData.validTo) : null,
        operatorId: req.user?.id || null,
      },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_CREATE',
      entityType: 'COUPON',
      entityId: coupon.id,
      afterSnapshot: coupon,
      req,
      remark: `创建优惠券: ${coupon.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(coupon);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_CREATE',
      entityType: 'COUPON',
      req,
      remark: '创建优惠券失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating coupon', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeCoupon = await prisma.coupon.findUnique({ where: { id } });
    if (!beforeCoupon) return res.status(404).json({ error: 'Coupon not found' });

    if (beforeCoupon.status !== 'DRAFT' && beforeCoupon.status !== 'PENDING_REVIEW') {
      return res.status(400).json({ error: '当前状态下无法编辑优惠券' });
    }

    const validatedData = CouponUpdateSchema.parse(req.body);
    const updateData = { ...validatedData };
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom);
    if (updateData.validTo) updateData.validTo = new Date(updateData.validTo);

    const coupon = await prisma.coupon.update({ where: { id }, data: updateData });

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_UPDATE',
      entityType: 'COUPON',
      entityId: id,
      beforeSnapshot: beforeCoupon,
      afterSnapshot: coupon,
      req,
      remark: `更新优惠券: ${coupon.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(coupon);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_UPDATE',
      entityType: 'COUPON',
      entityId: req.params.id,
      req,
      remark: '更新优惠券失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeCoupon = await prisma.coupon.findUnique({ where: { id } });
    if (!beforeCoupon) return res.status(404).json({ error: 'Coupon not found' });

    if (beforeCoupon.status === 'PUBLISHED') {
      return res.status(400).json({ error: '已发布的优惠券无法删除，请先结束' });
    }

    const memberCouponCount = await prisma.memberCoupon.count({ where: { couponId: id } });
    if (memberCouponCount > 0) {
      return res.status(400).json({ error: '已有会员领取该优惠券，无法删除' });
    }

    await prisma.couponIssueBatch.deleteMany({ where: { couponId: id } });
    await prisma.coupon.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_DELETE',
      entityType: 'COUPON',
      entityId: id,
      beforeSnapshot: beforeCoupon,
      req,
      remark: `删除优惠券: ${beforeCoupon.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_DELETE',
      entityType: 'COUPON',
      entityId: req.params.id,
      req,
      remark: '删除优惠券失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/status', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { status, remark } = CouponStatusChangeSchema.parse(req.body);

    const beforeCoupon = await prisma.coupon.findUnique({ where: { id } });
    if (!beforeCoupon) return res.status(404).json({ error: 'Coupon not found' });

    if (!validateStatusTransition(beforeCoupon.status, status)) {
      return res.status(400).json({ error: `无法从 ${beforeCoupon.status} 变更到 ${status}` });
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: { status },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_STATUS_CHANGE',
      entityType: 'COUPON',
      entityId: id,
      beforeSnapshot: beforeCoupon,
      afterSnapshot: coupon,
      req,
      remark: `优惠券状态变更: ${beforeCoupon.status} → ${status} ${remark ? '，' + remark : ''}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(coupon);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_STATUS_CHANGE',
      entityType: 'COUPON',
      entityId: req.params.id,
      req,
      remark: '优惠券状态变更失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error changing coupon status', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/issue', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { couponId, targetType, targetIds, scheduledAt, expireReminder } = CouponIssueSchema.parse(req.body);

    const result = await issueCoupons({
      couponId,
      targetType,
      targetIds,
      scheduledAt,
      expireReminder,
      operator: req.user,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_ISSUE',
      entityType: 'COUPON',
      entityId: couponId,
      afterSnapshot: { couponId, targetType, targetIds, result },
      req,
      remark: `批量发放优惠券: 目标 ${targetType}，共发放 ${result.success} 张，失败 ${result.failed} 张，跳过 ${result.skipped} 张`,
      durationMs: Date.now() - startTime,
      resultStatus: result.failed > 0 ? 'PARTIAL' : 'SUCCESS',
      errorMessage: result.failed > 0 ? `失败 ${result.failed} 张` : null,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error issuing coupons', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.get('/member-coupons', authenticate, async (req, res) => {
  try {
    const validated = MemberCouponQuerySchema.parse(req.query);
    const { couponId, memberId, status, page, pageSize } = validated;

    const where = {};
    if (couponId) where.couponId = couponId;
    if (memberId) where.memberId = memberId;
    if (status) where.status = status;

    const [list, total] = await Promise.all([
      prisma.memberCoupon.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { claimedAt: 'desc' },
        include: {
          coupon: { select: { id: true, name: true, type: true, value: true, minConsume: true } },
          member: { select: { id: true, name: true, phone: true, level: true } },
          issueBatch: true,
        },
      }),
      prisma.memberCoupon.count({ where }),
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
    logger.error('Error fetching member coupons', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/member-coupons/:id/redeem', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { orderNo, remark } = CouponRedeemSchema.parse(req.body);

    const result = await redeemMemberCoupon(id, orderNo, remark);

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_REDEEM',
      entityType: 'COUPON',
      entityId: result.couponId,
      afterSnapshot: { memberCouponId: id, orderNo, result },
      req,
      remark: `核销优惠券: ${result.code}，订单号: ${orderNo}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error redeeming coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/member-coupons/:id/refund', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { remark } = CouponRefundSchema.parse(req.body);

    const result = await refundMemberCoupon(id, remark);

    await createAuditLog({
      operator: req.user,
      actionType: 'COUPON_REFUND',
      entityType: 'COUPON',
      entityId: result.couponId,
      afterSnapshot: { memberCouponId: id, result },
      req,
      remark: `退回优惠券: ${result.code}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error refunding coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/member-coupons/:id/lock', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { orderNo } = req.body;
    const result = await lockMemberCoupon(id, orderNo);
    res.json(result);
  } catch (error) {
    logger.error('Error locking coupon', { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.get('/:id/members', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, pageSize = 20 } = req.query;

    const [list, total] = await Promise.all([
      prisma.memberCoupon.findMany({
        where: { couponId: id },
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize),
        orderBy: { claimedAt: 'desc' },
        include: {
          member: { select: { id: true, name: true, phone: true, level: true } },
          issueBatch: true,
        },
      }),
      prisma.memberCoupon.count({ where: { couponId: id } }),
    ]);

    res.json({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / parseInt(pageSize)),
    });
  } catch (error) {
    logger.error('Error fetching coupon members', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
