const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { MemberSchema, PointsUpdateSchema, FreezePointsSchema } = require('../validations/schemas');
const { z } = require('zod');
const { createTransaction } = require('../services/pointsTransaction');
const { createAuditLog } = require('../services/auditLog');

// Get all members
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, level, status } = req.query;
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }
    if (level) where.level = level;
    if (status) where.status = status;

    const members = await prisma.member.findMany({
      where,
      orderBy: { joinDate: 'desc' }
    });
    res.json(members);
  } catch (error) {
    logger.error('Error fetching members', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create member
router.post('/', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = MemberSchema.parse(req.body);
    const member = await prisma.member.create({
      data: validatedData
    });

    if (validatedData.points && validatedData.points > 0) {
      try {
        await createTransaction({
          memberId: member.id,
          points: validatedData.points,
          reasonType: 'REGISTER_REWARD',
          operatorId: req.user?.id || null,
          remark: '注册赠送积分',
        });
      } catch (txError) {
        logger.warn('Failed to create register reward transaction', { memberId: member.id, error: txError.message });
      }
    }

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_CREATE',
      entityType: 'MEMBER',
      entityId: member.id,
      afterSnapshot: member,
      req,
      remark: `创建会员: ${member.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(member);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_CREATE',
      entityType: 'MEMBER',
      req,
      remark: '创建会员失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    logger.error('Error creating member', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member
router.put('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeMember = await prisma.member.findUnique({ where: { id } });
    const validatedData = MemberSchema.partial().parse(req.body);
    const member = await prisma.member.update({
      where: { id },
      data: validatedData
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_UPDATE',
      entityType: 'MEMBER',
      entityId: id,
      beforeSnapshot: beforeMember,
      afterSnapshot: member,
      req,
      remark: `更新会员: ${member.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(member);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_UPDATE',
      entityType: 'MEMBER',
      entityId: req.params.id,
      req,
      remark: '更新会员失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete member
router.delete('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeMember = await prisma.member.findUnique({ where: { id } });
    await prisma.member.delete({
      where: { id }
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_DELETE',
      entityType: 'MEMBER',
      entityId: id,
      beforeSnapshot: beforeMember,
      req,
      remark: `删除会员: ${beforeMember?.name || 'ID=' + id}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_DELETE',
      entityType: 'MEMBER',
      entityId: req.params.id,
      req,
      remark: '删除会员失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member points (with transaction recording)
router.post('/:id/points', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { points, reasonType, bizOrderNo, bizOrderType, remark } = PointsUpdateSchema.parse(req.body);

    if (points === 0) {
      return res.status(400).json({ error: 'Points change cannot be zero' });
    }

    const beforeMember = await prisma.member.findUnique({ where: { id } });

    const transaction = await createTransaction({
      memberId: id,
      points,
      reasonType: reasonType || 'MANUAL_ADJUST',
      bizOrderNo: bizOrderNo || null,
      bizOrderType: bizOrderType || null,
      operatorId: req.user?.id || null,
      remark: remark || null,
    });

    const member = await prisma.member.findUnique({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_ADJUST',
      entityType: 'MEMBER',
      entityId: id,
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, pointsChange: points },
      req,
      remark: `${points > 0 ? '增加' : '扣除'}积分 ${Math.abs(points)} | ${remark || reasonType || 'MANUAL_ADJUST'}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json({ member, transaction });
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_ADJUST',
      entityType: 'MEMBER',
      entityId: req.params.id,
      req,
      remark: '积分调整失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error updating member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Freeze member points
router.post('/:id/freeze', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { points, reasonType, bizOrderNo, bizOrderType, remark } = FreezePointsSchema.parse(req.body);

    const beforeMember = await prisma.member.findUnique({ where: { id } });

    const transaction = await createTransaction({
      memberId: id,
      points: -points,
      reasonType: reasonType || 'FREEZE_OP',
      bizOrderNo: bizOrderNo || null,
      bizOrderType: bizOrderType || null,
      operatorId: req.user?.id || null,
      remark: remark || null,
    });

    const member = await prisma.member.findUnique({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_FREEZE',
      entityType: 'MEMBER',
      entityId: id,
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, frozenPointsChange: points },
      req,
      remark: `冻结积分 ${points} | ${remark || reasonType || 'FREEZE_OP'}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json({ member, transaction });
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_FREEZE',
      entityType: 'MEMBER',
      entityId: req.params.id,
      req,
      remark: '积分冻结失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error freezing member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Unfreeze member points
router.post('/:id/unfreeze', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { points, reasonType, bizOrderNo, bizOrderType, remark } = FreezePointsSchema.parse(req.body);

    const beforeMember = await prisma.member.findUnique({ where: { id } });

    const transaction = await createTransaction({
      memberId: id,
      points: points,
      reasonType: reasonType || 'UNFREEZE_OP',
      bizOrderNo: bizOrderNo || null,
      bizOrderType: bizOrderType || null,
      operatorId: req.user?.id || null,
      remark: remark || null,
    });

    const member = await prisma.member.findUnique({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_UNFREEZE',
      entityType: 'MEMBER',
      entityId: id,
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, frozenPointsChange: -points },
      req,
      remark: `解冻积分 ${points} | ${remark || reasonType || 'UNFREEZE_OP'}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json({ member, transaction });
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_UNFREEZE',
      entityType: 'MEMBER',
      entityId: req.params.id,
      req,
      remark: '积分解冻失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error unfreezing member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get member points transactions
router.get('/:id/transactions', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, pageSize = 20 } = req.query;

    const transactions = await prisma.pointsTransaction.findMany({
      where: { memberId: id },
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      take: parseInt(pageSize),
      orderBy: { createdAt: 'desc' },
      include: {
        operator: { select: { id: true, username: true } },
        reverseOf: { select: { id: true, serialNo: true, changeType: true, changeValue: true } },
      },
    });

    const total = await prisma.pointsTransaction.count({ where: { memberId: id } });

    res.json({
      list: transactions,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / parseInt(pageSize)),
    });
  } catch (error) {
    logger.error('Error fetching member transactions', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
