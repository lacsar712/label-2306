const { z } = require('zod');

const MemberSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  email: z.string().email().optional().nullable(),
  level: z.enum(['NORMAL', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  points: z.number().int().optional(),
});

const PointsUpdateSchema = z.object({
  points: z.number().int(),
  reasonType: z.enum(['MANUAL_ADJUST', 'MALL_EXCHANGE', 'SIGN_IN_REWARD', 'ACTIVITY_BONUS', 'ORDER_EARN', 'EXPIRE_CLEAR', 'FREEZE_OP', 'UNFREEZE_OP', 'REVERSE_OP', 'REGISTER_REWARD', 'OTHER']).optional().default('MANUAL_ADJUST'),
  bizOrderNo: z.string().optional().nullable(),
  bizOrderType: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
});

const CreateUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const TransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
  memberId: z.coerce.number().int().optional(),
  memberName: z.string().optional(),
  memberPhone: z.string().optional(),
  changeType: z.enum(['ADD', 'DEDUCT', 'FREEZE', 'UNFREEZE', 'EXPIRE', 'REVERSE']).optional(),
  reasonType: z.enum(['MANUAL_ADJUST', 'MALL_EXCHANGE', 'SIGN_IN_REWARD', 'ACTIVITY_BONUS', 'ORDER_EARN', 'EXPIRE_CLEAR', 'FREEZE_OP', 'UNFREEZE_OP', 'REVERSE_OP', 'REGISTER_REWARD', 'OTHER']).optional(),
  bizOrderNo: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  serialNo: z.string().optional(),
});

const ReverseTransactionSchema = z.object({
  remark: z.string().optional().nullable(),
});

const FreezePointsSchema = z.object({
  points: z.number().int().positive(),
  reasonType: z.enum(['MANUAL_ADJUST', 'MALL_EXCHANGE', 'SIGN_IN_REWARD', 'ACTIVITY_BONUS', 'ORDER_EARN', 'EXPIRE_CLEAR', 'FREEZE_OP', 'UNFREEZE_OP', 'REVERSE_OP', 'REGISTER_REWARD', 'OTHER']).optional().default('FREEZE_OP'),
  bizOrderNo: z.string().optional().nullable(),
  bizOrderType: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
});

const TagGroupSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
});

const TagGroupUpdateSchema = TagGroupSchema.partial();

const TagRuleConditionSchema = z.object({
  field: z.enum(['POINTS', 'LEVEL', 'STATUS', 'JOIN_DATE', 'LAST_ACTIVE_DATE', 'CONSUME_COUNT', 'CONSUME_AMOUNT']),
  operator: z.enum(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'CONTAINS', 'IN']),
  value: z.any(),
});

const TagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#409EFF'),
  description: z.string().max(500).optional().nullable(),
  groupId: z.number().int().optional().nullable(),
  isMutuallyExclusive: z.boolean().optional().default(false),
  uniqueInGroup: z.boolean().optional().default(false),
  autoRuleEnabled: z.boolean().optional().default(false),
  ruleLogic: z.enum(['AND', 'OR']).optional().nullable(),
  ruleConditions: z.array(TagRuleConditionSchema).optional().nullable(),
});

const TagUpdateSchema = TagSchema.partial();

const MemberTagBindSchema = z.object({
  tagIds: z.array(z.number().int()),
  remark: z.string().optional().nullable(),
});

const MemberTagUnbindSchema = z.object({
  tagIds: z.array(z.number().int()),
  remark: z.string().optional().nullable(),
});

const BatchTagApplySchema = z.object({
  tagId: z.number().int(),
  memberIds: z.array(z.number().int()),
  remark: z.string().optional().nullable(),
});

const MemberListWithTagsSchema = z.object({
  search: z.string().optional(),
  level: z.string().optional(),
  status: z.string().optional(),
  tagIds: z.string().optional(),
  tagLogic: z.enum(['AND', 'OR']).optional().default('AND'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
});

const CouponCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['FULL_REDUCTION', 'DISCOUNT', 'POINTS_EXCHANGE']),
  value: z.coerce.number().positive(),
  minConsume: z.coerce.number().min(0).optional().default(0),
  pointsCost: z.coerce.number().int().positive().optional().nullable(),
  applicableLevels: z.array(z.enum(['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'])).optional().nullable(),
  scope: z.enum(['ALL', 'PRODUCT', 'CATEGORY']).optional().default('ALL'),
  scopeIds: z.array(z.union([z.string(), z.number()])).optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  validDays: z.coerce.number().int().positive().optional().nullable(),
  totalQuantity: z.coerce.number().int().positive(),
  perUserLimit: z.coerce.number().int().positive().optional().default(1),
  stackable: z.boolean().optional().default(false),
  shelfStatus: z.boolean().optional().default(true),
  description: z.string().max(500).optional().nullable(),
});

const CouponUpdateSchema = CouponCreateSchema.partial();

const CouponStatusChangeSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ENDED']),
  remark: z.string().optional().nullable(),
});

const CouponIssueSchema = z.object({
  couponId: z.coerce.number().int(),
  targetType: z.enum(['SPECIFIC', 'LEVEL', 'TAG']),
  targetIds: z.array(z.union([z.string(), z.number()])),
  scheduledAt: z.string().optional().nullable(),
  expireReminder: z.boolean().optional().default(true),
});

const CouponQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['FULL_REDUCTION', 'DISCOUNT', 'POINTS_EXCHANGE']).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ENDED']).optional(),
  shelfStatus: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
});

const MemberCouponQuerySchema = z.object({
  couponId: z.coerce.number().int().optional(),
  memberId: z.coerce.number().int().optional(),
  status: z.enum(['CLAIMED', 'LOCKED', 'REDEEMED', 'RETURNED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(20),
});

const CouponRedeemSchema = z.object({
  orderNo: z.string().min(1),
  remark: z.string().optional().nullable(),
});

const CouponRefundSchema = z.object({
  remark: z.string().optional().nullable(),
});

module.exports = {
  MemberSchema,
  PointsUpdateSchema,
  CreateUserSchema,
  UpdateUserSchema,
  TransactionQuerySchema,
  ReverseTransactionSchema,
  FreezePointsSchema,
  TagGroupSchema,
  TagGroupUpdateSchema,
  TagSchema,
  TagUpdateSchema,
  TagRuleConditionSchema,
  MemberTagBindSchema,
  MemberTagUnbindSchema,
  BatchTagApplySchema,
  MemberListWithTagsSchema,
  CouponCreateSchema,
  CouponUpdateSchema,
  CouponStatusChangeSchema,
  CouponIssueSchema,
  CouponQuerySchema,
  MemberCouponQuerySchema,
  CouponRedeemSchema,
  CouponRefundSchema,
};
