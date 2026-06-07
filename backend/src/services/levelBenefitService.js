const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['DRAFT'],
};

const LEVEL_ORDER = ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'];

function validateStatusTransition(currentStatus, newStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

function getNextLevel(currentLevel) {
  const idx = LEVEL_ORDER.indexOf(currentLevel);
  if (idx === -1 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

async function createVersion(benefit, operatorId, changeRemark) {
  const lastVersion = await prisma.levelBenefitVersion.findFirst({
    where: { benefitId: benefit.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version || 0) + 1;

  return prisma.levelBenefitVersion.create({
    data: {
      benefitId: benefit.id,
      version: nextVersion,
      title: benefit.title,
      description: benefit.description,
      icon: benefit.icon,
      level: benefit.level,
      sortOrder: benefit.sortOrder,
      minPoints: benefit.minPoints,
      isEnabled: benefit.isEnabled,
      status: benefit.status,
      changeRemark,
      operatorId,
    },
  });
}

async function reorderBenefits(items, operatorId) {
  const results = [];
  for (const item of items) {
    const updated = await prisma.levelBenefit.update({
      where: { id: item.id },
      data: { sortOrder: item.sortOrder },
    });
    results.push(updated);
  }
  return results;
}

async function copyBenefit(sourceId, targetLevel, withSortOrder, operator) {
  const source = await prisma.levelBenefit.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error('源权益不存在');
  }

  const sortOrder = withSortOrder
    ? source.sortOrder
    : await prisma.levelBenefit.count({ where: { level: targetLevel } });

  const newBenefit = await prisma.levelBenefit.create({
    data: {
      title: source.title + ' (副本)',
      description: source.description,
      icon: source.icon,
      level: targetLevel,
      sortOrder,
      minPoints: source.minPoints,
      isEnabled: source.isEnabled,
      status: 'DRAFT',
      operatorId: operator?.id || null,
    },
  });

  await createVersion(newBenefit, operator?.id || null, `从 ${source.level} 复制创建`);
  return newBenefit;
}

async function getImpactPreview(benefitId, newData) {
  const benefit = await prisma.levelBenefit.findUnique({ where: { id: benefitId } });
  if (!benefit) {
    throw new Error('权益不存在');
  }

  const targetLevel = newData.level || benefit.level;
  const targetMinPoints = newData.minPoints !== undefined ? newData.minPoints : benefit.minPoints;
  const isEnabled = newData.isEnabled !== undefined ? newData.isEnabled : benefit.isEnabled;
  const isPublished = (newData.status || benefit.status) === 'PUBLISHED';

  if (!isEnabled || !isPublished) {
    return {
      affectedLevels: {},
      totalAffectedMembers: 0,
      byLevel: {},
    };
  }

  const affectedLevels = [targetLevel];
  const levelIdx = LEVEL_ORDER.indexOf(targetLevel);
  for (let i = levelIdx + 1; i < LEVEL_ORDER.length; i++) {
    affectedLevels.push(LEVEL_ORDER[i]);
  }

  const byLevel = {};
  let total = 0;

  for (const level of affectedLevels) {
    const count = await prisma.member.count({
      where: {
        level,
        points: { gte: targetMinPoints },
        status: 'ACTIVE',
      },
    });
    byLevel[level] = count;
    total += count;
  }

  return {
    affectedLevels,
    totalAffectedMembers: total,
    byLevel,
  };
}

async function getMemberBenefits(member) {
  const currentLevelBenefits = await prisma.levelBenefit.findMany({
    where: {
      level: member.level,
      status: 'PUBLISHED',
      isEnabled: true,
      minPoints: { lte: member.points },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const nextLevel = getNextLevel(member.level);
  let nextLevelBenefits = [];
  if (nextLevel) {
    nextLevelBenefits = await prisma.levelBenefit.findMany({
      where: {
        level: nextLevel,
        status: 'PUBLISHED',
        isEnabled: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  return {
    currentLevel: member.level,
    currentLevelBenefits,
    nextLevel,
    nextLevelBenefits,
  };
}

async function getLevelBenefitsSummary() {
  const result = {};
  for (const level of LEVEL_ORDER) {
    const published = await prisma.levelBenefit.count({
      where: { level, status: 'PUBLISHED', isEnabled: true },
    });
    const draft = await prisma.levelBenefit.count({
      where: { level, status: 'DRAFT' },
    });
    const pending = await prisma.levelBenefit.count({
      where: { level, status: 'PENDING_REVIEW' },
    });
    result[level] = { published, draft, pending, total: published + draft + pending };
  }
  return result;
}

module.exports = {
  validateStatusTransition,
  getNextLevel,
  createVersion,
  reorderBenefits,
  copyBenefit,
  getImpactPreview,
  getMemberBenefits,
  getLevelBenefitsSummary,
  LEVEL_ORDER,
};
