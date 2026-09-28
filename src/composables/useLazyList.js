import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getScrollMetrics, resolveScrollRootFromEvent } from '../utils/scrollTarget.js'

/**
 * 通用无限滚动懒加载 composable
 * @param {import('vue').Ref<any[]>} sourceListRef 过滤/排序后的完整数据源
 * @param {number} pageSize 每次加载数量，默认 60
 * @param {string|null} scrollContainerSelector 可选滚动容器选择器
 */
export function useLazyList(sourceListRef, pageSize = 60, scrollContainerSelector = null) {
  const displayCount = ref(pageSize)

  // 当前切片渲染列表
  const displayedItems = computed(() => {
    if (!sourceListRef.value || !Array.isArray(sourceListRef.value)) return []
    return sourceListRef.value.slice(0, displayCount.value)
  })

  // 是否还有更多数据待加载
  const hasMore = computed(() => {
    if (!sourceListRef.value) return false
    return displayCount.value < sourceListRef.value.length
  })

  // 加载下一批（60 项）
  const loadMore = () => {
    if (hasMore.value) {
      displayCount.value += pageSize
    }
  }

  // 重置回首页（前 60 项）
  const reset = () => {
    displayCount.value = pageSize
  }

  // Ensure a lazily rendered item has a DOM node before callers try to locate it.
  const ensureItemVisible = matcherOrIndex => {
    const source = sourceListRef.value || []
    const index = typeof matcherOrIndex === 'number'
      ? matcherOrIndex
      : source.findIndex(matcherOrIndex)
    if (index < 0 || index >= source.length) return -1

    const requiredCount = Math.min(
      source.length,
      Math.ceil((index + 1) / pageSize) * pageSize
    )
    if (displayCount.value < requiredCount) displayCount.value = requiredCount
    return index
  }

  // 监听数据源变化（搜索、分类筛选切换），自动重置
  watch(sourceListRef, () => {
    reset()
  })

  // 滚动监听（使用捕获阶段 capture: true，确保能监听到任何子容器及异步挂载容器的滚动事件）
  //
  // 注意这里为什么用 resolveScrollRootFromEvent 而不是 resolveScrollTarget：
  // 滚动处理是**热路径**（每帧都可能跑），后者要读 scrollHeight 判断"哪个元素真的能滚"，
  // **强制同步布局**（2026-09-27 实测单次 12~14ms、最高 46ms）。而滚动事件的 target
  // 本身就是滚动元素，比较即可。原实现还额外用 `scopedContainer.offsetParent === null`
  // 判断容器是否隐藏——同样会强制布局，而且事件既然从该容器冒上来，它必然可见，故去掉。
  //
  // 下面的 getScrollMetrics 仍然要读 scrollHeight/clientHeight：判断"是否接近底部"
  // 本质上需要内容总高。若要进一步省掉这次布局，应换成 IntersectionObserver 哨兵元素，
  // 而不是在这里做缓存（缓存会在"数据加载后列表才变成可滚"时失效）。
  let ticking = false

  const handleScroll = (e) => {
    const scopedContainer = scrollContainerSelector
      ? document.querySelector(scrollContainerSelector)
      : null
    const activeTarget = resolveScrollRootFromEvent(e, scopedContainer)
    if (!activeTarget) return
    if (ticking) return
    ticking = true
    window.requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = getScrollMetrics(activeTarget)
      if (scrollTop + clientHeight >= scrollHeight - 300) loadMore()
      ticking = false
    })
  }

  onMounted(() => {
    // 关键：scroll 事件不冒泡，但可以通过 window 捕获阶段 (capture: true) 拦截所有子容器的滚动
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll, { capture: true })
  })

  return {
    displayCount,
    displayedItems,
    hasMore,
    loadMore,
    reset,
    ensureItemVisible
  }
}
