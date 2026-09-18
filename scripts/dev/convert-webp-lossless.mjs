/**
 * 全站图片转 WebP（**视觉无损**）：PNG/JPEG → WebP lossless，**保留原文件名与扩展名**。
 *
 * ── 为什么保留 `.png` 扩展名却装 WebP 内容 ──
 * 若把 URL 改成 `.webp`，需要同步改 `src/` 里 342 处字面量 + `public/data/parsed/*.json`
 * 里约 9303 处路径，迁移面近万处、极易漏改，且会让所有旧 URL 立即 404（破坏性变更）。
 * 实测（Chromium / WebKit / Firefox 三引擎）**WebP 内容的文件用 `.png` 扩展名 +
 * `image/png` Content-Type 提供时全部正常解码**，且 canvas 读回的像素与等价 PNG 完全一致
 * ——浏览器按内容嗅探，不依赖扩展名。因此保持路径不变，改动面为 0。
 * 代价：Content-Type 与真实格式不符（`image/png` 里装 WebP）。对本项目无影响
 * （`src/` 无任何按魔数解析图片的代码；`gachaSpinePlayer.js` 的 `getImageData` 作用在
 * 已渲染的 canvas 上，不读图片字节）。
 *
 * ── 「无损」的可验证定义 ──
 * WebP lossless 解码后，**alpha 通道逐字节相同**；RGB 只在 **alpha=0 的完全透明像素**上
 * 可能被归一化（视觉不可见，是 WebP 对透明区 RGB 的标准处理）。不透明与半透明像素必须
 * 零差异。本工具默认按此标准**逐文件实测校验**，任一不满足即拒绝写入该文件。
 * 用 `--no-verify-pixels` 可跳过（快，但放弃这层保证）。
 *
 * 用法：
 *   node scripts/dev/convert-webp-lossless.mjs                     # 预览全部（public/images+ui+test2）
 *   node scripts/dev/convert-webp-lossless.mjs --root public/ui    # 只预览某个根
 *   node scripts/dev/convert-webp-lossless.mjs --backup-out <dir>  # 指定回退点（首次运行必需）
 *   node scripts/dev/convert-webp-lossless.mjs --apply --backup-out <dir>
 *   node scripts/dev/convert-webp-lossless.mjs --apply --backup-out <dir> --no-verify-pixels
 *
 * 回退点：`--backup-out` 指向一个**已存在的**备份根，其下必须有与各 `--root` 同名的子目录
 * （如 `<backup>/images/`、`<backup>/ui/`），且与原文件**逐字节一致**（SHA-256 校验），
 * 否则拒绝写入。这是为了防止「拿过期备份当回退点」——本项目历史上就出现过备份是压缩前
 * 状态、与当前不一致的情况。
 *
 * 依赖：sharp（含 libwebp）。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, extname, relative, resolve, sep, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'
import { fileDigest } from './raw-sync.mjs'

const { values } = parseArgs({ options: {
  apply: { type: 'boolean' },
  root: { type: 'string', multiple: true },
  'backup-out': { type: 'string' },
  'backup-to': { type: 'string' },
  'no-verify-pixels': { type: 'boolean' },
  effort: { type: 'string' },
} })

const EFFORT = Math.min(6, Math.max(0, Number(values.effort ?? 6)))
const VERIFY = !values['no-verify-pixels']
const MIN_BYTES = 2048 // 微小图转换收益为负，且会产生额外请求头开销

// 默认覆盖全站两个图片根（public/test2 已于 2026-09-18 删除，其内容并入 public/images/chara/Q）
const rootArgs = values.root?.length ? values.root : ['public/images', 'public/ui']
const roots = rootArgs.map(r => resolve(projectRoot, r))
for (const r of roots) {
  if (!existsSync(r)) throw new Error(`根目录不存在：${r}`)
  if (!r.startsWith(projectRoot + sep)) throw new Error(`根目录必须位于项目内：${r}`)
}

/** 收集某根下所有图片 */
function collect(root) {
  const out = []
  const walk = d => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && ['.png', '.jpg', '.jpeg'].includes(extname(e.name).toLowerCase())) out.push(p)
    }
  }
  walk(root)
  return out
}

const jobs = []
for (const root of roots) {
  const relRoot = relative(projectRoot, root) // 如 public/images
  const mirrorKey = relRoot.replace(/^public[\\/]/, '').replace(/\\/g, '/') // 如 images / ui / test2
  for (const file of collect(root)) jobs.push({ file, root, mirrorKey, relInRoot: relative(root, file) })
}

/**
 * 回退点路径：`<backupOut>/<mirrorKey>/<根内相对路径>`。
 * 注意 `--backup-out` 传的应是**不含 images 后缀**的备份根（如 `…备份-资源/webp-<时间戳>`），
 * 以免与 `maintenance-paths.mjs` 的 `imageBackupRoot`（已以 /images 结尾）拼出 images/images。
 */
let backupOut = values['backup-out'] ? resolve(projectRoot, values['backup-out']) : ''
const backupFor = job => backupOut ? join(backupOut, job.mirrorKey, job.relInRoot) : ''

// ── 可选：先自建回退点（逐文件 SHA-256 校验），这是「以后还能用」的关键一环 ──
if (values['backup-to']) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) // yyyymmddHHMMSS
  backupOut = resolve(projectRoot, values['backup-to'], `webp-before-${stamp}`)
  console.log(`[webp] 建立回退点：${backupOut}`)
  let copied = 0
  for (const job of jobs) {
    const dest = backupFor(job)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(job.file, dest)
    if (fileDigest(job.file) !== fileDigest(dest)) throw new Error(`备份校验失败：${relative(projectRoot, job.file)}`)
    copied++
  }
  const bytes = jobs.reduce((n, j) => n + statSync(j.file).size, 0)
  console.log(`[webp] 回退点完成：${copied} 个文件 / ${(bytes / 1048576).toFixed(2)} MB，逐文件 SHA-256 校验通过`)
}

const { default: sharp } = await import('sharp')

console.log(`[webp] 根目录：${roots.map(r => relative(projectRoot, r)).join(', ')}`)
console.log(`[webp] 候选文件 ${jobs.length} 个；像素级校验：${VERIFY ? '开启（默认）' : '关闭'}；effort=${EFFORT}`)

// ── 校验所有回退点，任何一个对不上就整体拒绝 ──
let backupMissing = 0
const backupBad = []
if (values.apply) {
  if (!backupOut) throw new Error('--apply 必须同时给出 --backup-to（自建回退点）或 --backup-out（已存在的回退点）')
  if (!existsSync(backupOut)) throw new Error(`回退点目录不存在：${backupOut}`)
  for (const job of jobs) {
    const b = backupFor(job)
    if (!existsSync(b)) { backupMissing++; continue }
    if (fileDigest(job.file) === fileDigest(b)) continue
    backupBad.push(relative(projectRoot, job.file))
    if (backupBad.length >= 8) break
  }
  console.log(`[webp] 回退点校验：缺失 ${backupMissing} 个，内容不一致 ${backupBad.length}${backupBad.length ? `（如 ${backupBad.slice(0, 3).join(', ')}）` : ''}`)
}

/** 返回 { ok, reason, bytes } —— ok 表示可以安全写入 */
async function convert(file) {
  const src = readFileSync(file)
  const meta = await sharp(src).metadata()
  if (!meta.width || !meta.height) return { ok: false, reason: '无法读取尺寸' }

  let out
  try {
    // WebP lossless 对 PNG/JPEG 一视同仁：先把源解码为像素，再无熵损失地编码。
    // JPEG 的「损失」发生在当初的 JPEG 压缩，本步不再引入新损失。
    out = await sharp(src).webp({ lossless: true, effort: EFFORT }).toBuffer()
  } catch (e) {
    return { ok: false, reason: `编码失败: ${e.message}` }
  }

  if (out.length >= src.length) return { ok: false, reason: '未变小', bytes: out.length }

  const after = await sharp(out).metadata()
  if (after.width !== meta.width || after.height !== meta.height) {
    return { ok: false, reason: `尺寸变了 ${meta.width}x${meta.height} → ${after.width}x${after.height}` }
  }

  if (VERIFY) {
    const a = await sharp(src).ensureAlpha().raw().toBuffer()
    const b = await sharp(out).ensureAlpha().raw().toBuffer()
    if (a.length !== b.length) return { ok: false, reason: '像素缓冲长度不一致' }
    let alphaDiff = 0
    let visibleRgbDiff = 0
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] !== b[i + 3]) { alphaDiff++; continue }
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        // 只有完全透明像素(alpha=0)的 RGB 允许被归一化
        if (a[i + 3] !== 0) visibleRgbDiff++
      }
    }
    if (alphaDiff) return { ok: false, reason: `alpha 通道有 ${alphaDiff} 处变化` }
    if (visibleRgbDiff) return { ok: false, reason: `可见像素有 ${visibleRgbDiff} 处 RGB 变化` }
  }

  return { ok: true, bytes: out.length, out }
}

if (!values.apply) {
  // 预览：抽样代表性文件估算收益（全量转换太慢，抽样已足够判断量级）
  const bySize = [...jobs].sort((x, y) => statSync(y.file).size - statSync(x.file).size)
  const sample = [...new Set([
    ...bySize.slice(0, 8),
    ...Array.from({ length: 22 }, (_, i) => bySize[Math.floor((i * bySize.length) / 22)]).filter(Boolean),
  ])]
  let oldB = 0, newB = 0, okN = 0, skip = 0
  console.log(`\n[webp] 预览抽样 ${sample.length} 个：`)
  for (const job of sample) {
    const o = statSync(job.file).size
    oldB += o
    if (o < MIN_BYTES) { newB += o; skip++; continue }
    const r = await convert(job.file)
    if (r.ok) { newB += r.bytes; okN++ }
    else { newB += o; skip++ }
    const rel = relative(projectRoot, job.file).replace(/\\/g, '/')
    console.log(`  ${r.ok ? '可压缩' : '跳过  '}  ${(o / 1024).toFixed(0).padStart(6)}KB → ${r.ok ? (r.bytes / 1024).toFixed(0).padStart(6) + 'KB' : '     -'}  ${r.ok ? `${(100 * (1 - r.bytes / o)).toFixed(1)}%`.padStart(6) : (r.reason || '').padEnd(6)}  ${rel.length > 56 ? '…' + rel.slice(-55) : rel}`)
  }
  console.log(`\n[webp] 抽样合计 ${(oldB / 1048576).toFixed(2)} MB → ${(newB / 1048576).toFixed(2)} MB，省 ${(100 * (1 - newB / oldB)).toFixed(1)}%（可压缩 ${okN}，跳过 ${skip}）`)
  console.log('[webp] 预览结束，未写入任何文件。加 --apply --backup-out <回退点> 才实际转换。')
  process.exit(0)
}

if (backupMissing || backupBad.length) {
  throw new Error(`回退点校验失败（缺失 ${backupMissing}，不一致 ${backupBad.length}）：拒绝写入。请先建立与当前状态一致的备份。`)
}

let origTotal = 0, newTotal = 0, converted = 0, skippedSize = 0, skippedSmall = 0
const failures = []
for (const job of jobs) {
  const orig = statSync(job.file).size
  origTotal += orig
  if (orig < MIN_BYTES) { newTotal += orig; skippedSmall++; continue }
  try {
    const r = await convert(job.file)
    if (r.ok) {
      writeFileSync(job.file, r.out)
      newTotal += r.bytes
      converted++
    } else {
      newTotal += orig
      skippedSize++
      if (r.reason && !/未变小/.test(r.reason)) failures.push(`${relative(projectRoot, job.file)}: ${r.reason}`)
    }
  } catch (e) {
    newTotal += orig
    failures.push(`${relative(projectRoot, job.file)}: ${e.message}`)
  }
}

const saved = origTotal - newTotal
console.log(`\n[webp] ${jobs.length} 个文件：转换 ${converted}，未变小跳过 ${skippedSize}，过小跳过 ${skippedSmall}`)
console.log(`[webp] ${(origTotal / 1048576).toFixed(2)} MB → ${(newTotal / 1048576).toFixed(2)} MB，省 ${(saved / 1048576).toFixed(2)} MB（${(100 * saved / origTotal).toFixed(1)}%）`)
if (failures.length) {
  console.log(`[webp] ⚠ 校验失败/异常 ${failures.length} 个（这些文件未被修改）：`)
  for (const f of failures.slice(0, 20)) console.log(`    ${f}`)
} else {
  console.log('[webp] 全部通过校验（alpha 逐字节相同；不透明/半透明像素零差异）。')
}
console.log(`[webp] 回退点：${backupOut}`)
