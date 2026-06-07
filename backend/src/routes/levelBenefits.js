const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { z } = require('zod');
const {
  LevelBenefitCreateSchema,
  LevelBenefitUpdateSchema,
  LevelBenefitStatusSchema,
  LevelBenefitQuerySchema,
  LevelBenefitReorderSchema,
  LevelBenefitCopySchema,
} = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');
const {
  validateStatusTransition,
  createVersion,
  reorderBenefits,
  copyBenefit,
  getImpactPreview,
  getLevelBenefitsSummary,
} = require('../services/levelBenefitService');

router.get('/summary', authenticate, async (req, res) => {
  try {
    const data = await getLevelBenefitsSummary();
    res.json(data);
  } catch (error) {
    logger.error('Error fetching level benefits summary', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const validated = LevelBenefitQuerySchema.parse(req.query);
    const { level, status, isEnabled, page, pageSize } = validated;

    const where = {};
    if (level) where.level = level;
    if (status) where.status = status;
    if (isEnabled !== undefined && isEnabled !== '') {
      where.isEnabled = isEnabled === 'true';
    }

    const [list, total] = await Promise.all([
      prisma.levelBenefit.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
        include: {
          operator: { select: { id: true, username: true } },
          _count: { select: { versions: true } },
        },
      }),
      prisma.levelBenefit.count({ where }),
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
    logger.error('Error fetching level benefits', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/all-by-level', authenticate, async (req, res) => {
  try {
    const levels = ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'];
    const result = {};
    for (const level of levels) {
      result[level] = await prisma.levelBenefit.findMany({
        where: { level },
        orderBy: { sortOrder: 'asc' },
        include: {
          operator: { select: { id: true, username: true } },
          _count: { select: { versions: true } },
        },
      });
    }
    res.json(result);
  } catch (error) {
    logger.error('Error fetching all level benefits by level', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const benefit = await prisma.levelBenefit.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, username: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { operator: { select: { id: true, username: true } } },
        },
      },
    });
    if (!benefit) return res.status(404).json({ error: '权益不存在' });
    res.json(benefit);
  } catch (error) {
    logger.error('Error fetching level benefit', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const versions = await prisma.levelBenefitVersion.findMany({
      where: { benefitId: id },
      orderBy: { version: 'desc' },
      include: { operator: { select: { id: true, username: true } } },
    });
    res.json(versions);
  } catch (error) {
    logger.error('Error fetching level benefit versions', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/impact-preview', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const newData = req.body || {};
    const preview = await getImpactPreview(id, newData);
    res.json(preview);
  } catch (error) {
    logger.error('Error fetching impact preview', { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = LevelBenefitCreateSchema.parse(req.body);

    const existingCount = await prisma.levelBenefit.count({ where: { level: validatedData.level } });

    const benefit = await prisma.levelBenefit.create({
      data: {
        ...validatedData,
        sortOrder: validatedData.sortOrder || existingCount,
        operatorId: req.user?.id || null,
      },
    });

    await createVersion(benefit, req.user?.id || null, '创建权益');

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_CREATE',
      entityType: 'LEVEL_BENEFIT',
      entityId: benefit.id,
      afterSnapshot: benefit,
      req,
      remark: `创建等级权益: ${benefit.title} (${benefit.level})`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(benefit);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_CREATE',
      entityType: 'LEVEL_BENEFIT',
      req,
      remark: '创建等级权益失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating level benefit', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeBenefit = await prisma.levelBenefit.findUnique({ where: { id } });
    if (!beforeBenefit) return res.status(404).json({ error: '权益不存在' });

    if (beforeBenefit.status === 'PUBLISHED') {
      return res.status(400).json({ error: '已发布的权益无法直接编辑，请先撤回草稿或创建新版本' });
    }

    const validatedData = LevelBenefitUpdateSchema.parse(req.body);

    const benefit = await prisma.levelBenefit.update({
      where: { id },
      data: {
        ...validatedData,
        operatorId: req.user?.id || null,
      },
    });

    await createVersion(benefit, req.user?.id || null, '更新权益内容');

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_UPDATE',
      entityType: 'LEVEL_BENEFIT',
      entityId: id,
      beforeSnapshot: beforeBenefit,
      afterSnapshot: benefit,
      req,
      remark: `更新等级权益: ${benefit.title}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(benefit);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_UPDATE',
      entityType: 'LEVEL_BENEFIT',
      entityId: req.params.id,
      req,
      remark: '更新等级权益失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating level benefit', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeBenefit = await prisma.levelBenefit.findUnique({ where: { id } });
    if (!beforeBenefit) return res.status(404).json({ error: '权益不存在' });

    if (beforeBenefit.status === 'PUBLISHED') {
      return res.status(400).json({ error: '已发布的权益无法删除，请先撤回草稿' });
    }

    await prisma.levelBenefitVersion.deleteMany({ where: { benefitId: id } });
    await prisma.levelBenefit.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_DELETE',
      entityType: 'LEVEL_BENEFIT',
      entityId: id,
      beforeSnapshot: beforeBenefit,
      req,
      remark: `删除等级权益: ${beforeBenefit.title}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_DELETE',
      entityType: 'LEVEL_BENEFIT',
      entityId: req.params.id,
      req,
      remark: '删除等级权益失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting level benefit', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/reorder', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const { items } = LevelBenefitReorderSchema.parse(req.body);
    const result = await reorderBenefits(items, req.user?.id || null);

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_REORDER',
      entityType: 'LEVEL_BENEFIT',
      afterSnapshot: { items },
      req,
      remark: `重新排序 ${items.length} 个等级权益`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_REORDER',
      entityType: 'LEVEL_BENEFIT',
      req,
      remark: '权益排序失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error reordering level benefits', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/copy', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const { sourceId, targetLevel, withSortOrder } = LevelBenefitCopySchema.parse(req.body);
    const newBenefit = await copyBenefit(sourceId, targetLevel, withSortOrder, req.user);

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_COPY',
      entityType: 'LEVEL_BENEFIT',
      entityId: newBenefit.id,
      afterSnapshot: { sourceId, targetLevel, newBenefitId: newBenefit.id },
      req,
      remark: `复制权益 #${sourceId} 到 ${targetLevel}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(newBenefit);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_COPY',
      entityType: 'LEVEL_BENEFIT',
      req,
      remark: '复制权益失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error copying level benefit', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/:id/status', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { status, remark } = LevelBenefitStatusSchema.parse(req.body);

    const beforeBenefit = await prisma.levelBenefit.findUnique({ where: { id } });
    if (!beforeBenefit) return res.status(404).json({ error: '权益不存在' });

    if (!validateStatusTransition(beforeBenefit.status, status)) {
      return res.status(400).json({ error: `无法从 ${beforeBenefit.status} 变更到 ${status}` });
    }

    const benefit = await prisma.levelBenefit.update({
      where: { id },
      data: {
        status,
        operatorId: req.user?.id || null,
      },
    });

    await createVersion(benefit, req.user?.id || null, `状态变更: ${beforeBenefit.status} → ${status}${remark ? '，' + remark : ''}`);

    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_STATUS_CHANGE',
      entityType: 'LEVEL_BENEFIT',
      entityId: id,
      beforeSnapshot: beforeBenefit,
      afterSnapshot: benefit,
      req,
      remark: `权益状态变更: ${beforeBenefit.status} → ${status}${remark ? '，' + remark : ''}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(benefit);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'LEVEL_BENEFIT_STATUS_CHANGE',
      entityType: 'LEVEL_BENEFIT',
      entityId: req.params.id,
      req,
      remark: '权益状态变更失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error changing level benefit status', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
