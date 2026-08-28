/**
 * 装备词缀预解析（新风格，替代原 scripts/generate-affixes.js）
 * 产物：parsed/itemAffixes.json（装备词缀，itemParser 运行时读）
 */
import { buildItemAffixes } from '../../src/utils/affixData.js'
import { readJson } from './shared.mjs'

export function build() {
  const data = buildItemAffixes({
    equipGroupRes: readJson('equipGroup.json'),
    itemRes: readJson('item.json'),
    rewardRes: readJson('reward.json')
  })
  return {
    files: [{ file: 'parsed/itemAffixes.json', data }]
  }
}
