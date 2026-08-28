/**
 * 事件/探索图鉴预解析：public/data/parsed/events.json
 * 对应浏览器端 src/utils/eventData.js 的 buildEventData（同一纯函数）
 */
import { buildEventData } from '../../src/utils/eventData.js'
import { readJson } from './shared.mjs'

export function buildEventsFile() {
  const data = buildEventData({
    eventJson: readJson('randomEventInfo.json'),
    areaJson: readJson('randomEventArea.json'),
    rewardJson: readJson('reward.json'),
    itemJson: readJson('item.json'),
    mapJson: readJson('area.json'),
    exploreJson: readJson('exploreArea.json'),
    monJson: readJson('mon.json')
  })
  return { file: 'parsed/events.json', data }
}
