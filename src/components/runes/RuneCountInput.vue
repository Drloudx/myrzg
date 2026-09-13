<template>
  <label class="rune-count-stepper"><span>{{ label }}</span>
    <input type="number" min="1" max="999" step="1" :value="modelValue" @change="commit" @keydown.enter="commit" />
    <span class="rune-count-arrows">
      <button type="button" title="增加次数" aria-label="增加次数" :disabled="modelValue >= 999" @click="emit('update:modelValue', modelValue + 1)"><i class="rune-chevron is-up" /></button>
      <button type="button" title="减少次数" aria-label="减少次数" :disabled="modelValue <= 1" @click="emit('update:modelValue', modelValue - 1)"><i class="rune-chevron" /></button>
    </span>
  </label>
</template>

<script setup>
import { nextTick } from 'vue'

const props = defineProps({ modelValue: { type: Number, required: true }, label: { type: String, default: '次数' } })
const emit = defineEmits(['update:modelValue'])
async function commit(event) {
  const input = event.target
  emit('update:modelValue', Number(input.value))
  await nextTick()
  input.value = String(props.modelValue)
}
</script>

<style scoped>
.rune-count-stepper { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.rune-count-stepper input { width: 54px; height: 34px; padding: 4px; box-sizing: border-box; font: inherit; text-align: center; appearance: textfield; background: var(--input-bg); color: var(--input-text); border: 1px solid var(--input-border); border-radius: 4px; }
.rune-count-stepper input::-webkit-inner-spin-button, .rune-count-stepper input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.rune-count-arrows { display: grid; width: 28px; height: 40px; grid-template-rows: repeat(2, 1fr); }
.rune-count-arrows button { display: flex; justify-content: center; align-items: center; border: 0; background: transparent; cursor: pointer; padding: 0; }
.rune-count-arrows button:disabled { opacity: .3; cursor: default; }
.rune-chevron { display: block; width: 7px; height: 7px; border-right: 2px solid var(--accent-ink); border-bottom: 2px solid var(--accent-ink); transform: translateY(-2px) rotate(45deg); }
.rune-chevron.is-up { transform: translateY(2px) rotate(225deg); }
</style>
