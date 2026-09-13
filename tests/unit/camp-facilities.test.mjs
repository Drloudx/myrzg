import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { buildCampFacilityData, formatCampDuration } from '../../src/utils/campFacilityData.js'
import { buildFacilitiesFile } from '../../scripts/parse/facilities.mjs'
import { validateResource } from '../../src/utils/resourceSchemas.js'

const fixture = () => ({
  homeLevelRes: { datas: { center: { name: '营地中心', icon: 'center', condition: 'unlock', level: {
    1: { consume: 'first', reward: 'reward1', playerLevel: 2, desc: '初始', playerAbility: { orderWeight: 5 } },
    2: { consume: 'last', reward: 'unused', playerLevel: 99, desc: '二级效果', att: { maxHp: 100 }, playerAbility: { orderWeight: 10 } }
  } } } },
  campResearchRes: { datas: {
    first: { name: '前置', des: '速度', icon: 'r', team: 'collect', level: [{ level: 1, consume: 'first', addDes: '10%', action: 'playerAbility', actionPara: { speed: 0.1 } }] },
    second: { name: '后置', des: '效果', icon: 'r', team: 'collect', preResearch: 'first', level: [
      { level: 1, consume: 'first', addDes: '10%', action: 'playerAbility', actionPara: { speed: 0.1 } },
      { level: 2, consume: 'last', addDes: '20%', action: 'playerAbility', actionPara: { speed: 0.2 } }
    ] }
  } },
  consumeRes: { datas: { first: { money: 25, items: [{ typeId: 'wood', num: 3 }] }, last: { money: 99 } } },
  itemRes: { datas: { wood: { name: '木头', img: 'wood', quality: 1 } } },
  rewardRes: { datas: { reward1: { items: [{ rate: 1, num: 1, rules: [{ mode: 'item', typeId: 'wood', chance: 1, min: 1, max: 1 }] }] } } },
  conditionRes: { gameConditions: { unlock: { desc: '不要显示内部备注', rules: [{ type: 'level', need: true, para: { min: 1 } }] } } }
})

test('building upgrades pair current costs and rewards with the next level and hide terminal costs', () => {
  const camp = buildCampFacilityData(fixture())
  const building = camp.buildings[0]
  const [first, last] = building.levels
  assert.deepEqual([first.upgrade.fromLevel, first.upgrade.toLevel, first.upgrade.playerLevel], [1, 2, 2])
  assert.equal(first.upgrade.consumeId, 'first')
  assert.equal(first.upgrade.costs[0].num, 25)
  assert.equal(first.upgrade.costs[1].num, 3)
  assert.equal(first.upgrade.rewards[0].typeId, 'wood')
  assert.equal(last.upgrade, null)
  assert.equal(last.description, '二级效果')
  assert.equal(last.playerAbility.orderWeight, 15)
  assert.equal(last.stats.find(stat => stat.key === 'maxHp').value, '+100')
  assert.equal(building.unlockCondition, '玩家等级达到 1 级')
})

test('research uses target level costs and replacement effects, with a level-one prerequisite', () => {
  const research = buildCampFacilityData(fixture()).research[1]
  assert.deepEqual(research.prerequisite, { id: 'first', name: '前置', level: 1 })
  assert.equal(research.levels[1].consumeId, 'last')
  assert.equal(research.levels[1].playerAbility.speed, 0.2)
  assert.equal(research.levels[1].effect, '20%')
})

test('missing material and formula references fail parsing instead of advertising free upgrades', () => {
  const maps = fixture()
  delete maps.consumeRes.datas.first
  assert.throws(() => buildCampFacilityData(maps), /Missing camp consume/)
  const other = fixture()
  other.campResearchRes.datas.first.level[0] = { action: 'formula', actionPara: ['missing'], level: 1 }
  assert.throws(() => buildCampFacilityData(other), /Missing research formula/)
})

test('camp durations include hours and days without rounding research times', () => {
  assert.equal(formatCampDuration(0), '0 秒')
  assert.equal(formatCampDuration(300), '5 分钟')
  assert.equal(formatCampDuration(43200), '12 小时')
  assert.equal(formatCampDuration(90061), '1 天 1 小时 1 分钟 1 秒')
})

test('real camp data preserves recipes, resolves icons, and conforms to runtime schema', () => {
  const { data } = buildFacilitiesFile()
  assert.equal(validateResource('data/parsed/facilities.json', data), true)
  const camp = data.find(entry => entry.key === 'camp')
  assert.equal(camp.buildings.length, 7)
  assert.equal(camp.research.length, 38)
  assert.equal(camp.buildings.find(entry => entry.id === 'center').levels.length, 7)
  const center = camp.buildings.find(entry => entry.id === 'center')
  assert.equal(center.levels[0].upgrade.rewardId, 'homeLevel_center1')
  assert.equal(center.levels[2].upgrade.rewardId, 'homeLevel_center2')
  assert.equal(center.levels[4].stats.find(stat => stat.key === 'decMax').value, 300)
  const blacksmith = camp.buildings.find(entry => entry.id === 'blacksmith')
  assert.equal(blacksmith.levels.at(-1).upgrade, null)
  assert.equal(blacksmith.levels.at(-2).upgrade.toLevel, 9)
  assert.equal(blacksmith.levels.at(-2).upgrade.centerLevel, 7)
  const improved = camp.research.find(entry => entry.id === 'blacksmithCarbonFormula')
  assert.equal(improved.levels[0].recipes[0].id, 'item_10083_01')
  for (const icon of [...camp.buildings.flatMap(entry => [entry.icon, ...entry.levels.map(level => level.icon)]), ...camp.research.map(entry => entry.icon)]) {
    assert.ok(existsSync(new URL(`../../public${icon}`, import.meta.url)), icon)
  }
  const original = JSON.parse(readFileSync(new URL('../../public/data/parsed/facilities.json', import.meta.url), 'utf8'))
  for (const facility of data.filter(entry => entry.key !== 'camp')) {
    assert.deepEqual(facility, original.find(entry => entry.key === facility.key))
  }
  const invalid = structuredClone(data)
  delete invalid.at(-1).buildings[0].levels[0].upgrade.costs
  assert.throws(() => validateResource('data/parsed/facilities.json', invalid), /数据格式不完整/)
})
