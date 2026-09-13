<template>
  <UiCardGrid
    ref="frame"
    :id="id"
    :wide="wide"
    :small="small"
    class="ui-virtual-grid"
    :content-style="{ position: 'relative', height: items.length ? `${totalSize}px` : undefined }"
  >
    <div
      v-for="row in virtualRows"
      :key="row.key"
      :ref="measureRow"
      :data-index="row.index"
      class="ui-virtual-grid__row"
      :style="{
        transform: `translateY(${row.start - scrollMargin}px)`,
        gridTemplateColumns: columnTemplate,
        columnGap: `${columnGap}px`
      }"
    >
      <template v-for="(item, offset) in rowItems(row.index)" :key="keyForItem(item)">
        <slot :item="item" :index="row.index * columns + offset" />
      </template>
    </div>
    <slot v-if="!items.length" name="empty" />
  </UiCardGrid>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import UiCardGrid from './UiCardGrid.vue'

const props = defineProps({
  id: { type: String, default: '' },
  items: { type: Array, required: true },
  itemKey: { type: [String, Function], default: 'id' },
  estimateSize: { type: Number, default: 120 },
  overscan: { type: Number, default: 3 },
  wide: { type: Boolean, default: false },
  small: { type: Boolean, default: false }
})

const frame = ref(null)
const scrollElement = shallowRef(null)
const columns = ref(1)
const columnTemplate = ref('minmax(0, 1fr)')
const columnGap = ref(0)
const rowGap = ref(0)
const scrollMargin = ref(0)
let resizeObserver = null
let layoutFrame = 0
let measuredWidth = 0

const keyForItem = item => typeof props.itemKey === 'function' ? props.itemKey(item) : item[props.itemKey]
const rowItems = index => props.items.slice(index * columns.value, (index + 1) * columns.value)
const virtualizer = useVirtualizer(computed(() => {
  const source = props.items
  const columnCount = columns.value
  return {
    count: Math.ceil(source.length / columnCount),
    getScrollElement: () => scrollElement.value,
    estimateSize: () => props.estimateSize,
    getItemKey: index => `${columnCount}:${keyForItem(source[index * columnCount])}`,
    gap: rowGap.value,
    scrollMargin: scrollMargin.value,
    overscan: props.overscan
  }
}))

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())
const measureRow = element => virtualizer.value.measureElement(element)

const refreshLayout = () => {
  layoutFrame = 0
  const grid = frame.value?.gridElement
  const preferred = frame.value?.scrollElement
  if (!grid || !preferred || !grid.clientWidth) return

  // Keep the same owner while a modal temporarily clamps its scroll range.
  const owner = window.matchMedia('(min-width: 1025px)').matches
    ? document.querySelector('.app-container') || preferred
    : preferred
  scrollElement.value = owner
  const style = getComputedStyle(grid)
  const tracks = style.gridTemplateColumns.split(/\s+/).filter(Boolean)
  const nextColumns = Math.max(1, tracks.length)
  const width = grid.clientWidth
  const changedWidth = measuredWidth !== width || columns.value !== nextColumns
  measuredWidth = width
  columns.value = nextColumns
  columnTemplate.value = style.gridTemplateColumns
  columnGap.value = Number.parseFloat(style.columnGap) || 0
  rowGap.value = Number.parseFloat(style.rowGap) || 0
  scrollMargin.value = grid.getBoundingClientRect().top - owner.getBoundingClientRect().top + owner.scrollTop
  if (changedWidth) virtualizer.value.measure()
}

const scheduleLayout = () => {
  if (!layoutFrame) layoutFrame = requestAnimationFrame(refreshLayout)
}

const scrollToItem = async (keyOrIndex, options = {}) => {
  await nextTick()
  refreshLayout()
  const index = typeof keyOrIndex === 'number'
    ? keyOrIndex
    : props.items.findIndex(item => typeof keyOrIndex === 'function' ? keyOrIndex(item) : keyForItem(item) === keyOrIndex)
  if (index < 0 || index >= props.items.length) return -1
  const rowIndex = Math.floor(index / columns.value)
  virtualizer.value.scrollToIndex(rowIndex, { align: 'center', ...options })
  await new Promise(resolve => requestAnimationFrame(resolve))
  await nextTick()
  virtualizer.value.scrollToIndex(rowIndex, { align: 'center', ...options })
  return index
}

onMounted(() => {
  refreshLayout()
  resizeObserver = new ResizeObserver(scheduleLayout)
  resizeObserver.observe(frame.value.gridElement)
  resizeObserver.observe(frame.value.scrollElement)
  const filter = frame.value.scrollElement.closest('.page-view-container')?.querySelector('.filter-panel')
  if (filter) resizeObserver.observe(filter)
  window.addEventListener('resize', scheduleLayout, { passive: true })
})

watch(() => props.items, async () => {
  await nextTick()
  refreshLayout()
  scrollElement.value?.scrollTo({ top: 0, behavior: 'auto' })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', scheduleLayout)
  if (layoutFrame) cancelAnimationFrame(layoutFrame)
})

defineExpose({ scrollToItem })
</script>

<style scoped>
.ui-virtual-grid {
  overflow-anchor: none;
}
.ui-virtual-grid__row {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: grid;
  align-items: start;
  box-sizing: border-box;
}
@media (max-width: 1024px) {
  .ui-virtual-grid {
    padding-bottom: calc(88px + var(--floating-control-size, 44px) + var(--safe-bottom, 0px));
  }
}
</style>
