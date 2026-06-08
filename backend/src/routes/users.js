const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, isAdmin } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditLog');
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
} = require('../services/userService');

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const user = await createUser(req.body);

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

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const { beforeUser, updatedUser } = await updateUser(req.params.id, req.body, req.user?.id);

    await createAuditLog({
      operator: req.user,
      actionType: 'USER_UPDATE',
      entityType: 'USER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeUser,
      afterSnapshot: updatedUser,
      req,
      remark: `更新用户: ${updatedUser.username}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
      sensitivityLevel: 'CRITICAL',
    });

    res.json(updatedUser);
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

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  const startTime = Date.now();
  try {
    const beforeUser = await deleteUser(req.params.id, req.user?.id);

    await createAuditLog({
      operator: req.user,
      actionType: 'USER_DELETE',
      entityType: 'USER',
      entityId: parseInt(req.params.id),
      beforeSnapshot: beforeUser,
      req,
      remark: `删除用户: ${beforeUser?.username || 'ID=' + req.params.id}`,
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

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
