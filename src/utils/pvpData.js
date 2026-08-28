/**
 * PVP 奖励构建期纯函数：由 reward/pvp/itemExchange/consume 原始 JSON 生成
 *   { pvp: parsed-pvp.json 内容, sources: parsed-pvp-sources.json 内容 }
 * 对应原 scripts/parse-rewards.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）共用。
 */
export function buildPvpData(maps) {
  const { rewardRes, pvpRes, exchangeRes, consumeRes } = maps

  const rawReward = rewardRes && (rewardRes.datas || rewardRes) || {}
  const rawPvp = pvpRes || {}
  const rawExchange = (exchangeRes && exchangeRes.itemExchange) || {}
  const rawConsume = consumeRes && (consumeRes.datas || consumeRes) || {}

  const pvpRewards = {
    exchange: {},
    tier: [],
    rank: [],
    battle: { win: null, fail: null }
  }

  const itemSources = {}
  const addSource = (itemId, type, id, name, des) => {
    if (!itemSources[itemId]) itemSources[itemId] = []
    if (!itemSources[itemId].find(x => x.type === type && x.id === id)) {
      itemSources[itemId].push({ type, id, name, des })
    }
  }

  // 1. Process Exchange Rewards
  const extractSpecialItems = (data) => {
    const items = []
    if (data.ke) items.push({ rules: [{ typeId: 'item_00002', num: data.ke }] })
    if (data.exp) items.push({ rules: [{ typeId: 'item_00004', num: data.exp }] })
    if (data.heroExp) items.push({ rules: [{ typeId: 'item_00006', num: data.heroExp }] })
    if (data.equipExp) items.push({ rules: [{ typeId: 'item_00007', num: data.equipExp }] })
    return items
  }
  const normalizeItems = (data) => {
    if (!data) return []
    return extractSpecialItems(data).concat(data.items || [])
  }

  Object.values(rawExchange).forEach(ex => {
    if (ex.category && ex.category[0] === 'pvp') {
      const subCat = ex.category[1] || '兑换'
      if (!pvpRewards.exchange[subCat]) {
        pvpRewards.exchange[subCat] = []
      }
      const rewardData = rawReward[ex.reward] || {}
      const consumeData = rawConsume[ex.consume] || {}
      pvpRewards.exchange[subCat].push({
        id: ex.id,
        sort: ex.sort || 0,
        limitCondition: ex.limitCondition,
        rewardItems: normalizeItems(rewardData),
        consumeItems: normalizeItems(consumeData)
      })
      // Reverse mapping
      const allItems = normalizeItems(rewardData)
      if (allItems.length > 0) {
        allItems.forEach(group => {
          if (group.rules) {
            group.rules.forEach(r => {
              if (r.typeId && r.typeId.startsWith('item_')) {
                addSource(r.typeId, 'pvp', 'exchange', 's1兑换', '兑换奖励')
              }
            })
          }
        })
      }
    }
  })

  // Sort exchanges
  Object.keys(pvpRewards.exchange).forEach(subCat => {
    pvpRewards.exchange[subCat].sort((a, b) => a.sort - b.sort)
  })

  // 2. Process Tier Rewards (段位奖励)
  if (rawPvp.rankInfo) {
    Object.values(rawPvp.rankInfo).forEach(tier => {
      const rewardData = rawReward[tier.reward] || {}
      pvpRewards.tier.push({
        id: tier.type,
        name: tier.name,
        typeOrder: parseInt(tier.type) || 0,
        rewardItems: normalizeItems(rewardData)
      })
      const allItems = normalizeItems(rewardData)
      if (allItems.length > 0) {
        allItems.forEach(group => {
          if (group.rules) {
            group.rules.forEach(r => {
              if (r.typeId && r.typeId.startsWith('item_')) {
                addSource(r.typeId, 'pvp', 'tier', '段位奖励', '挑战赛')
              }
            })
          }
        })
      }
    })
    pvpRewards.tier.sort((a, b) => a.typeOrder - b.typeOrder)
  }

  // 3. Process Rank Rewards (排名奖励)
  if (rawPvp.rankReward) {
    rawPvp.rankReward.forEach(rank => {
      const rewardData = rawReward[rank.reward] || {}
      pvpRewards.rank.push({
        start: rank.start,
        end: rank.end,
        rewardItems: normalizeItems(rewardData)
      })
      const allItems = normalizeItems(rewardData)
      if (allItems.length > 0) {
        allItems.forEach(group => {
          if (group.rules) {
            group.rules.forEach(r => {
              if (r.typeId && r.typeId.startsWith('item_')) {
                addSource(r.typeId, 'pvp', 'rank', '排名奖励', '挑战赛')
              }
            })
          }
        })
      }
    })
    pvpRewards.rank.sort((a, b) => a.start - b.start)
  }

  // 4. Process Battle Rewards
  const pvpWinData = rawReward['pvpWin'] || {}
  const pvpFailData = rawReward['pvpFailure'] || {}
  pvpRewards.battle.win = { rewardItems: normalizeItems(pvpWinData) }
  const winItems = normalizeItems(pvpWinData)
  if (winItems.length > 0) {
    winItems.forEach(group => {
      if (group.rules) {
        group.rules.forEach(r => {
          if (r.typeId && r.typeId.startsWith('item_')) {
            addSource(r.typeId, 'pvp', 'battle', '战斗胜负', '战斗结算')
          }
        })
      }
    })
  }
  pvpRewards.battle.fail = { rewardItems: normalizeItems(pvpFailData) }
  const failItems = normalizeItems(pvpFailData)
  if (failItems.length > 0) {
    failItems.forEach(group => {
      if (group.rules) {
        group.rules.forEach(r => {
          if (r.typeId && r.typeId.startsWith('item_')) {
            addSource(r.typeId, 'pvp', 'battle', '战斗胜负', '战斗结算')
          }
        })
      }
    })
  }

  return { pvp: pvpRewards, sources: itemSources }
}
