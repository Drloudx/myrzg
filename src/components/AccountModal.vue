<template>
  <UiModal
    :visible="modelValue"
    title="账号"
    max-width="560px"
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
          <span class="account-preview-title">{{ selectedPath ? '已选择头像' : '未选择头像' }}</span>
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
              :title="item.id"
              @click="draft.avatar = item.id"
            >
              <img :src="getImageUrl(item.path)" alt="" loading="lazy" decoding="async" />
            </button>
          </div>
        </div>
      </template>
    </UiSection>

    <p class="account-note">
      这是**本机身份**，不是账号：不注册、不登录、不跨设备同步，也不验证身份——
      因此别人可以把昵称设成你的名字。评论管理（审核、删除）在
      <button type="button" class="account-link" @click="goAdmin">评论管理页</button>。
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="close()">取消</UiButton>
      <UiButton variant="primary" :disabled="!draft.nick.trim()" @click="confirm">保存</UiButton>
    </template>
  </UiModal>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { UiModal, UiSection, UiButton, UiEmptyState } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import {
  avatarCatalogState,
  avatarGroups,
  avatarPath,
  identity,
  loadAvatarCatalog,
  saveIdentity
} from '../utils/identity.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])
const router = useRouter()

/** 草稿：只有点「保存」才写入，取消不留痕 */
const draft = ref({ nick: '', avatar: '' })

const selectedPath = computed(() => avatarPath(draft.value.avatar))

// 每次打开都从已保存的身份初始化，并确保头像清单已加载
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    draft.value = { nick: identity.value.nick, avatar: identity.value.avatar }
    loadAvatarCatalog()
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

async function goAdmin() {
  close()
  // 先让关闭这一帧落地再切路由：弹窗是 teleport 到 body 的全局弹窗，
  // 与路由切换在同一帧会让覆盖层登记与滚动锁的时序变得不确定。
  await nextTick()
  router.push('/admin/comments')
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

.account-link {
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

/* 头像数量较多，放在可滚动容器里，避免弹窗被撑得极高 */
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
  max-height: 216px;
  overflow-y: auto;
  padding: 2px;
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
  .avatar-grid {
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    max-height: 190px;
  }
}
</style>
