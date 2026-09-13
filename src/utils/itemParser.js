import { fetchWithFallback } from './request.js'
import { createCachedLoader } from './resourceClient.js'
import { buildFullCategoryTree, getCategoryName, translateStatName } from './gameMappings.js'
import { resolveHomeItemUnlocks } from './furnitureData.js'
import { buildRuneEffect } from './runeData.js'
import { parseItemAcquisition, parseEquipmentPool, parseRewardGroups } from './acquisitionRules.js'

// 缓存数据，避免重复请求
let cachedItems = null
let cachedCategoryTree = null
let lanDict = null
let cachedAvatars = null
let cachedRewards = null
let cachedEquipEnchants = null
let cachedSkillTriggers = null
let cachedEquipGroups = null
let cachedEquipSuits = null
let cachedItemAffixes = null
let cachedEquipGlobalConfig = null
let cachedEquipEnhanceConfig = null

const EQUIP_ENHANCE_ATTRS = new Set(['phyAtk', 'magicAtk', 'phyDef', 'magicDef', 'maxHp'])
const EQUIP_ENHANCE_ATTR_ORDER = new Map(['phyAtk', 'magicAtk', 'phyDef', 'magicDef', 'maxHp'].map((key, index) => [key, index]))

/**
 * 物品列表默认排序：分类逐级升序，同分类内品质降序，再按 ID / 名称兜底。
 * 物品图鉴与装备图鉴必须复用，避免两个入口的装备顺序不一致。
 */
export function compareItemsByCategoryQuality(a, b) {
  for (let index = 0; index < 3; index++) {
    const categoryA = Number(a?.category?.[index] || 0)
    const categoryB = Number(b?.category?.[index] || 0)
    if (categoryA !== categoryB) return categoryA - categoryB
  }

  const qualityDiff = Number(b?.quality || 0) - Number(a?.quality || 0)
  if (qualityDiff) return qualityDiff

  const idDiff = String(a?.typeId || '').localeCompare(String(b?.typeId || ''))
  if (idDiff) return idDiff

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-Hans-CN')
}

export function roundToEven(value) {
  const lower = Math.floor(value)
  const fraction = value - lower
  if (Math.abs(fraction - 0.5) < 1e-9) {
    return lower % 2 === 0 ? lower : lower + 1
  }
  return Math.round(value)
}

/**
 * 解析锻造台真实打造方案。装备打造是随机池：先按 exchangeTeam 的品阶开放，
 * 再从 itemExchangeRandom 的奖励池生成 equip/equipGroup，材料只取 consume 表。
 */
export function buildSmithingData({ itemExchangeRandomRes = {}, exchangeTeamRes = {}, consumeRes = {}, rewardRes = {}, equipGroupRes = {}, itemRes = {} } = {}) {
  const randomDatas = itemExchangeRandomRes?.datas || {}
  const ruleTeams = itemExchangeRandomRes?.ruleTeam || {}
  const consumeDatas = consumeRes?.datas || {}
  const rewards = rewardRes?.datas || {}
  const qualityGroups = equipGroupRes?.qualityGroups || {}
  const rawItems = itemRes?.datas || itemRes || {}
  const blacksmith = Array.isArray(exchangeTeamRes?.blacksmith) ? exchangeTeamRes.blacksmith : []

  const teamLevels = new Map()
  blacksmith.forEach(team => (team.randomTeamList || []).forEach(id => {
    teamLevels.set(id, Number(team.equipLevel) || 0)
  }))
  const result = new Map()

  for (const exchange of Object.values(randomDatas)) {
    const equipLevel = teamLevels.get(exchange.team)
    if (!equipLevel || !exchange.consume) continue
    const consume = consumeDatas[exchange.consume]
    const materials = (consume?.items || []).map(material => {
      const target = rawItems[material.typeId] || {}
      return {
        typeId: material.typeId,
        name: target.name || material.typeId,
        img: target.img ? `/images/Common_ItemIcon/${target.img}.png` : '',
        quality: Number(target.quality) || 1,
        num: Number(material.num) || 0
      }
    }).filter(material => material.num > 0)
    if (!materials.length) continue

    const ruleTeam = ruleTeams[exchange.ruleTeamId] || []
    const totalChance = ruleTeam.reduce((sum, rule) => sum + (Number(rule.chance) || 0), 0)
    const qualityChances = Object.entries(exchange.reward || {}).map(([quality, rewardId]) => {
      const chanceRule = ruleTeam.find(rule => String(rule.value) === String(quality))
      return { quality: Number(quality), chance: totalChance ? (Number(chanceRule?.chance) || 0) / totalChance : 0, rewardId }
    }).filter(entry => entry.chance > 0)

    const targets = new Map()
    for (const { quality, rewardId } of qualityChances) {
      for (const group of parseRewardGroups(rewards[rewardId], { items: rawItems, equipGroups: equipGroupRes })) {
        for (const rule of group.rules || []) {
          if (rule.actualProb === 0) continue
          if (rule.mode === 'equip' && rule.typeId) {
            const qualities = targets.get(rule.typeId) || new Set()
            qualities.add(String(rewardId))
            targets.set(rule.typeId, qualities)
          }
          if (rule.mode === 'equipGroup' && rule.equipTypeGroup) {
            const groupQualities = qualityGroups[rule.qualityGroup] || []
            if (rule.qualityGroup && !groupQualities.some(entry => Number(entry.quality) === quality)) continue
            for (const entry of rule.candidates || []) {
              if (entry.typeId && entry.prob !== 0) {
                const qualities = targets.get(entry.typeId) || new Set()
                qualities.add(String(rewardId))
                targets.set(entry.typeId, qualities)
              }
            }
          }
        }
      }
    }

    for (const [typeId, rewardIds] of targets) {
      const target = rawItems[typeId]
      if (!target?.equip) continue
      const existing = result.get(typeId) || []
      const targetQualityChances = qualityChances.filter(entry => rewardIds.has(String(entry.rewardId)))
      existing.push({
        exchangeId: exchange.typeId,
        facilityId: 'sysBlacksmith',
        facilityName: '锻造台',
        equipLevel,
        position: Number(target.equip.position) || 0,
        materials,
        qualityChances: targetQualityChances,
        outputMode: targetQualityChances.some(({ rewardId }) => (rewards[rewardId]?.items || []).some(group => (group.rules || []).some(rule => rule.mode === 'equip'))) ? 'equip' : 'equipGroup'
      })
      result.set(typeId, existing)
    }
  }

  return Object.fromEntries([...result].map(([typeId, recipes]) => [typeId, recipes]))
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const parts = []
  if (days) parts.push(`${days}天`)
  if (hours) parts.push(`${hours}小时`)
  if (minutes) parts.push(`${minutes}分钟`)
  if (secs || parts.length === 0) parts.push(`${secs}秒`)
  return parts.join('')
}

function getPrimaryHarvest(rewardId, rewards, rawItems) {
  const reward = rewards[rewardId]
  if (!reward) return null

  for (const group of reward.items || []) {
    if (Number(group.rate ?? 1) < 1) continue
    for (const rule of group.rules || []) {
      if (rule.mode !== 'item' || Number(rule.chance ?? 1) < 1 || !rule.typeId) continue
      const min = Number(rule.min) || 0
      const max = Number(rule.max) || min
      return {
        typeId: rule.typeId,
        name: rawItems[rule.typeId]?.name || rule.typeId,
        min,
        max
      }
    }
  }

  return null
}

/**
 * 构建期纯函数：由原始 JSON 响应对象生成物品/装备核心数据。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildItemData(maps) {
  const {
    itemRes, settingRes, lanRes, avatarRes, rewardRes,
    enchantRes, triggerRes, equipGroupRes, equipSuitRes, itemAffixesRes, equipGlobalRes, homeLevelRes,
    heroRes, heroStarRes, skinRes = {}, plantRes = {}, petRes = {}, campResearchRes = {}, homeItemRes = {},
    itemExchangeRandomRes = {}, exchangeTeamRes = {}, consumeRes = {}
  } = maps

  // 1. 解析字典 lan.json
  const lanDict = {}
  if (lanRes && lanRes.data) {
    lanRes.data.forEach(item => {
      lanDict[item.name] = item.desc_cn || item.desc_en || item.name
    })
  }

  // 1.5 缓存角色和奖励字典
  const avatars = avatarRes?.datas || []
  const rewards = rewardRes?.datas || {}
  const equipEnchants = enchantRes?.datas || {}
  const skillTriggers = triggerRes || {}
  const equipGroups = equipGroupRes?.equipGroups || {}
  const equipSuits = equipSuitRes || {}
  const itemAffixes = itemAffixesRes || {}
  const equipGlobalConfig = equipGlobalRes || {}
  const equipEnhanceConfig = buildEquipEnhanceConfig(equipGlobalConfig, homeLevelRes)
  const heroes = heroRes?.datas || heroRes || {}
  const heroStarLevels = heroStarRes?.heroStarLevel || {}
  const skins = skinRes?.datas || skinRes || {}
  const plants = plantRes?.plant || {}
  const seeds = plantRes?.seed || {}
  const pets = petRes?.datas || petRes || {}
  const campResearch = campResearchRes?.datas || campResearchRes || {}

  const poisonCaps = [...new Set(Object.values(heroes)
    .map(hero => Number(hero?.unitData?.poisonMax))
    .filter(value => value > 0))]
  const poisonCap = poisonCaps.length === 1 ? poisonCaps[0] : 100
  const potionResearch = campResearch.potionPoisonReduce
  const potionResearchLevel = potionResearch?.level?.find(level =>
    Number(level?.actionPara?.potionPoisonReduce) > 0
  )
  const potionPoisonReduction = Number(potionResearchLevel?.actionPara?.potionPoisonReduce) || 0

  // 2. 解析分类树 gameSetting.json -> typeSetting.item_type（完整补全中类/小类）
  const rawCategoryTree = settingRes?.data?.typeSetting?.item_type || []
  const categoryTree = buildFullCategoryTree(rawCategoryTree)

  // 3. 解析物品列表并处理碎片名称
  const rawItems = itemRes.datas || {}
  const items = Object.values(rawItems)
  const smithingData = buildSmithingData({ itemExchangeRandomRes, exchangeTeamRes, consumeRes, rewardRes, equipGroupRes, itemRes })
  const originalNameFragmentIds = new Set(['item_59001', 'item_5900101', 'item_5900102', 'item_5900103'])

  items.forEach(item => {
    if (smithingData[item.typeId]) item.smithing = { facilityId: 'sysBlacksmith', facilityName: '锻造台', recipes: smithingData[item.typeId] }
    item.homeItemUnlocks = resolveHomeItemUnlocks(item, homeItemRes)
    const category = item.category || []
    if (Number(category[0]) === 3 && Number(category[1]) === 31) {
      const toxicity = Number(item.use2Info?.poison) || 0
      item.potionInfo = {
        toxicity,
        toxicityCap: poisonCap,
        remainingFromZero: Math.max(0, poisonCap - toxicity),
        researchName: potionResearch?.name || '',
        researchReduction: potionPoisonReduction,
        toxicityWithResearch: Math.trunc(toxicity * Math.max(0, 1 - potionPoisonReduction))
      }
    }

    const seedTypeId = seeds[item.typeId]?.[0]?.type
    const plant = seedTypeId ? plants[seedTypeId] : null
    if (plant) {
      const harvest = getPrimaryHarvest(plant.reward, rewards, rawItems)
      const researchName = campResearch[plant.research?.id]?.name || ''
      const researchHarvests = (plant.research?.levelReward || [])
        .map(level => ({
          level: Number(level.level) || 0,
          ...getPrimaryHarvest(level.reward, rewards, rawItems)
        }))
        .filter(level => level.typeId && (
          !harvest || level.typeId !== harvest.typeId || level.min !== harvest.min || level.max !== harvest.max
        ))

      item.seedInfo = {
        growMinutes: Number(plant.time) || 0,
        formattedGrowTime: formatDuration((Number(plant.time) || 0) * 60),
        harvest,
        researchName,
        researchHarvests
      }
    }

    if (Number(category[0]) === 6 && pets[item.typeId]) {
      const pet = pets[item.typeId]
      item.petEggInfo = {
        petName: pet.name || item.name,
        eggTime: Number(pet.eggTime) || 0,
        formattedEggTime: formatDuration(pet.eggTime),
        sellPrice: Number(pet.sellPrice) || 0,
        feedExp: Number(pet.exp) || 0
      }
    }

    if (item.useActionPara && item.useActionPara.heros && item.useActionPara.heros.length > 0) {
      const heroId = item.useActionPara.heros[0].heroTypeId
      const avatar = avatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
      const isHeroFragment = !!item.name?.includes('碎片')
      if (avatar && !isHeroFragment) {
        item.heroUnlock = {
          heroTypeId: heroId,
          heroName: avatar.name,
          heroIcon: avatar.img
        }
      }
      if (avatar && isHeroFragment && !originalNameFragmentIds.has(item.typeId)) {
        item.name = `${avatar.name}碎片`
        item.desc = item.name
      }
      const hero = heroes[heroId]
      const stageCosts = hero ? heroStarLevels[String(hero.rare)] || [] : []
      if (isHeroFragment && stageCosts.length) {
        const stages = stageCosts.map((costs, index) => ({
          stage: index + 1,
          costs: costs.map(Number),
          total: costs.reduce((sum, cost) => sum + Number(cost || 0), 0)
        }))
        item.heroStarUsage = {
          heroTypeId: heroId,
          heroName: avatar?.name || hero.name || heroId,
          rarity: Number(hero.rare || 0),
          stages,
          total: stages.reduce((sum, stage) => sum + stage.total, 0)
        }
      }
    }

    const skinTypeId = item.useActionPara?.unlockHeroSkin?.skinTypeId
    const skin = skinTypeId ? skins[skinTypeId] : null
    if (skin?.show && skin.heroTypeId && skin.name && skin.img) {
      const avatar = avatars?.find(entry => entry.typeId === skin.heroTypeId || entry.heroTypeId === skin.heroTypeId)
      item.skinUnlock = {
        skinTypeId,
        skinName: skin.name,
        heroTypeId: skin.heroTypeId,
        heroName: avatar?.name || heroes[skin.heroTypeId]?.name || skin.heroTypeId,
        icon: skin.icon || '',
        img: skin.img,
        modelImage: maps.skinModelImages?.[skinTypeId] || '',
        quality: Number(skin.quality) || 0,
        attributes: Object.entries(skin.attrAdd || {}).map(([key, value]) => ({
          key,
          baseValue: Number(value?.baseValue) || 0,
          percent: Number(value?.percent) || 0
        })).filter(attribute => attribute.baseValue || attribute.percent)
      }
    }
  })

  // Resolve after item names/icons have been enriched, once at build time.
  const acquisitionContext = {
    items: rawItems, rewards, consumes: consumeRes, equipGroups: equipGroupRes,
    getItemImageUrl: item => getItemImageUrl(item, avatars)
  }
  for (const item of items) {
    const acquisition = parseItemAcquisition(item, acquisitionContext)
    if (acquisition) item.acquisition = acquisition
  }

  return {
    items,
    categoryTree,
    lanDict,
    avatars,
    rewards,
    equipEnchants,
    skillTriggers,
    equipGroups,
    equipSuits,
    itemAffixes,
    equipGlobalConfig,
    equipEnhanceConfig
  }
}

function setItemCache(data) {
  cachedItems = data.items
  cachedCategoryTree = data.categoryTree
  lanDict = data.lanDict
  cachedAvatars = data.avatars
  cachedRewards = data.rewards
  cachedEquipEnchants = data.equipEnchants
  cachedSkillTriggers = data.skillTriggers
  cachedEquipGroups = data.equipGroups
  cachedEquipSuits = data.equipSuits
  cachedItemAffixes = data.itemAffixes
  cachedEquipGlobalConfig = data.equipGlobalConfig || null
  cachedEquipEnhanceConfig = data.equipEnhanceConfig || buildEquipEnhanceConfig(data.equipGlobalConfig)
}

/**
 * 统一加载构建期预解析的核心数据。
 */
export const fetchItemData = createCachedLoader(async () => {
  if (cachedItems && cachedCategoryTree) {
    return {
      items: cachedItems,
      categoryTree: cachedCategoryTree,
      lanDict,
      avatars: cachedAvatars,
      rewards: cachedRewards,
      equipEnchants: cachedEquipEnchants,
      skillTriggers: cachedSkillTriggers,
      equipGroups: cachedEquipGroups,
      equipSuits: cachedEquipSuits,
      itemAffixes: cachedItemAffixes,
      equipGlobalConfig: cachedEquipGlobalConfig,
      equipEnhanceConfig: cachedEquipEnhanceConfig
    }
  }

  const parsed = await fetchWithFallback('data/parsed/items.json')
  setItemCache(parsed)
  return parsed
})

/**
 * 将职业索引数组转换为中文名
 * @param {number[]} jobIndices 
 */
// translateJob 已删除：统一使用 translateJobArray（字符串返回版无调用方，死代码）。
export function translateJobArray(jobIndices) {
  if (!jobIndices || jobIndices.length === 0) return []
  const jobString = lanDict?.['hero_job']
  if (!jobString) return jobIndices 
  
  const jobs = jobString.split(',')
  return jobIndices.map(idx => jobs[idx] || idx)
}

/**
 * 翻译战斗属性Key
 * @param {string} attrKey 
 */
export function translateAttr(attrKey) {
  const normalizedKey = attrKey === 'cirtDam' ? 'critDam' : attrKey
  return lanDict?.[normalizedKey] || translateStatName(attrKey)
}

/**
 * 解析分类描述名称
 * @param {number[]} categoryArray [1, 13, 134]
 * @param {object[]} categoryTree 
 */
export function translateCategory(categoryArray, categoryTree) {
  if (!categoryArray || !categoryArray.length) return ''
  let currentTree = categoryTree || []
  const names = []
  
  for (let i = 0; i < categoryArray.length; i++) {
    const targetType = String(categoryArray[i])
    const found = currentTree ? currentTree.find(node => String(node.type) === targetType) : null
    if (found) {
      names.push(found.name)
      currentTree = found.info
    } else {
      const fallbackName = getCategoryName(targetType)
      if (fallbackName && fallbackName !== targetType) {
        names.push(fallbackName)
      }
      currentTree = null
    }
  }
  return names.join(' > ')
}

/**
 * 解析使用效果 (解锁皮肤/角色)
 * @param {object} item 
 */
export function parseItemUnlocks(item) {
  if (!item || !item.useActionPara) return null

  // 家具制作图/皮肤图按 useActionPara.homeItems.typeId 的配置关系展示。
  if (item.useAction === 'unlockHomeItem' || item.useAction === 'unlockHomeItemSkin') {
    const unlocks = item.homeItemUnlocks?.length
      ? item.homeItemUnlocks
      : (item.useActionPara.homeItems || []).map(entry => ({
          typeId: entry.typeId,
          name: entry.typeId,
          skinNames: entry.skin || []
        }))
    if (!unlocks.length) return null

    if (item.useAction === 'unlockHomeItemSkin') {
      return `解锁家具外观：${unlocks.map(unlock => {
        const skinNames = unlock.skinNames?.length ? `（${unlock.skinNames.join('、')}）` : ''
        return `${unlock.name || unlock.typeId}${skinNames}`
      }).join('、')}`
    }
    return `解锁家具制作：${unlocks.map(unlock => {
      const skinNames = unlock.skinNames?.length ? `（同时解锁外观：${unlock.skinNames.join('、')}）` : ''
      return `${unlock.name || unlock.typeId}${skinNames}`
    }).join('、')}`
  }

  // 1. 角色碎片 heros
  if (item.useActionPara.heros && item.useActionPara.heros.length > 0) {
    const heroId = item.useActionPara.heros[0].heroTypeId
    const avatar = cachedAvatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
    const name = item.heroStarUsage?.heroName || item.heroUnlock?.heroName || avatar?.name || heroId
    if (item.name?.includes('碎片')) return `用于${name}升星`
    return `解锁角色：${name}`
  }

  // 2. 解锁皮肤 unlockHeroSkin
  if (item.useActionPara.unlockHeroSkin && item.useActionPara.unlockHeroSkin.skinTypeId) {
    if (item.skinUnlock?.skinName) {
      return `解锁皮肤：${item.skinUnlock.skinName}`
    }
    const skinId = item.useActionPara.unlockHeroSkin.skinTypeId
    // Try to find the skin item in item.json (cachedItems)
    const skinItem = cachedItems?.find(i => i.typeId === skinId)
    if (skinItem && skinItem.name) {
      return `解锁皮肤：${skinItem.name}`
    } else {
      // Fallback: 如果匹配不上就显示为角色名 skinSuffix
      const heroIdMatch = skinId.match(/^(hero_\d+)_skin/)
      if (heroIdMatch) {
        const hId = heroIdMatch[1] // hero_002
        const avatar = cachedAvatars?.find(a => a.typeId === hId || a.heroTypeId === hId)
        const roleName = avatar ? avatar.name : hId
        const skinSuffix = skinId.split('_').pop() // skin01
        return `解锁皮肤：${roleName} ${skinSuffix}`
      }
      return `解锁皮肤：${skinId}`
    }
  }

  return null
}

/**
 * 智能获取物品图标
 */
export function getItemImageUrl(item, avatars = cachedAvatars) {
  if (!item) return ''

  // 家具图纸使用目标家具/外观的可展示图；错误或缺失的源配置明确显示占位。
  if (item.useAction === 'unlockHomeItem' || item.useAction === 'unlockHomeItemSkin') {
    const icon = item.homeItemUnlocks?.[0]?.icon || ''
    return icon ? `/images/BuildItem/${icon}.png` : '/ui/visibility-off.svg'
  }
  
  // 只有碎片使用角色头像；指名契约书保留 item.json 配置的契约书图标。
  if (item.name?.includes('碎片') && item.useActionPara?.heros?.length > 0) {
    const heroId = item.useActionPara.heros[0].heroTypeId
    const avatar = avatars?.find(a => a.typeId === heroId || a.heroTypeId === heroId)
    if (avatar && avatar.img) {
      // e.g. at001_0 -> chara001_0
      const imgName = avatar.img.replace(/^at/, 'chara')
      return `/images/HeroInfoPanel_Atlas/${imgName}_p.png`
    }
  }

  // 默认物品图标
  return item.img ? `/images/Common_ItemIcon/${item.img}.png` : ''
}

/**
 * 解析物品使用效果（主要针对 getReward 和消耗效果）
 * 返回结构化的掉落/获取信息数组
 */
export function getItemAcquisition(item) {
  return item?.acquisition || parseItemAcquisition(item, {
    items: cachedItems, rewards: cachedRewards, equipGroups: cachedEquipGroups, getItemImageUrl
  })
}

export function parseItemRewards(item) {
  const groups = getItemAcquisition(item)?.groups
  return groups?.length ? groups : null
}

/**
 * 根据 ID 查找缓存的物品
 */
export function getCachedItem(typeId) {
  return cachedItems?.find(i => i.typeId === typeId) || null
}

/**
 * 判断是否为游戏装备图鉴中的正式装备。
 * PicHandBookPanel 使用 category=4、hide=false、equipLevel>0，并不会展示
 * equipGroup 的 show_* 展示占位项；网页的装备入口统一复用这条规则。
 */
export function isVisibleEquipItem(item) {
  if (!item || !Array.isArray(item.category) || String(item.category[0]) !== '4') return false
  if (String(item.typeId || '').startsWith('show_')) return false
  if (item.hide === true) return false
  return !!item.equip && Number(item.equip.equipLevel) > 0
}

/** 装备全局配置（品质/品阶属性系数等），由预解析或原始表提供。 */
export function getEquipGlobalConfig() {
  return cachedEquipGlobalConfig || {}
}

/**
 * 从锻造台实际开放等级与装备全局配置的交集中，取得当前版本可用的强化参数。
 * homeLevel 未提供时仅排除 990+ 测试档，供旧预解析产物降级使用。
 */
export function buildEquipEnhanceConfig(equipGlobalConfig = {}, homeLevelRes = null) {
  const smithyCfg = equipGlobalConfig?.smithyCfg || {}
  const configuredLevels = Object.keys(smithyCfg)
    .map(Number)
    .filter(level => Number.isInteger(level) && level > 0 && level < 100)

  const activeLevels = Object.keys(homeLevelRes?.datas?.blacksmith?.level || {})
    .map(Number)
    .filter(level => configuredLevels.includes(level))
  const usableLevels = activeLevels.length ? activeLevels : configuredLevels
  const blacksmithLevel = usableLevels.length ? Math.max(...usableLevels) : 0
  const config = smithyCfg[String(blacksmithLevel)] || {}

  return {
    blacksmithLevel,
    maxLevel: Math.max(0, Number(config.levelMax) || 0),
    attUp: Math.max(0, Number(config.attUp) || 0)
  }
}

export function getEquipEnhanceConfig() {
  return cachedEquipEnhanceConfig || buildEquipEnhanceConfig(cachedEquipGlobalConfig)
}

/**
 * 按游戏装备生成与强化公式，计算指定品质、强化等级下的属性区间。
 * 强化只作用于五项 EquipBaseProperty，最终展示与游戏一致取整。
 */
export function calculateEquipAttributeRange(item, quality, enhanceLevel = 0) {
  const rawData = item?.equip?.unitData
  if (!rawData) return null

  const equipLevel = Number(item.equip.equipLevel) || 1
  const selectedQuality = Number(quality) || 1
  const config = getEquipGlobalConfig()
  const qualityAddition = config.qualityAddition || {}
  const levelAddition = config.equipLevelAddition || {}
  const levelMult = Number(levelAddition[String(equipLevel)]?.per ?? 1)
  const qualData = qualityAddition[String(selectedQuality)] || qualityAddition['1'] || { permin: 1, permax: 1 }
  const enhanceConfig = getEquipEnhanceConfig()
  const safeEnhanceLevel = Math.min(
    Math.max(0, Number(enhanceLevel) || 0),
    enhanceConfig.maxLevel || 0
  )
  const enhanceMult = 1 + safeEnhanceLevel * enhanceConfig.attUp

  return Object.fromEntries(Object.entries(rawData).map(([key, rawValue]) => {
    const value = Number(rawValue) || 0
    if (!EQUIP_ENHANCE_ATTRS.has(key)) {
      return [key, { min: value, max: value, grows: false }]
    }

    const min = roundToEven(value * levelMult * Number(qualData.permin ?? 1) * enhanceMult)
    const max = roundToEven(value * levelMult * Number(qualData.permax ?? 1) * enhanceMult)
    return [key, { min, max, grows: true }]
  }))
}

/** 过滤无效的 0 属性，并把强化可成长属性排在其他属性之前。 */
export function buildEquipAttributeItems(attributeRange = {}) {
  return Object.entries(attributeRange)
    .map(([key, value], sourceIndex) => ({ key, ...value, sourceIndex }))
    .filter(attribute => Number(attribute.min) !== 0 || Number(attribute.max) !== 0)
    .sort((a, b) => {
      if (a.grows !== b.grows) return a.grows ? -1 : 1
      if (a.grows && b.grows) {
        return (EQUIP_ENHANCE_ATTR_ORDER.get(a.key) ?? 99) - (EQUIP_ENHANCE_ATTR_ORDER.get(b.key) ?? 99)
      }
      return a.sourceIndex - b.sourceIndex
    })
    .map(({ sourceIndex, ...attribute }) => attribute)
}

/**
 * 获取缓存的物品字典（typeId -> item），供共用食材组装等场景使用
 */
export function getCachedItemDict() {
  if (!cachedItems) return {}
  return Object.fromEntries(cachedItems.map(i => [i.typeId, i]))
}

/**
 * 解析符石效果 (类别包含 7)
 */
export function parseRuneEffect(item) {
  return buildRuneEffect(item, cachedEquipEnchants, cachedSkillTriggers)
}

/**
 * 解析装备组包含的装备
 */
export function parseEquipGroup(item) {
  if (!item || !item.category || item.category.length !== 1 || (item.category[0] !== 4 && item.category[0] !== '4')) return null;

  if (!cachedEquipGroups) return null;

  const match = Object.entries(cachedEquipGroups).find(([, group]) => group.showItemTypeId === item.typeId)
  if (!match) return null
  return parseEquipmentPool({ equipTypeGroup: match[0] }, {
    items: cachedItems, equipGroups: cachedEquipGroups, getItemImageUrl
  })
}

/**
 * 解析装备套装效果
 */
export function parseEquipSuit(item) {
  if (!item || !item.equip || !item.equip.suitTypeId || !cachedEquipSuits) return null;

  const suitData = cachedEquipSuits[item.equip.suitTypeId];
  if (!suitData) return null;

  const suitItems = (suitData.equipTypeId || []).map(typeId => {
    const targetItem = getCachedItem(typeId);
    if (targetItem) {
      return {
        typeId,
        targetName: targetItem.name,
        targetImg: getItemImageUrl(targetItem),
        targetQuality: targetItem.quality || 1
      };
    }
    return {
      typeId,
      targetName: typeId,
      targetImg: '',
      targetQuality: 1
    };
  });

  const suitEffects = (suitData.suitData || []).map(effect => {
    let des = effect.suitDes || '';
    const formattedDes = des.replace(/\{([^}]+)\}/g, "<span class='suit-val' style='color: #3b82f6;'>$1</span>");
    return {
      num: effect.suitNum,
      desHtml: formattedDes
    };
  });

  return {
    suitName: suitData.suitName || '未知套装',
    suitItems,
    suitEffects
  };
}

/**
 * 解析装备词条
 */
export function parseItemAffixes(item) {
  if (!item || !cachedItemAffixes) return null;

  const affixGroups = cachedItemAffixes[item.typeId];
  if (!affixGroups || !Array.isArray(affixGroups)) return null;

  const resultGroups = [];
  const seenPrefixes = new Set();
  
  for (const group of affixGroups) {
    if (!group.prefixes || !Array.isArray(group.prefixes)) continue;
    
    const parsedPrefixes = group.prefixes.filter(prefixId => {
      if (seenPrefixes.has(prefixId)) return false;
      seenPrefixes.add(prefixId);
      return true;
    }).map(prefixId => {
      const skillData = cachedSkillTriggers?.[prefixId];
      if (!skillData || !skillData.levelData) return null;
      
      const levelData = skillData.levelData['1'];
      if (!levelData || !levelData.des) return null;
      
      const formattedDes = levelData.des.replace(/\{([^}]+)\}/g, "<span class='affix-val' style='color: #3b82f6;'>$1</span>");
      
      return {
        id: prefixId,
        skillName: levelData.skillName || '',
        desHtml: formattedDes
      };
    }).filter(Boolean);

    if (parsedPrefixes.length > 0) {
      resultGroups.push({
        groupId: group.groupId,
        prefixes: parsedPrefixes
      });
    }
  }

  return resultGroups.length > 0 ? resultGroups : null;
}
