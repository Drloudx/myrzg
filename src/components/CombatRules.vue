<template>
  <div class="combat-rules">
    <UiSection v-for="section in filteredSections" :key="section.id" :title="section.title" :data-rule-section="section.id">
      <div class="combat-rules__entries">
        <article v-for="(entry, index) in section.entries" :key="index" class="combat-rules__entry">
          <h4 v-if="entry.title">{{ entry.title }} <span v-if="entry.value">{{ entry.value }}</span></h4>
          <p v-if="entry.text">{{ entry.text }}</p>
          <div v-if="entry.formula" class="combat-rules__formula">
            <p v-for="(line, lineIndex) in entry.formula.split('\n')" :key="lineIndex">{{ line }}</p>
          </div>
          <p v-if="entry.note">{{ entry.note }}</p>
        </article>
      </div>
    </UiSection>
    <UiEmptyState v-if="!filteredSections.length" text="未找到匹配的战斗规则，试试“冷却”“暴击”或“护盾”" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UiSection, UiEmptyState } from './ui/index.js'
import { combatRuleSections } from '../config/combatRules.js'

const props = defineProps({ query: { type: String, default: '' } })
const filteredSections = computed(() => {
  const query = props.query.trim().toLocaleLowerCase()
  if (!query) return combatRuleSections
  return combatRuleSections.map(section => ({
    ...section,
    entries: section.entries.filter(entry =>
      [section.title, ...Object.values(entry)].join(' ').toLocaleLowerCase().includes(query)
    )
  })).filter(section => section.entries.length)
})
</script>

<style scoped>
.combat-rules { width: 100%; min-width: 0; box-sizing: border-box; padding: 12px 14px 14px; background: var(--paper); border: 1px solid var(--border-soft); border-radius: 6px; }
.combat-rules__entries { display: grid; gap: 14px; }
.combat-rules__entry { min-width: 0; overflow-wrap: anywhere; }
.combat-rules__entry h4 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin: 0 0 6px; color: var(--text-main); font-size: 15px; }
.combat-rules__entry h4 span { color: var(--accent-ink); }
.combat-rules__entry p { margin: 6px 0 0; color: var(--text-main); font-size: 14px; line-height: 1.8; }
.combat-rules__formula { margin: 10px 0; font-variant-numeric: tabular-nums; }
.combat-rules__formula p { margin: 0; white-space: pre-wrap; }
</style>
