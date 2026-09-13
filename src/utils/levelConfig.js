/**
 * 玩家等级表会额外保留一个“下一等级经验”边界档。
 * 例如当前正式可达 50 级，playerLevel.json 仍包含 level 51 的经验配置。
 */
export function resolvePlayablePlayerLevelCap(playerLevelRes) {
  const levelMap = playerLevelRes?.playerLevel || playerLevelRes || {}
  const configuredLevels = Object.entries(levelMap)
    .map(([key, value]) => Number(value?.level ?? key))
    .filter(level => Number.isFinite(level) && level > 0)

  if (!configuredLevels.length) return 1
  return Math.max(1, Math.max(...configuredLevels) - 1)
}
