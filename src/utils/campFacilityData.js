import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, BASE_REWARD_PATHS, parseRewardEntries, translateStatName } from './gameMappings.js'
import { formatFurnitureCondition } from './furnitureData.js'

const datas = resource => resource?.datas || resource || {}
const cleanText = text => String(text || '').replace(/[{}]/g, '').trim()
const researchTeams = { collect: '采集研究', make: '生产研究', adv: '冒险研究' }
const numericEntries = object => Object.entries(object || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) !== 0)
const addValues = (total, values) => {
  for (const [key, value] of numericEntries(values)) total[key] = Number(((total[key] || 0) + Number(value)).toFixed(6))
  return total
}

function parseCost(id, consumes, items) {
  if (!id) return []
  const consume = consumes[id]
  if (!consume) throw new Error(`Missing camp consume: ${id}`)
  return [
    ...Object.entries(BASE_REWARD_ICONS).flatMap(([key, typeId]) => Number(consume[key]) > 0 ? [{
      typeId, name: BASE_REWARD_NAMES[key], img: BASE_REWARD_PATHS[key], quality: Number(items[typeId]?.quality) || 1, num: Number(consume[key])
    }] : []),
    ...(consume.items || []).filter(entry => Number(entry.num) > 0).map(entry => {
      const item = items[entry.typeId]
      if (!item) throw new Error(`Missing camp material: ${entry.typeId}`)
      return { typeId: entry.typeId, name: item.name, img: `/images/Common_ItemIcon/${item.img}.png`, quality: Number(item.quality) || 1, num: Number(entry.num) }
    })
  ]
}

/** Buildings use current-level costs and next-level effects; research costs use the target level. */
export function buildCampFacilityData(maps, recipes = []) {
  const homes = datas(maps.homeLevelRes)
  const researches = datas(maps.campResearchRes)
  const items = datas(maps.itemRes)
  const consumes = datas(maps.consumeRes)
  const rewards = datas(maps.rewardRes)
  const furniture = maps.homeItemRes?.furniture || {}
  const conditions = maps.conditionRes?.gameConditions || datas(maps.conditionRes)
  const tasks = datas(maps.taskRes)

  const buildings = Object.entries(homes).map(([id, home]) => {
    const abilityTotal = {}
    const levels = Object.entries(home.level || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([key, info]) => {
      const level = Number(key)
      const next = home.level[level + 1]
      addValues(abilityTotal, info.playerAbility)
      const abilityStats = numericEntries(abilityTotal).flatMap(([key, value]) => key === 'orderWeight'
        ? [{ key, label: '货车载重上限加成', value: `+${value}` }] : [])
      const stats = numericEntries(info.att).map(([key, value]) => ({ key, label: translateStatName(key), value: `+${value}` }))
      if (id === 'center' && Number.isFinite(Number(maps.roomBuildRes?.camp?.decMax))) {
        stats.push({ key: 'decMax', label: '装饰值上限', value: Number(maps.roomBuildRes.camp.decMax) + (Number(info.campDecMaxChange) || 0) })
      }
      const levelRecipes = recipes.filter(recipe => recipe.facility === id && recipe.level === level && !recipe.isImproved)
      const rewardId = next ? info.reward || '' : ''
      if (rewardId && !rewards[rewardId]) throw new Error(`Missing camp reward: ${rewardId}`)
      return {
        level,
        icon: `/images/BuildItem/${info.icon || home.icon}.png`,
        description: cleanText(info.desc).split('\n').filter(line =>
          !(stats.some(stat => stat.key === 'decMax') && line.includes('装饰值上限'))
          && !(abilityStats.length && line.includes('货车载重上限'))).join('\n'),
        stats: [...stats, ...abilityStats],
        playerAbility: { ...abilityTotal },
        recipes: levelRecipes.map(recipe => ({ id: recipe.id, name: recipe.output.name, img: recipe.output.img, itemId: recipe.output.typeId, facility: recipe.facility, level: recipe.level })),
        appearance: info.homeItem && furniture[info.homeItem] ? { id: info.homeItem, name: furniture[info.homeItem].name } : null,
        upgrade: next ? {
          fromLevel: level, toLevel: level + 1,
          playerLevel: id === 'center' ? Number(info.playerLevel) || 0 : 0,
          centerLevel: id !== 'center' ? Number(info.centerLevel) || 0 : 0,
          consumeId: info.consume || '',
          costs: parseCost(info.consume, consumes, items),
          rewardId,
          rewards: parseRewardEntries(rewards, items, rewardId).entries.map(entry => ({
            typeId: entry.typeId, name: entry.name, img: entry.icon, quality: entry.quality, num: entry.count
          }))
        } : null
      }
    })
    return {
      id, name: home.name, icon: `/images/BuildItem/${home.icon}.png`, levels,
      unlockCondition: formatFurnitureCondition(conditions[home.condition], tasks)
    }
  })

  const research = Object.entries(researches).map(([id, entry]) => ({
    id, name: entry.name, description: cleanText(entry.des), team: entry.team,
    teamName: researchTeams[entry.team] || '其他研究',
    icon: `/images/CampCenterPanel/${entry.icon}.png`,
    prerequisite: entry.preResearch && researches[entry.preResearch]
      ? { id: entry.preResearch, name: researches[entry.preResearch].name, level: 1 } : null,
    levels: [...(entry.level || [])].sort((a, b) => a.level - b.level).map(info => ({
      level: Number(info.level), effect: cleanText(info.addDes),
      playerLevel: Number(info.condition?.playerLevel) || 0,
      building: info.condition?.workbenchType || '',
      buildingName: homes[info.condition?.workbenchType]?.name || '',
      buildingLevel: Number(info.condition?.workbenchLevel) || 0,
      consumeId: info.consume || '', costs: parseCost(info.consume, consumes, items),
      timeSeconds: Number(info.timeSeconds) || 0,
      action: info.action,
      // A research contributes only its selected level, not the sum of its earlier levels.
      playerAbility: info.action === 'playerAbility' ? { ...info.actionPara } : {},
      recipes: info.action === 'formula' ? (info.actionPara || []).map(formulaId => {
        const recipe = recipes.find(candidate => candidate.formulaId === formulaId || candidate.id === formulaId)
        if (!recipe) throw new Error(`Missing research formula: ${formulaId}`)
        return { id: recipe.id, name: recipe.output.name, itemId: recipe.output.typeId, facility: recipe.facility, level: recipe.level }
      }) : []
    }))
  }))

  return {
    key: 'camp', name: '营地', icon: buildings.find(entry => entry.id === 'center')?.icon || '',
    modes: [{ key: 'building', name: '营地升级' }, { key: 'research', name: '属性研究' }],
    buildings, research
  }
}

export function formatCampDuration(seconds) {
  let remaining = Math.max(0, Math.floor(Number(seconds) || 0))
  const parts = []
  for (const [size, unit] of [[86400, '天'], [3600, '小时'], [60, '分钟'], [1, '秒']]) {
    const value = Math.floor(remaining / size)
    if (value) parts.push(`${value} ${unit}`)
    remaining %= size
  }
  return parts.join(' ') || '0 秒'
}
