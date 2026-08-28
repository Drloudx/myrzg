/**
 * 魔物图鉴预解析：public/data/parsed/pets.json
 * 对应浏览器端 src/utils/petParser.js 的 buildPetData（同一纯函数）
 */
import { buildPetData } from '../../src/utils/petParser.js'
import { readJson } from './shared.mjs'

export function buildPetsFile() {
  const maps = {
    petRes: readJson('pet/pet.json'),
    petLevelRes: readJson('pet/petLevel.json'),
    petSettingRes: readJson('pet/petSetting.json'),
    skillRes: readJson('skill.json'),
    skillTriggerRes: readJson('skillTrigger.json')
  }
  const data = buildPetData(maps)
  return { file: 'parsed/pets.json', data }
}
