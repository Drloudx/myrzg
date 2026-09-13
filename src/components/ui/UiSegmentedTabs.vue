<template>
  <div class="ui-segmented" :class="{ 'is-scrollable': canScroll, 'is-at-end': isAtEnd }">
    <div
      ref="scrollerRef"
      class="ui-segmented__scroller"
      :class="{ 'is-dragging': isDragging }"
      role="tablist"
      @scroll="syncScrollState"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="finishPointerDrag"
      @pointercancel="cancelPointerDrag"
    >
      <button
        v-for="opt in options"
        :key="getOptionValue(opt)"
        type="button"
        role="tab"
        class="ui-segmented__item"
        :class="{ 'is-active': modelValue === getOptionValue(opt) }"
        @click="selectOption(getOptionValue(opt))"
      >
        {{ opt.label ?? opt.name ?? opt.title ?? getOptionValue(opt) }}
      </button>
    </div>
    <span v-if="canScroll && !isAtEnd" class="ui-segmented__scroll-cue" aria-hidden="true"></span>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * UiSegmentedTabs —— 木刻分段切换（图鉴大分类/状态页签）
 * options: [{ value, label }]
 */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])
const scrollerRef = ref(null)
const canScroll = ref(false)
const isAtEnd = ref(true)
const isDragging = ref(false)
let dragPointerId = null
let dragStartX = 0
let dragStartScrollLeft = 0
let dragMoved = false
let suppressNextClick = false

const getOptionValue = (opt) => {
  if (typeof opt === 'string' || typeof opt === 'number') return opt
  if (!opt) return ''
  return opt.value !== undefined ? opt.value : (opt.key !== undefined ? opt.key : opt.id)
}

const syncScrollState = () => {
  const el = scrollerRef.value
  if (!el) return
  canScroll.value = el.scrollWidth > el.clientWidth + 1
  isAtEnd.value = !canScroll.value || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

const revealActiveOption = () => {
  const el = scrollerRef.value
  const active = el?.querySelector('.ui-segmented__item.is-active')
  if (!el || !active) {
    syncScrollState()
    return
  }

  const containerRect = el.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  if (activeRect.left < containerRect.left) {
    el.scrollBy({ left: activeRect.left - containerRect.left - 8, behavior: 'smooth' })
  } else if (activeRect.right > containerRect.right) {
    el.scrollBy({ left: activeRect.right - containerRect.right + 8, behavior: 'smooth' })
  }
  requestAnimationFrame(syncScrollState)
}

const handlePointerDown = event => {
  const el = scrollerRef.value
  if (!el || !canScroll.value || event.pointerType !== 'mouse' || event.button !== 0) return
  dragPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartScrollLeft = el.scrollLeft
  dragMoved = false
}

const handlePointerMove = event => {
  const el = scrollerRef.value
  if (!el || dragPointerId !== event.pointerId) return
  const deltaX = event.clientX - dragStartX
  if (!dragMoved && Math.abs(deltaX) < 4) return
  if (!dragMoved) el.setPointerCapture(event.pointerId)
  dragMoved = true
  suppressNextClick = true
  isDragging.value = true
  event.preventDefault()
  el.scrollLeft = dragStartScrollLeft - deltaX
}

const finishPointerDrag = event => {
  const el = scrollerRef.value
  if (!el || dragPointerId !== event.pointerId) return
  if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId)
  dragPointerId = null
  isDragging.value = false
  syncScrollState()
  if (dragMoved) window.setTimeout(() => { suppressNextClick = false }, 0)
}

const cancelPointerDrag = event => {
  if (dragPointerId !== event.pointerId) return
  dragPointerId = null
  dragMoved = false
  suppressNextClick = false
  isDragging.value = false
}

const selectOption = value => {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }
  emit('update:modelValue', value)
}

onMounted(() => {
  nextTick(revealActiveOption)
  window.addEventListener('resize', syncScrollState)
})

onBeforeUnmount(() => window.removeEventListener('resize', syncScrollState))

watch(() => [props.modelValue, props.options.length], () => nextTick(revealActiveOption))
</script>

<style scoped>
.ui-segmented {
  position: relative;
  display: inline-flex;
  padding: 4px;
  background: var(--wood, #2b1f15);
  border: 1px solid var(--segmented-border);
  border-radius: 6px;
  box-sizing: border-box;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.45);
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}
.ui-segmented__scroller {
  display: flex;
  align-items: center;
  gap: 3px;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.ui-segmented__scroller::-webkit-scrollbar { display: none; }
.ui-segmented.is-scrollable .ui-segmented__scroller,
.ui-segmented.is-scrollable .ui-segmented__item { cursor: grab; }
.ui-segmented__scroller.is-dragging,
.ui-segmented__scroller.is-dragging .ui-segmented__item { cursor: grabbing; user-select: none; }
.ui-segmented.is-scrollable:not(.is-at-end)::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  bottom: 4px;
  width: 30px;
  background: linear-gradient(to right, transparent, var(--wood, #2b1f15) 76%);
  pointer-events: none;
}
.ui-segmented__scroll-cue {
  position: absolute;
  right: 11px;
  top: 50%;
  width: 7px;
  height: 7px;
  border-top: 2px solid var(--segmented-text-hover);
  border-right: 2px solid var(--segmented-text-hover);
  transform: translateY(-50%) rotate(45deg);
  pointer-events: none;
  z-index: 1;
}
.ui-segmented__item {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--segmented-text);
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  white-space: nowrap;
  font-family: var(--font-ui);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}
.ui-segmented__item:hover {
  color: var(--segmented-text-hover);
}
.ui-segmented__item.is-active {
  background: var(--segmented-active-bg);
  color: var(--segmented-active-color);
  font-weight: 700;
  text-shadow: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
</style>
