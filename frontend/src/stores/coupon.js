import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  changeCouponStatus,
  issueCoupons,
  getMemberCoupons,
  getCouponStats,
  getCouponMembers,
  redeemMemberCoupon,
  refundMemberCoupon,
} from '../api/coupon';

export const useCouponStore = defineStore('coupon', () => {
  const coupons = ref([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const currentCoupon = ref(null);
  const stats = ref(null);
  const memberCoupons = ref([]);
  const memberCouponTotal = ref(0);
  const couponMembers = ref([]);
  const couponMemberTotal = ref(0);
  const loading = ref(false);

  async function fetchCoupons(params = {}) {
    loading.value = true;
    try {
      const res = await getCoupons({
        page: page.value,
        pageSize: pageSize.value,
        ...params,
      });
      coupons.value = res.list;
      total.value = res.total;
      page.value = res.page;
      pageSize.value = res.pageSize;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCoupon(id) {
    loading.value = true;
    try {
      const res = await getCoupon(id);
      currentCoupon.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCouponStats() {
    try {
      const res = await getCouponStats();
      stats.value = res;
      return res;
    } catch (e) {
      console.error('Failed to fetch coupon stats', e);
      return null;
    }
  }

  async function fetchMemberCoupons(params = {}) {
    loading.value = true;
    try {
      const res = await getMemberCoupons({
        page: 1,
        pageSize: 20,
        ...params,
      });
      memberCoupons.value = res.list;
      memberCouponTotal.value = res.total;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCouponMembers(couponId, params = {}) {
    loading.value = true;
    try {
      const res = await getCouponMembers(couponId, {
        page: 1,
        pageSize: 20,
        ...params,
      });
      couponMembers.value = res.list;
      couponMemberTotal.value = res.total;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function createNewCoupon(data) {
    const res = await createCoupon(data);
    await fetchCoupons();
    return res;
  }

  async function updateExistingCoupon(id, data) {
    const res = await updateCoupon(id, data);
    await fetchCoupons();
    return res;
  }

  async function removeCoupon(id) {
    await deleteCoupon(id);
    await fetchCoupons();
  }

  async function updateStatus(id, status, remark) {
    const res = await changeCouponStatus(id, status, remark);
    await fetchCoupons();
    return res;
  }

  async function batchIssue(data) {
    return issueCoupons(data);
  }

  async function redeemCoupon(id, orderNo, remark) {
    const res = await redeemMemberCoupon(id, orderNo, remark);
    return res;
  }

  async function refundCoupon(id, remark) {
    const res = await refundMemberCoupon(id, remark);
    return res;
  }

  return {
    coupons,
    total,
    page,
    pageSize,
    currentCoupon,
    stats,
    memberCoupons,
    memberCouponTotal,
    couponMembers,
    couponMemberTotal,
    loading,
    fetchCoupons,
    fetchCoupon,
    fetchCouponStats,
    fetchMemberCoupons,
    fetchCouponMembers,
    createNewCoupon,
    updateExistingCoupon,
    removeCoupon,
    updateStatus,
    batchIssue,
    redeemCoupon,
    refundCoupon,
  };
});
