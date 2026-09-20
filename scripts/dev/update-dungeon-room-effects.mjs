/**
 * 从完整游戏配置提取副本女神房与泉水房效果，写回 raw/ 中的派生房间表。
 * 用法：npm run data:dungeons:effects -- [Config_decrypted 目录]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { configRoot as defaultConfigRoot, rawRoot } from './maintenance-paths.mjs'
import { buildRoomEffects } from '../parse/roomEffects.mjs'

const configRoot = resolve(process.argv[2] || defaultConfigRoot)
const outputPath = join(rawRoot, 'dungeonBattleRooms.json')

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const roomMap = readJson(join(configRoot, 'room.json'))
const buffMap = readJson(join(configRoot, 'buff.json'))
const buffTeamMap = readJson(join(configRoot, 'battleBuffTeam.json'))
const buffCardMap = readJson(join(configRoot, 'battleBuffCard.json'))
const extracted = readJson(outputPath)

const buffs = { buffMap, buffTeamMap, buffCardMap }

let effectRoomCount = 0
for (const [roomId, detail] of Object.entries(extracted.roomDetails || {})) {
  detail.effects = buildRoomEffects(roomMap[roomId]?.battleData, buffs)
  if (detail.effects.length) effectRoomCount += 1
}

writeFileSync(outputPath, JSON.stringify(extracted), 'utf8')
console.log(`updated ${effectRoomCount} room effects -> ${outputPath}`)
