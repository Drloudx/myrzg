/**
 * 房间结构化效果（石像祝福 / 泉水恢复）构建期共享实现。
 *
 * 从 `room.json[roomTypeId].battleData` 里递归找 `buffGive` / `spObjAddBuff` 动作，
 * 再沿 `battleBuffTeam → battleBuffCard → buff` 展开成玩家可读的选项。
 * 副本（update-dungeon-room-effects.mjs）与章节关卡（chapters.mjs）共用这一份，
 * 不在各自的解析里重复维护。
 */

const findActions = (value, actions = []) => {
  if (!value || typeof value !== 'object') return actions
  const type = String(value.actionType || '').trim()
  if (type === 'buffGive' || type === 'spObjAddBuff') actions.push(value)
  Object.values(value).forEach(child => findActions(child, actions))
  return actions
}

const percent = value => `${Math.round(Number(value || 0) * 100)}%`

const buildBuffEffect = (action, buffMap, buffTeamMap, buffCardMap) => {
  const team = buffTeamMap[action.actionPara?.buffTeamTypeId]
  if (!team) return null
  const cardIds = [...new Set((team.buffPool || []).flatMap(pool => pool.buffCards || []))]
  const options = cardIds.map(cardId => {
    const card = buffCardMap[cardId]
    const buff = buffMap[card?.buffId]
    return card ? {
      name: buff?.buffName || card.name || '随机增益',
      detail: card.des || buff?.buffDes || ''
    } : null
  }).filter(Boolean)
  return options.length ? {
    type: 'buff',
    title: '石像祝福',
    summary: `为全队存活角色随机附加以下 ${options.length > 1 ? '1 项' : '增益'}`,
    options,
    sourceId: action.actionPara.buffTeamTypeId
  } : null
}

const buildRecoverEffect = (action, buffMap) => {
  const buffId = action.actionPara?.buffId
  const buff = buffMap[buffId]
  if (!buff) return null
  const rate = Number(buff.para?.rate || 0)
  const summary = rate === 0
    ? '补满全队存活角色当前缺失的生命值与能量'
    : rate >= 1
      ? `恢复全队存活角色 ${percent(rate)} 最大生命值与能量（通常等同回满）`
      : `恢复全队存活角色 ${percent(rate)} 最大生命值与能量`
  return {
    type: 'recover',
    title: rate >= 1 || rate === 0 ? '完全恢复' : '泉水恢复',
    summary,
    options: [],
    sourceId: buffId
  }
}

/** @returns {Array} 去重后的效果列表，无效果时为空数组。 */
export function buildRoomEffects(roomBattleData, { buffMap = {}, buffTeamMap = {}, buffCardMap = {} } = {}) {
  const effects = findActions(roomBattleData)
    .map(action => String(action.actionType).trim() === 'buffGive'
      ? buildBuffEffect(action, buffMap, buffTeamMap, buffCardMap)
      : buildRecoverEffect(action, buffMap))
    .filter(Boolean)
  return [...new Map(effects.map(effect => [`${effect.type}:${effect.sourceId}`, effect])).values()]
}
