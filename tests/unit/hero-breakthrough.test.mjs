/**
 * 角色突破材料判定（`breakthroughConsumesItems`）。
 *
 * 背景：角色详情原先无条件加载整张 `parsed/items.json`（本地 brotli 约 126 KiB）来解析
 * 突破材料的名称与图标。核对原表后发现 `heroRank` 引用的 consume 条目**全部只有 money**，
 * 那次加载解析不出任何东西。改动后只在"真的带材料"时才加载——这个测试把两点都锁住：
 *   1. 当前原表下确实一个材料都没有（否则优化前提不成立，应该退回无条件加载）；
 *   2. 一旦配置带上材料，判定必须立刻变 true（不能因为"现在都是空"就把逻辑写死成 false）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { breakthroughConsumesItems } from '../../src/utils/heroParser.js'

const heroes = JSON.parse(readFileSync(new URL('../../public/data/parsed/heroes.json', import.meta.url), 'utf8'))
const { heroRank, consumeDatas, heroes: heroList } = heroes

test('当前原表：所有角色的突破档位都不带材料（这是"按需加载"成立的前提）', () => {
  assert.ok(heroList.length > 0, '角色列表不能为空')
  const loading = heroList.filter(hero => breakthroughConsumesItems(heroRank, consumeDatas, hero.rare, hero.job))
  assert.deepEqual(loading.map(hero => hero.id), [],
    '若有角色开始带突破材料，说明原表已变，需要复核 HeroesView 的按需加载前提与开发日志')
})

test('heroRank 引用的 consume 条目确实存在且被检查过（避免判定因取不到 key 而恒 false）', () => {
  const keys = new Set()
  for (const rankInfo of Object.values(heroRank?.heroRank || {})) {
    for (const byJob of Object.values(rankInfo?.upgradeConsume || {})) {
      for (const key of Object.values(byJob || {})) if (key) keys.add(key)
    }
  }
  assert.ok(keys.size > 0, 'heroRank 必须引用到 consume 条目')
  const pick = key => consumeDatas?.[key] || consumeDatas?.datas?.[key]
  const resolved = [...keys].filter(key => pick(key))
  assert.equal(resolved.length, keys.size, '被引用的 consume 条目必须都能在 consumeDatas 里取到')
  for (const key of resolved) {
    assert.deepEqual(pick(key).items ?? [], [], `${key} 目前应为空 items`)
  }
})

test('配置一旦带上材料，判定立即为 true（不能把逻辑写死成"永远不需要"）', () => {
  const rankConfig = { heroRank: { 0: { upgradeConsume: { 1: { 1: 'testConsume' } } } } }
  const withItems = { testConsume: { money: 500, items: [{ typeId: 'item_1', num: 3 }] } }
  const emptyItems = { testConsume: { money: 500, items: [] } }
  assert.equal(breakthroughConsumesItems(rankConfig, withItems, 1, 1), true)
  assert.equal(breakthroughConsumesItems(rankConfig, emptyItems, 1, 1), false)
  // datas 包裹结构（原表 consume.json 的顶层形状）同样要认
  assert.equal(breakthroughConsumesItems(rankConfig, { datas: withItems }, 1, 1), true)
})

test('缺配置 / 缺档位时安全返回 false', () => {
  assert.equal(breakthroughConsumesItems(null, null, 1, 1), false)
  assert.equal(breakthroughConsumesItems({}, {}, 1, 1), false)
  assert.equal(breakthroughConsumesItems({ heroRank: { 0: { upgradeConsume: { 1: { 1: 'k' } } } } }, {}, 1, 1), false)
  // 该稀有度/职业没有对应档位
  assert.equal(breakthroughConsumesItems({ heroRank: { 0: { upgradeConsume: { 1: { 1: 'k' } } } } }, { k: { items: [{ typeId: 'x', num: 1 }] } }, 5, 5), false)
})
