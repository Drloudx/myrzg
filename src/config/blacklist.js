/**
 * 全局隐藏/黑名单配置文件 (Global Blacklist Config)
 *
 * 开发者在此数组中添加条目【名称】或【ID】，即可全局自动隐藏对应的条目。
 * 作用范围涵盖：全局搜索下拉、角色图鉴、装备图鉴、成就查询、食谱配方、魔物收益及构建索引等。
 */

// 1. 模糊匹配名单 (只要名称中包含该关键字即隐藏)
export const FUZZY_BLACKLIST = [
    //成就相关
    '未使用',
    //物品图鉴去掉测试相关
    '测试',
    '（废弃）',
    '契约感谢',
    //魔物图鉴和被隐藏的物品
    '黑森林',
    '霜烬平原',
    '黑森林/霜烬平原',

]
// 2. 精确匹配名单 (ID、typeId 或 完整名称 必须完全匹配才隐藏)
export const EXACT_BLACKLIST = [
    //物品图鉴乱七八糟的物品
    // 希尔旧版获取道具不进入网页图鉴；原始 JSON 保留。
    'item_59001',
    'item_5900101',
    'item_5900102',
    '11皮',
    '11布',
    '11重分解',
    '12重',
    '12重分解',
    '21重',
    '22重',
    '全部基础材料',
    '全种子各类代币属性',
    '道具药水食物',
    '家具',
    '人物+宠物',
    'c1装备',
    'c2装备',
    'c3装备',
    'C1~C3家具宝箱',
    '11重分',
    '全种子各类代币属性碎片',

    '普通月卡',
    '自由委托印章',
    '第四章',
    '第五章',
    '坚韧的板材',
    //没出的食谱
    '松茸鲜汤',
    '松茸肉汤面',
    '莲香肉干',
    '冰莲火腿三明治',
    //成就
    '坐牢模拟器',
    '冰原老司机',
    '菌毯清洁大师',
    '蓝伞伞，躺板板',
    '赫淮斯托斯',
    '扫黑除恶',
    '来吧！灵魂森友会',
    '否定使命之人',
    '黑森林探索者',
    '霜烬平原探索者',
    '制裁魔女之人',
    '献出心脏',
    '你甚至不愿意叫我一声老大',
    '超绝最可爱天界格莉',
   //特殊物品
    '【未使用】石镐',
    //霜烬平原/黑森林相关素材与道具（按用户要求隐藏）
    '异变菌帽',
    '腐朽巨鹿角',
    '霜寒趾甲',
    '冰焰之心',
    '蕈人孢子簇',
    '魔花花瓣',
    '粗糙的冰晶',
    '熔火结晶',
    '冰莲种子',
    '冰莲',
    '提纯的冰晶',
    '寒冰粉',
    '寒冰爆桶',
    '熔火护盾',
    //家具图纸：这几类是通用分类图（非具体家具），按用户要求隐藏
    '桌子类制作图',
    '凳子类制作图',
    '书架类制作图',

]

/**
 * 校验目标条目是否属于全局黑名单
 * @param {Object|string|number} item 支持 { id, name, typeId } 对象或字符串/数字
 * @returns {boolean} true 表示属于黑名单(应当被隐藏)
 */
export const isBlacklisted = (item) => {
  if (item === null || item === undefined) return false

  let idStr = ''
  let nameStr = ''

  if (typeof item === 'object') {
    idStr = item.id !== undefined && item.id !== null ? String(item.id).trim() : ''
    if (!idStr && item.typeId) {
      idStr = String(item.typeId).trim()
    }
    const parts = [
      item.name,
      item.desc,
      item.tip,
      item.source,
      item.label,
      item.keywords,
      ...(item.category || []),
      ...(item.categories || []),
      ...(item.place || []),
      ...(item.mark || [])
    ].filter(Boolean).map(s => String(s).trim())
    nameStr = parts.join(' ')
  } else {
    const s = String(item).trim()
    idStr = s
    nameStr = s
  }

  // 1. 优先检查精确匹配
  const isExactMatch = EXACT_BLACKLIST.some(rule => {
    if (rule === null || rule === undefined) return false
    const ruleStr = String(rule).trim().toLowerCase()
    if (!ruleStr) return false

    if (idStr && idStr.toLowerCase() === ruleStr) return true
    
    // 精确匹配只校验名称本身，不能校验拼合后的 nameStr
    if (typeof item === 'object') {
      if (item.name && String(item.name).trim().toLowerCase() === ruleStr) return true
    } else {
      if (nameStr && nameStr.toLowerCase() === ruleStr) return true
    }
    
    return false
  })

  if (isExactMatch) return true

  // 2. 检查模糊匹配
  const isFuzzyMatch = FUZZY_BLACKLIST.some(rule => {
    if (rule === null || rule === undefined) return false
    const ruleStr = String(rule).trim().toLowerCase()
    if (!ruleStr) return false

    if (nameStr && nameStr.toLowerCase().includes(ruleStr)) return true
    return false
  })

  return isFuzzyMatch
}

/**
 * ─────────── 装备品阶隐藏 ───────────
 *
 * 装备的「阶」对应数据里的 `item.equip.equipLevel`（1~5）。
 * 在此数组填入要**隐藏**的品阶，以下三处一并生效：
 *   1. 物品图鉴 → 装备子类（`ItemsView`）
 *   2. 装备图鉴（`EquipsView`）
 *   3. 设施功能 → 锻造台 → 装备打造（`FacilitiesView`，按配方产出物的阶过滤）
 *
 * 例：`[4, 5]` = 隐藏 4 阶与 5 阶装备；`[]` = 全都不隐藏。
 *
 * 注意：只影响**装备**（`category` 含 4）。符石也有「1阶~6阶」，但走 `category[1]=71~76`，
 * 与 `equipLevel` 无关，不受本数组影响。
 */
export const HIDDEN_EQUIP_TIERS = [4, 5]

/** 品阶取值范围（与游戏 equipLevel 一致） */
export const EQUIP_TIER_RANGE = [1, 2, 3, 4, 5]

/**
 * 该装备是否属于被隐藏的品阶。
 * @param {Object} item 物品条目（需含 category / equip）
 * @returns {boolean} true 表示应被隐藏
 */
export const isEquipTierHidden = (item) => {
  if (!item) return false
  // 非装备不受影响
  const cats = item.category || item.categories || []
  if (!cats.map(String).includes('4')) return false
  const tier = Number(item.equip?.equipLevel)
  if (!Number.isFinite(tier)) return false
  return HIDDEN_EQUIP_TIERS.map(Number).includes(tier)
}

/** 可见的品阶列表（用于筛选行渲染，已排除被隐藏的） */
export const visibleEquipTiers = () =>
  EQUIP_TIER_RANGE.filter(t => !HIDDEN_EQUIP_TIERS.map(Number).includes(t))
