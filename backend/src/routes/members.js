const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const { createAuditLog } = require('../services/auditLog');
const {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  adjustMemberPoints,
  freezeMemberPoints,
  unfreezeMemberPoints,
  getMemberTransactions,
  getMemberLevelBenefits,
} = require('../services/memberService');

function handleError(res, error, defaultMsg = 'Internal Server Error') {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.errors });
  }
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.code === 'P2002') {
    return res.status(400).json({ error: 'Phone number already exists' });
  }
  logger.error('Request error', { error: error.message });
  res.status(500).json({ error: defaultMsg });
}

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await listMembers(req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Error fetching members');
  }
});

router.post('/', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const member = await createMember(req.body, req.user?.id);

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

    handleError(res, error, 'Error creating member');
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { beforeMember, member } = await updateMember(req.params.id, req.body);

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_UPDATE',
      entityType: 'MEMBER',
      entityId: parseInt(req.params.id),
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

    handleError(res, error, 'Error updating member');
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const beforeMember = await deleteMember(req.params.id);

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_DELETE',
      entityType: 'MEMBER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeMember,
      req,
      remark: `删除会员: ${beforeMember?.name || 'ID=' + req.params.id}`,
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

    handleError(res, error, 'Error deleting member');
  }
});

router.post('/:id/points', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { beforeMember, member, transaction, pointsAdjusted } = await adjustMemberPoints(
      req.params.id,
      req.body,
      req.user?.id
    );

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_ADJUST',
      entityType: 'MEMBER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, pointsChange: pointsAdjusted },
      req,
      remark: `${pointsAdjusted > 0 ? '增加' : '扣除'}积分 ${Math.abs(pointsAdjusted)} | ${req.body.remark || req.body.reasonType || 'MANUAL_ADJUST'}`,
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

    handleError(res, error, 'Error updating member points');
  }
});

router.post('/:id/freeze', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { beforeMember, member, transaction, pointsFrozen } = await freezeMemberPoints(
      req.params.id,
      req.body,
      req.user?.id
    );

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_FREEZE',
      entityType: 'MEMBER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, frozenPointsChange: pointsFrozen },
      req,
      remark: `冻结积分 ${pointsFrozen} | ${req.body.remark || req.body.reasonType || 'FREEZE_OP'}`,
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

    handleError(res, error, 'Error freezing member points');
  }
});

router.post('/:id/unfreeze', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { beforeMember, member, transaction, pointsUnfrozen } = await unfreezeMemberPoints(
      req.params.id,
      req.body,
      req.user?.id
    );

    await createAuditLog({
      operator: req.user,
      actionType: 'POINTS_UNFREEZE',
      entityType: 'MEMBER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeMember,
      afterSnapshot: { ...member, frozenPointsChange: -pointsUnfrozen },
      req,
      remark: `解冻积分 ${pointsUnfrozen} | ${req.body.remark || req.body.reasonType || 'UNFREEZE_OP'}`,
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

    handleError(res, error, 'Error unfreezing member points');
  }
});

router.get('/:id/transactions', authenticate, async (req, res) => {
  try {
    const result = await getMemberTransactions(req.params.id, req.query);
    res.json(result);
  } catch (error) {
    handleError(res, error, 'Error fetching member transactions');
  }
});

router.get('/:id/benefits', authenticate, async (req, res) => {
  try {
    const benefits = await getMemberLevelBenefits(req.params.id);
    res.json(benefits);
  } catch (error) {
    handleError(res, error, 'Error fetching member benefits');
  }
});

module.exports = router;
