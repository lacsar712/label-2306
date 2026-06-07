const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(process.cwd(), 'exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const DEFAULT_EXPIRE_DAYS = process.env.EXPORT_EXPIRE_DAYS || 7;

const EXPORT_FIELD_DEFS = {
  MEMBERS: {
    label: '会员列表',
    fields: [
      { key: 'id', label: '会员ID' },
      { key: 'name', label: '姓名' },
      { key: 'phone', label: '手机号', adminOnly: true },
      { key: 'email', label: '邮箱', adminOnly: true },
      { key: 'level', label: '会员等级' },
      { key: 'status', label: '状态' },
      { key: 'points', label: '可用积分' },
      { key: 'frozenPoints', label: '冻结积分' },
      { key: 'joinDate', label: '注册时间' },
      { key: 'updatedAt', label: '更新时间' },
    ],
    defaultSortBy: 'joinDate',
  },
  POINTS_TRANSACTIONS: {
    label: '积分流水',
    fields: [
      { key: 'id', label: '流水ID' },
      { key: 'serialNo', label: '流水号' },
      { key: 'memberId', label: '会员ID' },
      { key: 'memberName', label: '会员姓名' },
      { key: 'memberPhone', label: '会员手机号', adminOnly: true },
      { key: 'changeType', label: '变动类型' },
      { key: 'changeValue', label: '变动值' },
      { key: 'balanceBefore', label: '变动前余额' },
      { key: 'balanceAfter', label: '变动后余额' },
      { key: 'reasonType', label: '变动原因' },
      { key: 'bizOrderNo', label: '业务单号' },
      { key: 'bizOrderType', label: '业务类型' },
      { key: 'operatorUsername', label: '操作人' },
      { key: 'remark', label: '备注' },
      { key: 'createdAt', label: '创建时间' },
    ],
    defaultSortBy: 'createdAt',
  },
  COUPON_CLAIMS: {
    label: '优惠券领取记录',
    fields: [
      { key: 'id', label: '记录ID' },
      { key: 'couponId', label: '优惠券ID' },
      { key: 'couponName', label: '优惠券名称' },
      { key: 'couponType', label: '优惠券类型' },
      { key: 'memberId', label: '会员ID' },
      { key: 'memberName', label: '会员姓名' },
      { key: 'memberPhone', label: '会员手机号', adminOnly: true },
      { key: 'code', label: '券码', adminOnly: true },
      { key: 'status', label: '状态' },
      { key: 'claimedAt', label: '领取时间' },
      { key: 'redeemedAt', label: '核销时间' },
      { key: 'expiredAt', label: '过期时间' },
    ],
    defaultSortBy: 'claimedAt',
  },
  WORK_ORDERS: {
    label: '工单列表',
    fields: [
      { key: 'id', label: '工单ID' },
      { key: 'title', label: '标题' },
      { key: 'description', label: '描述' },
      { key: 'status', label: '状态' },
      { key: 'priority', label: '优先级' },
      { key: 'memberId', label: '会员ID' },
      { key: 'memberName', label: '会员姓名' },
      { key: 'memberPhone', label: '会员手机号', adminOnly: true },
      { key: 'operatorUsername', label: '处理人' },
      { key: 'resolvedAt', label: '解决时间' },
      { key: 'closedAt', label: '关闭时间' },
      { key: 'createdAt', label: '创建时间' },
    ],
    defaultSortBy: 'createdAt',
  },
  SIGN_IN_RECORDS: {
    label: '签到记录',
    fields: [
      { key: 'id', label: '记录ID' },
      { key: 'memberId', label: '会员ID' },
      { key: 'memberName', label: '会员姓名' },
      { key: 'memberPhone', label: '会员手机号', adminOnly: true },
      { key: 'points', label: '签到积分' },
      { key: 'signDate', label: '签到日期' },
    ],
    defaultSortBy: 'signDate',
  },
  EXCHANGE_RECORDS: {
    label: '兑换记录',
    fields: [
      { key: 'id', label: '记录ID' },
      { key: 'orderNo', label: '兑换单号' },
      { key: 'memberId', label: '会员ID' },
      { key: 'memberName', label: '会员姓名' },
      { key: 'memberPhone', label: '会员手机号', adminOnly: true },
      { key: 'itemName', label: '商品名称' },
      { key: 'pointsCost', label: '消耗积分' },
      { key: 'quantity', label: '数量' },
      { key: 'status', label: '状态' },
      { key: 'operatorUsername', label: '操作人' },
      { key: 'remark', label: '备注' },
      { key: 'createdAt', label: '兑换时间' },
    ],
    defaultSortBy: 'createdAt',
  },
};

function getExportFieldDefs(exportType, isAdmin) {
  const def = EXPORT_FIELD_DEFS[exportType];
  if (!def) return null;
  return {
    ...def,
    fields: def.fields.filter(f => isAdmin || !f.adminOnly),
  };
}

function getAllExportTypes(isAdmin) {
  return Object.entries(EXPORT_FIELD_DEFS).map(([type, def]) => ({
    type,
    label: def.label,
    fields: def.fields.filter(f => isAdmin || !f.adminOnly),
  }));
}

async function getFieldConfig(exportType, isAdmin) {
  const config = await prisma.exportFieldConfig.findUnique({ where: { exportType } });
  const defFields = EXPORT_FIELD_DEFS[exportType];
  if (!defFields) return null;
  if (!config) {
    return defFields.fields.filter(f => isAdmin || !f.adminOnly).map(f => f.key);
  }
  const allowedKeys = isAdmin ? config.adminFields : config.userFields;
  const allowedSet = new Set(allowedKeys || []);
  return defFields.fields
    .filter(f => isAdmin || !f.adminOnly)
    .filter(f => allowedSet.has(f.key))
    .map(f => f.key);
}

async function updateFieldConfig(exportType, adminFields, userFields, operator) {
  return prisma.exportFieldConfig.upsert({
    where: { exportType },
    update: {
      adminFields,
      userFields,
      updatedBy: operator?.id || null,
    },
    create: {
      exportType,
      adminFields,
      userFields,
      updatedBy: operator?.id || null,
    },
  });
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') return JSON.stringify(val);
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildFilterSummary(exportType, filters, dateRange) {
  const parts = [];
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        parts.push(`${k}: ${v}`);
      }
    });
  }
  if (dateRange?.start || dateRange?.end) {
    parts.push(`日期: ${dateRange.start || '*'} ~ ${dateRange.end || '*'}`);
  }
  return parts.join('; ') || '无筛选条件';
}

async function fetchMembersData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { phone: { contains: filters.search } },
    ];
  }
  if (filters?.level) where.level = filters.level;
  if (filters?.status) where.status = filters.status;
  if (dateRange?.start || dateRange?.end) {
    where.joinDate = {};
    if (dateRange.start) where.joinDate.gte = new Date(dateRange.start);
    if (dateRange.end) where.joinDate.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  return prisma.member.findMany({ where, orderBy });
}

async function fetchPointsTransactionsData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.memberId) where.memberId = parseInt(filters.memberId);
  if (filters?.changeType) where.changeType = filters.changeType;
  if (filters?.reasonType) where.reasonType = filters.reasonType;
  if (filters?.bizOrderNo) where.bizOrderNo = { contains: filters.bizOrderNo };
  if (dateRange?.start || dateRange?.end) {
    where.createdAt = {};
    if (dateRange.start) where.createdAt.gte = new Date(dateRange.start);
    if (dateRange.end) where.createdAt.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  const records = await prisma.pointsTransaction.findMany({
    where,
    orderBy,
    include: {
      member: { select: { name: true, phone: true } },
      operator: { select: { username: true } },
    },
  });

  return records.map(r => ({
    ...r,
    memberName: r.member?.name,
    memberPhone: r.member?.phone,
    operatorUsername: r.operator?.username,
  }));
}

async function fetchCouponClaimsData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.couponId) where.couponId = parseInt(filters.couponId);
  if (filters?.memberId) where.memberId = parseInt(filters.memberId);
  if (filters?.status) where.status = filters.status;
  if (dateRange?.start || dateRange?.end) {
    where.claimedAt = {};
    if (dateRange.start) where.claimedAt.gte = new Date(dateRange.start);
    if (dateRange.end) where.claimedAt.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  const records = await prisma.memberCoupon.findMany({
    where,
    orderBy,
    include: {
      coupon: { select: { name: true, type: true } },
      member: { select: { name: true, phone: true } },
    },
  });

  return records.map(r => ({
    ...r,
    couponName: r.coupon?.name,
    couponType: r.coupon?.type,
    memberName: r.member?.name,
    memberPhone: r.member?.phone,
  }));
}

async function fetchWorkOrdersData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;
  if (filters?.memberId) where.memberId = parseInt(filters.memberId);
  if (dateRange?.start || dateRange?.end) {
    where.createdAt = {};
    if (dateRange.start) where.createdAt.gte = new Date(dateRange.start);
    if (dateRange.end) where.createdAt.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  const records = await prisma.workOrder.findMany({
    where,
    orderBy,
    include: {
      member: { select: { name: true, phone: true } },
      operator: { select: { username: true } },
    },
  });

  return records.map(r => ({
    ...r,
    memberName: r.member?.name,
    memberPhone: r.member?.phone,
    operatorUsername: r.operator?.username,
  }));
}

async function fetchSignInRecordsData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.memberId) where.memberId = parseInt(filters.memberId);
  if (dateRange?.start || dateRange?.end) {
    where.signDate = {};
    if (dateRange.start) where.signDate.gte = new Date(dateRange.start);
    if (dateRange.end) where.signDate.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  const records = await prisma.signInRecord.findMany({
    where,
    orderBy,
    include: {
      member: { select: { name: true, phone: true } },
    },
  });

  return records.map(r => ({
    ...r,
    memberName: r.member?.name,
    memberPhone: r.member?.phone,
  }));
}

async function fetchExchangeRecordsData(filters, dateRange, sortBy, sortOrder) {
  const where = {};
  if (filters?.memberId) where.memberId = parseInt(filters.memberId);
  if (filters?.status) where.status = filters.status;
  if (dateRange?.start || dateRange?.end) {
    where.createdAt = {};
    if (dateRange.start) where.createdAt.gte = new Date(dateRange.start);
    if (dateRange.end) where.createdAt.lte = new Date(dateRange.end);
  }
  const orderBy = {};
  if (sortBy) orderBy[sortBy] = sortOrder || 'desc';

  const records = await prisma.exchangeRecord.findMany({
    where,
    orderBy,
    include: {
      member: { select: { name: true, phone: true } },
      operator: { select: { username: true } },
    },
  });

  return records.map(r => ({
    ...r,
    memberName: r.member?.name,
    memberPhone: r.member?.phone,
    operatorUsername: r.operator?.username,
  }));
}

async function fetchData(exportType, filters, dateRange, sortBy, sortOrder) {
  switch (exportType) {
    case 'MEMBERS':
      return fetchMembersData(filters, dateRange, sortBy, sortOrder);
    case 'POINTS_TRANSACTIONS':
      return fetchPointsTransactionsData(filters, dateRange, sortBy, sortOrder);
    case 'COUPON_CLAIMS':
      return fetchCouponClaimsData(filters, dateRange, sortBy, sortOrder);
    case 'WORK_ORDERS':
      return fetchWorkOrdersData(filters, dateRange, sortBy, sortOrder);
    case 'SIGN_IN_RECORDS':
      return fetchSignInRecordsData(filters, dateRange, sortBy, sortOrder);
    case 'EXCHANGE_RECORDS':
      return fetchExchangeRecordsData(filters, dateRange, sortBy, sortOrder);
    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}

async function createExportTask({ exportType, fields, filters, dateRange, sortBy, sortOrder, operator }) {
  const fieldDefs = EXPORT_FIELD_DEFS[exportType];
  if (!fieldDefs) throw new Error(`Unknown export type: ${exportType}`);

  const isAdmin = operator?.role === 'ADMIN';
  const allowedKeys = await getFieldConfig(exportType, isAdmin);
  const allowedSet = new Set(allowedKeys);
  const requestedFields = fields.filter(f => allowedSet.has(f));

  if (requestedFields.length === 0) {
    throw new Error('No valid export fields selected');
  }

  const effectiveSortBy = sortBy || fieldDefs.defaultSortBy;
  const effectiveSortOrder = sortOrder || 'desc';
  const filterSummary = buildFilterSummary(exportType, filters, dateRange);

  const task = await prisma.exportTask.create({
    data: {
      exportType,
      status: 'PENDING',
      fields: requestedFields,
      filters: filters || null,
      dateRange: dateRange || null,
      sortBy: effectiveSortBy,
      sortOrder: effectiveSortOrder,
      filterSummary,
      operatorId: operator?.id || null,
      operatorUsername: operator?.username || null,
    },
  });

  setImmediate(() => processExportTask(task.id));

  return task;
}

async function processExportTask(taskId) {
  let task;
  try {
    task = await prisma.exportTask.update({
      where: { id: taskId },
      data: { status: 'GENERATING' },
    });

    const fieldDefs = EXPORT_FIELD_DEFS[task.exportType];
    const fieldDefMap = new Map(fieldDefs.fields.map(f => [f.key, f]));
    const fieldLabels = task.fields.map(k => fieldDefMap.get(k)?.label || k);

    const data = await fetchData(
      task.exportType, task.filters, task.dateRange, task.sortBy, task.sortOrder);

    const fileName = `${task.exportType}_${Date.now()}.csv`;
    const filePath = path.join(EXPORT_DIR, fileName);

    const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8'});
    writeStream.write('\ufeff');
    writeStream.write(fieldLabels.map(escapeCsv).join(',') + '\n');

    for (const row of data) {
      const line = task.fields.map(k => escapeCsv(row[k])).join(',');
      writeStream.write(line + '\n');
    }

    await new Promise((resolve, reject) => {
      writeStream.end(err => (err ? reject(err) : resolve()));
    });

    const stats = fs.statSync(filePath);
    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + DEFAULT_EXPIRE_DAYS);

    await prisma.exportTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        filePath,
        fileName,
        fileSize: stats.size,
        completedAt: new Date(),
        expiredAt,
      },
    });

    logger.info(`Export task ${taskId} completed: ${fileName} (${stats.size} bytes)`);
  } catch (error) {
    logger.error(`Export task ${taskId} failed: ${error.message}`);
    await prisma.exportTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });
  }
}

async function queryExportTasks({ page = 1, pageSize = 20, exportType, status, operatorId, startDate, endDate, keyword }) {
  const where = {};
  if (exportType) where.exportType = exportType;
  if (status) where.status = status;
  if (operatorId) where.operatorId = parseInt(operatorId);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  if (keyword) {
    where.OR = [
      { operatorUsername: { contains: keyword } },
      { filterSummary: { contains: keyword } },
      { fileName: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.exportTask.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(pageSize),
      take: parseInt(pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exportTask.count({ where }),
  ]);

  return {
    list,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(total / parseInt(pageSize)),
  };
}

async function getExportTask(id) {
  return prisma.exportTask.findUnique({ where: { id: parseInt(id) } });
}

async function incrementDownloadCount(id) {
  return prisma.exportTask.update({
    where: { id: parseInt(id) },
    data: { downloadCount: { increment: 1 } },
  });
}

async function cleanupExpiredExports() {
  const now = new Date();
  const expired = await prisma.exportTask.findMany({
    where: {
      expiredAt: { lte: now },
      status: 'COMPLETED',
      filePath: { not: null },
    },
  });

  let deletedCount = 0;
  for (const task of expired) {
    try {
      if (task.filePath && fs.existsSync(task.filePath)) {
        fs.unlinkSync(task.filePath);
      }
      await prisma.exportTask.update({
        where: { id: task.id },
        data: { filePath: null, fileName: null },
      });
      deletedCount++;
    } catch (error) {
      logger.warn(`Failed to clean up export file ${task.filePath}: ${error.message}`);
    }
  }
  return deletedCount;
}

async function getExportFilePath(task) {
  if (!task || task.status !== 'COMPLETED' || !task.filePath) {
    return null;
  }
  if (task.expiredAt && task.expiredAt < new Date()) {
    return null;
  }
  if (!fs.existsSync(task.filePath)) {
    return null;
  }
  return task.filePath;
}

module.exports = {
  EXPORT_FIELD_DEFS,
  getExportFieldDefs,
  getAllExportTypes,
  getFieldConfig,
  updateFieldConfig,
  createExportTask,
  processExportTask,
  queryExportTasks,
  getExportTask,
  incrementDownloadCount,
  cleanupExpiredExports,
  getExportFilePath,
  EXPORT_DIR,
  DEFAULT_EXPIRE_DAYS,
};
