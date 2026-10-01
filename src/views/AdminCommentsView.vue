<template>
  <div class="page-view-container admin-comments-page">
    <!-- 是否需要访问凭据：由 onMounted 的无令牌探测决定，不能只看 adminToken 是否为空。
         服务端把管理端免验证打开时（本地 .dev.vars 的 ADMIN_AUTH_DISABLED=1），
         此时令牌本来就是空的，若用 `!adminToken` 判断会一直停在登录框（踩过这个坑）。 -->
    <div v-if="needsAuth" class="admin-login paper-panel">
      <h2 class="admin-login-title">评论管理</h2>
      <p class="admin-login-tip">
        这个页面用于管理评论：审核、隐藏与删除。需要访问凭据，凭据只保存在你本机浏览器。
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
        <UiButton variant="primary" size="sm" :disabled="!tokenInput.trim()" @click="saveToken">进入</UiButton>
      </div>
      <p v-if="loginError" class="admin-error" role="alert">{{ loginError }}</p>
    </div>

    <template v-else>
      <UiFilterPanel>
        <template #search>
          <div class="admin-toolbar">
            <span class="admin-toolbar-title">评论管理</span>
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
        <ul v-if="comments.length" class="admin-list">
          <li v-for="c in comments" :key="c.id" class="admin-item paper-panel">
            <div class="admin-item-head">
              <UiTag :tone="statusTone(c.status)">{{ statusLabel(c.status) }}</UiTag>
              <span class="admin-id">#{{ c.id }}</span>
              <span class="admin-nick">{{ c.nick }}</span>
              <span class="admin-page" :title="c.pageKey">{{ c.pageKey }}</span>
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
        <UiEmptyState v-else text="该状态下没有评论" />

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
import { onMounted, ref } from 'vue'
import { UiButton, UiEmptyState, UiFilterPanel, UiFilterPill, UiFilterRow, UiTag } from '../components/ui/index.js'
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
 * 初值 false：先假设不需要，由 onMounted 的无令牌探测来纠正——
 * 探测成功（本地免验证）就保持 false 直接进管理界面；401/404 才置 true 显示登录框。
 */
const needsAuth = ref(false)

const comments = ref([])
const loading = ref(false)
const errorMessage = ref('')
const statusFilter = ref('0') // 默认看待审
const cursor = ref(null)
const hasMore = ref(false)
const pendingCount = ref(0)

onMounted(async () => {
  try {
    adminToken.value = localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    adminToken.value = ''
  }

  // 先试一次"不带令牌"的请求：本地把管理端免验证打开时（.dev.vars 的
  // ADMIN_AUTH_DISABLED=1），这样就能直接进管理页、不用输令牌；
  // 线上会返回 401（需要令牌）或 404（未配置令牌），于是正常显示登录框。
  try {
    await load()
  } catch {
    needsAuth.value = true
    if (adminToken.value) {
      try {
        await load()
      } catch {
        /* load 内部已处理错误提示 */
      }
    }
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
  safeLoad()
}

function logout() {
  adminToken.value = ''
  tokenInput.value = ''
  comments.value = []
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
 * @param {{append?: boolean, probe?: boolean}} options
 *   `probe` 为 true 时表示"探测是否需要令牌"（onMounted 里先试一次不带令牌的请求），
 *   这种调用不写登录错误提示，由调用方决定怎么展示，且会把错误抛出去。
 */
async function load({ append = false, probe = false } = {}) {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchAdminComments(adminToken.value, {
      status: statusFilter.value,
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

.admin-toolbar-title {
  color: var(--text-main);
  font-size: 15px;
  font-weight: 700;
}

.admin-toolbar > :last-child {
  margin-left: auto;
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
