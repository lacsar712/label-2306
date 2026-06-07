const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { TransactionQuerySchema, ReverseTransactionSchema } = require('../validations/schemas');
const { z } = require('zod');
const {
  queryTransactions,
  getTransactionById,
  reverseTransaction,
  getMemberTrend,
  getReasonStats,
  exportTransactionsToCsv,
  createTransaction,
} = require('../services/pointsTransaction');

router.get('/', authenticate, async (req, res) => {
  try {
    const filters = TransactionQuerySchema.parse(req.query);
    const result = await queryTransactions(filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error querying transactions', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const transaction = await getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    logger.error('Error fetching transaction', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/reverse', authenticate, isAdmin, async (req, res) => {
  try {
    const { remark } = ReverseTransactionSchema.parse(req.body);
    const reversedTx = await reverseTransaction(
      parseInt(req.params.id),
      req.user?.id || null,
      remark || null
    );
    res.json(reversedTx);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error reversing transaction', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/member/:memberId/trend', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trend = await getMemberTrend(req.params.memberId, parseInt(days));
    res.json(trend);
  } catch (error) {
    logger.error('Error fetching member trend', { memberId: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/reason', authenticate, async (req, res) => {
  try {
    const { memberId, startDate, endDate } = req.query;
    const stats = await getReasonStats({ memberId, startDate, endDate });
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching reason stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/export/csv', authenticate, async (req, res) => {
  try {
    const filters = TransactionQuerySchema.parse(req.query);
    const csvContent = await exportTransactionsToCsv(filters);
    const filename = `points_transactions_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error exporting transactions', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch/sign-in', authenticate, async (req, res) => {
  try {
    const { memberIds, points = 10, remark } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'memberIds must be a non-empty array' });
    }

    const results = [];
    for (const memberId of memberIds) {
      try {
        const tx = await createTransaction({
          memberId: parseInt(memberId),
          points,
          reasonType: 'SIGN_IN_REWARD',
          operatorId: req.user?.id || null,
          remark: remark || '签到奖励',
        });
        results.push({ memberId, success: true, transaction: tx });
      } catch (e) {
        results.push({ memberId, success: false, error: e.message });
      }
    }

    res.json({ results });
  } catch (error) {
    logger.error('Error batch sign-in reward', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch/activity', authenticate, async (req, res) => {
  try {
    const { memberIds, points, activityNo, remark } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'memberIds must be a non-empty array' });
    }
    if (!points || typeof points !== 'number') {
      return res.status(400).json({ error: 'points must be a number' });
    }

    const results = [];
    for (const memberId of memberIds) {
      try {
        const tx = await createTransaction({
          memberId: parseInt(memberId),
          points,
          reasonType: 'ACTIVITY_BONUS',
          bizOrderNo: activityNo || null,
          bizOrderType: 'ACTIVITY',
          operatorId: req.user?.id || null,
          remark: remark || '活动加成',
        });
        results.push({ memberId, success: true, transaction: tx });
      } catch (e) {
        results.push({ memberId, success: false, error: e.message });
      }
    }

    res.json({ results });
  } catch (error) {
    logger.error('Error batch activity bonus', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch/exchange', authenticate, async (req, res) => {
  try {
    const { memberId, points, exchangeNo, remark } = req.body;
    if (!memberId || !points || points >= 0) {
      return res.status(400).json({ error: 'memberId and negative points are required' });
    }

    const tx = await createTransaction({
      memberId: parseInt(memberId),
      points,
      reasonType: 'MALL_EXCHANGE',
      bizOrderNo: exchangeNo || null,
      bizOrderType: 'EXCHANGE',
      operatorId: req.user?.id || null,
      remark: remark || '商城兑换',
    });

    res.json({ transaction: tx });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error exchange points', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
