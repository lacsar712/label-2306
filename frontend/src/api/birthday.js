import request from './axios';

export function getBirthdayMembers(params) {
  return request.get('/birthdays/members', { params });
}

export function getBirthdayCalendar(params) {
  return request.get('/birthdays/calendar', { params });
}

export function getBirthdayDashboard() {
  return request.get('/birthdays/dashboard');
}

export function getWishTemplates() {
  return request.get('/birthdays/templates');
}

export function saveWishTemplate(data) {
  return request.post('/birthdays/templates', data);
}

export function getPointsRules() {
  return request.get('/birthdays/points-rules');
}

export function savePointsRule(data) {
  return request.post('/birthdays/points-rules', data);
}

export function getCareConfig() {
  return request.get('/birthdays/config');
}

export function updateCareConfig(data) {
  return request.put('/birthdays/config', data);
}

export function executeBirthdayCare(data) {
  return request.post('/birthdays/execute', data);
}

export function getCareRecords(params) {
  return request.get('/birthdays/records', { params });
}

export function getMemberCareHistory(memberId) {
  return request.get(`/birthdays/members/${memberId}/history`);
}
