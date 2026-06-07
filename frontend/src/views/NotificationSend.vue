<template>
  <div class="notification-send-page">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="goBack" style="padding: 0; margin-right: 12px;">
          <el-icon :size="20"><ArrowLeft /></el-icon>
        </el-button>
        <div>
          <h2 class="page-title">{{ isEdit ? '编辑通知' : '发送通知' }}</h2>
          <p class="page-subtitle">创建和发送系统通知给用户</p>
        </div>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="16">
        <el-card shadow="never" class="form-card">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" label-position="right">
            <el-form-item label="通知类型" prop="type">
              <el-radio-group v-model="form.type">
                <el-radio value="INFO">
                  <el-tag type="info" effect="light">信息</el-tag>
                </el-radio>
                <el-radio value="WARNING">
                  <el-tag type="warning" effect="light">警告</el-tag>
                </el-radio>
                <el-radio value="SUCCESS">
                  <el-tag type="success" effect="light">成功</el-tag>
                </el-radio>
                <el-radio value="URGENT">
                  <el-tag type="danger" effect="light">紧急</el-tag>
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="优先级" prop="priority">
              <el-radio-group v-model="form.priority">
                <el-radio value="LOW">低</el-radio>
                <el-radio value="MEDIUM">中</el-radio>
                <el-radio value="HIGH">高</el-radio>
                <el-radio value="URGENT">紧急</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="标题" prop="title">
              <el-input
                v-model="form.title"
                placeholder="请输入通知标题"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="正文" prop="content">
              <el-input
                v-model="form.content"
                type="textarea"
                :rows="10"
                placeholder="请输入通知正文内容，支持使用模板变量 {{变量名}}"
              />
            </el-form-item>

            <el-form-item label="目标范围" prop="targetType">
              <el-radio-group v-model="form.targetType" @change="handleTargetTypeChange">
                <el-radio value="SINGLE_USER">单个用户</el-radio>
                <el-radio value="ROLE">按角色</el-radio>
                <el-radio value="TAG">按标签会员</el-radio>
                <el-radio value="ALL">全员</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item v-if="form.targetType === 'SINGLE_USER'" label="选择用户" prop="targetIds">
              <el-select
                v-model="form.targetIds"
                multiple
                filterable
                placeholder="请选择用户"
                style="width: 100%"
              >
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="`${user.username} (${user.role})`"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="form.targetType === 'ROLE'" label="选择角色" prop="targetIds">
              <el-checkbox-group v-model="form.targetIds">
                <el-checkbox value="ADMIN">管理员</el-checkbox>
                <el-checkbox value="USER">普通用户</el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <el-form-item v-if="form.targetType === 'TAG'" label="选择标签" prop="targetIds">
              <el-select
                v-model="form.targetIds"
                multiple
                filterable
                placeholder="请选择会员标签"
                style="width: 100%"
              >
                <el-option
                  v-for="tag in tags"
                  :key="tag.id"
                  :label="tag.name"
                  :value="tag.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="发送方式">
              <el-radio-group v-model="sendMode">
                <el-radio value="instant">即时发送</el-radio>
                <el-radio value="scheduled">定时发送</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item v-if="sendMode === 'scheduled'" label="发送时间" prop="scheduledAt">
              <el-date-picker
                v-model="form.scheduledAt"
                type="datetime"
                placeholder="选择定时发送时间"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :disabled-date="disabledDate"
              />
            </el-form-item>

            <el-form-item label="过期时间">
              <el-date-picker
                v-model="form.expiredAt"
                type="datetime"
                placeholder="选择通知过期时间（可选）"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :disabled-date="disabledDate"
                clearable
              />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never" class="template-card">
          <template #header>
            <div class="card-header">
              <span>通知模板</span>
              <el-button type="primary" link size="small" @click="openTemplateDialog">
                <el-icon><Plus /></el-icon>新建模板
              </el-button>
            </div>
          </template>

          <div class="template-list">
            <div
              v-for="template in notificationStore.templates"
              :key="template.id"
              class="template-item"
              :class="{ active: form.templateId === template.id }"
              @click="selectTemplate(template)"
            >
              <div class="template-header">
                <el-tag size="small" :type="getNotificationTypeTag(template.type)" effect="light">
                  {{ getNotificationTypeLabel(template.type) }}
                </el-tag>
                <span class="template-name">{{ template.name }}</span>
                <el-button
                  v-if="!template.isSystem"
                  type="danger"
                  link
                  size="small"
                  class="delete-btn"
                  @click.stop="handleDeleteTemplate(template)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
              <div class="template-title">{{ template.title }}</div>
              <div class="template-content">{{ stripHtml(template.content) }}</div>
              <div v-if="template.variables && template.variables.length > 0" class="template-vars">
                <el-tag v-for="v in template.variables" :key="v" size="small" type="info" effect="plain">
                  {{ v }}
                </el-tag>
              </div>
            </div>
            <el-empty v-if="notificationStore.templates.length === 0" description="暂无模板" />
          </div>
        </el-card>

        <el-card v-if="form.templateId && currentTemplate?.variables?.length > 0" shadow="never" class="variables-card" style="margin-top: 20px;">
          <template #header>
            <span>模板变量</span>
          </template>
          <el-form label-width="100px">
            <el-form-item
              v-for="variable in currentTemplate.variables"
              :key="variable"
              :label="variable"
            >
              <el-input
                v-model="form.templateVariables[variable]"
                :placeholder="`请输入 ${variable}`"
                @input="handleVariableChange"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="preview-card" style="margin-top: 20px;">
          <template #header>
            <span>预览</span>
          </template>
          <div class="preview-content">
            <div class="preview-type">
              <el-tag :type="getNotificationTypeTag(form.type)" effect="light">
                {{ getNotificationTypeLabel(form.type) }}
              </el-tag>
              <span class="preview-title">{{ form.title || '通知标题预览' }}</span>
            </div>
            <div class="preview-body" v-html="previewContent || '通知正文预览'"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="form-actions">
      <el-button @click="goBack">取消</el-button>
      <el-button type="default" @click="handleSaveDraft">保存草稿</el-button>
      <el-button type="primary" @click="handleSend" :loading="sending">
        {{ sendMode === 'scheduled' ? '定时发送' : '立即发送' }}
      </el-button>
    </div>

    <el-dialog
      v-model="templateDialogVisible"
      title="新建通知模板"
      width="600px"
    >
      <el-form :model="templateForm" :rules="templateRules" ref="templateFormRef" label-width="80px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="templateForm.name" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="通知类型" prop="type">
          <el-radio-group v-model="templateForm.type">
            <el-radio value="INFO">信息</el-radio>
            <el-radio value="WARNING">警告</el-radio>
            <el-radio value="SUCCESS">成功</el-radio>
            <el-radio value="URGENT">紧急</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="templateForm.title" placeholder="请输入模板标题" />
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <el-input
            v-model="templateForm.content"
            type="textarea"
            :rows="6"
            placeholder="请输入模板正文，使用 {{变量名}} 定义变量"
          />
        </el-form-item>
        <el-form-item label="变量列表">
          <el-input
            v-model="variablesInput"
            placeholder="多个变量用逗号分隔，例如：username,date,amount"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTemplate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useNotificationStore } from '../stores/notification';
import { notificationApi } from '../api/notification';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, Plus, Delete } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();
const notificationStore = useNotificationStore();

const formRef = ref(null);
const templateFormRef = ref(null);
const users = ref([]);
const tags = ref([]);
const sendMode = ref('instant');
const sending = ref(false);
const isEdit = ref(false);
const templateDialogVisible = ref(false);
const variablesInput = ref('');

const form = reactive({
  id: null,
  type: 'INFO',
  title: '',
  content: '',
  priority: 'MEDIUM',
  targetType: 'ALL',
  targetIds: [],
  scheduledAt: null,
  expiredAt: null,
  templateId: null,
  templateVariables: {},
});

const templateForm = reactive({
  name: '',
  type: 'INFO',
  title: '',
  content: '',
  variables: [],
});

const rules = {
  title: [{ required: true, message: '请输入通知标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入通知正文', trigger: 'blur' }],
  type: [{ required: true, message: '请选择通知类型', trigger: 'change' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
  targetType: [{ required: true, message: '请选择目标范围', trigger: 'change' }],
};

const templateRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  title: [{ required: true, message: '请输入模板标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入模板正文', trigger: 'blur' }],
  type: [{ required: true, message: '请选择通知类型', trigger: 'change' }],
};

const currentTemplate = computed(() => {
  return notificationStore.templates.find(t => t.id === form.templateId) || null;
});

const previewContent = computed(() => {
  if (!form.content) return '';
  let content = form.content;
  if (form.templateVariables) {
    Object.keys(form.templateVariables).forEach(key => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(pattern, form.templateVariables[key] || `{{${key}}}`);
    });
  }
  return content;
});

const fetchUsers = async () => {
  try {
    users.value = await notificationApi.getUsers();
  } catch (e) {
    console.error('Failed to fetch users:', e);
  }
};

const fetchTags = async () => {
  try {
    const result = await notificationApi.getTags();
    const allTags = [];
    if (Array.isArray(result)) {
      result.forEach(group => {
        if (group.tags) {
          allTags.push(...group.tags);
        }
      });
    }
    tags.value = allTags;
  } catch (e) {
    console.error('Failed to fetch tags:', e);
  }
};

const loadNotification = async (id) => {
  try {
    const data = await notificationApi.getNotification(id);
    isEdit.value = true;
    form.id = data.id;
    form.type = data.type;
    form.title = data.title;
    form.content = data.content;
    form.priority = data.priority;
    form.targetType = data.targetType;
    form.targetIds = data.targetIds || [];
    form.scheduledAt = data.scheduledAt;
    form.expiredAt = data.expiredAt;
    form.templateId = data.templateId;
    form.templateVariables = data.templateVariables || {};
    if (data.scheduledAt) {
      sendMode.value = 'scheduled';
    }
  } catch (e) {
    console.error('Failed to load notification:', e);
    ElMessage.error('加载通知失败');
  }
};

const handleTargetTypeChange = () => {
  form.targetIds = [];
};

const selectTemplate = (template) => {
  form.templateId = template.id;
  form.type = template.type;
  form.title = template.title;
  form.content = template.content;
  form.templateVariables = {};
  if (template.variables) {
    template.variables.forEach(v => {
      form.templateVariables[v] = '';
    });
  }
};

const handleVariableChange = () => {
};

const handleSaveDraft = async () => {
  try {
    await formRef.value.validate();
    const data = {
      type: form.type,
      title: form.title,
      content: form.content,
      priority: form.priority,
      targetType: form.targetType,
      targetIds: form.targetIds.length > 0 ? form.targetIds : null,
      scheduledAt: sendMode.value === 'scheduled' ? form.scheduledAt : null,
      expiredAt: form.expiredAt,
      templateId: form.templateId,
      templateVariables: Object.keys(form.templateVariables).length > 0 ? form.templateVariables : null,
    };

    if (form.id) {
      await notificationStore.updateNotification(form.id, data);
    } else {
      await notificationStore.createNotification(data);
    }
    ElMessage.success('草稿保存成功');
    router.push('/notifications');
  } catch (e) {
    if (e !== false) {
      console.error(e);
    }
  }
};

const handleSend = async () => {
  try {
    await formRef.value.validate();

    if (form.targetType !== 'ALL' && form.targetIds.length === 0) {
      ElMessage.warning('请选择目标用户');
      return;
    }

    if (sendMode.value === 'scheduled' && !form.scheduledAt) {
      ElMessage.warning('请选择定时发送时间');
      return;
    }

    sending.value = true;
    const data = {
      notificationId: form.id,
      type: form.type,
      title: form.title,
      content: form.content,
      priority: form.priority,
      targetType: form.targetType,
      targetIds: form.targetIds.length > 0 ? form.targetIds : null,
      scheduledAt: sendMode.value === 'scheduled' ? form.scheduledAt : null,
      expiredAt: form.expiredAt,
      templateId: form.templateId,
      templateVariables: Object.keys(form.templateVariables).length > 0 ? form.templateVariables : null,
    };

    await notificationStore.sendNotification(data);
    ElMessage.success(sendMode.value === 'scheduled' ? '定时发送已设置' : '通知发送成功');
    router.push('/notifications');
  } catch (e) {
    if (e !== false) {
      console.error(e);
    }
  } finally {
    sending.value = false;
  }
};

const openTemplateDialog = () => {
  templateForm.name = '';
  templateForm.type = 'INFO';
  templateForm.title = '';
  templateForm.content = '';
  templateForm.variables = [];
  variablesInput.value = '';
  templateDialogVisible.value = true;
};

const handleCreateTemplate = async () => {
  try {
    await templateFormRef.value.validate();
    const variables = variablesInput.value
      .split(',')
      .map(v => v.trim())
      .filter(v => v);

    await notificationStore.createTemplate({
      ...templateForm,
      variables: variables.length > 0 ? variables : null,
    });

    ElMessage.success('模板创建成功');
    templateDialogVisible.value = false;
    notificationStore.fetchTemplates();
  } catch (e) {
    if (e !== false) {
      console.error(e);
    }
  }
};

const handleDeleteTemplate = async (template) => {
  try {
    await ElMessageBox.confirm(`确定要删除模板"${template.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await notificationStore.deleteTemplate(template.id);
    ElMessage.success('删除成功');
    notificationStore.fetchTemplates();
    if (form.templateId === template.id) {
      form.templateId = null;
    }
  } catch (e) {
    if (e !== 'cancel') {
      console.error(e);
    }
  }
};

const goBack = () => {
  router.push('/notifications');
};

const disabledDate = (time) => {
  return time.getTime() < Date.now() - 8.64e7;
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

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').substring(0, 100);
};

onMounted(async () => {
  await Promise.all([
    fetchUsers(),
    fetchTags(),
    notificationStore.fetchTemplates(),
  ]);

  if (route.query.id) {
    await loadNotification(parseInt(route.query.id));
  }
});
</script>

<style scoped>
.notification-send-page {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: flex-start;
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

.form-card,
.template-card,
.variables-card,
.preview-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.template-list {
  max-height: 400px;
  overflow-y: auto;
}

.template-item {
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #4f46e5;
  background-color: #f8fafc;
}

.template-item.active {
  border-color: #4f46e5;
  background-color: #eef2ff;
}

.template-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.template-item:hover .delete-btn {
  opacity: 1;
}

.template-title {
  font-size: 13px;
  color: #334155;
  margin-bottom: 4px;
  font-weight: 500;
}

.template-content {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 8px;
}

.template-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.preview-content {
  padding: 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  min-height: 150px;
}

.preview-type {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.preview-body {
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding: 20px;
  background-color: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
</style>
