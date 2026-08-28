/**
 * 从完整游戏配置提取副本女神房与泉水房效果，写回网页使用的精简房间表。
 * 用法：npm run data:dungeons:effects -- [Config_decrypted 目录]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const configRoot = resolve(process.argv[2] || 'E:/Desktop/羊2/Config_decrypted')
const outputPath = join(repoRoot, 'public/data/dungeonBattleRooms.json')

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const roomMap = readJson(join(configRoot, 'room.json'))
const buffMap = readJson(join(configRoot, 'buff.json'))
const buffTeamMap = readJson(join(configRoot, 'battleBuffTeam.json'))
const buffCardMap = readJson(join(configRoot, 'battleBuffCard.json'))
const extracted = readJson(outputPath)

const findActions = (value, actions = []) => {
  if (!value || typeof value !== 'object') return actions
  const type = String(value.actionType || '').trim()
  if (type === 'buffGive' || type === 'spObjAddBuff') actions.push(value)
  Object.values(value).forEach(child => findActions(child, actions))
  return actions
}

const percent = value => `${Math.round(Number(value || 0) * 100)}%`

const buildBuffEffect = action => {
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

const buildRecoverEffect = action => {
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

let effectRoomCount = 0
for (const [roomId, detail] of Object.entries(extracted.roomDetails || {})) {
  const actions = findActions(roomMap[roomId]?.battleData)
  const effects = actions.map(action => String(action.actionType).trim() === 'buffGive'
    ? buildBuffEffect(action)
    : buildRecoverEffect(action))
    .filter(Boolean)
  const unique = new Map(effects.map(effect => [`${effect.type}:${effect.sourceId}`, effect]))
  detail.effects = [...unique.values()]
  if (detail.effects.length) effectRoomCount += 1
}

writeFileSync(outputPath, JSON.stringify(extracted), 'utf8')
console.log(`updated ${effectRoomCount} room effects -> ${outputPath}`)
