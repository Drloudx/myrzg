import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { buildRunesFile } from '../../scripts/parse/runes.mjs'
import { build as buildSearch } from '../../scripts/parse/search.mjs'
import { buildRuneData, buildRuneEffect, getRuneItemTarget, getRuneSourceTarget } from '../../src/utils/runeData.js'
import { scaleAcquisition } from '../../src/utils/acquisitionRules.js'
import { validateResource } from '../../src/utils/resourceSchemas.js'

const raw = file => JSON.parse(readFileSync(new URL(`../../raw/${file}.json`, import.meta.url), 'utf8'))
const context = {
  itemRes: raw('item'), enchantRes: raw('equip/equipEnchant'), triggerRes: raw('skillTrigger'),
  rewardRes: raw('reward'), consumeRes: raw('consume'), exchangeRes: raw('itemExchange'),
  mappingRes: raw('fushi_itemExchangeMapping')
}
const data = buildRunesFile().data

test('formal catalog has 19 rune families, six levels, nine appraisals and 95 syntheses', () => {
  assert.deepEqual([data.runes.length, data.appraisals.length, data.syntheses.length], [114, 9, 95])
  assert.equal(new Set(data.runes.map(rune => rune.effect.skillTriggerId)).size, 19)
  assert.ok(data.runes.every(rune => !rune.name.includes('未使用')))
  assert.equal('divineStones' in data, false)
  assert.ok([...data.runes, ...data.appraisals].every(entry => existsSync(new URL(`../../public${entry.icon}`, import.meta.url))))
  assert.deepEqual(data.runes.find(rune => rune.id === 'item_19310').effect,
    buildRuneEffect(context.itemRes.datas.item_19310, context.enchantRes, context.triggerRes))
  assert.equal(data.enchantCosts[0].min, 500)
})

test('synthesis follows explicit mapping, three inputs and configured silver to next level', () => {
  for (const plan of data.syntheses) {
    assert.equal(context.mappingRes[plan.input.id], plan.id)
    assert.equal(plan.output.effect.level, plan.input.effect.level + 1)
    assert.equal(plan.acquisition.costs.find(cost => cost.typeId === plan.input.id).min, 3)
    assert.equal(plan.acquisition.costs.find(cost => cost.typeId === 'item_00001').min, plan.input.effect.level * 300)
    assert.equal(plan.acquisition.groups[0].kind, 'fixed')
    assert.equal(plan.acquisition.groups[0].rules[0].min, 1)
  }
  assert.ok(!data.syntheses.some(plan => plan.input.effect.level === 6))
  const noMapping = buildRuneData({ ...context, mappingRes: {} })
  assert.equal(noMapping.syntheses.length, 0)
})

test('missing references or non-progressive synthesis fail instead of inventing rules', () => {
  assert.throws(() => buildRuneData({ ...context, mappingRes: { item_19310: 'missing' } }), /Missing rune exchange/)
  assert.throws(() => buildRuneData({ ...context, triggerRes: {} }), /Missing rune effect/)
  assert.throws(() => buildRuneData({ ...context, consumeRes: {} }), /Missing appraisal/)
  assert.throws(() => buildRuneData({ ...context, mappingRes: { item_19310: 'item_19312' } }), /Invalid rune synthesis/)
})

test('batch appraisal scales costs and draws but preserves per-draw probability and quantity', () => {
  const original = data.appraisals.find(plan => plan.id === 'item_19304').acquisition
  const snapshot = JSON.stringify(original)
  const batch = scaleAcquisition(original, 3)
  assert.equal(batch.sourceItemCount, 3)
  assert.equal(batch.costs[0].min, 300)
  assert.equal(batch.groups[0].num, 3)
  assert.equal(batch.groups[0].rules[0].actualProb, 0.235)
  assert.equal(batch.groups[0].rules[0].min, 1)
  assert.equal(JSON.stringify(original), snapshot)
})

test('batch synthesis scales guaranteed output and all costs with integer bounds', () => {
  const original = data.syntheses[0].acquisition
  const batch = scaleAcquisition(original, 2)
  assert.deepEqual(batch.costs.map(cost => cost.min), [600, 6])
  assert.equal(batch.groups[0].rules[0].min, 2)
  assert.equal(original.groups[0].rules[0].min, 1)
  for (const count of [0, -1, 1.5, 1000, NaN, Infinity]) assert.throws(() => scaleAcquisition(original, count), RangeError)
  assert.equal(scaleAcquisition(null), null)
})

test('item and source routes resolve exact catalog entries and plans', () => {
  for (const rune of data.runes) assert.equal(getRuneItemTarget(context.itemRes.datas[rune.id]).query.focus, rune.id)
  for (const plan of data.appraisals) assert.equal(getRuneItemTarget(context.itemRes.datas[plan.id]).query.id, plan.id)
  assert.equal(getRuneItemTarget({ typeId: 'item_19310', category: [7], hide: true }), null)
  for (const sources of Object.values(data.sources)) for (const source of sources) {
    const target = getRuneSourceTarget(source)
    const plans = source.type === 'runeAppraisal' ? data.appraisals : data.syntheses
    assert.ok(plans.some(plan => plan.id === target.query.id))
    if (source.probability !== undefined) assert.ok(source.probability > 0)
  }
})

test('search merges both source types and removes only duplicate gem exchanges', () => {
  const sources = buildSearch().files.find(file => file.file === 'parsed/item-sources.json').data
  for (const plan of data.syntheses) {
    const entries = sources[plan.output.id]
    assert.equal(entries.filter(source => source.type === 'runeSynthesis' && source.id === plan.id).length, 1)
    assert.equal(entries.filter(source => source.type === 'exchange' && source.category === 'gem' && source.id === plan.id).length, 0)
  }
  assert.ok(sources.item_19440.some(source => source.type === 'runeAppraisal'))
})

test('runtime schema validates complete catalog and rejects malformed effects and rules', () => {
  assert.equal(validateResource('data/parsed/runes.json', data), true)
  for (const invalid of [{}, { ...data, runes: [{}] }, { ...data, syntheses: [{ id: 'x', name: 'x' }] }, { ...data, enchantCosts: null }]) {
    assert.throws(() => validateResource('data/parsed/runes.json', invalid), /数据格式不完整/)
  }
})
