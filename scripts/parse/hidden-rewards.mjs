/**
 * 场景宝箱（隐藏奖励）预解析（新风格，替代原 scripts/parse-hidden-rewards.js）
 * 产物：parsed-hidden.json（奖励页运行时）、parsed-hidden-sources.json（构建期合并进 item-sources）
 * 注意：场景定位优先完整版 room主.json（含采集物引用），缺失回退精简版 room.json
 */
import { buildHiddenRewards } from '../../src/utils/hiddenRewardsData.js'
import { readJson, publicDataDir } from './shared.mjs'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function build() {
  const roomRes = existsSync(join(publicDataDir, 'room主.json'))
    ? readJson('room主.json')
    : readJson('room.json')

  const { hidden, sources } = buildHiddenRewards({
    rewardRes: readJson('reward.json'),
    collectTypeRes: readJson('roomCollectType.json'),
    collectRes: readJson('roomCollect.json'),
    roomRes,
    levelRoomRes: readJson('levelRoom.json'),
    areaRes: readJson('area.json')
  })
  return {
    files: [
      { file: 'parsed/parsed-hidden.json', data: hidden },
      { file: 'parsed/parsed-hidden-sources.json', data: sources }
    ],
    deps: { hiddenSources: sources, hiddenList: hidden }
  }
}
