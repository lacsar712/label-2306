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
        <el-button type="success" @click="showBatchTagDialog" :disabled="selectedMembers.length === 0">
          <el-icon class="mr-4"><PriceTag /></el-icon>批量打标 ({{ selectedMembers.length }})
        </el-button>
      </div>
    </div>

    <el-card class="stats-card mb-24" shadow="never">
      <div class="card-header">
        <span class="card-title">标签分布</span>
        <el-button link type="primary" @click="$router.push('/tags')">管理标签</el-button>
      </div>
      <div class="tag-stats-row">
        <div
          v-for="stat in tagStore.tagStats"
          :key="stat.id"
          class="tag-stat-item"
          @click="toggleTagFilter(stat.id)"
          :class="{ active: selectedTagIds.includes(stat.id) }"
        >
          <div class="tag-stat-color" :style="{ backgroundColor: stat.color }"></div>
          <div class="tag-stat-content">
            <div class="tag-stat-name">
              <el-tag
                :color="stat.color + '20'"
                :style="{ color: stat.color, borderColor: stat.color + '40' }"
                effect="plain"
                size="small"
              >
                <span class="color-dot" :style="{ backgroundColor: stat.color }"></span>
                {{ stat.name }}
              </el-tag>
            </div>
            <div class="tag-stat-numbers">
              <span class="tag-count">{{ stat.memberCount }}</span>
              <span class="tag-percent">{{ stat.percentage }}%</span>
            </div>
            <div class="tag-stat-trend" :class="stat.last7DaysChange >= 0 ? 'up' : 'down'">
              <el-icon><CaretTop v-if="stat.last7DaysChange >= 0" /><CaretBottom v-else /></el-icon>
              7日 {{ stat.last7DaysChange >= 0 ? '+' : '' }}{{ stat.last7DaysChange }}
            </div>
          </div>
        </div>
        <div v-if="tagStore.tagStats.length === 0" class="empty-tags">
          <el-empty description="暂无标签数据" :image-size="80" />
        </div>
      </div>
    </el-card>

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
          <el-select v-model="filterStatus" placeholder="会员状态" clearable @change="handleSearch" class="status-select">
            <el-option label="活跃" value="ACTIVE" />
            <el-option label="不活跃" value="INACTIVE" />
            <el-option label="已停用" value="SUSPENDED" />
          </el-select>
          <el-select
            v-model="selectedTagIds"
            multiple
            filterable
            placeholder="选择标签筛选"
            clearable
            @change="handleSearch"
            class="tag-select"
          >
            <el-option-group v-for="group in tagStore.tagGroups" :key="group.id" :label="group.name">
              <el-option
                v-for="tag in group.tags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
            <el-option-group label="未分组" v-if="ungroupedTags.length > 0">
              <el-option
                v-for="tag in ungroupedTags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
          <el-radio-group v-model="tagLogic" size="default" @change="handleSearch">
            <el-radio-button label="AND">同时满足</el-radio-button>
            <el-radio-button label="OR">满足任一</el-radio-button>
          </el-radio-group>
          <el-button type="primary" plain @click="handleSearch">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table
        ref="tableRef"
        v-loading="memberStore.loading"
        :data="memberStore.members"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        row-class-name="member-row"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
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
        <el-table-column label="标签" min-width="240">
          <template #default="{ row }">
            <div class="member-tags">
              <el-tag
                v-for="mt in row.memberTags"
                :key="mt.tag.id"
                :color="mt.tag.color + '20'"
                :style="{ color: mt.tag.color, borderColor: mt.tag.color + '40' }"
                effect="plain"
                size="small"
                class="member-tag-item"
                closable
                @close="handleUnbindTag(row, mt.tag.id)"
              >
                <span class="color-dot" :style="{ backgroundColor: mt.tag.color }"></span>
                {{ mt.tag.name }}
              </el-tag>
              <el-button link type="primary" size="small" @click="openTagBindDialog(row)">
                <el-icon><Plus /></el-icon>添加
              </el-button>
            </div>
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

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="memberStore.page"
          v-model:page-size="memberStore.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="memberStore.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="showAddDialog"
      :title="isEdit ? '编辑会员' : '新增会员'"
      width="520px"
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
        <el-form-item label="会员标签">
          <el-select
            v-model="formTagIds"
            multiple
            filterable
            placeholder="选择标签"
            class="w-full"
          >
            <el-option-group v-for="group in tagStore.tagGroups" :key="group.id" :label="group.name">
              <el-option
                v-for="tag in group.tags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
            <el-option-group label="未分组" v-if="ungroupedTags.length > 0">
              <el-option
                v-for="tag in ungroupedTags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showTagBindDialog"
      :title="`为会员 [${bindingMember?.name}] 添加标签`"
      width="480px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="选择标签">
          <el-select
            v-model="bindingTagIds"
            multiple
            filterable
            placeholder="选择要绑定的标签"
            class="w-full"
          >
            <el-option-group v-for="group in tagStore.tagGroups" :key="group.id" :label="group.name">
              <el-option
                v-for="tag in getAvailableTags(group.tags)"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
            <el-option-group label="未分组" v-if="ungroupedTags.length > 0">
              <el-option
                v-for="tag in getAvailableTags(ungroupedTags)"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="bindingRemark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTagBindDialog = false">取消</el-button>
        <el-button type="primary" :loading="binding" @click="confirmBindTags">确认绑定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showBatchTagDialog"
      title="批量打标"
      width="480px"
      destroy-on-close
    >
      <el-alert
        :title="`已选择 ${selectedMembers.length} 名会员`"
        type="info"
        :closable="false"
        show-icon
        class="mb-16"
      />
      <el-form label-position="top">
        <el-form-item label="选择标签">
          <el-select
            v-model="batchTagId"
            filterable
            placeholder="选择要打标的标签"
            class="w-full"
          >
            <el-option-group v-for="group in tagStore.tagGroups" :key="group.id" :label="group.name">
              <el-option
                v-for="tag in group.tags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
            <el-option-group label="未分组" v-if="ungroupedTags.length > 0">
              <el-option
                v-for="tag in ungroupedTags"
                :key="tag.id"
                :label="tag.name"
                :value="tag.id"
              >
                <span style="float: left">
                  <span class="color-dot" :style="{ backgroundColor: tag.color }"></span>
                  {{ tag.name }}
                </span>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="batchRemark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchTagDialog = false">取消</el-button>
        <el-button type="primary" :loading="batchApplying" :disabled="!batchTagId" @click="confirmBatchTag">
          确认打标
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useMemberStore } from '../stores/member';
import { useTagStore } from '../stores/tag';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, PriceTag, CaretTop, CaretBottom } from '@element-plus/icons-vue';

const memberStore = useMemberStore();
const tagStore = useTagStore();

const search = ref('');
const filterLevel = ref('');
const filterStatus = ref('');
const selectedTagIds = ref([]);
const tagLogic = ref('AND');
const selectedMembers = ref([]);
const showAddDialog = ref(false);
const showTagBindDialog = ref(false);
const showBatchTagDialog = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const binding = ref(false);
const batchApplying = ref(false);
const formRef = ref(null);
const tableRef = ref(null);

const bindingMember = ref(null);
const bindingTagIds = ref([]);
const bindingRemark = ref('');
const batchTagId = ref(null);
const batchRemark = ref('');
const formTagIds = ref([]);

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

const ungroupedTags = computed(() => tagStore.tags.filter(t => !t.groupId));

const getAvailableTags = (tags) => {
  if (!bindingMember.value) return tags;
  const boundTagIds = bindingMember.value.memberTags?.map(mt => mt.tag.id) || [];
  return tags.filter(t => !boundTagIds.includes(t.id));
};

const handleSearch = () => {
  memberStore.setPage(1);
  fetchMembers();
};

const fetchMembers = () => {
  const params = {
    search: search.value || undefined,
    level: filterLevel.value || undefined,
    status: filterStatus.value || undefined,
    tagIds: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined,
    tagLogic: tagLogic.value,
  };
  memberStore.fetchMembers(params);
};

const resetFilters = () => {
  search.value = '';
  filterLevel.value = '';
  filterStatus.value = '';
  selectedTagIds.value = [];
  tagLogic.value = 'AND';
  handleSearch();
};

const toggleTagFilter = (tagId) => {
  const index = selectedTagIds.value.indexOf(tagId);
  if (index > -1) {
    selectedTagIds.value.splice(index, 1);
  } else {
    selectedTagIds.value.push(tagId);
  }
  handleSearch();
};

const handleSelectionChange = (rows) => {
  selectedMembers.value = rows;
};

const handlePageChange = (page) => {
  memberStore.setPage(page);
  fetchMembers();
};

const handleSizeChange = (size) => {
  memberStore.setPageSize(size);
  fetchMembers();
};

const handleEdit = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  formTagIds.value = row.memberTags?.map(mt => mt.tag.id) || [];
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
  formTagIds.value = [];
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (isEdit.value) {
          await memberStore.updateMember(form.id, form);
          if (formTagIds.value.length >= 0) {
            const currentTagIds = (await tagStore.fetchMemberTags(form.id)).map(mt => mt.tagId);
            const toBind = formTagIds.value.filter(id => !currentTagIds.includes(id));
            const toUnbind = currentTagIds.filter(id => !formTagIds.value.includes(id));
            if (toBind.length > 0) await tagStore.bindMemberTags(form.id, toBind, '编辑会员时绑定');
            if (toUnbind.length > 0) await tagStore.unbindMemberTags(form.id, toUnbind, '编辑会员时解绑');
          }
          ElMessage.success('更新成功');
        } else {
          const member = await memberStore.addMember(form);
          if (formTagIds.value.length > 0 && member?.id) {
            await tagStore.bindMemberTags(member.id, formTagIds.value, '创建会员时绑定');
          }
          ElMessage.success('添加成功');
        }
        showAddDialog.value = false;
        fetchMembers();
        await tagStore.fetchTagStats();
      } finally {
        submitting.value = false;
      }
    }
  });
};

const openTagBindDialog = (row) => {
  bindingMember.value = row;
  bindingTagIds.value = [];
  bindingRemark.value = '';
  showTagBindDialog.value = true;
};

const confirmBindTags = async () => {
  if (!bindingMember.value || bindingTagIds.value.length === 0) return;
  binding.value = true;
  try {
    await tagStore.bindMemberTags(bindingMember.value.id, bindingTagIds.value, bindingRemark.value);
    ElMessage.success('绑定成功');
    showTagBindDialog.value = false;
    fetchMembers();
  } finally {
    binding.value = false;
  }
};

const handleUnbindTag = async (row, tagId) => {
  try {
    await ElMessageBox.confirm('确定要移除该标签吗？', '确认', { type: 'warning' });
    await tagStore.unbindMemberTags(row.id, [tagId], '手动移除');
    ElMessage.success('已移除标签');
    fetchMembers();
  } catch {
    // 用户取消
  }
};

const confirmBatchTag = async () => {
  if (!batchTagId.value || selectedMembers.value.length === 0) return;
  batchApplying.value = true;
  try {
    const memberIds = selectedMembers.value.map(m => m.id);
    const result = await tagStore.batchApplyTag(batchTagId.value, memberIds, batchRemark.value);
    ElMessage.success(`成功打标 ${result.success?.length || 0} 人${result.skipped?.length > 0 ? `，跳过 ${result.skipped.length} 人` : ''}`);
    showBatchTagDialog.value = false;
    tableRef.value?.clearSelection();
    fetchMembers();
  } finally {
    batchApplying.value = false;
  }
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

onMounted(async () => {
  await Promise.all([
    tagStore.fetchTagGroups(),
    tagStore.fetchTags(),
    tagStore.fetchTagStats(),
  ]);
  fetchMembers();
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

.stats-card, .filter-card, .table-card {
  border-radius: 12px;
  border: none;
}

.tag-stats-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.tag-stat-item {
  flex: 0 0 auto;
  min-width: 160px;
  display: flex;
  padding: 12px 14px;
  border-radius: 10px;
  background-color: #fafbfc;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.tag-stat-item:hover {
  background-color: #f8fafc;
  transform: translateY(-1px);
}

.tag-stat-item.active {
  background-color: #eff6ff;
  border-color: #4f46e5;
}

.tag-stat-color {
  width: 4px;
  border-radius: 2px;
  margin-right: 10px;
  flex-shrink: 0;
}

.tag-stat-content {
  flex: 1;
  min-width: 0;
}

.tag-stat-name {
  margin-bottom: 4px;
}

.tag-stat-numbers {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;
}

.tag-count {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.tag-percent {
  font-size: 12px;
  color: #94a3b8;
}

.tag-stat-trend {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}

.tag-stat-trend.up { color: #67C23A; }
.tag-stat-trend.down { color: #F56C6C; }

.empty-tags {
  width: 100%;
  display: flex;
  justify-content: center;
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
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  max-width: 280px;
}

.level-select, .status-select {
  width: 140px;
}

.tag-select {
  min-width: 240px;
  flex: 1;
  max-width: 360px;
}

.member-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.member-tag-item {
  margin: 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.mb-24 { margin-bottom: 24px; }
.mb-16 { margin-bottom: 16px; }
.mr-4 { margin-right: 4px; }
.ml-8 { margin-left: 8px; }
.w-full { width: 100%; }

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

.color-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
}
</style>
