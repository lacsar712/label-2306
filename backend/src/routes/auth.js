const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditLog');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set!');
}

router.post('/login', async (req, res) => {
  const startTime = Date.now();
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      await createAuditLog({
        operator: user ? { id: user.id, username: user.username } : null,
        actionType: 'AUTH_LOGIN',
        entityType: 'USER',
        entityId: user?.id,
        req,
        remark: `登录失败: ${username}`,
        durationMs: Date.now() - startTime,
        resultStatus: 'FAILURE',
        errorMessage: 'Invalid username or password',
      });
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    await createAuditLog({
      operator: { id: user.id, username: user.username },
      actionType: 'AUTH_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      req,
      remark: `用户登录: ${user.username}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    await createAuditLog({
      actionType: 'AUTH_LOGIN',
      entityType: 'USER',
      req,
      remark: '登录异常',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    await createAuditLog({
      operator: req.user,
      actionType: 'AUTH_LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      req,
      remark: `用户登出: ${req.user.username}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
