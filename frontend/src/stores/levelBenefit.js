import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getLevelBenefits,
  getAllLevelBenefitsByLevel,
  getLevelBenefit,
  getLevelBenefitVersions,
  getLevelBenefitImpactPreview,
  createLevelBenefit,
  updateLevelBenefit,
  deleteLevelBenefit,
  reorderLevelBenefits,
  copyLevelBenefit,
  changeLevelBenefitStatus,
  getLevelBenefitsSummary,
} from '../api/levelBenefit';

export const useLevelBenefitStore = defineStore('levelBenefit', () => {
  const benefits = ref([]);
  const benefitsByLevel = ref({});
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(100);
  const currentBenefit = ref(null);
  const versions = ref([]);
  const summary = ref(null);
  const impactPreview = ref(null);
  const loading = ref(false);

  async function fetchSummary() {
    try {
      const res = await getLevelBenefitsSummary();
      summary.value = res;
      return res;
    } catch (e) {
      console.error('Failed to fetch level benefits summary', e);
      return null;
    }
  }

  async function fetchBenefits(params = {}) {
    loading.value = true;
    try {
      const res = await getLevelBenefits({
        page: page.value,
        pageSize: pageSize.value,
        ...params,
      });
      benefits.value = res.list;
      total.value = res.total;
      page.value = res.page;
      pageSize.value = res.pageSize;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllByLevel() {
    loading.value = true;
    try {
      const res = await getAllLevelBenefitsByLevel();
      benefitsByLevel.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBenefit(id) {
    loading.value = true;
    try {
      const res = await getLevelBenefit(id);
      currentBenefit.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchVersions(id) {
    try {
      const res = await getLevelBenefitVersions(id);
      versions.value = res;
      return res;
    } catch (e) {
      console.error('Failed to fetch versions', e);
      return [];
    }
  }

  async function fetchImpactPreview(id, data = {}) {
    try {
      const res = await getLevelBenefitImpactPreview(id, data);
      impactPreview.value = res;
      return res;
    } catch (e) {
      console.error('Failed to fetch impact preview', e);
      return null;
    }
  }

  async function createBenefit(data) {
    const res = await createLevelBenefit(data);
    await fetchAllByLevel();
    await fetchSummary();
    return res;
  }

  async function updateBenefit(id, data) {
    const res = await updateLevelBenefit(id, data);
    await fetchAllByLevel();
    await fetchSummary();
    return res;
  }

  async function removeBenefit(id) {
    await deleteLevelBenefit(id);
    await fetchAllByLevel();
    await fetchSummary();
  }

  async function reorder(items) {
    const res = await reorderLevelBenefits(items);
    await fetchAllByLevel();
    return res;
  }

  async function copy(sourceId, targetLevel, withSortOrder = false) {
    const res = await copyLevelBenefit(sourceId, targetLevel, withSortOrder);
    await fetchAllByLevel();
    await fetchSummary();
    return res;
  }

  async function updateStatus(id, status, remark) {
    const res = await changeLevelBenefitStatus(id, status, remark);
    await fetchAllByLevel();
    await fetchSummary();
    return res;
  }

  return {
    benefits,
    benefitsByLevel,
    total,
    page,
    pageSize,
    currentBenefit,
    versions,
    summary,
    impactPreview,
    loading,
    fetchSummary,
    fetchBenefits,
    fetchAllByLevel,
    fetchBenefit,
    fetchVersions,
    fetchImpactPreview,
    createBenefit,
    updateBenefit,
    removeBenefit,
    reorder,
    copy,
    updateStatus,
  };
});
