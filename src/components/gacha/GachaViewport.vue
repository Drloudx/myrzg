<template>
  <div ref="viewport" class="gacha-viewport" :data-rotated="rotated">
    <div class="gacha-viewport__content" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

// 微信等 WebView 可以锁住浏览器方向。只横置本页内容，不依赖全屏/方向锁权限。
const viewport = ref(null)
const width = ref(0)
const height = ref(0)
const touchScreen = ref(false)
const rotated = computed(() => touchScreen.value && width.value > 0 && height.value > width.value)
const contentStyle = computed(() => rotated.value ? {
  width: `${height.value}px`,
  height: `${width.value}px`,
  transform: 'translate(-50%, -50%) rotate(90deg)'
} : {})
let observer
let pointerQuery

function measure() {
  width.value = viewport.value?.clientWidth || 0
  height.value = viewport.value?.clientHeight || 0
  touchScreen.value = pointerQuery?.matches || false
}

onMounted(() => {
  pointerQuery = window.matchMedia('(pointer: coarse)')
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(viewport.value)
  pointerQuery.addEventListener('change', measure)
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  pointerQuery?.removeEventListener('change', measure)
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.gacha-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.gacha-viewport__content {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  transform-origin: center;
}
</style>
