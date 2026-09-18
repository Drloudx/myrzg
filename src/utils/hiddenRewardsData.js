/**
 * 场景宝箱（隐藏奖励）构建期纯函数：由 reward/roomCollectType/roomCollect/room/levelRoom/area
 * 原始 JSON 生成 { hidden: parsed-hidden.json 内容, sources: parsed-hidden-sources.json 内容 }。
 * 对应原 scripts/parse-hidden-rewards.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）共用。
 */

// 点位预览图映射（roomId -> { roomName, file, variants? }）。
// roomName 取自当前 levelRoom 表，便于按关卡核对/补图；暂无图片时 file 留空。
// 同一关卡有多个采集点时，在 variants 中按 collectId 分别配图。
// 来源：TapTap 帖子《被隐藏的物品点位》（moment/710617298674649775）主贴 27 张截图
// 命名规则：点位名 + _prev 后缀。
const HIDDEN_PREV_MAP = {
  'c0_area1_1': { roomName: '三岔路口', file: '营地周边-岔路口_prev.webp' },
  'c0_area1_6': { roomName: '隐居者的药田', file: '营地周边-隐居者的药田_prev.webp' },
  'c1_area1_1': { roomName: '驿站住民区', file: '驿站住民区-驿站住民区_prev.webp' },
  'c1_area1_2': { roomName: '驿站地窖', file: '驿站住民区-驿站地窖1_prev.webp' },
  'c1_area1_10': { roomName: '驿站地窖', file: '驿站住民区-驿站地窖2_prev.webp' },
  'c1_area1_7': { roomName: '枯草小径', file: '驿站住民区-枯草小径_prev.webp' },
  'c1_area1_9': { roomName: '枯草小径', file: '' },
  'c1_area2_1': { roomName: '风车小镇', file: '风车平野-风车小镇_prev.webp' },
  'c1_area2_6': { roomName: '民居', file: '风车平野-民居_prev.webp' },
  'c1_area3_6': { roomName: '维丝的秘密基地', file: '黑铁锻炉-维丝的秘密基地_prev.webp' },
  'c1_area4_4': { roomName: '碎石小径', file: '旧日修行所-碎石小径_prev.webp' },
  'c1_area5_3': { roomName: '观星高地外围', file: '观星高地-观星高地外围_prev.webp' },
  'c2_area1_2': { roomName: '工头小屋', file: '巴诺姆村-工头小屋_prev.webp' },
  'c2_area1_3': { roomName: '矿山道', file: '巴诺姆村-矿山道_prev.webp' },
  'c2_area1_6': { roomName: '山腰道路', file: '巴诺姆村-山腰道路_prev.webp' },
  'c2_area1_8': { roomName: '菲莉娜的契约台', file: '巴诺姆村-菲莉娜的契约台_prev.webp' },
  'c2_area2_1': { roomName: '灾害研究所（外部）', file: '灾害研究所-灾害研究所外部_prev.webp' },
  'c2_area2_3': { roomName: '研究所外围', file: '' },
  'c2_area2_5': { roomName: '外围山崖', file: '灾害研究所-外围山崖_prev.webp' },
  'c2_area3_1': { roomName: '破败古院', file: '破败古院-破败古院_prev.webp' },
  'c2_area3_2': { roomName: '古院后院', file: '' },
  'c2_area4_3': { roomName: '安娜的勘测地', file: '山神之殒-安娜的勘测地_prev.webp' },
  'c2_area4_4': { roomName: '山神之殒外围', file: '' },
  'c3_area1_3': { roomName: '长老小屋内', file: '' },
  'c3_area1_4': { roomName: '尾指村居民区', file: '尾指村-尾指村居民区_prev.webp' },
  'c3_area1_5': { roomName: '尾指村居民区', file: '尾指村-未知区域_prev.webp' },
  'c3_area2_2': { roomName: '水纹花海', file: '献水圣坛-水纹花海_prev.webp' },
  'c3_area3_3': { roomName: '大市集居民区2', file: '大市集-大市集居民区2_prev.webp' },
  'c3_area3_6': { roomName: '赛弗的藏身处', file: '' },
  'c3_area4_2': { roomName: '柏莉尔的家', file: '贫民街-柏莉尔的家_prev.webp' },
  'c3_area4_3': { roomName: '贫民街·二街道', file: '贫民街-贫民街二街道_prev.webp' },
  'c3_area4_4': { roomName: '贫民街·民居', file: '贫民街-贫民街民居_prev.webp' },
  'c3_area5_2': { roomName: '蒸馏工厂内部', file: '蒸馏工厂废墟-蒸馏工厂内部_prev.webp' },
  'c4_area1_4': { roomName: '住民区2', file: '' },
  'c4_area1_6': { roomName: '艾薇杜尔的故居', file: '' },
  'c4_area1_7': { roomName: '金弦宴堂', file: '' },
  'c4_area2_1': { roomName: '布拉格乌尔庄园', file: '' },
  'c4_area2_4': { roomName: '庄园外围', file: '' },
  'c4_area3_2': { roomName: '北部猎场', file: '' },
  'c4_area4_1': { roomName: '艾伦瑟的故居', file: '' },
  'c4_area4_3': { roomName: '寂静林野', file: '' },
  'c4_area5_2': { roomName: '巨木之口', file: '' },
  'c4_area5_3': { roomName: '巨木之影', file: '' },
  'c5_area1_2': { roomName: '大书院·旧街', file: '' },
  'c5_area1_3': { roomName: '本院·大厅', file: '' },
  'c5_area1_5': { roomName: '本院·审议室', file: '' },
  'c5_area1_6': { roomName: '本院·院长室', file: '' },
  'c5_area1_7': { roomName: '大书院·西口', file: '' },
  'c5_area2_1': { roomName: '沉星冰湖', file: '' },
  'c5_area2_2': { roomName: '冰湖东部', file: '' },
  'c5_area3_2': { roomName: '你的包间', file: '' },
  'c5_area3_3': { roomName: '露天温泉', file: '' },
  'c5_area4_1': { roomName: '扎营点', file: '' },
  'c5_area5_2': {
    roomName: '达卡拉狭路',
    file: '',
    variants: {
      'c5yinCang05': { roomName: '达卡拉狭路', file: '' },
      'c5changJing07': { roomName: '达卡拉狭路', file: '' }
    }
  }
}
const getPrevImg = (roomId, collectId) => {
  const config = HIDDEN_PREV_MAP[roomId]
  const f = config?.variants
    ? config.variants[collectId]?.file
    : config?.file
  return f ? `/images/hidden_prev/${f}` : ''
}

/** 简单确定性字符串哈希（djb2），用于生成稳定的条目唯一 id 摘要 */
function hashStr(str) {
  let h = 5381
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
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

  // room.json 的键/room.typeId 是场景配置 ID，levelRoom.roomTypeId 才是指向它的外键。
  // 同一场景配置可能被多个地图房间复用，因此保留全部精确匹配项。
  const levelRoomsByRoomTypeId = new Map()
  for (const lr of Object.values(levelRoomData)) {
    if (!lr?.roomTypeId) continue
    const matches = levelRoomsByRoomTypeId.get(lr.roomTypeId) || []
    matches.push(lr)
    levelRoomsByRoomTypeId.set(lr.roomTypeId, matches)
  }

  // 采集点只认源码实际读取的两个字段，避免 c1_area1_1 命中 c1_area1_10 这类前缀误匹配。
  const roomsByCollectId = new Map()
  for (const [roomKey, room] of Object.entries(roomData)) {
    const collectIds = new Set()
    for (const obj of room?.battleData?.spObj || []) {
      if (obj?.caijiTypeId) collectIds.add(obj.caijiTypeId)
    }
    for (const trigger of room?.battleData?.triggers || []) {
      for (const action of trigger?.actions || []) {
        if (action?.actionPara?.roomCollectId) collectIds.add(action.actionPara.roomCollectId)
      }
    }

    for (const collectId of collectIds) {
      const matches = roomsByCollectId.get(collectId) || []
      matches.push({ ...room, typeId: room.typeId || roomKey })
      roomsByCollectId.set(collectId, matches)
    }
  }

  for (const r of Object.values(rewardData)) {
    if (r.category && r.category.includes('场景宝箱')) {
      const collectTypes = []
      for (const ct of Object.values(collectTypeData)) {
        if (ct.reward === r.typeId) {
          collectTypes.push(ct)
        }
      }

      const collects = []
      for (const ct of collectTypes) {
        for (const c of Object.values(collectData)) {
          if (c.collectTypeId === ct.collectTypeId) {
            collects.push({ ...c, baseName: ct.name, tip: ct.tip })
          }
        }
      }

      for (const c of collects) {
        for (const rm of roomsByCollectId.get(c.typeId) || []) {
          for (const lr of levelRoomsByRoomTypeId.get(rm.typeId) || []) {
            const areaId = lr.areaId
            const areaName = areaData[areaId] ? areaData[areaId].name : areaId

            const parts = (areaId || '').split('_')
            const bigMapId = parts[0] ? parts[0] + '_map' : 'unknown_map'
            const bigMapName = areaData[bigMapId] ? areaData[bigMapId].name : '未知大地图'

            let sortKey = '99_99'
            if (lr.roomTypeId && lr.roomTypeId.includes('area')) {
              sortKey = lr.roomTypeId.split('area')[1] || sortKey
            }

            const cName = c.baseName || c.name || '场景宝箱'
            const cTip = c.tip || ''

            const uniqueKey = `${lr.typeId}-${c.typeId}-${r.typeId}`
            if (!seen.has(uniqueKey)) {
              seen.add(uniqueKey)

              // 一个物理房间（roomId）可能对应多个采集点/奖励组（各自独立一条隐藏奖励）。
              // 若只用 roomId 作为条目 id，同房多采集点会产生重复 DOM id `hidden-<roomId>`，
              // 前往定位会命中错误条目。这里给每条生成稳定的唯一 id = roomId + 奖励项摘要，
              // 保证同房不同采集点可在 DOM/前往时精确定位到各自条目。
              const itemIdStr = (r.items || []).map(g => {
                if (g && g.rules) return g.rules.map(rule => rule.typeId).join('|')
                return g && g.typeId ? g.typeId : ''
              }).join('~')
              const hash = hashStr(itemIdStr).slice(0, 8)
              const entryId = `${lr.typeId || rm.typeId}-${hash}`

              hiddenRewards.push({
                bigMapId,
                bigMapName,
                areaId,
                areaName,
                roomId: lr.typeId || rm.typeId,
                roomTypeId: rm.typeId,
                roomName: lr.name || rm.name,
                collectId: c.typeId,
                collectName: cName,
                collectTip: cTip,
                rewardId: r.typeId,
                sortKey,
                prevImg: getPrevImg(lr.typeId || rm.typeId, c.typeId),
                rewardItems: r.items,
                id: entryId
              })

              const locStr = `${bigMapName} - ${areaName} - ${lr.name || rm.name}`
              if (r.items) {
                r.items.forEach(itemGrp => {
                  if (itemGrp.rules) {
                    itemGrp.rules.forEach(rule => {
                      const tId = rule.typeId
                      if (!globalSources[tId]) globalSources[tId] = []
                      globalSources[tId].push({
                        type: 'hidden',
                        id: entryId,
                        roomId: lr.typeId || rm.typeId,
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
  }

  const parseSortKey = (sortKey) => {
    const parts = sortKey.split('_').map(n => parseInt(n, 10))
    return (parts[0] || 0) * 1000 + (parts[1] || 0)
  }

  // 同地区的同名房间聚在首个房间编号所在位置，避免 _2 和 _10 被其他房间隔开。
  const roomGroupOrder = new Map()
  for (const entry of hiddenRewards) {
    const groupKey = `${entry.bigMapId}|${entry.areaId}|${entry.roomName}`
    const ownOrder = parseSortKey(entry.sortKey)
    const currentOrder = roomGroupOrder.get(groupKey)
    if (currentOrder === undefined || ownOrder < currentOrder) roomGroupOrder.set(groupKey, ownOrder)
  }

  hiddenRewards.sort((a, b) => {
    if (a.bigMapId !== b.bigMapId) return a.bigMapId.localeCompare(b.bigMapId)
    const aGroupKey = `${a.bigMapId}|${a.areaId}|${a.roomName}`
    const bGroupKey = `${b.bigMapId}|${b.areaId}|${b.roomName}`
    const groupOrderDiff = roomGroupOrder.get(aGroupKey) - roomGroupOrder.get(bGroupKey)
    if (groupOrderDiff !== 0) return groupOrderDiff
    const roomNameDiff = a.roomName.localeCompare(b.roomName, 'zh-CN')
    if (roomNameDiff !== 0) return roomNameDiff
    return parseSortKey(a.sortKey) - parseSortKey(b.sortKey)
  })

  return { hidden: hiddenRewards, sources: globalSources }
}
