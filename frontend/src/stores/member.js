import { defineStore } from 'pinia';
import api from '../api/axios';

export const useMemberStore = defineStore('member', {
  state: () => ({
    members: [],
    stats: {
      total: 0,
      active: 0,
      levelStats: [],
      totalPoints: 0
    },
    loading: false
  }),
  actions: {
    async fetchMembers(params) {
      this.loading = true;
      try {
        const data = await api.get('/members', { params });
        this.members = data;
      } finally {
        this.loading = false;
      }
    },
    async fetchStats() {
      try {
        const data = await api.get('/stats');
        this.stats = data;
      } catch (error) {
        console.error('Failed to fetch stats', error);
      }
    },
    async addMember(member) {
      const data = await api.post('/members', member);
      await this.fetchMembers();
      await this.fetchStats();
      return data;
    },
    async updateMember(id, member) {
      const data = await api.put(`/members/${id}`, member);
      await this.fetchMembers();
      await this.fetchStats();
      return data;
    },
    async deleteMember(id) {
      await api.delete(`/members/${id}`);
      await this.fetchMembers();
      await this.fetchStats();
    }
  }
});
