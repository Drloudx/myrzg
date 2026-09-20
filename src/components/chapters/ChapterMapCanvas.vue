<!--
  章节地图画布：世界地图底图 + 章节拼块，点击地区切换章节。地图是这一页的主视图（仅桌面端）。

  坐标来自构建期产物 `chapters.json.map`（拼块矩形由模板匹配测得，见 scripts/parse/chapterMapLayout.mjs）。
  命中判定用构建期烘焙的**归属图**：拼块包围盒互相重叠（c0 的框有 57% 被 c3 压住），
  不能用矩形热区；不透明区域也有重叠，所以归属按渲染顺序定，运行时按格查表。

  布局要点：底图是正方形，而「占满中间区域」的区域是长方形。做法是画布铺满区域、内部放一个
  正方形**舞台**按 cover 缩放居中，超出画布的部分裁掉——裁掉的是边缘云朵，大陆本身不动。
  因此命中判定必须用**舞台**的矩形换算（舞台可能比画布大），不能用画布矩形。
  画布高度按左右面板底部实测对齐（见 measure），且**底部不留外边距**——留了画布就比面板高，
  页面会多出一条无意义的滚动条。

  边框沿用全局 `.paper-panel`（与左侧导航面板同一套描边/阴影/圆角），不另写一套。

  可访问性：画布本身 `aria-hidden`（等价的可聚焦控件是页面上的章节按钮，键盘用户用它切换），
  但「展开列表」是真按钮，放在 aria-hidden 之外。
-->
<template>
  <figure v-if="tiles.length" class="chapter-map">
    <div
      id="chapterMapCanvas"
      ref="canvasRef"
      class="chapter-map__canvas paper-panel"
      :class="{ 'is-pointing': hoverId }"
      :style="canvasStyle"
      @click="handleClick"
      @mousemove="handleMove"
      @mouseleave="hoverId = ''"
    >
      <div ref="stageRef" class="chapter-map__stage" :class="{ 'is-hovering': !!hoverId }" aria-hidden="true">
        <img class="chapter-map__bg" :src="getImageUrl(map.background)" alt="" decoding="async" @error="handleImgError" />
        <img
          v-for="tile in tiles"
          :key="tile.id"
          class="chapter-map__tile"
          :class="{ 'is-active': tile.id === activeId, 'is-dimmed': hasActive && tile.id !== activeId, 'is-hover': tile.id === hoverId }"
          :style="tileStyle(tile)"
          :data-tile="tile.id"
          :src="getImageUrl(tile.image)"
          alt=""
          decoding="async"
          @error="handleImgError"
        />
      </div>
      <img v-if="map.title" class="chapter-map__title" :src="getImageUrl(map.title)" alt="" @error="handleImgError" />
      <div class="chapter-map__extra"><slot name="extra" /></div>
      <span class="chapter-map__chip chapter-map__caption">{{ captionText }}</span>
      <button type="button" class="chapter-map__chip chapter-map__list-btn" @click="emit('list')">展开列表</button>
    </div>
  </figure>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getImageUrl, handleImageFallback } from '../../utils/env.js'

/** 高度上限：舞台取宽高中的较大者，太高会把大陆边缘裁掉（见文件头说明）。 */
const MAX_HEIGHT = 900
const MIN_HEIGHT = 360

const props = defineProps({
  /** `chapters.json` 的 `map` 对象：{ background, title, size, tiles, owner } */
  map: { type: Object, required: true },
  activeId: { type: String, default: '' },
  /** 可见章节 id（黑名单隐藏的章节不出现在地图上）。 */
  visibleIds: { type: Array, default: () => [] },
  /** 「全部章节」时的关卡总数，用于未选中具体章节时的说明。 */
  totalStages: { type: Number, default: 0 }
})
const emit = defineEmits(['select', 'list'])

const canvasRef = ref(null)
const stageRef = ref(null)
const hoverId = ref('')
const canvasHeight = ref(0)
const handleImgError = handleImageFallback

const canvasStyle = computed(() => canvasHeight.value
  ? { '--chapter-map-h': `${canvasHeight.value}px` }
  : {})

/**
 * 画布高度 = **左右面板底部** − 画布顶部。
 *
 * 基准取左右两侧的 sticky 面板，不取视口：两侧面板底部比视口底还高一点
 * （要留底部安全区），按视口算画布就会比左右面板长出一截，看起来没对齐。
 * 取不到面板时（原生壳等）退回视口底部减一个空隙。
 */
const measure = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const top = canvas.getBoundingClientRect().top
  const sidePanel = document.querySelector('.desktop-sidebar-container, .desktop-right-container')
  const bottom = sidePanel ? sidePanel.getBoundingClientRect().bottom : window.innerHeight - 10
  canvasHeight.value = Math.max(MIN_HEIGHT, Math.min(Math.round(bottom - top), MAX_HEIGHT))
}

const visible = computed(() => new Set(props.visibleIds))
const tiles = computed(() => (props.map.tiles || []).filter(tile => visible.value.has(tile.id)))
const activeTile = computed(() => tiles.value.find(tile => tile.id === props.activeId) || null)
/** 选中具体章节时才压暗其他地区；「全部章节」时整张地图保持原色。 */
const hasActive = computed(() => !!activeTile.value)

const captionText = computed(() => {
  if (activeTile.value) {
    const tile = activeTile.value
    const label = tile.chapterNo === null ? tile.areaName : `${tile.chapterNo} ${tile.areaName}`
    return `${label} · ${tile.stageCount} 关`
  }
  return props.totalStages ? `全部章节 · ${props.totalStages} 关` : '选择一个地区'
})

/** 归属图：RLE 解码成每格的拼块序号；序号对应 owner.ids。 */
const owner = computed(() => {
  const source = props.map.owner
  if (!source?.data) return null
  const total = source.resolution * source.resolution
  const grid = new Int8Array(total)
  let cursor = 0
  for (const part of source.data.split(',')) {
    const separator = part.indexOf(':')
    const value = Number(part.slice(0, separator))
    const run = Number(part.slice(separator + 1))
    for (let i = 0; i < run && cursor < total; i++) grid[cursor++] = value
  }
  return { resolution: source.resolution, ids: source.ids, grid }
})

const tileStyle = tile => ({
  left: `${tile.x / props.map.size.w * 100}%`,
  top: `${tile.y / props.map.size.h * 100}%`,
  width: `${tile.w / props.map.size.w * 100}%`,
  height: `${tile.h / props.map.size.h * 100}%`
})

const tileAt = (clientX, clientY) => {
  // 用舞台而不是画布：舞台按 cover 缩放，可能比画布大（超出部分被裁掉）
  const stage = stageRef.value
  const grid = owner.value
  if (!stage || !grid) return ''
  const rect = stage.getBoundingClientRect()
  if (!rect.width || !rect.height) return ''
  const gx = Math.floor((clientX - rect.left) / rect.width * grid.resolution)
  const gy = Math.floor((clientY - rect.top) / rect.height * grid.resolution)
  if (gx < 0 || gy < 0 || gx >= grid.resolution || gy >= grid.resolution) return ''
  const index = grid.grid[gy * grid.resolution + gx]
  if (index < 0) return ''
  const id = grid.ids[index]
  return visible.value.has(id) ? id : ''
}

const handleClick = (event) => {
  const id = tileAt(event.clientX, event.clientY)
  if (id && id !== props.activeId) emit('select', id)
}

const handleMove = (event) => {
  const id = tileAt(event.clientX, event.clientY)
  if (id !== hoverId.value) hoverId.value = id
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
watch(() => props.map, async () => { await nextTick(); measure() })
</script>

<style scoped>
/* figure 有 UA 默认的 16px 40px 外边距，必须显式清零，否则画布左右各缩 40px。 */
.chapter-map {
  margin: 0;
  display: block;
}
.chapter-map__canvas {
  position: relative;
  width: 100%;
  height: var(--chapter-map-h, 640px);
  /* 描边/阴影/圆角来自 .paper-panel，与左侧导航面板同一套 */
  padding: 0;
  overflow: hidden;
}
.chapter-map__canvas.is-pointing { cursor: pointer; }

/* 正方形舞台：取画布宽高较大的一边，居中，超出画布的部分被裁掉。 */
.chapter-map__stage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: max(100%, var(--chapter-map-h, 640px));
  aspect-ratio: 1 / 1;
  pointer-events: none;
}
.chapter-map__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.chapter-map__tile {
  position: absolute;
  display: block;
  transition: opacity 0.18s ease, filter 0.18s ease, transform 0.18s ease;
}
.chapter-map__tile.is-dimmed { opacity: 0.42; filter: saturate(0.4); }

/*
  悬停浮动：鼠标进入地图后，指着的那块浮起来（放大 + 提亮 + 投影 + 提到最上层），
  其余压暗。默认（未选中任何章节）时全部同色，没有这个反馈就分不清指着哪一块。
*/
.chapter-map__stage.is-hovering .chapter-map__tile:not(.is-hover) { opacity: 0.55; }
.chapter-map__tile.is-hover {
  opacity: 1;
  z-index: 2;
  transform: scale(1.045);
  filter: brightness(1.12) saturate(1.05) drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
}
/* 已选中章节时其余块本来就是压暗的，悬停时再压一档即可，不要再叠加饱和度变化 */
.chapter-map__stage.is-hovering .chapter-map__tile.is-dimmed:not(.is-hover) { opacity: 0.34; filter: saturate(0.35); }

.chapter-map__title {
  position: absolute;
  width: min(50%, 260px);
  height: auto;
  pointer-events: none;
}

/* 底部标签与右上角「展开列表」共用一套胶囊样式。 */
.chapter-map__chip {
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
.chapter-map__caption {
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  pointer-events: none;
}
.chapter-map__list-btn {
  top: 8px;
  right: 8px;
  cursor: pointer;
  font-family: inherit;
}
.chapter-map__list-btn:hover { background: var(--paper-soft); }

/* 地图上没有拼块的章节（幽夜古堡、黏滑溪谷）由页面通过 extra 插槽放进来的入口。 */
.chapter-map__extra {
  position: absolute;
  left: 8px;
  bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(50% - 16px);
}

@media (prefers-reduced-motion: reduce) {
  .chapter-map__tile { transition: none; }
}
</style>
