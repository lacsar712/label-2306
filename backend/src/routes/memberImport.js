const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { z } = require('zod');
const {
  getStandardFields,
  getImportConfig,
  updateImportConfig,
  previewImport,
  createBatch,
  processImportBatch,
  pauseBatch,
  resumeBatch,
  cancelBatch,
  getBatch,
  listBatches,
  getBatchRecords,
  retryFailedRecords,
} = require('../services/memberImportService');

const uploadDir = path.join(os.tmpdir(), 'member-imports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv') cb(null, true);
    else cb(new Error('只支持 CSV 格式文件'));
  }
});

const CheckImportSchema = z.object({
  fieldMapping: z.record(z.string()).optional(),
});

const StartImportSchema = z.object({
  conflictStrategy: z.enum(['SKIP', 'OVERWRITE', 'MARK_FOR_REVIEW']).default('SKIP'),
  fieldMapping: z.record(z.string()).optional(),
  tempFilePath: z.string(),
  fileName: z.string(),
});

router.get('/template', authenticate, async (req, res) => {
  try {
    const fields = getStandardFields();
    const header = fields.map(f => f.label).join(',');
    const sampleRow = ['张三', '13800138000', 'zhangsan@example.com', 'NORMAL', 'ACTIVE', 'ONLINE', '100', '1990', '1', '1', 'SOLAR'].join(',');
    const csvContent = '\uFEFF' + header + '\n' + sampleRow + '\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=member_import_template.csv');
    res.send(csvContent);
  } catch (error) {
    logger.error('下载模板失败', { error: error.message });
    res.status(500).json({ error: '下载模板失败' });
  }
});

router.get('/standard-fields', authenticate, async (req, res) => {
  res.json(getStandardFields());
});

router.get('/config', authenticate, isAdmin, async (req, res) => {
  try {
    const config = await getImportConfig();
    res.json(config);
  } catch (error) {
    logger.error('获取导入配置失败', { error: error.message });
    res.status(500).json({ error: '获取配置失败' });
  }
});

router.put('/config', authenticate, isAdmin, async (req, res) => {
  try {
    const { maxImportLimit, allowNonAdminImport } = z.object({
      maxImportLimit: z.coerce.number().int().min(1).max(100000),
      allowNonAdminImport: z.boolean(),
    }).parse(req.body);

    const config = await updateImportConfig({ maxImportLimit, allowNonAdminImport }, req.user?.id);
    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('更新导入配置失败', { error: error.message });
    res.status(500).json({ error: '更新配置失败' });
  }
});

router.post('/preview', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传 CSV 文件' });
  }
  try {
    const result = await previewImport(req.file.path, {});
    const config = await getImportConfig();
    if (result.totalCount > config.maxImportLimit) {
      return res.status(400).json({
        error: `单次导入上限为 ${config.maxImportLimit} 条，当前文件共 ${result.totalCount} 条`
      });
    }
    res.json({
      tempFilePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...result,
    });
  } catch (error) {
    logger.error('预览导入失败', { error: error.message });
    res.status(500).json({ error: error.message || '预览失败' });
  }
});

router.post('/preview/remap', authenticate, async (req, res) => {
  try {
    const { tempFilePath, fieldMapping } = CheckImportSchema.extend({
      tempFilePath: z.string(),
    }).parse(req.body);

    if (!fs.existsSync(tempFilePath)) {
      return res.status(400).json({ error: '临时文件不存在，请重新上传' });
    }

    const result = await previewImport(tempFilePath, fieldMapping || {});
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('重新预览失败', { error: error.message });
    res.status(500).json({ error: error.message || '预览失败' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const config = await getImportConfig();
    if (!config.allowNonAdminImport && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '仅管理员可执行批量导入' });
    }

    const { conflictStrategy, fieldMapping, tempFilePath, fileName } = StartImportSchema.parse(req.body);

    if (!fs.existsSync(tempFilePath)) {
      return res.status(400).json({ error: '临时文件不存在，请重新上传' });
    }

    const stats = fs.statSync(tempFilePath);
    const batch = await createBatch({
      fileName,
      fileSize: stats.size,
      originalFilePath: tempFilePath,
      conflictStrategy,
      fieldMapping,
      operator: req.user,
    });

    processImportBatch(batch.id, req.user, req);

    res.status(201).json(batch);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('创建导入任务失败', { error: error.message });
    res.status(500).json({ error: error.message || '创建任务失败' });
  }
});

router.get('/batches', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const result = await listBatches({
      ...req.query,
      page,
      pageSize,
      operatorId: req.user?.role !== 'ADMIN' ? req.user?.id : undefined,
    });
    res.json(result);
  } catch (error) {
    logger.error('获取导入批次列表失败', { error: error.message });
    res.status(500).json({ error: '获取列表失败' });
  }
});

router.get('/batches/:id', authenticate, async (req, res) => {
  try {
    const batch = await getBatch(parseInt(req.params.id));
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    if (batch.operatorId && batch.operatorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权访问此批次' });
    }
    res.json(batch);
  } catch (error) {
    logger.error('获取导入批次失败', { error: error.message });
    res.status(500).json({ error: '获取批次失败' });
  }
});

router.get('/batches/:id/records', authenticate, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const batch = await getBatch(batchId);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    if (batch.operatorId && batch.operatorId !== req.user?.id && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权访问此批次' });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const result = await getBatchRecords(batchId, { ...req.query, page, pageSize });
    res.json(result);
  } catch (error) {
    logger.error('获取导入记录失败', { error: error.message });
    res.status(500).json({ error: '获取记录失败' });
  }
});

router.post('/batches/:id/pause', authenticate, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const batch = await getBatch(batchId);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    if (batch.status !== 'PROCESSING') {
      return res.status(400).json({ error: '只有进行中的任务可以暂停' });
    }
    const result = await pauseBatch(batchId);
    res.json(result);
  } catch (error) {
    logger.error('暂停导入失败', { error: error.message });
    res.status(500).json({ error: '暂停失败' });
  }
});

router.post('/batches/:id/resume', authenticate, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const batch = await getBatch(batchId);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    if (batch.status !== 'PAUSED') {
      return res.status(400).json({ error: '只有暂停中的任务可以恢复' });
    }
    const result = await resumeBatch(batchId);
    res.json(result);
  } catch (error) {
    logger.error('恢复导入失败', { error: error.message });
    res.status(500).json({ error: '恢复失败' });
  }
});

router.post('/batches/:id/cancel', authenticate, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const batch = await getBatch(batchId);
    if (!batch) return res.status(404).json({ error: '批次不存在' });
    if (!['PROCESSING', 'PAUSED', 'PENDING'].includes(batch.status)) {
      return res.status(400).json({ error: '当前状态不可取消' });
    }
    const result = await cancelBatch(batchId);
    res.json(result);
  } catch (error) {
    logger.error('取消导入失败', { error: error.message });
    res.status(500).json({ error: '取消失败' });
  }
});

router.post('/batches/:id/retry-failed', authenticate, async (req, res) => {
  try {
    const config = await getImportConfig();
    if (!config.allowNonAdminImport && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '仅管理员可执行重导' });
    }
    const batchId = parseInt(req.params.id);
    const result = await retryFailedRecords(batchId, req.user, req);
    res.json(result);
  } catch (error) {
    logger.error('重导失败行失败', { error: error.message });
    res.status(500).json({ error: error.message || '重导失败' });
  }
});

module.exports = router;
