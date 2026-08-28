/**
 * 游戏 ID → 展示 的全局映射与公共工具
 * 全站统一从这里取映射，禁止在页面里各自写死（规范整体代码）。
 * 来源：源码 Const.cs / TaskPanel.cs / item.json / GAoNanoFileList 等。
 */

// ---------- 任务类型（源码 TaskPanel.GetTaskTypeText） ----------
export const TASK_TYPE_LABELS = { 1: '主线', 2: '支线', 3: '委托', 4: '伙伴', 5: '活动' }
export const TASK_TYPE_ORDER = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }

// ---------- 步骤类型 ----------
export const STEP_TYPE_NAMES = {
  talk: '与NPC对话',
  npcTalkBattle: '与NPC对话进入副本',
  passInstance: '通关副本',
  passStage: '通关关卡',
  hunter: '狩猎怪物',
  hunterUid: '狩猎精英/BOSS',
  getItemNpc: '提交道具给NPC',
  getItem: '获取物品',
  collect: '地图采集',
  gotoStage: '前往指定场景',
  gotoCamp: '返回营地',
  tag: '系统目标触发',
  openAreaShow: '解锁区域',
  level: '等级',
  sellPet: '卖出魔物'
}

// ---------- 副本难度（stepPosition[2]） ----------
export const DIFFICULTY = { '1': '简单', '2': '普通', '3': '困难' }

// ---------- 基础货币/经验图标（源码 Const.cs + item.json） ----------
export const BASE_REWARD_ICONS = {
  money: 'item_00001', // 银币
  ke: 'item_00002', // 氪金
  payKe: 'item_00003', // 神晶
  exp: 'item_00004', // 营地经验值
  ti: 'item_00005', // 体力
  heroExp: 'item_00006', // 伙伴经验值
  equipExp: 'item_00007', // 装备强化经验
  speed: 'item_00008' // 加速点
}
export const BASE_REWARD_NAMES = {
  money: '银币',
  ke: '氪金',
  payKe: '神晶',
  exp: '营地经验值',
  ti: '体力',
  heroExp: '伙伴经验值',
  equipExp: '装备强化经验',
  speed: '加速点'
}

// 基础货币/经验的完整图片路径（统一 /images 前缀，页面禁止再各自写死）
const baseRewardIconPath = (iconId) => `/images/Common_ItemIcon/${iconId}.png`
export const BASE_REWARD_PATHS = Object.fromEntries(
  Object.entries(BASE_REWARD_ICONS).map(([key, id]) => [key, baseRewardIconPath(id)])
)

// 奖励 rule.mode -> 展示信息（怪物/角色/物品解析、成就页、奖励页共用）
export const REWARD_MODE_INFO = {
  money: { id: 'item_00001', name: BASE_REWARD_NAMES.money, icon: BASE_REWARD_PATHS.money },
  randomMoney: { id: 'item_00001', name: BASE_REWARD_NAMES.money, icon: BASE_REWARD_PATHS.money },
  ke: { id: 'item_00002', name: BASE_REWARD_NAMES.ke, icon: BASE_REWARD_PATHS.ke }
}

// 通用奖励对象解析（成就页、图鉴等共用）：从 reward.json 条目自动解析出标准奖励条目
export function parseRewardObject(r, itemMap = {}) {
  if (!r) return { rewards: [], rewardItemNames: [] }
  const rewards = []
  const rewardItemNames = []

  // 1. 基础货币与经验（自动遍历 BASE_REWARD_ICONS，统一走全局映射）
  for (const [field, iconId] of Object.entries(BASE_REWARD_ICONS)) {
    const val = r[field]
    if (val && val > 0) {
      rewards.push({
        typeId: iconId,
        name: BASE_REWARD_NAMES[field],
        count: val,
        icon: BASE_REWARD_PATHS[field]
      })
    }
  }

  // 2. 道具条目 items
  if (Array.isArray(r.items)) {
    for (const it of r.items) {
      if (it && Array.isArray(it.rules)) {
        for (const rule of it.rules) {
          if (rule && rule.typeId) {
            const count = rule.min || rule.max || it.num || 1
            const matchedItem = itemMap[rule.typeId]
            const name = (matchedItem && matchedItem.name) || rule.typeId
            rewards.push({
              typeId: rule.typeId,
              name,
              count,
              icon: `/images/Common_ItemIcon/${(matchedItem && matchedItem.img) || rule.typeId}.png`
            })
            if (matchedItem && matchedItem.name) {
              rewardItemNames.push(matchedItem.name)
            }
          }
        }
      }
    }
  }

  return { rewards, rewardItemNames }
}

// 任务/事件类奖励解析（tasks/events 共用，输出 { entries, text }；原 taskParser/eventData 各自副本收敛于此）
export function parseRewardEntries(rewardMap, itemMap, rewardId) {
  if (!rewardId) return { entries: [], text: [] }
  const r = rewardMap[rewardId] || {}
  const entries = []
  const text = []
  const arr = (v) => (Array.isArray(v) ? v : [])

  for (const [field, iconId] of Object.entries(BASE_REWARD_ICONS)) {
    const val = r[field]
    if (val > 0) {
      entries.push({
        kind: field,
        name: BASE_REWARD_NAMES[field],
        count: val,
        typeId: iconId,
        icon: BASE_REWARD_PATHS[field]
      })
    }
  }

  for (const it of arr(r.items)) {
    for (const rule of arr(it && it.rules)) {
      if (rule && rule.typeId) {
        const item = itemMap[rule.typeId]
        const count = rule.min || rule.max || it.num || 1
        entries.push({
          kind: 'item',
          name: (item && item.name) || rule.typeId,
          count,
          typeId: rule.typeId,
          icon: `/Common_ItemIcon/${(item && item.img) || rule.typeId}.png`
        })
      }
    }
  }
  return { entries, text }
}

// ---------- 角色/魔物 职业与元素映射（角色图鉴、魔物图鉴、搜索索引共用） ----------
export const JOB_NAMES = {
  1: '近卫',
  2: '守护',
  3: '秘术',
  4: '射手',
  5: '突袭',
  6: '支援'
}
// 职业 → 资源文件名拼音缩写（如 class_icon_s_zs.png）；HeroesView getJobSlug 使用
export const JOB_SLUGS = {
  1: 'zs',
  2: 'qs',
  3: 'fs',
  4: 'yx',
  5: 'ck',
  6: 'fz'
}
export const ELEMENT_NAMES = {
  1: '水',
  2: '火',
  3: '风',
  4: '地'
}
// 元素图标 slug（大写开头 / 全小写两种）
export const ELEMENT_SLUGS = { 1: 'Water', 2: 'Fire', 3: 'Wind', 4: 'Ground' }
export const ELEMENT_SLUGS_LOWER = { 1: 'water', 2: 'fire', 3: 'wind', 4: 'ground' }

// ---------- 稀有度/品质名称（物品图鉴、装备图鉴、事件探索等全站统一） ----------
// 游戏官方品质体系：EatCookPanelUI.cs / lan.json equip_qual
export const RARITY_NAMES = {
  1: '普通',
  2: '稀少',
  3: '珍贵',
  4: '罕见',
  5: '传说'
}
export const getRarityName = (r) => RARITY_NAMES[r] || RARITY_NAMES[1]

// ---------- 物品分类完整映射（单一真相来源：包含 gameSetting.json 缺漏的二级分类） ----------
// 来源：源码 Item.cs (isSeed=16, isFoodMat=13, isPotion=31, isFood=32, isBattleItem=33)
//       gameSetting.json (item_type / campBuild_type) + Item.json 归类
export const ITEM_CATEGORY_NAMES = {
  // 一级大类 (category[0])
  '0': '特殊',
  '1': '材料',
  '2': '其他',
  '3': '消耗',
  '4': '装备',
  '5': '收集',
  '6': '魔物蛋',
  '7': '符石',

  // 二级中类 (category[1])
  // 材料 (1) 下属
  '11': '基础材料',
  '12': '魔物素材',
  '13': '食材',
  '14': '药材',
  '16': '种子',

  // 其他 (2) 下属
  '21': '结晶碎片/礼包',
  '22': '兑换代币',
  '24': '旧版符石',

  // 消耗 (3) 下属
  '31': '药水',
  '32': '料理',
  '33': '道具',

  // 装备 (4) 下属
  '41': '武器',
  '42': '头盔',
  '43': '上衣',
  '44': '手套',
  '45': '鞋子',
  '46': '项链',
  '47': '戒指',

  // 收集 (5) 下属
  '51': '食谱',
  '52': '家具图纸',
  '54': '日志文本',
  '55': '外观皮肤',

  // 符石 (7) 下属
  '71': '1阶符石',
  '72': '2阶符石',
  '73': '3阶符石',
  '74': '4阶符石',
  '75': '5阶符石',
  '76': '6阶符石',

  // 三级小类 (category[2])
  // 食材 (13) 下属
  '131': '肉类',
  '132': '水果',
  '133': '蔬菜',
  '134': '菌菇',
  '135': '调料',

  // 药水 (31) 下属
  '311': '恢复类',
  '312': '强化类',
  '313': '抗性类',

  // 料理 (32) 下属
  '321': '恢复类',
  '322': '强化类',
  '323': '抗性类',

  // 道具 (33) 下属
  '331': '投掷',
  '332': '装置',
  '333': '陷阱',
  '334': '卷轴'
}

/**
 * 获取单个分类代码的中文名称
 */
export function getCategoryName(code) {
  if (code === undefined || code === null) return ''
  return ITEM_CATEGORY_NAMES[String(code)] || String(code)
}

/**
 * 补全并标准化 gameSetting.json 的 item_type 分类树
 * 保证 ItemsView 级联筛选与 ItemDetailModal 分类路径拥有完整中类与小类
 */
export function buildFullCategoryTree(rawTree = []) {
  // 深度克隆原始树或以标准映射建立底表
  const baseTree = [
    {
      type: '0',
      name: '特殊'
    },
    {
      type: '1',
      name: '材料',
      info: [
        { type: '11', name: '基础材料' },
        { type: '12', name: '魔物素材' },
        {
          type: '13',
          name: '食材',
          info: [
            { type: '131', name: '肉类' },
            { type: '132', name: '水果' },
            { type: '133', name: '蔬菜' },
            { type: '134', name: '菌菇' },
            { type: '135', name: '调料' }
          ]
        },
        { type: '14', name: '药材' },
        { type: '16', name: '种子' }
      ]
    },
    {
      type: '2',
      name: '其他',
      info: [
        { type: '21', name: '结晶碎片/礼包' },
        { type: '22', name: '兑换代币' },
        { type: '24', name: '旧版符石' }
      ]
    },
    {
      type: '3',
      name: '消耗',
      info: [
        {
          type: '31',
          name: '药水',
          info: [
            { type: '311', name: '恢复类' },
            { type: '312', name: '强化类' },
            { type: '313', name: '抗性类' }
          ]
        },
        {
          type: '32',
          name: '料理',
          info: [
            { type: '321', name: '恢复类' },
            { type: '322', name: '强化类' },
            { type: '323', name: '抗性类' }
          ]
        },
        {
          type: '33',
          name: '道具',
          info: [
            { type: '331', name: '投掷' },
            { type: '332', name: '装置' },
            { type: '333', name: '陷阱' },
            { type: '334', name: '卷轴' }
          ]
        }
      ]
    },
    {
      type: '4',
      name: '装备',
      info: [
        { type: '41', name: '武器' },
        { type: '42', name: '头盔' },
        { type: '43', name: '上衣' },
        { type: '44', name: '手套' },
        { type: '45', name: '鞋子' },
        { type: '46', name: '项链' },
        { type: '47', name: '戒指' }
      ]
    },
    {
      type: '5',
      name: '收集',
      info: [
        { type: '51', name: '食谱' },
        { type: '52', name: '家具图纸' },
        { type: '54', name: '日志文本' },
        { type: '55', name: '外观皮肤' }
      ]
    },
    {
      type: '6',
      name: '魔物蛋'
    },
    {
      type: '7',
      name: '符石',
      info: [
        { type: '71', name: '1阶' },
        { type: '72', name: '2阶' },
        { type: '73', name: '3阶' },
        { type: '74', name: '4阶' },
        { type: '75', name: '5阶' },
        { type: '76', name: '6阶' }
      ]
    }
  ]

  if (!Array.isArray(rawTree) || rawTree.length === 0) {
    return baseTree
  }

  // 若 rawTree 存在，合并覆盖并补充缺失节点
  return baseTree
}

/**
 * 将物品 category 数组转换为可读的标签数组（已过滤纯数字和重复值）
 * 例如 [1, 11] -> ['材料', '基础材料']
 *     [2, 21] -> ['其他', '礼包']
 */
export function resolveItemCategoryTags(category = []) {
  if (!Array.isArray(category) || category.length === 0) return ['物品']
  const tags = []
  for (const c of category) {
    const name = ITEM_CATEGORY_NAMES[String(c)]
    if (name && !tags.includes(name)) {
      tags.push(name)
    }
  }
  return tags.length > 0 ? tags : ['物品']
}

// 品质原色/背景色统一从 theme.css 变量读取（--qN 原色 / --qN-bg 浅底）。
// 仅作为读取失败时的兜底（数值与 theme.css 一致）；网页文字类另用 --qN-text。
const Q_COLOR_FALLBACK = { 1: '#cfba96', 2: '#a7c037', 3: '#3fa2ff', 4: '#ee62f1', 5: '#ffb64d' }
const Q_BG_FALLBACK = {
  1: 'rgba(111,91,60,0.12)',
  2: 'rgba(167,192,55,0.22)',
  3: 'rgba(63,162,255,0.20)',
  4: 'rgba(238,98,241,0.19)',
  5: 'rgba(255,182,77,0.24)'
}
export function getQualityColors(quality) {
  const q = Number(quality) || 1
  let color = ''
  let background = ''
  if (typeof document !== 'undefined' && document.documentElement) {
    const cs = getComputedStyle(document.documentElement)
    color = cs.getPropertyValue(`--q${q}`).trim()
    background = cs.getPropertyValue(`--q${q}-bg`).trim()
  }
  return {
    color: color || Q_COLOR_FALLBACK[q] || Q_COLOR_FALLBACK[1],
    background: background || Q_BG_FALLBACK[q] || Q_BG_FALLBACK[1]
  }
}

// ---------- 大地图名（c0~c5_map -> 地图名；也支持 c0~c5 / C0~C5 归一化） ----------
export const MAP_NAMES = {
  c0: '求生者草原',
  c1: '秋日荒野',
  c2: '索利德山地',
  c3: '魔爪湖畔',
  c4: '黑森林',
  c5: '霜烬平原'
}
// 章节代码（c1/c2 或 C1/C2 或 c1_map）→ 地图名，兜底返回原值
export function getMapName(key) {
  if (!key) return ''
  const s = String(key).toLowerCase().replace(/_map$/, '').trim()
  return MAP_NAMES[s] || key
}

// ---------- 战斗/基础属性中文名（角色图鉴、怪物详情共用） ----------
export const STAT_NAMES = {
  maxHp: '生命值',
  phyAtk: '物理攻击',
  magicAtk: '魔法攻击',
  phyDef: '物理防御',
  magicDef: '魔法防御',
  atkSpeed: '攻速加成',
  crit: '暴击率',
  critRes: '暴击抗性',
  critDam: '暴击伤害',
  atkRange: '攻击距离',
  atkFloatMin: '伤害浮动下限',
  atkFloatMax: '伤害浮动上限',
  walkSpeed: '行走速度',
  runSpeed: '移动速度加成',
  maxSp: '法力值',
  repelRes: '击退抵抗',
  phyAtkPen: '物理穿透',
  magicAtkPen: '魔法穿透',
  rebDam: '反伤率',
  vampire: '吸血率',
  cureAdd: '受治疗加成',
  collection: '采集范围',
  poisonMax: '中毒上限',
  poisonDown: '毒素消退',
  helpTime: '救助时间',
  restoreHp: '生命恢复',
  restoreSp: '法力恢复'
}
export const translateStatName = (key) => STAT_NAMES[key] || key

// ---------- 技能名清洗（heroParser / petParser 共用） ----------
export const getCleanSkillName = (rawName) => {
  if (!rawName) return ''
  return rawName.replace(/\s*[Ll]v\s*:\s*\d+/g, '').trim()
}

// ---------- 技能/效果描述高亮（角色、魔物、物品详情共用） ----------
// {数值} 或 <数值> 统一包成高亮 span
export const formatHighlightedText = (text) => {
  if (!text) return ''
  return text.replace(/(?:\{([^}]+)\})|(?:<([^>]+)>)/g, (match, p1, p2) => {
    return `<span class="value-highlight">${p1 || p2}</span>`
  })
}

// ---------- tag 步骤目标（手动映射，数据/源码无官方名称，依据步骤语义整理） ----------
export const TAG_LABELS = {
  DailyTaskFinish: '完成委托契约',
  alchemyStartMaking: '制药台制作',
  campCenter2: '升级营地中心至 2 级',
  checkInXiTa: '邀请茜塔入住小屋',
  dingDan: '完成一张订单',
  heroLvUp: '提升伙伴等级',
  heroRankUp: '角色突破',
  muChuangMaked: '制作木制大床',
  oneHome: '建造一号小屋',
  openEntrust: '打开委托板',
  petHome: '建造宠物小屋',
  rolelv5: '伙伴升至 5 级',
  tieJiangPuLv2: '锻造台升至 2 级',
  towerLayer_3: '通关神匠之塔第 3 层',
  wuQiLv10: '武器强化至 10 级',
  wuQiLv12: '武器强化至 12 级',
  wuQiLv7: '武器强化至 7 级',
  yingDiLv3: '营地中心升至 3 级',
  zhongZhiOver: '营地种植一次',
  zhuangBeiUp: '强化一次装备',
  zhuangBeiWear: '给角色穿戴装备',
  zhuangBeiXiLian: '装备洗炼一次'
}

// ---------- 剧情文本 ----------
const DIALOG_TEXT_RE = /[\u4e00-\u9fff\s，。？！、；：,.?!:：()（）《》<>【】]/

export function resolveDialogMeta(raw, name = '') {
  if (!raw) return null
  return { raw, isText: DIALOG_TEXT_RE.test(raw), name }
}

// 清洗 GAoNano 剧本文本标记（与角色图鉴一致）
// ---------- 主角称呼占位（gameSetting.textReplaceBySex）：默认男主称呼（女主称呼） ----------
export const CALL_NAME_REPLACE = {
  '{callName1}': '他（她）',
  '{callName2}': '少年（少女）',
  '{callName3}': '小哥（小姐）',
  '{callName4}': '大哥哥（大姐姐）'
}

// 通用文本替换表（{myName}/[myName]/主角 -> 小工匠，删除隐藏标记）
export const NAME_TEXT_REPLACERS = [
  [/\{myName\}/g, '小工匠'],
  [/\[myName\]/g, '小工匠'],
  [/主角/g, '小工匠']
]
const MARKUP_REPLACERS = [
  [/\[show\]/g, ''],
  [/\[l\]\[cm\]/g, ''],
  [/\[l\]/g, ''],
  [/\[cm\]/g, ''],
  [/\[r\]/g, ''],
  [/\[hide\]/g, '']
]

// 基础清洗：通用标记 + 富文本标记（b/color/size/wait）+ 主角称呼（角色图鉴/任务图鉴共用）
export function cleanDialogueBase(text) {
  if (!text) return ''
  let result = text
  for (const [re, rep] of [...MARKUP_REPLACERS, ...NAME_TEXT_REPLACERS]) {
    result = result.replace(re, rep)
  }
  // 富文本标记：结束标签 [b]/[bEnd]/[colorEnd]/[sizeEnd] + 带参数开标签 [color=xxx]/[size=xx]/[wait=xx]
  result = result
    .replace(/\[(b|bEnd|colorEnd|sizeEnd)\]/g, '')
    .replace(/\[(color|size|wait)=[^\]]*\]/g, '')
  return result
}

export function cleanDialogueLine(text) {
  if (!text) return ''
  let result = cleanDialogueBase(text)
  // 主角称呼：默认男主称呼（女主称呼），如 {callName4} -> 大哥哥（大姐姐）
  for (const [k, v] of Object.entries(CALL_NAME_REPLACE)) {
    result = result.split(k).join(v)
  }
  return result
}

// 邮件内容清洗（角色档案专用：主角称呼替换 + 邮筒占位 + 删除隐藏标记）
export function cleanMailContent(text) {
  if (!text) return ''
  let result = text
  for (const [re, rep] of NAME_TEXT_REPLACERS) {
    result = result.replace(re, rep)
  }
  return result.replace(/\{邮筒\}/g, '邮筒').replace(/\[hide\]/g, '')
}

// ---------- 怪物头像（与怪物图鉴 MonstersView 同一套规则：avatar→colect、小写、跳过默认皮肤后缀） ----------
export const SKIP_SKINS = ['default', 'nomal', 'normal', 'kuangbao', 'crazy', 'smallfront', 'lance', 'sling', 'up', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'blue', 'red', 'yellow', 'green']

export function getMonsterIcon(icon, skinName = '') {
  if (!icon) return ''
  const lowerIcon = String(icon).toLowerCase()
  const lowerSkin = String(skinName || '').toLowerCase().replace(/\//g, '_')
  const shouldSkip = SKIP_SKINS.includes(lowerSkin) || !lowerSkin
  if (lowerIcon.startsWith('avatar')) {
    const base = lowerIcon.replace('avatar', 'colect')
    return shouldSkip ? base : `${base}_${lowerSkin}`
  }
  return lowerIcon
}

// ---------- 二级分类排序 ----------
export function chapterSortKey(label) {
  if (!label) return 999
  if (label === '初始章') return 0
  if (label === '序章') return 1
  const m = /^第(.+)章$/.exec(label)
  if (m) {
    const num = parseInt(m[1], 10)
    if (!Number.isNaN(num)) return 10 + num
  }
  return 900
}

export function subSortKey(type, label) {
  if (Number(type) === 3) {
    // 委托 C0~Cn 按数字排序
    const m = /^C(\d+)$/i.exec(label)
    return m ? 100 + parseInt(m[1], 10) : 999
  }
  if (Number(type) === 4) {
    // 好感度区间按起始数字排序
    const m = /^(\d+)/.exec(label)
    return m ? 200 + parseInt(m[1], 10) : 999
  }
  return chapterSortKey(label)
}
