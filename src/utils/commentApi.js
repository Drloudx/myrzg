/**
 * 评论 API 客户端
 *
 * 为什么不用 `fetchWithFallback`：那是给**静态资源**用的（带 manifest SHA-256 校验与
 * 包内同版本回退），评论是动态写接口，没有也不该有内容哈希。
 *
 * 地址解析：
 *   - Web：同域相对路径 `/api/...`（走 EdgeOne → Cloudflare Pages Functions）
 *   - Android：必须用绝对地址。因为打包进 APK 后页面是 `https://localhost`，
 *     相对路径会打到 WebView 本地壳上，请求不到服务端。
 *     原生端优先云端（`CLOUD_URL`）；断网时明确报错，而不是静默失败。
 *
 * 相关设计：docs/technical/COMMENTS_BACKEND.md
 */
import { CLOUD_URL, isNative } from './env.js'

const TIMEOUT_MS = 15000

/**
 * 面向用户的兜底文案。**这里只放中文短句，不出现状态码、字段名或任何技术名词**（用户明确要求）。
 * 正常情况下服务端会返回自己的中文文案（见 `functions/api/[[path]].js` 的 `ERR` 契约），
 * 这几个只用于"请求根本没到服务端"的情形。
 */
const CONNECT_ERROR = '无法连接评论服务器'
const NETWORK_ERROR = '网络连接异常'
const TIMEOUT_ERROR = '网络连接超时，请稍后再试'
const GENERIC_ERROR = '操作失败，请稍后再试'

/** 自删令牌的本地存储键：`myrzg:comment-token:<id>` */
const TOKEN_PREFIX = 'myrzg:comment-token:'

function apiBase() {
  if (isNative) {
    // 原生端：断网时访问云端无意义，直接给出可读错误
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new CommentApiError(NETWORK_ERROR, 0)
    }
    return CLOUD_URL
  }
  return ''
}

export class CommentApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'CommentApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body, adminToken } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8'
  if (adminToken) headers['x-admin-token'] = adminToken

  let response
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
  } catch (err) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') throw new CommentApiError(TIMEOUT_ERROR, 0)
    throw new CommentApiError(CONNECT_ERROR, 0)
  } finally {
    clearTimeout(timer)
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    // 响应不是 JSON。两种常见情形：
    //   1. 本地只跑了 `npm run dev` 没开 `npm run dev:api`，代理拿不到 API（502/504）；
    //   2. 线上 Functions 没生效，/api/* 被 SPA 兜底重写成了 index.html。
    // 对外只给用户能看懂的一句话，技术原因写控制台。
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      console.warn('[comments] API 不可达（本地请确认已运行 npm run dev:api）')
    } else {
      console.warn('[comments] 响应不是 JSON，可能被 SPA 兜底或边缘缓存改写')
    }
    throw new CommentApiError(CONNECT_ERROR, response.status)
  }

  if (!response.ok) {
    // 服务端已按"对外文案契约"返回可直接展示的中文；客户端不再拼技术细节。
    throw new CommentApiError(data?.error || GENERIC_ERROR, response.status)
  }
  return data
}

/** 读取某页面（如 `item:30047`）的评论 */
export function fetchComments(pageKey, { cursor, limit = 20 } = {}) {
  const params = new URLSearchParams({ page: pageKey, limit: String(limit) })
  if (cursor) params.set('cursor', String(cursor))
  return request(`/api/comments?${params.toString()}`)
}

/**
 * 发表评论。返回体含 `deleteToken`，调用方需 `saveDeleteToken` 保存。
 *
 * 昵称与头像来自本机身份（`utils/identity.js`），不在这里要求用户重填。
 * 注意：`avatar` 是**头像 ID**（如 `avatar_pet_006`），服务端只做格式校验，
 * 路径由客户端查 `avatarCatalog.json` 得到。
 */
export function postComment({ pageKey, nick, avatar, body, token, hp }) {
  return request('/api/comments', {
    method: 'POST',
    body: { page: pageKey, nick, avatar, body, token, hp }
  })
}

/** 凭令牌删除自己的评论 */
export function deleteOwnComment(id, token) {
  return request('/api/comments', { method: 'DELETE', body: { id, token } })
}

// ── 自删令牌的本地存储 ──────────────────────────────────────────────
// 令牌只发给发表者本人（明文仅一次），存 localStorage 是为了让用户
// 无需记任何东西就能删自己的评论。换设备/清浏览器数据后删不了，需联系管理员。

export function saveDeleteToken(id, token) {
  try {
    localStorage.setItem(`${TOKEN_PREFIX}${id}`, token)
  } catch {
    /* 隐私模式下 localStorage 可能不可用；删除功能降级为不可用，不影响发表 */
  }
}

export function getDeleteToken(id) {
  try {
    return localStorage.getItem(`${TOKEN_PREFIX}${id}`)
  } catch {
    return null
  }
}

export function removeDeleteToken(id) {
  try {
    localStorage.removeItem(`${TOKEN_PREFIX}${id}`)
  } catch {
    /* 同上 */
  }
}

// ── 管理端 ────────────────────────────────────────────────────────

/**
 * 管理端列表。
 * @param {string} adminToken 管理凭据
 * @param {{status?: string|number, q?: string, cursor?: number, limit?: number}} options
 *   `q` 是关键词，服务端在正文/昵称/页面标识里匹配（不在前端过滤，评论会持续增长）
 */
export function fetchAdminComments(adminToken, { status, q, cursor, limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (status !== undefined && status !== null && status !== '') params.set('status', String(status))
  if (q) params.set('q', String(q))
  if (cursor) params.set('cursor', String(cursor))
  return request(`/api/admin/comments?${params.toString()}`, { adminToken })
}

/** 改状态：0 待审 / 1 显示（放行）/ 2 隐藏 */
export function setCommentStatus(adminToken, id, status) {
  return request('/api/admin/comments', { method: 'PATCH', body: { id, status }, adminToken })
}

/** 彻底删除（隐私删除请求用；只想下架请用 setCommentStatus(id, 2)） */
export function deleteCommentPermanently(adminToken, id) {
  return request('/api/admin/comments', { method: 'DELETE', body: { id }, adminToken })
}
