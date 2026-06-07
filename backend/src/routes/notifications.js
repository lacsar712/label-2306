const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { z } = require('zod');
const {
  NotificationTemplateSchema,
  NotificationTemplateUpdateSchema,
  NotificationTemplateQuerySchema,
  NotificationCreateSchema,
  NotificationUpdateSchema,
  NotificationQuerySchema,
  NotificationSendSchema,
  UserNotificationQuerySchema,
  NotificationReadSchema,
} = require('../validations/schemas');
const { createAuditLog } = require('../services/auditLog');
const {
  sendNotification,
  markAsRead,
  getNotificationStats,
  archiveExpiredNotifications,
  getUserUnreadCount,
} = require('../services/notificationService');

router.get('/templates', authenticate, async (req, res) => {
  try {
    const validated = NotificationTemplateQuerySchema.parse(req.query);
    const { search, type, isSystem, page, pageSize } = validated;

    const where = {};
    if (search) where.name = { contains: search };
    if (type) where.type = type;
    if (isSystem !== undefined && isSystem !== '') {
      where.isSystem = isSystem === 'true';
    }

    const [list, total] = await Promise.all([
      prisma.notificationTemplate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, username: true } },
        },
      }),
      prisma.notificationTemplate.count({ where }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching notification templates', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/templates', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = NotificationTemplateSchema.parse(req.body);
    const template = await prisma.notificationTemplate.create({
      data: {
        ...validatedData,
        variables: validatedData.variables || null,
        operatorId: req.user?.id || null,
      },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: template.id,
      afterSnapshot: template,
      req,
      remark: `创建通知模板: ${template.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(template);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      req,
      remark: '创建通知模板失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating notification template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/templates/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeTemplate = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!beforeTemplate) return res.status(404).json({ error: 'Template not found' });

    const validatedData = NotificationTemplateUpdateSchema.parse(req.body);
    const template = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...validatedData,
        variables: validatedData.variables || beforeTemplate.variables,
      },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: id,
      beforeSnapshot: beforeTemplate,
      afterSnapshot: template,
      req,
      remark: `更新通知模板: ${template.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(template);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: req.params.id,
      req,
      remark: '更新通知模板失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating notification template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/templates/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeTemplate = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!beforeTemplate) return res.status(404).json({ error: 'Template not found' });

    if (beforeTemplate.isSystem) {
      return res.status(400).json({ error: '系统模板无法删除' });
    }

    await prisma.notificationTemplate.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: id,
      beforeSnapshot: beforeTemplate,
      req,
      remark: `删除通知模板: ${beforeTemplate.name}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: req.params.id,
      req,
      remark: '删除通知模板失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting notification template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const totalNotifications = await prisma.notification.count();
    const sentNotifications = await prisma.notification.count({ where: { status: 'SENT' } });
    const scheduledNotifications = await prisma.notification.count({ where: { status: 'SCHEDULED' } });
    const archivedNotifications = await prisma.notification.count({ where: { status: 'ARCHIVED' } });

    const typeStats = await prisma.notification.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { status: 'SENT' },
    });

    const priorityStats = await prisma.notification.groupBy({
      by: ['priority'],
      _count: { id: true },
      where: { status: 'SENT' },
    });

    const totalRecipients = await prisma.notificationRecipient.count();
    const readRecipients = await prisma.notificationRecipient.count({ where: { isRead: true } });

    const overallReadRate = totalRecipients > 0 ? Math.round((readRecipients / totalRecipients) * 100) : 0;

    res.json({
      total: totalNotifications,
      sent: sentNotifications,
      scheduled: scheduledNotifications,
      archived: archivedNotifications,
      typeStats,
      priorityStats,
      totalRecipients,
      readRecipients,
      overallReadRate,
    });
  } catch (error) {
    logger.error('Error fetching notification stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await getNotificationStats(req.params.id);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching notification stats', { id: req.params.id, error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.get('/mine/unread-count', authenticate, async (req, res) => {
  try {
    const count = await getUserUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    logger.error('Error fetching unread count', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/mine', authenticate, async (req, res) => {
  try {
    const validated = UserNotificationQuerySchema.parse(req.query);
    const { search, type, priority, isRead, page, pageSize } = validated;

    const where = {
      userId: req.user.id,
      notification: {
        status: { in: ['SENT', 'ARCHIVED'] },
      },
    };

    if (search) {
      where.notification = {
        ...where.notification,
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      };
    }
    if (type) where.notification.type = type;
    if (priority) where.notification.priority = priority;
    if (isRead !== undefined && isRead !== '') {
      where.isRead = isRead === 'true';
    }

    const [list, total] = await Promise.all([
      prisma.notificationRecipient.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            include: {
              operator: { select: { id: true, username: true } },
            },
          },
        },
      }),
      prisma.notificationRecipient.count({ where }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching user notifications', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/mine/read', authenticate, async (req, res) => {
  try {
    const { ids } = NotificationReadSchema.parse(req.body);
    const result = await markAsRead(req.user.id, ids);
    res.json({ affected: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error marking notifications as read', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const validated = NotificationQuerySchema.parse(req.query);
    const { search, type, priority, status, targetType, page, pageSize } = validated;

    const where = {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (targetType) where.targetType = targetType;

    const [list, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, username: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { recipients: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching notifications', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        operator: { select: { id: true, username: true } },
        template: true,
        _count: { select: { recipients: true } },
      },
    });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    logger.error('Error fetching notification', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = NotificationCreateSchema.parse(req.body);

    const notification = await prisma.notification.create({
      data: {
        ...validatedData,
        scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
        expiredAt: validatedData.expiredAt ? new Date(validatedData.expiredAt) : null,
        targetIds: validatedData.targetIds || null,
        templateVariables: validatedData.templateVariables || null,
        operatorId: req.user?.id || null,
      },
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: notification.id,
      afterSnapshot: notification,
      req,
      remark: `创建通知草稿: ${notification.title}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(201).json(notification);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      req,
      remark: '创建通知失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating notification', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeNotification = await prisma.notification.findUnique({ where: { id } });
    if (!beforeNotification) return res.status(404).json({ error: 'Notification not found' });

    if (beforeNotification.status === 'SENT' || beforeNotification.status === 'ARCHIVED') {
      return res.status(400).json({ error: '已发送或已归档的通知无法编辑' });
    }

    const validatedData = NotificationUpdateSchema.parse(req.body);
    const updateData = { ...validatedData };
    if (updateData.scheduledAt) updateData.scheduledAt = new Date(updateData.scheduledAt);
    if (updateData.expiredAt) updateData.expiredAt = new Date(updateData.expiredAt);

    const notification = await prisma.notification.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: id,
      beforeSnapshot: beforeNotification,
      afterSnapshot: notification,
      req,
      remark: `更新通知: ${notification.title}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(notification);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: req.params.id,
      req,
      remark: '更新通知失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating notification', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const id = parseInt(req.params.id);
    const beforeNotification = await prisma.notification.findUnique({ where: { id } });
    if (!beforeNotification) return res.status(404).json({ error: 'Notification not found' });

    await prisma.notificationRecipient.deleteMany({ where: { notificationId: id } });
    await prisma.notification.delete({ where: { id } });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: id,
      beforeSnapshot: beforeNotification,
      req,
      remark: `删除通知: ${beforeNotification.title}`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.status(204).send();
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: req.params.id,
      req,
      remark: '删除通知失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    logger.error('Error deleting notification', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/send', authenticate, async (req, res) => {
  const startTime = Date.now();
  try {
    const validatedData = NotificationSendSchema.parse(req.body);

    const result = await sendNotification({
      ...validatedData,
      operator: req.user,
    });

    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      entityId: result.id,
      afterSnapshot: result,
      req,
      remark: `发送通知: ${result.title}，目标 ${result.targetType}，状态 ${result.status === 'SCHEDULED' ? '定时发送' : '即时发送'}，${result.totalRecipients} 人`,
      durationMs: Date.now() - startTime,
      resultStatus: 'SUCCESS',
    });

    res.json(result);
  } catch (error) {
    await createAuditLog({
      operator: req.user,
      actionType: 'OTHER',
      entityType: 'SYSTEM',
      req,
      remark: '发送通知失败',
      durationMs: Date.now() - startTime,
      resultStatus: 'FAILURE',
      errorMessage: error.message,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error sending notification', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/archive-expired', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await archiveExpiredNotifications();
    res.json({ archived: result.count });
  } catch (error) {
    logger.error('Error archiving expired notifications', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
