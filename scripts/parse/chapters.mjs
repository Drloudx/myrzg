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
import { CHAPTER_MAP_SIZE, CHAPTER_TILE_RECTS, CHAPTER_MAP_TILE_PATH } from './chapterMapLayout.mjs'

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

/** 关卡内的可检索词：名称、描述、奖励物品、怪物与采集物。 */
function stageSearchText({ shortName, name, des, difficulties }) {
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
        cost: difficulties[0].consumeCost?.ti || 0,
        level: difficulties[0].level,
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

  const chapterMap = {
    background: '/images/chapters/map_w1_bg.webp',
    title: '/images/chapters/map_w1_title.webp',
    size: CHAPTER_MAP_SIZE,
    tiles,
    // 命中判定用：地图上每格最终属于哪一块（构建期烘焙，见 import-chapter-map-assets.mjs）。
    // 拼块包围盒互相重叠，不能用矩形热区；不透明区域也有重叠，所以按渲染顺序定归属。
    owner: ownerGrid
  }

  files.unshift({ file: 'parsed/chapters.json', data: { chapters, map: chapterMap } })
  return { files, deps: {} }
}
