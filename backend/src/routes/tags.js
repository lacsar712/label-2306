const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  TagGroupSchema,
  TagGroupUpdateSchema,
  TagSchema,
  TagUpdateSchema,
  MemberTagBindSchema,
  MemberTagUnbindSchema,
  BatchTagApplySchema,
} = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');
const {
  previewRuleMatches,
  applyTagToMembers,
  unbindTagFromMembers,
  runAutoTagRule,
  getTagStats,
} = require('../services/tagService');

// ==================== Tag Group Routes ====================

router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await prisma.tagGroup.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        tags: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { memberTags: true } } },
        },
      },
    });
    res.json(groups);
  } catch (error) {
    logger.error('Error fetching tag groups', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/groups', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = TagGroupSchema.parse(req.body);
    const group = await prisma.tagGroup.create({ data: validatedData });

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_CREATE',
      entityType: 'TAG_GROUP',
      entityId: group.id,
      afterSnapshot: group,
      req,
      remark: `创建标签分组: ${group.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(group);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_CREATE',
      entityType: 'TAG_GROUP',
      req,
      remark: '创建标签分组失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '标签分组名称已存在' });
    }
    logger.error('Error creating tag group', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/groups/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeGroup = await prisma.tagGroup.findUnique({ where: { id } });
    const validatedData = TagGroupUpdateSchema.parse(req.body);
    const group = await prisma.tagGroup.update({ where: { id }, data: validatedData });

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_UPDATE',
      entityType: 'TAG_GROUP',
      entityId: id,
      beforeSnapshot: beforeGroup,
      afterSnapshot: group,
      req,
      remark: `更新标签分组: ${group.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(group);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_UPDATE',
      entityType: 'TAG_GROUP',
      entityId: req.params.id,
      req,
      remark: '更新标签分组失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '标签分组名称已存在' });
    }
    logger.error('Error updating tag group', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/groups/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeGroup = await prisma.tagGroup.findUnique({ where: { id } });

    await prisma.tag.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.tagGroup.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_DELETE',
      entityType: 'TAG_GROUP',
      entityId: id,
      beforeSnapshot: beforeGroup,
      req,
      remark: `删除标签分组: ${beforeGroup?.name || 'ID=' + id}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_GROUP_DELETE',
      entityType: 'TAG_GROUP',
      entityId: req.params.id,
      req,
      remark: '删除标签分组失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting tag group', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==================== Tag Routes ====================

router.get('/', authenticate, async (req, res) => {
  try {
    const { groupId, search } = req.query;
    const where = {};

    if (groupId) where.groupId = parseInt(groupId) === 0 ? null : parseInt(groupId);
    if (search) where.name = { contains: search };

    const tags = await prisma.tag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        group: true,
        _count: { select: { memberTags: true } },
      },
    });
    res.json(tags);
  } catch (error) {
    logger.error('Error fetching tags', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const data = await getTagStats();
    res.json(data);
  } catch (error) {
    logger.error('Error fetching tag stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tag = await prisma.tag.findUnique({
      where: { id },
      include: {
        group: true,
        _count: { select: { memberTags: true } },
      },
    });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (error) {
    logger.error('Error fetching tag', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = TagSchema.parse(req.body);
    const tag = await prisma.tag.create({ data: validatedData });

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_CREATE',
      entityType: 'TAG',
      entityId: tag.id,
      afterSnapshot: tag,
      req,
      remark: `创建标签: ${tag.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(tag);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_CREATE',
      entityType: 'TAG',
      req,
      remark: '创建标签失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating tag', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeTag = await prisma.tag.findUnique({ where: { id } });
    const validatedData = TagUpdateSchema.parse(req.body);
    const tag = await prisma.tag.update({ where: { id }, data: validatedData });

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_UPDATE',
      entityType: 'TAG',
      entityId: id,
      beforeSnapshot: beforeTag,
      afterSnapshot: tag,
      req,
      remark: `更新标签: ${tag.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(tag);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_UPDATE',
      entityType: 'TAG',
      entityId: req.params.id,
      req,
      remark: '更新标签失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating tag', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeTag = await prisma.tag.findUnique({ where: { id } });

    await prisma.$transaction([
      prisma.memberTag.deleteMany({ where: { tagId: id } }),
      prisma.tagBindingHistory.deleteMany({ where: { tagId: id } }),
      prisma.tag.delete({ where: { id } }),
    ]);

    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_DELETE',
      entityType: 'TAG',
      entityId: id,
      beforeSnapshot: beforeTag,
      req,
      remark: `删除标签: ${beforeTag?.name || 'ID=' + id}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'TAG_DELETE',
      entityType: 'TAG',
      entityId: req.params.id,
      req,
      remark: '删除标签失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting tag', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==================== Tag Rule Routes ====================

router.get('/:id/preview', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await previewRuleMatches(id);
    res.json(result);
  } catch (error) {
    logger.error('Error previewing rule matches', { id: req.params.id, error: error.message });
    if (error.message === 'Tag not found') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/run-rule', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await runAutoTagRule(id, req.user);
    res.json(result);
  } catch (error) {
    logger.error('Error running auto tag rule', { id: req.params.id, error: error.message });
    if (error.message === 'Tag not found') {
      return res.status(404).json({ error: 'Tag not found' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch-apply', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const { tagId, memberIds, remark } = BatchTagApplySchema.parse(req.body);
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    const result = await applyTagToMembers(tagId, memberIds, 'BATCH', req.user, remark);

    await createAuditLog({
      operator: req.user,
      actionType: 'BATCH_OPERATION',
      entityType: 'MEMBER_TAG',
      entityId: tagId,
      afterSnapshot: { tagId, memberIds, result },
      req,
      remark: `批量打标: ${tag?.name || 'ID=' + tagId}, 共 ${memberIds.length} 人, 成功 ${result.success.length} 人`,
      durationMs: Date.now() - startTime,
      resultStatus: result.failed.length > 0 ? 'PARTIAL' : 'SUCCESS',
      errorMessage: result.failed.length > 0 ? `失败 ${result.failed.length} 人` : null,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error batch applying tags', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==================== Member Tag Routes ====================

router.get('/members/:memberId', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const memberTags = await prisma.memberTag.findMany({
      where: { memberId },
      include: {
        tag: { include: { group: true } },
        operator: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(memberTags);
  } catch (error) {
    logger.error('Error fetching member tags', { memberId: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/members/:memberId/bind', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const memberId = parseInt(req.params.memberId);
    const { tagIds, remark } = MemberTagBindSchema.parse(req.body);
    const results = { success: [], failed: [], skipped: [] };

    for (const tagId of tagIds) {
      const result = await applyTagToMembers(tagId, [memberId], 'MANUAL', req.user, remark);
      if (result.success.length > 0) results.success.push(tagId);
      else if (result.skipped.length > 0) results.skipped.push(tagId);
      else results.failed.push(tagId);
    }

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_TAG_BIND',
      entityType: 'MEMBER_TAG',
      entityId: memberId,
      afterSnapshot: { memberId, tagIds, result: results },
      req,
      remark: `会员 ${memberId} 手动绑定标签: ${tagIds.join(', ')}`,
      durationMs: Date.now() - startTime,
      resultStatus: results.failed.length > 0 ? 'PARTIAL' : 'SUCCESS',
    });

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error binding tags to member', { memberId: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/members/:memberId/unbind', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const memberId = parseInt(req.params.memberId);
    const { tagIds, remark } = MemberTagUnbindSchema.parse(req.body);
    const results = { success: [], failed: [], skipped: [] };

    for (const tagId of tagIds) {
      const result = await unbindTagFromMembers(tagId, [memberId], 'MANUAL', req.user, remark);
      if (result.success.length > 0) results.success.push(tagId);
      else if (result.skipped.length > 0) results.skipped.push(tagId);
      else results.failed.push(tagId);
    }

    await createAuditLog({
      operator: req.user,
      actionType: 'MEMBER_TAG_UNBIND',
      entityType: 'MEMBER_TAG',
      entityId: memberId,
      afterSnapshot: { memberId, tagIds, result: results },
      req,
      remark: `会员 ${memberId} 手动解绑标签: ${tagIds.join(', ')}`,
      durationMs: Date.now() - startTime,
      resultStatus: results.failed.length > 0 ? 'PARTIAL' : 'SUCCESS',
    });

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error unbinding tags from member', { memberId: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/members/:memberId/history', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const { page = 1, pageSize = 20 } = req.query;

    const [list, total] = await Promise.all([
      prisma.tagBindingHistory.findMany({
        where: { memberId },
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize),
        orderBy: { createdAt: 'desc' },
        include: {
          tag: true,
          operator: { select: { id: true, username: true } },
        },
      }),
      prisma.tagBindingHistory.count({ where: { memberId } }),
    ]);

    res.json({
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / parseInt(pageSize)),
    });
  } catch (error) {
    logger.error('Error fetching member tag history', { memberId: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
