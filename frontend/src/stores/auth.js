import { defineStore } from 'pinia';
import axios from 'axios';

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
        this.token = response.data.token;
        this.user = response.data.user;
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        return true;
      } catch (error) {
        throw error.response?.data?.error || '登录失败';
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});
