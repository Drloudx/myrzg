<template>
  <div class="ui-tabs-shell" :class="{ 'is-scrollable': canScroll, 'is-at-end': isAtEnd }">
    <div ref="tabsRef" class="ui-tabs" role="tablist" @scroll="syncScrollState">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        role="tab"
        class="ui-tabs__item"
        :class="{ 'is-active': modelValue === opt.value }"
        @click="emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
    <span v-if="canScroll && !isAtEnd" class="ui-tabs__scroll-cue" aria-hidden="true"></span>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * UiTabs —— 墨迹下划线页签（详情页内部子页签）
 * options: [{ value, label }]
 */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const tabsRef = ref(null)
const canScroll = ref(false)
const isAtEnd = ref(true)

const syncScrollState = () => {
  const el = tabsRef.value
  if (!el) return
  canScroll.value = el.scrollWidth > el.clientWidth + 1
  isAtEnd.value = !canScroll.value || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

const revealActiveTab = () => {
  const el = tabsRef.value
  const active = el?.querySelector('.ui-tabs__item.is-active')
  if (!el || !active) {
    syncScrollState()
    return
  }

  const containerRect = el.getBoundingClientRect()
  const activeRect = active.getBoundingClientRect()
  if (activeRect.left < containerRect.left) {
    el.scrollBy({ left: activeRect.left - containerRect.left - 12, behavior: 'smooth' })
  } else if (activeRect.right > containerRect.right) {
    el.scrollBy({ left: activeRect.right - containerRect.right + 12, behavior: 'smooth' })
  }
  requestAnimationFrame(syncScrollState)
}

onMounted(() => {
  nextTick(() => {
    syncScrollState()
    revealActiveTab()
  })
  window.addEventListener('resize', syncScrollState)
})

onBeforeUnmount(() => window.removeEventListener('resize', syncScrollState))

watch(() => [props.modelValue, props.options.length], () => nextTick(revealActiveTab))
</script>

<style scoped>
.ui-tabs-shell {
  position: relative;
  min-width: 0;
}

.ui-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 2px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  overflow-x: auto;
  scrollbar-width: none;
}
.ui-tabs::-webkit-scrollbar { display: none; }
.ui-tabs-shell.is-scrollable:not(.is-at-end)::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 2px;
  width: 28px;
  pointer-events: none;
  background: linear-gradient(to right, transparent, var(--paper, #dfceb3) 78%);
  opacity: 0.94;
}
.ui-tabs__scroll-cue {
  position: absolute;
  right: 7px;
  top: 50%;
  width: 7px;
  height: 7px;
  border-top: 2px solid var(--accent-ink, #557574);
  border-right: 2px solid var(--accent-ink, #557574);
  transform: translateY(-60%) rotate(45deg);
  pointer-events: none;
  z-index: 1;
}
.ui-tabs__item {
  position: relative;
  background: transparent;
  border: none;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted, #6b5134);
  cursor: pointer;
  white-space: nowrap;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  transition: color 0.15s ease;
}
.ui-tabs__item:hover {
  color: var(--text-main, #3e2a14);
}
.ui-tabs__item.is-active {
  color: var(--accent-ink, #557574);
  font-weight: 700;
}
.dark-mode .ui-tabs__item.is-active {
  color: var(--accent-bright, #93b3b2);
}
.ui-tabs__item.is-active::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -2px;
  height: 3px;
  background: var(--accent-bright, #7a9a99);
  border-radius: 2px 2px 0 0;
  box-shadow: 0 -1px 2px rgba(0, 0, 0, 0.2);
}
</style>
