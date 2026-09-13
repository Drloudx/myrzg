/**
 * 装备词缀构建期纯函数：由 equipGroup/item/reward 原始 JSON 生成词缀表。
 * 对应原 scripts/generate-affixes.js（等价迁移）。
 * 不依赖网络与浏览器，Node 构建脚本（scripts/parse/*.mjs）与浏览器共用。
 */
export function buildItemAffixes(maps) {
  const { equipGroupRes, itemRes, rewardRes } = maps

  const equipGroupData = equipGroupRes.equipGroups || {}
  const rewardData = rewardRes?.datas || {}
  const itemAffixes = {}

  // equipGroup.json 同时保留了正式奖励组和旧版/测试奖励组。
  // 游戏只有被启用奖励实际引用的组才会参与生成装备，不能把同一件装备
  // 在“暂不使用”组里的前缀也并入可携带效果。
  const isInactiveReward = (reward) => {
    const categories = Array.isArray(reward?.category) ? reward.category : []
    return categories.some(category => /暂不使用|测试|废弃|弃用/.test(String(category)))
  }
  const activeGroupIds = new Set()
  for (const reward of Object.values(rewardData)) {
    if (isInactiveReward(reward)) continue
    for (const item of Array.isArray(reward?.items) ? reward.items : []) {
      for (const rule of Array.isArray(item?.rules) ? item.rules : []) {
        if (rule?.mode === 'equipGroup' && rule.equipTypeGroup) {
          activeGroupIds.add(rule.equipTypeGroup)
        }
      }
    }
  }

  // 1. 遍历所有装备组
  for (const [groupId, group] of Object.entries(equipGroupData)) {
    if (activeGroupIds.size > 0 && !activeGroupIds.has(groupId)) continue
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
  // 找出所有 category[0] === 4 且 quality === 5 的装备 typeId
  const specialEquipIds = new Set()
  for (const [typeId, item] of Object.entries(itemData.datas || {})) {
    if (item.category && item.category[0] === 4 && item.quality === 5) {
      specialEquipIds.add(typeId)
    }
  }

  // 在 reward.json 中寻找这些装备的词条 (prefix)
  for (const [rewardId, reward] of Object.entries(rewardData)) {
    if (isInactiveReward(reward)) continue
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

  for (const [typeId, groups] of Object.entries(itemAffixes)) {
    const seenPrefixSets = new Set()
    itemAffixes[typeId] = groups.filter(group => {
      group.prefixes = [...new Set(group.prefixes || [])]
      const signature = [...group.prefixes].sort().join('|')
      if (!signature || seenPrefixSets.has(signature)) return false
      seenPrefixSets.add(signature)
      return true
    })
    if (itemAffixes[typeId].length === 0) delete itemAffixes[typeId]
  }

  return itemAffixes
}
