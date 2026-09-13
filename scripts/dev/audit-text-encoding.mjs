/**
 * Read-only text encoding health check. Never rewrites, converts or deletes files.
 *
 * Detects the failure mode where a UTF-8 document is decoded as GBK(cp936) and written
 * back as UTF-8 ("double encoding"): the file stays valid UTF-8 but every CJK character
 * becomes a wrong one, and punctuation/line breaks are partly swallowed.
 *
 * How the test works: encode the text back to GBK bytes, then decode as UTF-8.
 *   - A double-encoded file returns its ORIGINAL readable text (many CJK characters).
 *   - A healthy file returns garbage, because GBK byte pairs are almost never valid UTF-8.
 * Thresholds are calibrated against this repository: healthy files stay <= 0.014,
 * damaged files land around 0.31 (see docs/dev-logs/2026-09/2026-09-12.md).
 *
 * Usage:
 *   node scripts/dev/audit-text-encoding.mjs          # report; exit 1 when anything is found
 *   node scripts/dev/audit-text-encoding.mjs --json   # machine-readable report
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const slash = value => value.replaceAll('\\', '/')

const SCAN_DIRS = ['docs', 'src', 'scripts', 'tests', 'public/data', 'android/app/src/main']
const SCAN_ROOT_FILES = ['README.md', 'index.html', 'package.json', 'vite.config.js', 'playwright.config.js', 'capacitor.config.json']
const TEXT_EXT = /\.(md|json|js|mjs|cjs|ts|vue|css|html|txt|ya?ml|xml|java|kt|gradle|properties|bat|py)$/i
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '.idea', 'dist', 'backups', 'raw', '.tools', 'test-results'])

// 双重编码判定阈值：CJK 占比高于 CJK_MIN 且替换字符占比低于 BAD_MAX
const CJK_MIN = 0.05
const BAD_MAX = 0.2
// 单文件里出现替换字符即视为编码错误（双编码损失点会额外产生少量 U+FFFD，另由 cjkRatio 判定）
const REPLACEMENT_MIN = 3

const gbkDecoder = new TextDecoder('gbk')
const utf8Fatal = new TextDecoder('utf-8', { fatal: true })
const utf8Loose = new TextDecoder('utf-8')
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

// 用平台自带的 GBK 解码器枚举码位，反查出「字符 → GBK 字节」。
// 注意 cp936 的单字节 0x80 映射为 €（U+20AC），与双字节区并存。
const gbkBytesByChar = (() => {
  const map = new Map()
  for (let byte = 0x80; byte <= 0xff; byte++) {
    const char = gbkDecoder.decode(Uint8Array.from([byte]))
    if (char.length === 1 && char !== '\uFFFD' && !map.has(char)) map.set(char, [byte])
  }
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x40; trail <= 0xfe; trail++) {
      if (trail === 0x7f) continue
      const char = gbkDecoder.decode(Uint8Array.from([lead, trail]))
      if (char.length === 1 && char !== '\uFFFD' && !map.has(char)) map.set(char, [lead, trail])
    }
  }
  return map
})()

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out)
    } else if (entry.isFile() && TEXT_EXT.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function collectFiles() {
  const files = []
  for (const dir of SCAN_DIRS) {
    const full = join(root, dir)
    if (existsSync(full)) walk(full, files)
  }
  for (const name of SCAN_ROOT_FILES) {
    const full = join(root, name)
    if (existsSync(full)) files.push(full)
  }
  return files
}

/** @returns {{bad:number,badRatio:number,cjkRatio:number,exact:boolean,sample:string}|null} */
function doubleEncodingMetrics(text) {
  const bytes = []
  let nonAscii = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code < 0x80) { bytes.push(code); continue }
    nonAscii += 1
    const mapped = gbkBytesByChar.get(char)
    if (!mapped) return null // 含 GBK 无法表示的字（emoji、罕见符号等），本检查不适用
    bytes.push(...mapped)
  }
  if (nonAscii < 40) return null

  const raw = Uint8Array.from(bytes)
  let exact = false
  try { utf8Fatal.decode(raw); exact = true } catch { /* 双编码损失点会产生非法序列，属预期 */ }
  const decoded = utf8Loose.decode(raw)
  let bad = 0
  let cjk = 0
  for (const char of decoded) {
    if (char === '\uFFFD') bad += 1
    else if (CJK_RE.test(char)) cjk += 1
  }
  return { bad, badRatio: bad / decoded.length, cjkRatio: cjk / decoded.length, exact, sample: decoded.slice(0, 60) }
}

const files = collectFiles()
const findings = []
let scanned = 0
let measurable = 0

for (const file of files) {
  const rel = slash(relative(root, file))
  const bytes = readFileSync(file)
  scanned += 1

  // 1) 文件本身是否合法 UTF-8（真正的编码错误，例如 GBK 文件被当 UTF-8 保存）
  try {
    utf8Fatal.decode(bytes)
  } catch (error) {
    findings.push({ path: rel, kind: 'invalid-utf8', detail: error.message })
    continue
  }

  const text = bytes.toString('utf8')

  // 2) 替换字符残留
  const replacements = (text.match(/\uFFFD/g) || []).length

  // 3) 双重编码：GBK 往返后还原成可读中文
  const metrics = doubleEncodingMetrics(text)
  if (metrics) measurable += 1
  const doubleEncoded = Boolean(metrics && metrics.cjkRatio >= CJK_MIN && metrics.badRatio <= BAD_MAX)

  if (doubleEncoded) {
    findings.push({
      path: rel,
      kind: 'double-encoded',
      detail: `GBK 往返还原出可读中文（CJK 占比 ${metrics.cjkRatio.toFixed(3)}，替换字符 ${metrics.badRatio.toFixed(3)}）`,
      sample: metrics.sample,
    })
  } else if (replacements >= REPLACEMENT_MIN) {
    findings.push({ path: rel, kind: 'replacement-chars', detail: `含 ${replacements} 个 U+FFFD` })
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, measurable, findings }, null, 2))
} else {
  console.log('文本编码健康检查（只读；不修改任何文件）')
  console.log(`  扫描 ${scanned} 个文本文件，其中 ${measurable} 个可做 GBK 往返判定`)
  if (findings.length === 0) {
    console.log('  ✅ 未发现双重编码或非法编码文件')
  } else {
    console.log(`  ❌ 发现 ${findings.length} 个编码异常文件：`)
    for (const finding of findings) {
      console.log(`     [${finding.kind}] ${finding.path} — ${finding.detail}`)
      if (finding.sample) console.log(`       还原样例: ${finding.sample.replace(/\n/g, ' ⏎ ')}`)
    }
    console.log('\n  修复线索：若文件本应含中文，用 GBK 反解（本脚本的还原样例即原文前缀）后按 UTF-8 重新保存；')
    console.log('  丢失的字（原解码器吞掉的字节）需人工补齐。详见 docs/dev-logs/2026-09/2026-09-12.md。')
  }
}

process.exit(findings.length === 0 ? 0 : 1)
