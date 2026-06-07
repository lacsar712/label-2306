const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { MemberSchema, PointsUpdateSchema } = require('../validations/schemas');
const { z } = require('zod');

// Get all members
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, level, status } = req.query;
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }
    if (level) where.level = level;
    if (status) where.status = status;

    const members = await prisma.member.findMany({
      where,
      orderBy: { joinDate: 'desc' }
    });
    res.json(members);
  } catch (error) {
    logger.error('Error fetching members', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create member
router.post('/', authenticate, async (req, res) => {
  try {
    const validatedData = MemberSchema.parse(req.body);
    const member = await prisma.member.create({
      data: validatedData
    });
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    logger.error('Error creating member', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member
router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = MemberSchema.partial().parse(req.body);
    const member = await prisma.member.update({
      where: { id },
      data: validatedData
    });
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete member
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.member.delete({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member points
router.post('/:id/points', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { points } = PointsUpdateSchema.parse(req.body);
    
    const member = await prisma.member.update({
      where: { id },
      data: {
        points: {
          increment: points
        }
      }
    });
    
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
