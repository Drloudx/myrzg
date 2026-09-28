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
 * scrollContainer: CSS 选择器（如 "#itemsGridScroll"）；桌面列表进入文档流后自动回退到 App 原生滚动根
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { getScrollTop, resolveScrollRootFromEvent, resolveScrollTarget } from '../../utils/scrollTarget.js'

const props = defineProps({
  scrollContainer: { type: String, default: '' }
})

const isVisible = ref(false)
let ticking = false

/**
 * 滚动处理是**热路径**（每帧都可能跑），所以这里只做两件零布局开销的事：
 * ① 用事件的 target 判断这次滚动是不是本列表的滚动根；② 读 scrollTop。
 *
 * 不要改回 `resolveScrollTarget()` + `getScrollMetrics()`：前者读 scrollHeight 判断
 * "哪个元素真的能滚"、后者会连 scrollHeight 一起读，两者都**强制同步布局**
 * （2026-09-27 实测单次 12~14ms、最高 46ms；每次滚动事件造成 2 次布局、占主线程 13%）。
 * 按钮只需要一个 scrollTop，不需要任何几何信息。
 */
const preferredRoot = () => (props.scrollContainer ? document.querySelector(props.scrollContainer) : null)

const handleScroll = event => {
  const root = resolveScrollRootFromEvent(event, preferredRoot())
  if (!root) return
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    isVisible.value = getScrollTop(root) > 100
    ticking = false
  })
}

const scrollToTop = () => {
  // 动作路径：一次点击一次，这里用会强制布局的 resolveScrollTarget 是可以的
  const el = resolveScrollTarget(props.scrollContainer)
  if (el && el !== window) {
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
})
</script>

<style scoped>
.ui-back-to-top {
  position: fixed;
  right: 20px;
  bottom: calc(24px + var(--safe-bottom, 0px));
  width: var(--floating-control-size, 44px);
  height: var(--floating-control-size, 44px);
  box-sizing: border-box;
  border-radius: 50%;
  background: var(--floating-control-background, linear-gradient(180deg, #463424, #2b1f15));
  color: var(--on-wood-text);
  border: var(--floating-control-border, 2px solid #8f7351);
  box-shadow: var(--floating-control-shadow, 0 4px 12px rgba(0, 0, 0, 0.4));
  cursor: pointer;
  z-index: var(--floating-control-z, 6002);
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
@media (min-width: 1025px) and (max-width: 1400px) {
  .ui-back-to-top {
    right: 270px;
  }
}
@media (min-width: 1401px) {
  .ui-back-to-top {
    right: calc((100vw - 1400px) / 2 + 270px);
  }
}
@media (hover: hover) {
  .ui-back-to-top:hover {
    border-color: var(--accent-bright, #7a9a99);
    background: linear-gradient(180deg, var(--wood, #2b1f15), var(--wood-deep, #1e150d));
  }
}
</style>
