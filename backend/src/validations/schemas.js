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

module.exports = {
  MemberSchema,
  PointsUpdateSchema,
  CreateUserSchema,
  UpdateUserSchema,
  TransactionQuerySchema,
  ReverseTransactionSchema,
  FreezePointsSchema,
};
