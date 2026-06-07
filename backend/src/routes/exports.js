const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { ExportTaskCreateSchema, ExportTaskQuerySchema, ExportFieldConfigUpdateSchema } = require('../validations/schemas');
const { z } = require('zod');
const {
  createExportTask,
  queryExportTasks,
  getExportTask,
  incrementDownloadCount,
  getExportFilePath,
  cleanupExpiredExports,
  getAllExportTypes,
  getExportFieldDefs,
  getFieldConfig,
  updateFieldConfig,
  EXPORT_DIR,
  DEFAULT_EXPIRE_DAYS,
} = require('../services/exportService');
const { createAuditLog } = require('../services/auditLog');
const fs = require('fs');
const path = require('path');

router.get('/types', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const types = getAllExportTypes(isAdmin);
    res.json(types);
  } catch (error) {
    logger.error('Error fetching export types', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/types/:exportType/fields', authenticate, async (req, res) => {
  try {
    const { exportType } = req.params;
    const isAdmin = req.user?.role === 'ADMIN';
    const fieldDefs = getExportFieldDefs(exportType, isAdmin);
    if (!fieldDefs) {
      return res.status(400).json({ error: 'Invalid export type' });
    }
    const allowedFields = await getFieldConfig(exportType, isAdmin);
    fieldDefs.fields = fieldDefs.fields.map(f => ({
      ...f,
      allowed: allowedFields.includes(f.key),
    }));
    res.json(fieldDefs);
  } catch (error) {
    logger.error('Error fetching export fields', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/tasks', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validated = ExportTaskCreateSchema.parse(req.body);

    const isAdmin = req.user?.role === 'ADMIN';
    const allowedFields = await getFieldConfig(validated.exportType, isAdmin);
    const invalidFields = validated.fields.filter(f => !allowedFields.includes(f));
    if (invalidFields.length > 0) {
      return res.status(403).json({ error: `无权限导出以下字段: ${invalidFields.join(', ')}` });
    }

    const task = await createExportTask({
      ...validated,
      operator: req.user,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      entityId: task.id,
      afterSnapshot: { exportType: task.exportType, fields: task.fields, filterSummary: task.filterSummary },
      req,
      remark: `创建导出任务: ${validated.exportType}`,
      sensitivityLevel: 'HIGH',
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(task);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      req,
      remark: '创建导出任务失败',
      sensitivityLevel: 'HIGH',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating export task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/tasks', authenticate, async (req, res) => {
  try {
    const validated = ExportTaskQuerySchema.parse(req.query);

    const isAdmin = req.user?.role === 'ADMIN';
    const queryFilters = { ...validated };
    if (!isAdmin) {
      queryFilters.operatorId = req.user.id;
    }

    const result = await queryExportTasks(queryFilters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error listing export tasks', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/tasks/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await getExportTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Export task not found' });
    }

    const isAdmin = req.user?.role === 'ADMIN';
    if (!isAdmin && task.operatorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Error fetching export task', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/tasks/:id/download', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await getExportTask(id);
    if (!task) {
      return res.status(404).json({ error: 'Export task not found' });
    }

    const isAdmin = req.user?.role === 'ADMIN';
    if (!isAdmin && task.operatorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (task.status === 'FAILED') {
      return res.status(400).json({ error: `导出任务失败: ${task.errorMessage || '未知错误'}` });
    }
    if (task.status !== 'COMPLETED') {
      return res.status(400).json({ error: '导出任务尚未完成' });
    }

    const filePath = await getExportFilePath(task);
    if (!filePath) {
      return res.status(404).json({ error: '文件不存在或已过期' });
    }

    await incrementDownloadCount(id);

    const fileName = task.fileName || `export_${task.id}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.download(filePath, fileName);
  } catch (error) {
    logger.error('Error downloading export file', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/tasks/:id/retry', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const existingTask = await getExportTask(id);
    if (!existingTask) {
      return res.status(404).json({ error: 'Export task not found' });
    }

    const isAdmin = req.user?.role === 'ADMIN';
    if (!isAdmin && existingTask.operatorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const task = await createExportTask({
      exportType: existingTask.exportType,
      fields: existingTask.fields,
      filters: existingTask.filters,
      dateRange: existingTask.dateRange,
      sortBy: existingTask.sortBy,
      sortOrder: existingTask.sortOrder,
      operator: req.user,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      entityId: task.id,
      afterSnapshot: { exportType: task.exportType, fields: task.fields, filterSummary: task.filterSummary },
      req,
      remark: `重试导出任务: ${existingTask.exportType} (原任务ID: ${id})`,
      sensitivityLevel: 'HIGH',
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(task);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      req,
      remark: '重试导出任务失败',
      sensitivityLevel: 'HIGH',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error retrying export task', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/configs', authenticate, isAdmin, async (req, res) => {
  try {
    const configs = await prisma.exportFieldConfig.findMany();
    const allTypes = getAllExportTypes(true);
    const result = allTypes.map(type => {
      const existing = configs.find(c => c.exportType === type.type);
      if (existing) {
        return {
          exportType: type.type,
          label: type.label,
          allFields: type.fields,
          adminFields: existing.adminFields,
          userFields: existing.userFields,
        };
      }
      const defaultFields = type.fields.filter(f => !f.adminOnly).map(f => f.key);
      return {
        exportType: type.type,
        label: type.label,
        allFields: type.fields,
        adminFields: type.fields.map(f => f.key),
        userFields: defaultFields,
      };
    });
    res.json(result);
  } catch (error) {
    logger.error('Error fetching export field configs', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/configs/:exportType', authenticate, isAdmin, async (req, res) => {
  try {
    const { exportType } = req.params;
    const validated = ExportFieldConfigUpdateSchema.parse(req.body);

    const fieldDefs = getExportFieldDefs(exportType, true);
    if (!fieldDefs) {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    const allFieldKeys = fieldDefs.fields.map(f => f.key);
    const invalidAdmin = validated.adminFields.filter(f => !allFieldKeys.includes(f));
    const invalidUser = validated.userFields.filter(f => !allFieldKeys.includes(f));
    if (invalidAdmin.length > 0 || invalidUser.length > 0) {
      return res.status(400).json({ error: '包含无效的字段' });
    }

    const nonAdminFields = fieldDefs.fields.filter(f => !f.adminOnly).map(f => f.key);
    const userHasAdminOnly = validated.userFields.filter(f => !nonAdminFields.includes(f));
    if (userHasAdminOnly.length > 0) {
      return res.status(400).json({ error: '普通用户不能被授予管理员专属字段权限' });
    }

    const config = await updateFieldConfig(exportType, validated.adminFields, validated.userFields, req.user);

    await createAuditLog({
      operator: req.user,
      actionType: 'SYSTEM_CONFIG',
      entityType: 'SYSTEM',
      entityId: exportType,
      afterSnapshot: { adminFields: validated.adminFields, userFields: validated.userFields },
      req,
      remark: `更新导出字段配置: ${exportType}`,
      sensitivityLevel: 'CRITICAL',
      resultStatus: 'SUCCESS',
    });

    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating export field config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/cleanup', authenticate, isAdmin, async (req, res) => {
  try {
    const count = await cleanupExpiredExports();

    await createAuditLog({
      operator: req.user,
      actionType: 'SYSTEM_CONFIG',
      entityType: 'SYSTEM',
      afterSnapshot: { deletedCount: count },
      req,
      remark: `清理过期导出文件，共 ${count} 个`,
      sensitivityLevel: 'MEDIUM',
      resultStatus: 'SUCCESS',
    });

    res.json({ deletedCount: count });
  } catch (error) {
    logger.error('Error cleaning up expired exports', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/settings', authenticate, isAdmin, async (req, res) => {
  try {
    res.json({
      expireDays: DEFAULT_EXPIRE_DAYS,
      exportDir: EXPORT_DIR,
    });
  } catch (error) {
    logger.error('Error fetching export settings', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
