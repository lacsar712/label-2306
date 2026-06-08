const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const {
  MemberSchema,
  PointsUpdateSchema,
  FreezePointsSchema,
  MemberListWithTagsSchema,
} = require('../validations/schemas');
const { createTransaction } = require('./pointsTransaction');
const { getMemberBenefits } = require('./levelBenefitService');
const {
  buildPaginationQuery,
  buildPaginationResult,
} = require('../utils/pagination');

function buildMemberWhereClause({ search, level, status, tagIds, tagLogic }) {
  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
    ];
  }
  if (level) where.level = level;
  if (status) where.status = status;

  if (tagIds) {
    const tagIdArray = tagIds.split(',').map(Number).filter(n => !isNaN(n));
    if (tagIdArray.length > 0) {
      if (tagLogic === 'OR') {
        where.memberTags = { some: { tagId: { in: tagIdArray } } };
      } else {
        where.AND = tagIdArray.map(tid => ({
          memberTags: { some: { tagId: tid } },
        }));
      }
    }
  }

  return where;
}

async function listMembers(query) {
  const validated = MemberListWithTagsSchema.parse(query);
  const { page, pageSize, search, level, status, tagIds, tagLogic } = validated;

  const where = buildMemberWhereClause({ search, level, status, tagIds, tagLogic });
  const { skip, take } = buildPaginationQuery(page, pageSize);

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip,
      take,
      orderBy: { joinDate: 'desc' },
      include: {
        memberTags: {
          include: { tag: { include: { group: true } } },
        },
      },
    }),
    prisma.member.count({ where }),
  ]);

  return buildPaginationResult(members, total, page, pageSize);
}

async function createMember(body, operatorId) {
  const validatedData = MemberSchema.parse(body);
  const member = await prisma.member.create({ data: validatedData });

  if (validatedData.points && validatedData.points > 0) {
    try {
      await createTransaction({
        memberId: member.id,
        points: validatedData.points,
        reasonType: 'REGISTER_REWARD',
        operatorId: operatorId || null,
        remark: '注册赠送积分',
      });
    } catch (txError) {
      logger.warn('Failed to create register reward transaction', {
        memberId: member.id,
        error: txError.message,
      });
    }
  }

  return member;
}

async function updateMember(idParam, body) {
  const id = parseInt(idParam);
  const beforeMember = await prisma.member.findUnique({ where: { id } });
  const validatedData = MemberSchema.partial().parse(body);
  const member = await prisma.member.update({
    where: { id },
    data: validatedData,
  });

  return { beforeMember, member };
}

async function deleteMember(idParam) {
  const id = parseInt(idParam);
  const beforeMember = await prisma.member.findUnique({ where: { id } });
  await prisma.member.delete({ where: { id } });
  return beforeMember;
}

async function adjustMemberPoints(idParam, body, operatorId) {
  const id = parseInt(idParam);
  const { points, reasonType, bizOrderNo, bizOrderType, remark } = PointsUpdateSchema.parse(body);

  if (points === 0) {
    const error = new Error('Points change cannot be zero');
    error.status = 400;
    throw error;
  }

  const beforeMember = await prisma.member.findUnique({ where: { id } });

  const transaction = await createTransaction({
    memberId: id,
    points,
    reasonType: reasonType || 'MANUAL_ADJUST',
    bizOrderNo: bizOrderNo || null,
    bizOrderType: bizOrderType || null,
    operatorId: operatorId || null,
    remark: remark || null,
  });

  const member = await prisma.member.findUnique({ where: { id } });

  return { beforeMember, member, transaction, pointsAdjusted: points };
}

async function freezeMemberPoints(idParam, body, operatorId) {
  const id = parseInt(idParam);
  const { points, reasonType, bizOrderNo, bizOrderType, remark } = FreezePointsSchema.parse(body);

  const beforeMember = await prisma.member.findUnique({ where: { id } });

  const transaction = await createTransaction({
    memberId: id,
    points: -points,
    reasonType: reasonType || 'FREEZE_OP',
    bizOrderNo: bizOrderNo || null,
    bizOrderType: bizOrderType || null,
    operatorId: operatorId || null,
    remark: remark || null,
  });

  const member = await prisma.member.findUnique({ where: { id } });

  return { beforeMember, member, transaction, pointsFrozen: points };
}

async function unfreezeMemberPoints(idParam, body, operatorId) {
  const id = parseInt(idParam);
  const { points, reasonType, bizOrderNo, bizOrderType, remark } = FreezePointsSchema.parse(body);

  const beforeMember = await prisma.member.findUnique({ where: { id } });

  const transaction = await createTransaction({
    memberId: id,
    points,
    reasonType: reasonType || 'UNFREEZE_OP',
    bizOrderNo: bizOrderNo || null,
    bizOrderType: bizOrderType || null,
    operatorId: operatorId || null,
    remark: remark || null,
  });

  const member = await prisma.member.findUnique({ where: { id } });

  return { beforeMember, member, transaction, pointsUnfrozen: points };
}

async function getMemberTransactions(idParam, query) {
  const id = parseInt(idParam);
  const { page = 1, pageSize = 20 } = query;
  const { skip, take, page: p, pageSize: ps } = buildPaginationQuery(page, pageSize);

  const where = { memberId: id };

  const [transactions, total] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        operator: { select: { id: true, username: true } },
        reverseOf: { select: { id: true, serialNo: true, changeType: true, changeValue: true } },
      },
    }),
    prisma.pointsTransaction.count({ where }),
  ]);

  return buildPaginationResult(transactions, total, p, ps);
}

async function getMemberLevelBenefits(idParam) {
  const id = parseInt(idParam);
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) {
    const error = new Error('会员不存在');
    error.status = 404;
    throw error;
  }

  return await getMemberBenefits(member);
}

module.exports = {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  adjustMemberPoints,
  freezeMemberPoints,
  unfreezeMemberPoints,
  getMemberTransactions,
  getMemberLevelBenefits,
};
