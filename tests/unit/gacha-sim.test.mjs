import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createRuntime,
  drawMany,
  drawOne,
  formatGachaRate,
  getPityConfig,
  normalizeRuntime,
  resolveDuplicate,
  summarizeTiers
} from '../../src/utils/gachaSim.js'

const gacha = JSON.parse(readFileSync(new URL('../../public/data/parsed/gacha.json', import.meta.url), 'utf8'))
const heroPool = gacha.pools.find(pool => pool.id === 'hero:1:1:0')
const upPool = gacha.pools.find(pool => pool.id === 'hero:2:2:0')
const petPool = gacha.pools.find(pool => pool.id === 'pet:1:1:0')

/** 固定种子随机源，保证测试可复现。 */
function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

test('卡池数据带上了原表概率说明与指定伙伴', () => {
  assert.equal(gacha.pools.length, 4)
  for (const pool of gacha.pools) {
    assert.ok(pool.percTip.length > 0, `${pool.id} 缺少 percTip`)
    assert.ok(pool.percTip.includes('{'), `${pool.id} 的 percTip 应保留占位符`)
  }
  assert.deepEqual(upPool.upTypes, ['hero_064'])
  assert.equal(upPool.assets.coverSprite, 'gacha_p_sp001')
  assert.equal(petPool.assets.coverSprite, 'gacha_egg_sp')
})

test('保底参数取自原表字段', () => {
  const config = getPityConfig(heroPool)
  assert.equal(config.topRank, 5)
  assert.equal(config.topSafe, 36)
  assert.equal(config.topFirstSafe, 10)
  assert.equal(config.byRank.get(4).safe, 10)
  assert.deepEqual(summarizeTiers(heroPool).map(tier => tier.rank), [3, 4, 5])
})

test('硬保底：首次保底在第 10 抽、5 星硬保底在第 36 抽生效', () => {
  // 随机源恒为 0 ⇒ 权重随机永远落在最低档，只有保底能把结果推到高星
  const alwaysLow = () => 0

  let runtime = createRuntime(heroPool)
  let firstFiveStarAt = 0
  for (let pull = 1; pull <= 40; pull += 1) {
    const result = drawOne(heroPool, runtime, alwaysLow)
    runtime = result.runtime
    if (result.tier.rank === 5) { firstFiveStarAt = pull; break }
  }
  assert.equal(firstFiveStarAt, 10, '首次保底 firstSafe=10 应先于硬保底生效')

  // 跳过首次保底后，5 星硬保底应在第 36 抽生效
  let runtime2 = { ...createRuntime(heroPool), firstGuarantyUsed: true }
  let hardPityAt = 0
  for (let pull = 1; pull <= 40; pull += 1) {
    const result = drawOne(heroPool, runtime2, alwaysLow)
    runtime2 = result.runtime
    if (result.tier.rank === 5) { hardPityAt = pull; break }
  }
  assert.equal(hardPityAt, 36)
})

test('4 星保底 safe=10：首保底用掉后第 10 抽给 4 星', () => {
  const alwaysLow = () => 0
  let runtime = { ...createRuntime(heroPool), firstGuarantyUsed: true }
  const ranks = []
  for (let pull = 1; pull <= 10; pull += 1) {
    const result = drawOne(heroPool, runtime, alwaysLow)
    runtime = result.runtime
    ranks.push(result.tier.rank)
  }
  assert.equal(ranks.at(-1), 4, '第 10 抽应由 4 星保底命中（5 星硬保底在 36 抽）')
  assert.equal(ranks.filter(rank => rank === 3).length, 9)
  assert.equal(runtime.pity[4], 0, '命中后 4 星保底计数清零')
  assert.equal(runtime.pity[5], 10, '未命中 5 星时计数继续累加')
})

test('星级分布与官方概率说明一致（大样本）', () => {
  const random = seeded(20260913)
  const total = 120000
  let runtime = createRuntime(heroPool)
  const counts = { 3: 0, 4: 0, 5: 0 }
  for (let index = 0; index < total; index += 1) {
    const result = drawOne(heroPool, runtime, random)
    runtime = result.runtime
    counts[result.tier.rank] += 1
  }
  const fiveRate = counts[5] / total * 100
  const fourRate = counts[4] / total * 100
  // 官方：5★ 基础 2.3% / 综合 4.3%；4★ 基础 7.6% / 综合 13.9%
  assert.ok(fiveRate > 3.5 && fiveRate < 5.0, `5★ 实测 ${fiveRate.toFixed(2)}% 偏离综合概率 4.3%`)
  assert.ok(fourRate > 12.5 && fourRate < 15.5, `4★ 实测 ${fourRate.toFixed(2)}% 偏离综合概率 13.9%`)
})

test('指定伙伴保底：第 2 次 5 星必为 hero_064', () => {
  const random = seeded(7)
  let runtime = createRuntime(upPool)
  const fiveStars = []
  for (let index = 0; index < 4000 && fiveStars.length < 2; index += 1) {
    const result = drawOne(upPool, runtime, random)
    runtime = result.runtime
    if (result.tier.rank === 5) fiveStars.push(result.candidate.typeId)
  }
  assert.equal(fiveStars.length, 2)
  assert.equal(fiveStars[1], 'hero_064')
})

test('十连返回 10 个结果并推进保底计数', () => {
  const random = seeded(99)
  const { pulls, runtime } = drawMany(heroPool, createRuntime(heroPool), 10, random)
  assert.equal(pulls.length, 10)
  assert.equal(runtime.totalPulls, 10)
  assert.ok(pulls.every(pull => pull.candidate && pull.tierRank >= 3))
})

test('重复转化：达到碎片上限后转为记忆结晶，且计数单调不出现负数', () => {
  const fiveStar = heroPool.tiers.find(tier => tier.rank === 5).candidates[0]
  const limit = fiveStar.duplicate.limit

  const first = resolveDuplicate(fiveStar, 0)
  assert.equal(first.fragments, 10)
  assert.equal(first.converted, false)
  assert.equal(first.overflow, null)

  const partial = resolveDuplicate(fiveStar, limit - 5)
  assert.equal(partial.fragments, 5)
  assert.equal(partial.converted, true)
  assert.equal(partial.ownedAfter, limit)
  assert.ok(partial.overflow.count > 0)

  const full = resolveDuplicate(fiveStar, limit)
  assert.equal(full.fragments, 0)
  assert.equal(full.ownedAfter, limit)
  assert.equal(full.overflow.typeId, 'item_20026')
})

test('运行时归一化兼容缺失与非法字段', () => {
  const runtime = normalizeRuntime(heroPool, { totalPulls: 'x', pity: { 5: -3 } })
  assert.equal(runtime.totalPulls, 0)
  assert.equal(runtime.pity[5], 0)
  assert.equal(runtime.pity[3], 0)
  assert.equal(runtime.guarantyCount, 0)
})

test('概率文案：两位小数、极小值用 <0.01%', () => {
  assert.equal(formatGachaRate(4.3), '4.30%')
  assert.equal(formatGachaRate(0.005), '<0.01%')
  assert.equal(formatGachaRate(0), '0%')
})
