import { fetchWithFallback } from './request.js'
import { createCachedLoader } from './resourceClient.js'
import { getItemImageUrl } from './itemParser.js'
import { getCleanSkillName, getMonsterIcon, REWARD_MODE_INFO } from './gameMappings.js'
import { describeBuff } from './buffParser.js'

let cachedMonsters = null
let cachedLevelStrength = null

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

const SPECIAL_FORM_OWNERS = {
  '003_egg': '003',
  '003SummonMon': '003',
  '013_egg': '013',
  '013_eggs': '013',
  '013_baby': '013',
  '023_egg': '021',
  'obj_mon069': '069',
  '069_jianci': '069',
  'obj_mon055': '055',
  'Mon055StoneMon': '055',
  '091_LeftHand': '091',
  '091_RightHand': '091'
}

function getFormOwnerId(typeId, officialIds) {
  const id = String(typeId || '')
  if (officialIds.includes(id)) return id

  const special = Object.entries(SPECIAL_FORM_OWNERS).find(([part]) => id.includes(part))
  if (special && officialIds.includes(special[1])) return special[1]

  const candidates = officialIds
    .filter(baseId => id.startsWith(`${baseId}_`) || id.startsWith(`${baseId}crazy`) || id.startsWith(`${baseId}Summon`))
    .sort((a, b) => b.length - a.length)
  if (candidates.length) return candidates[0]

  return officialIds.length === 1 ? officialIds[0] : ''
}

function visitNested(value, callback, path = []) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitNested(entry, callback, [...path, index]))
    return
  }
  Object.entries(value).forEach(([key, entry]) => {
    callback(key, entry, value, path)
    visitNested(entry, callback, [...path, key])
  })
}

const VARIANT_SOURCE_LABELS = {
  story: '剧情',
  explore: '探索',
  dungeon: '副本',
  daily: '日常',
  tower: '神匠之塔',
  scene: '场景'
}

const VARIANT_SOURCE_ORDER = ['story', 'explore', 'dungeon', 'daily', 'tower', 'scene']

function getDataRoot(value, key = 'datas') {
  return value?.[key] || value || {}
}

function getBattleUsageKind(battleId, battle) {
  const id = String(battleId || '')
  const category = Array.isArray(battle?.category) ? battle.category.join(' ') : String(battle?.category || '')
  const text = `${id} ${battle?.name || ''} ${battle?.tip || ''} ${category}`
  if (/测试|停用|\btest\b/i.test(text)) return 'test'
  if (/^tower/i.test(id) || category.includes('爬塔') || category.includes('神匠之塔') || category.includes('塔1')) return 'tower'
  if (category.includes('副本')) return 'dungeon'
  if (/^daily_/i.test(id) || category.includes('日常')) return 'daily'
  return 'story'
}

function getRoomMonsterIds(room) {
  const ids = []
  const rounds = room?.battleData?.monRounds || room?.monRounds || []
  rounds.forEach(round => {
    const mons = round?.mons || round?.monsters || []
    mons.forEach(mon => {
      const id = String(mon?.typeId || '')
      if (id) ids.push(id)
    })
  })
  return ids
}

function getAiTransitionCondition(aiModel, targetState) {
  const incoming = new Map()
  Object.entries(aiModel || {}).forEach(([stateName, state]) => {
    const transitions = Array.isArray(state?.tri) ? state.tri : []
    transitions.forEach(transition => {
      const target = String(transition?.triEnter || '')
      if (!target) return
      const entries = incoming.get(target) || []
      entries.push({ stateName, transition })
      incoming.set(target, entries)
    })
  })

  const queue = [String(targetState || '')]
  const checked = new Set()
  while (queue.length) {
    const state = queue.shift()
    if (!state || checked.has(state)) continue
    checked.add(state)
    for (const entry of incoming.get(state) || []) {
      if (entry.transition?.triList?.length) return entry.transition
      queue.push(entry.stateName)
    }
  }
  return null
}

function formatAiTriggerCondition(trigger) {
  const conditions = (trigger?.triList || []).map(check => {
    const para = check?.triPara || {}
    switch (Number(check?.triType)) {
      case 1: return `持续 ${Number(para.float_para1 || 0)} 秒后`
      case 2: return `生命值降至 ${Math.round(Number(para.float_para1 || 0) * 100)}% 及以下`
      case 7: return `完成 ${Number(para.int_para1 || 0)} 次攻击后`
      case 8: return '死亡时'
      case 14: return `技能 ${Number(para.int_para1 || 0) + 1} 可用时`
      case 15: return `技能 ${Number(para.int_para1 || 0) + 1} 结算后`
      case 16: return `被命中 ${Number(para.int_para1 || 0)} 次后`
      case 17: return `单次受伤超过最大生命值的 ${Math.round(Number(para.int_para1 || 0) * 100)}% 时`
      case 18: return `${Number(para.float_para1 || 0)} 秒未攻击后`
      case 19: return '战斗胜利后'
      case 20: return '角色濒死时'
      default: return ''
    }
  }).filter(Boolean)
  if (!conditions.length) return '满足 AI 切换条件时'
  return conditions.join(Number(trigger?.triCheckType) === 2 ? '，且' : '，或')
}

function getTransformEdges(monData, aiData) {
  const knownMonsterIds = new Set(Object.keys(monData || {}))
  const rawEdges = []
  Object.values(monData || {}).forEach(monster => {
    const sourceId = String(monster?.typeId || '')
    const aiModel = aiData?.[monster?.aiId]?.aiModel || {}
    Object.entries(aiModel).forEach(([stateName, state]) => {
      if (Number(state?.type) !== 6) return
      const targetId = String(state?.para?.string_para || '')
      if (!knownMonsterIds.has(sourceId) || !knownMonsterIds.has(targetId)) return
      const trigger = getAiTransitionCondition(aiModel, stateName)
      rawEdges.push({
        fromId: sourceId,
        fromName: monData[sourceId]?.name || monData[sourceId]?.monDes || sourceId,
        toId: targetId,
        toName: monData[targetId]?.name || monData[targetId]?.monDes || targetId,
        condition: formatAiTriggerCondition(trigger),
        checkMode: Number(trigger?.triCheckType) === 2 ? 'all' : 'once'
      })
    })
  })

  return rawEdges.filter(edge => {
    const reverse = rawEdges.find(item => item.fromId === edge.toId && item.toId === edge.fromId)
    if (!reverse) return true
    return edge.fromId.length < edge.toId.length
      || (edge.fromId.length === edge.toId.length && edge.fromId.localeCompare(edge.toId) < 0)
  }).map(edge => {
    const reverse = rawEdges.find(item => item.fromId === edge.toId && item.toId === edge.fromId)
    return reverse ? { ...edge, reverseCondition: reverse.condition } : edge
  })
}

// 构建期用途索引：只输出最终关系标签、变身链和精简塔层，不把房间/关卡明细带到浏览器。
export function buildMonsterVariantUsage({ monData, aiData, towerUsageRes = {}, exploreAreaRes = {}, roomRes = {}, battleRes = {}, dungeonBattleRes = {}, dungeonBattleRoomsRes = {} }) {
  const usage = new Map()
  const transformSourcesByTarget = new Map()
  const transformEdgesByMonster = new Map()
  const towerAppearancesByMonster = new Map()
  const towerBossAppearancesByMonster = new Map()
  const knownMonsterIds = new Set(Object.keys(monData || {}))

  const addUsage = (monsterId, kind, label = '') => {
    const id = String(monsterId || '')
    if (!knownMonsterIds.has(id)) return
    const entry = usage.get(id) || { kinds: new Set(), labels: new Set() }
    entry.kinds.add(kind)
    if (label) entry.labels.add(String(label))
    usage.set(id, entry)
  }

  const addTransform = edge => {
    const source = String(edge?.fromId || '')
    const target = String(edge?.toId || '')
    const sources = transformSourcesByTarget.get(target) || new Set()
    sources.add(source)
    transformSourcesByTarget.set(target, sources)
    ;[source, target].forEach(id => {
      const edges = transformEdgesByMonster.get(id) || []
      edges.push(edge)
      transformEdgesByMonster.set(id, edges)
    })
  }

  getTransformEdges(monData, aiData).forEach(addTransform)

  Object.entries(getDataRoot(towerUsageRes)).forEach(([monsterId, appearances]) => {
    const id = String(monsterId || '')
    if (!knownMonsterIds.has(id) || !Array.isArray(appearances) || !appearances.length) return
    towerAppearancesByMonster.set(id, appearances)
    addUsage(id, 'tower', appearances.map(entry => entry.towerName).filter(Boolean).join(' / '))

    // 通用形态本身不会被塔房间直接引用；若塔内使用的是 *_boss 形态，
    // 仅将其塔层摘要关联到去掉后缀的通用形态，详情页可复用同一展示组件。
    const bossBaseId = id.replace(/_boss$/i, '')
    if (bossBaseId !== id && knownMonsterIds.has(bossBaseId)) {
      towerBossAppearancesByMonster.set(bossBaseId, appearances)
    }
  })

  Object.values(getDataRoot(exploreAreaRes)).forEach(area => {
    const label = area?.eventName || area?.name || ''
    const enemies = area?.enemys || area?.enemies || []
    enemies.forEach(id => addUsage(id, 'explore', label))
  })

  const battleData = getDataRoot(battleRes)
  const dungeonBattleData = getDataRoot(dungeonBattleRes)
  const dungeonRooms = getDataRoot(dungeonBattleRoomsRes)
  const roomToBattles = new Map()
  Object.entries(dungeonRooms).forEach(([battleId, battle]) => {
    visitNested(battle, (key, value) => {
      if (key !== 'roomTypeId' || typeof value !== 'string') return
      const ids = roomToBattles.get(value) || new Set()
      ids.add(battleId)
      roomToBattles.set(value, ids)
    })
  })

  const battleIds = [...new Set([...Object.keys(battleData), ...Object.keys(dungeonBattleData)])]
    .sort((a, b) => b.length - a.length)
  const resolveRoomBattles = roomId => {
    const mapped = roomToBattles.get(roomId)
    if (mapped?.size) return [...mapped]
    const matched = battleIds.find(id => roomId === id || roomId.startsWith(`${id}_`))
    return matched ? [matched] : []
  }

  Object.entries(getDataRoot(roomRes, 'rooms')).forEach(([roomId, room]) => {
    const monsterIds = getRoomMonsterIds(room)
    if (!monsterIds.length) return

    const matchedBattles = resolveRoomBattles(roomId)
    if (matchedBattles.length) {
      matchedBattles.forEach(battleId => {
        const battle = dungeonBattleData[battleId] || battleData[battleId] || {}
        const kind = getBattleUsageKind(battleId, battle)
        monsterIds.forEach(id => addUsage(id, kind, battle.name || battleId))
      })
      return
    }

    const kind = /^tower/i.test(roomId) ? 'tower' : (/^daily_/i.test(roomId) ? 'daily' : 'scene')
    monsterIds.forEach(id => addUsage(id, kind, roomId))
  })

  return { usage, transformSourcesByTarget, transformEdgesByMonster, towerAppearancesByMonster, towerBossAppearancesByMonster, hasSourceData: usage.size > 0 }
}

const SPECIAL_TRANSFORM_CONFIGS = {
  '012': {
    stage1Name: '空中结网 · 霸体',
    stage2Name: '坠地虚弱 · 破防',
    stage1Tab: '空中结网 (一阶段)',
    stage2Tab: '坠地虚弱 (二阶段)',
    condition: '被命中 4 次后击落',
    reverseCondition: '完成 2 次攻击后逃窜回网'
  }
}

function applyVariantMetadata(form, typeId, ownerId, variantUsage) {
  const id = String(typeId || '')
  const edges = variantUsage?.transformEdgesByMonster?.get(id) || []
  const edge = edges.find(item => item.fromId === ownerId)
    || edges.find(item => item.toId === ownerId)
    || edges[0]
  if (edge) {
    const special = SPECIAL_TRANSFORM_CONFIGS[edge.fromId] || SPECIAL_TRANSFORM_CONFIGS[ownerId]
    form.transform = {
      ...edge,
      currentStage: id === edge.toId ? 'after' : 'before',
      ...(special ? {
        stage1Name: special.stage1Name,
        stage2Name: special.stage2Name,
        stage1Tab: special.stage1Tab,
        stage2Tab: special.stage2Tab,
        ...(special.condition ? { condition: special.condition } : {}),
        ...(special.reverseCondition ? { reverseCondition: special.reverseCondition } : {})
      } : {})
    }
  }
  const towerAppearances = variantUsage?.towerAppearancesByMonster?.get(id)
  if (towerAppearances?.length) form.towerAppearances = towerAppearances
  const towerBossAppearances = variantUsage?.towerBossAppearancesByMonster?.get(id)
  if (towerBossAppearances?.length) form.towerBossAppearances = towerBossAppearances
}

function hasMeaningfulUsage(variantUsage, typeId) {
  const kinds = variantUsage?.usage?.get(String(typeId || ''))?.kinds
  return !!kinds && [...kinds].some(kind => kind !== 'test')
}

function isActiveTransformTarget(typeId, officialIds, variantUsage, checked = new Set()) {
  const id = String(typeId || '')
  if (checked.has(id)) return false
  checked.add(id)
  const sources = variantUsage?.transformSourcesByTarget?.get(id)
  if (!sources?.size) return false
  return [...sources].some(sourceId => officialIds.includes(sourceId)
    || hasMeaningfulUsage(variantUsage, sourceId)
    || isActiveTransformTarget(sourceId, officialIds, variantUsage, checked))
}

function hasVariantEvidence(m, officialIds, variantUsage) {
  const id = String(m?.typeId || '')
  if (!variantUsage?.hasSourceData) return true
  if (officialIds.includes(id) || isSummonOrEgg(m)) return true
  return hasMeaningfulUsage(variantUsage, id) || isActiveTransformTarget(id, officialIds, variantUsage)
}

function getVariantPresentation(m, ownerId, ownerName, officialIds, variantUsage) {
  const id = String(m?.typeId || '')
  const name = m?.name || m?.monDes || id
  if (id === ownerId) return { relationType: '本体', tabLabel: name }
  if (/_fenlie/i.test(id)) {
    return { relationType: '分裂形态', tabLabel: `分裂形态 · ${name}` }
  }
  if (isSummonOrEgg(m)) {
    return { relationType: '召唤物', tabLabel: name }
  }
  if (isActiveTransformTarget(id, officialIds, variantUsage)) {
    return { relationType: '变身阶段', tabLabel: `变身阶段 · ${name}` }
  }

  let sourceKinds = [...(variantUsage?.usage?.get(id)?.kinds || [])]
    .filter(kind => VARIANT_SOURCE_LABELS[kind])
    .sort((a, b) => VARIANT_SOURCE_ORDER.indexOf(a) - VARIANT_SOURCE_ORDER.indexOf(b))
  if (sourceKinds.length > 1) sourceKinds = sourceKinds.filter(kind => kind !== 'scene')
  if (!sourceKinds.length) return { relationType: '同源变种', tabLabel: name }

  const sourceLabel = sourceKinds.length > 2
    ? '通用'
    : sourceKinds.map(kind => VARIANT_SOURCE_LABELS[kind]).join(' / ')
  const sameNameAsOwner = String(name).trim() === String(ownerName || '').trim()

  // 关系标签与阶级精细化：精英标记为「xx精英」，关底/独立首领标记为「xx首领」
  let relationType = `${sourceLabel}版本`
  const rank = m?.monRank || m?.unitData?.monRank || 1
  if (id !== '052_1' && id !== '064_elite' && id !== '067_elite' && id !== '052_2' && id !== '052_tower1_30') {
    if (rank >= 3 && (!sameNameAsOwner || id.includes('boss'))) {
      relationType = sourceLabel === '剧情 / 副本' ? '关底首领' : `${sourceLabel}首领`
    } else if (rank === 2 && (id.includes('elite') || name.includes('精英'))) {
      relationType = `${sourceLabel}精英`
    }
  }

  return {
    relationType,
    tabLabel: sameNameAsOwner ? `${sourceLabel} · ${name}` : name
  }
}

function formatRangeValue(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const width = value.width ?? value.w
    const length = value.lenth ?? value.length ?? value.h
    if (width != null || length != null) return `${width ?? 0} x ${length ?? 0}`
  }
  return String(value)
}

function cleanConfiguredText(text) {
  return String(text || '').replace(/\{([^}]+)\}/g, '$1').replace(/[（()）]/g, '').trim()
}

function getReadableSkillText(values, skillId) {
  const internalId = String(skillId || '').trim().toLowerCase()
  for (const value of values) {
    const text = cleanConfiguredText(getCleanSkillName(value || ''))
    if (!text || text.toLowerCase() === internalId) continue
    if (/^\d+$/.test(text)) continue
    if (/^(?:mon|pet|hero|skill|buff)[_-]?[a-z0-9_-]+$/i.test(text)) continue
    return text
  }
  return ''
}

function isDeveloperSkillLabel(text) {
  return /boss(?:[一二三四五六七八九十\d]+技能|技能|位移|召唤)$/i.test(text)
    || /(?:新)?[一二三四五六七八九十\d]+技能$/i.test(text)
    || /^\d{3,}(?:普攻|技能.*)$/i.test(text)
}

function isPlaceholderSkillDescription(text) {
  return /可使用\s*#?变量名.*描述倍率/.test(text)
    || (/[?？]/.test(text) && /\d+\s*%/.test(text))
}

function getBuffConfig(buffId, buffData) {
  if (buffData[buffId]) return { id: buffId, data: buffData[buffId] }
  const prefixedId = `buff_${buffId}`
  return buffData[prefixedId] ? { id: prefixedId, data: buffData[prefixedId] } : null
}

function parseLinkedBuffEffect(buffId, buffData) {
  const resolved = getBuffConfig(buffId, buffData)
  if (!resolved) return { id: buffId, name: buffId, description: '' }

  const b = resolved.data
  const para = b.para || {}
  const damage = para.damage || para.actionPara?.damage || {}
  return {
    id: resolved.id,
    name: para.replyType === 'hp' ? '回复光环' : (b.buffName || b.name || resolved.id),
    description: cleanConfiguredText(b.buffDes || b.des || ''),
    duration: Number(b.buffTime || 0),
    interval: Number(para.spTime || 0),
    radius: Number(para.radius || 0),
    damageMultiplier: Number(damage.muPower || 0),
    damageBase: Number(damage.baseDamage || 0),
    damageType: damage.damageType || damage.muAddType || '',
    elementType: damage.elementType || '',
    healPercent: para.replyType === 'hp' ? Number(para.muPower || 0) : 0,
    healBase: para.replyType === 'hp' ? Number(para.baseReplyValue || 0) : 0,
    healType: para.replyType === 'hp' ? (para.muAddType || '') : ''
  }
}

function getBuffTriggerLabel(buff) {
  const checkType = buff?.para?.checkType || ''
  const checkNum = Number(buff?.para?.checkNum || 0)
  if (!checkNum) return ''
  if (checkType === 'checkSp') return `每 ${checkNum} 秒触发`
  if (checkType === 'checkAtkNum') return `每 ${checkNum} 次普通攻击触发`
  if (checkType === 'checkHit') return `每受到 ${checkNum} 次攻击触发`
  return ''
}

function getReadableSkillName(values, skillId) {
  for (const value of values) {
    const text = getReadableSkillText([value], skillId)
    if (text && !isDeveloperSkillLabel(text)) return text
  }
  return ''
}

// 少数专用技能会在源码中重复调用召唤，而配置只保存一份 summonData。
// Mon042Skill8.cs 固定在三个格点各召唤一次浮游装置。
const SOURCE_SUMMON_COUNTS = {
  mon_04209: 3
}

function getAiSkillIndices(aiConfig) {
  const indices = new Set()
  visitNested(aiConfig?.aiModel || {}, (key, value, parent) => {
    if (key !== 'type' || Number(value) !== 1) return
    const index = Number(parent?.para?.int_para ?? 0)
    if (Number.isInteger(index) && index >= 0) indices.add(index)
  })
  return indices
}

export function extractSkillTriggerConditions(aiModel) {
  if (!aiModel || typeof aiModel !== 'object') return {}

  const stateToSkillIndex = new Map()
  Object.entries(aiModel).forEach(([stateName, state]) => {
    if (Number(state?.type) === 1 && state?.para?.int_para !== undefined) {
      stateToSkillIndex.set(stateName, Number(state.para.int_para))
    } else {
      const match = stateName.match(/^skill_?(\d+)$/i)
      if (match) {
        stateToSkillIndex.set(stateName, Number(match[1]))
      }
    }
  })

  const skillConditions = new Map()
  const getEntry = idx => {
    if (!skillConditions.has(idx)) {
      skillConditions.set(idx, {
        hpPercents: new Set(),
        attackCounts: new Set(),
        hitCounts: new Set(),
        durations: new Set(),
        others: new Set()
      })
    }
    return skillConditions.get(idx)
  }

  Object.entries(aiModel).forEach(([fromState, state]) => {
    (state?.tri || []).forEach(tr => {
      const targetState = tr.triEnter
      const skillIdx = stateToSkillIndex.get(targetState)
      if (skillIdx === undefined) return

      const triList = tr.triList || []
      const entry = getEntry(skillIdx)

      triList.forEach(check => {
        const triType = Number(check?.triType)
        const para = check?.triPara || {}
        const range = check?.triParaRange

        if (triType === 2) {
          const hp = Math.round(Number(para.float_para1 || 0) * 100)
          if (hp > 0 && hp <= 100) entry.hpPercents.add(hp)
        } else if (triType === 7) {
          if (check.needRange && range && range.min !== undefined && range.max !== undefined) {
            const min = Number(range.min)
            const max = Number(range.max)
            if (min === max) {
              entry.attackCounts.add(`自身普攻 ${min} 次后`)
            } else {
              const count = max - min + 1
              const prob = (100 / count).toFixed(1).replace(/\.0$/, '')
              entry.attackCounts.add(`自身普攻 ${min}~${max} 次后（各 ${prob}% 几率）`)
            }
          } else if (para.int_para1) {
            entry.attackCounts.add(`自身普攻 ${para.int_para1} 次后`)
          }
        } else if (triType === 16) {
          if (check.needRange && range && range.min !== undefined && range.max !== undefined) {
            const min = Number(range.min)
            const max = Number(range.max)
            if (min === max) {
              entry.hitCounts.add(`自身受到 ${min} 次攻击后`)
            } else {
              const count = max - min + 1
              const prob = (100 / count).toFixed(1).replace(/\.0$/, '')
              entry.hitCounts.add(`自身受到 ${min}~${max} 次攻击后（各 ${prob}% 几率）`)
            }
          } else if (para.int_para1) {
            entry.hitCounts.add(`自身受到 ${para.int_para1} 次攻击后`)
          }
        } else if (triType === 1) {
          const sec = Number(para.float_para1 || 0)
          if (sec > 0) entry.durations.add(`${sec}秒`)
        } else if (triType === 8) {
          entry.others.add('自身死亡时')
        }
      })
    })
  })

  const result = {}
  skillConditions.forEach((data, skillIdx) => {
    const parts = []

    if (data.hpPercents.size > 0) {
      const sortedHp = [...data.hpPercents].sort((a, b) => b - a).map(h => `${h}%`)
      parts.push(`自身生命值降至 ${sortedHp.join('、')} 及以下`)
    }
    if (data.attackCounts.size > 0) {
      parts.push([...data.attackCounts].join(' / '))
    }
    if (data.hitCounts.size > 0) {
      parts.push([...data.hitCounts].join(' / '))
    }
    if (data.durations.size > 0 && data.hpPercents.size === 0 && data.attackCounts.size === 0) {
      parts.push(`战斗持续 ${[...data.durations].join(' / ')} 后`)
    }
    if (data.others.size > 0) {
      parts.push([...data.others].join('，'))
    }

    if (parts.length > 0) {
      result[skillIdx] = parts.join('；')
    }
  })

  return result
}


function getMonsterPortrait(m, key) {
  const typeId = String(m?.typeId || key || '')
  if (typeId.includes('023_egg')) {
    return 'colect_mon_021' // 023_egg 复用母体 Mon_021 的游戏立绘
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

function getMonsterPortraitPath(m) {
  const model = m?.viewData?.skeletonName
  if (model === 'obj_mon055' || model === 'obj_mon069') {
    return `/images/model-previews/${model}.webp`
  }
  if (m.typeId === '003SummonMon') return '/images/Common_ItemIcon/item_10043.webp'
  return `/images/PicHandBookPanel_Atlas/${getMonsterPortrait(m, m.typeId)}.webp`
}

export function getVariantLabel(m, presentation = null) {
  if (presentation?.tabLabel) return presentation.tabLabel
  return m?.name || m?.monDes || m?.typeId || '未知形态'
}

// Base parser function for stats and skills
function processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData, monNames = {}, aiData = {}) {
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

  // 技能按源码事件结构提取：伤害段、范围、附加状态、召唤与陷阱。
  let rawSkills = m.skillList || m.skillsList || []
  if (typeof rawSkills === 'string') rawSkills = rawSkills.split(',').filter(Boolean)
  else if (!Array.isArray(rawSkills)) rawSkills = [rawSkills]
  const aiSkillIndices = getAiSkillIndices(aiData[m.aiId])
  const skillTriggerConditions = extractSkillTriggerConditions(aiData[m.aiId]?.aiModel)

  const indexedRawSkills = rawSkills.map((skillObj, index) => ({ skillObj, originalIndex: index }))
  const filteredSkills = indexedRawSkills
    .filter(item => !aiSkillIndices.size || aiSkillIndices.has(item.originalIndex) || item.originalIndex === 0)
    .filter(item => {
      const skillId = typeof item.skillObj === 'object' ? (item.skillObj.skillId || item.skillObj.id) : item.skillObj
      return skillId && !String(skillId).includes('hero')
    })

  let unnamedSkillIndex = 0
  const skills = filteredSkills.map(({ skillObj, originalIndex }) => {
    const skillId = typeof skillObj === 'object' ? (skillObj.skillId || skillObj.id) : skillObj
    const s = skillData[skillId]
    if (!s) return null
    
    const lvlData = s.levelData?.['1'] || s.levelData?.[1] || {}
    let aniEvents = lvlData.aniEvents || []
    if (!Array.isArray(aniEvents)) aniEvents = Object.values(aniEvents)
    
    const damageHits = []
    const ranges = []
    const addedBuffIds = new Set()
    const summons = []
    let trap = null

    aniEvents.forEach(evt => {
      const arg = evt.arg || {}
      visitNested(arg, (key, value, parent) => {
        if (/^(?:damage\d*|lineDamage|atkDamage|trapDamage|createDamage)$/i.test(key) && value && typeof value === 'object') {
          const multiplier = Number(value.muPower || 0)
          const baseDamage = Number(value.baseDamage || 0)
          if (multiplier !== 0 || baseDamage !== 0) {
            damageHits.push({
              event: evt.eventName || '',
              source: key,
              type: value.damageType || value.muAddType || '',
              multiplier,
              baseDamage,
              repelForce: Number(value.repelForce || 0),
              stagger: Number(value.repelTime || 0),
              count: key === 'atkDamage' ? Math.max(1, Number(parent?.atkCount || 1)) : 1
            })
          }
        }
        if (['rectRange', 'radius', 'raduis', 'range', 'checkRange', 'hit1CheckRange', 'hit2CheckRange', 'sectorAngle', 'moveDis', 'moveGridRange', 'atkLenth', 'atkWidth'].includes(key)) {
          const formatted = formatRangeValue(value)
          if (formatted) ranges.push({ key, value: formatted })
        }
        if (typeof key === 'string' && /buff/i.test(key) && !/time|range|eft|spine|des|color|name|icon/i.test(key)) {
          if (typeof value === 'string' && value.length > 0) addedBuffIds.add(value)
          else if (Array.isArray(value)) value.forEach(id => typeof id === 'string' && addedBuffIds.add(id))
        }
        if (key === 'summonData' && value && typeof value === 'object') {
          const poolIds = Array.isArray(parent?.monList) ? parent.monList.map(String).filter(Boolean) : []
          const directId = value.monTypeId || value.typeId || ''
          const monsterIds = poolIds.length ? poolIds : [directId].filter(Boolean)
          const poolNames = monsterIds.map(id => monNames[id] || id)
          const count = SOURCE_SUMMON_COUNTS[skillId]
            || Number(parent?.monCnt ?? value.cnt ?? value.count ?? 1)
          summons.push({
            monsterId: monsterIds.join('/'),
            monsterIds,
            name: poolNames.join(' / ') || '召唤物',
            poolNames,
            count,
            randomPool: poolIds.length > 1,
            allowDuplicates: poolIds.length > 1 && count > 1,
            maxCount: Number(value.maxCount || 0),
            hpPercent: Number(value.hpPrecent ?? value.hpPercent ?? 0),
            atkPercent: Number(value.atkPercent || 0),
            defPercent: Number(value.defPercent || 0),
            duration: Number(value.durtime || value.duration || 0)
          })
        }
        if (key === 'trap' && value && typeof value === 'object') {
          trap = {
            duration: Number(value.durtime || value.duration || 0),
            interval: Number(value.cd || value.interval || 0)
          }
        }
        if (evt.eventName === 'birth' && key === 'mons' && Array.isArray(value)) {
          summons.push({
            monsterId: value.join('/'),
            name: value.map(id => monNames[id] || id).join(' / '),
            count: Number(parent.cnt || 1),
            hpPercent: Number(parent.hp || 0),
            delay: Number(parent.delay || 0)
          })
        }
      })

      // Dedicated monster skills may create a unit through monId/createMonPos.
      if (arg.monId && !arg.summonData && (arg.createMonPos || arg.posList)) {
        const count = Array.isArray(arg.posList) ? arg.posList.length : 1
        summons.push({
          monsterId: String(arg.monId),
          monsterIds: [String(arg.monId)],
          name: monNames[arg.monId] || String(arg.monId),
          poolNames: [monNames[arg.monId] || String(arg.monId)],
          count,
          randomPool: false,
          allowDuplicates: false,
          maxCount: 0,
          hpPercent: Number(arg.hpRate || 0),
          atkPercent: Number(arg.phyRate || arg.magicRate || 0),
          defPercent: Number(arg.phyDefRate || arg.magicDefRate || 0),
          duration: 0
        })
      }

      if (arg.trapLiveTime || arg.trapSpTime || arg.trapEffectId || arg.trapDamage || arg.trapAddEffectId) {
        trap = {
          duration: Number(arg.trapLiveTime || 0),
          interval: Number(arg.trapSpTime || 0)
        }
      }
    })

    const addBuffs = [...addedBuffIds].map(id => {
      const buff = buffData[id] || {}
      return {
        id,
        name: buff.buffName || buff.name || id,
        description: id === 'mon069StunBuff'
          ? '无法移动、攻击或使用技能；尖刺被破坏时解除'
          : cleanConfiguredText(buff.buffDes || buff.des || ''),
        duration: Number(buff.buffTime || 0),
        // 数值说明与词条页共用同一个渲染器，不再各自解析 para
        values: buff.para || buff.buffEffect ? describeBuff(buff, { buffData }) : null
      }
    })
    const kind = String(s.skillType) === '0' ? '普攻' : '技能'
    const tip = cleanConfiguredText(s.tip || '')
    const configuredName = getReadableSkillName([
      lvlData.name,
      lvlData.skillName,
      s.name,
      s.skillName
    ], skillId)
    const configuredDescription = getReadableSkillText([
      lvlData.des,
      s.des,
      tip !== m.name && tip !== configuredName ? tip : ''
    ], skillId)
    const description = isDeveloperSkillLabel(configuredDescription) || isPlaceholderSkillDescription(configuredDescription)
      ? ''
      : configuredDescription
    let displayName = configuredName || (kind === '普攻' ? '普通攻击' : `技能${++unnamedSkillIndex}`)
    if (kind === '普攻') {
      const cleanMonName = (m.name || '').replace(/[“”（）\s]/g, '')
      const cleanDispName = displayName.replace(/[“”（）\s]/g, '')
      if (!displayName || cleanDispName === cleanMonName || cleanMonName.includes(cleanDispName) || cleanDispName.includes(cleanMonName) || displayName.endsWith('普攻')) {
        displayName = '普通攻击'
      }
    }
    const mechanicParts = []
    if (damageHits.length) {
      const damageText = damageHits.map(hit => `${hit.type === 'magicAtk' ? '魔法' : hit.type === 'realAtk' ? '真实' : '物理'}${Math.round(hit.multiplier * 100)}%${hit.count > 1 ? ` ×${hit.count}` : ''}`).join(' / ')
      mechanicParts.push(`${damageHits.length} 段伤害：${damageText}`)
    }
    if (summons.length) {
      mechanicParts.push(summons.map(entry => entry.randomPool
        ? `从${entry.poolNames.join(' / ')}中随机召唤 ${entry.count} 只${entry.allowDuplicates ? '（可重复）' : ''}`
        : `召唤 ${entry.name} x${entry.count}`).join('、'))
    }
    if (addBuffs.length) mechanicParts.push(`附加 ${addBuffs.map(entry => entry.name).join('、')}`)
    if (trap) mechanicParts.push('生成持续性陷阱')
    const movement = ranges.filter(entry => entry.key === 'moveGridRange' || entry.key === 'moveDis')
    if (movement.length) {
      mechanicParts.push(movement.map(entry => `${entry.key === 'moveGridRange' ? '随机位移' : '位移'} ${entry.value} 格`).join('、'))
    }

    return {
      id: skillId,
      name: displayName,
      kind,
      triggerCondition: kind === '普攻' || originalIndex === 0 ? '' : (skillTriggerConditions[originalIndex] || ''),
      cooldown: Number(lvlData.cd || 0),
      cost: lvlData.cost || s.cost || 0,
      des: description,
      summary: mechanicParts.join('；'),
      damageHits,
      ranges: ranges.filter((entry, index, list) => list.findIndex(item => item.key === entry.key && item.value === entry.value) === index),
      addBuffs,
      summons,
      trap
    }
  }).filter(Boolean)

  // buffsList 单项必定携带；多项由源码按权重随机选择一项。
  let rawBuffs = m.buffsList || m.buffList || {}
  if (typeof rawBuffs === 'string') {
    rawBuffs = rawBuffs.split(',').map(id => ({ id, weight: 1 })).filter(b => b.id)
  } else if (Array.isArray(rawBuffs)) {
    rawBuffs = rawBuffs.map(b => typeof b === 'object' ? { id: b.buffId || b.id, weight: Number(b.weight ?? 1) } : { id: b, weight: 1 })
  } else if (typeof rawBuffs === 'object') {
    rawBuffs = Object.entries(rawBuffs).map(([id, weight]) => ({ id, weight }))
  } else {
    rawBuffs = []
  }

  const totalBuffWeight = rawBuffs.reduce((sum, entry) => sum + Number(entry.weight || 0), 0)
  const randomBuff = rawBuffs.length > 1
  const buffs = rawBuffs.map(buffObj => {
    const buffId = buffObj.id
    const b = buffData[buffId]
    if (!b) return null
    
    const actPara = b.para?.actionPara || {}

    const rawAddBuffIds = [
      ...(Array.isArray(actPara.addBuffs) ? actPara.addBuffs : []),
      ...(actPara.addBuffId ? [actPara.addBuffId] : []),
      ...(Array.isArray(b.addBuffs) ? b.addBuffs : [])
    ].map(String).filter((id, index, list) => id && list.indexOf(id) === index)
    const linkedEffects = rawAddBuffIds.map(id => parseLinkedBuffEffect(id, buffData))
    const mappedAddBuffs = linkedEffects.map(effect => effect.name)

    let name = (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '狂暴' : (b.buffName || b.name || buffId)
    let des = (buffId === 'monCrazy' || buffId === 'monCrazy_s') ? '无属性' : (b.buffDes || b.des || '')

    // Special override for mon091BuffCtl (天界 / 天界的效果)
    if (buffId === 'mon091BuffCtl') {
      name = '天界之御'
      des = '战斗开始时，额外召唤 [超天界格莉姆的左手] 与 [超天界格莉姆的右手] 协同作战（继承 50% 生命值、50% 攻击力、100% 防御力）。当双拳全部被击破时，本体将陷入持续 11 秒的瘫痪虚弱状态。'
    }

    const triggerLabel = getBuffTriggerLabel(b)

    // 部分描述中的触发秒数已过期；addBuffSelf 以源码实际读取的 checkNum 为准。
    let cleanDes = des.replace(/\{|\}|\(|\)|（|）/g, '')
    if (b.para?.actionType === 'addBuffSelf' && triggerLabel && linkedEffects.length) {
      const effectNames = linkedEffects.map(effect => effect.healPercent ? '回复光环' : effect.name)
      cleanDes = `${triggerLabel.replace(/触发$/, '')}获得${effectNames.join('、')}。`
    }

    return {
      id: buffId,
      weight: Number(buffObj.weight || 0),
      probability: randomBuff && totalBuffWeight > 0 ? Number(buffObj.weight || 0) / totalBuffWeight : 1,
      selectionType: randomBuff ? '随机选取一项' : '固定携带',
      name,
      des: cleanDes,
      nameAdd: b.nameAdd || b.para?.nameAdd || '',
      duration: Number(b.buffTime || 0),
      addBuffs: mappedAddBuffs,
      linkedEffects,
      // 完整数值说明：与词条页共用 buffParser 的渲染器，覆盖属性/伤害/护盾/回复/范围/时间层数。
      // 原先手写的 damageReduction/speedChange/triggerInterval/triggerType/stackable/maxStacks/
      // triggerLabel/rectRange/muPower/baseDamage/repel* 已全部由 values.status 与 values.groups 覆盖，
      // 故不再重复输出（SPEC：只保留展示与定位实际消费的字段）。
      values: describeBuff(b, { buffData })
    }
  }).filter(Boolean)

  const collectRewards = m.rewards ? parseRewardId(m.rewards, rewards, items, equipGroupData) : []

  return {
    id: m.typeId,
    name: m.name || m.monDes || m.typeId,
    tabLabel: getVariantLabel(m),
    icon: m.icon || m.monIcon || '',
    portraitPath: getMonsterPortraitPath(m),
    monDes: m.monDes || '',
    weakAttDes: m.weakAttDes || '',
    specialDes: m.specialDes || '',
    stats: translatedStats,
    rawStats,
    level: m.level || 1,
    keyList: unitData.keyList || [],
    skills,
    buffs,
    collectRewards,
    monRank: Number(m.monRank || 0),
    category: Array.isArray(m.category) ? m.category : []
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

export const fetchMonsterLevelStrength = createCachedLoader(async () => {
  if (cachedLevelStrength) return cachedLevelStrength
  const res = await fetchWithFallback('data/parsed/monLevelStrength.json')
  cachedLevelStrength = res.datas?.monLevelStrength || res.monLevelStrength
  return cachedLevelStrength
})

// 怪物图鉴构建期纯函数：由原始 JSON 对象生成基础数据表
export function buildMonsterMaps(maps) {
  const {
    items, lanDict, rewards, fileMonRes, monRes, skillRes, buffRes, equipGroupRes, aiRes = {},
    towerUsageRes = {}, exploreAreaRes = {}, roomRes = {}, battleRes = {}, dungeonBattleRes = {}, dungeonBattleRoomsRes = {}
  } = maps

  const fileMon = fileMonRes.monFile || []
  const monData = monRes.datas || monRes || {}
  const skillData = skillRes.datas || skillRes || {}
  const buffData = buffRes.datas || buffRes || {}
  const equipGroupData = equipGroupRes.equipGroups || {}
  const aiData = aiRes.datas || aiRes || {}

  // Build monNames dictionary
  const monNames = {}
  for (const key in monData) {
    if (monData[key]) {
      monNames[key] = monData[key].name || monData[key].monDes || key
    }
  }

  const variantUsage = buildMonsterVariantUsage({
    monData,
    aiData,
    towerUsageRes,
    exploreAreaRes,
    roomRes,
    battleRes,
    dungeonBattleRes,
    dungeonBattleRoomsRes
  })

  return { items, lanDict, rewards, fileMon, monData, skillData, buffData, equipGroupData, monNames, aiData, variantUsage }
}

// 是否为召唤物/蛋形态（会归入 summons 列表）
const isSummonOrEgg = (m) => {
  const mId = String(m?.typeId || '')
  const low = mId.toLowerCase()
  return low.includes('summon') || low.includes('egg') || low.startsWith('obj_') || mId === '069_jianci' || mId === 'Mon055StoneMon' || mId.includes('LeftHand') || mId.includes('RightHand')
}

// monRank -> 展示品质 (3: 首领/Boss -> 5橙, 2: 精英 -> 4紫, 1: 普通 -> 3蓝)
const rankToQuality = (rankVal) => (rankVal >= 3 ? 5 : (rankVal === 2 ? 4 : 3))

// 1. fetchMonsterData - Official pokedex grouped by skeletonName
// 构建期纯函数：由基础数据表生成怪物图鉴列表（不依赖网络与浏览器）
export function buildMonsterData(maps) {
  const { items, lanDict, rewards, fileMon, monData, skillData, buffData, equipGroupData, monNames, aiData, variantUsage } = maps

  const allMons = Object.entries(monData).map(([key, val]) => {
    if (val && !val.typeId) {
      val.typeId = key
    }
    return val
  })

  const officialIdsBySkeleton = new Map()
  fileMon.forEach(baseMon => {
    const official = monData[baseMon?.monTypeId]
    if (!official || baseMon.hide) return
    const skeleton = getSkeletonName(official, baseMon.monTypeId)
    const ids = officialIdsBySkeleton.get(skeleton) || []
    ids.push(String(baseMon.monTypeId))
    officialIdsBySkeleton.set(skeleton, ids)
  })

  const processedMonsters = fileMon.map(baseMon => {
    if (baseMon.hide) return null
    
    const monTypeId = baseMon.monTypeId
    const baseFormInMonJson = monData[monTypeId]
    if (!baseFormInMonJson) return null

    // Grouping key: skeletonName
    const skeleton = getSkeletonName(baseFormInMonJson, monTypeId)
    const officialIds = officialIdsBySkeleton.get(skeleton) || [String(monTypeId)]
    
    const forms = []
    const summons = []
    
    allMons.forEach(m => {
      if (!m || isHiddenMonster(m)) return

      const mSkeleton = getSkeletonName(m, m.typeId)
      if (mSkeleton !== skeleton) return
      if (getFormOwnerId(m.typeId, officialIds) !== String(monTypeId)) return
      if (!hasVariantEvidence(m, officialIds, variantUsage)) return

      const processed = processForm(m, skillData, buffData, rewards, items, lanDict, equipGroupData, monNames, aiData)
      const presentation = getVariantPresentation(m, String(monTypeId), baseFormInMonJson.name, officialIds, variantUsage)
      processed.relationType = presentation.relationType
      processed.tabLabel = getVariantLabel(m, presentation)
      applyVariantMetadata(processed, m.typeId, String(monTypeId), variantUsage)
      
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

    // 消除同名 Tab 冲突（如安瑟恩单元 042_tower1_35/70，恐怖蟾兽 055_tower1_50/75，砂蜘蛛育母 013_tower1_15 等）
    const allFormItems = [...forms, ...summons]
    const labelCounts = new Map()
    allFormItems.forEach(f => {
      labelCounts.set(f.tabLabel, (labelCounts.get(f.tabLabel) || 0) + 1)
    })

    allFormItems.forEach(f => {
      if ((labelCounts.get(f.tabLabel) || 0) > 1) {
        const floorMatch = f.id.match(/tower\d*_(\d+)/)
        const floor = floorMatch ? floorMatch[1] : (f.towerAppearances?.[0]?.floors?.[0] || f.towerBossAppearances?.[0]?.floors?.[0])
        if (floor) {
          f.tabLabel = `神匠之塔 · ${floor}层`
        } else if (f.relationType && f.relationType !== '本体') {
          f.tabLabel = `${f.relationType} · ${f.name}`
        }
      }
    })

    const baseRewards = parseRewardId(baseMon.reward, rewards, items, equipGroupData)
    const rankVal = forms[0]?.monRank || 3
    const quality = rankToQuality(rankVal)
    const icon = getMonsterPortrait(baseFormInMonJson, monTypeId) || baseMon.monIcon

    const allFormNames = forms.map(f => f.name).filter(Boolean)
    const allTabLabels = allFormItems.map(f => f.tabLabel).filter(Boolean)
    const allWeaknesses = forms.map(f => f.weakAttDes).filter(Boolean)
    const keywords = [
      ...allFormNames,
      ...allTabLabels,
      baseMon.text || '',
      baseMon.label || '',
      ...(baseMon.mark || []),
      ...(baseMon.place || []),
      ...allWeaknesses
    ].filter(Boolean).join(' ').toLowerCase()

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
      keywords
    }
  }).filter(Boolean)
  
  return processedMonsters
}

export const fetchMonsterData = createCachedLoader(async () => {
  if (cachedMonsters) return cachedMonsters

  const parsed = await fetchWithFallback('data/parsed/monsters.json')
  cachedMonsters = parsed.monsters
  return cachedMonsters
})
