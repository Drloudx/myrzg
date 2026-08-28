/**
 * PVP 奖励预解析（新风格，替代原 scripts/parse-rewards.js）
 * 产物：parsed-pvp.json（奖励页运行时）、parsed-pvp-sources.json（构建期合并进 item-sources）
 */
import { buildPvpData } from '../../src/utils/pvpData.js'
import { readJson } from './shared.mjs'

export function build() {
  const { pvp, sources } = buildPvpData({
    rewardRes: readJson('reward.json'),
    pvpRes: readJson('pvp.json'),
    exchangeRes: readJson('itemExchange.json'),
    consumeRes: readJson('consume.json')
  })
  return {
    files: [
      { file: 'parsed/parsed-pvp.json', data: pvp },
      { file: 'parsed/parsed-pvp-sources.json', data: sources }
    ],
    deps: { pvpSources: sources }
  }
}
