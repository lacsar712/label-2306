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

module.exports = {
  MemberSchema,
  PointsUpdateSchema,
  CreateUserSchema,
  UpdateUserSchema,
};
