/**
 * 食谱相关共享工具
 * 原本 PREVIEW_AVAILABLE_IDS / GENERIC_FOOD_TYPE_MAP / 食材组装逻辑在
 * RecipesView.vue 与 ItemDetailModal.vue 中重复，这里统一收口。
 */

/**
 * 食谱大图预览可用列表 (硬编码替换 import.meta.glob 防止图片被 Vite 错误打包到 dist/assets 中)
 */
export const PREVIEW_AVAILABLE_IDS = new Set([
  'item_30022', 'item_30023', 'item_30024', 'item_30025', 'item_30026', 'item_30027',
  'item_30028', 'item_30029', 'item_30030', 'item_30031', 'item_30032', 'item_30033',
  'item_30034', 'item_30035', 'item_30036', 'item_30037', 'item_30038', 'item_30039',
  'item_30040', 'item_30041', 'item_30042', 'item_30043', 'item_30044', 'item_30046',
  'item_30047', 'item_30048'
])

/**
 * 通用食材类型 ID 转换关系 (foodType: 1->兽肉, 2->野菜, 3->浆果, 4->地菇)
 */
export const GENERIC_FOOD_TYPE_MAP = {
  '1': { typeId: 'item_10006', name: '兽肉' },
  '2': { typeId: 'item_10056', name: '野菜' },
  '3': { typeId: 'item_10055', name: '浆果' },
  '4': { typeId: 'item_10057', name: '地菇' }
}

/**
 * 组装一份菜单/配方的食材列表（item.json 的 food 与 foodType 两种来源）
 * @param {object} menuEntry menu.json 中单个配方条目
 * @param {object} itemDict item.json 的 datas 字典（itemId -> item）
 * @returns {Array<{typeId, name, count, icon}>} icon 为相对路径（需调用方再包 getImageUrl）
 */
export function buildRecipeIngredients(menuEntry, itemDict = {}) {
  const ingredients = []
  const pushIngredient = (typeId, count, name, imgKey) => {
    ingredients.push({
      typeId,
      name,
      count,
      icon: `/Common_ItemIcon/${imgKey}.png`
    })
  }

  if (menuEntry.food && Array.isArray(menuEntry.food) && menuEntry.food.length > 0) {
    menuEntry.food.forEach(f => {
      const ingId = f.typeId
      const count = f.num || 1
      const matchedItem = itemDict[ingId] || {}
      pushIngredient(ingId, count, matchedItem.name || ingId, matchedItem.img || ingId)
    })
  }

  if (menuEntry.foodType && Array.isArray(menuEntry.foodType) && menuEntry.foodType.length > 0) {
    menuEntry.foodType.forEach(ft => {
      const genInfo = GENERIC_FOOD_TYPE_MAP[ft.type] || { typeId: 'item_10006', name: '兽肉' }
      const count = ft.num || 1
      const matchedItem = itemDict[genInfo.typeId] || {}
      pushIngredient(genInfo.typeId, count, genInfo.name, matchedItem.img || genInfo.typeId)
    })
  }

  return ingredients
}
