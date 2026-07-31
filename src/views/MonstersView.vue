<template>
  <div class="items-view">
    <div class="filter-header">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <img :src="getImageUrl('/ui/search.svg')" class="search-icon" alt="搜索" />
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索怪物名称、描述、弱点..." 
          class="search-input"
        />
      </div>

      <!-- 标签筛选 -->
      <div class="filter-row" v-if="allLabels.length > 0">
        <span class="filter-label">大类：</span>
        <div class="filter-options">
          <button 
            class="filter-btn" 
            :class="{ active: selectedLabel === null }"
            @click="selectedLabel = null"
          >全部</button>
          <button 
            v-for="label in allLabels" 
            :key="label"
            class="filter-btn" 
            :class="{ active: selectedLabel === label }"
            @click="selectedLabel = label"
          >{{ label }}</button>
        </div>
      </div>
    </div>

    <!-- 列表区 -->
    <div class="items-grid" id="monstersGridScroll" v-if="isDataReady">
      <div 
        v-for="mon in filteredMonsters" 
        :key="mon.id"
        class="item-card quality-bg-3"
        @click="handleMonsterClick(mon)"
      >
        <div class="item-icon-wrapper">
          <img 
            :src="getImageUrl(`/images/PicHandBookPanel/${mon.icon}.png`)" 
            :alt="mon.name"
            class="item-icon"
            loading="lazy"
            @error="handleImgError"
          />
        </div>
        <div class="item-name quality-text-3">
          {{ mon.name }}
        </div>
        <div class="item-tags" v-if="mon.label">
          <span class="mini-tag tag-type">{{ mon.label }}</span>
        </div>
      </div>
      <div v-if="filteredMonsters.length === 0" class="empty-state">
        无匹配怪物
      </div>
    </div>
    <div v-else-if="errorMessage" class="error-state">
      {{ errorMessage }}
    </div>
    <div v-else class="loading-state">
      数据加载中...
    </div>

    <!-- Monster Detail Modal -->
    <MonsterDetailModal v-model:visible="isModalVisible" />
    
    <BackToTop scroll-container="#monstersGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { fetchMonsterData } from '../utils/monsterParser'
import { getImageUrl } from '../utils/env'
import { useRoute, useRouter } from 'vue-router'
import MonsterDetailModal from '../components/MonsterDetailModal.vue'
import BackToTop from '../components/BackToTop.vue'
import { isBlacklisted } from '../config/blacklist.js'

// We will use a shared modal state or emit events.
// For now, let's assume we use a local ref for the modal or a global store.
// Wait, the plan says we use URL query `?id=xxx` and App.vue handles the modal!
// But wait, App.vue only handles ItemDetailModal right now via `?itemId=xxx`.
// For monsters, the user said "其他独立模块（如成就、菜谱、魔物）：使用 ?id=xxx 作为关键字，由各自对应的路由视图负责监听与定位。"
// So MonstersView.vue should handle its own MonsterDetailModal!

const route = useRoute()
const router = useRouter()

const allMonsters = ref([])
const allLabels = ref([])
const isDataReady = ref(false)
const isModalVisible = ref(false)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedLabel = ref(null)

onMounted(async () => {
  try {
    const data = await fetchMonsterData()
    if (data.length === 0) {
      errorMessage.value = 'fetchMonsterData 返回了空数组 (可能解析异常被捕获)'
    }
    allMonsters.value = data
    
    // Extract unique labels
    const labels = new Set()
    data.forEach(m => {
      if (m.label) labels.add(m.label)
    })
    allLabels.value = Array.from(labels).sort()
    
    isDataReady.value = true
  } catch (err) {
    errorMessage.value = '加载失败: ' + err.message
    console.error(err)
  }
})

watch(() => route.query.id, (newId) => {
  // We can listen to this and pop the modal if needed, but we'll do this in the parent component that holds the modal.
  // Actually, we will put the MonsterDetailModal inside MonstersView.vue!
})

const filteredMonsters = computed(() => {
  if (!isDataReady.value) return []
  
  let result = allMonsters.value.filter(m => !isBlacklisted(m))
  
  // 标签过滤
  if (selectedLabel.value) {
    result = result.filter(m => m.label === selectedLabel.value)
  }
  
  // 搜索过滤
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(m => m.keywords.includes(q))
  }
  
  return result
})

const handleMonsterClick = (mon) => {
  // Push id to url
  router.push({ query: { ...route.query, id: mon.id } })
}

const handleImgError = (e) => {
  e.target.style.display = 'none'
}
</script>

<style scoped>
.items-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.filter-header {
  padding: 12px 16px;
  background: var(--card-bg, #ffffff);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.search-bar {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  filter: var(--icon-filter);
}

.search-input {
  width: 100%;
  height: 36px;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,0.1);
  padding: 0 16px 0 36px;
  font-size: 14px;
  background: rgba(0,0,0,0.02);
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: #a3c4f3;
  background: #fff;
}

.filter-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-sub);
  white-space: nowrap;
  padding-top: 6px;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-btn {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--hover-bg);
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.item-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-radius: 8px;
  background: var(--card-bg);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.item-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.item-icon-wrapper {
  width: 100%;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.item-icon {
  max-width: 64px;
  max-height: 64px;
  object-fit: contain;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-tags {
  margin-top: 6px;
}

.mini-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--primary);
}

.empty-state, .loading-state {
  padding: 40px;
  text-align: center;
  color: var(--text-sub);
  font-size: 14px;
}

/* 适配桌面端宽屏 */
@media (min-width: 768px) {
  .items-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 20px;
  }
}
</style>
