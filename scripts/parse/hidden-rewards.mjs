/**
 * 场景宝箱（隐藏奖励）预解析（新风格，替代原 scripts/parse-hidden-rewards.js）
 * 产物：parsed-hidden.json（奖励页运行时）、parsed-hidden-sources.json（构建期合并进 item-sources）
 * 数据源：raw/room.json 为 Config_decrypted 原始完整房间表（battleData 含 monRounds/spObj/npcList），
 *        隐藏奖励定位用其 spObj（采集物引用）；由 buildHiddenRewards 在遍历时自取所需字段。
 */
import { buildHiddenRewards } from '../../src/utils/hiddenRewardsData.js'
import { readJson } from './shared.mjs'

export function build() {
  const roomRes = readJson('room.json')

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
