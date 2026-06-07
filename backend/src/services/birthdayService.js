const prisma = require('../utils/prisma');
const { createTransaction } = require('./pointsTransaction');

const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getWeekRange = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const calculateAge = (birthdayYear, birthdayMonth, birthdayDay) => {
  if (!birthdayYear || !birthdayMonth || !birthdayDay) return null;
  const today = new Date();
  let age = today.getFullYear() - birthdayYear;
  const monthDiff = today.getMonth() - (birthdayMonth - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdayDay)) {
    age--;
  }
  return age >= 0 ? age : null;
};

const enrichMemberWithBirthdayInfo = (member) => {
  const age = calculateAge(member.birthday, member.birthdayMonth, member.birthdayDay);
  return {
    ...member,
    age,
  };
};

const getBirthdaysByScope = async ({ scope, year, month, level }) => {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  const currentMonth = month || (now.getMonth() + 1);

  let where = {
    birthdayMonth: { not: null },
    birthdayDay: { not: null },
    status: 'ACTIVE',
  };

  if (level) {
    where.level = level;
  }

  switch (scope) {
    case 'TODAY': {
      where.birthdayMonth = now.getMonth() + 1;
      where.birthdayDay = now.getDate();
      break;
    }
    case 'THIS_WEEK': {
      const { start, end } = getWeekRange(now);
      const startMonth = start.getMonth() + 1;
      const endMonth = end.getMonth() + 1;
      const startDay = start.getDate();
      const endDay = end.getDate();

      if (startMonth === endMonth) {
        where.birthdayMonth = startMonth;
        where.birthdayDay = { gte: startDay, lte: endDay };
      } else {
        where.OR = [
          { birthdayMonth: startMonth, birthdayDay: { gte: startDay } },
          { birthdayMonth: endMonth, birthdayDay: { lte: endDay } },
        ];
      }
      break;
    }
    case 'THIS_MONTH': {
      where.birthdayMonth = now.getMonth() + 1;
      break;
    }
    case 'NEXT_MONTH': {
      const nextMonth = now.getMonth() + 2;
      if (nextMonth > 12) {
        where.birthdayMonth = 1;
      } else {
        where.birthdayMonth = nextMonth;
      }
      break;
    }
    case 'CALENDAR': {
      where.birthdayMonth = currentMonth;
      break;
    }
  }

  const members = await prisma.member.findMany({
    where,
    include: {
      birthdayCareRecords: {
        where: { birthdayYear: currentYear },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { birthdayMonth: 'asc' },
      { birthdayDay: 'asc' },
    ],
  });

  return members.map((m) => {
    const enriched = enrichMemberWithBirthdayInfo(m);
    const careRecord = m.birthdayCareRecords?.[0] || null;
    return {
      ...enriched,
      birthdayCareRecords: undefined,
      hasCaredThisYear: !!careRecord,
      lastCareRecord: careRecord ? {
        id: careRecord.id,
        channel: careRecord.channel,
        pointsGiven: careRecord.pointsGiven,
        result: careRecord.result,
        createdAt: careRecord.createdAt,
      } : null,
    };
  });
};

const getCalendarBirthdays = async (year, month, level) => {
  const members = await getBirthdaysByScope({ scope: 'CALENDAR', year, month, level });
  const calendar = {};
  members.forEach((m) => {
    const day = m.birthdayDay;
    if (!calendar[day]) {
      calendar[day] = [];
    }
    calendar[day].push(m);
  });
  return calendar;
};

const getDashboardStats = async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const todayMembers = await getBirthdaysByScope({ scope: 'TODAY' });
  const weekMembers = await getBirthdaysByScope({ scope: 'THIS_WEEK' });
  const monthMembers = await getBirthdaysByScope({ scope: 'THIS_MONTH' });

  const caredCount = monthMembers.filter((m) => m.hasCaredThisYear).length;
  const completionRate = monthMembers.length > 0 ? Math.round((caredCount / monthMembers.length) * 100) : 0;

  const heatmapData = {};
  for (let m = 1; m <= 12; m++) {
    const count = await prisma.member.count({
      where: {
        birthdayMonth: m,
        status: 'ACTIVE',
        birthdayDay: { not: null },
      },
    });
    heatmapData[m] = count;
  }

  const careConfig = await getCareConfig();
  const remindThreshold = careConfig?.remindDaysBefore || 3;

  const today = now.getDate();
  const upcomingMembers = monthMembers.filter((m) => {
    const daysUntilBirthday = m.birthdayDay - today;
    return daysUntilBirthday > 0 && daysUntilBirthday <= remindThreshold;
  });

  return {
    today: {
      count: todayMembers.length,
      members: todayMembers.slice(0, 5),
    },
    thisWeek: {
      count: weekMembers.length,
    },
    thisMonth: {
      count: monthMembers.length,
      caredCount,
      completionRate,
    },
    upcoming: {
      count: upcomingMembers.length,
      members: upcomingMembers.slice(0, 5),
      remindDaysBefore: remindThreshold,
    },
    heatmap: heatmapData,
  };
};

const getWishTemplates = async () => {
  return prisma.birthdayWishTemplate.findMany({
    include: {
      operator: { select: { id: true, username: true } },
    },
    orderBy: { id: 'asc' },
  });
};

const upsertWishTemplate = async (data, operatorId) => {
  const { level, title, content, isEnabled } = data;
  return prisma.birthdayWishTemplate.upsert({
    where: { level },
    update: { title, content, isEnabled, operatorId },
    create: { level, title, content, isEnabled, operatorId },
  });
};

const getPointsRules = async () => {
  return prisma.birthdayPointsRule.findMany({
    include: {
      operator: { select: { id: true, username: true } },
    },
    orderBy: { id: 'asc' },
  });
};

const upsertPointsRule = async (data, operatorId) => {
  const { level, points, preventDuplicate, isEnabled } = data;
  return prisma.birthdayPointsRule.upsert({
    where: { level },
    update: { points, preventDuplicate, isEnabled, operatorId },
    create: { level, points, preventDuplicate, isEnabled, operatorId },
  });
};

const getCareConfig = async () => {
  let config = await prisma.birthdayCareConfig.findFirst();
  if (!config) {
    config = await prisma.birthdayCareConfig.create({
      data: {
        remindDaysBefore: 3,
        autoSendEnabled: false,
        defaultChannel: 'SMS',
      },
    });
  }
  return config;
};

const updateCareConfig = async (data, operatorId) => {
  const config = await getCareConfig();
  return prisma.birthdayCareConfig.update({
    where: { id: config.id },
    data: { ...data, operatorId },
  });
};

const executeBirthdayCare = async ({ memberIds, scope, channel, sendWish = true, givePoints = true, remark, operatorId }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const careConfig = await getCareConfig();
  const effectiveChannel = channel || careConfig.defaultChannel;

  let targetMembers;
  if (memberIds && memberIds.length > 0) {
    targetMembers = await prisma.member.findMany({
      where: {
        id: { in: memberIds },
        status: 'ACTIVE',
        birthdayMonth: { not: null },
        birthdayDay: { not: null },
      },
    });
  } else if (scope) {
    targetMembers = await getBirthdaysByScope({ scope });
  } else {
    throw new Error('Either memberIds or scope must be provided');
  }

  const allTemplates = await getWishTemplates();
  const allRules = await getPointsRules();

  const templateMap = {};
  allTemplates.forEach((t) => {
    if (t.isEnabled) templateMap[t.level] = t;
  });

  const ruleMap = {};
  allRules.forEach((r) => {
    if (r.isEnabled) ruleMap[r.level] = r;
  });

  const results = [];

  for (const member of targetMembers) {
    try {
      const existingRecord = await prisma.birthdayCareRecord.findUnique({
        where: {
          memberId_birthdayYear: {
            memberId: member.id,
            birthdayYear: currentYear,
          },
        },
      });

      const rule = ruleMap[member.level];
      if (existingRecord && rule?.preventDuplicate) {
        results.push({
          memberId: member.id,
          memberName: member.name,
          result: 'SKIPPED',
          reason: '本年度已关怀过，重复赠送保护已启用',
        });
        continue;
      }

      let wishContent = null;
      let templateId = null;
      if (sendWish) {
        const template = templateMap[member.level];
        if (template) {
          templateId = template.id;
          wishContent = template.content
            .replace(/\{name\}/g, member.name)
            .replace(/\{year\}/g, String(currentYear));
        }
      }

      let pointsGiven = 0;
      let transactionId = null;
      if (givePoints && rule && rule.points > 0) {
        pointsGiven = rule.points;
        const tx = await createTransaction({
          memberId: member.id,
          points: rule.points,
          reasonType: 'BIRTHDAY_GIFT',
          operatorId,
          remark: remark || `${currentYear}年生日关怀赠送积分`,
        });
        transactionId = tx.id;
      }

      const careRecord = await prisma.birthdayCareRecord.upsert({
        where: {
          memberId_birthdayYear: {
            memberId: member.id,
            birthdayYear: currentYear,
          },
        },
        update: {
          channel: effectiveChannel,
          templateId,
          wishContent,
          pointsGiven,
          transactionId,
          operatorId,
          result: 'SUCCESS',
          remark,
        },
        create: {
          memberId: member.id,
          birthdayYear: currentYear,
          channel: effectiveChannel,
          templateId,
          wishContent,
          pointsGiven,
          transactionId,
          operatorId,
          result: 'SUCCESS',
          remark,
        },
      });

      results.push({
        memberId: member.id,
        memberName: member.name,
        result: 'SUCCESS',
        careRecordId: careRecord.id,
        pointsGiven,
      });
    } catch (error) {
      results.push({
        memberId: member.id,
        memberName: member.name,
        result: 'FAILED',
        error: error.message,
      });
    }
  }

  return {
    total: targetMembers.length,
    success: results.filter((r) => r.result === 'SUCCESS').length,
    failed: results.filter((r) => r.result === 'FAILED').length,
    skipped: results.filter((r) => r.result === 'SKIPPED').length,
    details: results,
  };
};

const getCareRecords = async ({ page, pageSize, memberId, birthdayYear, channel, result, startDate, endDate }) => {
  const where = {};

  if (memberId) where.memberId = memberId;
  if (birthdayYear) where.birthdayYear = birthdayYear;
  if (channel) where.channel = channel;
  if (result) where.result = result;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = getEndOfDay(new Date(endDate));
  }

  const [list, total] = await Promise.all([
    prisma.birthdayCareRecord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, name: true, phone: true, level: true } },
        operator: { select: { id: true, username: true } },
        transaction: { select: { id: true, serialNo: true, changeValue: true } },
      },
    }),
    prisma.birthdayCareRecord.count({ where }),
  ]);

  return {
    list,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

const getMemberCareHistory = async (memberId) => {
  return prisma.birthdayCareRecord.findMany({
    where: { memberId },
    orderBy: { birthdayYear: 'desc' },
    include: {
      operator: { select: { id: true, username: true } },
      transaction: { select: { id: true, serialNo: true, changeValue: true } },
    },
  });
};

module.exports = {
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
  calculateAge,
};
