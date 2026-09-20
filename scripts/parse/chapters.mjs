/**
 * 关卡图鉴预解析：章节索引 + 按关卡拆分的详情文件。
 *
 * 数据链（全部为完整原表，不使用任何裁剪版）：
 *   chapterInfo.json  章节名 / 描述 / mapArea / 额外难度解锁条件
 *   area.json         datas[mapArea].map → 底图、画布尺寸、levelStage 节点与顺序
 *   levelStage.json   关卡名 / 短号 / des / battle1..3
 *   battle.json       每个难度的等级、体力消耗、限时、奖励组与房间结构
 *   room.json         房间内的怪物波次、采集物、女神/泉水效果（battleData 下）
 *   reward/consume/item/mon/roomCollect/roomCollectType/equipGroup  关联与展示字段
 *
 * 房间、怪物与掉落的解析直接复用副本图鉴的实现（dungeonData.js + compact.mjs），
 * 只在“从完整 battle.json 取哪一批关卡”和“章节归属”上与副本不同。
 */
import { buildBattleRooms, buildBattleRoutes, buildSpecialChestSources, buildRewardEntries, consumeCost } from '../../src/utils/dungeonData.js'
import { readFileSync } from 'node:fs'
import { readJson } from './shared.mjs'
import { compactRewards, compactRooms } from './compact.mjs'
import { buildRoomEffects } from './roomEffects.mjs'
import { CHAPTER_MAP_SIZE, CHAPTER_TILE_RECTS, CHAPTER_MAP_TILE_PATH, CHAPTER_REGION_BG_PATH, AREA_ICON_PATH, INSTANCE_ICON_PATH, STAGE_PLATFORM_PATH, STAGE_PLATFORM_LOCKED_PATH, STAGE_CRYSTAL_PATH, STAGE_CRYSTAL_SMALL_PATH } from './chapterMapLayout.mjs'

const asMap = value => value && typeof value === 'object' ? value : {}
const asArray = value => Array.isArray(value) ? value : []

/** 章节顺序：主线 c0..c5 走 chapterInfo，特殊章节（幽夜古堡/黏滑溪谷）只有 area。 */
const SPECIAL_CHAPTER_IDS = ['sp1', 'sp2']

/** 房间配置里战斗相关字段都在 battleData 下；这里统一摊平成 dungeonData 期望的形状。 */
function roomDetailsFrom(roomMap, buffs) {
  const details = {}
  for (const [id, room] of Object.entries(roomMap)) {
    const battleData = room?.battleData || {}
    details[id] = {
      typeId: room.typeId,
      name: room.name,
      jigDes: room.jigDes,
      desc: room.des,
      notFightRoom: room.notFightRoom,
      linkStage: room.linkStage,
      category: room.category,
      spObj: asArray(battleData.spObj),
      npcList: asArray(battleData.npcList),
      // roundId 是内部字符串，展示层只需要波次序号
      monRounds: asArray(battleData.monRounds).map((round, index) => ({ round: index + 1, mons: asArray(round.mons) })),
      effects: buildRoomEffects(battleData, buffs)
    }
  }
  return details
}

/** 从完整 battle.json 内联提取路线布局，等价 extractDungeonRoutes.mjs 对副本做的事。 */
function routeBattleOf(battle) {
  if (!Array.isArray(battle?.layers)) return null
  const layers = []
  for (const layer of battle.layers) {
    for (const layerData of asArray(layer?.layerDatas)) {
      const map = layerData.map || {}
      layers.push({
        id: layerData.layerId || `layer-${layers.length + 1}`,
        name: layerData.name || `布局 ${layers.length + 1}`,
        chance: Number(layerData.chance || 0),
        startRoomId: layerData.startRoomId || '',
        endRoom: layerData.endRoom || '',
        startEntrance: layerData.startEntrance || '',
        size: map.size || { w: 1600, h: 1000 },
        nodes: asArray(map.levelRoom),
        links: asArray(map.link).map(link => ({
          rooms: asArray(link.levelRooms),
          x1: Number(link.x1 || 0),
          y1: Number(link.y1 || 0),
          x2: Number(link.x2 || 0),
          y2: Number(link.y2 || 0)
        }))
      })
    }
  }
  return layers.length ? { layers } : null
}

const DIFFICULTY_LABELS = ['简单', '普通', '困难']
const DIFFICULTY_KEYS = ['battle1', 'battle2', 'battle3']

/** 游戏 LevelStageShowPanel 的解锁文案：普通看章节额外难度条件，困难看是否通关普通。 */
function unlockOf(index, conf, chapterConf) {
  if (index === 1) {
    const condition = chapterConf?.exBattleOpenCondition
    if (!condition) return null
    const label = chapterConf.exBattleOpenConditionDes || condition
    return { condition, text: `完成 ${label} 解锁` }
  }
  if (index === 2) {
    if (!conf.battle2) return null
    return { condition: conf.battle2, text: '通关 普通难度 解锁' }
  }
  return null
}

/** 关卡内的可检索词：名称、描述、奖励物品、怪物与采集物。 */function stageSearchText({ shortName, name, des, difficulties }) {
  const words = [shortName, name, des]
  for (const difficulty of difficulties) {
    for (const entry of [...difficulty.reward, ...difficulty.firstReward]) words.push(entry.name)
    for (const room of difficulty.rooms) {
      words.push(room.label)
      for (const variant of room.variants) {
        words.push(variant.name, variant.kind, ...variant.effects.map(effect => effect.title))
        for (const monster of variant.monsters) {
          words.push(monster.name)
          for (const drop of monster.drops) words.push(drop.name, ...drop.reward.map(entry => entry.name))
        }
        for (const collection of variant.collections) {
          words.push(collection.name, ...collection.reward.map(entry => entry.name))
        }
      }
    }
  }
  return [...new Set(words.filter(Boolean))].join(' ')
}

/**
 * 章节地区路线图：底图 + 节点 + 连线。
 *
 * 节点位置与类型取自 `area.datas[mapArea].map`，摆放偏移照源码 `MapPanel.InitMapPanel`：
 * levelStage / levelRoom 落在 (x, y)，地区节点上移 80、副本入口上移 75。
 *
 * **Y 轴要翻转**：配置是 Unity UI 的 `localPosition`（+y 向上），而 CSS 的 `top` 是 +y 向下，
 * 直接拿来用整张地图会上下镜像。游戏截图里 2-6 在 2-5 上方，而配置 y(2-6)=1095 > y(2-5)=957，
 * 就是这条的证据。所以统一 `y_css = size.h − y_unity`，偏移量在 Unity 坐标里先加再翻。
 *
 * 探索点没有名字（`explorePoint.json` 只有一条、且真正的点位来自玩家存档），只画点不标名。
 */
function buildRegionRoute(chapterId, areaMap, tables) {
  const height = Number(areaMap.size?.h || 0)
  /** Unity 的 +y 向上 → CSS 的 +y 向下。 */
  const flipY = unityY => height - unityY

  const nodes = [
    ...asArray(areaMap.levelStage).map(node => ({
      kind: 'stage',
      id: node.typeId,
      x: Number(node.x || 0),
      y: flipY(Number(node.y || 0)),
      label: tables.levelStages[node.typeId]?.shortName || node.typeId,
      name: tables.levelStages[node.typeId]?.name || ''
    })),
    ...asArray(areaMap.area).map(node => ({
      kind: 'area',
      id: node.typeId,
      x: Number(node.x || 0),
      y: flipY(Number(node.y || 0) - 80),
      label: tables.areas[node.typeId]?.name || node.typeId,
      name: '',
      icon: tables.areas[node.typeId]?.icon || '',
      iconPath: tables.areas[node.typeId]?.icon ? AREA_ICON_PATH(tables.areas[node.typeId].icon) : ''
    })),
    ...asArray(areaMap.instance).map(node => ({
      kind: 'instance',
      id: node.instance,
      x: Number(node.x || 0),
      y: flipY(Number(node.y || 0) - 75),
      label: tables.instances[node.instance]?.name || node.instance,
      name: '',
      // 节点图要用 map.instance[].img（map_w1_cN_dM，地图上的立体图），**不是** instance.icon——
      // 后者是副本自己的平面图标，c1/c2 那几个是 map_fb_*，摆到地图上不是游戏里的样子。
      icon: node.img || '',
      iconPath: node.img ? INSTANCE_ICON_PATH(node.img) : ''
    })),
    ...asArray(areaMap.explorePoint).map(node => ({
      kind: 'explore',
      id: node.explorePointTypeId,
      x: Number(node.x || 0),
      y: flipY(Number(node.y || 0)),
      label: '',
      name: ''
    }))
  ]
  return {
    // 底图按**章节 id** 命名（map_w1_c1_bg），不是地区 id（c1_map）——两者差一个 _map 后缀，
    // 拼错时 SPA fallback 会对不存在的图片返回 200 + HTML，只有解码失败才会暴露。
    background: CHAPTER_REGION_BG_PATH(chapterId),
    size: { w: Number(areaMap.size?.w || 0), h: height },
    bgPos: { x: Number(areaMap.bgImg?.x || 0), y: flipY(Number(areaMap.bgImg?.y || 0)) },
    nodes,
    links: asArray(areaMap.link).map(link => ({
      x1: Number(link.x1 || 0),
      y1: flipY(Number(link.y1 || 0)),
      x2: Number(link.x2 || 0),
      y2: flipY(Number(link.y2 || 0))
    }))
  }
}

export function buildChaptersFiles() {
  const chapterInfo = asMap(readJson('chapterInfo.json'))
  const ownerGrid = JSON.parse(readFileSync(new URL('./chapterMapOwner.json', import.meta.url), 'utf8'))
  const areas = asMap(readJson('area.json').datas)
  const levelStages = asMap(readJson('levelStage.json').datas)
  const battles = asMap(readJson('battle.json').datas)
  const rewards = asMap(readJson('reward.json').datas)
  const consumes = asMap(readJson('consume.json').datas)
  const items = asMap(readJson('item.json').datas)
  const collectMap = asMap(readJson('roomCollect.json').datas)
  const collectTypes = asMap(readJson('roomCollectType.json').datas)
  const monMap = asMap(readJson('mon.json').datas)
  const equipConfig = readJson('equip/equipGroup.json')
  const instances = asMap(readJson('instance.json').datas)
  const routeTables = { areas, instances, levelStages }
  const roomDetails = roomDetailsFrom(asMap(readJson('room.json')), {
    buffMap: asMap(readJson('buff.json')),
    buffTeamMap: asMap(readJson('battleBuffTeam.json')),
    buffCardMap: asMap(readJson('battleBuffCard.json'))
  })

  const buildDifficulty = (battleId, index, conf, chapterConf) => {
    const battle = battles[battleId]
    if (!battle) return null
    const rooms = buildBattleRooms(battle, roomDetails, collectMap, collectTypes, rewards, consumes, items, monMap, equipConfig)
    return {
      key: DIFFICULTY_KEYS[index],
      label: DIFFICULTY_LABELS[index],
      battleId,
      name: battle.name || '',
      level: Number(battle.battleLevel || 0),
      time: Number(battle.time || 0),
      consumeCost: consumeCost(consumes[battle.consume]),
      unlock: unlockOf(index, conf, chapterConf),
      reward: buildRewardEntries(rewards[battle.reward], items, null, equipConfig),
      firstReward: buildRewardEntries(rewards[battle.firstReward], items, null, equipConfig),
      rooms,
      routes: buildBattleRoutes(routeBattleOf(battle), rooms),
      chestSources: buildSpecialChestSources(rooms, rewards, items, equipConfig)
    }
  }

  // 章节来源：chapterInfo 给主线，area 给全部（含 sp1/sp2 与地图信息）
  const chapterIds = [
    ...Object.keys(chapterInfo),
    ...SPECIAL_CHAPTER_IDS.filter(id => !chapterInfo[id])
  ]
  const files = []
  const stageIds = new Set()

  const chapters = chapterIds.map((chapterId, order) => {
    const conf = chapterInfo[chapterId]
    const areaId = conf?.mapArea || `${chapterId}_map`
    const area = areas[areaId]
    if (!area?.map) throw new Error(`[chapters] 章节 ${chapterId} 缺少地图配置：${areaId}`)

    const stages = asArray(area.map.levelStage).map(node => {
      const stage = levelStages[node.typeId]
      if (!stage) throw new Error(`[chapters] 关卡节点 ${node.typeId} 在 levelStage.json 中不存在`)
      if (stageIds.has(node.typeId)) throw new Error(`[chapters] 关卡重复挂载：${node.typeId}`)
      stageIds.add(node.typeId)

      const difficulties = DIFFICULTY_KEYS
        .map((key, index) => stage[key] ? buildDifficulty(stage[key], index, stage, conf) : null)
        .filter(Boolean)
      if (!difficulties.length) throw new Error(`[chapters] 关卡 ${node.typeId} 没有任何难度配置`)

      const summary = {
        id: stage.typeId,
        shortName: stage.shortName || stage.typeId,
        name: stage.name || '',
        des: stage.des || '',
        hidden: !!stage.hide,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
        difficultyLabels: difficulties.map(item => item.label),
        // 列表卡片按当前难度显示等级，所以每难度的等级都要进索引（三难度的推荐等级不同）
        levels: Object.fromEntries(difficulties.map(item => [item.label, item.level])),
        cost: difficulties[0].consumeCost?.ti || 0,
        reward: compactRewards(difficulties[0].reward),
        firstReward: compactRewards(difficulties[0].firstReward),
        detailFile: `stages/${stage.typeId}.json`
      }

      const { reward, firstReward, ...scalars } = summary
      files.push({
        file: `parsed/stages/${stage.typeId}.json`,
        data: {
          ...scalars,
          chapter: { id: chapterId, name: conf?.name || area.name, areaName: area.name, areaId },
          difficulties: difficulties.map(item => ({
            ...item,
            reward: compactRewards(item.reward),
            firstReward: compactRewards(item.firstReward),
            rooms: compactRooms(item.rooms)
          }))
        }
      })

      return { ...summary, searchText: stageSearchText({ ...summary, difficulties }) }
    })

    return {
      id: chapterId,
      order,
      chapterNo: /^c(\d+)$/.test(chapterId) ? Number(chapterId.slice(1)) : null,
      name: conf?.name || area.name,
      des: conf?.des || area.des || '',
      areaId,
      areaName: area.name || '',
      areaDes: area.des || '',
      stageCount: stages.length,
      stages
    }
  })

  if (stageIds.size !== Object.keys(levelStages).length) {
    const orphan = Object.keys(levelStages).filter(id => !stageIds.has(id))
    throw new Error(`[chapters] 有 ${orphan.length} 个关卡没有挂到任何章节：${orphan.join(', ')}`)
  }

  // 世界地图：底图 + 已开放章节的拼块矩形（坐标由模板匹配测得，见 chapterMapLayout.mjs）。
  // 拼块只对有矩形且有关卡数据的章节输出；特殊章节（sp1/sp2）不在世界地图上，不参与。
  const tiles = chapters
    .filter(chapter => CHAPTER_TILE_RECTS[chapter.id] && chapter.stages.length)
    .map(chapter => {
      const rect = CHAPTER_TILE_RECTS[chapter.id]
      return {
        id: chapter.id,
        chapterNo: chapter.chapterNo,
        name: chapter.name,
        areaName: chapter.areaName,
        stageCount: chapter.stages.length,
        image: CHAPTER_MAP_TILE_PATH(chapter.id),
        ...rect
      }
    })

  // 地区路线图：每个章节的内页地图（底图 + 关卡/地区/副本/探索节点 + 连线）
  const regions = {}
  for (const chapter of chapters) {
    const areaMap = areas[chapter.areaId]?.map
    if (!areaMap) continue
    regions[chapter.id] = buildRegionRoute(chapter.id, areaMap, routeTables)
  }

  const chapterMap = {
    background: '/images/chapters/map_w1_bg.webp',
    title: '/images/chapters/map_w1_title.webp',
    size: CHAPTER_MAP_SIZE,
    tiles,
    regions,
    // 地区路线图上的关卡节点石台（从 MapPanelAtlas 切出来的游戏原图），以及叠上去的蓝色水晶
    stagePlatform: { normal: STAGE_PLATFORM_PATH, locked: STAGE_PLATFORM_LOCKED_PATH },
    stageCrystal: STAGE_CRYSTAL_PATH,
    stageCrystalSmall: STAGE_CRYSTAL_SMALL_PATH,
    // 命中判定用：地图上每格最终属于哪一块（构建期烘焙，见 import-chapter-map-assets.mjs）。
    // 拼块包围盒互相重叠，不能用矩形热区；不透明区域也有重叠，所以按渲染顺序定归属。
    owner: ownerGrid
  }

  files.unshift({ file: 'parsed/chapters.json', data: { chapters, map: chapterMap } })
  return { files, deps: {} }
}
