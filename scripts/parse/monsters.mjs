/**
 * 怪物图鉴预解析：public/data/parsed/monsters.json
 * 内容 = { monsters(官方图鉴列表), handbook(全怪物图鉴) }
 * 对应浏览器端 src/utils/monsterParser.js 的 buildMonsterData / buildFullMonsterHandbook（同一纯函数）
 * 依赖物品表（由 index.mjs 传入）
 */
import { buildMonsterMaps, buildMonsterData, buildFullMonsterHandbook } from '../../src/utils/monsterParser.js'
import { readJson } from './shared.mjs'

export function buildMonstersFile(itemData) {
  const baseMaps = buildMonsterMaps({
    items: itemData.items,
    lanDict: itemData.lanDict,
    rewards: itemData.rewards,
    fileMonRes: readJson('fileMon.json'),
    monRes: readJson('mon.json'),
    skillRes: readJson('skill.json'),
    buffRes: readJson('buff.json'),
    equipGroupRes: readJson('equip/equipGroup.json')
  })
  const data = {
    monsters: buildMonsterData(baseMaps),
    handbook: buildFullMonsterHandbook(baseMaps)
  }
  return { file: 'parsed/monsters.json', data }
}
