<template>
  <div ref="host" class="sidebar-mascot" :data-character="active.id" :data-rigged="hasMascotRig(active.id) ? 'true' : null" :aria-busy="loading" :style="{ '--mascot-play-state': playing ? 'running' : 'paused' }">
    <!-- Trusted, repository-owned SVG; no runtime markup or original PNG download. -->
    <div class="mascot-art" :data-action="action" :data-hero="active.id" :data-rigged="hasMascotRig(active.id) ? 'true' : null" aria-hidden="true">
      <div v-if="hasMascotRig(active.id) && artwork" class="mascot-drawing"><MascotScene :key="active.id" :character="active.id" :action="action" :playing="playing" :paused="paused" :reduced-motion="reducedMotion" @state="hilState = $event" /></div>
      <div v-else class="mascot-drawing" v-html="artwork"></div>
      <span v-if="action === 'think' && !reducedMotion && (!hasMascotRig(active.id) || (hilState.action === 'think' && hilState.stage === 'loop'))" class="mascot-thought-bubble">?</span>
    </div>
    <div class="mascot-controls">
      <UiButton
        v-if="!reducedMotion"
        class="mascot-control mascot-motion-toggle"
        variant="ghost" size="sm" type="button"
        :aria-label="`${paused ? '播放' : '暂停'}${active.name}${actionName}动画`"
        :aria-pressed="paused"
        @click="togglePaused"
      >{{ paused ? '播放' : '暂停' }}</UiButton>
      <UiButton
        v-if="!reducedMotion"
        ref="actionButton"
        class="mascot-control mascot-action-toggle"
        variant="ghost" size="sm" type="button"
        aria-label="选择吉祥物动作"
        aria-haspopup="dialog"
        :aria-expanded="actionPickerOpen"
        aria-controls="mascot-action-picker"
        :title="`当前动作：${actionName}`"
        @click="actionPickerOpen = !actionPickerOpen; pickerOpen = false"
      >{{ actionName }}</UiButton>
      <UiButton
        ref="switchButton"
        class="mascot-control mascot-switch"
        variant="ghost" size="sm" type="button"
        :disabled="loading"
        aria-label="切换吉祥物角色"
        aria-haspopup="dialog"
        :aria-expanded="pickerOpen"
        aria-controls="mascot-character-picker"
        :title="`当前：${active.name}；选择吉祥物`"
        @click="pickerOpen = !pickerOpen"
      >{{ loading ? '加载中' : '切换' }}<i v-if="!loading" class="mascot-chevron" :class="{ 'is-open': pickerOpen }" aria-hidden="true"></i></UiButton>
    </div>
    <span class="mascot-announcement" role="status">{{ loadFailed ? '角色加载失败，请重试' : `当前吉祥物：${active.name}` }}</span>
    <UiPopover v-model:visible="actionPickerOpen" id="mascot-action-picker" :anchor="actionButton?.$el" :title="`${active.name}的动作`" :width="340">
      <div class="mascot-action-options">
        <UiButton v-for="entry in availableActions" :key="entry.id" :variant="action === entry.id ? 'secondary' : 'ghost'"
          class="mascot-action-option" :aria-pressed="action === entry.id" :aria-label="`使用${entry.name}动作`" @click="selectAction(entry.id)">
          <span>{{ entry.name }}</span><small>{{ entry.detail }}</small>
        </UiButton>
      </div>
    </UiPopover>
    <UiPopover
      v-model:visible="pickerOpen"
      id="mascot-character-picker"
      :anchor="switchButton?.$el"
      title="选择吉祥物"
    >
      <template #heading-actions v-if="batchCount > 1">
        <nav class="mascot-batch-controls" aria-label="切换吉祥物批次">
          <UiButton variant="ghost" size="sm" :disabled="batch === 0 || loading" aria-label="上一批角色" @click="batch--"><span class="mascot-batch-arrow" aria-hidden="true">‹</span>上一批</UiButton>
          <span class="mascot-batch-position" aria-live="polite">{{ batch + 1 }} / {{ batchCount }}</span>
          <UiButton variant="ghost" size="sm" :disabled="batch >= batchCount - 1 || loading" aria-label="下一批角色" @click="batch++">下一批<span class="mascot-batch-arrow" aria-hidden="true">›</span></UiButton>
        </nav>
      </template>
      <div class="mascot-options">
        <UiButton
          v-for="character in batchCharacters"
          :key="character.id"
          class="mascot-option"
          :variant="active.id === character.id ? 'secondary' : 'ghost'"
          size="sm" type="button"
          :aria-label="`选择${character.name}`"
          :aria-pressed="active.id === character.id"
          :data-character-option="character.id"
          :disabled="loading"
          @click="loadCharacter(character, true)"
        >
          <span v-if="hasMascotRig(character.id) && previews[character.id]" class="mascot-option-art" aria-hidden="true"><MascotScene :character="character.id" preview /></span>
          <span v-else-if="previews[character.id]" class="mascot-option-art" aria-hidden="true" v-html="previews[character.id]"></span>
          <span v-else class="mascot-option-art mascot-preview-placeholder" aria-hidden="true">{{ previewErrors[character.id] ? '点击重试' : '加载中' }}</span>
          <span class="mascot-option-name">{{ character.name }}</span>
        </UiButton>
      </div>
      <div v-if="loadFailed" class="mascot-picker-error" role="alert">
        <span>角色加载失败，请重试</span>
        <UiButton variant="ghost" size="sm" @click="loadCharacter(requested, true)">重试</UiButton>
      </div>
    </UiPopover>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { UiButton, UiPopover } from './ui/index.js'
import { MASCOTS } from '../config/mascots.js'
import { loadMascotArtwork } from '../utils/mascotArtwork.js'
import MascotScene from './mascot/MascotScene.vue'
import { hasMascotRig } from './mascot/mascotModels.js'
import '../assets/mascot/idle.css'
import '../assets/mascot/actions.css'

const host = ref(null)
const switchButton = ref(null)
const actionButton = ref(null)
const actionPickerOpen = ref(false)
const route = useRoute()
const pickerOpen = ref(false)
const batchSize = 7
const batch = ref(0)
const batchCount = Math.ceil(MASCOTS.length / batchSize)
const batchCharacters = computed(() => MASCOTS.slice(batch.value * batchSize, (batch.value + 1) * batchSize))
const previews = ref({})
const previewErrors = ref({})
const paused = ref(false)
const action = ref('idle')
const hilState = ref({ action: 'idle', stage: 'loop' })
const actions = [
  { id: 'idle', name: '待机', detail: '呼吸 · 眨眼' },
  { id: 'think', name: '思考', detail: '抬手托腮 · 偏头' },
  { id: 'swing', name: '秋千', detail: '握绳轻荡 · 晃脚' },
  { id: 'fish', name: '钓鱼', detail: '看漂 · 收线提竿' }
]
const actionName = computed(() => actions.find(entry => entry.id === action.value)?.name || '待机')
const reducedMotion = ref(false)
const inView = ref(false)
const pageVisible = ref(false)
const playing = computed(() => !paused.value && !reducedMotion.value && inView.value && pageVisible.value)
const preferenceKey = 'mitora-mascot-paused'
const characterKey = 'sidebar-mascot-character'
const actionKey = 'sidebar-mascot-action'
const active = ref(MASCOTS[0])
// Only hand-checked articulated models expose the full choreography. A portrait
// remains idle until its limbs and props have been individually verified.
const availableActions = computed(() => hasMascotRig(active.value.id) ? actions : [{ ...actions[0], detail: '轻呼吸' }])
const artwork = ref('')
const loading = ref(false)
const loadFailed = ref(false)
let requested = MASCOTS[0]
let loadOperation = 0
let artworkRequest
let previewRequest
let observer
let motionPreference

async function loadCharacter(character, closePicker = false) {
  const operation = ++loadOperation
  artworkRequest?.abort()
  artworkRequest = new AbortController()
  requested = character
  loading.value = true
  loadFailed.value = false
  try {
    const svg = await loadMascotArtwork(character, artworkRequest.signal)
    if (operation !== loadOperation) return
    artwork.value = svg
    previews.value[character.id] = svg
    active.value = character
    if (!hasMascotRig(character.id) && action.value !== 'idle') {
      action.value = 'idle'
      try { localStorage.setItem(actionKey, 'idle') } catch { /* Session fallback remains available. */ }
    }
    actionPickerOpen.value = false
    if (closePicker) {
      pickerOpen.value = false
    }
    try { localStorage.setItem(characterKey, character.id) } catch { /* Session switching still works without storage. */ }
  } catch {
    if (operation === loadOperation) loadFailed.value = true
  } finally {
    if (operation === loadOperation) loading.value = false
  }
  if (closePicker && !loadFailed.value && operation === loadOperation) {
    await nextTick()
    switchButton.value?.$el?.focus({ preventScroll: true })
  }
}

watch(pickerOpen, open => {
  if (open) batch.value = Math.floor(MASCOTS.findIndex(character => character.id === active.value.id) / batchSize)
}, { flush: 'sync' })
watch([pickerOpen, batch], async ([open]) => {
  previewRequest?.abort()
  if (!open) return
  actionPickerOpen.value = false
  const controller = new AbortController()
  previewRequest = controller
  await Promise.allSettled(batchCharacters.value.map(async character => {
    if (previews.value[character.id]) return
    previewErrors.value[character.id] = false
    try {
      const svg = await loadMascotArtwork(character, controller.signal)
      if (!controller.signal.aborted) previews.value[character.id] = svg
    } catch {
      if (!controller.signal.aborted) previewErrors.value[character.id] = true
    }
  }))
})
watch(() => route.fullPath, () => { pickerOpen.value = false; actionPickerOpen.value = false })
watch(reducedMotion, reduced => { if (reduced) actionPickerOpen.value = false })

function updateVisibility() { pageVisible.value = !document.hidden }
function updateMotionPreference() { reducedMotion.value = motionPreference.matches }
function togglePaused() {
  paused.value = !paused.value
  try { localStorage.setItem(preferenceKey, String(paused.value)) } catch { /* Private browsing may disable storage. */ }
}
async function selectAction(id) {
  if (!availableActions.value.some(entry => entry.id === id)) return
  action.value = id
  actionPickerOpen.value = false
  try { localStorage.setItem(actionKey, action.value) } catch { /* Keep the session choice. */ }
  await nextTick()
  actionButton.value?.$el?.focus({ preventScroll: true })
}

onMounted(() => {
  try { paused.value = localStorage.getItem(preferenceKey) === 'true' } catch { /* Animation controls remain usable without storage. */ }
  try {
    const saved = localStorage.getItem(actionKey)
    action.value = saved === 'hop' ? 'think' : actions.some(entry => entry.id === saved) ? saved : 'idle'
  } catch { /* Default to idle. */ }
  let initial = MASCOTS[0]
  try { initial = MASCOTS.find(entry => entry.id === localStorage.getItem(characterKey)) || initial } catch { /* Use the default character. */ }
  loadCharacter(initial)
  updateVisibility()
  document.addEventListener('visibilitychange', updateVisibility)
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference()
  motionPreference.addEventListener('change', updateMotionPreference)
  observer = new IntersectionObserver(([entry]) => { inView.value = entry.isIntersecting && entry.intersectionRatio > 0 })
  observer.observe(host.value)
})

onBeforeUnmount(() => {
  loadOperation += 1
  artworkRequest?.abort()
  previewRequest?.abort()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', updateVisibility)
  motionPreference?.removeEventListener('change', updateMotionPreference)
})
</script>

<style scoped>
.sidebar-mascot {
  width: 192px;
  max-width: 100%;
  flex: 0 0 auto;
  align-self: flex-end;
  margin-top: auto;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.mascot-art {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  contain: layout paint;
}
.mascot-drawing { width: 100%; height: 100%; }
.mascot-art :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.mascot-controls {
  width: max-content;
  align-self: flex-end;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 2px;
}
.mascot-control {
  pointer-events: auto;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-main);
  padding-inline: 7px;
}
.mascot-switch { min-height: 28px; }
.mascot-chevron {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-1px) rotate(45deg);
  transition: transform .15s ease;
}
.mascot-chevron.is-open { transform: translateY(2px) rotate(225deg); }
@media (prefers-reduced-motion: reduce) { .mascot-chevron { transition: none; } }
.mascot-announcement {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.mascot-options {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.mascot-batch-controls { display: flex; align-items: center; gap: 3px; }
.mascot-batch-controls :deep(.ui-btn) { min-height: 30px; padding: 0 7px; font-size: 13px; color: var(--text-main); gap: 5px; }
.mascot-batch-arrow { font-size: 24px; line-height: 1; }
.mascot-batch-position { min-width: 34px; text-align: center; font-size: 12px; color: var(--text-muted); }
.mascot-action-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mascot-action-option { display: flex; flex-direction: column; gap: 5px; padding: 12px 6px; }
.mascot-action-option small { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.mascot-option {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px 3px;
  gap: 4px;
  font-size: 13px;
  font-weight: 400;
}
.mascot-option-art {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  pointer-events: none;
}
.mascot-option-art :deep(svg) { display: block; width: 100%; height: 100%; }
.mascot-option-art :deep(.idle-motion) { animation: none; }
.mascot-option-art :deep(.hil-scene *) { animation: none; }
.mascot-preview-placeholder { display: grid; place-items: center; }
.mascot-option-name { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.6; }
.mascot-picker-error { display: flex; align-items: center; justify-content: flex-end; font-size: 13px; gap: 8px; }
/* Keep the illustration secondary in short desktop windows; the notes stay above it in normal flow. */
@media (max-height: 780px) {
  .sidebar-mascot { width: 144px; padding-top: 8px; }
}
</style>
