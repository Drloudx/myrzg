/**
 * 成就图鉴预解析：public/data/parsed/achievements.json
 * 对应浏览器端 src/utils/achievementData.js 的 buildAchievementData（同一纯函数）
 */
import { buildAchievementData } from '../../src/utils/achievementData.js'
import { readJson } from './shared.mjs'

export function buildAchievementsFile() {
  const data = buildAchievementData({
    achJson: readJson('achievement.json'),
    rewJson: readJson('reward.json'),
    itemJson: readJson('item.json')
  })
  return { file: 'parsed/achievements.json', data }
}
