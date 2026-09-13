import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSupplementalItemSources, getSourceRewardItemIds } from '../../src/utils/supplementalItemSources.js'
import { readJson } from '../../scripts/parse/shared.mjs'
import { build } from '../../scripts/parse/search.mjs'

const item = name => ({ typeId: name, name, hide: false })
const reward = (typeId, overrides = {}) => ({ items: [{ rate: 1, num: 1,
  rules: [{ mode: 'item', typeId, chance: 1, min: 1, max: 1 }] }], ...overrides })
const base = () => ({
  itemJson: { datas: { a: item('a'), b: item('b'), seed: item('seed'), item_00001: item('item_00001') } },
  rewardJson: { datas: { a: reward('a'), b: reward('b') } }
})

test('source identity excludes zero probability, empty quantity, equipGroup and internal rewards', () => {
  const items = base().itemJson.datas
  const data = reward('a', { money: 5, items: [
    { rate: 0, rules: [{ typeId: 'b', mode: 'item' }] },
    { num: 0, rules: [{ typeId: 'b', mode: 'item' }] },
    { rules: [{ typeId: 'b', mode: 'item', chance: 0 }, { typeId: 'b', mode: 'item', max: 0 },
      { typeId: 'b', mode: 'equipGroup' }, { typeId: 'a', mode: 'equip', chance: 1 }] }
  ] })
  assert.deepEqual(getSourceRewardItemIds(data, items), ['item_00001', 'a'])
  assert.deepEqual(getSourceRewardItemIds({ ...data, category: ['测试'] }, items), [])
  assert.deepEqual(getSourceRewardItemIds(reward('a', { items: [{ rules: [{ mode: 'randomMoney', min: 2, max: 3 }] }] }), items), ['item_00001'])
})

test('events require positive entry references and preserve legitimate abandoned-chest names', () => {
  const maps = base()
  maps.randomEventInfoJson = { datas: {
    live: { name: '废弃的宝箱', reward: 'a' }, orphan: { name: '孤立事件', reward: 'b' }, zero: { name: '零权重', reward: 'b' }
  } }
  maps.randomEventAreaJson = { data: { c1_map: [{ events: [{ typeId: 'live', chance: 1 }, { typeId: 'live', chance: 1 }, { typeId: 'zero', chance: 0 }] }] } }
  const sources = buildSupplementalItemSources(maps)
  assert.equal(sources.a.length, 1)
  assert.equal(sources.a[0].name, '废弃的宝箱')
  assert.equal(sources.b, undefined)
})

test('collection follows the collection foreign key and gates research-only rewards', () => {
  const maps = base()
  maps.fileGatherJson = { gatherFile: [{ gatherTypeId: 'point', place: ['秋日荒野'] }] }
  maps.roomCollectJson = { datas: { point: { collectTypeId: 'ore' } } }
  maps.roomCollectTypeJson = { datas: {
    point: { name: '错误同名类型', reward: 'b' },
    ore: { name: '矿石', reward: 'a', research: { id: 'study', levelReward: [{ level: 1, reward: 'b' }, { level: 9, reward: 'b' }] } }
  } }
  maps.campResearchJson = { datas: { study: { name: '矿物研究', level: [{ level: 1 }] } } }
  const sources = buildSupplementalItemSources(maps)
  assert.equal(sources.a[0].name, '矿石')
  assert.equal(sources.b.length, 1)
  assert.equal(sources.b[0].researchLevel, 1)
  assert.match(sources.b[0].des, /需矿物研究 1级/)
})

test('plant rewards require a real seed and positive candidate, excluding test crops', () => {
  const maps = base()
  maps.plantJson = { seed: { seed: [{ type: 'crop', chance: 1 }, { type: 'crop_test', chance: 1 }, { type: 'zero', chance: 0 }], absent: [{ type: 'zero' }] },
    plant: { crop: { name: '小麦', reward: 'a' }, crop_test: { name: '试验_test', reward: 'b' }, zero: { name: '蔬菜', reward: 'b' } } }
  const sources = buildSupplementalItemSources(maps)
  assert.equal(sources.a[0].seedId, 'seed')
  assert.equal(sources.b, undefined)
})

test('camp rewards belong to the transition from current to next level, not terminal levels', () => {
  const maps = base()
  maps.homeLevelJson = { datas: { center: { name: '营地中心', level: { 1: { reward: 'a' }, 2: { reward: 'b' } } } } }
  const sources = buildSupplementalItemSources(maps)
  assert.equal(sources.a[0].level, 1)
  assert.equal(sources.a[0].targetLevel, 2)
  assert.equal(sources.b, undefined)
})

test('only chapter-referenced first rewards and player-init guide battles are admitted', () => {
  const maps = base()
  maps.levelStageJson = { datas: { c0_1: { typeId: 'c0_1', shortName: '0-1', name: '相遇', hide: true, battle1: 'live' } } }
  maps.battleJson = { datas: { live: { name: '相遇', firstReward: 'a' }, orphan: { name: '孤立战役', firstReward: 'b' }, guide: { name: '引导', reward: 'a' }, guide_bak: { name: '备份', reward: 'b' } } }
  maps.playerInitJson = { initBattleId: 'guide', initBattleId2: 'guide_bak' }
  const sources = buildSupplementalItemSources(maps)
  assert.deepEqual(sources.a.map(x => x.type), ['firstReward', 'guide'])
  assert.equal(sources.b, undefined)
})

test('activity signup uses entry rewards, not legacy signIn or preview rewards', () => {
  const maps = base()
  maps.signInJson = { newbieSignIn: { 1: 'b' } }
  maps.activityListJson = { datas: {
    signup: { activityType: '7dayCheck', name: '旅途', para: { achives: [{ reward: 'a' }], showReward: 'b' } },
    off: { activityType: 'activityCheckIn', name: '关闭活动', startTime: '2025-12-01', endTime: '2025-12-01', para: { achives: [{ reward: 'b' }] } },
    test: { activityType: '7dayCheck', name: '测试签到', para: { achives: [{ reward: 'b' }] } }
  } }
  const sources = buildSupplementalItemSources(maps)
  assert.equal(sources.a[0].type, 'signIn')
  assert.equal(sources.b, undefined)
})

test('real source build preserves existing dungeon sources and links target real entries', () => {
  const sentinel = { type: 'dungeon', id: 'retained', name: '保留副本来源', des: '固定装备' }
  const result = build({ dungeonSources: { item_411000: [sentinel] } })
  const sources = result.files.find(x => x.file === 'parsed/item-sources.json').data
  assert.ok(sources.item_411000.some(x => x.id === sentinel.id))
  assert.ok(sources.item_411000.some(x => x.type === 'guide' && x.id === 'c00_1'))
  assert.ok(sources.item_411000.some(x => x.type === 'firstReward' && x.id === 'c0_4_a'))
  assert.ok(sources.item_50004.some(x => x.type === 'camp' && x.level === 1 && x.targetLevel === 2))
  assert.ok(sources.item_50087.some(x => x.type === 'activity' && x.name === '世界探险挑战'))
  assert.ok(sources.item_10036.some(x => x.type === 'plant' && x.seedId === 'item_15009'))
  const events = readJson('randomEventInfo.json').datas
  const explores = readJson('exploreArea.json').datas
  const items = readJson('item.json').datas
  for (const source of Object.values(sources).flat()) {
    if (source.type === 'event') assert.ok(events[source.id])
    if (source.type === 'explore') assert.ok(explores[source.id])
    if (source.type === 'plant') assert.ok(items[source.seedId])
  }
})
