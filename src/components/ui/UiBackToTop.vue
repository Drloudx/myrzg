<template>
  <Transition name="ui-btt-fade">
    <button
      v-show="isVisible"
      class="ui-back-to-top"
      title="回到顶部"
      aria-label="回到顶部"
      @click="scrollToTop"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </button>
  </Transition>
</template>

<script setup>
/**
 * UiBackToTop —— 回到顶部悬浮按钮（木质圆钮）
 * scrollContainer: CSS 选择器（如 "#itemsGridScroll"），缺省监听 window 滚动
 */
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  scrollContainer: { type: String, default: '' }
})

const isVisible = ref(false)
let scrollTarget = null
let ticking = false

const getScrollTarget = () => {
  if (!scrollTarget && props.scrollContainer) {
    scrollTarget = document.querySelector(props.scrollContainer)
  }
  return scrollTarget
}

const handleScroll = (e) => {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    const el = getScrollTarget() || (e && e.target ? e.target : window)
    const scrollTop = el && el.scrollTop !== undefined
      ? el.scrollTop
      : (window.scrollY || document.documentElement.scrollTop || 0)
    isVisible.value = scrollTop > 100
    ticking = false
  })
}

const scrollToTop = () => {
  const el = getScrollTarget()
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, true)
})
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true)
  scrollTarget = null
})
</script>

<style scoped>
.ui-back-to-top {
  position: fixed;
  right: 20px;
  bottom: calc(24px + var(--safe-bottom, 0px));
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--wood-soft, #463424), var(--wood, #2b1f15));
  color: var(--paper, #dfceb3);
  border: 2px solid var(--border-color, #8f7351);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(223, 206, 179, 0.25);
  cursor: pointer;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  transform: translateZ(0);
  will-change: opacity;
  padding: 0;
}
.ui-btt-fade-enter-active, .ui-btt-fade-leave-active {
  transition: opacity 0.25s ease;
}
.ui-btt-fade-enter-from, .ui-btt-fade-leave-to {
  opacity: 0;
}
@media (min-width: 800px) {
  .ui-back-to-top {
    right: calc(50% - 400px);
  }
}
@media (hover: hover) {
  .ui-back-to-top:hover {
    border-color: var(--accent-bright, #7a9a99);
    background: linear-gradient(180deg, var(--wood, #2b1f15), var(--wood-deep, #1e150d));
  }
}
</style>
