/** Furniture encyclopedia data: public/data/parsed/furniture.json. */
import { buildFurnitureData } from '../../src/utils/furnitureData.js'
import { readJson } from './shared.mjs'

export function buildFurnitureFile() {
  const data = buildFurnitureData({
    homeItemRes: readJson('homeItem.json'),
    itemRes: readJson('item.json'),
    settingRes: readJson('gameSetting.json'),
    consumeRes: readJson('consume.json'),
    playerInitRes: readJson('playerInit.json'),
    conditionRes: readJson('condition.json'),
    taskRes: readJson('task.json')
  })
  return { file: 'parsed/furniture.json', data }
}
