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
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">系统运行状态</span>
              <span class="stat-value">正常</span>
            </div>
            <div class="stat-icon orange">
              <el-icon><Connection /></el-icon>
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
              <span class="card-title">等级分布</span>
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
import { onMounted, computed } from 'vue';
import { useMemberStore } from '../stores/member';
import { User, CircleCheck, Star, Connection } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const memberStore = useMemberStore();
const stats = computed(() => memberStore.stats);

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelColor = (level) => {
  const map = { NORMAL: '#94a3b8', SILVER: '#60a5fa', GOLD: '#f59e0b', PLATINUM: '#8b5cf6' };
  return map[level] || '#94a3b8';
};

onMounted(() => {
  memberStore.fetchStats();
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

.mt-24 { margin-top: 24px; }

.chart-card, .action-card {
  border-radius: 12px;
  border: none;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

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

.quick-actions {
  display: flex;
  flex-direction: column;
}

.action-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.action-btn {
  flex: 1;
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
