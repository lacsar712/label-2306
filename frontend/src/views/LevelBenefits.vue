<template>
  <div class="level-benefits">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">等级权益管理</h2>
        <p class="page-subtitle">按等级配置会员权益，支持审批流、版本历史与影响预览</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openCreateDialog(currentLevel)">
          <el-icon class="mr-4"><Plus /></el-icon>新建权益
        </el-button>
      </div>
    </div>

    <el-row :gutter="24" class="stats-row">
      <el-col :span="6" v-for="(stat, level) in benefitStats" :key="level">
        <el-card class="stat-card" shadow="hover" :class="['level-' + level.toLowerCase()]" @click="activeLevel = level">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">{{ getLevelLabel(level) }}</span>
              <span class="stat-value">{{ stat?.published || 0 }} 项权益</span>
              <div class="stat-sub">
                <el-tag size="small" type="info" effect="plain">草稿 {{ stat?.draft || 0 }}</el-tag>
                <el-tag size="small" type="warning" effect="plain" style="margin-left: 4px">待审 {{ stat?.pending || 0 }}</el-tag>
              </div>
            </div>
            <div class="stat-icon">
              <el-icon><Medal /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="main-card">
      <el-tabs v-model="currentLevel" class="level-tabs" @tab-change="handleLevelChange">
        <el-tab-pane
          v-for="level in LEVELS"
          :key="level"
          :label="getLevelLabel(level)"
          :name="level"
        >
          <template #label>
            <span class="tab-label">
              <el-icon :size="16"><Medal /></el-icon>
              {{ getLevelLabel(level) }}
              <el-badge
                v-if="benefitStats[level]?.pending > 0"
                :value="benefitStats[level].pending"
                type="warning"
                class="pending-badge"
              />
            </span>
          </template>

          <div class="benefit-list" v-loading="store.loading">
            <div
              v-for="(benefit, index) in currentBenefits"
              :key="benefit.id"
              class="benefit-item"
              :class="{ dragging: dragItem?.id === benefit.id }"
              draggable="true"
              @dragstart="handleDragStart($event, benefit, index)"
              @dragover.prevent="handleDragOver($event, index)"
              @dragend="handleDragEnd"
              @drop="handleDrop($event, index)"
            >
              <div class="benefit-drag-handle" title="拖拽排序">
                <el-icon :size="18"><Rank /></el-icon>
              </div>

              <div class="benefit-icon" v-if="benefit.icon">
                <el-icon :size="24"><component :is="benefit.icon" /></el-icon>
              </div>
              <div class="benefit-icon benefit-icon-default" v-else>
                <el-icon :size="24"><Star /></el-icon>
              </div>

              <div class="benefit-body">
                <div class="benefit-header">
                  <span class="benefit-title">{{ benefit.title }}</span>
                  <el-tag :type="getStatusTag(benefit.status)" effect="dark" size="small" class="benefit-status">
                    {{ getStatusLabel(benefit.status) }}
                  </el-tag>
                  <el-tag v-if="!benefit.isEnabled" type="info" size="small" effect="plain" style="margin-left: 4px">已停用</el-tag>
                  <span v-if="benefit.minPoints > 0" class="benefit-points">
                    <el-icon><Coin /></el-icon>{{ benefit.minPoints }} 积分以上
                  </span>
                </div>
                <div class="benefit-desc" v-html="benefit.description"></div>
                <div class="benefit-meta">
                  <span>排序: {{ benefit.sortOrder }}</span>
                  <span>版本: {{ benefit._count?.versions || 0 }}</span>
                  <span v-if="benefit.operator">操作人: {{ benefit.operator.username }}</span>
                  <span>{{ formatDate(benefit.updatedAt) }}</span>
                </div>
              </div>

              <div class="benefit-actions">
                <el-dropdown trigger="click" @command="(cmd) => handleAction(cmd, benefit)">
                  <el-button circle>
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit" :disabled="benefit.status === 'PUBLISHED'">
                        <el-icon><Edit /></el-icon>编辑
                      </el-dropdown-item>
                      <el-dropdown-item command="preview">
                        <el-icon><View /></el-icon>预览影响
                      </el-dropdown-item>
                      <el-dropdown-item command="versions">
                        <el-icon><Document /></el-icon>版本历史
                      </el-dropdown-item>
                      <el-dropdown-item command="copy">
                        <el-icon><CopyDocument /></el-icon>复制到其他等级
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="benefit.status === 'DRAFT'"
                        command="submit"
                      >
                        <el-icon><Promotion /></el-icon>提交审核
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="benefit.status === 'PENDING_REVIEW'"
                        command="publish"
                      >
                        <el-icon><CircleCheck /></el-icon>审核通过并发布
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="benefit.status === 'PENDING_REVIEW'"
                        command="reject"
                      >
                        <el-icon><CloseBold /></el-icon>驳回为草稿
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="benefit.status === 'PUBLISHED'"
                        command="unpublish"
                      >
                        <el-icon><RefreshLeft /></el-icon>撤回草稿
                      </el-dropdown-item>
                      <el-dropdown-item
                        command="delete"
                        :disabled="benefit.status === 'PUBLISHED'"
                        divided
                      >
                        <el-icon><Delete /></el-icon>删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>

            <el-empty v-if="currentBenefits.length === 0" description="该等级暂无权益配置" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingBenefit ? '编辑权益' : '新建权益'"
      width="720px"
      destroy-on-close
    >
      <el-form :model="benefitForm" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="权益标题" prop="title">
          <el-input v-model="benefitForm.title" placeholder="输入权益标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="所属等级" prop="level">
          <el-select v-model="benefitForm.level" style="width: 100%">
            <el-option v-for="lvl in LEVELS" :key="lvl" :label="getLevelLabel(lvl)" :value="lvl" />
          </el-select>
        </el-form-item>
        <el-form-item label="图标标识" prop="icon">
          <el-select v-model="benefitForm.icon" placeholder="选择图标（可选）" clearable style="width: 100%">
            <el-option label="Star 星标" value="Star" />
            <el-option label="Present 礼物" value="Present" />
            <el-option label="Trophy 奖杯" value="Trophy" />
            <el-option label="Medal 奖章" value="Medal" />
            <el-option label="Stamp 印章" value="Stamp" />
            <el-option label="Coin 金币" value="Coin" />
            <el-option label="Wallet 钱包" value="Wallet" />
            <el-option label="CreditCard 卡片" value="CreditCard" />
            <el-option label="Goods 商品" value="Goods" />
            <el-option label="Discount 折扣" value="Discount" />
            <el-option label="Lightning 闪电" value="Lightning" />
            <el-option label="Briefcase 专属" value="Briefcase" />
            <el-option label="Box 礼盒" value="Box" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效条件" prop="minPoints">
          <el-input-number v-model="benefitForm.minPoints" :min="0" style="width: 100%" />
          <div class="form-tip">持有积分下限，达到此积分的会员可享受该权益（0 表示无限制）</div>
        </el-form-item>
        <el-form-item label="排序权重" prop="sortOrder">
          <el-input-number v-model="benefitForm.sortOrder" :min="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="启用状态" prop="isEnabled">
          <el-switch v-model="benefitForm.isEnabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="详细描述" prop="description">
          <div class="rich-editor-wrapper">
            <div class="editor-toolbar">
              <el-button-group size="small">
                <el-button @click="execCmd('bold')"><b>B</b></el-button>
                <el-button @click="execCmd('italic')"><i>I</i></el-button>
                <el-button @click="execCmd('underline')"><u>U</u></el-button>
                <el-button @click="execCmd('insertUnorderedList')"><el-icon><List /></el-icon></el-button>
                <el-button @click="execCmd('insertOrderedList')"><el-icon><Sort /></el-icon></el-button>
                <el-button @click="insertLink"><el-icon><Link /></el-icon></el-button>
              </el-button-group>
            </div>
            <div
              ref="editorRef"
              class="rich-editor"
              contenteditable="true"
              @input="onEditorInput"
              @blur="onEditorBlur"
              placeholder="输入权益详细描述，支持富文本..."
            ></div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave" :loading="submitting">保存为草稿</el-button>
          <el-button type="success" @click="handleSaveAndSubmit" :loading="submitting" v-if="!editingBenefit || editingBenefit.status !== 'PUBLISHED'">
            保存并提交审核
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="copyDialogVisible"
      title="复制权益到其他等级"
      width="480px"
    >
      <el-form label-width="100px">
        <el-form-item label="源权益">
          <span>{{ copyingBenefit?.title }}</span>
        </el-form-item>
        <el-form-item label="目标等级">
          <el-select v-model="copyTargetLevel" style="width: 100%">
            <el-option
              v-for="lvl in LEVELS.filter(l => l !== copyingBenefit?.level)"
              :key="lvl"
              :label="getLevelLabel(lvl)"
              :value="lvl"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="复制排序">
          <el-switch v-model="copyWithSortOrder" active-text="是" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCopy" :loading="submitting">确认复制</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="previewDialogVisible"
      title="权益影响范围预览"
      width="560px"
    >
      <div v-loading="previewLoading" class="preview-content">
        <div class="preview-header">
          <h4>{{ previewingBenefit?.title }}</h4>
          <el-tag :type="getStatusTag(previewingBenefit?.status)" size="small">
            {{ getStatusLabel(previewingBenefit?.status) }}
          </el-tag>
        </div>

        <el-descriptions :column="2" border size="small" class="preview-desc">
          <el-descriptions-item label="所属等级">{{ getLevelLabel(previewingBenefit?.level) }}</el-descriptions-item>
          <el-descriptions-item label="积分门槛">{{ previewingBenefit?.minPoints || 0 }} 以上</el-descriptions-item>
          <el-descriptions-item label="启用状态">
            {{ previewingBenefit?.isEnabled ? '启用' : '停用' }}
          </el-descriptions-item>
          <el-descriptions-item label="影响会员总数">
            <span class="preview-total">{{ impactPreview?.totalAffectedMembers || 0 }} 人</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="preview-levels">
          <h5>受影响等级会员分布：</h5>
          <div v-if="impactPreview?.byLevel" class="level-breakdown">
            <div v-for="(count, lvl) in impactPreview.byLevel" :key="lvl" class="level-row">
              <span class="level-name">{{ getLevelLabel(lvl) }}</span>
              <el-progress
                :percentage="impactPreview.totalAffectedMembers ? Math.round((count / impactPreview.totalAffectedMembers) * 100) : 0"
                :stroke-width="8"
                :show-text="false"
                style="flex: 1; margin: 0 16px"
              />
              <span class="level-count">{{ count }} 人</span>
            </div>
          </div>
          <el-empty v-else description="暂无影响数据" :image-size="60" />
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="versionDialogVisible"
      title="版本历史"
      width="720px"
    >
      <div v-loading="versionLoading">
        <el-timeline>
          <el-timeline-item
            v-for="ver in versionList"
            :key="ver.id"
            :timestamp="formatDate(ver.createdAt)"
            placement="top"
          >
            <el-card shadow="never" class="version-card">
              <div class="version-header">
                <span class="version-tag">v{{ ver.version }}</span>
                <el-tag :type="getStatusTag(ver.status)" size="small" effect="plain">
                  {{ getStatusLabel(ver.status) }}
                </el-tag>
                <span class="version-operator" v-if="ver.operator">
                  {{ ver.operator.username }}
                </span>
              </div>
              <div class="version-title">{{ ver.title }}</div>
              <div class="version-desc" v-html="ver.description"></div>
              <div class="version-meta">
                <span>等级: {{ getLevelLabel(ver.level) }}</span>
                <span>积分: {{ ver.minPoints }}</span>
                <span>排序: {{ ver.sortOrder }}</span>
                <span>{{ ver.isEnabled ? '启用' : '停用' }}</span>
              </div>
              <div class="version-remark" v-if="ver.changeRemark">
                <el-icon><ChatDotRound /></el-icon>{{ ver.changeRemark }}
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="versionList.length === 0" description="暂无历史版本" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useLevelBenefitStore } from '../stores/levelBenefit';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import {
  Plus, Medal, Rank, Star, Coin, Edit, View, Document, CopyDocument,
  Promotion, CircleCheck, CloseBold, RefreshLeft, Delete, MoreFilled,
  List, Sort, Link, ChatDotRound, Present, Trophy, CreditCard, Goods,
  Discount, Lightning, Wallet, Box, Briefcase, Stamp
} from '@element-plus/icons-vue';

const store = useLevelBenefitStore();

const LEVELS = ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'];
const currentLevel = ref('NORMAL');

const benefitStats = computed(() => store.summary || {});
const currentBenefits = computed(() => store.benefitsByLevel[currentLevel.value] || []);

const dialogVisible = ref(false);
const editingBenefit = ref(null);
const submitting = ref(false);
const formRef = ref(null);
const editorRef = ref(null);

const copyDialogVisible = ref(false);
const copyingBenefit = ref(null);
const copyTargetLevel = ref('');
const copyWithSortOrder = ref(false);

const previewDialogVisible = ref(false);
const previewingBenefit = ref(null);
const previewLoading = ref(false);
const impactPreview = ref(null);

const versionDialogVisible = ref(false);
const versionLoading = ref(false);
const versionList = ref([]);

const dragItem = ref(null);
const dragIndex = ref(null);

const benefitForm = reactive({
  title: '',
  description: '',
  icon: null,
  level: 'NORMAL',
  sortOrder: 0,
  minPoints: 0,
  isEnabled: true,
});

const formRules = {
  title: [{ required: true, message: '请输入权益标题', trigger: 'blur' }],
  level: [{ required: true, message: '请选择所属等级', trigger: 'change' }],
  description: [{ required: true, message: '请输入权益描述', trigger: 'blur' }],
};

function getLevelLabel(level) {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
}

function getStatusTag(status) {
  const map = { DRAFT: 'info', PENDING_REVIEW: 'warning', PUBLISHED: 'success' };
  return map[status] || 'info';
}

function getStatusLabel(status) {
  const map = { DRAFT: '草稿', PENDING_REVIEW: '待审核', PUBLISHED: '已发布' };
  return map[status] || status;
}

function formatDate(date) {
  if (!date) return '';
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

async function handleLevelChange() {
  await store.fetchAllByLevel();
}

function openCreateDialog(level) {
  editingBenefit.value = null;
  benefitForm.title = '';
  benefitForm.description = '';
  benefitForm.icon = null;
  benefitForm.level = level;
  benefitForm.sortOrder = (currentBenefits.value?.length || 0);
  benefitForm.minPoints = 0;
  benefitForm.isEnabled = true;
  dialogVisible.value = true;
  nextTick(() => {
    if (editorRef.value) editorRef.value.innerHTML = '';
  });
}

function openEditDialog(benefit) {
  editingBenefit.value = benefit;
  benefitForm.title = benefit.title;
  benefitForm.description = benefit.description;
  benefitForm.icon = benefit.icon;
  benefitForm.level = benefit.level;
  benefitForm.sortOrder = benefit.sortOrder;
  benefitForm.minPoints = benefit.minPoints;
  benefitForm.isEnabled = benefit.isEnabled;
  dialogVisible.value = true;
  nextTick(() => {
    if (editorRef.value) editorRef.value.innerHTML = benefit.description || '';
  });
}

function execCmd(cmd, value = null) {
  document.execCommand(cmd, false, value);
  editorRef.value?.focus();
  onEditorInput();
}

function insertLink() {
  const url = prompt('请输入链接地址:', 'https://');
  if (url) execCmd('createLink', url);
}

function onEditorInput() {
  benefitForm.description = editorRef.value?.innerHTML || '';
}

function onEditorBlur() {
  benefitForm.description = editorRef.value?.innerHTML || '';
}

async function handleSave() {
  await doSave(false);
}

async function handleSaveAndSubmit() {
  await doSave(true);
}

async function doSave(submitForReview) {
  submitting.value = true;
  try {
    await formRef.value.validate();
    let result;
    if (editingBenefit.value) {
      result = await store.updateBenefit(editingBenefit.value.id, { ...benefitForm });
    } else {
      result = await store.createBenefit({ ...benefitForm });
    }
    if (submitForReview && result) {
      await store.updateStatus(result.id, 'PENDING_REVIEW', '提交审核');
    }
    ElMessage.success(editingBenefit.value ? '权益已更新' : '权益已创建');
    dialogVisible.value = false;
  } catch (e) {
    if (e !== false) {
      ElMessage.error(e.message || '保存失败');
    }
  } finally {
    submitting.value = false;
  }
}

async function handleAction(cmd, benefit) {
  switch (cmd) {
    case 'edit':
      openEditDialog(benefit);
      break;
    case 'preview':
      await openPreview(benefit);
      break;
    case 'versions':
      await openVersions(benefit);
      break;
    case 'copy':
      copyingBenefit.value = benefit;
      copyTargetLevel.value = LEVELS.find(l => l !== benefit.level) || 'NORMAL';
      copyWithSortOrder.value = false;
      copyDialogVisible.value = true;
      break;
    case 'submit':
      await changeStatus(benefit, 'PENDING_REVIEW', '提交审核');
      break;
    case 'publish':
      await changeStatus(benefit, 'PUBLISHED', '审核通过并发布');
      break;
    case 'reject':
      await changeStatus(benefit, 'DRAFT', '审核驳回');
      break;
    case 'unpublish':
      await changeStatus(benefit, 'DRAFT', '撤回为草稿');
      break;
    case 'delete':
      await confirmDelete(benefit);
      break;
  }
}

async function changeStatus(benefit, status, actionLabel) {
  try {
    await ElMessageBox.confirm(`确定要${actionLabel} "${benefit.title}" 吗？`, '确认操作', {
      type: 'warning',
    });
    await store.updateStatus(benefit.id, status, actionLabel);
    ElMessage.success(`${actionLabel}成功`);
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '操作失败');
  }
}

async function confirmDelete(benefit) {
  try {
    await ElMessageBox.confirm(`确定要删除 "${benefit.title}" 吗？此操作不可撤销。`, '删除确认', {
      type: 'error',
    });
    await store.removeBenefit(benefit.id);
    ElMessage.success('删除成功');
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败');
  }
}

async function confirmCopy() {
  if (!copyTargetLevel.value) {
    ElMessage.warning('请选择目标等级');
    return;
  }
  submitting.value = true;
  try {
    await store.copy(copyingBenefit.value.id, copyTargetLevel.value, copyWithSortOrder.value);
    ElMessage.success(`已复制到${getLevelLabel(copyTargetLevel.value)}`);
    copyDialogVisible.value = false;
  } catch (e) {
    ElMessage.error(e.message || '复制失败');
  } finally {
    submitting.value = false;
  }
}

async function openPreview(benefit) {
  previewingBenefit.value = benefit;
  previewDialogVisible.value = true;
  previewLoading.value = true;
  impactPreview.value = null;
  try {
    const data = await store.fetchImpactPreview(benefit.id, {
      level: benefit.level,
      minPoints: benefit.minPoints,
      isEnabled: benefit.isEnabled,
      status: benefit.status,
    });
    impactPreview.value = data;
  } catch (e) {
    ElMessage.error('获取影响预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function openVersions(benefit) {
  versionDialogVisible.value = true;
  versionLoading.value = true;
  versionList.value = [];
  try {
    versionList.value = await store.fetchVersions(benefit.id);
  } catch (e) {
    ElMessage.error('获取版本历史失败');
  } finally {
    versionLoading.value = false;
  }
}

function handleDragStart(e, benefit, index) {
  dragItem.value = benefit;
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e, index) {
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e, dropIndex) {
  if (dragItem.value === null || dragIndex.value === dropIndex) return;
  const list = [...currentBenefits.value];
  const [moved] = list.splice(dragIndex.value, 1);
  list.splice(dropIndex, 0, moved);
  const reorderItems = list.map((b, i) => ({ id: b.id, sortOrder: i }));
  store.reorder(reorderItems);
  dragItem.value = null;
  dragIndex.value = null;
}

function handleDragEnd() {
  dragItem.value = null;
  dragIndex.value = null;
}

onMounted(async () => {
  await store.fetchSummary();
  await store.fetchAllByLevel();
});
</script>

<style scoped>
.level-benefits {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  border: 1px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.stat-card:hover {
  border-color: #4f46e5;
  transform: translateY(-2px);
}

.stat-card.level-normal:hover { border-color: #64748b; }
.stat-card.level-silver:hover { border-color: #94a3b8; }
.stat-card.level-gold:hover { border-color: #f59e0b; }
.stat-card.level-platinum:hover { border-color: #8b5cf6; }

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  display: block;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  display: block;
  margin-bottom: 8px;
}

.stat-sub {
  display: flex;
  gap: 4px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.level-normal .stat-icon { background: linear-gradient(135deg, #64748b, #475569); }
.level-silver .stat-icon { background: linear-gradient(135deg, #94a3b8, #64748b); }
.level-gold .stat-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.level-platinum .stat-icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }

.main-card {
  border-radius: 12px;
}

.level-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 2px;
  background-color: #e2e8f0;
}

.level-tabs :deep(.el-tabs__item) {
  height: 48px;
  font-size: 15px;
  font-weight: 500;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pending-badge {
  margin-left: 4px;
}

.benefit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
  min-height: 200px;
}

.benefit-item {
  display: flex;
  align-items: stretch;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
  gap: 16px;
}

.benefit-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.benefit-item.dragging {
  opacity: 0.5;
  border-style: dashed;
}

.benefit-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  cursor: grab;
  padding: 0 4px;
  user-select: none;
}

.benefit-drag-handle:hover {
  color: #4f46e5;
}

.benefit-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.benefit-icon-default {
  background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
  color: #64748b;
}

.benefit-body {
  flex: 1;
  min-width: 0;
}

.benefit-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.benefit-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.benefit-points {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #f59e0b;
  padding: 2px 8px;
  background: #fef3c7;
  border-radius: 4px;
}

.benefit-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 8px;
  max-height: 3.2em;
  overflow: hidden;
}

.benefit-desc :deep(img) {
  max-width: 100%;
}

.benefit-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
}

.benefit-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.rich-editor-wrapper {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.editor-toolbar {
  padding: 8px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.rich-editor {
  min-height: 150px;
  padding: 12px;
  outline: none;
  line-height: 1.6;
}

.rich-editor:focus {
  background: #fafbfc;
}

.rich-editor:empty::before {
  content: attr(placeholder);
  color: #a8b2bd;
}

.preview-content {
  padding: 8px 0;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.preview-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.preview-desc {
  margin-bottom: 20px;
}

.preview-total {
  font-size: 18px;
  font-weight: 700;
  color: #4f46e5;
}

.preview-levels h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.level-breakdown {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.level-row {
  display: flex;
  align-items: center;
}

.level-name {
  width: 80px;
  font-size: 13px;
  color: #475569;
}

.level-count {
  width: 80px;
  text-align: right;
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
}

.version-card {
  margin-bottom: 4px;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.version-tag {
  font-weight: 700;
  color: #4f46e5;
  font-size: 13px;
}

.version-operator {
  margin-left: auto;
  font-size: 12px;
  color: #64748b;
}

.version-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 6px;
}

.version-desc {
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
  margin-bottom: 8px;
}

.version-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.version-remark {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #0284c7;
  padding: 6px 10px;
  background: #f0f9ff;
  border-radius: 6px;
}
</style>
