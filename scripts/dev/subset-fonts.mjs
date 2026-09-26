/**
 * 字体子集化：把 HarmonyOS 全字集 woff2 裁到「本项目真正用得到的字符」。
 *
 * 为什么需要：`HarmonyOS_Sans_SC_Regular/Bold.woff2` 是 CJK 全字集（29063 字形），
 * 各 4.18 / 4.30 MB。**首次访问**（含清缓存、换设备）两项合计要下 8.28 MB，
 * 占冷启动总传输量约 94%——这是打开慢的第一位原因，且对所有页面生效
 * （字体浏览器缓存 7 天，老用户感知不到，新用户极慢）。
 *
 * 实测本仓库随包发布的全部内容（数据产物 + 源码 + HTML）只用到 3713 个唯一字符，
 * 裁完为 473 / 479 KB，合计省 88.8%。生成时逐字自校验，内容字符零缺失。
 *
 * 为什么不会「丢字」：字符集**每次从随包发布的输入现算**（见 font-subset-lib.mjs 的
 * CHARSET_INPUTS），不维护人工白名单；`--check` 断言「子集字符集 == 当前数据字符集」，
 * 数据更新后忘记重新子集化会**直接失败**，而不是静默回退系统字体。
 * 运行时唯一可能超出子集的文本是实时公告 `notice.json`（本身也在输入里）
 * 和用户导入的备份；这两处缺字会回退 `--font-ui` 里的设备字体，不出现豆腐块。
 *
 * 与 convert-fonts-woff2.mjs 的分工：那个脚本只换容器（TTF → WOFF2，不裁字形），
 * 本脚本在它的产物上再裁字形。全字集 woff2 **保留**，作为 `@font-face` 的第二顺位
 * src 兜底（子集文件缺失/损坏时才会用到；src 列表不会同时下载两个）。
 *
 * 用法：
 *   node scripts/dev/subset-fonts.mjs            # 预览：打印字符集与当前状态，不写文件
 *   node scripts/dev/subset-fonts.mjs --apply    # 生成 .subset.woff2 并写清单
 *   node scripts/dev/subset-fonts.mjs --check    # 只校验清单与当前数据是否一致（纯 Node）
 *
 * 依赖：只有 --apply 需要 python + fonttools + brotli
 * （`python -m pip install "fonttools[woff]" brotli`）。
 */
import { existsSync, statSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { parseArgs } from 'node:util'
import {
  WEIGHTS,
  CHARSET_INPUTS,
  sourceName,
  subsetName,
  collectCharset,
  charsetHash,
  charsetPaths,
  checkFontSubset
} from './font-subset-lib.mjs'

const { values } = parseArgs({ options: { apply: { type: 'boolean' }, check: { type: 'boolean' } } })

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const { fontsDir, manifestPath } = charsetPaths(repoRoot)
const py = process.platform === 'win32' ? 'python' : 'python3'
const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`

// ---------- --check：对接 npm run verify，纯 Node ----------
if (values.check) {
  const result = checkFontSubset(repoRoot)
  console.log('── 字体子集检查 ──')
  if (!result.ok) {
    for (const problem of result.problems) console.log(`  ❌ ${problem}`)
    process.exit(1)
  }
  console.log(`  ✅ 子集与当前数据一致（内容 ${result.contentCount} 字 / 补齐后 ${result.charCount} 字，sha256 ${result.hash.slice(0, 12)}）`)
  process.exit(0)
}

const { content, all, files } = collectCharset(repoRoot)
const allChars = [...all].sort()
const hash = charsetHash(allChars)
const summary = `字符集：内容 ${content.size} 个唯一字符，补齐后 ${allChars.length} 个（扫描 ${files.length} 个文件）`

// ---------- 预览：不写任何文件 ----------
if (!values.apply) {
  console.log('[subset] 预览（未写入任何文件）。')
  console.log(`[subset] ${summary}`)
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
  for (const weight of WEIGHTS) {
    const source = join(fontsDir, sourceName(weight))
    if (!existsSync(source)) {
      console.log(`  ${sourceName(weight).padEnd(34)} 缺少源字体（全字集 woff2）`)
      continue
    }
    const entry = manifest?.fonts?.[weight]
    console.log(`  ${sourceName(weight).padEnd(34)} 全字集 ${kb(statSync(source).size)}  →  ${entry ? `子集 ${kb(entry.outputBytes)}` : '尚未子集化'}`)
  }
  console.log(manifest
    ? `[subset] 清单字符集 ${manifest.charset?.count} 字 / 现算 ${allChars.length} 字：${manifest.charset?.sha256 === hash ? '一致' : '**已过期，需 --apply**'}`
    : '[subset] 尚无清单。')
  console.log('[subset] 加 --apply 才实际生成 .subset.woff2 并写入清单。')
  process.exit(0)
}

// ---------- --apply：实际子集化 ----------
const missingSources = WEIGHTS
  .map(weight => join(fontsDir, sourceName(weight)))
  .filter(p => !existsSync(p))
if (missingSources.length) {
  throw new Error(`缺少源字体（全字集 woff2）：${missingSources.map(p => p.split(/[\\/]/).pop()).join(', ')}。先用 scripts/dev/convert-fonts-woff2.mjs 生成。`)
}

try {
  execFileSync(py, ['-c', 'import fontTools, brotli'], { stdio: 'ignore' })
} catch {
  throw new Error('缺少 fonttools 或 brotli：请先运行 python -m pip install "fonttools[woff]" brotli')
}

const workDir = join(tmpdir(), `myrzg-font-subset-${process.pid}`)
mkdirSync(workDir, { recursive: true })
const charsetFile = join(workDir, 'charset.txt')
// 不带 BOM：--text-file 会把 BOM 当成一个字符
writeFileSync(charsetFile, allChars.join(''), 'utf8')

const slash = value => value.replaceAll('\\', '/')
const pyScript = `
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools import subset
weights = ${JSON.stringify(WEIGHTS)}
fonts_dir = ${JSON.stringify(slash(fontsDir))}
work_dir = ${JSON.stringify(slash(workDir))}
charset_path = ${JSON.stringify(slash(charsetFile))}
wanted = set(ord(c) for c in open(charset_path, encoding='utf-8').read())

def cmap_of(path):
    font = TTFont(path)
    codes = set()
    for table in font['cmap'].tables:
        codes.update(table.cmap.keys())
    font.close()
    return codes

report = {}
for weight in weights:
    src = os.path.join(fonts_dir, 'HarmonyOS_Sans_SC_%s.woff2' % weight)
    tmp_ttf = os.path.join(work_dir, '%s.ttf' % weight)
    dst = os.path.join(fonts_dir, 'HarmonyOS_Sans_SC_%s.subset.woff2' % weight)
    font = TTFont(src)
    font.flavor = None
    font.save(tmp_ttf)
    font.close()
    subset.main([tmp_ttf, '--text-file=' + charset_path, '--layout-features=*',
                 '--flavor=woff2', '--output-file=' + dst])
    orig_cmap = cmap_of(src)
    sub_cmap = cmap_of(dst)
    # 源字体本来就没有的码位（emoji、生僻符号）不算缺字：它们今天也已经回退设备字体
    expected = wanted & orig_cmap
    missing = sorted(expected - sub_cmap)
    report[weight] = {
        'sourceBytes': os.path.getsize(src),
        'outputBytes': os.path.getsize(dst),
        'sourceGlyphs': len(orig_cmap),
        'glyphs': len(sub_cmap),
        'expected': len(expected),
        'missingCount': len(missing),
        'missing': [chr(c) for c in missing[:40]]
    }
print(json.dumps(report, ensure_ascii=True))
`

const pyScriptPath = join(workDir, 'subset.py')
writeFileSync(pyScriptPath, pyScript, 'utf8')

let report
try {
  const out = execFileSync(py, [pyScriptPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  report = JSON.parse(out.trim().split(/\r?\n/).pop())
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

const missing = WEIGHTS.filter(weight => report[weight].missingCount > 0)
if (missing.length) {
  for (const weight of missing) {
    console.error(`  ❌ ${weight} 子集缺 ${report[weight].missingCount} 个字符：${report[weight].missing.join(' ')}`)
  }
  throw new Error('子集化自校验失败：产物缺字，未写入清单。')
}

writeFileSync(manifestPath, `${JSON.stringify({
  generator: 'scripts/dev/subset-fonts.mjs',
  note: '由 --apply 生成；--check（npm run verify 内）会核对字符集 sha256 与子集文件，数据更新后必须重新生成。',
  charset: { count: allChars.length, contentCount: content.size, sha256: hash },
  inputs: CHARSET_INPUTS,
  fonts: Object.fromEntries(WEIGHTS.map(weight => [weight, {
    source: sourceName(weight),
    output: subsetName(weight),
    sourceBytes: report[weight].sourceBytes,
    outputBytes: report[weight].outputBytes,
    sourceGlyphs: report[weight].sourceGlyphs,
    glyphs: report[weight].glyphs,
    charsetCount: allChars.length
  }]))
}, null, 2)}\n`, 'utf8')

console.log('[subset] 子集化完成（自校验：内容字符 0 缺失）。')
console.log(`[subset] ${summary}`)
let totalSource = 0
let totalOutput = 0
for (const weight of WEIGHTS) {
  const r = report[weight]
  totalSource += r.sourceBytes
  totalOutput += r.outputBytes
  console.log(`  ${sourceName(weight).padEnd(34)} ${kb(r.sourceBytes)} → ${kb(r.outputBytes)}  (字形 ${r.sourceGlyphs} → ${r.glyphs}，省 ${(100 * (1 - r.outputBytes / r.sourceBytes)).toFixed(1)}%)`)
}
console.log(`  合计 ${(totalSource / 1048576).toFixed(2)} MB → ${(totalOutput / 1048576).toFixed(2)} MB，省 ${(100 * (1 - totalOutput / totalSource)).toFixed(1)}%`)
console.log(`[subset] 清单：${relative(repoRoot, manifestPath).replaceAll('\\', '/')}；全字集 woff2 保留作为兜底。`)
