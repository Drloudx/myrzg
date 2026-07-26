<template>
  <div class="page-view-container">
    <!-- Top Control Bar (2-Row Layout: Segmented Category Tags + Full Search) -->
    <div class="filter-sticky-bar recipes-filter-sticky">
      <!-- Row 1: Category Tag Segmented Pills + Right Counter -->
      <div class="control-row-1">
        <div class="segmented-pill-container tag-segmented">
          <div
            v-for="tag in tagOptions"
            :key="tag.key"
            :class="['segmented-pill-item', { active: filterTag === tag.key }]"
            @click="filterTag = tag.key"
          >
            {{ tag.label }}
          </div>
        </div>

        <div class="recipes-counter">
          包含食谱2<span class="count-num">{{ filteredRecipes.length }}</span> / {{ recipes.length }}
        </div>
      </div>

      <!-- Row 2: Full-Width Search Input using /ui/search.svg -->
      <div class="control-row-2">
        <div class="search-input-wrapper-full">
          <img src="/ui/search.svg" class="search-icon-img" alt="搜索" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="搜索食谱名称、食材、标签或Buff效果..."
            class="recipe-search-input-full"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">✕</button>
        </div>
      </div>
    </div>

    <!-- Async Data Loading State -->
    <div v-if="!isDataReady" class="global-loading-state">
      <div class="global-loading-spinner"></div>
      <span>正在装配食谱与Buff配方数据...</span>
    </div>

    <!-- Recipe Cards List Container -->
    <div v-else class="data-grid-scroll recipe-scroll-container" id="recipeGridScroll">
      <div class="recipe-cards-list">
        <div
          v-for="item in filteredRecipes"
          :key="item.id"
          :id="'recipe-card-' + item.id"
          class="recipe-card"
          :class="{ 'card-highlight-pulse': highlightedRecipeId === item.id }"
        >
          <!-- Card Header Row: Icon + Name & Sub-Category Tags + Circular Grey Preview Eye Button -->
          <div class="card-header-row">
            <div class="card-header-left">
              <div class="recipe-icon-wrapper">
                <img
                  :src="item.icon"
                  :alt="item.name"
                  class="recipe-icon-img"
                  loading="lazy"
                  @error="handleImgError"
                />
              </div>
              <div class="recipe-title-group">
                <div class="recipe-name-row">
                  <span class="recipe-name">{{ item.name }}</span>
                  <div class="recipe-category-pills" v-if="item.categoryTags && item.categoryTags.length">
                    <span
                      v-for="(ct, cIdx) in item.categoryTags"
                      :key="cIdx"
                      class="category-tag-pill"
                    >
                      {{ ct }}
                    </span>
                  </div>
                </div>

                <!-- Ingredients List Row (Directly under Recipe Title & Sub-Category Pills) -->
                <div class="ingredients-flex-row" v-if="item.ingredients && item.ingredients.length">
                  <div
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
                  </div>
                </div>
              </div>
            </div>

            <!-- Circular Grey Preview Image Action Button with visibility.svg (Only if preview image exists) -->
            <button
              v-if="item.hasPreview"
              class="preview-btn circle-grey-btn"
              @click="openPreviewModal(item)"
              title="查看制作图"
            >
              <img src="/ui/visibility1.svg" class="preview-icon-img" alt="查看" />
            </button>
          </div>

          <!-- Buff Description Section (Buff info ONLY, no left border, no header pills) -->
          <div class="buff-section" v-if="item.buffDes">
            <div class="buff-des-text">{{ item.buffDes }}</div>
          </div>

          <!-- Reserved Source / Obtain Channel Link Section -->
          <div class="card-section source-section" v-if="item.sourceInfo">
            <div class="source-link-bar" @click="handleNavigateSource(item.sourceInfo)">
              <span class="source-text">{{ item.sourceInfo.text }}</span>
              <span class="source-arrow">›</span>
            </div>
          </div>
        </div>

        <div v-if="filteredRecipes.length === 0" class="no-data">
          未找到符合条件的食谱配方数据
        </div>
      </div>
    </div>

    <!-- Preview Modal (Always uses recipe.id for menu_prev大图匹配) -->
    <BaseModal
      :visible="previewModal.visible"
      :title="`${previewModal.recipe.name || ''} 制作图`"
      @close="closePreviewModal"
    >
      <div class="preview-modal-body">
        <div class="preview-img-container">
          <img
            :src="previewModal.imgUrl"
            :alt="previewModal.recipe.name"
            class="recipe-prev-img"
            @error="handlePreviewError"
          />
        </div>
        <div class="preview-footer-note" v-if="previewModal.recipe.sourceInfo">
          <span class="source-tag-note">
            {{ previewModal.recipe.sourceInfo.text }}
          </span>
        </div>
      </div>
    </BaseModal>

    <!-- Task Detail Modal -->
    <BaseModal
      :visible="taskModal.visible"
      :title="taskModal.task?.name || '任务详情'"
      @close="closeTaskModal"
    >
      <div class="task-modal-body" v-if="taskModal.task">
        <!-- Meta Info Group -->
        <div class="task-meta-card">
          <div class="task-meta-row">
            <span class="meta-label">任务名称：</span>
            <span class="meta-val task-title-val">{{ taskModal.task.name }}</span>
          </div>
          <div class="task-meta-row">
            <span class="meta-label">任务类型：</span>
            <span class="task-type-badge">{{ taskModal.task.type }}</span>
          </div>
          <div class="task-meta-row">
            <span class="meta-label">接取地点：</span>
            <span class="meta-val">{{ taskModal.task.location }}</span>
          </div>
          <div class="task-meta-row">
            <span class="meta-label">接取 NPC：</span>
            <span class="meta-val npc-name">{{ taskModal.task.npc }}</span>
          </div>
        </div>

        <!-- Task Steps List -->
        <div class="task-section">
          <div class="task-section-title">
            <span>完整任务流程</span>
          </div>
          <div class="task-steps-list">
            <div
              v-for="(step, sIdx) in taskModal.task.steps"
              :key="sIdx"
              class="task-step-item"
            >
              <div class="step-num">{{ sIdx + 1 }}</div>
              <div class="step-text">{{ step }}</div>
            </div>
          </div>
        </div>

        <!-- Task Rewards List -->
        <div class="task-section">
          <div class="task-section-title">
            <span>任务奖励</span>
          </div>
          <div class="task-rewards-flex">
            <div
              v-for="(rew, rIdx) in taskModal.task.rewards"
              :key="rIdx"
              class="task-reward-chip"
            >
              <img :src="rew.icon" :alt="rew.name" class="rew-icon-img" @error="handleImgError" />
              <span class="rew-name">{{ rew.name }}</span>
              <span class="rew-count">× {{ rew.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>

    <BackToTop scroll-container="#recipeGridScroll" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '../components/BaseModal.vue'
import BackToTop from '../components/BackToTop.vue'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'

const route = useRoute()
const router = useRouter()

/**
 * 食谱大图预览可用列表 (硬编码替换 import.meta.glob 防止图片被 Vite 错误打包到 dist/assets 中)
 */
const PREVIEW_AVAILABLE_IDS = new Set([
  'item_30022', 'item_30023', 'item_30024', 'item_30025', 'item_30026', 'item_30027', 
  'item_30028', 'item_30029', 'item_30030', 'item_30031', 'item_30032', 'item_30033',
  'item_30034', 'item_30035', 'item_30036', 'item_30037', 'item_30038', 'item_30039',
  'item_30040', 'item_30041', 'item_30042', 'item_30043', 'item_30044', 'item_30046',
  'item_30047', 'item_30048'
])

/**
 * 食材与 ID 强绑定静态映射表 (写于页面内部，防匹配错乱)
 */
const INGREDIENT_NAME_MAP = {
  'item_10006': '兽肉',
  'item_10016': '猪腿骨',
  'item_10024': '面粉',
  'item_10036': '绿榛菇',
  'item_10055': '浆果',
  'item_10056': '野菜',
  'item_10057': '地菇',
  'item_10088': '岩盐',
  'item_10089': '风干肉',
  'item_10090': '果酱',
  'item_10091': '腌菜',
  'item_10100': '水露果',
  'item_10101': '魔爪贝',
  'item_10111': '黑森林松茸',
  'item_10112': '黑森林松茸干',
  'item_10118': '冰莲'
}

/**
 * 通用食材类型 ID 转换关系 (foodType: 1->兽肉, 2->野菜, 3->浆果, 4->地菇)
 */
const GENERIC_FOOD_TYPE_MAP = {
  '1': { typeId: 'item_10006', name: '兽肉' },
  '2': { typeId: 'item_10056', name: '野菜' },
  '3': { typeId: 'item_10055', name: '浆果' },
  '4': { typeId: 'item_10057', name: '地菇' }
}

/**
 * 食谱获取途径/跳转预留接口映射表
 */
const RECIPE_SOURCE_CONFIG = {
  'item_30035': {
    text: '配方由成就「战场美食家」获取',
    targetType: 'achievement',
    targetId: '10501',
    targetQuery: '战场美食家'
  },
  'item_30041': {
    text: '完成任务“修行者的佐餐小菜”获取配方',
    targetType: 'task_modal',
    taskData: {
      name: '修行者的佐餐小菜',
      type: '支线任务（第二章支线）',
      location: '第二章区域，破败古院北部房间',
      npc: '萨拉',
      steps: [
        '前往破败古院北部 ，与倒地的萨拉交互扶起她，接取本任务；',
        '前往破败古院 找到剋大师对话，向大师询问饮品，获得佳酿；',
        '返回后院，将佳酿交给萨拉；',
        '再次前往，带萨拉与剋大师见面交谈；',
        '准备材料：面粉 ×1、兽肉 ×1，前往剋大师处提交食材；',
        '交付材料后任务完成。'
      ],
      rewards: [
        { typeId: 'item_00001', count: 500 },
        { typeId: 'item_00002', count: 50 },
        { typeId: 'item_54004', count: 1 }
      ]
    }
  },
  'item_30034': {
    text: '完成任务“稀缺的食材（测试2）”获取配方',
    targetType: 'task_modal',
    taskData: {
      name: '稀缺的食材',
      type: '支线任务（初始章支线）',
      location: '初始章驿站房间',
      npc: '茜塔',
      steps: [
        '前往驿站找到茜塔对话，询问她的烦恼，接取本任务；',
        '前往求生者草原、秋日荒野击杀野猪魔物，收集5份兽肉；',
        '回到驿站，将5份兽肉提交给茜塔；',
        '交付材料后任务完成。'
      ],
      rewards: [
        { typeId: 'item_30034', count: 3 },
        { typeId: 'item_54001', count: 1 },
        { typeId: 'item_10016', count: 3 }
      ]
    }
  },
  'item_30040': {
    text: '完成任务“禅武同如一，虎啸除心魔”获取配方',
    targetType: 'task_modal',
    taskData: {
      name: '禅武同如一，虎啸除心魔',
      type: '主线任务（第二章主线）',
      location: '第二章破败古院房间',
      npc: '剋大师',
      steps: [
        '前往破败古院，与剋大师对话行礼，接取本任务；',
        '解锁演出关卡2-9；',
        '前往禅心林，通关战斗关卡2-9；',
        '返回破败古院，再次与剋大师对话；',
        '解锁演出关卡2-10；',
        '前往深林，通关战斗关卡2-10，任务完成。'
      ],
      rewards: [
        { name: 'item_00001', count: 500,  },
        { name: 'item_00002', count: 20,  },
        { name: 'item_27011', count: 1,  },
        { name: 'item_19207', count: 5, },
        { name: 'item_54003', count: 1, },
        { name: 'item_00004', count: 100,  }
      ]
    }
  },
  'item_30042': {
    text: '完成任务“香甜美食在哪里”获取配方',
    targetType: 'task_modal',
    taskData: {
      name: '香甜美食在哪里',
      type: '支线任务（第二章支线）',
      location: '第二章巴诺姆村',
      npc: '村长米拉贝尔',
      steps: [
        '找到村长米拉贝尔对话询问缘由，接取本任务；',
        '前往巴诺姆村，与“萝卜”阿里特对话询问美食配方；',
        '通关关卡2-10简单，从哈比巢穴夺回被偷走的配方；',
        '返回巴诺姆村，将夺回的配方交给阿里特；',
        '与同区域的“双刃”费萨交谈，咨询配方使用事宜；',
        '准备材料：面粉×2、兽肉×1、果酱×1，将食材提交给费萨；',
        '交付材料后任务完成。'
      ],
      rewards: [
        { name: 'item_00001', count: 500 },
        { name: 'item_00002', count: 50 },
        { name: 'item_54005', count: 1 }
      ]
    }

  },
}

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
const rawItemDict = ref({})

// Preview Modal State
const previewModal = ref({
  visible: false,
  recipe: {},
  imgUrl: ''
})

// Task Detail Modal State
const taskModal = ref({
  visible: false,
  task: null
})

const openTaskModal = (taskData) => {
  if (!taskData) return

  // 自动从 item.json (rawItemDict) 根据 ID 匹配真实名称与图标
  const resolvedRewards = (taskData.rewards || []).map(r => {
    const idKey = r.typeId || r.id || r.name
    const itemEntry = rawItemDict.value[idKey] || {}

    const name = itemEntry.name || r.name || idKey
    const imgKey = itemEntry.img || idKey
    const icon = r.icon || getImageUrl(`/Common_ItemIcon/${imgKey}.png`)

    return {
      typeId: idKey,
      name,
      count: r.count,
      icon
    }
  })

  taskModal.value = {
    visible: true,
    task: {
      ...taskData,
      rewards: resolvedRewards
    }
  }
}

const closeTaskModal = () => {
  taskModal.value.visible = false
}

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
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
  } else if (sourceInfo.targetType === 'task_modal') {
    openTaskModal(sourceInfo.taskData)
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
    const [menuJson, itemJson, buffJson, gsJson] = await Promise.all([
      fetchWithFallback('data/menu.json'),
      fetchWithFallback('data/item.json'),
      fetchWithFallback('data/buff.json'),
      fetchWithFallback('data/gameSetting.json')
    ])

    const menuDict = menuJson.datas || {}
    const itemDict = itemJson.datas || {}
    const buffDict = buffJson || {}
    rawItemDict.value = itemDict

    // Parse category codes from gameSetting.json
    const categoryCodeMap = {}
    const parseCategoryTypes = (arr) => {
      if (!arr || !Array.isArray(arr)) return
      arr.forEach(i => {
        if (i.type !== undefined && i.name) {
          categoryCodeMap[String(i.type)] = i.name
        }
        if (i.info) parseCategoryTypes(i.info)
      })
    }

    if (gsJson.data && gsJson.data.typeSetting && gsJson.data.typeSetting.item_type) {
      parseCategoryTypes(gsJson.data.typeSetting.item_type)
    }

    const assembledList = Object.values(menuDict).map(menuEntry => {
      const typeId = menuEntry.typeId
      const itemEntry = itemDict[typeId] || {}

      // 1. Resolve Recipe Icon & Name using itemEntry.img (e.g. item_30035 -> img: item_30009)
      const recipeName = itemEntry.name || menuEntry.name || '未知食谱'
      const recipeImgKey = itemEntry.img || typeId
      const recipeIcon = getImageUrl(`/Common_ItemIcon/${recipeImgKey}.png`)
      const recipeLevel = menuEntry.level || 1
      const hasPreview = PREVIEW_AVAILABLE_IDS.has(typeId)

      // 2. Resolve Category Tags & filter out "消耗" and "料理"
      const rawCats = itemEntry.category || []
      const categoryTags = rawCats
        .map(c => categoryCodeMap[String(c)] || String(c))
        .filter(t => t !== '消耗' && t !== '料理')

      // 3. Resolve Ingredients List using itemDict[ingId].img
      const ingredients = []
      if (menuEntry.food && Array.isArray(menuEntry.food) && menuEntry.food.length > 0) {
        menuEntry.food.forEach(f => {
          const ingId = f.typeId
          const count = f.num || 1
          const staticName = INGREDIENT_NAME_MAP[ingId]
          const matchedItem = itemDict[ingId] || {}
          const ingName = staticName || matchedItem.name || ingId
          const ingImgKey = matchedItem.img || ingId

          ingredients.push({
            typeId: ingId,
            name: ingName,
            count,
            icon: getImageUrl(`/Common_ItemIcon/${ingImgKey}.png`)
          })
        })
      } else if (menuEntry.foodType && Array.isArray(menuEntry.foodType) && menuEntry.foodType.length > 0) {
        menuEntry.foodType.forEach(ft => {
          const genInfo = GENERIC_FOOD_TYPE_MAP[ft.type] || { typeId: 'item_10006', name: '兽肉' }
          const count = ft.num || 1
          const matchedItem = itemDict[genInfo.typeId] || {}
          const ingImgKey = matchedItem.img || genInfo.typeId

          ingredients.push({
            typeId: genInfo.typeId,
            name: genInfo.name,
            count,
            icon: getImageUrl(`/Common_ItemIcon/${ingImgKey}.png`)
          })
        })
      }

      // 4. Resolve Buff Description ONLY
      let buffId = null
      if (itemEntry.useActionPara2 && itemEntry.useActionPara2.buff) {
        buffId = itemEntry.useActionPara2.buff
      }
      let buffTags = []
      let buffDes = ''

      if (buffId && buffDict[buffId]) {
        const bObj = buffDict[buffId]
        buffTags = bObj.buffTags || []
        if (bObj.buffDes) {
          buffDes = bObj.buffDes.replace(/\{([^}]+)\}/g, '$1')
        }
      }

      // 5. Source Info Link
      const sourceInfo = RECIPE_SOURCE_CONFIG[typeId] || null

      return {
        id: typeId,
        name: recipeName,
        level: recipeLevel,
        icon: recipeIcon,
        hasPreview,
        categoryTags,
        ingredients,
        buffId,
        buffTags,
        buffDes,
        sourceInfo
      }
    })

    recipes.value = assembledList.filter(r => !isBlacklisted(r))
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
</script>

<style scoped>
.recipes-filter-sticky {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row-1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.segmented-pill-container {
  display: flex;
  align-items: center;
  padding: 3px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-sizing: border-box;
}


.tag-segmented {
  display: inline-flex;
  width: auto;
}

.segmented-pill-item {
  flex: 1;
  text-align: center;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
}

.segmented-pill-item:hover {
  color: var(--text-main);
}

.segmented-pill-item.active {
  background: var(--card-bg, #ffffff);
  color: var(--primary);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.recipes-counter {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-sub);
  white-space: nowrap;
  margin-left: 4px; 
}

.count-num {
  color: var(--primary);
  font-weight: 700;
}

.control-row-2 {
  width: 100%;
}

.search-input-wrapper-full {
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
  filter: var(--icon-filter);
  pointer-events: none;
}

.recipe-search-input-full {
  width: 100%;
  height: 34px;
  padding: 4px 30px 4px 34px;
  border: 1px solid var(--input-border);
  border-radius: 17px;
  font-size: 13px;
  background: var(--input-bg);
  color: var(--input-text);
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.recipe-search-input-full:focus {
  outline: none;
  border-color: var(--input-border-focus);
  background: var(--card-bg);
}

.clear-btn {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: var(--text-sub);
  cursor: pointer;
  font-size: 12px;
}

/* Recipe Cards Container */
.recipe-scroll-container {
  padding-top: 4px;
}

.recipe-cards-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
}

.recipe-card {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  gap: 8px;
  transition: all 0.25s ease;
}

.recipe-card:hover {
  background: var(--hover-bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.recipe-card.card-highlight-pulse {
  border-color: var(--primary) !important;
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.45) !important;
  animation: cardPulse 0.8s ease-in-out 3;
}

@keyframes cardPulse {
  0%, 100% {
    border-color: var(--primary);
    box-shadow: 0 0 14px rgba(59, 130, 246, 0.4);
  }
  50% {
    border-color: #60a5fa;
    box-shadow: 0 0 22px rgba(96, 165, 250, 0.7);
  }
}

/* Header Row */
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

/* Larger Recipe Icon (54px x 54px) */
.recipe-icon-wrapper {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  background: var(--input-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  flex-shrink: 0;
}

.recipe-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recipe-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.recipe-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recipe-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
}

/* Exact Tag Pill Style requested by user */
.recipe-category-pills {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.category-tag-pill {
  color: var(--primary);
  background: #3b82f614;
  border: 1px solid #3b82f62e;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 1px 2px #00000005;
  white-space: nowrap;
}

/* Circular Grey Preview Action Button */
.preview-btn.circle-grey-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.preview-btn.circle-grey-btn:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
  transform: scale(1.06);
}

.preview-icon-img {
  width: 18px;
  height: 18px;
  filter: var(--icon-filter);
}

/* Ingredients Flex Chips (Directly under Title) */
.ingredients-flex-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ingredient-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
}

.ing-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.ing-name {
  color: var(--text-main);
  font-weight: 500;
}

.ing-count {
  color: var(--primary);
  font-weight: bold;
}

/* Buff Section */
.buff-section {
  background: var(--input-bg);
  padding: 8px 12px;
  border-radius: 8px;
}

.buff-des-text {
  font-size: 12px;
  color: var(--text-main);
  line-height: 1.45;
  font-weight: 500;
}

/* Source Section */
.source-section {
  margin-top: 2px;
}

.source-link-bar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  width: max-content;
}

.source-link-bar:hover {
  background: rgba(245, 158, 11, 0.2);
  transform: translateX(2px);
}


.source-text {
  font-size: 12px;
  font-weight: 600;
  color: #d97706;
}

.source-arrow {
  font-size: 14px;
  color: #d97706;
  font-weight: bold;
}

/* Preview Modal Body */
.preview-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.preview-img-container {
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  background: var(--input-bg);
  border-radius: 8px;
  padding: 10px;
}

.recipe-prev-img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
}

.preview-footer-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 12px;
  color: var(--text-sub);
  padding: 0 4px;
}

.source-tag-note {
  color: #d97706;
  font-weight: 600;
}

/* Task Detail Modal Styles */
.task-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 2px 0;
  flex: none;
}

.task-meta-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px 14px;
}

.task-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.meta-label {
  color: var(--text-sub);
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}

.meta-val {
  color: var(--text-main);
  font-weight: 500;
}

.task-title-val {
  font-weight: 700;
  color: var(--text-main);
}

.npc-name {
  color: var(--primary);
  font-weight: 700;
}

.task-type-badge {

  font-size: 11px;
  font-weight: 700;
}

.task-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: none;
}

.task-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.title-icon {
  font-size: 14px;
}

.task-steps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: none;
  padding-bottom: 0 !important;
}

.task-step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-main);
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary);
  color: #ffffff;
  font-size: 11px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-text {
  flex: 1;
}

.task-rewards-flex {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: none;
}

.task-reward-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 12px;
}

.rew-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.rew-name {
  color: var(--text-main);
  font-weight: 600;
}

.rew-count {
  color: var(--primary);
  font-weight: 700;
}
</style>
