<template>
  <g class="hil-figure" :data-pose="pose" :data-model="model.id" stroke="var(--rig-outline, #525250)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <g class="hil-hair hil-hair-left"><g class="rig-hair-left" :style="leftHairStyle" v-html="parts.hairLeft" /></g>
    <g class="hil-hair hil-hair-right"><g class="rig-hair-right" :style="rightHairStyle"><g :class="{ 'rig-cape': model.id === '055' }" :style="capeStyle" v-html="parts.hairRight" /></g></g>
    <g v-if="parts.sword && model.swordLayer !== 'front'" class="rig-sword" :style="swordStyle" v-html="parts.sword" />
    <g v-if="!model.satchelLayer" class="rig-satchel" :style="satchelStyle" v-html="parts.satchel" />
    <MascotLeg v-for="leg in legs" :key="leg.side" v-bind="leg" :variant="model.legVariant" :details="parts" />
    <g v-if="parts.skirt" class="rig-skirt" :style="skirtStyle" v-html="parts.skirt" />
    <g v-html="parts.torso" />
    <g v-if="parts.front" class="rig-collar" v-html="parts.front" />
    <g v-if="model.satchelLayer === 'waist'" class="rig-satchel" :style="satchelStyle" v-html="parts.satchel" />
    <g class="hil-head" v-html="parts.head" />
    <MascotArm v-for="arm in arms" :key="arm.side" v-bind="arm" :sleeve="model.sleeve" :details="parts" :animated="['idle', 'think', 'think-raise'].includes(pose)" />
    <g v-if="parts.sword && model.swordLayer === 'front'" class="rig-sword" :style="swordStyle" v-html="parts.sword" />
    <g v-if="parts.sword && model.swordLayer === 'front'" class="rig-sword" :style="swordStyle" v-html="parts.sword" />
    <g v-if="model.satchelLayer === 'shield'" class="rig-satchel" :style="satchelStyle" v-html="parts.satchel" />
  </g>
</template>

<script setup>
import { computed } from 'vue'
import MascotArm from './MascotArm.vue'
import MascotLeg from './MascotLeg.vue'
import { accessoryTransform } from './mascotModels.js'
const props = defineProps({ parts: { type: Object, required: true }, model: { type: Object, required: true }, pose: { type: String, default: 'idle' } })
const arms = computed(() => props.model.arms[props.pose] || props.model.arms.idle)
const legs = computed(() => props.model.legs[props.pose] || props.model.legs.idle)
const accessoryStyle = selector => {
  const accessory = props.model.accessories.find(item => item.selector === selector)
  return accessory ? { '--rig-accessory-transform': accessoryTransform(accessory, props.pose) } : undefined
}
const swordStyle = computed(() => accessoryStyle('.rig-sword'))
const capeStyle = computed(() => accessoryStyle('.rig-cape'))
const leftHairStyle = computed(() => accessoryStyle('.rig-hair-left'))
const rightHairStyle = computed(() => accessoryStyle('.rig-hair-right'))
const satchelStyle = computed(() => accessoryStyle('.rig-satchel'))
const skirtStyle = computed(() => accessoryStyle('.rig-skirt'))
</script>
