<template>
  <div class="dashboard">
    <el-row :gutter="24">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总会员数</span>
              <span class="stat-value">{{ stats.total }}</span>
            </div>
            <div class="stat-icon blue">
              <el-icon><User /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">活跃会员</span>
              <span class="stat-value">{{ stats.active }}</span>
            </div>
            <div class="stat-icon green">
              <el-icon><CircleCheck /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总积分</span>
              <span class="stat-value">{{ stats.totalPoints }}</span>
            </div>
            <div class="stat-icon purple">
              <el-icon><Star /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card birthday-stat" shadow="hover" @click="$router.push('/birthdays')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">今日生日</span>
              <span class="stat-value birthday-value">{{ birthdayStats.today?.count || 0 }}</span>
            </div>
            <div class="stat-icon pink">
              <el-icon><Cherry /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="8">
        <el-card class="chart-card birthday-reminder-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon class="title-icon pink"><Bell /></el-icon>
                生日提醒
              </span>
              <el-button link type="primary" @click="$router.push('/birthdays')">查看全部</el-button>
            </div>
          </template>
          <div class="birthday-reminder-content">
            <div class="reminder-section">
              <div class="reminder-header today">
                <el-icon><Sunny /></el-icon>
                <span>今日生日 ({{ birthdayStats.today?.count || 0 }}人)</span>
              </div>
              <div class="reminder-list">
                <div v-for="member in birthdayStats.today?.members || []" :key="member.id" class="reminder-item">
                  <div class="member-info">
                    <span class="member-name">{{ member.name }}</span>
                    <el-tag size="small" :type="getLevelTagType(member.level)" effect="plain">
                      {{ getLevelLabel(member.level) }}
                    </el-tag>
                  </div>
                  <span class="member-phone">{{ member.phone }}</span>
                </div>
                <el-empty v-if="!birthdayStats.today?.members || birthdayStats.today.members.length === 0" description="今日暂无生日会员" :image-size="60" />
              </div>
            </div>

            <div class="reminder-section" v-if="birthdayStats.upcoming && birthdayStats.upcoming.count > 0">
              <div class="reminder-header upcoming">
                <el-icon><Warning /></el-icon>
                <span>未来{{ birthdayStats.upcoming.remindDaysBefore }}天内 ({{ birthdayStats.upcoming.count }}人)</span>
              </div>
              <div class="reminder-list">
                <div v-for="member in birthdayStats.upcoming?.members || []" :key="member.id" class="reminder-item">
                  <div class="member-info">
                    <span class="member-name">{{ member.name }}</span>
                    <span class="birthday-date">{{ member.birthdayMonth }}月{{ member.birthdayDay }}日</span>
                  </div>
                  <el-tag size="small" :type="getLevelTagType(member.level)" effect="plain">
                    {{ getLevelLabel(member.level) }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon class="title-icon blue"><DataAnalysis /></el-icon>
                等级分布
              </span>
            </div>
          </template>
          <div class="level-dist">
            <div v-for="item in stats.levelStats" :key="item.level" class="level-bar-item">
              <div class="level-info">
                <span class="level-name">{{ getLevelLabel(item.level) }}</span>
                <span class="level-count">{{ item._count }} 人</span>
              </div>
              <el-progress 
                :percentage="stats.total > 0 ? (item._count / stats.total) * 100 : 0" 
                :stroke-width="12"
                :color="getLevelColor(item.level)"
                :show-text="false"
              />
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon class="title-icon orange"><Present /></el-icon>
                本月关怀进度
              </span>
              <el-button link type="primary" @click="$router.push('/birthdays')">去执行</el-button>
            </div>
          </template>
          <div class="care-progress">
            <div class="progress-stats">
              <div class="progress-item">
                <span class="progress-label">本月生日会员</span>
                <span class="progress-value big">{{ birthdayStats.thisMonth?.count || 0 }}</span>
              </div>
              <div class="progress-item">
                <span class="progress-label">已关怀</span>
                <span class="progress-value success">{{ birthdayStats.thisMonth?.caredCount || 0 }}</span>
              </div>
              <div class="progress-item">
                <span class="progress-label">完成率</span>
                <span class="progress-value">{{ birthdayStats.thisMonth?.completionRate || 0 }}%</span>
              </div>
            </div>
            <el-progress 
              :percentage="birthdayStats.thisMonth?.completionRate || 0" 
              :stroke-width="20"
              color="#4f46e5"
            />
            <div class="progress-tip">
              <el-icon><InfoFilled /></el-icon>
              本周生日会员：{{ birthdayStats.thisWeek?.count || 0 }} 人
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="16">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <el-icon class="title-icon purple"><Histogram /></el-icon>
                全年生日分布热力图
              </span>
            </div>
          </template>
          <div ref="heatmapChartRef" class="heatmap-chart"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="action-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">快捷操作</span>
            </div>
          </template>
          <div class="quick-actions">
            <div class="action-grid">
              <el-button type="primary" class="action-btn" @click="$router.push('/members')">
                管理会员
              </el-button>
              <el-button type="warning" class="action-btn" @click="$router.push('/points')">
                会员积分
              </el-button>
              <el-button type="success" class="action-btn" @click="$router.push('/transactions')">
                积分流水
              </el-button>
              <el-button type="danger" class="action-btn" @click="$router.push('/birthdays')">
                生日关怀
              </el-button>
            </div>
            <div class="tip-box">
              <h4 class="tip-title">💡 提示</h4>
              <p class="tip-content">黄金及以上等级会员本月活跃度提升了 15%。建议开展针对性营销活动。</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, computed, ref, nextTick, onUnmounted } from 'vue';
import { useMemberStore } from '../stores/member';
import { useBirthdayStore } from '../stores/birthday';
import { User, CircleCheck, Star, Cherry, DataAnalysis, Bell, Sunny, Warning, Present, InfoFilled, Histogram } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';

const memberStore = useMemberStore();
const birthdayStore = useBirthdayStore();
const stats = computed(() => memberStore.stats);
const birthdayStats = computed(() => birthdayStore.dashboardStats || {});

const heatmapChartRef = ref(null);
let heatmapChart = null;

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelTagType = (level) => {
  const map = { NORMAL: 'info', SILVER: '', GOLD: 'warning', PLATINUM: 'danger' };
  return map[level] || 'info';
};

const getLevelColor = (level) => {
  const map = { NORMAL: '#94a3b8', SILVER: '#60a5fa', GOLD: '#f59e0b', PLATINUM: '#8b5cf6' };
  return map[level] || '#94a3b8';
};

const initHeatmapChart = () => {
  if (!heatmapChartRef.value) return;
  
  heatmapChart = echarts.init(heatmapChartRef.value);
  
  const heatmapData = birthdayStats.value.heatmap || {};
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const values = [];
  for (let i = 1; i <= 12; i++) {
    values.push(heatmapData[i] || 0);
  }
  const maxValue = Math.max(...values, 1);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        const data = params[0];
        return `${data.name}<br/>生日会员：<strong>${data.value}</strong> 人`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#64748b', fontSize: 12 }
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, idx) => ({
          value: v,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#818cf8' },
              { offset: 1, color: '#c7d2fe' }
            ])
          }
        })),
        barWidth: '60%',
        label: {
          show: true,
          position: 'top',
          color: '#475569',
          fontSize: 12,
          fontWeight: 600
        }
      }
    ]
  };

  heatmapChart.setOption(option);
};

const handleResize = () => {
  heatmapChart?.resize();
};

onMounted(async () => {
  memberStore.fetchStats();
  await birthdayStore.fetchDashboardStats();
  await nextTick();
  initHeatmapChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  heatmapChart?.dispose();
});
</script>

<style scoped>
.dashboard {
  padding: 12px 24px;
}

.stat-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.birthday-value {
  color: #ec4899;
}

.birthday-stat {
  cursor: pointer;
}

.birthday-stat:hover {
  background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
}

.stat-icon.blue { background-color: #eff6ff; color: #3b82f6; }
.stat-icon.green { background-color: #f0fdf4; color: #22c55e; }
.stat-icon.purple { background-color: #faf5ff; color: #a855f7; }
.stat-icon.orange { background-color: #fff7ed; color: #f97316; }
.stat-icon.pink { background-color: #fdf2f8; color: #ec4899; }

.mt-24 { margin-top: 24px; }

.chart-card, .action-card, .birthday-reminder-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.title-icon.blue { color: #3b82f6; }
.title-icon.purple { color: #8b5cf6; }
.title-icon.orange { color: #f97316; }
.title-icon.pink { color: #ec4899; }

.level-dist {
  padding: 8px 0;
}

.level-bar-item {
  margin-bottom: 20px;
}

.level-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.level-name {
  font-size: 14px;
  color: #475569;
}

.level-count {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.birthday-reminder-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.reminder-section {
  border-radius: 8px;
  overflow: hidden;
}

.reminder-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  margin-bottom: 10px;
}

.reminder-header.today {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.reminder-header.upcoming {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.reminder-list {
  max-height: 180px;
  overflow-y: auto;
}

.reminder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.reminder-item:hover {
  background-color: #f8fafc;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.member-phone {
  font-size: 12px;
  color: #94a3b8;
}

.birthday-date {
  font-size: 12px;
  color: #64748b;
}

.care-progress {
  padding: 8px 0;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.progress-label {
  font-size: 12px;
  color: #64748b;
}

.progress-value {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.progress-value.big {
  font-size: 28px;
  color: #4f46e5;
}

.progress-value.success {
  color: #22c55e;
}

.progress-tip {
  margin-top: 16px;
  padding: 12px;
  background-color: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
}

.heatmap-chart {
  height: 280px;
  width: 100%;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 4px;
}

.action-btn {
  height: 40px;
  border-radius: 8px;
  margin: 0 !important;
}

.tip-box {
  margin-top: 20px;
  padding: 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.tip-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #1e293b;
}

.tip-content {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}
</style>
