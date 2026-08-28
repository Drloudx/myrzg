<template>
  <div class="page-view-container events-page">

    <!-- 筛选区：半透明羊皮纸面板 -->
    <div class="events-filter-panel paper-panel">
      <!-- 顶部页签：随机事件 / 探索区域 -->
      <UiSegmentedTabs
        :model-value="activeTab"
        :options="tabOptions"
        @update:model-value="selectTab"
      />

      <!-- 地图筛选（与其他页面分段标签一致：均分占满，手机端自动适配） -->
      <UiSegmentedTabs
        v-if="mapOptions.length > 1"
        :model-value="filterMap"
        :options="mapOptions"
        @update:model-value="selectMap"
      />

      <!-- 搜索 -->
      <UiSearchInput
        v-model="searchQuery"
        :placeholder="activeTab === 'random' ? '搜索事件名称、描述...' : '搜索探索区域名称、描述...'"
      />

      <!-- 数量计数 -->
      <div class="collection-counter">
        共 <span class="count-num">{{ listCount }}</span> 个{{ activeTab === 'random' ? '事件' : '探索区域' }}
      </div>
    </div>

    <!-- 加载 / 错误 / 列表 -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配事件数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />

    <!-- 列表区（懒加载每批 60 项） -->
    <UiCardGrid v-else id="eventsGridScroll">
      <UiItemCard
        v-for="item in displayedList"
        :key="item.id"
        :img="item.imgUrl"
        :name="item.name"
        :quality="item.quality"
        @click="openDetail(item)"
        @img-error="handleImgError"
      >
        <template #extra>
          <span
            v-if="item.badgeText"
            class="event-quality-badge"
            :class="`quality-badge-${item.quality}`"
          >{{ item.badgeText }}</span>
        </template>
      </UiItemCard>

      <UiEmptyState v-if="filteredList.length === 0" text="未找到符合条件的内容" />
    </UiCardGrid>

    <UiBackToTop scroll-container="#eventsGridScroll" />

    <!-- 详情全屏弹窗（羊皮纸木质标题条 + 内容区滚动） -->
    <UiModal
      v-model:visible="detailVisible"
      :title="selectedItem ? selectedItem.name : ''"
      max-width="820px"
      scroll-id="eventModalScroll"
      :z-index="2000"
      @close="closeDetail"
    >
      <template v-if="selectedItem">
        <!-- 徽标行 -->
        <div class="detail-badges">
          <UiTag v-if="selectedItem.badgeText" :quality="selectedItem.quality">{{ selectedItem.badgeText }}</UiTag>
          <template v-if="activeTab === 'random'">
            <UiTag tone="accent">CD {{ selectedItem.cd }}s</UiTag>
          </template>
          <template v-else>
            <UiTag tone="accent">Lv.{{ selectedItem.level }}</UiTag>
            <UiTag :quality="selectedItem.quality">{{ qualityName(selectedItem.quality) }}</UiTag>
          </template>
        </div>

        <!-- 大图（保留原结构，羊皮纸化） -->
        <UiSection class="event-hero-section">
          <img
            :src="selectedItem.imgUrl"
            :alt="selectedItem.name"
            class="event-hero-img"
            loading="lazy"
            @error="handleImgError"
          />
        </UiSection>

        <!-- 随机事件信息 -->
        <UiSection v-if="activeTab === 'random'" title="事件信息">
          <UiInfoRow label="事件描述" :value="selectedItem.des || '（无描述）'" />
          <UiInfoRow v-if="selectedItem.buttonText" label="交互按钮" :value="selectedItem.buttonText" />
          <UiInfoRow label="出现地图">
            <template v-if="selectedItem.mapNames.length">
              <UiTag v-for="(m, mi) in selectedItem.mapNames" :key="mi" tone="default">{{ m }}</UiTag>
            </template>
            <template v-else>未知</template>
          </UiInfoRow>
          <UiInfoRow v-if="selectedItem.chance > 0" label="刷新概率" :value="`${selectedItem.chance}%`" />
          <UiInfoRow label="冷却时间" :value="`${selectedItem.cd} 秒`" />
        </UiSection>

        <!-- 探索区域信息 -->
        <UiSection v-else title="探索信息">
          <UiInfoRow label="区域描述" :value="selectedItem.des || '（无描述）'" />
          <UiInfoRow label="所属地图" :value="selectedItem.mapName || '未知'" />
          <UiInfoRow label="探索等级" :value="`Lv.${selectedItem.level}`" />
          <UiInfoRow label="耗时" :value="`${selectedItem.timeMinute} 分钟`" />
          <UiInfoRow label="队伍人数" :value="`${selectedItem.maxNum} 人`" />
          <UiInfoRow label="消耗" :value="selectedItem.consumeText || '无'" />
          <UiInfoRow v-if="selectedItem.positions && selectedItem.positions.length" label="探索点位">
            <UiTag v-for="(p, pi) in selectedItem.positions" :key="pi" tone="default">{{ p }}</UiTag>
          </UiInfoRow>
          <UiInfoRow v-if="selectedItem.enemys && selectedItem.enemys.length" label="遭遇敌人">
            <UiTag v-for="(en, ei) in selectedItem.enemys" :key="ei" tone="default">{{ en.name }}</UiTag>
          </UiInfoRow>
        </UiSection>

        <!-- 奖励 -->
        <UiSection :title="activeTab === 'random' ? '事件奖励' : '探索奖励'">
          <div v-if="selectedItem.reward.entries.length" class="reward-list">
            <UiRewardCard
              v-for="(rw, rIdx) in selectedItem.reward.entries"
              :key="rIdx"
              :rule="{
                targetName: rw.name,
                targetImg: getImageUrl(rw.icon),
                targetQuality: 0,
                min: rw.count,
                max: rw.count,
                typeId: rw.typeId
              }"
              @click="goToItem(rw.typeId)"
            />
            <UiTag v-for="(txt, tIdx) in selectedItem.reward.text" :key="'t' + tIdx" tone="gold">{{ txt }}</UiTag>
          </div>
          <p v-else class="no-reward">无</p>
        </UiSection>

        <UiBackToTop scroll-container="#eventModalScroll" />
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiInfoRow,
  UiItemCard,
  UiModal,
  UiRewardCard,
  UiSearchInput,
  UiSection,
  UiSegmentedTabs,
  UiTag
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env'
import { isBlacklisted } from '../config/blacklist.js'
import { getRarityName } from '../utils/gameMappings'
import { buildEventData } from '../utils/eventData.js'
import { useLazyList } from '../composables/useLazyList'

const route = useRoute()
const router = useRouter()

const activeTab = ref(route.query.tab === 'explore' ? 'explore' : 'random')
const tabOptions = [
  { key: 'random', label: '随机事件' },
  { key: 'explore', label: '探索区域' }
]

const events = ref([])     // 随机事件
const explores = ref([])   // 探索区域
const mapNameMap = ref({}) // c1_map -> 秋日荒野
const isDataReady = ref(false)
const errorMessage = ref('')

const filterMap = ref(route.query.map || 'all')
const searchQuery = ref(route.query.q || '')

const detailVisible = ref(false)
const selectedItem = ref(null)

const handleImgError = (e) => {
  e.target.style.opacity = '0.25'
}

// 品质名称统一走 gameMappings.getRarityName（官方体系：普通/稀少/珍贵/罕见/传说）
const qualityName = (q) => getRarityName(q)

// ---------- 筛选选项（全部大地图 c1~c5，黑名单地图是否隐藏由全局 blacklist.js 决定） ----------
const mapOptions = computed(() => {
  const opts = [{ key: 'all', label: '全部' }]
  const order = ['c1_map', 'c2_map', 'c3_map', 'c4_map', 'c5_map']
  for (const k of order) {
    if (mapNameMap.value[k]) {
      opts.push({ key: k, label: mapNameMap.value[k] })
    }
  }
  return opts
})

// ---------- 奖励解析已收敛到 gameMappings.parseRewardEntries（见 eventData.js） ----------

// 消耗道具解析（consume.json: explore001 = 200G）
const CONSUME_MONEY = { explore001: 200, explore002: 400, explore003: 600 }
const consumeText = (consumeId) => {
  const money = CONSUME_MONEY[consumeId]
  return money ? `${money}G` : (consumeId || '')
}

// ---------- 加载 ----------
onMounted(async () => {
  try {
    let built = null

    // 优先读取构建期预解析单文件
    try {
      const data = await fetchWithFallback('data/parsed/events.json')
      built = data
    } catch (e) {
      console.warn('parsed/events.json 不可用，回退到原始多文件加载:', e?.message || e)
    }

    if (!built) {
      const [eventJson, areaJson, rewardJson, itemJson, mapJson, exploreJson, monJson] = await Promise.all([
        fetchWithFallback('data/randomEventInfo.json'),
        fetchWithFallback('data/randomEventArea.json'),
        fetchWithFallback('data/reward.json'),
        fetchWithFallback('data/item.json'),
        fetchWithFallback('data/area.json'),
        fetchWithFallback('data/exploreArea.json'),
        fetchWithFallback('data/mon.json')
      ])
      built = buildEventData({ eventJson, areaJson, rewardJson, itemJson, mapJson, exploreJson, monJson })
    }

    // 大地图名索引（c1_map -> 秋日荒野），供「全部 / 大地图」筛选行使用
    mapNameMap.value = built.mapNameMap || {}

    // 预解析产物存相对路径，运行时统一过 getImageUrl（原生端会加 CDN 前缀）
    events.value = built.events
      .map(ev => ({ ...ev, imgUrl: getImageUrl(ev.imgUrl) }))
      .filter(e => !isBlacklisted({ id: e.id, name: e.name }))

    explores.value = built.explores
      .map(ev => ({ ...ev, imgUrl: getImageUrl(ev.imgUrl) }))
      .filter(e => !isBlacklisted({ id: e.id, name: e.name }))

    isDataReady.value = true

    // ?event=/?explore= 直达详情
    const eventId = route.query.event
    if (eventId) {
      const item = events.value.find(e => e.id === eventId)
      if (item) openDetail(item)
    }
    const exploreId = route.query.explore
    if (exploreId) {
      const item = explores.value.find(e => e.id === exploreId)
      if (item) openDetail(item)
    }
  } catch (err) {
    console.error('加载事件数据失败:', err)
    errorMessage.value = '加载失败：' + (err && err.message ? err.message : err)
    isDataReady.value = true
  }
})

// ---------- 列表与筛选 ----------
const currentList = computed(() => activeTab.value === 'random' ? events.value : explores.value)
const listCount = computed(() => currentList.value.length)

const filteredList = computed(() => {
  return currentList.value.filter(item => {
    if (filterMap.value !== 'all') {
      const maps = item.maps || (item.mapKey ? [item.mapKey] : [])
      if (!maps.includes(filterMap.value)) return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = item.name.toLowerCase().includes(q)
      const matchDes = (item.des || '').toLowerCase().includes(q)
      if (!matchName && !matchDes) return false
    }
    return true
  })
})

const { displayedItems: displayedList } = useLazyList(filteredList, 60, '#eventsGridScroll')

const selectTab = (key) => {
  activeTab.value = key
  filterMap.value = 'all'
  searchQuery.value = ''
}

const selectMap = (key) => {
  filterMap.value = key
}

watch([activeTab, filterMap, searchQuery], () => {
  const query = {}
  if (activeTab.value !== 'random') query.tab = activeTab.value
  if (filterMap.value !== 'all') query.map = filterMap.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (route.query.event) query.event = route.query.event
  if (route.query.explore) query.explore = route.query.explore
  router.replace({ query })
})

// ---------- 详情 ----------
const openDetail = (item) => {
  selectedItem.value = item
  detailVisible.value = true
  const key = activeTab.value === 'random' ? 'event' : 'explore'
  router.replace({ query: { ...route.query, [key]: item.id } })
}

const closeDetail = () => {
  detailVisible.value = false
  selectedItem.value = null
  const q = { ...route.query }
  if (route.query.event) delete q.event
  if (route.query.explore) delete q.explore
  router.replace({ query: q })
}

const goToItem = (typeId) => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}

// 外部修改 event/explore 参数时同步打开/关闭详情
watch(
  () => [route.query.event, route.query.explore, route.query.tab],
  ([eventId, exploreId, tab]) => {
    if (!isDataReady.value) return
    if (eventId && tab !== 'explore') {
      const item = events.value.find(e => e.id === eventId)
      if (item) openDetail(item)
    } else if (exploreId) {
      const item = explores.value.find(e => e.id === exploreId)
      if (item) openDetail(item)
    }
  }
)
</script>

<style scoped>
/* ===== 页面特有布局（通用羊皮纸样式已由 theme.css 与 ui 组件库提供） ===== */

/* 筛选区：半透明 paper-panel 内部排版 */
.events-filter-panel {
  margin: 0 0 12px 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

/* 分段页签在筛选区内均分占满（手机端自动适配） */
.events-filter-panel :deep(.ui-segmented) {
  width: 100%;
}
.events-filter-panel :deep(.ui-segmented__item) {
  flex: 1;
}

.collection-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

/* 事件卡片为横版场景图（页面特有图片尺寸）：16:9 图槽 + 3/2 列网格 */
.events-page :deep(.ui-card-grid) {
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
/* 覆盖 UiItemCard 默认 max-width:86px：事件页用大图卡，撑满列宽 */
.events-page :deep(.ui-item-card) {
  max-width: 100%;
  width: 100%;
}
.events-page :deep(.ui-item-card__slot) {
  aspect-ratio: 16 / 9;
  max-width: 100%;
}
.events-page :deep(.ui-item-card__icon) {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}
@media (max-width: 768px) {
  .events-page :deep(.ui-card-grid) {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

/* 详情弹窗 */
.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 2px;
}
.event-hero-section {
  text-align: center;
}
.event-hero-img {
  width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 8px;
  background: rgba(43, 31, 21, 0.08);
  display: block;
}
.reward-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.no-reward {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== 事件/探索卡片品质角标：左上角 + 同品质文字/浅底 ===== */
.events-page :deep(.ui-item-card__badge) {
  right: auto;
  bottom: auto;
  top: 3px;
  left: 3px;
  z-index: 2;
}
.event-quality-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.5;
  border: 1px solid;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  text-shadow: none;
}
.event-quality-badge.quality-badge-1 { background: var(--quality-label-bg); color: var(--q1-text); border-color: var(--q1); }
.event-quality-badge.quality-badge-2 { background: var(--quality-label-bg); color: var(--q2-text); border-color: var(--q2); }
.event-quality-badge.quality-badge-3 { background: var(--quality-label-bg); color: var(--q3-text); border-color: var(--q3); }
.event-quality-badge.quality-badge-4 { background: var(--quality-label-bg); color: var(--q4-text); border-color: var(--q4); }
.event-quality-badge.quality-badge-5 { background: var(--quality-label-bg); color: var(--q5-text); border-color: var(--q5); }
.event-quality-badge.quality-badge-0 {
  background: var(--quality-label-bg);
  color: var(--text-main);
  border-color: var(--border-soft);
}
/* 事件/探索卡片图槽：不透明羊皮纸底 + 品质色描边，参考实底插画框 */
.events-page :deep(.ui-item-card__slot) {
  background: var(--paper-soft, #e9dcc3);
  border: 2px solid;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 0 14px rgba(135, 107, 72, 0.18);
}
</style>
