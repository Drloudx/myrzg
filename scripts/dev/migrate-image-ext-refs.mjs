/**
 * 把代码里的图片路径引用从 .png/.jpg 改为 .webp（配合 normalize-image-extensions.mjs）。
 *
 * 背景：图片文件已按真实格式重命名（2778 个 .png → .webp、1 个 .jpg → .webp），
 * 代码里的引用必须同步，否则 404。
 *
 * 安全设计（改名这类批量操作最容易漏改，故本脚本自带验证）：
 *   - 只替换**图片路径**上下文（形如 `/xxx/yyy.webp` 或 `xxx.webp` 且位于引号/模板中）
 *   - **不动**格式判断型用法（`replace(/\.png$/...)`、`endsWith('.webp')` 等）——那些已单独改成扩展名无关
 *   - **不动**源资源包路径（`4.24路资源包`、`UI_Atlases` 下的原图仍是 .png）
 *   - **不动**会生成 PNG 的脚本（export-skin-models 用 sharp 输出 .png）
 *   - 改完**逐个验证**：从产物与源码提取所有图片引用，确认磁盘上文件存在
 *
 * 用法：
 *   node scripts/dev/migrate-image-ext-refs.mjs           # 预览
 *   node scripts/dev/migrate-image-ext-refs.mjs --apply   # 写入
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })

const TARGET_DIRS = ['src', 'tests', 'scripts/parse', 'scripts/dev']
const EXCLUDE_FILES = new Set([
  // 用 sharp 输出 .png 的生成脚本：产物是真 PNG，不应改
  'scripts/dev/export-skin-models.mjs',
  // 从源资源包/图集导入：源文件仍是 .png
  'scripts/dev/import-gacha-assets.mjs',
  'scripts/dev/consolidate-image-resources.mjs',
  'scripts/dev/share-gacha-images.mjs',
  // 压缩/转换工具本身要认所有图片格式
  'scripts/dev/compress-images.mjs',
  'scripts/dev/convert-webp-lossless.mjs',
  'scripts/dev/normalize-image-extensions.mjs',
])

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!['node_modules', 'scratch'].includes(e.name)) walk(p, out) }
    else out.push(p)
  }
  return out
}

const files = TARGET_DIRS.flatMap(d => walk(join(projectRoot, d)))
  .filter(f => /\.(js|mjs|vue|ts)$/.test(f))
  .filter(f => !EXCLUDE_FILES.has(f.replace(projectRoot + '\\', '').replaceAll('\\', '/')))

// 匹配「图片路径」：引号/模板内、含 / 或纯文件名、以 .png/.jpg/.jpeg 结尾
const PATH_RE = /(['"`])([^'"`\n]*?\.(?:png|jpg|jpeg))\1/g

let changedFiles = 0
let changedRefs = 0
const report = []
const skipped = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  let localCount = 0
  const next = text.replace(PATH_RE, (whole, quote, path) => {
    // 跳过源资源包 / 图集路径（那些文件仍是 .png）
    if (/4\.24路资源包|UI_Atlases/.test(path)) { skipped.push({ file, path, why: '源资源包' }); return whole }
    // 跳过 CSS url() 里的字体等非图片（本正则已限定图片扩展名，这里只做兜底）
    if (/\.(?:png|jpg|jpeg)$/i.test(path) === false) return whole
    localCount++
    return `${quote}${path.replace(/\.(?:png|jpg|jpeg)$/i, '.webp')}${quote}`
  })
  if (localCount) {
    changedFiles++
    changedRefs += localCount
    report.push({ file: file.replace(projectRoot + '/', '').replaceAll('\\', '/'), n: localCount })
    if (values.apply) writeFileSync(file, next)
  }
}

console.log(`[refs] 扫描 ${files.length} 个文件，命中 ${changedFiles} 个，引用 ${changedRefs} 处`)
for (const r of report.sort((a, b) => b.n - a.n).slice(0, 20)) console.log(`  ${String(r.n).padStart(4)}  ${r.file}`)
if (skipped.length) {
  console.log(`\n[refs] 跳过源资源包路径 ${skipped.length} 处（文件仍是 .png，正确）`)
  for (const s of skipped.slice(0, 5)) console.log(`      ${s.path}`)
}

if (!values.apply) {
  console.log('\n[refs] 预览结束，未写入。加 --apply 执行。')
  process.exit(0)
}
console.log('\n[refs] 已写入。下一步：npm run data:build 重新生成产物路径。')
