/**
 * 事件/探索图鉴构建期纯函数：由 randomEventInfo/area/reward/item/exploreArea/mon 原始 JSON
 * 生成事件与探索区域列表。与 EventsView.vue 的组装逻辑保持一致；
 * imgUrl 存相对路径（调用方再包 getImageUrl），奖励条目 icon 为相对路径（渲染时包 getImageUrl）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, BASE_REWARD_PATHS, getRarityName, parseRewardEntries } from './gameMappings.js'

// 消耗道具解析（consume.json: explore001 = 200G）
const CONSUME_MONEY = { explore001: 200, explore002: 400, explore003: 600 }
const consumeText = (consumeId) => {
  const money = CONSUME_MONEY[consumeId]
  return money ? `${money}G` : (consumeId || '')
}

export function buildEventData(maps) {
  const { eventJson, areaJson, rewardJson, itemJson, mapJson, exploreJson, monJson } = maps

  const eventMap = (eventJson && eventJson.datas) || eventJson || {}
  const areaData = (areaJson && areaJson.data) || {}
  const rewardMap = (rewardJson && rewardJson.datas) || {}
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
        if (!eventLoc[ev.typeId]) eventLoc[ev.typeId] = { maps: [], groups: [], chances: [] }
        eventLoc[ev.typeId].maps.push(mapId)
        eventLoc[ev.typeId].groups.push(g.group)
        if (typeof ev.chance === 'number') eventLoc[ev.typeId].chances.push(ev.chance)
      }
    }
  }

  const events = []
  for (const ev of Object.values(eventMap)) {
    if (!ev || !ev.typeId) continue
    const loc = eventLoc[ev.typeId]
    if (!loc || !loc.maps.length) continue
    const groupLabel = loc.groups.includes('rare2') ? '稀有' : (loc.groups.includes('rare1') ? '普通' : '')
    // 随机事件分组映射到品质体系（统一颜色）：普通 rare1 -> 品质1(灰)，稀有 rare2 -> 品质3(蓝)
    const groupQuality = loc.groups.includes('rare2') ? 3 : 1
    const chance = loc.chances.length ? loc.chances[0] : 0
    events.push({
      id: ev.typeId,
      name: ev.name || ev.typeId,
      des: ev.des || '',
      img: ev.img || ev.typeId,
      imgUrl: `/images/event/${(ev.img || ev.typeId)}.png`,
      buttonText: ev.buttonText || '',
      cd: ev.cd || 0,
      maps: [...new Set(loc.maps)],
      mapNames: [...new Set(loc.maps)].map(m => mapNameMap[m] || m),
      group: loc.groups[0] || '',
      badgeText: groupLabel,
      quality: groupQuality,
      chance,
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
      consumeText: consumeText(conf.consume),
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
