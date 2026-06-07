import { defineStore } from 'pinia';
import { notificationApi } from '../api/notification';

export const useNotificationStore = defineStore('notification', {
  state: () => ({
    unreadCount: 0,
    myNotifications: [],
    myNotificationsTotal: 0,
    notifications: [],
    notificationsTotal: 0,
    templates: [],
    templatesTotal: 0,
    stats: null,
    loading: false,
  }),
  getters: {
    hasUnread: (state) => state.unreadCount > 0,
  },
  actions: {
    async fetchUnreadCount() {
      try {
        const result = await notificationApi.getUnreadCount();
        this.unreadCount = result.count || 0;
        return this.unreadCount;
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
        return 0;
      }
    },

    async fetchMyNotifications(params = {}) {
      this.loading = true;
      try {
        const result = await notificationApi.getMyNotifications(params);
        this.myNotifications = result.list || [];
        this.myNotificationsTotal = result.total || 0;
        return result;
      } catch (error) {
        console.error('Failed to fetch my notifications:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchNotifications(params = {}) {
      this.loading = true;
      try {
        const result = await notificationApi.getNotifications(params);
        this.notifications = result.list || [];
        this.notificationsTotal = result.total || 0;
        return result;
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchTemplates(params = {}) {
      try {
        const result = await notificationApi.getTemplates(params);
        this.templates = result.list || [];
        this.templatesTotal = result.total || 0;
        return result;
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        throw error;
      }
    },

    async fetchStats() {
      try {
        const result = await notificationApi.getStats();
        this.stats = result;
        return result;
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        throw error;
      }
    },

    async markAsRead(ids) {
      try {
        const result = await notificationApi.markAsRead(ids);
        if (Array.isArray(ids)) {
          this.unreadCount = Math.max(0, this.unreadCount - ids.length);
        }
        return result;
      } catch (error) {
        console.error('Failed to mark as read:', error);
        throw error;
      }
    },

    async markAllAsRead() {
      try {
        const result = await notificationApi.markAllAsRead();
        this.unreadCount = 0;
        return result;
      } catch (error) {
        console.error('Failed to mark all as read:', error);
        throw error;
      }
    },

    async createNotification(data) {
      try {
        return await notificationApi.createNotification(data);
      } catch (error) {
        console.error('Failed to create notification:', error);
        throw error;
      }
    },

    async updateNotification(id, data) {
      try {
        return await notificationApi.updateNotification(id, data);
      } catch (error) {
        console.error('Failed to update notification:', error);
        throw error;
      }
    },

    async deleteNotification(id) {
      try {
        return await notificationApi.deleteNotification(id);
      } catch (error) {
        console.error('Failed to delete notification:', error);
        throw error;
      }
    },

    async sendNotification(data) {
      try {
        const result = await notificationApi.sendNotification(data);
        await this.fetchUnreadCount();
        return result;
      } catch (error) {
        console.error('Failed to send notification:', error);
        throw error;
      }
    },

    async createTemplate(data) {
      try {
        return await notificationApi.createTemplate(data);
      } catch (error) {
        console.error('Failed to create template:', error);
        throw error;
      }
    },

    async updateTemplate(id, data) {
      try {
        return await notificationApi.updateTemplate(id, data);
      } catch (error) {
        console.error('Failed to update template:', error);
        throw error;
      }
    },

    async deleteTemplate(id) {
      try {
        return await notificationApi.deleteTemplate(id);
      } catch (error) {
        console.error('Failed to delete template:', error);
        throw error;
      }
    },

    decrementUnreadCount() {
      if (this.unreadCount > 0) {
        this.unreadCount--;
      }
    },
  },
});
