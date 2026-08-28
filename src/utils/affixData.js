/**
 * 装备词缀构建期纯函数：由 equipGroup/item/reward 原始 JSON 生成词缀表。
 * 对应原 scripts/generate-affixes.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildItemAffixes(maps) {
  const { equipGroupRes, itemRes, rewardRes } = maps

  const equipGroupData = equipGroupRes.equipGroups || {}
  const itemAffixes = {}

  // 1. 遍历所有装备组
  for (const [groupId, group] of Object.entries(equipGroupData)) {
    if (group.prefix && group.prefix.length > 0 && group.type && group.type.length > 0) {
      const prefixes = group.prefix.map(p => p.prefix)

      // 遍历该组内的所有装备
      for (const item of group.type) {
        const typeId = item.typeId
        if (!itemAffixes[typeId]) {
          itemAffixes[typeId] = []
        }
        // 将当前组的词条加入到该装备的词条池中
        itemAffixes[typeId].push({ groupId, prefixes })
      }
    }
  }

  // 2. 处理特殊的 5星装备词条 (散落在 reward.json 中)
  const itemData = itemRes || {}
  const rewardData = rewardRes || {}

  // 找出所有 category[0] === 4 且 quality === 5 的装备 typeId
  const specialEquipIds = new Set()
  for (const [typeId, item] of Object.entries(itemData.datas || {})) {
    if (item.category && item.category[0] === 4 && item.quality === 5) {
      specialEquipIds.add(typeId)
    }
  }

  // 在 reward.json 中寻找这些装备的词条 (prefix)
  const rewardItems = rewardData.datas || {}
  for (const [rewardId, reward] of Object.entries(rewardItems)) {
    if (!reward.items) continue
    for (const group of reward.items) {
      if (!group.rules) continue
      for (const rule of group.rules) {
        if (rule.typeId && specialEquipIds.has(rule.typeId) && rule.prefix) {
          const typeId = rule.typeId
          if (!itemAffixes[typeId]) {
            itemAffixes[typeId] = []
          }
          // 检查是否已经包含了这个特殊的奖励组，防止重复添加
          const existingGroup = itemAffixes[typeId].find(g => g.groupId === rewardId)
          if (existingGroup) {
            if (!existingGroup.prefixes.includes(rule.prefix)) {
              existingGroup.prefixes.push(rule.prefix)
            }
          } else {
            itemAffixes[typeId].push({ groupId: rewardId, prefixes: [rule.prefix] })
          }
        }
      }
    }
  }

  return itemAffixes
}
