<template>
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
      :maxlength="MAX_BODY"
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
      <span class="comment-count">{{ form.body.length }}/{{ MAX_BODY }}</span>
      <UiButton variant="primary" size="sm" :disabled="submitting || !canSubmit" @click="submit">
        {{ submitting ? '提交中...' : '发表' }}
      </UiButton>
    </div>

    <p v-if="error" class="comment-submit-error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="comment-submit-notice" role="status">{{ notice }}</p>
  </form>
</template>

<script setup>
/**
 * CommentComposer —— 评论发表区（昵称/头像来自「账号」弹窗，这里不重复填写）。
 *
 * 为什么从 `CommentsPanel` 拆出来：讨论区页面需要**把发表区固定在滚动容器之外**
 * （用户要求"悬浮在底部"）。留在 `CommentsPanel` 里就只能跟着列表一起滚，
 * 消息一多就被推出视野——那是"列表底部"而不是"容器底部"。
 *
 * 复用：`CommentsPanel` 内部仍用它（详情弹窗里的讨论区形态不变），
 * 讨论区页面则单独放在滚动容器下方。
 */
import { computed, reactive, ref } from 'vue'
import { UiButton } from './ui/index.js'
import { getImageUrl } from '../utils/env.js'
import { postComment, saveDeleteToken } from '../utils/commentApi.js'
import { notifyCommentPosted } from '../utils/commentEvents.js'
import { avatarPath, identity, openAccountModal } from '../utils/identity.js'

const props = defineProps({
  /** 评论归属键（`item:xxx` / `site:general`） */
  pageKey: { type: String, required: true },
  /** 该页面的人话名字，随评论一起存下来（管理端与账号弹窗据此显示） */
  pageLabel: { type: String, default: '' }
})

const emit = defineEmits(['posted'])

/**
 * 正文字数上限。**必须与服务端 `MAX_BODY` 保持一致**
 * （`functions/api/[[path]].js`，超出会被服务端明确拒绝）。
 * 前端 maxlength 只是第一道防线：绕过它（改 DOM / 直接调接口）也不会被接受。
 */
const MAX_BODY = 200

const form = reactive({ body: '', hp: '' })
const submitting = ref(false)
const error = ref('')
const notice = ref('')

const myAvatarPath = computed(() => {
  const path = avatarPath(identity.value.avatar)
  return path ? getImageUrl(path) : ''
})

const canSubmit = computed(() => form.body.trim().length > 0)

/** 蜜罐被意外聚焦时立即移开焦点（例如密码管理器自动填充） */
function onHoneypotFocus(event) {
  event?.target?.blur?.()
}

async function submit() {
  if (submitting.value || !canSubmit.value) return

  // 未设昵称：先把账号弹窗打开让用户设好，回来再点发表。
  // 不自动用"匿名"顶替，否则用户会以为设置已生效。
  if (!identity.value.nick.trim()) {
    error.value = ''
    notice.value = '请先设置昵称，保存后再点「发表」'
    openAccountModal()
    return
  }

  submitting.value = true
  error.value = ''
  notice.value = ''
  try {
    const data = await postComment({
      pageKey: props.pageKey,
      pageLabel: props.pageLabel,
      nick: identity.value.nick.trim(),
      avatar: identity.value.avatar || '',
      body: form.body.trim(),
      hp: form.hp
    })
    // 令牌只在这次响应里给一次，立刻落本地（用于作者自删）
    if (data.deleteToken) saveDeleteToken(data.comment.id, data.deleteToken)

    if (data.pending) {
      // 进待审：不直接插进列表，避免"看得见但别人看不见"的误导
      notice.value = data.notice || '评论已提交，将尽快审核后显示'
    }
    form.body = ''
    // 广播：右栏「最新讨论」等其他位置的评论列表据此刷新
    // （它们与发表区互不相识，靠这个信号解耦，见 utils/commentEvents.js）
    notifyCommentPosted()
    // 交给调用方刷新列表（发表区在组件外时由父组件调 CommentsPanel.reload()）
    emit('posted', data)
  } catch (err) {
    error.value = err?.message || '发表失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* 与 CommentsPanel 里的同名类保持一致（同一视觉，两处使用） */
.comment-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-identity {
  display: flex;
  align-items: center;
  gap: 8px;
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
