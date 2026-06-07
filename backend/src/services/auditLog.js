const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const DEFAULT_AUDIT_CONFIGS = [
  { actionType: 'MEMBER_CREATE', sensitivityLevel: 'MEDIUM', description: '会员创建' },
  { actionType: 'MEMBER_UPDATE', sensitivityLevel: 'MEDIUM', description: '会员更新' },
  { actionType: 'MEMBER_DELETE', sensitivityLevel: 'HIGH', description: '会员删除' },
  { actionType: 'POINTS_ADJUST', sensitivityLevel: 'HIGH', description: '积分调整' },
  { actionType: 'POINTS_FREEZE', sensitivityLevel: 'HIGH', description: '积分冻结' },
  { actionType: 'POINTS_UNFREEZE', sensitivityLevel: 'HIGH', description: '积分解冻' },
  { actionType: 'USER_CREATE', sensitivityLevel: 'CRITICAL', description: '用户创建' },
  { actionType: 'USER_UPDATE', sensitivityLevel: 'CRITICAL', description: '用户更新' },
  { actionType: 'USER_DELETE', sensitivityLevel: 'CRITICAL', description: '用户删除' },
  { actionType: 'AUTH_LOGIN', sensitivityLevel: 'LOW', description: '用户登录' },
  { actionType: 'AUTH_LOGOUT', sensitivityLevel: 'LOW', description: '用户登出' },
  { actionType: 'COUPON_ISSUE', sensitivityLevel: 'MEDIUM', description: '优惠券发放' },
  { actionType: 'BLACKLIST_ADD', sensitivityLevel: 'HIGH', description: '加入黑名单' },
  { actionType: 'BLACKLIST_REMOVE', sensitivityLevel: 'HIGH', description: '移除黑名单' },
  { actionType: 'DATA_EXPORT', sensitivityLevel: 'HIGH', description: '数据导出' },
  { actionType: 'SYSTEM_CONFIG', sensitivityLevel: 'CRITICAL', description: '系统配置修改' },
  { actionType: 'TRANSACTION_REVERSE', sensitivityLevel: 'HIGH', description: '流水冲正' },
  { actionType: 'BATCH_OPERATION', sensitivityLevel: 'MEDIUM', description: '批量操作' },
  { actionType: 'TAG_GROUP_CREATE', sensitivityLevel: 'MEDIUM', description: '标签分组创建' },
  { actionType: 'TAG_GROUP_UPDATE', sensitivityLevel: 'MEDIUM', description: '标签分组更新' },
  { actionType: 'TAG_GROUP_DELETE', sensitivityLevel: 'MEDIUM', description: '标签分组删除' },
  { actionType: 'TAG_CREATE', sensitivityLevel: 'MEDIUM', description: '标签创建' },
  { actionType: 'TAG_UPDATE', sensitivityLevel: 'MEDIUM', description: '标签更新' },
  { actionType: 'TAG_DELETE', sensitivityLevel: 'MEDIUM', description: '标签删除' },
  { actionType: 'MEMBER_TAG_BIND', sensitivityLevel: 'MEDIUM', description: '会员标签绑定' },
  { actionType: 'MEMBER_TAG_UNBIND', sensitivityLevel: 'MEDIUM', description: '会员标签解绑' },
  { actionType: 'TAG_RULE_APPLY', sensitivityLevel: 'MEDIUM', description: '标签规则执行' },
  { actionType: 'OTHER', sensitivityLevel: 'LOW', description: '其他操作' },
];

async function initAuditConfigs() {
  for (const config of DEFAULT_AUDIT_CONFIGS) {
    await prisma.auditConfig.upsert({
      where: { actionType: config.actionType },
      update: {},
      create: config,
    });
  }
  logger.info('Audit configs initialized');
}

let auditConfigCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000;

async function getAuditConfig(actionType) {
  const now = Date.now();
  if (!auditConfigCache || now - cacheTimestamp > CACHE_TTL) {
    const configs = await prisma.auditConfig.findMany();
    auditConfigCache = new Map(configs.map(c => [c.actionType, c]));
    cacheTimestamp = now;
  }
  return auditConfigCache.get(actionType);
}

function invalidateAuditConfigCache() {
  auditConfigCache = null;
  cacheTimestamp = 0;
}

async function createAuditLog({
  operator,
  actionType,
  entityType,
  entityId,
  beforeSnapshot,
  afterSnapshot,
  req,
  remark,
  sensitivityLevel,
  resultStatus = 'SUCCESS',
  errorMessage,
  durationMs,
}) {
  try {
    const config = await getAuditConfig(actionType);
    if (config && !config.enabled) {
      return null;
    }

    const finalSensitivity = sensitivityLevel || (config?.sensitivityLevel) || 'MEDIUM';

    const logData = {
      actionType,
      entityType,
      entityId: entityId ? String(entityId) : null,
      beforeSnapshot: beforeSnapshot || null,
      afterSnapshot: afterSnapshot || null,
      sensitivityLevel: finalSensitivity,
      resultStatus,
      errorMessage,
      durationMs,
      remark,
    };

    if (operator) {
      logData.operatorId = operator.id;
      logData.operatorUsername = operator.username;
    }

    if (req) {
      logData.requestIp = extractClientIp(req);
      logData.userAgent = req.headers['user-agent'] || null;
      logData.requestPath = req.originalUrl || req.path || null;
      logData.requestMethod = req.method || null;
      const params = {
        query: req.query || {},
        params: req.params || {},
        body: sanitizeBody(req.body),
      };
      logData.requestParams = params;
    }

    const auditLog = await prisma.auditLog.create({ data: logData });
    return auditLog;
  } catch (error) {
    logger.error('Failed to create audit log', { error: error.message, actionType, entityType });
    return null;
  }
}

function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) return realIp;
  return req.ip || req.connection?.remoteAddress || null;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'authorization'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '***';
    }
  }
  return sanitized;
}

async function queryAuditLogs(filters) {
  const {
    page = 1,
    pageSize = 20,
    operatorId,
    operatorUsername,
    actionType,
    entityType,
    entityId,
    sensitivityLevel,
    resultStatus,
    startDate,
    endDate,
    keyword,
  } = filters;

  const where = {};

  if (operatorId) where.operatorId = parseInt(operatorId);
  if (operatorUsername) where.operatorUsername = { contains: operatorUsername };
  if (actionType) where.actionType = actionType;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = String(entityId);
  if (sensitivityLevel) where.sensitivityLevel = sensitivityLevel;
  if (resultStatus) where.resultStatus = resultStatus;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (keyword) {
    where.OR = [
      { operatorUsername: { contains: keyword } },
      { remark: { contains: keyword } },
      { entityId: { contains: keyword } },
      { requestPath: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      take: parseInt(pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    list,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(total / parseInt(pageSize)),
  };
}

async function getAuditLogById(id) {
  return prisma.auditLog.findUnique({ where: { id: BigInt(id) } });
}

async function getAuditStats({ groupBy, startDate, endDate }) {
  const where = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  let byActionType = [];
  let byOperator = [];
  let failureRate = 0;
  let totalCount = 0;

  if (groupBy === 'actionType' || !groupBy) {
    byActionType = await prisma.auditLog.groupBy({
      by: ['actionType', 'resultStatus'],
      where,
      _count: true,
      orderBy: { _count: { actionType: 'desc' } },
    });
  }

  if (groupBy === 'operator' || !groupBy) {
    byOperator = await prisma.auditLog.groupBy({
      by: ['operatorId', 'operatorUsername', 'resultStatus'],
      where,
      _count: true,
      having: { operatorId: { not: null } },
      orderBy: { _count: { operatorId: 'desc' } },
      take: 20,
    });
  }

  totalCount = await prisma.auditLog.count({ where });
  const failureCount = await prisma.auditLog.count({
    where: { ...where, resultStatus: { in: ['FAILURE', 'PARTIAL'] } },
  });
  failureRate = totalCount > 0 ? (failureCount / totalCount) * 100 : 0;

  return {
    totalCount,
    failureRate: parseFloat(failureRate.toFixed(2)),
    byActionType,
    byOperator,
  };
}

async function exportAuditLogsToCsv(filters) {
  const MAX_ROWS = 10000;
  const result = await queryAuditLogs({ ...filters, page: 1, pageSize: MAX_ROWS });

  const headers = [
    'ID', '操作人ID', '操作人', '动作类型', '目标实体', '实体ID',
    '敏感级别', '结果状态', '请求IP', '请求方法', '请求路径',
    '备注', '错误信息', '耗时(ms)', '操作时间',
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = result.list.map(log => [
    log.id.toString(),
    log.operatorId || '',
    log.operatorUsername || '',
    log.actionType,
    log.entityType,
    log.entityId || '',
    log.sensitivityLevel,
    log.resultStatus,
    log.requestIp || '',
    log.requestMethod || '',
    log.requestPath || '',
    log.remark || '',
    log.errorMessage || '',
    log.durationMs || '',
    log.createdAt.toISOString(),
  ]);

  const csvContent = '\ufeff' + [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
  return csvContent;
}

async function exportAuditLogsToJson(filters) {
  const MAX_ROWS = 10000;
  const result = await queryAuditLogs({ ...filters, page: 1, pageSize: MAX_ROWS });
  const serializable = result.list.map(log => ({
    ...log,
    id: log.id.toString(),
  }));
  return JSON.stringify(serializable, null, 2);
}

async function getAuditConfigs() {
  return prisma.auditConfig.findMany({ orderBy: { actionType: 'asc' } });
}

async function updateAuditConfig(id, data, operator) {
  const updated = await prisma.auditConfig.update({
    where: { id: parseInt(id) },
    data: {
      enabled: data.enabled,
      sensitivityLevel: data.sensitivityLevel,
      description: data.description,
      updatedBy: operator?.id || null,
    },
  });
  invalidateAuditConfigCache();

  await createAuditLog({
    operator,
    actionType: 'SYSTEM_CONFIG',
    entityType: 'AUDIT_CONFIG',
    entityId: id,
    afterSnapshot: { enabled: updated.enabled, sensitivityLevel: updated.sensitivityLevel, description: updated.description },
    remark: `更新审计配置: ${updated.actionType}`,
    sensitivityLevel: 'CRITICAL',
  });

  return updated;
}

module.exports = {
  initAuditConfigs,
  createAuditLog,
  queryAuditLogs,
  getAuditLogById,
  getAuditStats,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  getAuditConfigs,
  updateAuditConfig,
};
