import { getResourceBaseUrl } from './env.js'
import { fetchWithFallback } from './request.js'
import { fetchItemData, getItemImageUrl } from './itemParser.js'
import { JOB_NAMES, ELEMENT_NAMES, REWARD_MODE_INFO, getCleanSkillName } from './gameMappings.js'

let cachedHeroes = null
let cachedHeroLevel = null
let cachedHeroRank = null
let cachedHeroConsume = null

/**
 * 构建期纯函数：由原始 JSON 对象（含 fetchItemData 产物）生成角色图鉴最终数据。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildHeroData(maps) {
  const {
    heroRes, archivesRes, behaviorRes, levelRes, mailRes, rankRes,
    skillUpgradeRes, talkRes, starRes, consumeRes, skillRes, skillTriggerRes,
    taskRes, dialogSegmentsRes, dialogIndexRes,
    items, lanDict, rewards
  } = maps

  const heroDatas = heroRes.datas || heroRes || {}
  const archivesDatas = archivesRes.archives || archivesRes || {}
  const behaviorDatas = behaviorRes.datas || behaviorRes || {}
  const levelDatas = levelRes.heroLevel || levelRes || {}
  const mailDatas = mailRes.datas || mailRes || {}
  const rankDatas = rankRes.heroRank || rankRes || {}
  const skillUpgradeDatas = skillUpgradeRes.datas || skillUpgradeRes || {}
  const talkDatas = talkRes.hero || talkRes || {}
  const starDatas = starRes.heroStar || starRes || {}
  const starLevelDatas = starRes.heroStarLevel || {}
  const consumeDatas = consumeRes.datas || consumeRes || {}
  const skillDatas = skillRes.datas || skillRes || {}
  const skillTriggerDatas = skillTriggerRes.datas || skillTriggerRes || {}

    // 任务名索引（角色档案的剧情任务显示任务名）与剧情分段索引
    const taskNameMap = {}
    const taskDatas = taskRes.datas || {}
    for (const [id, t] of Object.entries(taskDatas)) {
      if (t && t.name) taskNameMap[id] = t.name
    }
    const dialogSegmentsMap = dialogSegmentsRes || {}
    const dialogIndexMap = dialogIndexRes || {}

    // 根据任务 ID 解析剧情分段列表：dialogSegments.json 有则用分段，否则单文件；
    // 每段带 dialogIndex 里的剧情名称（如 "米托拉-营地对话【拾荒计划如何？】"）
    const resolveTaskDialogs = (taskTypeId) => {
      if (!taskTypeId) return []
      const segs = dialogSegmentsMap[taskTypeId]
      const ids = Array.isArray(segs) && segs.length > 0 ? segs : [taskTypeId]
      return ids.map(id => ({
        id,
        name: dialogIndexMap[id] || ''
      }))
    }

    // Save global levels and ranks for reference (level calculator)
    // （构建期纯函数内不再写模块缓存，缓存由 fetchHeroData 负责）

    const processedHeroes = Object.keys(heroDatas).map(key => {
      const h = heroDatas[key]
      if (h.hide === true) return null

      const typeId = h.typeId || key
      const rare = h.rare || 3
      const job = h.job || 1
      const element = h.element || 1

      // 1. Job and Element mappings
      const jobName = JOB_NAMES[job] || '未知职业'
      const elementName = ELEMENT_NAMES[element] || '无'

      // 2. Process favorability items (itemFavor)
      const favorItems = []
      if (h.itemFavor) {
        Object.entries(h.itemFavor).forEach(([itemId, val]) => {
          const item = items.find(i => i.typeId === itemId)
          favorItems.push({
            id: itemId,
            points: val,
            name: item ? item.name : itemId,
            quality: item ? item.quality : 1,
            img: item ? getItemImageUrl(item) : ''
          })
        })
      }

      // 3. Process skills: normalAttack and skillList
      const parsedSkills = []
      
      // Normal attack
      if (h.normalAttack) {
        const skillId = h.normalAttack
        const s = skillDatas[skillId]
        if (s) {
          parsedSkills.push(processSkillInfo(skillId, s, 'normal', rare, element, skillUpgradeDatas.skillOne, consumeDatas, items))
        }
      }

      // Active skills (correctly mapping idx 0 -> skillOne and idx 1 -> skillTwo)
      if (h.skillList && Array.isArray(h.skillList)) {
        h.skillList.forEach((skillId, idx) => {
          const s = skillDatas[skillId]
          if (s) {
            const upgradeList = idx === 0 ? skillUpgradeDatas.skillOne : skillUpgradeDatas.skillTwo
            parsedSkills.push(processSkillInfo(skillId, s, 'active', rare, element, upgradeList, consumeDatas, items))
          }
        })
      }

      // 4. Process star skills (paSkillList)
      const starSkills = []
      if (h.paSkillList) {
        Object.entries(h.paSkillList).forEach(([starKey, skillId], index) => {
          const trigger = skillTriggerDatas[skillId]
          if (trigger) {
            // Get upgrade matrix for this rarity index
            // starSkill1 is index 0, starSkill2 is index 1, starSkill3 is index 2, starSkill4 is index 3
            const shardCosts = (starLevelDatas[rare] && starLevelDatas[rare][index]) || []
            const levelData = []
            if (trigger.levelData) {
              Object.entries(trigger.levelData).forEach(([lvlKey, lvlVal]) => {
                levelData.push({
                  level: parseInt(lvlKey),
                  name: lvlVal.skillName || trigger.skillName || '',
                  des: lvlVal.des || '',
                  cost: shardCosts[parseInt(lvlKey) - 1] || 0
                })
              })
            }
            const rawName = trigger.name || trigger.skillName || (levelData[0] && levelData[0].name) || '星阶技能'
            starSkills.push({
              key: starKey, // e.g. "starSkill1"
              id: skillId,
              icon: trigger.skillIcon || `skill_${skillId}`,
              name: getCleanSkillName(rawName),
              levelData,
              maxLevel: levelData.length
            })
          }
        })
      }

      // 5. Talent / Passive skills (talentSkillList)
      const talentSkills = []
      if (h.talentSkillList && Array.isArray(h.talentSkillList)) {
        h.talentSkillList.forEach(skillId => {
          const trigger = skillTriggerDatas[skillId]
          if (trigger) {
            const levelData = []
            if (trigger.levelData) {
              Object.entries(trigger.levelData).forEach(([lvlKey, lvlVal]) => {
                levelData.push({
                  level: parseInt(lvlKey),
                  name: lvlVal.skillName || trigger.skillName || '被动天赋',
                  des: lvlVal.des || ''
                })
              })
            }
            const rawName = trigger.name || trigger.skillName || (levelData[0] && levelData[0].name) || '核心天赋'
            talentSkills.push({
              id: skillId,
              icon: trigger.skillIcon || `skill_${skillId}`,
              name: getCleanSkillName(rawName),
              levelData
            })
          }
        })
      }

      // 6. Archives and Story Tasks (combined in natural favorability order)
      const archives = []
      const heroArchivesList = archivesDatas[typeId] || []
      
      heroArchivesList.forEach(arch => {
        const taskTypeId = arch.taskTypeId || ''
        archives.push({
          title: arch.archiveTitle || '',
          desc: arch.archiveDesc || '',
          taskDesc: arch.archiveTask || '',
          unlockFav: arch.unlockFavValue || 0,
          type: arch.type || 0,
          reward: arch.reward ? parseReward(arch.reward, rewards, items) : null,
          mail: arch.mailTypeId ? processMail(arch.mailTypeId, mailDatas, rewards, items) : null,
          taskTypeId,
          taskName: taskNameMap[taskTypeId] || '',
          dialogs: resolveTaskDialogs(taskTypeId),
          stats: arch.unitData || {}
        })
      })

      // Sort in favorability unlock threshold ascending order
      archives.sort((a, b) => a.unlockFav - b.unlockFav)

      // 7. Behavior voicelines and interaction texts
      const behavior = behaviorDatas[typeId] || {}
      const talk = talkDatas[typeId] || {}

      const touchLines = (behavior.motou || []).map(m => ({
        text: m.text,
        vocal: m.vocal || '',
        face: m.face || '',
        min: m.min || 0,
        max: m.max || 0
      }))

      const walkLines = (behavior.luguo || []).map(l => ({
        text: l.text,
        vocal: l.vocal || '',
        face: l.face || '',
        min: l.min || 0,
        max: l.max || 0
      }))

      const ziyanziyuLines = (behavior.ziyanziyu || []).map(z => ({
        text: z.text,
        vocal: z.vocal || '',
        face: z.face || '',
        min: z.min || 0,
        max: z.max || 0
      }))

      const chatLines = (behavior.chat || []).map(c => ({
        dialog: c.dialog || '',
        min: c.min || 0,
        max: c.max || 0
      }))

      const heroEvents = (behavior.heroEvent || []).map(e => ({
        day: e.day || 0,
        title: e.title || '',
        dialog: e.dialog || ''
      }))

      // Exploration & combat dialogue
      const exploreTalks = {
        start: talk.start || [],
        fight: talk.fight || [],
        win: talk.win || [],
        exploreTalk: talk.exploreTalk || [],
        loopEnd: talk.loopEnd || [],
        readyGoHome: talk.readyGoHome || [],
        over: talk.over || [],
        roomFinishMember: talk.roomFinishMember || [],
        roomFinishLeader: talk.roomFinishLeader || [],
        getGift: talk.getGift || [],
        gacha: talk.gacha || []
      }

      // 8. Star coins memory crystal limits configuration
      const starConfig = starDatas[rare] || {}
      const starLimitInfo = {
        limit: starConfig.starCoinLimit || 0,
        rewardItemId: starConfig.itemTypeId || 'item_20026',
        rewardItemNum: starConfig.itemNum || 0
      }

      return {
        id: typeId,
        name: h.name,
        name2: h.name2 || '',
        des: h.des || '',
        icon: h.icon || '',
        img: h.img || '',
        rare,
        job,
        jobName,
        element,
        elementName,
        itemFavor: favorItems,
        unitData: h.unitData || {},
        skills: parsedSkills,
        starSkills,
        talentSkills,
        archives,
        behavior: {
          chat: chatLines,
          heroEvent: heroEvents,
          touch: touchLines,
          walk: walkLines,
          ziyanziyu: ziyanziyuLines,
          explore: exploreTalks
        },
        starLimitInfo
      }
    }).filter(Boolean)

    // Sort: rare descending, then id ascending
    processedHeroes.sort((a, b) => {
      if (b.rare !== a.rare) return b.rare - a.rare
      return a.id.localeCompare(b.id)
    })

    return {
      heroes: processedHeroes,
      heroLevel: levelRes,
      heroRank: rankRes,
      consumeDatas
    }
}

async function loadRawHeroMaps() {
  const baseUrl = getResourceBaseUrl()
  const [
    heroRes,
    archivesRes,
    behaviorRes,
    levelRes,
    mailRes,
    rankRes,
    skillUpgradeRes,
    talkRes,
    starRes,
    consumeRes,
    skillRes,
    skillTriggerRes,
    taskRes,
    dialogSegmentsRes,
    dialogIndexRes
  ] = await Promise.all([
    fetch(`${baseUrl}/data/hero/hero.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroArchives.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroBehavior.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroLevel.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroMail.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroRank.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroSkillUpgrade.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroTalk.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/hero/heroStar.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/consume.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/skill.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/skillTrigger.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/task.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/parsed/dialogSegments.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/parsed/dialogIndex.json`).then(r => r.json())
  ])
  return {
    heroRes, archivesRes, behaviorRes, levelRes, mailRes, rankRes,
    skillUpgradeRes, talkRes, starRes, consumeRes, skillRes, skillTriggerRes,
    taskRes, dialogSegmentsRes, dialogIndexRes
  }
}

/**
 * 角色图鉴数据加载：优先读取构建期预解析的 parsed/heroes.json（单文件、免运行时解析），
 * 预解析文件缺失时回退到原始多文件加载 + 运行时解析。
 */
export async function fetchHeroData() {
  if (cachedHeroes) {
    return {
      heroes: cachedHeroes,
      heroLevel: cachedHeroLevel,
      heroRank: cachedHeroRank,
      consumeDatas: cachedHeroConsume
    }
  }

  try {
    const parsed = await fetchWithFallback('data/parsed/heroes.json')
    cachedHeroes = parsed.heroes
    cachedHeroLevel = parsed.heroLevel
    cachedHeroRank = parsed.heroRank
    cachedHeroConsume = parsed.consumeDatas
    return parsed
  } catch (e) {
    console.warn('parsed/heroes.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  try {
    // We need core items, lanDict, and rewards for translation and reward parsing
    const { items, lanDict, rewards } = await fetchItemData()
    const rawMaps = await loadRawHeroMaps()
    const data = buildHeroData({ ...rawMaps, items, lanDict, rewards })
    cachedHeroes = data.heroes
    cachedHeroLevel = data.heroLevel
    cachedHeroRank = data.heroRank
    cachedHeroConsume = data.consumeDatas
    return data
  } catch (err) {
    console.error('Failed to parse hero data:', err)
    throw err
  }
}

// Help process active skills and normal attacks
function processSkillInfo(skillId, s, type, rare, element, upgradeList, consumeDatas, items) {
  // Extract multiplier and damage type for normal attacks
  let power = 100
  let isPhy = true
  if (type === 'normal' && s.levelData && s.levelData["1"] && s.levelData["1"].aniEvents) {
    const ani = s.levelData["1"].aniEvents.find(e => e.arg && e.arg.damage)
    if (ani && ani.arg && ani.arg.damage) {
      const dmg = ani.arg.damage
      if (dmg.muPower !== undefined) {
        power = Math.round(dmg.muPower * 100)
      }
      if (dmg.damageType === 'magicAtk' || dmg.muAddType === 'magicAtk') {
        isPhy = false
      }
    }
  }

  // s.levelData maps level numbers to details
  let levelData = []
  if (s.levelData) {
    Object.entries(s.levelData).forEach(([lvlKey, lvlVal]) => {
      let customDes = lvlVal.des || ''
      if (type === 'normal' && !customDes) {
        customDes = `造成 {${power}%}${isPhy ? '物理攻击' : '魔法攻击'}加成的${isPhy ? '物理' : '魔法'}伤害。`
      }
      levelData.push({
        level: parseInt(lvlKey),
        name: lvlVal.skillName || s.skillName || '',
        des: customDes,
        cd: lvlVal.cd !== undefined ? lvlVal.cd : (s.cd || 0),
        cost: lvlVal.cost !== undefined ? lvlVal.cost : (s.cost || 0)
      })
    })
    // Restrict skill level max to 12
    if (levelData.length > 12) {
      levelData = levelData.slice(0, 12)
    }
  }

  // Upgrade costs matching skill level thresholds
  let upgrades = []
  const rareUpgradeList = upgradeList ? upgradeList[rare] : null
  if (rareUpgradeList && Array.isArray(rareUpgradeList)) {
    rareUpgradeList.forEach(entry => {
      const consumeKey = entry.upgradeConsume ? entry.upgradeConsume[element] : null
      const consumeDetail = consumeKey ? consumeDatas[consumeKey] : null
      
      const parsedItems = []
      if (consumeDetail && consumeDetail.items) {
        consumeDetail.items.forEach(cItem => {
          const dbItem = items.find(i => i.typeId === cItem.typeId)
          parsedItems.push({
            id: cItem.typeId,
            num: cItem.num,
            name: dbItem ? dbItem.name : cItem.typeId,
            quality: dbItem ? dbItem.quality : 1,
            img: dbItem ? getItemImageUrl(dbItem) : ''
          })
        })
      }

      upgrades.push({
        level: entry.level, // Current skill level
        heroLevel: entry.heroLevel, // Hero level threshold required to upgrade to next level
        consumeKey,
        money: consumeDetail ? consumeDetail.money : 0,
        items: parsedItems
      })
    })
    // Restrict upgrades to 11 steps (upgrade to max level 12)
    if (upgrades.length > 11) {
      upgrades = upgrades.slice(0, 11)
    }
  }

  const rawName = s.name || s.skillName || (levelData[0] && levelData[0].name) || '技能'
  return {
    id: skillId,
    type,
    icon: `skill_${skillId}`,
    name: getCleanSkillName(rawName),
    levelData,
    upgrades,
    maxLevel: levelData.length
  }
}

// Mail parsing
function processMail(mailId, mailDatas, rewards, items) {
  const mail = mailDatas[mailId]
  if (!mail) return null
  return {
    id: mailId,
    title: mail.title || '',
    content: mail.content || '',
    reward: mail.reward ? parseReward(mail.reward, rewards, items) : null,
    taskTypeId: mail.taskTypeId || '',
    getTaskText: mail.getTaskText || ''
  }
}

// Reward list parsing helper
function parseReward(rewardId, rewards, items) {
  if (!rewardId || !rewards) return null
  const rewardData = rewards[rewardId]
  if (!rewardData || !rewardData.items) return null

  const parsedItems = []
  rewardData.items.forEach(group => {
    group.rules.forEach(rule => {
      if (rule.mode === 'item') {
        const targetItem = items.find(i => i.typeId === rule.typeId)
        parsedItems.push({
          id: rule.typeId,
          name: targetItem ? targetItem.name : rule.typeId,
          img: targetItem ? getItemImageUrl(targetItem) : '',
          quality: targetItem ? targetItem.quality : 1,
          chance: rule.chance || 1
        })
      } else if (rule.mode === 'randomMoney' || rule.mode === 'money') {
        parsedItems.push({
          id: 'money',
          name: REWARD_MODE_INFO.money.name,
          img: REWARD_MODE_INFO.money.icon,
          quality: 1,
          chance: rule.chance || 1
        })
      } else if (rule.mode === 'ke') {
        parsedItems.push({
          id: 'ke',
          name: REWARD_MODE_INFO.ke.name,
          img: REWARD_MODE_INFO.ke.icon,
          quality: 1,
          chance: rule.chance || 1
        })
      }
    })
  })

  return {
    id: rewardId,
    items: parsedItems
  }
}

// Interactive stats calculator: computes values at Level L and Rank R
export function calculateStats(unitData, level, rank, heroLevelConfig, heroRankConfig) {
  const growthFields = ['phyAtk', 'magicAtk', 'phyDef', 'magicDef', 'maxHp']
  const results = {}

  // Get base growth per level (default 0.05 / 5%)
  const levelGrowthRate = heroLevelConfig?.attUp || 0.05
  
  // Calculate total rank attUp sum
  let rankGrowthSum = 0
  const rankList = heroRankConfig?.heroRank || {}
  for (let r = 0; r < rank; r++) {
    const rankInfo = rankList[r]
    if (rankInfo && rankInfo.attUp !== undefined) {
      rankGrowthSum += rankInfo.attUp
    }
  }

  const multiplier = 1 + (level - 1) * levelGrowthRate + rankGrowthSum

  growthFields.forEach(field => {
    const baseVal = unitData[field] || 0
    results[field] = Math.round(baseVal * multiplier)
  })

  // Copy non-growth attributes
  Object.keys(unitData).forEach(key => {
    if (!growthFields.includes(key)) {
      results[key] = unitData[key]
    }
  })

  return results
}

// Compute cumulative upgrade and breakthrough costs
export function calculateUpgradeCosts(targetLevel, targetRank, rarity, job, heroLevelConfig, heroRankConfig, consumeDatas, items) {
  let totalExp = 0
  let totalUpgradeMoney = 0
  let totalBreakthroughMoney = 0

  // 1. Level upgrade costs (Level 1 -> targetLevel)
  const levelList = heroLevelConfig?.heroLevel || {}
  for (let l = 1; l < targetLevel; l++) {
    const lvlInfo = levelList[l]
    if (lvlInfo && lvlInfo.exp) {
      totalExp += lvlInfo.exp
      totalUpgradeMoney += lvlInfo.exp // 1:1 ratio
    }
  }

  // 2. Rank breakthrough costs (Rank 0 -> targetRank)
  const rankList = heroRankConfig?.heroRank || {}
  const breakthroughItemsMap = {}

  for (let r = 0; r < targetRank; r++) {
    const rankInfo = rankList[r]
    const consumeKey = rankInfo?.upgradeConsume?.[rarity]?.[job]
    if (consumeKey) {
      const consumeDetail = consumeDatas?.[consumeKey] || consumeDatas?.datas?.[consumeKey]
      if (consumeDetail) {
        totalBreakthroughMoney += consumeDetail.money || 0
        if (consumeDetail.items) {
          consumeDetail.items.forEach(cItem => {
            const dbItem = items.find(i => i.typeId === cItem.typeId)
            const itemId = cItem.typeId
            if (!breakthroughItemsMap[itemId]) {
              breakthroughItemsMap[itemId] = {
                id: itemId,
                name: dbItem ? dbItem.name : itemId,
                quality: dbItem ? dbItem.quality : 1,
                img: dbItem ? getItemImageUrl(dbItem) : '',
                num: 0
              }
            }
            breakthroughItemsMap[itemId].num += cItem.num
          })
        }
      }
    }
  }

  return {
    exp: totalExp,
    upgradeMoney: totalUpgradeMoney,
    breakthroughMoney: totalBreakthroughMoney,
    breakthroughItems: Object.values(breakthroughItemsMap)
  }
}
