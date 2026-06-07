import { defineStore } from 'pinia';
import api from '../api/axios';

export const useTagStore = defineStore('tag', {
  state: () => ({
    tagGroups: [],
    tags: [],
    tagStats: [],
    totalMembers: 0,
    loading: false,
  }),
  actions: {
    async fetchTagGroups() {
      this.loading = true;
      try {
        const data = await api.get('/tags/groups');
        this.tagGroups = data;
      } finally {
        this.loading = false;
      }
    },
    async fetchTags(params) {
      this.loading = true;
      try {
        const data = await api.get('/tags', { params });
        this.tags = data;
      } finally {
        this.loading = false;
      }
    },
    async fetchTagStats() {
      this.loading = true;
      try {
        const data = await api.get('/tags/stats');
        this.tagStats = data.stats;
        this.totalMembers = data.totalMembers;
      } finally {
        this.loading = false;
      }
    },
    async createTagGroup(data) {
      const result = await api.post('/tags/groups', data);
      await this.fetchTagGroups();
      return result;
    },
    async updateTagGroup(id, data) {
      const result = await api.put(`/tags/groups/${id}`, data);
      await this.fetchTagGroups();
      return result;
    },
    async deleteTagGroup(id) {
      await api.delete(`/tags/groups/${id}`);
      await this.fetchTagGroups();
    },
    async createTag(data) {
      const result = await api.post('/tags', data);
      await this.fetchTags();
      await this.fetchTagGroups();
      return result;
    },
    async updateTag(id, data) {
      const result = await api.put(`/tags/${id}`, data);
      await this.fetchTags();
      await this.fetchTagGroups();
      await this.fetchTagStats();
      return result;
    },
    async deleteTag(id) {
      await api.delete(`/tags/${id}`);
      await this.fetchTags();
      await this.fetchTagGroups();
      await this.fetchTagStats();
    },
    async previewTagRule(tagId) {
      const data = await api.get(`/tags/${tagId}/preview`);
      return data;
    },
    async runTagRule(tagId) {
      const data = await api.post(`/tags/${tagId}/run-rule`);
      await this.fetchTagStats();
      return data;
    },
    async batchApplyTag(tagId, memberIds, remark) {
      const data = await api.post('/tags/batch-apply', { tagId, memberIds, remark });
      await this.fetchTagStats();
      return data;
    },
    async fetchMemberTags(memberId) {
      const data = await api.get(`/tags/members/${memberId}`);
      return data;
    },
    async bindMemberTags(memberId, tagIds, remark) {
      const data = await api.post(`/tags/members/${memberId}/bind`, { tagIds, remark });
      await this.fetchTagStats();
      return data;
    },
    async unbindMemberTags(memberId, tagIds, remark) {
      const data = await api.post(`/tags/members/${memberId}/unbind`, { tagIds, remark });
      await this.fetchTagStats();
      return data;
    },
    async fetchMemberTagHistory(memberId, params) {
      const data = await api.get(`/tags/members/${memberId}/history`, { params });
      return data;
    },
  },
});
