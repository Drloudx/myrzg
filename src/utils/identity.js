/**
 * 本机身份（昵称 + 头像）
 *
 * ## 这是什么，不是什么
 * 这是**本机身份**，不是账号体系：昵称与头像只存在浏览器 localStorage，
 * 不注册、不登录、无密码、不跨设备同步。评论时自动带上，用户不用每次重填。
 *
 * **它防不了冒充**：任何人都能把昵称设成别人的名字。真正的账号体系需要后端认证
 * （受 Workers 免费版 10ms CPU 限制，只能走托管认证），是独立一期的事。
 * 决策依据见 docs/technical/COMMENTS_BACKEND.md 第七节。
 *
 * ## 为什么存头像 ID 而不是图片路径
 * 存 `avatar_pet_006` 这样的 ID，路径由 `avatarCatalog.json` 查。
 * 这样素材目录改名或迁移时只需更新清单，**库里的历史评论不会指向失效路径**；
 * 服务端也能用同一份 ID 白名单校验，避免客户端塞任意字符串进库。
 */
import { computed, ref } from 'vue'

const STORAGE_KEY = 'myrzg:identity'

/** 头像 ID 白名单（与服务端 `functions/api/[[path]].js` 的校验同源，都来自 avatarCatalog.json） */
export const AVATAR_ID_RE = /^[A-Za-z0-9_]{1,40}$/

export const identity = ref({ nick: '', avatar: '' })

/** 头像清单加载状态：'idle' | 'loading' | 'ready' | 'error' */
export const avatarCatalogState = ref('idle')
export const avatarGroups = ref([])

let accountModalOpen = null

/** 由 App.vue 在 setup 时注入账号弹窗开关，避免子组件各自维护一份弹窗状态 */
export function registerAccountModal(openFn) {
  accountModalOpen = openFn
}

/** 打开账号弹窗（评论面板在未设昵称时调用） */
export function openAccountModal() {
  accountModalOpen?.()
}

/** 安全读取 localStorage：隐私模式或被禁用时返回 null，不让整个应用崩掉 */
function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** 从 localStorage 载入（应用启动时调一次） */
export function loadIdentity() {
  const raw = safeGet(STORAGE_KEY)
  if (!raw) return identity.value
  try {
    const parsed = JSON.parse(raw)
    identity.value = {
      nick: typeof parsed?.nick === 'string' ? parsed.nick.slice(0, 24) : '',
      avatar: AVATAR_ID_RE.test(parsed?.avatar || '') ? parsed.avatar : ''
    }
  } catch {
    // 旧格式或损坏数据：当作未设置，不阻塞
    identity.value = { nick: '', avatar: '' }
  }
  return identity.value
}

/** 保存（账号弹窗确认时调用） */
export function saveIdentity({ nick, avatar }) {
  const next = {
    nick: String(nick || '').trim().slice(0, 24),
    avatar: AVATAR_ID_RE.test(String(avatar || '')) ? String(avatar) : ''
  }
  identity.value = next
  safeSet(STORAGE_KEY, JSON.stringify(next))
  return next
}

export const hasNickname = computed(() => identity.value.nick.trim().length > 0)

/**
 * 载入头像清单（`data/parsed/avatarCatalog.json`，
 * 由 `scripts/dev/sync-avatar-catalog.mjs` 生成）。
 * 只在第一次打开账号弹窗时请求。
 *
 * 路径必须在 `data/parsed/` 下：`verify.mjs` 的护栏限定浏览器运行时只能读
 * `data/parsed/`、`data/dialogs/`、`data/taskDialogs/` 与 `data/notice.json`。
 */
export async function loadAvatarCatalog() {
  if (avatarCatalogState.value === 'ready' || avatarCatalogState.value === 'loading') return
  avatarCatalogState.value = 'loading'
  try {
    const res = await fetch('data/parsed/avatarCatalog.json')
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    avatarGroups.value = Array.isArray(data?.groups) ? data.groups : []
    avatarCatalogState.value = 'ready'
  } catch {
    // 清单缺失时选择器显示空态，不影响"只改昵称"这条主路径
    avatarCatalogState.value = 'error'
  }
}

/** 头像 ID → 图片路径（清单未加载或 ID 未知时返回空串） */
export function avatarPath(id) {
  return avatarEntry(id)?.path || ''
}

/** 头像 ID → 清单条目 `{id, path, name}`（含角色/魔物名，供选择器显示与提示） */
export function avatarEntry(id) {
  if (!id) return null
  for (const group of avatarGroups.value) {
    const hit = (group.items || []).find((it) => it.id === id)
    if (hit) return hit
  }
  return null
}
