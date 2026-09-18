// Pure reward rules shared by build-time parsers and item/equipment details.
// gameMappings re-exports these mappings for existing consumers.
export const BASE_REWARD_ICONS = {
  money: 'item_00001', ke: 'item_00002', payKe: 'item_00003', exp: 'item_00004',
  ti: 'item_00005', heroExp: 'item_00006', equipExp: 'item_00007', speed: 'item_00008'
}
export const BASE_REWARD_NAMES = {
  money: '银币', ke: '氪金', payKe: '神晶', exp: '营地经验值',
  ti: '体力', heroExp: '伙伴经验值', equipExp: '装备强化经验', speed: '加速点'
}
export const BASE_REWARD_PATHS = Object.fromEntries(
  Object.entries(BASE_REWARD_ICONS).map(([key, id]) => [key, `/images/Common_ItemIcon/${id}.webp`])
)
export const REWARD_MODE_INFO = Object.fromEntries(
  Object.entries(BASE_REWARD_ICONS).map(([key, id]) => [key, {
    id, name: BASE_REWARD_NAMES[key], icon: BASE_REWARD_PATHS[key]
  }])
)
REWARD_MODE_INFO.randomMoney = REWARD_MODE_INFO.money
REWARD_MODE_INFO.randomKe = REWARD_MODE_INFO.ke

const table = value => value?.datas || value || {}
const list = value => Array.isArray(value) ? value : []
const number = (value, fallback) => value == null || value === '' || !Number.isFinite(Number(value))
  ? fallback : Number(value)
const weight = rule => Math.max(0, number(rule?.chance, 0))
const knownTotalWeight = rules => rules.every(rule => number(rule?.chance, -1) >= 0)
  ? rules.reduce((sum, rule) => sum + weight(rule), 0) : 0
const itemAt = (items, id) => Array.isArray(items)
  ? items.find(item => item?.typeId === id) : table(items)[id]

export function getRewardItemTarget(typeId) {
  return typeId ? { query: { itemId: typeId } } : null
}

function itemPresentation(typeId, context, currency) {
  const item = itemAt(context.items, typeId)
  const icon = item && context.getItemImageUrl
    ? context.getItemImageUrl(item)
    : item?.img ? `/images/Common_ItemIcon/${item.img}.webp` : ''
  return {
    typeId,
    targetName: item?.name || currency?.name || typeId || '',
    targetImg: icon || currency?.icon || '',
    targetQuality: number(item?.quality, 0),
    target: item ? getRewardItemTarget(typeId) : null
  }
}

export function parseEquipmentPool(rule, context = {}) {
  const groups = context.equipGroups || {}
  const types = list((groups.equipGroups || groups)[rule.equipTypeGroup]?.type)
  const total = knownTotalWeight(types)
  return types.filter(entry => entry?.typeId).map(entry => ({
    ...itemPresentation(entry.typeId, context),
    chance: weight(entry),
    ...(total > 0 ? { prob: weight(entry) / total } : {})
  }))
}

function parseRule(rule, context) {
  const mode = rule.mode || (rule.typeId ? 'item' : 'unknown')
  const currency = REWARD_MODE_INFO[mode]
  const min = Math.max(0, number(rule.min, number(rule.max, 1)))
  const max = Math.max(min, number(rule.max, min))
  const parsed = { ...rule, mode, min, max }
  if (mode === 'equipGroup') {
    // The preview ID is not an actual fixed equipment reward.
    delete parsed.typeId
    const qualities = list(context.equipGroups?.qualityGroups?.[rule.qualityGroup])
    const total = knownTotalWeight(qualities)
    return {
      ...parsed, targetName: '随机装备', targetImg: '', targetQuality: 0, target: null,
      isRandomPool: true, candidates: parseEquipmentPool(rule, context),
      qualities: qualities.map(entry => ({
        quality: number(entry.quality, 0), chance: weight(entry),
        ...(total > 0 ? { prob: weight(entry) / total } : {})
      }))
    }
  }
  if (mode === 'item' || mode === 'equip' || currency) {
    Object.assign(parsed, itemPresentation(currency?.id || rule.typeId, context, currency))
    if (mode === 'equip' && rule.quality != null) parsed.targetQuality = number(rule.quality, 0)
  } else {
    // Unsupported modes remain inspectable, but cannot masquerade as item links.
    delete parsed.typeId
    Object.assign(parsed, { targetName: '奖励', targetImg: '', targetQuality: 0, target: null })
  }
  return parsed
}

function currencyRules(value, context) {
  return Object.keys(BASE_REWARD_ICONS).flatMap(mode => {
    const count = number(value?.[mode], 0)
    return count > 0 ? [parseRule({ mode, min: count, max: count }, context)] : []
  })
}

/**
 * A group keeps draw count separate from per-draw quantity and probability.
 * Missing/all-zero weights are unknown, not uniform or guaranteed. No cumulative
 * probability is inferred: the supplied client config does not define repetition.
 */
export function parseRewardGroups(rewardOrId, context = {}) {
  const reward = typeof rewardOrId === 'string' ? table(context.rewards)[rewardOrId] : rewardOrId
  if (!reward) return []
  const groups = []
  const fixed = currencyRules(reward, context)
  if (fixed.length) groups.push({
    kind: 'fixed', rate: 1, num: 1,
    rules: fixed.map(rule => ({ ...rule, prob: 1, actualProb: 1, groupCount: 1 }))
  })
  for (const group of list(reward.items)) {
    if (!group) continue
    const rules = list(group.rules).filter(Boolean)
    if (!rules.length) continue
    const total = knownTotalWeight(rules)
    const rate = Math.min(1, Math.max(0, number(group.rate, 1)))
    const num = Math.max(0, Math.floor(number(group.num, 1)))
    groups.push({
      kind: 'random', rate, num,
      rules: rules.map(rule => ({
        ...parseRule(rule, context), groupCount: num,
        ...(total > 0 ? { prob: weight(rule) / total, actualProb: num ? rate * weight(rule) / total : 0 }
          : rate === 0 || num === 0 ? { actualProb: 0 } : {})
      }))
    })
  }
  return groups
}

export function parseAcquisitionCosts(consumeOrId, context = {}) {
  const consume = typeof consumeOrId === 'string' ? table(context.consumes)[consumeOrId] : consumeOrId
  if (!consume) return []
  return [
    ...currencyRules(consume, context),
    ...list(consume.items).filter(item => item?.typeId && number(item.num, 0) > 0)
      .map(item => parseRule({ mode: 'item', typeId: item.typeId, min: number(item.num, 0), max: number(item.num, 0) }, context))
  ]
}

/** Costs are additional to consuming one copy of the source item. */
export function parseItemAcquisition(item, context = {}) {
  const action = item?.useAction
  const para = item?.useActionPara
  if (!para || !['getReward', 'getRewardCost', 'getRewardSelect', 'getRewardCondition', 'appraisal'].includes(action)) return null
  const result = {
    action, rewardId: para.reward || '', consumeId: '', conditionId: para.condition || '',
    sourceItemId: item.typeId || '', sourceItemCount: 1, costs: [], groups: []
  }
  if (action === 'getRewardSelect') {
    const rules = list(para.rewards).filter(entry => entry?.itemTypeId).map(entry => ({
      ...parseRule({ mode: 'item', typeId: entry.itemTypeId, min: entry.num, max: entry.num }, context),
      isSelect: true
    }))
    if (rules.length) result.groups = [{ kind: 'select', isSelect: true, rate: 1, num: 1, rules }]
  } else {
    result.groups = parseRewardGroups(para.reward, context)
  }
  if (action === 'getRewardCost') {
    result.costs = parseAcquisitionCosts({ items: [{ typeId: para.itemTypeId, num: para.itemNum }] }, context)
  } else if (action === 'appraisal') {
    result.consumeId = para.consume || ''
    result.costs = parseAcquisitionCosts(para.consume, context)
  }
  return result
}

/** Actual item identities for reverse sources; previews and impossible rewards are excluded. */
export function getObtainableRewardRules(groups = []) {
  return groups.flatMap(group => !(group.rate > 0 && group.num > 0) ? [] : group.rules
    .filter(rule => rule.typeId && !rule.isRandomPool && rule.max > 0 && rule.actualProb !== 0
      && (rule.isSelect || rule.chance == null || rule.chance > 0))
    .map(rule => ({ ...rule, groupKind: group.kind, groupRate: group.rate, groupCount: group.num })))
}

/** Batch totals keep random draws separate from guaranteed reward quantities. */
export function scaleAcquisition(acquisition, count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 999) throw new RangeError('Acquisition count must be an integer from 1 to 999')
  if (!acquisition) return null
  const scaleRule = rule => ({ ...rule, min: rule.min * count, max: rule.max * count })
  return {
    ...acquisition, sourceItemCount: acquisition.sourceItemCount * count,
    costs: acquisition.costs.map(scaleRule),
    groups: acquisition.groups.map(group => group.kind === 'fixed'
      ? { ...group, rules: group.rules.map(scaleRule) }
      : { ...group, num: group.num * count, rules: group.rules.map(rule => ({ ...rule, groupCount: group.num * count })) })
  }
}

/** Shared business labels; no page-specific mechanics or source routes. */
export function formatRewardGroupLabel(group) {
  if (group.isSelect) return '[自选池] 从以下奖励中自选 1 个'
  if (group.kind === 'fixed') return '固定获得'
  if (group.num === 0 || group.rate === 0) return '不触发奖励'
  if (group.rules.every(rule => rule.actualProb == null)) return '奖励内容'
  if (group.rate < 1) return `[概率池] ${(group.rate * 100).toFixed(1)}% 概率从以下奖励中抽取 1 个`
  return '[必出池] 从以下奖励中抽取 1 个'
}

export function formatRewardProbability(rule) {
  if (rule.isSelect) return '自选获得'
  if (rule.actualProb == null || !Number.isFinite(rule.actualProb)) return ''
  const label = rule.actualProb < 1 ? `单次抽取 ${formatPercent(rule.actualProb)}%` : '单次抽取必定获得'
  return rule.cumulativeProb != null && rule.groupCount > 1
    ? `${label} · 综合概率 ${formatPercent(rule.cumulativeProb)}%` : label
}

function formatPercent(probability) {
  const percent = probability * 100
  if (percent > 0 && percent < 0.01) return '<0.01'
  return percent.toFixed(2)
}

// Compatibility adapters: preserve the entry shape used by tasks/events/achievements.
export function parseRewardObject(reward, items = {}) {
  const rewards = []
  const rewardItemNames = []
  for (const group of parseRewardGroups(reward, { items })) {
    for (const rule of group.rules) {
      if (!rule.typeId || rule.actualProb === 0) continue
      rewards.push({
        typeId: rule.typeId, name: rule.targetName, count: rule.min,
        icon: rule.targetImg, quality: rule.targetQuality
      })
      if (group.kind !== 'fixed' && itemAt(items, rule.typeId)?.name) rewardItemNames.push(rule.targetName)
    }
  }
  return { rewards, rewardItemNames }
}

export function parseRewardEntries(rewards, items, rewardId) {
  const entries = []
  for (const group of parseRewardGroups(rewardId, { rewards, items })) {
    for (const rule of group.rules) {
      if (!rule.typeId || rule.actualProb === 0) continue
      entries.push({
        kind: group.kind === 'fixed' ? rule.mode : 'item', name: rule.targetName,
        count: rule.min, typeId: rule.typeId,
        icon: group.kind === 'fixed' ? rule.targetImg : rule.targetImg.replace(/^\/images\//, '/'),
        quality: rule.targetQuality
      })
    }
  }
  return { entries, text: [] }
}
