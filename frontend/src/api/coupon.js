import request from './axios';

export function getCouponStats() {
  return request.get('/coupons/stats');
}

export function getCoupons(params) {
  return request.get('/coupons', { params });
}

export function getCoupon(id) {
  return request.get(`/coupons/${id}`);
}

export function createCoupon(data) {
  return request.post('/coupons', data);
}

export function updateCoupon(id, data) {
  return request.put(`/coupons/${id}`, data);
}

export function deleteCoupon(id) {
  return request.delete(`/coupons/${id}`);
}

export function changeCouponStatus(id, status, remark) {
  return request.post(`/coupons/${id}/status`, { status, remark });
}

export function issueCoupons(data) {
  return request.post('/coupons/issue', data);
}

export function getMemberCoupons(params) {
  return request.get('/coupons/member-coupons', { params });
}

export function getCouponMembers(id, params) {
  return request.get(`/coupons/${id}/members`, { params });
}

export function redeemMemberCoupon(id, orderNo, remark) {
  return request.post(`/coupons/member-coupons/${id}/redeem`, { orderNo, remark });
}

export function refundMemberCoupon(id, remark) {
  return request.post(`/coupons/member-coupons/${id}/refund`, { remark });
}

export function lockMemberCoupon(id, orderNo) {
  return request.post(`/coupons/member-coupons/${id}/lock`, { orderNo });
}
