<template>
  <div class="page-view-container exchange-page">

    <!-- 筛选区（半透明羊皮纸面板） -->
    <div class="filter-panel paper-panel">
      <!-- 一级分类：下拉菜单（业务结构，形状走主题变量） -->
      <select v-model="selectedCat" class="cat-select">
        <option v-for="cat in categories" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
      </select>

      <!-- 二级子分类：分段页签 -->
      <div class="sub-tabs-row" v-if="currentSubs.length > 1">
        <UiSegmentedTabs
          v-model="selectedSub"
          :options="currentSubs.map(sub => ({ value: sub.key, label: sub.label }))"
        />
      </div>

      <UiSearchInput v-model="searchQuery" placeholder="搜索兑换名称、描述..." />

      <div class="collection-counter">
        共 <span class="count-num">{{ filteredExchanges.length }}</span> 条兑换
      </div>
    </div>

    <!-- 加载 / 错误 -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配兑换数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />

    <!-- 兑换列表（滚动容器 id 供回到顶部定位，懒加载每批 60 项） -->
    <UiCardGrid v-else id="exchangeScroll">
      <div class="exchange-list" :class="{
        'exchange-list--equipment': selectedCat === 'baodi',
        'exchange-list--pack': selectedCat === 'pack'
      }">
        <UiExchangeTrade
          v-for="ex in displayedExchanges"
          :key="ex.id"
          :title="exchangeTitle(ex)"
          :reward-items="ex.rewardItems"
          :consume-items="ex.consumeItems"
          :limit-text="ex.limitText"
          :pack-image="packImage(ex)"
          @item-click="goToItem"
        />

        <UiEmptyState v-if="filteredExchanges.length === 0" text="未找到符合条件的兑换" />
      </div>
    </UiCardGrid>

    <UiBackToTop scroll-container="#exchangeScroll" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env'
import { useLazyList } from '../composables/useLazyList'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiExchangeTrade,
  UiSearchInput,
  UiSegmentedTabs
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const categories = ref([])
const currentSubs = ref([])
const isDataReady = ref(false)
const errorMessage = ref('')

const selectedCat = ref(route.query.cat || '')
const selectedSub = ref(route.query.sub || null)
const searchQuery = ref(route.query.q || '')

const handleImgError = (e) => {
  e.target.style.opacity = '0.25'
}

const exchangeTitle = (exchange) => {
  const firstReward = exchange?.rewardItems?.[0]
  const baseName = firstReward?.name || exchange?.name?.trim() || exchange?.des || exchange?.id || '兑换物品'
  return baseName
}

const packImage = (exchange) => {
  if (currentCategory.value?.key !== 'pack' || exchange?.team !== 'pack') return ''
  return getImageUrl(`/images/PackPane/shop_goods_${exchange.id}.png`)
}

onMounted(async () => {
  try {
    const data = await fetchWithFallback('data/parsed/parsed-exchange.json')
    categories.value = data || []
    if (categories.value.length) {
      selectedCat.value = selectedCat.value || categories.value[0].key
      syncSubs()
    }
    isDataReady.value = true
  } catch (err) {
    console.error('加载兑换数据失败:', err)
    errorMessage.value = '加载失败：' + (err && err.message ? err.message : err)
    isDataReady.value = true
  }
})

const currentCategory = computed(() => categories.value.find(c => c.key === selectedCat.value) || null)

const syncSubs = () => {
  const cat = currentCategory.value
  if (cat && cat.subs && cat.subs.length) {
    currentSubs.value = cat.subs
    if (!selectedSub.value || !cat.subs.some(s => s.key === selectedSub.value)) {
      selectedSub.value = cat.subs[0] ? cat.subs[0].key : null
    }
  } else {
    currentSubs.value = []
    selectedSub.value = null
  }
}

watch(selectedCat, () => {
  selectedSub.value = null
  syncSubs()
})

const filteredExchanges = computed(() => {
  const cat = currentCategory.value
  if (!cat) return []
  let list = []
  if (selectedSub.value) {
    const sub = cat.subs.find(s => s.key === selectedSub.value)
    list = sub ? sub.list : []
  } else {
    for (const s of cat.subs) list = list.concat(s.list)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(ex => {
      const matchDes = (ex.des || '').toLowerCase().includes(q)
      const matchName = (ex.name || '').toLowerCase().includes(q)
      const matchId = ex.id.toLowerCase().includes(q)
      const matchConsume = ex.consumeItems.some(it => it.name.toLowerCase().includes(q))
      const matchReward = ex.rewardItems.some(it => it.name.toLowerCase().includes(q))
      return matchDes || matchName || matchId || matchConsume || matchReward
    })
  }
  return list
})

const { displayedItems: displayedExchanges } = useLazyList(filteredExchanges, 20, '#exchangeScroll')

watch([selectedCat, selectedSub, searchQuery], () => {
  const query = {}
  if (selectedCat.value) query.cat = selectedCat.value
  if (selectedSub.value) query.sub = selectedSub.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  router.replace({ query })
})

const goToItem = (typeId) => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}
</script>

<style scoped>
/* 筛选面板：布局微调，面板底色/描边/间距由全局 .paper-panel 与主题变量提供 */
.filter-panel {
  margin: 0 0 12px 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

/* 一级分类下拉（形状走主题变量） */
.cat-select {
  width: 100%;
  height: 38px;
  padding: 4px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  background: var(--input-bg);
  color: var(--input-text);
  box-sizing: border-box;
  font-family: 'HarmonyOS', 'Microsoft YaHei', 'MYR2Sans', sans-serif;
}
.cat-select:focus {
  outline: none;
  border-color: var(--input-border-focus);
}

.sub-tabs-row { width: 100%; }

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 兑换列表：每条记录独立卡片，多列网格排列 */
.exchange-list {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  min-width: 0;
}

.exchange-list--equipment {
  /* 装备消耗最多 4 个材料，预留四行材料芯片，避免溢出到下一行。 */
  grid-auto-rows: 350px;
}

.exchange-list--equipment :deep(.ui-exchange-trade__reward-stage) {
  flex: 0 0 88px;
  height: 88px;
  align-items: flex-start;
  padding-top: 10px;
}

.exchange-list--equipment :deep(.ui-exchange-trade__consume-footer) {
  min-height: 150px;
  align-items: flex-start;
}

/* 礼包卡片需要足够横向空间，避免左侧礼包图与右侧物品清单互相挤压。 */
.exchange-list--pack {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

@media (max-width: 640px) {
  .exchange-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .exchange-list--equipment {
    grid-auto-rows: 360px;
  }
  .exchange-list--equipment :deep(.ui-exchange-trade__consume-footer) {
    min-height: 150px;
  }
  .exchange-list--pack {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
