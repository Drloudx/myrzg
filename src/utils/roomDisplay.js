/**
 * 房间内容与奖励池的展示整形（副本图鉴 / 关卡图鉴共用）。
 *
 * 两个页面消费同一套「关卡 → 房间 → 候选变体 → 怪物 / 采集 / 效果 → 奖励池」结构，
 * 波次文案、宝箱排序、奖励池分组、概率标签和可点击判断必须一致，
 * 因此只在这里维护一份；页面只负责自己的布局与样式。
 */
import { getImageUrl } from './env.js'

/** 宝箱档位：金 3 / 银 2 / 铜 1 / 其他 0。用于把高价值箱子排在前面。 */
export const chestTier = (value = '') => {
  const text = String(value)
  if (text.includes('金')) return 3
  if (text.includes('银')) return 2
  if (text.includes('铜')) return 1
  return 0
}

/** 奖励池内排序：品质 → 单次概率 → 名称。 */
export const rewardQualitySort = (a, b) => Number(b?.quality || 0) - Number(a?.quality || 0)
  || Number(b?.actualProb || 0) - Number(a?.actualProb || 0)
  || String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN')

/** 采集物排序：金/银/铜宝箱优先，其余按名称。 */
export const sortedCollections = (collections = []) => [...collections].sort((a, b) => chestTier(b?.name) - chestTier(a?.name)
  || String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN'))

/** 怪物按波次分行；多波时逐波列出，单波时合并成一行。 */
export const monsterWaveLines = (room) => {
  const waves = room?.waves || []
  if (waves.length > 1) {
    return waves.map((wave, index) => ({
      key: `wave-${wave.round || index + 1}`,
      wave: wave.round || index + 1,
      text: (wave.monsters || []).map(monster => `${monster.name} ×${monster.count}`).join('、')
    }))
  }
  return [{ key: 'all', wave: 0, text: (room?.monsters || []).map(monster => `${monster.name} ×${monster.count}`).join('、') }]
}

export const collectConsumeText = (collection) => collection?.consumeCost?.ti > 0
  ? `消耗 ${collection.consumeCost.ti} 体力`
  : '无需消耗'

/** 只有真实物品/固定装备能打开全局物品详情；随机装备池不生成跳转。 */
export const isRewardClickable = (entry) => !!entry?.typeId
  && (entry.kind === 'item' || entry.kind === 'equip')
  && entry.typeId !== 'equipGroup'

/** 同一 typeId 去重（保留品质最高的一条），用于来源摘要与预览。 */
export const uniqueRewards = (entries = []) => {
  const rewards = new Map()
  entries.forEach((entry, index) => {
    if (!entry) return
    const key = entry.typeId || `${entry.name}-${index}`
    const current = rewards.get(key)
    if (!current || Number(entry.quality || 0) > Number(current.quality || 0)) rewards.set(key, entry)
  })
  return [...rewards.values()].sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0)
    || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
}

/** 构建期产物的奖励条目 → `UiRewardCard` 的 rule。 */
export const rewardRule = (entry) => ({
  ...entry,
  targetName: entry.name,
  targetImg: entry.icon ? getImageUrl(entry.icon) : '',
  targetQuality: entry.quality || 0
})

/** 按 groupIndex 把奖励条目还原成奖励池，池内按品质排序。 */
export const rewardGroups = (entries = []) => {
  const groups = new Map()
  entries.forEach(entry => {
    const index = Number(entry.groupIndex || 0)
    if (!groups.has(index)) groups.set(index, { index, rate: Number(entry.groupRate ?? 1), count: Number(entry.groupCount || 1), entries: [] })
    groups.get(index).entries.push(entry)
  })
  return [...groups.values()]
    .map(group => ({ ...group, entries: [...group.entries].sort(rewardQualitySort) }))
    .sort((a, b) => a.index - b.index)
}

export const rewardGroupLabel = (group) => `${group.rate < 1 ? `${(group.rate * 100).toFixed(0)}% 概率触发` : '必定触发'} · ${group.count} 个奖励`

/** 房间类型 → `UiTag` 的 tone。 */
export const roomKindTone = (room) => room?.kind?.includes('宝箱') ? 'gold'
  : room?.kind === 'BOSS' ? 'danger'
    : room?.kind === '事件' ? 'accent'
      : 'default'
