<template>
  <div class="birthday-config">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">生日关怀配置</h2>
        <p class="page-subtitle">配置祝福语模板、积分赠送规则与提醒策略</p>
      </div>
      <div class="header-actions">
        <el-button @click="$router.push('/birthdays')">
          <el-icon class="mr-4"><ArrowLeft /></el-icon>返回生日管理
        </el-button>
      </div>
    </div>

    <el-card class="config-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon class="title-icon"><Bell /></el-icon>
            提醒策略与通用配置
          </span>
        </div>
      </template>
      <el-form :model="configForm" label-width="140px" class="config-form">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="提前提醒天数">
              <el-input-number
                v-model="configForm.remindDaysBefore"
                :min="0"
                :max="30"
                :step="1"
                controls-position="right"
                style="width: 160px"
              />
              <span class="form-tip">提前 N 天在仪表盘中显示生日提醒</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="默认发送渠道">
              <el-select v-model="configForm.defaultChannel" style="width: 200px">
                <el-option label="短信" value="SMS" />
                <el-option label="微信" value="WECHAT" />
                <el-option label="邮件" value="EMAIL" />
                <el-option label="站内信" value="IN_APP" />
                <el-option label="人工" value="MANUAL" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="saveCareConfig" :loading="savingConfig">
            保存通用配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card mt-24" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon class="title-icon"><ChatDotRound /></el-icon>
            分级祝福语模板
          </span>
          <span class="card-subtitle">支持变量：{name} 会员姓名，{year} 当前年份</span>
        </div>
      </template>
      <div class="template-list">
        <div v-for="(item, idx) in templateForms" :key="idx" class="template-item">
          <div class="template-header">
            <el-tag :type="getLevelTagType(item.level)" size="large" effect="light">
              {{ getLevelLabel(item.level) }}
            </el-tag>
            <el-switch v-model="item.isEnabled" active-text="启用" inactive-text="停用" />
          </div>
          <el-form :model="item" label-width="80px" class="template-form">
            <el-form-item label="标题">
              <el-input v-model="item.title" placeholder="祝福标题" maxlength="200" show-word-limit />
            </el-form-item>
            <el-form-item label="内容">
              <el-input
                v-model="item.content"
                type="textarea"
                :rows="4"
                placeholder="祝福内容，支持 {name} 和 {year} 变量"
                maxlength="2000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveTemplate(item)" :loading="savingTemplate === item.level">
                保存模板
              </el-button>
              <el-button @click="previewTemplate(item)">预览</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </el-card>

    <el-card class="config-card mt-24" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title">
            <el-icon class="title-icon"><Star /></el-icon>
            积分赠送规则
          </span>
        </div>
      </template>
      <el-table :data="rulesForms" style="width: 100%" :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }">
        <el-table-column prop="level" label="会员等级" width="160">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)" effect="light">
              {{ getLevelLabel(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="赠送积分" width="200">
          <template #default="{ row }">
            <el-input-number
              v-model="row.points"
              :min="0"
              :max="100000"
              :step="10"
              controls-position="right"
              style="width: 160px"
            />
          </template>
        </el-table-column>
        <el-table-column label="重复赠送保护" width="200">
          <template #default="{ row }">
            <el-switch
              v-model="row.preventDuplicate"
              active-text="启用"
              inactive-text="停用"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-switch
              v-model="row.isEnabled"
              active-text="启用"
              inactive-text="停用"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="primary" link @click="saveRule(row)" :loading="savingRule === row.level">
              保存规则
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="rule-tip">
        <el-icon><InfoFilled /></el-icon>
        重复赠送保护：启用后，同一年度内对同一会员仅赠送一次积分，重复执行关怀时将跳过积分赠送
      </div>
    </el-card>

    <el-dialog v-model="showPreviewDialog" title="祝福语预览" width="480px">
      <div class="preview-content">
        <h3 class="preview-title">{{ previewData.title }}</h3>
        <div class="preview-body" v-html="renderedPreview"></div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showPreviewDialog = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useBirthdayStore } from '../stores/birthday';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Bell, ChatDotRound, Star, InfoFilled } from '@element-plus/icons-vue';

const birthdayStore = useBirthdayStore();

const savingConfig = ref(false);
const savingTemplate = ref(null);
const savingRule = ref(null);
const showPreviewDialog = ref(false);
const previewData = ref({ title: '', content: '' });

const LEVELS = ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'];

const configForm = reactive({
  remindDaysBefore: 3,
  autoSendEnabled: false,
  defaultChannel: 'SMS',
});

const templateForms = ref(
  LEVELS.map((level) => ({
    level,
    title: '',
    content: '',
    isEnabled: true,
  }))
);

const rulesForms = ref(
  LEVELS.map((level) => ({
    level,
    points: 0,
    preventDuplicate: true,
    isEnabled: true,
  }))
);

const renderedPreview = computed(() => {
  return previewData.value.content
    .replace(/\{name\}/g, '<strong>张先生</strong>')
    .replace(/\{year\}/g, new Date().getFullYear());
});

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelTagType = (level) => {
  const map = { NORMAL: 'info', SILVER: '', GOLD: 'warning', PLATINUM: 'danger' };
  return map[level] || 'info';
};

const saveCareConfig = async () => {
  try {
    savingConfig.value = true;
    await birthdayStore.updateCareConfig({ ...configForm });
    ElMessage.success('通用配置已保存');
  } catch (e) {
    ElMessage.error('保存失败');
    console.error(e);
  } finally {
    savingConfig.value = false;
  }
};

const saveTemplate = async (template) => {
  try {
    if (!template.title || !template.content) {
      ElMessage.warning('请填写标题和内容');
      return;
    }
    savingTemplate.value = template.level;
    await birthdayStore.saveWishTemplate({ ...template });
    ElMessage.success(`${getLevelLabel(template.level)}祝福语模板已保存`);
  } catch (e) {
    ElMessage.error('保存失败');
    console.error(e);
  } finally {
    savingTemplate.value = null;
  }
};

const saveRule = async (rule) => {
  try {
    savingRule.value = rule.level;
    await birthdayStore.savePointsRule({ ...rule });
    ElMessage.success(`${getLevelLabel(rule.level)}积分规则已保存`);
  } catch (e) {
    ElMessage.error('保存失败');
    console.error(e);
  } finally {
    savingRule.value = null;
  }
};

const previewTemplate = (template) => {
  previewData.value = { ...template };
  showPreviewDialog.value = true;
};

const mergeData = () => {
  const templates = birthdayStore.wishTemplates || [];
  templateForms.value = LEVELS.map((level) => {
    const existing = templates.find((t) => t.level === level);
    return (
      existing || {
        level,
        title: '',
        content: '',
        isEnabled: true,
      }
    );
  });

  const rules = birthdayStore.pointsRules || [];
  rulesForms.value = LEVELS.map((level) => {
    const existing = rules.find((r) => r.level === level);
    return (
      existing || {
        level,
        points: 0,
        preventDuplicate: true,
        isEnabled: true,
      }
    );
  });

  const config = birthdayStore.careConfig;
  if (config) {
    configForm.remindDaysBefore = config.remindDaysBefore;
    configForm.autoSendEnabled = config.autoSendEnabled;
    configForm.defaultChannel = config.defaultChannel;
  }
};

onMounted(async () => {
  await Promise.all([
    birthdayStore.fetchWishTemplates(),
    birthdayStore.fetchPointsRules(),
    birthdayStore.fetchCareConfig(),
  ]);
  mergeData();
});
</script>

<style scoped>
.birthday-config {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.mr-4 {
  margin-right: 4px;
}

.mt-24 {
  margin-top: 24px;
}

.config-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.title-icon {
  color: #4f46e5;
}

.card-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
}

.config-form {
  padding: 8px 0;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.template-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.template-item {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  background-color: #fafafa;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.template-form {
  margin: 0;
}

.rule-tip {
  margin-top: 16px;
  padding: 12px 16px;
  background-color: #eff6ff;
  border-radius: 8px;
  font-size: 13px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-content {
  padding: 24px;
  background-color: #f8fafc;
  border-radius: 8px;
}

.preview-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #1e293b;
}

.preview-body {
  font-size: 14px;
  color: #475569;
  line-height: 1.8;
}
</style>
