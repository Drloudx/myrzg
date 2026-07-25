/**
 * 全局隐藏/黑名单配置文件 (Global Blacklist Config)
 *
 * 开发者在此数组中添加条目【名称】或【ID】，即可全局自动隐藏对应的条目。
 * 作用范围涵盖：全局搜索下拉、角色图鉴、装备图鉴、成就查询、食谱配方、魔物收益及构建索引。
 *
 * 支持匹配规则：
 * 1. 名称全称或关键字 (如 '章节宝箱', '通关', '果香烤肉') -> 只要名称包含该关键字即隐藏
 * 2. ID / typeId 精确匹配 (如 'item_30025', '10501', '101') -> 匹配对应 ID 即可直接隐藏
 */
export const GLOBAL_BLACKLIST = [
  // --- 名称/关键字 隐藏条目 ---
  '章节宝箱',
  '通关',
  '松茸鲜汤',
  '松茸肉汤面',
  '莲香肉干',
  '冰莲火腿三明治',


  // --- ID / typeId 隐藏条目 (写在下方即可生效) ---
  // 'item_30025',
  // '10501'
]

/**
 * 校验目标条目 (对象或 ID/名称字符串) 是否属于全局黑名单
 * @param {Object|string|number} item 支持 { id, name, typeId } 对象或字符串/数字
 * @returns {boolean} true 表示属于黑名单 (应当被隐藏/过滤)
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
    nameStr = item.name ? String(item.name).trim() : ''
  } else {
    const s = String(item).trim()
    idStr = s
    nameStr = s
  }

  return GLOBAL_BLACKLIST.some(rule => {
    if (rule === null || rule === undefined) return false
    const ruleStr = String(rule).trim()
    if (!ruleStr) return false

    // 1. ID 精确匹配 (不区分大小写)
    if (idStr && idStr.toLowerCase() === ruleStr.toLowerCase()) {
      return true
    }

    // 2. 名称全称或关键字匹配 (不区分大小写)
    if (nameStr && nameStr.toLowerCase().includes(ruleStr.toLowerCase())) {
      return true
    }

    return false
  })
}
