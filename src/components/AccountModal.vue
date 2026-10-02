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
        <div v-for="group in avatarGroups" :key="group.key" class="avatar-group">
          <div class="avatar-group-label">{{ group.label }}（{{ group.items.length }}）</div>
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
        </div>
      </template>
    </UiSection>

    <p class="account-note">
      这是**本机身份**，不是账号：不注册、不登录、不跨设备同步，也不验证身份——
      因此别人可以把昵称设成你的名字。
    </p>

    <UiSection title="我发过的评论">
      <UiEmptyState v-if="myLoading" type="loading" text="加载中..." />
      <UiEmptyState v-else-if="!myComments.length && !myFailed" text="这台设备上还没有发过评论" />
      <div v-else-if="myFailed" class="account-hint">
        暂时取不到，可能是网络问题。
        <button type="button" class="account-retry" @click="loadMyComments()">重试</button>
      </div>
      <ul v-else class="my-list">
        <li v-for="c in myComments" :key="c.id" class="my-item">
          <div class="my-head">
            <UiTag :tone="statusTone(c.status)">{{ statusLabel(c.status) }}</UiTag>
            <span class="my-page">{{ c.pageKey }}</span>
            <time class="my-time">{{ formatTime(c.createdAt) }}</time>
          </div>
          <p class="my-body">{{ c.body }}</p>
        </li>
      </ul>
      <p v-if="myComments.length" class="account-hint">
        删除请到对应物品的讨论区：列表里自己的评论旁有「删除」。
      </p>
    </UiSection>

    <template #footer>
      <UiButton variant="ghost" @click="close()">取消</UiButton>
      <UiButton variant="primary" :disabled="!draft.nick.trim()" @click="confirm">保存</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { UiModal, UiSection, UiButton, UiEmptyState, UiTag } from './ui/index.js'
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
import { fetchMyComments, getDeleteToken, listOwnedCommentIds } from '../utils/commentApi.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

/** 草稿：只有点「保存」才写入，取消不留痕 */
const draft = ref({ nick: '', avatar: '' })

/** 「我发过的评论」：凭本机保存的自删令牌取回，含待审/已隐藏状态 */
const myComments = ref([])
const myLoading = ref(false)
const myFailed = ref(false)

async function loadMyComments() {
  const ids = listOwnedCommentIds()
  if (!ids.length) {
    myComments.value = []
    myFailed.value = false
    return
  }
  myLoading.value = true
  myFailed.value = false
  try {
    const items = ids
      .map((id) => ({ id, token: getDeleteToken(id) }))
      .filter((it) => it.token)
    const data = await fetchMyComments(items)
    myComments.value = data?.comments || []
  } catch {
    myFailed.value = true
  } finally {
    myLoading.value = false
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

// 每次打开都从已保存的身份初始化，并确保头像清单与"我发过的评论"都是最新的
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    draft.value = { nick: identity.value.nick, avatar: identity.value.avatar }
    loadAvatarCatalog()
    loadMyComments()
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

.avatar-group + .avatar-group {
  margin-top: 10px;
}

.avatar-group-label {
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 700;
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
