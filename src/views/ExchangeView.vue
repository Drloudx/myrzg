<template>
  <div class="page-view-container exchange-page">

    <!-- 筛选区（半透明羊皮纸面板） -->
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索兑换名称、描述..." />
      </template>

      <UiFilterRow class="exchange-filter-row" label="分类：">
        <UiFilterPill
          v-for="category in categories"
          :key="category.key"
          :active="selectedCat === category.key"
          @click="selectedCat = category.key"
        >{{ category.label }}</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow v-if="showSubFilter" class="exchange-filter-row" label="子类：">
        <UiFilterPill
          v-for="sub in currentSubs"
          :key="sub.key"
          :active="!showRefreshRules && selectedSub === sub.key"
          @click="selectedSub = sub.key; selectedView = 'items'"
        >{{ sub.label }}</UiFilterPill>
        <UiFilterPill v-if="hasRefreshRules" :active="showRefreshRules" @click="selectedView = 'rules'">刷新规则</UiFilterPill>
      </UiFilterRow>

      <UiFilterRow v-if="rarityOptions.length" class="exchange-filter-row" label="稀有度：">
        <UiFilterPill
          v-for="option in rarityOptions"
          :key="option.value"
          :active="!showRefreshRules && selectedRarity === option.value"
          @click="selectedRarity = option.value; selectedView = 'items'"
        >{{ option.label }}</UiFilterPill>
        <UiFilterPill :active="showRefreshRules" @click="selectedView = 'rules'">刷新规则</UiFilterPill>
      </UiFilterRow>

      <p v-if="currentSummary && !hasRefreshRules" class="exchange-summary">{{ currentSummary }}</p>

      <div v-if="!showRefreshRules" class="collection-counter">
        共 <span class="count-num">{{ filteredExchanges.length }}</span> 条兑换
      </div>
    </UiFilterPanel>

    <!-- 加载 / 错误 -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配兑换数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />

    <div v-else-if="showRefreshRules" id="exchangeScroll" class="exchange-rules paper-panel" data-main-scroll>
      <UiSection :title="`${currentCategory.label}刷新规则`">
        <p class="exchange-rules__summary">{{ currentSummary }}</p>
      </UiSection>
      <UiSection title="商品规则与解锁条件">
        <UiListRow v-for="group in refreshRuleGroups" :key="group.text">
          <div class="exchange-rules__group">
            <p class="exchange-rules__text">{{ group.text }}</p>
            <p class="exchange-rules__names">{{ group.names.join('、') }}</p>
          </div>
        </UiListRow>
      </UiSection>
    </div>

    <!-- 兑换列表（滚动容器 id 供回到顶部定位，懒加载每批 60 项） -->
    <UiCardGrid v-else id="exchangeScroll">
      <div class="exchange-list" :class="{
        'exchange-list--pack': selectedCat === 'pack',
        'exchange-list--shop': selectedCat === 'shop' && !displayedExchanges.some(ex => ex.skin),
        'exchange-list--skin': displayedExchanges.some(ex => ex.skin)
      }">
        <UiExchangeTrade
          v-for="ex in displayedExchanges"
          :key="ex.id"
          :title="exchangeTitle(ex)"
          :reward-items="ex.rewardItems"
          :consume-items="ex.consumeItems"
          :limit-text="ex.limitText"
          :meta-text="hasRefreshRules ? '' : ex.metaText"
          :pack-image="packImage(ex)"
          :skin="ex.skin"
          :shop="selectedCat === 'shop' && !ex.skin"
          :compact="selectedCat !== 'shop' && selectedCat !== 'pack'"
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
import { isBlacklisted } from '../config/blacklist.js'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiExchangeTrade,
  UiFilterPill,
  UiFilterRow,
  UiListRow,
  UiSection,
  UiFilterPanel, UiSearchInput
} from '../components/ui/index.js'

const route = useRoute()
const router = useRouter()

const categories = ref([])
const currentSubs = ref([])
const isDataReady = ref(false)
const errorMessage = ref('')

/**
 * 子类筛选只在**确实有多个子类可选**时才显示。
 * 只有单一子类时（如「神匠之塔兑换」只有塔1、「符石合成」只有 Gem、「PVP兑换」只有 s1、
 * 「通用兑换」只有「无」），筛选行是死按钮、子类名又常是内部代号，没有信息量。
 * `syncSubs` 会自动把 selectedSub 指向唯一子类，故隐藏筛选不影响列表内容。
 * 同时保留原先按分类隐藏的 tuzi / huoyue。
 */
const showSubFilter = computed(() =>
  currentSubs.value.length > 1 && !['tuzi', 'huoyue'].includes(selectedCat.value))

// 保留旧皮肤购买分享链接，同时迁移为商城的时装子类。
const categoryFromQuery = query => query.cat === 'fashion' ? 'shop' : query.cat
const subFromQuery = query => query.sub || (query.cat === 'fashion' ? 'fuZhuang' : null)
const selectedCat = ref(categoryFromQuery(route.query) || '')
const selectedSub = ref(subFromQuery(route.query))
const selectedRarity = ref(route.query.rarity || 'all')
const searchQuery = ref(route.query.q || '')
const selectedView = ref(route.query.view === 'rules' ? 'rules' : 'items')

const handleImgError = (e) => {
  e.target.style.opacity = '0.25'
}

const exchangeTitle = (exchange) => {
  // 游戏商城直接使用兑换名称，包含“银币×2000”等实际获得数量。
  if (selectedCat.value === 'shop' && !exchange?.skin && exchange?.name?.trim()) return exchange.name.trim()
  if (exchange?.displayName) return exchange.displayName
  const firstReward = exchange?.rewardItems?.[0]
  const baseName = firstReward?.name || exchange?.name?.trim() || exchange?.des || exchange?.id || '兑换物品'
  return baseName
}

const packImage = (exchange) => {
  if (currentCategory.value?.key !== 'pack' || exchange?.team !== 'pack') return ''
  return getImageUrl(`/images/PackPane/shop_goods_${exchange.id}.webp`)
}

onMounted(async () => {
  try {
    if (route.query.cat === 'fashion') {
      await router.replace({ query: { ...route.query, cat: 'shop', sub: subFromQuery(route.query) } })
    }
    const data = await fetchWithFallback('data/parsed/parsed-exchange.json')
    // Rune recipes now have their own catalog; also exclude them from older cached payloads.
    categories.value = (data || []).filter(category => category.key !== 'gem')
    if (categories.value.length) {
      selectedCat.value = categories.value.some(category => category.key === selectedCat.value)
        ? selectedCat.value : categories.value[0].key
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

const currentSub = computed(() => currentSubs.value.find(sub => sub.key === selectedSub.value) || null)

const rarityOptions = computed(() => {
  if (selectedCat.value !== 'tuzi' || !currentSub.value) return []
  const present = new Set(currentSub.value.list.map(item => item.rarity).filter(Boolean))
  return [
    { value: 'all', label: '全部候选' },
    ...['紫', '蓝', '绿', '白'].filter(rarity => present.has(rarity)).map(rarity => ({ value: rarity, label: rarity }))
  ]
})

const currentSummary = computed(() => currentSub.value?.summary || currentCategory.value?.summary || '')
const hasRefreshRules = computed(() => ['seed', 'tuzi'].includes(selectedCat.value))
const showRefreshRules = computed(() => hasRefreshRules.value && selectedView.value === 'rules')
const refreshRuleGroups = computed(() => {
  if (!hasRefreshRules.value) return []
  // Use the complete candidate list, so selecting a pool never hides its unlock rules.
  const entries = currentCategory.value?.subs.find(sub => sub.key === 'all')?.list || []
  const groups = new Map()
  for (const entry of entries) {
    if (!entry.metaText) continue
    if (!groups.has(entry.metaText)) groups.set(entry.metaText, new Set())
    for (const item of entry.rewardItems) groups.get(entry.metaText).add(item.name)
  }
  return [...groups].map(([text, names]) => ({ text, names: [...names] }))
})

const syncSubs = () => {
  const cat = currentCategory.value
  if (cat && cat.subs && cat.subs.length) {
    // **子类也要过黑名单**：否则被隐藏的地区（如黑森林/霜烬平原）仍作为筛选按钮出现，
    // 点进去是空列表（条目本身会被 filteredExchanges 过滤掉）——按钮与内容不一致。
    const subs = cat.subs.filter(sub => !isBlacklisted(sub.label) && !isBlacklisted(sub.key))
    currentSubs.value = subs
    if (!selectedSub.value || !subs.some(s => s.key === selectedSub.value)) {
      selectedSub.value = subs[0] ? subs[0].key : null
    }
  } else {
    currentSubs.value = []
    selectedSub.value = null
  }
}

watch(selectedCat, () => {
  const isRouteNavigation = categoryFromQuery(route.query) === selectedCat.value
  selectedSub.value = isRouteNavigation ? subFromQuery(route.query) : null
  selectedRarity.value = isRouteNavigation ? (route.query.rarity || 'all') : 'all'
  selectedView.value = isRouteNavigation && route.query.view === 'rules' ? 'rules' : 'items'
  syncSubs()
})

watch(
  () => [route.query.cat, route.query.sub, route.query.rarity, route.query.q, route.query.view],
  ([cat, sub, rarity, query, view]) => {
    if (!isDataReady.value) return
    if (cat === 'fashion') {
      router.replace({ query: { ...route.query, cat: 'shop', sub: subFromQuery(route.query) } })
    }
    sub = subFromQuery({ cat, sub })
    cat = categoryFromQuery({ cat })
    searchQuery.value = query || ''
    selectedView.value = view === 'rules' ? 'rules' : 'items'
    const targetCategory = categories.value.some(category => category.key === cat) ? cat : categories.value[0]?.key
    if (targetCategory && selectedCat.value !== targetCategory) {
      selectedCat.value = targetCategory
    }
    syncSubs()
    if (sub && currentSubs.value.some(option => option.key === sub)) selectedSub.value = sub
    else if (!currentSubs.value.some(option => option.key === selectedSub.value)) syncSubs()
    selectedRarity.value = rarityOptions.value.some(option => option.value === rarity) ? rarity : 'all'
  }
)

watch(selectedSub, () => {
  if (selectedCat.value === 'tuzi' && !rarityOptions.value.some(option => option.value === selectedRarity.value)) {
    selectedRarity.value = 'all'
  }
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
  // 黑名单：兑换条目本身（名称/描述/奖励物名称/消耗物名称）命中即隐藏。
  // 之前本页完全没过黑名单，导致【未使用】类物品、黑森林纪念币等照常显示。
  list = list.filter(ex => {
    if (isBlacklisted({ id: ex.id, name: ex.name, desc: ex.des })) return false
    const hitReward = (ex.rewardItems || []).some(it => isBlacklisted({ id: it.typeId, name: it.name }))
    const hitConsume = (ex.consumeItems || []).some(it => isBlacklisted({ id: it.typeId, name: it.name }))
    return !hitReward && !hitConsume
  })
  if (selectedCat.value === 'tuzi' && selectedRarity.value !== 'all') {
    list = list.filter(exchange => exchange.rarity === selectedRarity.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(ex => {
      const matchDes = (ex.des || '').toLowerCase().includes(q)
      const matchName = (ex.name || '').toLowerCase().includes(q)
      const matchId = ex.id.toLowerCase().includes(q)
      const matchConsume = ex.consumeItems.some(it => it.name.toLowerCase().includes(q))
      const matchReward = ex.rewardItems.some(it => it.name.toLowerCase().includes(q))
      const matchSkin = [ex.skin?.heroName, ex.skin?.name].some(value => value?.toLowerCase().includes(q))
      return matchDes || matchName || matchId || matchConsume || matchReward || matchSkin
    })
  }
  return list
})

const { displayedItems: displayedExchanges } = useLazyList(filteredExchanges, 20, '#exchangeScroll')

watch([selectedCat, selectedSub, selectedRarity, searchQuery, selectedView], () => {
  const query = { ...route.query }
  for (const key of ['cat', 'sub', 'rarity', 'q', 'view']) delete query[key]
  if (selectedCat.value) query.cat = selectedCat.value
  if (selectedSub.value) query.sub = selectedSub.value
  if (selectedCat.value === 'tuzi' && selectedRarity.value !== 'all') query.rarity = selectedRarity.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (showRefreshRules.value) query.view = 'rules'
  router.replace({ query })
})

const goToItem = (typeId) => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}
</script>

<style scoped>
.exchange-filter-row { align-items: flex-start; }
.exchange-filter-row :deep(.ui-filter-row__label) { padding-top: 7px; }
/* 筛选面板：布局继承全局 theme.css .filter-panel，面板底色/描边/间距由全局 .paper-panel 与主题变量提供 */

/* 一级分类下拉（形状走主题变量） */
.cat-select-wrap {
  position: relative;
  width: 100%;
}
.cat-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 38px;
  padding: 4px 40px 4px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  background: var(--input-bg);
  color: var(--input-text);
  box-sizing: border-box;
  font-family: var(--font-ui);
}
.cat-select:focus {
  outline: none;
  border-color: var(--input-border-focus);
}
.cat-select-arrow {
  position: absolute;
  top: 50%;
  right: 15px;
  width: 7px;
  height: 7px;
  border-right: 2px solid var(--input-text);
  border-bottom: 2px solid var(--input-text);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}

.sub-tabs-row { width: 100%; }

.exchange-summary {
  margin: 0;
  padding-left: 9px;
  color: var(--text-muted);
  border-left: 3px solid var(--accent-bright);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
}

.exchange-rules {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding: 12px 14px;
  box-sizing: border-box;
  overflow-y: auto;
}
.exchange-rules :deep(.ui-list-row + .ui-list-row) { margin-top: 8px; }
.exchange-rules__summary,
.exchange-rules__text,
.exchange-rules__names {
  margin: 0;
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.exchange-rules__text { font-weight: 700; }
.exchange-rules__names {
  margin-top: 4px;
  color: var(--text-muted);
}
.exchange-rules__group { min-width: 0; }

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
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 14px 10px;
  min-width: 0;
}

/* 礼包卡片需要足够横向空间，避免左侧礼包图与右侧物品清单互相挤压。 */
.exchange-list--pack {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.exchange-list--skin {
  grid-template-columns: repeat(2, minmax(0, 160px));
  justify-content: start;
  gap: 20px;
}

.exchange-list--shop {
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 14px 10px;
}

@media (max-width: 640px) {
  .exchange-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px 6px;
  }
  .exchange-list--pack {
    grid-template-columns: minmax(0, 1fr);
  }
  .exchange-list--skin {
    grid-template-columns: repeat(2, minmax(0, 160px));
    gap: 10px;
  }
  .exchange-list--shop {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px 6px;
  }
}

</style>
