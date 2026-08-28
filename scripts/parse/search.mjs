/**
 * 搜索索引 + 物品来源 预解析（新风格，替代原 scripts/clean-data.js）
 * 产物：parsed/search-index.json（全局搜索，覆盖 角色/物品/装备/魔物/魔物蛋/成就/料理/怪物/任务/事件/探索/兑换/隐藏宝箱）、
 *       parsed/item-sources.json（物品来源）、src/types/data-types.d.ts
 * 依赖：pvp/hidden 来源表 + 隐藏宝箱列表（由 pvp.mjs / hidden-rewards.mjs 先行构建后传入；
 *       独立运行（node scripts/parse/search.mjs）时从磁盘已有产物读取）
 */
import { buildSearchData } from '../../src/utils/searchData.js'
import { readJson, parsedDir } from './shared.mjs'

export function build(deps = {}) {
  const { pvpSources = {}, hiddenSources = {}, hiddenList = [] } = deps
  const result = buildSearchData({
    heroJson: readJson('hero/hero.json'),
    itemJson: readJson('item.json'),
    monJson: readJson('mon.json'),
    fileMonJson: readJson('fileMon.json'),
    petJson: readJson('pet.json'),
    achievementJson: readJson('achievement.json'),
    rewardJson: readJson('reward.json'),
    menuJson: readJson('menu.json'),
    buffJson: readJson('buff.json'),
    gameSettingJson: readJson('gameSetting.json'),
    taskJson: readJson('task.json'),
    randomEventInfoJson: readJson('randomEventInfo.json'),
    randomEventAreaJson: readJson('randomEventArea.json'),
    exploreAreaJson: readJson('exploreArea.json'),
    itemExchangeJson: readJson('itemExchange.json'),
    pvpSources,
    hiddenSources,
    hiddenList
  })
  return {
    files: [
      { file: 'parsed/search-index.json', data: result.searchIndex },
      { file: 'parsed/item-sources.json', data: result.itemSources }
    ],
    typesContent: result.typesContent
  }
}

// ---------- 独立运行：npm run search:update（只重建搜索索引/来源/类型文件） ----------
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const readParsed = (file, fallback) => {
    const p = join(parsedDir, file)
    if (!existsSync(p)) return fallback
    try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return fallback }
  }
  const out = build({
    pvpSources: readParsed('parsed-pvp-sources.json', {}),
    hiddenSources: readParsed('parsed-hidden-sources.json', {}),
    hiddenList: readParsed('parsed-hidden.json', [])
  })
  if (!existsSync(parsedDir)) mkdirSync(parsedDir, { recursive: true })
  for (const { file, data } of out.files) {
    writeFileSync(join(parsedDir, file.replace('parsed/', '')), JSON.stringify(data), 'utf8')
    console.log(`  ✓ ${file}（${Math.round(Buffer.byteLength(JSON.stringify(data)) / 1024)}KB）`)
  }
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
  writeFileSync(join(repoRoot, 'src/types/data-types.d.ts'), out.typesContent, 'utf8')
  console.log('✅ 全局搜索索引已更新（覆盖 角色/物品/装备/魔物/魔物蛋/成就/料理/怪物/任务/事件/探索/兑换/隐藏宝箱）')
}
