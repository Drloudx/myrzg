import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEquipAttributeItems, buildSmithingData } from '../../src/utils/itemParser.js'
import { translateStatName } from '../../src/utils/gameMappings.js'

const fixture = () => ({
  itemExchangeRandomRes: {
    datas: {
      forge_sword: {
        typeId: 'forge_sword', team: 'forge_c1', consume: 'make_sword', ruleTeamId: 'equipMake',
        reward: { 3: 'blue_sword', 4: 'purple_sword', 5: 'orange_sword' },
        tip: '过期策划备注：30蓝60紫10金'
      },
      forge_helmet: {
        typeId: 'forge_helmet', team: 'forge_c1', consume: 'make_helmet', ruleTeamId: 'equipMake',
        reward: { 3: 'blue_helmet', 4: 'purple_helmet', 5: 'orange_helmet' }
      }
    },
    ruleTeam: { equipMake: [
      { value: '3', chance: 25 }, { value: '4', chance: 60 }, { value: '5', chance: 15 }
    ] }
  },
  exchangeTeamRes: { blacksmith: [{ randomTeamList: ['forge_c1'], equipLevel: 1 }] },
  consumeRes: { datas: {
    make_sword: { items: [{ typeId: 'ore', num: 2 }] },
    make_helmet: { items: [{ typeId: 'cloth', num: 3 }] }
  } },
  rewardRes: { datas: {
    blue_sword: { items: [{ rules: [{ mode: 'equipGroup', equipTypeGroup: 'swords', qualityGroup: 'blue' }] }] },
    purple_sword: { items: [{ rules: [{ mode: 'equipGroup', equipTypeGroup: 'swords', qualityGroup: 'purple' }] }] },
    orange_sword: { items: [{ rules: [{ mode: 'equipGroup', equipTypeGroup: 'swords', qualityGroup: 'orange' }] }] },
    blue_helmet: { items: [{ rules: [{ mode: 'equip', typeId: 'helmet' }] }] },
    purple_helmet: { items: [{ rules: [{ mode: 'equip', typeId: 'helmet' }] }] },
    orange_helmet: { items: [{ rules: [{ mode: 'equip', typeId: 'helmet' }] }] }
  } },
  equipGroupRes: {
    equipGroups: { swords: { type: [{ typeId: 'sword', chance: 1 }] } },
    qualityGroups: {
      blue: [{ quality: 3, chance: 1 }],
      purple: [{ quality: 4, chance: 1 }],
      orange: [{ quality: 5, chance: 1 }]
    }
  },
  itemRes: { datas: {
    sword: { typeId: 'sword', equip: { equipLevel: 1, position: 1 } },
    helmet: { typeId: 'helmet', equip: { equipLevel: 1, position: 2 } },
    ore: { typeId: 'ore', name: '铜锭', img: 'ore_icon', quality: 2 },
    cloth: { typeId: 'cloth', name: '粗布', img: 'cloth_icon', quality: 1 },
    potion: { typeId: 'potion', name: '药水' }
  } }
})

test('smithing binds exact and grouped equipment with consume materials', () => {
  const data = buildSmithingData(fixture())
  assert.equal(data.sword[0].outputMode, 'equipGroup')
  assert.equal(data.helmet[0].outputMode, 'equip')
  assert.deepEqual(data.sword[0].materials, [{
    typeId: 'ore', name: '铜锭', img: '/images/Common_ItemIcon/ore_icon.webp', quality: 2, num: 2
  }])
  assert.equal(data.potion, undefined)
})

test('smithing quality chance follows ruleTeam instead of stale tip text', () => {
  const data = buildSmithingData(fixture())
  assert.deepEqual(data.sword[0].qualityChances.map(entry => [entry.quality, entry.chance]), [
    [3, 0.25], [4, 0.6], [5, 0.15]
  ])
})

test('smithing ignores an equipment pool whose configured quality does not match its reward tier', () => {
  const maps = fixture()
  maps.equipGroupRes.qualityGroups.blue = [{ quality: 2, chance: 1 }]
  const data = buildSmithingData(maps)
  assert.deepEqual(data.sword[0].qualityChances.map(entry => entry.quality), [4, 5])
})

test('equipment attributes hide zero values, put enhanceable stats first and map cirtDam', () => {
  const attributes = buildEquipAttributeItems({
    crit: { min: 0, max: 0, grows: false },
    cirtDam: { min: 4, max: 4, grows: false },
    maxHp: { min: 775, max: 805, grows: true },
    magicDef: { min: 114, max: 118, grows: true }
  })
  assert.deepEqual(attributes.map(attribute => attribute.key), ['magicDef', 'maxHp', 'cirtDam'])
  assert.equal(translateStatName('cirtDam'), '暴击伤害')
})
