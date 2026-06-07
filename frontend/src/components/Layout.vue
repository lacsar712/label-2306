<template>
  <el-container class="layout-container">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <el-icon :size="24" color="#4f46e5"><UserFilled /></el-icon>
        <span class="logo-text">会员管理系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        router
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <span>会员列表</span>
        </el-menu-item>
        <el-menu-item index="/transactions">
          <el-icon><Tickets /></el-icon>
          <span>积分流水</span>
        </el-menu-item>
        <el-menu-item index="/tags">
          <el-icon><PriceTag /></el-icon>
          <span>会员标签</span>
        </el-menu-item>
        <el-menu-item index="/coupons">
          <el-icon><Present /></el-icon>
          <span>优惠券管理</span>
        </el-menu-item>
        <el-menu-item index="/notifications">
          <el-icon><Bell /></el-icon>
          <span>通知中心</span>
        </el-menu-item>
        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <span>数据导出</span>
        </el-menu-item>
        <el-menu-item v-if="authStore.isAdmin" index="/system">
          <el-icon><Setting /></el-icon>
          <span>系统管理</span>
        </el-menu-item>
        <el-menu-item v-if="authStore.isAdmin" index="/audit-logs">
          <el-icon><Document /></el-icon>
          <span>操作审计</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <el-button link @click="handleLogout" class="logout-btn">
          <el-icon><SwitchButton /></el-icon>
          <span>退出登录</span>
        </el-button>
      </div>
    </el-aside>
    <el-container>
      <el-header height="64px">
        <div class="header-content">
          <div class="breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item>{{ currentPageName }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="user-info">
            <el-popover
              placement="bottom-end"
              :width="380"
              trigger="click"
              popper-class="notification-popover"
              :visible="notificationPopoverVisible"
              @show="handlePopoverShow"
              @hide="handlePopoverHide"
            >
              <template #reference>
                <el-badge :value="notificationStore.unreadCount" :hidden="notificationStore.unreadCount === 0" class="notification-badge">
                  <el-button class="notification-btn" circle>
                    <el-icon :size="18"><Bell /></el-icon>
                  </el-button>
                </el-badge>
              </template>

              <div class="notification-panel">
                <div class="panel-header">
                  <span class="panel-title">通知中心</span>
                  <div class="panel-actions">
                    <el-button type="primary" link size="small" @click="handleMarkAllRead" :disabled="notificationStore.unreadCount === 0">
                      全部标为已读
                    </el-button>
                    <el-button type="primary" link size="small" @click="goToNotifications">
                      查看全部
                    </el-button>
                  </div>
                </div>

                <div class="panel-filters">
                  <el-select v-model="panelFilters.type" placeholder="类型" size="small" style="width: 100px" clearable @change="fetchPanelNotifications">
                    <el-option label="信息" value="INFO" />
                    <el-option label="警告" value="WARNING" />
                    <el-option label="成功" value="SUCCESS" />
                    <el-option label="紧急" value="URGENT" />
                  </el-select>
                  <el-select v-model="panelFilters.priority" placeholder="优先级" size="small" style="width: 100px" clearable @change="fetchPanelNotifications">
                    <el-option label="低" value="LOW" />
                    <el-option label="中" value="MEDIUM" />
                    <el-option label="高" value="HIGH" />
                    <el-option label="紧急" value="URGENT" />
                  </el-select>
                  <el-input
                    v-model="panelFilters.search"
                    placeholder="搜索"
                    size="small"
                    style="width: 140px"
                    clearable
                    @keyup.enter="fetchPanelNotifications"
                  >
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                </div>

                <div class="panel-list" v-loading="panelLoading">
                  <div
                    v-for="item in panelNotifications"
                    :key="item.id"
                    class="panel-item"
                    :class="{ unread: !item.isRead }"
                    @click="handleViewNotification(item)"
                  >
                    <div class="item-header">
                      <el-tag size="small" :type="getNotificationTypeTag(item.notification.type)" effect="light">
                        {{ getNotificationTypeLabel(item.notification.type) }}
                      </el-tag>
                      <span class="item-time">{{ formatTime(item.createdAt) }}</span>
                    </div>
                    <div class="item-title">{{ item.notification.title }}</div>
                    <div class="item-content">{{ stripHtml(item.notification.content) }}</div>
                  </div>
                  <el-empty v-if="panelNotifications.length === 0 && !panelLoading" description="暂无通知" />
                </div>
              </div>
            </el-popover>

            <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
            <span class="username">{{ authStore.user?.username || '管理员' }}</span>
            <el-tag size="small" :type="authStore.isAdmin ? 'danger' : 'info'" class="role-tag">
              {{ authStore.user?.role }}
            </el-tag>
          </div>
        </div>
      </el-header>
      <el-main>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useNotificationStore } from '../stores/notification';
import { DataAnalysis, User, Setting, SwitchButton, UserFilled, Tickets, Document, PriceTag, Present, Bell, Search, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const notificationPopoverVisible = ref(false);
const panelLoading = ref(false);
const panelNotifications = ref([]);
let refreshTimer = null;

const panelFilters = reactive({
  type: '',
  priority: '',
  search: '',
  page: 1,
  pageSize: 10,
});

const activeMenu = computed(() => route.path);
const currentPageName = computed(() => {
  if (route.path === '/') return '数据概览';
  if (route.path === '/members') return '会员列表';
  if (route.path === '/points') return '会员积分';
  if (route.path === '/transactions') return '积分流水';
  if (route.path === '/tags') return '会员标签';
  if (route.path === '/coupons') return '优惠券管理';
  if (route.path === '/notifications') return '通知中心';
  if (route.path.startsWith('/notifications/')) return '通知中心';
  if (route.path === '/export') return '数据导出';
  if (route.path === '/system') return '系统管理';
  if (route.path === '/audit-logs') return '操作审计';
  return '';
});

const fetchPanelNotifications = async () => {
  panelLoading.value = true;
  try {
    const result = await notificationStore.fetchMyNotifications(panelFilters);
    panelNotifications.value = result.list || [];
  } catch (e) {
    console.error('Failed to fetch notifications:', e);
  } finally {
    panelLoading.value = false;
  }
};

const handlePopoverShow = () => {
  fetchPanelNotifications();
};

const handlePopoverHide = () => {
};

const handleViewNotification = async (item) => {
  if (!item.isRead) {
    try {
      await notificationStore.markAsRead([item.notificationId]);
      notificationStore.decrementUnreadCount();
    } catch (e) {
      console.error(e);
    }
  }
  notificationPopoverVisible.value = false;
  router.push('/notifications');
};

const handleMarkAllRead = async () => {
  try {
    await notificationStore.markAllAsRead();
    ElMessage.success('已全部标为已读');
    fetchPanelNotifications();
  } catch (e) {
    console.error(e);
  }
};

const goToNotifications = () => {
  notificationPopoverVisible.value = false;
  router.push('/notifications');
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

const formatTime = (date) => {
  if (!date) return '';
  const now = dayjs();
  const target = dayjs(date);
  const diffMinutes = now.diff(target, 'minute');
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  const diffHours = now.diff(target, 'hour');
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = now.diff(target, 'day');
  if (diffDays < 7) return `${diffDays}天前`;
  return target.format('MM-DD HH:mm');
};

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').substring(0, 60);
};

const handleLogout = () => {
  authStore.logout();
  notificationStore.unreadCount = 0;
  ElMessage.success('已退出登录');
  router.push('/login');
};

const startRefreshTimer = () => {
  refreshTimer = setInterval(() => {
    notificationStore.fetchUnreadCount();
  }, 60000);
};

const stopRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

onMounted(() => {
  notificationStore.fetchUnreadCount();
  startRefreshTimer();
});

onUnmounted(() => {
  stopRefreshTimer();
});
</script>

<style scoped>
.layout-container {
  height: 100vh;
  background-color: #f8fafc;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-right: 1px solid #e2e8f0;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.el-menu {
  border-right: none;
  flex: 1;
}

.el-menu-item {
  height: 50px;
  margin: 4px 12px;
  border-radius: 8px;
  color: #64748b;
}

.el-menu-item.is-active {
  background-color: #f1f5f9;
  color: #4f46e5;
  font-weight: 600;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.logout-btn {
  width: 100%;
  height: 40px;
  justify-content: flex-start;
  padding: 0 12px;
  color: #64748b;
  gap: 8px;
}

.logout-btn:hover {
  color: #ef4444;
  background-color: #fef2f2;
}

.header-content {
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  background-color: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.role-tag {
  font-weight: 600;
  text-transform: uppercase;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.notification-badge {
  margin-right: 8px;
}

.notification-btn {
  padding: 0;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.notification-btn:hover {
  background-color: #f1f5f9;
}

:deep(.notification-popover) {
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden;
}

.notification-panel {
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.panel-actions {
  display: flex;
  gap: 12px;
}

.panel-filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #f8fafc;
}

.panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.panel-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 4px;
}

.panel-item:hover {
  background-color: #f8fafc;
}

.panel-item.unread {
  background-color: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.panel-item.unread:hover {
  background-color: #dbeafe;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-time {
  font-size: 12px;
  color: #94a3b8;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
  line-height: 1.4;
}

.item-content {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
</style>
