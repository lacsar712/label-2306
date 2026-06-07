<template>
  <div class="member-list">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员列表</h2>
        <p class="page-subtitle">管理和查看所有系统会员信息</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon class="mr-4"><Plus /></el-icon>新增会员
        </el-button>
        <el-button type="warning" @click="$router.push('/points')">会员积分</el-button>
      </div>
    </div>

    <el-card class="filter-card mb-24" shadow="never">
      <div class="filter-header">
        <div class="search-group">
          <el-input
            v-model="search"
            placeholder="搜索姓名或手机号"
            class="search-input"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select v-model="filterLevel" placeholder="会员等级" clearable @change="handleSearch" class="level-select">
            <el-option label="普通会员" value="NORMAL" />
            <el-option label="白银会员" value="SILVER" />
            <el-option label="黄金会员" value="GOLD" />
            <el-option label="铂金会员" value="PLATINUM" />
          </el-select>
          <el-button type="primary" plain @click="handleSearch">搜索</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="memberStore.loading"
        :data="memberStore.members" 
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        row-class-name="member-row"
      >
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="phone" label="手机号" min-width="120" />
        <el-table-column prop="level" label="等级" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)">{{ getLevelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" min-width="80" />
        <el-table-column prop="status" label="状态" min-width="100">
          <template #default="{ row }">
            <el-badge :is-dot="true" :type="getStatusType(row.status)">
              <span class="ml-8">{{ getStatusLabel(row.status) }}</span>
            </el-badge>
          </template>
        </el-table-column>
        <el-table-column prop="joinDate" label="加入时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.joinDate) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <el-button link @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="$router.push({ path: '/points', query: { memberId: row.id } })">积分</el-button>
            <el-popconfirm title="确定删除该会员吗？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="showAddDialog"
      :title="isEdit ? '编辑会员' : '新增会员'"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="等级" prop="level">
              <el-select v-model="form.level" class="w-full">
                <el-option label="普通会员" value="NORMAL" />
                <el-option label="白银会员" value="SILVER" />
                <el-option label="黄金会员" value="GOLD" />
                <el-option label="铂金会员" value="PLATINUM" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="积分" prop="points">
              <el-input-number v-model="form.points" :min="0" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="ACTIVE">活跃</el-radio>
            <el-radio label="INACTIVE">不活跃</el-radio>
            <el-radio label="SUSPENDED">已停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { useMemberStore } from '../stores/member';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

const memberStore = useMemberStore();
const search = ref('');
const filterLevel = ref('');
const showAddDialog = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const formRef = ref(null);

const form = reactive({
  id: null,
  name: '',
  phone: '',
  email: '',
  level: 'NORMAL',
  points: 0,
  status: 'ACTIVE'
});

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  email: [{ type: 'email', message: '请输入正确的邮箱', trigger: 'blur' }]
};

const handleSearch = () => {
  memberStore.fetchMembers({
    search: search.value,
    level: filterLevel.value
  });
};

const handleEdit = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  showAddDialog.value = true;
};

const handleDelete = async (id) => {
  await memberStore.deleteMember(id);
  ElMessage.success('删除成功');
};

const resetForm = () => {
  isEdit.value = false;
  form.id = null;
  form.name = '';
  form.phone = '';
  form.email = '';
  form.level = 'NORMAL';
  form.points = 0;
  form.status = 'ACTIVE';
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (isEdit.value) {
          await memberStore.updateMember(form.id, form);
          ElMessage.success('更新成功');
        } else {
          await memberStore.addMember(form);
          ElMessage.success('添加成功');
        }
        showAddDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelTagType = (level) => {
  const map = { NORMAL: 'info', SILVER: 'primary', GOLD: 'warning', PLATINUM: 'success' };
  return map[level] || 'info';
};

const getStatusLabel = (status) => {
  const map = { ACTIVE: '活跃', INACTIVE: '不活跃', SUSPENDED: '已停用' };
  return map[status] || status;
};

const getStatusType = (status) => {
  const map = { ACTIVE: 'success', INACTIVE: 'info', SUSPENDED: 'danger' };
  return map[status] || 'info';
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

onMounted(() => {
  memberStore.fetchMembers();
});
</script>

<style scoped>
.member-list {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.filter-card, .table-card {
  border-radius: 12px;
  border: none;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-group {
  display: flex;
  gap: 12px;
  flex: 1;
}

.search-input {
  max-width: 320px;
}

.level-select {
  width: 160px;
}

.mb-24 {
  margin-bottom: 24px;
}

.mr-4 {
  margin-right: 4px;
}

.ml-8 {
  margin-left: 8px;
}

.w-full {
  width: 100%;
}

:deep(.member-row) {
  transition: background-color 0.2s;
}

:deep(.member-row:hover) {
  background-color: #f8fafc !important;
}

:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
}

:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

:deep(.el-tag--info) { background-color: #f1f5f9; color: #64748b; }
:deep(.el-tag--primary) { background-color: #eff6ff; color: #3b82f6; }
:deep(.el-tag--warning) { background-color: #fff7ed; color: #f97316; }
:deep(.el-tag--success) { background-color: #faf5ff; color: #a855f7; }
</style>
