const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditLog');
const {
  getBirthdaysByScope,
  getCalendarBirthdays,
  getDashboardStats,
  getWishTemplates,
  upsertWishTemplate,
  getPointsRules,
  upsertPointsRule,
  getCareConfig,
  updateCareConfig,
  executeBirthdayCare,
  getCareRecords,
  getMemberCareHistory,
} = require('../services/birthdayService');
const {
  BirthdayWishTemplateSchema,
  BirthdayWishTemplateUpdateSchema,
  BirthdayPointsRuleSchema,
  BirthdayPointsRuleUpdateSchema,
  BirthdayCareConfigSchema,
  BirthdayCareExecuteSchema,
  BirthdayCareRecordQuerySchema,
  BirthdayQuerySchema,
} = require('../validations/schemas');
const { z } = require('zod');

router.get('/members', authenticate, async (req, res) => {
  try {
    const validated = BirthdayQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ error: validated.error.errors });
    }
    const { scope, year, month, level } = validated.data;
    const members = await getBirthdaysByScope({ scope, year, month, level });
    res.json(members);
  } catch (error) {
    logger.error('Error fetching birthday members', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/calendar', authenticate, async (req, res) => {
  try {
    const validated = BirthdayQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ error: validated.error.errors });
    }
    const { year, month, level } = validated.data;
    const now = new Date();
    const calendar = await getCalendarBirthdays(
      year || now.getFullYear(),
      month || (now.getMonth() + 1),
      level
    );
    res.json(calendar);
  } catch (error) {
    logger.error('Error fetching birthday calendar', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching birthday dashboard stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/templates', authenticate, async (req, res) => {
  try {
    const templates = await getWishTemplates();
    res.json(templates);
  } catch (error) {
    logger.error('Error fetching wish templates', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/templates', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = BirthdayWishTemplateSchema.parse(req.body);
    const beforeTemplate = await prisma.birthdayWishTemplate.findUnique({
      where: { level: validatedData.level },
    });
    const template = await upsertWishTemplate(validatedData, req.user?.id || null);

    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'BIRTHDAY_WISH_TEMPLATE',
      entityId: template.id,
      beforeSnapshot: beforeTemplate,
      afterSnapshot: template,
      req,
      remark: `更新生日祝福语模板: ${validatedData.level}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(template);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'BIRTHDAY_WISH_TEMPLATE',
      req,
      remark: '更新生日祝福语模板失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error upserting wish template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/points-rules', authenticate, async (req, res) => {
  try {
    const rules = await getPointsRules();
    res.json(rules);
  } catch (error) {
    logger.error('Error fetching points rules', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/points-rules', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = BirthdayPointsRuleSchema.parse(req.body);
    const beforeRule = await prisma.birthdayPointsRule.findUnique({
      where: { level: validatedData.level },
    });
    const rule = await upsertPointsRule(validatedData, req.user?.id || null);

    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'BIRTHDAY_POINTS_RULE',
      entityId: rule.id,
      beforeSnapshot: beforeRule,
      afterSnapshot: rule,
      req,
      remark: `更新生日积分规则: ${validatedData.level}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(rule);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'BIRTHDAY_POINTS_RULE',
      req,
      remark: '更新生日积分规则失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error upserting points rule', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await getCareConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching care config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/config', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = BirthdayCareConfigSchema.parse(req.body);
    const beforeConfig = await getCareConfig();
    const config = await updateCareConfig(validatedData, req.user?.id || null);

    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'SYSTEM',
      entityId: config.id,
      beforeSnapshot: beforeConfig,
      afterSnapshot: config,
      req,
      remark: '更新生日关怀配置',
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(config);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CONFIG_UPDATE',
      entityType: 'SYSTEM',
      req,
      remark: '更新生日关怀配置失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating care config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/execute', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = BirthdayCareExecuteSchema.parse(req.body);
    const result = await executeBirthdayCare({
      ...validatedData,
      operatorId: req.user?.id || null,
    });

    await createAuditLog({
      operator: req.user,
      actionType: validatedData.memberIds?.length > 1 ? 'BIRTHDAY_CARE_BATCH' : 'BIRTHDAY_CARE_EXECUTE',
      entityType: 'BIRTHDAY_CARE_RECORD',
      req,
      remark: `执行生日关怀: 总计${result.total}人, 成功${result.success}人, 失败${result.failed}人, 跳过${result.skipped}人`,
      durationMs: Date.now() - startTime,
      resultStatus: result.failed > 0 ? 'PARTIAL' : 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'BIRTHDAY_CARE_EXECUTE',
      entityType: 'BIRTHDAY_CARE_RECORD',
      req,
      remark: '执行生日关怀失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error executing birthday care', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.get('/records', authenticate, async (req, res) => {
  try {
    const validated = BirthdayCareRecordQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ error: validated.error.errors });
    }
    const result = await getCareRecords(validated.data);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching care records', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/members/:id/history', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const history = await getMemberCareHistory(id);
    res.json(history);
  } catch (error) {
    logger.error('Error fetching member care history', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
