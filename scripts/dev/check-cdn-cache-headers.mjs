/**
 * 线上缓存头核对（**只读，需要网络；不放进 npm run verify**，因为 verify 必须能离线跑）。
 *
 * 为什么需要：本站是 **Cloudflare Pages（GitHub 自动部署）+ 外层腾讯云 EdgeOne**。
 * `public/_headers` 只对 Cloudflare Pages 生效，而 EdgeOne 的节点/浏览器缓存策略
 * **优先级更高**——所以"文件里写对了"不等于"线上生效"。2026-09-27 实测发现
 * `/images/*` 与 `/ui/*` 被压成 `max-age=3600`，而 `/fonts/*`、`/assets/*`、
 * `/data/parsed/*` 都正确透传。这种差异只能靠打真实响应头来发现。
 *
 * **必须同时核对 Content-Type**：本站 `_redirects` 是 `/* /index.html 200`，
 * 所以请求一个**不存在**的路径也会返回 HTTP 200，而且 `_headers` 是**按请求路径**匹配的
 * ——于是"未部署的文件"会拿到正确的 Cache-Control，看起来像通过。
 * 只认 Content-Type 不是 text/html 的响应才算数，否则报"该路径未部署/缺失"。
 *
 * 期望值来源：`public/_headers`（本文件不复制规则，只核对结果）。
 *
 * 用法：
 *   node scripts/dev/check-cdn-cache-headers.mjs                 # 核对默认域名（取 env.js 的 CLOUD_URL）
 *   node scripts/dev/check-cdn-cache-headers.mjs --url https://xxx
 * 退出码：全部符合 0，任一不符合 1（可直接用于部署后复测）。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { url: { type: 'string' } } })
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** 默认域名从 `src/utils/env.js` 的 CLOUD_URL 读，避免两处各写一份。 */
function cloudUrl() {
  const env = readFileSync(join(repoRoot, 'src/utils/env.js'), 'utf8')
  const match = env.match(/CLOUD_URL\s*=\s*'([^']+)'/)
  if (!match) throw new Error('未能在 src/utils/env.js 里找到 CLOUD_URL')
  return match[1]
}

const base = String(values.url || cloudUrl()).replace(/\/$/, '')

const request = async (path, method = 'HEAD') => {
  const response = await fetch(`${base}${path}`, { method, redirect: 'follow' })
  return {
    status: response.status,
    headers: response.headers,
    cacheControl: response.headers.get('cache-control') || '(无)',
    contentType: (response.headers.get('content-type') || '').split(';')[0].trim(),
    edge: response.headers.get('eo-cache-status') || response.headers.get('cf-cache-status') || '',
    age: response.headers.get('age') || ''
  }
}

/**
 * 带 hash 的 assets 文件名**每次构建都变**，只能从**线上** index.html 取，
 * 不能用本地 dist（本地可能领先于部署，取到未部署的文件名会走进 SPA fallback）。
 */
async function deployedAssetPath() {
  const html = await (await fetch(`${base}/index.html`)).text()
  const found = html.match(/\/assets\/[A-Za-z0-9._-]+\.js/)
  if (!found) throw new Error('未能从线上 index.html 解析出 assets 文件名')
  return found[0]
}

const assetPath = await deployedAssetPath()

/**
 * 期望规则：`ok(cacheControl)` 判定缓存头，`type` 判定服务出来的确实是该文件。
 *
 * `control` 标出**对照项**：与出问题的图片同处 `/images/*` 前缀、但扩展名不是图片类型。
 * 2026-09-27 实测这几条都拿到 `public, max-age=604800`，而 `.webp` 只有 `max-age=3600`
 * ——同一份 `_headers` 规则、同一个路径前缀，只有扩展名不同，结论只能是
 * **外层 CDN 按文件类型覆盖了图片**，而不是 Pages 没应用规则。
 * 有这组对照，下面的诊断结论才站得住；缺了它就只能猜。
 */
const EXPECTATIONS = [
  { path: '/', expectType: 'text/html', note: '应用壳必须每次回源校验，否则用户拿不到新版本', ok: cc => /no-cache/.test(cc) },
  { path: '/index.html', expectType: 'text/html', note: '同上', ok: cc => /no-cache/.test(cc) },
  { path: '/data/notice.json', expectType: 'application/json', note: '实时公告，不参与游戏表版本锁', ok: cc => /no-store/.test(cc) },
  { path: '/data/parsed/items.json', expectType: 'application/json', note: 'URL 带 ?v=<sha256>，可永久缓存', ok: cc => /immutable/.test(cc) && /max-age=31536000/.test(cc) },
  { path: assetPath, expectType: 'javascript', note: '文件名自带内容 hash，可永久缓存', ok: cc => /immutable/.test(cc) && /max-age=31536000/.test(cc) },
  { path: '/fonts/HarmonyOS_Sans_SC_Regular.subset.woff2', expectType: 'font/woff2', note: 'URL 带内容哈希，_headers 给 1 年 immutable', ok: cc => /immutable/.test(cc) && /max-age=31536000/.test(cc) },
  // 对照组：同前缀、非图片类型 —— 用来证明 `_headers` 的 /images/* 规则本身是生效的
  { path: '/images/gacha/asset-manifest.json', expectType: 'application/json', control: true, note: '对照组：/images/* 下的非图片文件应随 _headers 为 7 天', ok: cc => /max-age=604800/.test(cc) },
  { path: '/images/gacha/audio/card.mp4', expectType: 'video/mp4', control: true, note: '对照组：mp4 应随 _headers 为 7 天', ok: cc => /max-age=604800/.test(cc) },
  // 出问题的两条：图片类型被外层 CDN 压成 1 小时
  { path: '/images/Common_ItemIcon/item_00001.webp', expectType: 'image/webp', image: true, note: '_headers 给 7 天；实测被压成 max-age=3600', ok: cc => /max-age=604800/.test(cc) },
  { path: '/ui/logo.webp', expectType: 'image/webp', image: true, note: '_headers 给 7 天；实测被压成 max-age=3600', ok: cc => /max-age=604800/.test(cc) }
]

console.log(`核对线上缓存头：${base}\n`)
let failed = 0
const missing = []
const outcome = []
for (const expectation of EXPECTATIONS) {
  let result
  try {
    result = await request(expectation.path)
  } catch (error) {
    failed++
    console.log(`  ❌ ${expectation.path}\n      请求失败：${error.message}`)
    continue
  }

  // SPA fallback：不存在的路径也回 200 + text/html，且 _headers 按路径照样套上，
  // 不加这一层判断就会把"没部署"误报成"缓存头正确"。
  // 用 includes 而不是相等：CDN 可能回 application/javascript、application/json 等完整类型。
  if (expectation.expectType && !result.contentType.includes(expectation.expectType)) {
    missing.push(`${expectation.path}（Content-Type=${result.contentType}，期望 ${expectation.expectType}）`)
    console.log(`  ⚠️  ${expectation.path}`)
    console.log(`       未部署或缺失：Content-Type=${result.contentType}（期望 ${expectation.expectType}）`)
    console.log(`       这条不计通过也不计失败——先部署该文件再复跑。`)
    continue
  }

  const pass = expectation.ok(result.cacheControl)
  if (!pass) failed++
  console.log(`  ${pass ? '✅' : '❌'} ${expectation.path}${expectation.control ? '   [对照组]' : ''}`)
  console.log(`       Cache-Control: ${result.cacheControl}${result.status !== 200 ? `  (HTTP ${result.status})` : ''}`)
  if (!pass) {
    console.log(`       期望：${expectation.note}`)
    console.log(`       修复：先在腾讯云 EdgeOne 控制台确认「忽略查询字符串」为关闭，`)
    console.log(`             再为该路径/文件类型设置「遵循源站」或 7 天；然后重新部署 Pages 并复跑本脚本。`)
  }
  outcome.push({ expectation, pass, result })
}

console.log(failed === 0
  ? `\n✅ 已核对的路径缓存头全部与 public/_headers 一致${missing.length ? `；另有 ${missing.length} 条未部署` : ''}`
  : `\n❌ ${failed} 条不符合 public/_headers —— 见上方修复建议`)

// 诊断：把"对照组通过 + 图片失败"这个组合翻成结论，避免每次都要重新推一遍。
const controlPassed = outcome.some(o => o.expectation.control && o.pass)
const imageFailed = outcome.filter(o => o.expectation.image && !o.pass)
if (controlPassed && imageFailed.length) {
  console.log(`
诊断：对照组（/images/* 下的 .json/.mp4）按 _headers 拿到了 7 天，而图片类型只有 1 小时。
  同一份 _headers 规则、同一个路径前缀，只有扩展名不同 —— 说明 Cloudflare Pages 的
  public/_headers **已经生效**，是**外层腾讯云 EdgeOne 按文件类型覆盖了图片的缓存策略**。
  因此：改仓库文件无法解决，必须在 EdgeOne 控制台把图片类（webp/svg/png/...）的缓存
  过期规则改成「遵循源站」或 7 天，并确认「忽略查询字符串」为关闭（否则 ?v= 不参与缓存键，
  长缓存会读到旧图）。改完重新部署 Pages 再复跑本脚本。`)
}
if (missing.length) console.log(`\n未部署（需先发布）：\n  - ${missing.join('\n  - ')}`)
process.exit(failed === 0 ? 0 : 1)
