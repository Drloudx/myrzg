/**
 * 料理图鉴构建期纯函数：由 menu/item/buff/gameSetting 原始 JSON 生成食谱列表。
 * 与 RecipesView.vue 的组装逻辑保持一致；图标存相对路径（调用方再包 getImageUrl）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
import { PREVIEW_AVAILABLE_IDS, buildRecipeIngredients } from './recipeUtils.js'

// 配方来源跳转配置（与 RecipesView 保持一致）
export const RECIPE_SOURCE_CONFIG = {
  'item_30035': { text: '配方由成就「战场美食家」获取', targetType: 'achievement', targetId: '10501', targetQuery: '战场美食家' },
  'item_30041': { text: '完成任务“修行者的佐餐小菜”获取配方', targetType: 'task', targetId: 's_2_7' },
  'item_30034': { text: '完成任务“稀缺的食材”获取配方', targetType: 'task', targetId: 'sub_0_01' },
  'item_30040': { text: '完成任务“禅武同如一，虎啸除心魔”获取配方', targetType: 'task', targetId: 'm_2_8' },
  'item_30042': { text: '完成任务“香甜美食在哪里”获取配方', targetType: 'task', targetId: 's_2_10' }
}

export function buildRecipeData(maps) {
  const { menuJson, itemJson, buffJson, gsJson } = maps

  const menuDict = menuJson.datas || {}
  const itemDict = itemJson.datas || {}
  const buffDict = buffJson || {}

  // Parse category codes from gameSetting.json
  const categoryCodeMap = {}
  const parseCategoryTypes = (arr) => {
    if (!arr || !Array.isArray(arr)) return
    arr.forEach(i => {
      if (i.type !== undefined && i.name) {
        categoryCodeMap[String(i.type)] = i.name
      }
      if (i.info) parseCategoryTypes(i.info)
    })
  }
  if (gsJson.data && gsJson.data.typeSetting && gsJson.data.typeSetting.item_type) {
    parseCategoryTypes(gsJson.data.typeSetting.item_type)
  }

  const assembledList = Object.values(menuDict).map(menuEntry => {
    const typeId = menuEntry.typeId
    const itemEntry = itemDict[typeId] || {}

    // 1. Resolve Recipe Icon & Name using itemEntry.img (e.g. item_30035 -> img: item_30009)
    const recipeName = itemEntry.name || menuEntry.name || '未知食谱'
    const recipeImgKey = itemEntry.img || typeId
    const recipeIcon = `/Common_ItemIcon/${recipeImgKey}.png`
    const hasPreview = PREVIEW_AVAILABLE_IDS.has(typeId)

    // 2. Resolve Category Tags & filter out "消耗" and "料理"
    const rawCats = itemEntry.category || []
    const categoryTags = rawCats
      .map(c => categoryCodeMap[String(c)] || String(c))
      .filter(t => t !== '消耗' && t !== '料理')

    // 3. Resolve Ingredients List using itemDict[ingId].img（icon 为相对路径）
    const ingredients = buildRecipeIngredients(menuEntry, itemDict)

    // 4. Resolve Buff Description ONLY
    let buffId = null
    if (itemEntry.useActionPara2 && itemEntry.useActionPara2.buff) {
      buffId = itemEntry.useActionPara2.buff
    }
    let buffDes = ''
    if (buffId && buffDict[buffId]) {
      const bObj = buffDict[buffId]
      if (bObj.buffDes) {
        buffDes = bObj.buffDes.replace(/\{([^}]+)\}/g, '$1')
      }
    }

    // 5. Source Info Link
    const sourceInfo = RECIPE_SOURCE_CONFIG[typeId] || null

    return {
      id: typeId,
      name: recipeName,
      icon: recipeIcon,
      hasPreview,
      categoryTags,
      ingredients,
      buffId,
      buffDes,
      sourceInfo
    }
  })

  return { recipes: assembledList }
}
