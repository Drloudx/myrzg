<!--
  章节地区路线图：点进章节后的那张关卡地图（底图 + 关卡/地区/副本/探索节点 + 连线）。

  数据来自构建期产物 `chapters.json.map.regions[cid]`：节点坐标与摆放偏移照源码
  `MapPanel.InitMapPanel`（关卡在 (x,y)，地区上移 80、副本入口上移 75），连线直接取
  `area.map.link`。底图按 `bgPos` 居中摆放，尺寸用图片自身像素（不在产物里存宽高）。

  画布比可视区大得多（2727×2406 ~ 3456×2144），所以需要缩放平移：
  用显式的平移偏移而不是 scrollLeft —— 缩到比容器小时 scrollLeft 恒为 0，拖动会完全失效。
  节点标记按 1/zoom 反向缩放，保持屏幕上恒定大小，否则缩小后标签读不清。

  可访问性：节点是真按钮（可 Tab、可回车），缩放控件与「展开列表」也是。
-->
<template>
  <div class="region-map">
    <div ref="viewportRef" class="region-map__viewport" :style="{ height: `${height}px` }" @wheel="handleWheel" @pointerdown="handlePointerDown" @pointermove="handlePointerMove" @pointerup="handlePointerUp" @pointercancel="handlePointerUp" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd" @touchcancel="handleTouchEnd">
      <div class="region-map__canvas" :style="canvasStyle">
        <img
          v-if="region.background"
          class="region-map__bg"
          :src="getImageUrl(region.background)"
          alt=""
          decoding="async"
          :style="bgStyle"
          @load="handleBgLoad"
          @error="handleImgError"
        />
        <svg class="region-map__links" :viewBox="`0 0 ${size.w} ${size.h}`" preserveAspectRatio="none" aria-hidden="true">
          <line v-for="(link, index) in region.links" :key="`link-${index}`" :x1="link.x1" :y1="link.y1" :x2="link.x2" :y2="link.y2" />
        </svg>
        <!--
          只有关卡节点是可点的：地区/副本/探索点是地图装饰（源码里地区节点的 BoxCollider
          是 enabled = false），用 div + pointer-events:none，否则立体图会盖住关卡节点、
          把点击吃掉。
        -->
        <component
          :is="node.kind === 'stage' ? 'button' : 'div'"
          v-for="node in region.nodes"
          :key="`${node.kind}-${node.id}`"
          class="region-map__node"
          :class="[`is-${node.kind}`, { 'is-current': node.kind === 'stage' && node.id === currentStageId }]"
          :style="nodeStyle(node)"
          :type="node.kind === 'stage' ? 'button' : undefined"
          :title="nodeTitle(node)"
          @click="handleNode(node)"
        >
          <template v-if="node.kind === 'stage'">
            <img class="region-map__node-art" :src="getImageUrl(nodeIcon(node))" alt="" decoding="async" @error="handleImgError" />
            <!-- 石台本体只有灰/橙两态，三颗宝石是各自一张 sprite 叠上去的（游戏原图，不用滤镜染） -->
            <img class="region-map__node-art region-map__node-art--gem is-mid" :src="getImageUrl(stageCrystal)" alt="" aria-hidden="true" decoding="async" @error="handleImgError" />
            <img class="region-map__node-art region-map__node-art--gem is-left" :src="getImageUrl(stageCrystalSmall)" alt="" aria-hidden="true" decoding="async" @error="handleImgError" />
            <img class="region-map__node-art region-map__node-art--gem is-right" :src="getImageUrl(stageCrystalSmall)" alt="" aria-hidden="true" decoding="async" @error="handleImgError" />
          </template>
          <img v-else-if="nodeIcon(node)" class="region-map__node-art" :src="getImageUrl(nodeIcon(node))" alt="" decoding="async" @error="handleImgError" />
          <span v-else class="region-map__node-dot"></span>
          <!--
            副本图**自带名称牌边框**（map_w1_cN_dM 里已经含「迷宫挑战」徽标 + 一块空牌子），
            所以名字直接压在图上的牌子位置，不再套地区那层边框。
          -->
          <span
            v-if="node.label"
            class="region-map__node-label"
            :class="node.kind === 'area' ? 'is-plaque' : (node.kind === 'instance' ? 'is-builtin' : '')"
          >{{ node.label }}</span>
        </component>
      </div>

      <button type="button" class="region-map__back" @click="emit('back')">
        <img :src="getImageUrl(mapTitle)" alt="返回世界地图" @error="handleImgError" />
      </button>
      <span class="region-map__hint region-map__hint--back">点击返回世界地图</span>
      <button type="button" class="region-map__chip region-map__list-btn" @click="emit('list')">展开列表</button>
      <span class="region-map__chip region-map__caption">{{ captionText }}</span>

      <div class="region-map__footer">
        <span class="region-map__hint">按住 ctrl 可用滚轮进行缩放</span>
        <div class="region-map__toolbar" role="group" aria-label="地图缩放控制">
          <button type="button" title="缩小地图" aria-label="缩小地图" :disabled="zoom <= MIN_ZOOM" @click="zoomBy(-ZOOM_STEP)">−</button>
          <output aria-label="当前缩放比例">{{ Math.round(zoom * 100) }}%</output>
          <button type="button" title="放大地图" aria-label="放大地图" :disabled="zoom >= MAX_ZOOM" @click="zoomBy(ZOOM_STEP)">+</button>
          <button type="button" title="恢复默认视图" aria-label="恢复默认视图" @click="resetView">↺</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getImageUrl, handleImageFallback } from '../../utils/env.js'

const MIN_ZOOM = 0.32
const MAX_ZOOM = 2.4
const ZOOM_STEP = 0.15
/** 初始视图在节点范围外留的边距（画布像素）。 */
const FIT_PADDING = 120
/**
 * 初始缩放相对「贴合节点范围」的放大倍数：贴合时节点间距太小、标签互相压住，
 * 放大一档后位置铺开（标记是恒定屏幕尺寸，不跟着放大），重叠明显减少。
 */
const FIT_BOOST = 1.4

const props = defineProps({
  /** `chapters.json.map.regions[cid]` */
  region: { type: Object, required: true },
  /** 世界地图标题条路径，用作「返回世界地图」按钮。 */
  mapTitle: { type: String, default: '' },
  /** 关卡节点石台图（`chapters.json.map.stagePlatform`）：{ normal, locked }。 */
  stagePlatform: { type: Object, default: () => ({ normal: '', locked: '' }) },
  /** 叠在石台中间的大宝石（`chapters.json.map.stageCrystal`）。 */
  stageCrystal: { type: String, default: '' },
  /** 叠在石台两侧的小宝石（`chapters.json.map.stageCrystalSmall`）。 */
  stageCrystalSmall: { type: String, default: '' },
  /** 当前打开的关卡 id（高亮它在路线上的位置）。 */
  currentStageId: { type: String, default: '' },
  caption: { type: String, default: '' },
  /** 可视区高度（由页面统一测量，与世界地图保持一致）。 */
  height: { type: Number, default: 640 }
})
const emit = defineEmits(['select', 'back', 'list'])

const viewportRef = ref(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const bgNatural = ref(null)
const handleImgError = handleImageFallback

const size = computed(() => ({
  w: Math.max(1, Number(props.region.size?.w || 1)),
  h: Math.max(1, Number(props.region.size?.h || 1))
}))
const captionText = computed(() => props.caption)

/** 底图按 `bgPos` 居中摆放；宽度用图片自身像素换算成画布百分比，所以产物里不必存宽高。 */
const bgStyle = computed(() => {
  if (!bgNatural.value) return { display: 'none' }
  return {
    left: `${(Number(props.region.bgPos?.x || 0) / size.value.w) * 100}%`,
    top: `${(Number(props.region.bgPos?.y || 0) / size.value.h) * 100}%`,
    width: `${(bgNatural.value.w / size.value.w) * 100}%`
  }
})

const canvasStyle = computed(() => ({
  width: `${size.value.w}px`,
  height: `${size.value.h}px`,
  transform: `scale(${zoom.value})`,
  left: `${panX.value}px`,
  top: `${panY.value}px`
}))

/** 节点标记反向缩放：父层按 zoom 缩放，这里 1/zoom 抵消，屏幕上恒定大小。 */
const nodeScale = computed(() => 1 / zoom.value)
const nodeStyle = node => ({
  left: `${(Number(node.x || 0) / size.value.w) * 100}%`,
  top: `${(Number(node.y || 0) / size.value.h) * 100}%`,
  transform: `translate(-50%, -50%) scale(${nodeScale.value})`
})

/** 节点用游戏原图：关卡是石台，地区是立体图，副本入口是入口图，探索点没有图只画点。 */
const nodeIcon = (node) => {
  if (node.kind === 'stage') return props.stagePlatform?.normal || ''
  if (node.kind === 'area' || node.kind === 'instance') return node.iconPath || ''
  return ''
}

const nodeTitle = (node) => {
  if (node.kind === 'stage') return `${node.label} ${node.name}`
  if (node.kind === 'area') return `地区：${node.label}`
  if (node.kind === 'instance') return `副本入口：${node.label}`
  return '探索点'
}

const handleNode = (node) => {
  if (node.kind !== 'stage') return
  emit('select', node.id)
}

/** 节点包围盒（加边距）：初始视图贴合它，而不是整张画布——节点通常只占画布的一小块。 */
const nodeBounds = computed(() => {
  const nodes = props.region.nodes || []
  if (!nodes.length) return { x: 0, y: 0, w: size.value.w, h: size.value.h }
  const xs = nodes.map(n => Number(n.x || 0))
  const ys = nodes.map(n => Number(n.y || 0))
  const x = Math.min(...xs) - FIT_PADDING
  const y = Math.min(...ys) - FIT_PADDING
  return {
    x,
    y,
    w: Math.max(...xs) + FIT_PADDING - x,
    h: Math.max(...ys) + FIT_PADDING - y
  }
})

const clampZoom = value => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

const viewportSize = () => {
  const el = viewportRef.value
  return { w: el?.clientWidth || 1, h: el?.clientHeight || 1 }
}

/** 平移范围：画布比可视区大时限制在边界内，小时锁居中（避免「缩小时拖不动」的错觉）。 */
const clampPan = () => {
  const view = viewportSize()
  const scaledW = size.value.w * zoom.value
  const scaledH = size.value.h * zoom.value
  panX.value = scaledW <= view.w
    ? (view.w - scaledW) / 2
    : Math.min(0, Math.max(view.w - scaledW, panX.value))
  panY.value = scaledH <= view.h
    ? (view.h - scaledH) / 2
    : Math.min(0, Math.max(view.h - scaledH, panY.value))
}

const resetView = () => {
  const view = viewportSize()
  const bounds = nodeBounds.value
  const next = clampZoom(Math.min(view.w / bounds.w, view.h / bounds.h) * FIT_BOOST)
  zoom.value = next
  // 让节点范围居中
  panX.value = (view.w - bounds.w * next) / 2 - bounds.x * next
  panY.value = (view.h - bounds.h * next) / 2 - bounds.y * next
  clampPan()
}

/** 以可视区中心为锚点缩放，避免缩放时内容乱跳。 */
const zoomAt = (next, anchorX, anchorY) => {
  const view = viewportSize()
  const cx = anchorX ?? view.w / 2
  const cy = anchorY ?? view.h / 2
  const mapX = (cx - panX.value) / zoom.value
  const mapY = (cy - panY.value) / zoom.value
  zoom.value = clampZoom(next)
  panX.value = cx - mapX * zoom.value
  panY.value = cy - mapY * zoom.value
  clampPan()
}

const zoomBy = amount => zoomAt(zoom.value + amount)

const handleBgLoad = event => {
  bgNatural.value = { w: event.target.naturalWidth, h: event.target.naturalHeight }
}

// ---------- 交互：Ctrl/⌘+滚轮缩放、拖动平移、双指捏合 ----------
const drag = ref(null)
const touch = ref(null)

const handleWheel = event => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const rect = viewportRef.value.getBoundingClientRect()
  zoomAt(zoom.value - event.deltaY * 0.0016, event.clientX - rect.left, event.clientY - rect.top)
}

const handlePointerDown = event => {
  if (event.button !== 0) return
  // 任何按钮上都不启动拖动：viewport 会 setPointerCapture，捕获后 pointerup 落在 viewport 上，
  // 按钮的 click 就不再触发（缩放条、返回、节点、胶囊全是按钮）。拖动请从地图空白处开始。
  if (event.target.closest?.('button')) return
  drag.value = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

const handlePointerMove = event => {
  if (!drag.value || drag.value.pointerId !== event.pointerId) return
  panX.value += event.clientX - drag.value.x
  panY.value += event.clientY - drag.value.y
  drag.value.x = event.clientX
  drag.value.y = event.clientY
  clampPan()
}

const handlePointerUp = event => {
  if (drag.value?.pointerId === event.pointerId) drag.value = null
}

const handleTouchStart = event => {
  if (event.touches.length === 2) {
    const [a, b] = event.touches
    touch.value = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom: zoom.value }
  }
}

const handleTouchMove = event => {
  if (!touch.value || event.touches.length !== 2) return
  event.preventDefault()
  const [a, b] = event.touches
  const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  if (!touch.value.distance) return
  const rect = viewportRef.value.getBoundingClientRect()
  zoomAt(touch.value.zoom * (distance / touch.value.distance), (a.clientX + b.clientX) / 2 - rect.left, (a.clientY + b.clientY) / 2 - rect.top)
}

const handleTouchEnd = () => { touch.value = null }

const onResize = () => clampPan()

onMounted(() => {
  resetView()
  window.addEventListener('resize', onResize, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
watch(() => props.region, () => resetView())
watch(() => props.height, () => resetView())
</script>

<style scoped>
.region-map { width: 100%; }
.region-map__viewport {
  position: relative;
  width: 100%;
  /* 有 1px 边框，必须 border-box：否则实际占位比传入的 height 多 2px，
     地图区就会比左右面板高出一截、页面多一条滚动条。 */
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--paper-dark);
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.region-map__viewport:active { cursor: grabbing; }

.region-map__canvas {
  position: absolute;
  transform-origin: 0 0;
}
.region-map__bg {
  position: absolute;
  transform: translate(-50%, -50%);
  display: block;
  max-width: none;
}
.region-map__links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
/* 连线：游戏里是金色虚线 */
.region-map__links line {
  stroke: #d8a63f;
  stroke-width: 3;
  stroke-dasharray: 8 6;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

/*
  节点：屏幕尺寸恒定（由 1/zoom 反向缩放维持），所以这里给的都是屏幕像素。
  锚点只由**图形**决定（translate(-50%,-50%) 作用在图形上），名称牌绝对定位挂在下方——
  名称牌参与布局的话会把节点整体上推，落点就不准了。
*/
.region-map__node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font-ui);
  font-weight: 700;
}
.region-map__node-art { display: block; height: auto; pointer-events: none; }
/* 关卡节点在最上层；地区/副本/探索点是装饰，既不接收指针也不参与命中 */
.region-map__node.is-stage { width: 54px; height: 54px; z-index: 3; }
.region-map__node.is-stage .region-map__node-art { position: absolute; inset: 0; width: 100%; height: auto; }
/*
  三颗宝石叠在石台上：位置是**从石台图里量出来的**。
  石台图里水晶簇的包围盒是 88×42 @ (19,0)（顶到图的最高行）——中间那颗最高，
  所以大宝石 top 0%，两侧矮一截、top 8%。
*/
.region-map__node.is-stage .region-map__node-art--gem { inset: auto; }
.region-map__node.is-stage .region-map__node-art--gem.is-mid { left: 35%; top: 0; width: 30%; }
.region-map__node.is-stage .region-map__node-art--gem.is-left { left: 15%; top: 8%; width: 24%; }
.region-map__node.is-stage .region-map__node-art--gem.is-right { left: 59%; top: 8%; width: 24%; }
.region-map__node.is-area { width: 86px; z-index: 1; pointer-events: none; }
.region-map__node.is-area .region-map__node-art { width: 86px; }
.region-map__node.is-instance { width: 72px; z-index: 2; pointer-events: none; }
.region-map__node.is-instance .region-map__node-art { width: 72px; }
.region-map__node.is-explore { width: 13px; height: 13px; z-index: 1; pointer-events: none; }

.region-map__node-dot {
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: var(--accent);
  border: 1px solid var(--accent-ink);
}

/* 关卡编号：游戏里就是一小块深色牌子 */
.region-map__node-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 1px;
  padding: 1px 8px;
  border: 1px solid #17100a;
  border-radius: 3px;
  background: rgba(43, 31, 21, 0.88);
  color: var(--paper);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
/*
  地区/副本名：用游戏里的名称牌边框（图集里的 map_a_title，两端菱形 + 金边 + 深青底）。
  两端是装饰、中段要随名字长短伸缩，所以走 border-image 而不是整张缩放，否则菱形会被拉扁。
*/
.region-map__node-label.is-plaque {
  padding: 0 24px;
  border-style: solid;
  border-width: 0 24px;
  border-color: transparent;
  border-image-source: url('/images/chapters/area_title.webp');
  border-image-slice: 0 34 fill;
  border-image-width: 0 24px;
  border-image-repeat: stretch;
  background: none;
  border-radius: 0;
  box-shadow: none;
  color: var(--paper);
  font-size: 12px;
  line-height: 30px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
/* 副本名：压在图标自带的空牌子上（牌子在图的下缘 ~82%~99% 处），不再套边框 */
.region-map__node-label.is-builtin {
  position: absolute;
  left: 50%;
  bottom: 5%;
  transform: translateX(-50%);
  padding: 0;
  border: none;
  background: none;
  box-shadow: none;
  color: #f2e3c4;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
.region-map__node.is-current .region-map__node-label { background: var(--accent); color: #fff; border-color: var(--accent-ink); }
.region-map__node.is-current .region-map__node-label.is-plaque,
.region-map__node.is-current .region-map__node-label.is-builtin { background: none; }
.region-map__node:hover .region-map__node-art { filter: brightness(1.15) drop-shadow(0 0 7px rgba(255, 214, 120, 0.95)); }
.region-map__node.is-area:hover .region-map__node-label,
.region-map__node.is-instance:hover .region-map__node-label { filter: brightness(1.18); }
.region-map__node.is-area:hover .region-map__node-label,
.region-map__node.is-instance:hover .region-map__node-label { filter: brightness(1.18); }

/* 底部右侧：提示文字在缩放条左边，与副本图鉴同一套写法 */
.region-map__footer {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
}
.region-map__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  background: var(--paper);
}
.region-map__toolbar button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--paper-soft);
  color: var(--text-main);
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}
.region-map__toolbar button:disabled { opacity: 0.45; cursor: default; }
.region-map__toolbar output { min-width: 42px; text-align: center; font-size: 11px; font-weight: 700; color: var(--text-muted); }

/* 操作提示：与副本图鉴同款，只在有鼠标的设备上显示（触屏端是双指缩放） */
.region-map__hint {
  display: none;
  color: var(--text-main);
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
@media (hover: hover) and (pointer: fine) {
  .region-map__hint { display: block; }
}
.region-map__hint--back {
  position: absolute;
  z-index: 5;
  top: 10px;
  left: calc(min(50%, 260px) + 16px);
}

/* 「世界地图」标题条：位置与尺寸和世界地图画布保持一致，在这里兼作「返回世界地图」按钮。
   按钮必须给显式宽度——它是 shrink-to-fit，而里面的 img 用百分比宽度会形成循环依赖，
   浏览器会退化成「按钮撑满、图片居中」，标题条就跑不到左上角。 */
.region-map__back {
  position: absolute;
  width: min(50%, 260px);
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  line-height: 0;
}
.region-map__back img { display: block; width: 100%; height: auto; }
.region-map__chip {
  position: absolute;
  padding: 4px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  background: var(--paper);
  color: var(--text-main);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.region-map__list-btn { top: 8px; right: 8px; cursor: pointer; font-family: inherit; }
.region-map__list-btn:hover { background: var(--paper-soft); }
.region-map__caption { left: 50%; bottom: 10px; transform: translateX(-50%); pointer-events: none; }
</style>
