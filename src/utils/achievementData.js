/**
 * 成就图鉴构建期纯函数：由 achievement/reward/item 原始 JSON 生成成就列表。
 * 与 AchievementView.vue 的组装逻辑保持一致（复用 gameMappings.parseRewardObject）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
import { getMapName, parseRewardObject } from './gameMappings.js'
import { isBlacklisted } from '../config/blacklist.js'

const asArray = value => Array.isArray(value) ? value : (value ? [value] : [])

// The client calculates achievement caps from these parameters rather than from
// the localized description. Keep the derived condition visible and accurate.
function getRequirementText(achievement) {
  const para = achievement.para && typeof achievement.para === 'object' ? achievement.para : {}
  const officialDescription = String(achievement.des || '').trim()
  const num = Number(para.num)
  const count = Number.isFinite(num) ? num : null

  switch (achievement.achiAction) {
    case 'checkPlayerLevel':
      return Number.isFinite(Number(para.level)) ? `营地等级达到 ${para.level}。` : ''
    case 'heroJobNum':
      return count === null ? '' : `累计拥有 ${count} 个伙伴。`
    case 'heroFavLevelNum': {
      const heroNum = Number(para.heroNum)
      const favLevel = Number(para.favValueLevel)
      if (!Number.isFinite(heroNum) || !Number.isFinite(favLevel)) return ''
      return `和 ${heroNum === 1 ? '一名' : heroNum + '名'}伙伴的好感等级达到 ${favLevel} 级。`
    }
    case 'taskTypeNumber':
      return count === null ? '' : `累计完成 ${count} 次委托任务。`
    case 'checkIncrement':
      if (count === null) return ''
      if (para.incrementName === 'money') return `累计赚取 ${count} 银币。`
      if (para.incrementName === 'petDispatch') return `累计卖出 ${count} 只魔物。`
      if (String(para.incrementName || '').startsWith('battle_')) return `累计完成 ${count} 次战斗。`
      return `累计完成目标 ${count} 次。`
    case 'checkFoodMakeNum':
      return count === null ? '' : `累计制作 ${count} 个料理。`
    case 'checkCollectNum':
      if (count === null) return ''
      return para.collectTypeId === 'tree' ? `累计伐木 ${count} 次。` : `累计采集 ${count} 次。`
    case 'checkKillMonTypeNum':
      return count === null ? '' : `累计解锁 ${count} 个魔物图鉴。`
    case 'monKillAll':
      return count === null ? '' : `累计消灭 ${count} 只魔物。`
    case 'monKillTag':
    case 'monKillTypeId':
      return officialDescription || (count === null ? '' : `累计消灭对应类别魔物 ${count} 只。`)
    case 'levelStageBattleNum':
      return count === null ? '' : `通关${getMapName(para.chapter)}的关卡，收集 ${count} 个星星。`
    case 'fastBattleTime':
      return officialDescription || (Number.isFinite(Number(para.time)) ? `在 ${para.time} 秒内通关指定关卡。` : '')
    case 'passBattle':
      return officialDescription || `通关指定关卡（共 ${asArray(para.battleTypeIds).length} 个）。`
    case 'taskComplete':
      return officialDescription || `完成指定剧情任务（共 ${asArray(para.taskTypeId).length} 项）。`
    case 'taskStepComplete':
      return officialDescription || (Number.isFinite(Number(para.taskStep)) ? `完成指定任务的第 ${para.taskStep} 步。` : '完成指定任务步骤。')
    case 'interaction':
      return officialDescription || `完成指定战斗条件（共 ${asArray(para.eventRecords).length} 项）。`
    case 'interactionPrefixNum':
      return officialDescription || (count === null ? '' : `累计完成同类交互 ${count} 次。`)
    default:
      return officialDescription
  }
}

const isPublicAchievement = achievement => (
  achievement && !achievement.alwaysHide
    && !isBlacklisted({ id: achievement.typeId, name: achievement.name })
)

export function buildAchievementData(maps) {
  const { achJson, rewJson, itemJson } = maps

  const rawAchList = Object.values(achJson.achievement || {})
  const rewardMap = rewJson.datas || {}
  const itemMap = itemJson.datas || {}

  const publicById = new Map(
    rawAchList.filter(isPublicAchievement).map(a => [String(a.typeId), a])
  )
  const previousById = new Map()
  rawAchList.filter(isPublicAchievement).forEach(a => {
    asArray(a.next).forEach(nextId => {
      const target = publicById.get(String(nextId))
      if (!target) return
      const key = String(target.typeId)
      if (!previousById.has(key)) previousById.set(key, [])
      previousById.get(key).push(a)
    })
  })

  const assembled = rawAchList.filter(a => !a.alwaysHide).map(a => {
    const rewardObj = rewardMap[a.reward] || {}
    const { rewards, rewardItemNames } = parseRewardObject(rewardObj, itemMap)
    const previousAchievements = (previousById.get(String(a.typeId)) || [])
      .map(item => ({ id: item.typeId, name: item.name }))
    const nextAchievements = asArray(a.next)
      .map(nextId => publicById.get(String(nextId)))
      .filter(Boolean)
      .map(item => ({ id: item.typeId, name: item.name }))

    return {
      id: a.typeId,
      name: a.name,
      des: a.des,
      category: a.category || 'adv',
      rewards,
      rewardItemNames,
      requirementText: getRequirementText(a),
      previousAchievements,
      nextAchievements
    }
  })

  return { achievements: assembled }
}
