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
const MIN_ROUTE_ZOOM = 0.7
const MAX_ROUTE_ZOOM = 2.4
const ROUTE_MAP_WIDTH = 1400
const routeZoom = ref(DEFAULT_ROUTE_ZOOM)
const scrollRef = ref(null)
const expandedNodes = ref(new Set())
let touchGesture = null
let touchPan = null
let touchFrame = 0
let touchRequest = null
let momentumFrame = 0
let pointerDrag = null
let zoomFrame = 0
let zoomRequest = null

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

const clampZoom = value => Math.min(MAX_ROUTE_ZOOM, Math.max(MIN_ROUTE_ZOOM, Number(value) || 1))
const setZoom = value => { routeZoom.value = Number(clampZoom(value).toFixed(2)) }
const dimensions = layer => {
  const sourceWidth = Math.max(1, Number(layer?.size?.w || 1600))
  const sourceHeight = Math.max(1, Number(layer?.size?.h || 1000))
  return { width: ROUTE_MAP_WIDTH, height: Math.round(ROUTE_MAP_WIDTH * sourceHeight / sourceWidth) }
}
const mapStyle = layer => ({ width: `${dimensions(layer).width}px`, height: `${dimensions(layer).height}px`, transform: `scale(${routeZoom.value})` })
const mapSpaceStyle = layer => ({ width: `${dimensions(layer).width * routeZoom.value}px`, height: `${dimensions(layer).height * routeZoom.value}px` })

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
    const contentX = container.scrollLeft + focusX
    const contentY = container.scrollTop + focusY
    setZoom(request.value)
    nextTick(() => {
      const ratio = routeZoom.value / previousZoom
      container.scrollLeft = Math.max(0, contentX * ratio - focusX)
      container.scrollTop = Math.max(0, contentY * ratio - focusY)
    })
  })
}
const resetViewport = () => {
  const container = scrollRef.value
  if (!container) return
  container.scrollLeft = 0
  container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
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
  const container = state?.container
  if (!container || Math.max(Math.abs(velocityX), Math.abs(velocityY)) < 0.35) return
  const step = () => {
    velocityX *= 0.9
    velocityY *= 0.9
    const previousLeft = container.scrollLeft
    const previousTop = container.scrollTop
    container.scrollLeft += velocityX
    container.scrollTop += velocityY
    if (container.scrollLeft === previousLeft) velocityX = 0
    if (container.scrollTop === previousTop) velocityY = 0
    if (Math.max(Math.abs(velocityX), Math.abs(velocityY)) >= 0.35) momentumFrame = requestAnimationFrame(step)
    else momentumFrame = 0
  }
  momentumFrame = requestAnimationFrame(step)
}
const handleTouchStart = event => {
  const container = scrollRef.value
  if (!container) return
  stopMomentum()
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    touchGesture = null
    touchPan = { container, x: touch.clientX, y: touch.clientY, time: performance.now(), velocityX: 0, velocityY: 0 }
    return
  }
  if (event.touches.length !== 2) return
  touchPan = null
  touchGesture = { distance: touchDistance(event.touches), zoom: routeZoom.value, midpoint: touchMidpoint(event.touches), left: container.scrollLeft, top: container.scrollTop }
}
const handleTouchMove = event => {
  if (event.touches.length === 1 && touchPan?.container) {
    event.preventDefault()
    const touch = event.touches[0]
    const now = performance.now()
    const deltaX = touchPan.x - touch.clientX
    const deltaY = touchPan.y - touch.clientY
    const elapsed = Math.max(1, now - touchPan.time)
    touchPan.container.scrollLeft += deltaX
    touchPan.container.scrollTop += deltaY
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
    setZoom(request.zoom)
    nextTick(() => {
      const rect = container.getBoundingClientRect()
      const ratio = routeZoom.value / request.start.zoom
      const startX = request.start.midpoint.x - rect.left
      const startY = request.start.midpoint.y - rect.top
      container.scrollLeft = Math.max(0, (request.start.left + startX) * ratio - (request.midpoint.x - rect.left))
      container.scrollTop = Math.max(0, (request.start.top + startY) * ratio - (request.midpoint.y - rect.top))
    })
  })
}
const handleTouchEnd = event => {
  if (event.touches?.length >= 2) return
  if (event.touches?.length === 1) {
    const touch = event.touches[0]
    const container = scrollRef.value
    touchGesture = null
    touchPan = container ? { container, x: touch.clientX, y: touch.clientY, time: performance.now(), velocityX: 0, velocityY: 0 } : null
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
  pointerDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop }
  container.setPointerCapture?.(event.pointerId)
}
const handlePointerMove = event => {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId || !scrollRef.value) return
  scrollRef.value.scrollLeft = pointerDrag.left - (event.clientX - pointerDrag.x)
  scrollRef.value.scrollTop = pointerDrag.top - (event.clientY - pointerDrag.y)
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
onBeforeUnmount(() => {
  for (const frame of [touchFrame, momentumFrame, zoomFrame]) if (frame) cancelAnimationFrame(frame)
})
</script>

<style scoped>
.route-layout-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 1px 0 8px; }
.route-layout-tab { flex: 0 0 auto; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-muted); padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
.route-layout-tab small { display: block; margin-top: 2px; color: var(--text-sub); font-size: 10px; font-weight: 600; }
.route-layout-tab--active { border-color: var(--accent); background: var(--hover-bg); color: var(--text-main); }
.route-map-shell { position: relative; }
.route-map-toolbar { position: absolute; z-index: 5; top: 10px; left: 10px; display: grid; grid-template-columns: 30px 46px 30px 30px; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-solid); box-shadow: 0 2px 8px rgba(0,0,0,.22); }
.route-map-toolbar button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-main); padding: 0; font-size: 17px; font-weight: 800; cursor: pointer; }
.route-map-toolbar button:hover:not(:disabled) { border-color: var(--accent); background: var(--hover-bg); }
.route-map-toolbar button:disabled { opacity: .38; cursor: default; }
.route-map-toolbar output { color: var(--text-main); font-size: 11px; font-weight: 800; text-align: center; }
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
