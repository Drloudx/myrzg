<template>
  <UiModal
    :visible="modelValue"
    title="账号"
    max-width="720px"
    teleport-to="body"
    @update:visible="close"
  >
    <!--
      「账号」是**本机身份**：昵称与头像只存这台设备的浏览器，不注册、不登录、不跨设备同步。
      评论时自动带上，因此用户不必每次重填。

      它防不了冒充（任何人都能把昵称设成你的名字）——弹窗里如实说明，不伪装成账号体系。
      真正账号需要的后端认证受 Workers 免费版 10ms CPU 限制，是独立一期的事，
      决策依据见 docs/technical/COMMENTS_BACKEND.md 第七节。
    -->
    <UiSection title="昵称">
      <input
        v-model="draft.nick"
        class="account-input"
        type="text"
        maxlength="24"
        placeholder="给自己起个名字，评论时会显示"
        autocomplete="nickname"
        @keyup.enter="confirm"
      />
      <p class="account-hint">{{ draft.nick.trim().length }}/24 · 本机保存，换设备需要重新设置</p>
    </UiSection>

    <UiSection :title="`头像${draft.avatar ? '（已选）' : '（可选）'}`">
      <div class="account-preview">
        <img v-if="selectedPath" :src="getImageUrl(selectedPath)" alt="" class="account-preview-img" />
        <div v-else class="account-preview-img account-preview-empty" aria-hidden="true">
          {{ draft.nick.trim().slice(0, 1) || '?' }}
        </div>
        <div class="account-preview-text">
          <span class="account-preview-title">{{ selectedName || '未选择头像' }}</span>
          <span class="account-hint">不选也行，评论时会用昵称首字代替</span>
        </div>
        <UiButton v-if="draft.avatar" variant="ghost" size="sm" @click="draft.avatar = ''">清除</UiButton>
      </div>

      <UiEmptyState v-if="avatarCatalogState === 'loading'" type="loading" text="头像加载中..." />
      <div v-else-if="avatarCatalogState === 'error'" class="account-hint">
        头像列表暂时加载不出来，可以先只设置昵称，稍后再试。
      </div>
      <template v-else>
        <!-- 分组默认收起：76 个头像全铺开会把弹窗撑得很长，而多数人只用其中一两个 -->
        <UiAccordion
          v-for="group in avatarGroups"
          :key="group.key"
          class="avatar-group"
          :title="`${group.label}（${group.items.length}）`"
          :model-value="expandedGroups.has(group.key)"
          @update:model-value="(v) => toggleGroup(group.key, v)"
        >
          <div class="avatar-grid">
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="avatar-cell"
              :class="{ active: draft.avatar === item.id }"
              :title="item.name || item.id"
              :aria-label="item.name || item.id"
              @click="draft.avatar = item.id"
            >
              <img :src="getImageUrl(item.path)" :alt="item.name || ''" loading="lazy" decoding="async" />
            </button>
          </div>
        </UiAccordion>
      </template>
    </UiSection>

    <p class="account-note">
      这是**本机身份**，不是账号：不注册、不登录、不跨设备同步，也不验证身份——
      因此别人可以把昵称设成你的名字。
    </p>

    <UiSection title="我发过的评论">
      <!--
        改成**点击才加载**（用户要求）：自动加载会在每次打开账号弹窗时都打一次接口，
        属于"用户没操作也会产生的固定开销"。这里只在用户主动点击时才请求。

        默认**不显示具体条数**：本机令牌里可能残留已在别处删掉的评论
        （用户就见过"发过 37 条"却一条都查不到）。数量以服务端返回为准，点开后才显示。
      -->
      <UiEmptyState v-if="!storedCount" text="这台设备上还没有发过评论" />
      <div v-else-if="!myLoaded" class="my-load-row">
        <span class="account-hint">查看这台设备上发过的评论</span>
        <UiButton variant="secondary" size="sm" @click="loadMyComments()">查看</UiButton>
      </div>
      <UiEmptyState v-else-if="myLoading" type="loading" text="加载中..." />
      <div v-else-if="myFailed" class="account-hint">
        暂时取不到，可能是网络问题。
        <button type="button" class="account-retry" @click="loadMyComments()">重试</button>
      </div>
      <template v-else>
        <p v-if="!myComments.length" class="account-hint">这些评论都已经删除了。</p>
        <template v-else>
          <p class="account-hint">共 {{ myComments.length }} 条</p>
          <ul class="my-list">
            <li v-for="c in myComments" :key="c.id" class="my-item">
              <div class="my-head">
                <UiTag :tone="statusTone(c.status)">{{ statusLabel(c.status) }}</UiTag>
                <!-- 显示物品名而不是 item:item_00001；名字随评论一起存，不额外加载物品表 -->
                <span class="my-page" :title="c.pageKey">{{ c.pageLabel || c.pageKey }}</span>
                <time class="my-time">{{ formatTime(c.createdAt) }}</time>
              </div>
              <p class="my-body">{{ c.body }}</p>
              <div class="my-foot">
                <button type="button" class="my-delete" :disabled="deleting" @click="askDelete(c)">删除</button>
              </div>
            </li>
          </ul>
        </template>
      </template>
      <p v-if="myError" class="my-error" role="alert">{{ myError }}</p>
    </UiSection>

    <template #footer>
      <UiButton variant="ghost" @click="close()">取消</UiButton>
      <UiButton variant="primary" :disabled="!draft.nick.trim()" @click="confirm">保存</UiButton>
    </template>
  </UiModal>

  <!--
    删除确认：**不用 window.confirm**——那是浏览器原生样式，与本项目的羊皮纸设计系统完全不搭，
    也绕过了共享覆盖层体系（overlayStack / globalModalLock）。
    用同一个 UiModal 并 teleport 到 body，z-index 取 14000：
    高于全局弹窗的下限 12000 与业务弹窗的 13000，才能盖在账号弹窗之上。
  -->
  <UiModal
    :visible="pendingDelete !== null"
    title="删除评论"
    max-width="420px"
    teleport-to="body"
    :z-index="14000"
    @update:visible="(v) => { if (!v) pendingDelete = null }"
  >
    <p class="account-note">这条评论会从讨论区移除，且无法恢复。</p>
    <p v-if="pendingDelete" class="confirm-quote">{{ pendingDelete.body }}</p>
    <p v-if="myError" class="my-error" role="alert">{{ myError }}</p>
    <template #footer>
      <UiButton variant="ghost" @click="pendingDelete = null">取消</UiButton>
      <UiButton variant="danger" :disabled="deleting" @click="deleteConfirmed">
        {{ deleting ? '删除中…' : '确认删除' }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { UiModal, UiSection, UiButton, UiEmptyState, UiTag, UiAccordion } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import {
  avatarCatalogState,
  avatarEntry,
  avatarGroups,
  avatarPath,
  identity,
  loadAvatarCatalog,
  saveIdentity
} from '../utils/identity.js'
import { fetchMyComments, getDeleteToken, listOwnedCommentIds, deleteOwnComment, removeDeleteToken } from '../utils/commentApi.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

/** 草稿：只有点「保存」才写入，取消不留痕 */
const draft = ref({ nick: '', avatar: '' })

/**
 * 已展开的头像分组。**默认全收起**（用户在 76 个头像里通常只用一两个，
 * 全铺开会把弹窗撑得很长）。用 Set 而不是逐组 ref，便于按 key 增删。
 */
const expandedGroups = ref(new Set())
function toggleGroup(key, open) {
  const next = new Set(expandedGroups.value)
  if (open) next.add(key)
  else next.delete(key)
  expandedGroups.value = next
}

/** 「我发过的评论」：凭本机保存的自删令牌取回，含待审/已隐藏状态 */
const myComments = ref([])
const myLoading = ref(false)
const myFailed = ref(false)
const myError = ref('')
/** 待确认删除的那条评论（null 表示确认框关闭） */
const pendingDelete = ref(null)
const deleting = ref(false)
/** 是否已请求过「我发过的评论」——改成点击才加载，避免每次打开弹窗都打接口 */
const myLoaded = ref(false)

/**
 * 本机存有令牌的评论数（**仅本地计数，不代表这些评论还在库里**）。
 * 只用于决定是否显示「查看」入口——不显示具体数字，
 * 因为那个数字会包含已在别处删掉的残留令牌（用户见过"37 条"却查不到的情况）。
 */
const storedCount = ref(0)

/** 只算本机有多少条可回看，不请求接口 */
function refreshOwnedCount() {
  storedCount.value = listOwnedCommentIds().length
  myLoaded.value = false
}

async function loadMyComments() {
  const ids = listOwnedCommentIds()
  if (!ids.length) {
    myComments.value = []
    storedCount.value = 0
    myFailed.value = false
    myLoaded.value = true
    return
  }
  myLoading.value = true
  myFailed.value = false
  myError.value = ''
  try {
    const items = ids
      .map((id) => ({ id, token: getDeleteToken(id) }))
      .filter((it) => it.token)
    const data = await fetchMyComments(items)
    myComments.value = data?.comments || []
    // 以**服务端实际返回的条数**为准：本机可能残留已在别处删除的评论令牌。
    // 顺手清掉那些失效令牌，避免数量越攒越多（用户遇到的"37 条"就是这么来的）。
    const alive = new Set(myComments.value.map((c) => c.id))
    for (const id of ids) if (!alive.has(id)) removeDeleteToken(id)
    storedCount.value = myComments.value.length
    myLoaded.value = true
  } catch {
    myFailed.value = true
  } finally {
    myLoading.value = false
  }
}

/**
 * 删除自己的评论。
 * 复用已有的 DELETE /api/comments（凭本机令牌），**不新增接口、不额外查库**。
 * 确认走 UiModal（见模板），不用 window.confirm。
 */
function askDelete(comment) {
  if (deleting.value) return
  myError.value = ''
  pendingDelete.value = comment
}

async function deleteConfirmed() {
  const comment = pendingDelete.value
  if (!comment || deleting.value) return
  const token = getDeleteToken(comment.id)
  if (!token) {
    myError.value = '这条评论的删除凭据已失效'
    pendingDelete.value = null
    return
  }
  deleting.value = true
  myError.value = ''
  try {
    await deleteOwnComment(comment.id, token)
    removeDeleteToken(comment.id)
    myComments.value = myComments.value.filter((c) => c.id !== comment.id)
    pendingDelete.value = null
  } catch (err) {
    // 服务端删除是幂等的：404 视为已删除
    if (err?.status === 404) {
      removeDeleteToken(comment.id)
      myComments.value = myComments.value.filter((c) => c.id !== comment.id)
      pendingDelete.value = null
    } else {
      myError.value = err?.message || '删除失败，请稍后再试'
    }
  } finally {
    deleting.value = false
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
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const selectedPath = computed(() => avatarPath(draft.value.avatar))
/** 选中头像对应的角色/魔物名，用作预览区标题（比显示 at001b_0 这种内部编号友好） */
const selectedName = computed(() => avatarEntry(draft.value.avatar)?.name || '')

// 每次打开都从已保存的身份初始化；头像清单按需加载。
// **「我发过的评论」不在这里请求**——只统计本机有多少条，等用户点「查看」才打接口。
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    draft.value = { nick: identity.value.nick, avatar: identity.value.avatar }
    loadAvatarCatalog()
    refreshOwnedCount()
    // 重置上一次的展开状态：每次打开都是"未加载"，用户点才请求
    myLoaded.value = false
    myComments.value = []
    myError.value = ''
    pendingDelete.value = null
  },
  { immediate: true }
)

function close() {
  emit('update:modelValue', false)
}

function confirm() {
  if (!draft.value.nick.trim()) return
  saveIdentity(draft.value)
  close()
}
</script>

<style scoped>
/* 只保留业务布局；面板/按钮/章节样式一律来自 theme.css 与 Ui 组件 */
.account-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--paper-soft);
  color: var(--text-main);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}

.account-input:focus {
  outline: 2px solid var(--accent-bright);
  outline-offset: 1px;
}

.account-input::placeholder {
  color: var(--text-faint);
}

.account-hint {
  margin: 6px 0 0;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.6;
}

.account-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

/* 「我发过的评论」列表 */
.my-load-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.my-load-row .account-hint {
  margin: 0;
}

.my-load-row > :last-child {
  margin-left: auto;
}

/* 确认框里引用的待删评论正文 */
.confirm-quote {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-left: 3px solid var(--border-color);
  background: var(--paper-soft);
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  max-height: 120px;
  overflow-y: auto;
}

.my-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.my-item {
  padding: 8px 10px;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}

.my-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.my-page {
  color: var(--text-faint);
  font-size: 12px;
}

.my-time {
  margin-left: auto;
  color: var(--text-faint);
  font-size: 12px;
}

.my-body {
  margin: 6px 0 0;
  color: var(--text-main);
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.my-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.my-delete {
  padding: 0;
  border: none;
  background: none;
  color: var(--danger);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.my-delete:hover:not(:disabled) {
  text-decoration: underline;
}

.my-delete:disabled {
  opacity: 0.6;
  cursor: default;
}

.my-error {
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 13px;
  line-height: 1.6;
}

.account-retry {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}


.account-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.account-preview-img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  object-fit: cover;
  flex: 0 0 auto;
}

.account-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-solid);
  color: var(--text-muted);
  font-size: 22px;
  font-weight: 700;
}

.account-preview-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.account-preview-title {
  color: var(--text-main);
  font-size: 13.5px;
  font-weight: 700;
}

/* 分组标题由 UiAccordion 渲染，这里只留组间距 */
.avatar-group + .avatar-group {
  margin-top: 4px;
}

/* 头像数量较多，但**不再自己开滚动条**：
   原先这里给了 max-height + overflow-y，结果在弹窗（本身可滚）内部又套一层滚动区，
   出现两条滚动条互相抢滚动（用户指出的问题）。
   现在让它自然铺开、统一由弹窗正文滚动。 */
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.avatar-cell {
  padding: 0;
  border: 1px solid var(--border-soft);
  border-radius: 50%;
  background: var(--paper-soft);
  cursor: pointer;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  line-height: 0;
}

.avatar-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-cell:hover {
  border-color: var(--accent-bright);
}

.avatar-cell.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bright);
}

@media (max-width: 600px) {
  /* 手机端只缩格子，同样不自己开滚动条（统一由弹窗正文滚） */
  .avatar-grid {
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  }
}
</style>
