<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1 class="title">会员管理系统</h1>
        <p class="subtitle">请登录以继续管理</p>
      </div>
      <el-form :model="form" :rules="rules" ref="loginForm" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input 
            v-model="form.username" 
            placeholder="用户名" 
            :prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input 
            v-model="form.password" 
            type="password" 
            placeholder="密码" 
            :prefix-icon="Lock"
            show-password
            size="large"
          />
        </el-form-item>
        <el-button 
          type="primary" 
          class="login-button" 
          :loading="loading" 
          size="large"
          @click="handleLogin"
        >
          立即登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();
const loginForm = ref(null);
const loading = ref(false);

const form = reactive({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const handleLogin = async () => {
  if (!loginForm.value) return;
  
  await loginForm.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        await authStore.login(form.username, form.password);
        ElMessage.success('登录成功');
        router.push('/');
      } catch (error) {
        ElMessage.error(error || '登录失败');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%);
  font-family: 'Inter', sans-serif;
}

.login-card {
  width: 400px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.title {
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.login-button {
  width: 100%;
  margin-top: 12px;
  height: 48px;
  font-weight: 600;
  background: linear-gradient(90deg, #ff4d4d, #f9cb28);
  border: none;
  transition: transform 0.2s;
}

.login-button:hover {
  transform: translateY(-2px);
  opacity: 0.9;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: none !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.el-input__inner) {
  color: #fff !important;
}

:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.3) !important;
}
</style>
