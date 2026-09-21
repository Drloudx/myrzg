<!--
  奖励池列表（副本图鉴 / 关卡图鉴共用）。

  模式：
  1. 默认大背包货架模式（breakdown = false）：
     - 统一平铺所有掉落物品，按品质与综合概率降序对齐在同一个整齐货架中；
     - 右上角角标为最终综合概率（已计入池子触发率）；
     - 悬停展示单次抽取概率与综合获得概率等详细规则；
     - 触屏移动端点击直接进入物品详情页。
  2. 弹窗明细模式（breakdown = true）：
     - 供「概率明细」弹窗使用；
     - 按奖励池分组，标题旁标注触发概率与奖励件数，清晰还原底层抽卡规则。
-->
<template>
  <div class="reward-pools" :class="{ 'reward-pools--dense': dense }">
    <!-- 弹窗明细模式：按奖励池分组展开 -->
    <template v-if="breakdown">
      <div v-for="group in groups" :key="group.index" class="breakdown-pool">
        <div class="breakdown-pool__heading">
          <strong class="breakdown-pool__title">奖励池 {{ group.index + 1 }}</strong>
          <span class="breakdown-pool__rule">{{ breakdownRuleText(group) }}</span>
          <span v-if="sourceOf" class="breakdown-pool__source">来源：{{ sourceOf(group) }}</span>
        </div>

        <div class="reward-shelf">
          <div
            v-for="(entry, index) in group.entries"
            :key="`${group.index}-${entry.typeId || entry.name}-${index}`"
            class="reward-slot"
            :class="{ 'is-clickable': isRewardClickable(entry) }"
            @click="handleClick(entry)"
            @mouseenter="onSlotEnter"
            @mouseleave="onSlotLeave"
          >
            <div
              class="reward-slot__box"
              :class="[`quality-border-${entry.quality || 1}`, `quality-bg-${entry.quality || 1}`]"
            >
              <img
                v-if="entry.icon"
                :src="getImageUrl(entry.icon)"
                :alt="entry.name"
                class="reward-slot__icon"
                loading="lazy"
                @error="handleImgError"
              />
              <span v-else class="reward-slot__placeholder">✦</span>

              <!-- 概率角标 -->
              <span v-if="slotProbText(resolveEntryProb(entry, group).compositeProb)" class="reward-slot__prob">
                {{ slotProbText(resolveEntryProb(entry, group).compositeProb) }}
              </span>

              <!-- 数量角标 -->
              <span v-if="slotCountText(entry)" class="reward-slot__count">
                {{ slotCountText(entry) }}
              </span>

              <!-- 桌面悬停浮层 -->
              <div class="reward-slot__tooltip" role="tooltip">
                <div class="reward-slot__tooltip-title" :class="`quality-text-${entry.quality || 1}`">
                  {{ entry.name }}
                </div>
                <div v-if="entry.min !== undefined && entry.max !== undefined" class="reward-slot__tooltip-line">
                  数量：{{ entry.min === entry.max ? entry.min : `${entry.min}~${entry.max}` }}
                </div>
                <div class="reward-slot__tooltip-line reward-slot__tooltip-rule">
                  所属规则：{{ tooltipRuleText(group.rate, group.count) }}
                </div>
                <div v-if="resolveEntryProb(entry, group).singleProb < 1 || group.rate < 1" class="reward-slot__tooltip-line">
                  单次抽取概率：{{ formatDetailPercent(resolveEntryProb(entry, group).singleProb) }}%
                </div>
                <div class="reward-slot__tooltip-line reward-slot__tooltip-highlight">
                  综合获得概率：{{ formatDetailPercent(resolveEntryProb(entry, group).compositeProb) }}%
                </div>
                <div v-if="entry.detail" class="reward-slot__tooltip-detail">
                  {{ entry.detail }}
                </div>
              </div>
            </div>

            <div class="reward-slot__name" :title="entry.name">
              {{ entry.name }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 默认模式：统一大背包货架流（所有物品整整齐齐平铺在一处） -->
    <template v-else>
      <div class="reward-shelf">
        <div
          v-for="(item, index) in unifiedEntries"
          :key="`${item.typeId || item.name}-${index}`"
          class="reward-slot"
          :class="{ 'is-clickable': isRewardClickable(item) }"
          @click="handleClick(item)"
          @mouseenter="onSlotEnter"
          @mouseleave="onSlotLeave"
        >
          <div
            class="reward-slot__box"
            :class="[`quality-border-${item.quality || 1}`, `quality-bg-${item.quality || 1}`]"
          >
            <img
              v-if="item.icon"
              :src="getImageUrl(item.icon)"
              :alt="item.name"
              class="reward-slot__icon"
              loading="lazy"
              @error="handleImgError"
            />
            <span v-else class="reward-slot__placeholder">✦</span>

            <!-- 综合概率角标 -->
            <span v-if="slotProbText(item._prob.compositeProb)" class="reward-slot__prob">
              {{ slotProbText(item._prob.compositeProb) }}
            </span>

            <!-- 数量角标 -->
            <span v-if="slotCountText(item)" class="reward-slot__count">
              {{ slotCountText(item) }}
            </span>

            <!-- 桌面悬浮 Tooltip -->
            <div class="reward-slot__tooltip" role="tooltip">
              <div class="reward-slot__tooltip-title" :class="`quality-text-${item.quality || 1}`">
                {{ item.name }}
              </div>
              <div v-if="item.min !== undefined && item.max !== undefined" class="reward-slot__tooltip-line">
                数量：{{ item.min === item.max ? item.min : `${item.min}~${item.max}` }}
              </div>

              <!-- 单来源规则 -->
              <template v-if="item._sources.length <= 1">
                <div class="reward-slot__tooltip-line reward-slot__tooltip-rule">
                  所属规则：{{ tooltipRuleText(item._prob.groupRate, item._prob.groupCount) }}
                </div>
                <div v-if="item._prob.singleProb < 1 || item._prob.groupRate < 1" class="reward-slot__tooltip-line">
                  单次抽取概率：{{ formatDetailPercent(item._prob.singleProb) }}%
                </div>
              </template>

              <!-- 多来源跨池合并展示 -->
              <template v-else>
                <div v-for="(src, sIdx) in item._sources" :key="sIdx" class="reward-slot__tooltip-line reward-slot__tooltip-muted">
                  池 {{ src.groupIndex + 1 }}（{{ tooltipRuleText(src.prob.groupRate, src.prob.groupCount) }}）：单次 {{ formatDetailPercent(src.prob.singleProb) }}%
                </div>
              </template>

              <div class="reward-slot__tooltip-line reward-slot__tooltip-highlight">
                综合获得概率：{{ formatDetailPercent(item._prob.compositeProb) }}%
              </div>
              <div v-if="item.detail" class="reward-slot__tooltip-detail">
                {{ item.detail }}
              </div>
            </div>
          </div>

          <div class="reward-slot__name" :title="item.name">
            {{ item.name }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { isRewardClickable, rewardGroups } from '../utils/roomDisplay.js'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  /** 可选：为每个奖励池补一行来源说明（副本预览掉落用）。 */
  sourceOf: { type: Function, default: null },
  /** 紧凑模式 */
  dense: { type: Boolean, default: false },
  /** 是否为概率明细弹窗展开模式 */
  breakdown: { type: Boolean, default: false }
})

const emit = defineEmits(['item-click'])
const groups = computed(() => rewardGroups(props.entries))

const handleImgError = handleImageFallback

const handleClick = (entry) => {
  if (isRewardClickable(entry)) {
    emit('item-click', entry.typeId)
  }
}

/** 计算单个条目的单次概率与综合概率 */
const resolveEntryProb = (entry, group = null) => {
  const groupRate = Number(entry?.groupRate ?? group?.rate ?? 1)
  const groupCount = Number(entry?.groupCount ?? group?.count ?? 1)

  // 1. 池内单次概率 pSingle
  let pSingle = Number(entry?.actualProb ?? 1)
  if (entry?.groupRate && entry.groupRate > 0 && entry.actualProb !== undefined) {
    pSingle = Math.min(1, entry.actualProb / entry.groupRate)
  }

  // 2. 最终综合获得概率 compositeProb（计入池子本身的触发率 groupRate）
  let compositeProb
  if (pSingle >= 1) {
    compositeProb = groupRate
  } else if (groupCount <= 1) {
    compositeProb = pSingle * groupRate
  } else {
    compositeProb = groupRate * (1 - Math.pow(1 - pSingle, groupCount))
  }
  compositeProb = Math.min(1, Math.max(0, compositeProb))

  return {
    groupRate,
    groupCount,
    singleProb: pSingle,
    compositeProb
  }
}

/** 统一大背包货架列表：去重归并，计算合并综合概率，按品质降序排列 */
const unifiedEntries = computed(() => {
  const map = new Map()
  for (const group of groups.value) {
    for (const entry of group.entries) {
      const key = entry.typeId || `${entry.name}-${entry.groupIndex}`
      const prob = resolveEntryProb(entry, group)

      if (!map.has(key)) {
        map.set(key, {
          ...entry,
          _prob: prob,
          _sources: [{ groupIndex: group.index, prob }]
        })
      } else {
        const existing = map.get(key)
        existing._sources.push({ groupIndex: group.index, prob })
        // 多池合并获得概率公式：1 - (1 - P1)*(1 - P2)
        const p1 = existing._prob.compositeProb
        const p2 = prob.compositeProb
        const combined = 1 - (1 - p1) * (1 - p2)
        existing._prob = {
          ...existing._prob,
          compositeProb: Math.min(1, Math.max(0, combined))
        }
        if (Number(entry.quality || 0) > Number(existing.quality || 0)) {
          existing.quality = entry.quality
        }
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const qDiff = Number(b.quality || 0) - Number(a.quality || 0)
    if (qDiff !== 0) return qDiff
    return (b._prob.compositeProb || 0) - (a._prob.compositeProb || 0)
  })
})

/** 悬停浮层规则简述 */
const tooltipRuleText = (rate, count) => {
  if (rate < 1) {
    return `${Math.round(rate * 100)}% 触发 · ${count} 件`
  }
  return `${count} 件`
}

/** 弹窗明细模式下的标头文字（放在奖励池 X 右边） */
const breakdownRuleText = (group) => {
  if (group.rate < 1) {
    return `（${Math.round(group.rate * 100)}% 触发 · ${group.count} 件）`
  }
  return `（${group.count} 件）`
}

/** 鼠标悬停时动态计算边界，防止 Tooltip 溢出弹窗或视口边缘，上方受限时向下翻转 */
const onSlotEnter = (event) => {
  const slot = event.currentTarget
  const tooltip = slot.querySelector('.reward-slot__tooltip')
  if (!tooltip) return

  // 1. 容器检测（弹窗内容区或视口/页面）
  const container = slot.closest('.ui-modal-body, .ui-modal-window')
  const header = document.querySelector('.site-header, .app-header')
  const containerTop = container ? container.getBoundingClientRect().top : (header ? header.getBoundingClientRect().bottom : 60)
  const containerLeft = container ? container.getBoundingClientRect().left : 10
  const containerRight = container ? container.getBoundingClientRect().right : window.innerWidth - 10

  const slotRect = slot.getBoundingClientRect()
  const spaceAbove = slotRect.top - containerTop

  // 2. 垂直检测：上方空间不足（< 115px）时翻转朝下展示
  const shouldFlip = spaceAbove < 115
  tooltip.classList.toggle('is-flipped-bottom', shouldFlip)

  // 3. 水平检测：防左右两侧溢出
  const tooltipRect = tooltip.getBoundingClientRect()
  const pad = 12
  let shiftX = 0

  if (tooltipRect.left < containerLeft + pad) {
    shiftX = (containerLeft + pad) - tooltipRect.left
  } else if (tooltipRect.right > containerRight - pad) {
    shiftX = (containerRight - pad) - tooltipRect.right
  }

  if (Math.abs(shiftX) > 1) {
    tooltip.style.transform = `translateX(calc(-50% + ${Math.round(shiftX)}px))`
    const maxShift = Math.max(0, tooltipRect.width / 2 - 14)
    const arrowShift = Math.max(-maxShift, Math.min(maxShift, -shiftX))
    tooltip.style.setProperty('--arrow-shift', `${Math.round(arrowShift)}px`)
  } else {
    tooltip.style.transform = 'translateX(-50%)'
    tooltip.style.setProperty('--arrow-shift', '0px')
  }
}

const onSlotLeave = (event) => {
  const slot = event.currentTarget
  const tooltip = slot.querySelector('.reward-slot__tooltip')
  if (tooltip) {
    tooltip.style.setProperty('--arrow-shift', '0px')
  }
}

/** 数量角标：如 ×1，×2~3 */
const slotCountText = (entry) => {
  if (entry.min === undefined || entry.max === undefined) return ''
  return `×${entry.min === entry.max ? entry.min : `${entry.min}~${entry.max}`}`
}

/** 角标综合概率简写 */
const slotProbText = (prob) => {
  if (prob === undefined || prob === null) return ''
  const percent = prob * 100
  if (percent >= 100) return '100%'
  if (percent <= 0) return ''
  if (percent < 0.01) return '<0.01%'
  if (percent >= 10) return `${Math.round(percent)}%`
  return `${percent.toFixed(1)}%`
}

/** Tooltip 里展示的高精度百分比 */
const formatDetailPercent = (probability) => {
  if (probability == null) return ''
  const percent = probability * 100
  if (percent > 0 && percent < 0.01) return '<0.01'
  return percent.toFixed(2)
}
</script>

<style scoped>
.reward-pools {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 弹窗明细模式 */
.breakdown-pool {
  margin-bottom: 14px;
}
.breakdown-pool:last-child {
  margin-bottom: 0;
}
.breakdown-pool__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-main);
}
.breakdown-pool__title {
  font-weight: 700;
}
.breakdown-pool__rule {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}
.breakdown-pool__source {
  color: var(--accent-ink);
  background: var(--hover-bg);
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 700;
}

/* 战利品货架：网格流整齐排列 */
.reward-shelf {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.reward-slot {
  position: relative;
  width: 66px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  user-select: none;
}
.reward-slot:hover {
  z-index: 100;
}
.breakdown-pool:has(.reward-slot:hover) {
  position: relative;
  z-index: 100;
}
.reward-slot.is-clickable {
  cursor: pointer;
}
.reward-slot.is-clickable:hover .reward-slot__box {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
}

.reward-slot__box {
  position: relative;
  width: 66px;
  height: 66px;
  border-radius: 6px;
  border: 2px solid var(--border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: var(--paper-soft);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.reward-slot__icon {
  width: 82%;
  height: 82%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}
.reward-slot__placeholder {
  font-size: 20px;
  color: var(--text-muted);
}

/* 右上角概率角标 */
.reward-slot__prob {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(28, 20, 12, 0.85);
  color: #fce8bd;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  letter-spacing: -0.2px;
}

/* 右下角数量角标 */
.reward-slot__count {
  position: absolute;
  bottom: 2px;
  right: 3px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
  -webkit-text-stroke: 2px rgba(28, 20, 12, 0.95);
  paint-order: stroke fill;
}

/* 物品名称：居中并最多两行展示 */
.reward-slot__name {
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-main);
  text-align: center;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

/* 桌面端悬浮气泡浮层（Tooltip - 温暖羊皮纸风格） */
.reward-slot__tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 230px;
  padding: 8px 10px;
  background: var(--paper-soft, #e9dcc3);
  border: 1px solid var(--border-color, #8f7351);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(43, 31, 21, 0.22), 0 1px 3px rgba(43, 31, 21, 0.12);
  color: var(--text-main, #3e2a14);
  font-size: 11px;
  line-height: 1.5;
  z-index: 60;
  pointer-events: none;
  text-align: left;
}

/* 顶部空间受限时翻转朝下展示 */
.reward-slot__tooltip.is-flipped-bottom {
  bottom: auto;
  top: calc(100% + 8px);
}

/* 小三角箭头 - 外边框 */
.reward-slot__tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: calc(50% + var(--arrow-shift, 0px));
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: var(--border-color, #8f7351) transparent transparent transparent;
}

/* 小三角箭头 - 背景填充 */
.reward-slot__tooltip::after {
  content: '';
  position: absolute;
  top: calc(100% - 1px);
  left: calc(50% + var(--arrow-shift, 0px));
  transform: translateX(-50%);
  border-width: 5px;
  border-style: solid;
  border-color: var(--paper-soft, #e9dcc3) transparent transparent transparent;
}

/* 翻转朝下时小三角箭头方向调整：指向上方 */
.reward-slot__tooltip.is-flipped-bottom::before {
  top: auto;
  bottom: 100%;
  border-color: transparent transparent var(--border-color, #8f7351) transparent;
}
.reward-slot__tooltip.is-flipped-bottom::after {
  top: auto;
  bottom: calc(100% - 1px);
  border-color: transparent transparent var(--paper-soft, #e9dcc3) transparent;
}

.reward-slot__tooltip-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}
.reward-slot__tooltip-line {
  font-size: 11px;
  color: var(--text-main, #3e2a14);
}
.reward-slot__tooltip-rule {
  color: var(--text-main, #3e2a14);
  font-weight: 600;
}
.reward-slot__tooltip-highlight {
  color: #9c5700;
  font-weight: 700;
}
:global(.dark-mode) .reward-slot__tooltip-highlight {
  color: var(--gold, #c9a24b);
}
.reward-slot__tooltip-muted {
  color: var(--text-muted, #6b5134);
  font-size: 10px;
}
.reward-slot__tooltip-detail {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  color: var(--text-muted, #6b5134);
  font-size: 10px;
  line-height: 1.4;
}

/* 仅在支持鼠标悬停的桌面端激活浮层 */
@media (hover: hover) and (pointer: fine) {
  .reward-slot:hover .reward-slot__tooltip {
    display: block;
  }
}

/* 移动端视口适配：自适应网格均分（5列自适应流，自然靠左对齐），消除行末尴尬留白 */
@media (max-width: 640px) {
  .reward-shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
    gap: 6px 8px;
  }
  .reward-slot {
    width: 100%;
    min-width: 0;
  }
  .reward-slot__box {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
  .reward-slot__name {
    font-size: 10px;
  }
  .reward-slot__prob {
    font-size: 9px;
    padding: 1px 3px;
  }
  .reward-slot__count {
    font-size: 10px;
  }
}

/* 密集模式（如特殊掉落卡片、房间掉落列表） */
.reward-pools--dense .reward-shelf {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 8px;
}
@media (min-width: 641px) {
  .reward-pools--dense .reward-shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, 58px);
    gap: 8px 8px;
  }
  .reward-pools--dense .reward-slot {
    width: 58px;
  }
  .reward-pools--dense .reward-slot__box {
    width: 58px;
    height: 58px;
  }
  .reward-pools--dense .reward-slot__name {
    font-size: 11px;
    width: 58px;
  }
}
</style>
