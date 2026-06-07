import request from './axios';

export function downloadTemplate() {
  return request.get('/members/import/template', {
    responseType: 'blob',
  });
}

export function getStandardFields() {
  return request.get('/members/import/standard-fields');
}

export function getImportConfig() {
  return request.get('/members/import/config');
}

export function updateImportConfig(data) {
  return request.put('/members/import/config', data);
}

export function previewImportFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/members/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function remapPreview(params) {
  return request.post('/members/import/preview/remap', params);
}

export function startImport(params) {
  return request.post('/members/import', params);
}

export function listImportBatches(params) {
  return request.get('/members/import/batches', { params });
}

export function getImportBatch(id) {
  return request.get(`/members/import/batches/${id}`);
}

export function getImportBatchRecords(id, params) {
  return request.get(`/members/import/batches/${id}/records`, { params });
}

export function pauseImportBatch(id) {
  return request.post(`/members/import/batches/${id}/pause`);
}

export function resumeImportBatch(id) {
  return request.post(`/members/import/batches/${id}/resume`);
}

export function cancelImportBatch(id) {
  return request.post(`/members/import/batches/${id}/cancel`);
}

export function retryFailedRecords(id) {
  return request.post(`/members/import/batches/${id}/retry-failed`);
}
