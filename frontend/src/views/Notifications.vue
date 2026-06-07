<template>
  <div class="notifications-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">通知中心</h2>
        <p class="page-subtitle">查看和管理系统通知</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="goToSend">
          <el-icon class="mr-4"><Promotion /></el-icon>发送通知
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="notification-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="我的通知" name="mine">
        <el-card shadow="never" class="list-card">
          <div class="filter-bar">
            <el-input
              v-model="mineFilters.search"
              placeholder="搜索通知标题或内容"
              size="default"
              style="width: 240px"
              clearable
              @keyup.enter="fetchMyNotifications"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="mineFilters.type" placeholder="类型" size="default" style="width: 140px" clearable>
              <el-option label="信息" value="INFO" />
              <el-option label="警告" value="WARNING" />
              <el-option label="成功" value="SUCCESS" />
              <el-option label="紧急" value="URGENT" />
            </el-select>
            <el-select v-model="mineFilters.priority" placeholder="优先级" size="default" style="width: 140px" clearable>
              <el-option label="低" value="LOW" />
              <el-option label="中" value="MEDIUM" />
              <el-option label="高" value="HIGH" />
              <el-option label="紧急" value="URGENT" />
            </el-select>
            <el-select v-model="mineFilters.isRead" placeholder="已读状态" size="default" style="width: 140px" clearable>
              <el-option label="未读" value="false" />
              <el-option label="已读" value="true" />
            </el-select>
            <el-button type="primary" @click="fetchMyNotifications">查询</el-button>
            <el-button @click="resetMineFilters">重置</el-button>
            <el-button type="success" @click="handleMarkAllAsRead" :disabled="notificationStore.unreadCount === 0">
              全部标为已读
            </el-button>
            <el-button type="warning" @click="handleBatchMarkRead" :disabled="selectedIds.length === 0">
              批量标为已读
            </el-button>
          </div>

          <el-table
            v-loading="notificationStore.loading"
            :data="notificationStore.myNotifications"
            style="width: 100%"
            @selection-change="handleSelectionChange"
            row-key="id"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column label="状态" width="60" align="center">
              <template #default="{ row }">
                <el-dot v-if="!row.isRead" type="danger" />
              </template>
            </el-table-column>
            <el-table-column label="类型" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getNotificationTypeTag(row.notification.type)" effect="light">
                  {{ getNotificationTypeLabel(row.notification.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getPriorityTag(row.notification.priority)" effect="plain">
                  {{ getPriorityLabel(row.notification.priority) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="标题" min-width="200" prop="notification.title" :show-overflow-tooltip="true" />
            <el-table-column label="内容" min-width="280" :show-overflow-tooltip="true">
              <template #default="{ row }">
                <span>{{ stripHtml(row.notification.content) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="发送人" width="120">
              <template #default="{ row }">
                {{ row.notification.operator?.username || '系统' }}
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleView(row)">查看</el-button>
                <el-button
                  v-if="!row.isRead"
                  type="success"
                  link
                  size="small"
                  @click="handleSingleMarkRead(row)"
                >标为已读</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="mineFilters.page"
              v-model:page-size="mineFilters.pageSize"
              :total="notificationStore.myNotificationsTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @size-change="fetchMyNotifications"
              @current-change="fetchMyNotifications"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane v-if="authStore.isAdmin" label="全部通知" name="all">
        <el-row :gutter="24" class="stats-row" v-if="notificationStore.stats">
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">通知总数</span>
                  <span class="stat-value">{{ notificationStore.stats.total || 0 }}</span>
                </div>
                <div class="stat-icon blue">
                  <el-icon><Bell /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">已发送</span>
                  <span class="stat-value">{{ notificationStore.stats.sent || 0 }}</span>
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
                  <span class="stat-label">定时发送</span>
                  <span class="stat-value">{{ notificationStore.stats.scheduled || 0 }}</span>
                </div>
                <div class="stat-icon orange">
                  <el-icon><Clock /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">整体已读率</span>
                  <span class="stat-value">{{ notificationStore.stats.overallReadRate || 0 }}%</span>
                </div>
                <div class="stat-icon purple">
                  <el-icon><DataLine /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" class="list-card">
          <div class="filter-bar">
            <el-input
              v-model="allFilters.search"
              placeholder="搜索通知标题或内容"
              size="default"
              style="width: 240px"
              clearable
              @keyup.enter="fetchNotifications"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select v-model="allFilters.type" placeholder="类型" size="default" style="width: 140px" clearable>
              <el-option label="信息" value="INFO" />
              <el-option label="警告" value="WARNING" />
              <el-option label="成功" value="SUCCESS" />
              <el-option label="紧急" value="URGENT" />
            </el-select>
            <el-select v-model="allFilters.priority" placeholder="优先级" size="default" style="width: 140px" clearable>
              <el-option label="低" value="LOW" />
              <el-option label="中" value="MEDIUM" />
              <el-option label="高" value="HIGH" />
              <el-option label="紧急" value="URGENT" />
            </el-select>
            <el-select v-model="allFilters.status" placeholder="状态" size="default" style="width: 140px" clearable>
              <el-option label="草稿" value="DRAFT" />
              <el-option label="定时发送" value="SCHEDULED" />
              <el-option label="已发送" value="SENT" />
              <el-option label="已归档" value="ARCHIVED" />
            </el-select>
            <el-select v-model="allFilters.targetType" placeholder="目标范围" size="default" style="width: 140px" clearable>
              <el-option label="单个用户" value="SINGLE_USER" />
              <el-option label="角色" value="ROLE" />
              <el-option label="标签会员" value="TAG" />
              <el-option label="全员" value="ALL" />
            </el-select>
            <el-button type="primary" @click="fetchNotifications">查询</el-button>
            <el-button @click="resetAllFilters">重置</el-button>
          </div>

          <el-table
            v-loading="notificationStore.loading"
            :data="notificationStore.notifications"
            style="width: 100%"
          >
            <el-table-column label="类型" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getNotificationTypeTag(row.type)" effect="light">
                  {{ getNotificationTypeLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getPriorityTag(row.priority)" effect="plain">
                  {{ getPriorityLabel(row.priority) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="标题" min-width="180" prop="title" :show-overflow-tooltip="true" />
            <el-table-column label="目标范围" width="100" align="center">
              <template #default="{ row }">
                {{ getTargetTypeLabel(row.targetType) }}
              </template>
            </el-table-column>
            <el-table-column label="接收人数" width="100" align="center">
              <template #default="{ row }">
                {{ row._count?.recipients || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="getStatusTag(row.status)">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发送人" width="120">
              <template #default="{ row }">
                {{ row.operator?.username || '系统' }}
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleViewNotification(row)">查看</el-button>
                <el-button
                  v-if="row.status === 'SENT'"
                  type="success"
                  link
                  size="small"
                  @click="handleViewStats(row)"
                >统计</el-button>
                <el-button
                  v-if="row.status === 'DRAFT' || row.status === 'SCHEDULED'"
                  type="warning"
                  link
                  size="small"
                  @click="handleEdit(row)"
                >编辑</el-button>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="handleDelete(row)"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="allFilters.page"
              v-model:page-size="allFilters.pageSize"
              :total="notificationStore.notificationsTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @size-change="fetchNotifications"
              @current-change="fetchNotifications"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="detailDialogVisible"
      title="通知详情"
      width="600px"
    >
      <div v-if="currentDetail" class="notification-detail">
        <div class="detail-header">
          <el-tag :type="getNotificationTypeTag(currentDetail.notification?.type || currentDetail.type)">
            {{ getNotificationTypeLabel(currentDetail.notification?.type || currentDetail.type) }}
          </el-tag>
          <span class="detail-title">{{ currentDetail.notification?.title || currentDetail.title }}</span>
        </div>
        <div class="detail-meta">
          <span>优先级：{{ getPriorityLabel(currentDetail.notification?.priority || currentDetail.priority) }}</span>
          <span>发送人：{{ currentDetail.notification?.operator?.username || currentDetail.operator?.username || '系统' }}</span>
          <span>时间：{{ formatDate(currentDetail.notification?.sentAt || currentDetail.sentAt || currentDetail.createdAt) }}</span>
        </div>
        <div class="detail-content" v-html="currentDetail.notification?.content || currentDetail.content"></div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="statsDialogVisible"
      title="通知统计"
      width="500px"
    >
      <div v-if="currentStats" class="notification-stats">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="通知标题">{{ currentStats.title }}</el-descriptions-item>
          <el-descriptions-item label="总接收人数">{{ currentStats.totalRecipients }}</el-descriptions-item>
          <el-descriptions-item label="已读人数">{{ currentStats.readCount }}</el-descriptions-item>
          <el-descriptions-item label="未读人数">{{ currentStats.unreadCount }}</el-descriptions-item>
          <el-descriptions-item label="送达率">
            <el-progress :percentage="currentStats.deliveryRate" :color="'#67C23A'" />
          </el-descriptions-item>
          <el-descriptions-item label="已读率">
            <el-progress :percentage="currentStats.readRate" :color="'#409EFF'" />
          </el-descriptions-item>
          <el-descriptions-item label="发送时间">{{ formatDate(currentStats.sentAt) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '../stores/notification';
import { useAuthStore } from '../stores/auth';
import { notificationApi } from '../api/notification';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Promotion, Bell, CircleCheck, Clock, DataLine } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const router = useRouter();
const notificationStore = useNotificationStore();
const authStore = useAuthStore();

const activeTab = ref('mine');
const selectedIds = ref([]);
const detailDialogVisible = ref(false);
const statsDialogVisible = ref(false);
const currentDetail = ref(null);
const currentStats = ref(null);

const mineFilters = reactive({
  search: '',
  type: '',
  priority: '',
  isRead: '',
  page: 1,
  pageSize: 20,
});

const allFilters = reactive({
  search: '',
  type: '',
  priority: '',
  status: '',
  targetType: '',
  page: 1,
  pageSize: 20,
});

const fetchMyNotifications = async () => {
  await notificationStore.fetchMyNotifications(mineFilters);
};

const fetchNotifications = async () => {
  await notificationStore.fetchNotifications(allFilters);
};

const fetchStats = async () => {
  if (authStore.isAdmin) {
    await notificationStore.fetchStats();
  }
};

const handleTabChange = (tab) => {
  if (tab === 'mine') {
    fetchMyNotifications();
  } else if (tab === 'all') {
    fetchNotifications();
    fetchStats();
  }
};

const resetMineFilters = () => {
  mineFilters.search = '';
  mineFilters.type = '';
  mineFilters.priority = '';
  mineFilters.isRead = '';
  mineFilters.page = 1;
  fetchMyNotifications();
};

const resetAllFilters = () => {
  allFilters.search = '';
  allFilters.type = '';
  allFilters.priority = '';
  allFilters.status = '';
  allFilters.targetType = '';
  allFilters.page = 1;
  fetchNotifications();
};

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map(item => item.notificationId);
};

const handleMarkAllAsRead = async () => {
  try {
    await ElMessageBox.confirm('确定要将所有通知标为已读吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await notificationStore.markAllAsRead();
    ElMessage.success('已全部标为已读');
    fetchMyNotifications();
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e);
    }
  }
};

const handleBatchMarkRead = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await notificationStore.markAsRead(selectedIds.value);
    ElMessage.success(`已将 ${selectedIds.value.length} 条通知标为已读`);
    selectedIds.value = [];
    fetchMyNotifications();
  } catch (e) {
    console.error(e);
  }
};

const handleSingleMarkRead = async (row) => {
  try {
    await notificationStore.markAsRead([row.notificationId]);
    notificationStore.decrementUnreadCount();
    ElMessage.success('已标为已读');
    fetchMyNotifications();
  } catch (e) {
    console.error(e);
  }
};

const handleView = (row) => {
  currentDetail.value = row;
  detailDialogVisible.value = true;
  if (!row.isRead) {
    handleSingleMarkRead(row);
  }
};

const handleViewNotification = (row) => {
  currentDetail.value = row;
  detailDialogVisible.value = true;
};

const handleViewStats = async (row) => {
  try {
    currentStats.value = await notificationApi.getNotificationStats(row.id);
    statsDialogVisible.value = true;
  } catch (e) {
    console.error(e);
  }
};

const handleEdit = (row) => {
  router.push({ path: '/notifications/send', query: { id: row.id } });
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除通知"${row.title}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await notificationStore.deleteNotification(row.id);
    ElMessage.success('删除成功');
    fetchNotifications();
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e);
    }
  }
};

const goToSend = () => {
  router.push('/notifications/send');
};

const getNotificationTypeTag = (type) => {
  const map = {
    INFO: 'info',
    WARNING: 'warning',
    SUCCESS: 'success',
    URGENT: 'danger',
  };
  return map[type] || 'info';
};

const getNotificationTypeLabel = (type) => {
  const map = {
    INFO: '信息',
    WARNING: '警告',
    SUCCESS: '成功',
    URGENT: '紧急',
  };
  return map[type] || type;
};

const getPriorityTag = (priority) => {
  const map = {
    LOW: 'info',
    MEDIUM: '',
    HIGH: 'warning',
    URGENT: 'danger',
  };
  return map[priority] || '';
};

const getPriorityLabel = (priority) => {
  const map = {
    LOW: '低',
    MEDIUM: '中',
    HIGH: '高',
    URGENT: '紧急',
  };
  return map[priority] || priority;
};

const getStatusTag = (status) => {
  const map = {
    DRAFT: 'info',
    SCHEDULED: 'warning',
    SENT: 'success',
    ARCHIVED: 'info',
  };
  return map[status] || 'info';
};

const getStatusLabel = (status) => {
  const map = {
    DRAFT: '草稿',
    SCHEDULED: '定时发送',
    SENT: '已发送',
    ARCHIVED: '已归档',
  };
  return map[status] || status;
};

const getTargetTypeLabel = (type) => {
  const map = {
    SINGLE_USER: '单个用户',
    ROLE: '角色',
    TAG: '标签会员',
    ALL: '全员',
  };
  return map[type] || type;
};

const formatDate = (date) => {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').substring(0, 80);
};

onMounted(() => {
  fetchMyNotifications();
  if (authStore.isAdmin) {
    fetchStats();
  }
});
</script>

<style scoped>
.notifications-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  flex: 1;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.page-subtitle {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.notification-tabs {
  margin-top: 0;
}

.list-card {
  margin-bottom: 20px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
  align-items: center;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border: none;
  border-radius: 12px;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
}

.stat-icon.blue {
  background-color: #3b82f6;
}

.stat-icon.green {
  background-color: #22c55e;
}

.stat-icon.orange {
  background-color: #f97316;
}

.stat-icon.purple {
  background-color: #8b5cf6;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.notification-detail {
  padding: 12px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #64748b;
}

.detail-content {
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
  padding: 16px;
  background-color: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.notification-stats {
  padding: 12px 0;
}
</style>
