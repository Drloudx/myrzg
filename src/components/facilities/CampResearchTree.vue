<template>
  <div class="camp-research-trees" :style="{ '--research-node-width': `${CAMP_RESEARCH_NODE.width}px`, '--research-node-height': `${CAMP_RESEARCH_NODE.height}px` }">
    <section v-for="group in groups" :key="group.id" class="research-tree-section">
      <div class="research-tree-title"><h2>{{ group.name }}</h2><span>{{ group.matchCount }} 项研究</span></div>
      <p class="research-tree-hint">点击研究查看效果与消耗<span> · 拖动或左右滑动查看分支</span></p>
      <div ref="scrollPanels" class="research-tree-scroll" :class="{ 'is-dragging': draggingGroup === group.id }" tabindex="0" :aria-label="`${group.name}关系图`"
        @pointerdown="startDrag($event, group.id)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"
        @lostpointercapture="endDrag" @pointerleave="leaveDrag" @click.capture="guardDragClick" @dragstart.prevent>
        <div class="research-tree" :style="{ width: `${group.layout.width}px`, height: `${group.layout.height}px` }">
          <svg class="research-tree-lines" :viewBox="`0 0 ${group.layout.width} ${group.layout.height}`" aria-hidden="true">
            <path v-for="edge in group.layout.edges" :key="edge.to" :d="edge.path" />
          </svg>
          <button v-for="node in group.layout.nodes" :key="node.id" type="button" class="research-node"
            :class="{ 'is-context': !matchingIds.has(node.id) }" :data-research="node.id" :aria-label="node.name"
            :style="{ left: `${node.x}px`, top: `${node.y}px`, backgroundImage: `url('${getImageUrl('/images/CampCenterPanel/build_tree_botm.webp')}')` }"
            :title="`${node.name}：${node.description}${node.prerequisite ? `；前置：${node.prerequisite.name}` : ''}`" @click="emit('select', node.id)">
            <img :src="getImageUrl(node.icon)" :alt="node.name" @error="handleImageFallback" />
            <span class="research-node-body"><span class="research-node-heading"><strong>{{ node.name }}</strong><small>共 {{ node.levels.length }} 级</small></span><span class="research-node-description">{{ node.description }}</span></span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { getImageUrl, handleImageFallback } from '../../utils/env.js'
import { CAMP_RESEARCH_NODE, layoutCampResearch } from '../../utils/campResearchLayout.js'

const props = defineProps({ entries: { type: Array, required: true }, matches: { type: Array, required: true } })
const emit = defineEmits(['select'])
const scrollPanels = ref([])
const draggingGroup = ref(null)
let drag = null
let suppressClick = false
const startDrag = (event, groupId) => {
  suppressClick = false
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  drag = { panel: event.currentTarget, groupId, pointerId: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false }
}
const moveDrag = event => {
  if (!drag || drag.pointerId !== event.pointerId) return
  const delta = event.clientX - drag.x
  if (!drag.moved && Math.abs(delta) < 4) return
  if (!drag.moved) drag.panel.setPointerCapture(event.pointerId)
  drag.moved = true
  suppressClick = true
  draggingGroup.value = drag.groupId
  event.preventDefault()
  drag.panel.scrollLeft = drag.left - delta
}
const endDrag = event => {
  if (!drag || drag.pointerId !== event.pointerId) return
  const { panel, pointerId } = drag
  drag = null
  draggingGroup.value = null
  if (panel.hasPointerCapture(pointerId)) panel.releasePointerCapture(pointerId)
}
const leaveDrag = event => { if (!drag?.moved) endDrag(event) }
const guardDragClick = event => {
  if (suppressClick && event.detail !== 0) {
    event.preventDefault()
    event.stopPropagation()
  }
  suppressClick = false
}
const matchingIds = computed(() => new Set(props.matches.map(entry => entry.id)))
const groups = computed(() => {
  const byId = new Map(props.entries.map(entry => [entry.id, entry]))
  const visible = new Set(matchingIds.value)
  for (const entry of props.matches) {
    let parent = byId.get(entry.prerequisite?.id)
    const visited = new Set([entry.id])
    while (parent && !visited.has(parent.id)) {
      visible.add(parent.id)
      visited.add(parent.id)
      parent = byId.get(parent.prerequisite?.id)
    }
  }
  const teams = [...new Map(props.matches.map(entry => [entry.team, entry.teamName]))]
  return teams.map(([id, name]) => ({ id, name,
    matchCount: props.matches.filter(entry => entry.team === id).length,
    layout: layoutCampResearch(props.entries.filter(entry => entry.team === id && visible.has(entry.id)))
  }))
})
watch(groups, async () => {
  await nextTick()
  // Start at the root; later branches remain reachable by horizontal scrolling.
  for (const panel of scrollPanels.value) panel.scrollLeft = 0
}, { immediate: true })
</script>

<style scoped>
.research-tree-section + .research-tree-section { margin-top: 24px; }
.research-tree-title { display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-soft); padding-bottom: 8px; }
.research-tree-title h2 { margin: 0; font-size: 16px; color: var(--text-main); }
.research-tree-title > span, .research-tree-hint { font-size: 12px; color: var(--text-muted); }
.research-tree-hint { margin: 8px 0; line-height: 1.5; }
.research-tree-scroll { overflow-x: auto; max-width: 100%; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-dark); scrollbar-width: none; cursor: grab; user-select: none; }
.research-tree-scroll::-webkit-scrollbar { display: none; }
.research-tree-scroll.is-dragging, .research-tree-scroll.is-dragging .research-node { cursor: grabbing; }
.research-tree { position: relative; margin-inline: auto; }
.research-tree-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.research-tree-lines path { fill: none; stroke: var(--border-color); stroke-width: 2; stroke-linejoin: round; }
.research-node { position: absolute; width: var(--research-node-width); height: var(--research-node-height); padding: 0; border: 0; background-color: transparent; background-size: 100% 100%; background-repeat: no-repeat; color: #382b1d; text-align: left; cursor: pointer; font: inherit; transition: filter .15s; }
.research-node:hover, .research-node:focus-visible { filter: drop-shadow(0 0 4px var(--accent-ink)); }
.research-node.is-context { opacity: .6; }
.research-node > img { position: absolute; left: 14px; top: 14px; width: 60px; height: 60px; object-fit: contain; }
.research-node-body { position: absolute; left: 90px; right: 24px; top: 12px; bottom: 10px; display: grid; grid-template-rows: 35px 1fr; }
.research-node-heading { display: flex; align-items: center; justify-content: flex-start; gap: 8px; min-width: 0; }
.research-node strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 1.4; }
.research-node-description { min-width: 0; padding-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 13px; }
.research-node small { flex: 0 0 auto; white-space: nowrap; font-size: 10px; color: #65513b; }
</style>
