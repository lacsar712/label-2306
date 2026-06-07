<template>
  <div class="transactions-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">积分流水</h2>
        <p class="page-subtitle">查询所有积分变动记录，支持多维度筛选与导出</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download" @click="handleExport" :loading="exporting">
          导出 CSV
        </el-button>
        <el-button type="primary" :icon="Plus" @click="$router.push('/points')">
          积分调整
        </el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :model="filters" inline class="filter-form">
        <el-form-item label="会员姓名">
          <el-input v-model="filters.memberName" placeholder="请输入姓名" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="会员手机">
          <el-input v-model="filters.memberPhone" placeholder="请输入手机号" clearable style="width: 140px" />
        </el-form-item>
        <el-form-item label="流水号">
          <el-input v-model="filters.serialNo" placeholder="流水号" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="变动类型">
          <el-select v-model="filters.changeType" placeholder="全部" clearable style="width: 130px">
            <el-option label="增加" value="ADD" />
            <el-option label="扣减" value="DEDUCT" />
            <el-option label="冻结" value="FREEZE" />
            <el-option label="解冻" value="UNFREEZE" />
            <el-option label="过期清零" value="EXPIRE" />
            <el-option label="冲正" value="REVERSE" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因类型">
          <el-select v-model="filters.reasonType" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="item in reasonTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务单号">
          <el-input v-model="filters.bizOrderNo" placeholder="业务单号" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="发生时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="24" class="stats-row">
      <el-col :span="16">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                {{ trendMemberFilter ? `${trendMemberFilter} - ` : '' }}积分变动趋势 (近30天)
              </span>
              <el-select
                v-model="trendMemberId"
                placeholder="选择会员查看趋势"
                clearable
                filterable
                size="small"
                style="width: 220px"
                @change="fetchTrend"
              >
                <el-option
                  v-for="m in memberList"
                  :key="m.id"
                  :label="`${m.name} (${m.phone})`"
                  :value="m.id"
                />
              </el-select>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">原因类型占比</span>
            </div>
          </template>
          <div ref="reasonChartRef" class="chart-container reason-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="table-card" shadow="never">
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="serialNo" label="流水号" width="210">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDetail(row)">
              {{ row.serialNo }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="会员" width="170">
          <template #default="{ row }">
            <div class="member-cell">
              <span class="member-name">{{ row.member?.name }}</span>
              <span class="member-phone">{{ row.member?.phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="变动类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getChangeTypeTag(row.changeType)" size="small">
              {{ getChangeTypeLabel(row.changeType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动值" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.changeValue > 0 ? 'value-add' : 'value-deduct'">
              {{ row.changeValue > 0 ? '+' : '' }}{{ row.changeValue }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="变动前" width="90" align="right">
          <template #default="{ row }">{{ row.balanceBefore }}</template>
        </el-table-column>
        <el-table-column label="变动后" width="90" align="right">
          <template #default="{ row }">{{ row.balanceAfter }}</template>
        </el-table-column>
        <el-table-column label="原因类型" width="120">
          <template #default="{ row }">{{ getReasonTypeLabel(row.reasonType) }}</template>
        </el-table-column>
        <el-table-column label="业务单号" width="150">
          <template #default="{ row }">
            <span class="biz-no" v-if="row.bizOrderNo">{{ row.bizOrderNo }}</span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="110">
          <template #default="{ row }">
            <span v-if="row.operator">{{ row.operator.username }}</span>
            <span v-else class="muted">系统</span>
          </template>
        </el-table-column>
        <el-table-column label="发生时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleDetail(row)">详情</el-button>
            <el-button
              v-if="authStore.isAdmin && row.changeType !== 'REVERSE' && !row.reverseOf"
              type="danger"
              link
              size="small"
              @click="handleReverse(row)"
            >冲正</el-button>
            <el-tag v-if="row.reverseOf" type="warning" size="small" effect="light">已冲正</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="流水详情" width="620px" destroy-on-close>
      <el-descriptions v-if="detailData" :column="2" border>
        <el-descriptions-item label="流水号" :span="2">
          <span class="mono">{{ detailData.serialNo }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="会员姓名">{{ detailData.member?.name }}</el-descriptions-item>
        <el-descriptions-item label="会员手机号">{{ detailData.member?.phone }}</el-descriptions-item>
        <el-descriptions-item label="会员等级">{{ getLevelLabel(detailData.member?.level) }}</el-descriptions-item>
        <el-descriptions-item label="当前可用积分">{{ detailData.member?.points }}</el-descriptions-item>
        <el-descriptions-item label="变动类型">
          <el-tag :type="getChangeTypeTag(detailData.changeType)" size="small">
            {{ getChangeTypeLabel(detailData.changeType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="变动值">
          <span :class="detailData.changeValue > 0 ? 'value-add' : 'value-deduct'" style="font-weight:600">
            {{ detailData.changeValue > 0 ? '+' : '' }}{{ detailData.changeValue }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="变动前余额">{{ detailData.balanceBefore }}</el-descriptions-item>
        <el-descriptions-item label="变动后余额">{{ detailData.balanceAfter }}</el-descriptions-item>
        <el-descriptions-item label="原因类型">{{ getReasonTypeLabel(detailData.reasonType) }}</el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ detailData.operator ? `${detailData.operator.username} (${detailData.operator.role})` : '系统' }}
        </el-descriptions-item>
        <el-descriptions-item label="关联业务单号" :span="2">
          <span v-if="detailData.bizOrderNo" class="mono">{{ detailData.bizOrderNo }} ({{ detailData.bizOrderType || '-' }})</span>
          <span v-else class="muted">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="发生时间" :span="2">
          {{ formatDate(detailData.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ detailData.remark || '-' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="detailData.reverseOf" label="被冲正流水" :span="2">
          <el-button type="primary" link @click="handleDetailById(detailData.reverseOf.id)">
            {{ detailData.reverseOf.serialNo }}
            ({{ getChangeTypeLabel(detailData.reverseOf.changeType) }}
            {{ detailData.reverseOf.changeValue > 0 ? '+' : '' }}{{ detailData.reverseOf.changeValue }})
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item v-if="detailData.reversedBy && detailData.reversedBy.length > 0" label="冲正流水" :span="2">
          <el-button v-for="r in detailData.reversedBy" :key="r.id" type="primary" link @click="handleDetailById(r.id)">
            {{ r.serialNo }}
          </el-button>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button
          v-if="authStore.isAdmin && detailData && detailData.changeType !== 'REVERSE' && !(detailData.reversedBy && detailData.reversedBy.length > 0)"
          type="danger"
          @click="handleReverse(detailData)"
        >
          冲正此流水
        </el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Refresh, Download, Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const exporting = ref(false);
const detailVisible = ref(false);
const detailData = ref(null);
const trendChartRef = ref(null);
const reasonChartRef = ref(null);
const memberList = ref([]);
const trendMemberId = ref(null);
const trendMemberFilter = ref('');
let trendChartInstance = null;
let reasonChartInstance = null;

const dateRange = ref([]);

const filters = reactive({
  memberName: '',
  memberPhone: '',
  serialNo: '',
  changeType: '',
  reasonType: '',
  bizOrderNo: '',
  memberId: null,
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const tableData = ref([]);

const reasonTypeOptions = [
  { label: '人工调整', value: 'MANUAL_ADJUST' },
  { label: '签到奖励', value: 'SIGN_IN_REWARD' },
  { label: '活动加成', value: 'ACTIVITY_BONUS' },
  { label: '消费获取', value: 'ORDER_EARN' },
  { label: '商城兑换', value: 'MALL_EXCHANGE' },
  { label: '过期清零', value: 'EXPIRE_CLEAR' },
  { label: '冻结操作', value: 'FREEZE_OP' },
  { label: '解冻操作', value: 'UNFREEZE_OP' },
  { label: '冲正操作', value: 'REVERSE_OP' },
  { label: '注册奖励', value: 'REGISTER_REWARD' },
  { label: '其他', value: 'OTHER' },
];

const getChangeTypeLabel = (t) => {
  const map = { ADD: '增加', DEDUCT: '扣减', FREEZE: '冻结', UNFREEZE: '解冻', EXPIRE: '过期清零', REVERSE: '冲正' };
  return map[t] || t;
};

const getChangeTypeTag = (t) => {
  const map = { ADD: 'success', DEDUCT: 'danger', FREEZE: 'warning', UNFREEZE: 'info', EXPIRE: 'info', REVERSE: 'warning' };
  return map[t] || '';
};

const getReasonTypeLabel = (t) => {
  const opt = reasonTypeOptions.find((o) => o.value === t);
  return opt ? opt.label : t;
};

const getLevelLabel = (l) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[l] || l;
};

const formatDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-');

const buildQueryParams = () => {
  const params = {
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
  if (filters.memberName) params.memberName = filters.memberName;
  if (filters.memberPhone) params.memberPhone = filters.memberPhone;
  if (filters.serialNo) params.serialNo = filters.serialNo;
  if (filters.changeType) params.changeType = filters.changeType;
  if (filters.reasonType) params.reasonType = filters.reasonType;
  if (filters.bizOrderNo) params.bizOrderNo = filters.bizOrderNo;
  if (filters.memberId) params.memberId = filters.memberId;
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dateRange.value[0];
    params.endDate = dateRange.value[1];
  }
  return params;
};

const fetchList = async () => {
  loading.value = true;
  try {
    const params = buildQueryParams();
    const res = await api.get('/transactions', { params });
    tableData.value = res.list;
    pagination.total = res.total;
    pagination.page = res.page;
    pagination.pageSize = res.pageSize;
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  fetchList();
  fetchReasonStats();
};

const handleReset = () => {
  filters.memberName = '';
  filters.memberPhone = '';
  filters.serialNo = '';
  filters.changeType = '';
  filters.reasonType = '';
  filters.bizOrderNo = '';
  filters.memberId = null;
  dateRange.value = [];
  pagination.page = 1;
  fetchList();
  fetchReasonStats();
};

const handleExport = async () => {
  exporting.value = true;
  try {
    const params = buildQueryParams();
    const blob = await api.get('/transactions/export/csv', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `points_transactions_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    ElMessage.success('导出成功');
  } finally {
    exporting.value = false;
  }
};

const handleDetail = async (row) => {
  try {
    detailData.value = await api.get(`/transactions/${row.id}`);
    detailVisible.value = true;
  } catch (e) {
    ElMessage.error('获取详情失败');
  }
};

const handleDetailById = async (id) => {
  try {
    detailData.value = await api.get(`/transactions/${id}`);
  } catch (e) {
    ElMessage.error('获取详情失败');
  }
};

const handleReverse = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要冲正流水 ${row.serialNo} 吗？冲正将生成反向流水并调整会员积分，此操作不可撤销。`,
      '冲正确认',
      { type: 'warning', confirmButtonText: '确认冲正', cancelButtonText: '取消' }
    );
    const { value: remark } = await ElMessageBox.prompt('请输入冲正备注（可选）', '冲正备注', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '冲正原因',
      inputType: 'textarea',
      inputValidator: (v) => true,
    });
    await api.post(`/transactions/${row.id}/reverse`, { remark: remark || null });
    ElMessage.success('冲正成功');
    detailVisible.value = false;
    fetchList();
    fetchTrend();
    fetchReasonStats();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e?.response?.data?.error || '冲正失败');
    }
  }
};

const fetchTrend = async () => {
  if (!trendChartInstance) return;
  try {
    if (trendMemberId.value) {
      const m = memberList.value.find((x) => x.id === trendMemberId.value);
      trendMemberFilter.value = m ? `${m.name} (${m.phone})` : '';
      const data = await api.get(`/transactions/stats/member/${trendMemberId.value}/trend`, { params: { days: 30 } });
      renderTrendChart(data);
    } else {
      trendMemberFilter.value = '';
      renderTrendChart([]);
    }
  } catch (e) {
    console.error('fetch trend error', e);
  }
};

const renderTrendChart = (data) => {
  if (!trendChartInstance) return;
  const dates = data.map((d) => d.date);
  const addData = data.map((d) => d.add);
  const deductData = data.map((d) => d.deduct);
  const netData = data.map((d) => d.net);
  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['增加积分', '扣减积分', '净变动'], bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value' },
    series: [
      {
        name: '增加积分',
        type: 'line',
        smooth: true,
        data: addData,
        itemStyle: { color: '#22c55e' },
        areaStyle: { color: 'rgba(34,197,94,0.1)' },
      },
      {
        name: '扣减积分',
        type: 'line',
        smooth: true,
        data: deductData,
        itemStyle: { color: '#ef4444' },
        areaStyle: { color: 'rgba(239,68,68,0.1)' },
      },
      {
        name: '净变动',
        type: 'line',
        smooth: true,
        data: netData,
        itemStyle: { color: '#6366f1' },
        lineStyle: { type: 'dashed' },
      },
    ],
  });
};

const fetchReasonStats = async () => {
  if (!reasonChartInstance) return;
  try {
    const params = {};
    if (trendMemberId.value) params.memberId = trendMemberId.value;
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0];
      params.endDate = dateRange.value[1];
    }
    const data = await api.get('/transactions/stats/reason', { params });
    renderReasonChart(data);
  } catch (e) {
    console.error('fetch reason stats error', e);
  }
};

const renderReasonChart = (data) => {
  if (!reasonChartInstance) return;
  const pieData = data.map((d) => ({
    name: getReasonTypeLabel(d.reasonType),
    value: d.count,
  }));
  reasonChartInstance.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: pieData,
      },
    ],
  });
};

const fetchMembers = async () => {
  try {
    memberList.value = await api.get('/members');
  } catch (e) {
    console.error('fetch members error', e);
  }
};

const initCharts = async () => {
  await nextTick();
  if (trendChartRef.value && !trendChartInstance) {
    trendChartInstance = echarts.init(trendChartRef.value);
  }
  if (reasonChartRef.value && !reasonChartInstance) {
    reasonChartInstance = echarts.init(reasonChartRef.value);
  }
  window.addEventListener('resize', () => {
    trendChartInstance && trendChartInstance.resize();
    reasonChartInstance && reasonChartInstance.resize();
  });
};

watch(
  () => dateRange.value,
  () => {
    fetchReasonStats();
  }
);

onMounted(async () => {
  await initCharts();
  await fetchMembers();
  fetchList();
  fetchTrend();
  fetchReasonStats();
});
</script>

<style scoped>
.transactions-page {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 12px;
  margin-right: 8px;
}

.stats-row {
  margin-bottom: 20px;
}

.chart-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.chart-container {
  width: 100%;
  height: 280px;
}

.reason-chart {
  height: 280px;
}

.table-card {
  border-radius: 12px;
  border: none;
}

.member-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.member-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
}

.member-phone {
  font-size: 12px;
  color: #94a3b8;
}

.value-add {
  color: #22c55e;
  font-weight: 600;
}

.value-deduct {
  color: #ef4444;
  font-weight: 600;
}

.muted {
  color: #cbd5e1;
}

.mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
}

.biz-no {
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 12px;
  color: #475569;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
