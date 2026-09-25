/**
 * 物品/装备核心数据预解析：public/data/parsed/items.json
 * 对应浏览器端 src/utils/itemParser.js 的 buildItemData（同一纯函数）
 */
import { buildItemData } from '../../src/utils/itemParser.js'
import { buildRegularFacilityRecipes, indexRegularFacilityRecipes } from '../../src/utils/facilityData.js'
import { readJson } from './shared.mjs'
import { loadSkinModelImages } from './skin-models.mjs'

export function buildItemsFile() {
  const maps = {
    itemRes: readJson('item.json'),
    settingRes: readJson('gameSetting.json'),
    lanRes: readJson('lan.json'),
    avatarRes: readJson('avatars.json'),
    rewardRes: readJson('reward.json'),
    enchantRes: readJson('equip/equipEnchant.json'),
    triggerRes: readJson('skillTrigger.json'),
    equipGroupRes: readJson('equip/equipGroup.json'),
    equipSuitRes: readJson('equip/equipSuit.json'),
    itemAffixesRes: readJson('parsed/itemAffixes.json'),
    equipGlobalRes: readJson('equip/装备符石数据对应表equipGlobalConfig.json'),
    homeLevelRes: readJson('homeLevel.json'),
    heroRes: readJson('hero/hero.json'),
    heroStarRes: readJson('hero/heroStar.json'),
    skinRes: readJson('skin.json'),
    plantRes: readJson('plant.json'),
    petRes: readJson('pet.json'),
    campResearchRes: readJson('campResearch.json'),
    homeItemRes: readJson('homeItem.json'),
    itemExchangeRandomRes: readJson('itemExchangeRandom.json'),
    exchangeTeamRes: readJson('exchangeTeam.json'),
    consumeRes: readJson('consume.json'),
    formulaRes: readJson('formula.json'),
    playerInitRes: readJson('playerInit.json')
  }
  maps.skinModelImages = loadSkinModelImages(maps.skinRes)
  const data = buildItemData(maps)
  const facilityRecipes = indexRegularFacilityRecipes(buildRegularFacilityRecipes(maps))
  for (const item of data.items || []) {
    if (facilityRecipes[item.typeId]) item.facilityCrafting = facilityRecipes[item.typeId]
  }
  return { file: 'parsed/items.json', data }
}
