<template>
  <div class="audit-logs-page">
    <el-card shadow="never" class="page-header-card">
      <div class="header-row">
        <div>
          <h2 class="page-title">操作审计日志</h2>
          <p class="page-desc">记录系统内所有关键操作，支持筛选、搜索、Diff对比与合规导出</p>
        </div>
        <div class="header-actions">
          <el-button :icon="Refresh" @click="fetchLogs">刷新</el-button>
          <el-dropdown @command="handleExport" trigger="click">
            <el-button type="primary" :icon="Download">
              导出日志
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
                <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">总操作数</div>
          <div class="stat-value">{{ stats.totalCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">失败率</div>
          <div class="stat-value" :class="{ 'text-danger': stats.failureRate > 5 }">
            {{ stats.failureRate }}%
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">Top 5 操作类型</div>
          <div class="action-type-list">
            <el-tag
              v-for="item in topActionTypes"
              :key="item.actionType"
              :type="getSensitivityTagType(item.actionType)"
              class="action-tag"
            >
              {{ actionTypeLabels[item.actionType] || item.actionType }}
              <span class="tag-count">{{ item._count }}</span>
            </el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="filter-card">
      <el-form :model="filters" inline>
        <el-form-item label="关键字">
          <el-input
            v-model="filters.keyword"
            placeholder="操作人/备注/实体ID/路径"
            clearable
            style="width: 220px"
            @keyup.enter="fetchLogs"
          />
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filters.actionType" placeholder="全部" clearable style="width: 180px">
            <el-option
              v-for="(label, key) in actionTypeLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标实体">
          <el-select v-model="filters.entityType" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="(label, key) in entityTypeLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="敏感级别">
          <el-select v-model="filters.sensitivityLevel" placeholder="全部" clearable style="width: 130px">
            <el-option label="低 (LOW)" value="LOW" />
            <el-option label="中 (MEDIUM)" value="MEDIUM" />
            <el-option label="高 (HIGH)" value="HIGH" />
            <el-option label="严重 (CRITICAL)" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果状态">
          <el-select v-model="filters.resultStatus" placeholder="全部" clearable style="width: 130px">
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAILURE" />
            <el-option label="部分成功" value="PARTIAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input
            v-model="filters.operatorUsername"
            placeholder="用户名"
            clearable
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 360px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="fetchLogs">查询</el-button>
          <el-button :icon="RefreshLeft" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="日志列表" name="list">
        <el-card shadow="never" class="table-card">
          <el-table :data="logs" v-loading="loading" stripe style="width: 100%">
            <el-table-column prop="id" label="ID" width="90" :formatter="formatBigInt" />
            <el-table-column label="操作时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作人" width="120">
              <template #default="{ row }">
                <span v-if="row.operatorUsername">{{ row.operatorUsername }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="动作类型" width="160">
              <template #default="{ row }">
                <el-tag :type="getActionTypeTagType(row.actionType)" size="small">
                  {{ actionTypeLabels[row.actionType] || row.actionType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="目标" width="170">
              <template #default="{ row }">
                <div class="entity-cell">
                  <el-tag size="small" type="info" effect="plain">{{ entityTypeLabels[row.entityType] }}</el-tag>
                  <span class="entity-id" v-if="row.entityId">#{{ row.entityId }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="敏感级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getSensitivityTagType(row.sensitivityLevel)" size="small">
                  {{ sensitivityLabels[row.sensitivityLevel] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.resultStatus === 'SUCCESS' ? 'success' : (row.resultStatus === 'FAILURE' ? 'danger' : 'warning')" size="small">
                  {{ resultLabels[row.resultStatus] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            <el-table-column label="耗时" width="90" align="right">
              <template #default="{ row }">
                <span>{{ row.durationMs != null ? row.durationMs + 'ms' : '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="viewDetail(row)">
                  详情
                </el-button>
                <el-button
                  v-if="row.beforeSnapshot || row.afterSnapshot"
                  link
                  type="primary"
                  size="small"
                  @click="viewDiff(row)"
                >
                  Diff
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[20, 50, 100, 200]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="fetchLogs"
              @current-change="fetchLogs"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="异常统计" name="stats">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>按操作人聚合（Top 20）</span>
                </div>
              </template>
              <el-table :data="stats.byOperator || []" stripe>
                <el-table-column prop="operatorUsername" label="操作人" width="150" />
                <el-table-column label="成功次数" width="120" align="right">
                  <template #default="{ row }">
                    <span class="text-success">{{ getCountByStatus(row, 'SUCCESS') }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="失败次数" width="120" align="right">
                  <template #default="{ row }">
                    <span class="text-danger">{{ getCountByStatus(row, 'FAILURE') + getCountByStatus(row, 'PARTIAL') }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="_count" label="总次数" width="120" align="right" />
              </el-table>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card shadow="never">
              <template #header>
                <div class="card-header">
                  <span>按操作类型聚合</span>
                </div>
              </template>
              <el-table :data="stats.byActionType || []" stripe>
                <el-table-column label="操作类型" width="200">
                  <template #default="{ row }">
                    {{ actionTypeLabels[row.actionType] || row.actionType }}
                  </template>
                </el-table-column>
                <el-table-column label="结果" width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.resultStatus === 'SUCCESS' ? 'success' : (row.resultStatus === 'FAILURE' ? 'danger' : 'warning')" size="small">
                      {{ resultLabels[row.resultStatus] }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="_count" label="次数" width="120" align="right" />
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="审计配置" name="config">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>审计范围配置</span>
              <el-tag type="info" size="small">ADMIN 可配置需要审计的操作范围与敏感级别</el-tag>
            </div>
          </template>
          <el-table :data="configList" v-loading="configLoading" stripe>
            <el-table-column label="操作类型" width="200">
              <template #default="{ row }">
                {{ actionTypeLabels[row.actionType] || row.actionType }}
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="150" />
            <el-table-column label="敏感级别" width="180">
              <template #default="{ row }">
                <el-select
                  v-model="row.sensitivityLevel"
                  size="small"
                  style="width: 140px"
                  @change="handleConfigChange(row)"
                >
                  <el-option label="低 (LOW)" value="LOW" />
                  <el-option label="中 (MEDIUM)" value="MEDIUM" />
                  <el-option label="高 (HIGH)" value="HIGH" />
                  <el-option label="严重 (CRITICAL)" value="CRITICAL" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  v-model="row.enabled"
                  @change="handleConfigChange(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="180">
              <template #default="{ row }">
                {{ formatDate(row.updatedAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="detailVisible" title="日志详情" width="720px" destroy-on-close>
      <template v-if="currentLog">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="日志ID">{{ formatBigInt(currentLog) }}</el-descriptions-item>
          <el-descriptions-item label="操作时间">{{ formatDate(currentLog.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ currentLog.operatorUsername || '-' }} (ID: {{ currentLog.operatorId || '-' }})
          </el-descriptions-item>
          <el-descriptions-item label="耗时">{{ currentLog.durationMs != null ? currentLog.durationMs + 'ms' : '-' }}</el-descriptions-item>
          <el-descriptions-item label="动作类型">
            <el-tag :type="getActionTypeTagType(currentLog.actionType)">
              {{ actionTypeLabels[currentLog.actionType] || currentLog.actionType }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="目标">
            {{ entityTypeLabels[currentLog.entityType] }}
            <span v-if="currentLog.entityId">#{{ currentLog.entityId }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="敏感级别">
            <el-tag :type="getSensitivityTagType(currentLog.sensitivityLevel)">
              {{ sensitivityLabels[currentLog.sensitivityLevel] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="结果状态">
            <el-tag :type="currentLog.resultStatus === 'SUCCESS' ? 'success' : 'danger'">
              {{ resultLabels[currentLog.resultStatus] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="请求IP">{{ currentLog.requestIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求方法">{{ currentLog.requestMethod || '-' }}</el-descriptions-item>
          <el-descriptions-item label="请求路径" :span="2">{{ currentLog.requestPath || '-' }}</el-descriptions-item>
          <el-descriptions-item label="User-Agent" :span="2">
            <span class="text-small">{{ currentLog.userAgent || '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentLog.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item v-if="currentLog.errorMessage" label="错误信息" :span="2">
            <span class="text-danger">{{ currentLog.errorMessage }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>请求参数</el-divider>
        <pre class="json-pre">{{ formatJson(currentLog.requestParams) }}</pre>

        <el-divider v-if="currentLog.beforeSnapshot || currentLog.afterSnapshot">数据快照</el-divider>
        <el-row v-if="currentLog.beforeSnapshot || currentLog.afterSnapshot" :gutter="12">
          <el-col :span="12" v-if="currentLog.beforeSnapshot">
            <div class="snapshot-title">变更前</div>
            <pre class="json-pre">{{ formatJson(currentLog.beforeSnapshot) }}</pre>
          </el-col>
          <el-col :span="12" v-if="currentLog.afterSnapshot">
            <div class="snapshot-title">变更后</div>
            <pre class="json-pre">{{ formatJson(currentLog.afterSnapshot) }}</pre>
          </el-col>
        </el-row>
      </template>
    </el-dialog>

    <el-dialog v-model="diffVisible" title="数据 Diff 对比" width="900px" destroy-on-close>
      <template v-if="currentLog">
        <div class="diff-container">
          <div class="diff-pane">
            <div class="diff-pane-title before">变更前 (Before)</div>
            <pre class="diff-pre">{{ formatJson(currentLog.beforeSnapshot) || '(无数据)' }}</pre>
          </div>
          <div class="diff-pane">
            <div class="diff-pane-title after">变更后 (After)</div>
            <pre class="diff-pre">{{ formatJson(currentLog.afterSnapshot) || '(无数据)' }}</pre>
          </div>
        </div>
        <el-divider>字段差异列表</el-divider>
        <div class="diff-fields">
          <div
            v-for="(diff, idx) in fieldDiffs"
            :key="idx"
            class="diff-field-row"
            :class="{ 'diff-added': diff.type === 'added', 'diff-removed': diff.type === 'removed', 'diff-changed': diff.type === 'changed' }"
          >
            <el-tag size="small" :type="diff.type === 'added' ? 'success' : (diff.type === 'removed' ? 'danger' : 'warning')">
              {{ diff.type === 'added' ? '新增' : (diff.type === 'removed' ? '删除' : '修改') }}
            </el-tag>
            <span class="diff-field-key">{{ diff.key }}</span>
            <span class="diff-field-values">
              <template v-if="diff.type === 'changed'">
                <del class="diff-old">{{ formatJson(diff.oldValue) }}</del>
                <span class="diff-arrow">→</span>
                <ins class="diff-new">{{ formatJson(diff.newValue) }}</ins>
              </template>
              <template v-else-if="diff.type === 'added'">
                <ins class="diff-new">{{ formatJson(diff.newValue) }}</ins>
              </template>
              <template v-else>
                <del class="diff-old">{{ formatJson(diff.oldValue) }}</del>
              </template>
            </span>
          </div>
          <el-empty v-if="fieldDiffs.length === 0" description="无字段差异" />
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Download, ArrowDown, Search, RefreshLeft
} from '@element-plus/icons-vue';
import axios from '../api/axios';
import dayjs from 'dayjs';

const actionTypeLabels = {
  MEMBER_CREATE: '会员创建',
  MEMBER_UPDATE: '会员更新',
  MEMBER_DELETE: '会员删除',
  POINTS_ADJUST: '积分调整',
  POINTS_FREEZE: '积分冻结',
  POINTS_UNFREEZE: '积分解冻',
  USER_CREATE: '用户创建',
  USER_UPDATE: '用户更新',
  USER_DELETE: '用户删除',
  AUTH_LOGIN: '用户登录',
  AUTH_LOGOUT: '用户登出',
  COUPON_ISSUE: '优惠券发放',
  BLACKLIST_ADD: '加入黑名单',
  BLACKLIST_REMOVE: '移除黑名单',
  DATA_EXPORT: '数据导出',
  SYSTEM_CONFIG: '系统配置',
  TRANSACTION_REVERSE: '流水冲正',
  BATCH_OPERATION: '批量操作',
  OTHER: '其他操作',
};

const entityTypeLabels = {
  MEMBER: '会员',
  USER: '用户',
  POINTS_TRANSACTION: '积分流水',
  COUPON: '优惠券',
  BLACKLIST: '黑名单',
  SYSTEM: '系统',
  AUDIT_CONFIG: '审计配置',
};

const sensitivityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '严重',
};

const resultLabels = {
  SUCCESS: '成功',
  FAILURE: '失败',
  PARTIAL: '部分',
};

const loading = ref(false);
const logs = ref([]);
const pagination = reactive({ page: 1, pageSize: 20, total: 0 });
const filters = reactive({
  keyword: '',
  actionType: '',
  entityType: '',
  sensitivityLevel: '',
  resultStatus: '',
  operatorUsername: '',
  startDate: '',
  endDate: '',
});
const dateRange = ref([]);

const stats = reactive({
  totalCount: 0,
  failureRate: 0,
  byActionType: [],
  byOperator: [],
});

const activeTab = ref('list');
const detailVisible = ref(false);
const diffVisible = ref(false);
const currentLog = ref(null);

const configList = ref([]);
const configLoading = ref(false);

const topActionTypes = computed(() => {
  const map = new Map();
  (stats.byActionType || []).forEach(item => {
    const current = map.get(item.actionType) || { actionType: item.actionType, _count: 0 };
    current._count += item._count;
    map.set(item.actionType, current);
  });
  return Array.from(map.values()).sort((a, b) => b._count - a._count).slice(0, 5);
});

const fieldDiffs = computed(() => {
  if (!currentLog.value) return [];
  const before = currentLog.value.beforeSnapshot || {};
  const after = currentLog.value.afterSnapshot || {};
  const diffs = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const inBefore = key in before;
    const inAfter = key in after;
    if (inBefore && !inAfter) {
      diffs.push({ key, type: 'removed', oldValue: before[key] });
    } else if (!inBefore && inAfter) {
      diffs.push({ key, type: 'added', newValue: after[key] });
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffs.push({ key, type: 'changed', oldValue: before[key], newValue: after[key] });
    }
  }
  return diffs;
});

watch(dateRange, (val) => {
  if (val && val.length === 2) {
    filters.startDate = val[0];
    filters.endDate = val[1];
  } else {
    filters.startDate = '';
    filters.endDate = '';
  }
});

function formatDate(dt) {
  if (!dt) return '-';
  return dayjs(dt).format('YYYY-MM-DD HH:mm:ss');
}

function formatBigInt(row) {
  if (!row) return '';
  const id = row.id != null ? row.id : row;
  return id ? id.toString() : '';
}

function formatJson(obj) {
  if (obj == null) return '';
  try {
    if (typeof obj === 'string') return obj;
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function getActionTypeTagType(type) {
  const critical = ['USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'SYSTEM_CONFIG'];
  const high = ['MEMBER_DELETE', 'POINTS_ADJUST', 'POINTS_FREEZE', 'POINTS_UNFREEZE', 'BLACKLIST_ADD', 'BLACKLIST_REMOVE', 'DATA_EXPORT', 'TRANSACTION_REVERSE'];
  if (critical.includes(type)) return 'danger';
  if (high.includes(type)) return 'warning';
  return '';
}

function getSensitivityTagType(level) {
  if (level === 'CRITICAL') return 'danger';
  if (level === 'HIGH') return 'warning';
  if (level === 'MEDIUM') return '';
  return 'info';
}

function getCountByStatus(row, status) {
  if (row.resultStatus === status) return row._count;
  return 0;
}

async function fetchLogs() {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters,
    };
    const data = await axios.get('/audit-logs', { params });
    logs.value = data.list || [];
    pagination.total = data.total || 0;
  } catch (e) {
    ElMessage.error('获取日志列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchStats() {
  try {
    const data = await axios.get('/audit-logs/stats', {
      params: {
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    });
    Object.assign(stats, data);
  } catch (e) {
    // ignore
  }
}

async function fetchConfig() {
  configLoading.value = true;
  try {
    configList.value = await axios.get('/audit-logs/config/list');
  } catch (e) {
    ElMessage.error('获取配置失败');
  } finally {
    configLoading.value = false;
  }
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    actionType: '',
    entityType: '',
    sensitivityLevel: '',
    resultStatus: '',
    operatorUsername: '',
    startDate: '',
    endDate: '',
  });
  dateRange.value = [];
  pagination.page = 1;
  fetchLogs();
}

function viewDetail(row) {
  currentLog.value = row;
  detailVisible.value = true;
}

function viewDiff(row) {
  currentLog.value = row;
  diffVisible.value = true;
}

async function handleExport(type) {
  try {
    const params = { ...filters };
    const url = type === 'csv' ? '/audit-logs/export/csv' : '/audit-logs/export/json';
    const response = await axios.get(url, {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response], {
      type: type === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${Date.now()}.${type}`;
    link.click();
    URL.revokeObjectURL(link.href);
    ElMessage.success('导出成功');
  } catch (e) {
    ElMessage.error('导出失败');
  }
}

async function handleConfigChange(row) {
  try {
    await axios.put(`/audit-logs/config/${row.id}`, {
      enabled: row.enabled,
      sensitivityLevel: row.sensitivityLevel,
      description: row.description,
    });
    ElMessage.success('配置已更新');
  } catch (e) {
    ElMessage.error('配置更新失败');
    fetchConfig();
  }
}

onMounted(() => {
  fetchLogs();
  fetchStats();
  fetchConfig();
});
</script>

<style scoped>
.audit-logs-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header-card {
  border-radius: 12px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.page-desc {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-row {
  margin-top: 0;
}

.stat-card {
  border-radius: 12px;
  height: 100%;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 6px;
}

.stat-value.text-danger {
  color: #ef4444;
}

.action-type-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.action-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tag-count {
  background: rgba(255, 255, 255, 0.4);
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.filter-card {
  border-radius: 12px;
}

.main-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.table-card {
  border-radius: 12px;
}

.entity-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.entity-id {
  font-size: 12px;
  color: #64748b;
}

.text-muted {
  color: #94a3b8;
}

.text-danger {
  color: #ef4444;
}

.text-success {
  color: #10b981;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.json-pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  max-height: 320px;
  overflow: auto;
  color: #334155;
}

.snapshot-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #475569;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.diff-container {
  display: flex;
  gap: 12px;
}

.diff-pane {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.diff-pane-title {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
}

.diff-pane-title.before {
  background: #fef2f2;
  color: #dc2626;
  border-bottom: 1px solid #fecaca;
}

.diff-pane-title.after {
  background: #f0fdf4;
  color: #16a34a;
  border-bottom: 1px solid #bbf7d0;
}

.diff-pre {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  max-height: 320px;
  overflow: auto;
  background: #fff;
}

.diff-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-field-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 13px;
}

.diff-field-row.diff-added {
  background: #f0fdf4;
}

.diff-field-row.diff-removed {
  background: #fef2f2;
}

.diff-field-row.diff-changed {
  background: #fffbeb;
}

.diff-field-key {
  font-weight: 600;
  color: #334155;
  min-width: 140px;
}

.diff-field-values {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.diff-arrow {
  color: #94a3b8;
}

.diff-old {
  background: #fee2e2;
  color: #b91c1c;
  padding: 1px 6px;
  border-radius: 4px;
  text-decoration: none;
  font-family: monospace;
}

.diff-new {
  background: #bbf7d0;
  color: #166534;
  padding: 1px 6px;
  border-radius: 4px;
  text-decoration: none;
  font-family: monospace;
}

.text-small {
  font-size: 12px;
  color: #64748b;
  word-break: break-all;
}
</style>
