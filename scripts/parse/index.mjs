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
import { parsedDir, sizeOf } from './shared.mjs'
import * as pvp from './pvp.mjs'
import * as hiddenRewards from './hidden-rewards.mjs'
import * as search from './search.mjs'
import * as affixes from './affixes.mjs'
import * as exchange from './exchange.mjs'
import { buildItemsFile } from './items.mjs'
import { buildTasksFile } from './tasks.mjs'
import { buildHeroesFile } from './heroes.mjs'
import { buildPetsFile } from './pets.mjs'
import { buildMonstersFile } from './monsters.mjs'
import { buildRecipesFile } from './recipes.mjs'
import { buildAchievementsFile } from './achievements.mjs'
import { buildEventsFile } from './events.mjs'
import { buildPetEggsFile } from './pet-eggs.mjs'
import { buildDungeonsFiles } from './dungeons.mjs'

if (!existsSync(parsedDir)) {
  mkdirSync(parsedDir, { recursive: true })
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const writeOutput = ({ file, data }) => {
  const relativeFile = file.replace(/\\/g, '/').replace(/^parsed\//, '')
  const target = join(parsedDir, ...relativeFile.split('/'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(data), 'utf8')
  console.log(`  ✓ ${String(file).padEnd(34)} ${String(sizeOf(data)).padStart(6)} KB`)
}

// ---------- 1. 遗留表（已迁移为新风格模块；顺序敏感：pvp/宝箱来源先出，供 search 合并） ----------
console.log('\n── [legacy→new] pvp 奖励 ──')
const pvpOut = pvp.build()
pvpOut.files.forEach(writeOutput)

console.log('\n── [legacy→new] 场景宝箱（隐藏奖励） ──')
const hiddenOut = hiddenRewards.build()
hiddenOut.files.forEach(writeOutput)

console.log('\n── [legacy→new] 搜索索引 + 物品来源 + 类型文件 ──')
const searchOut = search.build({
  pvpSources: pvpOut.deps.pvpSources,
  hiddenSources: hiddenOut.deps.hiddenSources,
  hiddenList: hiddenOut.deps.hiddenList
})
searchOut.files.forEach(writeOutput)
writeFileSync(join(repoRoot, 'src/types/data-types.d.ts'), searchOut.typesContent, 'utf8')
console.log('  ✓ src/types/data-types.d.ts 已生成')

console.log('\n── [legacy→new] 装备词缀 ──')
affixes.build().files.forEach(writeOutput)

console.log('\n── [legacy→new] 兑换数据 ──')
exchange.build().files.forEach(writeOutput)

// ---------- 2. 页面级预解析（items 是 heroes/monsters 依赖表，必须先构建） ----------
const jobs = [
  { name: 'items', build: () => buildItemsFile(), dependsOnItems: false },
  { name: 'tasks', build: () => buildTasksFile(), dependsOnItems: false },
  { name: 'recipes', build: () => buildRecipesFile(), dependsOnItems: false },
  { name: 'achievements', build: () => buildAchievementsFile(), dependsOnItems: false },
  { name: 'events', build: () => buildEventsFile(), dependsOnItems: false },
  { name: 'pet-eggs', build: () => buildPetEggsFile(), dependsOnItems: false },
  { name: 'dungeons', build: () => buildDungeonsFiles(), dependsOnItems: false },
  { name: 'pets', build: () => buildPetsFile(), dependsOnItems: false },
  { name: 'heroes', build: () => buildHeroesFile(itemData), dependsOnItems: true },
  { name: 'monsters', build: () => buildMonstersFile(itemData), dependsOnItems: true }
]

console.log('\n── [page] 页面级预解析 ──')
let itemData = null
for (const job of jobs) {
  if (job.dependsOnItems && !itemData) {
    throw new Error(`[scripts/parse] ${job.name} 依赖 items 产物，但 items 尚未构建`)
  }
  const startedAt = Date.now()
  const output = job.build()
  if (job.name === 'dungeons') rmSync(join(parsedDir, 'dungeons'), { recursive: true, force: true })
  if (job.name === 'items') itemData = output.data
  const files = output.files || [output]
  files.forEach(writeOutput)
  console.log(`                              (${Date.now() - startedAt}ms)`)
}

console.log('\n✅ 数据预处理完成，全部产物在 public/data/parsed/，可直接进行 vite build 发布。')
