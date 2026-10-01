/**
 * 评论 API（Cloudflare Pages Functions）
 *
 * 路由：
 *   GET    /api/health           探活（同时用于线上缓存头断言）
 *   GET    /api/comments         列表（分页）
 *   POST   /api/comments         发表
 *   DELETE /api/comments         自己删除（凭浏览器令牌）
 *   GET    /api/admin/comments   管理端列表（需管理员令牌）
 *   PATCH  /api/admin/comments   管理端改状态：0 待审 / 1 显示 / 2 隐藏
 *   DELETE /api/admin/comments   管理端彻底删除
 *
 * 设计依据：docs/technical/COMMENTS_BACKEND.md
 *
 * 三条必须遵守的约束（免费版）：
 *   1. CPU 10ms/次——只用 WebCrypto 做 SHA-256。**禁止 bcrypt/argon2**，
 *      实测 PBKDF2 600k 次要 104ms，必然触发 Error 1102。
 *      管理员与评论者都用「随机令牌 + 恒定时间比较」，不做密码哈希，正好绕开。
 *   2. D1 写入按「行」计费（索引也算行），一次发评论约 6 行，上限约 1.5 万条/天。
 *   3. 响应必须是 application/json + no-store；本站 EdgeOne 按文件类型缓存，
 *      JSON 当前不被缓存（2026-10-01 实测），no-store 是第二道防线。
 *
 * 环境变量（Cloudflare Pages 项目配置，不入仓库）：
 *   DB                D1 绑定（wrangler.toml）
 *   ADMIN_TOKEN       可选。管理端令牌；未配置则管理接口一律 404
 *   TURNSTILE_SECRET  可选。未配置则跳过人机校验
 *   IP_HASH_SALT      可选但强烈建议。IP/邮箱哈希加盐
 */

import { matchReview } from '../../src/config/commentBlocklist.js'

const MAX_BODY = 1000
const MAX_NICK = 24
const MAX_LIMIT = 50
const RATE_PER_HOUR = 5
const RATE_PER_DAY = 20

/**
 * page_key 白名单：必须是 `前缀:业务ID`，避免评论被挂到任意路径
 */
const PAGE_KEY_RE = /^(item|furniture|hero|pet|monster|task|event|battle|stage|glossary):[A-Za-z0-9_\-.]{1,64}$/

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

function bad(message, status = 400) {
  return json({ ok: false, error: message }, status)
}

/** 全部使用 WebCrypto（原生、毫秒级）。不可用 bcrypt —— 免费版 CPU 只有 10ms */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 恒定时间比较：避免用 === 比较令牌时泄漏前缀匹配长度 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

/** UTC 小时桶（与 D1 免费额度重置口径一致） */
function hourBucket(unixSec) {
  return new Date(unixSec * 1000).toISOString().slice(0, 13).replace(/[-T]/g, '')
}

function dayBucket(unixSec) {
  return new Date(unixSec * 1000).toISOString().slice(0, 10).replace(/-/g, '')
}

/** 剥离控制字符、收敛换行、限长。不存 HTML —— 展示端一律当纯文本渲染 */
function sanitize(text, maxLen) {
  return String(text ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen)
}

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    ''
  )
}

/** UPSERT 计数并返回自增后的值（1 行读 + 1~2 行写） */
async function bump(env, bucket) {
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, counter) VALUES (?, 1)
     ON CONFLICT(bucket) DO UPDATE SET counter = counter + 1
     RETURNING counter`
  )
    .bind(bucket)
    .first()
  return row?.counter ?? 1
}

/** 小时桶做闸门，日桶兜底。返回 null 表示放行 */
async function checkRateLimit(env, ipHash, ts) {
  const hourCount = await bump(env, `h:${ipHash}:${hourBucket(ts)}`)
  if (hourCount > RATE_PER_HOUR) return { message: '发言太频繁，请稍后再试', status: 429 }

  const dayCount = await bump(env, `d:${ipHash}:${dayBucket(ts)}`)
  if (dayCount > RATE_PER_DAY) return { message: '今日发言次数已达上限', status: 429 }

  return null
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true // 未配置则跳过，便于先上线
  if (!token) return false
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    })
    const data = await res.json()
    return data.success === true
  } catch {
    return false // 验证服务不可达时按失败处理，不放行可疑请求
  }
}

/** 管理员令牌校验：只比对哈希，恒定时间比较 */
async function isAdmin(env, request) {
  if (!env.ADMIN_TOKEN) return false
  const token = request.headers.get('x-admin-token') || ''
  if (!token) return false
  const [provided, expected] = await Promise.all([
    sha256Hex(token),
    sha256Hex(String(env.ADMIN_TOKEN).trim())
  ])
  return safeEqual(provided, expected)
}

function toPublic(row) {
  return {
    id: row.id,
    nick: row.nick,
    body: row.body,
    createdAt: row.created_at,
    emailHash: row.email_hash || null,
    status: row.status,
    pageKey: row.page_key,
    // 命中审核词表的原因（供管理页面判断是误伤还是真垃圾）；干净评论为 null
    reviewReason: row.review_reason || null
  }
}

/** GET /api/comments?page=item:30047&cursor=<id>&limit=20 —— 只返回 status=1 */
async function listComments(env, url) {
  const pageKey = url.searchParams.get('page') || ''
  if (!PAGE_KEY_RE.test(pageKey)) return bad('page 参数不合法')

  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '20', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), MAX_LIMIT)
  const cursor = Number.parseInt(url.searchParams.get('cursor') || '', 10)
  const hasCursor = Number.isFinite(cursor)

  // 多取 1 条判断 hasMore，避免 COUNT(*)（全表扫描，D1 按行计费）
  const sql = hasCursor
    ? `SELECT id, nick, email_hash, body, created_at, status, page_key FROM comments
       WHERE page_key = ?1 AND status = 1 AND id < ?2 ORDER BY id DESC LIMIT ?3`
    : `SELECT id, nick, email_hash, body, created_at, status, page_key FROM comments
       WHERE page_key = ?1 AND status = 1 ORDER BY id DESC LIMIT ?2`

  const stmt = hasCursor
    ? env.DB.prepare(sql).bind(pageKey, cursor, limit + 1)
    : env.DB.prepare(sql).bind(pageKey, limit + 1)

  const { results } = await stmt.all()
  const rows = results || []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  return json({
    ok: true,
    comments: page.map(toPublic),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore
  })
}

/** POST /api/comments —— 发评论，返回一次性自删令牌 */
async function createComment(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad('请求体不是合法 JSON')
  }

  // 1) 蜜罐：正常用户看不到该字段，填了就是机器人。零成本
  if (sanitize(payload?.hp, 8)) return bad('请求被拒绝', 403)

  const pageKey = String(payload?.page || '')
  if (!PAGE_KEY_RE.test(pageKey)) return bad('page 参数不合法')

  const nick = sanitize(payload?.nick, MAX_NICK)
  const body = sanitize(payload?.body, MAX_BODY)
  if (!nick) return bad('请填写昵称')
  if (!body) return bad('评论内容不能为空')

  const ip = clientIp(request)
  const salt = env.IP_HASH_SALT || 'myrzg-default-salt'
  const ipHash = await sha256Hex(`${ip}|${salt}`)
  const ts = nowSec()

  // 2) 限流（放在人机校验前：先挡高频，省一次外部 fetch）
  const limited = await checkRateLimit(env, ipHash, ts)
  if (limited) return bad(limited.message, limited.status)

  // 3) 人机校验
  if (!(await verifyTurnstile(env, payload?.token, ip))) {
    return bad('人机校验未通过，请刷新页面重试', 403)
  }

  // 4) 审核词表命中 → 待审（不拒绝，避免误伤丢内容；管理员可一键放行）
  const reviewHits = matchReview(body)
  const needsReview = reviewHits.length > 0
  const status = needsReview ? 0 : 1

  // 5) 自删令牌：只把哈希入库，明文只在此次响应里给浏览器一次
  const deleteToken = randomToken()
  const tokenHash = await sha256Hex(deleteToken)

  const rawEmail = sanitize(payload?.email, 254).toLowerCase()
  const emailHash = rawEmail ? await sha256Hex(rawEmail) : null
  const uaHash = await sha256Hex(String(request.headers.get('user-agent') || '').slice(0, 200))

  const inserted = await env.DB.prepare(
    `INSERT INTO comments (page_key, nick, email_hash, body, status, created_at, ip_hash, ua_hash, token_hash, review_reason)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     RETURNING id, created_at`
  )
    .bind(
      pageKey,
      nick,
      emailHash,
      body,
      status,
      ts,
      ipHash,
      uaHash,
      tokenHash,
      needsReview ? reviewHits.join(',') : null
    )
    .first()

  return json(
    {
      ok: true,
      comment: { id: inserted.id, nick, body, createdAt: inserted.created_at, status },
      // 前端存 localStorage，用于"删除我的评论"。明文只出现这一次
      deleteToken,
      pending: status === 0,
      notice: status === 0 ? '评论已提交，将尽快审核后显示' : ''
    },
    201
  )
}

/** DELETE /api/comments —— 凭浏览器令牌删自己的评论 */
async function deleteOwnComment(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad('请求体不是合法 JSON')
  }

  const id = Number.parseInt(payload?.id, 10)
  const token = String(payload?.token || '')
  if (!Number.isFinite(id) || !token) return bad('参数不合法')

  const row = await env.DB.prepare(`SELECT id, token_hash, status FROM comments WHERE id = ?1`)
    .bind(id)
    .first()
  if (!row) return bad('评论不存在', 404)
  if (row.status === 2) return json({ ok: true, alreadyGone: true })
  if (!row.token_hash) return bad('该评论未持有删除令牌', 403)

  const provided = await sha256Hex(token)
  if (!safeEqual(provided, row.token_hash)) return bad('没有权限删除这条评论', 403)

  // 软删除：保留记录供追溯，但前端不再显示
  await env.DB.prepare(`UPDATE comments SET status = 2, token_hash = NULL WHERE id = ?1`)
    .bind(id)
    .run()
  return json({ ok: true })
}

/** GET /api/admin/comments?status=&cursor=&limit= —— 管理端列表 */
async function adminList(env, url) {
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), MAX_LIMIT)
  const cursor = Number.parseInt(url.searchParams.get('cursor') || '', 10)
  const hasCursor = Number.isFinite(cursor)

  const statusParam = url.searchParams.get('status')
  const hasStatus = statusParam === '0' || statusParam === '1' || statusParam === '2'
  const status = hasStatus ? Number.parseInt(statusParam, 10) : null

  const where = []
  if (hasStatus) where.push('status = ?1')
  if (hasCursor) where.push(`id < ?${hasStatus ? 2 : 1}`)
  const limitIdx = 1 + (hasStatus ? 1 : 0) + (hasCursor ? 1 : 0)

  const sql = `SELECT id, page_key, nick, email_hash, body, created_at, status, review_reason FROM comments
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY id DESC LIMIT ?${limitIdx}`

  const binds = []
  if (hasStatus) binds.push(status)
  if (hasCursor) binds.push(cursor)
  binds.push(limit + 1)

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all()
  const rows = results || []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  // 待审总数：只在第一页算，且用索引扫描；管理端低频，成本可接受
  let pendingCount = 0
  if (!hasCursor) {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM comments WHERE status = 0`).first()
    pendingCount = c?.n ?? 0
  }

  return json({
    ok: true,
    comments: page.map(toPublic),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore,
    pendingCount
  })
}

/** PATCH /api/admin/comments —— 改状态（放行 / 隐藏 / 打回待审） */
async function adminPatch(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad('请求体不是合法 JSON')
  }
  const id = Number.parseInt(payload?.id, 10)
  const status = Number.parseInt(payload?.status, 10)
  if (!Number.isFinite(id) || ![0, 1, 2].includes(status)) return bad('参数不合法')

  const res = await env.DB.prepare(`UPDATE comments SET status = ?1 WHERE id = ?2`)
    .bind(status, id)
    .run()
  if (!res.meta?.changes) return bad('评论不存在', 404)
  return json({ ok: true })
}

/** DELETE /api/admin/comments —— 彻底删除（隐私删除请求用；软删除请用 PATCH status=2） */
async function adminDelete(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad('请求体不是合法 JSON')
  }
  const id = Number.parseInt(payload?.id, 10)
  if (!Number.isFinite(id)) return bad('参数不合法')

  const res = await env.DB.prepare(`DELETE FROM comments WHERE id = ?1`).bind(id).run()
  if (!res.meta?.changes) return bad('评论不存在', 404)
  return json({ ok: true })
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type, x-admin-token',
        'access-control-max-age': '86400'
      }
    })
  }

  if (!env.DB) return bad('服务端未配置 D1 绑定（env.DB 缺失）', 500)

  // 管理端未配置令牌时，连路由都不暴露
  const isAdminPath = path === '/api/admin/comments'
  if (isAdminPath && !env.ADMIN_TOKEN) return bad('接口不存在', 404)

  try {
    if (path === '/api/health') {
      return json({ ok: true, ts: nowSec() })
    }

    if (path === '/api/comments') {
      if (request.method === 'GET') return await listComments(env, url)
      if (request.method === 'POST') return await createComment(env, request)
      if (request.method === 'DELETE') return await deleteOwnComment(env, request)
      return bad('不支持的请求方法', 405)
    }

    if (isAdminPath) {
      if (!(await isAdmin(env, request))) return bad('管理员令牌无效', 401)
      if (request.method === 'GET') return await adminList(env, url)
      if (request.method === 'PATCH') return await adminPatch(env, request)
      if (request.method === 'DELETE') return await adminDelete(env, request)
      return bad('不支持的请求方法', 405)
    }

    return bad('接口不存在', 404)
  } catch (err) {
    // 不把内部错误细节回给客户端
    console.error('comments api error:', err)
    return bad('服务暂时不可用，请稍后再试', 500)
  }
}
