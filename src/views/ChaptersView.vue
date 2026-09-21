<template>
  <div class="page-view-container chapters-page">

    <!--
      地图视图（仅桌面端），分两级：
        未选章节 → 世界地图（点地区进入该地区）
        已选章节 → 该地区的路线图（底图 + 关卡/地区/副本节点 + 连线）
      两级共用同一块区域与同一个实测高度；「展开列表」切到列表视图。
    -->
    <div v-if="showMap && chapterMap && isDataReady" ref="mapAreaRef" class="chapters-map-area">
      <ChapterMapCanvas
        v-if="!regionRoute"
        :map="chapterMap"
        :active-id="chapterId"
        :visible-ids="mapVisibleIds"
        :total-stages="totalNormalStages"
        :height="mapAreaHeight"
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

      <RegionRouteMap
        v-else
        :region="regionRoute"
        :map-title="chapterMap.title"
        :stage-platform="chapterMap.stagePlatform"
        :stage-crystal="chapterMap.stageCrystal"
        :stage-crystal-small="chapterMap.stageCrystalSmall"
        :area-tag="chapterMap.areaTag"
        :current-stage-id="stageDetail?.id || ''"
        :caption="regionCaption"
        :height="mapAreaHeight"
        @select="openStageById"
        @back="backToWorldMap"
        @list="openList"
      />
    </div>

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
                <UiTag tone="wood">{{ displayDifficulty(item) }}</UiTag>
                <UiTag v-if="displayLevel(item)" tone="muted">Lv.{{ displayLevel(item) }}</UiTag>
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

        <!-- 难度切换用列表页同款的 UiFilterPill：UiSegmentedTabs 是深色木条（为深色底设计），
             放在羊皮纸弹窗里不搭；换成胶囊后与列表页的难度筛选完全一致。 -->
        <UiFilterRow label="难度：" class="stage-difficulty-tabs">
          <UiFilterPill
            v-for="(item, index) in stageDetail.difficulties"
            :key="item.key"
            :active="difficultyIndex === index"
            @click="difficultyIndex = index"
          >
            {{ item.label }}
          </UiFilterPill>
        </UiFilterRow>

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

        <UiSection :title="stageDetail.kind === 'area' ? '探索产出' : '通关掉落'" data-source-entry="settlement">
          <RewardPools v-if="difficulty.reward.length" :entries="difficulty.reward" @item-click="goToItem" />
          <p v-else class="stage-empty-reward">暂无可展示的掉落配置</p>
        </UiSection>

        <UiSection v-if="difficulty.rooms.length" title="房间内容与掉落来源">
          <RoomContentList :rooms="difficulty.rooms" @item-click="goToItem" />
        </UiSection>

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
  UiTag
} from '../components/ui/index.js'
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'
import ChapterMapCanvas from '../components/chapters/ChapterMapCanvas.vue'
import RegionRouteMap from '../components/chapters/RegionRouteMap.vue'
import RewardPools from '../components/RewardPools.vue'
import RoomContentList from '../components/RoomContentList.vue'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { BASE_REWARD_PATHS } from '../utils/gameMappings.js'
import { isBlacklisted } from '../config/blacklist.js'

const DIFFICULTY_LABELS = ['简单', '普通', '困难', '自由探索']

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

/** 可见章节的纯关卡总数（不含自由探索小地区，供世界地图与统计汇总显示）。 */
const totalNormalStages = computed(() =>
  visibleChapters.value.reduce((sum, chapter) => sum + (chapter.stageCount ?? chapter.stages.filter(s => s.kind !== 'area').length), 0)
)

/** 地图上可见的章节 id：被黑名单隐藏的章节不出现，地图上该区域保持底图原样（未探索）。 */
const mapVisibleIds = computed(() => visibleChapters.value.map(chapter => chapter.id))

/**
 * 地图视图与列表视图是两屏，互斥，由显式的 `view` 决定：
 *   - 地图视图（仅桌面端）：整块区域只有地图，内部再分世界地图 / 地区路线图两级。
 *   - 列表视图：地图不出现；桌面端搜索框右侧的「进入地图」切回地图。
 * 手机端不出地图（拼块章节名在 390px 下读不清），恒为列表视图。
 * 地图层级由 `chapterId` 推导（选了章节就是地区路线图），不另存状态，刷新与分享自然一致。
 */
const MOBILE_QUERY = '(max-width: 767px)'
const isMobile = ref(typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches)
const view = ref(route.query.view === 'list' ? 'list' : 'map')

const showMap = computed(() => !isMobile.value && view.value === 'map')
const showStageList = computed(() => !showMap.value)

const openList = () => { view.value = 'list' }
const openMap = () => { view.value = 'map' }

/** 选了章节 → 地图视图的第二级（该地区的路线图）；未选 → 世界地图。 */
const regionRoute = computed(() => {
  if (chapterId.value === 'all') return null
  return chapterMap.value?.regions?.[chapterId.value] || null
})
const regionCaption = computed(() => {
  const chapter = visibleChapters.value.find(item => item.id === chapterId.value)
  if (!chapter) return ''
  const count = chapter.stageCount ?? chapter.stages.filter(s => s.kind !== 'area').length
  return `${chapter.areaName} · ${count} 关`
})
const backToWorldMap = () => { chapterId.value = 'all' }

/**
 * 地图区高度 = 左右面板底部 − 地图区顶部，由页面测一次给两个地图组件共用。
 * 取左右面板而不是视口：两侧 sticky 面板要留底部安全区，比视口底还高一点，
 * 按视口算地图会比面板长出一截。
 */
const mapAreaRef = ref(null)
const mapAreaHeight = ref(640)
const measureMapArea = () => {
  const el = mapAreaRef.value
  if (!el) return
  const top = el.getBoundingClientRect().top
  const sidePanel = document.querySelector('.desktop-sidebar-container, .desktop-right-container')
  const bottom = sidePanel ? sidePanel.getBoundingClientRect().bottom : window.innerHeight - 10
  mapAreaHeight.value = Math.max(360, Math.min(Math.round(bottom - top), 900))
}

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

const chapterLabel = (chapter) => chapter.areaName

/**
 * 卡片上只显示**一个**难度标签：按当前难度筛选显示对应难度；筛选为「全部」时默认显示「普通」。
 * 关卡没有「普通」（如序章只有简单）时退回它实际有的第一个难度。
 */
const displayDifficulty = (stage) => {
  const wanted = difficultyFilter.value !== 'all' ? difficultyFilter.value : '普通'
  return stage.difficultyLabels.includes(wanted) ? wanted : stage.difficultyLabels[0]
}

/** 等级跟着上面的难度走——三难度的推荐等级不同。 */
const displayLevel = (stage) => stage.levels?.[displayDifficulty(stage)] || 0

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

const difficulty = computed(() => stageDetail.value?.difficulties?.[difficultyIndex.value] || null)
const detailTitle = computed(() => stageDetail.value
  ? `${stageDetail.value.shortName} ${stageDetail.value.name}`
  : '关卡详情')

const handleImgError = handleImageFallback

const selectChapter = (id) => {
  // 换章节后列表内容整体替换，`UiVirtualGrid` 会在 items 变化时自行把列表滚回顶部；
  // 这里不要再调 scrollToItem——它用 align:'center' 会把整页滚动，把上方的地图推出视口。
  // 视图不在这里切：地图视图里选地区会自然进入该地区的路线图，列表视图里选章节仍留在列表。
  chapterId.value = id
}

/** 路线图上点关卡节点 → 打开该关卡详情（节点只带 id，要回索引里取详情文件路径）。 */
const openStageById = (stageId) => {
  const found = visibleStages.value.find(stage => stage.id === stageId)
  if (found) openStage(found)
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
    const targetLabel = DIFFICULTY_LABELS.includes(route.query.diff) ? route.query.diff : difficultyFilter.value
    const matchedIdx = data.difficulties.findIndex(d => d.label === targetLabel)
    difficultyIndex.value = matchedIdx >= 0 ? matchedIdx : 0
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
// 地图区高度实测：地图区挂载后测一次，窗口变化时重测。
// 必须等 isDataReady —— 首次挂载时地图区还没渲染（v-if 里带 isDataReady），
// 量不到元素就会一直停在默认值，表现为地图比左右面板短一截。
onMounted(() => {
  measureMapArea()
  window.addEventListener('resize', measureMapArea, { passive: true })
  onBeforeUnmount(() => window.removeEventListener('resize', measureMapArea))
})
watch([showMap, isDataReady], async () => {
  await nextTick()
  measureMapArea()
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

/**
 * 浏览器前进/后退或粘贴 URL 时同步其余筛选状态。
 * 这些值原先只在初始化时读一次，从 ?chapter=c0 后退到 ?chapter=c1 视图不会跟着变
 * （地图层级现在也由 chapterId 决定，不跟随就会停在上一章的地图上）。
 * 自身 router.replace 写入的是同样的值，所以这里比较后再赋值，不会来回打架。
 */
watch(() => route.query, (query) => {
  const chapter = query.chapter || 'all'
  if (chapter !== chapterId.value) chapterId.value = chapter
  const diff = DIFFICULTY_LABELS.includes(query.diff) ? query.diff : 'all'
  if (diff !== difficultyFilter.value) difficultyFilter.value = diff
  const keyword = query.q || ''
  if (keyword !== searchQuery.value) searchQuery.value = keyword
  const nextView = query.view === 'list' ? 'list' : 'map'
  if (nextView !== view.value) view.value = nextView
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
/* 与其它详情页同款：徽标行必须有 gap，否则 UiTag 之间只剩空白字符的间距，看着像没做间距。 */
.detail-badges { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 4px; }
.stage-difficulty-tabs { margin: 8px 0 12px; }
.stage-entry-cost { display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px; font-weight: 700; white-space: nowrap; }
.stage-entry-cost img { width: 22px; height: 22px; object-fit: contain; }
.stage-empty-reward { margin: 0; color: var(--text-muted); font-size: 13px; }

@media (max-width: 640px) {
  .stage-card-rewards { display: none; }
}
</style>
