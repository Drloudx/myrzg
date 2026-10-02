<template>
  <div class="page-view-container admin-comments-page">
    <!-- 是否需要访问凭据：没有本地凭据就显示登录框；有则直接载入列表。
         本地与线上同一条路径（本地令牌在 .dev/vars 的 ADMIN_TOKEN），无免验证旁路。 -->
    <div v-if="needsAuth" class="admin-login paper-panel">
      <h2 class="admin-login-title">评论管理</h2>
      <p class="admin-login-tip">
        这个页面用于管理评论：审核、隐藏与删除。
      </p>
      <input
        v-model="tokenInput"
        class="admin-input"
        type="password"
        placeholder="粘贴管理员令牌"
        autocomplete="off"
        @keyup.enter="saveToken"
      />
      <div class="admin-login-actions">
        <UiButton variant="primary" size="sm" :disabled="!tokenInput.trim()" @click="saveToken">
          进入
        </UiButton>
      </div>
      <p v-if="loginError" class="admin-error" role="alert">{{ loginError }}</p>
    </div>

    <template v-else>
      <UiFilterPanel>
        <template #search>
          <div class="admin-toolbar">
            <UiSearchInput
              :model-value="searchInput"
              placeholder="搜索评论内容、昵称或物品..."
              class="admin-search"
              @update:model-value="onSearchInput"
            />
            <UiButton variant="ghost" size="sm" @click="logout">退出</UiButton>
          </div>
        </template>
        <UiFilterRow label="状态：">
          <UiFilterPill :active="statusFilter === '0'" @click="setFilter('0')">
            待审{{ pendingCount ? ` (${pendingCount})` : '' }}
          </UiFilterPill>
          <UiFilterPill :active="statusFilter === '1'" @click="setFilter('1')">已显示</UiFilterPill>
          <UiFilterPill :active="statusFilter === '2'" @click="setFilter('2')">已隐藏</UiFilterPill>
          <UiFilterPill :active="statusFilter === ''" @click="setFilter('')">全部</UiFilterPill>
        </UiFilterRow>
      </UiFilterPanel>

      <UiEmptyState v-if="loading && !comments.length" type="loading" text="加载中..." />

      <div v-else-if="errorMessage" class="admin-error-block" role="alert">
        <UiEmptyState type="error" :text="errorMessage" />
        <UiButton variant="secondary" size="sm" @click="safeLoad()">重新加载</UiButton>
      </div>

      <template v-else>
        <!--
          `data-main-scroll` 是关键：App.vue 的 updateStickyClipping() 会把每个页面里
          带该属性的内容**裁剪到筛选面板底边**（clip-path: inset(--sticky-clip-top 0 0)），
          专门用来防止内容从 sticky 面板上方那道缝里露出来。
          物品/家具页由 UiCardGrid 自带这个属性，副本/兑换/魔物收益页各自标在自己的滚动容器上；
          管理页原先漏了，所以评论卡片会从面板上方露出来（实测截图确认）。
        -->
        <ul v-if="comments.length" class="admin-list" data-main-scroll>
          <li v-for="c in comments" :key="c.id" class="admin-item paper-panel">
            <div class="admin-item-head">
              <UiTag :tone="statusTone(c.status)">{{ statusLabel(c.status) }}</UiTag>
              <span class="admin-id">#{{ c.id }}</span>
              <span class="admin-nick">{{ c.nick }}</span>
              <!-- 显示业务名（如「银币」「奇瓦」）而不是 item:item_00001 / hero:hero_019：
                   page_label 由发表方随评论一起存下（见 docs/technical/COMMENTS_BACKEND.md），
                   管理员不需要看懂内部标识。悬停 title 保留原始 page_key 便于排查。 -->
              <span class="admin-page" :title="c.pageKey">{{ c.pageLabel || c.pageKey }}</span>
              <time class="admin-time">{{ formatTime(c.createdAt) }}</time>
            </div>

            <p class="admin-body">{{ c.body }}</p>

            <div class="admin-item-foot">
              <span v-if="c.reviewReason" class="admin-reason">命中：{{ c.reviewReason }}</span>
              <span v-else class="admin-reason admin-reason-none">未命中审核词表</span>
              <div class="admin-actions">
                <UiButton v-if="c.status !== 1" variant="primary" size="sm" @click="changeStatus(c, 1)">放行</UiButton>
                <UiButton v-if="c.status !== 0" variant="secondary" size="sm" @click="changeStatus(c, 0)">转待审</UiButton>
                <UiButton v-if="c.status !== 2" variant="secondary" size="sm" @click="changeStatus(c, 2)">隐藏</UiButton>
                <UiButton variant="danger" size="sm" @click="hardDelete(c)">彻底删除</UiButton>
              </div>
            </div>
          </li>
        </ul>
        <UiEmptyState v-else :text="searchQuery ? '没有匹配的评论' : '该状态下没有评论'" />

        <div v-if="hasMore" class="admin-more">
          <UiButton variant="secondary" size="sm" :disabled="loading" @click="loadMore()">
            {{ loading ? '加载中...' : '加载更多' }}
          </UiButton>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  UiButton,
  UiEmptyState,
  UiFilterPanel,
  UiFilterPill,
  UiFilterRow,
  UiSearchInput,
  UiTag
} from '../components/ui/index.js'
import {
  CommentApiError,
  deleteCommentPermanently,
  fetchAdminComments,
  setCommentStatus
} from '../utils/commentApi.js'

const TOKEN_KEY = 'myrzg:admin-token'

const adminToken = ref('')
const tokenInput = ref('')
const loginError = ref('')

/**
 * 是否需要输入访问凭据。
 * 有个本地保存的凭据就直接载入，否则显示登录框。
 * 本地与线上走同一条路径（本地令牌是 .dev/vars 里的 `ADMIN_TOKEN`），
 * 所以没有"免验证旁路"这一说，界面状态只由凭据是否存在决定。
 */
const needsAuth = ref(true)

const comments = ref([])
const loading = ref(false)
const errorMessage = ref('')
const statusFilter = ref('0') // 默认看待审
const cursor = ref(null)
const hasMore = ref(false)
const pendingCount = ref(0)

/** 搜索关键词：输入框的即时值 + 实际生效值（防抖后） */
const searchInput = ref('')
const searchQuery = ref('')
let searchTimer = 0

/**
 * 搜索防抖 400ms：每敲一个字都请求会打满免费版额度（管理端也吃同一份 10 万/天）。
 * 输入框保持即时响应，只有生效值变化才发请求。
 */
function onSearchInput(value) {
  searchInput.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = 0
    searchQuery.value = String(value || '').trim()
    comments.value = []
    cursor.value = null
    hasMore.value = false
    safeLoad()
  }, 400)
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(async () => {
  try {
    adminToken.value = localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    adminToken.value = ''
  }

  if (!adminToken.value) {
    // 没有凭据就停在登录框，不发请求（避免无谓的 401）
    needsAuth.value = true
    return
  }
  needsAuth.value = false
  try {
    await load()
  } catch {
    // 凭据失效：load() 已切回登录态并给出提示
  }
})

function saveToken() {
  const value = tokenInput.value.trim()
  if (!value) return
  loginError.value = ''
  adminToken.value = value
  try {
    localStorage.setItem(TOKEN_KEY, value)
  } catch {
    /* 隐私模式下存不了，本次会话仍可用 */
  }
  needsAuth.value = false
  safeLoad()
}

/**
 * 退出：清凭据并**回到登录界面**。
 *
 * 关键是要显式把 `needsAuth` 置回 true：只清 `adminToken` 不够。
 * 界面状态由 `needsAuth` 决定，不置回的话列表仍留在屏幕上，
 * 看起来"点了退出没反应"（用户实际反馈过）。
 */
function logout() {
  adminToken.value = ''
  tokenInput.value = ''
  comments.value = []
  cursor.value = null
  hasMore.value = false
  pendingCount.value = 0
  errorMessage.value = ''
  loginError.value = ''
  needsAuth.value = true
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 忽略 */
  }
}

function setFilter(value) {
  statusFilter.value = value
  comments.value = []
  cursor.value = null
  hasMore.value = false
  safeLoad()
}

/**
 * 载入管理端列表。
 * 401/404 表示凭据无效或服务端未配置令牌 → 清凭据并切回登录界面；
 * 其余错误（网络、服务端故障）只在列表区显示提示，不把用户踢出登录态。
 */
async function load({ append = false } = {}) {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchAdminComments(adminToken.value, {
      status: statusFilter.value,
      q: searchQuery.value,
      cursor: append ? cursor.value : undefined
    })
    comments.value = append ? [...comments.value, ...data.comments] : data.comments
    hasMore.value = !!data.hasMore
    cursor.value = data.nextCursor ?? null
    if (typeof data.pendingCount === 'number') pendingCount.value = data.pendingCount
    if (data.comments.length === 0) pendingCount.value = 0
    loginError.value = ''
    return data
  } catch (err) {
    const needsAuthError = err instanceof CommentApiError && (err.status === 401 || err.status === 404)
    if (needsAuthError) {
      // 需要令牌：退回登录态，避免页面停在一个永远报错的列表上
      needsAuth.value = true
      adminToken.value = ''
      comments.value = []
      if (!probe) {
        try {
          localStorage.removeItem(TOKEN_KEY)
        } catch {
          /* 忽略 */
        }
        loginError.value = err.status === 404 ? '当前未开放评论管理' : '访问凭据无效，请重新输入'
      }
    } else {
      errorMessage.value = err?.message || '加载失败，请稍后重试'
    }
    throw err
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  return safeLoad({ append: true })
}

/** 供模板直接绑定的包装：错误已在 load() 里转成界面提示，这里只吞掉 promise */
function safeLoad(options = {}) {
  return load(options).catch(() => {})
}

async function changeStatus(comment, status) {
  const backup = comment.status
  comment.status = status // 乐观更新
  try {
    await setCommentStatus(adminToken.value, comment.id, status)
    // 当前筛选下已不属于该状态，从列表移除
    if (String(status) !== statusFilter.value && statusFilter.value !== '') {
      comments.value = comments.value.filter((c) => c.id !== comment.id)
    }
    if (status === 1) pendingCount.value = Math.max(0, pendingCount.value - 1)
  } catch (err) {
    comment.status = backup
    errorMessage.value = err?.message || '操作失败'
  }
}

async function hardDelete(comment) {
  // 彻底删除不可恢复，二次确认
  if (!window.confirm(`彻底删除 #${comment.id}？此操作不可恢复，建议优先用「隐藏」。`)) return
  try {
    await deleteCommentPermanently(adminToken.value, comment.id)
    comments.value = comments.value.filter((c) => c.id !== comment.id)
  } catch (err) {
    errorMessage.value = err?.message || '删除失败'
  }
}

function statusLabel(status) {
  return { 0: '待审', 1: '已显示', 2: '已隐藏' }[status] || '未知'
}

function statusTone(status) {
  return { 0: 'gold', 1: 'accent', 2: 'danger' }[status] || 'default'
}

function formatTime(unixSec) {
  const d = new Date(unixSec * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style scoped>
/*
 * 说明：本页筛选面板的"卡片不从上方面板缝里露出来"是靠模板上的
 * `data-main-scroll`（App.vue 的 updateStickyClipping 会据此裁剪内容）。
 * 曾尝试用本文件覆盖面板背景/`z-index`，**实测无效也不需要**：
 *   - scoped 选择器（含 `:deep()`）都编不出能命中 UiFilterPanel 根元素的规则；
 *   - 真正的原因是内容没被裁剪，而不是面板挡不住，见模板注释。
 * 故不在此重复声明面板样式，避免留下会误导后人的无效覆盖。
 */

.admin-login {
  max-width: 560px;
  margin: 24px auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-login-title {
  margin: 0;
  color: var(--text-main);
  font-size: 18px;
}

/* 正文 ≥13px、行高 ≥1.6（UI 组件库 1.3） */
.admin-login-tip {
  margin: 0;
  color: var(--text-muted);
  font-size: 13.5px;
  line-height: 1.6;
}

.admin-login-tip code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--paper-solid);
  color: var(--text-main);
  font-size: 13px;
}

.admin-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--paper-soft);
  color: var(--text-main);
  font-family: inherit;
  font-size: 13.5px;
}

.admin-input:focus {
  outline: 2px solid var(--accent-bright);
  outline-offset: 1px;
}

.admin-login-actions {
  display: flex;
  justify-content: flex-end;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

/* 搜索框占据标题原来的位置；退出按钮靠右 */
.admin-search {
  flex: 1 1 auto;
  min-width: 0;
}

.admin-toolbar > :last-child {
  margin-left: auto;
  flex: 0 0 auto;
}


.admin-list {
  list-style: none;
  margin: 12px 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-item {
  padding: 12px 14px;
}

.admin-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-id {
  color: var(--text-faint);
  font-size: 12px;
}

.admin-nick {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 700;
}

.admin-page {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--paper-solid);
  color: var(--text-muted);
  font-size: 12px;
}

.admin-time {
  margin-left: auto;
  color: var(--text-faint);
  font-size: 12px;
}

.admin-body {
  margin: 8px 0;
  color: var(--text-main);
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.admin-item-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-reason {
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}

.admin-reason-none {
  color: var(--text-faint);
  font-weight: 400;
}

.admin-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-left: auto;
}

.admin-error,
.admin-error-block {
  color: var(--danger);
  font-size: 13.5px;
  line-height: 1.6;
}

.admin-error-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
}

.admin-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}
</style>
