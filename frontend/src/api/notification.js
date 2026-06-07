import axios from './axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const notificationApi = {
  getTemplates: (params) => {
    return axios.get(`${API_URL}/notifications/templates`, { params });
  },

  createTemplate: (data) => {
    return axios.post(`${API_URL}/notifications/templates`, data);
  },

  updateTemplate: (id, data) => {
    return axios.put(`${API_URL}/notifications/templates/${id}`, data);
  },

  deleteTemplate: (id) => {
    return axios.delete(`${API_URL}/notifications/templates/${id}`);
  },

  getStats: () => {
    return axios.get(`${API_URL}/notifications/stats`);
  },

  getNotificationStats: (id) => {
    return axios.get(`${API_URL}/notifications/${id}/stats`);
  },

  getUnreadCount: () => {
    return axios.get(`${API_URL}/notifications/mine/unread-count`);
  },

  getMyNotifications: (params) => {
    return axios.get(`${API_URL}/notifications/mine`, { params });
  },

  markAsRead: (ids) => {
    return axios.post(`${API_URL}/notifications/mine/read`, { ids });
  },

  markAllAsRead: () => {
    return axios.post(`${API_URL}/notifications/mine/read`, {});
  },

  getNotifications: (params) => {
    return axios.get(`${API_URL}/notifications`, { params });
  },

  getNotification: (id) => {
    return axios.get(`${API_URL}/notifications/${id}`);
  },

  createNotification: (data) => {
    return axios.post(`${API_URL}/notifications`, data);
  },

  updateNotification: (id, data) => {
    return axios.put(`${API_URL}/notifications/${id}`, data);
  },

  deleteNotification: (id) => {
    return axios.delete(`${API_URL}/notifications/${id}`);
  },

  sendNotification: (data) => {
    return axios.post(`${API_URL}/notifications/send`, data);
  },

  archiveExpired: () => {
    return axios.post(`${API_URL}/notifications/archive-expired`);
  },

  getUsers: () => {
    return axios.get(`${API_URL}/users`);
  },

  getTags: () => {
    return axios.get(`${API_URL}/tags`);
  },
};
