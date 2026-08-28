/**
 * 角色图鉴预解析：public/data/parsed/heroes.json
 * 对应浏览器端 src/utils/heroParser.js 的 buildHeroData（同一纯函数）
 * 依赖 items/heroBuilder 共用物品表（由 index.mjs 传入）
 */
import { buildHeroData } from '../../src/utils/heroParser.js'
import { readJson } from './shared.mjs'

export function buildHeroesFile(itemData) {
  const rawMaps = {
    heroRes: readJson('hero/hero.json'),
    archivesRes: readJson('hero/heroArchives.json'),
    behaviorRes: readJson('hero/heroBehavior.json'),
    levelRes: readJson('hero/heroLevel.json'),
    mailRes: readJson('hero/heroMail.json'),
    rankRes: readJson('hero/heroRank.json'),
    skillUpgradeRes: readJson('hero/heroSkillUpgrade.json'),
    talkRes: readJson('hero/heroTalk.json'),
    starRes: readJson('hero/heroStar.json'),
    consumeRes: readJson('consume.json'),
    skillRes: readJson('skill.json'),
    skillTriggerRes: readJson('skillTrigger.json'),
    taskRes: readJson('task.json'),
    dialogSegmentsRes: readJson('parsed/dialogSegments.json'),
    dialogIndexRes: readJson('parsed/dialogIndex.json')
  }
  const data = buildHeroData({
    ...rawMaps,
    items: itemData.items,
    lanDict: itemData.lanDict,
    rewards: itemData.rewards
  })
  return { file: 'parsed/heroes.json', data }
}
