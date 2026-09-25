/**
 * Buff 来源索引（构建期纯函数）：`buffID → 谁在用它`。
 *
 * 用途：词条详情里的「数值版本」标签需要显示来源（角色名/魔物名）而不是时长——
 * 同一个状态在 4 条英雄技能上各有一份数值时，标「结晶(5s)」四次没有任何信息量。
 *
 * 索引分两条路，互为补充：
 *   1. **`buffType` 前缀**：配置里大量 buffType 直接写着归属（`hero011Star1Add`、`pet_07502AddBuff`、
 *      `mon023AddBuff01`），能覆盖约六成 buff，且不依赖别的表。
 *   2. **反查技能表**：`skill.json` / `skillTrigger.json` 的 `levelData[].para` 里带 `buffId`/`addBuff`，
 *      而 `hero.json` / `pet.json` 的技能字段指向这些技能；`mon.json` 的 `buffsList` 直接列 buff。
 *      覆盖 `buffType` 没有归属信息的那部分（如 `圣愈` 的 `buffType=critUp`，靠伽拉忒亚普攻反查到）。
 */
import { isPlainObject } from './buffParser.js'
import { isBlacklisted } from '../config/blacklist.js'

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

const KNOWN_HIDDEN_MONSTER_BASE_IDS = [
  '016', '017', '020', '021', '022', '023', '024', '025', '031', '032', '033', '080',
  '083', '084', '085', '086', '087', '088', '089', '090', '091'
]

function createMonsterBlacklistChecker(fileMonJson) {
  const placeMap = new Map()
  const blacklistedBaseIds = new Set(KNOWN_HIDDEN_MONSTER_BASE_IDS)
  const blacklistedNames = new Set()

  const list = fileMonJson?.monFile || (Array.isArray(fileMonJson) ? fileMonJson : Object.values(fileMonJson?.datas || fileMonJson || {}))
  for (const m of list) {
    if (m?.monTypeId && m?.place) {
      placeMap.set(String(m.monTypeId), m.place)
    }
    if (m && isBlacklisted(m)) {
      if (m.monTypeId) blacklistedBaseIds.add(String(m.monTypeId))
      if (m.name) blacklistedNames.add(String(m.name))
    }
  }

  function getFormOwnerId(id) {
    if (placeMap.has(id)) return id
    for (const [part, ownerId] of Object.entries(SPECIAL_FORM_OWNERS)) {
      if (id.includes(part)) return ownerId
    }
    for (const baseId of placeMap.keys()) {
      if (id.startsWith(`${baseId}_`) || id.startsWith(`${baseId}crazy`) || id.startsWith(`${baseId}Summon`)) {
        return baseId
      }
    }
    return ''
  }

  function getMonsterPlace(id) {
    const ownerId = getFormOwnerId(String(id || ''))
    return placeMap.get(ownerId) || []
  }

  function isMonsterHidden(mon) {
    if (!mon) return false
    const id = String(mon.typeId || mon.id || '')
    const name = String(mon.name || mon.monDes || '')
    const cats = Array.isArray(mon.category) ? mon.category : (mon.category ? [mon.category] : [])
    const place = mon.place || getMonsterPlace(id)

    // 1. 章节标签：c4 为第四章（黑森林），c5 为第五章（霜烬平原）
    if (cats.includes('c4') || cats.includes('c5')) return true

    // 2. 地区匹配：若对象携带 place 且包含黑名单地区
    if (place.some(p => p.includes('黑森林') || p.includes('霜烬平原'))) return true

    // 3. 通用黑名单校验（精确/模糊匹配，如 '测试'、'未使用'、EXACT_BLACKLIST）
    if (isBlacklisted({ ...mon, place })) return true

    // 4. 基础怪 ID 或名称属于黑名单
    if (blacklistedBaseIds.has(id) || (name && blacklistedNames.has(name))) return true

    // 5. 特殊附属怪 / 召唤物属于黑名单本体
    for (const [part, ownerId] of Object.entries(SPECIAL_FORM_OWNERS)) {
      if (id.includes(part) && blacklistedBaseIds.has(ownerId)) return true
    }

    // 6. 变种 / 精英形态前缀匹配（如 020_elite_boss -> 020）
    for (const baseId of blacklistedBaseIds) {
      if (id === baseId || id.startsWith(`${baseId}_`) || id.startsWith(`${baseId}crazy`) || id.startsWith(`${baseId}Summon`)) {
        return true
      }
    }

    return false
  }

  return { isMonsterHidden, getMonsterPlace }
}

/** 从任意嵌套结构里收集「像 buff id」的字符串。 */
function collectBuffIds(node, out, depth = 0) {
  if (depth > 8 || node == null) return
  if (Array.isArray(node)) {
    for (const child of node) collectBuffIds(child, out, depth + 1)
    return
  }
  if (!isPlainObject(node)) return
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && /^[A-Za-z0-9_\-[\]]+$/.test(value) && /buff/i.test(key)) out.add(value)
    else if (Array.isArray(value) && /buff/i.test(key)) {
      for (const item of value) if (typeof item === 'string') out.add(item)
    }
    collectBuffIds(value, out, depth + 1)
  }
}

/** 级联收集 Buff 触发器/被动在 `para` 中派生附加的子 Buff ID（如被动触发护盾 Buff） */
function getCascadedBuffIds(buffIds, buffData, visited = new Set()) {
  const result = new Set()
  const walk = (node, depth = 0) => {
    if (depth > 6 || node == null) return
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string' && buffData[item]) result.add(item)
        else walk(item, depth + 1)
      }
      return
    }
    if (!isPlainObject(node)) return
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && (/buff/i.test(key) || key === 'newBuffBaseId') && buffData[value]) {
        result.add(value)
      }
      walk(value, depth + 1)
    }
  }

  for (const bId of buffIds) {
    if (visited.has(bId)) continue
    visited.add(bId)
    const buff = buffData[bId]
    if (buff?.para) walk(buff.para)
  }

  if (result.size > 0) {
    const nextIds = [...result].filter(id => !visited.has(id))
    if (nextIds.length) {
      const deeper = getCascadedBuffIds(nextIds, buffData, visited)
      for (const id of deeper) result.add(id)
    }
  }
  return [...result]
}

/** 建立 `skillId → buffId 集合`。 */
function buildSkillBuffMap(skillJson, skillTriggerJson, buffData) {
  const map = new Map()
  const add = (skillId, node) => {
    const ids = new Set()
    collectBuffIds(node, ids)
    const valid = [...ids].filter(id => buffData[id])
    if (valid.length) {
      const cascaded = getCascadedBuffIds(valid, buffData)
      map.set(String(skillId), [...new Set([...valid, ...cascaded])])
    }
  }
  for (const [skillId, skill] of Object.entries(skillJson || {})) add(skillId, skill?.levelData || skill)
  for (const [skillId, skill] of Object.entries(skillTriggerJson || {})) {
    add(skillId, skill?.levelData || skill)
    // skillTrigger 自己也带 skillId 字段
    if (skill?.skillId) add(skill.skillId, skill?.levelData || skill)
  }
  return map
}

/** 把 `{buffId → owner}` 累加进索引。若已存在该归属但缺少技能名，优先补充技能名。 */
function link(index, buffIds, owner) {
  for (const id of buffIds) {
    if (!index.has(id)) index.set(id, [])
    const list = index.get(id)
    const existing = list.find(entry => entry.kind === owner.kind && entry.name === owner.name)
    if (!existing) {
      list.push({ ...owner })
    } else {
      if (!existing.skillName && owner.skillName) {
        existing.skillName = owner.skillName
      }
      if (!existing.place?.length && owner.place?.length) {
        existing.place = owner.place
      }
    }
  }
}

/** 判断是否为策划开发期占位标记或临时技能代号 */
function isDeveloperSkillLabel(text) {
  return /boss(?:[一二三四五六七八九十\d]+技能|技能|位移|召唤)$/i.test(text)
    || /(?:新)?[一二三四五六七八九十\d]+技能$/i.test(text)
    || /^\d{3,}(?:普攻|技能.*)$/i.test(text)
}

/** 从技能配置项中解析出最具可读性的技能名称 */
function getSkillDisplayName(s, skillId = '') {
  if (!s) return ''
  const candidates = [
    s.name,
    s.skillName,
    s.levelData?.['1']?.skillName,
    s.levelData?.['1']?.name,
    s.levelData?.['1']?.des,
    s.tip
  ]
  const cleanId = String(skillId || '').trim().toLowerCase()
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue
    const clean = raw.replace(/\s*[Ll]v\s*[:：]?\s*\d+/g, '').replace(/\{([^}]+)\}/g, '$1').replace(/[（()）]/g, '').trim()
    if (!clean || clean.toLowerCase() === cleanId) continue
    if (/^\d+$/.test(clean)) continue
    if (/^(?:mon|pet|hero|skill|buff)[_-]?[a-z0-9_-]+$/i.test(clean)) continue
    if (isDeveloperSkillLabel(clean)) continue
    return clean
  }
  return ''
}

export function buildBuffSourceIndex({
  heroJson, petJson, monJson, skillJson, skillTriggerJson, itemJson, buffJson, fileMonJson, monstersJson
} = {}) {
  const buffData = buffJson || {}
  const index = new Map()
  const { isMonsterHidden, getMonsterPlace } = createMonsterBlacklistChecker(fileMonJson)

  // 技能 ID -> 技能名称映射
  const skillNameMap = new Map()
  for (const [sId, s] of Object.entries(skillJson || {})) {
    const sName = getSkillDisplayName(s, sId)
    if (sName) skillNameMap.set(String(sId), sName)
  }
  for (const [sId, s] of Object.entries(skillTriggerJson || {})) {
    const sName = getSkillDisplayName(s, sId)
    if (sName) skillNameMap.set(String(sId), sName)
  }

  // ---- 路径 1：buffType / buffEffect 前缀直接写归属 ----
  const heroObj = id => heroJson?.datas?.[`hero_${id}`] || heroJson?.datas?.[id]
  const petObj = id => petJson?.datas?.[`pet_${id}`] || petJson?.datas?.[id]
  const monObj = id => {
    const mons = monJson?.datas || monJson || {}
    return mons[id] || mons[`${id}_1`]
  }

  for (const buff of Object.values(buffData)) {
    const type = String(buff?.buffType || '')
    const id = String(buff?.buffID || '')
    if (!id) continue
    let owner = null
    const heroMatch = type.match(/^hero(\d{3})/i) || type.match(/^Buff_hero(\d{3})/i)
    const petMatch = type.match(/^pet_?(\d{3})/i)
    const monMatch = type.match(/^(?:buff_)?mon(\d{3})/i)

    if (heroMatch) {
      const h = heroObj(heroMatch[1])
      if (h?.name && !isBlacklisted(h)) owner = { kind: '角色', name: h.name, id: h.typeId || heroMatch[1], icon: h.icon || '' }
    } else if (petMatch) {
      const p = petObj(petMatch[1])
      if (p?.name && !isBlacklisted(p)) owner = { kind: '魔物', name: p.name, id: p.typeId || petMatch[1], icon: p.icon || '' }
    } else if (monMatch) {
      const m = monObj(monMatch[1])
      if (m?.name || m?.monDes) {
        const monId = m.typeId || monMatch[1]
        if (!isMonsterHidden({ ...m, typeId: monId })) {
          owner = {
            kind: '怪物',
            name: m.name || m.monDes,
            id: monId,
            icon: m.icon || '',
            place: getMonsterPlace(monId)
          }
        }
      }
    }
    if (owner?.name) link(index, [id], owner)
  }

  // ---- 路径 2：反查技能表 ----
  const skillBuffMap = buildSkillBuffMap(skillJson, skillTriggerJson, buffData)
  const collectSkillIds = node => {
    const ids = new Set()
    const visit = (value, depth = 0) => {
      if (depth > 4 || value == null) return
      if (typeof value === 'string') { if (skillBuffMap.has(value)) ids.add(value); return }
      if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return }
      if (isPlainObject(value)) for (const child of Object.values(value)) visit(child, depth + 1)
    }
    visit(node)
    return [...ids]
  }

  // 角色
  for (const hero of Object.values(heroJson?.datas || {})) {
    if (!hero?.name || isBlacklisted(hero)) continue
    const heroId = hero.typeId || ''
    const heroIcon = hero.icon || ''
    const skillIds = collectSkillIds([
      hero.skillList, hero.normalAttack, hero.talentSkillList, hero.paSkillList
    ])
    for (const skillId of skillIds) {
      const sName = skillNameMap.get(skillId) || ''
      link(index, skillBuffMap.get(skillId) || [], {
        kind: '角色',
        name: hero.name,
        id: heroId,
        icon: heroIcon,
        skillName: sName
      })
    }
  }

  // 魔物
  for (const pet of Object.values(petJson?.datas || {})) {
    if (!pet?.name || isBlacklisted(pet)) continue
    const petId = pet.typeId || ''
    const petIcon = pet.icon || ''
    const skillIds = collectSkillIds([pet.normalAttack, pet.skill1, pet.skill2, pet.skill3, pet.skillList])
    for (const skillId of skillIds) {
      const sName = skillNameMap.get(skillId) || ''
      link(index, skillBuffMap.get(skillId) || [], {
        kind: '魔物',
        name: pet.name,
        id: petId,
        icon: petIcon,
        skillName: sName
      })
    }
  }

  // 怪物：优先基于规范的怪物图鉴数据（monsters.json）建立索引
  // 确保：1. 与怪物图鉴技能名 100% 对齐；2. 过滤废弃/测试技能及训练木桩、NPC复制人；3. 变种与地区完全关联
  const normalizedMonsters = Array.isArray(monstersJson?.monsters)
    ? monstersJson.monsters
    : (Array.isArray(monstersJson) ? monstersJson : null)

  if (normalizedMonsters && normalizedMonsters.length > 0) {
    for (const m of normalizedMonsters) {
      if (isBlacklisted(m)) continue
      const mainId = m.id || ''
      const mainName = m.name || ''
      const place = m.place || []

      for (const form of (m.forms || [])) {
        const formId = form.id || mainId
        const formName = form.name || mainName
        const formIcon = form.icon || m.icon || ''

        // 1. 技能附加的 Buff（含技能树派生 Buff）
        for (const s of (form.skills || [])) {
          const sName = s.name || ''
          const sBuffIds = new Set((s.addBuffs || []).map(b => b.id).filter(Boolean))
          if (s.id && skillBuffMap.has(s.id)) {
            for (const bId of skillBuffMap.get(s.id)) sBuffIds.add(bId)
          }
          if (sBuffIds.size > 0) {
            link(index, [...sBuffIds], {
              kind: '怪物',
              name: formName,
              id: formId,
              icon: formIcon,
              place,
              skillName: sName
            })
          }
        }

        // 2. 怪物常驻被动 / 异变 Buff
        for (const b of (form.buffs || [])) {
          if (!b.id) continue
          link(index, [b.id], {
            kind: '怪物',
            name: formName,
            id: formId,
            icon: formIcon,
            place,
            skillName: b.name || '常驻特质'
          })
        }
      }
    }
  } else {
    // 降级兜底：基于 monJson 遍历，但过滤 dummy / NPC 并在技能名清洗上与怪物图鉴标准一致
    const mons = monJson?.datas || monJson || {}
    for (const [rawId, mon] of Object.entries(mons)) {
      if (!mon?.name && !mon?.monDes) continue
      const monId = mon.typeId || rawId || ''
      if (/^(?:hero\d+_npc|daoCaoRen|muzhuang\d*|scfx_|car_|tower1_)/i.test(monId)) continue
      if (mon.name?.includes('木桩') || mon.name?.includes('稻草人')) continue
      if (isMonsterHidden({ ...mon, typeId: monId })) continue
      const name = mon.name || mon.monDes
      const monIcon = mon.icon || ''
      const place = getMonsterPlace(monId)
      const ownIds = new Set()
      for (const field of [mon.buffsList, mon.buffList, mon.buff]) {
        if (isPlainObject(field)) for (const key of Object.keys(field)) if (buffData[key]) ownIds.add(key)
        else if (Array.isArray(field)) for (const item of field) {
          const key = typeof item === 'string' ? item : item?.buffId || item?.id
          if (key && buffData[key]) ownIds.add(key)
        }
        else if (typeof field === 'string' && buffData[field]) ownIds.add(field)
      }
      link(index, [...ownIds], { kind: '怪物', name, id: monId, icon: monIcon, place })
      for (const skillId of collectSkillIds(mon.skillList)) {
        const sName = skillNameMap.get(skillId) || ''
        link(index, skillBuffMap.get(skillId) || [], {
          kind: '怪物',
          name,
          id: monId,
          icon: monIcon,
          place,
          skillName: sName
        })
      }
    }
  }

  // 物品 / 料理
  for (const item of Object.values(itemJson?.datas || {})) {
    if (!item?.name || isBlacklisted(item)) continue
    const ids = new Set()
    collectBuffIds(item, ids)
    link(index, [...ids].filter(id => buffData[id]), {
      kind: '物品',
      name: item.name,
      id: item.typeId || item.id || '',
      icon: item.icon || ''
    })
  }

  return index
}
