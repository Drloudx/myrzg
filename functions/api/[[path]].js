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

/**
 * 限流阈值的默认值。可用**环境变量**覆盖（`RATE_LIMIT_PER_HOUR` / `RATE_LIMIT_PER_DAY`），
 * **生产环境不要设置**，用默认值即可。
 *
 * 为什么做成可注入：端到端测试套件的 POST 数量（约 13 个）必然超过 5 条/小时，
 * 后半段会被 429 挡成假失败。本地用 `.dev.vars` 放大阈值就能稳定重复运行，
 * 不必在生产代码里塞"测试专用旁路"。非法值一律回落到默认值。
 */
const RATE_DEFAULTS = { perHour: 5, perDay: 20 }

function positiveInt(value, fallback) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * page_key 白名单：必须是 `前缀:业务ID`，避免评论被挂到任意路径
 */
const PAGE_KEY_RE = /^(item|furniture|hero|pet|monster|task|event|battle|stage|glossary):[A-Za-z0-9_\-.]{1,64}$/

/**
 * 头像 ID 白名单：只允许 `at001_0`、`avatar_pet_006` 这类标识符。
 *
 * 这里**只校验格式、不校验是否在清单里**——头像 ID 与图片路径刻意解耦：
 * 客户端用 `public/data/avatarCatalog.json` 把 ID 换成路径。
 * 好处是素材目录将来改名/迁移时，库里的历史评论仍存 ID、不会变成失效路径；
 * 代价是客户端能存一个清单里没有的 ID，效果只是回退成昵称首字占位（无害）。
 * 不硬编码清单的原因：Worker 读不到 `public/` 下的文件，硬编码会与素材脱节。
 */
const AVATAR_ID_RE = /^[A-Za-z0-9_]{1,40}$/

/**
 * 自删令牌的形状：`randomToken()` 生成的 32 字节十六进制。
 * 用于 `/api/my-comments` 的入参预筛——不校验形状的话，
 * 攻击者可以用超长/异常字符串批量试探（虽然最终仍要过哈希比对）。
 */
const DELETE_TOKEN_RE = /^[a-f0-9]{64}$/

/**
 * 对外错误文案契约。**这里是给普通用户看的字，不是给开发者看的日志。**
 *
 * 规则（用户明确要求）：只在下面这张表里选，不要临时造新句子；
 * 不出现技术名词、状态码、字段名、英文——例如「JSON」「page_key」「D1」「token」
 * 这类字眼一律不出现在 `error` 里。技术细节写进 `console.error` 的服务端日志。
 *
 * | 对外文案 | 何时用 | 内部含义 |
 * | --- | --- | --- |
 * | 评论不存在 | 目标评论已被删除或从未存在 | 404 |
 * | 无法连接评论服务器 | 服务端自身故障 | 500 |
 * | 请求太频繁，请稍后再试 | 触发限流 | 429 |
 * | 评论内容不能为空 | 正文为空 | 400 |
 * | 请填写昵称 | 昵称为空 | 400 |
 * | 评论内容有误，请检查后重试 | 请求体非法 / 标识格式不对 | 400 |
 * | 提交失败，请刷新页面后重试 | 人机校验、蜜罐拦截、无删除权限 | 403 |
 * | 操作失败，请稍后再试 | 没有更贴切的归类时兜底 | 4xx/5xx |
 */
const ERR = {
  notFound: '评论不存在',
  server: '无法连接评论服务器',
  rateLimited: '请求太频繁，请稍后再试',
  rateLimitedDay: '今天发言次数已达上限',
  emptyBody: '评论内容不能为空',
  needNick: '请填写昵称',
  badRequest: '评论内容有误，请检查后重试',
  rejected: '提交失败，请刷新页面后重试',
  fallback: '操作失败，请稍后再试'
}

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
  const perHour = positiveInt(env.RATE_LIMIT_PER_HOUR, RATE_DEFAULTS.perHour)
  const perDay = positiveInt(env.RATE_LIMIT_PER_DAY, RATE_DEFAULTS.perDay)

  const hourCount = await bump(env, `h:${ipHash}:${hourBucket(ts)}`)
  if (hourCount > perHour) return { message: ERR.rateLimited, status: 429 }

  const dayCount = await bump(env, `d:${ipHash}:${dayBucket(ts)}`)
  if (dayCount > perDay) return { message: ERR.rateLimitedDay, status: 429 }

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

/**
 * 管理员令牌校验：只比对哈希，恒定时间比较。
 *
 * 本地与线上走**同一条路径**（不存在"本地免验证"的旁路）：
 * 本地用 `.dev.vars` 里的 `ADMIN_TOKEN`（短令牌便于开发），
 * 线上用 Cloudflare Pages 环境变量里的长随机串。
 * 这样本地验证到的行为就是线上行为，不会出现"本地能进、线上进不去"的错觉。
 */
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
    // 头像 ID（不是路径）。客户端用 avatarCatalog.json 换成图片；空值走昵称首字占位
    avatar: row.avatar || null,
    body: row.body,
    createdAt: row.created_at,
    status: row.status,
    pageKey: row.page_key,
    // 评论所在页面的人话名字（如「银币」）。由发表方连同评论一起存下来，
    // 这样管理端/账号弹窗不必为每条评论反查物品表，也不会因为缺产物而显示不出名字。
    pageLabel: row.page_label || null,
    // 命中审核词表的原因（供管理页面判断是误伤还是真垃圾）；干净评论为 null
    reviewReason: row.review_reason || null
  }
}

/** GET /api/comments?page=item:30047&cursor=<id>&limit=20 —— 只返回 status=1 */
async function listComments(env, url) {
  const pageKey = url.searchParams.get('page') || ''
  if (!PAGE_KEY_RE.test(pageKey)) return bad(ERR.badRequest)

  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '20', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), MAX_LIMIT)
  const cursor = Number.parseInt(url.searchParams.get('cursor') || '', 10)
  const hasCursor = Number.isFinite(cursor)

  // 多取 1 条判断 hasMore，避免 COUNT(*)（全表扫描，D1 按行计费）
  const sql = hasCursor
    ? `SELECT id, nick, avatar, body, created_at, status, page_key, page_label FROM comments
       WHERE page_key = ?1 AND status = 1 AND id < ?2 ORDER BY id DESC LIMIT ?3`
    : `SELECT id, nick, avatar, body, created_at, status, page_key, page_label FROM comments
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
    return bad(ERR.badRequest)
  }

  // 1) 蜜罐：正常用户看不到该字段，填了就是机器人。零成本
  if (sanitize(payload?.hp, 8)) return bad(ERR.rejected, 403)

  const pageKey = String(payload?.page || '')
  if (!PAGE_KEY_RE.test(pageKey)) return bad(ERR.badRequest)

  const nick = sanitize(payload?.nick, MAX_NICK)
  const body = sanitize(payload?.body, MAX_BODY)
  if (!nick) return bad(ERR.needNick)
  if (!body) return bad(ERR.emptyBody)

  // 头像 ID：格式不合法就当没设置（回退昵称首字），不因此拒绝整条评论
  const rawAvatar = String(payload?.avatar || '')
  const avatar = AVATAR_ID_RE.test(rawAvatar) ? rawAvatar : null

  // 评论所在页面的人话名字（如「银币」）。由前端用它手上已有的业务数据传上来——
  // 服务端读不到物品表，事后反查还得依赖产物存在。只做长度与去控制字符处理。
  const pageLabel = sanitize(payload?.pageLabel, 40)

  const ip = clientIp(request)
  const salt = env.IP_HASH_SALT || 'myrzg-default-salt'
  const ipHash = await sha256Hex(`${ip}|${salt}`)
  const ts = nowSec()

  // 2) 限流（放在人机校验前：先挡高频，省一次外部 fetch）
  const limited = await checkRateLimit(env, ipHash, ts)
  if (limited) return bad(limited.message, limited.status)

  // 3) 人机校验
  if (!(await verifyTurnstile(env, payload?.token, ip))) {
    return bad(ERR.rejected, 403)
  }

  // 4) 审核词表命中 → 待审（不拒绝，避免误伤丢内容；管理员可一键放行）
  const reviewHits = matchReview(body)
  const needsReview = reviewHits.length > 0
  const status = needsReview ? 0 : 1

  // 5) 自删令牌：只把哈希入库，明文只在此次响应里给浏览器一次
  const deleteToken = randomToken()
  const tokenHash = await sha256Hex(deleteToken)

  const uaHash = await sha256Hex(String(request.headers.get('user-agent') || '').slice(0, 200))

  const inserted = await env.DB.prepare(
    `INSERT INTO comments (page_key, nick, avatar, body, status, created_at, ip_hash, ua_hash, token_hash, review_reason, page_label)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     RETURNING id, created_at`
  )
    .bind(
      pageKey,
      nick,
      avatar,
      body,
      status,
      ts,
      ipHash,
      uaHash,
      tokenHash,
      needsReview ? reviewHits.join(',') : null,
      pageLabel || null
    )
    .first()

  return json(
    {
      ok: true,
      comment: { id: inserted.id, nick, avatar, body, createdAt: inserted.created_at, status },
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
    return bad(ERR.badRequest)
  }

  const id = Number.parseInt(payload?.id, 10)
  const token = String(payload?.token || '')
  if (!Number.isFinite(id) || !token) return bad(ERR.badRequest)

  const row = await env.DB.prepare(`SELECT id, token_hash, status FROM comments WHERE id = ?1`)
    .bind(id)
    .first()

  // 已经不在库里就算成功——**幂等**。否则重复点击、多个标签页、或列表是旧快照时
  // 会报"评论不存在"，用户看到"明明还在却说不存在"，比直接消失更困惑。
  if (!row) return json({ ok: true, alreadyGone: true })

  // status=0（待审）也允许作者删除：那是"别人看不到但作者自己发的"，
  // 前端待审时不入列表，但令牌已发，用户可能通过其它入口进来删。
  if (!row.token_hash) return bad(ERR.rejected, 403)

  const provided = await sha256Hex(token)
  if (!safeEqual(provided, row.token_hash)) return bad(ERR.rejected, 403)

  /*
   * **真删除，不是软删除**（用户明确要求："删评论都要彻底删了，别留记录"）。
   *
   * 原先写的是 `UPDATE ... SET status = 2`（软删除）。后果是库里持续堆积
   * status=2 的用户记录——用户本机令牌也一直累积（实测攒到 37 条），
   * 而管理页默认只看待审，所以他"在管理页也看不到、却一直有记录"。
   *
   * 代价说明：软删除能保留证据供追溯、也便于误删恢复。改成硬删除后这两点没有了，
   * 但"用户要求删除"在隐私意义上本就该是真删除。管理端的「隐藏」（status=2）
   * 仍是软删除，用于审核下架，两者职责不同。
   */
  await env.DB.prepare(`DELETE FROM comments WHERE id = ?1`).bind(id).run()
  return json({ ok: true })
}

/**
 * GET /api/admin/comments?status=&q=&cursor=&limit= —— 管理端列表
 *
 * `q` 为关键词搜索，匹配**正文 / 昵称 / 页面标识**（大小写不敏感）。
 * 在服务端搜而不是前端过滤：评论会持续增长，管理端不该把全部数据拉到浏览器再筛。
 * 用 LIKE 而非 FTS：D1 免费版读便宜（500 万行/天），而 FTS 要额外索引（写入按行计费），
 * 管理端查询低频，没必要为它增加写入成本。
 */
async function adminList(env, url) {
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), MAX_LIMIT)
  const cursor = Number.parseInt(url.searchParams.get('cursor') || '', 10)
  const hasCursor = Number.isFinite(cursor)

  const statusParam = url.searchParams.get('status')
  const hasStatus = statusParam === '0' || statusParam === '1' || statusParam === '2'
  const status = hasStatus ? Number.parseInt(statusParam, 10) : null

  // 关键词：`%`/`_`/`\` 用 ESCAPE 子句按**字面量**匹配。
  // 不能简单删掉这些字符：删了会变成空条件 → 静默返回全部评论，
  // 用户搜 `%` 却看到"全部"是最容易误判的行为。转义后搜的是字面量本身。
  const q = sanitize(url.searchParams.get('q') || '', 60)
  const hasQ = q.length > 0
  const likeParam = hasQ ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : ''

  const where = []
  const binds = []
  if (hasStatus) {
    binds.push(status)
    where.push(`status = ?${binds.length}`)
  }
  if (hasQ) {
    binds.push(likeParam)
    const i = binds.length
    where.push(`(body LIKE ?${i} ESCAPE '\\' OR nick LIKE ?${i} ESCAPE '\\' OR page_key LIKE ?${i} ESCAPE '\\')`)
  }
  if (hasCursor) {
    binds.push(cursor)
    where.push(`id < ?${binds.length}`)
  }
  binds.push(limit + 1)

  const sql = `SELECT id, page_key, page_label, nick, avatar, body, created_at, status, review_reason FROM comments
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY id DESC LIMIT ?${binds.length}`

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all()
  const rows = results || []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  // 待审总数：只在第一页算；管理端低频，COUNT(*) 的成本可接受
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

/**
 * GET /api/my-comments?ids=12,15,20 —— 「我在这台设备上发过的评论」
 *
 * 用途：账号弹窗里回看自己的评论与状态。
 *
 * 安全模型：**必须逐条提供该评论的删除令牌**，只返回令牌匹配的那些。
 * 因此这不是"按 id 列举评论"的公开接口——不知道令牌就什么都拿不到，
 * 也不会泄漏"某个 id 是否存在"（不匹配的条目直接不出现在结果里）。
 *
 * 为什么用 POST 而不是 GET：令牌要放在请求体里。
 * 放 URL 会被浏览器历史、Referer、代理日志记录下来。
 */
async function listMyComments(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad(ERR.badRequest)
  }

  // items: [{ id: 12, token: '...' }, ...]，最多 50 条（与列表页上限一致）
  const items = Array.isArray(payload?.items) ? payload.items.slice(0, 50) : []
  if (!items.length) return json({ ok: true, comments: [] })

  const wanted = []
  for (const it of items) {
    const id = Number.parseInt(it?.id, 10)
    const token = String(it?.token || '')
    if (Number.isFinite(id) && DELETE_TOKEN_RE.test(token)) wanted.push({ id, token })
  }
  if (!wanted.length) return json({ ok: true, comments: [] })

  const placeholders = wanted.map((_, i) => `?${i + 1}`).join(', ')
  const { results } = await env.DB.prepare(
    `SELECT id, page_key, page_label, nick, avatar, body, created_at, status, token_hash
     FROM comments WHERE id IN (${placeholders})`
  )
    .bind(...wanted.map((w) => w.id))
    .all()

  // 令牌校验：只回传令牌对得上的那些；hash 比对用恒定时间比较
  const tokenById = new Map(wanted.map((w) => [w.id, w.token]))
  const verified = []
  for (const row of results || []) {
    const token = tokenById.get(row.id)
    if (!token || !row.token_hash) continue
    const provided = await sha256Hex(token)
    if (!safeEqual(provided, row.token_hash)) continue
    verified.push({
      id: row.id,
      nick: row.nick,
      avatar: row.avatar || null,
      body: row.body,
      createdAt: row.created_at,
      status: row.status,
      pageKey: row.page_key,
      pageLabel: row.page_label || null
    })
  }
  verified.sort((a, b) => b.id - a.id)
  return json({ ok: true, comments: verified })
}

/** PATCH /api/admin/comments —— 改状态（放行 / 隐藏 / 打回待审） */
async function adminPatch(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad(ERR.badRequest)
  }
  const id = Number.parseInt(payload?.id, 10)
  const status = Number.parseInt(payload?.status, 10)
  if (!Number.isFinite(id) || ![0, 1, 2].includes(status)) return bad(ERR.badRequest)

  const res = await env.DB.prepare(`UPDATE comments SET status = ?1 WHERE id = ?2`)
    .bind(status, id)
    .run()
  if (!res.meta?.changes) return bad(ERR.notFound, 404)
  return json({ ok: true })
}

/** DELETE /api/admin/comments —— 彻底删除（隐私删除请求用；软删除请用 PATCH status=2） */
async function adminDelete(env, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return bad(ERR.badRequest)
  }
  const id = Number.parseInt(payload?.id, 10)
  if (!Number.isFinite(id)) return bad(ERR.badRequest)

  const res = await env.DB.prepare(`DELETE FROM comments WHERE id = ?1`).bind(id).run()
  if (!res.meta?.changes) return bad(ERR.notFound, 404)
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

  if (!env.DB) return bad(ERR.server, 500)

  // 管理端未配置令牌时，连路由都不暴露（对外表现为"接口不存在"）
  const isAdminPath = path === '/api/admin/comments'
  if (isAdminPath && !env.ADMIN_TOKEN) return bad(ERR.fallback, 404)

  try {
    if (path === '/api/health') {
      return json({ ok: true, ts: nowSec() })
    }

    if (path === '/api/comments') {
      if (request.method === 'GET') return await listComments(env, url)
      if (request.method === 'POST') return await createComment(env, request)
      if (request.method === 'DELETE') return await deleteOwnComment(env, request)
      return bad(ERR.fallback, 405)
    }

    // 「我发过的评论」：令牌放请求体（不放 URL，避免被历史/Referer/代理日志记录）
    if (path === '/api/my-comments') {
      if (request.method !== 'POST') return bad(ERR.fallback, 405)
      return await listMyComments(env, request)
    }

    if (isAdminPath) {
      if (!(await isAdmin(env, request))) return bad(ERR.rejected, 401)
      if (request.method === 'GET') return await adminList(env, url)
      if (request.method === 'PATCH') return await adminPatch(env, request)
      if (request.method === 'DELETE') return await adminDelete(env, request)
      return bad(ERR.fallback, 405)
    }

    return bad(ERR.fallback, 404)
  } catch (err) {
    // 不把内部错误细节回给客户端
    console.error('comments api error:', err)
    return bad(ERR.server, 500)
  }
}
