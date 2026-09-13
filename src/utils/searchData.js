/**
 * 搜索索引 + 物品来源 构建期纯函数：由全部原始表生成
 *   { searchIndex: search-index.json 内容, itemSources: item-sources.json 内容, typesContent }
 * 对应原 scripts/clean-data.js（等价迁移；不再生成无引用的 roles.json / equips.json）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）共用。
 */
import { isBlacklisted } from '../config/blacklist.js'
import {
  JOB_NAMES,
  ELEMENT_NAMES,
  TASK_TYPE_LABELS,
  getMapName,
  ITEM_CATEGORY_NAMES,
  resolveItemCategoryTags
} from './gameMappings.js'
import { buildOfficialExchangeIndex, getExchangeSourceMeta, isVisibleExchange } from './exchangeData.js'
import { isFurnitureCatalogEntry } from './furnitureData.js'
import { buildSupplementalItemSources } from './supplementalItemSources.js'
import { buildRemainingItemSources } from './remainingItemSources.js'

// 成就名防剧透屏蔽（与 clean-data 一致）
const BLACKLIST_ACHIEVEMENT_NAMES = ['章节宝箱', '通关']

// ---------- 任务搜索条目（与任务页同过滤：跳过 demo 与伙伴档案） ----------
function buildTaskSearchList(maps) {
  const taskJson = maps.taskJson || {}
  const list = []
  for (const t of Object.values(taskJson.datas || {})) {
    const cat = t.category || []
    const isDemo = cat.includes('demo') || cat.includes('demo支线') || String(t.typeId || '').startsWith('demo_')
    const isPartnerArchive = cat.length === 1 && cat[0] === '伙伴档案'
    if (isDemo || isPartnerArchive) continue
    const typeLabel = TASK_TYPE_LABELS[t.taskType] || '任务'
    const subLabel = cat[1] || ''
    list.push({
      id: t.typeId,
      type: 'task',
      name: t.name || t.typeId,
      quality: t.close ? 1 : 3,
      category: '任务',
      subTag: typeLabel,
      categoryTags: ['任务', typeLabel],
      keywords: `${t.name || ''} 任务 ${typeLabel} ${subLabel} ${t.des || ''} ${t.des2 || ''}`.toLowerCase()
    })
  }
  return list
}

// ---------- 事件/探索搜索条目 ----------
function buildEventSearchList(maps) {
  const eventMap = (maps.randomEventInfoJson && maps.randomEventInfoJson.datas) || maps.randomEventInfoJson || {}
  const areaData = (maps.randomEventAreaJson && maps.randomEventAreaJson.data) || {}
  const exploreData = (maps.exploreAreaJson && maps.exploreAreaJson.datas) || maps.exploreAreaJson || {}

  const evGroups = {}
  for (const groups of Object.values(areaData)) {
    for (const g of groups) {
      for (const ev of g.events || []) {
        if (!evGroups[ev.typeId]) evGroups[ev.typeId] = []
        if (!evGroups[ev.typeId].includes(g.group)) evGroups[ev.typeId].push(g.group)
      }
    }
  }
  const eventList = []
  for (const ev of Object.values(eventMap)) {
    if (!ev || !ev.typeId) continue
    const groups = evGroups[ev.typeId] || []
    const isRare = groups.includes('rare2')
    const label = isRare ? '稀有' : ((groups.includes('rare1') || groups.length) ? '普通' : '')
    eventList.push({
      id: ev.typeId,
      type: 'event',
      name: ev.name || ev.typeId,
      quality: isRare ? 3 : 1,
      category: '事件',
      subTag: label || '随机事件',
      categoryTags: ['事件', '随机事件', label],
      keywords: `${ev.name || ''} 事件 随机事件 ${label} ${ev.des || ''}`.toLowerCase()
    })
  }

  for (const [id, conf] of Object.entries(exploreData)) {
    if (!conf || !conf.name) continue
    const m = /^explore(\d+)_/.exec(id)
    const mapKey = m ? `c${m[1]}_map` : ''
    const mapName = getMapName(mapKey)
    eventList.push({
      id,
      type: 'explore',
      name: conf.name,
      quality: conf.quality || 1,
      category: '探索',
      subTag: mapName || '探索区域',
      categoryTags: ['事件', '探索区域', mapName],
      keywords: `${conf.name} 探索 事件 ${mapName} ${conf.eventDes || ''}`.toLowerCase()
    })
  }
  return eventList
}

// ---------- 兑换搜索条目 ----------
function buildExchangeSearchList(maps, officialExchangeIndex) {
  const exchangeMap = (maps.itemExchangeJson && maps.itemExchangeJson.itemExchange) || {}
  const list = []
  for (const [id, e] of Object.entries(exchangeMap)) {
    if (!isVisibleExchange(e, officialExchangeIndex)) continue
    const name = e.name || id
    const meta = getExchangeSourceMeta(e, officialExchangeIndex)
    list.push({
      id,
      type: 'exchange',
      name,
      quality: 3,
      category: '兑换',
      subTag: meta.categoryLabel,
      categoryTags: ['兑换', meta.categoryLabel, meta.subLabel],
      keywords: `${name} 兑换 ${e.des || ''} ${meta.categoryLabel} ${meta.subLabel}`.toLowerCase()
    })
  }
  return list
}

// ---------- 场景宝箱（隐藏）搜索条目 ----------
function buildHiddenSearchList(hiddenList = []) {
  return hiddenList.map(h => ({
    id: `${h.roomId || ''}:${h.collectName || ''}`,
    type: 'hidden',
    name: h.collectName || h.roomName || '',
    quality: 3,
    category: '隐藏',
    subTag: h.areaName || h.bigMapName || '',
    categoryTags: ['隐藏', '场景宝箱', h.areaName, h.bigMapName],
    keywords: `${h.collectName || ''} ${h.roomName || ''} ${h.areaName || ''} ${h.bigMapName || ''} 场景宝箱 隐藏`.toLowerCase()
  }))
}

// ---------- 家具搜索条目 ----------
function buildFurnitureSearchList(maps) {
  const furnitureMap = maps.homeItemJson?.furniture || maps.homeItemJson?.datas || maps.homeItemJson || {}
  const categoryNames = new Map()
  for (const main of maps.gameSettingJson?.data?.typeSetting?.homeItem_type || []) {
    categoryNames.set(String(main.type), main.name)
    for (const sub of main.info || []) categoryNames.set(String(sub.type), sub.name)
  }

  return Object.values(furnitureMap)
    .filter(isFurnitureCatalogEntry)
    .map(furniture => {
      const categoryIds = (furniture.objType || []).map(String)
      const mainName = categoryNames.get(categoryIds[0]) || categoryIds[0] || '家具'
      const subName = categoryNames.get(categoryIds[1]) || categoryIds[1] || ''
      const skinText = (furniture.skin || [])
        .flatMap(skin => [skin.name, skin.desc])
        .filter(Boolean)
        .join(' ')
      const sourceText = (furniture.category || []).join(' ')
      return {
        id: furniture.typeId,
        type: 'furniture',
        name: furniture.name || furniture.typeId,
        quality: Number(furniture.quality) || 1,
        category: mainName,
        subTag: subName,
        categoryTags: ['家具', mainName, subName].filter(Boolean),
        keywords: `${furniture.name || ''} 家具 家具图鉴 ${mainName} ${subName} ${sourceText} ${furniture.desc || ''} ${skinText}`.toLowerCase()
      }
    })
}

export function buildSearchData(maps) {
  const officialExchangeIndex = buildOfficialExchangeIndex({
    shopRes: maps.shopJson,
    generalRes: maps.generalJson,
    packDisplayRes: maps.packDisplayJson,
    activityListRes: maps.activityListJson
  })
  const {
    heroJson, itemJson, monJson, fileMonJson, petJson, achievementJson, rewardJson,
    menuJson, buffJson, gameSettingJson,
    randomEventInfoJson, randomEventAreaJson, exploreAreaJson, itemExchangeJson,
    pvpSources = {}, hiddenSources = {}, hiddenList = [], dungeonSources = {}
  } = maps

  // ---------- 1. Roles ----------
  const heroDatas = heroJson?.datas || {}
  const rawRoles = Object.values(heroDatas)
    .filter(h => h.hide !== true)
    .map(h => ({
      id: h.typeId,
      type: 'role',
      name: h.name,
      quality: h.rare || 3,
      class: JOB_NAMES[h.job] || '未知职业',
      element: ELEMENT_NAMES[h.element] || '无',
      desc: h.name2 || h.des || '',
      skillName: h.normalAttack || ''
    }))

  // ---------- 2. 角色碎片映射 ----------
  const roleNameById = {}
  for (const [id, h] of Object.entries(heroDatas)) {
    if (h && h.name) roleNameById[h.typeId || id] = h.name
  }
  const HERO_FRAGMENT_SPECIALS = {
    item_59002_1: '米托拉', item_59005: '茜塔', item_59015: '芭杜尔'
  }
  const getFragmentHeroName = (item) => {
    const name = item.name || ''
    if (HERO_FRAGMENT_SPECIALS[item.typeId]) return HERO_FRAGMENT_SPECIALS[item.typeId]
    const m = /^(\d{3})碎片/.exec(name)
    if (m) return roleNameById[`hero_${m[1]}`] || ''
    return ''
  }

  // ---------- 3. Pets and Pet Eggs ----------
  const rawPetData = petJson || {}
  const petList = []
  Object.values(rawPetData.datas || {}).forEach(p => {
    const star = p.star || 1
    const starDisplay = star + 2
    petList.push({
      id: p.monId || p.typeId,
      type: 'pet',
      name: p.name,
      quality: p.star >= 3 ? 5 : (p.star === 2 ? 4 : 3),
      category: '魔物',
      categoryTags: ['魔物'],
      subTag: `${starDisplay}星`,
      keywords: `${p.name} 魔物 魔物图鉴 ${p.des || ''}`.toLowerCase()
    })
    petList.push({
      id: p.monId || p.typeId,
      type: 'pet_egg',
      name: `${p.name}的蛋`,
      quality: p.star >= 3 ? 5 : (p.star === 2 ? 4 : 3),
      category: '魔物蛋',
      categoryTags: ['魔物蛋'],
      subTag: `${Math.round(p.eggTime / 60)}分钟`,
      keywords: `${p.name}的蛋 魔物蛋 蛋孵化 培育室 魔物收益 ${p.des || ''}`.toLowerCase()
    })
  })

  // ---------- 4. Achievements ----------
  const rawAchData = achievementJson || {}
  const rawRewardData = rewardJson || {}
  const rawItemData = itemJson || {}
  const categoryMap = { adv: '冒险', exp: '探索', live: '生活', hide: '隐藏' }
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

  // ---------- 5. Recipes ----------
  const rawMenuData = menuJson || {}
  const rawBuffData = buffJson || {}
  const rawGameSetting = gameSettingJson || {}
  const categoryCodeMap = { ...ITEM_CATEGORY_NAMES }
  const parseCategoryTypes = (arr) => {
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
    const subCategoryTags = rawCats
      .map(c => categoryCodeMap[String(c)] || String(c))
      .filter(t => t !== '消耗' && t !== '料理' && !/^\d+$/.test(t))
    const buffId = itemEntry.useActionPara2 ? itemEntry.useActionPara2.buff : null
    const bObj = buffId ? rawBuffData[buffId] : null
    const buffDes = bObj && bObj.buffDes ? bObj.buffDes.replace(/\{([^}]+)\}/g, '$1') : ''
    const starLabel = `${m.level || 1}星`
    return {
      id: m.typeId,
      type: 'recipe',
      name,
      quality: m.level >= 3 ? 5 : (m.level === 2 ? 4 : 3),
      category: '料理',
      categoryTags: ['料理', starLabel, ...subCategoryTags],
      subTag: starLabel,
      keywords: `${name} 食谱 配方 料理 ${starLabel} ${subCategoryTags.join(' ')} ${buffDes}`.toLowerCase()
    }
  })

  // ---------- 6. Monsters（搜索索引） ----------
  let monList = []
  const parsedMon = monJson?.datas || {}
  const parsedFileMon = fileMonJson || {}
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

  // ---------- 7. Items（搜索索引） ----------
  const rawItems = Object.values(rawItemData.datas || {})

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
    ...rawItems.filter(i => !i.typeId || !i.typeId.startsWith('show_')).flatMap(i => {
      const categoryTags = resolveItemCategoryTags(i.category)
      const isEquip = i.category && String(i.category[0]) === '4'
      const fragHero = getFragmentHeroName(i)
      const fragSuffix = (i.name || '').match(/x\d+$/)?.[0] || ''
      const fragDisplayName = fragHero ? (i.name.includes(fragHero) ? i.name : `${fragHero}碎片${fragSuffix}`) : i.name
      const fragKeywords = fragHero ? ` ${fragDisplayName} ${fragHero}碎片` : ''

      if (isEquip) {
        const slotName = categoryCodeMap[String(i.category[1])] || '装备'
        const rankText = i.equip && i.equip.equipLevel ? `${i.equip.equipLevel}阶` : '1阶'
        return [
          {
            id: i.typeId,
            type: 'item',
            name: i.name,
            quality: i.quality || 1,
            category: '物品',
            subTag: '',
            categoryTags: ['装备', slotName],
            keywords: `${i.name} 物品 装备 ${slotName} ${i.desc || ''}`.toLowerCase()
          },
          {
            id: i.typeId,
            type: 'equip',
            name: i.name,
            quality: i.quality || 1,
            category: '装备',
            subTag: `${slotName} · ${rankText}`,
            categoryTags: [slotName, rankText],
            keywords: `${i.name} 装备 ${slotName} ${rankText} ${i.desc || ''}`.toLowerCase()
          }
        ]
      }
      return [{
        id: i.typeId,
        type: 'item',
        name: fragDisplayName,
        quality: i.quality || 1,
        category: '物品',
        subTag: categoryTags[1] || categoryTags[0] || '',
        categoryTags,
        keywords: `${i.name}${fragKeywords} 物品 ${i.desc || ''} ${categoryTags.join(' ')}`.toLowerCase()
      }]
    }),
    ...petList,
    ...achList,
    ...recipeList,
    ...monList,
    ...buildTaskSearchList(maps),
    ...buildEventSearchList(maps),
    ...buildExchangeSearchList(maps, officialExchangeIndex),
    ...buildHiddenSearchList(hiddenList),
    ...buildFurnitureSearchList(maps)
  ]

  // ---------- 8. Item Sources ----------
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
          const typeId = String(rule.typeId || '')
          // 奖励不只包含 item_*：皮肤、宠物蛋等也会作为物品进入 item.json。
          // 以物品表实际存在为准，避免兑换来源漏掉 skin005a 这类正式道具。
          if (typeId && rawItemData.datas?.[typeId]) drops.push({ id: typeId })
        })
      }
    })
    return drops
  }

  monList.forEach(m => {
    const baseMon = parsedMon[m.id] || {}
    const drops = getItemsFromReward(baseMon.reward)
    drops.forEach(drop => {
      const list = ensureSourceList(drop.id)
      if (!list.find(x => x.type === 'monster' && x.id === m.id)) {
        list.push({ type: 'monster', id: m.id, name: m.name, des: '怪物掉落' })
      }
    })
  })

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

  const taskJson = maps.taskJson || {}
  const parsedTasks = Object.values(taskJson.datas || {})
  parsedTasks.forEach(t => {
    const cat = t.category || []
    const isDemo = cat.includes('demo') || cat.includes('demo支线') || String(t.typeId || '').startsWith('demo_')
    const isPartnerArchive = cat.length === 1 && cat[0] === '伙伴档案'
    if (isDemo || isPartnerArchive) return

    const dropIds = new Set()
    getItemsFromReward(t.reward).forEach(d => dropIds.add(d.id))
    ;(t.steps || []).forEach(s => {
      getItemsFromReward(s.stepReward).forEach(d => dropIds.add(d.id))
    })
    dropIds.forEach(dropId => {
      const list = ensureSourceList(dropId)
      if (!list.find(x => x.type === 'task' && x.id === t.typeId)) {
        list.push({ type: 'task', id: t.typeId, name: t.name, des: '任务奖励' })
      }
    })
  })

  Object.values(rawMenuData.datas || {}).forEach(r => {
    if (r.itemTypeId && String(r.itemTypeId).startsWith('item_')) {
      const list = ensureSourceList(r.itemTypeId)
      if (!list.find(x => x.type === 'recipe' && x.id === r.typeId)) {
        list.push({ type: 'recipe', id: r.typeId, name: r.name || r.itemTypeId, des: '配方制作' })
      }
    }
  })

  // 兑换奖励来源：与兑换页共用可见性、一级分类和地图子分类规则。
  const rawExchangeData = maps.itemExchangeJson?.itemExchange || {}
  Object.values(rawExchangeData).forEach(exchange => {
    if (!isVisibleExchange(exchange, officialExchangeIndex)) return
    const meta = getExchangeSourceMeta(exchange, officialExchangeIndex)
    const drops = getItemsFromReward(exchange.reward)
    drops.forEach(drop => {
      const list = ensureSourceList(drop.id)
      const itemName = rawItemData.datas?.[drop.id]?.name || drop.id
      if (!list.find(x => x.type === 'exchange' && x.id === exchange.id)) {
        list.push({
          type: 'exchange',
          id: exchange.id,
          name: `${meta.categoryLabel} · ${meta.subLabel}`,
          des: `兑换${itemName}`,
          category: meta.category,
          sub: meta.sub
        })
      }
    })
  })

  Object.keys(pvpSources).forEach(itemId => {
    const list = ensureSourceList(itemId)
    ;(pvpSources[itemId] || []).forEach(src => {
      if (!list.find(x => x.type === src.type && x.id === src.id)) {
        list.push(src)
      }
    })
  })

  Object.keys(hiddenSources).forEach(itemId => {
    const list = ensureSourceList(itemId)
    ;(hiddenSources[itemId] || []).forEach(src => {
      if (!list.find(x => x.type === src.type && x.id === src.id)) {
        list.push(src)
      }
    })
  })

  Object.keys(dungeonSources).forEach(itemId => {
    const list = ensureSourceList(itemId)
    ;(dungeonSources[itemId] || []).forEach(src => {
      if (!list.find(x => x.type === src.type && x.id === src.id && x.des === src.des)) {
        list.push(src)
      }
    })
  })

  for (const [itemId, sources] of Object.entries(buildSupplementalItemSources(maps))) {
    ensureSourceList(itemId).push(...sources)
  }

  for (const [itemId, sources] of Object.entries(maps.runeSources || {})) {
    const synthesisIds = new Set(sources.filter(source => source.type === 'runeSynthesis').map(source => source.id))
    itemSources[itemId] = ensureSourceList(itemId).filter(source =>
      !(source.type === 'exchange' && source.category === 'gem' && synthesisIds.has(source.id)))
    itemSources[itemId].push(...sources)
  }

  for (const [itemId, sources] of Object.entries(buildRemainingItemSources(maps, itemSources))) {
    ensureSourceList(itemId).push(...sources)
  }

  // ---------- 9. 黑名单过滤 ----------
  const filteredSearchIndex = searchIndex.filter(item => !isBlacklisted(item))

  // ---------- 10. TypeScript 类型定义（原 data-types.d.ts） ----------
  const typesContent = `// Auto-generated TypeScript definitions by scripts/parse/search.mjs

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
  type: 'role' | 'equip' | 'pet' | 'pet_egg' | 'achievement' | 'recipe' | 'item' | 'furniture' | 'monster' | 'task' | 'event' | 'explore' | 'exchange' | 'hidden';
  name: string;
  quality: number;
  category: string;
  subTag: string;
  keywords: string;
}
`

  return { searchIndex: filteredSearchIndex, itemSources, typesContent }
}
