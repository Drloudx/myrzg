/**
 * 魔物蛋图鉴预解析：public/data/parsed/pet-eggs.json
 * 对应浏览器端 src/utils/petEggsData.js 的 buildPetEggsData（同一纯函数）
 */
import { buildPetEggsData } from '../../src/utils/petEggsData.js'
import { readJson } from './shared.mjs'

export function buildPetEggsFile() {
  const data = buildPetEggsData({
    petJson: readJson('pet.json')
  })
  return { file: 'parsed/pet-eggs.json', data }
}
