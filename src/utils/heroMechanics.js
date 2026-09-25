// Build the compact combat summary shown below hero skill descriptions.
// Raw tables provide the common fields; source-audited overrides cover custom skills.

const DAMAGE_TYPE_LABELS = {
  phyAtk: '物理',
  magicAtk: '魔法',
  realAtk: '真实'
}

const ELEMENT_LABELS = {
  water: '水',
  fire: '火',
  wind: '风',
  earth: '地'
}

const FORM_LABELS = {
  normalAtk: '普通攻击',
  skill: '技能伤害',
  summon: '召唤物攻击',
  buff: 'Buff伤害',
  none: '无直接伤害'
}

const OUTCOME_LABELS = {
  damage: '伤害',
  heal: '治疗',
  shield: '护盾',
  resource: '资源恢复',
  statBuff: '属性增益',
  statDebuff: '属性削弱',
  statInherit: '属性继承',
  damageReduction: '伤害减免',
  control: '控制',
  damageOverTime: '持续伤害',
  reflect: '反伤',
  summon: '召唤'
}

// These are intentionally per-skill facts, not a global character count or rule table.
// Add a source-audited entry only when the generic table interpretation is insufficient.
export const HERO_SKILL_MECHANICS_OVERRIDES = {
  '01904': {
    reviewStatus: 'verified',
    damage: { form: 'buff', formLabel: 'Buff伤害', crit: 'no' },
    bonuses: {
      applies: ['magicAtk', 'magicDamage', 'magicPenetration', 'fireDamage', 'attackDamage'],
      excludes: ['normalDamage', 'skillDamage', 'normalAndSkillDamage']
    },
    conditions: ['普通攻击负责叠加火种；达到3层后触发一次引燃伤害'],
    notes: []
  },
  '04901': {
    reviewStatus: 'verified',
    damage: { form: 'normalAtk', crit: 'yes' },
    features: ['远程射击'],
    notes: []
  },
  '04902': {
    reviewStatus: 'verified',
    damage: { form: 'skill', crit: 'no' },
    features: ['范围', '持续', '6段'],
    notes: []
  },
  '04903': {
    reviewStatus: 'verified',
    damage: { form: 'skill', crit: 'yes' },
    features: ['范围', '穿透目标', '3次特殊攻击'],
    bonuses: {
      excludes: ['normalDamage']
    },
    conditions: ['升星4后特殊攻击必定暴击'],
    notes: [
      '描述称为普通攻击，但实际按技能伤害结算'
    ]
  },
  '04904': {
    reviewStatus: 'verified',
    damage: { form: 'none', crit: 'na' },
    features: ['普攻命中附加减速'],
    effects: ['移动速度降低20%'],
    notes: []
  },
  '02702': {
    reviewStatus: 'verified',
    damage: { crit: 'conditional' },
    features: ['多段'],
    conditions: [
      '解锁星阶技能“领班的心得”后，投掷出的厨刀可以暴击；未解锁时不能暴击。'
    ],
    notes: []
  },
  '02703': {
    reviewStatus: 'verified',
    damage: { crit: 'conditional' },
    features: ['多段', '穿透目标'],
    conditions: [
      '解锁星阶技能“领班的心得”后，投掷出的厨刀可以暴击；未解锁时不能暴击。'
    ],
    notes: []
  },
  '02704': {
    reviewStatus: 'verified',
    damage: { form: 'normalAtk', formLabel: '普通攻击', crit: 'conditional' },
    features: ['多段'],
    conditions: [
      '解锁星阶技能“领班的心得”后，天赋投掷出的厨刀可以暴击；未解锁时不能暴击。'
    ],
    notes: []
  },
  '04304': {
    reviewStatus: 'verified',
    damage: { form: 'skill', formLabel: '技能伤害', crit: 'no' },
    conditions: ['第3次普通攻击触发的【欠账】清算伤害不能暴击；普通攻击本体仍按普通攻击结算。'],
    notes: []
  },
  '05504': {
    reviewStatus: 'verified',
    damage: { crit: 'conditional' },
    conditions: ['解锁星阶技能“炼剑为我”后，【一式·飞翎】的强化斩击必定暴击；未解锁时不能暴击。'],
    notes: []
  },
  '06404': {
    reviewStatus: 'verified',
    damage: { crit: 'conditional' },
    conditions: ['普通攻击改造部分按普通攻击结算并可暴击；魔剑元素爆发及其附加伤害不能暴击。'],
    notes: []
  },
  '02504': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    features: ['多段'],
    conditions: ['天赋额外发射的弩箭按技能伤害结算，不能暴击；普通攻击本体仍可暴击。'],
    notes: []
  },
  '02604': {
    reviewStatus: 'verified',
    damage: { form: 'buff', formLabel: 'Buff伤害', crit: 'no' },
    conditions: ['【撕裂】的持续伤害不能暴击；普攻本体仍按普通攻击结算。'],
    notes: []
  },
  '03304': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    conditions: ['天赋附加的最大生命值伤害不能暴击；普通攻击本体仍按普通攻击结算。'],
    notes: []
  },
  '03404': {
    reviewStatus: 'verified',
    damage: { form: 'summon', formLabel: '召唤物攻击', crit: 'no' },
    outcomes: ['damage'],
    outcomeLabels: ['伤害'],
    conditions: ['魔水精灵触发的强力魔水弹不能暴击；魔水精灵普通攻击本体按其自身攻击规则结算。'],
    notes: []
  },
  '03402': {
    reviewStatus: 'verified',
    features: ['弹射']
  },
  '06604': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    conditions: ['冰爆伤害不能暴击；触发冰岩的普通攻击仍按普通攻击结算。'],
    notes: []
  },
  '00104': {
    reviewStatus: 'verified',
    damage: {
      form: 'none',
      formLabel: '无直接伤害',
      types: [],
      typeLabels: [],
      elements: [],
      elementLabels: [],
      scaling: [],
      scalingLabels: [],
      multiplier: 0,
      segments: [],
      crit: 'na'
    },
    bonuses: { applies: [], excludes: [] },
    outcomes: ['control'],
    outcomeLabels: ['控制'],
    conditions: [],
    notes: []
  },
  '00804': {
    reviewStatus: 'verified',
    damage: { form: 'buff', formLabel: 'Buff伤害', crit: 'no' },
    outcomes: ['damageOverTime'],
    outcomeLabels: ['持续伤害'],
    conditions: ['【灼烧】的持续伤害不能暴击；天赋由角色自身暴击触发。'],
    notes: []
  },
  '01204': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    conditions: ['第5次普攻触发的火箭附加伤害不能暴击；普通攻击本体仍可暴击。'],
    notes: []
  },
  '04104': {
    reviewStatus: 'verified',
    damage: { crit: 'yes' },
    conditions: ['反击有30%概率触发；触发后有4秒冷却。'],
    notes: []
  },
  '03703': {
    reviewStatus: 'verified',
    damage: { crit: 'conditional' },
    conditions: ['解锁星阶技能“梵海修罗”后，【禅天极震】可以暴击；未解锁时不能暴击。'],
    notes: []
  },
  '02303': {
    reviewStatus: 'verified',
    features: ['强化普攻']
  },
  '02502': {
    reviewStatus: 'verified',
    features: ['穿透目标']
  },
  '02503': {
    reviewStatus: 'verified',
    features: ['多段']
  },
  '05002': {
    reviewStatus: 'verified',
    features: ['多段']
  },
  '05502': {
    reviewStatus: 'verified',
    features: ['多段']
  },
  '05503': {
    reviewStatus: 'verified',
    features: ['弹射']
  },
  '05102': {
    reviewStatus: 'verified',
    damage: { form: 'skill', crit: 'no' },
    notes: []
  },
  '05302': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    notes: []
  },
  '05303': {
    reviewStatus: 'verified',
    damage: { crit: 'no' },
    notes: []
  },
  '04603': {
    reviewStatus: 'verified',
    damage: { form: 'none', formLabel: '无直接伤害', crit: 'na' },
    outcomes: ['summon', 'control', 'reflect'],
    outcomeLabels: ['召唤', '控制', '反伤'],
    conditions: [
      '反击仅在敌人的普通攻击命中假人时触发；每次符合条件的命中触发1次，没有独立次数上限或反击冷却。',
      '假人的反击伤害不能暴击。',
      '被嘲讽的敌人无法使用技能，只能进行普通攻击。',
      'Boss是否受嘲讽取决于目标的控制抗性；具有控制抗性的Boss可能免疫嘲讽。'
    ],
    notes: []
  },
  '03403': {
    reviewStatus: 'verified',
    damage: {
      form: 'summon',
      formLabel: '召唤物攻击',
      types: ['magicAtk'],
      typeLabels: ['魔法'],
      elements: [],
      elementLabels: [],
      scaling: ['magicAtk'],
      scalingLabels: ['魔法攻击'],
      crit: 'yes'
    },
    bonuses: {
      applies: ['magicAtk', 'magicDamage', 'magicPenetration', 'normalDamage', 'normalAndSkillDamage'],
      excludes: ['skillDamage']
    },
    conditions: [
      '魔水精灵喷射魔水弹为远程普通攻击，按魔法伤害结算，可以暴击（召唤物基础暴击率25%、暴击伤害125%）。',
      '魔水精灵继承露帕对应技能等级比例的法术强度与最大生命值。'
    ],
    notes: []
  },
  '06502': {
    reviewStatus: 'verified',
    damage: {
      form: 'summon',
      formLabel: '召唤物攻击',
      types: ['phyAtk'],
      typeLabels: ['物理'],
      elements: ['fire'],
      elementLabels: ['火'],
      scaling: ['phyAtk'],
      scalingLabels: ['物理攻击'],
      crit: 'yes'
    },
    bonuses: {
      applies: ['phyAtk', 'physicalDamage', 'physicalPenetration', 'fireDamage', 'normalDamage', 'normalAndSkillDamage'],
      excludes: ['skillDamage']
    },
    conditions: [
      '浮游炮自动攻击为远程普通攻击，按火属性物理伤害结算，可以暴击（召唤物基础暴击率12%、暴击伤害150%）。',
      '浮游炮继承乌尔勒60%攻击力、20%防御力与80%最大生命值。'
    ],
    notes: []
  },
  '02603': {
    reviewStatus: 'verified',
    conditions: [
      '技能本体造成的范围斩击按技能伤害结算，不能暴击。',
      '召唤出的吸血蝙蝠攻击为近战普通攻击，按火属性物理伤害结算，可以暴击（蝙蝠基础暴击率35%、暴击伤害125%），攻击附带吸血恢复。'
    ],
    notes: []
  },
  '02902': {
    reviewStatus: 'verified',
    conditions: [
      '技能发射的音波斩击按技能伤害结算，不能暴击。',
      '召唤出的火精灵自动攻击为火属性普通攻击，可以暴击（火精灵基础暴击率25%、暴击伤害125%）。'
    ],
    notes: []
  },
  '02903': {
    reviewStatus: 'verified',
    conditions: [
      '技能为群体治疗，无直接伤害。',
      '召唤出的风精灵持续演奏，为附近的友方单位提供持续治疗。'
    ],
    notes: []
  }
}

function asObject(value) {
  return value && typeof value === 'object' ? value : null
}

function collectDamageEntries(value, entries = []) {
  const object = asObject(value)
  if (!object) return entries
  for (const [key, child] of Object.entries(object)) {
    // 技能表同时使用 damage、damage1、damage2 等字段表示伤害段。
    if ((key === 'damage' || /^damage\d+$/.test(key)) && asObject(child) && (child.damageType || child.muAddType || child.elementType || Number(child.muPower) || Number(child.baseDamage))) entries.push(child)
    if (asObject(child)) collectDamageEntries(child, entries)
  }
  return entries
}

function collectBuffIds(value, ids = []) {
  const object = asObject(value)
  if (!object) return ids
  for (const [key, child] of Object.entries(object)) {
    if (key === 'addBuff' && Array.isArray(child)) ids.push(...child.filter(Boolean))
    if ((key === 'buffId' || key === 'addBuffId') && typeof child === 'string') ids.push(child)
    if ((key === 'addBuff' || key === 'buffs') && Array.isArray(child)) ids.push(...child.filter(Boolean))
    if (asObject(child)) collectBuffIds(child, ids)
  }
  return ids
}

function collectBuffDamageEntries(buffIds, buffDatas) {
  const entries = []
  const queue = [...buffIds]
  const seen = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const buff = buffDatas?.[id]
    if (!buff) continue
    const payload = buff.para || buff
    entries.push(...collectDamageEntries(payload))
    queue.push(...collectBuffIds(payload))
  }
  return entries
}

function containsAppliedBuff(value) {
  const object = asObject(value)
  if (!object) return false
  for (const [key, child] of Object.entries(object)) {
    if (key === 'addBuff' && (Array.isArray(child) ? child.length > 0 : Boolean(child))) return true
    if (asObject(child) && containsAppliedBuff(child)) return true
  }
  return false
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function hasSummonDescription(description) {
  return /召唤/.test(description)
    || (/部署[^。；，,]*(?:浮游炮|召唤物|单位|装置|傀儡|图腾)/.test(description)
      && /拥有|继承|自动攻击|不可移动/.test(description))
    || /放置[^。；，,]*(?:拥有|反击|召唤物|稻草人|装置|傀儡)/.test(description)
}

function detectOutcomes(description, hasDamage, hasDescribedDamage = false) {
  const outcomes = []
  if (hasDamage || hasDescribedDamage) outcomes.push('damage')
  if (/治疗|恢复[^。；，,]*生命|回复[^。；，,]*生命/.test(description)) outcomes.push('heal')
  if (/护盾/.test(description)) outcomes.push('shield')
  if (/(?:恢复|回复|获得)[^。；，,]*(?:法力|魔力|能量|MP)/i.test(description)) outcomes.push('resource')
  // 游戏文本既使用“召唤”，也使用“部署某个单位/装置”描述召唤物。
  if (hasSummonDescription(description)) outcomes.push('summon')
  if (/眩晕|禁锢|击退|击飞|拉扯|嘲讽|减速|沉默|冻结|定身/.test(description)) outcomes.push('control')
  if (/(?:提高|增加|提升)[^。；，,]*(?:攻击|防御|攻速|移速|暴击|伤害|抗性|穿透|冷却)|(?:攻击|防御|攻速|移速|暴击|伤害|抗性|穿透|冷却)[^。；，,]*(?:提高|增加|提升)/.test(description)) outcomes.push('statBuff')
  // “受到的伤害减少”是自身减伤；“连续命中伤害减少”是伤害衰减，二者都不是敌方属性削弱。
  const selfDamageReduction = /受到的(?:所有)?伤害(?:降低|减少)/.test(description)
  const repeatedDamageReduction = /(?:单个敌人|同一目标)[^。；，,]*连续[^。；，,]*伤害[^。；，,]*(?:降低|减少|降至)|连续[^。；，,]*伤害[^。；，,]*(?:降低|减少|降至)/.test(description)
  if (selfDamageReduction) outcomes.push('damageReduction')
  if (!selfDamageReduction && !repeatedDamageReduction && /(?:降低|减少)[^。；，,]*(?:攻击|防御|攻速|移速|暴击|伤害|抗性|穿透|冷却)|(?:攻击|防御|攻速|移速|暴击|伤害|抗性|穿透|冷却)[^。；，,]*(?:降低|减少)/.test(description)) outcomes.push('statDebuff')
  if (/继承[^。；，,]*(?:属性|攻击|防御|生命|抗性|穿透)/.test(description)) outcomes.push('statInherit')
  if (/(?:反击|反伤|等同于该次攻击)[^。；，,]*伤害/.test(description)) outcomes.push('reflect')
  if ((hasDamage || hasDescribedDamage) && /每\s*\{?\s*\d+(?:\.\d+)?\s*\}?\s*秒[^。；，,]*(?:造成|受到)[^。；，,]*伤害/.test(description) && /持续/.test(description)) outcomes.push('damageOverTime')
  return unique(outcomes)
}

function collectEffectScalings(description) {
  const formulaText = [...description.matchAll(/\{([^}]*)\}/g)].map(match => match[1]).join(' ')
  const scalings = []
  // 属性名称有时位于花括号外（如“继承 {100%} 物理攻击力”），不能只查公式本体。
  if (/物理攻击/.test(`${formulaText} ${description}`)) scalings.push('phyAtk')
  if (/魔法攻击|法术强度/.test(`${formulaText} ${description}`)) scalings.push('magicAtk')
  if (/最大生命|拥有[^。；，,]*生命值/.test(description)) scalings.push('maxHp')
  if (/最大法力|最大魔力/.test(description)) scalings.push('maxSp')
  return unique(scalings)
}

// 部分技能由召唤物自身攻击，技能表没有可遍历的 damage 字段，伤害公式只存在于描述文本。
// 仅在公式附近明确出现“伤害”且同时能识别攻击属性时采集，避免把普通百分比误判为伤害。
function collectDescriptionDamageEntries(description) {
  const entries = []
  for (const match of description.matchAll(/\{([^}]*)\}/g)) {
    const formula = match[1]
    const remainder = description.slice(match.index + match[0].length)
    const tail = remainder.match(/^[^。；！？]*/)?.[0] || ''
    const context = `${formula} ${tail}`
    if (!/伤害/.test(context)) continue

    const percent = context.match(/(\d+(?:\.\d+)?)\s*%/)
    if (!percent) continue
    const scaling = /物理攻击/.test(context)
      ? 'phyAtk'
      : /魔法攻击|法术强度/.test(context)
        ? 'magicAtk'
        : /最大生命/.test(context)
          ? 'maxHp'
          : ''
    if (!scaling) continue

    const damageType = /真实伤害/.test(context)
      ? 'realAtk'
      : /魔法伤害/.test(context) || scaling === 'magicAtk'
        ? 'magicAtk'
        : 'phyAtk'
    entries.push({
      damageType,
      elementType: '',
      scaling,
      multiplier: Number(percent[1]) / 100,
      baseDamage: 0
    })
  }
  return entries
}

function hasSummonConfig(value, buffDatas) {
  const object = asObject(value)
  if (!object) return false
  if (asObject(object.summonData)) return true
  if (Object.values(object).some(child => asObject(child) && hasSummonConfig(child, buffDatas))) return true
  return collectBuffIds(value).some(id => {
    const buff = buffDatas?.[id]
    return Boolean(buff && hasSummonConfig(buff.para || buff, buffDatas))
  })
}

function normalizeDamageEntry(entry) {
  const damageType = entry.damageType || entry.muAddType || ''
  const scaling = entry.muAddType || ''
  return {
    damageType,
    elementType: entry.elementType || '',
    scaling,
    multiplier: Number(entry.muPower || 0),
    baseDamage: Number(entry.baseDamage || 0)
  }
}

function mergeMechanics(base, override) {
  if (!override) return base
  const merged = {
    ...base,
    ...override,
    damage: { ...base.damage, ...(override.damage || {}) },
    bonuses: { ...base.bonuses, ...(override.bonuses || {}) },
    features: unique([...(base.features || []), ...(override.features || [])]),
    effects: unique([...(base.effects || []), ...(override.effects || [])]),
    conditions: unique([...(base.conditions || []), ...(override.conditions || [])]),
    notes: unique([...(base.notes || []), ...(override.notes || [])])
  }
  return merged
}

function buildBaseMechanics({ type, levelValue, buffDatas }) {
  const description = String(levelValue?.des || '')
  // 有些防御型天赋的 buff 内带有受击/反制伤害配置，但天赋本身并不造成直接伤害。
  const defensiveOnly = /受到的(?:所有)?伤害(?:减少|降低)/.test(description) && !/(?:造成|对.+?伤害)/.test(description)
  const rawEntries = defensiveOnly ? [] : collectDamageEntries(levelValue)
  const buffIds = collectBuffIds(levelValue)
  const buffEntries = defensiveOnly ? [] : collectBuffDamageEntries(buffIds, buffDatas)
  const structuredEntries = [...rawEntries, ...buffEntries].map(normalizeDamageEntry)
  const damageKey = entry => JSON.stringify([entry.damageType, entry.scaling, entry.multiplier, entry.baseDamage])
  const structuredKeys = new Set(structuredEntries.map(damageKey))
  const textEntries = defensiveOnly ? [] : collectDescriptionDamageEntries(description)
    .filter(entry => !structuredKeys.has(damageKey(entry)))
  const entries = structuredEntries.concat(textEntries)
  const uniqueEntries = entries.filter((entry, index, list) => {
    const key = JSON.stringify(entry)
    return list.findIndex(item => JSON.stringify(item) === key) === index
  })

  const damageTypes = unique(uniqueEntries.map(entry => entry.damageType))
  const elements = unique(uniqueEntries.map(entry => entry.elementType))
  const scaling = unique(uniqueEntries.map(entry => entry.scaling))
  const hasDamage = uniqueEntries.length > 0
  // 天赋通常是被动，但替换普通攻击的天赋仍按普通攻击结算。
  const hasSummonText = hasSummonDescription(description)
  const summonConfig = hasSummonConfig(levelValue, buffDatas)
  const hasSummonAttack = summonConfig && hasSummonText && /(?:会(?:自动)?攻击|自动攻击|每次攻击|持续[^。；，,]{0,12}攻击|助战|喷射|发射)/.test(description)
  const hasDirectStructuredDamage = rawEntries.length > 0 || buffEntries.length > 0
  const form = hasSummonAttack && !hasDirectStructuredDamage
    ? 'summon'
    : !hasDamage
      ? hasSummonAttack ? 'summon' : 'none'
    : type === 'normal'
      ? 'normalAtk'
      : type === 'active'
        ? 'skill'
        : /普通攻击|普攻|自动射击/.test(description)
          ? 'normalAtk'
          : 'none'
  const hasRange = Boolean(levelValue?.range || levelValue?.radius || levelValue?.rectRange || levelValue?.aniEvents?.some(event => {
    const arg = event?.arg || {}
    return arg.range || arg.radius || arg.rectRange
  })) || /范围内|范围伤害|目标范围|附近敌人|周围的敌人|其下方敌人/.test(description)
  const hasDuration = Boolean(levelValue?.durTime || levelValue?.spTime || levelValue?.aniEvents?.some(event => {
    const arg = event?.arg || {}
    return arg.durTime || arg.spTime
  })) || /持续\s*\{?\s*\d+(?:\.\d+)?\s*\}?\s*(?:秒|s)/.test(description)
  const hasBuff = containsAppliedBuff(levelValue)
  const reductionRates = unique((levelValue?.aniEvents || [])
    .map(event => Number(event?.arg?.damDecRate))
    .filter(rate => Number.isFinite(rate) && rate >= 0 && rate < 1))
  const features = []
  if (hasRange) features.push('范围')
  if (hasDuration) features.push('持续')
  if (uniqueEntries.length > 1) features.push('多段')
  if (hasBuff) features.push('附加状态')

  const effects = reductionRates.map(rate => `同一目标连续命中时，后续伤害降至${Math.round(rate * 100)}%`)
  // 排除“造成的所有伤害提高/降低”这类伤害增益描述；它不是技能本身的直接伤害。
  const hasDescribedDamage = /(?:造成|反击|反伤|等同于该次攻击)[^。；，,]*伤害(?!提高|增加|提升|降低|减少)/.test(description)
  const outcomes = detectOutcomes(description, hasDamage, hasDescribedDamage)
  const effectScalings = collectEffectScalings(description)
  const notes = []

  const applies = []
  if (hasDamage) {
    if (scaling.includes('phyAtk')) applies.push('phyAtk')
    if (scaling.includes('magicAtk')) applies.push('magicAtk')
    if (damageTypes.includes('phyAtk')) applies.push('physicalDamage', 'physicalPenetration')
    if (damageTypes.includes('magicAtk')) applies.push('magicDamage', 'magicPenetration')
    elements.forEach(element => {
      if (ELEMENT_LABELS[element]) applies.push(`${element}Damage`)
    })
    if (form === 'normalAtk') applies.push('normalDamage', 'normalAndSkillDamage')
    if (form === 'skill') applies.push('skillDamage', 'normalAndSkillDamage')
  }

  const excludes = []
  if (hasDamage && form === 'normalAtk') excludes.push('skillDamage')
  if (hasDamage && form === 'skill') excludes.push('normalDamage')

  // CalculateMaster's needCirt parameter defaults to false. Normal attacks are
  // dispatched through the normal-attack controller (which enables crit), while
  // regular active-skill damage must opt in explicitly. Source-audited exceptions
  // such as 04903 are represented in HERO_SKILL_MECHANICS_OVERRIDES above.
  const crit = hasDamage
    ? type === 'normal'
      ? 'yes'
      : type === 'active'
        ? 'no'
        : 'unknown'
    : 'na'

  return {
    reviewStatus: hasDamage ? (type === 'talent' ? 'pending' : 'verified') : 'table-derived',
    damage: {
      form,
      formLabel: FORM_LABELS[form],
      types: damageTypes,
      typeLabels: damageTypes.map(typeName => DAMAGE_TYPE_LABELS[typeName] || typeName),
      elements,
      elementLabels: elements.map(element => ELEMENT_LABELS[element] || element),
      scaling,
      scalingLabels: scaling.map(stat => stat === 'phyAtk' ? '物理攻击' : stat === 'magicAtk' ? '魔法攻击' : stat),
      multiplier: uniqueEntries[0]?.multiplier || 0,
      segments: uniqueEntries,
      crit
    },
    bonuses: {
      applies: unique(applies),
      excludes: unique(excludes)
    },
    features,
    effects,
    outcomes,
    outcomeLabels: outcomes.map(outcome => OUTCOME_LABELS[outcome] || outcome),
    effectScalings,
    effectScalingLabels: effectScalings.map(stat => stat === 'phyAtk' ? '物理攻击' : stat === 'magicAtk' ? '魔法攻击' : stat === 'maxHp' ? '最大生命' : stat === 'maxSp' ? '最大法力' : stat),
    conditions: [],
    notes,
    sourceRefs: []
  }
}

export function buildSkillMechanics({ skillId, type, levelValue, buffDatas }) {
  const base = buildBaseMechanics({ type, levelValue, buffDatas })
  return mergeMechanics(base, HERO_SKILL_MECHANICS_OVERRIDES[skillId])
}

export function buildTalentMechanics({ skillId, trigger, buffDatas }) {
  const base = buildBaseMechanics({ type: 'talent', levelValue: trigger?.levelData?.['1'] || trigger, buffDatas })
  const override = HERO_SKILL_MECHANICS_OVERRIDES[skillId]
  return mergeMechanics(base, override)
}

export const MECHANICS_LABELS = {
  phyAtk: '物理攻击',
  magicAtk: '魔法攻击',
  physicalDamage: '物理伤害',
  magicDamage: '魔法伤害',
  waterDamage: '水属性伤害',
  fireDamage: '火属性伤害',
  windDamage: '风属性伤害',
  earthDamage: '地属性伤害',
  physicalPenetration: '物理穿透',
  magicPenetration: '魔法穿透',
  normalDamage: '普通攻击伤害加成',
  skillDamage: '技能伤害',
  normalAndSkillDamage: '普通攻击与技能伤害加成',
  attackDamage: '造成的伤害加成'
}

export const MECHANICS_CRIT_LABELS = {
  yes: '可以暴击',
  no: '不能暴击',
  conditional: '条件满足时暴击',
  guaranteed: '必定暴击',
  unknown: '实际暴击规则待核对',
  na: '无直接伤害'
}
