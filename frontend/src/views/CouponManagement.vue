<template>
  <div class="coupon-management">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">优惠券管理</h2>
        <p class="page-subtitle">配置优惠券规则、管理生命周期、批量发放与核销</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openCouponDialog()">
          <el-icon class="mr-4"><Plus /></el-icon>新建优惠券
        </el-button>
      </div>
    </div>

    <el-row :gutter="24" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">进行中优惠券</span>
              <span class="stat-value">{{ couponStats?.activeCoupons || 0 }}</span>
            </div>
            <div class="stat-icon blue">
              <el-icon><Present /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">领取率</span>
              <span class="stat-value">{{ couponStats?.claimRate || 0 }}%</span>
            </div>
            <div class="stat-icon green">
              <el-icon><Download /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">核销率</span>
              <span class="stat-value">{{ couponStats?.redeemRate || 0 }}%</span>
            </div>
            <div class="stat-icon orange">
              <el-icon><CircleCheck /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">ROI 估算</span>
              <span class="stat-value">¥{{ couponStats?.roiEstimate || 0 }}</span>
            </div>
            <div class="stat-icon purple">
              <el-icon><TrendCharts /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="chart-row">
      <el-col :span="14">
        <el-card shadow="never" class="trend-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">近30天发放与核销趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" class="trend-chart"></div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="type-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">各券种发放/核销对比</span>
            </div>
          </template>
          <div ref="typeChartRef" class="type-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="list-card">
      <div class="filter-bar">
        <el-input
          v-model="filters.search"
          placeholder="搜索优惠券名称"
          size="default"
          style="width: 240px"
          clearable
          @keyup.enter="fetchCoupons"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.type" placeholder="券种" size="default" style="width: 140px" clearable>
          <el-option label="满减券" value="FULL_REDUCTION" />
          <el-option label="折扣券" value="DISCOUNT" />
          <el-option label="积分兑换券" value="POINTS_EXCHANGE" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" size="default" style="width: 140px" clearable>
          <el-option label="草稿" value="DRAFT" />
          <el-option label="待审核" value="PENDING_REVIEW" />
          <el-option label="已发布" value="PUBLISHED" />
          <el-option label="已结束" value="ENDED" />
        </el-select>
        <el-select v-model="filters.shelfStatus" placeholder="上下架" size="default" style="width: 140px" clearable>
          <el-option label="上架中" value="true" />
          <el-option label="已下架" value="false" />
        </el-select>
        <el-button type="primary" @click="fetchCoupons">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table
        v-loading="couponStore.loading"
        :data="couponStore.coupons"
        style="width: 100%"
        stripe
      >
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <div class="coupon-name">
              <span class="name-text">{{ row.name }}</span>
              <el-tag size="small" :type="getCouponTypeTag(row.type)" effect="light">
                {{ getCouponTypeLabel(row.type) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="面值/折扣" width="110" align="center">
          <template #default="{ row }">
            <div class="coupon-value">
              <template v-if="row.type === 'FULL_REDUCTION' || row.type === 'POINTS_EXCHANGE'">
                <span class="value-num">¥{{ row.value }}</span>
              </template>
              <template v-else>
                <span class="value-num">{{ row.value }}折</span>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="minConsume" label="门槛" width="100" align="center">
          <template #default="{ row }">
            <span>满¥{{ row.minConsume }}</span>
          </template>
        </el-table-column>
        <el-table-column label="库存/已领" width="140" align="center">
          <template #default="{ row }">
            <div class="stock-info">
              <el-progress
                type="line"
                :percentage="row.totalQuantity > 0 ? Math.min((row.claimedQuantity / row.totalQuantity) * 100, 100) : 0"
                :stroke-width="6"
                :show-text="false"
              />
              <span class="stock-text">{{ row.claimedQuantity }}/{{ row.totalQuantity }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" effect="dark">
              {{ getStatusLabel(row.status) }}
            </el-tag>
            <div style="margin-top: 4px">
              <el-tag size="small" :type="row.shelfStatus ? 'success' : 'info'">
                {{ row.shelfStatus ? '上架' : '下架' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="有效期" width="180">
          <template #default="{ row }">
            <div class="valid-period">
              <template v-if="row.validFrom || row.validTo">
                <span>{{ formatDate(row.validFrom) }}</span>
                <span class="arrow">→</span>
                <span>{{ formatDate(row.validTo) }}</span>
              </template>
              <template v-else-if="row.validDays">
                <span>领取后 {{ row.validDays }} 天</span>
              </template>
              <template v-else>
                <span>-</span>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewCoupon(row)">详情</el-button>
            <el-button
              v-if="row.status === 'DRAFT' || row.status === 'PENDING_REVIEW'"
              link type="primary" size="small"
              @click="openCouponDialog(row)"
            >编辑</el-button>
            <el-button
              v-if="row.status === 'DRAFT'"
              link type="warning" size="small"
              @click="changeStatus(row, 'PENDING_REVIEW')"
            >提交审核</el-button>
            <el-button
              v-if="row.status === 'PENDING_REVIEW'"
              link type="success" size="small"
              @click="changeStatus(row, 'PUBLISHED')"
            >发布</el-button>
            <el-button
              v-if="row.status === 'PENDING_REVIEW'"
              link type="info" size="small"
              @click="changeStatus(row, 'DRAFT')"
            >退回</el-button>
            <el-button
              v-if="row.status === 'PUBLISHED'"
              link type="primary" size="small"
              @click="openIssueDialog(row)"
            >发放</el-button>
            <el-button
              v-if="row.status === 'PUBLISHED'"
              link type="danger" size="small"
              @click="changeStatus(row, 'ENDED')"
            >结束</el-button>
            <el-button
              v-if="row.status !== 'PUBLISHED' && row._count?.memberCoupons === 0"
              link type="danger" size="small"
              @click="removeCoupon(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="couponStore.page"
          v-model:page-size="couponStore.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="couponStore.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchCoupons"
          @current-change="fetchCoupons"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="couponDialogVisible"
      :title="editingCoupon ? '编辑优惠券' : '新建优惠券'"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-form ref="couponFormRef" :model="couponForm" :rules="couponRules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="券名称" prop="name">
              <el-input v-model="couponForm.name" placeholder="请输入优惠券名称" maxlength="100" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="券种" prop="type">
              <el-select v-model="couponForm.type" style="width: 100%" @change="onCouponTypeChange">
                <el-option label="满减券" value="FULL_REDUCTION" />
                <el-option label="折扣券" value="DISCOUNT" />
                <el-option label="积分兑换券" value="POINTS_EXCHANGE" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="面值/折扣" prop="value">
              <el-input-number
                v-model="couponForm.value"
                :min="0"
                :max="couponForm.type === 'DISCOUNT' ? 9.9 : 99999"
                :step="couponForm.type === 'DISCOUNT' ? 0.1 : 1"
                :precision="couponForm.type === 'DISCOUNT' ? 1 : 2"
                style="width: 100%"
              />
              <span v-if="couponForm.type === 'DISCOUNT'" class="unit-tip">折，范围 1.0 ~ 9.9</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最低消费门槛" prop="minConsume">
              <el-input-number v-model="couponForm.minConsume" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col v-if="couponForm.type === 'POINTS_EXCHANGE'" :span="12">
            <el-form-item label="所需积分" prop="pointsCost">
              <el-input-number v-model="couponForm.pointsCost" :min="1" :precision="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发放总量" prop="totalQuantity">
              <el-input-number v-model="couponForm.totalQuantity" :min="1" :precision="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每人限领" prop="perUserLimit">
              <el-input-number v-model="couponForm.perUserLimit" :min="1" :precision="0" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用等级">
              <el-select
                v-model="couponForm.applicableLevels"
                multiple
                placeholder="全部等级（不选则全部）"
                style="width: 100%"
              >
                <el-option label="普通会员" value="NORMAL" />
                <el-option label="白银会员" value="SILVER" />
                <el-option label="黄金会员" value="GOLD" />
                <el-option label="铂金会员" value="PLATINUM" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用范围">
              <el-select v-model="couponForm.scope" style="width: 100%">
                <el-option label="全部商品" value="ALL" />
                <el-option label="指定商品" value="PRODUCT" />
                <el-option label="指定品类" value="CATEGORY" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="couponForm.scope !== 'ALL'" :span="24">
            <el-form-item label="范围ID">
              <el-select
                v-model="couponForm.scopeIds"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="输入ID后回车确认（可添加多个）"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效期起">
              <el-date-picker
                v-model="couponForm.validFrom"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效期止">
              <el-date-picker
                v-model="couponForm.validTo"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="领取后有效天数">
              <el-input-number
                v-model="couponForm.validDays"
                :min="1"
                :precision="0"
                placeholder="与起止时间二选一"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否可叠加">
              <el-switch v-model="couponForm.stackable" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="上架状态">
              <el-switch v-model="couponForm.shelfStatus" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="描述">
              <el-input
                v-model="couponForm.description"
                type="textarea"
                :rows="3"
                placeholder="优惠券使用说明"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="couponDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCoupon">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="issueDialogVisible"
      title="批量发放优惠券"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form ref="issueFormRef" :model="issueForm" :rules="issueRules" label-width="120px">
        <el-form-item label="当前优惠券">
          <el-tag type="primary" effect="light">{{ currentCouponForIssue?.name }}</el-tag>
        </el-form-item>
        <el-form-item label="发放对象" prop="targetType">
          <el-radio-group v-model="issueForm.targetType">
            <el-radio value="SPECIFIC">指定会员</el-radio>
            <el-radio value="LEVEL">按等级</el-radio>
            <el-radio value="TAG">按标签</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="选择对象" prop="targetIds">
          <el-select
            v-if="issueForm.targetType === 'SPECIFIC'"
            v-model="issueForm.targetIds"
            multiple
            filterable
            remote
            :remote-method="searchMembers"
            placeholder="输入手机号/姓名搜索会员"
            style="width: 100%"
            :loading="memberSearchLoading"
          >
            <el-option
              v-for="m in memberOptions"
              :key="m.id"
              :label="`${m.name} (${m.phone})`"
              :value="m.id"
            />
          </el-select>
          <el-select
            v-else-if="issueForm.targetType === 'LEVEL'"
            v-model="issueForm.targetIds"
            multiple
            placeholder="选择会员等级"
            style="width: 100%"
          >
            <el-option label="普通会员" value="NORMAL" />
            <el-option label="白银会员" value="SILVER" />
            <el-option label="黄金会员" value="GOLD" />
            <el-option label="铂金会员" value="PLATINUM" />
          </el-select>
          <el-select
            v-else-if="issueForm.targetType === 'TAG'"
            v-model="issueForm.targetIds"
            multiple
            placeholder="选择标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.id"
              :label="tag.name"
              :value="tag.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="定时生效">
          <el-date-picker
            v-model="issueForm.scheduledAt"
            type="datetime"
            placeholder="立即生效（不设置则立即）"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="过期提醒">
          <el-switch v-model="issueForm.expireReminder" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="issueDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="issuing" @click="submitIssue">确认发放</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="detailDialogVisible"
      title="优惠券详情"
      width="720px"
    >
      <el-descriptions :column="2" border v-if="currentCouponDetail">
        <el-descriptions-item label="名称" :span="2">{{ currentCouponDetail.name }}</el-descriptions-item>
        <el-descriptions-item label="券种">
          <el-tag :type="getCouponTypeTag(currentCouponDetail.type)">
            {{ getCouponTypeLabel(currentCouponDetail.type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="面值/折扣">
          <template v-if="currentCouponDetail.type === 'FULL_REDUCTION' || currentCouponDetail.type === 'POINTS_EXCHANGE'">
            ¥{{ currentCouponDetail.value }}
          </template>
          <template v-else>{{ currentCouponDetail.value }}折</template>
        </el-descriptions-item>
        <el-descriptions-item label="最低消费">¥{{ currentCouponDetail.minConsume }}</el-descriptions-item>
        <el-descriptions-item label="发放总量">{{ currentCouponDetail.totalQuantity }}</el-descriptions-item>
        <el-descriptions-item label="已领取">{{ currentCouponDetail.claimedQuantity }}</el-descriptions-item>
        <el-descriptions-item label="已核销">{{ currentCouponDetail.redeemedQuantity }}</el-descriptions-item>
        <el-descriptions-item label="每人限领">{{ currentCouponDetail.perUserLimit }}</el-descriptions-item>
        <el-descriptions-item label="可叠加">{{ currentCouponDetail.stackable ? '是' : '否' }}</el-descriptions-item>
        <el-descriptions-item label="上下架">
          {{ currentCouponDetail.shelfStatus ? '上架' : '下架' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTag(currentCouponDetail.status)">
            {{ getStatusLabel(currentCouponDetail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="有效期" :span="2">
          <template v-if="currentCouponDetail.validFrom || currentCouponDetail.validTo">
            {{ formatDate(currentCouponDetail.validFrom) }} → {{ formatDate(currentCouponDetail.validTo) }}
          </template>
          <template v-else-if="currentCouponDetail.validDays">
            领取后 {{ currentCouponDetail.validDays }} 天有效
          </template>
        </el-descriptions-item>
        <el-descriptions-item label="适用等级">
          {{ currentCouponDetail.applicableLevels?.length
            ? currentCouponDetail.applicableLevels.map(l => getLevelLabel(l)).join('、')
            : '全部等级' }}
        </el-descriptions-item>
        <el-descriptions-item label="适用范围">
          {{ getScopeLabel(currentCouponDetail.scope) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ currentCouponDetail.description || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-tabs" style="margin-top: 24px">
        <el-tabs v-model="detailTab">
          <el-tab-pane label="发放记录" name="batches">
            <el-table :data="currentCouponDetail?.issueBatches || []" size="small" stripe>
              <el-table-column prop="id" label="批次ID" width="80" />
              <el-table-column label="发放对象" width="120">
                <template #default="{ row }">
                  {{ getTargetTypeLabel(row.targetType) }}
                </template>
              </el-table-column>
              <el-table-column prop="totalIssued" label="发放数量" width="100" />
              <el-table-column label="定时生效" width="160">
                <template #default="{ row }">{{ formatDate(row.scheduledAt) || '立即' }}</template>
              </el-table-column>
              <el-table-column prop="operator?.username" label="操作人" width="100" />
              <el-table-column label="发放时间" width="160">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="领取明细" name="members">
            <el-table
              v-loading="couponStore.loading"
              :data="couponStore.couponMembers"
              size="small"
              stripe
            >
              <el-table-column label="会员" width="160">
                <template #default="{ row }">
                  <span>{{ row.member?.name }} ({{ row.member?.phone }})</span>
                </template>
              </el-table-column>
              <el-table-column label="等级" width="80">
                <template #default="{ row }">{{ getLevelLabel(row.member?.level) }}</template>
              </el-table-column>
              <el-table-column prop="code" label="券码" width="200" />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag size="small" :type="getMemberCouponStatusTag(row.status)">
                    {{ getMemberCouponStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="orderNo" label="关联订单" width="140" />
              <el-table-column label="领取时间" width="160">
                <template #default="{ row }">{{ formatDate(row.claimedAt) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button
                    v-if="row.status === 'CLAIMED'"
                    link type="primary" size="small"
                    @click="redeemCoupon(row)"
                  >核销</el-button>
                  <el-button
                    v-if="row.status === 'REDEEMED' || row.status === 'LOCKED'"
                    link type="warning" size="small"
                    @click="refundCoupon(row)"
                  >退回</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination" style="margin-top: 12px">
              <el-pagination
                v-model:current-page="memberListPage"
                v-model:page-size="memberListPageSize"
                :page-sizes="[10, 20, 50]"
                :total="couponStore.couponMemberTotal"
                layout="total, sizes, prev, pager, next"
                @size-change="fetchCouponMembers"
                @current-change="fetchCouponMembers"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useCouponStore } from '../stores/coupon';
import { useTagStore } from '../stores/tag';
import { searchMembers as apiSearchMembers } from '../api/member';
import * as echarts from 'echarts';
import {
  Plus, Search, Present, Download, CircleCheck, TrendCharts,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const couponStore = useCouponStore();
const tagStore = useTagStore();

const couponStats = computed(() => couponStore.stats);
const tagOptions = computed(() => {
  const list = [];
  tagStore.tagGroups.forEach(g => g.tags?.forEach(t => list.push(t)));
  return list;
});

const filters = reactive({
  search: '',
  type: '',
  status: '',
  shelfStatus: '',
});

const trendChartRef = ref(null);
const typeChartRef = ref(null);
let trendChart = null;
let typeChart = null;

const couponDialogVisible = ref(false);
const editingCoupon = ref(null);
const submitting = ref(false);
const couponFormRef = ref(null);
const couponForm = reactive({
  name: '',
  type: 'FULL_REDUCTION',
  value: 10,
  minConsume: 0,
  pointsCost: null,
  applicableLevels: [],
  scope: 'ALL',
  scopeIds: [],
  validFrom: '',
  validTo: '',
  validDays: null,
  totalQuantity: 100,
  perUserLimit: 1,
  stackable: false,
  shelfStatus: true,
  description: '',
});

const couponRules = {
  name: [{ required: true, message: '请输入优惠券名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择券种', trigger: 'change' }],
  value: [{ required: true, message: '请输入面值/折扣', trigger: 'blur' }],
  totalQuantity: [{ required: true, message: '请输入发放总量', trigger: 'blur' }],
};

const issueDialogVisible = ref(false);
const currentCouponForIssue = ref(null);
const issuing = ref(false);
const issueFormRef = ref(null);
const issueForm = reactive({
  couponId: null,
  targetType: 'SPECIFIC',
  targetIds: [],
  scheduledAt: '',
  expireReminder: true,
});

const issueRules = {
  targetType: [{ required: true, message: '请选择发放对象类型', trigger: 'change' }],
  targetIds: [{ required: true, type: 'array', message: '请至少选择一个对象', trigger: 'change' }],
};

const memberSearchLoading = ref(false);
const memberOptions = ref([]);

const detailDialogVisible = ref(false);
const currentCouponDetail = ref(null);
const detailTab = ref('batches');
const memberListPage = ref(1);
const memberListPageSize = ref(10);

function resetFilters() {
  filters.search = '';
  filters.type = '';
  filters.status = '';
  filters.shelfStatus = '';
  couponStore.page = 1;
  fetchCoupons();
}

function fetchCoupons() {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.shelfStatus) params.shelfStatus = filters.shelfStatus;
  couponStore.fetchCoupons(params);
}

async function viewCoupon(row) {
  await couponStore.fetchCoupon(row.id);
  currentCouponDetail.value = couponStore.currentCoupon;
  detailTab.value = 'batches';
  detailDialogVisible.value = true;
  memberListPage.value = 1;
  fetchCouponMembers();
}

function fetchCouponMembers() {
  if (!currentCouponDetail.value) return;
  couponStore.fetchCouponMembers(currentCouponDetail.value.id, {
    page: memberListPage.value,
    pageSize: memberListPageSize.value,
  });
}

function openCouponDialog(row = null) {
  editingCoupon.value = row;
  if (row) {
    Object.assign(couponForm, {
      name: row.name,
      type: row.type,
      value: parseFloat(row.value),
      minConsume: parseFloat(row.minConsume),
      pointsCost: row.pointsCost ? parseInt(row.pointsCost) : null,
      applicableLevels: row.applicableLevels || [],
      scope: row.scope,
      scopeIds: row.scopeIds || [],
      validFrom: row.validFrom || '',
      validTo: row.validTo || '',
      validDays: row.validDays,
      totalQuantity: row.totalQuantity,
      perUserLimit: row.perUserLimit,
      stackable: row.stackable,
      shelfStatus: row.shelfStatus,
      description: row.description || '',
    });
  } else {
    Object.assign(couponForm, {
      name: '',
      type: 'FULL_REDUCTION',
      value: 10,
      minConsume: 0,
      pointsCost: null,
      applicableLevels: [],
      scope: 'ALL',
      scopeIds: [],
      validFrom: '',
      validTo: '',
      validDays: null,
      totalQuantity: 100,
      perUserLimit: 1,
      stackable: false,
      shelfStatus: true,
      description: '',
    });
  }
  couponDialogVisible.value = true;
  nextTick(() => couponFormRef.value?.clearValidate());
}

function onCouponTypeChange() {
  if (couponForm.type === 'DISCOUNT') {
    couponForm.value = 9;
  } else {
    couponForm.value = 10;
  }
}

async function submitCoupon() {
  if (!couponFormRef.value) return;
  try {
    await couponFormRef.value.validate();
    submitting.value = true;

    const data = { ...couponForm };
    if (data.scope === 'ALL') data.scopeIds = [];
    if (data.applicableLevels?.length === 0) data.applicableLevels = null;
    if (data.scopeIds?.length === 0) data.scopeIds = null;

    if (editingCoupon.value) {
      await couponStore.updateExistingCoupon(editingCoupon.value.id, data);
      ElMessage.success('更新成功');
    } else {
      await couponStore.createNewCoupon(data);
      ElMessage.success('创建成功');
    }
    couponDialogVisible.value = false;
  } catch (err) {
    if (err?.name !== 'ZodError') {
      console.error(err);
    }
  } finally {
    submitting.value = false;
  }
}

async function changeStatus(row, newStatus) {
  const actionMap = {
    'DRAFT→PENDING_REVIEW': '提交审核',
    'PENDING_REVIEW→DRAFT': '退回草稿',
    'PENDING_REVIEW→PUBLISHED': '发布',
    'PUBLISHED→ENDED': '结束',
  };
  const action = actionMap[`${row.status}→${newStatus}`] || '状态变更';

  try {
    await ElMessageBox.confirm(`确定要${action}「${row.name}」吗？`, '确认', {
      type: 'warning',
    });
    await couponStore.updateStatus(row.id, newStatus);
    ElMessage.success('操作成功');
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
}

async function removeCoupon(row) {
  try {
    await ElMessageBox.confirm(`确定要删除「${row.name}」吗？此操作不可恢复。`, '确认', {
      type: 'warning',
    });
    await couponStore.removeCoupon(row.id);
    ElMessage.success('删除成功');
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
}

function openIssueDialog(row) {
  currentCouponForIssue.value = row;
  issueForm.couponId = row.id;
  issueForm.targetType = 'SPECIFIC';
  issueForm.targetIds = [];
  issueForm.scheduledAt = '';
  issueForm.expireReminder = true;
  issueDialogVisible.value = true;
  nextTick(() => issueFormRef.value?.clearValidate());
}

async function searchMembers(query) {
  if (!query) return;
  memberSearchLoading.value = true;
  try {
    const res = await apiSearchMembers({ search: query, page: 1, pageSize: 20 });
    memberOptions.value = res.list || [];
  } catch (e) {
    console.error(e);
  } finally {
    memberSearchLoading.value = false;
  }
}

async function submitIssue() {
  if (!issueFormRef.value) return;
  try {
    await issueFormRef.value.validate();
    issuing.value = true;

    const data = {
      couponId: issueForm.couponId,
      targetType: issueForm.targetType,
      targetIds: issueForm.targetIds,
      scheduledAt: issueForm.scheduledAt || null,
      expireReminder: issueForm.expireReminder,
    };

    const res = await couponStore.batchIssue(data);
    ElMessage.success(`发放完成：成功 ${res.success}，失败 ${res.failed}，跳过 ${res.skipped}`);
    issueDialogVisible.value = false;
    fetchCoupons();
  } catch (err) {
    console.error(err);
  } finally {
    issuing.value = false;
  }
}

async function redeemCoupon(row) {
  try {
    const { value: orderNo } = await ElMessageBox.prompt('请输入关联订单号', '核销优惠券', {
      confirmButtonText: '确认核销',
      cancelButtonText: '取消',
      inputValidator: (v) => !!v || '请输入订单号',
    });
    await couponStore.redeemCoupon(row.id, orderNo, '');
    ElMessage.success('核销成功');
    fetchCouponMembers();
    fetchCoupons();
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
}

async function refundCoupon(row) {
  try {
    await ElMessageBox.confirm(`确定要退回优惠券「${row.code}」吗？`, '确认', { type: 'warning' });
    await couponStore.refundCoupon(row.id, '');
    ElMessage.success('已退回');
    fetchCouponMembers();
    fetchCoupons();
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
}

function getCouponTypeLabel(type) {
  return { FULL_REDUCTION: '满减券', DISCOUNT: '折扣券', POINTS_EXCHANGE: '积分兑换券' }[type] || type;
}
function getCouponTypeTag(type) {
  return { FULL_REDUCTION: 'danger', DISCOUNT: 'warning', POINTS_EXCHANGE: 'success' }[type] || '';
}
function getStatusLabel(status) {
  return { DRAFT: '草稿', PENDING_REVIEW: '待审核', PUBLISHED: '已发布', ENDED: '已结束' }[status] || status;
}
function getStatusTag(status) {
  return { DRAFT: 'info', PENDING_REVIEW: 'warning', PUBLISHED: 'success', ENDED: 'danger' }[status] || '';
}
function getLevelLabel(level) {
  return { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' }[level] || level;
}
function getScopeLabel(scope) {
  return { ALL: '全部商品', PRODUCT: '指定商品', CATEGORY: '指定品类' }[scope] || scope;
}
function getTargetTypeLabel(t) {
  return { SPECIFIC: '指定会员', LEVEL: '按等级', TAG: '按标签' }[t] || t;
}
function getMemberCouponStatusLabel(s) {
  return { CLAIMED: '已领取', LOCKED: '已锁定', REDEEMED: '已核销', RETURNED: '已退回', EXPIRED: '已过期' }[s] || s;
}
function getMemberCouponStatusTag(s) {
  return { CLAIMED: 'primary', LOCKED: 'warning', REDEEMED: 'success', RETURNED: 'info', EXPIRED: 'danger' }[s] || '';
}
function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function renderTrendChart() {
  if (!trendChartRef.value) return;
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value);
  }
  const trend = couponStats.value?.dailyTrend || [];
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['发放数量', '核销数量'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trend.map(t => t.date.slice(5)),
      boundaryGap: false,
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '发放数量',
        type: 'line',
        smooth: true,
        data: trend.map(t => t.claimed),
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
      },
      {
        name: '核销数量',
        type: 'line',
        smooth: true,
        data: trend.map(t => t.redeemed),
        itemStyle: { color: '#22c55e' },
        areaStyle: { color: 'rgba(34, 197, 94, 0.1)' },
      },
    ],
  });
}

function renderTypeChart() {
  if (!typeChartRef.value) return;
  if (!typeChart) {
    typeChart = echarts.init(typeChartRef.value);
  }
  const byType = couponStats.value?.byType || {};
  const types = Object.keys(byType);
  typeChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['发放数量', '核销数量'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: types.map(t => byType[t].name),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '发放数量',
        type: 'bar',
        data: types.map(t => byType[t].claimed),
        itemStyle: { color: '#6366f1' },
        barWidth: 24,
      },
      {
        name: '核销数量',
        type: 'bar',
        data: types.map(t => byType[t].redeemed),
        itemStyle: { color: '#10b981' },
        barWidth: 24,
      },
    ],
  });
}

watch(() => couponStats.value, (val) => {
  if (val) {
    nextTick(() => {
      renderTrendChart();
      renderTypeChart();
    });
  }
}, { deep: true });

onMounted(async () => {
  await tagStore.fetchTagGroups();
  await couponStore.fetchCouponStats();
  fetchCoupons();

  const resizeHandler = () => {
    trendChart?.resize();
    typeChart?.resize();
  };
  window.addEventListener('resize', resizeHandler);
});
</script>

<style scoped>
.coupon-management {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.mr-4 { margin-right: 4px; }

.stats-row { margin-bottom: 24px; }
.chart-row { margin-bottom: 24px; }

.stat-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}
.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stat-info { display: flex; flex-direction: column; }
.stat-label { font-size: 14px; color: #64748b; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 700; color: #1e293b; }
.stat-icon {
  width: 56px; height: 56px; border-radius: 12px;
  display: flex; justify-content: center; align-items: center; font-size: 24px;
}
.stat-icon.blue { background-color: #eff6ff; color: #3b82f6; }
.stat-icon.green { background-color: #f0fdf4; color: #22c55e; }
.stat-icon.orange { background-color: #fff7ed; color: #f97316; }
.stat-icon.purple { background-color: #faf5ff; color: #a855f7; }

.trend-card, .type-card, .list-card {
  border-radius: 12px;
  border: none;
}
.trend-chart { height: 300px; }
.type-chart { height: 300px; }

.card-title { font-size: 16px; font-weight: 600; color: #1e293b; }

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.coupon-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.name-text {
  font-weight: 500;
  color: #1e293b;
}
.coupon-value .value-num {
  font-size: 16px;
  font-weight: 700;
  color: #ef4444;
}
.stock-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.stock-text {
  font-size: 12px;
  color: #64748b;
}
.valid-period {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #64748b;
}
.valid-period .arrow { color: #94a3b8; }

.unit-tip {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
</style>
