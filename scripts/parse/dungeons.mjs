/** 副本图鉴预解析：轻量索引 + 按关卡拆分的详情文件。 */
import { buildDungeonData } from '../../src/utils/dungeonData.js'
import { readJson } from './shared.mjs'

const compactReward = (entry = {}) => ({
  typeId: entry.typeId,
  name: entry.name,
  icon: entry.icon,
  quality: entry.quality,
  min: entry.min,
  max: entry.max,
  actualProb: entry.actualProb,
  cumulativeProb: entry.cumulativeProb,
  groupIndex: entry.groupIndex,
  kind: entry.kind,
  detail: entry.detail || undefined,
  groupRate: entry.groupRate,
  groupCount: entry.groupCount
})

const compactRewards = (entries = []) => entries.map(compactReward)

const compactMonster = (monster = {}) => ({
  typeId: monster.typeId,
  name: monster.name,
  count: monster.count,
  drops: (monster.drops || []).map(drop => ({
    collectTypeId: drop.collectTypeId,
    name: drop.name,
    dropRate: drop.dropRate,
    reward: compactRewards(drop.reward)
  }))
})

const compactVariant = (variant = {}) => ({
  typeId: variant.typeId,
  name: variant.name,
  kind: variant.kind,
  notFightRoom: variant.notFightRoom,
  npcCount: variant.npcCount,
  effects: (variant.effects || []).map(effect => ({
    type: effect.type,
    title: effect.title,
    summary: effect.summary,
    options: (effect.options || []).map(option => ({
      name: option.name,
      detail: option.detail
    }))
  })),
  monsters: (variant.monsters || []).map(compactMonster),
  waves: (variant.waves || []).map(wave => ({
    round: wave.round,
    monsters: (wave.monsters || []).map(monster => ({
      typeId: monster.typeId,
      name: monster.name,
      count: monster.count
    }))
  })),
  collections: (variant.collections || []).map(collection => ({
    collectTypeId: collection.collectTypeId,
    count: collection.count,
    name: collection.name,
    consume: collection.consume,
    consumeCost: collection.consumeCost,
    reward: compactRewards(collection.reward)
  })),
  source: variant.source ? { candidate: !!variant.source.candidate } : undefined
})

const compactBattle = (battle = {}) => ({
  id: battle.id,
  name: battle.name,
  level: battle.level,
  des: battle.des,
  consumeCost: battle.consumeCost,
  reward: compactRewards(battle.reward),
  previewReward: compactRewards(battle.previewReward),
  firstReward: compactRewards(battle.firstReward),
  specialDrops: {
    chestSources: (battle.specialDrops?.chestSources || []).map(source => ({
      rewardId: source.rewardId,
      name: source.name,
      tier: source.tier,
      sourceLabel: source.sourceLabel,
      reward: compactRewards(source.reward)
    }))
  },
  rooms: (battle.rooms || []).map(room => ({
    layer: room.layer,
    roomId: room.roomId,
    label: room.label,
    level: room.level,
    hidden: room.hidden,
    variants: (room.variants || []).map(compactVariant)
  })),
  routes: (battle.routes || []).map(route => ({
    id: route.id,
    name: route.name,
    chance: route.chance,
    startRoomId: route.startRoomId,
    endRoom: route.endRoom,
    startEntrance: route.startEntrance,
    size: route.size,
    nodes: (route.nodes || []).map(node => ({
      id: node.id,
      x: node.x,
      y: node.y,
      roomId: node.roomId,
      label: node.label,
      icon: node.icon,
      hidden: node.hidden,
      candidates: node.candidates,
      candidateOptions: (node.candidateOptions || []).map(option => ({ typeId: option.typeId })),
      variantOptions: (node.variantOptions || []).map(option => ({
        typeId: option.typeId,
        name: option.name,
        kind: option.kind,
        icon: option.icon
      }))
    })),
    links: route.links || []
  }))
})

const battleSearchText = (battle = {}) => {
  const words = [battle.name, battle.des, ...(battle.reward || []).map(entry => entry.name)]
  for (const room of battle.rooms || []) {
    for (const variant of room.variants || []) {
      words.push(variant.name, variant.kind)
      for (const effect of variant.effects || []) {
        words.push(effect.title, effect.summary)
        for (const option of effect.options || []) words.push(option.name, option.detail)
      }
      for (const monster of variant.monsters || []) {
        words.push(monster.name)
        for (const drop of monster.drops || []) words.push(...(drop.reward || []).map(entry => entry.name))
      }
      for (const collection of variant.collections || []) {
        words.push(collection.name, ...(collection.reward || []).map(entry => entry.name))
      }
    }
  }
  return [...new Set(words.filter(Boolean))].join(' ')
}

const battleSummary = (battle) => ({
  id: battle.id,
  name: battle.name,
  level: battle.level,
  searchText: battleSearchText(battle),
  detailFile: `dungeons/${battle.id}.json`
})

export function buildDungeonsFiles() {
  const fullData = buildDungeonData({
    instanceJson: readJson('instance.json'),
    battleJson: readJson('dungeonBattle.json'),
    battleRoomsJson: readJson('dungeonBattleRooms.json'),
    battleRoutesJson: readJson('dungeonBattleRoutes.json'),
    rewardJson: readJson('reward.json'),
    consumeJson: readJson('consume.json'),
    itemJson: readJson('item.json'),
    roomCollectJson: readJson('roomCollect.json'),
    roomCollectTypeJson: readJson('roomCollectType.json'),
    monJson: readJson('mon.json'),
    equipGroupJson: readJson('equip/equipGroup.json')
  })

  const files = []
  const detailIds = new Set()
  const dungeons = fullData.dungeons.map(dungeon => {
    const toSummary = (battle) => {
      if (!/^[A-Za-z0-9_-]+$/.test(battle.id)) throw new Error(`[dungeons] 非法关卡 ID，无法生成详情文件：${battle.id}`)
      if (detailIds.has(battle.id)) throw new Error(`[dungeons] 关卡 ID 重复：${battle.id}`)
      detailIds.add(battle.id)
      const detail = compactBattle(battle)
      files.push({ file: `parsed/dungeons/${battle.id}.json`, data: detail })
      return battleSummary(battle)
    }

    return {
      id: dungeon.id,
      name: dungeon.name,
      chapter: dungeon.chapter,
      mapName: dungeon.mapName,
      des: dungeon.des,
      icon: dungeon.icon,
      background: dungeon.background,
      battles: dungeon.battles.map(toSummary),
      storyBattles: (dungeon.storyBattles || []).map(toSummary)
    }
  })

  files.unshift({ file: 'parsed/dungeons.json', data: { dungeons, mapNames: fullData.mapNames } })
  return { files }
}
