/**
 * 字体子集化的共享逻辑（字符集收集 + 清单校验）。
 *
 * 由 `scripts/dev/subset-fonts.mjs`（生成）与 `scripts/dev/verify.mjs`（验收断言）共用，
 * 保证「算字符集」这件事只有一份实现——否则生成与校验口径不一致时，校验就失去意义。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'

/** 参与子集化的字重。 */
export const WEIGHTS = ['Regular', 'Bold']
export const sourceName = weight => `HarmonyOS_Sans_SC_${weight}.woff2`
export const subsetName = weight => `HarmonyOS_Sans_SC_${weight}.subset.woff2`

/**
 * 字符集输入：**随包发布**的全部文本来源。
 * 新增文本目录时要一起加进来，否则该目录的文案可能缺字（校验只覆盖这里列到的输入）。
 */
export const CHARSET_INPUTS = [
  { dir: 'public/data', exts: ['.json'] },
  { dir: 'src', exts: ['.vue', '.js', '.css'] },
  { file: 'index.html' }
]

/** 恒定补齐的码位段：标点/全角/拉丁。源字体没有的码位会被 pyftsubset 自动忽略。 */
const UNICODE_RANGES = [
  [0x20, 0x7e], // ASCII 可见字符
  [0xa0, 0xff], // Latin-1 补充
  [0x2000, 0x206f], // 常用标点（破折号、引号、省略号）
  [0x3000, 0x303f], // CJK 标点
  [0xff00, 0xffef] // 全角/半角形式
]

function walkFiles(target, exts, out) {
  for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(target, entry.name)
    if (entry.isDirectory()) { walkFiles(full, exts, out); continue }
    if (!entry.isFile()) continue
    if (exts && !exts.some(ext => entry.name.endsWith(ext))) continue
    out.push(full)
  }
  return out
}

/**
 * 收集字符集。返回 `{ content, all, files }`：
 * - `content` 是输入里真实出现的字符（缺字判定的对象）
 * - `all` 是 content ∪ 恒定补齐段（实际传给 pyftsubset 的集合）
 */
export function collectCharset(repoRoot) {
  const files = []
  for (const input of CHARSET_INPUTS) {
    if (input.file) {
      const p = join(repoRoot, input.file)
      if (existsSync(p)) files.push(p)
      continue
    }
    const dir = join(repoRoot, input.dir)
    if (existsSync(dir)) walkFiles(dir, input.exts, files)
  }
  const content = new Set()
  for (const file of files) {
    // 显式 UTF-8：本项目数据/文档统一 UTF-8，不能按系统默认编码误读后算错字符集
    for (const ch of readFileSync(file, 'utf8')) content.add(ch)
  }
  const all = new Set(content)
  for (const [from, to] of UNICODE_RANGES) {
    for (let code = from; code <= to; code++) all.add(String.fromCodePoint(code))
  }
  return { content, all, files }
}

export const charsetHash = chars => createHash('sha256').update([...chars].sort().join('')).digest('hex')

export const charsetPaths = repoRoot => ({
  fontsDir: join(repoRoot, 'public/fonts'),
  manifestPath: join(repoRoot, 'public/fonts/font-subset.json')
})

/**
 * 校验「已提交的子集字体」是否与**当前**数据字符集一致。
 * 纯 Node，不依赖 python，因此可以放进 `npm run verify` 而无环境耦合。
 * 返回 `{ ok, problems, charCount, contentCount, hash, manifest, fileCount }`。
 */
export function checkFontSubset(repoRoot) {
  const { fontsDir, manifestPath } = charsetPaths(repoRoot)
  const { content, all, files } = collectCharset(repoRoot)
  const hash = charsetHash(all)
  const problems = []
  let manifest = null

  if (!existsSync(manifestPath)) {
    problems.push(`缺少清单 ${relative(repoRoot, manifestPath).replaceAll('\\', '/')}：请运行 node scripts/dev/subset-fonts.mjs --apply`)
  } else {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch (error) {
      problems.push(`清单无法解析：${error.message}`)
    }
  }

  if (manifest) {
    if (manifest.charset?.sha256 !== hash) {
      problems.push(`字符集与清单不一致（清单 ${manifest.charset?.count} 字 / 当前 ${all.size} 字）：数据已更新，请重新运行 --apply`)
    }
    for (const weight of WEIGHTS) {
      const subset = join(fontsDir, subsetName(weight))
      const source = join(fontsDir, sourceName(weight))
      const entry = manifest.fonts?.[weight]
      if (!entry) problems.push(`清单缺少 ${weight} 条目`)
      if (!existsSync(subset)) {
        problems.push(`缺少子集字体 ${subsetName(weight)}：请运行 --apply`)
      } else {
        const size = statSync(subset).size
        if (size < 1024) problems.push(`${subsetName(weight)} 体积异常（${size} 字节）`)
        if (entry?.outputBytes && Math.abs(size - entry.outputBytes) > 1024) {
          problems.push(`${subsetName(weight)} 与清单记录不一致（${size} != ${entry.outputBytes}）`)
        }
      }
      // 全字集必须留着做 @font-face 的第二顺位兜底
      if (!existsSync(source)) problems.push(`缺少全字集兜底 ${sourceName(weight)}`)
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    hash,
    charCount: all.size,
    contentCount: content.size,
    fileCount: files.length,
    manifest
  }
}
