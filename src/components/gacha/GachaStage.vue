<template>
  <div ref="stageEl" class="gacha-stage" :class="{ 'gacha-stage--clear': clear }">
    <!-- 整页背板：把设计画布之外的留白用同一张主视觉的模糊放大版铺满，
         页面看起来是整屏游戏画面而不是居中的一个小方块 -->
    <div
      v-if="backdrop"
      class="gacha-bleed"
      :style="{ backgroundImage: `url(${backdrop})` }"
      aria-hidden="true"
    ></div>
    <div class="gacha-canvas" :class="{ 'gacha-canvas--fill': fit === 'height' }" :style="canvasStyle">
      <slot />
    </div>
    <!-- HUD 槽：不随画布缩放，直接锚定舞台（视口）边缘——游戏 NGUI UIRoot 按高度
         缩放后，跳过/分享等屏幕边按钮跟随窗口而不是 1534 画布 -->
    <div v-if="$slots.hud" class="gacha-hud">
      <slot name="hud" />
    </div>
    <!-- 设计画布是 1534×750 的横屏比例（2.045）；竖屏容器只能等比缩成一条窄带，
         这里给出非阻塞提示，画面本身仍保持完整不裁切 -->
    <div v-if="showRotateHint" class="gacha-rotate-hint">
      <span class="g-text g-text--sm">本页按页面为横屏设计，横屏或更宽的窗口下显示更完整</span>
    </div>
  </div>
</template>

<script setup>
/**
 * 卡池设计画布容器。
 *
 * 把 1534×750 的游戏设计分辨率等比缩放到可用区域并居中（见 `utils/gachaLayout.js`），
 * 子元素用 `gachaPos(x, y)` 直接写原始 prefab 坐标，不参与响应式重排。
 * 所有卡池业务组件都必须挂在本容器内，禁止各自再算缩放。
 *
 * `backdrop` 传入主视觉图片路径时，会用它在画布外圈铺一层模糊放大的背板，
 * 使整页（顶栏/导航已由 App 隐藏）看起来是完整游戏画面；画布本身始终 contain、不裁切。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { gachaFitScale, gachaFitScaleByHeight } from '../../utils/gachaLayout'

const props = defineProps({
  /** 整页背板图片（通常传当前卡池主视觉），不传则只显示纯色底。 */
  backdrop: { type: String, default: '' },
  /** 舞台底色透明：用于叠加在卡池页之上的弹层（如概率详情/记录查询），
   *  游戏中 heroPoolTip 是 HeroPoolPanel 的子面板，打开时卡池页仍在背后可见。 */
  clear: { type: Boolean, default: false },
  /** 缩放模式：contain（默认，完整不裁切，信箱留白）| height（游戏 NGUI UIRoot
   *  口径：按高度缩放撑满，宽度随窗口延伸/裁切）。抽卡演出面板用 height。 */
  fit: { type: String, default: 'contain' }
})

const stageEl = ref(null)
const scale = ref(1)
const stageWidth = ref(0)
const showRotateHint = ref(false)
let observer = null

function measure() {
  const el = stageEl.value
  if (!el) return
  const width = el.clientWidth
  const height = el.clientHeight
  if (props.fit === 'height') {
    // 游戏 NGUI UIRoot 口径：按高度缩放撑满，画布宽度 = 视口宽 / 缩放
    // （宽视口下画布比 1534 宽，背景/桌面等动宽素材继续铺满；窄视口对称裁切）
    scale.value = height / 750
    stageWidth.value = width / scale.value
    showRotateHint.value = false
    return
  }
  scale.value = gachaFitScale(width, height)
  // 高度受限说明宽度不够（竖屏），此时画面只剩一条窄带 → 提示横屏
  const byHeight = gachaFitScaleByHeight(height)
  showRotateHint.value = byHeight > 0 && scale.value < byHeight * 0.75
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(measure)
  observer.observe(stageEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const canvasStyle = computed(() => {
  const style = { transform: `scale(${scale.value})` }
  if (props.fit === 'height' && stageWidth.value) style.width = `${stageWidth.value}px`
  return style
})
defineExpose({ scale })
</script>
