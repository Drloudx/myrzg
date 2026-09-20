/**
 * 图片资源去重复（只读预览；--apply 才备份并删除）。
 *
 * 判定规则：内容 SHA-256 完全相同，且把仓库里所有 `/images/...` 引用（含 `${}` 动态模板）
 * 反查后没有任何命中。保留优先级：被引用的那份 > 不带 `#编号` 的那份 > 首个。
 *
 * 用法：
 *   node scripts/dev/dedupe-image-resources.mjs                    # 预览 A 类（逐字节重复且无引用）
 *   node scripts/dev/dedupe-image-resources.mjs --hash-suffix      # 连 B 类（# 编号副本，无引用）一起看
 *   node scripts/dev/dedupe-image-resources.mjs --hash-suffix --apply
 *
 * `--apply` 先把每个文件复制到 `../vue-myrzg备份-资源/dedupe-images-<时间>/images/` 并逐文件
 * 回读校验 SHA-256，写 manifest.json 后才删除；删前再校验一次源内容未变。
 * `--hash-suffix` 会删掉与同目录同名文件“像素不同”的重名导出副本，按 SPEC「同名不能作为删除依据」
 * 需要人工确认后再用。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const images = path.join(root, 'public/images')
const apply = process.argv.includes('--apply')
const hashSuffix = process.argv.includes('--hash-suffix')
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
const backupRoot = path.resolve(root, `../vue-myrzg备份-资源/dedupe-images-${stamp}`)

const walk = (dir, skip = []) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${entry.name}`)
  const file = path.join(dir, entry.name)
  if (entry.isDirectory()) return skip.includes(entry.name) ? [] : walk(file, skip)
  return entry.isFile() ? [file] : []
})
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const slash = value => value.replaceAll('\\', '/')

// 引用索引：src / scripts / tests / public/data / 根配置里的 `/images/...` 字面量，`${}` 当通配。
const textFiles = []
for (const entry of ['src', 'scripts', 'tests', 'public/data', 'index.html', 'vite.config.js']) {
  const target = path.join(root, entry)
  if (!fs.existsSync(target)) continue
  if (fs.statSync(target).isFile()) textFiles.push(target)
  else textFiles.push(...walk(target, ['node_modules', 'scratch']).filter(file => /\.(js|mjs|cjs|vue|ts|json|html|css|txt|md)$/i.test(file)))
}
const patterns = new Set()
for (const file of textFiles) {
  for (const match of fs.readFileSync(file, 'utf8').match(/\/images\/[A-Za-z0-9_\-./ #\u4e00-\u9fa5]*/g) || []) patterns.add(match.replace(/[)"'`,;]+$/, ''))
}
const matchers = [...patterns].map(pattern => {
  const index = pattern.indexOf('${')
  return { head: index === -1 ? pattern : pattern.slice(0, index), wildcard: index !== -1 }
})
const referenced = relative => {
  const full = '/images/' + relative
  return matchers.some(m => m.wildcard ? full.startsWith(m.head) : m.head === full)
}

const entries = walk(images).map(file => {
  const bytes = fs.readFileSync(file)
  return { rel: slash(path.relative(images, file)), size: bytes.length, hash: hash(bytes) }
})
const grouped = new Map()
for (const entry of entries) {
  if (!grouped.has(entry.hash)) grouped.set(entry.hash, [])
  grouped.get(entry.hash).push(entry)
}

const plan = []
const kept = []
for (const group of [...grouped.values()].filter(group => group.length > 1)) {
  const members = group.map(entry => ({ ...entry, ref: referenced(entry.rel) }))
  const keep = members.find(m => m.ref) || members.find(m => !/#\d+\./.test(m.rel)) || members[0]
  kept.push({ keep: keep.rel, referenced: !!keep.ref })
  for (const member of members) if (member !== keep && !member.ref) plan.push(member)
}
if (hashSuffix) {
  for (const entry of entries) if (/#\d+\./.test(entry.rel) && !referenced(entry.rel) && !plan.some(p => p.rel === entry.rel)) plan.push(entry)
}
plan.sort((a, b) => a.rel.localeCompare(b.rel))

const summary = {
  mode: apply ? 'apply' : 'preview',
  backupRoot: apply ? slash(backupRoot) : undefined,
  byteDuplicateDrops: plan.filter(entry => !/#\d+\./.test(entry.rel) || !hashSuffix).length,
  files: plan.length,
  bytes: plan.reduce((sum, entry) => sum + entry.size, 0),
  kept: kept.filter(entry => !entry.referenced).map(entry => entry.keep),
  plan: plan.map(entry => entry.rel)
}
if (!apply) { process.stdout.write(JSON.stringify(summary, null, 1) + '\n'); process.exit(0) }

const manifest = []
for (const entry of plan) {
  const source = path.join(images, entry.rel)
  const saved = path.join(backupRoot, 'images', entry.rel)
  fs.mkdirSync(path.dirname(saved), { recursive: true })
  fs.copyFileSync(source, saved, fs.constants.COPYFILE_EXCL)
  if (hash(fs.readFileSync(saved)) !== entry.hash) throw new Error(`Backup differs: ${saved}`)
  manifest.push({ file: entry.rel, bytes: entry.size, sha256: entry.hash })
}
fs.mkdirSync(backupRoot, { recursive: true })
fs.writeFileSync(path.join(backupRoot, 'manifest.json'), JSON.stringify({
  reason: 'public/images 去重复：内容相同且无任何引用的副本' + (hashSuffix ? '（含 # 编号副本）' : ''),
  createdAt: new Date().toISOString(),
  fileCount: manifest.length,
  totalBytes: manifest.reduce((sum, entry) => sum + entry.bytes, 0),
  files: manifest
}, null, 2) + '\n', 'utf8')

for (const entry of plan) {
  const source = path.join(images, entry.rel)
  if (hash(fs.readFileSync(source)) !== entry.hash) throw new Error(`Source changed: ${source}`)
  fs.unlinkSync(source)
}
for (const dir of new Set(plan.map(entry => path.dirname(entry.rel)))) {
  const target = path.join(images, dir)
  if (fs.existsSync(target) && fs.readdirSync(target).length === 0) fs.rmdirSync(target)
}
process.stdout.write(JSON.stringify({ ...summary, deleted: plan.length }, null, 1) + '\n')
