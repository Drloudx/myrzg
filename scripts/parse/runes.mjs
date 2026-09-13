import { buildRuneData } from '../../src/utils/runeData.js'
import { readJson } from './shared.mjs'

export function buildRunesFile() {
  return { file: 'parsed/runes.json', data: buildRuneData({
    itemRes: readJson('item.json'), enchantRes: readJson('equip/equipEnchant.json'),
    triggerRes: readJson('skillTrigger.json'), rewardRes: readJson('reward.json'),
    consumeRes: readJson('consume.json'), exchangeRes: readJson('itemExchange.json'),
    mappingRes: readJson('fushi_itemExchangeMapping.json')
  }) }
}
