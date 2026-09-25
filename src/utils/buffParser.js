/**
 * Buff 词条构建期纯函数：把 `buff.json` 的 `para` 数值翻成玩家可读的中文说明。
 *
 * 为什么需要：`para` 里 1638 条 buff 都带真实数值，但字段形状有 60+ 种
 * （`attr.<属性>.baseValue/percent`、`damage.muPower`、`addNewBuff.*` 嵌套…），
 * 此前角色/怪物图鉴只取了名字和描述，数值全部丢失。
 * 本模块是**唯一**的 para 渲染实现，词条页与角色/怪物图鉴共用，不在页面里另写一套。
 *
 * 单位语义依据源码（不靠猜）：
 * - `AttrAdd.cs`：`{ baseValue, percent }` 两个字段
 * - `Buff_AttributeAdd.cs` 的 `AddAttr()`：各属性分别把 baseValue/percent 加到哪个字段
 * - `UnitDataShowPanel.cs:162-221` 的 `GetNumByTypeName` / `GetPercent`：
 *   官方「字段 → 中文名 + 单位」对照，`GetPercent(v) = round(v*100,2)+"%"`（比例 ×100）
 * - `ExtentionMethod.cs:1726-1770` 的 `GetAttrValueStr`：官方单位表（补充）
 *
 * 单位三分类（写死在 `ATTR_STAT_META` 的 `base`/`percent` 字段）：
 * - `flat`  绝对值（点数）
 * - `ratio` 比例小数，展示要 ×100 再加 `%`（源码走 `GetPercent`）
 * - `pct`   已经是百分数，直接加 `%`（源码直接拼 `"%"`）
 */

// ---------- 属性数值单位表 ----------
// base / percent 分别描述 baseValue、percent 两个字段的单位；null 表示源码不读取该字段。
// name 取源码 `UnitDataShowPanel` 的官方中文名。
export const ATTR_STAT_META = {
  // 固定值 + 比例加成（AddAttr 分别累加到 *AddNum 与 *Add）
  phyAtk: { name: '物理攻击', base: 'flat', percent: 'ratio' },
  magicAtk: { name: '魔法攻击', base: 'flat', percent: 'ratio' },
  phyDef: { name: '物理防御', base: 'flat', percent: 'ratio' },
  magicDef: { name: '魔法防御', base: 'flat', percent: 'ratio' },
  hpMax: { name: '最大生命值', base: 'flat', percent: 'ratio' },
  spMax: { name: '最大魔法值', base: 'flat', percent: 'ratio' },
  // 只读 baseValue，且字段本身已是百分数
  atkSpeed: { name: '攻速加成', base: 'pct', percent: null },
  crit: { name: '暴击率', base: 'pct', percent: null },
  critDam: { name: '暴击伤害', base: 'pct', percent: null },
  cirtDam: { name: '暴击伤害', base: 'pct', percent: null }, // item.json 历史拼写
  critRes: { name: '暴击抗性', base: 'pct', percent: null },
  vampire: { name: '吸血百分比', base: 'pct', percent: null },
  rebDam: { name: '反伤百分比', base: 'pct', percent: null },
  skillCool: { name: '冷却缩减', base: 'pct', percent: null },
  cureAdd: { name: '受治疗加成', base: 'pct', percent: null },
  repelRes: { name: '击退抗性', base: 'pct', percent: null },
  phyAtkPen: { name: '物理穿透', base: 'pct', percent: null },
  magicAtkPen: { name: '魔法穿透', base: 'pct', percent: null },
  // 只读 baseValue，且是比例（源码走 GetPercent）
  hitDam: { name: '受到的伤害', base: 'ratio', percent: null },
  atkDamAdd: { name: '造成的伤害', base: 'ratio', percent: null },
  earth: { name: '地属性伤害提升', base: 'ratio', percent: null },
  water: { name: '水属性伤害提升', base: 'ratio', percent: null },
  fire: { name: '火属性伤害提升', base: 'ratio', percent: null },
  wind: { name: '风属性伤害提升', base: 'ratio', percent: null },
  phyRes: { name: '物理抗性', base: 'ratio', percent: null },
  magicRes: { name: '魔法抗性', base: 'ratio', percent: null },
  earthRes: { name: '地属性抗性', base: 'ratio', percent: null },
  waterRes: { name: '水属性抗性', base: 'ratio', percent: null },
  fireRes: { name: '火属性抗性', base: 'ratio', percent: null },
  windRes: { name: '风属性抗性', base: 'ratio', percent: null },
  // 只读 percent，且是比例
  runSpeed: { name: '移速加成', base: null, percent: 'ratio' },
  // 固定值 + 已是百分数的 percent（Buff_FirstVic.cs → restoreHp/restoreBaseHp）
  restoreHp: { name: '生命恢复', base: 'flat', percent: 'pct' },
  restoreSp: { name: '法力恢复', base: 'flat', percent: 'pct' }
}

// ---------- 伤害/属性键名 ----------
const DAMAGE_TYPE_LABELS = {
  phyAtk: '物理攻击',
  magicAtk: '魔法攻击',
  realAtk: '真实伤害',
  maxHp: '最大生命值',
  curHp: '当前生命值',
  atk: '攻击力'
}
const ELEMENT_LABELS = { fire: '火', water: '水', wind: '风', earth: '地' }

// ---------- 触发方式（源码 BuffDetectType.cs，68 个枚举里的常用项） ----------
// 只列玩家能理解的；未收录的枚举回退成原始代号，不编造解释。
export const DETECT_TYPE_LABELS = {
  none: '',
  spTime: '按固定间隔持续生效',
  dead: '自身死亡时',
  targetDead: '目标死亡时',
  firstVic: '战斗开始时',
  damCrit: '造成暴击时',
  normalAtkCrit: '普通攻击暴击时',
  normalAtkCritAddDam: '普通攻击暴击后追加伤害',
  normalAtkAddNewDam: '普通攻击时追加伤害',
  normalAtk: '普通攻击时',
  normalAtkAndBeHit: '普通攻击或受击时',
  overLay: '叠层时',
  atkTm: '累计攻击次数达标时',
  spSkill: '释放技能时',
  doSkill: '释放技能时',
  doSkillEnd: '技能释放结束时',
  doNormalAtkEnd: '普通攻击结束时',
  normalAtkStartAndAtkEnd: '普通攻击开始与结束时',
  skillAtk: '技能命中时',
  BuffOver: '状态结束时',
  buffDamage: '状态造成伤害时',
  beHit: '受到攻击时',
  beHitByNorAtk: '受到普通攻击时',
  beHitByNormalAtk: '受到普通攻击时',
  beHitByNormalPhyAtk: '受到物理普通攻击时',
  beHitCheckLevel: '受击且等级满足条件时',
  beHitChangeDam: '受击后改变伤害',
  beHitReplyDamage: '受击时反击',
  addShield: '获得护盾时',
  addBuffType: '获得指定状态时',
  everyReply: '每次回复时',
  everyReplyHpAndSp: '每次回复生命或法力时',
  atkCheckHp: '攻击时按生命值判定',
  atkCheckDam: '攻击时按伤害判定',
  atkReplyDamage: '攻击时回复',
  atkAndHurtCheckHp: '攻击与受击时按生命值判定',
  atk: '攻击时',
  heroUsePotionItem: '使用药水时',
  normalAtkDam: '普通攻击造成伤害时',
  skillAtkDam: '技能造成伤害时',
  atkDamElement: '造成元素伤害时',
  nearDead: '濒死时',
  atkAndSkill: '攻击或释放技能时',
  monCntChange: '场上怪物数量变化时',
  heroCntChange: '场上角色数量变化时',
  skillKill: '技能击杀时',
  replySp: '回复法力时',
  doSkillResetCd: '释放技能并重置冷却时',
  roomChange: '房间变化时',
  unitDeadCheckJob: '单位死亡且职业满足时',
  skillConsume: '消耗技能资源时',
  friendBeHitByNorAtk: '友方受到普通攻击时',
  checkTarDead: '目标死亡判定时',
  checkSummonIdDead: '指定召唤物死亡时',
  atkAndSkillSucces: '攻击或技能命中时',
  normalDamCalEnd: '普通伤害结算结束时'
}

// ---------- buffEffect：权威机制分类 ----------
// 依据源码 `BuffControl.cs:312` 的 `CreatBuff(target, buffConf.buffEffect)`——这是**唯一**的效果派发点，
// `BuffControl.cs:352-713` 是 356 分支的 switch（键 = buffEffect，值 = Buff 实现类）。
// 因此判断「这个 buff 是什么机制」只能看 buffEffect：
//   - `buffType` 有 509 个取值且大量英雄专属串，只用于同类型互斥去重（`BuffControl.cs:730-741`）
//   - `buffTags` 1649 条里 71% 为空，只用于检测/驱散/改时长/护盾归属，不参与派发
// 下表只收**通用机制**（约 30 个）；其余 306 个是英雄/宠物/装备专属名（heroNNN*、pet_*、equip_*…），
// 归到对应角色词条，不当作通用词条。
export const BUFF_EFFECT_META = {
  // 持续伤害
  DOT: { name: '持续伤害', category: '持续伤害' },
  dotHalo: { name: '持续伤害光环', category: '持续伤害' },
  Poisoning: { name: '中毒', category: '持续伤害' },
  // 控制
  vertigo: { name: '眩晕', category: '控制' },
  Immobility: { name: '定身', category: '控制' },
  taunt: { name: '嘲讽', category: '控制' },
  confusion: { name: '混乱', category: '控制' },
  // 护盾
  Shield: { name: '护盾', category: '护盾' },
  maxHpShield: { name: '生命值护盾', category: '护盾' },
  PhAtkShield: { name: '物攻护盾', category: '护盾' },
  // 回复
  HOT: { name: '持续回复', category: '回复' },
  replyHalo: { name: '回复光环', category: '回复' },
  addHpVic: { name: '层数回复', category: '回复' },
  // 属性增减
  attrAddTime: { name: '限时属性增减', category: '属性增减' },
  attrAddVic: { name: '层数属性加成', category: '属性增减' },
  atkUp: { name: '攻击提升', category: '属性增减' },
  atkReduce: { name: '攻击降低', category: '属性增减' },
  atkSpeedUp: { name: '攻速提升', category: '属性增减' },
  moveUp: { name: '移速提升', category: '属性增减' },
  Thick: { name: '攻速与移速变化', category: '属性增减' },
  atkAddNum: { name: '普攻次数属性', category: '属性增减' },
  Buff_AttributeAddByNormalAtkTime: { name: '普攻次数属性', category: '属性增减' },
  Reduced_Defence: { name: '防御降低', category: '属性增减' },
  // 伤害修正
  commonDamAdd: { name: '通用增伤', category: '伤害修正' },
  damAddDamReduce: { name: '增伤与减伤', category: '伤害修正' },
  damAddRes: { name: '单位增伤与减伤', category: '伤害修正' },
  damAddHitAdd: { name: '增伤与命中提升', category: '伤害修正' },
  damTypeAdd: { name: '按伤害类型增伤', category: '伤害修正' },
  Buff_DamageAdd: { name: '伤害加成', category: '伤害修正' },
  beHitDamAdd: { name: '受击后增伤', category: '伤害修正' },
  canOverlaySkillDam: { name: '叠层技能增伤', category: '伤害修正' },
  elementSkillDamAdd: { name: '元素技能增伤', category: '伤害修正' },
  nextNorAtkDamAdd: { name: '下次普攻增伤', category: '伤害修正' },
  nextNorAtkRealCirt: { name: '下次普攻必定暴击', category: '伤害修正' },
  nextNorAtkPen: { name: '下次普攻穿透', category: '伤害修正' },
  norAtkAddNewDam: { name: '普攻附加伤害', category: '伤害修正' },
  normalAtkAddBuff: { name: '普攻附带状态', category: '伤害修正' },
  normalAtkDamAdd: { name: '普攻增伤', category: '伤害修正' },
  strengthenAtk: { name: '强化攻击', category: '伤害修正' },
  XierSkill1: { name: '强化攻击·进阶', category: '伤害修正' },
  // 等级与条件判定
  Rank_Of_Received_Damage_Decreases: { name: '受击按等级减伤', category: '等级判定' },
  Attack_Damage_Judgment_Level_Increases_Damage: { name: '攻击按等级增伤', category: '等级判定' },
  // 形态改变
  longAtkChange: { name: '远程攻击形态变更', category: '形态改变' },
  hero049Skill2Buff1: { name: '改变普通攻击', category: '形态改变' },
  // 召唤
  autoMoveSum: { name: '自动移动召唤物', category: '召唤' },
  hero026SummonBuff: { name: '召唤强化', category: '召唤' },
  // 濒死
  nearDead: { name: '濒死', category: '濒死' },
  hardNearDead: { name: '强韧濒死', category: '濒死' },
  // 特殊机制
  baTi: { name: '霸体', category: '特殊机制' },
  noneEft: { name: '纯特效（无战斗效果）', category: '特殊机制' },
  spObjReplyBuff_1: { name: '场景物回复', category: '特殊机制' },
  monSpecialBuff: { name: '怪物特殊状态', category: '特殊机制' },
  checkTeamElement: { name: '队伍元素判定', category: '特殊机制' },
  checkTeamJob: { name: '队伍职业判定', category: '特殊机制' },
  petCheckTrigger: { name: '宠物触发判定', category: '特殊机制' }
}

// 职业被动（heroJobNBuff*）也是通用机制，归一类
const JOB_BUFF_EFFECT_PATTERN = /^heroJob\d+Buff\d*$/

/**
 * 解析 buffEffect 的机制名与分类。专属名（`heroNNN`、`pet_`、`equip_`、`suit_`、`enchant_`、`mon` 前缀）
 * 返回空，由调用方决定是否折叠，不冒充通用词条。
 */
export function resolveBuffEffect(effect) {
  const key = String(effect || '')
  if (!key) return null
  if (BUFF_EFFECT_META[key]) return BUFF_EFFECT_META[key]
  if (JOB_BUFF_EFFECT_PATTERN.test(key)) return { name: '职业被动', category: '职业被动' }
  return null
}

// ---------- 词条分组 ----------
/**
 * 词条库分组。默认视图是「战斗状态」（玩家点名的「中毒、燃烧」这类），
 * 花名技能与怪物异变各占一组，不污染默认视图。
 * 料理不进词条库：`/recipes` 已按菜谱展示效果，且 31 条料理是「太多太杂」的主要来源。
 */
export const STATUS_GROUPS = [
  { id: 'status', name: '战斗状态', desc: '打在单位身上的负面、控制与护盾状态。' },
  { id: 'attribute', name: '属性增益', desc: '提升属性的通用增益状态。' },
  { id: 'elite', name: '怪物异变', desc: '精英怪与首领携带的异变状态。' },
  { id: 'skill', name: '技能专属', desc: '角色技能、升星与装备带来的专属状态，名字多为技能名。' }
]

/**
 * 标准状态规则表。
 *
 * **判定完全基于数据字段，不使用 `buffName`**，四层信号按顺序判定：
 *   1. `buffTypes`      —— 配置的语义类型（`poison` / `bleeding` / `burning` / `vertigo` / `fixed` / `taunt` / `shield` / `critUp`…）
 *   2. `buffEffects`    —— 源码唯一的效果派发键（`Thick` / `HOT` / `Shield` / `confusion` / `dotHalo`…）
 *   3. `elements`       —— `para.damage.elementType`（火属性 DOT 即燃烧）
 *   4. `attrPositive` / `attrNegative` —— `para.attr` 改了哪个属性、往哪个方向
 *   5. `desPattern`     —— **游戏自己的效果描述** `buffDes`（如「进入中毒状态」）。
 *      这不是展示名：展示名常常是「中毒紫」「中毒紫-boss」这类变体名，判不出效果；
 *      而描述是配置对效果的权威说明。放在最后，只用于机器可读字段覆盖不到的残留情形。
 *
 * 为什么不用名字：名字判不出效果，而且会判错。本项目实际数据里的反例——
 * `圣愈` 的 `buffDes` 写「暴击增加」、`buffType=critUp`，按名字会被归进治疗类；
 * 按 `buffType` 判定则正确落到「暴击提升」。
 * 为什么不用 `effect` 数字编号：它是表现层特效号，语义不同的状态会共用同一个号——
 * `炒鲜姑` 特效号 1201 与治疗同号，但实际是「增加生命上限 500 点」。
 *
 * 规则按「越具体越靠前」排列，命中即止。新 buff 只要带这些字段就会自动归位，不用改清单。
 * 构建期由 `buildGlossaryEntries` 断言每条规则至少命中一条 buff。
 */
export const STATUS_RULES = [
  // —— 持续伤害：buffType 是通用语义时最可靠，其次看元素与效果描述 ——
  { id: 'poison', name: '中毒', group: 'status', category: '持续伤害', buffTypes: ['poison'], desPattern: /中毒/ },
  { id: 'bleeding', name: '流血', group: 'status', category: '持续伤害', buffTypes: ['bleeding'], desPattern: /流血/ },
  { id: 'burning', name: '燃烧', group: 'status', category: '持续伤害', buffTypes: ['burning'], elements: ['fire'], desPattern: /燃烧|灼烧|业炎/ },
  { id: 'tear', name: '撕裂', group: 'status', category: '持续伤害', buffTypes: ['hero026TalentEffectBuff', 'hero047Skill1AddBuffBase'], desPattern: /撕裂/ },
  // 结晶/夜鳞毒的描述只有「每秒受到魔法伤害」，只能靠它们专属的 buffType 值判定
  { id: 'crystal', name: '结晶', group: 'status', category: '持续伤害', buffTypes: ['hero011Star1Add'], desPattern: /结晶/ },
  { id: 'nightscale', name: '夜鳞毒', group: 'status', category: '持续伤害', buffTypes: ['00902SkillBuff'], desPattern: /夜鳞毒/ },
  { id: 'dotHalo', name: '持续伤害光环', group: 'status', category: '持续伤害', buffEffects: ['dotHalo'] },
  // —— 控制 ——
  { id: 'stun', name: '眩晕', group: 'status', category: '控制', buffTypes: ['vertigo', 'mon069Stun', 'mon003StunBuff'], buffEffects: ['vertigo', 'mon069Stun'], buffTags: ['眩晕', '冰冻', '急冻'], desPattern: /眩晕|无法动弹|冻结/ },
  { id: 'root', name: '定身', group: 'status', category: '控制', buffTypes: ['fixed', 'hero043Skill2SpricalBuff'], buffEffects: ['Immobility', 'hero043Skill2SpricalBuff'], desPattern: /定身|无法移动/ },
  { id: 'taunt', name: '嘲讽', group: 'status', category: '控制', buffTypes: ['taunt', 'heroJob1Buff2'], buffEffects: ['taunt', 'heroJob1Buff2'], buffTags: ['嘲讽'], desPattern: /嘲讽|挑衅/ },
  { id: 'confuse', name: '混乱', group: 'status', category: '控制', buffEffects: ['confusion'] },
  // —— 削弱 ——
  { id: 'defDown', name: '防御下降', group: 'status', category: '削弱', attrNegative: ['phyDef', 'magicDef'] },
  // Thick 就是「攻速与移速变化」，减速、粘稠、麻痹等都挂它
  { id: 'weaken', name: '弱化', group: 'status', category: '削弱', buffEffects: ['Thick'], attrNegative: ['runSpeed', 'atkSpeed'] },
  { id: 'vuln', name: '易伤', group: 'status', category: '削弱', buffTypes: ['damageDeep', 'buff_damageDeep02'], buffEffects: ['Reduced_Defence', 'damAddHitAdd'], buffIds: ['buff_damageDeep01', 'buff_damageDeep02', '036Star4MonBuff', 'damAddAndHitAddBuff01'] },
  // —— 护盾与恢复 ——
  { id: 'shield', name: '护盾', group: 'status', category: '护盾恢复', buffTypes: ['shield'], buffEffects: ['Shield', 'maxHpShield', 'PhAtkShield', '051Skill1Buff'], buffTags: ['Shield'] },
  { id: 'hot', name: '持续回复', group: 'status', category: '护盾恢复', buffEffects: ['HOT'] },
  { id: 'healHalo', name: '治愈光环', group: 'status', category: '护盾恢复', buffTypes: ['strengthenGuangHuan'], buffEffects: ['replyHalo'] },
  { id: 'vampire', name: '吸血', group: 'status', category: '护盾恢复', attrPositive: ['vampire'] },
  // —— 属性增益：先按 buffType 的明确语义，再按 attr 签名 ——
  { id: 'critUp', name: '暴击提升', group: 'attribute', category: '属性增益', buffTypes: ['critUp'], attrPositive: ['crit', 'critDam', 'cirtDam'] },
  { id: 'atkSpeedUp', name: '攻速提升', group: 'attribute', category: '属性增益', buffTypes: ['atkSpeedUp'], buffEffects: ['atkSpeedUp'], attrPositive: ['atkSpeed'] },
  { id: 'moveUp', name: '移速提升', group: 'attribute', category: '属性增益', buffTypes: ['moveUp'], buffEffects: ['moveUp'], attrPositive: ['runSpeed', 'runSpeedAdd'] },
  { id: 'magicAtkUp', name: '魔法攻击提升', group: 'attribute', category: '属性增益', attrPositive: ['magicAtk'] },
  { id: 'atkUp', name: '攻击力提升', group: 'attribute', category: '属性增益', buffTypes: ['atkUp', 'attrAdd'], attrPositive: ['phyAtk'] },
  { id: 'defUp', name: '防御提升', group: 'attribute', category: '属性增益', attrPositive: ['phyDef', 'magicDef'] },
  { id: 'hpUp', name: '生命提升', group: 'attribute', category: '属性增益', attrPositive: ['hpMax', 'spMax'] },
  { id: 'resUp', name: '抗性提升', group: 'attribute', category: '属性增益', attrPositive: ['phyRes', 'magicRes', 'waterRes', 'fireRes', 'windRes', 'earthRes'] },
  { id: 'elementUp', name: '元素伤害提升', group: 'attribute', category: '属性增益', attrPositive: ['water', 'fire', 'wind', 'earth'] },
  { id: 'rebDam', name: '反伤', group: 'attribute', category: '属性增益', attrPositive: ['rebDam'] },
  // hitDam 是「受到的伤害」，负值即减伤
  { id: 'damReduce', name: '减伤', group: 'attribute', category: '属性增益', buffTypes: ['damageReduce'], buffEffects: ['beHitDamAdd', 'damAddHitAdd'], attrNegative: ['hitDam'] }
]

/** 取属性加成的有效数值（baseValue 优先，其次 percent），用于判断方向。 */
function attrValue(add) {
  if (!add || typeof add !== 'object') return 0
  const base = Number(add.baseValue || 0)
  return base || Number(add.percent || 0)
}

/** 该 buffEffect 是否是「通用机制」——英雄/宠物/装备专属名不算。 */
function isGenericEffect(effect) {
  const key = String(effect || '')
  if (!key) return false
  return Boolean(BUFF_EFFECT_META[key]) || JOB_BUFF_EFFECT_PATTERN.test(key)
}

/**
 * 一个 buff 命中哪条标准状态。
 *
 * 判定是**信号分层优先**而不是规则优先：先把所有规则的 `buffIds`、`buffTypes` 比完，再比 `buffEffects`、
 * `buffTags`、`elements`、`attr` 方向，最后才是 `desPattern`。
 */
export function matchCanonicalStatus(buff) {
  if (!buff) return null
  const bId = String(buff.buffID || '').trim()
  const type = String(buff.buffType || '').trim()
  const effect = String(buff.buffEffect || '').trim()
  const element = String(buff.para?.damage?.elementType || '').trim()
  const des = String(buff.buffDes || buff.des || '')
  const tags = Array.isArray(buff.buffTags) ? buff.buffTags : []
  const attr = (buff.para && typeof buff.para.attr === 'object' && buff.para.attr) || {}
  const damAddVal = Number(buff.para?.damAddValue ?? 0)
  const hitDamAddRate = Number(buff.para?.hitDamAddRate ?? 0)
  const attrAny = (keys, test) => keys.some(key => {
    const value = attrValue(attr[key])
    return value !== 0 && test(value)
  })
  const matches = {
    buffIds: rule => Boolean(rule.buffIds && bId && rule.buffIds.includes(bId)),
    buffTypes: rule => Boolean(rule.buffTypes && type && rule.buffTypes.includes(type)),
    buffEffects: rule => Boolean(
      rule.buffEffects && effect && rule.buffEffects.includes(effect) &&
      (effect !== 'beHitDamAdd' || (rule.id === 'damReduce' ? damAddVal < 0 : damAddVal > 0)) &&
      (effect !== 'damAddHitAdd' || (rule.id === 'damReduce' ? hitDamAddRate < 0 : hitDamAddRate > 0))
    ),
    buffTags: rule => Boolean(rule.buffTags && rule.buffTags.some(t => tags.includes(t))),
    elements: rule => effect === 'DOT' && Boolean(rule.elements && element && rule.elements.includes(element)),
    attrPositive: rule => Boolean(rule.attrPositive && attrAny(rule.attrPositive, value => value > 0)),
    attrNegative: rule => Boolean(rule.attrNegative && attrAny(rule.attrNegative, value => value < 0)),
    desPattern: rule => isGenericEffect(effect) && Boolean(rule.desPattern && des && rule.desPattern.test(des))
  }

  for (const signal of ['buffIds', 'buffTypes', 'buffEffects', 'buffTags', 'elements', 'attrPositive', 'attrNegative', 'desPattern']) {
    const hit = STATUS_RULES.find(rule => matches[signal](rule))
    if (hit) return hit
  }
  // 不再给「持续伤害」兜底：细分不出来的 DOT 都是英雄/魔物专属技能造成的，
  // 归到通用「持续伤害」会让玩家查不到它的真名（如 hero043「利息」）。
  // 它们会落到「技能专属」，用自己的名字展示。
  return null
}

/** 兼容别名。 */
export const CANONICAL_STATUSES = STATUS_RULES

/**
 * 料理类 buff：`buffType === 'cook'`（38 条）。
 * 用数据字段而不是名字前缀判定——「属性附加」「炒鲜姑」这些并不叫「料理：xxx」，
 * 但都是吃料理产生的临时增益，按用户决定不进词条库（`/recipes` 已按菜谱展示效果）。
 */
export function isCookBuff(buff) {
  if (String(buff?.buffType || '').trim() === 'cook') return true
  return /^料理：/.test(String(buff?.buffName || '').trim())
}

/** 纯内部代号名（不进任何分组）。 */
export function isInternalBuffName(name) {
  const text = String(name || '').trim()
  if (!text) return true
  return /^[a-z0-9_\-[\]]+$/i.test(text)
    || /buff$/i.test(text)
    || /^第[一二三四五六七八九十\d]+章/.test(text)
    || /测试/.test(text)
    || /白板/.test(text)
}

/** 怪物异变（精英/首领专属）。 */
export function isEliteBuffName(name) {
  return /^异变：/.test(String(name || '').trim())
}

// ---------- 纯内部 / 表现层键（不展示给玩家） ----------
// 依据：这些键只驱动特效、动画、子弹与内部判定，不构成玩家可读数值。
export const INTERNAL_PARA_KEYS = new Set([
  'animName', 'bulletId', 'groundBulletId', 'spEffectId', 'addEffectId', 'addEffectId1', 'addEffectId2',
  'hitEffectIdList', 'followEffectId', 'breakEffectId', 'breakEffectAddId', 'addEftId', 'skill2AddEftId',
  'groundEftId', 'hitGroundEftId', 'hitTopEftId', 'fallingStarEftId', 'shake', 'race', 'checkElement',
  'damageFromSkill', 'targetSkillId', 'skillId', 'aiId', 'targetTypeId', 'checkJob', 'baseType',
  'constant', 'newSkillAnim', 'fallingStarOffestX', 'fallingStarHeight', 'angle', 'buffId',
  'overLayEftId', 'overLayEftDic', 'buffChangeTypes', 'hitEffectId', 'projId', 'view'
])

// 这 6 个 buffEffect 在 `BuffControl.cs:352-713` 的 switch 里**没有分支**，
// 创建时直接 `return null`（只打日志），即配置存在但游戏里根本不生效。
// 词条页不展示，避免把无效配置当成玩家可见状态。
export const BROKEN_BUFF_EFFECTS = new Set([
  'enchant_1001_1', 'enchant_2001_1', '强化普攻', '力量药剂（小）', 'miTuoLaPassive', 'tempValue'
])

// ---------- 精选通用 buff ----------
// 面向玩家的分类标签；角色/魔物专属标记（如「小鹿被动」「weapon」）不算通用分类。
export const COMMON_BUFF_TAGS = new Set([
  '增益', '减益', '强化', '控制', '眩晕', '嘲讽', '流血', '燃烧', 'Shield',
  '恢复', '冰冻', '急冻', '撕裂', '夜鳞毒'
])
// 纯 ASCII 的名字多是内部代号（如 jidongBuff），不作为玩家词条。
const INTERNAL_NAME_PATTERN = /^[a-z0-9_\-[\]]+$/i

// ---------- 数值格式化 ----------
const round = (value, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** 去尾零，避免 0.50 这种显示。 */
const trim = (value) => String(value).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')

export function formatNumber(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return trim(round(num, digits))
}

/** 已是百分数的值 → `38%`。 */
export function formatPercentValue(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return `${formatNumber(num, digits)}%`
}

/** 比例小数 → `38%`（源码 GetPercent 语义）。 */
export function formatRatio(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  return `${formatNumber(num * 100, digits)}%`
}

/** 带符号：正数补 `+`，负数为 `-`。 */
function signed(text) {
  if (!text) return text
  return /^-/.test(text) ? text : `+${text}`
}

function formatByUnit(value, unit) {
  if (unit === 'ratio') return formatRatio(value)
  if (unit === 'pct') return formatPercentValue(value)
  return formatNumber(value)
}

export const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** 数值是否为「有效且非零」——零值加成本身没有信息量，不占行。 */
const isMeaningful = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num !== 0
}

// ---------- 各 para 分区的渲染 ----------

/**
 * 「值即百分数」字段里漏乘 100 的配置笔误归一化。**不改写原表**，只在渲染时换算。
 *
 * 已确证的笔误（判定依据 = 该字段的整体取值分布 + buffDes 原文自证）：
 * - `attr.restoreHp.percent` / `attr.restoreSp.percent`：正常值 2~8，7 条写成 0.02~0.1，
 *   且这些 buff 的 buffDes 写着「提升队伍 5% 生命恢复力」（`cook_30018` 等），全部落在 cook_/paTa 系列。
 * - 顶层 `atkSpeed`：正常值都是整数（15~35、-9~-15），只有 3 条写成 -0.1 / -0.2，
 *   且这 3 条的 `runSpeed` 恰好是同一个 -0.1 / -0.2（`hero066TalentAddBuff`「冰爆」、
 *   `hero064Star4SpeedDownBuff`「冰狱爆发」），说明是把比例值误填进了百分数字段。
 *   `Buff_Thick.cs:20` 与 `UnitDataShowPanel.cs:182`（`AtkSpeedAdd + "%"`）确认该字段是百分数。
 */
const PERCENT_TYPO_KEYS = new Set(['restoreHp', 'restoreSp', 'atkSpeed'])
const normalizePercentTypo = (key, value) => {
  const num = Number(value)
  if (!PERCENT_TYPO_KEYS.has(key)) return value
  return Math.abs(num) > 0 && Math.abs(num) < 1 ? num * 100 : value
}

/** `attr.<属性>.{baseValue,percent}` → 属性加成行。 */
function describeAttr(attr) {
  if (!isPlainObject(attr)) return []
  const rows = []
  for (const [stat, add] of Object.entries(attr)) {
    if (!isPlainObject(add)) continue
    const meta = ATTR_STAT_META[stat]
    // 未知属性保留代号并标注「单位未确证」，不猜单位也不静默丢弃。
    const label = meta?.name || stat
    const baseUnit = meta ? meta.base : null
    const percentUnit = meta ? meta.percent : null
    if (isMeaningful(add.baseValue) && baseUnit !== null) {
      rows.push({ label, value: signed(formatByUnit(add.baseValue, baseUnit)) })
    }
    if (isMeaningful(add.percent) && percentUnit !== null) {
      const suffix = baseUnit === 'flat' && percentUnit === 'ratio' ? '（按比例）' : ''
      const value = normalizePercentTypo(stat, add.percent)
      // 名称本身已经带「加成/提升」的不再叠一层：`runSpeed` 的官方名就叫「移速加成」，
      // 直接拼会渲染成「移速加成加成」。（其余后缀如「生命恢复」仍要拼成「生命恢复加成」。）
      const percentLabel = /(加成|提升)$/.test(label) ? label : `${label}加成`
      rows.push({ label: `${percentLabel}${suffix}`, value: signed(formatByUnit(value, percentUnit)) })
    }
  }
  return rows
}

/** `damage.*` → 伤害行。 */
function describeDamage(damage) {
  if (!isPlainObject(damage)) return []
  const rows = []
  const typeLabel = DAMAGE_TYPE_LABELS[damage.muAddType] || DAMAGE_TYPE_LABELS[damage.damageType] || ''
  const element = ELEMENT_LABELS[damage.elementType]
  const prefix = [element ? `${element}属性` : '', typeLabel].filter(Boolean).join('')
  if (isMeaningful(damage.muPower)) {
    rows.push({ label: '伤害倍率', value: `${formatRatio(damage.muPower)}${prefix ? ` ${prefix}` : ''}` })
  }
  if (isMeaningful(damage.baseDamage)) {
    rows.push({ label: '固定伤害', value: formatNumber(damage.baseDamage) })
  }
  if (isMeaningful(damage.repelForce)) {
    rows.push({ label: '击退力度', value: formatNumber(damage.repelForce) })
  }
  if (isMeaningful(damage.repelTime)) {
    rows.push({ label: '击退时长', value: `${formatNumber(damage.repelTime)} 秒` })
  }
  if (isMeaningful(damage.repelDis)) {
    rows.push({ label: '击退距离', value: `${formatNumber(damage.repelDis)} 格` })
  }
  return rows
}

/** `rectRange` / `radius` / `range` → 范围行。 */
function describeRange(para) {
  const rows = []
  const rect = para.rectRange
  if (isPlainObject(rect)) {
    const w = Number(rect.width)
    const h = Number(rect.lenth ?? rect.length)
    if (Number.isFinite(w) && Number.isFinite(h)) {
      rows.push({ label: '作用范围', value: `矩形 ${formatNumber(w)} × ${formatNumber(h)} 格` })
    }
  }
  const radius = Number(para.radius)
  if (isMeaningful(radius)) rows.push({ label: '作用半径', value: `${formatNumber(radius)} 格` })
  const range = Number(para.range ?? para.newRange)
  if (isMeaningful(range)) rows.push({ label: '作用距离', value: `${formatNumber(range)} 格` })
  const checkRange = Number(para.checkRange ?? para.atkCheckRange)
  if (isMeaningful(checkRange)) rows.push({ label: '判定距离', value: `${formatNumber(checkRange)} 格` })
  return rows
}

/** 回复类：`replyType`/`muPower`/`baseReplyValue`/`hotType`/`hotBase`。 */
function describeRecovery(para) {
  const rows = []
  const isReply = para.replyType === 'hp' || para.replyType === 'sp'
  const resource = para.replyType === 'sp' ? '法力' : '生命'
  if (isReply) {
    if (isMeaningful(para.muPower)) rows.push({ label: `回复量（按最大${resource}比例）`, value: formatRatio(para.muPower) })
    if (isMeaningful(para.baseReplyValue)) rows.push({ label: `固定回复${resource}`, value: formatNumber(para.baseReplyValue) })
  }
  if (para.hotType) {
    const hotLabel = para.hotType === 'hp' ? '生命' : para.hotType === 'sp' ? '法力' : DAMAGE_TYPE_LABELS[para.hotType] || para.hotType
    if (isMeaningful(para.hotBase)) rows.push({ label: `每次回复${hotLabel}`, value: formatNumber(para.hotBase) })
  }
  if (isMeaningful(para.replyRate)) rows.push({ label: '回复比例', value: formatRatio(para.replyRate) })
  return rows
}

/**
 * 护盾类。`shieldValue` 的单位随 `buffEffect` 变化，必须分支：
 * - `Shield`（`Buff_Shield.cs:17`）→ 固定护盾点数
 * - `PhAtkShield`（`Buff_Xier_LevelStar1_Shield.cs:30-40`）→ `shieldValue × baseType 属性` 的比例，另有 `baseShieldValue` 固定加成
 */
function describeShield(para, buff) {
  const rows = []
  const effect = String(buff?.buffEffect || '')
  const isRatioShield = effect === 'PhAtkShield'
  if (isMeaningful(para.shieldValue)) {
    if (isRatioShield) {
      const base = DAMAGE_TYPE_LABELS[para.baseType] || para.baseType || '攻击力'
      rows.push({ label: `护盾（按${base}比例）`, value: formatRatio(para.shieldValue) })
    } else {
      rows.push({ label: '护盾值', value: formatNumber(para.shieldValue) })
    }
  }
  if (isMeaningful(para.baseShieldValue)) rows.push({ label: '固定护盾加成', value: formatNumber(para.baseShieldValue) })
  // Buff_hero051Skill1.cs:48 → shieldValueRate 是魔法攻击的比例
  if (isMeaningful(para.shieldValueRate)) rows.push({ label: '护盾（按魔法攻击比例）', value: formatRatio(para.shieldValueRate) })
  // Pet07502SkillBuff.cs:38 → shieldHpValueRate 是最大生命的比例
  if (isMeaningful(para.shieldHpValueRate)) rows.push({ label: '护盾（按最大生命比例）', value: formatRatio(para.shieldHpValueRate) })
  return rows
}

/**
 * 顶层属性类键（与 `para.attr` 同级书写）。
 * 单位与 ATTR_STAT_META 一致：`atkSpeed` 已是百分数（`Buff_Thick.cs:20`），`runSpeed` 是比例（`Buff_Thick.cs:21`）。
 */
const TOP_LEVEL_ATTR_KEYS = [
  ['atkSpeed', '攻速加成', 'pct'],
  ['runSpeed', '移速加成', 'ratio'],
  ['runSpeedAdd', '移速加成', 'ratio'],
  ['critAdd', '暴击率提升', 'pct'],
  ['critDamAdd', '暴击伤害提升', 'pct'],
  ['cureAddValue', '受治疗加成', 'pct'],
  ['atk', '攻击力', 'ratio']
]

function describeTopLevelAttrs(para) {
  const rows = []
  for (const [key, label, unit] of TOP_LEVEL_ATTR_KEYS) {
    if (!(key in para) || !isMeaningful(para[key])) continue
    const value = normalizePercentTypo(key, para[key])
    rows.push({ label, value: signed(formatByUnit(value, unit)) })
  }
  return rows
}

// 增减伤 / 概率类标量键 → 中文名 + 单位
// （属性类键走 describeTopLevelAttrs / describeAttr，不在此重复）
const RATE_KEYS = [
  ['damAddRate', '伤害提升', 'ratio'],
  ['skillDamAddRate', '技能伤害提升', 'ratio'],
  ['skill1DamAddRate', '一技能伤害提升', 'ratio'],
  ['skill2DamAddRate', '二技能伤害提升', 'ratio'],
  ['skill_1DamAddRate', '技能伤害提升', 'ratio'],
  ['damAddValue', '伤害提升', 'ratio'],
  ['damRate', '伤害倍率', 'ratio'],
  ['damReplyRate', '反伤比例', 'ratio'],
  ['buffDamAddRate', '持续伤害提升', 'ratio'],
  ['hitDamAddRate', '受到伤害变化', 'ratio'],
  ['reduceDamRate', '受到伤害降低', 'ratio'],
  ['hitReduceRate', '受到伤害降低', 'ratio'],
  ['posionReduceRate', '中毒伤害降低', 'ratio'],
  ['damHpRate', '按生命值造成伤害', 'ratio'],
  ['hpRate', '生命值比例', 'ratio'],
  ['hpAddRate', '生命提升', 'ratio'],
  ['maxHpRate', '最大生命提升', 'ratio'],
  ['atkAddRate', '攻击提升', 'ratio'],
  ['phyAtkRate', '物理攻击提升', 'ratio'],
  ['magicAtkAddRate', '魔法攻击提升', 'ratio'],
  ['waterDamAdd', '水属性伤害提升', 'ratio'],
  ['limitRate', '触发上限', 'number'],
  ['rate', '触发概率', 'ratio'],
  ['damReduce', '受到伤害降低', 'ratio'],
  ['cdRate', '冷却变化', 'ratio'],
  ['cdDown', '冷却缩减', 'number'],
  ['skillMuPower', '技能伤害倍率', 'ratio']
]

function describeRates(para) {
  const rows = []
  for (const [key, label, unit] of RATE_KEYS) {
    if (!(key in para)) continue
    if (!isMeaningful(para[key])) continue
    rows.push({ label, value: signed(formatByUnit(para[key], unit)) })
  }
  return rows
}

/** 时间 / 层数 / 次数 / 触发判定。 */
function describeTiming(para) {
  const rows = []
  if (isMeaningful(para.spTime)) rows.push({ label: '生效间隔', value: `${formatNumber(para.spTime)} 秒` })
  if (isMeaningful(para.cd)) rows.push({ label: '触发冷却', value: `${formatNumber(para.cd)} 秒` })
  if (isMeaningful(para.time)) rows.push({ label: '持续/间隔', value: `${formatNumber(para.time)} 秒` })
  if (isMeaningful(para.buffTimeAdd)) rows.push({ label: '持续时间延长', value: `${formatNumber(para.buffTimeAdd)} 秒` })
  if (isMeaningful(para.addBuffTime)) rows.push({ label: '附加状态持续', value: `${formatNumber(para.addBuffTime)} 秒` })
  if (isMeaningful(para.checkCdTime)) rows.push({ label: '判定冷却', value: `${formatNumber(para.checkCdTime)} 秒` })
  if (isMeaningful(para.atkCdTime)) rows.push({ label: '攻击冷却', value: `${formatNumber(para.atkCdTime)} 秒` })
  if (isMeaningful(para.skillCdTime)) rows.push({ label: '技能冷却', value: `${formatNumber(para.skillCdTime)} 秒` })
  if (isMeaningful(para.fallTime)) rows.push({ label: '下落时间', value: `${formatNumber(para.fallTime)} 秒` })
  if (isMeaningful(para.maxLayPara)) rows.push({ label: '最大叠层', value: `${formatNumber(para.maxLayPara)} 层` })
  if (isMeaningful(para.startLayNum)) rows.push({ label: '初始层数', value: `${formatNumber(para.startLayNum)} 层` })
  if (isMeaningful(para.elementAddLayer)) rows.push({ label: '每次附加层数', value: `${formatNumber(para.elementAddLayer)} 层` })
  if (isMeaningful(para.checkAddLayerNum)) rows.push({ label: '判定所需层数', value: `${formatNumber(para.checkAddLayerNum)} 层` })
  if (isMeaningful(para.atkUseLayerNum)) rows.push({ label: '每次消耗层数', value: `${formatNumber(para.atkUseLayerNum)} 层` })
  if (isMeaningful(para.atkCount)) rows.push({ label: '触发所需攻击次数', value: `${formatNumber(para.atkCount)} 次` })
  if (isMeaningful(para.cnt)) rows.push({ label: '数量', value: `${formatNumber(para.cnt)} 个` })
  if (isMeaningful(para.checkNum)) rows.push({ label: '判定次数', value: `${formatNumber(para.checkNum)} 次` })
  if (isMeaningful(para.checkHpRate)) rows.push({ label: '生命值判定阈值', value: formatRatio(para.checkHpRate) })
  return rows
}

/** 范围类行里 `width`/`height` 这类独立键。 */
function describeExtraShape(para) {
  const rows = []
  if (isMeaningful(para.width) && isMeaningful(para.height)) {
    rows.push({ label: '作用范围', value: `矩形 ${formatNumber(para.width)} × ${formatNumber(para.height)} 格` })
  }
  if (isMeaningful(para.randomHitRange)) rows.push({ label: '随机命中范围', value: `${formatNumber(para.randomHitRange)} 格` })
  return rows
}

// 嵌套容器：标题 + 递归渲染
const NESTED_CONTAINERS = [
  ['addNewBuff', '触发后获得'],
  ['summonAddNewBuff', '召唤物获得'],
  ['speedAddNewBuff', '移速变化时获得'],
  ['lightAtkConf', '闪电攻击'],
  ['actionPara', '追加动作']
]

/** 关联 buff：`addBuffId`/`addBuff`/`buffs`/`shieldBuffId` 等。 */
function describeLinkedBuffs(para, buffData, seen) {
  const links = []
  const push = (id, note) => {
    const key = String(id ?? '').trim()
    if (!key) return
    const data = buffData[key]
    links.push({
      id: key,
      name: data?.buffName || data?.name || key,
      note,
      known: Boolean(data)
    })
  }
  const single = ['addBuffId', 'addBuff', 'addBaseBuffId', 'baseBuffId', 'atkAddBuffId', 'shieldBuffId']
  for (const key of single) if (para[key]) push(para[key], '')
  if (Array.isArray(para.addBuff)) for (const id of para.addBuff) push(id, '')
  if (Array.isArray(para.buffs)) for (const id of para.buffs) push(id, '')
  if (Array.isArray(para.addNewBuffList)) {
    for (const entry of para.addNewBuffList) {
      if (isPlainObject(entry)) push(entry.newBuffBaseId, '')
    }
  }
  // 去重
  const unique = []
  const seenIds = new Set()
  for (const link of links) {
    if (seenIds.has(link.id)) continue
    seenIds.add(link.id)
    unique.push(link)
  }
  return unique
}

/** 递归渲染一个 buff 的 para（含嵌套 buff）。 */
export function describeBuffPara(buff, options = {}) {
  const { buffData = {}, depth = 0, seen = new Set() } = options
  const para = isPlainObject(buff?.para) ? buff.para : {}
  const groups = []
  const add = (title, rows) => {
    const clean = rows.filter(row => row && row.value !== '' && row.value != null)
    if (clean.length) groups.push({ title, items: clean })
  }

  add('属性加成', [...describeAttr(para.attr), ...describeTopLevelAttrs(para)])
  add('伤害', describeDamage(para.damage))
  if (para.damage2) add('第二段伤害', describeDamage(para.damage2))
  add('护盾', describeShield(para, buff))
  add('回复', describeRecovery(para))
  add('增减益', describeRates(para))
  add('范围', [...describeRange(para), ...describeExtraShape(para)])
  add('时间与层数', describeTiming(para))

  // 顶层 muPower/muAddType（不挂在 damage 下的写法）
  if (isMeaningful(para.muPower) && !para.damage && !para.replyType) {
    const typeLabel = DAMAGE_TYPE_LABELS[para.muAddType] || ''
    add('伤害', [{ label: '伤害倍率', value: `${formatRatio(para.muPower)}${typeLabel ? ` ${typeLabel}` : ''}` }])
  }

  // 嵌套容器：深度上限防止配置自引用把构建挂死
  const nested = []
  if (depth < 3) {
    for (const [key, title] of NESTED_CONTAINERS) {
      const child = para[key]
      if (!isPlainObject(child)) continue
      const inner = describeBuffPara({ para: child }, { buffData, depth: depth + 1, seen })
      if (inner.groups.length) nested.push({ title, groups: inner.groups })
    }
    // addNewBuff 既可能是单对象，也可能是数组
    const addNew = para.addNewBuff
    if (isPlainObject(addNew)) {
      const id = addNew.newBuffBaseId
      const base = buffData[id]
      const label = base?.buffName || base?.name || id
      const inner = describeBuffPara({ para: addNew.newBuffPara || {} }, { buffData, depth: depth + 1, seen })
      const rows = []
      if (isMeaningful(addNew.newBuffTime)) rows.push({ label: '持续时间', value: `${formatNumber(addNew.newBuffTime)} 秒` })
      if (addNew.newBuffDes) rows.push({ label: '说明', value: String(addNew.newBuffDes) })
      if (rows.length) inner.groups.unshift({ title: '附加状态', items: rows })
      if (inner.groups.length) nested.push({ title: label ? `触发后获得「${label}」` : title, groups: inner.groups })
    }
  }

  return { groups, nested, linked: describeLinkedBuffs(para, buffData, seen) }
}

/**
 * 一个 buff 的完整可读描述：状态信息（持续时间/叠层/触发方式）+ para 数值 + 关联状态。
 * 角色图鉴与怪物图鉴直接消费本函数，不再各自解析 `para`。
 */
export function describeBuff(buff, options = {}) {
  const { buffData = {} } = options
  const para = isPlainObject(buff?.para) ? buff.para : {}
  const status = []
  const duration = Number(buff?.buffTime || 0)
  if (duration > 0) status.push({ label: '持续时间', value: `${formatNumber(duration)} 秒` })
  const maxStacks = Number(para.maxLayPara || 0)
  if (buff?.canOverlay) {
    status.push({ label: '可叠加', value: maxStacks > 0 ? `最多 ${formatNumber(maxStacks)} 层` : '是' })
  }
  const startLay = Number(para.startLayNum || 0)
  if (startLay > 0) status.push({ label: '初始层数', value: `${formatNumber(startLay)} 层` })
  const detectLabel = DETECT_TYPE_LABELS[para.detectType] || ''
  if (detectLabel) status.push({ label: '生效时机', value: detectLabel })
  const checkType = String(para.checkType || '')
  if (checkType && isMeaningful(para.checkNum)) {
    const every = checkType === 'checkSp' ? `${formatNumber(para.checkNum)} 秒`
      : checkType === 'checkAtkNum' ? `${formatNumber(para.checkNum)} 次普通攻击`
        : checkType === 'checkHit' ? `受到 ${formatNumber(para.checkNum)} 次攻击`
          : `${formatNumber(para.checkNum)} 次`
    status.push({ label: '触发条件', value: `每 ${every}` })
  }
  const described = describeBuffPara(buff, options)
  return { status, ...described }
}

// ---------- 精选通用 buff ----------
/**
 * 是否属于「通用 buff」：显示开关 + 面向玩家的分类标签 + 名字可读（排除内部代号）。
 * 词条库额外要求 `buffIcon`（用户选定的收录口径：有图标的通用 buff），
 * 角色/怪物图鉴回填不受图标限制，传 `requireIcon: false`。
 */
export function isCommonBuff(buff, options = {}) {
  const { requireIcon = true } = options
  if (!buff || buff.show === false) return false
  if (BROKEN_BUFF_EFFECTS.has(String(buff.buffEffect || ''))) return false
  if (requireIcon && !buff.buffIcon) return false
  const name = String(buff.buffName || '').trim()
  if (!name || INTERNAL_NAME_PATTERN.test(name)) return false
  if (!(buff.buffTags || []).some(tag => COMMON_BUFF_TAGS.has(tag))) return false
  return true
}

/** buff 图标相对路径（图集 CombatPanel_Atlas 的 28×28 sprite）。 */
export function resolveBuffIcon(icon) {
  const key = String(icon || '').trim()
  if (!key) return ''
  return `/images/CombatPanel_Atlas/${key}.webp`
}

/** 把一个 buff 摊成词条内的一个数值版本。`sources` 来自构建期的来源索引。 */
function describeVariant(buff, buffData, sourceIndex, levelIndex) {
  const effect = resolveBuffEffect(buff.buffEffect)
  const values = describeBuff(buff, { buffData })
  // 「有效果载荷」只算真正改变战斗的数值分组；`status` 里的持续时间/生效时机只是时序元数据，
  // 不能因为有「持续 6 秒」就认为这条状态有效果。
  const hasPayload = Boolean(values.groups.length || values.nested.length)
  const sources = sourceIndex?.get(String(buff.buffID || '')) || []
  // 技能等级：有了它，胶囊就只需要写「Lv.12」，来源与技能名在「施加来源」区写一次即可
  const levelInfo = levelIndex?.infoOf(buff.buffID) || null
  return {
    id: String(buff.buffID || ''),
    sourceName: String(buff.buffName || '').trim(),
    sources,
    skillId: levelInfo?.skillId || '',
    skillName: levelInfo?.skillName || '',
    skillLevel: levelInfo?.level || 0,
    icon: resolveBuffIcon(buff.buffIcon),
    tags: buff.buffTags || [],
    effect: String(buff.buffEffect || ''),
    mechanism: effect?.name || '',
    category: effect?.category || '',
    des: String(buff.buffDes || buff.des || '').replace(/\{|\}|（|）|\(|\)/g, ''),
    duration: Number(buff.buffTime || 0),
    stackable: Boolean(buff.canOverlay),
    maxStacks: Number(buff.para?.maxLayPara || 0),
    detectType: String(buff.para?.detectType || ''),
    // 配置里有没有真正改变战斗的数值分组。`emptyPayload` 由它和 `sources` 推导
    // （见 toEntry）—— 因为去重合并时会追加来源，不能在这里就把结论算死。
    hasPayload,
    values
  }
}

/** 由一组 buff 组装词条（取首个变体作为卡片代表）。 */
function toEntry({ name, group, category, variants, buffData, sourceIndex, levelIndex }) {
  const all = variants.map(buff => describeVariant(buff, buffData, sourceIndex, levelIndex))
  // 先判「等级型词条」：它同时决定去重口径与标签写法，必须在去重前定下来。
  // 整条词条的版本都来自同一技能的各个等级时，胶囊只写 `Lv.N`，等级就是变体的身份。
  // 还要**等级两两不同**：几个技能各自的一级会并出一条「定身」全是 Lv.1 的胶囊，
  // 那时候等级区分不了任何东西，必须退回「来源 · 区分数值」写法。
  const levelBased = all.length > 1
    && all.every(variant => variant.skillLevel > 0)
    && new Set(all.map(variant => variant.skillLevel)).size === all.length
  // 按「渲染结果」去重：数值完全相同的变体只留一个代表。
  // 标准状态会吸收大量同类 buff（护盾类 30+ 条），不去重的话弹窗里会挤满切换胶囊。
  // 去重时合并来源，这样切换胶囊仍能显示出处（如「结晶」的 4 份数值各来自不同角色）。
  const seen = new Map()
  for (const variant of all) {
    const signature = JSON.stringify([
      variant.duration, variant.stackable, variant.maxStacks,
      // 等级型词条要把等级算进身份：不同等级即使渲染出的数值一样，也不该并成同一颗胶囊
      // （胶囊上写的是 Lv.N，并错了就会显示成另一个等级）。非等级型不能带上它，
      // 否则本来该合并的重复版本会被拆成两颗标签完全相同的胶囊（中毒曾从 8 个变 11 个）。
      ...(levelBased ? [variant.skillId, variant.skillLevel] : []),
      variant.values.status, variant.values.groups, variant.values.nested, variant.values.linked
    ])
    if (seen.has(signature)) {
      const kept = seen.get(signature)
      kept.duplicateCount += 1
      for (const source of variant.sources) {
        if (!kept.sources.some(entry => entry.kind === source.kind && entry.name === source.name)) kept.sources.push(source)
      }
      continue
    }
    seen.set(signature, { ...variant, sources: [...variant.sources], duplicateCount: 1 })
  }
  const described = [...seen.values()]
  // 「配置里没写效果」= 没有数值载荷 **且** 查不到施加它的技能或物品。
  // 必须在合并来源之后才算：去重会把同数值的其它来源并进来，若在 describeVariant 里算死，
  // 就会出现「sources 有 2 个、emptyPayload 还是 true」的自相矛盾（眩晕 034_battleItem002）。
  for (const variant of described) {
    Object.defineProperty(variant, 'emptyPayload', {
      value: !variant.hasPayload && variant.sources.length === 0,
      enumerable: true,
      writable: true,
      configurable: true
    })
  }

  // 技能型变体把「技能」也作为一条来源：施加来源区写一次「角色：菲莉娜 / 技能：穿甲箭头」，
  // 就不用每个胶囊都重复一遍角色名。**只在等级型词条上这么做**——混了别的来源的词条
  // （如「攻速提升」里既有技能各级、又有装备与怪物 buff）把技能名并进来源会变成「拉碧丝、森精曼舞」这种怪标签。
  if (levelBased) {
    for (const variant of described) {
      if (variant.skillName && !variant.sources.some(source => source.kind === '技能' && source.name === variant.skillName)) {
        variant.sources.push({ kind: '技能', name: variant.skillName })
      }
    }
    // 胶囊按等级升序排列：底层顺序来自 buff 表主键顺序，直接展示会出现 Lv.3 / Lv.5 / Lv.9 / Lv.10 / Lv.4 这种乱序
    described.sort((a, b) => a.skillLevel - b.skillLevel)
  }
  const primary = described[0]
  // 图标取第一个有图标的变体：标准状态从全量池构建，首个变体可能没有图标
  const iconSource = described.find(variant => variant.icon) || primary

  // ---- 版本标签 ----
  // 非技能等级型：`来源 · 区分数值`。只显示时长会出现「结晶(5s)」重复四次；
  // 只显示来源会出现「缇莎」重复四次（同一角色的星阶技能各级共用同一 buff 名，只有数值不同）。
  // 因此优先挑出**各版本之间不一致的那条数值**作为区分项。
  const valueStrings = variant => variant.values.groups.flatMap(group =>
    group.items.map(item => `${item.label} ${item.value}`))
  const shared = (() => {
    if (described.length < 2) return new Set()
    const counts = new Map()
    for (const variant of described) {
      for (const text of new Set(valueStrings(variant))) counts.set(text, (counts.get(text) || 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n === described.length).map(([text]) => text))
  })()
  for (const variant of described) {
    const differing = valueStrings(variant).find(text => !shared.has(text))
    const names = variant.sources.map(source => source.name)
    // 来源可能有很多（中毒有 13 个怪），只留前两个再加计数
    const sourceText = names.length === 0
      ? variant.sourceName
      : names.length <= 2 ? names.join('、') : `${names[0]} 等 ${names.length} 个`
    variant.sourceText = sourceText
    variant.label = levelBased
      ? `Lv.${variant.skillLevel}`
      : [sourceText, differing].filter(Boolean).join(' · ')
        || `${variant.sourceName}${variant.duration ? `（${variant.duration} 秒）` : ''}`
  }

  // 标签可能撞车：两条变体的数值完全一样，只有持续时间/生效时机不同（如「易伤」的「大巧不工」
  // 一份 5 秒一份 10 秒）。去重签名认得出它们是两条，但标签会写成一模一样，胶囊就白摆了两颗。
  // 撞车时把「区分它们的那部分状态信息」补进标签。
  const labelCount = new Map()
  for (const variant of described) labelCount.set(variant.label, (labelCount.get(variant.label) || 0) + 1)
  if ([...labelCount.values()].some(count => count > 1)) {
    const used = new Set()
    for (const variant of described) {
      if (labelCount.get(variant.label) === 1) { used.add(variant.label); continue }
      const timing = variant.values.status.map(row => row.value).join(' / ')
      const candidates = [
        timing ? `${variant.label} · ${timing}` : '',
        variant.id ? `${variant.label} · ${variant.id}` : ''
      ].filter(Boolean)
      variant.label = candidates.find(candidate => !used.has(candidate)) || `${variant.label} · ${variant.id}`
      used.add(variant.label)
    }
  }

  return {
    name,
    group,
    category,
    icon: iconSource.icon,
    tags: [...new Set(all.flatMap(variant => variant.tags))],
    mechanisms: [...new Set(all.map(variant => variant.mechanism).filter(Boolean))],
    des: primary.des,
    // 该词条一共吸收了多少条 buff（去重前），以及吸收过哪些原 buff 名
    buffCount: all.length,
    sourceNames: [...new Set(all.map(variant => variant.sourceName).filter(Boolean))],
    // 技能等级型词条：详情里把「施加来源」排在「数值版本」前面（先交代是谁的哪个技能，再选等级）
    levelBased,
    skillName: levelBased ? primary.skillName : '',
    variants: described
  }
}

/**
 * 把 buff 表按名称归并成词条（同名变体合并为一条）。
 * 归并而不是逐条罗列，是因为 1649 条里有大量同名重复（「沙炎舞步」重复 43 次）。
 */
export function buildBuffEntries(buffData, options = {}) {
  const { onlyCommon = true, sourceIndex = null, levelIndex = null } = options
  const byName = new Map()
  for (const buff of Object.values(buffData || {})) {
    if (!isPlainObject(buff)) continue
    if (onlyCommon && !isCommonBuff(buff)) continue
    if (!isReachableSkillLevel(buff, levelIndex)) continue
    const name = String(buff.buffName || '').trim()
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(buff)
  }
  return [...byName.entries()]
    .map(([name, variants]) => toEntry({ name, group: '', category: '', variants, buffData, sourceIndex, levelIndex }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

/**
 * 游戏内可达的等级才进词条库。
 *
 * `skill.json` 给主动技能配了 21 级，但升级表 `heroSkillUpgrade.json` 每个稀有度只有 12 行，
 * 源码拿行数当上限（`HeroSkillUI.cs:245`）——Lv.13–21 客户端升不到，收录进来只会让
 * 「穿甲箭」平白多出 9 个玩家查不到的版本。判定依据与上限来源见 `utils/skillLevelIndex.js`。
 */
export function isReachableSkillLevel(buff, levelIndex) {
  if (!levelIndex) return true
  return levelIndex.isReachable(buff?.buffID)
}

/**
 * 生成分组词条库（词条页的主产物）。
 *
 * 分两个池子，这是关键：
 * - **标准状态从全量池找**：否则会漏掉「吸血」这类有状态语义、但没通过「有图标 + 有标签」精选的 buff。
 * - **其余分组只用精选池**：否则 300 多条「XX 升星1」「XX 天赋被动」会全涌进「技能专属」。
 *
 * 全量池还先滤掉「游戏内升不到的技能等级」，断言每条标准状态至少命中一条 buff，
 * 避免清单与数据脱节后静默变成空词条。
 */
export function buildGlossaryEntries(buffData, options = {}) {
  const { sourceIndex = null, levelIndex = null } = options
  const all = Object.values(buffData || {}).filter(isPlainObject)
  const nameOf = buff => String(buff.buffName || '').trim()
  const fullPool = all.filter(buff =>
    buff.show !== false
    && !BROKEN_BUFF_EFFECTS.has(String(buff.buffEffect || ''))
    && isReachableSkillLevel(buff, levelIndex)
    && nameOf(buff))
  const featuredPool = fullPool.filter(buff => isCommonBuff(buff, { requireIcon: true }))

  const canonicalBuckets = new Map(CANONICAL_STATUSES.map(status => [status.name, []]))
  const eliteByName = new Map()
  const skillByName = new Map()
  const claimed = new Set()

  // —— 第一遍：标准状态（全量池，按数据字段判定）——
  for (const buff of fullPool) {
    const name = nameOf(buff)
    if (isCookBuff(buff) || isInternalBuffName(name)) continue
    if (isEliteBuffName(name)) {
      if (!eliteByName.has(name)) eliteByName.set(name, [])
      eliteByName.get(name).push(buff)
      claimed.add(buff)
      continue
    }
    const hit = matchCanonicalStatus(buff)
    if (hit) {
      canonicalBuckets.get(hit.name).push(buff)
      claimed.add(buff)
    }
  }

  // —— 第二遍：精选池里剩余的进「技能专属」——
  for (const buff of featuredPool) {
    if (claimed.has(buff)) continue
    const name = nameOf(buff)
    if (isCookBuff(buff) || isInternalBuffName(name) || isEliteBuffName(name)) continue
    if (!skillByName.has(name)) skillByName.set(name, [])
    skillByName.get(name).push(buff)
  }

  const entries = []
  const missing = []
  for (const status of CANONICAL_STATUSES) {
    const variants = canonicalBuckets.get(status.name)
    if (!variants.length) { missing.push(status.name); continue }
    entries.push(toEntry({ name: status.name, group: status.group, category: status.category, variants, buffData, sourceIndex, levelIndex }))
  }
  if (missing.length) {
    throw new Error(`[buffParser] 标准状态未命中任何 buff，清单与数据已脱节：${missing.join('、')}`)
  }
  for (const [name, variants] of eliteByName) {
    entries.push(toEntry({ name, group: 'elite', category: '怪物异变', variants, buffData, sourceIndex, levelIndex }))
  }
  for (const [name, variants] of skillByName) {
    entries.push(toEntry({ name, group: 'skill', category: '技能专属', variants, buffData, sourceIndex, levelIndex }))
  }

  const order = new Map(STATUS_GROUPS.map((group, index) => [group.id, index]))
  const categoryOrder = ['持续伤害', '控制', '削弱', '护盾恢复', '属性增益']
  return entries.sort((a, b) =>
    (order.get(a.group) - order.get(b.group))
    || (categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category))
    || a.name.localeCompare(b.name, 'zh-Hans-CN'))
}
