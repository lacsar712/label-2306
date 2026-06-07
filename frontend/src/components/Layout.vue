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
        <el-menu-item v-if="authStore.isAdmin" index="/system">
          <el-icon><Setting /></el-icon>
          <span>系统管理</span>
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { DataAnalysis, User, Setting, SwitchButton, UserFilled, Tickets } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);
const currentPageName = computed(() => {
  if (route.path === '/') return '数据概览';
  if (route.path === '/members') return '会员列表';
  if (route.path === '/points') return '会员积分';
  if (route.path === '/transactions') return '积分流水';
  if (route.path === '/system') return '系统管理';
  return '';
});

const handleLogout = () => {
  authStore.logout();
  ElMessage.success('已退出登录');
  router.push('/login');
};
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
</style>
