/**
 * 字体格式转换：TTF → WOFF2（**无损**，仅换容器与压缩方式，字形完全一致）。
 *
 * 为什么需要：`HarmonyOS_Sans_SC_Regular/Bold.ttf` 各 7.9 MB（CJK 全字集 29221 字形），
 * 首次加载经 Brotli 后仍各 ~5.4 MB，占手机端首屏传输量约 78%。WOFF2 用 Brotli
 * 内置字典压缩字形数据，实测同字形数下再省约 46~48%。
 *
 * 与子集化的区别：本脚本**不裁字形**，因此不存在缺字回退设备字体的风险。
 * 子集化是另一件事（会丢字），未在本脚本实现。
 *
 * 用法：
 *   node scripts/dev/convert-fonts-woff2.mjs            # 只预览（不写文件）
 *   node scripts/dev/convert-fonts-woff2.mjs --apply    # 实际生成 .woff2
 *
 * 依赖：python + fonttools + brotli（`python -m pip install "fonttools[woff]" brotli`）。
 * 原 TTF 不会被删除：`@font-face` 保留 TTF 作为不支持 WOFF2 时的兜底，
 * 浏览器只会下载它能用的那一种（src 列表按 format() 择一）。
 */
import { existsSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fontsDir = join(repoRoot, 'public/fonts')
const py = process.platform === 'win32' ? 'python' : 'python3'

const target = name => join(fontsDir, name)
const SOURCES = ['HarmonyOS_Sans_SC_Regular.ttf', 'HarmonyOS_Sans_SC_Bold.ttf']

const missing = SOURCES.filter(name => !existsSync(target(name)))
if (missing.length) throw new Error(`缺少源字体：${missing.join(', ')}`)

// 依赖自检，避免跑到一半才失败
try {
  execFileSync(py, ['-c', 'import fontTools, brotli'], { stdio: 'ignore' })
} catch {
  throw new Error('缺少 fonttools 或 brotli：请先运行 python -m pip install "fonttools[woff]" brotli')
}

const sizes = SOURCES.map(name => ({ name, ttf: statSync(target(name)).size }))

if (!values.apply) {
  console.log('[woff2] 预览（未写入任何文件）。可转换：')
  for (const s of sizes) {
    console.log(`  ${s.name.padEnd(32)} ${(s.ttf / 1048576).toFixed(2)} MB (TTF)`)
  }
  console.log('[woff2] 加 --apply 才实际生成 .woff2。')
  process.exit(0)
}

const script = `
import os
from fontTools.ttLib import TTFont
for name in ${JSON.stringify(SOURCES.map(n => basename(n, '.ttf')))}:
    src = os.path.join(${JSON.stringify(fontsDir.replace(/\\/g, '/'))}, name + '.ttf')
    dst = os.path.join(${JSON.stringify(fontsDir.replace(/\\/g, '/'))}, name + '.woff2')
    f = TTFont(src)
    f.flavor = 'woff2'
    f.save(dst)
    f.close()
    print(f"{name}|{os.path.getsize(src)}|{os.path.getsize(dst)}")
`
const scriptPath = join(fontsDir, '.convert-woff2.py')
writeFileSync(scriptPath, script, 'utf8')

let out = ''
try {
  out = execFileSync(py, [scriptPath], { encoding: 'utf8' })
} finally {
  if (existsSync(scriptPath)) unlinkSync(scriptPath)
}

let totalOld = 0
let totalNew = 0
console.log('[woff2] 转换结果：')
for (const line of out.trim().split(/\r?\n/)) {
  const [name, oldSize, newSize] = line.split('|')
  if (!newSize) continue
  const o = Number(oldSize)
  const n = Number(newSize)
  totalOld += o
  totalNew += n
  console.log(`  ${name}.woff2  ${(o / 1048576).toFixed(2)} MB → ${(n / 1048576).toFixed(2)} MB  (省 ${(100 * (1 - n / o)).toFixed(1)}%)`)
}
if (totalOld) {
  console.log(`  合计 ${(totalOld / 1048576).toFixed(2)} MB → ${(totalNew / 1048576).toFixed(2)} MB，省 ${(100 * (1 - totalNew / totalOld)).toFixed(1)}%`)
}
const generated = readdirSync(fontsDir).filter(f => f.endsWith('.woff2'))
console.log(`[woff2] public/fonts 现有 .woff2 ${generated.length} 个；原 .ttf 保留作为兜底。`)
