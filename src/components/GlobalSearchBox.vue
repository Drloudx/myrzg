<template>
  <div class="global-search-container" :class="containerClass">
    <div class="global-search-box">
      <svg class="search-icon-img" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"></circle>
        <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
      </svg>
      <input
        type="text"
        v-model="query"
        @focus="handleFocus"
        placeholder="搜索名称、属性或描述..."
        class="global-search-input"
      />
      <button v-if="query" class="clear-btn" @click="query = ''">✕</button>
    </div>

    <!-- 快捷搜索结果下拉 -->
    <div v-if="isSearchOpen && query.trim()" class="global-search-dropdown paper-panel">
      <div v-if="results.length === 0" class="search-empty">
        未找到“{{ query }}”的相关结果
      </div>
      <div v-else class="search-result-list">
        <div
          v-for="item in results.slice(0, 15)"
          :key="`${item.type}-${item.id}`"
          class="search-result-item"
          @click="handleSelect(item)"
        >
          <span class="item-type-badge" :class="item.type">
            {{ typeLabel(item.type) }}
          </span>
          <span class="item-name" :class="`quality-text-${item.quality}`">{{ item.name }}</span>
          <div class="item-tags-flex" v-if="item.categoryTags && item.categoryTags.length">
            <span v-for="tag in item.categoryTags" :key="tag" class="category-tag-pill">{{ tag }}</span>
          </div>
          <span v-else class="item-tag">{{ subTagLabel(item) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  containerClass: {
    type: String,
    default: ''
  },
  modelValue: {
    type: String,
    default: ''
  },
  isSearchOpen: {
    type: Boolean,
    default: false
  },
  results: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'focus', 'select'])

const query = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const handleFocus = () => emit('focus')
const handleSelect = (item) => emit('select', item)

const typeLabel = (type) => {
  const map = {
    role: '角色',
    equip: '装备',
    achievement: '成就',
    recipe: '料理',
    item: '物品',
    pet: '魔物',
    pet_egg: '魔物蛋',
    monster: '怪物',
    task: '任务',
    event: '事件',
    explore: '探索',
    exchange: '兑换',
    hidden: '隐藏'
  }
  return map[type] || '未知'
}

const subTagLabel = (item) => {
  if (item.type === 'pet') return '魔物'
  if (item.type === 'pet_egg') return '魔物蛋'
  if (item.type === 'achievement') return item.category
  return `${item.category} · ${item.subTag}`
}
</script>

<style scoped>
.global-search-container {
  position: relative;
}

.global-search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon-img {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--paper, #dfceb3);
  pointer-events: none;
  flex-shrink: 0;
  opacity: 0.95;
}

.global-search-input {
  width: 100%;
  height: 36px;
  padding: 6px 32px 6px 38px;
  border: 1px solid var(--border-color, #6b5134);
  border-radius: 4px;
  font-size: 13px;
  background: var(--wood-soft, #463424);
  color: var(--paper, #dfceb3);
  box-sizing: border-box;
  transition: all 0.2s ease;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.35);
}
.global-search-input::placeholder {
  color: rgba(223, 206, 179, 0.65);
  font-style: italic;
}
.global-search-input:focus {
  outline: none;
  border-color: var(--accent-bright, #7a9a99);
  background: #55432f;
}

.clear-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--paper, #dfceb3);
  opacity: 0.85;
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
  border-radius: 3px;
  transition: opacity 0.15s ease;
}
.clear-btn:hover {
  opacity: 1;
}

.global-search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  padding: 6px;
  z-index: 9000;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);
  border-radius: 5px;
}

.search-empty {
  padding: 14px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
  font-style: italic;
}

.search-result-list {
  display: flex;
  flex-direction: column;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  cursor: pointer;
  border-radius: 3px;
  border-bottom: 1px dashed var(--border-faint, rgba(143, 115, 81, 0.25));
  transition: background-color 0.15s ease;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}

.item-type-badge {
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(43, 31, 21, 0.12);
  color: var(--text-muted, #6b5134);
  flex-shrink: 0;
}

.item-type-badge.role { background: rgba(23, 93, 140, 0.15); color: var(--q3); }
.item-type-badge.equip { background: rgba(126, 42, 168, 0.15); color: var(--q4); }
.item-type-badge.item { background: rgba(85, 117, 116, 0.18); color: var(--accent-ink, #557574); }
.item-type-badge.pet, .item-type-badge.pet_egg { background: rgba(176, 97, 12, 0.15); color: var(--q5); }
.item-type-badge.achievement { background: rgba(43, 122, 43, 0.15); color: var(--q2); }
.item-type-badge.recipe { background: rgba(176, 97, 12, 0.18); color: var(--q5); }
.item-type-badge.monster { background: var(--danger-soft, rgba(139, 0, 0, 0.1)); color: var(--danger, #8b0000); }
.item-type-badge.task { background: rgba(43, 122, 43, 0.15); color: var(--q2); }
.item-type-badge.event, .item-type-badge.explore { background: rgba(122, 154, 153, 0.18); color: var(--accent-ink, #557574); }
.item-type-badge.exchange { background: rgba(126, 42, 168, 0.15); color: var(--q4); }
.item-type-badge.hidden { background: rgba(110, 110, 110, 0.16); color: var(--q1); }

.item-name {
  font-size: 14px;
  font-weight: 700;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-tag-pill,
.item-tag {
  color: var(--accent-ink, #557574);
  background: rgba(122, 154, 153, 0.16);
  border: 1px solid rgba(122, 154, 153, 0.4);
  border-radius: 3px;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-tags-flex {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>
