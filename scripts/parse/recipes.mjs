/**
 * 料理图鉴预解析：public/data/parsed/recipes.json
 * 对应浏览器端 src/utils/recipeData.js 的 buildRecipeData（同一纯函数）
 */
import { buildRecipeData } from '../../src/utils/recipeData.js'
import { readJson } from './shared.mjs'

export function buildRecipesFile() {
  const data = buildRecipeData({
    menuJson: readJson('menu.json'),
    itemJson: readJson('item.json'),
    buffJson: readJson('buff.json'),
    gsJson: readJson('gameSetting.json')
  })
  return { file: 'parsed/recipes.json', data }
}
