import { createRouter, createWebHistory } from 'vue-router';
import Layout from '../components/Layout.vue';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      component: Layout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'Dashboard',
          component: () => import('../views/Dashboard.vue'),
        },
        {
          path: 'members',
          name: 'Members',
          component: () => import('../views/MemberList.vue'),
        },
        {
          path: 'points',
          name: 'MemberPoints',
          component: () => import('../views/MemberPoints.vue'),
        },
        {
          path: 'system',
          name: 'System',
          component: () => import('../views/SystemManagement.vue'),
          meta: { requiresAdmin: true }
        },
      ],
    },
  ],
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/');
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/');
  } else {
    next();
  }
});

export default router;
