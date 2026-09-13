import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  parseRewardGroups, parseItemAcquisition, parseAcquisitionCosts, parseEquipmentPool,
  parseRewardObject, parseRewardEntries, formatRewardProbability, formatRewardGroupLabel
} from '../../src/utils/acquisitionRules.js'
import * as mappings from '../../src/utils/gameMappings.js'
import { buildItemData, getItemAcquisition, parseItemRewards } from '../../src/utils/itemParser.js'
import { buildRegularFacilityRecipes } from '../../src/utils/facilityData.js'

const items = {
  a: { typeId: 'a', name: 'Material A', img: 'a', quality: 2 },
  b: { typeId: 'b', name: 'Material B', img: 'b', quality: 3 },
  sword: { typeId: 'sword', name: 'Sword', img: 'sword', quality: 1 },
  item_00001: { typeId: 'item_00001', name: 'Silver', img: 'item_00001', quality: 5 }
}
const rule = (typeId, chance = 1, extra = {}) => ({ mode: 'item', typeId, chance, min: 1, max: 1, ...extra })
const reward = (rules, extra = {}) => ({ items: [{ rate: 1, num: 1, rules, ...extra }] })

test('weighted probability includes rate; draw count is not item count', () => {
  const [group] = parseRewardGroups(reward([rule('a', 3, { min: 2, max: 5 }), rule('b')], { rate: 0.2, num: 4 }), { items })
  assert.equal(group.num, 4)
  assert.equal(group.rules[0].prob, 0.75)
  assert.ok(Math.abs(group.rules[0].actualProb - 0.15) < 1e-12)
  assert.deepEqual([group.rules[0].min, group.rules[0].max], [2, 5])
  assert.equal(group.rules[0].cumulativeProb, undefined)
})

test('zero rates, draw counts, weights and quantities are never defaulted to one', () => {
  for (const extra of [{ rate: 0 }, { num: 0 }]) {
    const [group] = parseRewardGroups(reward([rule('a')], extra), { items })
    assert.equal(group.rules[0].actualProb, 0)
    assert.equal(parseRewardObject(reward([rule('a')], extra), items).rewards.length, 0)
  }
  const [group] = parseRewardGroups(reward([rule('a', 0, { min: 0, max: 0 }), rule('b')]), { items })
  assert.deepEqual([group.rules[0].min, group.rules[0].max, group.rules[0].actualProb], [0, 0, 0])
})

test('absent or all-zero weights do not invent a uniform distribution', () => {
  for (const rules of [[{ mode: 'item', typeId: 'a' }], [rule('a', 0), rule('b', 0)], [rule('a'), { typeId: 'b' }]]) {
    const [group] = parseRewardGroups(reward(rules), { items })
    assert.equal(group.rules[0].actualProb, undefined)
    assert.equal(formatRewardProbability(group.rules[0]), '')
    assert.equal(formatRewardGroupLabel(group), '奖励内容')
  }
})

test('top-level currencies are separate guaranteed rewards including currency-only packs', () => {
  const groups = parseRewardGroups({ money: 500, ke: 3, ti: 0 }, { items })
  assert.equal(groups[0].kind, 'fixed')
  assert.equal(formatRewardGroupLabel(groups[0]), '固定获得')
  assert.deepEqual(groups[0].rules.map(r => [r.typeId, r.min, r.actualProb]), [
    ['item_00001', 500, 1], ['item_00002', 3, 1]
  ])
  assert.equal(groups[0].rules[0].targetQuality, 5)
})

test('random currency rules retain ranges and use shared currency IDs', () => {
  const [group] = parseRewardGroups(reward([
    { mode: 'randomMoney', min: 100, max: 300, chance: 1 },
    { mode: 'randomKe', min: 2, max: 5, chance: 1 }
  ]), { items })
  assert.deepEqual(group.rules.map(r => [r.typeId, r.min, r.max]), [['item_00001', 100, 300], ['item_00002', 2, 5]])
})

test('fixed equipment preserves configured quality and generation fields', () => {
  const [group] = parseRewardGroups(reward([rule('sword', 1, { mode: 'equip', quality: 5, equipLevel: 3, prefix: 'poison' })]), { items })
  assert.equal(group.rules[0].targetQuality, 5)
  assert.equal(group.rules[0].prefix, 'poison')
  assert.equal(group.rules[0].equipLevel, 3)
  assert.deepEqual(group.rules[0].target, { query: { itemId: 'sword' } })
})

test('equipment pool keeps candidates/quality weights without fabricating a fixed item', () => {
  const equipGroups = {
    equipGroups: { swords: { type: [{ typeId: 'sword', chance: 3 }, { typeId: 'b', chance: 1 }] } },
    qualityGroups: { rare: [{ quality: 3, chance: 1 }, { quality: 5, chance: 4 }] }
  }
  const [group] = parseRewardGroups(reward([{ mode: 'equipGroup', typeId: 'preview', showItemTypeId: 'preview', equipTypeGroup: 'swords', qualityGroup: 'rare', chance: 1 }]), { items, equipGroups })
  const pool = group.rules[0]
  assert.equal(pool.typeId, undefined)
  assert.equal(pool.target, null)
  assert.equal(pool.candidates[0].prob, 0.75)
  assert.equal(pool.qualities[1].prob, 0.8)
  assert.deepEqual(parseEquipmentPool(pool, { items, equipGroups }), pool.candidates)
  assert.equal(parseRewardObject(reward([{ ...pool, chance: 1 }]), items).rewards.length, 0)
})

test('self-selection is not labelled random or guaranteed for every candidate', () => {
  const result = parseItemAcquisition({ typeId: 'pack', useAction: 'getRewardSelect', useActionPara: { rewards: [{ itemTypeId: 'a', num: 10 }, { itemTypeId: 'b', num: 2 }] } }, { items })
  assert.equal(result.groups[0].isSelect, true)
  assert.equal(result.groups[0].rules[0].actualProb, undefined)
  assert.equal(result.groups[0].rules[0].min, 10)
  assert.equal(formatRewardProbability(result.groups[0].rules[0]), '自选获得')
})

test('locked chest uses explicit key cost and opens its referenced reward', () => {
  const result = parseItemAcquisition({ typeId: 'chest', useAction: 'getRewardCost', useActionPara: { itemTypeId: 'b', itemNum: 2, reward: 'open' } }, { items, rewards: { datas: { open: reward([rule('a')]) } } })
  assert.equal(result.sourceItemCount, 1)
  assert.deepEqual(result.costs.map(r => [r.typeId, r.min]), [['b', 2]])
  assert.equal(result.groups[0].rules[0].typeId, 'a')
})

test('appraisal uses consume table, not the similarly named reward table', () => {
  const result = parseItemAcquisition({ typeId: 'rune', useAction: 'appraisal', useActionPara: { reward: 'pool', consume: 'fee' } }, {
    items, rewards: { pool: reward([rule('a'), rule('b')]) }, consumes: { datas: { fee: { money: 100, items: [{ typeId: 'b', num: 3 }] } } }
  })
  assert.equal(result.consumeId, 'fee')
  assert.deepEqual(result.costs.map(r => [r.typeId, r.min]), [['item_00001', 100], ['b', 3]])
  assert.equal(result.groups[0].rules[0].actualProb, 0.5)
})

test('missing tables and unsupported actions degrade without diagnostic UI text', () => {
  assert.equal(parseItemAcquisition({ useAction: 'getHero', useActionPara: {} }), null)
  assert.deepEqual(parseAcquisitionCosts('missing'), [])
  assert.deepEqual(parseRewardGroups('missing'), [])
  assert.deepEqual(parseRewardGroups({ items: [null, {}] }), [])
  assert.equal(parseRewardGroups(reward([rule('missing')]))[0].rules[0].target, null)
})

test('parsing is deterministic, JSON-safe, and never mutates source configs', () => {
  const context = { items, rewards: { box: reward([rule('a', '3'), rule('b', '1')]) } }
  const before = JSON.stringify(context)
  const first = parseRewardGroups('box', context)
  assert.deepEqual(first, parseRewardGroups('box', context))
  assert.equal(JSON.stringify(context), before)
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first)
})

test('legacy entry points are the same functions, not separate reward implementations', () => {
  assert.equal(mappings.parseRewardObject, parseRewardObject)
  assert.equal(mappings.parseRewardEntries, parseRewardEntries)
})

test('build-time item and equipment consumers use the exact shared acquisition payload', () => {
  const source = { typeId: 'pack', useAction: 'getReward', useActionPara: { reward: 'box' } }
  const data = buildItemData({ itemRes: { datas: { ...structuredClone(items), pack: source } }, rewardRes: { datas: { box: reward([rule('a')]) } } })
  const pack = data.items.find(item => item.typeId === 'pack')
  assert.equal(getItemAcquisition(pack), pack.acquisition)
  assert.equal(parseItemRewards(pack), pack.acquisition.groups)
})

test('facility output must not resurrect a zero-rate reward via its preview ID', () => {
  assert.deepEqual(buildRegularFacilityRecipes({
    formulaRes: { datas: { make: { workbenchId: 'workbench', reward: 'box', showItemTypeId: 'a' } } },
    rewardRes: { datas: { box: reward([rule('a')], { rate: 0 }) } }, itemRes: { datas: items }
  }), [])
})

test('all nine real appraisal pools resolve costs and weighted probabilities', () => {
  const read = name => JSON.parse(readFileSync(new URL(`../../raw/${name}.json`, import.meta.url), 'utf8'))
  const context = { items: read('item'), rewards: read('reward'), consumes: read('consume') }
  const runes = Object.values(context.items.datas).filter(item => item.useAction === 'appraisal')
  assert.equal(runes.length, 9)
  for (const item of runes) {
    const result = parseItemAcquisition(item, context)
    assert.ok(result.costs.length > 0)
    assert.ok(result.groups.length > 0)
    for (const group of result.groups) {
      assert.ok(Math.abs(group.rules.reduce((sum, rule) => sum + rule.actualProb, 0) - 1) < 1e-12)
      assert.ok(group.rules.every(rule => rule.target && rule.min === 1 && rule.max === 1))
    }
  }
})
