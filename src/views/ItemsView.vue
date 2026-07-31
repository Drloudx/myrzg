<template>
  <div class="items-view">
    <div class="filter-header">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <img :src="getImageUrl('/ui/search.svg')" class="search-icon" alt="搜索" />
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索物品名称、描述..." 
          class="search-input"
        />
      </div>

      <!-- 级联大类 -->
      <div class="filter-row">
        <span class="filter-label">大类：</span>
        <div class="filter-options">
          <button 
            class="filter-btn" 
            :class="{ active: selectedMain === null }"
            @click="selectMain(null)"
          >全部</button>
          <button 
            v-for="cat in categoryTree" 
            :key="cat.type"
            class="filter-btn" 
            :class="{ active: selectedMain === cat.type }"
            @click="selectMain(cat.type)"
          >{{ cat.name }}</button>
        </div>
      </div>

      <!-- 级联中类 -->
      <div v-if="subCategoryTree.length > 0" class="filter-row">
        <span class="filter-label">中类：</span>
        <div class="filter-options">
          <button 
            class="filter-btn" 
            :class="{ active: selectedSub === null }"
            @click="selectSub(null)"
          >全部</button>
          <button 
            v-for="sub in subCategoryTree" 
            :key="sub.type"
            class="filter-btn" 
            :class="{ active: selectedSub === sub.type }"
            @click="selectSub(sub.type)"
          >{{ sub.name }}</button>
        </div>
      </div>

      <!-- 级联小类 -->
      <div v-if="miniCategoryTree.length > 0" class="filter-row">
        <span class="filter-label">小类：</span>
        <div class="filter-options">
          <button 
            class="filter-btn" 
            :class="{ active: selectedMini === null }"
            @click="selectMini(null)"
          >全部</button>
          <button 
            v-for="mini in miniCategoryTree" 
            :key="mini.type"
            class="filter-btn" 
            :class="{ active: selectedMini === mini.type }"
            @click="selectMini(mini.type)"
          >{{ mini.name }}</button>
        </div>
      </div>

      <!-- 稀有度 -->
      <div class="filter-row">
        <span class="filter-label">稀有度：</span>
        <div class="filter-options">
          <button 
            class="filter-btn" 
            :class="{ active: selectedRarity === null }"
            @click="selectedRarity = null"
          >全部</button>
          <button 
            v-for="r in [1, 2, 3, 4, 5]" 
            :key="r"
            class="filter-btn" 
            :class="`quality-text-${r} ${selectedRarity === r ? 'active' : ''}`"
            @click="selectedRarity = r"
          >{{ getRarityName(r) }}</button>
        </div>
      </div>
    </div>

    <!-- 列表区 -->
    <div class="items-grid" id="itemsGridScroll" v-if="isDataReady">
      <div 
        v-for="item in filteredItems" 
        :key="item.typeId"
        class="item-card"
        :class="`quality-bg-${item.quality}`"
        @click="handleItemClick(item)"
      >
        <div class="item-icon-wrapper">
          <img 
            :src="getImageUrl(getItemImageUrl(item))" 
            :alt="item.name"
            class="item-icon"
            loading="lazy"
            @error="handleImgError"
          />
        </div>
        <div class="item-name" :class="`quality-text-${item.quality}`">
          {{ item.name }}
        </div>
      </div>
      <div v-if="filteredItems.length === 0" class="empty-state">
        无匹配物品
      </div>
    </div>
    <div v-else class="loading-state">
      数据加载中...
    </div>
    <BackToTop scroll-container="#itemsGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { fetchItemData, getItemImageUrl } from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { openItemDetail } from '../utils/itemModalState'
import { isBlacklisted } from '../config/blacklist.js'
import BackToTop from '../components/BackToTop.vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const allItems = ref([])
const categoryTree = ref([])
const lanDict = ref({})
const isDataReady = ref(false)

const searchQuery = ref('')
const selectedMain = ref(null)
const selectedSub = ref(null)
const selectedMini = ref(null)
const selectedRarity = ref(null)

onMounted(async () => {
  const data = await fetchItemData()
  allItems.value = data.items
  categoryTree.value = data.categoryTree
  lanDict.value = data.lanDict
  isDataReady.value = true
  
  // 处理全局 URL 唤起
  if (route.query.itemId && categoryTree.value.length) {
    const targetItem = allItems.value.find(i => i.typeId === route.query.itemId)
    if (targetItem) {
      openItemDetail(targetItem, categoryTree.value)
    }
  }
})

// 监听级联切换重置下级
const selectMain = (val) => {
  selectedMain.value = val
  selectedSub.value = null
  selectedMini.value = null
}

const selectSub = (val) => {
  selectedSub.value = val
  selectedMini.value = null
}

const selectMini = (val) => {
  selectedMini.value = val
}

const subCategoryTree = computed(() => {
  if (selectedMain.value === null) return []
  const mainNode = categoryTree.value.find(c => String(c.type) === String(selectedMain.value))
  return mainNode?.info || []
})

const miniCategoryTree = computed(() => {
  if (selectedSub.value === null) return []
  const subNode = subCategoryTree.value.find(c => String(c.type) === String(selectedSub.value))
  return subNode?.info || []
})

const getRarityName = (r) => {
  const map = { 1: '普通', 2: '优秀', 3: '稀有', 4: '史诗', 5: '传说' }
  return map[r]
}

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

const filteredItems = computed(() => {
  if (!isDataReady.value) return []
  return allItems.value.filter(item => {
    // 黑名单过滤
    if (isBlacklisted(item)) return false

    // 开发者调试开关：隐藏没有图标的物品（img 字段为空）
    // 如果需要开启此功能，取消下面一行的注释即可
    if (!item.img) return false

    // 搜索过滤
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchName = item.name && item.name.toLowerCase().includes(q)
      const matchDesc = item.desc && item.desc.toLowerCase().includes(q)
      const matchId = item.typeId && item.typeId.toLowerCase().includes(q)
      if (!matchName && !matchDesc && !matchId) return false
    }

    // 稀有度过滤
    if (selectedRarity.value !== null && item.quality !== selectedRarity.value) {
      return false
    }

    // 分类过滤
    if (selectedMain.value !== null) {
      if (!item.category || String(item.category[0]) !== String(selectedMain.value)) return false
      
      if (selectedSub.value !== null) {
        if (String(item.category[1]) !== String(selectedSub.value)) return false
        
        if (selectedMini.value !== null) {
          if (String(item.category[2]) !== String(selectedMini.value)) return false
        }
      }
    }

    return true
  }).sort((a, b) => {
    // 1. 大类 (Category 0)
    const cat0A = a.category && a.category[0] ? Number(a.category[0]) : 0
    const cat0B = b.category && b.category[0] ? Number(b.category[0]) : 0
    if (cat0A !== cat0B) return cat0A - cat0B

    // 2. 中类 (Category 1)
    const cat1A = a.category && a.category[1] ? Number(a.category[1]) : 0
    const cat1B = b.category && b.category[1] ? Number(b.category[1]) : 0
    if (cat1A !== cat1B) return cat1A - cat1B

    // 3. 小类 (Category 2)
    const cat2A = a.category && a.category[2] ? Number(a.category[2]) : 0
    const cat2B = b.category && b.category[2] ? Number(b.category[2]) : 0
    if (cat2A !== cat2B) return cat2A - cat2B

    // 4. 品质 (Quality) - 从高到低
    const qualA = a.quality || 0
    const qualB = b.quality || 0
    if (qualA !== qualB) return qualB - qualA

    // 5. ID (typeId)
    const idA = a.typeId || ''
    const idB = b.typeId || ''
    return idA.localeCompare(idB)
  })
})

const handleItemClick = (item) => {
  // Update URL to trigger App.vue watcher and open modal, keeping it in sync
  router.push({ query: { ...route.query, itemId: item.typeId } })
}
</script>

<style scoped>
.items-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color, #f5f6f8);
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
  font-size: 13px;
}

.filter-label {
  color: #666;
  white-space: nowrap;
  padding-top: 4px;
  width: 52px;
  flex-shrink: 0;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.filter-btn {
  background: transparent;
  border: none;
  padding: 4px 10px;
  border-radius: 12px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}

.filter-btn.active {
  background: #eef4fc;
  color: #3b82f6;
  font-weight: bold;
}

.items-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 12px;
  align-content: flex-start;
}

.item-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.1s;
  text-align: center;
}

.item-card:active {
  transform: scale(0.95);
}

.item-icon-wrapper {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: rgba(255,255,255,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 6px;
}

.item-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
}

.item-name {
  font-size: 11px;
  line-height: 1.2;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 视觉品质映射 */
.quality-bg-1 { background: rgba(240, 240, 240, 0.85); }
.quality-bg-2 { background: rgba(230, 245, 230, 0.85); }
.quality-bg-3 { background: rgba(220, 240, 255, 0.85); }
.quality-bg-4 { background: rgba(240, 220, 255, 0.85); }
.quality-bg-5 { background: rgba(255, 240, 220, 0.85); }

.quality-text-1 { color: #666; }
.quality-text-2 { color: #2b8a2b; }
.quality-text-3 { color: #1a6da1; }
.quality-text-4 { color: #8b2bba; }
.quality-text-5 { color: #bd6a15; }

/* 针对过滤器单独修正 active 色 */
.filter-btn.quality-text-1.active { background: #f0f0f0; }
.filter-btn.quality-text-2.active { background: #e6f5e6; }
.filter-btn.quality-text-3.active { background: #dcf0ff; }
.filter-btn.quality-text-4.active { background: #f0dcff; }
.filter-btn.quality-text-5.active { background: #fff0dc; }

.empty-state, .loading-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}
</style>
