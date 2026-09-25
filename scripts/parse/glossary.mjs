/**
 * 词条页预解析：public/data/parsed/glossary.json
 * 对应浏览器端 src/utils/glossaryData.js 的 buildGlossaryData（同一纯函数）。
 *
 * 除 buff 表外还要读角色/魔物/怪物/技能/物品表：用来建立「这个状态是谁在施加」的来源索引。
 * 另读 heroSkillUpgrade.json：它决定游戏内的技能等级上限（每个稀有度 12 行），
 * 词条库据此滤掉配置里有、客户端升不到的 Lv.13–21。
 */
import { buildGlossaryData } from '../../src/utils/glossaryData.js'
import { readJson } from './shared.mjs'

export function buildGlossaryFile(monstersData) {
  let monsters = monstersData
  if (!monsters) {
    try {
      monsters = readJson('parsed/monsters.json')?.monsters
    } catch {}
  }
  const data = buildGlossaryData({
    buffJson: readJson('buff.json'),
    heroJson: readJson('hero.json'),
    petJson: readJson('pet.json'),
    monJson: readJson('mon.json'),
    skillJson: readJson('skill.json'),
    skillTriggerJson: readJson('skillTrigger.json'),
    itemJson: readJson('item.json'),
    heroSkillUpgradeJson: readJson('heroSkillUpgrade.json'),
    fileMonJson: readJson('fileMon.json'),
    monstersJson: monsters
  })
  return { file: 'parsed/glossary.json', data }
}
