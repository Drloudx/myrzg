/**
 * 从解密版 battle.json 提取副本路线图所需的最小字段。
 * 原始配置保留在外部解包目录；提取结果写 raw/，再由 dungeons 预处理发布。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { configRoot, rawRoot } from '../dev/maintenance-paths.mjs'

const sourcePath = resolve(process.argv[2] || resolve(configRoot, 'battle.json'))
const outputPath = resolve(process.argv[3] || resolve(rawRoot, 'dungeonBattleRoutes.json'))
if (sourcePath === outputPath) throw new Error('The extracted routes must not overwrite the original battle table')
const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const routes = {}

for (const [battleId, battle] of Object.entries(source.datas || {})) {
  if (!battle?.category?.includes('副本') || !Array.isArray(battle.layers)) continue
  const layers = []
  for (const layer of battle.layers) {
    for (const layerData of layer?.layerDatas || []) {
      const map = layerData.map || {}
      const rooms = Object.values(layerData.rooms || {}).map(room => ({
        id: room.typeId,
        typeId: room.roomTypeId,
        name: room.name || room.typeId,
        icon: Number(room.roomIcon || 0),
        hidden: !!room.hiddenRoom,
        level: Number(room.gameLevel || 0),
        candidates: (room.randomRooms || []).map(candidate => ({
          typeId: candidate.roomTypeId,
          chance: Number(candidate.chance || 0),
          icon: Number(candidate.roomIcon || 0)
        }))
      }))
      layers.push({
        id: layerData.layerId || `layer-${layers.length + 1}`,
        name: layerData.name || `布局 ${layers.length + 1}`,
        chance: Number(layerData.chance || 0),
        startRoomId: layerData.startRoomId || '',
        endRoom: layerData.endRoom || '',
        startEntrance: layerData.startEntrance || '',
        size: map.size || { w: 1600, h: 1000 },
        nodes: map.levelRoom || [],
        links: (map.link || []).map(link => ({
          rooms: link.levelRooms || [],
          x1: Number(link.x1 || 0),
          y1: Number(link.y1 || 0),
          x2: Number(link.x2 || 0),
          y2: Number(link.y2 || 0)
        })),
        rooms
      })
    }
  }
  if (layers.length) routes[battleId] = { id: battleId, layers }
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify({ datas: routes }), 'utf8')
console.log(`extracted ${Object.keys(routes).length} dungeon routes -> ${outputPath}`)
