<template>
  <div class="page-view-container chapters-page">

    <!-- 世界地图视图（仅桌面端）：点击地区切章节；不在世界地图上的章节由 extra 插槽补入口 -->
    <ChapterMapCanvas
      v-if="showMap && chapterMap && isDataReady"
      :map="chapterMap"
      :active-id="chapterId"
      :visible-ids="mapVisibleIds"
      :total-stages="visibleStages.length"
      @select="selectChapter"
      @list="openList"
    >
      <template #extra>
        <UiButton
          v-for="chapter in mapExtraChapters"
          :key="chapter.id"
          size="sm"
          variant="secondary"
          @click="selectChapter(chapter.id)"
        >
          {{ chapter.areaName }}
        </UiButton>
      </template>
    </ChapterMapCanvas>

    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配关卡数据..." />
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage">
      <template #action><UiButton @click="loadChapters">重试</UiButton></template>
    </UiEmptyState>

    <!-- 列表视图：与地图是两屏；桌面端搜索框右侧的「进入地图」切回地图（手机端没有地图，不显示） -->
    <template v-else-if="showStageList">
      <UiFilterPanel class="filter-panel paper-panel">
        <template #search>
          <div class="chapters-search-row">
            <UiSearchInput v-model="searchQuery" placeholder="搜索关卡名称、描述、掉落物..." />
            <UiButton v-if="!isMobile" variant="secondary" @click="openMap">进入地图</UiButton>
          </div>
        </template>

        <UiFilterRow label="章节：">
          <UiFilterPill :active="chapterId === 'all'" @click="selectChapter('all')">全部</UiFilterPill>
          <UiFilterPill
            v-for="chapter in visibleChapters"
            :key="chapter.id"
            :active="chapterId === chapter.id"
            @click="selectChapter(chapter.id)"
          >
            {{ chapterLabel(chapter) }}
          </UiFilterPill>
        </UiFilterRow>

        <UiFilterRow label="难度：">
          <UiFilterPill :active="difficultyFilter === 'all'" @click="difficultyFilter = 'all'">全部</UiFilterPill>
          <UiFilterPill
            v-for="label in DIFFICULTY_LABELS"
            :key="label"
            :active="difficultyFilter === label"
            @click="difficultyFilter = label"
          >
            {{ label }}
          </UiFilterPill>

          <template #right>
            <div class="chapters-counter">
              数量：<span class="count-num">{{ filteredStages.length }}</span> / {{ stages.length }}
            </div>
          </template>
        </UiFilterRow>
      </UiFilterPanel>

      <!-- 单列窗口化：与任务图鉴一致，按实际内容测量每张卡片高度 -->
      <UiVirtualGrid
        ref="stageGrid"
        id="chaptersGridScroll"
        class="chapters-card-grid"
        :items="filteredStages"
        :estimate-size="130"
        wide
      >
      <template #default="{ item }">
        <UiListRow
          :key="item.id"
          :data-stage-id="item.id"
          class="stage-list-row"
          clickable
          @click="openStage(item)"
        >
          <div class="stage-card-main">
            <div class="stage-card-no">{{ item.shortName }}</div>
            <div class="stage-card-info">
              <div class="stage-card-name-row">
                <span class="stage-card-name">{{ item.name }}</span>
                <UiTag v-if="chapterId === 'all'" tone="accent">{{ item.chapterName }}</UiTag>
                <UiTag v-for="label in item.difficultyLabels" :key="label" tone="wood">{{ label }}</UiTag>
                <UiTag v-if="item.level" tone="muted">Lv.{{ item.level }}</UiTag>
              </div>
              <div class="stage-card-des">{{ item.des || '（无描述）' }}</div>
            </div>
          </div>

          <template #right>
            <div v-if="item.reward.length" class="stage-card-rewards">
              <div
                v-for="(rw, rIdx) in item.reward.slice(0, 4)"
                :key="rIdx"
                class="stage-card-reward"
                :title="`${rw.name} ×${rw.min}`"
              >
                <img :src="getImageUrl(rw.icon)" :alt="rw.name" class="stage-card-reward-icon" loading="lazy" @error="handleImgError" />
                <span class="stage-card-reward-count">×{{ rw.min }}</span>
              </div>
            </div>
            <span class="stage-card-arrow">›</span>
          </template>
        </UiListRow>
      </template>
      <template #empty><UiEmptyState text="未找到符合条件的关卡" /></template>
      </UiVirtualGrid>

      <UiBackToTop scroll-container="#chaptersGridScroll" />
    </template>

    <UiModal
      v-model:visible="detailVisible"
      :title="detailTitle"
      max-width="1100px"
      scroll-id="chapterStageScroll"
      :z-index="2000"
      @close="closeStage"
    >
      <UiEmptyState v-if="detailLoading" type="loading" text="正在加载关卡详情..." />
      <UiEmptyState v-else-if="detailError" type="error" :text="detailError" />
      <template v-else-if="stageDetail && difficulty">
        <div class="detail-badges">
          <UiTag tone="accent">{{ stageDetail.chapter.areaName }}</UiTag>
          <UiTag tone="wood">{{ stageDetail.chapter.name }}</UiTag>
          <UiTag tone="wood">{{ stageDetail.shortName }}</UiTag>
          <UiTag v-if="difficulty.level" tone="gold">推荐等级 Lv.{{ difficulty.level }}</UiTag>
        </div>

        <UiSegmentedTabs v-model="difficultyIndex" :options="difficultyTabs" class="stage-difficulty-tabs" />

        <UiSection title="关卡信息">
          <UiInfoRow label="关卡" :value="`${stageDetail.shortName} ${stageDetail.name}`" />
          <UiInfoRow label="难度" :value="difficulty.label" />
          <UiInfoRow label="进入消耗">
            <span v-if="difficulty.consumeCost?.ti > 0" class="stage-entry-cost">
              <img :src="getImageUrl(BASE_REWARD_PATHS.ti)" alt="体力" />
              <span>×{{ difficulty.consumeCost.ti }}</span>
            </span>
            <span v-else>无</span>
          </UiInfoRow>
          <UiInfoRow v-if="difficulty.time > 0" label="限时" :value="`${difficulty.time} 秒`" />
          <UiInfoRow v-if="difficulty.unlock" label="解锁条件" :value="difficulty.unlock.text" />
          <UiInfoRow v-if="stageDetail.des" label="关卡描述" :value="stageDetail.des" />
        </UiSection>

        <UiSection v-if="difficulty.firstReward.length" title="首次通关奖励">
          <RewardPools :entries="difficulty.firstReward" @item-click="goToItem" />
        </UiSection>

        <UiSection title="通关掉落" data-source-entry="settlement">
          <RewardPools v-if="difficulty.reward.length" :entries="difficulty.reward" @item-click="goToItem" />
          <p v-else class="stage-empty-reward">暂无可展示的掉落配置</p>
        </UiSection>

        <UiSection v-if="difficulty.rooms.length" title="房间内容与掉落来源">
          <RoomContentList :rooms="difficulty.rooms" @item-click="goToItem" />
        </UiSection>

        <p class="stage-drop-note">房间与掉落取自完整 `battle.json` / `room.json`：怪物按波次列出，采集物与怪物自动掉落按奖励池展示；随机候选房间按配置概率确定，不代表每次必然遭遇。</p>
        <UiBackToTop scroll-container="#chapterStageScroll" />
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiBackToTop,
  UiButton,
  UiEmptyState,
  UiFilterPanel,
  UiFilterPill,
  UiFilterRow,
  UiInfoRow,
  UiListRow,
  UiModal,
  UiSearchInput,
  UiSection,
  UiSegmentedTabs,
  UiTag
} from '../components/ui/index.js'
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'
import ChapterMapCanvas from '../components/chapters/ChapterMapCanvas.vue'
import RewardPools from '../components/RewardPools.vue'
import RoomContentList from '../components/RoomContentList.vue'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { BASE_REWARD_PATHS } from '../utils/gameMappings.js'
import { isBlacklisted } from '../config/blacklist.js'

const DIFFICULTY_LABELS = ['简单', '普通', '困难']

const route = useRoute()
const router = useRouter()

const chapters = shallowRef([])
const chapterMap = ref(null)
const isDataReady = ref(false)
const errorMessage = ref('')
const stageGrid = ref(null)
let loadOperation = 0

const chapterId = ref(route.query.chapter || 'all')
const difficultyFilter = ref(DIFFICULTY_LABELS.includes(route.query.diff) ? route.query.diff : 'all')
const searchQuery = ref(route.query.q || '')

const detailVisible = ref(false)
const stageDetail = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const difficultyIndex = ref(0)
let detailOperation = 0

/** 被黑名单隐藏的地区整章不出现：否则章节按钮还在、里面的关卡被逐条过滤，按钮与内容不一致。 */
const visibleChapters = computed(() => chapters.value.filter(chapter =>
  !isBlacklisted({ id: chapter.id, name: chapter.areaName, label: chapter.name })
))

/** 可见章节的全部关卡（深链定位也走这里：黑名单影响列表、搜索与直接入口）。 */
const visibleStages = computed(() => visibleChapters.value.flatMap(chapter => chapter.stages))

/** 地图上可见的章节 id：被黑名单隐藏的章节不出现，地图上该区域保持底图原样（未探索）。 */
const mapVisibleIds = computed(() => visibleChapters.value.map(chapter => chapter.id))

/**
 * 地图视图与列表视图是两屏，互斥，由显式的 `view` 决定：
 *   - 地图视图（仅桌面端）：整块区域只有地图；点地块或右上角「展开列表」切到列表。
 *   - 列表视图：地图不出现；桌面端搜索框右侧的「进入地图」切回地图。
 * 手机端不出地图（拼块章节名在 390px 下读不清），恒为列表视图。
 */
const MOBILE_QUERY = '(max-width: 767px)'
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)
const view = ref(route.query.view === 'list' || route.query.chapter || route.query.stage ? 'list' : 'map')

const showMap = computed(() => !isMobile.value && view.value === 'map')
const showStageList = computed(() => !showMap.value)

const openList = () => { view.value = 'list' }
const openMap = () => { view.value = 'map' }

/** 不在世界地图上的章节（幽夜古堡、黏滑溪谷）：地图视图里由 extra 插槽给入口，否则无路可进。 */
const mapTileIds = computed(() => new Set((chapterMap.value?.tiles || []).map(tile => tile.id)))
const mapExtraChapters = computed(() => visibleChapters.value.filter(chapter => !mapTileIds.value.has(chapter.id)))

/** 当前章节的关卡；「全部」时带上章节名，便于在卡片上标注归属。 */
const stages = computed(() => {
  if (chapterId.value === 'all') {
    return visibleChapters.value.flatMap(chapter => chapter.stages.map(stage => ({ ...stage, chapterName: chapter.areaName })))
  }
  const chapter = visibleChapters.value.find(item => item.id === chapterId.value)
  return (chapter?.stages || []).map(stage => ({ ...stage, chapterName: chapter.areaName }))
})

const chapterLabel = (chapter) => chapter.chapterNo === null
  ? chapter.areaName
  : `${chapter.chapterNo} ${chapter.areaName}`

const filteredStages = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return stages.value.filter(stage => {
    if (isBlacklisted({ id: stage.id, name: stage.name, desc: stage.des })) return false
    if (difficultyFilter.value !== 'all' && !stage.difficultyLabels.includes(difficultyFilter.value)) return false
    if (!query) return true
    // searchText 由构建期汇总名称、描述、奖励物、怪物与采集物，支持按掉落反查关卡
    return `${stage.name} ${stage.shortName} ${stage.id} ${stage.des} ${stage.searchText || ''}`.toLowerCase().includes(query)
  })
})

const difficultyTabs = computed(() => (stageDetail.value?.difficulties || [])
  .map((item, index) => ({ value: index, label: item.label })))

const difficulty = computed(() => stageDetail.value?.difficulties?.[difficultyIndex.value] || null)
const detailTitle = computed(() => stageDetail.value
  ? `${stageDetail.value.shortName} ${stageDetail.value.name}`
  : '关卡详情')

const handleImgError = handleImageFallback

const selectChapter = (id) => {
  // 换章节后列表内容整体替换，`UiVirtualGrid` 会在 items 变化时自行把列表滚回顶部；
  // 这里不要再调 scrollToItem——它用 align:'center' 会把整页滚动，把上方的地图推出视口。
  chapterId.value = id
  // 选章节即进入列表视图（地图视图里点地块、点章节按钮都是这个入口）
  openList()
}

// ---------- 数据 ----------
const loadChapters = async () => {
  const operation = ++loadOperation
  isDataReady.value = false
  errorMessage.value = ''
  try {
    const data = await fetchWithFallback('data/parsed/chapters.json')
    if (operation !== loadOperation) return
    chapters.value = data.chapters || []
    chapterMap.value = data.map || null
    isDataReady.value = true
    // URL 里带了被黑名单隐藏的章节时退回「全部」，避免停在空列表
    if (chapterId.value !== 'all' && !visibleChapters.value.some(chapter => chapter.id === chapterId.value)) {
      chapterId.value = 'all'
    }
    const requested = route.query.stage
    if (requested) {
      const found = visibleStages.value.find(stage => stage.id === requested)
      if (found) {
        await nextTick()
        await openStage(found, { syncUrl: false })
      }
    }
  } catch (err) {
    if (operation !== loadOperation) return
    console.error('加载关卡数据失败:', err)
    errorMessage.value = '关卡数据加载失败，请重试'
    isDataReady.value = true
  }
}

// ---------- 详情 ----------
const openStage = async (item, { syncUrl = true } = {}) => {
  const operation = ++detailOperation
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = ''
  stageDetail.value = null
  difficultyIndex.value = Math.max(0, DIFFICULTY_LABELS.indexOf(
    DIFFICULTY_LABELS.includes(route.query.diff) ? route.query.diff : difficultyFilter.value
  ))
  if (syncUrl) router.replace({ query: { ...route.query, stage: item.id } })
  try {
    const data = await fetchWithFallback(`data/parsed/${item.detailFile}`)
    if (operation !== detailOperation) return
    stageDetail.value = data
    const requested = DIFFICULTY_LABELS.indexOf(route.query.diff)
    difficultyIndex.value = requested >= 0 && requested < data.difficulties.length ? requested : 0
  } catch (err) {
    if (operation !== detailOperation) return
    console.error('加载关卡详情失败:', err)
    detailError.value = '关卡详情加载失败，请重试'
  } finally {
    if (operation === detailOperation) detailLoading.value = false
  }
}

const closeStage = () => {
  detailOperation += 1
  detailVisible.value = false
  stageDetail.value = null
  detailError.value = ''
  if (route.query.stage) {
    const query = { ...route.query }
    delete query.stage
    delete query.diff
    router.replace({ query })
  }
}

const goToItem = (typeId) => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}

onMounted(loadChapters)
onMounted(() => {
  const query = window.matchMedia(MOBILE_QUERY)
  const sync = () => { isMobile.value = query.matches }
  query.addEventListener('change', sync)
  onBeforeUnmount(() => query.removeEventListener('change', sync))
})
onBeforeUnmount(() => { loadOperation += 1; detailOperation += 1 })

watch([chapterId, difficultyFilter, searchQuery, view], () => {
  const query = {}
  if (chapterId.value !== 'all') query.chapter = chapterId.value
  if (difficultyFilter.value !== 'all') query.diff = difficultyFilter.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  // 列表视图没有章节时也要能分享/刷新回同一屏，所以显式带上 view
  if (view.value === 'list') query.view = 'list'
  if (route.query.stage) query.stage = route.query.stage
  router.replace({ query })
})

// 外部修改 stage 参数（前进/后退、粘贴分享链接）时同步打开或关闭详情
watch(() => route.query.stage, (value) => {
  if (!value) {
    if (detailVisible.value) closeStage()
    return
  }
  if (!isDataReady.value || stageDetail.value?.id === value) return
  const found = visibleStages.value.find(stage => stage.id === value)
  if (found) openStage(found, { syncUrl: false })
})
</script>

<style scoped>
/* 搜索框右侧放「进入地图」：与筛选面板同高的一行 */
.chapters-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chapters-search-row :deep(.ui-search) { flex: 1; min-width: 0; }

.chapters-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 0 4px;
}

/* ---------- 关卡列表（UiVirtualGrid 内通栏行布局，与任务图鉴一致） ---------- */
.chapters-card-grid :deep(.ui-card-grid) {
  grid-template-columns: minmax(0, 1fr);
  align-content: flex-start;
  gap: 6px;
}
.chapters-card-grid :deep(.ui-list-row) {
  background-color: var(--panel-list-background);
}
.stage-list-row {
  grid-column: 1 / -1;
}
.stage-card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.stage-card-no {
  flex-shrink: 0;
  min-width: 54px;
  padding: 3px 8px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: var(--wood);
  color: var(--on-wood-text);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.stage-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.stage-card-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.stage-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}
.stage-card-des {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.stage-card-rewards {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.stage-card-reward {
  display: flex;
  align-items: center;
  gap: 2px;
}
.stage-card-reward-icon {
  width: 26px;
  height: 26px;
  object-fit: contain;
}
.stage-card-reward-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.stage-card-arrow {
  color: var(--text-faint);
  font-size: 20px;
  line-height: 1;
}

/* ---------- 详情 ---------- */
.stage-difficulty-tabs { margin: 6px 0 12px; }
.stage-entry-cost { display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px; font-weight: 700; white-space: nowrap; }
.stage-entry-cost img { width: 22px; height: 22px; object-fit: contain; }
.stage-empty-reward { margin: 0; color: var(--text-muted); font-size: 13px; }
.stage-drop-note { margin: 14px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }

@media (max-width: 640px) {
  .stage-card-rewards { display: none; }
}
</style>
