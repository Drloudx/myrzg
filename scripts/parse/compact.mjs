/**
 * 副本 / 章节关卡详情产物的字段裁剪（构建期共享）。
 *
 * 这两个页面消费同一种「关卡 → 房间 → 候选变体 → 怪物 / 采集 / 效果 → 奖励」结构，
 * 展示字段必须一致，因此裁剪规则只在这里维护一份；
 * `dungeons.mjs`（副本图鉴）与 `chapters.mjs`（关卡图鉴）都从这里取。
 */

export const compactReward = (entry = {}) => ({
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

export const compactRewards = (entries = []) => entries.map(compactReward)

export const compactMonster = (monster = {}) => ({
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

export const compactVariant = (variant = {}) => ({
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

export const compactRoom = (room = {}) => ({
  layer: room.layer,
  roomId: room.roomId,
  label: room.label,
  level: room.level,
  hidden: room.hidden,
  variants: (room.variants || []).map(compactVariant)
})

export const compactRooms = (rooms = []) => rooms.map(compactRoom)
