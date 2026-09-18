/**
 * 把剩余的真 PNG/JPEG 也转为 WebP（**无损**），使全站图片扩展名统一为 .webp。
 *
 * 与 convert-webp-lossless.mjs 的区别：
 *   - 那个脚本有「压后未变小则跳过」的规则，于是留下 242 个 PNG 与 2 个 JPEG
 *   - 本脚本**不跳过**，一律转换，目的是扩展名统一（规范可被机器强制）
 *
 * 代价（已实测，见开发日志）：
 *   - 242 个 PNG：WebP 无损对 PNG 永远更优 → **全部变小**，共 −105 KB
 *   - 2 个 JPEG：JPEG 本身已是有损的，无损 WebP 要存解码后像素 → 变大
 *     （Alipay.jpg 134→244 KB、author_avatar.jpg 13→54 KB，合计 +150 KB）
 *   - 全站净变化约 **+45 KB**，绝对值很小
 *
 * 安全性：先备份（可选 --backup-to），转换后**写盘再读回复核**
 * 「alpha 逐字节相同 + 不透明/半透明像素零差异」，任一不满足则回滚该文件。
 *
 * 用法：
 *   node scripts/dev/convert-remaining-to-webp.mjs                     # 预览
 *   node scripts/dev/convert-remaining-to-webp.mjs --apply             # 执行
 *   node scripts/dev/convert-remaining-to-webp.mjs --apply --backup-to <dir>
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, copyFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: {
  apply: { type: 'boolean' },
  'backup-to': { type: 'string' },
  root: { type: 'string' },
} })

const rootDir = values.root ? join(projectRoot, values.root) : join(projectRoot, 'public')

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const targets = walk(rootDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f))
console.log(`[unify] 待转文件: ${targets.length} 个`)
if (!targets.length) {
  console.log('[unify] 没有非 WebP 图片，无需转换。')
  process.exit(0)
}

const { default: sharp } = await import('sharp')

/** 无损校验：alpha 逐字节相同 + 不透明/半透明像素零 RGB 差异 */
async function verifyLossless(srcBuf, webpBuf) {
  const a = await sharp(srcBuf).ensureAlpha().raw().toBuffer()
  const b = await sharp(webpBuf).ensureAlpha().raw().toBuffer()
  if (a.length !== b.length) return '像素缓冲长度不一致'
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return 'alpha 通道变化'
    if ((a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) && a[i + 3] !== 0) return '可见像素变化'
  }
  return ''
}

// 预览：只算体积变化
if (!values.apply) {
  let oldTotal = 0, newTotal = 0
  const grew = []
  for (const f of targets) {
    const src = readFileSync(f)
    const webp = await sharp(src).webp({ lossless: true, effort: 6 }).toBuffer()
    oldTotal += src.length; newTotal += webp.length
    if (webp.length > src.length) grew.push({ f: relative(projectRoot, f), d: webp.length - src.length })
  }
  console.log(`  当前 ${(oldTotal / 1048576).toFixed(2)} MB → ${(newTotal / 1048576).toFixed(2)} MB`)
  const delta = newTotal - oldTotal
  console.log(`  变化 ${delta >= 0 ? '+' : ''}${(delta / 1024).toFixed(1)} KB`)
  console.log(`  变大的: ${grew.length} 个`)
  for (const g of grew) console.log(`     +${(g.d / 1024).toFixed(1)} KB  ${g.f}`)
  console.log('\n[unify] 预览结束，未改动。加 --apply 执行。')
  process.exit(0)
}

// 备份：--backup-to 允许绝对路径（用 resolve 而非 join，否则绝对路径会被拼到 projectRoot 后面）
let backupDir = ''
if (values['backup-to']) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  backupDir = join(resolve(projectRoot, values['backup-to']), `webp-unify-${stamp}`)
  console.log(`[unify] 建立回退点: ${backupDir}`)
}

let converted = 0, failed = 0
const failures = []
for (const f of targets) {
  const src = readFileSync(f)
  const to = f.replace(/\.(png|jpg|jpeg)$/i, '.webp')
  if (existsSync(to)) { failures.push(`${relative(projectRoot, f)}: 目标已存在`); failed++; continue }
  try {
    const webp = await sharp(src).webp({ lossless: true, effort: 6 }).toBuffer()
    if (backupDir) {
      const dest = join(backupDir, relative(rootDir, f))
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(f, dest)
    }
    writeFileSync(to, webp)
    // 写盘后复核（针对实际写入的字节，而非内存缓冲）
    const readBack = readFileSync(to)
    const bad = await verifyLossless(src, readBack)
    if (bad) {
      unlinkSync(to)
      failures.push(`${relative(projectRoot, f)}: 复核失败(${bad})，已回滚`)
      failed++
      continue
    }
    unlinkSync(f)
    converted++
  } catch (e) {
    failures.push(`${relative(projectRoot, f)}: ${e.message}`)
    failed++
  }
}

console.log(`\n[unify] 已转换 ${converted} 个，失败 ${failed} 个`)
for (const f of failures.slice(0, 15)) console.log(`   ${f}`)
if (backupDir) console.log(`[unify] 回退点: ${backupDir}`)
console.log('[unify] 后续：改代码引用 ① 删掉扩展名特例 ② 重跑 data:build ③ 跑校验')
