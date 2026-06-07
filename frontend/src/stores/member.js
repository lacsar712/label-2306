import { defineStore } from 'pinia';
import api from '../api/axios';

export const useMemberStore = defineStore('member', {
  state: () => ({
    members: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
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
        const data = await api.get('/members', { params: { page: this.page, pageSize: this.pageSize, ...params } });
        this.members = data.list;
        this.total = data.total;
        this.page = data.page;
        this.pageSize = data.pageSize;
        this.totalPages = data.totalPages;
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
    },
    setPage(page) {
      this.page = page;
    },
    setPageSize(pageSize) {
      this.pageSize = pageSize;
      this.page = 1;
    },
  }
});
