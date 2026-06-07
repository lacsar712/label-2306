const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const os = require('os');

// Get member stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const total = await prisma.member.count();
    const active = await prisma.member.count({ where: { status: 'ACTIVE' } });
    const levelStats = await prisma.member.groupBy({
      by: ['level'],
      _count: true
    });
    const totalPoints = await prisma.member.aggregate({
      _sum: { points: true }
    });

    res.json({
      total,
      active,
      levelStats,
      totalPoints: totalPoints._sum.points || 0
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// System Info (Protected - Admin only)
router.get('/info', authenticate, isAdmin, async (req, res) => {
  try {
    const info = {
      platform: os.platform(),
      release: os.release(),
      uptime: os.uptime(),
      totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      cpuCount: os.cpus().length,
      nodeVersion: process.version,
      dbStatus: 'Connected'
    };
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
