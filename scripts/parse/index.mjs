/**
 * 一键数据预处理入口（新风格，全部模块化，无历史脚本残留）：
 *   1) 迁移后的遗留表：pvp → 场景宝箱 → 搜索索引+物品来源 → 装备词缀 → 兑换
 *   2) 页面级预解析：任务/角色/魔物/怪物/物品/料理/成就/事件/魔物蛋
 * 产物统一写入 public/data/parsed/（纯函数与浏览器端共用，展示结果一致）。
 *
 * 用法：
 *   node scripts/parse/index.mjs   （或 npm run data:build）
 * 随构建自动执行：npm run build = data:build + vite build
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsedDir, rawDir, publicDataDir, sizeOf } from './shared.mjs'
import * as pvp from './pvp.mjs'
import * as hiddenRewards from './hidden-rewards.mjs'
import * as search from './search.mjs'
import * as affixes from './affixes.mjs'
import * as exchange from './exchange.mjs'
import { buildItemsFile } from './items.mjs'
import { buildRunesFile } from './runes.mjs'
import { buildFurnitureFile } from './furniture.mjs'
import { buildFacilitiesFile } from './facilities.mjs'
import { buildTasksFile } from './tasks.mjs'
import { buildHeroesFile } from './heroes.mjs'
import { buildPetsFile } from './pets.mjs'
import { buildMonstersFile } from './monsters.mjs'
import { buildRecipesFile } from './recipes.mjs'
import { buildAchievementsFile } from './achievements.mjs'
import { buildEventsFile } from './events.mjs'
import { buildPetEggsFile } from './pet-eggs.mjs'
import { buildGlossaryFile } from './glossary.mjs'
import { buildGachaFile } from './gacha.mjs'
import { buildDungeonsFiles } from './dungeons.mjs'
import { buildChaptersFiles } from './chapters.mjs'
import { buildRelationsFile } from './relations.mjs'
import * as runtimeTables from './runtime-tables.mjs'

if (!existsSync(parsedDir)) {
  mkdirSync(parsedDir, { recursive: true })
}

// CI / 线上构建环境自适应：
// 若未包含 raw/ 原始表或原始表不完整，且 parsed 预解析数据已就绪，直接跳过构建
const hasRawData = (existsSync(rawDir) && existsSync(join(rawDir, 'reward.json'))) ||
  existsSync(join(publicDataDir, 'reward.json'))

if (!hasRawData) {
  if (existsSync(join(parsedDir, 'items.json'))) {
    console.log('\n[data:build] 检测到当前环境未包含 raw/ 原始表（CI/线上部署环境），且 public/data/parsed/ 预解析数据已就绪，跳过数据预处理，直接使用已有数据。\n')
    process.exit(0)
  } else {
    throw new Error('[data:build] 既未找到 raw/ 原始数据，public/data/parsed/ 也无预解析数据，无法完成构建。')
  }
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const TRANSIENT_WRITE_ERRORS = new Set(['EBUSY', 'EPERM', 'EACCES', 'UNKNOWN'])
const sleepSync = delay => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
const writeFileWithRetry = (target, content) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      writeFileSync(target, content, 'utf8')
      return
    } catch (error) {
      if (attempt >= 7 || !TRANSIENT_WRITE_ERRORS.has(error?.code)) throw error
      sleepSync(80 * (attempt + 1))
    }
  }
}
const writeOutput = ({ file, data }) => {
  const relativeFile = file.replace(/\\/g, '/').replace(/^parsed\//, '')
  const target = join(parsedDir, ...relativeFile.split('/'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileWithRetry(target, JSON.stringify(data))
  console.log(`  ✓ ${String(file).padEnd(34)} ${String(sizeOf(data)).padStart(6)} KB`)
}

// ---------- 1. 遗留表（已迁移为新风格模块；顺序敏感：pvp/宝箱来源先出，供 search 合并） ----------
console.log('\n── [legacy→new] pvp 奖励 ──')
const pvpOut = pvp.build()
pvpOut.files.forEach(writeOutput)

console.log('\n── [legacy→new] 场景宝箱（隐藏奖励） ──')
const hiddenOut = hiddenRewards.build()
hiddenOut.files.forEach(writeOutput)

console.log('\n── [legacy→new] 副本数据与来源 ──')
const dungeonOut = buildDungeonsFiles()
rmSync(join(parsedDir, 'dungeons'), { recursive: true, force: true })
dungeonOut.files.forEach(writeOutput)



console.log('\n── [legacy→new] 装备词缀 ──')
affixes.build().files.forEach(writeOutput)

console.log('\n── [legacy→new] 兑换数据 ──')
exchange.build().files.forEach(writeOutput)

console.log('\n── [runtime-tables] 运行时小表透传（raw → parsed） ──')
runtimeTables.build().files.forEach(writeOutput)

// ---------- 2. 页面级预解析（items 是 heroes/monsters 依赖表，必须先构建） ----------
const jobs = [
  { name: 'items', build: () => buildItemsFile(), dependsOnItems: false },
  { name: 'runes', build: () => buildRunesFile(), dependsOnItems: false },
  { name: 'furniture', build: () => buildFurnitureFile(), dependsOnItems: false },
  { name: 'facilities', build: () => buildFacilitiesFile(), dependsOnItems: false },
  { name: 'tasks', build: () => buildTasksFile(), dependsOnItems: false },
  { name: 'recipes', build: () => buildRecipesFile(), dependsOnItems: false },
  { name: 'achievements', build: () => buildAchievementsFile(), dependsOnItems: false },
  { name: 'events', build: () => buildEventsFile(), dependsOnItems: false },
  { name: 'pet-eggs', build: () => buildPetEggsFile(), dependsOnItems: false },
  { name: 'gacha', build: () => buildGachaFile(), dependsOnItems: false },
  { name: 'chapters', build: () => buildChaptersFiles(), dependsOnItems: false },
  { name: 'pets', build: () => buildPetsFile(), dependsOnItems: false },
  { name: 'heroes', build: () => buildHeroesFile(itemData), dependsOnItems: true },
  { name: 'monsters', build: () => buildMonstersFile(itemData), dependsOnItems: true },
  { name: 'glossary', build: () => buildGlossaryFile(monsterData), dependsOnItems: false }
]

console.log('\n── [page] 页面级预解析 ──')
let itemData = null
let monsterData = null
let recipeData = null
let heroData = null
let petData = null
for (const job of jobs) {
  if (job.dependsOnItems && !itemData) {
    throw new Error(`[scripts/parse] ${job.name} 依赖 items 产物，但 items 尚未构建`)
  }
  const startedAt = Date.now()
  const output = job.build()
  if (job.name === 'dungeons') rmSync(join(parsedDir, 'dungeons'), { recursive: true, force: true })
  if (job.name === 'chapters') rmSync(join(parsedDir, 'stages'), { recursive: true, force: true })
  if (job.name === 'monsters') {
    rmSync(join(parsedDir, 'monster-encounters'), { recursive: true, force: true })
    monsterData = output.files?.[0]?.data?.monsters || output.data?.monsters
  }
  if (job.name === 'items') itemData = output.data
  if (job.name === 'recipes') recipeData = output.data
  if (job.name === 'heroes') heroData = output.data
  if (job.name === 'pets') petData = output.data
  const files = output.files || [output]
  files.forEach(writeOutput)
  console.log(`                              (${Date.now() - startedAt}ms)`)
}

console.log('\n── [relations] 物品关联信息预解析 ──')
const relStartedAt = Date.now()
const relationsOut = buildRelationsFile({ itemData, recipeData, heroData, petData, monsterData })
writeOutput(relationsOut)
console.log(`                              (${Date.now() - relStartedAt}ms)`)

console.log('\n── [search] 搜索索引 + 物品来源 ──')
const searchStartedAt = Date.now()
const searchOut = search.build({
  pvpSources: pvpOut.deps.pvpSources,
  hiddenSources: hiddenOut.deps.hiddenSources,
  hiddenList: hiddenOut.deps.hiddenList,
  dungeonSources: dungeonOut.deps.dungeonSources
})
searchOut.files.forEach(writeOutput)
console.log(`                              (${Date.now() - searchStartedAt}ms)`)

console.log('\n✅ 数据预处理完成，全部产物在 public/data/parsed/，可直接进行 vite build 发布。')
