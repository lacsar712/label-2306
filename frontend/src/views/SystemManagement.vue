<template>
  <div class="system-mgmt">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">系统管理</h2>
        <p class="page-subtitle">管理系统用户及查看服务器运行状态</p>
      </div>
    </div>

    <el-card class="mgmt-card" shadow="never">
      <el-tabs v-model="activeTab" class="custom-tabs">
        <el-tab-pane label="用户管理" name="users">
          <div class="tab-header">
            <h3 class="tab-title">系统用户列表</h3>
            <el-button type="primary" @click="handleAddClick">
              <el-icon class="mr-4"><Plus /></el-icon>添加用户
            </el-button>
          </div>
          <el-table :data="users" v-loading="loadingUsers" style="width: 100%" :header-cell-style="{ background: '#f8fafc' }">
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="role" label="角色">
              <template #default="{ row }">
                <el-tag :type="row.role === 'ADMIN' ? 'danger' : 'info'" effect="light">
                  {{ row.role === 'ADMIN' ? '管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="创建时间">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button 
                  link 
                  @click="handleEditUser(row)"
                >
                  编辑
                </el-button>
                <el-button 
                  type="danger" 
                  link 
                  @click="handleDeleteUser(row)"
                  :disabled="authStore.user?.id === row.id"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="系统信息" name="info">
          <div class="system-info">
            <el-descriptions title="服务器状态" :column="2" border class="info-descriptions">
              <el-descriptions-item label="操作系统">
                <el-icon class="mr-4"><Platform /></el-icon>
                {{ systemInfo.platform }} {{ systemInfo.release }}
              </el-descriptions-item>
              <el-descriptions-item label="Node.js 版本">
                <el-icon class="mr-4"><Cpu /></el-icon>
                {{ systemInfo.nodeVersion }}
              </el-descriptions-item>
              <el-descriptions-item label="CPU 核心数">{{ systemInfo.cpuCount }}</el-descriptions-item>
              <el-descriptions-item label="总内存">{{ systemInfo.totalMemory }}</el-descriptions-item>
              <el-descriptions-item label="可用内存">{{ systemInfo.freeMemory }}</el-descriptions-item>
              <el-descriptions-item label="运行时间">
                <el-icon class="mr-4"><Timer /></el-icon>
                {{ formatUptime(systemInfo.uptime) }}
              </el-descriptions-item>
              <el-descriptions-item label="数据库状态">
                <el-tag type="success" effect="dark" round>已连接</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>

        <el-tab-pane label="导入配置" name="import">
          <div class="import-config">
            <h3 class="tab-title">会员批量导入配置</h3>
            <el-form :model="importConfig" label-width="200px" style="max-width: 600px; margin-top: 20px;">
              <el-form-item label="单次导入上限（条）">
                <el-input-number
                  v-model="importConfig.maxImportLimit"
                  :min="1"
                  :max="100000"
                  :step="100"
                  style="width: 200px"
                />
                <span class="form-tip">单次导入文件最大允许的数据行数</span>
              </el-form-item>
              <el-form-item label="非管理员导入权限">
                <el-switch
                  v-model="importConfig.allowNonAdminImport"
                  active-text="允许"
                  inactive-text="禁止"
                />
                <span class="form-tip">关闭后仅 ADMIN 角色可执行批量导入</span>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="savingImportConfig" @click="handleSaveImportConfig">
                  保存配置
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- Add/Edit User Dialog -->
    <el-dialog 
      v-model="showUserDialog" 
      :title="isEditUser ? '编辑系统用户' : '添加系统用户'" 
      width="400px"
      @closed="resetUserForm"
    >
      <el-form :model="userForm" :rules="userRules" ref="userFormRef" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item :label="isEditUser ? '新密码 (留空则不修改)' : '密码'" prop="password">
          <el-input v-model="userForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select 
            v-model="userForm.role" 
            placeholder="选择角色" 
            style="width: 100%"
            :disabled="isEditUser && userForm.username === 'admin'"
          >
            <el-option label="管理员" value="ADMIN" />
            <el-option label="普通用户" value="USER" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitUser">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Platform, Cpu, Timer } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import { getImportConfig, updateImportConfig } from '../api/memberImport';

const authStore = useAuthStore();
const activeTab = ref('users');
const users = ref([]);
const loadingUsers = ref(false);
const systemInfo = ref({});
const showUserDialog = ref(false);
const isEditUser = ref(false);
const submitting = ref(false);
const userFormRef = ref(null);
const importConfig = reactive({
  maxImportLimit: 1000,
  allowNonAdminImport: false,
});
const savingImportConfig = ref(false);

const userForm = reactive({
  id: null,
  username: '',
  password: '',
  role: 'USER'
});

const userRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }, { min: 3, message: '最少3个字符', trigger: 'blur' }],
  password: [
    { 
      required: true, 
      validator: (rule, value, callback) => {
        if (!isEditUser.value && !value) {
          callback(new Error('请输入密码'));
        } else if (value && value.length < 6) {
          callback(new Error('最少6个字符'));
        } else {
          callback();
        }
      }, 
      trigger: 'blur' 
    }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
};

const fetchUsers = async () => {
  loadingUsers.value = true;
  try {
    users.value = await api.get('/users');
  } finally {
    loadingUsers.value = false;
  }
};

const fetchSystemInfo = async () => {
  try {
    systemInfo.value = await api.get('/system/info');
  } catch (error) {
    console.error('Failed to fetch system info', error);
  }
};

const fetchImportConfig = async () => {
  try {
    const res = await getImportConfig();
    if (res.data) {
      importConfig.maxImportLimit = res.data.maxImportLimit;
      importConfig.allowNonAdminImport = res.data.allowNonAdminImport;
    }
  } catch (error) {
    console.error('Failed to fetch import config', error);
  }
};

const handleSaveImportConfig = async () => {
  savingImportConfig.value = true;
  try {
    await updateImportConfig({
      maxImportLimit: importConfig.maxImportLimit,
      allowNonAdminImport: importConfig.allowNonAdminImport,
    });
    ElMessage.success('导入配置已保存');
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '保存失败');
  } finally {
    savingImportConfig.value = false;
  }
};

const handleAddClick = () => {
  isEditUser.value = false;
  showUserDialog.value = true;
};

const handleEditUser = (user) => {
  isEditUser.value = true;
  userForm.id = user.id;
  userForm.username = user.username;
  userForm.password = '';
  userForm.role = user.role;
  showUserDialog.value = true;
};

const resetUserForm = () => {
  userForm.id = null;
  userForm.username = '';
  userForm.password = '';
  userForm.role = 'USER';
  if (userFormRef.value) {
    userFormRef.value.clearValidate();
  }
};

const handleSubmitUser = async () => {
  if (!userFormRef.value) return;
  await userFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (isEditUser.value) {
          const updateData = {
            username: userForm.username,
            role: userForm.role
          };
          if (userForm.password) {
            updateData.password = userForm.password;
          }
          await api.put(`/users/${userForm.id}`, updateData);
          ElMessage.success('用户更新成功');
        } else {
          await api.post('/users', userForm);
          ElMessage.success('用户添加成功');
        }
        showUserDialog.value = false;
        fetchUsers();
      } finally {
        submitting.value = false;
      }
    }
  });
};

const handleDeleteUser = (user) => {
  ElMessageBox.confirm(`确定要删除用户 "${user.username}" 吗？`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await api.delete(`/users/${user.id}`);
    ElMessage.success('用户已删除');
    fetchUsers();
  }).catch(() => {});
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

const formatUptime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}小时 ${m}分钟`;
};

onMounted(() => {
  fetchUsers();
  fetchSystemInfo();
  fetchImportConfig();
});
</script>

<style scoped>
.system-mgmt {
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

.mgmt-card {
  border-radius: 12px;
  border: none;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.tab-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.system-info {
  padding: 10px 0;
}

.info-descriptions {
  padding: 20px;
  background-color: #fcfcfc;
  border-radius: 8px;
}

.mr-4 {
  margin-right: 4px;
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

:deep(.el-descriptions__title) {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

:deep(.el-descriptions__label) {
  width: 150px;
  background-color: #f8fafc !important;
  color: #64748b;
  font-weight: 500;
}

.import-config {
  padding: 10px 0;
}

.form-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}
</style>
