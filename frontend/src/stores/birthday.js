import { defineStore } from 'pinia';
import {
  getBirthdayMembers,
  getBirthdayCalendar,
  getBirthdayDashboard,
  getWishTemplates,
  saveWishTemplate,
  getPointsRules,
  savePointsRule,
  getCareConfig,
  updateCareConfig,
  executeBirthdayCare,
  getCareRecords,
  getMemberCareHistory,
} from '../api/birthday';

export const useBirthdayStore = defineStore('birthday', {
  state: () => ({
    members: [],
    calendar: {},
    dashboardStats: null,
    wishTemplates: [],
    pointsRules: [],
    careConfig: null,
    careRecords: [],
    careRecordsTotal: 0,
    careRecordsPage: 1,
    careRecordsPageSize: 20,
    memberCareHistory: [],
    loading: false,
  }),
  actions: {
    async fetchBirthdayMembers(params) {
      this.loading = true;
      try {
        const data = await getBirthdayMembers(params);
        this.members = data;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetchCalendar(year, month, level) {
      try {
        const data = await getBirthdayCalendar({ year, month, level });
        this.calendar = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch calendar', error);
      }
    },
    async fetchDashboardStats() {
      try {
        const data = await getBirthdayDashboard();
        this.dashboardStats = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch dashboard stats', error);
      }
    },
    async fetchWishTemplates() {
      try {
        const data = await getWishTemplates();
        this.wishTemplates = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch wish templates', error);
      }
    },
    async saveWishTemplate(data) {
      const result = await saveWishTemplate(data);
      await this.fetchWishTemplates();
      return result;
    },
    async fetchPointsRules() {
      try {
        const data = await getPointsRules();
        this.pointsRules = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch points rules', error);
      }
    },
    async savePointsRule(data) {
      const result = await savePointsRule(data);
      await this.fetchPointsRules();
      return result;
    },
    async fetchCareConfig() {
      try {
        const data = await getCareConfig();
        this.careConfig = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch care config', error);
      }
    },
    async updateCareConfig(data) {
      const result = await updateCareConfig(data);
      this.careConfig = result;
      return result;
    },
    async executeCare(data) {
      const result = await executeBirthdayCare(data);
      return result;
    },
    async fetchCareRecords(params) {
      this.loading = true;
      try {
        const data = await getCareRecords({
          page: this.careRecordsPage,
          pageSize: this.careRecordsPageSize,
          ...params,
        });
        this.careRecords = data.list;
        this.careRecordsTotal = data.total;
        this.careRecordsPage = data.page;
        this.careRecordsPageSize = data.pageSize;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetchMemberCareHistory(memberId) {
      try {
        const data = await getMemberCareHistory(memberId);
        this.memberCareHistory = data;
        return data;
      } catch (error) {
        console.error('Failed to fetch member care history', error);
      }
    },
    setCareRecordsPage(page) {
      this.careRecordsPage = page;
    },
    setCareRecordsPageSize(pageSize) {
      this.careRecordsPageSize = pageSize;
      this.careRecordsPage = 1;
    },
  },
});
