import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const publicDataDir = path.join(__dirname, '../public/data')
const rewardPath = path.join(publicDataDir, 'reward.json')
const pvpPath = path.join(publicDataDir, 'pvp.json')
const exchangePath = path.join(publicDataDir, 'itemExchange.json')
const consumePath = path.join(publicDataDir, 'consume.json')

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.warn(`Failed to load ${filePath}`)
    return {}
  }
}

const rawReward = loadJSON(rewardPath).datas || {}
const rawPvp = loadJSON(pvpPath) || {}
const rawExchange = loadJSON(exchangePath).itemExchange || {}
const rawConsume = loadJSON(consumePath).datas || {}

const pvpRewards = {
  exchange: {},
  tier: [],
  rank: [],
  battle: { win: null, fail: null }
}

const itemSources = {}
function addSource(itemId, type, id, name, des) {
  if (!itemSources[itemId]) itemSources[itemId] = []
  if (!itemSources[itemId].find(x => x.type === type && x.id === id)) {
    itemSources[itemId].push({ type, id, name, des })
  }
}

// 1. Process Exchange Rewards
function extractSpecialItems(data) {
  const items = []
  if (data.ke) items.push({ rules: [{ typeId: 'item_00002', num: data.ke }] })
  if (data.exp) items.push({ rules: [{ typeId: 'item_00004', num: data.exp }] })
  if (data.heroExp) items.push({ rules: [{ typeId: 'item_00006', num: data.heroExp }] })
  if (data.equipExp) items.push({ rules: [{ typeId: 'item_00007', num: data.equipExp }] })
  return items
}

function normalizeItems(data) {
  if (!data) return []
  const special = extractSpecialItems(data)
  return special.concat(data.items || [])
}

Object.values(rawExchange).forEach(ex => {
  if (ex.category && ex.category[0] === 'pvp') {
    const subCat = ex.category[1] || '兑换'
    if (!pvpRewards.exchange[subCat]) {
      pvpRewards.exchange[subCat] = []
    }
    
    const rewardData = rawReward[ex.reward] || {}
    const consumeData = rawConsume[ex.consume] || {}
    
    const exchangeItem = {
      id: ex.id,
      sort: ex.sort || 0,
      limitCondition: ex.limitCondition,
      rewardItems: normalizeItems(rewardData),
      consumeItems: normalizeItems(consumeData)
    }
    pvpRewards.exchange[subCat].push(exchangeItem)
    
    // Reverse mapping
    const allItems = normalizeItems(rewardData)
    if (allItems.length > 0) {
      allItems.forEach(group => {
        if (group.rules) {
          group.rules.forEach(r => {
            if (r.typeId && r.typeId.startsWith('item_')) {
              addSource(r.typeId, 'pvp', 'exchange', `s1兑换`, '兑换奖励')
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
    
    // Reverse mapping
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
    
    // Reverse mapping
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

pvpRewards.battle.win = {
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

pvpRewards.battle.fail = {
  rewardItems: normalizeItems(pvpFailData)
}
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

  const parsedDir = path.join(__dirname, '../public/data/parsed')
  if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

  fs.writeFileSync(
    path.join(parsedDir, 'parsed-pvp.json'),
    JSON.stringify(pvpRewards, null, 2),
    'utf8'
  )

  fs.writeFileSync(
    path.join(parsedDir, 'parsed-pvp-sources.json'),
    JSON.stringify(itemSources, null, 2),
    'utf8'
  )

console.log('✅ Parsed PVP rewards successfully generated.')
