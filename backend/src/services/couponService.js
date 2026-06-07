const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

function generateCouponCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CPN${timestamp}${random}`;
}

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['DRAFT', 'PUBLISHED'],
  PUBLISHED: ['ENDED'],
  ENDED: [],
};

function validateStatusTransition(currentStatus, newStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

async function getMembersByTarget(targetType, targetIds) {
  let members = [];

  if (targetType === 'SPECIFIC') {
    members = await prisma.member.findMany({
      where: { id: { in: targetIds.map(id => parseInt(id)) } },
    });
  } else if (targetType === 'LEVEL') {
    members = await prisma.member.findMany({
      where: { level: { in: targetIds } },
    });
  } else if (targetType === 'TAG') {
    const tagIds = targetIds.map(id => parseInt(id));
    const memberTags = await prisma.memberTag.findMany({
      where: { tagId: { in: tagIds } },
      select: { memberId: true },
      distinct: ['memberId'],
    });
    const memberIds = memberTags.map(mt => mt.memberId);
    members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
    });
  }

  return members;
}

async function issueCoupons({ couponId, targetType, targetIds, scheduledAt, expireReminder, operator }) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) {
    throw new Error('优惠券不存在');
  }
  if (coupon.status !== 'PUBLISHED') {
    throw new Error('优惠券未发布，无法发放');
  }
  if (!coupon.shelfStatus) {
    throw new Error('优惠券已下架');
  }

  const members = await getMembersByTarget(targetType, targetIds);
  if (members.length === 0) {
    return { success: 0, failed: 0, skipped: 0, results: [] };
  }

  const batch = await prisma.couponIssueBatch.create({
    data: {
      couponId,
      targetType,
      targetIds,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expireReminder,
      operatorId: operator?.id || null,
    },
  });

  const results = { success: [], failed: [], skipped: [] };

  for (const member of members) {
    try {
      if (coupon.applicableLevels) {
        const levels = Array.isArray(coupon.applicableLevels)
          ? coupon.applicableLevels
          : coupon.applicableLevels;
        if (!levels.includes(member.level)) {
          results.skipped.push({ memberId: member.id, reason: '会员等级不符合' });
          continue;
        }
      }

      const existingCount = await prisma.memberCoupon.count({
        where: { couponId, memberId: member.id },
      });
      if (existingCount >= coupon.perUserLimit) {
        results.skipped.push({ memberId: member.id, reason: '已达到每人限领次数' });
        continue;
      }

      const currentClaimed = await prisma.memberCoupon.count({ where: { couponId } });
      if (currentClaimed >= coupon.totalQuantity) {
        results.failed.push({ memberId: member.id, reason: '优惠券库存不足' });
        continue;
      }

      const code = generateCouponCode();
      let expiredAt = null;
      if (coupon.validTo) {
        expiredAt = new Date(coupon.validTo);
      } else if (coupon.validDays) {
        expiredAt = new Date();
        expiredAt.setDate(expiredAt.getDate() + coupon.validDays);
      }

      const memberCoupon = await prisma.memberCoupon.create({
        data: {
          couponId,
          memberId: member.id,
          code,
          batchId: batch.id,
          expiredAt,
        },
      });

      results.success.push({ memberId: member.id, couponCode: code, memberCouponId: memberCoupon.id });
    } catch (err) {
      logger.error('发放优惠券失败', { memberId: member.id, couponId, error: err.message });
      results.failed.push({ memberId: member.id, reason: err.message });
    }
  }

  await prisma.coupon.update({
    where: { id: couponId },
    data: { claimedQuantity: { increment: results.success.length } },
  });

  await prisma.couponIssueBatch.update({
    where: { id: batch.id },
    data: { totalIssued: results.success.length },
  });

  return {
    batchId: batch.id,
    total: members.length,
    success: results.success.length,
    failed: results.failed.length,
    skipped: results.skipped.length,
    results,
  };
}

async function redeemMemberCoupon(memberCouponId, orderNo, remark) {
  const memberCoupon = await prisma.memberCoupon.findUnique({
    where: { id: memberCouponId },
    include: { coupon: true },
  });

  if (!memberCoupon) {
    throw new Error('会员优惠券不存在');
  }
  if (memberCoupon.status !== 'CLAIMED') {
    throw new Error(`优惠券状态为 ${memberCoupon.status}，无法核销`);
  }

  const now = new Date();
  if (memberCoupon.coupon.validFrom && now < new Date(memberCoupon.coupon.validFrom)) {
    throw new Error('优惠券尚未生效');
  }
  if (memberCoupon.expiredAt && now > new Date(memberCoupon.expiredAt)) {
    throw new Error('优惠券已过期');
  }

  const updated = await prisma.memberCoupon.update({
    where: { id: memberCouponId },
    data: {
      status: 'REDEEMED',
      orderNo,
      redeemedAt: now,
      remark,
    },
  });

  await prisma.coupon.update({
    where: { id: memberCoupon.couponId },
    data: { redeemedQuantity: { increment: 1 } },
  });

  return updated;
}

async function refundMemberCoupon(memberCouponId, remark) {
  const memberCoupon = await prisma.memberCoupon.findUnique({
    where: { id: memberCouponId },
  });

  if (!memberCoupon) {
    throw new Error('会员优惠券不存在');
  }
  if (memberCoupon.status !== 'REDEEMED' && memberCoupon.status !== 'LOCKED') {
    throw new Error(`优惠券状态为 ${memberCoupon.status}，无法退回`);
  }

  const updated = await prisma.memberCoupon.update({
    where: { id: memberCouponId },
    data: {
      status: 'RETURNED',
      returnedAt: new Date(),
      remark,
    },
  });

  if (memberCoupon.status === 'REDEEMED') {
    await prisma.coupon.update({
      where: { id: memberCoupon.couponId },
      data: { redeemedQuantity: { decrement: 1 } },
    });
  }

  return updated;
}

async function lockMemberCoupon(memberCouponId, orderNo) {
  const memberCoupon = await prisma.memberCoupon.findUnique({
    where: { id: memberCouponId },
  });

  if (!memberCoupon) {
    throw new Error('会员优惠券不存在');
  }
  if (memberCoupon.status !== 'CLAIMED') {
    throw new Error(`优惠券状态为 ${memberCoupon.status}，无法锁定`);
  }

  return prisma.memberCoupon.update({
    where: { id: memberCouponId },
    data: {
      status: 'LOCKED',
      orderNo,
      lockedAt: new Date(),
    },
  });
}

async function getCouponStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activeCoupons = await prisma.coupon.count({
    where: {
      status: 'PUBLISHED',
      shelfStatus: true,
      OR: [
        { validFrom: null },
        { validFrom: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { validTo: null },
            { validTo: { gte: now } },
          ],
        },
      ],
    },
  });

  const totalClaimed = await prisma.memberCoupon.count();
  const totalIssuedQuantity = await prisma.coupon.aggregate({
    _sum: { totalQuantity: true },
  });
  const totalClaimedQuantity = await prisma.coupon.aggregate({
    _sum: { claimedQuantity: true },
  });
  const totalRedeemedQuantity = await prisma.coupon.aggregate({
    _sum: { redeemedQuantity: true },
  });

  const claimRate = totalClaimedQuantity._sum.claimedQuantity && totalIssuedQuantity._sum.totalQuantity
    ? (totalClaimedQuantity._sum.claimedQuantity / totalIssuedQuantity._sum.totalQuantity) * 100
    : 0;

  const redeemRate = totalRedeemedQuantity._sum.redeemedQuantity && totalClaimedQuantity._sum.claimedQuantity
    ? (totalRedeemedQuantity._sum.redeemedQuantity / totalClaimedQuantity._sum.claimedQuantity) * 100
    : 0;

  const redeemedCoupons = await prisma.memberCoupon.findMany({
    where: { status: 'REDEEMED' },
    include: { coupon: true },
  });

  let totalFaceValue = 0;
  for (const mc of redeemedCoupons) {
    if (mc.coupon.type === 'FULL_REDUCTION' || mc.coupon.type === 'POINTS_EXCHANGE') {
      totalFaceValue += parseFloat(mc.coupon.value);
    } else if (mc.coupon.type === 'DISCOUNT') {
      totalFaceValue += (100 - parseFloat(mc.coupon.value)) * 10;
    }
  }
  const roiEstimate = totalFaceValue > 0 ? totalFaceValue * 3 : 0;

  const last30DaysClaimed = await prisma.memberCoupon.groupBy({
    by: ['couponId'],
    where: { claimedAt: { gte: thirtyDaysAgo } },
    _count: { _all: true },
  });

  const last30DaysRedeemed = await prisma.memberCoupon.groupBy({
    by: ['couponId'],
    where: { redeemedAt: { gte: thirtyDaysAgo }, status: 'REDEEMED' },
    _count: { _all: true },
  });

  const coupons = await prisma.coupon.findMany({
    select: { id: true, name: true, type: true },
    where: {
      OR: [
        { id: { in: last30DaysClaimed.map(c => c.couponId) } },
        { id: { in: last30DaysRedeemed.map(c => c.couponId) } },
      ],
    },
  });

  const couponMap = new Map(coupons.map(c => [c.id, c]));

  const byType = {
    FULL_REDUCTION: { claimed: 0, redeemed: 0, name: '满减券' },
    DISCOUNT: { claimed: 0, redeemed: 0, name: '折扣券' },
    POINTS_EXCHANGE: { claimed: 0, redeemed: 0, name: '积分兑换券' },
  };

  for (const item of last30DaysClaimed) {
    const coupon = couponMap.get(item.couponId);
    if (coupon && byType[coupon.type]) {
      byType[coupon.type].claimed += item._count._all;
    }
  }

  for (const item of last30DaysRedeemed) {
    const coupon = couponMap.get(item.couponId);
    if (coupon && byType[coupon.type]) {
      byType[coupon.type].redeemed += item._count._all;
    }
  }

  const dailyTrend = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const claimedCount = await prisma.memberCoupon.count({
      where: { claimedAt: { gte: dayStart, lt: dayEnd } },
    });
    const redeemedCount = await prisma.memberCoupon.count({
      where: { redeemedAt: { gte: dayStart, lt: dayEnd }, status: 'REDEEMED' },
    });

    dailyTrend.push({
      date: dayStart.toISOString().split('T')[0],
      claimed: claimedCount,
      redeemed: redeemedCount,
    });
  }

  return {
    activeCoupons,
    claimRate: parseFloat(claimRate.toFixed(2)),
    redeemRate: parseFloat(redeemRate.toFixed(2)),
    roiEstimate: parseFloat(roiEstimate.toFixed(2)),
    byType,
    dailyTrend,
  };
}

module.exports = {
  generateCouponCode,
  validateStatusTransition,
  issueCoupons,
  redeemMemberCoupon,
  refundMemberCoupon,
  lockMemberCoupon,
  getMembersByTarget,
  getCouponStats,
};
