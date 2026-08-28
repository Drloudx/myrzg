<template>
  <div class="page-view-container">

    <!-- 筛选区（羊皮纸面板，和物品图鉴风格一致的 UiSearchInput + UiFilterRow + UiFilterPill） -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索食谱名称、食材、标签或Buff效果..." />

      <UiFilterRow label="标签：">
        <UiFilterPill
          v-for="t in tagOptions"
          :key="t.key"
          :active="filterTag === t.key"
          @click="filterTag = t.key"
        >
          {{ t.label }}
        </UiFilterPill>

        <template #right>
          <div class="recipes-counter">
            数量：<span class="count-num">{{ filteredRecipes.length }}</span> / {{ recipes.length }}
          </div>
        </template>
      </UiFilterRow>
    </div>

    <!-- Async Data Loading State -->
    <UiEmptyState v-if="!isDataReady" type="loading" text="正在装配食谱与Buff配方数据..." />

    <!-- 列表区（双列卡片，懒加载每批 60 项） -->
    <UiCardGrid v-else id="recipeGridScroll" class="recipe-scroll-container">
      <div
        v-for="item in displayedRecipes"
        :key="item.id"
        :id="'recipe-card-' + item.id"
        class="recipe-card"
        :class="{ 'card-highlight-pulse': highlightedRecipeId === item.id }"
        @click="handleRecipeClick(item)"
      >
        <!-- 头部：图标 + 名称/分类 -->
        <div class="recipe-card-head">
          <div class="recipe-card-icon-wrap">
            <img
              :src="item.icon"
              :alt="item.name"
              class="recipe-card-icon"
              loading="lazy"
              @error="handleImgError"
            />
          </div>
          <div class="recipe-card-title">
            <span class="recipe-card-name">{{ item.name }}</span>
            <div v-if="item.categoryTags && item.categoryTags.length" class="recipe-category-pills">
              <UiTag v-for="(ct, cIdx) in item.categoryTags" :key="cIdx" tone="accent">{{ ct }}</UiTag>
            </div>
          </div>
        </div>

        <!-- 主体：食材 + Buff + 来源 -->
        <div class="recipe-card-body">
          <div v-if="item.ingredients && item.ingredients.length" class="ingredients-flex-row">
            <span
              v-for="(ing, iIdx) in item.ingredients"
              :key="iIdx"
              class="ingredient-chip"
            >
              <img
                :src="ing.icon"
                :alt="ing.name"
                class="ing-icon-img"
                loading="lazy"
                @error="handleImgError"
              />
              <span class="ing-name">{{ ing.name }}</span>
              <span class="ing-count">× {{ ing.count }}</span>
            </span>
          </div>

          <p v-if="item.buffDes" class="buff-des-text">{{ item.buffDes }}</p>

          <div
            v-if="item.sourceInfo"
            class="source-link-bar"
            @click.stop="handleNavigateSource(item.sourceInfo)"
          >
            <span class="source-text">{{ item.sourceInfo.text }}</span>
            <span class="source-arrow">›</span>
          </div>
        </div>

        <!-- 制作图预览按钮 -->
        <button
          v-if="item.hasPreview"
          class="preview-btn recipe-preview-corner"
          @click.stop="openPreviewModal(item)"
          title="查看制作图"
        >
          <img src="/ui/visibility1.svg" class="preview-icon-img" alt="查看" />
        </button>
      </div>

      <UiEmptyState v-if="filteredRecipes.length === 0" type="empty" text="未找到符合条件的食谱配方数据" />
    </UiCardGrid>

    <UiBackToTop scroll-container="#recipeGridScroll" />

    <!-- Preview Modal（菜谱详细制作：原居中弹窗设计，保持非全屏） -->
    <UiModal
      v-model:visible="previewModal.visible"
      :title="previewModal.recipe ? `${previewModal.recipe.name || ''} 详细制作` : '详细制作'"
      max-width="640px"
    >
      <div v-if="previewModal.recipe" class="recipe-modal-body">
        <UiSection v-if="previewModal.imgUrl" title="制作图预览">
          <div class="preview-img-container">
            <img
              :src="previewModal.imgUrl"
              :alt="previewModal.recipe.name"
              class="recipe-prev-img"
              @error="handlePreviewError"
            />
          </div>
        </UiSection>
      </div>
    </UiModal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiBackToTop,
  UiCardGrid,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiModal,
  UiSearchInput,
  UiSection,
  UiTag
} from '../components/ui/index.js'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'
import { buildRecipeData } from '../utils/recipeData.js'
import { useLazyList } from '../composables/useLazyList'

const route = useRoute()
const router = useRouter()

// Category Tag Filter Options
const tagOptions = [
  { key: 'all', label: '全部' },
  { key: '强化类', label: '强化类' },
  { key: '恢复类', label: '恢复类' },
  { key: '抗性类', label: '抗性类' }
]

// Filter States
const filterTag = ref(route.query.tag || 'all')
const searchQuery = ref(route.query.q || '')
const highlightedRecipeId = ref('')

const recipes = ref([])
const isDataReady = ref(false)

// Preview Modal State
const previewModal = ref({
  visible: false,
  recipe: {},
  imgUrl: ''
})

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}

// 点击配方成品（图标/名称/食材区域）→ 打开物品详情
const handleRecipeClick = (recipe) => {
  if (!recipe?.id) return
  router.push({ query: { ...route.query, itemId: recipe.id } })
}

const handlePreviewError = (e) => {
  if (previewModal.value.recipe && previewModal.value.recipe.icon) {
    e.target.src = previewModal.value.recipe.icon
  }
}

const openPreviewModal = (recipe) => {
  // 预览大图依据料理的 ID 匹配
  previewModal.value = {
    visible: true,
    recipe,
    imgUrl: getImageUrl(`/menu_prev/${recipe.id}_prev.png`)
  }
}

const closePreviewModal = () => {
  previewModal.value.visible = false
}

const handleNavigateSource = (sourceInfo) => {
  if (!sourceInfo) return
  if (sourceInfo.targetType === 'achievement') {
    router.push({
      path: '/achievement',
      query: { id: sourceInfo.targetId, q: sourceInfo.targetQuery }
    })
  } else if (sourceInfo.targetType === 'task') {
    // 跳转到任务图鉴详情页（?task=任务id，任务图鉴会自动打开对应任务详情）
    router.push({
      path: '/tasks',
      query: { task: sourceInfo.targetId }
    })
  }
}

const handleLocateRecipe = (targetId, queryQ) => {
  if (!isDataReady.value || !recipes.value.length) return

  let match = null
  if (targetId) {
    match = recipes.value.find(r => String(r.id) === String(targetId))
  }
  if (!match && queryQ) {
    const qLower = queryQ.trim().toLowerCase()
    match = recipes.value.find(r => r.name.toLowerCase().includes(qLower))
  }

  if (match) {
    if (filterTag.value !== 'all' && !match.categoryTags.includes(filterTag.value)) {
      filterTag.value = 'all'
    }

    highlightedRecipeId.value = match.id

    nextTick(() => {
      const el = document.getElementById(`recipe-card-${match.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    setTimeout(() => {
      highlightedRecipeId.value = ''
    }, 2800)
  }
}

onMounted(async () => {
  try {
    let assembledList = null

    // 优先读取构建期预解析单文件
    try {
      const data = await fetchWithFallback('data/parsed/recipes.json')
      assembledList = data.recipes
    } catch (e) {
      console.warn('parsed/recipes.json 不可用，回退到原始多文件加载:', e?.message || e)
    }

    if (!assembledList) {
      const [menuJson, itemJson, buffJson, gsJson] = await Promise.all([
        fetchWithFallback('data/menu.json'),
        fetchWithFallback('data/item.json'),
        fetchWithFallback('data/buff.json'),
        fetchWithFallback('data/gameSetting.json')
      ])
      assembledList = buildRecipeData({ menuJson, itemJson, buffJson, gsJson }).recipes
    }

    // 预解析产物存相对路径，运行时统一过 getImageUrl（原生端会加 CDN 前缀）
    recipes.value = assembledList
      .map(r => ({
        ...r,
        icon: getImageUrl(r.icon),
        ingredients: (r.ingredients || []).map(ing => ({ ...ing, icon: getImageUrl(ing.icon) }))
      }))
      .filter(r => !isBlacklisted(r))
    isDataReady.value = true

    if (route.query.id || route.query.q) {
      handleLocateRecipe(route.query.id, route.query.q)
    }
  } catch (err) {
    console.error('Fetch recipes/item/buff/gameSetting data error:', err)
    isDataReady.value = true
  }
})

// Bidirectional URL Query State Sync
watch([filterTag, searchQuery], () => {
  const query = {}
  if (filterTag.value !== 'all') query.tag = filterTag.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  router.replace({ query })
})

// Watch route.query for external changes
watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.q !== undefined && newQuery.q !== searchQuery.value) {
      searchQuery.value = newQuery.q || ''
    }
    if (newQuery.id || newQuery.q) {
      handleLocateRecipe(newQuery.id, newQuery.q)
    }
  },
  { deep: true }
)

const filteredRecipes = computed(() => {
  return recipes.value.filter(recipe => {
    // Category Tag filter
    if (filterTag.value !== 'all' && !recipe.categoryTags.includes(filterTag.value)) {
      return false
    }

    // Search query filter
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = recipe.name.toLowerCase().includes(q)
      const matchTags = recipe.categoryTags.some(t => t.toLowerCase().includes(q))
      const matchIng = recipe.ingredients.some(ing => ing.name.toLowerCase().includes(q))
      const matchBuff = recipe.buffDes.toLowerCase().includes(q)
      if (!matchName && !matchTags && !matchIng && !matchBuff) return false
    }

    return true
  })
})

const { displayedItems: displayedRecipes } = useLazyList(filteredRecipes, 60, '#recipeGridScroll')
</script>

<style scoped>
/* ===== 页面特有布局（筛选面板 / 单列卡片流） ===== */
.filter-panel {
  margin: 0 0 12px 0;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.filter-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.recipes-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  padding: 0 6px;
}

/* 菜谱为双列卡片网格（电脑端一行 2 个，移动端 1 列） */
.recipe-scroll-container :deep(.ui-card-grid) {
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  align-content: flex-start;
}
@media (max-width: 640px) {
  .recipe-scroll-container :deep(.ui-card-grid) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

/* ===== 菜谱卡片 ===== */
.recipe-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(223, 206, 179, 0.94);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  min-width: 0;
}
.dark-mode .recipe-card {
  background: rgba(63, 48, 32, 0.84);
}
.recipe-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-bright);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.3);
}

.recipe-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.recipe-card-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-soft);
  border: 1px solid var(--border-faint);
  border-radius: 6px;
}
.recipe-card-icon {
  width: 38px;
  height: 38px;
  object-fit: contain;
}
.recipe-card-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.recipe-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.3;
  word-break: break-word;
}
.recipe-card-title .recipe-category-pills {
  justify-content: flex-start;
}

.recipe-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.recipe-card-body .buff-des-text {
  text-align: left;
}

/* 预览按钮：卡片右上角 */
.recipe-preview-corner {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
}

/* ===== 卡片扩展内容（行内复用） ===== */
.recipe-card-extra {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.recipe-category-pills {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ingredients-flex-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.ingredient-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(43, 31, 21, 0.14);
  border: 1px solid var(--border-faint);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: inset 0 1px 2px rgba(43, 31, 21, 0.1);
}

.ing-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.ing-name {
  color: var(--text-main);
  font-weight: 600;
}

.ing-count {
  color: var(--accent-ink);
  font-weight: 700;
}

.buff-des-text {
  margin: 2px 0 0;
  width: 100%;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-main);
  text-align: center;
}

/* 获取途径条 */
.source-link-bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(138, 106, 31, 0.14);
  border: 1px dashed rgba(138, 106, 31, 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 100%;
}

.source-link-bar:hover {
  background: rgba(138, 106, 31, 0.22);
  transform: translateX(2px);
}

.source-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--gold);
  line-height: 1.6;
}

.source-arrow {
  font-size: 14px;
  color: var(--gold);
  font-weight: 700;
}

/* 制作图预览按钮（圆形） */
.preview-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(43, 31, 21, 0.08);
  border: 1px solid var(--border-color);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.preview-btn:hover {
  background: var(--hover-bg);
  border-color: var(--accent-bright);
  transform: scale(1.06);
}

.preview-icon-img {
  width: 18px;
  height: 18px;
  filter: var(--icon-filter1);
}

/* 全局搜索定位高亮脉冲（主题青描边） */
.card-highlight-pulse {
  border-color: var(--accent-bright) !important;
  box-shadow: 0 0 16px rgba(122, 154, 153, 0.45) !important;
  animation: cardPulse 0.8s ease-in-out 3;
}

@keyframes cardPulse {
  0%, 100% {
    border-color: var(--accent-bright);
    box-shadow: 0 0 14px rgba(122, 154, 153, 0.4);
  }
  50% {
    border-color: var(--accent);
    box-shadow: 0 0 22px rgba(85, 117, 116, 0.7);
  }
}

/* ===== 预览弹窗内容 ===== */
.recipe-modal-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-img-container {
  display: flex;
  justify-content: center;
  background: rgba(43, 31, 21, 0.08);
  border: 1px solid var(--border-faint);
  border-radius: 6px;
  padding: 10px;
}

.recipe-prev-img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
}

.source-detail-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

</style>
