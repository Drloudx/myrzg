/**
 * 兑换数据预解析（新风格，替代原 scripts/parse-exchange.js）
 * 产物：parsed/parsed-exchange.json（兑换页运行时读）
 */
import { buildExchangeData } from '../../src/utils/exchangeData.js'
import { readJson } from './shared.mjs'

export function build() {
  const data = buildExchangeData({
    exchangeRes: readJson('itemExchange.json'),
    rewardRes: readJson('reward.json'),
    consumeRes: readJson('consume.json'),
    itemRes: readJson('item.json'),
    equipGroupRes: readJson('equipGroup.json')
  })
  return {
    files: [{ file: 'parsed/parsed-exchange.json', data }]
  }
}
