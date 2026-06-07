import request from './axios';

export function getLevelBenefitsSummary() {
  return request.get('/level-benefits/summary');
}

export function getLevelBenefits(params) {
  return request.get('/level-benefits', { params });
}

export function getAllLevelBenefitsByLevel() {
  return request.get('/level-benefits/all-by-level');
}

export function getLevelBenefit(id) {
  return request.get(`/level-benefits/${id}`);
}

export function getLevelBenefitVersions(id) {
  return request.get(`/level-benefits/${id}/versions`);
}

export function getLevelBenefitImpactPreview(id, data) {
  return request.get(`/level-benefits/${id}/impact-preview`, data);
}

export function createLevelBenefit(data) {
  return request.post('/level-benefits', data);
}

export function updateLevelBenefit(id, data) {
  return request.put(`/level-benefits/${id}`, data);
}

export function deleteLevelBenefit(id) {
  return request.delete(`/level-benefits/${id}`);
}

export function reorderLevelBenefits(items) {
  return request.post('/level-benefits/reorder', { items });
}

export function copyLevelBenefit(sourceId, targetLevel, withSortOrder) {
  return request.post('/level-benefits/copy', { sourceId, targetLevel, withSortOrder });
}

export function changeLevelBenefitStatus(id, status, remark) {
  return request.post(`/level-benefits/${id}/status`, { status, remark });
}
