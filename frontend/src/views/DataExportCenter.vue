<template>
  <div class="data-export">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">数据导出中心</h2>
        <p class="page-subtitle">定制化数据导出，支持多类型、多条件筛选，历史记录追溯</p>
      </div>
    </div>

    <el-card class="export-card" shadow="never">
      <el-tabs v-model="activeTab" class="custom-tabs">
        <el-tab-pane label="新建导出" name="create">
          <div class="create-section">
            <div class="form-grid">
              <el-form label-position="top">
                <el-row :gutter="24">
                  <el-col :span="12">
                    <el-form-item label="导出类型" required>
                      <el-select
                        v-model="form.exportType"
                        placeholder="请选择导出类型"
                        style="width: 100%"
                        @change="handleTypeChange"
                      >
                        <el-option
                          v-for="t in exportTypes"
                          :key="t.type"
                          :label="t.label"
                          :value="t.type"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="日期区间">
                      <el-date-picker
                        v-model="form.dateRange"
                        type="daterange"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        style="width: 100%"
                        value-format="YYYY-MM-DD"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24" v-if="form.exportType === 'MEMBERS'">
                  <el-col :span="8">
                    <el-form-item label="搜索关键词">
                      <el-input v-model="form.filters.search" placeholder="姓名/手机号" clearable />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="会员等级">
                      <el-select v-model="form.filters.level" placeholder="全部" clearable style="width: 100%">
                        <el-option label="普通" value="NORMAL" />
                        <el-option label="白银" value="SILVER" />
                        <el-option label="黄金" value="GOLD" />
                        <el-option label="铂金" value="PLATINUM" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="状态">
                      <el-select v-model="form.filters.status" placeholder="全部" clearable style="width: 100%">
                        <el-option label="正常" value="ACTIVE" />
                        <el-option label="未激活" value="INACTIVE" />
                        <el-option label="冻结" value="SUSPENDED" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24" v-if="form.exportType === 'POINTS_TRANSACTIONS'">
                  <el-col :span="6">
                    <el-form-item label="会员ID">
                      <el-input v-model="form.filters.memberId" placeholder="会员ID" clearable />
                    </el-form-item>
                  </el-col>
                  <el-col :span="6">
                    <el-form-item label="变动类型">
                      <el-select v-model="form.filters.changeType" placeholder="全部" clearable style="width: 100%">
                        <el-option label="增加" value="ADD" />
                        <el-option label="扣除" value="DEDUCT" />
                        <el-option label="冻结" value="FREEZE" />
                        <el-option label="解冻" value="UNFREEZE" />
                        <el-option label="过期" value="EXPIRE" />
                        <el-option label="冲正" value="REVERSE" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6">
                    <el-form-item label="变动原因">
                      <el-select v-model="form.filters.reasonType" placeholder="全部" clearable style="width: 100%">
                        <el-option label="手动调整" value="MANUAL_ADJUST" />
                        <el-option label="商城兑换" value="MALL_EXCHANGE" />
                        <el-option label="签到奖励" value="SIGN_IN_REWARD" />
                        <el-option label="活动奖励" value="ACTIVITY_BONUS" />
                        <el-option label="订单获取" value="ORDER_EARN" />
                        <el-option label="过期清零" value="EXPIRE_CLEAR" />
                        <el-option label="注册奖励" value="REGISTER_REWARD" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="6">
                    <el-form-item label="业务单号">
                      <el-input v-model="form.filters.bizOrderNo" placeholder="业务单号" clearable />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24" v-if="form.exportType === 'COUPON_CLAIMS'">
                  <el-col :span="8">
                    <el-form-item label="优惠券ID">
                      <el-input v-model="form.filters.couponId" placeholder="优惠券ID" clearable />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="会员ID">
                      <el-input v-model="form.filters.memberId" placeholder="会员ID" clearable />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="状态">
                      <el-select v-model="form.filters.status" placeholder="全部" clearable style="width: 100%">
                        <el-option label="已领取" value="CLAIMED" />
                        <el-option label="已锁定" value="LOCKED" />
                        <el-option label="已核销" value="REDEEMED" />
                        <el-option label="已退回" value="RETURNED" />
                        <el-option label="已过期" value="EXPIRED" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24" v-if="form.exportType === 'WORK_ORDERS'">
                  <el-col :span="8">
                    <el-form-item label="状态">
                      <el-select v-model="form.filters.status" placeholder="全部" clearable style="width: 100%">
                        <el-option label="待处理" value="PENDING" />
                        <el-option label="处理中" value="PROCESSING" />
                        <el-option label="已解决" value="RESOLVED" />
                        <el-option label="已关闭" value="CLOSED" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="优先级">
                      <el-select v-model="form.filters.priority" placeholder="全部" clearable style="width: 100%">
                        <el-option label="低" value="LOW" />
                        <el-option label="中" value="MEDIUM" />
                        <el-option label="高" value="HIGH" />
                        <el-option label="紧急" value="URGENT" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="会员ID">
                      <el-input v-model="form.filters.memberId" placeholder="会员ID" clearable />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24" v-if="form.exportType === 'SIGN_IN_RECORDS' || form.exportType === 'EXCHANGE_RECORDS'">
                  <el-col :span="12">
                    <el-form-item label="会员ID">
                      <el-input v-model="form.filters.memberId" placeholder="会员ID" clearable />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12" v-if="form.exportType === 'EXCHANGE_RECORDS'">
                    <el-form-item label="状态">
                      <el-select v-model="form.filters.status" placeholder="全部" clearable style="width: 100%">
                        <el-option label="已完成" value="COMPLETED" />
                        <el-option label="处理中" value="PROCESSING" />
                        <el-option label="已取消" value="CANCELLED" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="24">
                  <el-col :span="12">
                    <el-form-item label="排序字段">
                      <el-select v-model="form.sortBy" placeholder="默认排序" clearable style="width: 100%">
                        <el-option
                          v-for="f in currentFieldDefs?.fields || []"
                          :key="f.key"
                          :label="f.label"
                          :value="f.key"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="排序方式">
                      <el-radio-group v-model="form.sortOrder">
                        <el-radio-button label="desc">降序</el-radio-button>
                        <el-radio-button label="asc">升序</el-radio-button>
                      </el-radio-group>
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-form-item label="导出字段" required>
                  <div class="field-selector">
                    <div class="field-actions">
                      <el-checkbox
                        :model-value="isAllFieldsSelected"
                        :indeterminate="isIndeterminate"
                        @change="handleCheckAll"
                      >
                        全选
                      </el-checkbox>
                      <span class="selected-count">已选 {{ form.fields.length }} / {{ allowedFieldCount }}</span>
                    </div>
                    <el-checkbox-group v-model="form.fields" class="field-group">
                      <el-checkbox
                        v-for="f in currentFieldDefs?.fields?.filter(f => f.allowed !== false) || []"
                        :key="f.key"
                        :value="f.key"
                        class="field-item"
                      >
                        <span>{{ f.label }}</span>
                        <el-tag v-if="f.adminOnly" size="small" type="danger" effect="plain" class="admin-tag">管理员</el-tag>
                      </el-checkbox>
                    </el-checkbox-group>
                  </div>
                </el-form-item>
              </el-form>
            </div>

            <div class="action-bar">
              <el-button @click="resetForm">重置</el-button>
              <el-button type="primary" :loading="submitting" @click="handleSubmit">
                <el-icon class="mr-4"><Download /></el-icon>创建导出任务
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="导出历史" name="history">
          <div class="history-section">
            <div class="filter-bar">
              <el-form :inline="true" :model="historyFilters" label-position="top">
                <el-form-item label="导出类型">
                  <el-select v-model="historyFilters.exportType" placeholder="全部" clearable style="width: 160px">
                    <el-option
                      v-for="t in exportTypes"
                      :key="t.type"
                      :label="t.label"
                      :value="t.type"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="状态">
                  <el-select v-model="historyFilters.status" placeholder="全部" clearable style="width: 140px">
                    <el-option label="排队中" value="PENDING" />
                    <el-option label="生成中" value="GENERATING" />
                    <el-option label="已完成" value="COMPLETED" />
                    <el-option label="失败" value="FAILED" />
                  </el-select>
                </el-form-item>
                <el-form-item label="关键词">
                  <el-input v-model="historyFilters.keyword" placeholder="操作人/筛选条件" clearable style="width: 180px" />
                </el-form-item>
                <el-form-item label="创建时间">
                  <el-date-picker
                    v-model="historyDateRange"
                    type="daterange"
                    range-separator="~"
                    start-placeholder="开始"
                    end-placeholder="结束"
                    style="width: 260px"
                    value-format="YYYY-MM-DD"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="fetchHistory">查询</el-button>
                  <el-button @click="resetHistoryFilters">重置</el-button>
                  <el-button type="primary" link @click="fetchHistory">
                    <el-icon><Refresh /></el-icon>刷新
                  </el-button>
                </el-form-item>
              </el-form>
            </div>

            <el-table :data="historyList" v-loading="historyLoading" style="width: 100%" :header-cell-style="{ background: '#f8fafc' }">
              <el-table-column label="ID" prop="id" width="70" />
              <el-table-column label="导出类型" width="140">
                <template #default="{ row }">
                  {{ getExportTypeLabel(row.exportType) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="getStatusTagType(row.status)" effect="light">
                    {{ getStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="筛选条件" prop="filterSummary" min-width="180" show-overflow-tooltip />
              <el-table-column label="文件大小" width="110">
                <template #default="{ row }">
                  {{ row.fileSize ? formatFileSize(row.fileSize) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="下载次数" prop="downloadCount" width="90" />
              <el-table-column label="操作人" prop="operatorUsername" width="100" />
              <el-table-column label="创建时间" width="170">
                <template #default="{ row }">
                  {{ formatDate(row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="过期时间" width="170">
                <template #default="{ row }">
                  {{ row.expiredAt ? formatDate(row.expiredAt) : '-' }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.status === 'COMPLETED'"
                    type="primary"
                    link
                    @click="handleDownload(row)"
                  >
                    下载
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    @click="handleRetry(row)"
                  >
                    重试
                  </el-button>
                  <el-popover
                    v-if="row.status === 'FAILED'"
                    placement="top"
                    :width="300"
                    trigger="hover"
                  >
                    <template #reference>
                      <el-button link type="danger">错误原因</el-button>
                    </template>
                    <div style="max-height: 200px; overflow: auto;">{{ row.errorMessage || '未知错误' }}</div>
                  </el-popover>
                </template>
              </el-table-column>
            </el-table>

            <div class="pagination-wrapper">
              <el-pagination
                v-model:current-page="historyFilters.page"
                v-model:page-size="historyFilters.pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="historyTotal"
                layout="total, sizes, prev, pager, next, jumper"
                @size-change="fetchHistory"
                @current-change="fetchHistory"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane v-if="authStore.isAdmin" label="字段权限配置" name="config">
          <div class="config-section">
            <el-alert
              title="ADMIN 可限制非管理员可导出的字段范围。标记为「管理员专属」的字段仅管理员可使用。"
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 20px"
            />

            <el-tabs v-model="configTab" type="card">
              <el-tab-pane
                v-for="cfg in exportConfigs"
                :key="cfg.exportType"
                :label="cfg.label"
                :name="cfg.exportType"
              >
                <div class="config-content">
                  <div class="config-block">
                    <div class="config-block-header">
                      <h4>管理员可导出字段</h4>
                      <el-checkbox
                        :model-value="isAllAdminFieldsSelected(cfg)"
                        :indeterminate="isAdminFieldsIndeterminate(cfg)"
                        @change="(v) => handleAdminCheckAll(cfg, v)"
                      >
                        全选
                      </el-checkbox>
                    </div>
                    <el-checkbox-group v-model="cfg.adminFields" class="field-group">
                      <el-checkbox
                        v-for="f in cfg.allFields"
                        :key="f.key"
                        :value="f.key"
                        class="field-item"
                      >
                        <span>{{ f.label }}</span>
                        <el-tag v-if="f.adminOnly" size="small" type="danger" effect="plain" class="admin-tag">专属</el-tag>
                      </el-checkbox>
                    </el-checkbox-group>
                  </div>

                  <el-divider />

                  <div class="config-block">
                    <div class="config-block-header">
                      <h4>普通用户可导出字段</h4>
                      <el-checkbox
                        :model-value="isAllUserFieldsSelected(cfg)"
                        :indeterminate="isUserFieldsIndeterminate(cfg)"
                        @change="(v) => handleUserCheckAll(cfg, v)"
                      >
                        全选
                      </el-checkbox>
                    </div>
                    <el-checkbox-group v-model="cfg.userFields" class="field-group">
                      <el-checkbox
                        v-for="f in cfg.allFields.filter(f => !f.adminOnly)"
                        :key="f.key"
                        :value="f.key"
                        class="field-item"
                      >
                        {{ f.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </div>

                  <div class="config-actions">
                    <el-button
                      type="primary"
                      :loading="savingConfig"
                      @click="handleSaveConfig(cfg)"
                    >
                      保存配置
                    </el-button>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import { Download, Refresh } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import {
  getExportTypes,
  getExportFields,
  createExportTask,
  getExportTasks,
  downloadExportTask,
  retryExportTask,
  getExportConfigs,
  updateExportConfig,
} from '../api/export';

const authStore = useAuthStore();
const activeTab = ref('create');
const submitting = ref(false);
const savingConfig = ref(false);

const exportTypes = ref([]);
const currentFieldDefs = ref(null);

const form = reactive({
  exportType: '',
  fields: [],
  filters: {},
  dateRange: [],
  sortBy: '',
  sortOrder: 'desc',
});

const allowedFieldCount = computed(() => {
  if (!currentFieldDefs.value) return 0;
  return currentFieldDefs.value.fields.filter(f => f.allowed !== false).length;
});

const isAllFieldsSelected = computed(() => {
  return form.fields.length > 0 && form.fields.length === allowedFieldCount.value;
});

const isIndeterminate = computed(() => {
  return form.fields.length > 0 && form.fields.length < allowedFieldCount.value;
});

const exportConfigs = ref([]);
const configTab = ref('');

const historyLoading = ref(false);
const historyList = ref([]);
const historyTotal = ref(0);
const historyDateRange = ref([]);
const historyFilters = reactive({
  page: 1,
  pageSize: 20,
  exportType: '',
  status: '',
  keyword: '',
});

const fetchExportTypes = async () => {
  try {
    exportTypes.value = await getExportTypes();
    if (exportTypes.value.length > 0 && !form.exportType) {
      form.exportType = exportTypes.value[0].type;
      await handleTypeChange(form.exportType);
    }
  } catch (e) {
    console.error('Failed to fetch export types:', e);
  }
};

const handleTypeChange = async (type) => {
  form.fields = [];
  form.filters = {};
  form.sortBy = '';
  if (type) {
    try {
      currentFieldDefs.value = await getExportFields(type);
      const defaultFields = (currentFieldDefs.value.fields || [])
        .filter(f => f.allowed !== false)
        .slice(0, 5)
        .map(f => f.key);
      form.fields = defaultFields;
    } catch (e) {
      console.error('Failed to fetch export fields:', e);
    }
  } else {
    currentFieldDefs.value = null;
  }
};

const handleCheckAll = (val) => {
  if (!currentFieldDefs.value) return;
  if (val) {
    form.fields = currentFieldDefs.value.fields
      .filter(f => f.allowed !== false)
      .map(f => f.key);
  } else {
    form.fields = [];
  }
};

const resetForm = () => {
  form.fields = [];
  form.filters = {};
  form.dateRange = [];
  form.sortBy = '';
  form.sortOrder = 'desc';
  if (form.exportType) {
    handleTypeChange(form.exportType);
  }
};

const handleSubmit = async () => {
  if (!form.exportType) {
    ElMessage.warning('请选择导出类型');
    return;
  }
  if (form.fields.length === 0) {
    ElMessage.warning('请至少选择一个导出字段');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      exportType: form.exportType,
      fields: form.fields,
      filters: Object.keys(form.filters).length > 0 ? form.filters : null,
      dateRange: form.dateRange?.length === 2
        ? { start: form.dateRange[0], end: form.dateRange[1] }
        : null,
      sortBy: form.sortBy || null,
      sortOrder: form.sortOrder,
    };
    await createExportTask(payload);
    ElMessage.success('导出任务已创建，可在「导出历史」中查看进度');
    activeTab.value = 'history';
    fetchHistory();
  } finally {
    submitting.value = false;
  }
};

const fetchHistory = async () => {
  historyLoading.value = true;
  try {
    const params = { ...historyFilters };
    if (historyDateRange.value?.length === 2) {
      params.startDate = historyDateRange.value[0];
      params.endDate = historyDateRange.value[1];
    }
    const result = await getExportTasks(params);
    historyList.value = result.list || [];
    historyTotal.value = result.total || 0;
  } finally {
    historyLoading.value = false;
  }
};

const resetHistoryFilters = () => {
  historyFilters.page = 1;
  historyFilters.exportType = '';
  historyFilters.status = '';
  historyFilters.keyword = '';
  historyDateRange.value = [];
  fetchHistory();
};

const handleDownload = async (row) => {
  try {
    const blob = await downloadExportTask(row.id);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.fileName || `export_${row.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    ElMessage.success('开始下载');
    fetchHistory();
  } catch (e) {
    // Error handled by interceptor
  }
};

const handleRetry = async (row) => {
  try {
    await retryExportTask(row.id);
    ElMessage.success('已重新创建导出任务');
    fetchHistory();
  } catch (e) {
    // Error handled by interceptor
  }
};

const fetchExportConfigs = async () => {
  if (!authStore.isAdmin) return;
  try {
    exportConfigs.value = await getExportConfigs();
    if (exportConfigs.value.length > 0 && !configTab.value) {
      configTab.value = exportConfigs.value[0].exportType;
    }
  } catch (e) {
    console.error('Failed to fetch export configs:', e);
  }
};

const isAllAdminFieldsSelected = (cfg) => {
  return cfg.adminFields.length > 0 && cfg.adminFields.length === cfg.allFields.length;
};

const isAdminFieldsIndeterminate = (cfg) => {
  return cfg.adminFields.length > 0 && cfg.adminFields.length < cfg.allFields.length;
};

const handleAdminCheckAll = (cfg, val) => {
  if (val) {
    cfg.adminFields = cfg.allFields.map(f => f.key);
  } else {
    cfg.adminFields = [];
  }
};

const isAllUserFieldsSelected = (cfg) => {
  const nonAdmin = cfg.allFields.filter(f => !f.adminOnly);
  return cfg.userFields.length > 0 && cfg.userFields.length === nonAdmin.length;
};

const isUserFieldsIndeterminate = (cfg) => {
  const nonAdmin = cfg.allFields.filter(f => !f.adminOnly);
  return cfg.userFields.length > 0 && cfg.userFields.length < nonAdmin.length;
};

const handleUserCheckAll = (cfg, val) => {
  if (val) {
    cfg.userFields = cfg.allFields.filter(f => !f.adminOnly).map(f => f.key);
  } else {
    cfg.userFields = [];
  }
};

const handleSaveConfig = async (cfg) => {
  savingConfig.value = true;
  try {
    await updateExportConfig(cfg.exportType, {
      adminFields: cfg.adminFields,
      userFields: cfg.userFields,
    });
    ElMessage.success('配置已保存');
    fetchExportTypes();
  } finally {
    savingConfig.value = false;
  }
};

const getExportTypeLabel = (type) => {
  const t = exportTypes.value.find(x => x.type === type);
  return t?.label || type;
};

const getStatusLabel = (status) => {
  const map = {
    PENDING: '排队中',
    GENERATING: '生成中',
    COMPLETED: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
};

const getStatusTagType = (status) => {
  const map = {
    PENDING: 'info',
    GENERATING: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
  };
  return map[status] || 'info';
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

onMounted(() => {
  fetchExportTypes();
  fetchHistory();
  fetchExportConfigs();
});

watch(activeTab, (val) => {
  if (val === 'history') fetchHistory();
  if (val === 'config') fetchExportConfigs();
});

// Auto refresh history when on history tab
let refreshTimer = null;
watch(activeTab, (val) => {
  if (val === 'history') {
    refreshTimer = setInterval(() => {
      const hasInProgress = historyList.value.some(
        t => t.status === 'PENDING' || t.status === 'GENERATING'
      );
      if (hasInProgress) fetchHistory();
    }, 5000);
  } else {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }
}, { immediate: true });
</script>

<style scoped>
.data-export {
  padding: 12px 24px;
}

.page-header {
  margin-bottom: 24px;
  padding: 0 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.export-card {
  border-radius: 12px;
  border: none;
}

.create-section {
  padding: 10px 0;
}

.form-grid {
  margin-bottom: 16px;
}

.field-selector {
  background-color: #f8fafc;
  border-radius: 8px;
  padding: 16px;
}

.field-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.selected-count {
  font-size: 13px;
  color: #64748b;
}

.field-group {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 20px;
}

.field-item {
  margin-right: 0 !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.admin-tag {
  margin-left: 4px;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.mr-4 {
  margin-right: 4px;
}

.history-section {
  padding: 10px 0;
}

.filter-bar {
  margin-bottom: 16px;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.config-section {
  padding: 10px 0;
}

.config-content {
  padding: 20px 0;
}

.config-block {
  padding: 8px 0;
}

.config-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.config-block-header h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 20px;
  margin-top: 8px;
  border-top: 1px solid #f1f5f9;
}

:deep(.custom-tabs .el-tabs__item) {
  font-size: 16px;
  font-weight: 500;
  height: 50px;
  line-height: 50px;
}

:deep(.custom-tabs .el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: #f1f5f9;
}
</style>
