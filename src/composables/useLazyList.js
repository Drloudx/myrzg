import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

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

  // 监听数据源变化（搜索、分类筛选切换），自动重置
  watch(sourceListRef, () => {
    reset()
  })

  // 滚动监听（使用捕获阶段 capture: true，确保能监听到任何子容器及异步挂载容器的滚动事件）
  let ticking = false

  const handleScroll = (e) => {
    if (ticking) return
    ticking = true
    window.requestAnimationFrame(() => {
      const target = e?.target
      if (target && target.scrollHeight) {
        // 如果是特定选择器，且当前滚动的元素不匹配则跳过（除非是根节点或未指定）
        if (scrollContainerSelector && target.id && !scrollContainerSelector.includes(target.id) && target !== document.documentElement && target !== document.body) {
          // 容器不匹配，不拦截
        } else {
          const scrollTop = target.scrollTop !== undefined ? target.scrollTop : (window.scrollY || 0)
          const scrollHeight = target.scrollHeight || document.documentElement.scrollHeight
          const clientHeight = target.clientHeight || window.innerHeight

          // 距离底部 300px 阈值时触发加载更多
          if (scrollTop + clientHeight >= scrollHeight - 300) {
            loadMore()
          }
        }
      }
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
    reset
  }
}
