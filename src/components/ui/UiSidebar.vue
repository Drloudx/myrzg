<template>
  <aside class="ui-sidebar sidebar paper-panel">
    <h3>{{ title }}</h3>
    <ul>
      <li v-for="item in items" :key="item.path">
        <a
          :class="{ active: String(active) === String(item.path) }"
          :href="'#' + item.path"
          @click.prevent="$emit('navigate', item.path)"
        >
          <img v-if="item.icon" :src="resolveIcon(item.icon)" class="sidebar-icon game-sprite" alt="" />
          <span>{{ item.name }}</span>
        </a>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { getImageUrl } from '../../utils/env.js'

defineProps({
  title: { type: String, default: '导航目录' },
  items: { type: Array, default: () => [] },
  active: { type: String, default: '' }
})
defineEmits(['navigate'])

const resolveIcon = (icon) => getImageUrl(icon)
</script>

<style scoped>
.sidebar-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 4px;
}
</style>
