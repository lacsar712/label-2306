<template>
  <div class="import-workspace">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span class="title">会员批量导入</span>
          <div class="header-actions">
            <el-button :icon="Download" type="primary" plain @click="handleDownloadTemplate">
              下载 CSV 模板
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="新建导入" name="new">
          <div class="step-flow">
            <el-steps :active="currentStep" finish-status="success" align-center>
              <el-step title="上传文件" />
              <el-step title="字段映射" />
              <el-step title="预览与确认" />
              <el-step title="执行导入" />
            </el-steps>
          </div>

          <div v-if="currentStep === 0" class="step-content">
            <el-upload
              ref="uploadRef"
              class="upload-area"
              drag
              :auto-upload="false"
              :limit="1"
              accept=".csv"
              :on-change="handleFileChange"
              :on-remove="handleFileRemove"
              :on-exceed="handleExceed"
            >
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <div class="upload-text">将 CSV 文件拖到此处，或<em>点击选择</em></div>
              <template #tip>
                <div class="upload-tip">仅支持 CSV 格式，建议先下载模板按格式填写</div>
              </template>
            </el-upload>

            <div v-if="uploadedFile" class="file-info">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="文件名">{{ uploadedFile.name }}</el-descriptions-item>
                <el-descriptions-item label="大小">{{ formatFileSize(uploadedFile.size) }}</el-descriptions-item>
                <el-descriptions-item label="总行数">{{ previewData?.totalCount || '-' }}</el-descriptions-item>
              </el-descriptions>
              <div class="file-actions">
                <el-button type="primary" :loading="previewLoading" @click="handlePreview">
                  下一步：预览解析
                </el-button>
              </div>
            </div>
          </div>

          <div v-if="currentStep === 1" class="step-content">
            <div class="section-title">
              <span>字段映射配置</span>
              <span class="tip">当 CSV 列名与标准字段不一致时，请手动映射</span>
            </div>
            <el-table :data="standardFields" border stripe>
              <el-table-column label="标准字段" prop="label" width="140">
                <template #default="{ row }">
                  <span :class="{ required: row.required }">{{ row.label }}</span>
                </template>
              </el-table-column>
              <el-table-column label="说明">
                <template #default="{ row }">
                  <span class="field-desc">{{ getFieldDescription(row.key) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="CSV 列名映射" width="260">
                <template #default="{ row }">
                  <el-select
                    v-model="fieldMapping[row.key]"
                    placeholder="选择 CSV 列"
                    clearable
                    filterable
                    style="width: 100%"
                  >
                    <el-option
                      v-for="h in previewData?.headers || []"
                      :key="h"
                      :label="h"
                      :value="h"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="预览值" min-width="160">
                <template #default="{ row }">
                  <span class="preview-value">
                    {{ getMappedPreviewValue(row.key) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>

            <div class="step-actions">
              <el-button @click="currentStep = 0">上一步</el-button>
              <el-button type="primary" :loading="remapLoading" @click="handleRemap">
                下一步：应用映射并预览
              </el-button>
            </div>
          </div>

          <div v-if="currentStep === 2" class="step-content">
            <div class="section-title">
              <span>冲突处理策略</span>
            </div>
            <el-radio-group v-model="conflictStrategy" class="conflict-group">
              <el-radio-button value="SKIP">跳过重复手机号</el-radio-button>
              <el-radio-button value="OVERWRITE">覆盖更新已有会员</el-radio-button>
              <el-radio-button value="MARK_FOR_REVIEW">标记待人工处理</el-radio-button>
            </el-radio-group>

            <div class="section-title">
              <span>数据预览（前 {{ previewData?.previewRows?.length || 0 }} 行）</span>
              <span class="tip">共 {{ previewData?.totalCount || 0 }} 行</span>
            </div>
            <el-table :data="previewData?.previewRows || []" border size="small" max-height="400">
              <el-table-column label="行号" prop="rowNumber" width="60" align="center" />
              <el-table-column label="姓名">
                <template #default="{ row }">{{ row.mappedData?.name }}</template>
              </el-table-column>
              <el-table-column label="手机号">
                <template #default="{ row }">
                  <span :class="{ dup: row.duplicateInDb || row.duplicateInFile }">
                    {{ row.mappedData?.phone }}
                  </span>
                  <el-tag v-if="row.duplicateInDb" size="small" type="warning" class="tag">
                    DB重复
                  </el-tag>
                  <el-tag v-if="row.duplicateInFile" size="small" type="danger" class="tag">
                    文件内重复
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="等级">
                <template #default="{ row }">{{ row.mappedData?.level }}</template>
              </el-table-column>
              <el-table-column label="状态">
                <template #default="{ row }">{{ row.mappedData?.status }}</template>
              </el-table-column>
              <el-table-column label="渠道">
                <template #default="{ row }">{{ row.mappedData?.channel }}</template>
              </el-table-column>
              <el-table-column label="积分">
                <template #default="{ row }">{{ row.mappedData?.points }}</template>
              </el-table-column>
              <el-table-column label="校验结果" width="140">
                <template #default="{ row }">
                  <el-tag v-if="row.valid" type="success" size="small">通过</el-tag>
                  <el-tag v-else type="danger" size="small">错误</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="错误信息" min-width="200">
                <template #default="{ row }">
                  <span class="error-text">{{ row.errors?.join('; ') }}</span>
                </template>
              </el-table-column>
            </el-table>

            <div class="step-actions">
              <el-button @click="currentStep = 1">上一步</el-button>
              <el-button type="primary" :loading="startLoading" @click="handleStartImport">
                确认并开始导入
              </el-button>
            </div>
          </div>

          <div v-if="currentStep === 3" class="step-content">
            <div v-if="activeBatch" class="progress-panel">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="批次ID">#{{ activeBatch.id }}</el-descriptions-item>
                <el-descriptions-item label="文件名">{{ activeBatch.fileName }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="getStatusTagType(activeBatch.status)">
                    {{ getStatusLabel(activeBatch.status) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="进度">
                  {{ activeBatch.progress || 0 }}%
                </el-descriptions-item>
                <el-descriptions-item label="总数">{{ activeBatch.totalCount }}</el-descriptions-item>
                <el-descriptions-item label="操作人">{{ activeBatch.operatorUsername }}</el-descriptions-item>
              </el-descriptions>

              <el-progress
                :percentage="activeBatch.progress || 0"
                :status="getProgressStatus(activeBatch.status)"
                class="progress-bar"
              />

              <div class="stats-row">
                <el-statistic title="成功" :value="activeBatch.successCount" />
                <el-statistic title="跳过" :value="activeBatch.skippedCount" />
                <el-statistic title="失败" :value="activeBatch.failedCount" />
                <el-statistic title="待处理" :value="activeBatch.pendingCount" />
              </div>

              <div class="batch-actions">
                <el-button
                  v-if="activeBatch.status === 'PROCESSING'"
                  type="warning"
                  @click="handlePause"
                >暂停</el-button>
                <el-button
                  v-if="activeBatch.status === 'PAUSED'"
                  type="primary"
                  @click="handleResume"
                >恢复</el-button>
                <el-button
                  v-if="['PROCESSING','PAUSED','PENDING'].includes(activeBatch.status)"
                  type="danger"
                  @click="handleCancel"
                >取消</el-button>
                <el-button
                  v-if="['COMPLETED','FAILED','CANCELLED'].includes(activeBatch.status) && activeBatch.failedCount > 0"
                  type="primary"
                  @click="handleRetryFailed"
                >重导失败行</el-button>
                <el-button
                  v-if="['COMPLETED','FAILED','CANCELLED','PAUSED'].includes(activeBatch.status)"
                  @click="resetForm"
                >重新导入</el-button>
              </div>

              <div v-if="activeBatch.errorMessage" class="error-message">
                <el-alert :title="activeBatch.errorMessage" type="error" show-icon />
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="历史批次" name="history">
          <div class="filter-bar">
            <el-form :inline="true" :model="batchFilter" size="default">
              <el-form-item label="状态">
                <el-select v-model="batchFilter.status" placeholder="全部" clearable style="width: 140px">
                  <el-option label="待处理" value="PENDING" />
                  <el-option label="处理中" value="PROCESSING" />
                  <el-option label="已暂停" value="PAUSED" />
                  <el-option label="已完成" value="COMPLETED" />
                  <el-option label="已取消" value="CANCELLED" />
                  <el-option label="失败" value="FAILED" />
                </el-select>
              </el-form-item>
              <el-form-item label="日期">
                <el-date-picker
                  v-model="batchFilter.dateRange"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                />
              </el-form-item>
              <el-form-item label="文件名">
                <el-input v-model="batchFilter.keyword" placeholder="搜索文件名" clearable style="width: 200px" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="fetchBatches">查询</el-button>
                <el-button @click="resetBatchFilter">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="batchList" border stripe v-loading="batchLoading">
            <el-table-column label="ID" prop="id" width="70" />
            <el-table-column label="文件名" prop="fileName" min-width="200">
              <template #default="{ row }">
                <el-button link type="primary" @click="viewBatchDetail(row)">{{ row.fileName }}</el-button>
              </template>
            </el-table-column>
            <el-table-column label="总数" prop="totalCount" width="80" align="center" />
            <el-table-column label="成功" prop="successCount" width="80" align="center">
              <template #default="{ row }">
                <span class="text-success">{{ row.successCount }}</span>
              </template>
            </el-table-column>
            <el-table-column label="跳过" prop="skippedCount" width="80" align="center" />
            <el-table-column label="失败" prop="failedCount" width="80" align="center">
              <template #default="{ row }">
                <span class="text-danger" v-if="row.failedCount > 0">{{ row.failedCount }}</span>
                <span v-else>0</span>
              </template>
            </el-table-column>
            <el-table-column label="待处理" prop="pendingCount" width="80" align="center" />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)" size="small">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="120">
              <template #default="{ row }">
                <el-progress :percentage="row.progress || 0" :stroke-width="8" />
              </template>
            </el-table-column>
            <el-table-column label="操作人" width="120">
              <template #default="{ row }">{{ row.operator?.username || row.operatorUsername }}</template>
            </el-table-column>
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="viewBatchDetail(row)">
                  详情
                </el-button>
                <el-button
                  v-if="row.status === 'PROCESSING'"
                  type="warning" link size="small"
                  @click="handlePause(row.id)"
                >暂停</el-button>
                <el-button
                  v-if="row.status === 'PAUSED'"
                  type="primary" link size="small"
                  @click="handleResume(row.id)"
                >恢复</el-button>
                <el-button
                  v-if="['PROCESSING','PAUSED','PENDING'].includes(row.status)"
                  type="danger" link size="small"
                  @click="handleCancel(row.id)"
                >取消</el-button>
                <el-button
                  v-if="['COMPLETED','FAILED','CANCELLED'].includes(row.status) && row.failedCount > 0"
                  type="success" link size="small"
                  @click="handleRetryFailed(row.id)"
                >重导失败</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination">
            <el-pagination
              v-model:current-page="batchPage"
              v-model:page-size="batchPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="batchTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="fetchBatches"
              @current-change="fetchBatches"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      :title="`批次详情 - #${selectedBatch?.id}`"
      width="900px"
      destroy-on-close
    >
      <div v-if="selectedBatch">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="文件名">{{ selectedBatch.fileName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusTagType(selectedBatch.status)">
              {{ getStatusLabel(selectedBatch.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="冲突策略">
            {{ getConflictLabel(selectedBatch.conflictStrategy) }}
          </el-descriptions-item>
          <el-descriptions-item label="总数">{{ selectedBatch.totalCount }}</el-descriptions-item>
          <el-descriptions-item label="成功">{{ selectedBatch.successCount }}</el-descriptions-item>
          <el-descriptions-item label="跳过">{{ selectedBatch.skippedCount }}</el-descriptions-item>
          <el-descriptions-item label="失败">{{ selectedBatch.failedCount }}</el-descriptions-item>
          <el-descriptions-item label="待处理">{{ selectedBatch.pendingCount }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ selectedBatch.operatorUsername }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(selectedBatch.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatDate(selectedBatch.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ formatDate(selectedBatch.completedAt) }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-filter">
          <el-radio-group v-model="recordFilter" size="default" @change="fetchBatchRecords">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="SUCCESS">成功</el-radio-button>
            <el-radio-button value="SKIPPED">跳过</el-radio-button>
            <el-radio-button value="FAILED">失败</el-radio-button>
            <el-radio-button value="PENDING_REVIEW">待处理</el-radio-button>
          </el-radio-group>
        </div>

        <el-table :data="recordList" border stripe size="small" v-loading="recordLoading" max-height="400">
          <el-table-column label="行号" prop="rowNumber" width="70" align="center" />
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getRowStatusTag(row.status)" size="small">
                {{ getRowStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原始数据" min-width="250">
            <template #default="{ row }">
              <span class="raw-data">{{ formatRawData(row.rawData) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="关联会员" width="150">
            <template #default="{ row }">
              <span v-if="row.member">{{ row.member.name }} / {{ row.member.phone }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="错误/备注" min-width="200">
            <template #default="{ row }">
              <span class="error-text" v-if="row.errorReason">{{ row.errorReason }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="recordPage"
            v-model:page-size="recordPageSize"
            :page-sizes="[20, 50, 100]"
            :total="recordTotal"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="fetchBatchRecords"
            @current-change="fetchBatchRecords"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, UploadFilled } from '@element-plus/icons-vue';
import axios from 'axios';
import request from '../api/axios';
import {
  downloadTemplate,
  getStandardFields,
  previewImportFile,
  remapPreview,
  startImport,
  listImportBatches,
  getImportBatch,
  getImportBatchRecords,
  pauseImportBatch,
  resumeImportBatch,
  cancelImportBatch,
  retryFailedRecords,
} from '../api/memberImport';

const activeTab = ref('new');
const currentStep = ref(0);
const uploadRef = ref(null);
const uploadedFile = ref(null);
const previewData = ref(null);
const standardFields = ref([]);
const fieldMapping = reactive({});
const conflictStrategy = ref('SKIP');
const previewLoading = ref(false);
const remapLoading = ref(false);
const startLoading = ref(false);
const activeBatch = ref(null);
let progressTimer = null;

const batchList = ref([]);
const batchLoading = ref(false);
const batchPage = ref(1);
const batchPageSize = ref(20);
const batchTotal = ref(0);
const batchFilter = reactive({
  status: '',
  dateRange: [],
  keyword: '',
});

const detailDialogVisible = ref(false);
const selectedBatch = ref(null);
const recordList = ref([]);
const recordLoading = ref(false);
const recordPage = ref(1);
const recordPageSize = ref(20);
const recordTotal = ref(0);
const recordFilter = ref('');

onMounted(async () => {
  try {
    standardFields.value = (await getStandardFields()).data;
  } catch (e) {
    console.error(e);
  }
  fetchBatches();
});

onUnmounted(() => {
  if (progressTimer) clearInterval(progressTimer);
});

function formatFileSize(size) {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(2)} ${units[i]}`;
}

function formatDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('zh-CN');
}

function formatRawData(data) {
  if (!data) return '';
  return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' | ');
}

function getFieldDescription(key) {
  const desc = {
    name: '必填，至少2个字符',
    phone: '必填，11位手机号，唯一',
    email: '可选，有效邮箱格式',
    level: '可选：普通/银卡/金卡/铂金 或 NORMAL/SILVER/GOLD/PLATINUM',
    status: '可选：活跃/不活跃/停用 或 ACTIVE/INACTIVE/SUSPENDED',
    channel: '可选：线上/线下/推荐/推广/其他 或 ONLINE/OFFLINE/REFERRAL/PROMOTION/OTHER',
    points: '可选，整数积分',
    birthday: '可选，生日年份',
    birthdayMonth: '可选，1-12',
    birthdayDay: '可选，1-31',
    calendarType: '可选：阳历/阴历 或 SOLAR/LUNAR',
  };
  return desc[key] || '';
}

function getMappedPreviewValue(key) {
  if (!previewData.value?.previewRows?.length) return '';
  const firstRow = previewData.value.previewRows[0];
  const csvCol = fieldMapping[key] || key;
  return firstRow.rawData?.[csvCol] ?? '';
}

function getStatusLabel(status) {
  const map = { PENDING: '待处理', PROCESSING: '处理中', PAUSED: '已暂停', COMPLETED: '已完成', CANCELLED: '已取消', FAILED: '失败' };
  return map[status] || status;
}

function getStatusTagType(status) {
  const map = { PENDING: 'info', PROCESSING: 'primary', PAUSED: 'warning', COMPLETED: 'success', CANCELLED: 'info', FAILED: 'danger' };
  return map[status] || 'info';
}

function getProgressStatus(status) {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'exception';
  if (status === 'CANCELLED') return 'warning';
  return undefined;
}

function getConflictLabel(strategy) {
  const map = { SKIP: '跳过重复', OVERWRITE: '覆盖更新', MARK_FOR_REVIEW: '标记待处理' };
  return map[strategy] || strategy;
}

function getRowStatusLabel(status) {
  const map = { SUCCESS: '成功', SKIPPED: '跳过', FAILED: '失败', PENDING_REVIEW: '待处理' };
  return map[status] || status;
}

function getRowStatusTag(status) {
  const map = { SUCCESS: 'success', SKIPPED: 'info', FAILED: 'danger', PENDING_REVIEW: 'warning' };
  return map[status] || 'info';
}

async function handleDownloadTemplate() {
  try {
    const res = await downloadTemplate();
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'member_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    ElMessage.error('下载模板失败');
  }
}

function handleFileChange(file) {
  uploadedFile.value = file.raw;
}

function handleFileRemove() {
  uploadedFile.value = null;
  previewData.value = null;
}

function handleExceed() {
  ElMessage.warning('一次只能上传一个文件');
}

async function handlePreview() {
  if (!uploadedFile.value) return;
  previewLoading.value = true;
  try {
    const res = await previewImportFile(uploadedFile.value);
    previewData.value = res.data;
    Object.keys(fieldMapping).forEach(k => delete fieldMapping[k]);
    (res.data.headers || []).forEach(h => {
      const found = standardFields.value.find(f => f.label === h || f.key === h);
      if (found) fieldMapping[found.key] = h;
    });
    currentStep.value = 1;
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function handleRemap() {
  if (!previewData.value) return;
  remapLoading.value = true;
  try {
    const res = await remapPreview({
      tempFilePath: previewData.value.tempFilePath,
      fieldMapping,
    });
    previewData.value = { ...previewData.value, ...res.data };
    currentStep.value = 2;
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '预览失败');
  } finally {
    remapLoading.value = false;
  }
}

async function handleStartImport() {
  if (!previewData.value) return;
  startLoading.value = true;
  try {
    const res = await startImport({
      tempFilePath: previewData.value.tempFilePath,
      fileName: previewData.value.fileName,
      conflictStrategy: conflictStrategy.value,
      fieldMapping,
    });
    activeBatch.value = res.data;
    currentStep.value = 3;
    ElMessage.success('导入任务已创建');
    startProgressPolling();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '创建任务失败');
  } finally {
    startLoading.value = false;
  }
}

function startProgressPolling() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(async () => {
    if (!activeBatch.value) return;
    try {
      const res = await getImportBatch(activeBatch.value.id);
      activeBatch.value = res.data;
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(res.data.status)) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    } catch (e) {
      console.error(e);
    }
  }, 2000);
}

async function handlePause(id) {
  const batchId = id || activeBatch.value?.id;
  try {
    await pauseImportBatch(batchId);
    ElMessage.success('已暂停');
    if (activeBatch.value && activeBatch.value.id === batchId) {
      activeBatch.value = (await getImportBatch(batchId)).data;
    }
    fetchBatches();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '暂停失败');
  }
}

async function handleResume(id) {
  const batchId = id || activeBatch.value?.id;
  try {
    await resumeImportBatch(batchId);
    ElMessage.success('已恢复');
    if (activeBatch.value && activeBatch.value.id === batchId) {
      activeBatch.value = (await getImportBatch(batchId)).data;
      startProgressPolling();
    }
    fetchBatches();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '恢复失败');
  }
}

async function handleCancel(id) {
  const batchId = id || activeBatch.value?.id;
  try {
    await ElMessageBox.confirm('确定要取消此导入任务吗？', '提示', { type: 'warning' });
    await cancelImportBatch(batchId);
    ElMessage.success('已取消');
    if (activeBatch.value && activeBatch.value.id === batchId) {
      activeBatch.value = (await getImportBatch(batchId)).data;
    }
    fetchBatches();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.error || '取消失败');
  }
}

async function handleRetryFailed(id) {
  const batchId = id || activeBatch.value?.id;
  try {
    await retryFailedRecords(batchId);
    ElMessage.success('重导任务已提交');
    if (activeBatch.value && activeBatch.value.id === batchId) {
      activeBatch.value = (await getImportBatch(batchId)).data;
    }
    fetchBatches();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '重导失败');
  }
}

function resetForm() {
  currentStep.value = 0;
  uploadedFile.value = null;
  previewData.value = null;
  activeBatch.value = null;
  conflictStrategy.value = 'SKIP';
  Object.keys(fieldMapping).forEach(k => delete fieldMapping[k]);
  if (uploadRef.value) uploadRef.value.clearFiles();
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

async function fetchBatches() {
  batchLoading.value = true;
  try {
    const params = {
      page: batchPage.value,
      pageSize: batchPageSize.value,
    };
    if (batchFilter.status) params.status = batchFilter.status;
    if (batchFilter.keyword) params.keyword = batchFilter.keyword;
    if (batchFilter.dateRange?.length === 2) {
      params.startDate = batchFilter.dateRange[0];
      params.endDate = batchFilter.dateRange[1];
    }
    const res = await listImportBatches(params);
    batchList.value = res.data.list;
    batchTotal.value = res.data.total;
  } catch (e) {
    ElMessage.error('获取批次列表失败');
  } finally {
    batchLoading.value = false;
  }
}

function resetBatchFilter() {
  batchFilter.status = '';
  batchFilter.dateRange = [];
  batchFilter.keyword = '';
  batchPage.value = 1;
  fetchBatches();
}

async function viewBatchDetail(row) {
  selectedBatch.value = row;
  recordPage.value = 1;
  recordFilter.value = '';
  detailDialogVisible.value = true;
  await fetchBatchRecords();
  if (['PROCESSING', 'PAUSED'].includes(row.status)) {
    startDetailPolling(row.id);
  }
}

let detailPollingTimer = null;
function startDetailPolling(batchId) {
  if (detailPollingTimer) clearInterval(detailPollingTimer);
  detailPollingTimer = setInterval(async () => {
    try {
      const res = await getImportBatch(batchId);
      selectedBatch.value = res.data;
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(res.data.status)) {
        clearInterval(detailPollingTimer);
        detailPollingTimer = null;
      }
    } catch (e) { /* ignore */ }
  }, 2000);
}

async function fetchBatchRecords() {
  if (!selectedBatch.value) return;
  recordLoading.value = true;
  try {
    const params = {
      page: recordPage.value,
      pageSize: recordPageSize.value,
    };
    if (recordFilter.value) params.status = recordFilter.value;
    const res = await getImportBatchRecords(selectedBatch.value.id, params);
    recordList.value = res.data.list;
    recordTotal.value = res.data.total;
  } catch (e) {
    ElMessage.error('获取记录失败');
  } finally {
    recordLoading.value = false;
  }
}
</script>

<style scoped>
.import-workspace {
  padding: 0;
}

.main-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.step-flow {
  padding: 24px 0 32px;
}

.step-content {
  padding: 8px 0;
}

.upload-area {
  margin-bottom: 24px;
}

.upload-icon {
  font-size: 67px;
  color: #409eff;
}

.upload-text {
  font-size: 14px;
  color: #606266;
}

.upload-text em {
  color: #409eff;
  font-style: normal;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
}

.file-info {
  margin-bottom: 24px;
}

.file-actions {
  margin-top: 16px;
  text-align: right;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.section-title .tip {
  font-size: 12px;
  font-weight: normal;
  color: #909399;
}

.required {
  color: #f56c6c;
  font-weight: 600;
}

.field-desc {
  color: #909399;
  font-size: 12px;
}

.preview-value {
  color: #606266;
  font-size: 12px;
}

.conflict-group {
  margin-bottom: 8px;
}

.dup {
  color: #e6a23c;
  font-weight: 600;
}

.tag {
  margin-left: 4px;
}

.error-text {
  color: #f56c6c;
  font-size: 12px;
}

.text-success {
  color: #67c23a;
  font-weight: 600;
}

.text-danger {
  color: #f56c6c;
  font-weight: 600;
}

.text-muted {
  color: #909399;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}

.progress-panel {
  padding: 8px 0;
}

.progress-bar {
  margin: 24px 0;
}

.stats-row {
  display: flex;
  gap: 40px;
  margin: 24px 0;
  padding: 20px;
  background: #f8fafc;
  border-radius: 8px;
}

.batch-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.error-message {
  margin-top: 16px;
}

.filter-bar {
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-filter {
  margin: 16px 0;
}

.raw-data {
  font-size: 12px;
  color: #606266;
  font-family: monospace;
}
</style>
