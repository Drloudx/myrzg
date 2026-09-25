/**
 * 词条百科构建模块（构建期纯函数）：生成 `parsed/glossary.json`。
 *
 * 方案 A 全自动架构：
 * 1. 机制骨架：采用面向玩家的百科定义（状态百科、战斗属性、核心机制）。
 * 2. 数据驱动自动化：自动根据 buff.json / hero.json / mon.json / pet.json 等原表：
 *    - 自动聚合与统计持续时间区间（durationRange）、跳字结算频率（spTime）、伤害属性；
 *    - 自动反查施加来源（角色及对应技能、怪物、魔物、道具），支持图鉴联动；
 *    - 自动捕捉新异常与怪物异变状态，绝不漏数据。
 */
import {
  STATUS_RULES,
  matchCanonicalStatus,
  resolveBuffIcon,
  isEliteBuffName,
  isCookBuff,
  isInternalBuffName,
  isPlainObject
} from './buffParser.js'
import { buildBuffSourceIndex } from './buffSourceIndex.js'
import { buildSkillLevelIndex } from './skillLevelIndex.js'
import {
  STATUS_ENCYCLOPEDIA,
  STATS_ENCYCLOPEDIA,
  MECHANICS_ENCYCLOPEDIA
} from '../config/glossaryEncyclopedia.js'
import { isBlacklisted } from '../config/blacklist.js'

export const GLOSSARY_SECTIONS = [
  { id: 'status', name: '异常与状态', desc: '打在战斗单位身上的持续伤害、强力控制、削弱与增益屏障。' },
  { id: 'stats', name: '战斗属性', desc: '决定角色攻防能力的基础面板、进阶上限与元素抗性。' },
  { id: 'mechanics', name: '核心机制', desc: '技能体系、伤害结算流与仇恨索敌等游戏底层运转规则。' }
]

const countBy = values => {
  const counts = new Map()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return counts
}
const toSorted = counts => [...counts.entries()]
  .map(([value, count]) => ({ value, count }))
  .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-Hans-CN'))

/**
 * 某个分组内的「分类」与「标签」分布。
 */
export function facetCountsForGroup(entries, groupId) {
  const scoped = (entries || []).filter(entry => !groupId || groupId === 'all' || entry.group === groupId)
  const categories = toSorted(countBy(scoped.map(entry => entry.category).filter(Boolean)))
    .map(({ value, count }) => ({ category: value, count }))
  const tags = toSorted(countBy(scoped.flatMap(entry => [...new Set(entry.tags || [])])))
    .map(({ value, count }) => ({ tag: value, count }))
  return { categories, tags }
}

/**
 * 提取持续时间文本说明
 */
function extractDurationText(buffs) {
  const nums = buffs.map(b => Number(b.buffTime || 0)).filter(t => t > 0)
  if (!nums.length) return '即时 / 永久生效'
  const hasPermanent = nums.some(t => t >= 9999)
  const regular = nums.filter(t => t < 9999)
  if (!regular.length) return '永久生效'
  const min = Math.min(...regular)
  const max = Math.max(...regular)
  const base = min === max ? `${min} 秒` : `${min} ~ ${max} 秒`
  return hasPermanent ? `${base}（部分技能为永久被动）` : base
}

/**
 * 提取结算频率说明
 */
function extractIntervalText(buffs) {
  const intervals = buffs.map(b => b.para?.spTime || b.para?.interval).filter(Boolean).map(Number).filter(n => n > 0)
  if (!intervals.length) return ''
  const min = Math.min(...intervals)
  const max = Math.max(...intervals)
  return min === max ? `每 ${min} 秒结算一次` : `每 ${min} ~ ${max} 秒结算一次`
}

/**
 * 提取伤害类型与元素
 */
function extractDamageTypeText(buffs) {
  const elements = new Set()
  const types = new Set()
  for (const b of buffs) {
    const el = b.para?.damage?.elementType
    if (el && el !== 'none') elements.add(el)
    const dt = b.para?.damage?.damageType || b.para?.damage?.muAddType
    if (dt === 'magicAtk') types.add('魔法伤害')
    else if (dt === 'phyAtk') types.add('物理伤害')
  }
  const elNames = { fire: '火属性', water: '水属性', wind: '风属性', earth: '地属性' }
  const elStr = [...elements].map(e => elNames[e] || e).join('/')
  const typeStr = [...types].join('/')
  if (!elStr && !typeStr) return ''
  return [elStr, typeStr].filter(Boolean).join(' ')
}

/**
 * 聚合施加来源列表
 */
function aggregateSources(buffs, sourceIndex) {
  const heroesMap = new Map()
  const monstersMap = new Map()
  const petsMap = new Map()
  const itemsMap = new Map()

  for (const buff of buffs) {
    const owners = sourceIndex.get(buff.buffID) || []
    for (const o of owners) {
      if (!o.name || isBlacklisted(o)) continue
      if (o.kind === '角色') {
        const key = o.name
        if (!heroesMap.has(key)) {
          heroesMap.set(key, { id: o.id, name: o.name, icon: o.icon, skillName: o.skillName || '' })
        } else if (o.skillName && !heroesMap.get(key).skillName) {
          heroesMap.get(key).skillName = o.skillName
        }
      } else if (o.kind === '怪物') {
        if (!monstersMap.has(o.name)) {
          monstersMap.set(o.name, {
            id: o.id,
            name: o.name,
            icon: o.icon,
            skillName: o.skillName || '',
            place: o.place || []
          })
        }
      } else if (o.kind === '魔物') {
        if (!petsMap.has(o.name)) {
          petsMap.set(o.name, { id: o.id, name: o.name, icon: o.icon, skillName: o.skillName || '' })
        }
      } else if (o.kind === '物品') {
        if (!itemsMap.has(o.name)) {
          itemsMap.set(o.name, { id: o.id, name: o.name, icon: o.icon })
        }
      }
    }
  }

  const sortByTitle = list => list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return {
    heroes: sortByTitle([...heroesMap.values()]),
    monsters: sortByTitle([...monstersMap.values()]),
    pets: sortByTitle([...petsMap.values()]),
    items: sortByTitle([...itemsMap.values()])
  }
}

export function buildGlossaryData({
  buffJson, heroJson, petJson, monJson, skillJson, skillTriggerJson, itemJson, heroSkillUpgradeJson, fileMonJson, monstersJson
} = {}) {
  const buffData = buffJson || {}
  const sourceIndex = buildBuffSourceIndex({
    buffJson: buffData, heroJson, petJson, monJson, skillJson, skillTriggerJson, itemJson, fileMonJson, monstersJson
  })
  const levelIndex = buildSkillLevelIndex({ skillJson, buffJson: buffData, heroSkillUpgradeJson })

  // 1. 按 STATUS_RULES 自动聚合匹配的 buff
  const statusBuckets = new Map()
  for (const rule of STATUS_RULES) {
    statusBuckets.set(rule.id, [])
  }

  const eliteByName = new Map()
  const claimedBuffs = new Set()

  for (const buff of Object.values(buffData)) {
    if (!isPlainObject(buff) || buff.show === false) continue
    const name = String(buff.buffName || '').trim()
    if (!name || isCookBuff(buff) || isInternalBuffName(name)) continue

    // 精英怪异变
    if (isEliteBuffName(name)) {
      if (!eliteByName.has(name)) eliteByName.set(name, [])
      eliteByName.get(name).push(buff)
      claimedBuffs.add(buff)
      continue
    }

    const hit = matchCanonicalStatus(buff)
    if (hit && statusBuckets.has(hit.id)) {
      statusBuckets.get(hit.id).push(buff)
      claimedBuffs.add(buff)
    }
  }

  // 2. 组装「异常与战斗状态」词条
  const statusEntries = []
  for (const rule of STATUS_RULES) {
    const buffs = statusBuckets.get(rule.id) || []
    const enc = STATUS_ENCYCLOPEDIA[rule.id] || {
      name: rule.name,
      category: rule.category,
      summary: `${rule.name}状态，在战斗中产生相应的战术影响。`,
      defaultTags: [rule.category, '战斗状态'],
      defaultRules: []
    }

    // 自动寻找最佳图标
    const iconBuff = buffs.find(b => b.buffIcon)
    const icon = iconBuff ? resolveBuffIcon(iconBuff.buffIcon) : ''

    // 动态提取特征
    const durText = extractDurationText(buffs)
    const intervalText = extractIntervalText(buffs)
    const dmgTypeText = extractDamageTypeText(buffs)

    const rules = []
    if (durText) rules.push({ label: '持续时间', value: durText })
    if (intervalText) rules.push({ label: '结算频率', value: intervalText })
    if (dmgTypeText) rules.push({ label: '伤害类型', value: dmgTypeText })

    // 融合百科规则
    for (const r of (enc.defaultRules || [])) {
      if (!rules.some(item => item.label === r.label)) {
        rules.push(r)
      }
    }

    // 自动提取施加来源
    const sources = aggregateSources(buffs, sourceIndex)

    statusEntries.push({
      id: rule.id,
      name: enc.name || rule.name,
      group: 'status',
      category: enc.category || rule.category,
      icon,
      tags: [...new Set([...(enc.defaultTags || []), enc.category || rule.category])],
      summary: enc.summary,
      rules,
      sources,
      buffCount: buffs.length
    })
  }

  // 3. 组装精英怪异变状态
  for (const [name, buffs] of eliteByName) {
    const iconBuff = buffs.find(b => b.buffIcon)
    const icon = iconBuff ? resolveBuffIcon(iconBuff.buffIcon) : ''
    const des = buffs.find(b => b.buffDes)?.buffDes || '精英怪物携带的异变特质，强化怪物的战斗能力。'
    const sources = aggregateSources(buffs, sourceIndex)
    statusEntries.push({
      id: `elite_${name}`,
      name,
      group: 'status',
      category: '怪物异变',
      icon,
      tags: ['怪物特质', '异变'],
      summary: des,
      rules: [
        { label: '特质类型', value: '精英首领常驻被动' },
        { label: '生效机制', value: '怪物入场即生效，无法被驱散' }
      ],
      sources,
      buffCount: buffs.length
    })
  }

  // 4. 组装「战斗属性」与「核心机制」
  const statsEntries = STATS_ENCYCLOPEDIA.map(item => ({
    ...item,
    icon: '',
    sources: { heroes: [], monsters: [], pets: [], items: [] }
  }))

  const mechanicsEntries = MECHANICS_ENCYCLOPEDIA.map(item => ({
    ...item,
    icon: '',
    sources: { heroes: [], monsters: [], pets: [], items: [] }
  }))

  const allEntries = [...statusEntries, ...statsEntries, ...mechanicsEntries]

  // 分组统计
  const groupCounts = countBy(allEntries.map(e => e.group))
  const sections = GLOSSARY_SECTIONS.map(sec => ({
    ...sec,
    count: groupCounts.get(sec.id) || 0
  }))

  return {
    meta: {
      skillLevelCap: levelIndex.cap,
      totalBuffs: Object.keys(buffData).length,
      entries: allEntries.length
    },
    sections,
    // 兼容字段
    groups: sections,
    entries: allEntries,
    buffs: allEntries
  }
}
