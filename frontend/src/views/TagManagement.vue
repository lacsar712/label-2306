<template>
  <div class="tag-management">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员标签管理</h2>
        <p class="page-subtitle">管理标签分组、标签库及自动打标规则</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showGroupDialog = true">
          <el-icon class="mr-4"><FolderAdd /></el-icon>新建分组
        </el-button>
        <el-button type="success" @click="openTagDialog()">
          <el-icon class="mr-4"><Plus /></el-icon>新建标签
        </el-button>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="6">
        <el-card class="group-card" shadow="never">
          <div class="card-header">
            <span class="card-title">标签分组</span>
          </div>
          <div class="group-list">
            <div
              class="group-item"
              :class="{ active: activeGroupId === null }"
              @click="selectGroup(null)"
            >
              <el-icon><Collection /></el-icon>
              <span class="group-name">全部标签</span>
              <el-tag size="small" type="info">{{ totalTagCount }}</el-tag>
            </div>
            <div
              v-for="group in tagStore.tagGroups"
              :key="group.id"
              class="group-item"
              :class="{ active: activeGroupId === group.id }"
              @click="selectGroup(group.id)"
            >
              <div class="group-main">
                <el-icon><Folder /></el-icon>
                <span class="group-name">{{ group.name }}</span>
                <el-tag size="small" type="info">{{ group.tags?.length || 0 }}</el-tag>
              </div>
              <div class="group-actions">
                <el-button link type="primary" size="small" @click.stop="openGroupDialog(group)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-popconfirm title="确定删除该分组吗？组内标签将移至未分组" @confirm="deleteGroup(group.id)">
                  <template #reference>
                    <el-button link type="danger" size="small">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="18">
        <el-card class="stats-card mb-24" shadow="never">
          <div class="card-header">
            <span class="card-title">标签统计概览</span>
          </div>
          <el-row :gutter="16">
            <el-col :span="6" v-for="stat in displayStats" :key="stat.id">
              <div class="stat-item" @click="openTrendDialog(stat)">
                <div class="stat-color" :style="{ backgroundColor: stat.color }"></div>
                <div class="stat-info">
                  <div class="stat-name">{{ stat.name }}</div>
                  <div class="stat-count">
                    <span class="count-num">{{ stat.memberCount }}</span>
                    <span class="count-unit">人</span>
                    <span class="count-percent">({{ stat.percentage }}%)</span>
                  </div>
                  <div class="stat-trend" :class="stat.last7DaysChange >= 0 ? 'up' : 'down'">
                    <el-icon><CaretTop v-if="stat.last7DaysChange >= 0" /><CaretBottom v-else /></el-icon>
                    近7日 {{ Math.abs(stat.last7DaysChange) }}
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <el-card class="tags-card" shadow="never">
          <div class="card-header">
            <span class="card-title">{{ activeGroupName }}</span>
            <el-input
              v-model="searchTag"
              placeholder="搜索标签名称"
              size="small"
              class="tag-search"
              clearable
              @input="debouncedSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>

          <el-table
            v-loading="tagStore.loading"
            :data="filteredTags"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column label="标签" min-width="180">
              <template #default="{ row }">
                <div class="tag-display">
                  <el-tag
                    :color="row.color + '20'"
                    :style="{ color: row.color, borderColor: row.color + '40' }"
                    effect="plain"
                    size="large"
                  >
                    <span class="color-dot" :style="{ backgroundColor: row.color }"></span>
                    {{ row.name }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="group.name" label="分组" min-width="120">
              <template #default="{ row }">
                <span v-if="row.group">{{ row.group.name }}</span>
                <span v-else class="text-muted">未分组</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.description">{{ row.description }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="规则配置" min-width="160">
              <template #default="{ row }">
                <div v-if="row.autoRuleEnabled" class="rule-config">
                  <el-tag size="small" type="success" effect="light">已启用</el-tag>
                  <span class="rule-logic">{{ row.ruleLogic === 'AND' ? '且' : '或' }}逻辑</span>
                  <span class="rule-count">{{ row.ruleConditions?.length || 0 }}个条件</span>
                </div>
                <span v-else class="text-muted">未启用</span>
              </template>
            </el-table-column>
            <el-table-column label="互斥设置" min-width="140">
              <template #default="{ row }">
                <div class="mutex-settings">
                  <el-tag v-if="row.isMutuallyExclusive" size="small" type="warning" effect="light">全局互斥</el-tag>
                  <el-tag v-if="row.uniqueInGroup" size="small" type="primary" effect="light">组内唯一</el-tag>
                  <span v-if="!row.isMutuallyExclusive && !row.uniqueInGroup" class="text-muted">无</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="会员数" width="100" align="center">
              <template #default="{ row }">
                <span class="member-count">{{ getTagMemberCount(row.id) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="260">
              <template #default="{ row }">
                <el-button link type="primary" @click="openTagDialog(row)">编辑</el-button>
                <el-button link type="success" @click="previewRule(row)" v-if="row.autoRuleEnabled">预览命中</el-button>
                <el-popconfirm title="确定删除该标签吗？" @confirm="deleteTag(row.id)">
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="showGroupDialog"
      :title="editingGroup ? '编辑分组' : '新建分组'"
      width="420px"
      destroy-on-close
      @closed="resetGroupForm"
    >
      <el-form :model="groupForm" :rules="groupRules" ref="groupFormRef" label-position="top">
        <el-form-item label="分组名称" prop="name">
          <el-input v-model="groupForm.name" placeholder="如：消费行为、生命周期、营销偏好" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="groupForm.description" type="textarea" :rows="3" placeholder="分组描述（选填）" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="groupForm.sortOrder" :min="0" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGroupDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitGroupForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showTagDialog"
      :title="editingTag ? '编辑标签' : '新建标签'"
      width="640px"
      destroy-on-close
      @closed="resetTagForm"
    >
      <el-form :model="tagForm" :rules="tagRules" ref="tagFormRef" label-position="top">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="标签名称" prop="name">
              <el-input v-model="tagForm.name" placeholder="如：高价值会员" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标签颜色" prop="color">
              <div class="color-picker-wrap">
                <el-color-picker v-model="tagForm.color" />
                <el-input v-model="tagForm.color" class="color-input" />
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="所属分组" prop="groupId">
              <el-select v-model="tagForm.groupId" placeholder="选择分组（选填）" class="w-full" clearable>
                <el-option
                  v-for="g in tagStore.tagGroups"
                  :key="g.id"
                  :label="g.name"
                  :value="g.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="互斥设置">
              <div class="mutex-options">
                <el-checkbox v-model="tagForm.isMutuallyExclusive">全局互斥</el-checkbox>
                <el-checkbox v-model="tagForm.uniqueInGroup">组内唯一</el-checkbox>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="标签描述" prop="description">
          <el-input v-model="tagForm.description" type="textarea" :rows="2" placeholder="标签描述（选填）" />
        </el-form-item>

        <el-divider content-position="left">自动打标规则</el-divider>
        <el-form-item>
          <el-switch v-model="tagForm.autoRuleEnabled" active-text="启用自动打标" />
        </el-form-item>
        <template v-if="tagForm.autoRuleEnabled">
          <el-form-item label="条件逻辑">
            <el-radio-group v-model="tagForm.ruleLogic">
              <el-radio label="AND">全部满足（AND）</el-radio>
              <el-radio label="OR">满足任一（OR）</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="规则条件">
            <div class="rule-conditions">
              <div v-for="(cond, index) in tagForm.ruleConditions" :key="index" class="rule-condition-item">
                <el-select v-model="cond.field" placeholder="字段" class="cond-field">
                  <el-option label="积分" value="POINTS" />
                  <el-option label="会员等级" value="LEVEL" />
                  <el-option label="会员状态" value="STATUS" />
                  <el-option label="加入时间" value="JOIN_DATE" />
                </el-select>
                <el-select v-model="cond.operator" placeholder="操作符" class="cond-operator">
                  <el-option label="等于" value="EQ" />
                  <el-option label="不等于" value="NE" />
                  <el-option label="大于" value="GT" />
                  <el-option label="大于等于" value="GTE" />
                  <el-option label="小于" value="LT" />
                  <el-option label="小于等于" value="LTE" />
                  <el-option label="介于" value="BETWEEN" />
                  <el-option label="包含" value="IN" />
                </el-select>
                <el-input
                  v-if="cond.field !== 'BETWEEN' && cond.field !== 'IN'"
                  v-model="cond.value"
                  placeholder="值"
                  class="cond-value"
                />
                <el-input
                  v-else
                  v-model="cond.valueStr"
                  placeholder="多个值用逗号分隔"
                  class="cond-value"
                />
                <el-button link type="danger" @click="removeCondition(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
              <el-button type="primary" plain size="small" @click="addCondition">
                <el-icon><Plus /></el-icon>添加条件
              </el-button>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showTagDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitTagForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showPreviewDialog"
      :title="`预览命中 - ${previewingTag?.name}`"
      width="720px"
      destroy-on-close
    >
      <div class="preview-header">
        <el-alert
          :title="`共命中 ${previewResult.total} 名会员（显示前100名）`"
          type="info"
          :closable="false"
          show-icon
        />
      </div>
      <el-table :data="previewResult.members" max-height="400" style="width: 100%">
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="phone" label="手机号" min-width="120" />
        <el-table-column prop="level" label="等级" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)">{{ getLevelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" width="80" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <span :class="'status-' + row.status.toLowerCase()">{{ getStatusLabel(row.status) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="applyingRule"
          @click="applyRule"
          :disabled="previewResult.total === 0"
        >
          确认打标（{{ previewResult.total }}人）
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showTrendDialog"
      :title="`${viewingTrendTag?.name} - 近7日变动趋势`"
      width="600px"
      destroy-on-close
    >
      <div ref="trendChartRef" class="trend-chart"></div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useTagStore } from '../stores/tag';
import { ElMessage } from 'element-plus';
import {
  Plus, FolderAdd, Folder, Collection, Edit, Delete, Search,
  CaretTop, CaretBottom
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';

const tagStore = useTagStore();

const activeGroupId = ref(null);
const searchTag = ref('');
const showGroupDialog = ref(false);
const showTagDialog = ref(false);
const showPreviewDialog = ref(false);
const showTrendDialog = ref(false);
const submitting = ref(false);
const applyingRule = ref(false);
const editingGroup = ref(null);
const editingTag = ref(null);
const previewingTag = ref(null);
const viewingTrendTag = ref(null);
const previewResult = reactive({ members: [], total: 0 });
const trendChartRef = ref(null);
let trendChart = null;
let searchTimer = null;

const groupForm = reactive({
  id: null,
  name: '',
  description: '',
  sortOrder: 0
});

const tagForm = reactive({
  id: null,
  name: '',
  color: '#409EFF',
  description: '',
  groupId: null,
  isMutuallyExclusive: false,
  uniqueInGroup: false,
  autoRuleEnabled: false,
  ruleLogic: 'AND',
  ruleConditions: []
});

const groupFormRef = ref(null);
const tagFormRef = ref(null);

const groupRules = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }],
};

const tagRules = {
  name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }],
  color: [{ required: true, message: '请选择标签颜色', trigger: 'change' }],
};

const totalTagCount = computed(() => tagStore.tags.length);

const activeGroupName = computed(() => {
  if (activeGroupId.value === null) return '全部标签';
  const group = tagStore.tagGroups.find(g => g.id === activeGroupId.value);
  return group ? group.name : '全部标签';
});

const displayStats = computed(() => tagStore.tagStats.slice(0, 4));

const filteredTags = computed(() => {
  let tags = tagStore.tags;
  if (activeGroupId.value !== null) {
    tags = tags.filter(t => t.groupId === activeGroupId.value);
  }
  if (searchTag.value) {
    const keyword = searchTag.value.toLowerCase();
    tags = tags.filter(t => t.name.toLowerCase().includes(keyword));
  }
  return tags;
});

const debouncedSearch = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {}, 300);
};

const selectGroup = (groupId) => {
  activeGroupId.value = groupId;
};

const getTagMemberCount = (tagId) => {
  const stat = tagStore.tagStats.find(s => s.id === tagId);
  return stat?.memberCount || 0;
};

const openGroupDialog = (group = null) => {
  editingGroup.value = group;
  if (group) {
    Object.assign(groupForm, group);
  }
  showGroupDialog.value = true;
};

const resetGroupForm = () => {
  editingGroup.value = null;
  groupForm.id = null;
  groupForm.name = '';
  groupForm.description = '';
  groupForm.sortOrder = 0;
};

const submitGroupForm = async () => {
  if (!groupFormRef.value) return;
  await groupFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (editingGroup.value) {
          await tagStore.updateTagGroup(groupForm.id, groupForm);
          ElMessage.success('更新成功');
        } else {
          await tagStore.createTagGroup(groupForm);
          ElMessage.success('创建成功');
        }
        showGroupDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const deleteGroup = async (id) => {
  await tagStore.deleteTagGroup(id);
  ElMessage.success('删除成功');
  if (activeGroupId.value === id) activeGroupId.value = null;
};

const openTagDialog = (tag = null) => {
  editingTag.value = tag;
  if (tag) {
    Object.assign(tagForm, {
      ...tag,
      ruleConditions: tag.ruleConditions?.map(c => ({
        ...c,
        valueStr: Array.isArray(c.value) ? c.value.join(',') : c.value
      })) || []
    });
  }
  showTagDialog.value = true;
};

const resetTagForm = () => {
  editingTag.value = null;
  tagForm.id = null;
  tagForm.name = '';
  tagForm.color = '#409EFF';
  tagForm.description = '';
  tagForm.groupId = null;
  tagForm.isMutuallyExclusive = false;
  tagForm.uniqueInGroup = false;
  tagForm.autoRuleEnabled = false;
  tagForm.ruleLogic = 'AND';
  tagForm.ruleConditions = [];
};

const addCondition = () => {
  tagForm.ruleConditions.push({ field: 'POINTS', operator: 'GTE', value: '', valueStr: '' });
};

const removeCondition = (index) => {
  tagForm.ruleConditions.splice(index, 1);
};

const submitTagForm = async () => {
  if (!tagFormRef.value) return;
  await tagFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        const submitData = {
          ...tagForm,
          ruleConditions: tagForm.autoRuleEnabled
            ? tagForm.ruleConditions.map(c => {
                if (c.operator === 'BETWEEN' || c.operator === 'IN') {
                  return { ...c, value: c.valueStr?.split(',').map(s => s.trim()).filter(Boolean) || [] };
                }
                return { ...c, value: isNaN(Number(c.value)) ? c.value : Number(c.value) };
              })
            : null
        };
        if (editingTag.value) {
          await tagStore.updateTag(tagForm.id, submitData);
          ElMessage.success('更新成功');
        } else {
          await tagStore.createTag(submitData);
          ElMessage.success('创建成功');
        }
        showTagDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const deleteTag = async (id) => {
  await tagStore.deleteTag(id);
  ElMessage.success('删除成功');
};

const previewRule = async (tag) => {
  previewingTag.value = tag;
  const result = await tagStore.previewTagRule(tag.id);
  previewResult.members = result.members;
  previewResult.total = result.total;
  showPreviewDialog.value = true;
};

const applyRule = async () => {
  if (!previewingTag.value) return;
  applyingRule.value = true;
  try {
    const result = await tagStore.runTagRule(previewingTag.value.id);
    ElMessage.success(`成功打标 ${result.success?.length || 0} 人`);
    showPreviewDialog.value = false;
    await tagStore.fetchTagStats();
  } finally {
    applyingRule.value = false;
  }
};

const openTrendDialog = async (stat) => {
  viewingTrendTag.value = stat;
  showTrendDialog.value = true;
  await nextTick();
  renderTrendChart(stat);
};

const renderTrendChart = (stat) => {
  if (!trendChartRef.value) return;
  if (trendChart) trendChart.dispose();
  trendChart = echarts.init(trendChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['打标', '摘标', '净变化'],
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stat.dailyTrend?.map(d => d.date.slice(5)) || []
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '打标',
        type: 'line',
        smooth: true,
        data: stat.dailyTrend?.map(d => d.bindings) || [],
        itemStyle: { color: '#67C23A' },
        areaStyle: { color: 'rgba(103,194,58,0.1)' }
      },
      {
        name: '摘标',
        type: 'line',
        smooth: true,
        data: stat.dailyTrend?.map(d => d.unbindings) || [],
        itemStyle: { color: '#F56C6C' },
        areaStyle: { color: 'rgba(245,108,108,0.1)' }
      },
      {
        name: '净变化',
        type: 'bar',
        data: stat.dailyTrend?.map(d => d.net) || [],
        itemStyle: { color: '#409EFF' }
      }
    ]
  };
  trendChart.setOption(option);
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

watch(showTrendDialog, (val) => {
  if (!val && trendChart) {
    trendChart.dispose();
    trendChart = null;
  }
});

onMounted(async () => {
  await Promise.all([
    tagStore.fetchTagGroups(),
    tagStore.fetchTags(),
    tagStore.fetchTagStats(),
  ]);
});
</script>

<style scoped>
.tag-management {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.group-card, .tags-card, .stats-card {
  border-radius: 12px;
  border: none;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.group-item:hover {
  background-color: #f8fafc;
}

.group-item.active {
  background-color: #eff6ff;
  color: #4f46e5;
  font-weight: 600;
}

.group-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.group-name {
  flex: 1;
  font-size: 14px;
}

.group-actions {
  display: none;
  gap: 4px;
}

.group-item:hover .group-actions {
  display: flex;
}

.tag-search {
  width: 200px;
}

.tag-display {
  display: flex;
  align-items: center;
}

.color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.rule-config {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rule-logic, .rule-count {
  font-size: 12px;
  color: #64748b;
}

.mutex-settings {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.member-count {
  font-weight: 600;
  color: #1e293b;
}

.stat-item {
  display: flex;
  padding: 16px;
  border-radius: 10px;
  background-color: #fafbfc;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.stat-item:hover {
  background-color: #f8fafc;
  border-color: #e2e8f0;
  transform: translateY(-1px);
}

.stat-color {
  width: 4px;
  border-radius: 2px;
  margin-right: 12px;
}

.stat-info {
  flex: 1;
}

.stat-name {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-count {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.count-num {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

.count-unit {
  font-size: 12px;
  color: #64748b;
}

.count-percent {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 4px;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  margin-top: 4px;
}

.stat-trend.up { color: #67C23A; }
.stat-trend.down { color: #F56C6C; }

.mb-24 { margin-bottom: 24px; }
.mr-4 { margin-right: 4px; }
.text-muted { color: #94a3b8; }
.w-full { width: 100%; }

.color-picker-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  flex: 1;
}

.mutex-options {
  display: flex;
  gap: 16px;
}

.rule-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.rule-condition-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.cond-field {
  width: 120px;
  flex-shrink: 0;
}

.cond-operator {
  width: 110px;
  flex-shrink: 0;
}

.cond-value {
  flex: 1;
}

.preview-header {
  margin-bottom: 16px;
}

.trend-chart {
  width: 100%;
  height: 300px;
}

.status-active { color: #67C23A; font-weight: 500; }
.status-inactive { color: #909399; }
.status-suspended { color: #F56C6C; }
</style>
