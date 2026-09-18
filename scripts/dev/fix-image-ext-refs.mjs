/**
 * 修正版：把代码里的图片路径引用从 .png/.jpg 改为 .webp。
 *
 * v1（migrate-image-ext-refs.mjs）的缺陷：
 *   正则 `(['"`])([^'"`\n]*?\.(?:png|jpg|jpeg))\1` 要求路径里不含引号，
 *   但模板字符串常嵌套引号，如：
 *       `/images/event/${(conf.eventImg || 'none')}.png`
 *   这里的 `'none'` 让 `[^'"`\n]*?` 提前终止 → 匹配失败 → 漏改。
 *
 * v2 改法：不再整体匹配「引号包住路径」，而是**逐行查找图片扩展名出现处**，
 * 判断它是否处于「路径构造」上下文（前文有 `/` 或 `${`），据此替换。
 * 这样对模板嵌套引号免疫。
 *
 * 仍然排除：
 *   - 格式判断型（replace(/\.png$/) / endsWith('.png')）——已单独改成扩展名无关
 *   - 源资源包 / 图集路径（那些文件仍是 .png）
 *   - 会生成 PNG 的脚本
 *   - 注释行
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })

const TARGET_DIRS = ['src', 'tests', 'scripts/parse', 'scripts/dev']
const EXCLUDE_FILES = new Set([
  'scripts/dev/export-skin-models.mjs',
  'scripts/dev/import-gacha-assets.mjs',
  'scripts/dev/consolidate-image-resources.mjs',
  'scripts/dev/share-gacha-images.mjs',
  'scripts/dev/compress-images.mjs',
  'scripts/dev/convert-webp-lossless.mjs',
  'scripts/dev/normalize-image-extensions.mjs',
  'scripts/dev/migrate-image-ext-refs.mjs',
  'scripts/dev/fix-image-ext-refs.mjs',
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

/** 判断该行是否「格式判断型」——这类不能改 */
const isFormatCheck = line =>
  /replace\(\s*\/\\?\.(png|jpg|jpeg)/.test(line) ||
  /\.(endsWith|includes|match)\(\s*['"`]?\.(png|jpg|jpeg)/.test(line) ||
  /contentType\s*:[^,;]{0,60}\.(png|jpg|jpeg)/.test(line) ||
  /ext\s*===?\s*['"`]\.(png|jpg|jpeg)/.test(line)

const files = TARGET_DIRS.flatMap(d => walk(join(projectRoot, d)))
  .filter(f => /\.(js|mjs|vue|ts)$/.test(f))
  .filter(f => !EXCLUDE_FILES.has(f.replace(projectRoot, '').replaceAll('\\', '/').replace(/^\//, '')))

let changedFiles = 0
let changedRefs = 0
const report = []
const skipped = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  let localCount = 0

  const nextLines = lines.map(line => {
    // 跳过注释行与格式判断行
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return line
    if (isFormatCheck(line)) { return line }
    // 跳过源资源包路径
    if (/4\.24路资源包|UI_Atlases/.test(line)) { skipped.push(line.trim().slice(0, 100)); return line }

    // 只替换「看起来是图片路径」的扩展名：前面紧跟非空白字符（文件名的一部分）
    // 且该扩展名不在 replace/endsWith 语境（已由 isFormatCheck 排除）
    const replaced = line.replace(/([A-Za-z0-9_\-{}()$.'"`\s|?:]*)\.(png|jpg|jpeg)(?=['"`\s,)\]}])/g,
      (whole, prefix, ext) => {
        // prefix 必须含 `/`（路径）或本身就是文件名拼接，否则可能是无关词
        if (!/[/\\]/.test(prefix) && !/\$\{/.test(prefix)) return whole
        localCount++
        return `${prefix}.webp`
      })
    return replaced
  })

  if (localCount) {
    changedFiles++
    changedRefs += localCount
    report.push({ file: file.replace(projectRoot, '').replaceAll('\\', '/').replace(/^\//, ''), n: localCount })
    if (values.apply) writeFileSync(file, nextLines.join('\n'))
  }
}

console.log(`[fix] 扫描 ${files.length} 个文件，命中 ${changedFiles} 个，引用 ${changedRefs} 处`)
for (const r of report.sort((a, b) => b.n - a.n).slice(0, 25)) console.log(`  ${String(r.n).padStart(4)}  ${r.file}`)
if (skipped.length) console.log(`\n[fix] 跳过源资源包路径 ${skipped.length} 处`)

if (!values.apply) {
  console.log('\n[fix] 预览结束。加 --apply 写入。')
  process.exit(0)
}
console.log('\n[fix] 已写入。')
