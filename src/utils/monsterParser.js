import { getResourceBaseUrl } from './env.js'
import { fetchWithFallback } from './request.js'
import { fetchItemData, getItemImageUrl } from './itemParser.js'
import { getMonsterIcon, REWARD_MODE_INFO } from './gameMappings.js'

let cachedMonsters = null
let cachedLevelStrength = null
let cachedFullHandbook = null

// Helper to filter out test/junk monsters
function isHiddenMonster(m) {
  if (!m) return true
  const typeId = String(m.typeId || '')
  if (typeId.includes('avatar_obj_000700_01')) return true

  const name = m.name || ''
  const monDes = m.monDes || ''
  if (name.includes('测试') || monDes.includes('测试')) return true

  return false
}

function getSkeletonName(m, key) {
  const typeId = String(m?.typeId || key || '')
  const rawSkel = String(m?.viewData?.skeletonName || m?.typeId || key || '')
  
  if (typeId.includes('003_egg') || typeId.includes('003SummonMon') || typeId.includes('avatar_Mon_003_Summon')) return 'Mon_003'
  if (typeId.includes('013_egg') || typeId.includes('013_eggs') || typeId.includes('013_baby')) return 'Mon_013'
  if (typeId.includes('023_egg')) return 'Mon_021'
  if (typeId.includes('obj_mon069') || typeId.includes('069_jianci')) return 'Mon_069'
  if (rawSkel.includes('obj_mon055') || typeId.includes('Mon055StoneMon')) return 'Mon_055'
  if (typeId.includes('091_LeftHand') || typeId.includes('091_RightHand')) return 'Mon_091'
  
  return m?.viewData?.skeletonName || m?.typeId || key
}

// 个别怪物的头像文件命名与 typeId/皮肤不一致（数据特例），这里手动修正
// 例：070_1a(皮肤 npc_a04) 的文件实际叫 colect_mon_070_1_npc_a04（少一个 a），
//     070_shishen05(皮肤 npc_a05) 的文件实际叫 colect_mon_070_1a_npc_a05（多一个 a）
const MONSTER_PORTRAIT_OVERRIDES = {
  '070_1a_npc_a04': 'colect_mon_070_1_npc_a04',
  '070_shishen05_npc_a05': 'colect_mon_070_1a_npc_a05'
}

function getMonsterPortrait(m, key) {
  const typeId = String(m?.typeId || key || '')
  if (typeId.includes('023_egg')) {
    return '' // Special egg with no icon
  }
  if (typeId.includes('003_egg')) {
    return 'colect_mon_003_egg'
  }

  const skinName = m?.viewData?.skinName || ''

  // If skinName contains 'hero', directly match with typeId
  if (String(skinName).toLowerCase().includes('hero')) {
    const cleanId = typeId.replace('hero_', '')
    return `colect_mon_${cleanId}`
  }

  // 其余规则与全站 getMonsterIcon 一致（avatar→colect、小写、跳过默认皮肤后缀）
  const generated = getMonsterIcon(m?.icon, skinName)
  const overrideKey = `${typeId}_${String(skinName).toLowerCase().replace(/\//g, '_')}`
  return MONSTER_PORTRAIT_OVERRIDES[overrideKey] || generated
}

// Helper to construct variant tag labels
export function getVariantLabel(m) {
  const typeId = String(m?.typeId || '')
  const name = m?.name || ''

  if (typeId.includes('LeftHand')) return '左手部位'
  if (typeId.includes('RightHand')) return '右手部位'
  if (typeId.includes('Summon') || typeId.includes('summon')) return '召唤物'
  if (typeId.includes('egg') || typeId.includes('eggs')) return '卵 / 蛋形态'

  let prefix = ''
  if (typeId.endsWith('crazy') || typeId.includes('crazy') || typeId.includes('_crazy')) {
    prefix += '狂暴 · '
  }
  if (typeId.includes('_fenLie')) {
    prefix += '分裂体 · '
  }
  if (typeId.includes('_elite_boss')) {
    prefix += '精英Boss · '
  } else if (typeId.includes('_elite')) {
    prefix += '精英 · '
  }
  if (typeId.includes('_boss') && !typeId.includes('_elite_boss')) {
    prefix += 'Boss · '
  }
  if (typeId.includes('_tower')) {
    const match = typeId.match(/_tower\d*_(\d+)/)
    if (match) {
      prefix += `爬塔 ${match[1]}层 · `
    } else {
      prefix += '爬塔 · '
    }
  }
  if (typeId.includes('_c00')) {
    prefix += '序章 · '
  } else if (typeId.includes('_c0')) {
    prefix += '特殊 · '
  } else if (typeId.match(/_(1|2|3)$/)) {
    prefix += '特殊 · '
  }

  let displayName = name
  if (typeId.endsWith('_s') && m.aiId === 'areaDefendAttack') {
    displayName = name + '守卫'
  }

  const labelPrefix = prefix ? prefix.slice(0, -3) : ''
  return labelPrefix ? `${labelPrefix} · ${displayName}` : displayName
}

// Base parser function for stats and skills
function processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData, monNames = {}) {
  const unitData = m.unitData || {}
  const rawStats = {
    maxHp: unitData.maxHp || 0,
    phyAtk: unitData.phyAtk || 0,
    magicAtk: unitData.magicAtk || 0,
    phyDef: unitData.phyDef || 0,
    magicDef: unitData.magicDef || 0,
    crit: unitData.crit || 0,
    critRes: unitData.critRes || 0,
    critDam: unitData.critDam || 0,
    atkRange: unitData.atkRange || 0,
    atkFloatMin: unitData.atkFloatMin || 0,
    atkFloatMax: unitData.atkFloatMax || 0,
    runSpeed: unitData.runSpeed || 0,
    repelRes: unitData.repelRes || 0,
    phyAtkPen: unitData.phyAtkPen || 0,
    magicAtkPen: unitData.magicAtkPen || 0,
    rebDam: unitData.rebDam || 0,
    vampire: unitData.vampire || 0,
    cureAdd: unitData.cureAdd || 0
  }

  const translatedStats = []
  Object.keys(rawStats).forEach(key => {
    if (rawStats[key] === 0) return
    translatedStats.push({
      key,
      label: lanDict[key] || key,
      value: rawStats[key]
    })
  })

  // Extract Skills & Summoning hatching birth effects
  let rawSkills = m.skillList || m.skillsList || []
  if (typeof rawSkills === 'string') rawSkills = rawSkills.split(',').filter(Boolean)
  else if (!Array.isArray(rawSkills)) rawSkills = [rawSkills]

  const skills = rawSkills.filter(skillObj => {
    const skillId = typeof skillObj === 'object' ? (skillObj.skillId || skillObj.id) : skillObj
    return skillId && !String(skillId).includes('hero')
  }).map(skillObj => {
    const skillId = typeof skillObj === 'object' ? (skillObj.skillId || skillObj.id) : skillObj
    const s = skillData[skillId]
    if (!s) return null
    
    const lvlData = s.levelData?.['1'] || s.levelData?.[1] || {}
    let aniEvents = lvlData.aniEvents || []
    if (!Array.isArray(aniEvents)) aniEvents = Object.values(aniEvents)
    
    let repelForce = 0
    let muPowers = []
    let repelTime = 0
    let baseDamage = 0
    let birthDes = ''
    
    aniEvents.forEach(evt => {
      const arg = evt.arg || {}
      
      // Parse hatching / summon birth mechanics
      if (evt.eventName === 'birth') {
        const mons = arg.mons || []
        const delay = arg.delay || 0
        const hpPercent = arg.hp ? (arg.hp * 100).toFixed(1) : 0
        const cnt = arg.cnt || 0
        const namedMons = mons.map(id => monNames[id] || id)
        birthDes = ` 效果: 等待 ${delay} 秒后，随机召唤 ${cnt} 只 [${namedMons.join('/')}] 怪物，召唤物血量为母体的 ${hpPercent}%。`
      }

      const processDmg = (dmg) => {
        if (!dmg) return
        if (dmg.repelForce) repelForce = Math.max(repelForce, dmg.repelForce)
        if (dmg.muPower) muPowers.push(JSON.stringify({ val: dmg.muPower, type: dmg.damageType || '' }))
        if (dmg.repelTime) repelTime = Math.max(repelTime, dmg.repelTime)
        if (dmg.baseDamage) baseDamage = Math.max(baseDamage, dmg.baseDamage)
      }

      Object.keys(arg).forEach(key => {
        if (key.startsWith('damage')) {
          processDmg(arg[key])
        }
      })
      if (arg.trap && arg.trap.damage) {
        processDmg(arg.trap.damage)
      }
    })
    
    const uniqueMuPowers = [...new Set(muPowers)].map(s => JSON.parse(s)).filter(m => m.val > 0).sort((a,b) => b.val - a.val)
    
    let cleanDes = (lvlData.des || s.des || '') + birthDes
    cleanDes = cleanDes.replace(/\{|\}|\(|\)|（|）/g, '')

    return {
      id: skillId,
      name: lvlData.name || s.name || lvlData.skillName || s.skillName || skillId,
      cost: lvlData.cost || s.cost || 0,
      des: cleanDes,
      repelForce,
      muPowers: uniqueMuPowers,
      repelTime,
      baseDamage
    }
  }).filter(Boolean)

  // Extract Buffs/Affixes
  let rawBuffs = m.buffsList || m.buffList || {}
  if (typeof rawBuffs === 'string') {
    rawBuffs = rawBuffs.split(',').map(id => ({ id, weight: 1 })).filter(b => b.id)
  } else if (Array.isArray(rawBuffs)) {
    rawBuffs = rawBuffs.map(b => typeof b === 'object' ? { id: b.buffId || b.id, weight: 1 } : { id: b, weight: 1 })
  } else if (typeof rawBuffs === 'object') {
    rawBuffs = Object.entries(rawBuffs).map(([id, weight]) => ({ id, weight }))
  } else {
    rawBuffs = []
  }

  const buffs = rawBuffs.map(buffObj => {
    const buffId = buffObj.id
    const b = buffData[buffId]
    if (!b) return null
    
    const actPara = b.para?.actionPara || {}
    let rectStr = ''
    if (actPara.rectRange) {
      if (typeof actPara.rectRange === 'object') {
        rectStr = `${actPara.rectRange.width || 0}x${actPara.rectRange.lenth || 0}`
      } else {
        rectStr = String(actPara.rectRange)
      }
    } else {
      rectStr = b.rectRange ? String(b.rectRange) : ''
    }

    const rawAddBuffs = actPara.addBuffs || b.addBuffs || []
    let mappedAddBuffs = []
    if (Array.isArray(rawAddBuffs)) {
      mappedAddBuffs = rawAddBuffs.map(id => {
        if (buffData[id]) return buffData[id].buffName || buffData[id].name || id
        return buffData[`buff_${id}`] ? (buffData[`buff_${id}`].buffName || buffData[`buff_${id}`].name) : id
      })
    }

    let name = (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '狂暴' : (b.buffName || b.name || buffId)
    let des = (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '无属性' : (b.buffDes || b.des || '')

    // Special override for mon091BuffCtl (天界 / 天界的效果)
    if (buffId === 'mon091BuffCtl') {
      name = '天界之御'
      des = '战斗开始时，额外召唤 [超天界格莉姆的左手] 与 [超天界格莉姆的右手] 协同作战（继承 50% 生命值、50% 攻击力、100% 防御力）。当双拳全部被击破时，本体将陷入持续 11 秒的瘫痪虚弱状态。'
    }

    // Clean up {} and ()
    let cleanDes = des.replace(/\{|\}|\(|\)|（|）/g, '')

    return {
      id: buffId,
      weight: buffObj.weight || 1,
      name,
      des: cleanDes,
      nameAdd: b.nameAdd || b.para?.nameAdd || '',
      repelForce: actPara.damage?.repelForce || 0,
      muPower: actPara.damage?.muPower || 0,
      damageType: actPara.damage?.damageType || '',
      rectRange: rectStr,
      repelTime: actPara.damage?.repelTime || 0,
      baseDamage: actPara.damage?.baseDamage || 0,
      addBuffs: mappedAddBuffs
    }
  }).filter(Boolean)

  const collectRewards = m.rewards ? parseRewardId(m.rewards, rewards, items, equipGroupData) : []

  return {
    id: m.typeId,
    name: m.name || m.monDes || m.typeId,
    tabLabel: getVariantLabel(m),
    icon: m.icon || m.monIcon || '',
    portraitName: getMonsterPortrait(m, m.typeId), // Pre-compute matched portrait filename
    monDes: m.monDes || '',
    weakAttDes: m.weakAttDes || '',
    stats: translatedStats,
    rawStats,
    level: m.level || 1,
    keyList: unitData.keyList || [],
    skills,
    buffs,
    collectRewards
  }
}

function parseRewardId(rewardId, rewards, items, equipGroupData) {
  if (!rewardId || !rewards) return []
  const rewardData = rewards[rewardId]
  if (!rewardData || !rewardData.items) return []
  
  return rewardData.items.map(group => {
    const totalChance = group.rules.reduce((sum, r) => sum + (r.chance || 0), 0)
    
    const parsedRules = group.rules.map(rule => {
      let parsedRule = { ...rule, targetImg: '', targetName: rule.typeId || rule.mode }
      parsedRule.prob = totalChance > 0 ? (rule.chance / totalChance) : 0
      parsedRule.actualProb = parsedRule.prob * (group.rate || 1)
      
      if (rule.mode === 'item') {
        const targetItem = items.find(i => i.typeId === rule.typeId)
        if (targetItem) {
          parsedRule.targetName = targetItem.name
          parsedRule.targetImg = getItemImageUrl(targetItem)
          parsedRule.targetQuality = targetItem.quality || 1
          parsedRule.targetId = targetItem.typeId
        } else {
          parsedRule.targetName = rule.typeId
          parsedRule.targetImg = ''
          parsedRule.targetQuality = 1
          parsedRule.targetId = rule.typeId
        }
      } else if (REWARD_MODE_INFO[rule.mode]) {
        const info = REWARD_MODE_INFO[rule.mode]
        parsedRule.targetName = info.name
        parsedRule.targetImg = info.icon
        parsedRule.targetQuality = 1
      } else if (rule.mode === 'equipGroup') {
        const eg = equipGroupData[rule.equipTypeGroup]
        if (eg && eg.showItemTypeId) {
          const targetItem = items.find(i => i.typeId === eg.showItemTypeId)
          if (targetItem) {
            parsedRule.targetName = targetItem.name || eg.tip || rule.equipTypeGroup
            parsedRule.targetImg = getItemImageUrl(targetItem)
            parsedRule.targetQuality = targetItem.quality || rule.qualityGroup?.replace('quality_', '') || 1
            parsedRule.targetId = targetItem.typeId
          } else {
            parsedRule.targetName = eg.tip || rule.equipTypeGroup
            parsedRule.targetImg = ''
            parsedRule.targetQuality = rule.qualityGroup?.replace('quality_', '') || 1
            parsedRule.targetId = rule.equipTypeGroup
          }
        } else {
          parsedRule.targetName = rule.equipTypeGroup
          parsedRule.targetImg = ''
          parsedRule.targetQuality = rule.qualityGroup?.replace('quality_', '') || 1
          parsedRule.targetId = rule.equipTypeGroup
        }
      }
      return parsedRule
    })
    
    return {
      rate: group.rate || 1,
      min: group.min || 1,
      max: group.max || 1,
      rules: parsedRules
    }
  })
}

export async function fetchMonsterLevelStrength() {
  if (cachedLevelStrength) return cachedLevelStrength
  const baseUrl = getResourceBaseUrl()
  try {
    const res = await fetch(`${baseUrl}/data/monLevelStrength.json`).then(r => r.json())
    cachedLevelStrength = res.datas?.monLevelStrength || res.monLevelStrength || {}
    return cachedLevelStrength
  } catch (e) {
    console.error('Failed to load monLevelStrength:', e)
    return {}
  }
}

// 怪物图鉴/全怪物图鉴 共用：构建期纯函数，由原始 JSON 对象生成基础数据表
export function buildMonsterMaps(maps) {
  const { items, lanDict, rewards, fileMonRes, monRes, skillRes, buffRes, equipGroupRes } = maps

  const fileMon = fileMonRes.monFile || []
  const monData = monRes.datas || monRes || {}
  const skillData = skillRes.datas || skillRes || {}
  const buffData = buffRes.datas || buffRes || {}
  const equipGroupData = equipGroupRes.equipGroups || {}

  // Build monNames dictionary
  const monNames = {}
  for (const key in monData) {
    if (monData[key]) {
      monNames[key] = monData[key].name || monData[key].monDes || key
    }
  }

  return { items, lanDict, rewards, fileMon, monData, skillData, buffData, equipGroupData, monNames }
}

async function loadRawMonsterMaps() {
  const baseUrl = getResourceBaseUrl()
  const { items, lanDict, rewards } = await fetchItemData()
  const [fileMonRes, monRes, skillRes, buffRes, equipGroupRes] = await Promise.all([
    fetch(`${baseUrl}/data/fileMon.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/mon.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/skill.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/buff.json`).then(r => r.json()),
    fetch(`${baseUrl}/data/equip/equipGroup.json`).then(r => r.json())
  ])
  return { items, lanDict, rewards, fileMonRes, monRes, skillRes, buffRes, equipGroupRes }
}

// 是否为召唤物/蛋形态（会归入 summons 列表）
const isSummonOrEgg = (m) => {
  const mId = String(m?.typeId || '')
  const low = mId.toLowerCase()
  return low.includes('summon') || low.includes('egg') || low.startsWith('obj_') || mId.includes('LeftHand') || mId.includes('RightHand')
}

// monRank -> 展示品质（>=5 五星，==4 四星，其余三星）
const rankToQuality = (rankVal) => (rankVal >= 5 ? 5 : (rankVal === 4 ? 4 : 3))

// 1. fetchMonsterData - Official pokedex grouped by skeletonName
// 构建期纯函数：由基础数据表生成怪物图鉴列表（不依赖网络与浏览器）
export function buildMonsterData(maps) {
  const { items, lanDict, rewards, fileMon, monData, skillData, buffData, equipGroupData, monNames } = maps

  const allMons = Object.entries(monData).map(([key, val]) => {
    if (val && !val.typeId) {
      val.typeId = key
    }
    return val
  })

  const processedMonsters = fileMon.map(baseMon => {
    if (baseMon.hide) return null
    
    const monTypeId = baseMon.monTypeId
    const baseFormInMonJson = monData[monTypeId]
    if (!baseFormInMonJson) return null

    // Grouping key: skeletonName
    const skeleton = getSkeletonName(baseFormInMonJson, monTypeId)
    
    const forms = []
    const summons = []
    
    allMons.forEach(m => {
      if (!m || isHiddenMonster(m)) return

      const mSkeleton = getSkeletonName(m, m.typeId)
      if (mSkeleton !== skeleton) return

      const processed = processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData, monNames)
      
      if (isSummonOrEgg(m)) {
        summons.push(processed)
      } else {
        forms.push(processed)
      }
    })

    // Sort forms: put base form first
    forms.sort((a, b) => {
      if (a.id === monTypeId) return -1
      if (b.id === monTypeId) return 1
      return a.id.localeCompare(b.id)
    })

    const baseRewards = parseRewardId(baseMon.reward, rewards, items, equipGroupData)
    const rankVal = forms[0]?.monRank || 3
    const quality = rankToQuality(rankVal)
    const icon = getMonsterPortrait(baseFormInMonJson, monTypeId) || baseMon.monIcon

    return {
      id: monTypeId,
      type: 'monster',
      name: forms.length > 0 ? (forms[0].name || forms[0].monDes || monTypeId) : monTypeId,
      icon,
      rawIcon: baseFormInMonJson.icon,
      text: baseMon.text,
      label: baseMon.label,
      mark: baseMon.mark || [],
      place: baseMon.place || [],
      baseRewards,
      quality,
      forms,
      summons,
      keywords: `${forms[0]?.name || ''} ${baseMon.label || ''} ${baseMon.place?.join(' ') || ''}`.toLowerCase()
    }
  }).filter(Boolean)
  
  return processedMonsters
}

export async function fetchMonsterData() {
  if (cachedMonsters) return cachedMonsters

  // 优先读取构建期预解析的 parsed/monsters.json
  try {
    const parsed = await fetchWithFallback('data/parsed/monsters.json')
    cachedMonsters = parsed.monsters || []
    cachedFullHandbook = parsed.handbook || null
    return cachedMonsters
  } catch (e) {
    console.warn('parsed/monsters.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  try {
    const maps = await loadRawMonsterMaps()
    const processedMonsters = buildMonsterData(maps)
    cachedMonsters = processedMonsters
    return cachedMonsters
  } catch (error) {
    console.error('Failed to load monster data:', error)
    throw error
  }
}

// 2. buildFullMonsterHandbook - 构建期纯函数：全怪物图鉴
export function buildFullMonsterHandbook(maps) {
  const { items, lanDict, rewards, fileMon, monData, skillData, buffData, equipGroupData, monNames } = maps

  const handbookData = {}

    for (const typeId in monData) {
      const monItem = monData[typeId]
      if (!monItem || isHiddenMonster(monItem)) continue
      if (typeId.toLowerCase().includes('muzhuang') || typeId.toLowerCase().includes('daocaoren')) continue

      const skeleton = getSkeletonName(monItem, typeId)

      if (!handbookData[skeleton]) {
        handbookData[skeleton] = {
          skeletonName: skeleton,
          items: []
        }
      }
      handbookData[skeleton].items.push(monItem)
    }

    const finalPokedex = Object.values(handbookData).map(group => {
      // Sort items within this skeleton group so base form is first
      // Base forms have default/nomal/normal skinName or shorter ID
      group.items.sort((a, b) => {
        const skinA = String(a.viewData?.skinName || '').toLowerCase()
        const skinB = String(b.viewData?.skinName || '').toLowerCase()
        const isBaseA = ['default', 'nomal', 'normal'].includes(skinA)
        const isBaseB = ['default', 'nomal', 'normal'].includes(skinB)
        
        if (isBaseA && !isBaseB) return -1
        if (!isBaseA && isBaseB) return 1
        return a.typeId.length - b.typeId.length || a.typeId.localeCompare(b.typeId)
      })

      const displayBase = group.items[0]
      if (!displayBase) return null

      // Clean baseId
      let baseId = displayBase.typeId
      const baseMatch = baseId.match(/^(\d{3})/)
      if (baseMatch) baseId = baseMatch[1]

      // Find matching description/location in fileMon.json
      let baseMon = null
      if (baseId) {
        const matchedMon = fileMon.find(m => String(m.monTypeId) === String(baseId))
        if (matchedMon) {
          const baseFormInMonJson = monData[baseId]
          if (baseFormInMonJson) {
            const baseSkeleton = getSkeletonName(baseFormInMonJson, baseId)
            if (baseSkeleton === group.skeletonName) {
              baseMon = matchedMon
            }
          }
        }
      }
      const text = baseMon ? baseMon.text : ''
      const place = baseMon ? (baseMon.place || []) : []
      const baseRewards = baseMon ? parseRewardId(baseMon.reward, rewards, items, equipGroupData) : []

      const rankVal = displayBase.monRank || 3
      const quality = rankToQuality(rankVal)

      const forms = []
      const summons = []

      group.items.forEach(m => {
        const processed = processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData, monNames)

        if (isSummonOrEgg(m)) {
          summons.push(processed)
        } else {
          forms.push(processed)
        }
      })

      const icon = getMonsterPortrait(displayBase, displayBase.typeId)

      return {
        id: group.skeletonName,
        name: displayBase.name || '未知单位',
        icon,
        rawIcon: displayBase.icon,
        category: displayBase.category || '未分类',
        text,
        place,
        baseRewards,
        quality,
        forms,
        summons,
        keywords: `${displayBase.name || ''} ${displayBase.category || ''} ${text} ${place.join(' ')}`.toLowerCase()
      }
    }).filter(Boolean)

  return finalPokedex
}

export async function fetchFullMonsterHandbook() {
  if (cachedFullHandbook) return cachedFullHandbook

  try {
    const parsed = await fetchWithFallback('data/parsed/monsters.json')
    cachedMonsters = parsed.monsters || []
    cachedFullHandbook = parsed.handbook || null
    return cachedFullHandbook
  } catch (e) {
    console.warn('parsed/monsters.json 不可用，回退到原始多文件加载:', e?.message || e)
  }

  try {
    const maps = await loadRawMonsterMaps()
    const data = buildFullMonsterHandbook(maps)
    cachedFullHandbook = data
    return data
  } catch (error) {
    console.error('Failed to load full monster handbook:', error)
    return []
  }
}
