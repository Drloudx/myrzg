/**
 * 词条页「名词解释」静态内容。
 *
 * 每条的 `basis` 标注依据来源（源码文件 / 配置字段），不确定的写「未确证」，不编造。
 * 只做**名词定义**；完整公式与结算顺序在战斗规则页（`src/config/combatRules.js` / `/rewards?tab=combat_rules`），
 * 这里不重复维护公式正文，只在需要时指向它。
 *
 * 源码路径均相对 `源码/源码/Assembly-CSharp/`。
 */
export const glossarySections = [
  {
    id: 'combat',
    title: '战斗基础名词',
    intro: '技能类型、冷却与攻速这些词在角色、魔物、怪物图鉴里反复出现，这里统一解释它们指什么。',
    entries: [
      {
        term: '普攻',
        alias: '普通攻击',
        text: '同一个东西：「普攻」是简称，正式写法是「普通攻击」。配置里用 skillType = 0 标记，源码枚举把 Normal 拼成了 Normol（SkillType.NormolAtk）。所有单位都默认拥有，不消耗法力、没有冷却，是攻速直接决定出手频率的那一招。',
        basis: 'SkillType.cs；Unit.cs:2450 按 skillType == NormolAtk 分支'
      },
      {
        term: '主动技能',
        text: '配置里 skillType = 1。需要玩家点击释放，有冷却时间和资源（通常是法力）消耗。角色图鉴里带冷却与消耗数值的技能就是这一类。',
        basis: 'SkillType.cs；SkillBase.cs:275'
      },
      {
        term: '被动天赋',
        text: '不需要主动释放、满足条件自动生效的技能。角色配置里存在 talentSkillList 字段，配置表是 skillTrigger.json（不是 skill.json）。触发条件与概率、冷却写在被动技能自己的 levelData 里。',
        basis: 'Hero.cs:33 talentSkillList；ClientConfig.cs:848-861 读 skillTriggerConf'
      },
      {
        term: '星阶技能',
        text: '随升星次数解锁的技能，共 4 阶。角色配置里是 paSkillList 的 starSkill1 到 starSkill4。角色图鉴「升星次数」就是四组星阶技能等级之和，不是稀有度。',
        basis: 'Hero.cs:35 paSkillList；HeroBattleAttributeGroup.cs:748'
      },
      {
        term: '冷却缩减',
        value: '上限 50%',
        text: '缩短技能冷却的属性。实际冷却 = 基础冷却 × (1 − 冷却缩减 ÷ 100)，所以 50% 就是冷却减半。直接减少剩余冷却、返还冷却或立即重置技能属于另外的效果，不受这项上限限制。',
        basis: 'CombatPanel.cs:5379；UnitAttribute.cs:354-364 上限 50'
      },
      {
        term: '攻速加成',
        value: '上限 +300%',
        text: '加快出手频率的属性。最终攻速 = 基础攻速 × (1 + min(攻速加成, 300) ÷ 100)，所以 300% 就是基础攻速的 4 倍。游戏面板里「基础攻速」「攻速加成」「当前攻速」是三个不同的值。',
        basis: 'UnitAttribute.cs:334-341；UnitDataShowPanel.cs:180-182'
      },
      {
        term: '攻击间隔',
        text: '两次普攻之间隔多久，等于 1 ÷ 最终攻速（秒）。攻速越高间隔越短。举例：最终攻速每秒 2 次，攻击间隔就是 0.5 秒。',
        basis: 'Unit.cs:1030；UnitAI.cs:713'
      },
      {
        term: '冷却时间（CD）',
        text: '主动技能两次可用之间需要等待的秒数，取技能配置 levelData 里对应等级的 cd 值。角色图鉴的主动技能详情会显示当前技能等级对应的冷却。',
        basis: 'SkillConf.cs:25 cd；SkillCdData.cs'
      },
      {
        term: '伤害浮动',
        text: '每次伤害在配置的上下限之间随机取值，让同一招的伤害有轻微波动。浮动上下限来自 atkFloatMin / atkFloatMax，具体结算位置见战斗规则页。',
        basis: 'UnitAttribute.cs:150-152；结算顺序见 combatRules.js'
      },
      {
        term: '等级压制',
        value: '最多减伤 50%',
        text: '攻击等级更高的目标时受到的伤害惩罚。只在攻击等级更高目标时计算，等级差达到 16 级时固定使伤害减半。',
        basis: 'combatRules.js「等级压制」；general.json 的 levelSuppressionCoefficientA/B'
      },
      {
        term: '霸体',
        text: '免疫部分控制效果的战斗状态。源码里通过 general 配置的 baTiInfluenceBuffEffects 键决定哪些状态能影响霸体，但该键在当前解密配置里不存在，因此只能确认机制存在，具体能免疫哪些状态未确证。',
        basis: 'BuffControl.cs:220,256（引用配置键）；该键在 general.json 中不存在'
      }
    ]
  },
  {
    id: 'buff',
    title: 'Buff 分类名词',
    intro: 'buff 有三个容易混淆的字段，先分清它们，再看具体分类。',
    entries: [
      {
        term: 'buffEffect（效果类型）',
        text: '决定 buff 到底做什么的字段，也是判断分类的唯一权威依据。源码用它在唯一派发点挑出对应的实现类，共有 356 个分支。其中约 30 个是通用机制（持续伤害、护盾、眩晕……），其余 306 个是角色、宠物、装备的专属效果名。',
        basis: 'BuffControl.cs:312 派发点；BuffControl.cs:352-713 的 356 分支 switch'
      },
      {
        term: 'buffType（互斥类型）',
        text: '只用于「同类型的新状态顶掉旧状态」，不代表效果分类。它有 509 个取值且大量是角色专属串，所以不要拿它当分类看。',
        basis: 'BuffControl.cs:730-741 RemoveOldBuff'
      },
      {
        term: 'buffTags（展示标签）',
        text: '给玩家看的分类标签，同时也是护盾归属、状态检测、驱散和持续时间修正的依据。注意 1649 条 buff 里有 71% 根本没有标签，所以「没有标签」不代表这个状态没有分类。',
        basis: 'BuffControl.cs:170-216 检测与按标签驱散；CombatPanel.cs:5662-5681 普攻增伤字典'
      },
      {
        term: '增益',
        text: '对携带者有利的状态标签，例如攻击提升、护盾、回复。与「减益」相对。',
        basis: 'buffTags 取值'
      },
      {
        term: '减益',
        text: '对携带者不利的状态标签，例如中毒、燃烧、流血、弱化。',
        basis: 'buffTags 取值'
      },
      {
        term: '强化',
        text: '临时提升战斗能力的状态标签，多用于升星技能与职业被动带来的自增益。',
        basis: 'buffTags 取值'
      },
      {
        term: '控制',
        text: '限制行动的状态总称，包含眩晕、定身、嘲讽、混乱等。不同控制限制的行为范围不一样，详见各自词条。',
        basis: 'buffTags 取值；各控制类的源码实现'
      },
      {
        term: '眩晕',
        text: '完全无法行动的控制：不能移动、不能普攻、不能放技能，同时暂停 AI。是限制最彻底的一类控制。',
        basis: 'Buff_Stun.cs:29-35（noMove / noSkill / noAtk / PauseAI）'
      },
      {
        term: '定身',
        text: '只能限制移动的控制：无法移动，但仍然可以普攻和释放技能。与眩晕的区别就在这里。',
        basis: 'Buff_Immobility.cs:35-37（仅 noMove / SetPauseMove）'
      },
      {
        term: '嘲讽',
        text: '强制目标把攻击对象改为嘲讽来源，并且无法释放技能。常用于坦克类角色保护队友。',
        basis: 'Buff_Ridicule.cs:25-31（target.ridicule = self；noSkill）'
      },
      {
        term: '混乱',
        text: '与嘲讽互斥的一类控制状态。源码里嘲讽会先判断目标是否处于混乱，因此两者不会同时存在。',
        basis: 'Buff_Ridicule.cs:27 if (!target.confusion)'
      },
      {
        term: '护盾',
        text: '先于生命值承受伤害的临时吸收量，扣完才扣血。判定护盾时源码硬编码只认 buffTags 含 Shield 的状态，所以「护盾类」的归属看这个标签。护盾量可以来自固定值，也可以按攻击力或最大生命值的比例换算。',
        basis: 'CombatPanel.cs:6265 硬编码 Shield 标签；Buff_Shield.cs:17；Buff_Xier_LevelStar1_Shield.cs:30-40'
      },
      {
        term: '持续伤害',
        alias: 'DOT',
        text: '按固定时间间隔反复造成伤害的状态。间隔由 spTime 决定（缺省 1 秒）。若同时配了作用半径，就变成范围内的持续伤害（持续伤害光环）。',
        basis: 'Buff_Burning.cs:59-83；Buff_DotHalo.cs:36-46'
      },
      {
        term: '流血',
        text: '持续伤害的一种展示分类，效果上仍是按间隔结算的持续伤害，只是图标与文案不同。',
        basis: 'buffTags 取值；实现同 DOT'
      },
      {
        term: '燃烧',
        text: '火属性的持续伤害，按间隔对目标结算火属性物理伤害。',
        basis: 'Buff_Burning.cs；buff.json 中燃烧的 elementType = fire'
      },
      {
        term: '中毒',
        text: '持续伤害的一种。游戏里中毒类状态实际走的是持续伤害（DOT）加 buffType = poison 的组合，而不是独立的 Poisoning 效果类型（后者在配置里没有任何引用）。',
        basis: 'buff.json 中毒条目为 buffEffect = DOT、buffType = poison；Poisoning 在配置中 0 条'
      },
      {
        term: '回复光环',
        text: '按固定间隔为范围内友方回复生命或法力的状态。回复量可来自固定值，也可按施法者属性比例换算。',
        basis: 'Buff_ReplyHalo.cs:67-78；Buff_Reply.cs:56-59'
      },
      {
        term: '纯特效状态',
        text: '只有表现效果、没有任何战斗数值的状态（buffEffect = noneEft）。用于挂特效或做标记，不会改变属性。',
        basis: 'Buff_NoneButEft.cs:14-22'
      }
    ]
  },
  {
    id: 'trigger',
    title: '触发条件名词',
    intro: '状态什么时候生效，由配置里的 detectType 决定（源码 BuffDetectType 枚举，共 75 个取值）。缺省或没写就是 none，即不自动触发。',
    entries: [
      {
        term: '无自动触发',
        alias: 'none',
        text: '状态挂上后只在开始和结束时结算一次，不会反复触发。定身、眩晕这类纯控制状态通常就是这种。',
        basis: 'BuffBase.cs:211 缺省 none'
      },
      {
        term: '按固定间隔',
        alias: 'spTime',
        text: '每隔 spTime 秒触发一次，缺省 1 秒。持续伤害和回复光环都靠它循环结算。',
        basis: 'BuffControl.cs:29-36；BuffBase.cs:479-486'
      },
      {
        term: '战斗开始时',
        alias: 'firstVic',
        text: '实际触发点是房间胜利结算时，每个房间一次。名字直译是「首次胜利」，配置里 39 条用到它，多为料理与战前准备类加成。',
        basis: 'BattleManager.cs:3225 在房间胜利分支内调用'
      },
      {
        term: '受到攻击时',
        alias: 'beHit',
        text: '携带者每次被攻击命中时触发，常见于反伤、受击回血、受击增伤类效果。另有「被普通攻击命中时」等更细的变体。',
        basis: 'CombatPanel.cs:5946；变体见 :5826、:5840'
      },
      {
        term: '普通攻击时',
        alias: 'normalAtk',
        text: '携带者发动普攻时触发。区分「普攻伤害计算时」与「普攻命中时」等更细的时机。',
        basis: 'Unit.cs:2450-2452'
      },
      {
        term: '普通攻击暴击时',
        alias: 'normalAtkCrit',
        text: '普攻打出暴击时触发，常用于暴击后追加伤害或附加状态。另有「造成暴击时」，对普攻和技能都生效。',
        basis: 'CombatPanel.cs:5991；damCrit 见 :6004'
      },
      {
        term: '累计普攻次数',
        alias: 'atkTm',
        text: '普攻累计到指定次数后触发，次数由 atkTm 配置。和「每 N 次普攻触发」是同一套机制的两种写法。',
        basis: 'Unit.cs:2454；Buff_AtkTm.cs:58-66'
      },
      {
        term: '释放技能时',
        alias: 'doSkill',
        text: '携带者释放非普攻技能时触发。另有「技能命中时」「技能结束时」等更细的时机。',
        basis: 'Unit.cs:2458；doSkillEnd 见 SkillBase.cs:287-289'
      },
      {
        term: '按生命值判定',
        alias: 'atkCheckHp',
        text: '按当前生命值比例决定是否生效，阈值写在 checkHpRate 或 hpRate 里。濒死类效果也属于这一族。',
        basis: 'CombatPanel.cs:5808；nearDead 见 :6469'
      },
      {
        term: '最大叠层',
        alias: 'maxLayPara',
        text: '同一个状态最多能叠几层。没写时默认 1 层，也就是不能叠。只有 canOverlay 为真、并且游戏里同 ID 的状态再次命中时才会叠层，而不是新建一个。',
        basis: 'BuffBase.cs:243-255（缺省 1）；BuffControl.cs:286-311'
      },
      {
        term: '初始层数',
        alias: 'startLayNum',
        text: '状态刚获得时就带的层数，会被最大叠层数截断。写 0 表示开局 0 层、必须靠后续叠加才生效。',
        basis: 'BuffBase.cs:256-261；BuffControl.cs:319-332'
      },
      {
        term: '叠层是否线性叠加',
        text: '属性类叠加基本是线性的：每次叠层追加一份基础值，总量等于基础值乘层数。但源码在移除属性时，冷却缩减、魔法防御、反伤这三项的减法漏乘了层数，与添加侧不对称，所以这三项不能无条件按「完全线性」理解。',
        basis: 'Buff_AttributeAdd.cs:111-248 加侧乘 numTemp；:266-333 减侧部分未乘'
      },
      {
        term: '触发概率',
        alias: 'race',
        text: '满足触发条件后再按概率决定是否真的生效，取值是小数比例，例如 0.15 表示 15%。没有该字段就是必定触发。',
        basis: 'BuffBase.cs:501-521 CheckRace'
      },
      {
        term: '触发冷却',
        alias: 'cd',
        text: '同一个效果两次触发之间至少间隔的秒数，避免高频重复触发。与「持续间隔」spTime 不同：spTime 是循环结算节奏，cd 是触发次数限制。',
        basis: 'BuffBase.cs:492-499 CheckCD'
      }
    ]
  },
  {
    id: 'attributes',
    title: '属性名词',
    intro: '状态与装备里的属性加成，先分「固定值」和「比例加成」两类，再看具体属性。固定值直接加在面板上，比例加成按基础值的百分比提升。',
    entries: [
      {
        term: '固定值加成',
        text: '直接增加具体点数，例如物理攻击 +38。在配置里是属性条目的 baseValue 字段。',
        basis: 'AttrAdd.cs baseValue；Buff_AttributeAdd.cs:123'
      },
      {
        term: '比例加成',
        text: '按基础属性的百分比提升，例如物理攻击 +7%。在配置里是属性条目的 percent 字段，按小数存储（0.07 即 7%）。面板计算为 基础值 × (1 + 比例)。',
        basis: 'AttrAdd.cs percent；UnitAttribute.cs:254'
      },
      {
        term: '物理攻击 / 魔法攻击',
        text: '决定伤害的两项主属性。物理攻击支撑物理伤害，魔法攻击支撑魔法伤害；具体一招吃哪一项，由该技能的倍率基准属性决定。',
        basis: 'UnitAttribute.cs:254,266'
      },
      {
        term: '物理防御 / 魔法防御',
        text: '分别减免物理伤害与魔法伤害的防御属性，计算时与攻击方的对应穿透相抵消。',
        basis: 'UnitAttribute.cs:278,290；结算见 combatRules.js'
      },
      {
        term: '暴击率',
        value: '按百分点',
        text: '决定是否打出暴击。实际判定还要减去目标的暴击抗性：差值不大于 0 时不暴击，达到 100% 时必定暴击。配置里是百分点数值，例如 4 表示 4%。',
        basis: 'UnitDataShowPanel.cs:185；判定见 combatRules.js「有效暴击率」'
      },
      {
        term: '暴击抗性',
        text: '抵消攻击方暴击率的属性，用于降低被暴击的概率。与暴击率同单位（百分点）。',
        basis: 'UnitDataShowPanel.cs:189'
      },
      {
        term: '暴击伤害',
        text: '暴击时额外增加的伤害比例。按百分点记，例如 50 表示暴击时伤害提升 50%。',
        basis: 'UnitDataShowPanel.cs:186；combatRules.js「暴击率与暴击伤害」'
      },
      {
        term: '攻速加成',
        text: '按百分点记的出手频率加成，直接参与「最终攻速 = 基础攻速 × (1 + 攻速加成 ÷ 100)」。上限 +300%。',
        basis: 'UnitDataShowPanel.cs:182；UnitAttribute.cs:334-341'
      },
      {
        term: '移速加成',
        text: '移动速度的比例加成。注意它和攻速加成记法不同：攻速按百分点存，移速按小数比例存（-0.1 表示 −10%）。',
        basis: 'UnitAttribute.cs:343-350；UnitDataShowPanel.cs:184 走 GetPercent'
      },
      {
        term: '穿透',
        alias: '物理穿透 / 魔法穿透',
        text: '计算伤害时忽略目标对应防御的比例。自身穿透、普攻额外穿透与本次攻击的无视防御相加，合计最多忽略目标的全部对应防御。',
        basis: 'combatRules.js「防御穿透」'
      },
      {
        term: '抗性',
        text: '分为两类：物理、魔法及水、火、风、地元素抗性各自独立乘算，每项最多按 100% 计；另一类抗性会先与增伤相加减。抗性达到 100% 也不一定让伤害为 0，还要经过最低伤害等后续处理。',
        basis: 'UnitDataShowPanel.cs:207-212；combatRules.js「增伤、易伤与元素抗性」'
      },
      {
        term: '属性伤害提升',
        text: '按元素或伤害类型提高造成的伤害，例如火属性伤害提升、普攻伤害提升、技能伤害提升。按小数比例存，0.08 表示 8%。',
        basis: 'UnitDataShowPanel.cs:198-205 走 GetPercent'
      },
      {
        term: '受到的伤害',
        text: '改变自身承受伤害的增减项，负数表示减伤。按小数比例存，例如 -0.15 表示受到伤害降低 15%。',
        basis: 'UnitDataShowPanel.cs:196；CombatPanel.cs:5764-5766'
      },
      {
        term: '吸血',
        text: '按造成伤害的一定比例回复自身生命。按百分点记。',
        basis: 'UnitDataShowPanel.cs:192'
      },
      {
        term: '反伤',
        text: '受到伤害时按比例反弹给攻击者。按百分点记。',
        basis: 'UnitDataShowPanel.cs:191'
      },
      {
        term: '受治疗加成',
        text: '提高自身受到治疗时的回复量。按百分点记。',
        basis: 'UnitDataShowPanel.cs:206'
      },
      {
        term: '生命恢复 / 法力恢复',
        text: '战斗中的持续恢复能力。按百分比记（3 表示 3%），另可叠加一个固定回复量，两者相加后按最大生命或最大法力换算。',
        basis: 'BattleManager.cs:3304,3328；Buff_FirstVic.cs:78-86'
      },
      {
        term: '击退抵抗',
        text: '降低被击退效果的属性。击退力度会先按 (1 − 击退抵抗) 衰减，抵抗足够高时几乎不会被推动。',
        basis: 'Unit.cs:739,763；UnitDataShowPanel.cs:190'
      },
      {
        term: '最大生命值 / 最大魔法值',
        text: '生命与技能资源的容量上限，同样有固定值与比例两种加成方式。法力在配置里也写作 sp。',
        basis: 'UnitAttribute.cs:302,314；UnitDataShowPanel.cs:176,179'
      }
    ]
  }
]

/** 页面顶部的一句话说明。 */
export const glossaryIntro = '这里解释游戏里的战斗名词、状态分类、触发时机与属性含义。数值来自游戏配置本身，'
  + '单位换算依据源码；标注「未确证」的项表示源码或配置证据不足，不作确定结论。'
