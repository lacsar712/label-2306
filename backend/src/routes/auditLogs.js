const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const {
  queryAuditLogs,
  getAuditLogById,
  getAuditStats,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  getAuditConfigs,
  updateAuditConfig,
  createAuditLog,
} = require('../services/auditLog');

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await queryAuditLogs(req.query);
    res.json(result);
  } catch (error) {
    logger.error('Error querying audit logs', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await getAuditStats(req.query);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting audit stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const log = await getAuditLogById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    res.json(log);
  } catch (error) {
    logger.error('Error fetching audit log', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/export/csv', authenticate, isAdmin, async (req, res) => {
  try {
    const startTime = Date.now();
    const csvContent = await exportAuditLogsToCsv(req.query);
    const filename = `audit_logs_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      req,
      remark: `导出审计日志 CSV`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });
  } catch (error) {
    logger.error('Error exporting audit logs CSV', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/export/json', authenticate, isAdmin, async (req, res) => {
  try {
    const startTime = Date.now();
    const jsonContent = await exportAuditLogsToJson(req.query);
    const filename = `audit_logs_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(jsonContent);

    await createAuditLog({
      operator: req.user,
      actionType: 'DATA_EXPORT',
      entityType: 'SYSTEM',
      req,
      remark: `导出审计日志 JSON`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });
  } catch (error) {
    logger.error('Error exporting audit logs JSON', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/config/list', authenticate, isAdmin, async (req, res) => {
  try {
    const configs = await getAuditConfigs();
    res.json(configs);
  } catch (error) {
    logger.error('Error getting audit configs', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/config/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const config = await updateAuditConfig(req.params.id, req.body, req.user);
    res.json(config);
  } catch (error) {
    logger.error('Error updating audit config', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
