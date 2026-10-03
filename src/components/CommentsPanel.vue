<template>
  <!-- `listRoot` 只是给滚动监听挂载用的锚点（真正的滚动容器由 CSS/父级决定） -->
  <UiSection
    ref="listRoot"
    :title="title"
    class="comments-panel"
    :data-has-more="hasMore ? '1' : '0'"
    :data-loading="loading ? '1' : '0'"
    :data-count="comments.length"
  >
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

        <!--
          分页入口两种形态：
          - `loadMoreOnScroll`（聊天式）：**不显示按钮**，往上翻到底部时自动加载更早的
            （见 listRoot 上的滚动监听）。"往上翻看历史"本身就是加载意图，再点一次是多余。
          - 默认（列表式）：保留「加载更多」按钮。
          加载中/到底了都**不再额外提示**：前者有内容变化本身作为反馈，
          后者用户翻到头自然知道（用户明确说这类提醒没必要）。
        -->
        <div v-if="!limit && hasMore && !loadMoreOnScroll" class="comments-more">
          <UiButton variant="secondary" size="sm" :disabled="loading" @click="loadMore()">
            {{ loading ? '加载中...' : '加载更多' }}
          </UiButton>
        </div>
      </template>

      <!-- 删除等操作的失败提示：列表仍然可见，只提示这一次操作失败 -->
      <p v-if="actionError" class="comment-submit-error" role="alert">{{ actionError }}</p>

      <!-- 发表区：只读形态不显示（右栏预览）。
           抽成 CommentComposer 是为了让讨论区页面能把它放到**滚动容器之外**
           （用户要求"悬浮在底部"：留在容器里消息一多就被推出视野） -->
      <CommentComposer
        v-if="!readOnly"
        :page-key="props.pageKey"
        :page-label="props.pageLabel"
        @posted="onPosted"
      />
    </template>
  </UiSection>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { UiButton, UiEmptyState, UiSection } from './ui/index.js'
import CommentComposer from './CommentComposer.vue'
import { getImageUrl } from '../utils/env.js'
import {
  deleteOwnComment,
  fetchComments,
  fetchRecentComments,
  getDeleteToken,
  removeDeleteToken
} from '../utils/commentApi.js'
import { avatarCatalogState, avatarPath, loadAvatarCatalog } from '../utils/identity.js'

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
  recent: { type: Boolean, default: false },
  /**
   * 聊天式排序：**最新在最后**（站内讨论区与右栏预览用）。
   *
   * 服务端一律按"最新在前"返回，这里整体反转。默认关闭，
   * 因为图鉴详情里的讨论区是"列表"形态（最新的在最上面更符合翻阅习惯），
   * 而聊天形态是"最新在底部、输入框就在下面"。
   */
  reverse: { type: Boolean, default: false },
  /**
   * 上滑到顶部时**自动加载更早的**，不显示「加载更多」按钮。
   *
   * 聊天式视图里"往上翻看历史"本身就是加载意图，再让人点一次按钮是多余的；
   * 按钮形态仍保留给默认（列表）形态使用。
   */
  loadMoreOnScroll: { type: Boolean, default: false }
})

const emit = defineEmits(['open-page', 'loading-earlier'])

/** 实际上列表里显示的条目（`limit` 只是截断展示，不改变分页状态） */
const shownComments = computed(() =>
  props.limit > 0 ? comments.value.slice(0, props.limit) : comments.value
)

/**
 * 已载入的条数。供父组件判断"列表是否已经来了数据"
 * （讨论区页面用它决定何时滚到最新一条）。
 */
const commentsLength = computed(() => comments.value.length)

const comments = ref([])
const loading = ref(false)
const errorMessage = ref('')
/** 删除等操作的失败提示（与"加载失败"分开：列表仍可见，只提示这次操作失败） */
const actionError = ref('')
const cursor = ref(null)
const hasMore = ref(false)
const deletingId = ref(null)

/** 本机发表过的评论 id，用于显示"删除"按钮 */
const ownedIds = ref(new Set())

/**
 * 发表成功后的回调（由 CommentComposer 触发）。
 *
 * 重新拉一次列表：发表区已移到组件外（讨论区页面要把它固定在滚动容器之外），
 * 不能再靠"本地往前插一条"同步——那样两处状态会不一致。
 */
async function onPosted() {
  actionError.value = ''
  await load()
}

/**
 * 供父组件在"发表区在组件外"时刷新列表（讨论区页面就是这种结构）。
 * 例如 DiscussionsView 把 CommentComposer 放在滚动容器之外，
 * 发完由它调用本方法，让列表与发表区状态保持一致。
 * 返回 Promise，调用方可以 `await` 后再滚到最新一条。
 */
function reload() {
  actionError.value = ''
  return load()
}

/**
 * 发表成功后**只把新评论并进列表**，不重新拉整页。
 *
 * 为什么不能直接 `reload()`：重拉会用服务端返回的新数组整体替换 `comments`，
 * Vue 于是把全部列表项**销毁重建**；重建期间 `scrollHeight` 会短暂变化，
 * 表现为"滚动条忽然变长又变短地闪一下"（用户反馈）。
 * 只 push/unshift 一条，其余 DOM 完全不动，就没有这个闪烁。
 *
 * 列表顺序与 `reverse` 一致：聊天式最新在末尾（push），列表式最新在开头（unshift）。
 */
function addPostedComment(comment) {
  if (!comment?.id) return
  if (props.reverse) comments.value = [...comments.value, comment]
  else comments.value = [comment, ...comments.value]
  syncOwned()
}

defineExpose({ reload, addPostedComment, commentsLength, hasMore, loading })

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
    // 两种数据源：某个页面的评论（可分页）／讨论区最新（固定条数、服务端有边缘缓存）
    const data = props.recent
      ? await fetchRecentComments()
      : await fetchComments(props.pageKey, { cursor: append ? cursor.value : undefined })

    /*
     * 排序：服务端一律按 **id 倒序**（最新在前）。
     *
     * `reverse` 模式（站内讨论区，聊天式）下改为**最新在最后**：
     * 接口是"最新在前"，所以整体反转即可；而"加载更早的"这一页同样是"最新在前"，
     * 反转后应**接在列表最前面**（`append` 时用 prepend 而不是 push）。
     */
    if (props.reverse) {
      const page = [...data.comments].reverse()
      comments.value = append ? [...page, ...comments.value] : page
    } else {
      comments.value = append ? [...comments.value, ...data.comments] : data.comments
    }

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

/**
 * 绑定滚动监听。
 *
 * **必须挂在真正的滚动祖先上，不能用 capture 挂在自己身上**：
 * capture 只能捕获**后代**的滚动事件，而这里的滚动容器（`.discussion-scroll` /
 * `#itemModalScroll`）是本组件的**祖先**——挂在自己身上永远收不到（实测踩到过）。
 *
 * 也不在 `onMounted` 里一次找完就罢：那一刻列表可能还没渲染出滚动高度，
 * `findScrollParent` 会因为 `scrollHeight <= clientHeight` 而找不到目标。
 * 所以用 watcher 在有数据后重试。
 */
const listRoot = ref(null)
let boundScroller = null

function scrollHost() {
  return listRoot.value?.$el || listRoot.value || null
}

function findScrollParent(el) {
  let node = el?.parentElement
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return null
}

/** 找一个**能滚**的祖先；找不到时退回到最近的可滚样式祖先（内容还没撑开的情况） */
function resolveScroller() {
  const host = scrollHost()
  let node = host?.parentElement
  let fallback = null
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') {
      if (!fallback) fallback = node
      if (node.scrollHeight > node.clientHeight + 4) return node
    }
    node = node.parentElement
  }
  return fallback
}

async function loadEarlierKeepingPosition(scroller) {
  if (!hasMore.value || loading.value) return
  const root = scroller || resolveScroller()
  if (!root) return

  const anchor = root.querySelector?.('.comment-item')
  const before = anchor ? anchor.getBoundingClientRect().top - root.getBoundingClientRect().top : 0

  /*
   * 通知父组件"这是往上补历史，别自动滚到底"。
   * 否则父组件 watch 到条数变化会把用户又拽回最新一条，
   * 同时覆盖掉下面这段锚点补偿（实测问题）。
   */
  emit('loading-earlier', true)
  try {
    await load({ append: true })
    await nextTick()
    const anchorAfter = root.querySelector?.('.comment-item')
    if (anchorAfter) {
      const after = anchorAfter.getBoundingClientRect().top - root.getBoundingClientRect().top
      root.scrollTop += after - before
    }
  } finally {
    emit('loading-earlier', false)
  }
}

function onListScroll(event) {
  if (!props.loadMoreOnScroll || !hasMore.value || loading.value) return
  const root = event?.currentTarget || resolveScroller()
  // 距离顶部 80px 内就触发，避免"必须精准拖到最顶"的手感
  if (root && root.scrollTop <= 80) loadEarlierKeepingPosition(root)
}

function bindScroller() {
  if (!props.loadMoreOnScroll) return
  const next = resolveScroller()
  if (!next || next === boundScroller) return
  boundScroller?.removeEventListener('scroll', onListScroll)
  next.addEventListener('scroll', onListScroll, { passive: true })
  boundScroller = next
}

watch(
  () => [props.loadMoreOnScroll, comments.value.length],
  () => nextTick(bindScroller),
  { immediate: true }
)

onBeforeUnmount(() => {
  boundScroller?.removeEventListener('scroll', onListScroll)
  boundScroller = null
})

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
    actionError.value = '这条评论的删除凭据已失效，请联系站长处理'
    return
  }

  deletingId.value = comment.id
  actionError.value = ''
  actionError.value = ''
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
      actionError.value = err?.message || '删除失败，请稍后重试'
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
    actionError.value = ''
    actionError.value = ''
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

/* 分页提示（聊天式：自动加载的说明 / 已到最早） */
.comments-more-hint {
  margin: 0;
  padding: 6px 0;
  color: var(--text-faint);
  font-size: 12.5px;
  line-height: 1.6;
  text-align: center;
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
