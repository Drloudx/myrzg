<template>
  <g class="mascot-arm" :data-side="side">
    <g class="rig-upper" :transform="`translate(${shoulder[0]} ${shoulder[1]}) rotate(${joint.upperAngle})`">
      <path class="rig-upper-sleeve" :d="sleeves['upper-sleeve']" fill="var(--rig-sleeve, #ece5d3)" />
      <path class="rig-upper-fold" :d="sleeves['upper-fold']" stroke="var(--rig-fold, #bab8a7)" stroke-width="1.5" />
      <g v-if="['knight', 'horned'].includes(sleeve)" data-costume="shoulder-armor">
        <path d="M-13-4L1-11L15 1L11 17L-9 15Z" fill="var(--rig-armor)" />
        <path d="M-10 0L1-6L10 3L7 11L-7 10" fill="none" stroke="var(--rig-boot-trim)" stroke-width="1.6" />
        <path v-if="sleeve === 'horned'" d="M-7-5L-20-12L-11 5Z" fill="var(--rig-spike)" />
      </g>
      <path v-if="sleeve === 'tiger'" d="M-9 6L1 10L-8 12M9 16L-1 20L8 23" stroke="var(--rig-stripe)" stroke-width="3.5" />
      <g v-if="['sita', 'bandage', 'ranger'].includes(sleeve)" data-costume="leather-armlet">
        <path d="M-10 7L9 7L9 18L-9 18Z" fill="var(--rig-armlet, #715a49)" />
        <path d="M-7 10L-2 10L-2 15L-7 15ZM3 10L7 10L7 15L3 15Z" fill="var(--rig-armlet-trim, #ad8b64)" stroke-width="1.1" />
      </g>
      <path v-if="sleeve === 'wrap' && side === 'right'" d="M-7 11L7 13L6 23L-6 21Z" fill="#929c69" stroke-width="1.4" />
      <g v-if="detail('upperArm')" data-costume="authored-upper-arm" v-html="detail('upperArm')" />
    </g>
    <g class="rig-forearm" :transform="`translate(${joint.elbow[0]} ${joint.elbow[1]}) rotate(${joint.forearmAngle})`">
      <g :class="['mascot-forearm', { 'hil-right-forearm': side === 'right' && animated }]">
        <path class="rig-forearm-sleeve" :d="sleeves['forearm-sleeve']" fill="var(--rig-sleeve, #ece5d3)" />
        <path class="rig-forearm-fold" :d="sleeves['forearm-fold']" stroke="var(--rig-fold, #bab8a7)" stroke-width="1.5" />
        <g class="rig-wrist" :transform="`translate(0 ${joint.forearmLength}) rotate(${joint.handAngle - joint.forearmAngle})`">
          <g transform="translate(0 14)" class="mascot-grip-anchor">
            <g :class="{ 'hil-reeling-hand': side === 'left' && grip === 'rod', 'hil-rod-hand': side === 'right' && grip === 'rod' }">
            <g :class="{ 'hil-thinking-hand': side === 'right' && animated }" :transform="side === 'left' ? 'scale(-1 1)' : undefined">
              <!-- Identical glove/cuff geometry on both hands and in every pose. -->
              <template v-if="['sita', 'bandage'].includes(sleeve)">
                <g data-costume="wrapped-wrist">
                  <path d="M-10-21L10-21L12-4L-10-4Z" fill="var(--rig-cuff)" />
                  <path d="M-8-19L10-12M-9-13L9-6M6-21L-9-15" stroke="#afb7b1" stroke-width="1.6" />
                </g>
              </template>
              <template v-else-if="sleeve === 'miner'">
                <path d="M-12-19Q0-24 12-19L12-3Q0 2-12-3Z" fill="#77858b" />
                <path d="M-9-17Q0-20 9-17M-9-5Q0-2 9-5" stroke="#c8d2c9" stroke-width="2.5" />
                <path d="M10-14L17-14L17-7L11-6Z" fill="none" stroke="#8d9b9f" stroke-width="3" />
              </template>
              <template v-else-if="['knight', 'horned'].includes(sleeve)">
                <path d="M-12-19L0-26L12-17L11-3L-10-3Z" fill="var(--rig-armor)" />
                <path d="M-9-16L0-21L8-15L6-7L-7-8Z" fill="var(--rig-cuff)" stroke-width="1.5" />
                <path v-if="sleeve === 'horned'" d="M-11-17L-20-28L-15-12Z" fill="var(--rig-spike)" />
              </template>
              <template v-else-if="sleeve === 'spiked'">
                <path d="M-12-18L12-18L13-3L-13-3Z" fill="var(--rig-cuff)" />
                <path d="M-11-16L-17-13L-12-9M12-16L18-12L12-8" fill="#909a9c" />
                <path d="M-5-16L0-20L4-15L0-11Z" fill="#8d999b" stroke-width="1.2" />
              </template>
              <template v-else-if="['ruffle', 'fur', 'snow'].includes(sleeve)">
                <path d="M-11-17L10-17L16-8L9-3L3-8L-1-3L-6-8L-13-4L-16-9Z" fill="var(--rig-cuff)" />
                <path d="M-8-14L-6-8M0-14L3-8M8-14L9-7" stroke="var(--rig-fold)" stroke-width="1.3" />
              </template>
              <template v-else-if="sleeve === 'wrap'">
                <path d="M-11-15L11-15L12-3L-11-3Z" fill="var(--rig-cuff)" />
                <path d="M-8-12L8-5M6-13L-7-5" stroke="var(--rig-wrap-stitch)" stroke-width="1.5" />
              </template>
              <template v-else>
                <path d="M-11-15L10-15L13-8L10-3L-11-3L-13-9Z" fill="var(--rig-cuff, #75674f)" />
                <path d="M-10-13L9-13M-8-9L7-9" stroke="var(--rig-trim, #b9a66c)" stroke-width="1.8" />
              </template>
              <g v-if="detail('cuff')" data-costume="authored-cuff" v-html="detail('cuff')" />
              <path class="mascot-palm" :d="bareHands ? 'M-8-5Q0-8 8-4L10 5Q11 10 7 12L3 11L0 13L-4 10L-7 11L-10 6Z' : 'M-10-5Q0-9 10-5L12 6Q13 12 8 14L4 13L0 16L-4 13L-8 14L-12 8Z'" fill="var(--rig-glove, #75674f)" />
              <path v-if="sleeve === 'wrap' && side === 'left'" d="M-8-5Q0-8 8-4L9 2L4 0L1 3L-3 0L-8 3Z" fill="#38313b" stroke-width="1.4" />
              <path class="mascot-thumb" :d="bareHands ? 'M-8-3Q-14-2-14 3Q-13 7-8 6L-4 2' : 'M-10-3Q-17-3-17 3Q-17 9-10 8L-5 3'" fill="var(--rig-thumb, #8b7958)" />
              <path v-if="grip === 'rope'" d="M0-8V13" :transform="`rotate(${side === 'left' ? joint.handAngle : -joint.handAngle})`" stroke="#bca36b" stroke-width="3" />
              <path v-if="grip === 'rope'" d="M-6-1L7-1M-5 4L8 4M-4 9L7 9" stroke="var(--rig-trim, #b9a66c)" stroke-width="2" />
              <g v-else stroke="var(--rig-trim, #b9a66c)" stroke-width="1.5">
                <path d="M-4-1L-3 8M2-2L3 9" />
                <path class="mascot-finger-index" d="M7-1Q9 2 8 7" />
              </g>
            </g>
            </g>
          </g>
        </g>
      </g>
    </g>
    <g v-if="!['ruffle', 'fur', 'leaf', 'sita', 'bandage', 'coat', 'ranger', 'spiked', 'knight', 'tiger', 'horned', 'snow', 'miner'].includes(sleeve) && (sleeve !== 'wrap' || side === 'left')" :transform="`translate(${shoulder[0]} ${shoulder[1]}) scale(${side === 'left' ? -1 : 1} 1)`">
      <path d="M-10-5L3-9L13 4L0 13L-12 4Z" fill="var(--rig-shoulder, #4b5c64)" />
      <path d="M-5-3L6 3" stroke="var(--rig-seam, #849494)" stroke-width="1.5" />
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { armSleevePaths, solveArm } from './mascotRig.js'
const props = defineProps({
  shoulder: { type: Array, required: true }, hand: { type: Array, required: true },
  side: { type: String, required: true }, handAngle: Number,
  bend: { type: Number, default: 1 }, grip: { type: String, default: 'rest' },
  upperLength: { type: Number, default: 40 }, forearmLength: { type: Number, default: 27 },
  animated: Boolean, sleeve: String, details: { type: Object, default: () => ({}) }
})
const detail = name => props.details[`${name}-${props.side}`] || props.details[name]
const joint = computed(() => solveArm(props))
const bareHands = computed(() => ['ruffle', 'wrap', 'fur', 'leaf', 'sita', 'bandage', 'coat', 'flame', 'spiked'].includes(props.sleeve))
const sleeves = computed(() => armSleevePaths(joint.value.upperLength, joint.value.forearmLength))
</script>
