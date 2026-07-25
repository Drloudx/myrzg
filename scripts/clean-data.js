import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { isBlacklisted } from '../src/config/blacklist.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const publicDataDir = path.join(projectRoot, 'public', 'data')
const typesDir = path.join(projectRoot, 'src', 'types')

// 1. Raw Data Architecture - Roles
const rawRoles = [
  { id: '101', name: '艾莉丝', rarity: '传说', rarityLevel: 'SS', class: '法师', element: '光', desc: '掌控神圣光辉的高阶魔导士，能对全场造成高额元素伤害。', skillName: '光辉耀斑', skillEffect: '对敌方全体造成240%魔法伤害，并施加2层【灼照】。' },
  { id: '102', name: '雷恩', rarity: '史诗', rarityLevel: 'S', class: '战士', element: '火', desc: '身经百战的要塞守卫，具备出色的防御与护盾能力。', skillName: '烈焰坚壁', skillEffect: '获得最大生命值30%的护盾，并对周围敌人造成震荡伤害。' },
  { id: '103', name: '希尔芙', rarity: '稀有', rarityLevel: 'A', class: '游侠', element: '风', desc: '穿梭在森林中的游风猎手，擅长快速连击与暴击。', skillName: '疾风连矢', skillEffect: '连续射出3发穿透箭矢，每次造成75%物理伤害。' },
  { id: '104', name: '米娅', rarity: '普通', rarityLevel: 'B', class: '圣职', element: '水', desc: '温和的治愈师，能为队友提供持续治疗与净化。', skillName: '静水润泽', skillEffect: '恢复生命值最低的队友20%最大生命值。' },
  { id: '105', name: '卡伦', rarity: '普通', rarityLevel: 'B', class: '战士', element: '土', desc: '村镇护卫士兵，依靠厚重盾牌抵挡进攻。', skillName: '岩盾格挡', skillEffect: '自身获得15%最大生命护盾，嘲讽周边敌人2秒。' },
  { id: '106', name: '莉娜', rarity: '普通', rarityLevel: 'B', class: '法师', element: '火', desc: '初学火焰魔法的学徒，掌握基础火球术。', skillName: '小火球', skillEffect: '对单体敌人130%魔法伤害，小幅灼烧3秒。' },
  { id: '107', name: '托比', rarity: '普通', rarityLevel: 'B', class: '游侠', element: '土', desc: '乡村猎人，擅长精准单点射击。', skillName: '精准射击', skillEffect: '单体160%物理伤害，提升自身5%暴击率。' },
  { id: '108', name: '瑟拉', rarity: '普通', rarityLevel: 'B', class: '圣职', element: '光', desc: '乡村修女，简单治疗受伤同伴。', skillName: '微光治愈', skillEffect: '单体恢复15%最大生命值，清除一层负面。' },
  { id: '109', name: '瓦鲁', rarity: '稀有', rarityLevel: 'A', class: '战士', element: '火', desc: '流浪狂战士，血量越低输出越高。', skillName: '狂怒劈斩', skillEffect: '单体200%物理伤害，自身损失8%生命值提升12%攻击。' },
  { id: '110', name: '菲雅', rarity: '稀有', rarityLevel: 'A', class: '法师', element: '冰', desc: '冰系见习魔导，可减速限制敌人行动。', skillName: '冰棱冲击', skillEffect: '直线群体110%魔法伤害，减速目标30%持续2秒。' },
  { id: '111', name: '凯德', rarity: '稀有', rarityLevel: 'A', class: '游侠', element: '暗', desc: '隐匿刺客，攻击附带持续毒素。', skillName: '毒刃突袭', skillEffect: '单体175%物理伤害，附加每秒6%物攻毒伤，持续4秒。' },
  { id: '112', name: '诺艾尔', rarity: '稀有', rarityLevel: 'A', class: '圣职', element: '风', desc: '巡风祭司，群体小额持续回血。', skillName: '清风庇护', skillEffect: '全队每2秒恢复4%生命，持续6秒。' },
  { id: '113', name: '格雷姆', rarity: '史诗', rarityLevel: 'S', class: '战士', element: '土', desc: '山谷堡垒统帅，拥有高额减伤与反伤。', skillName: '大地壁垒', skillEffect: '全队获得20%生命护盾，受到攻击反弹6%伤害。' },
  { id: '114', name: '伊索尔德', rarity: '史诗', rarityLevel: 'S', class: '法师', element: '暗', desc: '暗影咒术师，吸取敌方血量转化输出。', skillName: '暗影汲取', skillEffect: '全体敌方150%魔法伤害，伤害30%转化全队治疗。' },
  { id: '115', name: '薇拉', rarity: '史诗', rarityLevel: 'S', class: '游侠', element: '风', desc: '暴风弓箭手，大范围多重箭压制敌群。', skillName: '暴风箭雨', skillEffect: '大范围所有敌人100%物理伤害，提升全队10%移速。' },
  { id: '116', name: '塞拉芬', rarity: '史诗', rarityLevel: 'S', class: '圣职', element: '水', desc: '高阶治愈神官，解除全队全部负面状态。', skillName: '圣泉洗礼', skillEffect: '全队恢复18%最大生命值，清除所有控制与减益。' },
  { id: '117', name: '巴尔克', rarity: '传说', rarityLevel: 'SS', class: '战士', element: '暗', desc: '深渊黑骑士，残血爆发极强，自带吸血。', skillName: '深渊灭杀', skillEffect: '单体320%物理伤害，造成伤害50%转化自身生命值。' },
  { id: '118', name: '塞琉斯', rarity: '传说', rarityLevel: 'SS', class: '法师', element: '冰', desc: '永霜大魔导，大范围冻结敌方群体。', skillName: '永霜领域', skillEffect: '全体敌方200%魔法伤害，冻结目标1.2秒。' },
  { id: '119', name: '艾琳娜', rarity: '传说', rarityLevel: 'SS', class: '游侠', element: '光', desc: '圣银巡猎者，暴击必定附加真实伤害。', skillName: '圣光贯射', skillEffect: '贯穿全体210%物理伤害，暴击附加40%真实伤害。' },
  { id: '120', name: '露米奈', rarity: '传说', rarityLevel: 'SS', class: '圣职', element: '光', desc: '圣光圣女，复活一名阵亡队友并高额抬血。', skillName: '圣辉重生', skillEffect: '复活一名阵亡角色，恢复其60%最大生命值并附加护盾。' }
]

// 2. Raw Data Architecture - Equips
const rawEquips = [
  { id: 'e201', name: '秘境王者之剑', rarity: '传说', rarityLevel: 'SS', slot: '武器', mainStat: '攻击力 +350', effect: '攻击时有25%概率触发【狂暴】，提升30%暴击伤害，持续5秒。', starEffects: ['攻击时有25%概率触发【狂暴】，提升30%暴爆伤。', '【狂暴】概率提升至35%，暴伤提升至45%。', '【狂暴】概率提升至45%，暴伤提升至60%。', '【狂暴】触发时额外恢复20%生命值。'] },
  { id: 'e202', name: '守护者胸铠', rarity: '史诗', rarityLevel: 'S', slot: '衣服', mainStat: '防御力 +180 / 生命 +1200', effect: '受到伤害时，使自身受到的伤害降低15%，持续3秒。', starEffects: ['受到伤害时，减伤15%。', '减伤提升至20%。', '减伤提升至25%。', '获得免控护盾。'] },
  { id: 'e203', name: '迅捷追风靴', rarity: '稀有', rarityLevel: 'A', slot: '鞋子', mainStat: '速度 +45', effect: '战斗开始时，提升自身20%移动速度，持续8秒。', starEffects: ['开局提速20%。', '开局提速25%。', '开局提速30%。', '开局提速35%并免疫减速。'] },
  { id: 'e204', name: '学徒指环', rarity: '普通', rarityLevel: 'B', slot: '饰品', mainStat: '魔法回复 +5', effect: '释放技能时回复少量魔力。', starEffects: ['释放技能回复5魔力。', '回复8魔力。', '回复12魔力。', '回复18魔力。'] },
  { id: 'e001', name: '铸铁短剑', rarity: '普通', rarityLevel: 'B', slot: '武器', mainStat: '攻击力 +60', effect: '普通攻击伤害小幅提升', starEffects: ['普攻伤害+5%', '普攻伤害+10%', '普攻伤害+15%', '普攻附带小额流血'] },
  { id: 'e002', name: '粗布布衣', rarity: '普通', rarityLevel: 'B', slot: '衣服', mainStat: '防御力 +40 / 生命 +350', effect: '小幅提升最大生命值', starEffects: ['最大生命+3%', '最大生命+6%', '最大生命+9%', '脱战缓慢回血'] },
  { id: 'e003', name: '麻布便鞋', rarity: '普通', rarityLevel: 'B', slot: '鞋子', mainStat: '速度 +12', effect: '小幅提升基础移速', starEffects: ['移速+3%', '移速+6%', '移速+9%', '地面行走不减速'] },
  { id: 'e004', name: '碎石吊坠', rarity: '普通', rarityLevel: 'B', slot: '饰品', mainStat: '魔法回复 +3', effect: '缓慢恢复魔力', starEffects: ['每秒回魔1', '每秒回魔1.5', '每秒回魔2', '魔力低于30%回魔翻倍'] },
  { id: 'e005', name: '精铁长剑', rarity: '稀有', rarityLevel: 'A', slot: '武器', mainStat: '攻击力 +130', effect: '暴击概率小幅提升', starEffects: ['暴击率+4%', '暴击率+7%', '暴击率+11%', '暴击后短暂增伤8%'] },
  { id: 'e006', name: '皮质护胸', rarity: '稀有', rarityLevel: 'A', slot: '衣服', mainStat: '防御力 +95 / 生命 +680', effect: '被攻击降低小额伤害', starEffects: ['受到伤害-6%', '受到伤害-10%', '受到伤害-14%', '被击反弹5%伤害'] },
  { id: 'e007', name: '皮制疾行靴', rarity: '稀有', rarityLevel: 'A', slot: '鞋子', mainStat: '速度 +26', effect: '奔跑消耗耐力降低', starEffects: ['耐力消耗-8%', '耐力消耗-14%', '耐力消耗-20%', '冲刺距离增加15%'] },
  { id: 'e008', name: '青铜徽记', rarity: '稀有', rarityLevel: 'A', slot: '饰品', mainStat: '魔法回复 +6', effect: '击杀单位回复魔力', starEffects: ['击杀回魔4', '击杀回魔7', '击杀回魔11', '击杀同时恢复5%生命'] },
  { id: 'e009', name: '寒冰穿刺矛', rarity: '史诗', rarityLevel: 'S', slot: '武器', mainStat: '攻击力 +220', effect: '攻击有概率冰冻敌人1秒', starEffects: ['5%概率冰冻', '9%概率冰冻', '14%概率冰冻', '冰冻目标受到伤害提升12%'] },
  { id: 'e010', name: '熔岩锁甲', rarity: '史诗', rarityLevel: 'S', slot: '衣服', mainStat: '防御力 +145 / 生命 +960', effect: '自身持续灼烧周边敌人', starEffects: ['每秒灼烧20伤害', '每秒灼烧35伤害', '每秒灼烧50伤害', '灼烧附带减攻10%'] },
  { id: 'e011', name: '岩地重靴', rarity: '史诗', rarityLevel: 'S', slot: '鞋子', mainStat: '速度 +36', effect: '免疫小幅击退效果', starEffects: ['小幅抗击退', '中度抗击退', '大幅抗击退', '免疫击飞控制'] },
  { id: 'e012', name: '月华宝石', rarity: '史诗', rarityLevel: 'S', slot: '饰品', mainStat: '魔法回复 +9', effect: '技能冷却小幅缩减', starEffects: ['冷却缩减4%', '冷却缩减7%', '冷却缩减10%', '大招冷却额外再减5%'] },
  { id: 'e013', name: '雷霆裁决刃', rarity: '传说', rarityLevel: 'SS', slot: '武器', mainStat: '攻击力 +330', effect: '攻击概率释放连锁闪电', starEffects: ['18%连锁闪电', '26%连锁闪电', '34%连锁闪电', '闪电麻痹目标0.8秒'] }
]

// 3. Raw Data Architecture - Pets
const rawPetData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'pet.json'), 'utf8'))
const petList = Object.values(rawPetData.datas || {}).map(p => ({
  id: p.monId || p.typeId,
  type: 'pet',
  name: p.name,
  rarity: p.star >= 3 ? '传说' : (p.star === 2 ? '稀有' : '普通'),
  rarityLevel: p.star >= 3 ? 'SS' : (p.star === 2 ? 'A' : 'B'),
  category: '魔物蛋',
  subTag: `${Math.round(p.eggTime / 60)}分钟`,
  keywords: `${p.name} 魔物蛋 蛋孵化 ${p.des || ''}`.toLowerCase()
}))

// 4. Raw Data Architecture - Achievements
const rawAchData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'achievement.json'), 'utf8'))
const rawRewardData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'reward.json'), 'utf8'))
const rawItemData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'item.json'), 'utf8'))

const categoryMap = { adv: '冒险', exp: '探索', live: '生活', hide: '隐藏' }

// 代码层防剧透屏蔽黑名单 (依据成就标题 name 匹配)
const BLACKLIST_ACHIEVEMENT_NAMES = ['章节宝箱', '通关']

const achList = Object.values(rawAchData.achievement || {})
  .filter(a => {
    if (!a.name) return true
    return !BLACKLIST_ACHIEVEMENT_NAMES.some(kw => a.name.includes(kw))
  })
  .map(a => {
    const rObj = (rawRewardData.datas && rawRewardData.datas[a.reward]) || {}
    const rewardItemNames = []
    if (rObj.items && Array.isArray(rObj.items)) {
      rObj.items.forEach(it => {
        if (it.rules && Array.isArray(it.rules)) {
          it.rules.forEach(rule => {
            if (rule.typeId && rawItemData.datas && rawItemData.datas[rule.typeId]) {
              rewardItemNames.push(rawItemData.datas[rule.typeId].name)
            }
          })
        }
      })
    }
    return {
      id: a.typeId,
      type: 'achievement',
      name: a.name,
      rarity: '普通',
      rarityLevel: 'B',
      category: categoryMap[a.category] || '成就',
      subTag: a.des,
      keywords: `${a.name} 成就 ${a.des} ${rewardItemNames.join(' ')}`.toLowerCase()
    }
  })

// 5. Raw Data Architecture - Recipes & Game Setting Category Map
const rawMenuData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'menu.json'), 'utf8'))
const rawBuffData = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'buff.json'), 'utf8'))
const rawGameSetting = JSON.parse(fs.readFileSync(path.join(publicDataDir, 'gameSetting.json'), 'utf8'))

const categoryCodeMap = {}
function parseCategoryTypes(arr) {
  if (!arr || !Array.isArray(arr)) return
  arr.forEach(i => {
    if (i.type !== undefined && i.name) {
      categoryCodeMap[String(i.type)] = i.name
    }
    if (i.info) parseCategoryTypes(i.info)
  })
}

if (rawGameSetting.data && rawGameSetting.data.typeSetting && rawGameSetting.data.typeSetting.item_type) {
  parseCategoryTypes(rawGameSetting.data.typeSetting.item_type)
}

const recipeList = Object.values(rawMenuData.datas || {}).map(m => {
  const itemEntry = (rawItemData.datas && rawItemData.datas[m.typeId]) || {}
  const name = itemEntry.name || m.name || m.typeId
  const rawCats = itemEntry.category || []
  const categoryTags = rawCats
    .map(c => categoryCodeMap[String(c)] || String(c))
    .filter(t => t !== '消耗' && t !== '料理')
  const buffId = itemEntry.useActionPara2 ? itemEntry.useActionPara2.buff : null
  const bObj = buffId ? rawBuffData[buffId] : null
  const buffDes = bObj && bObj.buffDes ? bObj.buffDes.replace(/\{([^}]+)\}/g, '$1') : ''

  return {
    id: m.typeId,
    type: 'recipe',
    name,
    rarity: m.level >= 3 ? '传说' : (m.level === 2 ? '史诗' : '稀有'),
    rarityLevel: m.level >= 3 ? 'SS' : (m.level === 2 ? 'S' : 'A'),
    category: '料理',
    categoryTags,
    subTag: String(m.level || 1),
    keywords: `${name} 食谱 配方 料理 ${categoryTags.join(' ')} ${buffDes}`.toLowerCase()
  }
})

// 6. Build Search Index
const searchIndex = [
  ...rawRoles.map(r => ({
    id: r.id,
    type: 'role',
    name: r.name,
    rarity: r.rarity,
    rarityLevel: r.rarityLevel,
    category: r.class,
    subTag: r.element,
    keywords: `${r.name} ${r.class} ${r.element} ${r.desc} ${r.skillName}`.toLowerCase()
  })),
  ...rawEquips.map(e => ({
    id: e.id,
    type: 'equip',
    name: e.name,
    rarity: e.rarity,
    rarityLevel: e.rarityLevel,
    category: e.slot,
    subTag: e.mainStat,
    keywords: `${e.name} ${e.slot} ${e.mainStat} ${e.effect}`.toLowerCase()
  })),
  ...petList,
  ...achList,
  ...recipeList
]

// Ensure directories exist
if (!fs.existsSync(publicDataDir)) {
  fs.mkdirSync(publicDataDir, { recursive: true })
}
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true })
}

// Write Output JSON Files
const filteredSearchIndex = searchIndex.filter(item => !isBlacklisted(item))
fs.writeFileSync(path.join(publicDataDir, 'roles.json'), JSON.stringify(rawRoles, null, 2), 'utf8')
fs.writeFileSync(path.join(publicDataDir, 'equips.json'), JSON.stringify(rawEquips, null, 2), 'utf8')
fs.writeFileSync(path.join(publicDataDir, 'search-index.json'), JSON.stringify(filteredSearchIndex, null, 2), 'utf8')

// Generate TypeScript Definition File
const tsContent = `// Auto-generated TypeScript definitions by scripts/clean-data.js
export type RarityType = '传说' | '史诗' | '稀有' | '普通';
export type RarityLevelType = 'SS' | 'S' | 'A' | 'B';

export interface RoleData {
  id: string;
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  class: '战士' | '游侠' | '法师' | '圣职';
  element: '光' | '暗' | '火' | '水' | '风' | '地' | '冰' | '土';
  desc: string;
  skillName: string;
  skillEffect: string;
}

export interface EquipData {
  id: string;
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  slot: '武器' | '头部' | '衣服' | '鞋子' | '饰品';
  mainStat: string;
  effect: string;
  starEffects: string[];
}

export interface SearchIndexItem {
  id: string;
  type: 'role' | 'equip';
  name: string;
  rarity: RarityType;
  rarityLevel: RarityLevelType;
  category: string;
  subTag: string;
  keywords: string;
}
`

fs.writeFileSync(path.join(typesDir, 'data-types.d.ts'), tsContent, 'utf8')

console.log('✅ Data processing pipeline complete:')
console.log(` - public/data/roles.json (${rawRoles.length} roles)`)
console.log(` - public/data/equips.json (${rawEquips.length} equips)`)
console.log(` - public/data/search-index.json (${searchIndex.length} index items)`)
console.log(` - src/types/data-types.d.ts generated successfully`)
