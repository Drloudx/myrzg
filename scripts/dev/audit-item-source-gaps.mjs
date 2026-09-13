// Read-only audit. Prints evidence; never changes raw tables or page sources.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readJson, parsedDir } from '../parse/shared.mjs'
import { parseItemAcquisition, parseRewardGroups, getObtainableRewardRules } from '../../src/utils/acquisitionRules.js'
import { isBlacklisted } from '../../src/config/blacklist.js'
import { isVisibleEquipItem } from '../../src/utils/itemParser.js'

const parsed = name => JSON.parse(readFileSync(join(parsedDir, `${name}.json`), 'utf8'))
const items = readJson('item.json').datas
const rewards = readJson('reward.json').datas
const sources = parsed('item-sources')
const builtItems = new Map(parsed('items').items.map(item => [item.typeId, item]))
const context = { items, rewards, consumes: readJson('consume.json'), equipGroups: readJson('equip/equipGroup.json') }
const visible = Object.values(items).filter(item => !item.hide && !item.typeId.startsWith('show_') && !isBlacklisted(item)
  && (String(item.category?.[0]) !== '4' || isVisibleEquipItem(item)))
const visibleIds = new Set(visible.map(item => item.typeId))
const internal = /测试|未使用|暂不使用|弃用|[（(]废弃[）)]|(?:^|[_\s])(?:test|demo|bak)(?:[_\s\d]|$)/i
const dynamic = id => !!(builtItems.get(id)?.facilityCrafting?.length || builtItems.get(id)?.smithing?.recipes?.length)
const hasSource = id => !!sources[id]?.length || dynamic(id)
const identity = id => ({ id, name: builtItems.get(id)?.name || items[id]?.name || id })
const targets = groups => [...new Set(getObtainableRewardRules(groups)
  .map(rule => rule.typeId).filter(id => visibleIds.has(id)))]
const rewardTargets = id => targets(parseRewardGroups(id, context))
const containers = visible.filter(item => item.useAction !== 'appraisal').flatMap(item => {
  const acquisition = parseItemAcquisition(item, context)
  if (!acquisition) return []
  const outputIds = targets(acquisition.groups)
  const parentReward = rewards[acquisition.rewardId]
  const suspect = internal.test([item.name, item.desc, parentReward?.tip, ...(parentReward?.category || [])].join(' '))
  return [{ ...identity(item.typeId), action: acquisition.action, rewardId: acquisition.rewardId,
    costs: acquisition.costs.map(cost => ({ ...identity(cost.typeId), count: cost.min })),
    suspect, parentHasSource: hasSource(item.typeId),
    missing: outputIds.filter(id => !(sources[id] || []).some(source => source.id === item.typeId || source.sourceItemId === item.typeId))
      .map(id => ({ ...identity(id), hasOtherSource: hasSource(id) })),
    outputIds }]
})
const reachable = new Set(visible.filter(item => hasSource(item.typeId)).map(item => item.typeId))
let changed = true
while (changed) {
  changed = false
  for (const pack of containers) {
    if (pack.suspect || !reachable.has(pack.id)) continue
    for (const id of pack.outputIds) if (!reachable.has(id)) { reachable.add(id); changed = true }
  }
}
const confirmed = containers.filter(pack => !pack.suspect && reachable.has(pack.id) && pack.missing.length)
const unconfirmed = containers.filter(pack => !pack.suspect && !reachable.has(pack.id) && pack.missing.length)
const pools = parsed('gacha').pools
const gacha = pools.map(pool => ({ id: pool.id, name: pool.name, kind: pool.kind,
  eggs: pool.kind === 'pet' ? [...new Set(pool.tiers.flatMap(tier => tier.candidates.filter(c => c.weight > 0).map(c => c.itemId)))]
    .map(id => ({ ...identity(id), hasOtherSource: hasSource(id) })) : [],
  bonus: pool.bonus.map(entry => identity(entry.typeId)),
  conversions: [...new Set(pool.tiers.flatMap(tier => tier.candidates.flatMap(c => c.duplicate?.overflow?.typeId || [])))].map(identity)
}))
const battles = readJson('battle.json').datas
const daily = Object.values(readJson('dailyWork.json').plans).map(plan => ({ id: plan.typeId, name: plan.name,
  special: !!plan.special, condition: plan.condition,
  battles: plan.plan.map(entry => {
    const battle = battles[entry.battle]
    return { id: entry.battle, name: entry.name, condition: entry.condition, reward: battle?.reward,
      directOutputs: rewardTargets(battle?.reward).map(id => ({ ...identity(id), hasOtherSource: hasSource(id) })) }
  }) }))
const towers = Object.values(readJson('tower.json').datas).map(tower => ({ id: tower.typeId, name: tower.name,
  outputs: [...new Set(tower.layers.flatMap(layer => [layer.reward, layer.onceReward]).flatMap(rewardTargets))]
    .map(id => ({ ...identity(id), hasOtherSource: hasSource(id) })) }))
const dismantle = [...new Set(Object.values(readJson('equipDec.json').equipDec).flatMap(tier => Object.values(tier)).flatMap(rewardTargets))]
  .map(id => ({ ...identity(id), hasOtherSource: hasSource(id) }))
// Use only current catalog details and actual reward fields, never previewReward.
const dungeonRelations = []
for (const dungeon of parsed('dungeons').dungeons) {
  for (const summary of [...(dungeon.battles || []), ...(dungeon.storyBattles || [])]) {
    const battle = JSON.parse(readFileSync(join(parsedDir, summary.detailFile), 'utf8'))
    const add = (entries, location) => {
      for (const entry of entries || []) {
        if (!visibleIds.has(entry.typeId) || !(entry.max > 0) || !(entry.actualProb > 0)) continue
        if ((sources[entry.typeId] || []).some(source => source.type === 'dungeon' && source.id === summary.id)) continue
        dungeonRelations.push({ ...identity(entry.typeId), dungeon: dungeon.name, battleId: summary.id,
          battle: summary.name, location, hasOtherSource: hasSource(entry.typeId) })
      }
    }
    add(battle.reward, '通关结算')
    add(battle.firstReward, '首次通关')
    for (const room of battle.rooms || []) for (const variant of room.variants || []) {
      for (const monster of variant.monsters || []) for (const drop of monster.drops || []) add(drop.reward, `${variant.name} · ${monster.name}掉落`)
      for (const collection of variant.collections || []) add(collection.reward, `${variant.name} · ${collection.name}`)
    }
  }
}
const dungeonMissing = [...new Map(dungeonRelations.map(entry => [`${entry.id}|${entry.battleId}|${entry.location}`, entry])).values()]
const report = {
  counts: { visible: visible.length, structured: visible.filter(item => sources[item.typeId]?.length).length,
    noStructured: visible.filter(item => !sources[item.typeId]?.length).length,
    dynamicOnly: visible.filter(item => !sources[item.typeId]?.length && dynamic(item.typeId)).length,
    noStructuredOrDynamic: visible.filter(item => !hasSource(item.typeId)).length,
    confirmedParents: confirmed.length, confirmedRelations: confirmed.reduce((sum, pack) => sum + pack.missing.length, 0),
    confirmedTargets: new Set(confirmed.flatMap(pack => pack.missing.map(item => item.id))).size,
    newlyCoveredTargets: [...new Set(confirmed.flatMap(pack => pack.missing.map(item => item.id)))].filter(id => !hasSource(id)).map(identity) },
  confirmed, unconfirmed, suspect: containers.filter(pack => pack.suspect || !pack.outputIds.length),
  gacha, daily, towers, dismantle,
  dungeon: {
    targets: [...new Map(dungeonMissing.map(entry => [entry.id, identity(entry.id)])).values()],
    withoutSource: [...new Map(dungeonMissing.filter(entry => !entry.hasOtherSource).map(entry => [entry.id, entry])).values()],
    examples: dungeonMissing.filter(entry => ['item_19300', 'item_19302', 'item_19303'].includes(entry.id)).slice(0, 6)
  },
  mechanismCounts: {
    regularDailyPlans: daily.filter(plan => !plan.special).length,
    regularDailyBattles: daily.filter(plan => !plan.special).reduce((sum, plan) => sum + plan.battles.length, 0),
    regularDailyTargets: new Set(daily.filter(plan => !plan.special).flatMap(plan => plan.battles.flatMap(battle => battle.directOutputs.map(item => item.id)))).size,
    regularDailyWithoutSource: [...new Map(daily.filter(plan => !plan.special).flatMap(plan => plan.battles.flatMap(battle => battle.directOutputs.filter(item => !item.hasOtherSource).map(item => [item.id, item])))).values()],
    gachaEggTargets: new Set(gacha.flatMap(pool => pool.eggs.map(item => item.id))).size,
    gachaEggWithoutSource: [...new Map(gacha.flatMap(pool => pool.eggs.filter(item => !item.hasOtherSource).map(item => [item.id, item]))).values()]
  },
  noSource: visible.filter(item => !hasSource(item.typeId)).map(item => ({ ...identity(item.typeId), action: item.useAction, origin: item.origin || [] }))
}
const section = process.argv[2]
console.log(JSON.stringify(section ? report[section] : report, null, 2))
