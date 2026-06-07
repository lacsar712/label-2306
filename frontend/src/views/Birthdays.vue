<template>
  <div class="birthday-management">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">生日关怀管理</h2>
        <p class="page-subtitle">管理会员生日信息，执行生日关怀活动</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="$router.push('/birthdays/config')">
          <el-icon class="mr-4"><Setting /></el-icon>关怀配置
        </el-button>
        <el-button type="success" @click="showExecuteDialog = true" :disabled="selectedMembers.length === 0">
          <el-icon class="mr-4"><Present /></el-icon>执行关怀 ({{ selectedMembers.length }})
        </el-button>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="16">
        <el-card class="calendar-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">月历视图</span>
              <div class="calendar-nav">
                <el-select v-model="filterLevel" placeholder="会员等级" clearable @change="refreshCalendar" class="mr-12" style="width: 120px">
                  <el-option label="普通会员" value="NORMAL" />
                  <el-option label="白银会员" value="SILVER" />
                  <el-option label="黄金会员" value="GOLD" />
                  <el-option label="铂金会员" value="PLATINUM" />
                </el-select>
                <el-button-group>
                  <el-button @click="prevMonth">
                    <el-icon><ArrowLeft /></el-icon>
                  </el-button>
                  <span class="current-month">{{ currentYear }}年{{ currentMonth }}月</span>
                  <el-button @click="nextMonth">
                    <el-icon><ArrowRight /></el-icon>
                  </el-button>
                </el-button-group>
              </div>
            </div>
          </template>
          <div class="calendar-grid">
            <div class="calendar-weekday" v-for="day in ['一', '二', '三', '四', '五', '六', '日']" :key="day">
              {{ day }}
            </div>
            <div
              v-for="(day, idx) in calendarDays"
              :key="idx"
              class="calendar-day"
              :class="{
                'other-month': !day.isCurrentMonth,
                'today': day.isToday,
                'has-birthday': day.members && day.members.length > 0,
              }"
              @click="day.members && day.members.length > 0 && selectDayMembers(day)"
            >
              <span class="day-number">{{ day.date }}</span>
              <div v-if="day.members && day.members.length > 0" class="day-birthday-info">
                <span class="birthday-count">{{ day.members.length }}人</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="records-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">关怀执行记录</span>
              <el-button link type="primary" @click="loadCareRecords">刷新</el-button>
            </div>
          </template>
          <div class="records-list" v-loading="birthdayStore.loading">
            <div v-for="record in birthdayStore.careRecords.slice(0, 10)" :key="record.id" class="record-item">
              <div class="record-header">
                <span class="record-name">{{ record.member?.name }}</span>
                <el-tag size="small" :type="getResultTagType(record.result)" effect="light">
                  {{ getResultLabel(record.result) }}
                </el-tag>
              </div>
              <div class="record-meta">
                <span>{{ record.birthdayYear }}年 · {{ getChannelLabel(record.channel) }}</span>
                <span v-if="record.pointsGiven > 0" class="points-given">+{{ record.pointsGiven }}积分</span>
              </div>
              <div class="record-time">{{ formatTime(record.createdAt) }}</div>
            </div>
            <el-empty v-if="birthdayStore.careRecords.length === 0" description="暂无记录" :image-size="80" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="list-card mt-24" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="tabs-wrapper">
            <el-radio-group v-model="activeScope" size="large" @change="handleScopeChange">
              <el-radio-button label="TODAY">今日 ({{ stats.today?.count || 0 }})</el-radio-button>
              <el-radio-button label="THIS_WEEK">本周 ({{ stats.thisWeek?.count || 0 }})</el-radio-button>
              <el-radio-button label="THIS_MONTH">本月 ({{ stats.thisMonth?.count || 0 }})</el-radio-button>
              <el-radio-button label="NEXT_MONTH">下月</el-radio-button>
            </el-radio-group>
          </div>
          <div class="list-actions">
            <el-button
              type="primary"
              @click="executeScopeCare"
              :disabled="!birthdayStore.members || birthdayStore.members.length === 0"
            >
              批量关怀当前列表
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        ref="tableRef"
        v-loading="birthdayStore.loading"
        :data="birthdayStore.members"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="phone" label="手机号" min-width="120" />
        <el-table-column prop="level" label="等级" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)">{{ getLevelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生日" min-width="120">
          <template #default="{ row }">
            {{ formatBirthday(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="age" label="年龄" width="80">
          <template #default="{ row }">
            {{ row.age !== null && row.age !== undefined ? row.age + '岁' : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="日历类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.calendarType === 'LUNAR' ? 'warning' : 'info'" effect="plain">
              {{ row.calendarType === 'LUNAR' ? '农历' : '公历' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关怀状态" min-width="120">
          <template #default="{ row }">
            <el-tag v-if="row.hasCaredThisYear" type="success" effect="light">
              已关怀
            </el-tag>
            <el-tag v-else type="info" effect="plain">
              待关怀
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="历史关怀" min-width="200">
          <template #default="{ row }">
            <div v-if="row.lastCareRecord" class="last-care">
              <span>{{ getChannelLabel(row.lastCareRecord.channel) }}</span>
              <span v-if="row.lastCareRecord.pointsGiven > 0">· +{{ row.lastCareRecord.pointsGiven }}积分</span>
              <span class="care-time">{{ formatTime(row.lastCareRecord.createdAt) }}</span>
            </div>
            <span v-else class="text-gray">暂无记录</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewCareHistory(row)">关怀记录</el-button>
            <el-button type="success" link size="small" @click="executeSingleCare(row)" :disabled="row.hasCaredThisYear">
              执行关怀
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showExecuteDialog" title="执行生日关怀" width="520px">
      <el-form :model="executeForm" label-width="100px">
        <el-form-item label="发送渠道">
          <el-select v-model="executeForm.channel" style="width: 100%">
            <el-option label="短信" value="SMS" />
            <el-option label="微信" value="WECHAT" />
            <el-option label="邮件" value="EMAIL" />
            <el-option label="站内信" value="IN_APP" />
            <el-option label="人工" value="MANUAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="发送祝福">
          <el-switch v-model="executeForm.sendWish" />
        </el-form-item>
        <el-form-item label="赠送积分">
          <el-switch v-model="executeForm.givePoints" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="executeForm.remark" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExecuteDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmExecuteCare" :loading="executing">确认执行</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHistoryDialog" title="关怀历史记录" width="640px">
      <el-table :data="birthdayStore.memberCareHistory" style="width: 100%">
        <el-table-column prop="birthdayYear" label="年份" width="100" />
        <el-table-column label="渠道" width="100">
          <template #default="{ row }">
            {{ getChannelLabel(row.channel) }}
          </template>
        </el-table-column>
        <el-table-column prop="pointsGiven" label="赠送积分" width="100">
          <template #default="{ row }">
            <span v-if="row.pointsGiven > 0">+{{ row.pointsGiven }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getResultTagType(row.result)">
              {{ getResultLabel(row.result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator?.username" label="操作人" width="100" />
        <el-table-column prop="createdAt" label="执行时间">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useBirthdayStore } from '../stores/birthday';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import { Setting, Present, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';

const birthdayStore = useBirthdayStore();

const activeScope = ref('TODAY');
const selectedMembers = ref([]);
const showExecuteDialog = ref(false);
const showHistoryDialog = ref(false);
const executing = ref(false);
const filterLevel = ref('');
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth() + 1);

const stats = computed(() => birthdayStore.dashboardStats || {});

const executeForm = reactive({
  channel: 'SMS',
  sendWish: true,
  givePoints: true,
  remark: '',
});

const calendarDays = computed(() => {
  const days = [];
  const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1);
  const lastDay = new Date(currentYear.value, currentMonth.value, 0);
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value - 1, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    days.push({
      date: prevMonthLastDay - i,
      isCurrentMonth: false,
      isToday: false,
      members: [],
    });
  }
  
  const today = new Date();
  const isCurrentMonthView = today.getFullYear() === currentYear.value && today.getMonth() + 1 === currentMonth.value;
  
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const calendarData = birthdayStore.calendar || {};
    days.push({
      date: d,
      isCurrentMonth: true,
      isToday: isCurrentMonthView && today.getDate() === d,
      members: calendarData[d] || [],
    });
  }
  
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: d,
      isCurrentMonth: false,
      isToday: false,
      members: [],
    });
  }
  
  return days;
});

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelTagType = (level) => {
  const map = { NORMAL: 'info', SILVER: '', GOLD: 'warning', PLATINUM: 'danger' };
  return map[level] || 'info';
};

const getChannelLabel = (channel) => {
  const map = { SMS: '短信', WECHAT: '微信', EMAIL: '邮件', IN_APP: '站内信', MANUAL: '人工' };
  return map[channel] || channel;
};

const getResultLabel = (result) => {
  const map = { SUCCESS: '成功', FAILED: '失败', PARTIAL: '部分成功', SKIPPED: '跳过' };
  return map[result] || result;
};

const getResultTagType = (result) => {
  const map = { SUCCESS: 'success', FAILED: 'danger', PARTIAL: 'warning', SKIPPED: 'info' };
  return map[result] || 'info';
};

const formatTime = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

const formatBirthday = (row) => {
  if (!row.birthdayMonth || !row.birthdayDay) return '-';
  return `${row.birthdayMonth}月${row.birthdayDay}日`;
};

const handleScopeChange = async () => {
  await birthdayStore.fetchBirthdayMembers({ scope: activeScope.value, level: filterLevel.value });
};

const handleSelectionChange = (selection) => {
  selectedMembers.value = selection;
};

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  refreshCalendar();
};

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  refreshCalendar();
};

const refreshCalendar = async () => {
  await birthdayStore.fetchCalendar(currentYear.value, currentMonth.value, filterLevel.value);
};

const selectDayMembers = (day) => {
  if (day.members && day.members.length > 0) {
    selectedMembers.value = day.members;
    ElMessage.info(`已选择 ${day.members.length} 位生日会员`);
  }
};

const viewCareHistory = async (row) => {
  await birthdayStore.fetchMemberCareHistory(row.id);
  showHistoryDialog.value = true;
};

const executeSingleCare = async (row) => {
  try {
    await ElMessageBox.confirm(`确定对会员「${row.name}」执行生日关怀？`, '确认', {
      type: 'warning',
    });
    executing.value = true;
    const result = await birthdayStore.executeCare({
      memberIds: [row.id],
      ...executeForm,
    });
    if (result.success > 0) {
      ElMessage.success('关怀执行成功');
    } else if (result.skipped > 0) {
      ElMessage.info('已跳过（本年度已关怀过）');
    } else {
      ElMessage.error('关怀执行失败');
    }
    await refreshData();
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  } finally {
    executing.value = false;
  }
};

const executeScopeCare = async () => {
  try {
    await ElMessageBox.confirm(`确定对当前列表的所有会员执行生日关怀？`, '确认', {
      type: 'warning',
    });
    executing.value = true;
    const memberIds = birthdayStore.members.map((m) => m.id);
    const result = await birthdayStore.executeCare({
      memberIds,
      ...executeForm,
    });
    ElMessage.success(`执行完成：成功${result.success}人，失败${result.failed}人，跳过${result.skipped}人`);
    await refreshData();
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  } finally {
    executing.value = false;
  }
};

const confirmExecuteCare = async () => {
  try {
    executing.value = true;
    const memberIds = selectedMembers.value.map((m) => m.id);
    const result = await birthdayStore.executeCare({
      memberIds,
      ...executeForm,
    });
    ElMessage.success(`执行完成：成功${result.success}人，失败${result.failed}人，跳过${result.skipped}人`);
    showExecuteDialog.value = false;
    selectedMembers.value = [];
    await refreshData();
  } catch (e) {
    ElMessage.error(e.message || '执行失败');
  } finally {
    executing.value = false;
  }
};

const refreshData = async () => {
  await Promise.all([
    birthdayStore.fetchBirthdayMembers({ scope: activeScope.value, level: filterLevel.value }),
    birthdayStore.fetchDashboardStats(),
    birthdayStore.fetchCareRecords(),
    refreshCalendar(),
  ]);
};

watch([currentYear, currentMonth, filterLevel], () => {
  refreshCalendar();
});

onMounted(() => {
  refreshData();
});
</script>

<style scoped>
.birthday-management {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.mr-4 {
  margin-right: 4px;
}

.mr-12 {
  margin-right: 12px;
}

.mt-24 {
  margin-top: 24px;
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

.calendar-card, .records-card, .list-card {
  border-radius: 12px;
  border: none;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-month {
  padding: 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  min-width: 120px;
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-weekday {
  text-align: center;
  padding: 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  background-color: #f8fafc;
  border-radius: 8px;
}

.calendar-day {
  aspect-ratio: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  position: relative;
}

.calendar-day:hover {
  border-color: #4f46e5;
  background-color: #f5f3ff;
}

.calendar-day.other-month {
  opacity: 0.3;
  cursor: default;
}

.calendar-day.other-month:hover {
  border-color: #e2e8f0;
  background-color: transparent;
}

.calendar-day.today {
  border-color: #4f46e5;
  background-color: #eef2ff;
}

.calendar-day.has-birthday {
  background-color: #fef3c7;
  border-color: #f59e0b;
}

.calendar-day.has-birthday:hover {
  background-color: #fde68a;
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.day-birthday-info {
  margin-top: auto;
}

.birthday-count {
  font-size: 11px;
  color: #b45309;
  font-weight: 600;
  background-color: rgba(245, 158, 11, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.records-list {
  max-height: 520px;
  overflow-y: auto;
}

.record-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background-color: #f8fafc;
  transition: background-color 0.2s;
}

.record-item:hover {
  background-color: #f1f5f9;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.record-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.record-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.points-given {
  color: #22c55e;
  font-weight: 600;
}

.record-time {
  font-size: 11px;
  color: #94a3b8;
}

.tabs-wrapper {
  flex: 1;
}

.list-actions {
  display: flex;
  gap: 8px;
}

.last-care {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #475569;
  gap: 2px;
}

.care-time {
  color: #94a3b8;
  font-size: 11px;
}

.text-gray {
  color: #94a3b8;
  font-size: 12px;
}
</style>
