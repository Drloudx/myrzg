/**
 * 物品/装备核心数据预解析：public/data/parsed/items.json
 * 对应浏览器端 src/utils/itemParser.js 的 buildItemData（同一纯函数）
 */
import { buildItemData } from '../../src/utils/itemParser.js'
import { readJson } from './shared.mjs'

export function buildItemsFile() {
  const maps = {
    itemRes: readJson('item.json'),
    settingRes: readJson('gameSetting.json'),
    lanRes: readJson('lan.json'),
    avatarRes: readJson('avatars.json'),
    rewardRes: readJson('reward.json'),
    enchantRes: readJson('equip/equipEnchant.json'),
    triggerRes: readJson('skillTrigger.json'),
    equipGroupRes: readJson('equip/equipGroup.json'),
    equipSuitRes: readJson('equip/equipSuit.json'),
    itemAffixesRes: readJson('parsed/itemAffixes.json')
  }
  const data = buildItemData(maps)
  return { file: 'parsed/items.json', data }
}
