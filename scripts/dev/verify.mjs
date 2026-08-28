/**
 * 一键验收脚本（npm run verify）：
 *   1) 静态检查：parsed 产物齐全 + 源码/配置无旧脚本残留引用
 *   2) 完整构建：npm run build（数据预处理 + vite build）
 *   3) 产物检查：dist/data/parsed 关键产物存在
 * 全部通过输出 PASS，任一失败 exit 1。
 * 依赖：Node 18+；脚本目录 scripts/dev/（开发工具，不进构建链）。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const parsedDir = join(root, 'public/data/parsed')
const distParsedDir = join(root, 'dist/data/parsed')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ---------- 1. 产物齐全（public/data/parsed） ----------
console.log('── 1/3 预解析产物检查 ──')
const expected = {
  'items.json': 500, 'tasks.json': 500, 'heroes.json': 500, 'monsters.json': 300,
  'pets.json': 20, 'recipes.json': 5, 'achievements.json': 20, 'events.json': 20,
  'pet-eggs.json': 5, 'search-index.json': 100, 'item-sources.json': 20,
  'itemAffixes.json': 5, 'parsed-exchange.json': 100, 'parsed-pvp.json': 5,
  'parsed-hidden.json': 10, 'dialogIndex.json': 50, 'dialogSegments.json': 1,
  'parsed-pvp-sources.json': 0, 'parsed-hidden-sources.json': 0, 'dungeons.json': 10
}
for (const [file, minKB] of Object.entries(expected)) {
  const p = join(parsedDir, file)
  const ok = existsSync(p) && statSync(p).size >= minKB * 1024
  check(`parsed/${file}`, ok, ok ? `${Math.round(statSync(p).size / 1024)}KB` : '缺失或过小')
}

const dungeonDetailDir = join(parsedDir, 'dungeons')
const dungeonDetailFiles = existsSync(dungeonDetailDir)
  ? readdirSync(dungeonDetailDir).filter(file => file.endsWith('.json'))
  : []
const largestDungeonDetail = dungeonDetailFiles
  .map(file => ({ file, bytes: statSync(join(dungeonDetailDir, file)).size }))
  .sort((a, b) => b.bytes - a.bytes)[0]
check('副本详情已按关卡拆分', dungeonDetailFiles.length > 0,
  largestDungeonDetail
    ? `${dungeonDetailFiles.length} 个详情文件；最大 ${largestDungeonDetail.file} ${(largestDungeonDetail.bytes / 1024 / 1024).toFixed(2)}MB`
    : '未找到详情文件')

// ---------- 2. 源码/配置无旧脚本残留引用 ----------
console.log('── 2/3 旧脚本残留检查 ──')
// 2a. 旧文件必须已删除（存在即失败）
const goneFiles = [
  'scripts/clean-data.js', 'scripts/parse-rewards.js', 'scripts/parse-exchange.js',
  'scripts/generate-affixes.js', 'scripts/parse-hidden-rewards.js',
  'src/assets/common.css', 'src/components/BackToTop.vue',
  'src/views/MonstersView.bak.vue', 'src/utils/monsterParser.bak.js'
]
let staleFound = []
for (const rel of goneFiles) {
  if (existsSync(join(root, rel))) staleFound.push(`${rel} 仍存在`)
}
// 2b. 无对已删除模块的 import / 脚本引用（注释不算：只扫 import 与 package.json scripts）
const importRe = /from\s+['"][^'"]*(common\.css|BackToTop|MonstersView\.bak|monsterParser\.bak|UI_REFACTOR_GUIDE)['"]/
const scanImportDirs = ['src']
for (const d of scanImportDirs) {
  const dir = join(root, d)
  if (!existsSync(dir)) continue
  const walk = (cur) => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(js|mjs|vue|ts)$/.test(entry.name)) continue
      try {
        const rel = full.replace(root + '/', '')
        if (importRe.test(readFileSync(full, 'utf8'))) staleFound.push(`${rel} 含已删除模块 import`)
      } catch { }
    }
  }
  walk(dir)
}
try {
  const pkg = readFileSync(join(root, 'package.json'), 'utf8')
  for (const old of ['clean-data.js', 'parse-rewards.js', 'parse-exchange.js', 'generate-affixes.js', 'parse-hidden-rewards.js']) {
    if (pkg.includes(old)) staleFound.push(`package.json 引用 ${old}`)
  }
} catch { }
check('源码/配置无旧脚本残留', staleFound.length === 0, staleFound.length ? staleFound.join('; ') : '')

// ---------- 3. 完整构建 + dist 产物 ----------
console.log('── 3/3 完整构建（npm run build） ──')
let buildOk = true
try {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execSync(`${npmCmd} run build`, { stdio: 'inherit', cwd: root })
} catch (e) {
  buildOk = false
}
check('npm run build 通过', buildOk)

for (const f of ['items.json', 'tasks.json', 'heroes.json', 'monsters.json', 'search-index.json', 'parsed-exchange.json', 'dungeons.json']) {
  const p = join(distParsedDir, f)
  const ok = existsSync(p)
  check(`dist/data/parsed/${f}`, ok)
}

const distDungeonDetailDir = join(distParsedDir, 'dungeons')
const distDungeonDetails = existsSync(distDungeonDetailDir)
  ? readdirSync(distDungeonDetailDir).filter(file => file.endsWith('.json'))
  : []
check('dist/data/parsed/dungeons 详情产物', distDungeonDetails.length === dungeonDetailFiles.length,
  `${distDungeonDetails.length}/${dungeonDetailFiles.length} 个文件`)

// ---------- 汇总 ----------
const failed = results.filter(r => !r.ok)
console.log('\n' + (failed.length === 0
  ? '✅ verify 全部通过：产物齐全、无残留、build 成功'
  : `❌ verify 失败 ${failed.length} 项，请见上方 ❌ 列表`))
process.exit(failed.length === 0 ? 0 : 1)
