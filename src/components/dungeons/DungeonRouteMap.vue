<template>
  <div class="dungeon-route-map">
    <div class="route-layout-tabs" role="tablist" aria-label="随机布局">
      <button
        v-for="(layer, index) in routes"
        :key="layer.id"
        type="button"
        class="route-layout-tab"
        :class="{ 'route-layout-tab--active': routeIndex === index }"
        role="tab"
        :aria-selected="routeIndex === index"
        @click="selectLayer(index)"
      >
        {{ routeLabel(index) }}<small>{{ routeChance(layer) }}</small>
      </button>
    </div>

    <div v-if="displayLayer" class="route-map-shell">
      <div class="route-map-toolbar" role="group" aria-label="地图缩放控制">
        <button type="button" title="缩小地图" aria-label="缩小地图" :disabled="routeZoom <= MIN_ROUTE_ZOOM" @click="zoomBy(-0.1)">−</button>
        <output aria-label="当前地图缩放比例">{{ Math.round(routeZoom * 100) }}%</output>
        <button type="button" title="放大地图" aria-label="放大地图" :disabled="routeZoom >= MAX_ROUTE_ZOOM" @click="zoomBy(0.1)">+</button>
        <button type="button" title="恢复默认视图" aria-label="恢复默认视图" @click="resetMap">↺</button>
      </div>
      <!-- 桌面端操作提示：放在缩放控件**边框外**的右上角。
           触屏端由 CSS 隐藏（那边是双指缩放，没有 Ctrl+滚轮）。 -->
      <span class="route-map-hint">按住 ctrl 可用滚轮进行缩放</span>
      <div
        ref="scrollRef"
        class="route-map-scroll"
        @wheel="handleWheel"
        @dblclick="handleDoubleClick"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
      >
        <div class="route-map-space" :style="mapSpaceStyle(displayLayer)">
          <div class="route-map" :style="mapStyle(displayLayer)">
            <svg class="route-map__links" :viewBox="`0 0 ${displayLayer.size.w} ${displayLayer.size.h}`" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                v-for="(link, index) in displayLayer.links"
                :key="`route-link-${index}`"
                :points="link.points"
                class="route-map__link"
                :class="{ 'route-map__link--active': isLinkActive(link) }"
              />
            </svg>
            <div v-for="node in displayLayer.nodes" :key="node.id" class="route-node-group" :style="nodeStyle(node, displayLayer)">
              <button
                v-if="node.variantOptions?.length > 1"
                type="button"
                class="route-node-expand"
                :aria-label="isNodeExpanded(node) ? '收起候选房间' : `展开 ${node.variantOptions.length} 个候选房间`"
                @click.stop="toggleNode(node.id)"
              >{{ isNodeExpanded(node) ? '−' : '+' }}</button>
              <button
                v-for="(variant, variantIndex) in visibleVariants(node)"
                :key="`${node.id}-${variant.typeId}`"
                type="button"
                class="route-node"
                :class="nodeClass(node, variant.typeId)"
                :aria-label="nodeLabel(node, variant)"
                @click="selectRoom(node.id, variant.typeId)"
              >
                <img v-if="iconPath(variant)" :src="iconPath(variant)" alt="" />
                <span v-else class="route-node__fallback" :aria-label="variantIndex === 0 ? iconGlyph(node) : '房间图标'">{{ variantIndex === 0 ? iconGlyph(node) : '' }}</span>
                <i v-if="node.candidates && variantIndex === 0" class="route-node__random">{{ node.candidates + 1 }}</i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getImageUrl } from '../../utils/env.js'

const props = defineProps({
  routes: { type: Array, default: () => [] },
  routeIndex: { type: Number, default: 0 },
  roomId: { type: String, default: '' },
  variantId: { type: String, default: '' }
})
const emit = defineEmits(['update:routeIndex', 'update:roomId', 'update:variantId'])

const DEFAULT_ROUTE_ZOOM = 0.7
// 可缩小到 10%（原为 70%）；初始与「重置」仍回到 DEFAULT_ROUTE_ZOOM = 70%
const MIN_ROUTE_ZOOM = 0.1
const MAX_ROUTE_ZOOM = 2.4
const ROUTE_MAP_WIDTH = 1400
const routeZoom = ref(DEFAULT_ROUTE_ZOOM)
const scrollRef = ref(null)
/**
 * 平移偏移（屏幕像素，作用于地图左上角）。
 *
 * 为什么不用 `scrollLeft/scrollTop`：那是**内容溢出**才有效的机制。地图缩到比容器小
 * （如 20%）时内容不溢出，滚动量为 0，拖动就完全失效（`startMomentum` 也靠
 * `scrollLeft` 是否变化来判断停止）。改成显式偏移后，任意缩放级别都能自由拖动，
 * 且缩小时默认居中显示。
 */
const panX = ref(0)
const panY = ref(0)
const viewport = ref({ w: 0, h: 0 })
const expandedNodes = ref(new Set())
let touchGesture = null
let touchPan = null
let touchFrame = 0
let touchRequest = null
let momentumFrame = 0
let pointerDrag = null
let zoomFrame = 0
let zoomRequest = null
let resizeObserver = null

const selectedLayer = computed(() => props.routes[props.routeIndex] || null)
const displayLayer = computed(() => orientLayer(selectedLayer.value))

const selectLayer = index => {
  const layer = props.routes[index]
  const roomId = layer?.startRoomId || layer?.nodes?.[0]?.id || ''
  const variantId = layer?.nodes?.find(node => node.id === roomId)?.variantOptions?.[0]?.typeId || ''
  emit('update:routeIndex', index)
  emit('update:roomId', roomId)
  emit('update:variantId', variantId)
  resetMap()
}
const selectRoom = (roomId, variantId = '') => {
  emit('update:roomId', roomId)
  emit('update:variantId', variantId || selectedLayer.value?.nodes?.find(node => node.id === roomId)?.variantOptions?.[0]?.typeId || '')
}

/**
 * 夹紧缩放值。
 *
 * 注意**不能用 `Number(value) || 1` 兜底**：`0` 是假值，从 10% 再缩小一次得到
 * `0.1 - 0.1 = 0`，会被兜底成 `1` → 直接跳到 100%（实测复现）。
 * 无效输入才回落默认值，用 `Number.isFinite` 判断。
 */
const clampZoom = value => {
  const num = Number(value)
  const base = Number.isFinite(num) ? num : DEFAULT_ROUTE_ZOOM
  return Math.min(MAX_ROUTE_ZOOM, Math.max(MIN_ROUTE_ZOOM, base))
}
const setZoom = value => { routeZoom.value = Number(clampZoom(value).toFixed(2)) }
const dimensions = layer => {
  const sourceWidth = Math.max(1, Number(layer?.size?.w || 1600))
  const sourceHeight = Math.max(1, Number(layer?.size?.h || 1000))
  return { width: ROUTE_MAP_WIDTH, height: Math.round(ROUTE_MAP_WIDTH * sourceHeight / sourceWidth) }
}
const mapStyle = layer => ({
  width: `${dimensions(layer).width}px`,
  height: `${dimensions(layer).height}px`,
  // 平移量取整：非整数会让整层落在半像素上，浏览器按低分辨率光栅化后
  // 内容发糊，直到重绘（悬停/移动）才短暂清晰。
  transform: `translate(${Math.round(panX.value)}px, ${Math.round(panY.value)}px) scale(${routeZoom.value})`
})
const mapSpaceStyle = layer => ({
  width: `${dimensions(layer).width * routeZoom.value}px`,
  height: `${dimensions(layer).height * routeZoom.value}px`
})

/**
 * 容器可视尺寸（缩放/平移的约束基准）。
 *
 * 用 `getBoundingClientRect` 而不是 `clientWidth/clientHeight`：后者**含 padding**，
 * 而地图是从内容盒左上角定位的（容器 `padding: 2px 0 8px`）。用 client 尺寸居中
 * 会纵向偏 2.7px（实测 20% 缩放时中心应为 159 却落在 161.7）。
 */
const measureViewport = () => {
  const container = scrollRef.value
  if (!container) return viewport.value
  const rect = container.getBoundingClientRect()
  viewport.value = { w: rect.width, h: rect.height }
  return viewport.value
}

/**
 * 夹紧平移量：允许把地图拖到任意位置，但不允许整个拖出容器——
 * 缩得很小时也要留得住（否则地图一拖就找不回来）。
 * 地图比容器小的轴：至少保留 40px 在容器内；比容器大的轴：边界不得进入容器内部。
 */
/**
 * 夹紧平移量：允许**随意拖动**，只保证地图不会被整个拖出容器
 * （四边都至少留 `keep` 像素可见，否则地图一拖就找不回来）。
 *
 * 注意不能像滚动那样只在「内容溢出」方向放开：地图比容器大时若限制 pan ≤ 0，
 * 向右拖动会立刻被夹死，手感像"卡住"。
 */
const clampPan = (x, y) => {
  const { w, h } = viewport.value
  const size = dimensions(displayLayer.value)
  const scaledW = size.width * routeZoom.value
  const scaledH = size.height * routeZoom.value
  const keep = 40
  const limitX = { min: -(scaledW - keep), max: w - keep }
  const limitY = { min: -(scaledH - keep), max: h - keep }
  return {
    x: Math.min(limitX.max, Math.max(limitX.min, x)),
    y: Math.min(limitY.max, Math.max(limitY.min, y))
  }
}
const setPan = (x, y) => {
  const next = clampPan(x, y)
  panX.value = next.x
  panY.value = next.y
}
/**
 * 初始 / 重置的定位：**左对齐、底对齐**（沿用改造前的取景）。
 *
 * 改造前用的是 `scrollLeft = 0` + `scrollTop = scrollHeight - clientHeight`，
 * 即把内容左下角对齐容器左下角；这里用平移量表达同一构图：
 * 地图比容器大时 `h - scaledH` 正是底对齐；比容器小时取 0（顶对齐，居中反而不自然）。
 */
const resetPan = () => {
  const { h } = viewport.value
  const size = dimensions(displayLayer.value)
  setPan(0, Math.min(0, h - size.height * routeZoom.value))
}

const zoomAt = (value, clientX, clientY) => {
  zoomRequest = { value, clientX, clientY }
  if (zoomFrame) return
  zoomFrame = requestAnimationFrame(() => {
    zoomFrame = 0
    const request = zoomRequest
    zoomRequest = null
    const container = scrollRef.value
    const previousZoom = routeZoom.value
    if (!container || !request) {
      if (request) setZoom(request.value)
      return
    }
    const rect = container.getBoundingClientRect()
    const focusX = Number.isFinite(request.clientX) ? request.clientX - rect.left : rect.width / 2
    const focusY = Number.isFinite(request.clientY) ? request.clientY - rect.top : rect.height / 2
    setZoom(request.value)
    // 保持光标下的地图点不动：屏幕坐标 = pan + 地图坐标 × zoom，
    // 故新 pan = focus - (focus - 旧 pan) × (新 zoom / 旧 zoom)
    const ratio = routeZoom.value / previousZoom
    setPan(
      focusX - (focusX - panX.value) * ratio,
      focusY - (focusY - panY.value) * ratio
    )
  })
}
const resetViewport = () => {
  measureViewport()
  resetPan()
}
const queueViewportReset = () => nextTick(() => requestAnimationFrame(resetViewport))
const resetMap = () => {
  routeZoom.value = DEFAULT_ROUTE_ZOOM
  expandedNodes.value = new Set()
  queueViewportReset()
}
const zoomBy = amount => {
  const rect = scrollRef.value?.getBoundingClientRect()
  zoomAt(routeZoom.value + amount, rect ? rect.left + rect.width / 2 : undefined, rect ? rect.top + rect.height / 2 : undefined)
}
const handleWheel = event => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const nextZoom = clampZoom(routeZoom.value + (event.deltaY < 0 ? 0.1 : -0.1))
  if (nextZoom !== routeZoom.value) zoomAt(nextZoom, event.clientX, event.clientY)
}
const handleDoubleClick = event => {
  if (event.target?.closest?.('.route-node, .route-node-expand, .route-map-toolbar')) return
  event.preventDefault()
  zoomAt(routeZoom.value + 0.2, event.clientX, event.clientY)
}

const touchDistance = touches => touches?.length >= 2 ? Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY) : 0
const touchMidpoint = touches => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 })
const stopMomentum = () => {
  if (momentumFrame) cancelAnimationFrame(momentumFrame)
  momentumFrame = 0
}
const startMomentum = state => {
  let velocityX = Number(state?.velocityX || 0)
  let velocityY = Number(state?.velocityY || 0)
  if (Math.max(Math.abs(velocityX), Math.abs(velocityY)) < 0.35) return
  const step = () => {
    velocityX *= 0.9
    velocityY *= 0.9
    const previousX = panX.value
    const previousY = panY.value
    setPan(previousX + velocityX, previousY + velocityY)
    // 撞到边界就停（clamp 后位置没变说明已经拖到头了）
    if (panX.value === previousX) velocityX = 0
    if (panY.value === previousY) velocityY = 0
    if (Math.max(Math.abs(velocityX), Math.abs(velocityY)) >= 0.35) momentumFrame = requestAnimationFrame(step)
    else momentumFrame = 0
  }
  momentumFrame = requestAnimationFrame(step)
}
const handleTouchStart = event => {
  const container = scrollRef.value
  if (!container) return
  stopMomentum()
  measureViewport()
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    touchGesture = null
    touchPan = { x: touch.clientX, y: touch.clientY, time: performance.now(), velocityX: 0, velocityY: 0 }
    return
  }
  if (event.touches.length !== 2) return
  touchPan = null
  touchGesture = {
    distance: touchDistance(event.touches),
    zoom: routeZoom.value,
    midpoint: touchMidpoint(event.touches),
    panX: panX.value,
    panY: panY.value
  }
}
const handleTouchMove = event => {
  if (event.touches.length === 1 && touchPan) {
    event.preventDefault()
    const touch = event.touches[0]
    const now = performance.now()
    const deltaX = touch.clientX - touchPan.x
    const deltaY = touch.clientY - touchPan.y
    const elapsed = Math.max(1, now - touchPan.time)
    setPan(panX.value + deltaX, panY.value + deltaY)
    touchPan.velocityX = deltaX / elapsed * 16
    touchPan.velocityY = deltaY / elapsed * 16
    touchPan.x = touch.clientX
    touchPan.y = touch.clientY
    touchPan.time = now
    return
  }
  if (event.touches.length !== 2 || !touchGesture?.distance) return
  event.preventDefault()
  touchRequest = { start: touchGesture, midpoint: touchMidpoint(event.touches), zoom: touchGesture.zoom * (touchDistance(event.touches) / touchGesture.distance) }
  if (touchFrame) return
  touchFrame = requestAnimationFrame(() => {
    touchFrame = 0
    const request = touchRequest
    touchRequest = null
    const container = scrollRef.value
    if (!request || !container) return
    const rect = container.getBoundingClientRect()
    const startX = request.start.midpoint.x - rect.left
    const startY = request.start.midpoint.y - rect.top
    const focusX = request.midpoint.x - rect.left
    const focusY = request.midpoint.y - rect.top
    setZoom(request.zoom)
    const ratio = routeZoom.value / request.start.zoom
    setPan(
      focusX - (startX - request.start.panX) * ratio,
      focusY - (startY - request.start.panY) * ratio
    )
  })
}
const handleTouchEnd = event => {
  if (event.touches?.length >= 2) return
  if (event.touches?.length === 1) {
    const touch = event.touches[0]
    touchGesture = null
    touchPan = { x: touch.clientX, y: touch.clientY, time: performance.now(), velocityX: 0, velocityY: 0 }
    return
  }
  const finishedPan = touchPan
  touchPan = null
  touchGesture = null
  startMomentum(finishedPan)
}
const handlePointerDown = event => {
  if (event.pointerType === 'touch' || event.button !== 0 || !scrollRef.value || event.target?.closest?.('.route-node, .route-node-expand')) return
  const container = scrollRef.value
  measureViewport()
  stopMomentum()
  pointerDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: panX.value, panY: panY.value }
  container.setPointerCapture?.(event.pointerId)
}
const handlePointerMove = event => {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return
  // 抓取式拖动：地图跟随指针同向移动（与「拖动滚动条」的方向相反）
  setPan(
    pointerDrag.panX + (event.clientX - pointerDrag.x),
    pointerDrag.panY + (event.clientY - pointerDrag.y)
  )
}
const handlePointerUp = event => { if (pointerDrag?.pointerId === event.pointerId) pointerDrag = null }

const variantPriority = variant => {
  const text = `${variant?.kind || ''} ${variant?.name || ''}`
  if (/宝箱|箱子/.test(text)) return 60
  if (/白兔|白商人|白商/.test(text)) return 50
  if (/黑商|黑兔|黑商人/.test(text)) return 40
  if (/蛋|孵化/.test(text)) return 30
  if (/采集|矿|草|花|蘑菇|水晶|硫磺|冰莲/.test(text)) return 20
  return 10
}
const primaryVariant = node => [...(node?.variantOptions || [])].sort((a, b) => variantPriority(b) - variantPriority(a) || String(a.typeId).localeCompare(String(b.typeId)))[0]
const isNodeExpanded = node => expandedNodes.value.has(node?.id)
const toggleNode = nodeId => {
  const next = new Set(expandedNodes.value)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  expandedNodes.value = next
}
const visibleVariants = node => isNodeExpanded(node) ? node.variantOptions : [primaryVariant(node)].filter(Boolean)

function orientLayer(layer) {
  if (!layer?.nodes?.length) return layer
  const sourceNodes = layer.nodes.map(node => ({ ...node, sourceX: Number(node.x || 0), sourceY: Number(node.y || 0) }))
  const start = sourceNodes.find(node => node.id === layer.startRoomId) || sourceNodes[0]
  const end = sourceNodes.find(node => node.id === layer.endRoom) || sourceNodes.at(-1)
  const spanX = Number(end.sourceX - start.sourceX) || 1
  const spanY = Number(end.sourceY - start.sourceY) || 1
  const rawNodes = sourceNodes.map(node => {
    const progressX = (node.sourceX - start.sourceX) / spanX
    const progressY = (node.sourceY - start.sourceY) / spanY
    return { ...node, x: progressX * 1100, y: (1 - progressY) * 680 }
  })
  const minX = Math.min(...rawNodes.map(node => node.x))
  const maxX = Math.max(...rawNodes.map(node => node.x))
  const minY = Math.min(...rawNodes.map(node => node.y))
  const maxY = Math.max(...rawNodes.map(node => node.y))
  const nodes = rawNodes.map(node => ({ ...node, x: Math.round(node.x - minX + 150), y: Math.round(node.y - minY + 110) }))
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const links = (layer.links || []).flatMap(link => {
    const from = nodeMap.get(link.rooms?.[0])
    const to = nodeMap.get(link.rooms?.[1])
    return from && to ? [{ ...link, points: `${from.x},${from.y} ${to.x},${to.y}` }] : []
  })
  return { ...layer, size: { w: Math.max(900, Math.ceil(maxX - minX + 300)), h: Math.max(560, Math.ceil(maxY - minY + 220)) }, nodes, links }
}

const nodeStyle = (node, layer) => ({ left: `${Number(node.x || 0) / Math.max(1, Number(layer?.size?.w || 1600)) * 100}%`, top: `${Number(node.y || 0) / Math.max(1, Number(layer?.size?.h || 1000)) * 100}%` })
const iconPath = variant => Number(variant?.icon || 0) > 0 ? getImageUrl(`/instancepanel/MapPanelAtlas/map_r_fb_${String(variant.icon).padStart(2, '0')}.webp`) : ''
const routeChance = layer => {
  const total = props.routes.reduce((sum, item) => sum + Number(item.chance || 0), 0)
  if (props.routes.length === 1) return '固定布局'
  return total > 0 && Number(layer?.chance || 0) > 0 ? `约 ${(Number(layer.chance) / total * 100).toFixed(0)}%` : '未配置权重'
}
const routeLabel = index => ['路线一', '路线二', '路线三'][index] || `路线${index + 1}`
const iconGlyph = node => node?.id === selectedLayer.value?.startRoomId ? '起' : node?.id === selectedLayer.value?.endRoom ? '终' : '?'
const nodeLabel = (node, variant) => `${variant?.name || node?.label || '房间'}${node?.candidates ? `，${node.candidates + 1} 个候选` : ''}`
const nodeClass = (node, variantId) => ({
  'route-node--start': node?.id === selectedLayer.value?.startRoomId,
  'route-node--end': node?.id === selectedLayer.value?.endRoom,
  'route-node--selected': node?.id === props.roomId && variantId === props.variantId,
  'route-node--random': node?.candidates > 0
})
const isLinkActive = link => link?.rooms?.includes(props.roomId)

watch(() => props.routes, resetMap, { flush: 'post', immediate: true })

// 容器尺寸变化（窗口缩放、面板折叠、横竖屏切换）后重新夹紧平移量，
// 否则按旧尺寸算出的 pan 会让地图跑到可视区外。
watch(scrollRef, container => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!container) return
  measureViewport()
  setPan(panX.value, panY.value)
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    const before = { w: viewport.value.w, h: viewport.value.h }
    const now = measureViewport()
    if (now.w === before.w && now.h === before.h) return
    setPan(panX.value, panY.value)
  })
  resizeObserver.observe(container)
}, { flush: 'post' })

onBeforeUnmount(() => {
  for (const frame of [touchFrame, momentumFrame, zoomFrame]) if (frame) cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
.route-layout-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 1px 0 8px; }
.route-layout-tab { flex: 0 0 auto; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-muted); padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
.route-layout-tab small { display: block; margin-top: 2px; color: var(--text-sub); font-size: 10px; font-weight: 600; }
.route-layout-tab--active { border-color: var(--accent); background: var(--hover-bg); color: var(--text-main); }
.route-map-shell { position: relative; }
.route-map-toolbar { position: absolute; z-index: 5; top: 10px; left: 10px; display: flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-solid); box-shadow: 0 2px 8px rgba(0,0,0,.22); }
.route-map-toolbar button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-main); padding: 0; font-size: 17px; font-weight: 800; cursor: pointer; }
.route-map-toolbar button:hover:not(:disabled) { border-color: var(--accent); background: var(--hover-bg); }
.route-map-toolbar button:disabled { opacity: .38; cursor: default; }
.route-map-toolbar output { width: 46px; color: var(--text-main); font-size: 11px; font-weight: 800; text-align: center; }
/* 桌面端操作提示：紧挨缩放控件**右侧**、同一水平线上。
   工具栏 left:10px、实测宽 158px（4px padding×2 + 4 个 30px 控件 + 3 个 4px gap + 百分比格），
   故 left = 10 + 158 + 8 = 176px；行高与工具栏等高（4+30+4）保持垂直居中。
   颜色与左侧百分比一致（同为 --text-main），字号比正文大一号。
   默认隐藏，仅「有精确指针（鼠标）」的桌面端显示——触屏端是双指缩放，没有 Ctrl+滚轮。 */
.route-map-hint { display: none; position: absolute; z-index: 5; top: 10px; left: 176px; color: var(--text-main); font-size: 13px; line-height: 38px; white-space: nowrap; pointer-events: none; }
@media (hover: hover) and (pointer: fine) {
  .route-map-hint { display: block; }
}
.route-map-scroll { position: relative; width: 100%; height: clamp(360px,54vh,620px); overflow: hidden; padding: 2px 0 8px; touch-action: none; cursor: grab; user-select: none; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-dark); scrollbar-width: none; }
.route-map-scroll::-webkit-scrollbar { display: none; }
.route-map-scroll:active { cursor: grabbing; }
.route-map-space { position: relative; min-width: 100%; min-height: 100%; }
.route-map { position: absolute; left: 0; top: 0; transform-origin: top left; overflow: visible; }
.route-map__links { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.route-map__link { fill: none; stroke: rgba(220,196,147,.42); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.route-map__link--active { stroke: var(--accent); stroke-width: 12; }
.route-node-group { position: absolute; z-index: 1; transform: translate(-50%,-50%); display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; max-width: 190px; }
.route-node-expand { position: absolute; z-index: 3; top: -18px; left: 50%; width: 20px; height: 20px; transform: translateX(-50%); display: grid; place-items: center; border: 1px solid rgba(84,62,34,.45); border-radius: 50%; background: var(--paper-soft); color: var(--text-main); font-size: 14px; font-weight: 800; padding: 0; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,.25); }
.route-node { position: relative; width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border: 2px solid rgba(246,227,185,.76); border-radius: 50%; background: var(--paper-soft); color: var(--text-main); padding: 0; cursor: pointer; box-shadow: 0 2px 7px rgba(0,0,0,.35); transition: transform .16s ease,border-color .16s ease,box-shadow .16s ease; }
.route-node:hover, .route-node--selected { transform: scale(1.12); border-color: var(--accent); box-shadow: 0 0 0 3px rgba(85,117,116,.26),0 3px 10px rgba(0,0,0,.38); }
.route-node img { width: 36px; height: 36px; object-fit: contain; pointer-events: none; }
.route-node span { font-size: 12px; font-weight: 800; }
.route-node__fallback { width: 10px; height: 10px; border: 2px solid var(--accent); border-radius: 50%; background: var(--paper-solid); }
.route-node--start { border-color: #65bb8c; }
.route-node--end { border-color: var(--rarity-legend); }
.route-node__random { position: absolute; right: -5px; top: -7px; display: grid; place-items: center; width: 14px; height: 14px; border: 1px solid var(--paper-solid); border-radius: 50%; background: var(--accent); color: #fff; font-size: 10px; font-style: normal; }
@media (max-width: 440px) { .route-map-scroll { height: clamp(320px,48vh,440px); } }
</style>
