import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, BASE_REWARD_PATHS, getMapName, MAP_NAMES } from './gameMappings.js'

const asMap = (value) => value && typeof value === 'object' ? value : {}
const asArray = (value) => Array.isArray(value) ? value : []
const consumeCost = (consume) => consume ? {
  ti: Number(consume.ti || 0),
  money: Number(consume.money || 0),
  ke: Number(consume.ke || 0),
  payKe: Number(consume.payKe || 0),
  speed: Number(consume.speed || 0),
  items: asArray(consume.items)
} : null
// 蛇腹矿坑是主线矿坑/日常采集混合配置，不属于标准副本图鉴的常规副本列表。
const NON_STANDARD_INSTANCE_IDS = new Set(['dungeonD'])

function buildRewardEntries(reward, itemMap, source = null, equipConfig = null) {
  if (!reward) return []
  const entries = []

  for (const [field, iconId] of Object.entries(BASE_REWARD_ICONS)) {
    const count = Number(reward[field] || 0)
    if (count > 0) {
      entries.push({
        typeId: iconId,
        name: BASE_REWARD_NAMES[field],
        icon: BASE_REWARD_PATHS[field],
        quality: 0,
        min: count,
        max: count,
        actualProb: 1,
        kind: field,
        source
      })
    }
  }

  for (const [groupIndex, group] of asArray(reward.items).entries()) {
    const rules = asArray(group && group.rules)
    const totalChance = rules.reduce((sum, rule) => sum + Number(rule?.chance || 0), 0)
    const groupRate = Number(group?.rate ?? 1)
    const groupCount = Number(group?.num || 1)

    for (const rule of rules) {
      if (!rule) continue
      const mode = rule.mode || 'item'
      if (mode === 'equipGroup') {
        const equipGroup = equipConfig?.equipGroups?.[rule.equipTypeGroup]
        const qualityValues = asArray(equipConfig?.qualityGroups?.[rule.qualityGroup]).map(item => Number(item?.quality || 0))
        const quality = qualityValues.length ? Math.max(...qualityValues) : 0
        const actualProb = Math.min(1, (totalChance > 0 ? Number(rule.chance || 0) / totalChance : 1) * groupRate)
        const showId = equipGroup?.showItemTypeId || ''
        const candidateIds = showId ? [showId] : asArray(equipGroup?.type).map(item => item?.typeId).filter(Boolean)
        const ids = candidateIds.length ? candidateIds : ['equipGroup']
        ids.forEach(typeId => {
          const target = itemMap[typeId]
          entries.push({
            typeId,
            name: target?.name || (showId ? '随机装备' : equipGroup?.tip || '随机装备'),
            icon: target ? `/images/Common_ItemIcon/${target.img || target.typeId}.png` : '',
            quality: Number(quality || target?.quality || 0),
            min: Number(rule.min ?? groupCount ?? 1),
            max: Number(rule.max ?? rule.min ?? groupCount ?? 1),
            actualProb,
            cumulativeProb: 1 - Math.pow(1 - actualProb, groupCount),
            groupIndex,
            kind: 'equip',
            ruleMode: mode,
            equipTypeGroup: rule.equipTypeGroup || '',
            qualityGroup: rule.qualityGroup || '',
            detail: `随机装备 · ${equipGroup?.tip || rule.equipTypeGroup || '装备组'} · 最高品质 ${quality || '-' } · 装备等级 ${rule.equipLevel || '-'}`,
            groupRate,
            groupCount,
            source
          })
        })
        continue
      }
      const target = mode === 'item' ? itemMap[rule.typeId] : null
      const isEquip = mode === 'equip'
      const equipTarget = isEquip ? itemMap[rule.typeId] : null
      const min = Number(rule.min ?? groupCount ?? 1)
      const max = Number(rule.max ?? min)
      const chance = totalChance > 0 ? Number(rule.chance || 0) / totalChance : 1
      const actualProb = Math.min(1, chance * groupRate)
      entries.push({
        typeId: (equipTarget || target)?.typeId || rule.typeId || mode,
        name: (equipTarget || target)?.name || (isEquip ? '具体装备' : rule.typeId || mode),
        icon: (equipTarget || target) ? `/images/Common_ItemIcon/${(equipTarget || target).img || (equipTarget || target).typeId}.png` : '',
        quality: Number((equipTarget || target)?.quality || rule.quality || 0),
        min,
        max,
        actualProb,
        cumulativeProb: 1 - Math.pow(1 - actualProb, groupCount),
        groupIndex,
        kind: isEquip ? 'item' : 'item',
        ruleMode: mode,
        detail: isEquip ? `固定装备规则 · 品质 ${rule.quality || equipTarget?.quality || '-'} · 装备等级 ${rule.equipLevel || '-'}` : '',
        groupRate,
        groupCount,
        source
      })
    }
  }
  return entries
}

function roomKind(detail, collectType) {
  const tags = collectType?.tags || []
  if (tags.includes('金宝箱')) return '金宝箱'
  if (tags.includes('银宝箱')) return '银宝箱'
  if (tags.includes('铜宝箱')) return '铜宝箱'
  if (tags.includes('BOSS')) return 'BOSS'
  if (tags.includes('副本')) return collectType?.name || detail?.jigDes || '副本交互'
  if (detail?.jigDes?.includes('恢复')) return '恢复'
  if (detail?.jigDes?.includes('商店')) return '商店'
  if (detail?.jigDes?.includes('拼图')) return '事件'
  return detail?.jigDes || '战斗房间'
}

function buildRoomVariant(roomTypeId, roomDetails, collectMap, collectTypeMap, rewardMap, consumeMap, itemMap, monMap, equipConfig, source) {
  const detail = roomDetails[roomTypeId]
  if (!detail) return null
  const monRounds = asArray(detail.monRounds)
  const monsterMap = new Map()
  const waves = []
  const collections = []
  monRounds.forEach((round, roundIndex) => {
    const waveNumber = Number(round.round || roundIndex + 1)
    const waveMonsterMap = new Map()
    asArray(round.mons).forEach(mon => {
      const key = mon.typeId || mon.monId
      if (!key) return
      const waveMonster = waveMonsterMap.get(key) || { typeId: key, name: monMap[key]?.name || key, count: 0, rank: mon.monRank || 0 }
      waveMonster.count += 1
      waveMonsterMap.set(key, waveMonster)
      const current = monsterMap.get(key) || { typeId: key, name: monMap[key]?.name || key, count: 0, rounds: [], rank: mon.monRank || 0, drops: [] }
      current.count += 1
      if (!current.rounds.includes(waveNumber)) current.rounds.push(waveNumber)
      if (mon.caijiTypeId || mon.reward) {
        const collectId = mon.caijiTypeId || ''
        const collectObject = collectMap[collectId]
        const collectTypeId = collectObject?.collectTypeId || collectId
        const collectType = collectTypeMap[collectTypeId]
        const rewardId = mon.reward || collectType?.reward || ''
        const reward = rewardMap[rewardId]
        const collectName = collectObject?.name || collectType?.name || collectId || '怪物掉落'
        const rewardEntries = buildRewardEntries(reward, itemMap, { kind: 'monster', roomTypeId, collectTypeId: collectId, label: collectName }, equipConfig)
        current.drops.push({ collectTypeId: collectId, name: collectName, dropRate: mon.dropRate || 0, rewardId, reward: rewardEntries })
      }
      monsterMap.set(key, current)
    })
    if (waveMonsterMap.size) waves.push({ round: waveNumber, monsters: [...waveMonsterMap.values()] })
  })
  const collectionMap = new Map()
  asArray(detail.spObj).forEach(obj => {
    const collectId = obj.caijiTypeId
    if (!collectId) return
    const collectObject = collectMap[collectId]
    const collectTypeId = collectObject?.collectTypeId || collectId
    const collectType = collectTypeMap[collectTypeId]
    const rewardId = collectType?.reward || ''
    const collectName = collectType?.name || collectObject?.name || collectId
    const rewardEntries = buildRewardEntries(rewardMap[rewardId], itemMap, { kind: 'collect', roomTypeId, collectTypeId: collectId, label: collectName }, equipConfig)
    const consume = collectType?.consume || ''
    const key = `${collectTypeId}|${rewardId}|${consume}`
    const existing = collectionMap.get(key)
    if (existing) {
      existing.count += 1
      if (!existing.objectTypeIds.includes(collectId)) existing.objectTypeIds.push(collectId)
      return
    }
    const collection = {
      collectTypeId,
      objectTypeIds: [collectId],
      count: 1,
      name: collectName,
      kind: roomKind(detail, collectType),
      tags: collectType?.tags || [],
      consume,
      consumeCost: consumeCost(consumeMap[consume]),
      rewardId,
      reward: rewardEntries
    }
    collectionMap.set(key, collection)
    collections.push(collection)
  })
  const monsters = [...monsterMap.values()]
  const kind = collections[0]?.kind || (detail.notFightRoom ? (detail.jigDes || '事件') : (detail.jigDes || '战斗房间'))
  const configuredName = detail.jigDes || detail.name || ''
  return {
    typeId: roomTypeId,
    name: configuredName && configuredName !== roomTypeId ? configuredName : kind,
    desc: detail.desc || '',
    kind,
    notFightRoom: detail.notFightRoom,
    linkStage: detail.linkStage,
    npcCount: asArray(detail.npcList).length,
    effects: asArray(detail.effects),
    monsters,
    waves,
    collections,
    source
  }
}

function buildBattleRooms(fullBattle, roomDetails, collectMap, collectTypeMap, rewardMap, consumeMap, itemMap, monMap, equipConfig) {
  const rooms = []
  asArray(fullBattle?.layers).forEach((layer, layerIndex) => {
    const layerDatas = Array.isArray(layer) ? layer : asArray(layer?.layerDatas)
    layerDatas.forEach(layerData => {
      Object.values(layerData?.rooms || {}).forEach(room => {
        const candidates = [room.roomTypeId, ...asArray(room.randomRooms).map(item => item.roomTypeId)].filter(Boolean)
        const variants = [...new Set(candidates)].map((roomTypeId, index) => buildRoomVariant(roomTypeId, roomDetails, collectMap, collectTypeMap, rewardMap, consumeMap, itemMap, monMap, equipConfig, { layer: layerIndex + 1, roomId: room.typeId, candidate: index > 0 }))
          .filter(Boolean)
        if (variants.length) {
          const configuredLabel = room.name || ''
          const label = configuredLabel && configuredLabel !== room.typeId && !configuredLabel.includes('未命名') ? configuredLabel : variants[0].name
          rooms.push({ layer: layerIndex + 1, roomId: room.typeId, label, level: room.gameLevel || 0, hidden: !!room.hiddenRoom, icon: room.roomIcon || 0, variants })
        }
      })
    })
  })
  return rooms
}

function fallbackRoomIcon(kind) {
  const value = String(kind || '')
  if (/BOSS|首领/.test(value)) return 3
  if (/精英/.test(value)) return 2
  if (/战斗|敌人|蛇怪|混搭|困难|普通/.test(value)) return 1
  if (/宝箱/.test(value)) return 20
  if (/黑商|黑商人/.test(value)) return 22
  if (/商店|商人/.test(value)) return 19
  if (/采集|矿|草|蘑菇|水露|星象/.test(value)) return 31
  if (/恢复/.test(value)) return 4
  if (/buff|女神/i.test(value)) return 21
  return 1
}

function buildBattleRoutes(routeBattle, rooms) {
  if (!routeBattle?.layers?.length) return []
  const roomMap = new Map((rooms || []).map(room => [room.roomId, room]))
  return routeBattle.layers.map((layer, layerIndex) => ({
    id: layer.id || `layer-${layerIndex + 1}`,
    name: layer.name || `布局 ${layerIndex + 1}`,
    chance: Number(layer.chance || 0),
    startRoomId: layer.startRoomId || '',
    endRoom: layer.endRoom || '',
    startEntrance: layer.startEntrance || '',
    size: layer.size || { w: 1600, h: 1000 },
    nodes: asArray(layer.nodes).map(node => {
      const room = roomMap.get(node.typeId)
      const routeRoom = asArray(layer.rooms).find(item => item.id === node.typeId)
      const fallbackIcon = routeRoom?.icon || routeRoom?.candidates?.find(candidate => candidate.icon)?.icon || 0
      const candidateIconMap = new Map(asArray(routeRoom?.candidates).map(candidate => [candidate.typeId, candidate.icon]))
      const candidateFallbackIcon = Number(routeRoom?.candidates?.find(candidate => candidate.icon)?.icon || room?.icon || fallbackIcon || 0)
      const variantOptions = asArray(room?.variants).map((variant, index) => ({
        typeId: variant.typeId,
        name: variant.name,
        kind: variant.kind,
        icon: Number(candidateIconMap.get(variant.typeId) || (index === 0 ? room?.icon : 0) || candidateFallbackIcon || fallbackRoomIcon(variant.kind))
      }))
      return {
        id: node.typeId,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
        roomId: room?.roomId || node.typeId,
        label: room?.label || node.typeId,
        icon: room?.icon || Number(node.icon || fallbackIcon),
        hidden: room?.hidden || false,
        candidates: Math.max(0, variantOptions.length - 1),
        candidateOptions: asArray(routeRoom?.candidates),
        variantOptions
      }
    }),
    links: asArray(layer.links).map(link => ({
      rooms: asArray(link.rooms),
      x1: Number(link.x1 || 0),
      y1: Number(link.y1 || 0),
      x2: Number(link.x2 || 0),
      y2: Number(link.y2 || 0)
    }))
  }))
}

function buildSpecialChestSources(rooms, rewardMap, itemMap, equipConfig) {
  const sources = new Map()
  asArray(rooms).forEach(room => asArray(room.variants).forEach(variant => {
    asArray(variant.collections).forEach(collection => {
      const name = String(collection.name || collection.kind || '')
      const rewardId = collection.rewardId || ''
      if (!/[金银铜]宝箱/.test(name) || !rewardId || sources.has(rewardId)) return
      const reward = rewardMap[rewardId]
      if (!reward) return
      const tier = name.includes('金') ? 3 : name.includes('银') ? 2 : name.includes('铜') ? 1 : 0
      sources.set(rewardId, {
        rewardId,
        name,
        tier,
        sourceLabel: '',
        reward: buildRewardEntries(reward, itemMap, { kind: 'special-chest', rewardId, label: name }, equipConfig)
      })
    })
  }))

  return [...sources.values()]
    .filter(source => source.reward.length)
    .sort((a, b) => b.tier - a.tier
      || a.rewardId.localeCompare(b.rewardId, 'zh-CN'))
}

function buildBattle(instance, battle, battleConfig, fullBattle, routeBattle, rewardMap, consumeMap, itemMap, roomDetails, collectMap, collectTypeMap, monMap, equipConfig) {
  const config = asMap(battleConfig)
  const battleText = `${battle?.name || ''} ${config.name || ''} ${battle?.dungeonBattle || ''}`
  const disabled = /停用/.test(battleText)
  const rewardId = config.reward || config.showReward || ''
  const previewRewardId = config.showReward && config.showReward !== config.reward ? config.showReward : ''
  const firstRewardId = config.firstReward && config.firstReward !== '0' ? config.firstReward : ''
  const reward = rewardMap[rewardId] || null
  const previewReward = rewardMap[previewRewardId] || null
  const firstReward = rewardMap[firstRewardId] || null
  const consume = consumeMap[config.consume] || null
  const chapter = instance.chapter || String(config.category?.find(v => /^c\d/.test(v)) || '').match(/^c\d/)?.[0] || ''

  const rooms = buildBattleRooms(fullBattle, roomDetails, collectMap, collectTypeMap, rewardMap, consumeMap, itemMap, monMap, equipConfig)
  return {
    id: battle.dungeonBattle,
    name: battle.name || config.name || battle.dungeonBattle,
    level: Number(config.battleLevel || battle.level || 0),
    des: config.des || battle.des || '',
    consume: config.consume || '',
    consumeCost: consumeCost(consume),
    rewardId,
    previewRewardId,
    firstRewardId,
    reward: buildRewardEntries(reward, itemMap, null, equipConfig),
    previewReward: buildRewardEntries(previewReward, itemMap, null, equipConfig),
    firstReward: buildRewardEntries(firstReward, itemMap, null, equipConfig),
    rewardMeta: reward ? { exp: reward.exp || 0, money: reward.money || 0, tip: reward.tip || '' } : null,
    rooms,
    specialDrops: { chestSources: buildSpecialChestSources(rooms, rewardMap, itemMap, equipConfig) },
    routes: buildBattleRoutes(routeBattle, rooms),
    category: config.category || [],
    chapter,
    bossImg: battle.bossImg || '',
    showCondition: battle.showCondition || '',
    unlockCondition: battle.unlockCondition || '',
    buttonType: Number(battle.buttonType || 0),
    disabled,
    story: !disabled && (/大扫除|回忆|测试/.test(battleText) || /^sldsd_/.test(battle.dungeonBattle)),
    storyReason: /大扫除/.test(battleText) ? '剧情入口' : '剧情/旧版入口'
  }
}

export function buildDungeonData({ instanceJson, battleJson, battleRoomsJson, battleRoutesJson, rewardJson, consumeJson, itemJson, roomCollectJson, roomCollectTypeJson, monJson, equipGroupJson }) {
  const instances = asMap(instanceJson?.datas)
  const battles = asMap(battleJson?.datas)
  const rewards = asMap(rewardJson?.datas)
  const consumes = asMap(consumeJson?.datas)
  const items = asMap(itemJson?.datas)
  const roomDetails = asMap(battleRoomsJson?.roomDetails)
  const fullBattles = asMap(battleRoomsJson?.datas)
  const routeBattles = asMap(battleRoutesJson?.datas)
  const collectMap = asMap(roomCollectJson?.datas)
  const collectTypes = asMap(roomCollectTypeJson?.datas)
  const monMap = asMap(monJson?.datas)
  const equipConfig = equipGroupJson || null
  const itemMap = items

  const dungeonList = Object.entries(instances)
    .filter(([id, instance]) => !NON_STANDARD_INSTANCE_IDS.has(id) && instance && instance.chapter && Array.isArray(instance.battles))
    .map(([id, instance]) => {
      const visibleBattles = instance.battles
        .map(entry => buildBattle(instance, entry, battles[entry.dungeonBattle], fullBattles[entry.dungeonBattle], routeBattles[entry.dungeonBattle], rewards, consumes, itemMap, roomDetails, collectMap, collectTypes, monMap, equipConfig))
        .filter(battle => !battle.disabled && battle.rewardId && (battle.category.length === 0 || battle.category[0] === '副本'))
      const gameBattles = visibleBattles.filter(battle => !battle.story)
      const storyBattles = visibleBattles.filter(battle => battle.story)

      return {
        id,
        name: instance.name || id,
        chapter: instance.chapter,
        mapName: getMapName(instance.chapter),
        des: instance.des || '',
        icon: instance.icon ? `/images/instancepanel/${instance.icon}.png` : '',
        background: instance.view?.bgImg ? `/images/instancepanel/${instance.view.bgImg}.png` : '',
        battles: gameBattles,
        storyBattles
      }
    })
    .filter(dungeon => dungeon.battles.length > 0 || dungeon.storyBattles.length > 0)

  // 旧版 sldsd_* 入口有时独立挂在同地图的另一个 instance（例如“采石场”），
  // 但游戏实际入口已经迁移到正式副本。把它们并入同阶段正式卡片，避免出现 0 个正式关卡的孤立卡片。
  const formalDungeons = dungeonList.filter(dungeon => dungeon.battles.length > 0)
  const storyOnlyDungeons = dungeonList.filter(dungeon => dungeon.battles.length === 0 && dungeon.storyBattles.length > 0)
  storyOnlyDungeons.forEach(storyDungeon => {
    const stageIds = new Set(storyDungeon.storyBattles.map(battle => battle.category?.[1]).filter(Boolean))
    const target = formalDungeons.find(dungeon => dungeon.chapter === storyDungeon.chapter && dungeon.battles.some(battle => stageIds.has(battle.category?.[1])))
    if (target) target.storyBattles.push(...storyDungeon.storyBattles)
  })

  const dungeons = formalDungeons.filter(dungeon => dungeon.battles.length > 0).sort((a, b) => {
      const ai = Object.keys(MAP_NAMES).indexOf(a.chapter)
      const bi = Object.keys(MAP_NAMES).indexOf(b.chapter)
      const aMinLevel = Math.min(...a.battles.map(battle => Number(battle.level || 0)).filter(level => level > 0), Number.MAX_SAFE_INTEGER)
      const bMinLevel = Math.min(...b.battles.map(battle => Number(battle.level || 0)).filter(level => level > 0), Number.MAX_SAFE_INTEGER)
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
        || aMinLevel - bMinLevel
        || a.name.localeCompare(b.name, 'zh-CN')
    })

  return { dungeons, mapNames: MAP_NAMES }
}

export function getDungeonSummary(dungeon) {
  const battles = dungeon?.battles || []
  const itemIds = new Set()
  battles.forEach(battle => (battle.reward || []).forEach(entry => {
    if (entry.kind === 'item' && entry.typeId) itemIds.add(entry.typeId)
  }))
  return { battleCount: battles.length, itemCount: itemIds.size }
}
