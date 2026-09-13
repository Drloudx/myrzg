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
    battle: { win: null, fail: null },
    rules: null
  }

  const replacePvpTokens = (text, replacements = {}) => {
    if (!text) return ''
    return String(text)
      .replace(/\{([^}]+)\}/g, (_, token) => (
        Object.prototype.hasOwnProperty.call(replacements, token)
          ? replacements[token]
          : token
      ))
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

  const firstRewardCount = data => {
    for (const group of normalizeItems(data)) {
      for (const rule of (group?.rules || [])) {
        const value = rule?.num ?? rule?.min ?? rule?.max ?? group?.num
        if (value !== undefined && value !== null) return Number(value)
      }
    }
    return 0
  }

  // Keep the player-facing challenge rules from the same config that drives the
  // game UI. Internal IDs and the old season timestamp are intentionally omitted.
  const pvpWinData = rawReward['pvpWin'] || {}
  const pvpFailData = rawReward['pvpFailure'] || {}
  const winRewardCount = firstRewardCount(pvpWinData)
  const failRewardCount = firstRewardCount(pvpFailData)
  if (rawPvp.sessionDes || rawPvp.sessionAreaDes || rawPvp.pvpArea) {
    const areaValues = Object.values(rawPvp.pvpArea || {})
    const hpScale = Number(rawPvp.hpScale) || 0
    const areaCount = areaValues.length
    const areas = areaValues.map(area => {
      const specialStar = Number(area?.spPara?.star?.[0])
      const areaDes = replacePvpTokens(area.des, {
        '6': hpScale,
        '3': Number.isFinite(specialStar) ? specialStar : area.maxStar
      })
      return {
        name: area.areaName,
        description: areaDes,
        modeDescription: area.modeDes || '',
        specialDescription: area.spDes || ''
      }
    })
    pvpRewards.rules = {
      dailyChallenges: Number(rawPvp.pvpDayNum) || 0,
      winScore: Number(rawPvp.winScore) || 0,
      winRewardCount,
      failRewardCount,
      hpScale,
      purchase: {
        price: Number(rawPvp.pvpAddKePrice) || 0,
        count: Number(rawPvp.pvpDayKeAddNum) || 0,
        dailyMax: Number(rawPvp.pvpDayKeAddMax) || 0
      },
      sessionDescription: replacePvpTokens(rawPvp.sessionDes, {
        '6': Number(rawPvp.pvpDayNum) || 0,
        '3': failRewardCount || 3,
        '15': Number(rawPvp.winScore) || 0,
        '5': winRewardCount || 0,
        '挑战赛纪念币': '挑战赛纪念币',
        '最高段位赛区': '最高段位所在赛区',
        '赛季结算奖励': '赛季结算奖励'
      }),
      areas
    }
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
        score: Number(tier.score) || 0,
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
  pvpRewards.battle.win = {
    score: Number(rawPvp.winScore) || 0,
    rewardItems: normalizeItems(pvpWinData)
  }
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
  pvpRewards.battle.fail = { score: 0, rewardItems: normalizeItems(pvpFailData) }
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
