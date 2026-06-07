const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { createAuditLog } = require('./auditLog');
const { createTransaction } = require('./pointsTransaction');

const STANDARD_FIELDS = [
  { key: 'name', label: '姓名', required: true },
  { key: 'phone', label: '手机号', required: true },
  { key: 'email', label: '邮箱', required: false },
  { key: 'level', label: '等级', required: false },
  { key: 'status', label: '状态', required: false },
  { key: 'channel', label: '渠道', required: false },
  { key: 'points', label: '积分', required: false },
  { key: 'birthday', label: '生日年', required: false },
  { key: 'birthdayMonth', label: '生日月', required: false },
  { key: 'birthdayDay', label: '生日天', required: false },
  { key: 'calendarType', label: '日历类型', required: false },
];

const VALID_LEVELS = ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'];
const VALID_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const VALID_CHANNELS = ['ONLINE', 'OFFLINE', 'REFERRAL', 'PROMOTION', 'OTHER'];
const VALID_CALENDAR_TYPES = ['SOLAR', 'LUNAR'];

const CHINESE_TO_ENUM = {
  普通: 'NORMAL', NORMAL: 'NORMAL', normal: 'NORMAL',
  银卡: 'SILVER', SILVER: 'SILVER', silver: 'SILVER',
  金卡: 'GOLD', GOLD: 'GOLD', gold: 'GOLD',
  铂金: 'PLATINUM', PLATINUM: 'PLATINUM', platinum: 'PLATINUM',
  活跃: 'ACTIVE', ACTIVE: 'ACTIVE', active: 'ACTIVE',
  不活跃: 'INACTIVE', INACTIVE: 'INACTIVE', inactive: 'INACTIVE',
  停用: 'SUSPENDED', SUSPENDED: 'SUSPENDED', suspended: 'SUSPENDED',
  线上: 'ONLINE', ONLINE: 'ONLINE', online: 'ONLINE',
  线下: 'OFFLINE', OFFLINE: 'OFFLINE', offline: 'OFFLINE',
  推荐: 'REFERRAL', REFERRAL: 'REFERRAL', referral: 'REFERRAL',
  推广: 'PROMOTION', PROMOTION: 'PROMOTION', promotion: 'PROMOTION',
  其他: 'OTHER', OTHER: 'OTHER', other: 'OTHER',
  阳历: 'SOLAR', SOLAR: 'SOLAR', solar: 'SOLAR',
  阴历: 'LUNAR', LUNAR: 'LUNAR', lunar: 'LUNAR',
};

const activeTasks = new Map();

function getStandardFields() {
  return STANDARD_FIELDS;
}

function getImportConfig() {
  return prisma.importConfig.findFirst().then(cfg => cfg || prisma.importConfig.create({
    data: { maxImportLimit: 1000, allowNonAdminImport: false }
  }));
}

function updateImportConfig(data, operatorId) {
  return prisma.importConfig.findFirst().then(cfg => {
    if (cfg) {
      return prisma.importConfig.update({ where: { id: cfg.id }, data: { ...data, updatedBy: operatorId } });
    }
    return prisma.importConfig.create({ data: { ...data, updatedBy: operatorId } });
  });
}

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const headers = [];
    let firstRow = true;
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('headers', (headerList) => { headers.push(...headerList); })
      .on('data', (row) => { results.push(row); })
      .on('end', () => resolve({ headers, rows: results }))
      .on('error', reject);
  });
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 2;
}

function normalizeEnum(value, validList, fieldName) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = CHINESE_TO_ENUM[trimmed] || trimmed.toUpperCase();
  if (validList.includes(normalized)) return normalized;
  throw new Error(`${fieldName}值不合法: ${value}`);
}

function mapRowFields(row, fieldMapping) {
  const mapped = {};
  for (const field of STANDARD_FIELDS) {
    const csvColumn = fieldMapping[field.key] || field.key;
    if (row[csvColumn] !== undefined && row[csvColumn] !== null && row[csvColumn] !== '') {
      mapped[field.key] = row[csvColumn];
    }
  }
  return mapped;
}

function validateRow(data, rowNumber) {
  const errors = [];
  const result = {};

  if (!data.name || !validateName(data.name)) {
    errors.push('姓名不能为空且至少2个字符');
  } else {
    result.name = String(data.name).trim();
  }

  if (!data.phone || !validatePhone(String(data.phone).trim())) {
    errors.push('手机号格式不正确');
  } else {
    result.phone = String(data.phone).trim();
  }

  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(data.email).trim())) {
      errors.push('邮箱格式不正确');
    } else {
      result.email = String(data.email).trim();
    }
  }

  try {
    if (data.level) result.level = normalizeEnum(data.level, VALID_LEVELS, '等级');
  } catch (e) { errors.push(e.message); }

  try {
    if (data.status) result.status = normalizeEnum(data.status, VALID_STATUSES, '状态');
  } catch (e) { errors.push(e.message); }

  try {
    if (data.channel) result.channel = normalizeEnum(data.channel, VALID_CHANNELS, '渠道');
  } catch (e) { errors.push(e.message); }

  if (data.points !== undefined) {
    const pts = parseInt(data.points);
    if (isNaN(pts)) errors.push('积分必须是数字');
    else result.points = pts;
  }

  if (data.birthday) {
    const y = parseInt(data.birthday);
    if (isNaN(y)) errors.push('生日年必须是数字');
    else result.birthday = y;
  }
  if (data.birthdayMonth) {
    const m = parseInt(data.birthdayMonth);
    if (isNaN(m) || m < 1 || m > 12) errors.push('生日月必须是1-12之间的数字');
    else result.birthdayMonth = m;
  }
  if (data.birthdayDay) {
    const d = parseInt(data.birthdayDay);
    if (isNaN(d) || d < 1 || d > 31) errors.push('生日天必须是1-31之间的数字');
    else result.birthdayDay = d;
  }

  try {
    if (data.calendarType) result.calendarType = normalizeEnum(data.calendarType, VALID_CALENDAR_TYPES, '日历类型');
  } catch (e) { errors.push(e.message); }

  return { valid: errors.length === 0, errors, data: result };
}

async function previewImport(filePath, fieldMapping = {}) {
  const { headers, rows } = await parseCsvFile(filePath);
  const previewRows = rows.slice(0, 20);
  const validatedRows = [];
  const phoneSet = new Set();
  const duplicatePhonesInFile = new Set();

  for (let i = 0; i < previewRows.length; i++) {
    const rawRow = previewRows[i];
    const mapped = mapRowFields(rawRow, fieldMapping);
    const { valid, errors, data } = validateRow(mapped, i + 2);

    if (data.phone) {
      if (phoneSet.has(data.phone)) duplicatePhonesInFile.add(data.phone);
      phoneSet.add(data.phone);
    }

    validatedRows.push({
      rowNumber: i + 2,
      rawData: rawRow,
      mappedData: data,
      valid,
      errors: valid ? undefined : errors,
    });
  }

  const existingPhones = await prisma.member.findMany({
    where: { phone: { in: Array.from(phoneSet) } },
    select: { phone: true }
  }).then(list => new Set(list.map(m => m.phone)));

  for (const row of validatedRows) {
    if (row.mappedData.phone && existingPhones.has(row.mappedData.phone)) {
      row.duplicateInDb = true;
    }
    if (row.mappedData.phone && duplicatePhonesInFile.has(row.mappedData.phone)) {
      row.duplicateInFile = true;
    }
  }

  return {
    totalCount: rows.length,
    headers,
    previewRows: validatedRows,
    standardFields: STANDARD_FIELDS,
  };
}

async function createBatch({ fileName, fileSize, originalFilePath, conflictStrategy, fieldMapping, operator }) {
  return prisma.memberImportBatch.create({
    data: {
      fileName,
      fileSize,
      originalFilePath,
      conflictStrategy: conflictStrategy || 'SKIP',
      fieldMapping: fieldMapping || {},
      operatorId: operator?.id || null,
      operatorUsername: operator?.username || null,
    }
  });
}

async function processImportBatch(batchId, operator, req) {
  const batch = await prisma.memberImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error('批次不存在');

  const taskState = { cancelled: false, paused: false };
  activeTasks.set(batchId, taskState);

  try {
    await prisma.memberImportBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING', startedAt: new Date() }
    });

    const { rows } = await parseCsvFile(batch.originalFilePath);
    const fieldMapping = batch.fieldMapping || {};
    const conflictStrategy = batch.conflictStrategy;

    let successCount = 0, skippedCount = 0, failedCount = 0, pendingCount = 0;
    const total = rows.length;

    await prisma.memberImportBatch.update({
      where: { id: batchId },
      data: { totalCount: total }
    });

    const seenPhones = new Set();

    for (let i = 0; i < total; i++) {
      while (taskState.paused) {
        await new Promise(r => setTimeout(r, 500));
        const current = await prisma.memberImportBatch.findUnique({ where: { id: batchId } });
        if (current.status !== 'PAUSED') taskState.paused = false;
      }
      if (taskState.cancelled) break;

      const rawRow = rows[i];
      const rowNumber = i + 2;
      const mapped = mapRowFields(rawRow, fieldMapping);
      const { valid, errors, data } = validateRow(mapped, rowNumber);

      if (!valid) {
        failedCount++;
        await prisma.memberImportRecord.create({
          data: {
            batchId, rowNumber, rawData: rawRow,
            status: 'FAILED', errorReason: errors.join('; ')
          }
        });
      } else {
        const phone = data.phone;

        if (seenPhones.has(phone)) {
          if (conflictStrategy === 'OVERWRITE') {
            skippedCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'SKIPPED', errorReason: '文件内重复手机号，已被前面的行覆盖'
              }
            });
          } else if (conflictStrategy === 'MARK_FOR_REVIEW') {
            pendingCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'PENDING_REVIEW', errorReason: '文件内重复手机号，待人工处理'
              }
            });
          } else {
            skippedCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'SKIPPED', errorReason: '文件内重复手机号，已跳过'
              }
            });
          }
          continue;
        }
        seenPhones.add(phone);

        const existingMember = await prisma.member.findUnique({ where: { phone } });

        if (existingMember) {
          if (conflictStrategy === 'OVERWRITE') {
            const updated = await prisma.member.update({
              where: { phone }, data
            });
            successCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'SUCCESS', memberId: updated.id,
                errorReason: '已覆盖更新已存在的会员'
              }
            });
          } else if (conflictStrategy === 'MARK_FOR_REVIEW') {
            pendingCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'PENDING_REVIEW', memberId: existingMember.id,
                errorReason: '手机号已存在，待人工处理'
              }
            });
          } else {
            skippedCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'SKIPPED', memberId: existingMember.id,
                errorReason: '手机号已存在，已跳过'
              }
            });
          }
        } else {
          try {
            const created = await prisma.member.create({ data });
            if (data.points && data.points > 0) {
              try {
                await createTransaction({
                  memberId: created.id,
                  points: data.points,
                  reasonType: 'REGISTER_REWARD',
                  operatorId: operator?.id || null,
                  remark: '批量导入赠送积分',
                });
              } catch (txErr) {
                logger.warn('导入会员积分交易创建失败', { memberId: created.id, error: txErr.message });
              }
            }
            successCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'SUCCESS', memberId: created.id
              }
            });
          } catch (dbErr) {
            failedCount++;
            await prisma.memberImportRecord.create({
              data: {
                batchId, rowNumber, rawData: rawRow,
                status: 'FAILED', errorReason: dbErr.message
              }
            });
          }
        }
      }

      if ((i + 1) % 10 === 0 || i === total - 1) {
        await prisma.memberImportBatch.update({
          where: { id: batchId },
          data: {
            successCount, skippedCount, failedCount, pendingCount,
            progress: Math.round(((i + 1) / total) * 100)
          }
        });
      }
    }

    const finalStatus = taskState.cancelled ? 'CANCELLED' : (failedCount === total && total > 0 ? 'FAILED' : 'COMPLETED');
    await prisma.memberImportBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        successCount, skippedCount, failedCount, pendingCount,
        progress: taskState.cancelled ? Math.round(((successCount + skippedCount + failedCount + pendingCount) / Math.max(total, 1)) * 100) : 100,
        completedAt: new Date()
      }
    });

    await createAuditLog({
      operator,
      actionType: 'BATCH_OPERATION',
      entityType: 'MEMBER',
      req,
      remark: `批量导入会员完成：共${total}条，成功${successCount}条，跳过${skippedCount}条，失败${failedCount}条，待处理${pendingCount}条`,
      resultStatus: finalStatus === 'COMPLETED' ? 'SUCCESS' : (finalStatus === 'CANCELLED' ? 'PARTIAL' : 'FAILURE'),
    });

  } catch (err) {
    logger.error('批量导入失败', { batchId, error: err.message });
    await prisma.memberImportBatch.update({
      where: { id: batchId },
      data: { status: 'FAILED', errorMessage: err.message, completedAt: new Date() }
    });
  } finally {
    activeTasks.delete(batchId);
  }
}

function pauseBatch(batchId) {
  const task = activeTasks.get(batchId);
  if (task) task.paused = true;
  return prisma.memberImportBatch.update({
    where: { id: batchId },
    data: { status: 'PAUSED' }
  });
}

function resumeBatch(batchId) {
  const task = activeTasks.get(batchId);
  if (task) task.paused = false;
  return prisma.memberImportBatch.update({
    where: { id: batchId },
    data: { status: 'PROCESSING' }
  });
}

function cancelBatch(batchId) {
  const task = activeTasks.get(batchId);
  if (task) task.cancelled = true;
  return prisma.memberImportBatch.update({
    where: { id: batchId },
    data: { status: 'CANCELLED', completedAt: new Date() }
  });
}

function getBatch(batchId) {
  return prisma.memberImportBatch.findUnique({
    where: { id: batchId },
    include: {
      operator: { select: { id: true, username: true } }
    }
  });
}

function listBatches(params = {}) {
  const { page = 1, pageSize = 20, status, operatorId, startDate, endDate, keyword } = params;
  const where = {};
  if (status) where.status = status;
  if (operatorId) where.operatorId = parseInt(operatorId);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
  }
  if (keyword) where.fileName = { contains: keyword };

  return Promise.all([
    prisma.memberImportBatch.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { operator: { select: { id: true, username: true } } }
    }),
    prisma.memberImportBatch.count({ where })
  ]).then(([list, total]) => ({ list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }));
}

function getBatchRecords(batchId, params = {}) {
  const { page = 1, pageSize = 50, status } = params;
  const where = { batchId: parseInt(batchId) };
  if (status) where.status = status;

  return Promise.all([
    prisma.memberImportRecord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { rowNumber: 'asc' },
      include: { member: { select: { id: true, name: true, phone: true } } }
    }),
    prisma.memberImportRecord.count({ where })
  ]).then(([list, total]) => ({ list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }));
}

async function retryFailedRecords(batchId, operator, req) {
  const batch = await prisma.memberImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error('批次不存在');

  const failedRecords = await prisma.memberImportRecord.findMany({
    where: { batchId, status: { in: ['FAILED', 'PENDING_REVIEW'] } }
  });

  let addedSuccess = 0, addedSkipped = 0, addedFailed = 0, addedPending = 0;
  const conflictStrategy = batch.conflictStrategy;
  const seenPhones = new Set();

  for (const record of failedRecords) {
    const mapped = mapRowFields(record.rawData, batch.fieldMapping || {});
    const { valid, errors, data } = validateRow(mapped, record.rowNumber);

    if (!valid) {
      addedFailed++;
      await prisma.memberImportRecord.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorReason: errors.join('; ') }
      });
      continue;
    }

    const phone = data.phone;
    if (seenPhones.has(phone)) {
      addedSkipped++;
      await prisma.memberImportRecord.update({
        where: { id: record.id },
        data: { status: 'SKIPPED', errorReason: '重导时文件内重复手机号' }
      });
      continue;
    }
    seenPhones.add(phone);

    const existingMember = await prisma.member.findUnique({ where: { phone } });
    if (existingMember && conflictStrategy === 'SKIP') {
      addedSkipped++;
      await prisma.memberImportRecord.update({
        where: { id: record.id },
        data: { status: 'SKIPPED', memberId: existingMember.id, errorReason: '手机号已存在，已跳过' }
      });
    } else if (existingMember && conflictStrategy === 'MARK_FOR_REVIEW') {
      addedPending++;
      await prisma.memberImportRecord.update({
        where: { id: record.id },
        data: { status: 'PENDING_REVIEW', memberId: existingMember.id, errorReason: '手机号已存在，待人工处理' }
      });
    } else {
      try {
        let member;
        if (existingMember) {
          member = await prisma.member.update({ where: { phone }, data });
        } else {
          member = await prisma.member.create({ data });
          if (data.points && data.points > 0) {
            try {
              await createTransaction({
                memberId: member.id, points: data.points,
                reasonType: 'REGISTER_REWARD',
                operatorId: operator?.id || null,
                remark: '批量导入(重导)赠送积分',
              });
            } catch (txErr) {
              logger.warn('重导入会员积分交易创建失败', { memberId: member.id, error: txErr.message });
            }
          }
        }
        addedSuccess++;
        await prisma.memberImportRecord.update({
          where: { id: record.id },
          data: { status: 'SUCCESS', memberId: member.id, errorReason: null }
        });
      } catch (dbErr) {
        addedFailed++;
        await prisma.memberImportRecord.update({
          where: { id: record.id },
          data: { status: 'FAILED', errorReason: dbErr.message }
        });
      }
    }
  }

  const updated = await prisma.memberImportBatch.update({
    where: { id: batchId },
    data: {
      successCount: { increment: addedSuccess },
      skippedCount: { increment: addedSkipped },
      failedCount: { increment: addedFailed - failedRecords.filter(r => r.status === 'FAILED').length },
      pendingCount: { increment: addedPending - failedRecords.filter(r => r.status === 'PENDING_REVIEW').length },
    }
  });

  await createAuditLog({
    operator,
    actionType: 'BATCH_OPERATION',
    entityType: 'MEMBER',
    req,
    remark: `批量重导失败行：成功${addedSuccess}条，跳过${addedSkipped}条，失败${addedFailed}条，待处理${addedPending}条`,
    resultStatus: addedFailed === 0 ? 'SUCCESS' : 'PARTIAL',
  });

  return updated;
}

module.exports = {
  getStandardFields,
  getImportConfig,
  updateImportConfig,
  parseCsvFile,
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
};
