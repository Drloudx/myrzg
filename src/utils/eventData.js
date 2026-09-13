/**
 * 事件/探索图鉴构建期纯函数：由 randomEventInfo/area/reward/item/exploreArea/mon 原始 JSON
 * 生成事件与探索区域列表。与 EventsView.vue 的组装逻辑保持一致；
 * imgUrl 存相对路径（调用方再包 getImageUrl），奖励条目 icon 为相对路径（渲染时包 getImageUrl）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
import { BASE_REWARD_NAMES, getRarityName, parseRewardEntries } from './gameMappings.js'

const CONSUME_FIELDS = ['money', 'ke', 'payKe', 'ti', 'speed']

const consumeText = (consumeMap, itemMap, consumeId) => {
  if (!consumeId) return ''
  const consume = consumeMap[consumeId]
  if (!consume) return consumeId

  const parts = []
  for (const field of CONSUME_FIELDS) {
    const value = Number(consume[field] || 0)
    if (value > 0) parts.push(`${value} ${BASE_REWARD_NAMES[field] || field}`)
  }
  for (const entry of consume.items || []) {
    if (!entry?.typeId) continue
    const item = itemMap[entry.typeId]
    parts.push(`${item?.name || entry.typeId} x${Number(entry.num || 1)}`)
  }

  return parts.join('、') || consume.name || consumeId
}

export function buildEventData(maps) {
  const { eventJson, areaJson, rewardJson, consumeJson, itemJson, mapJson, exploreJson, monJson } = maps

  const eventMap = (eventJson && eventJson.datas) || eventJson || {}
  const areaData = (areaJson && areaJson.data) || {}
  const rewardMap = (rewardJson && rewardJson.datas) || {}
  const consumeMap = (consumeJson && consumeJson.datas) || consumeJson || {}
  const itemMap = (itemJson && itemJson.datas) || {}
  const mapNameData = (mapJson && mapJson.datas) || mapJson || {}
  const exploreData = (exploreJson && exploreJson.datas) || exploreJson || {}
  const monMap = (monJson && monJson.datas) || monJson || {}

  const mapNameMap = {}
  for (const k of ['c1_map', 'c2_map', 'c3_map', 'c4_map', 'c5_map']) {
    if (mapNameData[k]) mapNameMap[k] = mapNameData[k].name
  }

  // ===== 随机事件 =====
  const eventLoc = {}
  for (const [mapId, groups] of Object.entries(areaData)) {
    for (const g of groups) {
      for (const ev of g.events || []) {
        if (!eventLoc[ev.typeId]) eventLoc[ev.typeId] = []
        eventLoc[ev.typeId].push({
          mapId,
          group: g.group || '',
          chance: Number(ev.chance || 0)
        })
      }
    }
  }

  const groupCoolTime = (areaJson && areaJson.groupCoolTime) || {}

  const events = []
  for (const ev of Object.values(eventMap)) {
    if (!ev || !ev.typeId) continue
    const locations = eventLoc[ev.typeId]
    if (!locations || !locations.length) continue
    const groups = [...new Set(locations.map(loc => loc.group).filter(Boolean))]
    const maps = [...new Set(locations.map(loc => loc.mapId))]
    const groupLabel = groups.includes('rare2') ? '稀有' : (groups.includes('rare1') ? '普通' : '')
    // 随机事件分组映射到品质体系（统一颜色）：普通 rare1 -> 品质1(灰)，稀有 rare2 -> 品质3(蓝)
    const groupQuality = groups.includes('rare2') ? 3 : 1
    const group = groups[0] || ''
    const chance = locations[0]?.chance || 0
    events.push({
      id: ev.typeId,
      name: ev.name || ev.typeId,
      des: ev.des || '',
      img: ev.img || ev.typeId,
      imgUrl: `/images/event/${(ev.img || ev.typeId)}.png`,
      buttonText: ev.buttonText || '',
      maps,
      mapNames: maps.map(m => mapNameMap[m] || m),
      group,
      groupCooldown: Number(groupCoolTime[group] || 0),
      badgeText: groupLabel,
      quality: groupQuality,
      chance,
      consumeText: consumeText(consumeMap, itemMap, ev.consume),
      reward: parseRewardEntries(rewardMap, itemMap, ev.reward)
    })
  }

  // ===== 探索区域 =====
  const explores = []
  for (const [id, conf] of Object.entries(exploreData)) {
    if (!conf || !conf.name) continue
    const m = /^explore(\d+)_/.exec(id)
    const mapKey = m ? `c${m[1]}_map` : ''
    const enemys = (conf.enemys || []).map(eid => ({
      id: eid,
      name: (monMap[eid] && (monMap[eid].name || monMap[eid].monDes)) || eid
    }))
    explores.push({
      id,
      name: conf.name || id,
      des: conf.eventDes || '',
      img: conf.eventImg || '',
      imgUrl: `/images/event/${(conf.eventImg || 'none')}.png`,
      level: conf.level || 0,
      quality: conf.quality || 1,
      timeMinute: conf.timeMinute || 0,
      maxNum: conf.maxNum || 1,
      consumeText: consumeText(consumeMap, itemMap, conf.consume),
      mapKey,
      mapName: mapNameMap[mapKey] || '',
      positions: conf.positions || [],
      enemys,
      badgeText: getRarityName(conf.quality),
      reward: parseRewardEntries(rewardMap, itemMap, conf.reward)
    })
  }

  return { events, explores, mapNameMap }
}
