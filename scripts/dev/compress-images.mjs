/**
 * 有损图片压缩工具：PNG 调色板量化、JPEG quality 85，均不属于无损压缩。
 * 默认只预览 public/images（或其子目录），绝不写图。
 * 仅在用户明确授权压缩后使用 --apply --allow-lossy；逐文件验证同路径原图备份。
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { imageBackupRoot, projectRoot, resolveChild } from './maintenance-paths.mjs'
import { fileDigest } from './raw-sync.mjs'

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  apply: { type: 'boolean' }, 'allow-lossy': { type: 'boolean' }, backup: { type: 'string' }
} })
if (positionals.length > 1) throw new Error('Only one input directory is accepted')
if (values.apply && !values['allow-lossy']) throw new Error('Lossy compression requires explicit --apply --allow-lossy')
const imagesRoot = join(projectRoot, 'public/images')
const inputDir = resolve(positionals[0] || imagesRoot)
if (relative(imagesRoot, inputDir)) resolveChild(imagesRoot, inputDir)
const backupRoot = resolve(values.backup || imageBackupRoot)
const backupDistance = relative(imagesRoot, backupRoot)
if (!backupDistance || (!isAbsolute(backupDistance) && backupDistance !== '..' && !backupDistance.startsWith(`..${sep}`))) {
  throw new Error('Backups must be outside public/images')
}

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) { walk(full); continue }
    if (!entry.isFile()) continue
    const ext = extname(entry.name).toLowerCase()
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') files.push(full)
  }
}
walk(inputDir)

const candidates = files.filter(file => statSync(file).size >= 2048)
const hasOriginalBackup = (file, backup) => {
  if (!existsSync(backup)) return false
  const sourceStat = statSync(file)
  const backupStat = statSync(backup)
  if (!backupStat.isFile() || (sourceStat.dev === backupStat.dev && sourceStat.ino === backupStat.ino)) return false
  return fileDigest(file) === fileDigest(backup)
}
const invalidBackups = candidates.filter(file => {
  const backup = resolveChild(backupRoot, relative(imagesRoot, file))
  return !hasOriginalBackup(file, backup)
})
console.log(`[compress] ${candidates.length} candidates; ${invalidBackups.length} missing or non-matching original backups.`)
if (!values.apply) {
  console.log('[compress] Preview only. No images were encoded or changed. Compression requires user authorization and --apply --allow-lossy.')
  process.exit(0)
}
if (invalidBackups.length) throw new Error(`Original backup verification failed: ${invalidBackups.slice(0, 8).join(', ')}`)
const { default: sharp } = await import('sharp')
let origTotal = 0, newTotal = 0, skipped = 0, ok = 0
for (const f of files) {
  const orig = statSync(f).size
  if (orig < 2048) { skipped++; origTotal += orig; newTotal += orig; continue } // 跳过 <2KB 微小图
  origTotal += orig
  try {
    const backup = resolveChild(backupRoot, relative(imagesRoot, f))
    if (!hasOriginalBackup(f, backup)) throw new Error('Image changed after backup validation')
    const buf = readFileSync(f)
    const meta = await sharp(buf).metadata()
    let out
    if (meta.format === 'png') {
      out = await sharp(buf).png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer()
    } else {
      out = await sharp(buf).jpeg({ quality: 85 }).toBuffer()
    }
    if (out.length < orig) { writeFileSync(f, out); newTotal += out.length; ok++ }
    else { newTotal += orig; skipped++ }
  } catch (e) {
    console.warn('  skip(错误):', f, e.message)
    newTotal += orig
  }
}
const savings = origTotal ? 100 * (1 - newTotal / origTotal) : 0
const lines = `${files.length} 个文件（跳过 ${skipped}），${ok} 个已进行有损压缩\n原始 ${(origTotal/1048576).toFixed(1)}MB → 压缩后 ${(newTotal/1048576).toFixed(1)}MB，节省 ${savings.toFixed(1)}%`
console.log(lines)
