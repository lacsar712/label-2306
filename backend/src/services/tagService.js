const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { createAuditLog } = require('./auditLog');

function buildMemberWhereFromRule(conditions, logic) {
  if (!conditions || conditions.length === 0) return {};

  const whereClauses = conditions.map(cond => {
    switch (cond.field) {
      case 'POINTS':
        return buildNumericWhere('points', cond.operator, cond.value);
      case 'LEVEL':
        return buildEnumWhere('level', cond.operator, cond.value);
      case 'STATUS':
        return buildEnumWhere('status', cond.operator, cond.value);
      case 'JOIN_DATE':
        return buildDateWhere('joinDate', cond.operator, cond.value);
      default:
        return {};
    }
  }).filter(c => Object.keys(c).length > 0);

  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];

  return logic === 'OR' ? { OR: whereClauses } : { AND: whereClauses };
}

function buildNumericWhere(field, operator, value) {
  switch (operator) {
    case 'EQ': return { [field]: { equals: Number(value) } };
    case 'NE': return { [field]: { not: Number(value) } };
    case 'GT': return { [field]: { gt: Number(value) } };
    case 'GTE': return { [field]: { gte: Number(value) } };
    case 'LT': return { [field]: { lt: Number(value) } };
    case 'LTE': return { [field]: { lte: Number(value) } };
    case 'BETWEEN':
      if (Array.isArray(value) && value.length === 2) {
        return { [field]: { gte: Number(value[0]), lte: Number(value[1]) } };
      }
      return {};
    case 'IN':
      if (Array.isArray(value)) {
        return { [field]: { in: value.map(Number) } };
      }
      return {};
    default: return {};
  }
}

function buildEnumWhere(field, operator, value) {
  switch (operator) {
    case 'EQ': return { [field]: { equals: value } };
    case 'NE': return { [field]: { not: value } };
    case 'IN':
      if (Array.isArray(value)) return { [field]: { in: value } };
      return {};
    default: return {};
  }
}

function buildDateWhere(field, operator, value) {
  switch (operator) {
    case 'EQ': return { [field]: { equals: new Date(value) } };
    case 'GT': return { [field]: { gt: new Date(value) } };
    case 'GTE': return { [field]: { gte: new Date(value) } };
    case 'LT': return { [field]: { lt: new Date(value) } };
    case 'LTE': return { [field]: { lte: new Date(value) } };
    case 'BETWEEN':
      if (Array.isArray(value) && value.length === 2) {
        return { [field]: { gte: new Date(value[0]), lte: new Date(value[1]) } };
      }
      return {};
    default: return {};
  }
}

async function previewRuleMatches(tagId) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw new Error('Tag not found');
  if (!tag.autoRuleEnabled) return { members: [], total: 0 };

  const where = buildMemberWhereFromRule(tag.ruleConditions, tag.ruleLogic);
  const alreadyTaggedMemberIds = (await prisma.memberTag.findMany({
    where: { tagId },
    select: { memberId: true },
  })).map(mt => mt.memberId);

  if (alreadyTaggedMemberIds.length > 0) {
    where.id = { notIn: alreadyTaggedMemberIds };
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      take: 100,
      orderBy: { joinDate: 'desc' },
      include: { memberTags: { include: { tag: true } } },
    }),
    prisma.member.count({ where }),
  ]);

  return { members, total };
}

async function applyTagToMembers(tagId, memberIds, source = 'BATCH', operator = null, remark = null) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId }, include: { group: true } });
  if (!tag) throw new Error('Tag not found');

  const results = { success: [], failed: [], skipped: [] };

  for (const memberId of memberIds) {
    try {
      const existing = await prisma.memberTag.findUnique({
        where: { memberId_tagId: { memberId, tagId } },
      });
      if (existing) {
        results.skipped.push(memberId);
        continue;
      }

      if (tag.isMutuallyExclusive) {
        await prisma.memberTag.deleteMany({
          where: {
            memberId,
            tag: {
              OR: [
                { id: tagId },
                { isMutuallyExclusive: true },
              ],
            },
          },
        });
      }

      if (tag.uniqueInGroup && tag.groupId) {
        await prisma.memberTag.deleteMany({
          where: {
            memberId,
            tag: { groupId: tag.groupId },
          },
        });
      }

      await prisma.$transaction([
        prisma.memberTag.create({
          data: { memberId, tagId, source, operatorId: operator?.id || null, remark },
        }),
        prisma.tagBindingHistory.create({
          data: { memberId, tagId, action: 'BIND', source, operatorId: operator?.id || null, remark },
        }),
      ]);

      results.success.push(memberId);
    } catch (error) {
      logger.error('Failed to apply tag to member', { tagId, memberId, error: error.message });
      results.failed.push({ memberId, error: error.message });
    }
  }

  return results;
}

async function unbindTagFromMembers(tagId, memberIds, source = 'MANUAL', operator = null, remark = null) {
  const results = { success: [], failed: [], skipped: [] };

  for (const memberId of memberIds) {
    try {
      const existing = await prisma.memberTag.findUnique({
        where: { memberId_tagId: { memberId, tagId } },
      });
      if (!existing) {
        results.skipped.push(memberId);
        continue;
      }

      await prisma.$transaction([
        prisma.memberTag.delete({
          where: { memberId_tagId: { memberId, tagId } },
        }),
        prisma.tagBindingHistory.create({
          data: { memberId, tagId, action: 'UNBIND', source, operatorId: operator?.id || null, remark },
        }),
      ]);

      results.success.push(memberId);
    } catch (error) {
      logger.error('Failed to unbind tag from member', { tagId, memberId, error: error.message });
      results.failed.push({ memberId, error: error.message });
    }
  }

  return results;
}

async function runAutoTagRule(tagId, operator = null) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw new Error('Tag not found');
  if (!tag.autoRuleEnabled) return { success: 0, failed: 0, skipped: 0 };

  const { members, total } = await previewRuleMatches(tagId);
  const memberIds = members.map(m => m.id);

  const results = await applyTagToMembers(tagId, memberIds, 'AUTO_RULE', operator, `自动规则执行: ${tag.name}`);

  await createAuditLog({
    operator,
    actionType: 'TAG_RULE_APPLY',
    entityType: 'TAG',
    entityId: tagId,
    afterSnapshot: { tagId, tagName: tag.name, matchedCount: total, appliedCount: results.success.length },
    remark: `自动打标规则执行: ${tag.name}, 命中 ${total} 人, 成功打标 ${results.success.length} 人`,
    resultStatus: results.failed.length > 0 ? 'PARTIAL' : 'SUCCESS',
    errorMessage: results.failed.length > 0 ? `失败 ${results.failed.length} 人` : null,
  });

  return { ...results, totalMatched: total };
}

async function getTagStats() {
  const tags = await prisma.tag.findMany({
    include: { group: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalMembers = await prisma.member.count();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats = await Promise.all(tags.map(async (tag) => {
    const memberCount = await prisma.memberTag.count({ where: { tagId: tag.id } });
    const bindingsLast7Days = await prisma.tagBindingHistory.count({
      where: { tagId: tag.id, action: 'BIND', createdAt: { gte: sevenDaysAgo } },
    });
    const unbindingsLast7Days = await prisma.tagBindingHistory.count({
      where: { tagId: tag.id, action: 'UNBIND', createdAt: { gte: sevenDaysAgo } },
    });

    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayBindings = await prisma.tagBindingHistory.count({
        where: { tagId: tag.id, action: 'BIND', createdAt: { gte: dayStart, lt: dayEnd } },
      });
      const dayUnbindings = await prisma.tagBindingHistory.count({
        where: { tagId: tag.id, action: 'UNBIND', createdAt: { gte: dayStart, lt: dayEnd } },
      });

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        bindings: dayBindings,
        unbindings: dayUnbindings,
        net: dayBindings - dayUnbindings,
      });
    }

    return {
      ...tag,
      memberCount,
      percentage: totalMembers > 0 ? parseFloat(((memberCount / totalMembers) * 100).toFixed(2)) : 0,
      last7DaysChange: bindingsLast7Days - unbindingsLast7Days,
      last7DaysBindings: bindingsLast7Days,
      last7DaysUnbindings: unbindingsLast7Days,
      dailyTrend,
    };
  }));

  return { stats, totalMembers };
}

module.exports = {
  buildMemberWhereFromRule,
  previewRuleMatches,
  applyTagToMembers,
  unbindTagFromMembers,
  runAutoTagRule,
  getTagStats,
};
