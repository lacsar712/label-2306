import request from './axios';

export function getExportTypes() {
  return request.get('/exports/types');
}

export function getExportFields(exportType) {
  return request.get(`/exports/types/${exportType}/fields`);
}

export function createExportTask(data) {
  return request.post('/exports/tasks', data);
}

export function getExportTasks(params) {
  return request.get('/exports/tasks', { params });
}

export function getExportTask(id) {
  return request.get(`/exports/tasks/${id}`);
}

export function downloadExportTask(id) {
  return request.get(`/exports/tasks/${id}/download`, {
    responseType: 'blob',
  });
}

export function retryExportTask(id) {
  return request.post(`/exports/tasks/${id}/retry`);
}

export function getExportConfigs() {
  return request.get('/exports/configs');
}

export function updateExportConfig(exportType, data) {
  return request.put(`/exports/configs/${exportType}`, data);
}

export function cleanupExpiredExports() {
  return request.post('/exports/cleanup');
}

export function getExportSettings() {
  return request.get('/exports/settings');
}
