/**
 * 图片扩展名归一化：把扩展名改成文件的**真实格式**。
 *
 * 背景：上一轮全站转 WebP 时保留了原扩展名，于是 2778 个 `.png` 文件内容其实是 WebP。
 * 这导致两件事无法做：
 *   1. 无法校验「格式是否与扩展名一致」——不一致是常态，校验必然失败
 *   2. 响应头 Content-Type 与内容不符（image/png 里装 WebP）
 * 改名的收益不是省流量（内容已是 WebP，字节不变），而是**让规范可被机器强制**。
 *
 * 用法：
 *   node scripts/dev/normalize-image-extensions.mjs                 # 预览（默认，不写）
 *   node scripts/dev/normalize-image-extensions.mjs --apply         # 实际重命名
 *   node scripts/dev/normalize-image-extensions.mjs --apply --backup-to <dir>
 *
 * 安全设计：
 *   - 按 sharp 读出的**真实格式**决定目标扩展名，绝不硬编码 `.webp`
 *   - 目标已存在则**报错退出**（不覆盖），避免静默丢文件
 *   - 只处理 public 下的图片；SVG 是文本，跳过
 */
import { readdirSync, existsSync, statSync, renameSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: {
  apply: { type: 'boolean' },
  root: { type: 'string' },
  'backup-to': { type: 'string' },
} })

const rootDir = values.root ? join(projectRoot, values.root) : join(projectRoot, 'public')
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(rootDir).filter(f => IMAGE_EXT.has(extname(f).toLowerCase()))
const { default: sharp } = await import('sharp')

const jobs = []
const unreadable = []
for (const file of files) {
  const declared = extname(file).slice(1).toLowerCase()
  let real
  try {
    const meta = await sharp(file).metadata()
    real = meta.format === 'jpeg' ? 'jpg' : meta.format
  } catch {
    unreadable.push(relative(projectRoot, file))
    continue
  }
  // 目标扩展名：以真实格式为准；jpg/jpeg 统一为 jpg（不强制把 jpeg 改成 jpg，保持原样更稳）
  const target = real === 'jpg' && declared === 'jpeg' ? 'jpeg' : real
  if (target === declared) continue
  jobs.push({ file, declared, real, to: file.slice(0, file.length - declared.length) + target })
}

console.log(`[ext] 扫描 ${files.length} 个图片，需重命名 ${jobs.length} 个`)
if (unreadable.length) {
  console.log(`[ext] ⚠ 无法读取 ${unreadable.length} 个（跳过）：`)
  for (const f of unreadable.slice(0, 10)) console.log(`      ${f}`)
}

// 冲突预检：目标已存在则拒绝（除非就是自己）
const conflicts = jobs.filter(j => existsSync(j.to) && j.to !== j.file)
if (conflicts.length) {
  console.error(`[ext] ✗ 目标已存在 ${conflicts.length} 个，拒绝执行：`)
  for (const c of conflicts.slice(0, 10)) console.error(`      ${relative(projectRoot, c.file)} → ${relative(projectRoot, c.to)}`)
  process.exit(1)
}

const byPair = new Map()
for (const j of jobs) {
  const k = `.${j.declared} → .${j.real}`
  if (!byPair.has(k)) byPair.set(k, { n: 0, bytes: 0 })
  const v = byPair.get(k); v.n++; v.bytes += statSync(j.file).size
}
console.log('\n[ext] 重命名计划：')
for (const [k, v] of byPair) console.log(`  ${String(v.n).padStart(5)} 个  ${k}  ${(v.bytes / 1048576).toFixed(2)} MB`)

if (!values.apply) {
  console.log('\n[ext] 预览结束，未改动任何文件。加 --apply 执行。')
  process.exit(0)
}

/**
 * 带重试的重命名：Windows 上文件可能被瞬时占用（索引器 / 杀软扫描 / 编辑器句柄），
 * 表现为 EBUSY。实测同一文件稍后即可改名，故重试而非直接失败。
 */
function renameWithRetry(from, to, attempts = 8) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      renameSync(from, to)
      return
    } catch (error) {
      lastError = error
      if (error.code !== 'EBUSY' && error.code !== 'EPERM' && error.code !== 'EACCES') throw error
      // 忙等待：同步 sleep（脚本是一次性批处理，不需要异步）
      const until = Date.now() + 250 * (i + 1)
      while (Date.now() < until) { /* spin */ }
    }
  }
  throw lastError
}

let done = 0
const failed = []
for (const j of jobs) {
  try {
    renameWithRetry(j.file, j.to)
    done++
  } catch (error) {
    failed.push({ file: relative(projectRoot, j.file), error: error.code || error.message })
  }
}
console.log(`\n[ext] 已重命名 ${done} 个文件。`)
if (failed.length) {
  console.log(`[ext] ⚠ ${failed.length} 个失败（可重跑本脚本续做）：`)
  for (const f of failed.slice(0, 15)) console.log(`      ${f.file}  (${f.error})`)
}
console.log('[ext] 后续必须：① 改代码里的扩展名引用 ② 重跑 npm run data:build ③ 跑校验脚本')
