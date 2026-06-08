const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { CreateUserSchema, UpdateUserSchema } = require('../validations/schemas');

const USER_SELECT = { id: true, username: true, role: true, createdAt: true };

async function getAllUsers() {
  return await prisma.user.findMany({ select: USER_SELECT });
}

async function createUser(body) {
  const { username, password, role } = CreateUserSchema.parse(body);
  const hashedPassword = await bcrypt.hash(password, 10);
  return await prisma.user.create({
    data: { username, password: hashedPassword, role },
    select: USER_SELECT,
  });
}

async function updateUser(idParam, body, currentUserId) {
  const id = parseInt(idParam);
  const { username, password, role } = UpdateUserSchema.parse(body);

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });

  if (existingUser && existingUser.username === 'admin' && role && role !== 'ADMIN') {
    const error = new Error('Cannot change admin role');
    error.status = 400;
    throw error;
  }

  if (!username && !password && !role) {
    const error = new Error('No fields to update');
    error.status = 400;
    throw error;
  }

  const data = {};
  if (username) data.username = username;
  if (role) data.role = role;
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });

  return { beforeUser: existingUser, updatedUser };
}

async function deleteUser(idParam, currentUserId) {
  const id = parseInt(idParam);

  if (currentUserId === id) {
    const error = new Error('Cannot delete yourself');
    error.status = 400;
    throw error;
  }

  const beforeUser = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });

  await prisma.user.delete({ where: { id } });

  return beforeUser;
}

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  USER_SELECT,
};
