import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

import { isBlacklisted } from '../src/config/blacklist.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const publicDataDir = path.join(projectRoot, 'public', 'data')
const typesDir = path.join(projectRoot, 'src', 'types')

// 1. Raw Data Architecture - Roles
const rawRoles = []

// 2. Raw Data Architecture - Equips
const rawEquips = []

// 3. Raw Data Architecture - Pets
const rawPetData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'pet.json'), 'utf8'))
const petList = Object.values(rawPetData.datas || {}).map(p => ({
  id: p.monId || p.typeId,
  type: 'pet',
  name: p.name,
  quality: p.star >= 3 ? 5 : (p.star === 2 ? 4 : 3),
  category: '魔物蛋',
  categoryTags: ['魔物蛋'],
  subTag: `${Math.round(p.eggTime / 60)}分钟`,
  keywords: `${p.name} 魔物蛋 蛋孵化 ${p.des || ''}`.toLowerCase()
}))

// 4. Raw Data Architecture - Achievements
const rawAchData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'achievement.json'), 'utf8'))
const rawRewardData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'reward.json'), 'utf8'))
const rawItemData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'item.json'), 'utf8'))

const categoryMap = { adv: '冒险', exp: '探索', live: '生活', hide: '隐藏' }

// 代码层防剧透屏蔽黑名单 (依据成就标题 name 匹配)
const BLACKLIST_ACHIEVEMENT_NAMES = ['章节宝箱', '通关']

const achList = Object.values(rawAchData.achievement || {})
  .filter(a => {
    if (!a.name) return true
    return !BLACKLIST_ACHIEVEMENT_NAMES.some(kw => a.name.includes(kw))
  })
  .map(a => {
    const rObj = (rawRewardData.datas && rawRewardData.datas[a.reward]) || {}
    const rewardItemNames = []
    if (rObj.items && Array.isArray(rObj.items)) {
      rObj.items.forEach(it => {
        if (it.rules && Array.isArray(it.rules)) {
          it.rules.forEach(rule => {
            if (rule.typeId && rawItemData.datas && rawItemData.datas[rule.typeId]) {
              rewardItemNames.push(rawItemData.datas[rule.typeId].name)
            }
          })
        }
      })
    }
    return {
      id: a.typeId,
      type: 'achievement',
      name: a.name,
      quality: 3,
      category: categoryMap[a.category] || '成就',
      categoryTags: [categoryMap[a.category] || '成就', a.subTag || '隐藏'],
      subTag: a.subTag || '隐藏',
      keywords: `${a.name} 成就 ${categoryMap[a.category] || '成就'} ${a.subTag || '隐藏'} ${rewardItemNames.join(' ')} ${a.des || ''}`.toLowerCase()
    }
  })

// 5. Raw Data Architecture - Recipes & Game Setting Category Map
const rawMenuData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'menu.json'), 'utf8'))
const rawBuffData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'buff.json'), 'utf8'))
const rawGameSetting = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'gameSetting.json'), 'utf8'))

const categoryCodeMap = {}
function parseCategoryTypes(arr) {
  if (!arr || !Array.isArray(arr)) return
  arr.forEach(i => {
    if (i.type !== undefined && i.name) {
      categoryCodeMap[String(i.type)] = i.name
    }
    if (i.info) parseCategoryTypes(i.info)
  })
}

if (rawGameSetting.data && rawGameSetting.data.typeSetting && rawGameSetting.data.typeSetting.item_type) {
  parseCategoryTypes(rawGameSetting.data.typeSetting.item_type)
}

const recipeList = Object.values(rawMenuData.datas || {}).map(m => {
  const itemEntry = (rawItemData.datas && rawItemData.datas[m.typeId]) || {}
  const name = itemEntry.name || m.name || m.typeId
  const rawCats = itemEntry.category || []
  const categoryTags = rawCats
    .map(c => categoryCodeMap[String(c)] || String(c))
    .filter(t => t !== '消耗' && t !== '料理')
  const buffId = itemEntry.useActionPara2 ? itemEntry.useActionPara2.buff : null
  const bObj = buffId ? rawBuffData[buffId] : null
  const buffDes = bObj && bObj.buffDes ? bObj.buffDes.replace(/\{([^}]+)\}/g, '$1') : ''

  return {
    id: m.typeId,
    type: 'recipe',
    name,
    quality: m.level >= 3 ? 5 : (m.level === 2 ? 4 : 3),
    category: '料理',
    categoryTags,
    subTag: String(m.level || 1),
    keywords: `${name} 食谱 配方 料理 ${categoryTags.join(' ')} ${buffDes}`.toLowerCase()
  }
})

// 5. Build Search Index
  // Load fileMon.json and mon.json for monsters indexing
  let monList = []
  try {
    const monContent = fs.readFileSync(path.join(publicDataDir, 'mon.json'), 'utf8')
    const parsedMon = JSON.parse(monContent).datas || {}
    const fileMonContent = fs.readFileSync(path.join(publicDataDir, 'fileMon.json'), 'utf8')
    const parsedFileMon = JSON.parse(fileMonContent)
    const fileMonArr = parsedFileMon.monFile || parsedFileMon
    monList = fileMonArr.filter(m => !m.hide).map(m => {
      const baseMon = parsedMon[m.monTypeId] || {}
      const monName = m.name || baseMon.name || baseMon.monDes || m.monTypeId
      return {
        id: m.monTypeId,
        type: 'monster',
        name: monName,
        quality: baseMon.monRank || 3,
        category: '怪物',
        subTag: m.label || baseMon.label || '',
        categoryTags: ['怪物', m.label || baseMon.label || ''],
        keywords: `${monName} 怪物 ${m.label || baseMon.label || ''} ${m.text || ''}`.toLowerCase()
      }
    })
  } catch (e) {
    console.warn('Failed to load fileMon.json/mon.json for search indexing', e)
  }

  // Load item.json for items indexing
  let rawItems = []
  try {
    const itemContent = fs.readFileSync(path.join(publicDataDir, 'item.json'), 'utf8')
    rawItems = Object.values(JSON.parse(itemContent).datas || {})
  } catch (e) {
    console.warn('Failed to load item.json for search indexing', e)
  }

  const searchIndex = [
  ...rawRoles.map(r => ({
    id: r.id,
    type: 'role',
    name: r.name,
    quality: r.quality,
    category: r.class,
    subTag: r.element,
    keywords: `${r.name} ${r.class} ${r.element} ${r.desc} ${r.skillName}`.toLowerCase()
  })),
    ...rawEquips.map(e => ({
      id: e.id,
      type: 'equip',
      name: e.name,
      quality: e.quality,
      category: e.slot,
      subTag: e.mainStat,
      keywords: `${e.name} ${e.slot} ${e.mainStat} ${e.effect}`.toLowerCase()
    })),
    ...rawItems.map(i => {
      const categoryTags = (i.category || []).map(c => categoryCodeMap[String(c)] || String(c))
      return {
        id: i.typeId,
        type: 'item',
        name: i.name,
        quality: i.quality || 1,
        category: '物品',
        subTag: '',
        categoryTags,
        keywords: `${i.name} ${i.desc || ''} ${categoryTags.join(' ')}`.toLowerCase()
      }
    }),
  ...petList,
  ...achList,
  ...recipeList,
  ...monList
]

// 6. Build Item Sources Reverse Map
const itemSources = {}
const ensureSourceList = (id) => {
  if (!itemSources[id]) itemSources[id] = []
  return itemSources[id]
}

const getItemsFromReward = (rewardId) => {
  if (!rewardId) return []
  const reward = rawRewardData.datas?.[rewardId]
  if (!reward || !reward.items) return []
  const drops = []
  reward.items.forEach(group => {
    if (group.rules) {
      group.rules.forEach(rule => {
        if (rule.typeId && String(rule.typeId).startsWith('item_')) {
          drops.push({ id: rule.typeId })
        }
      })
    }
  })
  return drops
}

// 6.1 Process Monsters
try {
  const monContent = fs.readFileSync(path.join(publicDataDir, 'mon.json'), 'utf8')
  const parsedMon = JSON.parse(monContent).datas || {}
  monList.forEach(m => {
    const baseMon = parsedMon[m.id] || {}
    const drops = getItemsFromReward(baseMon.reward)
    drops.forEach(drop => {
      // Add deduplication logic inside
      const list = ensureSourceList(drop.id)
      if (!list.find(x => x.type === 'monster' && x.id === m.id)) {
        list.push({ type: 'monster', id: m.id, name: m.name, des: '怪物掉落' })
      }
    })
  })
} catch (e) {
  console.warn('Failed to parse monsters for sources', e)
}

// 6.2 Process Achievements
Object.values(rawAchData.achievement || {}).forEach(a => {
  if (BLACKLIST_ACHIEVEMENT_NAMES.some(kw => a?.name?.includes(kw))) return
  const drops = getItemsFromReward(a.reward)
  drops.forEach(drop => {
    const list = ensureSourceList(drop.id)
    if (!list.find(x => x.type === 'achievement' && x.id === a.typeId)) {
      list.push({ type: 'achievement', id: a.typeId, name: a.name, des: '成就奖励' })
    }
  })
})

// 6.3 Process Tasks
try {
  const taskContent = fs.readFileSync(path.join(publicDataDir, 'task.json'), 'utf8')
  const parsedTasks = Object.values(JSON.parse(taskContent).datas || {})
  parsedTasks.forEach(t => {
    const drops = getItemsFromReward(t.reward)
    drops.forEach(drop => {
      const list = ensureSourceList(drop.id)
      if (!list.find(x => x.type === 'task' && x.id === t.typeId)) {
        list.push({ type: 'task', id: t.typeId, name: t.name, des: '任务奖励' })
      }
    })
  })
} catch (e) {
  console.warn('Failed to parse tasks for sources', e)
}

// 6.4 Process Recipes
try {
  const matContent = fs.readFileSync(path.join(publicDataDir, 'menu.json'), 'utf8')
  const parsedMat = Object.values(JSON.parse(matContent).datas || {})
  parsedMat.forEach(r => {
    if (r.itemTypeId && String(r.itemTypeId).startsWith('item_')) {
      const list = ensureSourceList(r.itemTypeId)
      if (!list.find(x => x.type === 'recipe' && x.id === r.typeId)) {
        list.push({ type: 'recipe', id: r.typeId, name: r.name || r.itemTypeId, des: '配方制作' })
      }
    }
  })
} catch (e) {
  console.warn('Failed to parse recipes for sources', e)
}

// 6.5 Merge Parsed Rewards// 4b. Merge PVP Sources
try {
  const parsedPvpSourcesPath = path.join(publicDataDir, 'parsed', 'parsed-pvp-sources.json')
  if (fs.existsSync(parsedPvpSourcesPath)) {
    const pvpSources = JSON.parse(fs.readFileSync(parsedPvpSourcesPath, 'utf8'))
    Object.keys(pvpSources).forEach(itemId => {
      const list = ensureSourceList(itemId)
      pvpSources[itemId].forEach(src => {
        if (!list.find(x => x.type === src.type && x.id === src.id)) {
          list.push(src)
        }
      })
    })
  }
} catch (e) {
  console.warn('Failed to merge parsed-pvp-sources', e)
}

// 4c. Merge Hidden Sources (场景宝箱)
try {
  // First run the parser script
  execSync('node scripts/parse-hidden-rewards.js', { stdio: 'inherit' });

  const parsedHiddenSourcesPath = path.join(publicDataDir, 'parsed', 'parsed-hidden-sources.json')
  if (fs.existsSync(parsedHiddenSourcesPath)) {
    const hiddenSources = JSON.parse(fs.readFileSync(parsedHiddenSourcesPath, 'utf8'))
    Object.keys(hiddenSources).forEach(itemId => {
      const list = ensureSourceList(itemId)
      hiddenSources[itemId].forEach(src => {
        if (!list.find(x => x.type === src.type && x.id === src.id)) {
          list.push(src)
        }
      })
    })
  }
} catch (e) {
  console.warn('Failed to merge parsed-hidden-sources', e)
}

// Ensure directories exist
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true })
}
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true })
}

// Write Output JSON Files
const filteredSearchIndex = searchIndex.filter(item => !isBlacklisted(item))
fs.writeFileSync(path.join(publicDataDir, 'roles.json'), JSON.stringify(rawRoles, null, 2), 'utf8')
fs.writeFileSync(path.join(publicDataDir, 'equips.json'), JSON.stringify(rawEquips, null, 2), 'utf8')
fs.writeFileSync(path.join(publicDataDir, 'search-index.json'), JSON.stringify(filteredSearchIndex, null, 2), 'utf8')
fs.writeFileSync(path.join(publicDataDir, 'item-sources.json'), JSON.stringify(itemSources, null, 2), 'utf8')

// Generate TypeScript Definition File
const tsContent = `// Auto-generated TypeScript definitions by scripts/clean-data.js

export interface RoleData {
  id: string;
  name: string;
  quality: number;
  class: '战士' | '游侠' | '法师' | '圣职';
  element: '光' | '暗' | '火' | '水' | '风' | '地' | '冰' | '土';
  desc: string;
  skillName: string;
}

export interface EquipData {
  id: string;
  name: string;
  quality: number;
  slot: '武器' | '头部' | '衣服' | '鞋子' | '饰品';
  mainStat: string;
  effect: string;
  starEffects: string[];
}

export interface IndexData {
  id: string;
  type: 'role' | 'equip' | 'pet' | 'achievement' | 'recipe' | 'item' | 'monster';
  name: string;
  quality: number;
  category: string;
  subTag: string;
  keywords: string;
}
`;

fs.writeFileSync(path.join(typesDir, 'data-types.d.ts'), tsContent, 'utf8')

console.log('✅ Data processing pipeline complete:')
console.log(` - public/data/roles.json (${rawRoles.length} roles)`)
console.log(` - public/data/equips.json (${rawEquips.length} equips)`)
console.log(` - public/data/search-index.json (${searchIndex.length} index items)`)
console.log(` - src/types/data-types.d.ts generated successfully`)
