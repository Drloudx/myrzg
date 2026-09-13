<template>
  <svg ref="root" class="mascot-illustration hil-scene" data-rigged="true" :data-scene="scene" :data-stage="stage" :data-character="model.id" :style="model.styles" viewBox="0 0 320 400" fill="none" aria-hidden="true" focusable="false">
    <g class="mascot-display-scale" :transform="`translate(162 369) scale(${displayScale}) translate(-162 -369)`">
    <g class="hil-environment">
      <template v-if="scene === 'swing'">
      <ellipse class="hil-swing-shadow" cx="160" cy="380" rx="70" ry="8" fill="#574d3a" opacity=".12" />
      <g stroke="#6d5b43" stroke-linecap="round" stroke-linejoin="round">
        <path d="M98 25L24 382M222 25L296 382" stroke-width="11" />
        <path d="M101 28L29 379M219 28L291 379" stroke="#b39b70" stroke-width="3" />
        <path d="M76 25Q160 16 245 25" stroke-width="14" />
        <path d="M78 22Q160 13 244 22M44 290L57 292M266 292L279 290" stroke="#b39b70" stroke-width="2" />
        <path d="M82 97L118 28M202 27L240 97" stroke-width="7" />
        <circle cx="114" cy="25" r="5" fill="#ae9562" /><circle cx="208" cy="25" r="5" fill="#ae9562" />
      </g>
      <path d="M22 386L16 372M28 385L36 375M292 386L301 372M298 385L312 381" stroke="#88916a" stroke-width="2" stroke-linecap="round" />
      </template>
      <HilFishingProps v-else-if="scene === 'fish'" layer="back" />
      <ellipse v-else cx="162" cy="369" rx="43" ry="6" fill="#574d3a" opacity=".14" />
    </g>
    <g class="hil-swing-pendulum">
      <g v-if="scene === 'swing'" class="hil-seat-props">
        <path d="M114 25V284M208 25V284" stroke="#7e694b" stroke-width="4" />
        <path d="M113 29V280M207 29V280" stroke="#c9b482" stroke-width="1.2" stroke-dasharray="3 3" />
        <path d="M99 280L219 280L226 290L104 296L96 290Z" fill="#967447" stroke="#61513d" stroke-width="2" />
        <path d="M104 286L217 285M125 291L161 290" stroke="#c4a06a" stroke-width="1.5" />
        <path d="M111 273L118 278L112 285M205 273L212 278L205 286" stroke="#bca36b" stroke-width="3" stroke-linecap="round" />
      </g>
      <g :transform="placement" class="hil-model-placement">
        <g class="idle-body" :class="{ 'hil-standing idle-motion': ['idle', 'think'].includes(scene) }">
          <g class="hil-facing">
          <MascotFigure :parts="parts" :pose="pose" :model="model" />
          </g>
        </g>
      </g>
    </g>
    <HilFishingProps v-if="scene === 'fish'" layer="front" :parked-offset-x="model.fishing?.parkedOffsetX" :stowed="!['loop', 'fish-cast', 'fish-watch', 'fish-brake', 'fish-reel'].includes(stage)" />
    </g>
  </svg>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getMascotScale } from '../../config/mascots.js'
import MascotFigure from './MascotFigure.vue'
import HilFishingProps from './HilFishingProps.vue'
import { createMascotParts } from './mascotParts.js'
import { getMascotModel } from './mascotModels.js'
import { useMascotChoreography } from './useMascotChoreography.js'
import '../../assets/mascot/hil.css'
const props = defineProps({
  action: { type: String, default: 'idle' }, character: { type: String, default: '001' }, preview: Boolean,
  playing: { type: Boolean, default: true }, paused: Boolean, reducedMotion: Boolean
})
const emit = defineEmits(['state'])
const root = ref(null)
const model = getMascotModel(props.character)
const displayScale = getMascotScale(props.character)
const parts = createMascotParts(model)
const { scene, pose, stage, placement } = useMascotChoreography(props, root, model)
watch([scene, stage], () => emit('state', { action: scene.value, stage: stage.value }), { immediate: true })
</script>
