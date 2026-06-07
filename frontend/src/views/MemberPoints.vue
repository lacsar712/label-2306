<template>
  <div class="member-points">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员积分管理</h2>
        <p class="page-subtitle">手动为会员增加或减少积分</p>
      </div>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-card class="points-card" shadow="never">
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" class="points-form">
        <el-form-item label="选择会员" prop="memberId">
          <el-select
            v-model="form.memberId"
            placeholder="请选择会员"
            filterable
            class="w-full"
            :loading="loading"
          >
            <el-option
              v-for="item in members"
              :key="item.id"
              :label="`${item.name} (${item.phone})`"
              :value="item.id"
            >
              <div class="member-option">
                <span>{{ item.name }}</span>
                <span class="member-phone">{{ item.phone }}</span>
                <el-tag size="small" type="info" class="member-current-points">当前: {{ item.points }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="本次积分" prop="points">
          <template #label>
            <div class="form-label-with-tip">
              <span>本次积分</span>
              <span class="tip">输入正数为增加，负数为减少</span>
            </div>
          </template>
          <el-input-number v-model="form.points" class="w-full" :precision="0" />
        </el-form-item>

        <el-form-item class="form-actions">
          <el-button type="primary" :loading="submitting" @click="handleSubmit" size="large" class="submit-btn">
            确定
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api/axios';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const submitting = ref(false);
const members = ref([]);

const form = reactive({
  memberId: null,
  points: 0
});

const rules = {
  memberId: [{ required: true, message: '请选择会员', trigger: 'change' }],
  points: [{ required: true, message: '请输入积分', trigger: 'blur' }]
};

const fetchMembers = async () => {
  loading.value = true;
  try {
    members.value = await api.get('/members');
    // If memberId is in query, set it
    if (route.query.memberId) {
      form.memberId = parseInt(route.query.memberId);
    }
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      if (form.points === 0) {
        ElMessage.warning('积分变动不能为0');
        return;
      }
      submitting.value = true;
      try {
        await api.post(`/members/${form.memberId}/points`, { points: form.points });
        ElMessage.success('积分更新成功');
        router.push('/members');
      } finally {
        submitting.value = false;
      }
    }
  });
};

onMounted(() => {
  fetchMembers();
});
</script>

<style scoped>
.member-points {
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

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.points-card {
  max-width: 600px;
  margin: 0 auto;
  border-radius: 12px;
  border: none;
  padding: 20px;
}

.w-full {
  width: 100%;
}

.member-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-phone {
  color: #94a3b8;
  font-size: 12px;
}

.member-current-points {
  margin-left: auto;
}

.form-label-with-tip {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.tip {
  font-size: 12px;
  font-weight: normal;
  color: #94a3b8;
}

.form-actions {
  margin-top: 32px;
  margin-bottom: 0;
}

.submit-btn {
  width: 100%;
}
</style>
