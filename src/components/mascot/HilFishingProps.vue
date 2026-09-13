<template>
  <g v-if="layer === 'back'">
      <g :transform="fishPropsTransform">
      <ellipse class="hil-pond" cx="186" cy="314" rx="37" ry="18" fill="#aac9bd" opacity=".72" />
      <path d="M155 314Q166 323 181 322M190 323Q208 324 218 315" stroke="#709e9c" stroke-width="1.5" />
      <g class="hil-stool" stroke="#73634b" stroke-width="2" stroke-linejoin="round">
        <path d="M42 250L103 250L108 309Q75 320 40 308Z" fill="#9a7f57" />
        <ellipse cx="72" cy="251" rx="32" ry="9" fill="#c3a779" />
        <ellipse cx="72" cy="251" rx="22" ry="5" stroke="#96794f" />
        <path d="M53 266L50 300M66 271L65 313M91 263L96 301M77 273L79 301" stroke="#756244" />
      </g>
      </g>
  </g>
  <g v-else class="hil-fishing-front" :class="{ 'is-stowed': stowed }">
      <g :transform="fishPropsTransform">
      <g transform="translate(24 -5) scale(.9 1)" stroke-linecap="round" stroke-linejoin="round">
        <g class="hil-tackle" transform-origin="88px 225px" :transform="stowed ? fishingParkedTransform(parkedOffsetX) : undefined">
        <path d="M85 225L120 196" stroke="#564a3a" stroke-width="7" />
        <path d="M86 224L119 197" stroke="#c5a472" stroke-width="4" />
        <path d="M90 219L93 223M94 216L97 220M99 213L102 216M109 203L112 206M114 199L117 202" stroke="#856943" stroke-width="1.2" />
        <circle cx="88" cy="225" r="6" fill="#797c72" stroke="#4e5955" stroke-width="2" />
        <circle cx="88" cy="225" r="3" fill="#b6bca6" />
        <g class="hil-reel"><path d="M88 225L82 231L78 230" stroke="#5d6256" stroke-width="2" /><circle cx="78" cy="230" r="2" fill="#9c8155" /></g>
        <path class="hil-rod" d="M106 210Q166 150 216 150" stroke="#75633f" stroke-width="3" />
        <path class="hil-rod hil-rod-highlight" d="M106 210Q166 150 216 150" stroke="#c8af77" stroke-width="1" />
        <path class="hil-fishing-line" :d="stowed ? FISH_LINE_STOWED : FISH_LINE" stroke="#6c8a87" stroke-width="1.2" />
        <g transform="translate(-28 1)">
        <g class="hil-line-end">
        <g class="hil-bobber">
          <path d="M208 302V318" stroke="#817651" stroke-width="1.3" />
          <ellipse cx="208" cy="310" rx="3" ry="6" fill="#f0e4c5" stroke="#817651" />
          <path d="M205 310Q205 304 208 304Q211 304 211 310Z" fill="#b86756" />
        </g>
        <g class="hil-caught-fish">
          <path d="M208 307Q196 312 202 322L211 326L209 331L216 329L216 322Q223 313 214 308Z" fill="#87b3ac" stroke="#577d78" stroke-width="1.2" />
          <path d="M206 313Q201 321 212 323" stroke="#d8ded0" stroke-width="2" />
          <circle cx="211" cy="312" r="1.2" fill="#354a49" />
        </g>
        </g>
        </g>
        </g>
        <g class="hil-water-effects" transform="translate(-28 1)">
        <ellipse class="hil-water-ring" cx="208" cy="318" rx="8" ry="3" stroke="#739f9c" stroke-width="1.3" />
        <path class="hil-splash" d="M197 312L193 307M217 312L220 305M201 306L199 299" stroke="#9ac6c2" stroke-width="2" />
        </g>
      </g>
      <!-- Bait tin, spare hook and a little reed make the shoreline legible at small size. -->
      <path d="M119 310L119 299Q128 293 137 299L137 310Q128 315 119 310Z" fill="#a69772" stroke="#71664e" stroke-width="1.5" />
      <ellipse cx="128" cy="299" rx="9" ry="3" fill="#d2c399" stroke="#71664e" stroke-width="1.5" />
      <path d="M140 306Q147 314 149 306V302M110 324L104 306M111 326L116 315" stroke="#88916a" stroke-width="1.5" stroke-linecap="round" />
      </g>
  </g>
</template>

<script setup>
import { FISH_LINE, FISH_LINE_STOWED, fishingParkedTransform } from './hilFishingMotion.js'
defineProps({ layer: String, stowed: Boolean, parkedOffsetX: { type: Number, default: 0 } })
const fishPropsTransform = `translate(0 ${32 - 82 / .7}) scale(${1 / .7})`
</script>
