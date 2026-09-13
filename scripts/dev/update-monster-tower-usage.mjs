/**
 * 从完整 tower/battle/room 配置生成怪物实际出现楼层的轻量索引。
 * 默认读取仓库同级 Config_decrypted；也可把配置目录作为第一个参数传入。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const configDir = resolve(process.argv[2] || join(repoRoot, '..', 'Config_decrypted'))
// 原始表已迁移到 raw/（git-ignored、不进 dist）；monsterTowerUsage 属构建期索引，同样落 raw/。
const rawDir = join(repoRoot, 'raw')
const outputFile = join(rawDir, 'monsterTowerUsage.json')
const readConfig = file => JSON.parse(readFileSync(join(configDir, file), 'utf8'))
const towerData = readConfig('tower.json').datas || {}
const battleData = readConfig('battle.json').datas || {}
const roomConfig = readConfig('room.json')
const roomData = roomConfig.datas || roomConfig
const monPath = join(rawDir, 'mon.json')
const monsterData = JSON.parse(readFileSync(monPath, 'utf8')).datas || {}

function isBossMonster(monsterId) {
  const monster = monsterData[monsterId]
  const keyList = Array.isArray(monster?.unitData?.keyList) ? monster.unitData.keyList : []
  return Number(monster?.monRank || 0) === 3 || keyList.includes('boss')
}

function collectValues(value, key, result = []) {
  if (!value || typeof value !== 'object') return result
  if (Array.isArray(value)) {
    value.forEach(entry => collectValues(entry, key, result))
    return result
  }
  Object.entries(value).forEach(([entryKey, entry]) => {
    if (entryKey === key) result.push(entry)
    collectValues(entry, key, result)
  })
  return result
}

function getRoomMonsterIds(room) {
  const rounds = room?.battleData?.monRounds || room?.monRounds || []
  return rounds.flatMap(round => (round?.mons || round?.monsters || [])
    .map(monster => String(monster?.typeId || ''))
    .filter(Boolean))
}

const appearances = new Map()
Object.entries(towerData).forEach(([towerId, tower]) => {
  ;(tower?.layers || []).forEach(layer => {
    ;(layer?.battles || []).forEach(battleRef => {
      const battleId = String(battleRef?.battleId || '')
      const roomIds = new Set(collectValues(battleData[battleId], 'roomTypeId').filter(value => typeof value === 'string'))
      roomIds.forEach(roomId => {
        new Set(getRoomMonsterIds(roomData[roomId])).forEach(monsterId => {
          if (!isBossMonster(monsterId)) return
          const towerMap = appearances.get(monsterId) || new Map()
          const entry = towerMap.get(towerId) || { towerId, towerName: tower?.name || towerId, floors: new Set() }
          entry.floors.add(Number(layer?.layer || 0))
          towerMap.set(towerId, entry)
          appearances.set(monsterId, towerMap)
        })
      })
    })
  })
})

const datas = Object.fromEntries([...appearances.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([monsterId, towerMap]) => [monsterId, [...towerMap.values()].map(entry => ({
    towerId: entry.towerId,
    towerName: entry.towerName,
    floors: [...entry.floors].filter(Boolean).sort((a, b) => a - b)
  }))]))

writeFileSync(outputFile, JSON.stringify({ generatedFrom: ['tower.json', 'battle.json', 'room.json'], datas }), 'utf8')
console.log(`已生成 ${outputFile}`)
console.log(`共 ${Object.keys(datas).length} 个怪物形态，${Object.values(datas).flatMap(entries => entries.flatMap(entry => entry.floors)).length} 条楼层记录`)
