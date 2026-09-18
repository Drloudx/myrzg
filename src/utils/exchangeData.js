/**
 * 兑换数据构建期纯函数。
 * itemExchange 只定义兑换内容，正式可见范围必须再与商店、活动等入口配置求交集。
 */

import { getMapName, MAP_NAMES, BASE_REWARD_ICONS, BASE_REWARD_NAMES } from './gameMappings.js'
import { FUZZY_BLACKLIST, isBlacklisted } from '../config/blacklist.js'

const EXCLUDE_TEAMS = ['equipQualityUpgrade001', 'equipQualityUpgrade002', 'equipQualityUpgrade003', 'chouka']
// 保留在 itemExchange 配置中的历史委托板工资兑换，当前版本没有正式入口/服务器下发。
const INACTIVE_TEST_TEAMS = ['weituogongzi', 'weiTuoBanDay']
const LEGACY_TEST_TEAM = /^team\d*$/
const UNUSED_EXCHANGE_TEAMS = /^baodimap\d+(?:_1)?$/
const FORMAL_ENTRY_TEAMS = /^(?:market\d*|tuzi\w*|zhongzi|bke|ptjifen|payke|fuZhuang|pack|dailySupply)$/

const SUB_LABELS = {
  dailySupply: '每日补给',
  fixed: '固定商品',
  random: '随机商品',
  all: '全部候选'
}

const CATEGORY_ORDER = [
  { key: 'entrust', label: '委托兑换', teams: /^(?:weituo|weiTuo)/ },
  { key: 'market', label: '地区商店', teams: /^market/ },
  { key: 'gem', label: '符石合成', teams: /^Gem$/ },
  { key: 'tuzi', label: '兔子商人', teams: /^tuzi/ },
  { key: 'huoyue', label: '活跃兑换', teams: /^huoyue$/ },
  { key: 'shop', label: '商店积分', teams: /^(bke|ptjifen|payke|fuZhuang)$/ },
  { key: 'seed', label: '种子兑换', teams: /^zhongzi$/ },
  { key: 'pack', label: '每日补给', teams: /^(pack|dailySupply)$/ },
  // 「爬塔」是玩家俗称；游戏内该玩法正式名为「神匠之塔」（tower.json 的 name、
  // exchangeTeam.json 的 tower1 → name 均为「神匠之塔」），故用正式名。
  { key: 'tower', label: '神匠之塔兑换', teams: /^tower1$/ },
  { key: 'pvp', label: 'PVP兑换', teams: /^pvp001$/ },
  { key: 'general', label: '通用兑换', teams: /^(team\d*|无)$/ }
]

const MARKET_SHOPS = [
  { shopId: 'c1_map_bishao', key: 'c1', label: '秋日荒野' },
  { shopId: 'c2_map_shop', key: 'c2', label: '索利德山地' },
  { shopId: 'c3_map_shop', key: 'c3', label: '魔爪湖畔' },
  { shopId: 'c4_map_shop', key: 'c4_c5', label: '黑森林/霜烬平原' }
]

const RABBIT_SHOPS = ['c1_map_tuzi', 'c2_map_tuzi']

const MAP_SUB_ORDER = Object.values(MAP_NAMES)
const SUB_ORDER = [...MAP_SUB_ORDER, 'all', 'fixed', 'random', '白', '绿', '蓝', '紫', '每日', '每日补给']
const RABBIT_RARITY_ORDER = { 紫: 0, 蓝: 1, 绿: 2, 白: 3 }

const getCategory = (exchange) => {
  const team = exchange?.team || '无'
  return CATEGORY_ORDER.find(category => category.teams.test(team)) || { key: 'other', label: '兑换' }
}

const isMarketShopHidden = (definition) => {
  if (definition.key !== 'c4_c5') return isBlacklisted(definition.label)
  const normalizedLabel = definition.label.trim().toLowerCase()
  return FUZZY_BLACKLIST.some(rule => String(rule || '').trim().toLowerCase() === normalizedLabel)
}

const getShopItems = (shop) => (shop?.shopList || []).flatMap(pool => [
  ...(pool.exchangeIds || []),
  ...(pool.skins || []).map(skin => skin.exchangeId)
])

const addOfficialLocation = (index, id, location) => {
  if (!id) return
  if (!index[id]) index[id] = { locations: [] }
  if (!index[id].locations.some(existing => existing.category === location.category && existing.sub === location.sub)) {
    index[id].locations.push(location)
  }
}

/** 从正式入口配置建立兑换白名单。孤立配置不会进入索引。 */
export function buildOfficialExchangeIndex(maps = {}) {
  const shops = maps.shopRes?.datas || {}
  const general = maps.generalRes || {}
  const packDisplay = maps.packDisplayRes || {}
  const activities = maps.activityListRes?.datas || {}
  const index = {}

  for (const definition of MARKET_SHOPS) {
    if (isMarketShopHidden(definition)) continue
    for (const id of getShopItems(shops[definition.shopId])) {
      addOfficialLocation(index, id, {
        category: 'market', categoryLabel: '地区商店',
        sub: definition.key, subLabel: definition.label
      })
    }
  }

  for (const shopId of general.zhongziShop || []) {
    const shop = shops[shopId]
    let randomPoolNumber = 0
    for (const pool of shop?.shopList || []) {
      const isRandom = pool.type === 'random'
      if (isRandom) randomPoolNumber += 1
      for (const id of pool.exchangeIds || []) {
        addOfficialLocation(index, id, {
          category: 'seed', categoryLabel: '种子兑换',
          sub: isRandom ? 'random' : 'fixed',
          subLabel: isRandom ? '随机商品' : '固定商品',
          poolNumber: isRandom ? randomPoolNumber : 0,
          pickCount: pool.num, candidateCount: pool.exchangeIds.length
        })
      }
    }
  }

  for (const shopId of RABBIT_SHOPS) {
    const shop = shops[shopId]
    for (const pool of shop?.shopList || []) {
      for (const id of pool.exchangeIds || []) {
        addOfficialLocation(index, id, {
          category: 'tuzi', categoryLabel: '兔子商人',
          sub: 'all', subLabel: '全部候选',
          pickCount: pool.num, candidateCount: pool.exchangeIds.length
        })
      }
    }
  }

  // 积分商店和皮肤商店以礼包中心的可见入口为准；孤立的 payKeShop 不会被误收录。
  for (const display of Object.values(packDisplay)) {
    if (display?.hide || !display?.shopTypeId) continue
    const category = [2, 5].includes(display.packType) ? 'shop' : ''
    if (!category) continue
    for (const id of getShopItems(shops[display.shopTypeId])) {
      addOfficialLocation(index, id, {
        category,
        categoryLabel: '商店积分',
        sub: display.shopTypeId,
        subLabel: display.name || shops[display.shopTypeId]?.name || display.shopTypeId
      })
    }
  }

  const dailyEntries = activities.dailySupply?.para?.achives || []
  const dailyShopIds = new Set(getShopItems(shops.dailySupply))
  for (const entry of dailyEntries) {
    if (!dailyShopIds.has(entry.itemExchangeId)) continue
    addOfficialLocation(index, entry.itemExchangeId, {
      category: 'pack', categoryLabel: '每日补给',
      sub: 'dailySupply', subLabel: '每日补给',
      startTime: entry.startTime || '', endTime: entry.endTime || ''
    })
  }
  return index
}

/** 搜索来源和兑换页共用同一套可见性，防止隐藏配置从物品详情重新出现。 */
export function isVisibleExchange(exchange, officialIndex = {}) {
  const team = exchange?.team || '无'
  if (EXCLUDE_TEAMS.includes(team)
    || INACTIVE_TEST_TEAMS.includes(team)
    || LEGACY_TEST_TEAM.test(team)
    || UNUSED_EXCHANGE_TEAMS.test(team)
    || !CATEGORY_ORDER.some(category => category.teams.test(team))
    || isBlacklisted(exchange)) return false

  if (!FORMAL_ENTRY_TEAMS.test(team)) return true
  const category = getCategory(exchange)
  return Boolean(officialIndex[exchange?.id]?.locations?.some(location => location.category === category.key))
}

export function getExchangeSourceMeta(exchange, officialIndex = {}) {
  const category = getCategory(exchange)
  const formalLocation = FORMAL_ENTRY_TEAMS.test(exchange?.team || '无')
    ? officialIndex[exchange?.id]?.locations?.find(location => location.category === category.key)
    : null
  if (formalLocation) return formalLocation

  let subKey = exchange?.category?.[1] || exchange?.team || '无'
  if (/^[cC]\d+$/.test(subKey)) subKey = getMapName(subKey)
  return {
    category: category.key, categoryLabel: category.label,
    sub: subKey, subLabel: SUB_LABELS[subKey] || subKey
  }
}

export function compareExchangeSources(a, b) {
  const categoryRank = source => {
    const index = CATEGORY_ORDER.findIndex(category => category.key === source?.category)
    return index >= 0 ? index : CATEGORY_ORDER.length
  }
  const categoryDiff = categoryRank(a) - categoryRank(b)
  if (categoryDiff) return categoryDiff
  const subDiff = getSubSortKey(a?.sub) - getSubSortKey(b?.sub)
  if (subDiff) return subDiff
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN')
    || String(a?.id || '').localeCompare(String(b?.id || ''))
}

const getSubSortKey = (key) => {
  const index = SUB_ORDER.indexOf(key)
  return index >= 0 ? index : 100
}

export function buildExchangeData(maps) {
  const { exchangeRes, rewardRes, consumeRes, itemRes, equipGroupRes } = maps
  const rawExchange = exchangeRes?.itemExchange || {}
  const rawReward = rewardRes?.datas || {}
  const rawConsume = consumeRes?.datas || {}
  const rawItem = itemRes?.datas || {}
  const equipGroups = equipGroupRes?.equipGroups || {}
  const shops = maps.shopRes?.datas || {}
  const officialIndex = buildOfficialExchangeIndex(maps)

  const extractMoney = (data) => {
    const out = []
    if (!data) return out
    for (const [field, iconId] of Object.entries(BASE_REWARD_ICONS)) {
      const value = data[field]
      if (value > 0) out.push({ rules: [{ mode: 'item', typeId: iconId, num: value }] })
    }
    return out
  }
  const normalizeItems = data => data ? extractMoney(data).concat(data.items || []) : []

  const pushItem = (out, typeId, num) => {
    if (!typeId) return
    const item = rawItem[typeId] || {}
    out.push({
      typeId, num,
      name: BASE_REWARD_NAMES[typeId] || item.name || typeId,
      icon: `/Common_ItemIcon/${item.img || typeId}.png`,
      quality: item.quality || 1
    })
  }

  const resolveItemRules = (groups) => {
    const out = []
    for (const group of groups || []) {
      if (group && typeof group === 'object' && group.typeId && !group.rules && !group.mode) {
        pushItem(out, group.typeId, group.num || 1)
        continue
      }
      if (group?.rate === 0) continue
      for (const rule of group?.rules || []) {
        if (!rule) continue
        if (rule.mode === 'item') {
          pushItem(out, rule.typeId, rule.num || rule.min || 1)
        } else if (rule.mode === 'randomMoney') {
          pushItem(out, 'item_00001', parseInt(rule.min) || 1)
        } else if (rule.mode === 'randomKe') {
          pushItem(out, 'item_00002', parseInt(rule.min) || 1)
        } else if (rule.mode === 'equip' || rule.mode === 'equipGroup') {
          const groupConfig = equipGroups[rule.equipTypeGroup]
          const targetId = rule.typeId || groupConfig?.showItemTypeId || groupConfig?.type?.[0]?.typeId || ''
          if (targetId) pushItem(out, targetId, 1)
        } else if (rule.typeId) {
          pushItem(out, rule.typeId, rule.num || rule.min || 1)
        }
      }
    }
    return out
  }

  const limitTypeNames = { day: '每日', week: '每周', month: '每月', global: '总限' }
  const getLimitText = (limit = {}) => {
    const label = limit.exchangeType && limitTypeNames[limit.exchangeType]
    return label ? `${label}${limit.num ? ` ${limit.num} 次` : ''}` : (limit.num ? `${limit.num} 次` : '')
  }

  const resolveSeedUnlock = (exchange) => {
    if (!exchange?.showCondition) return ''
    const condition = maps.conditionRes?.gameConditions?.[exchange.showCondition]
    const taskId = condition?.rules?.find(rule => rule.type === 'passTask')?.para?.typeId
    const taskName = maps.taskRes?.datas?.[taskId]?.name
    return taskName ? `完成《${taskName}》后解锁` : ''
  }

  const makeItem = (id, overrides = {}) => {
    const exchange = rawExchange[id]
    if (!exchange || !isVisibleExchange(exchange, officialIndex)) return null
    const consumeId = exchange.consume || ''
    return {
      id: exchange.id, name: exchange.name || '', des: exchange.des || '',
      sort: exchange.sort || 0, team: exchange.team || '无',
      limitText: getLimitText(exchange.limitCondition || {}),
      consumeItems: resolveItemRules(normalizeItems(rawConsume[consumeId] || {})),
      rewardItems: resolveItemRules(normalizeItems(rawReward[exchange.reward] || {})),
      consumeId,
      ...overrides
    }
  }

  const buildMarketSubs = () => MARKET_SHOPS.filter(definition => !isMarketShopHidden(definition)).map(definition => ({
    key: definition.key,
    label: definition.label,
    list: getShopItems(shops[definition.shopId]).map(id => makeItem(id)).filter(Boolean)
  })).filter(sub => sub.list.length)

  const buildSeedSubs = () => {
    const entries = []
    let randomPoolNumber = 0
    for (const shopId of maps.generalRes?.zhongziShop || []) {
      for (const pool of shops[shopId]?.shopList || []) {
        const isRandom = pool.type === 'random'
        if (isRandom) randomPoolNumber += 1
        for (const id of pool.exchangeIds || []) {
          const parts = [isRandom ? `随机池 ${randomPoolNumber} · ${pool.exchangeIds.length} 选 ${pool.num}` : '固定商品']
          const unlockText = resolveSeedUnlock(rawExchange[id])
          if (unlockText) parts.push(unlockText)
          const item = makeItem(id, { poolType: isRandom ? 'random' : 'fixed', metaText: parts.join(' · ') })
          if (item) entries.push(item)
        }
      }
    }
    const fixed = entries.filter(item => item.poolType === 'fixed')
    const random = entries.filter(item => item.poolType === 'random')
    return [
      { key: 'all', label: '全部候选', list: entries },
      { key: 'fixed', label: '固定商品', list: fixed },
      { key: 'random', label: '随机商品', list: random }
    ].filter(sub => sub.list.length)
  }

  const buildRabbitSubs = () => {
    const list = []
    for (const pool of shops.c2_map_tuzi?.shopList || []) {
      for (const id of pool.exchangeIds || []) {
        const exchange = rawExchange[id]
        const rarity = exchange?.category?.[1] || ''
        const item = makeItem(id, {
          rarity,
          metaText: `${rarity}色池 ${pool.exchangeIds.length} 选 ${pool.num} · 每次可买 ${exchange?.randomShopLimitNum || 0} 个`
        })
        if (item) list.push(item)
      }
    }
    const sorted = list.sort((a, b) => (RABBIT_RARITY_ORDER[a.rarity] ?? 99) - (RABBIT_RARITY_ORDER[b.rarity] ?? 99))
    const greenCount = sorted.filter(item => item.rarity === '绿').length
    return sorted.length ? [{
      key: 'all',
      label: '全部候选',
      summary: `紫色 5 选 2、蓝色 10 选 3、绿色 ${greenCount} 选 4、白色 3 选 1；每次共出现 10 项。`,
      list: sorted
    }] : []
  }

  // PackHeroSkinTempUI: shop.skins → skin.heroTypeId → hero.Name;
  // 商店封面使用 shop.skins.img，不使用角色详情立绘或按名称猜测关联。
  const skinPresentation = (entry) => {
    const skin = maps.skinRes?.datas?.[entry.heroSkin]
    const hero = maps.heroRes?.datas?.[skin?.heroTypeId]
    if (!skin || !hero) return null
    return {
      id: entry.heroSkin,
      heroId: skin.heroTypeId,
      heroName: hero.name,
      name: skin.name,
      quality: skin.quality,
      image: entry.img ? `/images/PackPane/${entry.img}.png` : ''
    }
  }

  const buildConfiguredShopSubs = () => Object.values(maps.packDisplayRes || {})
    .filter(display => !display?.hide && display?.shopTypeId
      && [2, 5].includes(display.packType))
    .map(display => ({
      key: display.shopTypeId,
      label: display.name || shops[display.shopTypeId]?.name || display.shopTypeId,
      list: (shops[display.shopTypeId]?.shopList || []).flatMap(pool => [
        ...(pool.exchangeIds || []).map(id => makeItem(id)),
        ...(pool.skins || []).map(entry => makeItem(entry.exchangeId, { skin: skinPresentation(entry) }))
      ]).filter(item => item && getCategory(rawExchange[item.id]).key === 'shop')
    })).filter(sub => sub.list.length)

  const buildDailySubs = () => {
    const activity = maps.activityListRes?.datas?.dailySupply
    const shopIds = new Set(getShopItems(shops.dailySupply))
    const trimTime = value => String(value || '').replace(/:\d{2}$/, '')
    const list = (activity?.para?.achives || [])
      .filter(entry => shopIds.has(entry.itemExchangeId))
      .map(entry => makeItem(entry.itemExchangeId, {
        displayName: entry.name || '',
        metaText: `开放 ${trimTime(entry.startTime)}-${trimTime(entry.endTime)}`
      })).filter(Boolean)
    return list.length ? [{ key: 'dailySupply', label: '每日补给', list }] : []
  }

  const buildGenericSubs = (categoryKey) => {
    const subs = {}
    for (const exchange of Object.values(rawExchange)) {
      if (!isVisibleExchange(exchange, officialIndex) || getCategory(exchange).key !== categoryKey) continue
      let subKey = exchange.category?.[1] || exchange.team || '无'
      if (/^[cC]\d+$/.test(subKey)) subKey = getMapName(subKey)
      if (!subs[subKey]) subs[subKey] = []
      const item = makeItem(exchange.id)
      if (item) subs[subKey].push(item)
    }
    return Object.entries(subs)
      .map(([key, list]) => ({
        key, label: SUB_LABELS[key] || key,
        list: list.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
      }))
      .sort((a, b) => getSubSortKey(a.key) - getSubSortKey(b.key) || a.key.localeCompare(b.key, 'zh-CN'))
  }

  const builders = {
    market: buildMarketSubs,
    seed: buildSeedSubs,
    tuzi: buildRabbitSubs,
    shop: buildConfiguredShopSubs,
    pack: buildDailySubs
  }

  return CATEGORY_ORDER.map(category => {
    const subs = builders[category.key]?.() || buildGenericSubs(category.key)
    const summary = category.key === 'seed'
      ? '固定商品 4 项；随机商品分为两个候选池，每池 5 选 2，每次共随机出现 4 项。'
      : ''
    return { key: category.key, label: category.label, summary, subs }
  }).filter(category => category.subs.length)
}
