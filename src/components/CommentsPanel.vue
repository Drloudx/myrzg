<template>
  <UiSection title="讨论" class="comments-panel">
    <!-- 加载 / 错误 / 空 三态：统一用 UiEmptyState -->
    <UiEmptyState v-if="loading && !comments.length" type="loading" text="评论加载中..." />

    <template v-else>
      <div v-if="errorMessage" class="comments-error" role="alert">
        <UiEmptyState type="error" :text="errorMessage" />
        <UiButton variant="secondary" size="sm" @click="load()">重新加载</UiButton>
      </div>

      <template v-else>
        <ul v-if="comments.length" class="comments-list">
          <li v-for="c in comments" :key="c.id" class="comment-item">
            <img
              v-if="avatarOf(c)"
              class="comment-avatar"
              :src="avatarOf(c)"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <div v-else class="comment-avatar comment-avatar-fallback" aria-hidden="true">
              {{ (c.nick || '?').slice(0, 1) }}
            </div>

            <div class="comment-main">
              <div class="comment-head">
                <span class="comment-nick">{{ c.nick }}</span>
                <time class="comment-time" :datetime="isoTime(c.createdAt)">{{ formatTime(c.createdAt) }}</time>
                <button
                  v-if="ownedIds.has(c.id)"
                  type="button"
                  class="comment-delete"
                  :disabled="deletingId === c.id"
                  @click="handleDelete(c)"
                >
                  {{ deletingId === c.id ? '删除中' : '删除' }}
                </button>
              </div>
              <!-- 纯文本渲染：不解析 HTML，评论里的标签按原文显示 -->
              <p class="comment-body">{{ c.body }}</p>
            </div>
          </li>
        </ul>
        <UiEmptyState v-else text="还没有人讨论，来说两句吧" />

        <div v-if="hasMore" class="comments-more">
          <UiButton variant="secondary" size="sm" :disabled="loading" @click="loadMore()">
            {{ loading ? '加载中...' : '加载更多' }}
          </UiButton>
        </div>
      </template>

      <!-- 发表区：昵称与头像来自「账号」弹窗，这里不再重复填写 -->
      <form class="comment-form" @submit.prevent="submit">
        <div class="comment-identity">
          <img v-if="myAvatarPath" class="comment-avatar" :src="myAvatarPath" alt="" />
          <div v-else class="comment-avatar comment-avatar-fallback" aria-hidden="true">
            {{ identity.nick.trim().slice(0, 1) || '?' }}
          </div>
          <span class="comment-identity-text">
            <template v-if="identity.nick.trim()">
              以 <strong>{{ identity.nick }}</strong> 的身份发表
            </template>
            <template v-else>还没设置昵称</template>
          </span>
          <button type="button" class="comment-identity-edit" @click="openAccountModal()">
            {{ identity.nick.trim() ? '修改' : '去设置' }}
          </button>
        </div>

        <textarea
          v-model="form.body"
          class="comment-textarea"
          rows="3"
          maxlength="1000"
          placeholder="说点什么…（支持换行）"
        ></textarea>

        <!-- 蜜罐：正常用户与屏幕阅读器都感知不到，但不静默移除（display:none 会被部分机器人跳过）。
             用 visibility+opacity 而非仅移出视口，避免键盘 Tab 落在它上面。 -->
        <input
          v-model="form.hp"
          class="comment-honeypot"
          type="text"
          tabindex="-1"
          autocomplete="off"
          aria-hidden="true"
          @focus="onHoneypotFocus"
        />

        <div class="comment-form-foot">
          <span class="comment-count">{{ form.body.length }}/1000</span>
          <UiButton variant="primary" size="sm" :disabled="submitting || !canSubmit" @click="submit">
            {{ submitting ? '提交中...' : '发表' }}
          </UiButton>
        </div>

        <p v-if="submitError" class="comment-submit-error" role="alert">{{ submitError }}</p>
        <p v-else-if="submitNotice" class="comment-submit-notice" role="status">{{ submitNotice }}</p>
      </form>
    </template>
  </UiSection>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { UiButton, UiEmptyState, UiSection } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import {
  deleteOwnComment,
  fetchComments,
  getDeleteToken,
  postComment,
  removeDeleteToken,
  saveDeleteToken
} from '../utils/commentApi.js'
import {
  avatarCatalogState,
  avatarPath,
  identity,
  loadAvatarCatalog,
  openAccountModal
} from '../utils/identity.js'

const props = defineProps({
  /**
   * 评论归属键，形如 `item:30047`。
   * 由调用方从业务 ID 推导，不使用 URL 参数（SPEC 第四章：仅已实现的参数做 URL 同步）。
   */
  pageKey: { type: String, required: true }
})

const comments = ref([])
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const submitError = ref('')
const submitNotice = ref('')
const cursor = ref(null)
const hasMore = ref(false)
const deletingId = ref(null)

const form = reactive({ body: '', hp: '' })

/** 本机发表过的评论 id，用于显示"删除"按钮 */
const ownedIds = ref(new Set())

const myAvatarPath = computed(() => {
  const path = avatarPath(identity.value.avatar)
  return path ? getImageUrl(path) : ''
})

const canSubmit = computed(() => form.body.trim().length > 0)

function syncOwned() {
  const set = new Set()
  for (const c of comments.value) if (getDeleteToken(c.id)) set.add(c.id)
  ownedIds.value = set
}

/** 把评论的 avatar ID 换成图片地址；清单未加载或 ID 未知时返回空串，走昵称首字占位 */
function avatarOf(comment) {
  if (!comment?.avatar) return ''
  const path = avatarPath(comment.avatar)
  return path ? getImageUrl(path) : ''
}

async function load({ append = false } = {}) {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchComments(props.pageKey, { cursor: append ? cursor.value : undefined })
    comments.value = append ? [...comments.value, ...data.comments] : data.comments
    hasMore.value = !!data.hasMore
    cursor.value = data.nextCursor ?? null
    syncOwned()
  } catch (err) {
    errorMessage.value = err?.message || '评论加载失败'
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  return load({ append: true })
}

async function submit() {
  if (submitting.value || !canSubmit.value) return

  // 未设昵称：先把账号弹窗打开让用户设好，回来再点发表。
  // 不自动用"匿名"顶替，否则用户会以为设置已生效。
  if (!identity.value.nick.trim()) {
    submitError.value = ''
    submitNotice.value = '请先设置昵称，保存后再点「发表」'
    openAccountModal()
    return
  }

  submitting.value = true
  submitError.value = ''
  submitNotice.value = ''
  try {
    const data = await postComment({
      pageKey: props.pageKey,
      nick: identity.value.nick.trim(),
      avatar: identity.value.avatar || '',
      body: form.body.trim(),
      hp: form.hp
    })
    // 令牌只在这次响应里给一次，立刻落本地
    if (data.deleteToken) saveDeleteToken(data.comment.id, data.deleteToken)

    if (data.pending) {
      // 进待审：不直接把内容插进列表，避免"看得见但别人看不见"的误导
      submitNotice.value = data.notice || '评论已提交，将尽快审核后显示'
    } else {
      comments.value = [data.comment, ...comments.value]
    }
    form.body = ''
    syncOwned()
  } catch (err) {
    submitError.value = err?.message || '发表失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

async function handleDelete(comment) {
  const token = getDeleteToken(comment.id)
  if (!token) return
  deletingId.value = comment.id
  submitError.value = ''
  try {
    await deleteOwnComment(comment.id, token)
    removeDeleteToken(comment.id)
    comments.value = comments.value.filter((c) => c.id !== comment.id)
    syncOwned()
  } catch (err) {
    submitError.value = err?.message || '删除失败，请稍后重试'
  } finally {
    deletingId.value = null
  }
}

/** 时间 → 相对时间（近 7 天）或日期 */
function formatTime(unixSec) {
  const diff = Math.floor(Date.now() / 1000) - unixSec
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  const d = new Date(unixSec * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoTime(unixSec) {
  return new Date(unixSec * 1000).toISOString()
}

/** 蜜罐被意外聚焦时立即移开焦点（例如密码管理器自动填充） */
function onHoneypotFocus(event) {
  event?.target?.blur?.()
}

// 头像清单：用来把评论里的 avatar ID 换成图片，进面板就载入一次
watch(
  () => props.pageKey,
  () => {
    comments.value = []
    cursor.value = null
    hasMore.value = false
    submitError.value = ''
    submitNotice.value = ''
    if (props.pageKey) load()
  },
  { immediate: true }
)

// 有评论带头像时才需要清单
watch(
  comments,
  (list) => {
    if (list.some((c) => c.avatar) && avatarCatalogState.value === 'idle') loadAvatarCatalog()
  },
  { immediate: true }
)
</script>

<style scoped>
/* 只保留业务特殊布局；面板底色/描边/按钮一律来自 theme.css 与 Ui 组件 */
.comments-list {
  list-style: none;
  margin: 0 0 4px;
  padding: 0;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-faint);
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-avatar {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border-soft);
  object-fit: cover;
}

.comment-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-solid);
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 700;
}

.comment-main {
  flex: 1 1 auto;
  min-width: 0;
}

.comment-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.comment-nick {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 700;
}

.comment-time {
  color: var(--text-faint);
  font-size: 12px;
}

.comment-delete {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--danger);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.comment-delete:disabled {
  opacity: 0.6;
  cursor: default;
}

.comment-delete:hover:not(:disabled) {
  text-decoration: underline;
}

/* 正文 ≥13px、行高 ≥1.6（UI 组件库 1.3 可读性红线）；长词强制换行 */
.comment-body {
  margin: 4px 0 0;
  color: var(--text-main);
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.comments-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.comments-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
}

.comment-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-faint);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-identity-text {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
  min-width: 0;
}

.comment-identity-text strong {
  color: var(--text-main);
}

.comment-identity-edit {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
  flex: 0 0 auto;
}

.comment-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--paper-soft);
  color: var(--text-main);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.6;
  resize: vertical;
  min-height: 72px;
}

.comment-textarea:focus {
  outline: 2px solid var(--accent-bright);
  outline-offset: 1px;
}

.comment-textarea::placeholder {
  color: var(--text-faint);
}

/* 蜜罐：正常用户与屏幕阅读器都感知不到。
   刻意不用 display:none —— 部分机器人只跳过 display:none 的字段；
   用 visibility:hidden + opacity:0 + 尺寸归零，元素仍在 DOM 与无障碍树之外。 */
.comment-honeypot {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.comment-form-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.comment-count {
  color: var(--text-faint);
  font-size: 12px;
  margin-right: auto;
}

.comment-submit-error {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
  line-height: 1.6;
}

.comment-submit-notice {
  margin: 0;
  color: var(--accent-ink);
  font-size: 13px;
  line-height: 1.6;
}
</style>
