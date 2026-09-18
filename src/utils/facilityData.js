import { buildSmithingData } from './itemParser.js'
import { parseRewardGroups } from './acquisitionRules.js'
import { buildCampFacilityData } from './campFacilityData.js'

export const FACILITY_DEFINITIONS = [
  { key: 'blacksmith', facilityId: 'sysBlacksmith', name: '锻造台', actionType: 'openBlackSmith' },
  { key: 'workbench', facilityId: 'sysWorkbench', name: '工作台', actionType: 'openWorkbench' },
  { key: 'alchemy', facilityId: 'sysAlchemy', name: '制药台', actionType: 'openAlchemy' },
  { key: 'mill', facilityId: 'sysMill', name: '磨坊', actionType: 'openMill' }
]

const rawDatas = resource => resource?.datas || resource || {}

const itemView = (typeId, rawItems) => {
  const item = rawItems[typeId] || {}
  return {
    typeId,
    name: item.name || typeId,
    img: item.img ? `/images/Common_ItemIcon/${item.img}.webp` : '',
    quality: Number(item.quality) || 1
  }
}

const parseOutput = (formula, rewards, rawItems) => {
  const rules = parseRewardGroups(formula.reward, { rewards, items: rawItems })
    .flatMap(group => group.rules)
    .filter(rule => rule.mode === 'item' && rule.typeId && rule.actualProb !== 0)
  const preferred = rules.find(rule => rule.typeId === formula.showItemTypeId) || rules[0]
  if (!preferred && rewards[formula.reward]) return null
  const typeId = preferred?.typeId || formula.showItemTypeId
  if (!typeId) return null
  const output = itemView(typeId, rawItems)
  const fallbackCount = Number(formula.itemCnt) || 1
  output.min = preferred?.min ?? fallbackCount
  output.max = preferred?.max ?? output.min
  return output
}

/** Parse the normal ProducePanel formulas used by the four camp facilities. */
export function buildRegularFacilityRecipes({ formulaRes = {}, consumeRes = {}, rewardRes = {}, itemRes = {} } = {}) {
  const formulas = rawDatas(formulaRes)
  const consumes = rawDatas(consumeRes)
  const rewards = rawDatas(rewardRes)
  const rawItems = rawDatas(itemRes)
  const facilityKeys = new Set(FACILITY_DEFINITIONS.map(facility => facility.key))

  return Object.entries(formulas)
    .filter(([, formula]) => facilityKeys.has(formula?.workbenchId) && formula.hide !== true)
    .map(([id, formula]) => {
      const output = parseOutput(formula, rewards, rawItems)
      if (!output) return null
      const materials = (consumes[formula.consume]?.items || [])
        .map(material => ({
          ...itemView(material.typeId, rawItems),
          num: Number(material.num) || 0
        }))
        .filter(material => material.typeId && material.num > 0)

      return {
        id,
        formulaId: formula.formulaId || id,
        facility: formula.workbenchId,
        facilityId: FACILITY_DEFINITIONS.find(entry => entry.key === formula.workbenchId)?.facilityId || '',
        facilityName: FACILITY_DEFINITIONS.find(entry => entry.key === formula.workbenchId)?.name || formula.workbenchId,
        mode: 'crafting',
        level: Number(formula.buildLevel) || 1,
        category: formula.category?.[1] || formula.category?.[0] || '制作',
        sort: Number(formula.sort) || 0,
        makeTime: Number(formula.makeTime) || 0,
        isImproved: formula.unlock === false,
        nextFormulaId: formula.next || '',
        output,
        materials
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level || a.sort - b.sort || a.id.localeCompare(b.id))
}

export function indexRegularFacilityRecipes(recipes = []) {
  const result = {}
  for (const recipe of recipes) {
    const typeId = recipe?.output?.typeId
    if (!typeId) continue
    if (!result[typeId]) result[typeId] = []
    result[typeId].push(recipe)
  }
  return result
}

export function buildFacilityData(maps = {}) {
  const rawItems = rawDatas(maps.itemRes)
  const homeItems = maps.homeItemRes?.furniture || {}
  const regularRecipes = buildRegularFacilityRecipes(maps)
  const regularByFacility = Object.groupBy
    ? Object.groupBy(regularRecipes, recipe => recipe.facility)
    : regularRecipes.reduce((groups, recipe) => {
        ;(groups[recipe.facility] ||= []).push(recipe)
        return groups
      }, {})
  const smithing = buildSmithingData(maps)
  const equipmentRecipes = []

  for (const [typeId, recipes] of Object.entries(smithing)) {
    const target = itemView(typeId, rawItems)
    for (const recipe of recipes) {
      equipmentRecipes.push({
        id: `${recipe.exchangeId}:${typeId}`,
        exchangeId: recipe.exchangeId,
        facility: 'blacksmith',
        facilityId: 'sysBlacksmith',
        facilityName: '锻造台',
        mode: 'equipment',
        level: Number(recipe.equipLevel) || 1,
        position: Number(recipe.position) || 0,
        output: target,
        materials: recipe.materials || [],
        qualityChances: recipe.qualityChances || [],
        outputMode: recipe.outputMode || 'equipGroup'
      })
    }
  }
  equipmentRecipes.sort((a, b) => a.level - b.level || a.position - b.position || a.output.typeId.localeCompare(b.output.typeId))

  const facilities = FACILITY_DEFINITIONS.map(definition => {
    const homeItem = homeItems[definition.facilityId] || {}
    const craftingRecipes = regularByFacility[definition.key] || []
    const modes = definition.key === 'blacksmith'
      ? [
          { key: 'equipment', name: '装备打造', recipes: equipmentRecipes },
          { key: 'crafting', name: '材料加工', recipes: craftingRecipes }
        ]
      : [{ key: 'crafting', name: '物品制作', recipes: craftingRecipes }]

    return {
      ...definition,
      icon: homeItem.icon ? `/images/BuildItem/${homeItem.icon}.webp` : '',
      description: homeItem.desc || '',
      modes: modes.map(mode => ({
        ...mode,
        levels: [...new Set(mode.recipes.map(recipe => recipe.level))].sort((a, b) => a - b)
      }))
    }
  })
  if (maps.homeLevelRes && maps.campResearchRes) facilities.push(buildCampFacilityData(maps, regularRecipes))
  return facilities
}
