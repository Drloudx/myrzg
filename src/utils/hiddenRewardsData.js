/**
 * 场景宝箱（隐藏奖励）构建期纯函数：由 reward/roomCollectType/roomCollect/room/levelRoom/area
 * 原始 JSON 生成 { hidden: parsed-hidden.json 内容, sources: parsed-hidden-sources.json 内容 }。
 * 对应原 scripts/parse-hidden-rewards.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）共用。
 */

// 点位预览图映射（roomId -> public/images/hidden_prev 下的文件名）
// 来源：TapTap 帖子《被隐藏的物品点位》（moment/710617298674649775）主贴 27 张截图
// 命名规则：点位名 + _prev 后缀；无图点位不在此表
const HIDDEN_PREV_MAP = {
  'c0_area1_1': '营地周边-岔路口_prev.png',
  'c0_area1_6': '营地周边-隐居者的药田_prev.png',
  'c1_area1_2': '驿站住民区-驿站地窖1_prev.png',
  'c1_area1_10': '驿站住民区-驿站地窖2_prev.png',
  'c1_area1_9': '驿站住民区-驿站住民区_prev.png',
  'c1_area1_7': '驿站住民区-枯草小径_prev.png',
  'c1_area2_1': '风车平野-风车小镇_prev.png',
  'c1_area2_6': '风车平野-民居_prev.png',
  'c1_area3_6': '黑铁锻炉-维丝的秘密基地_prev.png',
  'c1_area4_4': '旧日修行所-碎石小径_prev.png',
  'c1_area5_3': '观星高地-观星高地外围_prev.png',
  'c2_area1_2': '巴诺姆村-工头小屋_prev.png',
  'c2_area1_8': '巴诺姆村-菲莉娜的契约台_prev.png',
  'c2_area1_3': '巴诺姆村-矿山道_prev.png',
  'c2_area1_6': '巴诺姆村-山腰道路_prev.png',
  'c2_area2_1': '灾害研究所-灾害研究所外部_prev.png',
  'c2_area2_5': '灾害研究所-外围山崖_prev.png',
  'c2_area3_1': '破败古院-破败古院_prev.png',
  'c2_area4_3': '山神之殒-安娜的勘测地_prev.png',
  'c3_area1_4': '尾指村-尾指村居民区_prev.png',
  'c3_area1_5': '尾指村-未知区域_prev.png',
  'c3_area2_2': '献水圣坛-水纹花海_prev.png',
  'c3_area3_3': '大市集-大市集居民区2_prev.png',
  'c3_area4_2': '贫民街-柏莉尔的家_prev.png',
  'c3_area4_3': '贫民街-贫民街二街道_prev.jpg',
  'c3_area4_4': '贫民街-贫民街民居_prev.png',
  'c3_area5_2': '蒸馏工厂废墟-蒸馏工厂内部_prev.png'
}
const getPrevImg = (roomId) => {
  const f = HIDDEN_PREV_MAP[roomId]
  return f ? `/images/hidden_prev/${f}` : ''
}

export function buildHiddenRewards(maps) {
  const { rewardRes, collectTypeRes, collectRes, roomRes, levelRoomRes, areaRes } = maps

  // 场景宝箱定位依赖完整房间表（含采集物引用），优先完整 room主.json，缺失回退 room.json（由脚本层选择传入）
  const rewardData = rewardRes.datas || rewardRes || {}
  const collectTypeData = collectTypeRes.datas || collectTypeRes || {}
  const collectData = collectRes.datas || collectRes || {}
  const roomData = roomRes.datas || roomRes || {}
  const levelRoomData = levelRoomRes.datas || levelRoomRes || {}
  const areaData = areaRes.datas || areaRes || {}

  const hiddenRewards = []
  const globalSources = {}
  const seen = new Set()

  for (const [rId, r] of Object.entries(rewardData)) {
    if (r.category && r.category.includes('场景宝箱')) {
      let collectTypes = []
      for (const [ctId, ct] of Object.entries(collectTypeData)) {
        if (ct.reward === r.typeId || ctId === r.typeId) {
          collectTypes.push(ct)
        }
      }

      let collects = []
      for (const ct of collectTypes) {
        for (const [cId, c] of Object.entries(collectData)) {
          if (c.collectTypeId === ct.collectTypeId) {
            collects.push({ ...c, baseName: ct.name, tip: ct.tip })
          }
        }
      }

      let rooms = []
      for (const c of collects) {
        for (const [rk, rm] of Object.entries(roomData)) {
          if (JSON.stringify(rm).includes(c.typeId)) {
            rooms.push({ room: rm, collectInfo: c, rewardInfo: r })
          }
        }
      }

      for (const mapping of rooms) {
        const rm = mapping.room
        let lr = levelRoomData[rm.typeId]
        if (!lr) {
          lr = Object.values(levelRoomData).find(l => JSON.stringify(l).includes(rm.typeId))
        }

        if (lr) {
          const areaId = lr.areaId
          const areaName = areaData[areaId] ? areaData[areaId].name : areaId

          const parts = (areaId || '').split('_')
          const bigMapId = parts[0] ? parts[0] + '_map' : 'unknown_map'
          const bigMapName = areaData[bigMapId] ? areaData[bigMapId].name : '未知大地图'

          let sortKey = '99_99'
          if (lr.roomTypeId && lr.roomTypeId.includes('area')) {
            sortKey = lr.roomTypeId.split('area')[1] || sortKey
          }

          const cName = mapping.collectInfo.baseName || mapping.collectInfo.name || '场景宝箱'
          const cTip = mapping.collectInfo.tip || ''

          const uniqueKey = `${lr.typeId}-${cName}-${JSON.stringify(mapping.rewardInfo.items)}`
          if (!seen.has(uniqueKey)) {
            seen.add(uniqueKey)

            hiddenRewards.push({
              bigMapId,
              bigMapName,
              areaId,
              areaName,
              roomId: lr.typeId || rm.typeId,
              roomName: lr.name || rm.name,
              collectName: cName,
              collectTip: cTip,
              sortKey,
              prevImg: getPrevImg(lr.typeId || rm.typeId),
              rewardItems: mapping.rewardInfo.items
            })

            const locStr = `${bigMapName} - ${areaName} - ${lr.name || rm.name}`
            if (mapping.rewardInfo.items) {
              mapping.rewardInfo.items.forEach(itemGrp => {
                if (itemGrp.rules) {
                  itemGrp.rules.forEach(rule => {
                    const tId = rule.typeId
                    if (!globalSources[tId]) globalSources[tId] = []
                    globalSources[tId].push({
                      type: 'hidden',
                      id: lr.typeId || rm.typeId,
                      name: '场景宝箱',
                      des: locStr,
                      bigMapId
                    })
                  })
                }
              })
            }
          }
        }
      }
    }
  }

  // Sort hidden rewards
  hiddenRewards.sort((a, b) => {
    if (a.bigMapId !== b.bigMapId) return a.bigMapId.localeCompare(b.bigMapId)
    const parseSort = (sk) => {
      const parts = sk.split('_').map(n => parseInt(n, 10))
      return (parts[0] || 0) * 1000 + (parts[1] || 0)
    }
    return parseSort(a.sortKey) - parseSort(b.sortKey)
  })

  return { hidden: hiddenRewards, sources: globalSources }
}
