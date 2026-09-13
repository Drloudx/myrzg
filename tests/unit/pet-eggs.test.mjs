import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  buildPetEggsData,
  calcPetDisposalRecommendation,
  PET_DISPOSAL_RULE
} from '../../src/utils/petEggsData.js'

const petJson = JSON.parse(readFileSync(new URL('../../raw/pet.json', import.meta.url), 'utf8'))

test('处置建议边界保持唯一且明确', () => {
  assert.deepEqual(PET_DISPOSAL_RULE, { feedBelow: 2.2, sellAbove: 3 })
  assert.equal(calcPetDisposalRecommendation(219, 100).text, '喂')
  assert.equal(calcPetDisposalRecommendation(220, 100).text, '按需选择')
  assert.equal(calcPetDisposalRecommendation(300, 100).text, '按需选择')
  assert.equal(calcPetDisposalRecommendation(301, 100).text, '卖')
  assert.equal(calcPetDisposalRecommendation(100, 0).text, '卖')
})

test('全量魔物收益按当前数据自然断层分为 4 喂、8 按需、20 卖', () => {
  const { pets } = buildPetEggsData({ petJson })
  const counts = pets.reduce((result, pet) => {
    result[pet.recommendationKey] = (result[pet.recommendationKey] || 0) + 1
    return result
  }, {})

  assert.equal(pets.length, 32)
  assert.deepEqual(counts, { optional: 8, feed: 4, sell: 20 })
  assert.equal(pets.find(pet => pet.name === '秋风妖精').recommendationText, '喂')
  assert.equal(pets.find(pet => pet.name === '角布林').recommendationText, '按需选择')
  assert.equal(pets.find(pet => pet.name === '掘地芙洛波').recommendationText, '卖')
})
