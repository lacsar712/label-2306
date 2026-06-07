import { defineStore } from 'pinia';
import axios from '../api/axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user')) || null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'ADMIN',
  },
  actions: {
    async login(username, password) {
      try {
        const response = await axios.post(`${API_URL}/auth/login`, { username, password });
        this.token = response.token;
        this.user = response.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        return true;
      } catch (error) {
        throw error.response?.data?.error || '登录失败';
      }
    },
    async logout() {
      try {
        await axios.post(`${API_URL}/auth/logout`);
      } catch (e) {
        // ignore
      }
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});
