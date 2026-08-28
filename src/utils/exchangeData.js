/**
 * 兑换数据构建期纯函数：由 itemExchange/reward/consume/item/equipGroup 原始 JSON 生成
 * 兑换页一级分类 → 二级子分类 → 兑换卡片 的聚合结果（parsed-exchange.json 内容）。
 * 对应原 scripts/parse-exchange.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）共用。
 */

import { getMapName, MAP_NAMES } from './gameMappings.js'
import { isBlacklisted } from '../config/blacklist.js'

// ---------- 一级分类 → team 组 映射 ----------
const EXCLUDE_TEAMS = ['equipQualityUpgrade001', 'equipQualityUpgrade002', 'equipQualityUpgrade003', 'chouka']
// 原始配置保留的停用工资兑换：reward.tip 明确标注“暂时不用”，且消耗 9999 个纪念币。
// 不应在正式兑换页当作可用的“每日”项目展示。
const INACTIVE_TEST_TEAMS = ['weituogongzi']
const LEGACY_TEST_TEAM = /^team\d*$/
// itemExchange 中遗留的固定品质装备配置没有正式游戏 UI 入口。
// 锻造台走 ProducePanel -> SmithPanelUI 的独立 randomTeamList，不在兑换页展示。
const UNUSED_EXCHANGE_TEAMS = /^baodimap\d+(?:_1)?$/
const SUB_LABELS = {
  dailySupply: '每日补给',
  pack: '礼包补给',
  payke: '神晶'
}
const CATEGORY_ORDER = [
  { key: 'entrust', label: '委托兑换', teams: /^(?:weituo|weiTuo)/ },
  { key: 'market', label: '商人购买', teams: /^market/ },
  { key: 'gem', label: '符石合成', teams: /^Gem$/ },
  { key: 'tuzi', label: '兔子商人', teams: /^tuzi/ },
  { key: 'huoyue', label: '活跃兑换', teams: /^huoyue$/ },
  { key: 'shop', label: '商店积分', teams: /^(bke|ptjifen|payke)$/ },
  { key: 'seed', label: '种子兑换', teams: /^zhongzi$/ },
  { key: 'pack', label: '礼包补给', teams: /^(pack|dailySupply)$/ },
  { key: 'tower', label: '爬塔兑换', teams: /^tower1$/ },
  { key: 'fashion', label: '皮肤购买', teams: /^fuZhuang$/ },
  { key: 'pvp', label: 'PVP兑换', teams: /^pvp001$/ },
  { key: 'general', label: '通用兑换', teams: /^(team\d*|无)$/ }
]
const MAP_SUB_ORDER = Object.values(MAP_NAMES)
const SUB_ORDER = [...MAP_SUB_ORDER, 'all', '白', '绿', '蓝', '紫', '每日', '每日补给', '礼包补给', '神晶']
const RABBIT_RARITY_ORDER = { 紫: 0, 蓝: 1, 绿: 2, 白: 3 }

/**
 * 兑换条目的统一可见性与来源元数据。
 * 搜索来源和兑换页必须使用同一套分类过滤，避免详情页显示已被兑换页隐藏的配置。
 */
export function isVisibleExchange(exchange) {
  const team = exchange?.team || '无'
  return !EXCLUDE_TEAMS.includes(team)
    && !INACTIVE_TEST_TEAMS.includes(team)
    && !LEGACY_TEST_TEAM.test(team)
    && !UNUSED_EXCHANGE_TEAMS.test(team)
    && CATEGORY_ORDER.some(c => c.teams.test(team))
    && !isBlacklisted(exchange)
}

export function getExchangeSourceMeta(exchange) {
  const team = exchange?.team || '无'
  const category = CATEGORY_ORDER.find(c => c.teams.test(team)) || { key: 'other', label: '兑换' }
  let subKey = (exchange?.category && exchange.category[1]) || team
  if (/^[cC]\d+$/.test(subKey)) subKey = getMapName(subKey)
  return {
    category: category.key,
    categoryLabel: category.label,
    sub: subKey,
    subLabel: SUB_LABELS[subKey] || subKey
  }
}

export function compareExchangeSources(a, b) {
  const categoryRank = (source) => {
    const index = CATEGORY_ORDER.findIndex(c => c.key === source?.category)
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

  const rawExchange = (exchangeRes && exchangeRes.itemExchange) || {}
  const rawReward = (rewardRes && rewardRes.datas) || {}
  const rawConsume = (consumeRes && consumeRes.datas) || {}
  const rawItem = (itemRes && itemRes.datas) || {}
  const equipGroups = (equipGroupRes && equipGroupRes.equipGroups) || {}

  const teamToCategory = {}
  CATEGORY_ORDER.forEach(c => c._teams = [])
  for (const [id, e] of Object.entries(rawExchange)) {
    const t = e.team || '无'
    if (!isVisibleExchange(e)) continue
    for (const c of CATEGORY_ORDER) {
      if (c.teams.test(t)) {
        teamToCategory[t] = c.key
        c._teams.push(t)
        break
      }
    }
    if (!teamToCategory[t]) teamToCategory[t] = 'other'
  }

  // ---------- 奖励/消耗解析（对照源码 ExtentionMethod.GetRewardInfo / GetConsumeShowData） ----------
  const BASE_REWARD_ICONS = {
    money: 'item_00001', ke: 'item_00002', payKe: 'item_00003', exp: 'item_00004',
    ti: 'item_00005', heroExp: 'item_00006', equipExp: 'item_00007', speed: 'item_00008'
  }
  const BASE_REWARD_NAMES = {
    money: '银币', ke: '氪金', payKe: '神晶', exp: '经验', ti: '体力',
    heroExp: '英雄经验', equipExp: '装备经验', speed: '加速'
  }

  const extractMoney = (data) => {
    const out = []
    if (!data) return out
    for (const [field, iconId] of Object.entries(BASE_REWARD_ICONS)) {
      const v = data[field]
      if (v > 0) out.push({ rules: [{ mode: 'item', typeId: iconId, num: v }] })
    }
    return out
  }

  const normalizeItems = (data) => {
    if (!data) return []
    return extractMoney(data).concat(data.items || [])
  }

  const pushItem = (out, typeId, num) => {
    if (!typeId) return
    const iconId = typeId.startsWith('item_') ? typeId : typeId
    const it = rawItem[typeId] || {}
    out.push({
      typeId,
      num,
      name: BASE_REWARD_NAMES[typeId] || it.name || typeId,
      icon: `/Common_ItemIcon/${(it.img || iconId)}.png`,
      quality: it.quality || 1
    })
  }

  const resolveItemRules = (groups) => {
    const out = []
    for (const g of groups || []) {
      // 情况1：consume 直接 {typeId, num}
      if (g && typeof g === 'object' && g.typeId && !g.rules && !g.mode) {
        pushItem(out, g.typeId, g.num || 1)
        continue
      }
      // 情况2：rules 包裹（对照源码 mode switch）
      if (g.rate === 0) continue // 源码：rate==0 跳过
      for (const r of (g && g.rules) || []) {
        if (!r) continue
        const mode = r.mode
        if (mode === 'item') {
          pushItem(out, r.typeId, r.num || r.min || 1)
        } else if (mode === 'randomMoney') {
          pushItem(out, 'item_00001', parseInt(r.min) || 1)
        } else if (mode === 'randomKe') {
          pushItem(out, 'item_00002', parseInt(r.min) || 1)
        } else if (mode === 'equip' || mode === 'equipGroup') {
          const targetId = r.typeId || (r.equipTypeGroup && equipGroups[r.equipTypeGroup]
            ? (equipGroups[r.equipTypeGroup].showItemTypeId || (equipGroups[r.equipTypeGroup].type && equipGroups[r.equipTypeGroup].type[0] && equipGroups[r.equipTypeGroup].type[0].typeId) || '')
            : '')
          if (targetId) pushItem(out, targetId, 1)
        } else if (r.typeId) {
          pushItem(out, r.typeId, r.num || r.min || 1)
        }
      }
    }
    return out
  }

  // ---------- 组装 ----------
  const limitTypeNames = { day: '每日', week: '每周', month: '每月', global: '总限' }
  const getLimitText = (limit = {}) => {
    const label = limit.exchangeType && limitTypeNames[limit.exchangeType]
    return label ? `${label}${limit.num ? ' ' + limit.num + ' 次' : ''}` : (limit.num ? `${limit.num} 次` : '')
  }
  const result = CATEGORY_ORDER.map(c => {
    const subs = {}
    for (const [id, e] of Object.entries(rawExchange)) {
      const t = e.team || '无'
      if (!isVisibleExchange(e)) continue
      if (teamToCategory[t] !== c.key) continue
      const rewardData = rawReward[e.reward] || {}
      const consumeRaw = e.consume
      const consumeData = rawConsume[consumeRaw] || {}

      const rewardGroups = normalizeItems(rewardData)
      const consumeGroups = normalizeItems(consumeData)

      const limit = e.limitCondition || {}
      const limitText = getLimitText(limit)

      const item = {
        id: e.id,
        name: e.name || '',
        des: e.des || '',
        sort: e.sort || 0,
        team: t,
        limitText,
        consumeItems: resolveItemRules(consumeGroups),
        rewardItems: resolveItemRules(rewardGroups),
        consumeId: consumeRaw || ''
      }

      // 二级子分类：优先 category[1]（如 c1/c2/每日/绿），否则 team；c1→地图名
      let subKey = (e.category && e.category[1]) || t
      if (/^[cC]\d+$/.test(subKey)) subKey = getMapName(subKey)
      if (!subs[subKey]) subs[subKey] = []
      subs[subKey].push(item)
    }
    // 二级排序 + 内部按 sort/id
    let subList = Object.entries(subs)
      .map(([key, list]) => ({ key, label: SUB_LABELS[key] || key, list: list.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id)) }))
      .sort((a, b) => getSubSortKey(a.key) - getSubSortKey(b.key) || a.key.localeCompare(b.key, 'zh-CN'))
    if (c.key === 'tuzi' && subList.length) {
      const allList = subList
        .flatMap(sub => sub.list.map(item => ({ item, rank: RABBIT_RARITY_ORDER[sub.key] ?? 99 })))
        .sort((a, b) => a.rank - b.rank || a.item.sort - b.item.sort || a.item.id.localeCompare(b.item.id))
        .map(entry => entry.item)
      subList = [{ key: 'all', label: '全部', list: allList }, ...subList]
    }
    return { key: c.key, label: c.label, subs: subList }
  })

  return result.filter(category => category.subs.length > 0)
}
