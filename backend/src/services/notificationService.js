const prisma = require('../utils/prisma');

const getTargetUsers = async (targetType, targetIds) => {
  let users = [];

  switch (targetType) {
    case 'ALL':
      users = await prisma.user.findMany({ select: { id: true } });
      break;
    case 'SINGLE_USER':
      if (targetIds && targetIds.length > 0) {
        users = await prisma.user.findMany({
          where: { id: { in: targetIds.map(id => parseInt(id)) } },
          select: { id: true },
        });
      }
      break;
    case 'ROLE':
      if (targetIds && targetIds.length > 0) {
        users = await prisma.user.findMany({
          where: { role: { in: targetIds } },
          select: { id: true },
        });
      }
      break;
    case 'TAG':
      if (targetIds && targetIds.length > 0) {
        const members = await prisma.member.findMany({
          where: {
            memberTags: {
              some: {
                tagId: { in: targetIds.map(id => parseInt(id)) },
              },
            },
          },
          select: { id: true },
        });
        users = await prisma.user.findMany({ select: { id: true } });
      }
      break;
    default:
      users = await prisma.user.findMany({ select: { id: true } });
  }

  return users;
};

const applyTemplateVariables = (content, variables) => {
  if (!variables) return content;
  let result = content;
  Object.keys(variables).forEach(key => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, variables[key]);
  });
  return result;
};

const sendNotification = async ({
  notificationId,
  type,
  title,
  content,
  priority,
  targetType,
  targetIds,
  scheduledAt,
  expiredAt,
  templateId,
  templateVariables,
  operator,
}) => {
  let finalTitle = title;
  let finalContent = content;
  let finalTemplateId = templateId;

  if (templateId) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: parseInt(templateId) },
    });
    if (template) {
      finalTitle = applyTemplateVariables(template.title, templateVariables);
      finalContent = applyTemplateVariables(template.content, templateVariables);
      finalTemplateId = template.id;
      if (!type) type = template.type;
    }
  }

  const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
  const status = isScheduled ? 'SCHEDULED' : 'SENT';
  const sentAt = isScheduled ? null : new Date();

  const notificationData = {
    type: type || 'INFO',
    title: finalTitle,
    content: finalContent,
    priority: priority || 'MEDIUM',
    targetType: targetType || 'ALL',
    targetIds: targetIds || null,
    status,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    expiredAt: expiredAt ? new Date(expiredAt) : null,
    sentAt,
    templateId: finalTemplateId,
    templateVariables: templateVariables || null,
    operatorId: operator?.id || null,
  };

  let notification;

  if (notificationId) {
    notification = await prisma.notification.update({
      where: { id: parseInt(notificationId) },
      data: notificationData,
    });
  } else {
    notification = await prisma.notification.create({
      data: notificationData,
    });
  }

  if (!isScheduled) {
    const targetUsers = await getTargetUsers(targetType || 'ALL', targetIds);

    const recipientData = targetUsers.map(user => ({
      notificationId: notification.id,
      userId: user.id,
    }));

    if (recipientData.length > 0) {
      await prisma.notificationRecipient.createMany({
        data: recipientData,
        skipDuplicates: true,
      });
    }
  }

  const totalRecipients = await prisma.notificationRecipient.count({
    where: { notificationId: notification.id },
  });

  return {
    ...notification,
    totalRecipients,
  };
};

const markAsRead = async (userId, notificationIds) => {
  const where = { userId };
  if (notificationIds && notificationIds.length > 0) {
    where.notificationId = { in: notificationIds.map(id => parseInt(id)) };
  }

  const result = await prisma.notificationRecipient.updateMany({
    where: {
      ...where,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result;
};

const getNotificationStats = async (notificationId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: parseInt(notificationId) },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  const totalRecipients = await prisma.notificationRecipient.count({
    where: { notificationId: parseInt(notificationId) },
  });

  const readCount = await prisma.notificationRecipient.count({
    where: {
      notificationId: parseInt(notificationId),
      isRead: true,
    },
  });

  const deliveryRate = totalRecipients > 0 ? 100 : 0;
  const readRate = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;

  return {
    notificationId: notification.id,
    title: notification.title,
    totalRecipients,
    readCount,
    unreadCount: totalRecipients - readCount,
    deliveryRate,
    readRate,
    sentAt: notification.sentAt,
  };
};

const archiveExpiredNotifications = async () => {
  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      status: 'SENT',
      expiredAt: {
        not: null,
        lte: now,
      },
    },
    data: {
      status: 'ARCHIVED',
    },
  });

  return result;
};

const getUserUnreadCount = async (userId) => {
  const count = await prisma.notificationRecipient.count({
    where: {
      userId: parseInt(userId),
      isRead: false,
      notification: {
        status: { in: ['SENT'] },
        OR: [
          { expiredAt: null },
          { expiredAt: { gt: new Date() } },
        ],
      },
    },
  });

  return count;
};

const processScheduledNotifications = async () => {
  const now = new Date();

  const scheduledNotifications = await prisma.notification.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: {
        not: null,
        lte: now,
      },
    },
  });

  for (const notification of scheduledNotifications) {
    const targetUsers = await getTargetUsers(notification.targetType, notification.targetIds);

    const recipientData = targetUsers.map(user => ({
      notificationId: notification.id,
      userId: user.id,
    }));

    if (recipientData.length > 0) {
      await prisma.notificationRecipient.createMany({
        data: recipientData,
        skipDuplicates: true,
      });
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: now,
      },
    });
  }

  return scheduledNotifications.length;
};

module.exports = {
  getTargetUsers,
  applyTemplateVariables,
  sendNotification,
  markAsRead,
  getNotificationStats,
  archiveExpiredNotifications,
  getUserUnreadCount,
  processScheduledNotifications,
};
