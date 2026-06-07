const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, isAdmin } = require('../middleware/auth');
const { CreateUserSchema, UpdateUserSchema } = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const { username, password, role } = CreateUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, role },
      select: { id: true, username: true, role: true, createdAt: true }
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'USER_CREATE',
      entityType: 'USER',
      entityId: user.id,
      afterSnapshot: user,
      req,
      remark: `创建用户: ${user.username}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
      sensitivityLevel: 'CRITICAL',
    });

    res.status(201).json(user);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'USER_CREATE',
      entityType: 'USER',
      req,
      remark: '创建用户失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
      sensitivityLevel: 'CRITICAL',
    });

    if (error.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const { username, password, role } = UpdateUserSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, createdAt: true } });
    if (existingUser && existingUser.username === 'admin' && role && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot change admin role' });
    }

    if (!username && !password && !role) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const data = {};
    if (username) data.username = username;
    if (role) data.role = role;
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, createdAt: true }
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'USER_UPDATE',
      entityType: 'USER',
      entityId: id,
      beforeSnapshot: existingUser,
      afterSnapshot: user,
      req,
      remark: `更新用户: ${user.username}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
      sensitivityLevel: 'CRITICAL',
    });

    res.json(user);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'USER_UPDATE',
      entityType: 'USER',
      entityId: req.params.id,
      req,
      remark: '更新用户失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
      sensitivityLevel: 'CRITICAL',
    });

    if (error.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    if (req.user.id === id) return res.status(400).json({ error: 'Cannot delete yourself' });

    const beforeUser = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, createdAt: true } });
    await prisma.user.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'USER_DELETE',
      entityType: 'USER',
      entityId: id,
      beforeSnapshot: beforeUser,
      req,
      remark: `删除用户: ${beforeUser?.username || 'ID=' + id}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
      sensitivityLevel: 'CRITICAL',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'USER_DELETE',
      entityType: 'USER',
      entityId: req.params.id,
      req,
      remark: '删除用户失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
      sensitivityLevel: 'CRITICAL',
    });

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
