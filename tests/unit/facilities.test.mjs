import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRegularFacilityRecipes, indexRegularFacilityRecipes } from '../../src/utils/facilityData.js'

const maps = {
  formulaRes: { datas: {
    visible: { workbenchId: 'workbench', buildLevel: 7, sort: 2, consume: 'make', reward: 'made', showItemTypeId: 'result', itemCnt: 1, makeTime: 45 },
    hidden: { workbenchId: 'workbench', buildLevel: 7, hide: true, consume: 'make', reward: 'made', showItemTypeId: 'result' },
    unrelated: { workbenchId: 'cook', buildLevel: 1, consume: 'make', reward: 'made', showItemTypeId: 'result' }
  } },
  consumeRes: { datas: { make: { items: [{ typeId: 'ore', num: 3 }] } } },
  rewardRes: { datas: { made: { items: [{ rules: [{ mode: 'item', typeId: 'result', min: 2, max: 2 }] }] } } },
  itemRes: { datas: {
    result: { typeId: 'result', name: '制作物', img: 'result_icon', quality: 3 },
    ore: { typeId: 'ore', name: '矿石', img: 'ore_icon', quality: 2 }
  } }
}

test('facility formulas use real output, consume materials and preserve levels above five', () => {
  const recipes = buildRegularFacilityRecipes(maps)
  assert.equal(recipes.length, 1)
  assert.equal(recipes[0].level, 7)
  assert.deepEqual(recipes[0].output, {
    typeId: 'result', name: '制作物', img: '/images/Common_ItemIcon/result_icon.webp', quality: 3, min: 2, max: 2
  })
  assert.deepEqual(recipes[0].materials, [{
    typeId: 'ore', name: '矿石', img: '/images/Common_ItemIcon/ore_icon.webp', quality: 2, num: 3
  }])
  assert.equal(indexRegularFacilityRecipes(recipes).result[0].id, 'visible')
})
