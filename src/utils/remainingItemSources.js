import { isBlacklisted } from '../config/blacklist.js'
import { getRarityName } from './gameMappings.js'
import { isVisibleEquipItem } from './itemParser.js'
import { parseRewardGroups, parseItemAcquisition, getObtainableRewardRules,
  formatRewardProbability } from './acquisitionRules.js'
import { isInternalSource, isUsableSourceEntry } from './supplementalItemSources.js'

const table = value => value?.datas || value || {}
const ranges = values => {
  const sorted = [...new Set(values)].sort((a, b) => a - b)
  const parts = []
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i]
    while (sorted[i + 1] === sorted[i] + 1) i++
    parts.push(first === sorted[i] ? `${first}` : `${first}～${sorted[i]}`)
  }
  return parts.join('、')
}

/** Build confirmed mechanisms first, then follow item containers from reachable parents. */
export function buildRemainingItemSources(maps, existingSources = {}) {
  const items = table(maps.itemJson)
  const rewards = table(maps.rewardJson)
  const context = { items, rewards, consumes: maps.consumeJson, equipGroups: maps.equipGroupJson }
  const visible = item => isUsableSourceEntry(item, item?.typeId) && !item.typeId?.startsWith('show_')
    && !isBlacklisted(item) && (String(item.category?.[0]) !== '4' || isVisibleEquipItem(item))
  const sources = {}
  const seen = new Set()
  const add = (id, source) => {
    if (!visible(items[id])) return
    const key = `${id}|${JSON.stringify(source)}`
    if (seen.has(key)) return
    seen.add(key)
    ;(sources[id] ||= []).push(source)
  }
  const rewardRules = id => {
    const reward = rewards[id]
    if (!reward || isInternalSource([reward.tip, ...(reward.category || [])].join(' '))) return []
    return getObtainableRewardRules(parseRewardGroups(reward, context))
  }
  const addReward = (id, source) => {
    for (const rule of rewardRules(id)) {
      add(rule.typeId, source)
    }
  }

  const battles = table(maps.battleJson)
  for (const plan of Object.values(maps.dailyWorkJson?.plans || {})) {
    if (!isUsableSourceEntry(plan, plan.typeId) || plan.special || plan.condition === 'false') continue
    for (const entry of plan.plan || []) {
      const battle = battles[entry.battle]
      if (!isUsableSourceEntry(battle, entry.battle) || entry.condition === 'false') continue
      const base = { type: 'dailyPlan', id: entry.battle,
        name: `${plan.name} · ${entry.name}`, des: '通关结算奖励' }
      addReward(battle.reward, base)
      addReward(battle.firstReward, { ...base, des: '首次通关奖励' })
    }
  }

  for (const tower of Object.values(table(maps.towerJson))) {
    if (!isUsableSourceEntry(tower, tower.typeId)) continue
    // Merge by actual output, not reward amount; retain exact layers and first-clear semantics.
    const groups = new Map()
    for (const layer of tower.layers || []) for (const field of ['reward', 'onceReward']) {
      if (!(Number(layer.layer) > 0) || !layer[field]) continue
      for (const rule of rewardRules(layer[field])) {
        const key = `${field}:${rule.typeId}`
        if (!groups.has(key)) groups.set(key, { field, itemId: rule.typeId, layers: [] })
        groups.get(key).layers.push(Number(layer.layer))
      }
    }
    for (const group of groups.values()) add(group.itemId, { type: 'tower', id: `${tower.typeId}:${group.field}`,
      name: tower.name,
      des: `第 ${ranges(group.layers)} 层 · ${group.field === 'onceReward' ? '首次通关奖励' : '通关结算奖励'}` })
  }

  for (const [level, qualities] of Object.entries(maps.equipDecJson?.equipDec || {})) {
    const groups = new Map()
    for (const [quality, rewardId] of Object.entries(qualities)) {
      for (const rule of rewardRules(rewardId)) {
        if (!groups.has(rule.typeId)) groups.set(rule.typeId, new Set())
        groups.get(rule.typeId).add(Number(quality))
      }
    }
    for (const [itemId, qualitySet] of groups) {
      const qualityList = [...qualitySet].sort((a, b) => a - b)
      const restriction = [1, 2, 3, 4, 5].every(quality => qualitySet.has(quality))
        ? '' : ` · ${qualityList.map(getRarityName).join('、')}`
      add(itemId, { type: 'dismantle', id: level, name: '装备分解',
        des: `第 ${level} 阶${restriction}装备分解` })
    }
  }

  // Consume the same admitted pools as the simulator; do not map hero-state fragments to item_59 IDs.
  for (const pool of maps.gachaData?.pools || []) {
    const base = { type: 'gacha', id: pool.id, poolKind: pool.kind, poolTypeId: pool.poolTypeId,
      name: pool.name }
    for (const tier of pool.tiers || []) {
      if (!(tier.weight > 0)) continue
      for (const candidate of tier.candidates || []) {
        if (!(candidate.weight > 0)) continue
        if (pool.kind === 'pet') add(candidate.itemId, { ...base, des: '贩售随机获得' })
        const duplicate = candidate.duplicate
        if (pool.kind === 'hero' && duplicate?.overflow?.count > 0) {
          add(duplicate.overflow.typeId, { ...base,
            des: '记忆碎片达到上限后，重复招募转化' })
        }
      }
    }
    for (const bonus of pool.bonus || []) if (bonus.count > 0) {
      add(bonus.typeId, { ...base, des: `${pool.kind === 'pet' ? '贩售' : '招募'}附赠` })
    }
  }

  const reachable = new Set([...Object.keys(existingSources).filter(id => existingSources[id]?.length), ...Object.keys(sources)])
  const pending = Object.values(items).filter(item => visible(item) && item.useAction !== 'appraisal')
    .flatMap(item => {
      const rule = parseItemAcquisition(item, context)
      if (!rule || (rule.rewardId && !rewardRules(rule.rewardId).length)) return []
      return [{ item, rule }]
    })
  const visited = new Set()
  let changed = true
  while (changed) {
    changed = false
    for (const { item, rule } of pending) {
      if (visited.has(item.typeId) || !reachable.has(item.typeId)) continue
      visited.add(item.typeId)
      for (const output of getObtainableRewardRules(rule.groups)) {
        if (output.typeId === item.typeId) continue
        const action = output.isSelect ? '自选获得'
          : output.groupKind === 'fixed' || output.actualProb === 1 ? '使用获得' : '使用后随机获得'
        // Probability belongs in chest / fixed equipment sources; full usage rules stay on the parent item.
        const keepProbability = !output.isSelect && (/宝箱/.test(item.name) || output.mode === 'equip')
        add(output.typeId, { type: 'container', id: item.typeId, sourceItemId: item.typeId, name: item.name,
          des: [action, keepProbability && formatRewardProbability(output)].filter(Boolean).join(' · ') })
        if (sources[output.typeId]?.length && !reachable.has(output.typeId)) {
          reachable.add(output.typeId)
          changed = true
        }
      }
    }
  }
  return sources
}
