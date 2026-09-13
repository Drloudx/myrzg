import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRemainingItemSources } from '../../src/utils/remainingItemSources.js'
import { buildDungeonItemSources } from '../../src/utils/dungeonData.js'
import { build } from '../../scripts/parse/search.mjs'
import { buildDungeonsFiles } from '../../scripts/parse/dungeons.mjs'

const item = (id, extra = {}) => ({ typeId: id, name: id, hide: false, ...extra })
const choice = (id, targets) => item(id, { useAction: 'getRewardSelect', useActionPara: {
  rewards: targets.map(itemTypeId => ({ itemTypeId, num: 1 }))
} })

test('containers follow rooted chains, preserve selection, and reject orphan cycles and test rewards', () => {
  const maps = { itemJson: { datas: {
    root: choice('root', ['nested']), nested: choice('nested', ['target']), target: item('target'),
    orphan: choice('orphan', ['cycle']), cycle: choice('cycle', ['orphan', 'no']), no: item('no'),
    bad: item('bad', { useAction: 'getReward', useActionPara: { reward: 'bad' } })
  } }, rewardJson: { datas: { bad: { tip: '测试通用奖励', items: [{ rules: [{ mode: 'item', typeId: 'no', chance: 1 }] }] } } } }
  const sources = buildRemainingItemSources(maps, { root: [{}], bad: [{}] })
  assert.equal(sources.target[0].sourceItemId, 'nested')
  assert.match(sources.target[0].des, /自选获得/)
  assert.doesNotMatch(sources.target[0].des, /概率|必定/)
  assert.equal(sources.no, undefined)
  assert.equal(sources.orphan, undefined)
})

test('containers exclude zero rewards and equipment pool previews', () => {
  const maps = { itemJson: { datas: {
    root: item('root', { useAction: 'getReward', useActionPara: { reward: 'contents' } }),
    target: item('target'), zero: item('zero'), preview: item('preview')
  } }, rewardJson: { datas: { contents: { items: [
    { rate: 0, rules: [{ mode: 'item', typeId: 'zero', chance: 1 }] },
    { num: 0, rules: [{ mode: 'item', typeId: 'zero', chance: 1 }] },
    { rules: [{ mode: 'item', typeId: 'zero', chance: 0 }] },
    { rules: [{ mode: 'equipGroup', typeId: 'preview', equipTypeGroup: 'pool', chance: 1 }] },
    { rules: [{ mode: 'item', typeId: 'target', chance: 1, min: 2, max: 4 }] }
  ] } } } }
  const sources = buildRemainingItemSources(maps, { root: [{}] })
  assert.deepEqual(Object.keys(sources), ['target'])
  assert.equal(sources.target[0].des, '使用获得')
  maps.itemJson.datas.root.name = '宝箱'
  assert.match(buildRemainingItemSources(maps, { root: [{}] }).target[0].des, /单次抽取必定获得/)
})

test('dungeon actual items, eggs and fixed equipment get the right targets, never preview or zero rewards', () => {
  const drop = (typeId, extra = {}) => ({ typeId, name: typeId, min: 1, max: 1, actualProb: 1, ruleMode: 'item', ...extra })
  const sources = buildDungeonItemSources([{ name: '副本', battles: [{ id: 'live', name: '关卡',
    reward: [drop('item_money'), drop('item_zero', { actualProb: 0 }), drop('item_empty', { max: 0 }),
      drop('item_preview', { ruleMode: 'equipGroup' }), drop('item_equip', { ruleMode: 'equip' })],
    previewReward: [drop('item_previewOnly')], firstReward: [drop('item_first')],
    rooms: [{ variants: [{ typeId: 'room', name: '房间',
      monsters: [{ typeId: 'mon', name: '怪物', drops: [{ collectTypeId: 'drop', reward: [drop('pet_001')] }] }],
      collections: [{ name: '采集点', collectTypeId: 'gather', reward: [drop('item_herb')] }]
    }] }]
  }] }])
  assert.deepEqual(Object.keys(sources).sort(), ['item_money', 'item_equip', 'item_first', 'pet_001', 'item_herb'].sort())
  assert.equal(sources.item_money[0].dropTab, 'settlement')
  assert.equal(sources.item_first[0].dropEntry, 'first')
  assert.equal(sources.pet_001[0].dropEntry, 'room:mon:drop')
  assert.equal(sources.item_herb[0].dropEntry, 'room:gather')
})

test('daily special plans are excluded and tower first rewards remain distinct', () => {
  const maps = { itemJson: { datas: { target: item('target'), no: item('no') } },
    rewardJson: { datas: { live: { items: [{ rules: [{ mode: 'item', typeId: 'target', chance: 1 }] }] },
      special: { items: [{ rules: [{ mode: 'item', typeId: 'no', chance: 1 }] }] } } },
    battleJson: { datas: { live: { name: '关卡', reward: 'live' }, special: { name: '限时', reward: 'special' } } },
    dailyWorkJson: { plans: { a: { typeId: 'a', name: '日常', plan: [{ battle: 'live', name: '关卡' }] },
      b: { typeId: 'b', name: '限时', special: true, plan: [{ battle: 'special', name: '限时' }] } } },
    towerJson: { datas: { tower: { typeId: 'tower', name: '塔', layers: [
      { layer: 1, reward: 'live', onceReward: 'live' }, { layer: 2, reward: 'live' }
    ] } } } }
  const sources = buildRemainingItemSources(maps)
  assert.equal(sources.no, undefined)
  const tower = sources.target.filter(x => x.type === 'tower')
  assert.equal(tower.length, 2)
  assert.equal(tower.find(x => x.id.endsWith(':reward')).des, '第 1～2 层 · 通关结算奖励')
  assert.equal(tower.find(x => x.id.endsWith(':onceReward')).des, '第 1 层 · 首次通关奖励')
  assert.equal(sources.target.find(x => x.type === 'dailyPlan').des, '通关结算奖励')
})

test('compact sources merge quantities without inventing missing tower floors or dismantling qualities', () => {
  const reward = (id, count) => ({ items: [{ rules: [{ mode: 'item', typeId: id, chance: 1, min: count, max: count }] }] })
  const maps = {
    itemJson: { datas: { a: item('a'), b: item('b') } },
    rewardJson: { datas: { small: reward('a', 1), large: reward('a', 10), other: reward('b', 1) } },
    towerJson: { datas: { tower: { typeId: 'tower', name: '塔', layers: [
      { layer: 1, reward: 'small' }, { layer: 2, reward: 'large', onceReward: 'other' },
      { layer: 3, reward: 'other' }, { layer: 4, reward: 'large' }
    ] } } },
    equipDecJson: { equipDec: { 1: { 1: 'small', 2: 'large', 3: 'small', 4: 'large', 5: 'small' },
      2: { 1: 'small', 2: 'other' } } }
  }
  const sources = buildRemainingItemSources(maps)
  assert.deepEqual(sources.a.filter(x => x.type === 'tower').map(x => x.des), ['第 1～2、4 层 · 通关结算奖励'])
  assert.deepEqual(sources.a.filter(x => x.type === 'dismantle').map(x => x.des), ['第 1 阶装备分解', '第 2 阶 · 普通装备分解'])
  assert.equal(sources.b.find(x => x.type === 'dismantle').des, '第 2 阶 · 稀少装备分解')
})

test('real build fills reported gaps without inventing unavailable packs, eggs or hero-state item mappings', () => {
  const sources = build().files.find(x => x.file === 'parsed/item-sources.json').data
  for (const id of ['59050', '59055', '59019', '59043', '59049', '59053', '59064', '59065']) {
    assert.ok(sources[`item_${id}`].some(x => x.type === 'container' && x.id === 'item_5Xchoice'))
  }
  assert.ok(sources.pet_074.some(x => x.type === 'container' && x.id === 'item_26005'))
  assert.ok(sources.pet_074.some(x => x.type === 'gacha' && x.poolKind === 'pet'))
  assert.ok(sources.item_19300.some(x => x.type === 'dungeon'))
  assert.ok(sources.item_19015.some(x => x.type === 'dailyPlan' && x.id === 'daily_mine_3_2'))
  assert.ok(sources.item_19304.some(x => x.type === 'dailyPlan'))
  assert.ok(sources.item_25002.some(x => x.type === 'tower'))
  assert.ok(sources.item_10075.some(x => x.type === 'dismantle'))
  assert.ok(sources.item_20026.some(x => x.type === 'gacha' && /上限/.test(x.des)))
  const allSources = Object.values(sources).flat()
  assert.ok(allSources.filter(x => x.type === 'dailyPlan').every(x => ['通关结算奖励', '首次通关奖励'].includes(x.des)))
  assert.ok(sources.item_00001.filter(x => x.type === 'dailyPlan').length > 0)
  assert.ok(allSources.filter(x => x.type === 'gacha').every(x => !/×|含保底|开放:|开放：/.test(x.des) && !('openTime' in x)))
  assert.ok(allSources.filter(x => x.type === 'dungeon').every(x => !('itemId' in x) && !('dungeonName' in x)))
  assert.ok(sources.item_19300.some(x => x.type === 'dungeon' && /箱内综合概率/.test(x.des)))
  for (const id of ['item_59051', 'item_59005', 'pet_098', 'item_10076']) assert.ok(!sources[id]?.length, id)
  const parents = new Set(Object.values(sources).flat().filter(x => x.type === 'container').map(x => x.id))
  assert.ok(!parents.has('item_20001'))
  assert.ok(!parents.has('item_26008x'))
  assert.ok(!parents.has('item_26013'))
  assert.equal(parents.size, 13)
  const fresh = build({ dungeonSources: buildDungeonsFiles().deps.dungeonSources }).files.find(x => x.file === 'parsed/item-sources.json').data
  assert.deepEqual(sources, fresh, 'standalone search must not depend on a stale dungeon source file')
})
