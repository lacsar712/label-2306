import axios from './axios';

export const notificationApi = {
  getTemplates: (params) => {
    return axios.get('/notifications/templates', { params });
  },

  createTemplate: (data) => {
    return axios.post('/notifications/templates', data);
  },

  updateTemplate: (id, data) => {
    return axios.put(`/notifications/templates/${id}`, data);
  },

  deleteTemplate: (id) => {
    return axios.delete(`/notifications/templates/${id}`);
  },

  getStats: () => {
    return axios.get('/notifications/stats');
  },

  getNotificationStats: (id) => {
    return axios.get(`/notifications/${id}/stats`);
  },

  getUnreadCount: () => {
    return axios.get('/notifications/mine/unread-count');
  },

  getMyNotifications: (params) => {
    return axios.get('/notifications/mine', { params });
  },

  markAsRead: (ids) => {
    return axios.post('/notifications/mine/read', { ids });
  },

  markAllAsRead: () => {
    return axios.post('/notifications/mine/read', {});
  },

  getNotifications: (params) => {
    return axios.get('/notifications', { params });
  },

  getNotification: (id) => {
    return axios.get(`/notifications/${id}`);
  },

  createNotification: (data) => {
    return axios.post('/notifications', data);
  },

  updateNotification: (id, data) => {
    return axios.put(`/notifications/${id}`, data);
  },

  deleteNotification: (id) => {
    return axios.delete(`/notifications/${id}`);
  },

  sendNotification: (data) => {
    return axios.post('/notifications/send', data);
  },

  archiveExpired: () => {
    return axios.post('/notifications/archive-expired');
  },

  getUsers: () => {
    return axios.get('/users');
  },

  getTags: () => {
    return axios.get('/tags');
  },
};
