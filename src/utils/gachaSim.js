/**
 * 模拟招募：抽卡规则引擎（纯函数，无网络 / 无组件依赖）。
 *
 * 数据来源：`public/data/parsed/gacha.json`（构建期由 heroPool/heroPoolTime/petPool/
 * petPoolTime/hero/pet/reward/item 生成）。每条卡池的星级权重、候选权重、保底次数
 * 都直接取自原表，不在页面写死。
 *
 * 边界说明（重要）：
 *   - 实际抽取在游戏服务端完成，客户端只接收结果（`HeroRecruitData`）。本文件按
 *     原表 `rareChance[].chance/safe` 与 `percTip` 的官方概率说明重写一套等价规则，
 *     用于本地模拟；页面上必须标注为「模拟」，不得表述为账号真实结果。
 *   - 只实现可在客户端配置中证实的三条规则（见 `resolveTier`）。原表另有
 *     `secondSafeMin/secondSafeMax`（如 4~8），服务端语义未证实，本模拟不采用，
 *     也不在页面上编造解释。
 *   - 保底计数与「已拥有」状态保存在本地（见 `stores/gachaState.js`），不是账号数据。
 */

/** 默认随机源，可注入以便测试。 */
const defaultRandom = () => Math.random()

/** 一抽最多回溯的星级判断次数，防御配置异常导致的死循环。 */
const MAX_GUARD = 8

/** 取该星级候选池。 */
function tierCandidates(tier) {
  return Array.isArray(tier?.candidates) ? tier.candidates : []
}

/** 按权重取一项；权重全部无效时回退第一项。 */
function pickWeighted(list, random, weightOf) {
  const weights = list.map(item => {
    const value = Number(weightOf(item))
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return list[0] ?? null
  let roll = random() * total
  for (let index = 0; index < list.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) return list[index]
  }
  return list[list.length - 1]
}

/**
 * 该池的保底参数（取最高星级档的 safe/firstSafe 作为 5★/3★ 上限，其余按自身 safe）。
 * `pool.tiers` 已按星级升序排列，这里只做读取，不重排。
 */
export function getPityConfig(pool) {
  const tiers = Array.isArray(pool?.tiers) ? pool.tiers : []
  const byRank = new Map(tiers.map(tier => [tier.rank, tier]))
  const highest = tiers[tiers.length - 1] ?? null
  return {
    tiers,
    byRank,
    topRank: highest?.rank ?? 5,
    /** 最高星级的硬保底次数（如 36）。 */
    topSafe: Number(highest?.safe) || 0,
    /** 最高星级的首次保底次数（如首次十连的 10）。 */
    topFirstSafe: Number(highest?.firstSafe) || 0,
    /** 最高星级指定伙伴保底。 */
    guaranty: highest?.guaranty ?? null
  }
}

/** 新建一份模拟运行时状态（保底计数 + 距上次高星次数）。 */
export function createRuntime(pool) {
  const config = getPityConfig(pool)
  return {
    poolId: pool?.id ?? '',
    totalPulls: 0,
    pity: Object.fromEntries(config.tiers.map(tier => [tier.rank, 0])),
    guarantyCount: 0,
    firstGuarantyUsed: false
  }
}

/** 归一化外部传入的运行时（兼容旧记录缺字段）。 */
export function normalizeRuntime(pool, runtime) {
  const base = createRuntime(pool)
  if (!runtime) return base
  const pity = { ...base.pity }
  for (const rank of Object.keys(pity)) {
    const value = Number(runtime.pity?.[rank])
    if (Number.isFinite(value) && value >= 0) pity[rank] = value
  }
  return {
    poolId: base.poolId,
    totalPulls: Number(runtime.totalPulls) || 0,
    pity,
    guarantyCount: Number(runtime.guarantyCount) || 0,
    firstGuarantyUsed: Boolean(runtime.firstGuarantyUsed)
  }
}

/**
 * 判定本次抽取的星级。只采用可在客户端配置与 `percTip` 中证实的三条规则：
 *   1. 硬保底：该星级连续 `safe` 次未出（如 5★ 的 36、4★ 的 10），本次必出；
 *   2. 首次保底：`firstSafe > 0` 且从未触发过时，抽数达到 `firstSafe` 必出最高星级
 *      （如常规招募「首次十连内必出 5★」），触发一次后失效；
 *   3. 权重：按 `rareChance[].chance`（parsed 为 `tier.weight`）加权随机。
 * 全部未命中时回退最低星级，保证每次抽取都有结果。
 */
function resolveTier(pool, runtime, random) {
  const config = getPityConfig(pool)
  const { tiers, byRank, topRank, topSafe, topFirstSafe } = config
  if (!tiers.length) return null

  const nextPull = runtime.totalPulls + 1
  const topTier = byRank.get(topRank)
  const topPity = runtime.pity[topRank] ?? 0

  if (topTier && topSafe > 0 && topPity + 1 >= topSafe) return topTier
  if (topTier && topFirstSafe > 0 && !runtime.firstGuarantyUsed && nextPull >= topFirstSafe) return topTier

  for (let index = tiers.length - 2; index >= 0; index -= 1) {
    const tier = tiers[index]
    const safe = Number(tier.safe) || 0
    const pity = runtime.pity[tier.rank] ?? 0
    if (safe > 0 && pity + 1 >= safe) return tier
  }

  const rolled = pickWeighted(tiers, random, tier => tier.weight)
  return rolled ?? tiers[0]
}

/**
 * 最高星级内部：若配置了指定伙伴保底（`guaranty`）且达到次数，强制给指定伙伴。
 * 未配置时按候选权重；`isUp` 只做展示标记，权重可证明时才参与计算。
 */
function resolveCandidate(tier, runtime, random) {
  const candidates = tierCandidates(tier)
  if (!candidates.length) return null
  const guaranty = tier.guaranty
  if (guaranty?.typeIds?.length) {
    const safe = Number(guaranty.safe) || 0
    if (safe > 0 && runtime.guarantyCount + 1 >= safe) {
      const forced = candidates.find(item => guaranty.typeIds.includes(item.typeId))
      if (forced) return forced
    }
  }
  return pickWeighted(candidates, random, item => item.weight) ?? candidates[0]
}

/** 更新保底计数：命中某星级则该项清零，其余累加。 */
function advancePity(pool, runtime, hitRank) {
  const config = getPityConfig(pool)
  const pity = {}
  for (const tier of config.tiers) {
    pity[tier.rank] = tier.rank === hitRank ? 0 : (runtime.pity[tier.rank] ?? 0) + 1
  }
  const guaranty = config.guaranty
  const hitGuaranty = Boolean(
    hitRank === config.topRank &&
    guaranty?.typeIds?.length &&
    runtime.guarantyCount + 1 >= (Number(guaranty.safe) || 0)
  )
  const pullsAfter = runtime.totalPulls + 1
  return {
    ...runtime,
    totalPulls: pullsAfter,
    pity,
    guarantyCount: hitGuaranty ? 0 : runtime.guarantyCount + 1,
    firstGuarantyUsed: runtime.firstGuarantyUsed ||
      (config.topFirstSafe > 0 && pullsAfter >= config.topFirstSafe)
  }
}

/**
 * 单抽。
 * @returns {{ tier:object, candidate:object, runtime:object }}
 */
export function drawOne(pool, runtime, random = defaultRandom) {
  const state = normalizeRuntime(pool, runtime)
  const config = getPityConfig(pool)
  let tier = null
  let candidate = null
  for (let attempt = 0; attempt < MAX_GUARD; attempt += 1) {
    tier = resolveTier(pool, state, random)
    if (!tier) break
    candidate = resolveCandidate(tier, state, random)
    if (candidate) break
    tier = null
  }
  if (!tier || !candidate) {
    return { tier: null, candidate: null, runtime: state }
  }
  return {
    tier,
    candidate,
    runtime: advancePity(pool, state, tier.rank),
    rank: tier.rank
  }
}

/** 连续抽 count 次，返回逐次结果与最终运行时。 */
export function drawMany(pool, runtime, count, random = defaultRandom) {
  let state = normalizeRuntime(pool, runtime)
  const pulls = []
  for (let index = 0; index < count; index += 1) {
    const result = drawOne(pool, state, random)
    if (!result.candidate) break
    state = result.runtime
    pulls.push({
      tierRank: result.tier.rank,
      candidate: result.candidate,
      pityAfter: { ...state.pity }
    })
  }
  return { pulls, runtime: state }
}

/**
 * 结算重复获得：按候选自带 `duplicate` 配置产出记忆碎片，达到上限后转化为记忆结晶。
 * 规则对应原表 `percTip`：「重复获得的伙伴将转化为 10 枚该伙伴的记忆碎片…当碎片已达
 * 上限时，将根据伙伴稀有度转化为对应数量的记忆结晶」（5★×20 / 4★×8 / 3★及以下×1，
 * 数值直接取候选的 `duplicate.overflow.count`，不在代码里写死稀有度映射）。
 * 计数保证单调、不出现负数：碎片最多补到 `limit`，本次无法容纳的部分转为结晶。
 *
 * @param {object} candidate 候选条目
 * @param {number} ownedFragments 已持有的该角色碎片数
 * @returns {{ fragments:number, converted:boolean, overflow:object|null, ownedAfter:number }}
 */
export function resolveDuplicate(candidate, ownedFragments = 0) {
  const duplicate = candidate?.duplicate
  const owned = Math.max(Number(ownedFragments) || 0, 0)
  if (!duplicate) {
    return { fragments: 0, converted: false, overflow: null, ownedAfter: owned }
  }
  const gain = Math.max(Number(duplicate.fragments) || 0, 0)
  const limit = Math.max(Number(duplicate.limit) || 0, 0)
  const overflow = duplicate.overflow
    ? { ...duplicate.overflow, count: Number(duplicate.overflow.count) || 0 }
    : null

  if (limit > 0 && owned >= limit) {
    return { fragments: 0, converted: Boolean(overflow), overflow, ownedAfter: owned }
  }
  const room = limit > 0 ? limit - owned : gain
  if (gain <= room) {
    return { fragments: gain, converted: false, overflow: null, ownedAfter: owned + gain }
  }
  return { fragments: room, converted: Boolean(overflow), overflow, ownedAfter: owned + room }
}

/** 概率展示：保留两位小数，非零且小于 0.01% 时显示 `<0.01%`（与奖励卡文案口径一致）。 */
export function formatGachaRate(value) {
  const rate = Number(value)
  if (!Number.isFinite(rate)) return ''
  if (rate <= 0) return '0%'
  if (rate < 0.01) return '<0.01%'
  return `${rate.toFixed(2)}%`
}

/** 按星级汇总概率，用于概率详情页顶部概览。 */
export function summarizeTiers(pool) {
  return (pool?.tiers ?? []).map(tier => ({
    rank: tier.rank,
    quality: tier.quality,
    chance: tier.weight,
    safe: Number(tier.safe) || 0,
    firstSafe: Number(tier.firstSafe) || 0,
    count: tierCandidates(tier).length
  }))
}
