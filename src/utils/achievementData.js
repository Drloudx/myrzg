/**
 * 成就图鉴构建期纯函数：由 achievement/reward/item 原始 JSON 生成成就列表。
 * 与 AchievementView.vue 的组装逻辑保持一致（复用 gameMappings.parseRewardObject）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
import { parseRewardObject } from './gameMappings.js'

export function buildAchievementData(maps) {
  const { achJson, rewJson, itemJson } = maps

  const rawAchList = Object.values(achJson.achievement || {})
  const rewardMap = rewJson.datas || {}
  const itemMap = itemJson.datas || {}

  const assembled = rawAchList.map(a => {
    const rewardObj = rewardMap[a.reward] || {}
    const { rewards, rewardItemNames } = parseRewardObject(rewardObj, itemMap)

    return {
      id: a.typeId,
      name: a.name,
      des: a.des,
      category: a.category || 'adv',
      rewardId: a.reward,
      rewards,
      rewardItemNames
    }
  })

  return { achievements: assembled }
}
