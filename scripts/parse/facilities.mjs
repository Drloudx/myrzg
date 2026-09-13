import { buildFacilityData } from '../../src/utils/facilityData.js'
import { readJson } from './shared.mjs'

export function buildFacilitiesFile() {
  const data = buildFacilityData({
    formulaRes: readJson('formula.json'),
    consumeRes: readJson('consume.json'),
    rewardRes: readJson('reward.json'),
    itemRes: readJson('item.json'),
    homeItemRes: readJson('homeItem.json'),
    homeLevelRes: readJson('homeLevel.json'),
    campResearchRes: readJson('campResearch.json'),
    roomBuildRes: readJson('roomBuild.json'),
    conditionRes: readJson('condition.json'),
    taskRes: readJson('task.json'),
    itemExchangeRandomRes: readJson('itemExchangeRandom.json'),
    exchangeTeamRes: readJson('exchangeTeam.json'),
    equipGroupRes: readJson('equip/equipGroup.json')
  })
  return { file: 'parsed/facilities.json', data }
}
