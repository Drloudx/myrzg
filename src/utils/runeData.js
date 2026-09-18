import { isBlacklisted } from '../config/blacklist.js'
import { formatHighlightedText, getCategoryName } from './gameMappings.js'
import { formatRewardProbability, parseAcquisitionCosts, parseItemAcquisition, parseRewardGroups } from './acquisitionRules.js'
import { isVisibleExchange } from './exchangeData.js'

const table = value => value?.datas || value || {}
const visible = item => item && item.hide !== true && !isBlacklisted(item)
export const isRuneItem = item => Number(item?.category?.[0]) === 7

// EquipEnchant.position uses equipment slots 1..5, matching categories 41..45.
export const runePositionName = position => getCategoryName(String(40 + Number(position)))

export function buildRuneEffect(item, enchants = {}, triggers = {}) {
  if (!isRuneItem(item)) return null
  const enchant = table(enchants)[item.typeId]
  const skill = table(triggers)[enchant?.skillTriggerId]?.levelData?.[String(enchant?.skillTriggerLevel)]
  if (!skill?.des) return null
  const positions = [...new Set((enchant.position || []).map(Number))]
  return {
    skillName: skill.skillName || '', skillTriggerId: enchant.skillTriggerId,
    level: Number(enchant.skillTriggerLevel), positions, positionLabels: positions.map(runePositionName),
    description: skill.des.replace(/\{([^}]+)\}/g, '$1'), desHtml: formatHighlightedText(skill.des)
  }
}

export function getRuneItemTarget(item) {
  if (!visible(item)) return null
  if (item.useAction === 'appraisal') return { path: '/runes', query: { tab: 'appraisal', id: item.typeId } }
  if (isRuneItem(item)) return { path: '/runes', query: { tab: 'runes', focus: item.typeId } }
  return null
}

export function getRuneSourceTarget(source) {
  if (source?.type === 'runeAppraisal') return { path: '/runes', query: { tab: 'appraisal', id: source.id } }
  if (source?.type === 'runeSynthesis') return { path: '/runes', query: { tab: 'synthesis', id: source.id } }
  return null
}

const itemView = item => ({
  id: item.typeId, name: item.name, icon: item.img ? `/images/Common_ItemIcon/${item.img}.webp` : '',
  quality: Number(item.quality) || 0
})

/** Config-only catalog: never infer an exchange by incrementing an item ID. */
export function buildRuneData({ itemRes = {}, enchantRes = {}, triggerRes = {}, rewardRes = {}, consumeRes = {}, exchangeRes = {}, mappingRes = {} } = {}) {
  const items = table(itemRes)
  const context = { items, rewards: rewardRes, consumes: consumeRes }
  const catalog = Object.values(items).filter(item => visible(item) && isRuneItem(item)).map(item => {
    const effect = buildRuneEffect(item, enchantRes, triggerRes)
    if (!effect) throw new Error(`Missing rune effect: ${item.typeId}`)
    return { ...itemView(item), effect }
  }).sort((a, b) => a.effect.skillTriggerId.localeCompare(b.effect.skillTriggerId) || a.effect.level - b.effect.level)
  const byId = Object.fromEntries(catalog.map(entry => [entry.id, entry]))
  const appraisals = Object.values(items).filter(item => visible(item) && item.useAction === 'appraisal').map(item => {
    const acquisition = parseItemAcquisition(item, context)
    if (!table(rewardRes)[acquisition.rewardId] || !table(consumeRes)[acquisition.consumeId]) {
      throw new Error(`Missing appraisal reward or consume: ${item.typeId}`)
    }
    if (!acquisition.groups.length || acquisition.groups.some(group => group.rules.some(rule =>
      !byId[rule.typeId] || !Number.isFinite(rule.actualProb)))) throw new Error(`Invalid appraisal pool: ${item.typeId}`)
    return { ...itemView(item), acquisition }
  }).sort((a, b) => a.id.localeCompare(b.id))

  const exchanges = exchangeRes?.itemExchange || table(exchangeRes)
  const syntheses = []
  for (const [inputId, exchangeId] of Object.entries(table(mappingRes))) {
    if (!byId[inputId]) continue
    const exchange = exchanges[exchangeId]
    if (!exchange) throw new Error(`Missing rune exchange: ${exchangeId}`)
    if (exchange.team !== 'Gem' || !isVisibleExchange(exchange)) continue
    if (!table(consumeRes)[exchange.consume] || !table(rewardRes)[exchange.reward]) throw new Error(`Incomplete rune synthesis: ${exchangeId}`)
    const costs = parseAcquisitionCosts(exchange.consume, context)
    const groups = parseRewardGroups(exchange.reward, context)
    const rules = groups.flatMap(group => group.rules)
    // The actual client only exposes a fixed, same-family, next-level result.
    if (groups.length !== 1 || groups[0].num !== 1 || rules.length !== 1
      || rules[0].actualProb !== 1 || rules[0].min !== 1 || rules[0].max !== 1
      || !byId[rules[0].typeId] || !costs.some(cost => cost.typeId === inputId && cost.min > 0)) {
      throw new Error(`Invalid rune synthesis: ${exchangeId}`)
    }
    const input = byId[inputId]
    const output = byId[rules[0].typeId]
    if (input.effect.skillTriggerId !== output.effect.skillTriggerId || output.effect.level !== input.effect.level + 1) {
      throw new Error(`Non-progressive rune synthesis: ${exchangeId}`)
    }
    syntheses.push({
      id: exchangeId, name: output.name, icon: output.icon, quality: output.quality, input, output,
      acquisition: {
        action: 'synthesis', rewardId: exchange.reward, consumeId: exchange.consume, conditionId: exchange.showCondition || '',
        sourceItemId: '', sourceItemCount: 0, costs, groups: [{ ...groups[0], kind: 'fixed' }]
      }
    })
  }
  syntheses.sort((a, b) => a.input.effect.skillTriggerId.localeCompare(b.input.effect.skillTriggerId) || a.output.effect.level - b.output.effect.level)

  const sources = {}
  const addSource = (id, source) => { (sources[id] ||= []).push(source) }
  for (const plan of appraisals) {
    for (const group of plan.acquisition.groups) {
      for (const rule of group.rules) {
        if (rule.actualProb <= 0 || rule.max <= 0) continue
        addSource(rule.typeId, {
          type: 'runeAppraisal', id: plan.id, name: plan.name,
          des: `鉴定获得 · ${formatRewardProbability(rule)}`, probability: rule.actualProb
        })
      }
    }
  }
  for (const plan of syntheses) addSource(plan.output.id, {
    type: 'runeSynthesis', id: plan.id, name: `${plan.input.name} → ${plan.output.name}`, des: '符石合成'
  })
  return {
    schemaVersion: 1, runes: catalog, appraisals, syntheses, sources,
    enchantCosts: parseAcquisitionCosts(enchantRes.consume, context)
  }
}
