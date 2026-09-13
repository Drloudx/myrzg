import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRewardEntries, parseRewardObject } from '../../src/utils/gameMappings.js'

const items = {
  item_00001: { typeId: 'item_00001', name: '银币', quality: 5, img: 'item_00001' },
  item_10001: { typeId: 'item_10001', name: '木材', quality: 1, img: 'item_10001' },
  item_30013: { typeId: 'item_30013', name: '精制生命药水', quality: 3, img: 'item_30013' }
}

const reward = {
  money: 500,
  items: [{ rules: [{ typeId: 'item_10001', min: 3 }, { typeId: 'item_30013', min: 1 }] }]
}

test('shared reward parsing preserves source item quality', () => {
  const parsed = parseRewardEntries({ reward_1: reward }, items, 'reward_1')

  assert.deepEqual(
    parsed.entries.map(entry => [entry.typeId, entry.quality]),
    [['item_00001', 5], ['item_10001', 1], ['item_30013', 3]]
  )
})

test('achievement reward parsing keeps the same quality contract', () => {
  const parsed = parseRewardObject(reward, items)

  assert.deepEqual(
    parsed.rewards.map(entry => [entry.typeId, entry.quality]),
    [['item_00001', 5], ['item_10001', 1], ['item_30013', 3]]
  )
})

test('unknown reward quality stays neutral instead of inventing a rarity', () => {
  const parsed = parseRewardEntries(
    { reward_2: { items: [{ rules: [{ typeId: 'missing_item', min: 1 }] }] } },
    items,
    'reward_2'
  )

  assert.equal(parsed.entries[0].quality, 0)
})
