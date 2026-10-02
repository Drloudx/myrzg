<template>
  <UiSection :title="title" class="comments-panel">
    <!-- 加载 / 错误 / 空 三态：统一用 UiEmptyState -->
    <UiEmptyState v-if="loading && !comments.length" type="loading" text="评论加载中..." />

    <template v-else>
      <div v-if="errorMessage" class="comments-error" role="alert">
        <UiEmptyState type="error" :text="errorMessage" />
        <UiButton variant="secondary" size="sm" @click="load()">重新加载</UiButton>
      </div>

      <template v-else>
        <ul v-if="shownComments.length" class="comments-list">
          <li v-for="c in shownComments" :key="c.id" class="comment-item">
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
                  v-if="!readOnly && ownedIds.has(c.id)"
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
              <!-- 右栏预览里要标明"这条来自哪个页面"，否则一串消息没有上下文 -->
              <button
                v-if="showPage && (c.pageLabel || c.pageKey)"
                type="button"
                class="comment-page-link"
                :title="c.pageKey"
                @click="emit('open-page', c)"
              >
                {{ c.pageLabel || c.pageKey }}
              </button>
            </div>
          </li>
        </ul>
        <UiEmptyState v-else :text="readOnly ? '还没有讨论' : '还没有人讨论，来说两句吧'" />

        <div v-if="!limit && hasMore" class="comments-more">
          <UiButton variant="secondary" size="sm" :disabled="loading" @click="loadMore()">
            {{ loading ? '加载中...' : '加载更多' }}
          </UiButton>
        </div>
      </template>

      <!-- 发表区：只读形态不显示（右栏预览 / 讨论区首页的历史消息） -->
      <form v-if="!readOnly" ref="formRef" class="comment-form" @submit.prevent="submit">
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
          placeholder="说点什么…"
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { UiButton, UiEmptyState, UiSection } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import {
  deleteOwnComment,
  fetchComments,
  fetchRecentComments,
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
   * 只读预览形态（`recent`）下不需要，所以非必填。
   */
  pageKey: { type: String, default: '' },
  /**
   * 该页面的人话名字（如「银币」），随评论一起存下来。
   * 管理端与账号弹窗据此显示物品名，而不是让用户去看 `item:item_00001` 这种内部标识；
   * 也不需要在打开评论列表时额外加载整份物品表（性能上更划算）。
   */
  pageLabel: { type: String, default: '' },
  /** 区块标题（右栏预览等处可改） */
  title: { type: String, default: '讨论' },
  /** 只读：不显示发表区与删除按钮（右栏预览用） */
  readOnly: { type: Boolean, default: false },
  /** 最多显示几条（0 = 不限，走分页的"加载更多"） */
  limit: { type: Number, default: 0 },
  /** 每条下方显示它来自哪个页面（全站最新列表用） */
  showPage: { type: Boolean, default: false },
  /**
   * 数据源换成"全站最新讨论"（`GET /api/recent`）而不是某个页面的评论。
   * 右栏预览与讨论区首页的历史消息用它。
   */
  recent: { type: Boolean, default: false }
})

const emit = defineEmits(['open-page'])

/** 实际上列表里显示的条目（`limit` 只是截断展示，不改变分页状态） */
const shownComments = computed(() =>
  props.limit > 0 ? comments.value.slice(0, props.limit) : comments.value
)

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

/** 发表区 DOM，用于发完把滚动条带回底部（否则新评论把表单顶出视口） */
const formRef = ref(null)

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
    // 两种数据源：某个页面的评论（可分页）／全站最新（固定条数、服务端有边缘缓存）
    const data = props.recent
      ? await fetchRecentComments()
      : await fetchComments(props.pageKey, { cursor: append ? cursor.value : undefined })
    comments.value = append ? [...comments.value, ...data.comments] : data.comments
    hasMore.value = !!data.hasMore
    cursor.value = data.nextCursor ?? null
    syncOwned()
  } catch (err) {
    // 只展示面向用户的中文；技术原因由 commentApi 写进控制台
    errorMessage.value = err?.message || '评论加载失败，请稍后重试'
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
      pageLabel: props.pageLabel,
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
    // 新评论插在列表最前，会把发表区往下顶。发完把滚动带到底部，
    // 让用户停在刚发的那条 + 输入框上，而不是盯着一片空白。
    await nextTick()
    scrollFormIntoView()
  } catch (err) {
    submitError.value = err?.message || '发表失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

/**
 * 删除自己的评论。
 *
 * 三条稳健性要求（都来自实际使用反馈）：
 *   1. **没有令牌时必须给出提示**。原先直接 `return` 什么都不做，
 *      表现就是"点删除只闪一下、没任何反应"——最难排查的一种失败。
 *   2. **把 404 当成删除成功**。服务端的删除是幂等的：当评论已经不可见时返回成功。
 *      但客户端仍要容忍旧的 404 响应（例如列表明明是旧快照），
 *      否则用户会看到"评论明明还在，却说不存在"。
 *   3. 无论服务端怎么回，删完都做一次列表刷新，让界面与真实状态对齐。
 */
async function handleDelete(comment) {
  if (deletingId.value) return
  const token = getDeleteToken(comment.id)
  if (!token) {
    submitError.value = '这条评论的删除凭据已失效，请联系站长处理'
    return
  }

  deletingId.value = comment.id
  submitError.value = ''
  submitNotice.value = ''
  try {
    await deleteOwnComment(comment.id, token)
    removeDeleteToken(comment.id)
    comments.value = comments.value.filter((c) => c.id !== comment.id)
    syncOwned()
  } catch (err) {
    if (err?.status === 404) {
      // 服务端认为它已经不在了：删除的目标状态已达成，按成功处理
      removeDeleteToken(comment.id)
      comments.value = comments.value.filter((c) => c.id !== comment.id)
      syncOwned()
    } else {
      submitError.value = err?.message || '删除失败，请稍后重试'
      // 失败时刷新一次列表，让用户看到真实状态（可能已在别处被删）
      try {
        await load()
      } catch {
        /* 刷新失败不再叠加提示，保留上面的错误文案 */
      }
    }
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

/**
 * 把发表区滚到可视区底部。
 *
 * 为什么不用 `alignElementInScrollTarget`（食谱/成就页用的那个）：那是**居中**对齐，
 * 会把表单怼到屏幕中间，而这里要的是"停在底部"。也不直接用 `scrollIntoView`——
 * 它会连带滚动所有可滚祖先，在本站「详情弹窗内嵌滚动 + 页面滚动」的双层结构里
 * 容易把外层页面一起滚走。
 *
 * 因此只操作**实际滚动根**：详情里是 `#itemModalScroll`，先找到它、直接置底。
 * 优先临时给表单加 `scroll-margin-bottom` 也无必要——置底后表单本来就在最下方。
 */
function scrollFormIntoView() {
  const form = formRef.value
  if (!form) return
  // 从表单向上找最接近的、真的能滚的祖先，找不到就退回详情弹窗的滚动区
  let node = form.parentElement
  let root = null
  while (node && node !== document.body) {
    if (node.scrollHeight > node.clientHeight + 4) {
      const overflowY = getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') {
        root = node
        break
      }
    }
    node = node.parentElement
  }
  if (!root) root = document.querySelector('#itemModalScroll')
  if (!root) return
  root.scrollTop = root.scrollHeight
}

/**
 * 数据加载时机。
 *
 * - **普通形态**（详情里的讨论区）：换 pageKey 时重置并重新加载；
 *   默认展开、挂载即拉评论（按用户要求保持"直接看见讨论"的体验）。
 *   额度提醒（2026-10-02 记录，用户明确要求暂不优化）：物品图鉴是首页、点开很频繁，
 *   因此"每次打开详情一次评论请求"是评论功能最大的一项固定开销。要省额度时把本节的
 *   `UiSection` 改成 `collapsible` + 默认收起、展开时才 `load()` 即可（改动只需几行）。
 * - **最新形态**（右栏预览 / 讨论区首页的历史消息）：只在挂载时拉一次；
 *   服务端那条带 30 秒边缘共享缓存，所以频繁打开页面也不会反复查库。
 */
watch(
  () => [props.pageKey, props.recent],
  () => {
    comments.value = []
    cursor.value = null
    hasMore.value = false
    submitError.value = ''
    submitNotice.value = ''
    if (props.recent || props.pageKey) load()
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 每条评论做成卡片：与符石图鉴的 .rune-entry 同一套视觉
   （--paper-soft 底 + 1px --border-soft 描边 + 6px 圆角），
   让讨论区和物品详情的其它 UiSection 在观感上分开。
   注意：详情里"卡片不从上方面板缝里露出来"靠的是 App.vue 对
   `[data-main-scroll]` 的裁剪（UiModal 的 .ui-modal-body 已按 header 底边裁剪），
   与卡片自身的背景/层叠无关——不要为此加 z-index 或改背景。 */
.comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
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

/* 全站最新列表里标注「这条来自哪个页面」：做成可点的小胶囊 */
.comment-page-link {
  margin-top: 6px;
  padding: 1px 7px;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: var(--paper-solid);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.6;
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-page-link:hover {
  border-color: var(--accent-bright);
  color: var(--accent-ink);
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
