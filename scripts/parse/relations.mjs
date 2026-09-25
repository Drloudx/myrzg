/**
 * 物品关联关系与同类物品预解析：public/data/parsed/item-relations.json
 * 建立物品与其上下游生产、种植、合成、锻造、怪物掉落、角色碎片、魔物蛋等多维关联索引，
 * 以及同系列品阶（宝箱、好感礼物、同功能药水、同技能符石、种子等）同类物品索引。
 */
import { buildItemRelations, buildSimilarItemsMap } from '../../src/utils/relationData.js'
import { readJson } from './shared.mjs'

export function buildRelationsFile(deps = {}) {
  const items = deps.itemData || readJson('parsed/items.json')
  const recipes = deps.recipeData || readJson('parsed/recipes.json')
  const heroes = deps.heroData || readJson('parsed/heroes.json')
  const pets = deps.petData || readJson('parsed/pets.json')
  const monsters = deps.monsterData || readJson('parsed/monsters.json')
  const itemSources = deps.itemSources || readJson('parsed/item-sources.json')

  const itemList = items?.items || items
  const relations = buildItemRelations({
    items: itemList,
    recipes: recipes?.recipes || recipes,
    heroes: heroes?.heroes || heroes,
    pets: pets?.pets || pets,
    monsters: monsters?.monsters || monsters,
    itemSources: itemSources || {}
  })

  const similar = buildSimilarItemsMap(itemList)

  const data = {
    relations,
    similar
  }

  return { file: 'parsed/item-relations.json', data }
}
