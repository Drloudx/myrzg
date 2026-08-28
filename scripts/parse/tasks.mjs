/**
 * 任务图鉴预解析：public/data/parsed/tasks.json
 * 对应浏览器端 src/utils/taskParser.js 的 buildTaskData（同一纯函数）
 */
import { buildTaskData } from '../../src/utils/taskParser.js'
import { readJson } from './shared.mjs'

export function buildTasksFile() {
  const maps = {
    taskJson: readJson('task.json'),
    levelStageJson: readJson('levelStage.json'),
    levelRoomJson: readJson('levelRoom.json'),
    areaJson: readJson('area.json'),
    instanceJson: readJson('instance.json'),
    battleJson: readJson('battle.json'),
    roomJson: readJson('room.json'),
    rewardJson: readJson('reward.json'),
    itemJson: readJson('item.json'),
    monJson: readJson('mon.json'),
    conditionJson: readJson('condition.json'),
    roomCollectJson: readJson('roomCollect.json'),
    roomCollectTypeJson: readJson('roomCollectType.json'),
    newOrderJson: readJson('委托订单newOrder.json'),
    heroJson: readJson('hero/hero.json'),
    dialogIndexJson: readJson('parsed/dialogIndex.json'),
    dialogSegmentsJson: readJson('parsed/dialogSegments.json')
  }
  const data = buildTaskData(maps)
  return { file: 'parsed/tasks.json', data }
}
