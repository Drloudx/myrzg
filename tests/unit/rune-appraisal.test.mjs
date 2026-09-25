import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRunesFile } from '../../scripts/parse/runes.mjs'
import { appraiseRunes } from '../../src/utils/runeAppraisal.js'
import { formatRewardProbability } from '../../src/utils/acquisitionRules.js'

const data = buildRunesFile().data
const small = data.appraisals[0].acquisition

test('all nine pools have the audited level probabilities', () => {
  const expected = [[.94, .05, .01], [.3, .6, .1], [0, .5, .5]]
  data.appraisals.forEach((plan, index) => {
    assert.equal(plan.acquisition.groups.length, 1)
    const group = plan.acquisition.groups[0]
    assert.deepEqual([group.rate, group.num], [1, 1])
    const levels = [0, 0, 0]
    for (const rule of group.rules) {
      const level = data.runes.find(rune => rune.id === rule.typeId).effect.level
      levels[level - 1] += rule.actualProb
    }
    levels.forEach((value, level) => assert.ok(Math.abs(value - expected[index % 3][level]) < 1e-12))
  })
})

test('weighted sampling matches every raw weight interval in every pool, without rounding', () => {
  for (const plan of data.appraisals) {
    const acquisition = plan.acquisition
    const before = JSON.stringify(acquisition)
    const rules = acquisition.groups[0].rules
    const total = rules.reduce((sum, rule) => sum + Number(rule.chance), 0)
    let position = 0
    const counts = new Map()
    while (position < total) {
      const batch = appraiseRunes(acquisition, Math.min(999, total - position), () => (position++ + .5) / total)
      for (const result of batch.results) counts.set(result.typeId, (counts.get(result.typeId) || 0) + result.count)
    }
    for (const rule of rules) assert.equal(counts.get(rule.typeId), Number(rule.chance))
    assert.equal(JSON.stringify(acquisition), before)
  }
})

test('independent rolls allow repeats, preserve ordering and aggregate the last batch', () => {
  const samples = [0, 1 - Number.EPSILON, 0]
  const batch = appraiseRunes(small, 3, () => samples.shift())
  const rules = small.groups[0].rules
  assert.deepEqual(batch.draws, [rules[0].typeId, rules.at(-1).typeId, rules[0].typeId])
  assert.deepEqual(batch.results.map(result => result.count), [2, 1])
  assert.equal(batch.count, 3)
  assert.equal(batch.sourceItemId, small.sourceItemId)
})

test('invalid counts, randomness and unsupported configurations fail explicitly', () => {
  for (const count of [0, -1, 1.5, 1000, NaN, Infinity]) assert.throws(() => appraiseRunes(small, count), RangeError)
  for (const random of [-1, 1, NaN, Infinity]) assert.throws(() => appraiseRunes(small, 1, () => random))
  for (const change of [group => { group.rate = .5 }, group => { group.num = 2 },
    group => { group.rules[0].chance = undefined }, group => { group.rules[0].min = 2 },
    group => { group.rules.forEach(rule => { rule.chance = 0 }) }]) {
    const copy = structuredClone(small)
    change(copy.groups[0])
    assert.throws(() => appraiseRunes(copy, 1))
  }
  assert.throws(() => appraiseRunes(null, 1))
})

test('zero-weight entries cannot be drawn', () => {
  const copy = structuredClone(small)
  copy.groups[0].rules[0].chance = 0
  assert.equal(appraiseRunes(copy, 1, () => 0).draws[0], copy.groups[0].rules[1].typeId)
})

test('shared probability text preserves 1.25%, 0.25% and repeating fractions', () => {
  for (const [value, text] of [[.235, '23.50'], [.0125, '1.25'], [.0025, '0.25'],
    [94 / 1100, '8.55'], [1 / 1100, '0.09'], [0, '0.00'], [1e-8, '<0.01']]) {
    assert.equal(formatRewardProbability({ actualProb: value }), `概率 ${text}%`)
    assert.equal(formatRewardProbability({ actualProb: value, groupCount: 2 }), `单次抽取 ${text}%`)
  }
  assert.equal(formatRewardProbability({ actualProb: 1 }), '必定获得')
  assert.equal(formatRewardProbability({ actualProb: 1, groupCount: 2 }), '单次抽取必定获得')
})
