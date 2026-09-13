<template>
  <g class="mascot-leg" :data-side="side" :transform="`translate(${hip[0]} ${hip[1]})`">
    <g class="rig-thigh" :transform="`rotate(${thighAngle})`">
      <path d="M-12-5Q0-9 12-4L11 24Q0 30-11 24Z" fill="var(--rig-thigh, #ece7d5)" />
      <path v-if="variant === 'rune'" d="M-5 3L-5 11L0 10L-1 20M5 12L8 15L7 24" stroke="#9477b1" stroke-width="1.8" />
      <path v-if="variant === 'mitora' && side === 'left'" d="M-11 3L11 6L11 14L-11 11Z" fill="#493d46" />
      <path v-else-if="!['gaiter', 'mitora', 'sita', 'silk', 'furBoot', 'fox', 'wolf'].includes(variant)" d="M-6 6L5 8M-7 13L7 15" stroke="#c1bcaa" stroke-width="1.5" />
      <g v-if="detail('thigh')" data-costume="authored-thigh" v-html="detail('thigh')" />
      <g transform="translate(0 24)">
        <g class="rig-shin" :transform="`rotate(${shinAngle - thighAngle})`">
          <g class="hil-shin" :class="`hil-shin-${side}`">
            <template v-if="variant === 'sita'">
              <g data-costume="buckled-boot-shaft">
                <path d="M-11-5Q0-1 11-5L10 29L-10 29Z" fill="var(--rig-stocking)" />
                <path d="M-11 1L10 3L10 10L-11 8ZM-10 17L10 15L11 22L-10 24Z" fill="#7c6755" />
                <path d="M-5 3L2 4L2 9L-5 8ZM-2 17L5 17L5 22L-2 22Z" fill="#b29a70" stroke-width="1.2" />
                <path d="M6 10L7 14M-5 25L-4 29" stroke="#697076" stroke-width="1.3" />
              </g>
            </template>
            <template v-else-if="variant === 'mitora'">
              <path d="M-11-3Q0-7 11-3L10 29L-10 29Z" :fill="side === 'left' ? '#483e4b' : '#f4ccac'" />
              <path v-if="side === 'left'" d="M-8 3L7 7L-6 14L-9 11Z" fill="#d8b99f" stroke="none" />
              <g v-else>
                <path d="M-10 15L10 13L11 27L-10 29Z" fill="#b59351" />
                <path d="M-6 17L-5 26M0 16L1 25M6 15L7 24" stroke="#e1bd74" stroke-width="1.5" />
              </g>
            </template>
            <template v-else>
            <path d="M-11-3Q0-7 11-3L10 29L-10 29Z" :fill="side === 'right' ? 'var(--rig-right-stocking, var(--rig-stocking, #ece7d5))' : 'var(--rig-stocking, #ece7d5)'" />
            <path v-if="variant === 'archer' && side === 'right'" d="M-4 11L3 16L-1 23L-7 17Z" fill="var(--rig-knee-trim)" />
            <path v-if="variant === 'plate'" d="M-12 2L0-6L12 2L8 15L0 19L-10 12Z" fill="var(--rig-boot-trim)" />
            <path v-if="variant === 'plate'" d="M-8 4L0-2L7 4L4 11L-3 12Z" fill="var(--rig-armor)" stroke-width="1.4" />
            <path v-if="variant === 'tiger'" d="M-10 3L2 8L-8 12M10 17L-2 21L9 25" stroke="var(--rig-stripe)" stroke-width="3" />
            <path d="M-9 3L-1 5L2 1L10 3M-9 9L9 10" stroke="var(--rig-knee-trim, #bba16e)" stroke-width="2" />
            <path v-if="variant === 'gaiter' && side === 'right'" d="M-6 12L7 11L5 18L-7 17Z" fill="#8e9277" />
            <path d="M-10 19L-3 25L9 20L6 30L-10 29Z" fill="var(--rig-leg-fold, #c9c5b7)" stroke="none" />
            </template>
            <g v-if="detail('shin')" data-costume="authored-shin" v-html="detail('shin')" />
            <g transform="translate(0 27)">
              <path d="M-12-5Q0 3 12-5L10 13L4 18L5 26Q2 36-10 33Q-17 30-13 20L-14 9Z" :fill="side === 'right' ? 'var(--rig-right-boot, var(--rig-boot, #6d6050))' : 'var(--rig-boot, #6d6050)'" />
              <template v-if="['wolf', 'fox', 'tiger'].includes(variant)">
                <path d="M-12 0L11 2L10 9L-12 7Z" fill="var(--rig-boot-trim)" />
                <path d="M-11 22L-8 25L-10 31L-13 28ZM-4 23L0 26L-2 33L-6 31ZM4 22L7 25L5 30L2 28Z" :fill="variant === 'wolf' ? '#d8d6c6' : '#695243'" stroke-width="1.2" />
              </template>
              <template v-else-if="variant === 'silk'">
                <path d="M-12 0L11 1L10 7L-12 6Z" fill="var(--rig-boot-trim)" />
                <path d="M-7 26L-6 30M-1 27L0 31" stroke="var(--rig-sole)" stroke-width="1.2" />
              </template>
              <template v-else-if="variant === 'furBoot'">
                <path d="M-12-3L-9 2L-5-2L0 3L5-2L9 2L12-3" stroke="#e7ddc4" stroke-width="5" />
                <path d="M-8 10L6 10L6 16L-8 16Z" fill="var(--rig-boot-trim)" />
              </template>
              <template v-else-if="variant === 'sita'">
                <path d="M-12 2L10 3L10 9L-12 8Z" fill="#736052" />
                <path d="M-3 3L3 3L3 8L-3 8Z" fill="#ab9169" stroke-width="1.2" />
                <path d="M-8 13L-6 23Q-6 27-1 28" stroke="#666e74" stroke-width="2" />
              </template>
              <template v-else-if="variant === 'mitora'">
                <path d="M-13 0L0 7L12-1L12 10L1 18L-13 10Z" fill="#567391" />
                <path v-if="side === 'left'" d="M-12-3L0 4L10-3L11 2L0 10L-12 4Z" fill="#e3ddc8" />
                <path v-if="side === 'left'" d="M0 10L4 14L0 18L-4 14Z" fill="#d3b471" stroke-width="1" />
                <path v-else d="M-8 25Q-1 21 5 25" stroke="#b99860" stroke-width="2.5" />
              </template>
              <template v-else-if="variant === 'paw'">
                <path d="M-12-2L-5 5L0 0L7 5L12-2M-10 7L-2 12L-6 20L3 17L7 23" stroke="var(--rig-boot-trim)" stroke-width="4" />
                <path d="M-10 25L-9 30M-4 26L-3 32M2 25L3 29" stroke="var(--rig-sole)" stroke-width="1.5" />
              </template>
              <template v-else-if="variant === 'garden'">
                <path d="M-12-3L-7 0L-2-3L3 1L8-2L12 0" stroke="#e7e4cf" stroke-width="5" />
                <path d="M-7 9L6 10L5 15L-7 14ZM-10 23Q-2 17 5 25L1 30L-9 29Z" fill="#ad7468" />
              </template>
              <path v-else d="M-8 7L6 10L-4 18M-8 25L1 27" stroke="var(--rig-boot-trim, #9b8766)" stroke-width="3" />
              <g v-if="detail('boot')" data-costume="authored-boot" v-html="detail('boot')" />
              <path d="M-11 32Q-3 37 5 29" stroke="var(--rig-sole, #4e473e)" stroke-width="2.5" />
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>
</template>

<script setup>
const props = defineProps({ hip: Array, side: String, thighAngle: Number, shinAngle: Number, variant: String, details: { type: Object, default: () => ({}) } })
const detail = name => props.details[`${name}-${props.side}`] || props.details[name]
</script>
