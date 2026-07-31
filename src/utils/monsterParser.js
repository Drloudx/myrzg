import { getResourceBaseUrl } from './env'
import { fetchItemData, getItemImageUrl } from './itemParser'

let cachedMonsters = null

export async function fetchMonsterData() {
  if (cachedMonsters) return cachedMonsters

  const baseUrl = getResourceBaseUrl()
  
  try {
    // We need item cache for translation and reward parsing
    const { items, lanDict, rewards } = await fetchItemData()
    
    // Fetch monster related data
    const [fileMonRes, monRes, skillRes, buffRes, equipGroupRes] = await Promise.all([
      fetch(`${baseUrl}/data/fileMon.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/mon.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/skill.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/buff.json`).then(r => r.json()),
      fetch(`${baseUrl}/data/equipGroup.json`).then(r => r.json())
    ])

    const fileMon = fileMonRes.monFile || []
    const monData = monRes.datas || monRes || {}
    const skillData = skillRes.datas || skillRes || {}
    const buffData = buffRes.datas || buffRes || {}
    const equipGroupData = equipGroupRes.equipGroups || {}
    
    // Convert monData object to array and ensure typeId exists from the key
    const allMons = Object.entries(monData).map(([key, val]) => {
      if (val && !val.typeId) {
        val.typeId = key
      }
      return val
    })

    // Parse all monsters
    const processedMonsters = fileMon.map(baseMon => {
      if (baseMon.hide) return null
      
      // Step 2: Find forms and summons
      const monTypeId = baseMon.monTypeId
      
      const forms = []
      const summons = []
      
      // We look for matches in mon.json
      allMons.forEach(m => {
        if (!m || !m.typeId) return
        
        // 过滤掉属于角色的召唤物 (如果技能ID包含 hero)
        const skillsStr = JSON.stringify({ skillId: m.skillId, skillList: m.skillList, skillsList: m.skillsList })
        if (skillsStr.includes('hero')) return

        const mId = String(m.typeId)
        const baseId = String(monTypeId)
        
        // ID equals monTypeId OR ID starts with monTypeId (e.g. 010crazy starts with 010)
        const isIdMatch = mId === baseId || mId.startsWith(baseId)
        if (!isIdMatch) return
        
        // Find if skeleton matches
        // For basic matching, we assume if skeletonName is same as base, it's a form. If different, it's a summon.
        // If we don't have a base skeletonName yet, we assume the exact monTypeId is the base form.
        const baseForm = allMons.find(a => a.typeId === monTypeId)
        const baseSkeleton = baseForm?.viewData?.skeletonName
        
        const isSameSkeleton = baseSkeleton && m.viewData?.skeletonName === baseSkeleton
        const isSameIcon = m.icon && baseForm?.icon === m.icon
        
        // A special case is when typeId is exactly monTypeId, it's obviously a form.
        if (m.typeId === monTypeId || isSameSkeleton || isSameIcon) {
          forms.push(processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData))
        } else {
          summons.push(processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData))
        }
      })
      
      // Step 5: Process base rewards from fileMon.json
      const baseRewards = parseRewardId(baseMon.reward, rewards, items, equipGroupData)

      return {
        id: monTypeId,
        type: 'monster',
        name: forms.length > 0 ? (forms[0].name || forms[0].monDes || monTypeId) : monTypeId,
        icon: baseMon.monIcon,
        text: baseMon.text,
        label: baseMon.label,
        mark: baseMon.mark || [],
        place: baseMon.place || [],
        baseRewards,
        forms,
        summons,
        keywords: `${forms[0]?.name || ''} ${baseMon.label || ''} ${baseMon.place?.join(' ') || ''}`.toLowerCase()
      }
    }).filter(Boolean)
    
    cachedMonsters = processedMonsters
    return cachedMonsters
    
  } catch (error) {
    console.error('Failed to load monster data:', error)
    throw error // Let UI handle it
  }
}

function processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData) {
  // Extract Stats
  const unitData = m.unitData || {}
  const stats = {
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
    keyList: unitData.keyList || []
  }

  // Translate labels for stats using lanDict
  const translatedStats = []
  Object.keys(stats).forEach(key => {
    if (key === 'keyList') return
    if (stats[key] === 0) return // Skip 0 values
    translatedStats.push({
      key,
      label: lanDict[key] || key,
      value: stats[key]
    })
  })

  // Extract Skills
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
    
    aniEvents.forEach(evt => {
      const arg = evt.arg || {}
      
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
    
    return {
      id: skillId,
      name: lvlData.skillName || s.skillName || s.name || skillId,
      cost: lvlData.cost || s.cost || 0,
      des: lvlData.des || s.des || '',
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

    // Map addBuffs to names
    const rawAddBuffs = actPara.addBuffs || b.addBuffs || []
    let mappedAddBuffs = []
    if (Array.isArray(rawAddBuffs)) {
      mappedAddBuffs = rawAddBuffs.map(id => {
        if (buffData[id]) return buffData[id].buffName || buffData[id].name || id
        // In case it's just "1" or "3", we can filter or leave them. For now, leave them if not found.
        return buffData[`buff_${id}`] ? (buffData[`buff_${id}`].buffName || buffData[`buff_${id}`].name) : id
      })
    }

    return {
      id: buffId,
      weight: buffObj.weight || 1,
      name: (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '狂暴' : (b.buffName || b.name || buffId),
      des: (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '无属性' : (b.buffDes || b.des || ''),
      nameAdd: b.nameAdd || b.para?.nameAdd || '',
      repelForce: actPara.damage?.repelForce || 0,
      muPower: actPara.damage?.muPower || 0,
      damageType: actPara.damage?.damageType || '',
      baseDamage: actPara.damage?.baseDamage || 0,
      rectRange: rectStr,
      addBuffs: mappedAddBuffs
    }
  }).filter(Boolean)

  // Extract Collect (Elite drops)
  const collectRewards = m.collectId ? parseRewardId(m.collectId, rewards, items, equipGroupData) : []

  return {
    id: m.typeId,
    name: m.name || m.monDes || m.typeId,
    icon: m.icon || m.monIcon || '',
    monDes: m.monDes || '',
    weakAttDes: m.weakAttDes || '',
    stats: translatedStats,
    keyList: stats.keyList,
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
      } else if (rule.mode === 'randomMoney' || rule.mode === 'money') {
        parsedRule.targetName = '银币'
        parsedRule.targetImg = '/images/Common_ItemIcon/item_00001.png'
        parsedRule.targetQuality = 1
      } else if (rule.mode === 'ke') {
        parsedRule.targetName = '氪金'
        parsedRule.targetImg = '/images/Common_ItemIcon/item_00002.png'
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
