<template>
  <Transition name="fade">
    <div v-if="visible" class="item-modal-overlay" @click.self="handleClose">
      <div class="item-modal-content">
        <button class="close-btn" @click="handleClose">✕</button>

        <!-- 顶部信息区 -->
        <div class="modal-header" :style="getQualityStyle(item.quality)">
          <div class="icon-wrapper" :class="`quality-bg-${item.quality}`">
            <img :src="getImageUrl(getItemImageUrl(item))" :alt="item.name" class="item-icon" loading="lazy" />
          </div>
          <div class="header-info">
            <h2 class="item-name" :style="{ color: getQualityStyle(item.quality).color }">
              {{ item.name }}
            </h2>
            <div class="item-tags">
              <span class="tag copy-tag" @click="copyId(item.typeId)" title="点击复制 ID">ID: {{ item.typeId }}</span>
              <span class="tag" v-if="categoryName">{{ categoryName }}</span>
              <span class="tag" v-if="item.maxNum > 1">可堆叠 ({{ item.maxNum }})</span>
            </div>
          </div>
        </div>

        <!-- 滚动内容区 -->
        <div class="modal-scroll-area" id="itemModalScroll">
          <div class="section desc-section">
            <p>{{ item.desc }}</p>
          </div>

          <!-- 装备属性 -->
          <div v-if="item.itemType === 2 && item.equip" class="section equip-section">
            <h3>装备属性</h3>
            <div class="equip-meta">
              <span v-if="item.equip.equipLevel">装备品阶: {{ item.equip.equipLevel }}</span>
              <span v-if="jobName">适用职业: {{ jobName }}</span>
            </div>
            <div v-if="item.equip.unitData" class="attr-grid">
              <div v-for="(val, key) in item.equip.unitData" :key="key" class="attr-item">
                <span class="attr-name">{{ translateAttr(key) }}</span>
                <span class="attr-val">+{{ val }}</span>
              </div>
            </div>
          </div>

          <!-- 使用效果 -->
          <div v-if="item.useDes || recipeInfo || bookContent" class="section action-section">
            <h3>{{ (bookContent && !item.useDes && !recipeInfo) ? '内容展示' : '使用效果' }}</h3>

            <!-- 书籍内容 -->
            <div v-if="bookContent" class="book-content-box">
              <div class="book-text">
                <template v-for="(para, i) in bookContent.split('\n')" :key="i">
                  <p v-if="para.trim()" class="book-para">{{ para.trim() }}</p>
                </template>
              </div>
            </div>

            <p v-if="item.useDes" v-html="formatUseDes(item.useDes)"></p>
            
            <div v-if="recipeInfo" class="recipe-container">
              <div class="recipe-title">配方</div>
              <div class="recipe-ingredients-mini" v-if="recipeInfo.ingredients && recipeInfo.ingredients.length">
                <div
                  v-for="(ing, idx) in recipeInfo.ingredients"
                  :key="idx"
                  class="ingredient-chip clickable"
                  @click="handleIngredientClick(ing.typeId)"
                >
                  <img
                    :src="ing.icon"
                    :alt="ing.name"
                    class="ing-icon-img"
                    loading="lazy"
                  />
                  <span class="ing-name">{{ ing.name }}</span>
                  <span class="ing-count">× {{ ing.count }}</span>
                </div>
              </div>
              <button class="go-recipe-btn" @click="goRecipeSearch">跳转食谱页面</button>
            </div>
            
            <!-- Preview Image -->
            <div v-if="recipeInfo && PREVIEW_AVAILABLE_IDS.has(recipeInfo.typeId)" class="recipe-preview-box">
              <div class="recipe-title">预览图</div>
              <img :src="getImageUrl(`/menu_prev/${recipeInfo.typeId}_prev.png`)" alt="预览图" class="recipe-prev-img" />
            </div>
          </div>

          <!-- 宝箱/奖励掉落展示 -->
          <div v-if="rewardDrops && rewardDrops.length > 0" class="section reward-section">
            <h3>使用效果</h3>
            <div v-for="(group, idx) in rewardDrops" :key="idx" class="reward-group">
               <div class="group-title">
                  <span v-if="group.rate < 1" class="pool-type prob-pool">[概率池] 仅 {{ (group.rate * 100).toFixed(1) }}% 概率触发抽取</span>
                  <span v-else class="pool-type sure-pool">[必出池] 必定触发抽取</span>
                  <span v-if="group.num > 1" class="pool-num"> (抽取 {{ group.num }} 次)</span>
               </div>
               <div class="reward-grid">
                  <div v-for="(rule, rIdx) in group.rules" :key="rIdx" class="reward-item-card" :class="[`quality-border-${rule.targetQuality}`, { 'clickable': rule.typeId }]" @click="handleRewardClick(rule)">
                    <div class="r-icon-wrapper" :class="`quality-bg-${rule.targetQuality}`">
                      <img v-if="rule.targetImg" :src="getImageUrl(rule.targetImg)" class="r-icon" />
                    </div>
                    <div class="r-info">
                       <span class="r-name" :class="`quality-text-${rule.targetQuality}`">{{ rule.targetName }}</span>
                       <span class="r-qty">x{{ rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}` }}</span>
                       <span class="r-prob" v-if="rule.actualProb < 1">{{ (rule.actualProb * 100).toFixed(1) }}%</span>
                       <span class="r-prob" v-else>必定获得</span>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <!-- 解锁内容 -->
          <div v-if="unlockText" class="section unlock-section">
            <h3>解锁内容</h3>
            <p>{{ unlockText }}</p>
          </div>

          <!-- 经济信息 -->
          <div v-if="item.sellable" class="section economy-section">
            <h3>基础信息</h3>
            <p>售价: {{ item.sellPrice }} 银币</p>
          </div>

          <!-- 获取途径 -->
          <div class="section origin-section">
            <h3>获取途径</h3>
            
            <div v-if="hasItemSources" class="source-grid">
              <div v-for="group in groupedSources" :key="group.name" class="source-group-wrapper">
                <!-- Group Header (Main Card) -->
                <div class="source-chip source-group-card clickable" @click="toggleSourceGroup(group.name)">
                  <div class="source-icon">{{ group.icon }}</div>
                  <div class="source-info" style="flex: 1;">
                    <span class="source-name" style="font-weight:bold;">{{ group.name }}</span>
                  </div>
                  <div class="source-toggle-icon" :class="{ 'open': expandedSourceGroups[group.name] }">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
                
                <!-- Group Drawer (2 columns) -->
                <div class="source-drawer-grid" :class="{ 'drawer-open': expandedSourceGroups[group.name] }">
                  <div v-for="(src, idx) in group.sources" :key="idx" 
                       class="source-chip drawer-chip"
                       :class="{ clickable: canNavigateToSource(src) }"
                       @click="handleSourceClick(src)">
                    <div class="drawer-icon-placeholder">{{ group.icon }}</div>
                    <div class="source-info">
                      <span class="source-name">{{ src.name }}</span>
                      <span class="source-des" v-if="src.des">{{ src.des }}</span>
                    </div>
                    <div class="source-action-text" v-if="canNavigateToSource(src)">前往</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-else-if="item.origin && item.origin.length > 0">
              <div v-for="(org, idx) in item.origin" :key="idx" class="origin-item">
                <span class="origin-val">{{ org.value || org }}</span>
                <button v-if="org.battleId" class="go-battle-btn">前往</button>
              </div>
            </div>
            
            <div v-else class="origin-placeholder">
              <p class="empty-tip">数据未补充...</p>
            </div>
          </div>
        </div>
      </div>
      <BackToTop scroll-container="#itemModalScroll" />
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getImageUrl } from '../utils/env'
import { translateJob, translateAttr, translateCategory, parseItemUnlocks, getItemImageUrl, parseItemRewards, getCachedItem } from '../utils/itemParser'
import { pushItemDetail, popItemDetail } from '../utils/itemModalState'
import { fetchWithFallback } from '../utils/request.js'
import BackToTop from './BackToTop.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    default: () => ({})
  },
  categoryTree: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:visible'])

const route = useRoute()
const router = useRouter()

const handleClose = () => {
  if (!popItemDetail()) {
    emit('update:visible', false)
      if (route && route.query.itemId) {
        const newQuery = { ...route.query }
        delete newQuery.itemId
        router.replace({ query: newQuery })
      }
  }
}

const copyId = async (id) => {
  if (!id) return
  try {
    await navigator.clipboard.writeText(id)
  } catch (err) {
    console.warn('复制失败', err)
  }
}

const categoryName = computed(() => {
  if (!props.item?.category || !props.categoryTree) return ''
  return translateCategory(props.item.category, props.categoryTree)
})

const jobName = computed(() => {
  if (!props.item?.equip?.job) return ''
  return translateJob(props.item.equip.job)
})

const unlockText = computed(() => {
  return parseItemUnlocks(props.item)
})

const rewardDrops = computed(() => {
  return parseItemRewards(props.item)
})

const handleRewardClick = (rule) => {
  if (rule.typeId) {
    const targetItem = getCachedItem(rule.typeId)
    if (targetItem) {
      pushItemDetail(targetItem)
    }
  }
}

const getQualityStyle = (quality) => {
  switch (quality) {
    case 1: return { background: 'rgba(240, 240, 240, 0.85)', color: '#666' }
    case 2: return { background: 'rgba(230, 245, 230, 0.85)', color: '#2b8a2b' }
    case 3: return { background: 'rgba(220, 240, 255, 0.85)', color: '#1a6da1' }
    case 4: return { background: 'rgba(240, 220, 255, 0.85)', color: '#8b2bba' }
    case 5: return { background: 'rgba(255, 240, 220, 0.85)', color: '#bd6a15' }
    default: return { background: 'rgba(240, 240, 240, 0.85)', color: '#666' }
  }
}

const formatUseDes = (text) => {
  if (!text) return ''
  return text.replace(/(?:\{([^}]+)\})|(?:<([^>]+)>)/g, (match, p1, p2) => {
    return `<span class="value-highlight">${p1 || p2}</span>`
  })
}

const menuDict = ref({})
const diaryData = ref(null)
const bookContent = ref(null)

const bookEventId = computed(() => {
  if (!props.item) return null
  const cat = props.item.category || []
  if (cat.includes(5) || cat.includes('5') || cat.includes(54) || cat.includes('54')) {
    const p = props.item.useActionPara
    if (p && p.eventType && p.eventType.length > 0) {
      return p.eventType[0]
    }
  }
  return null
})

watch(bookEventId, async (newVal) => {
  if (newVal) {
    if (!diaryData.value) {
      try {
        const res = await fetchWithFallback('data/diary.json')
        diaryData.value = res || {}
      } catch (e) {
        console.error('Failed to load diary.json', e)
      }
    }
    let foundText = ''
    if (diaryData.value) {
      const categories = ['taskMain', 'taskSub', 'word', 'book']
      for (const cat of categories) {
        const list = diaryData.value[cat]
        if (list && Array.isArray(list)) {
          for (const task of list) {
            if (task.content) {
              const matched = task.content.find(c => c.unlockCondition === newVal)
              if (matched) {
                foundText = matched.text
                break
              }
            }
          }
        }
        if (foundText) break
      }
    }
    bookContent.value = foundText
  } else {
    bookContent.value = null
  }
}, { immediate: true })

const globalItemSources = ref({})

onMounted(async () => {
  try {
    const menuRes = await fetchWithFallback('data/menu.json')
    menuDict.value = menuRes?.datas || {}
  } catch (e) {
    console.error('Failed to load menu.json', e)
  }
  
  try {
    const srcRes = await fetchWithFallback('data/item-sources.json')
    globalItemSources.value = srcRes || {}
  } catch (e) {
    console.error('Failed to load item-sources.json', e)
  }
})

const currentItemSources = computed(() => {
  if (!props.item?.typeId || !globalItemSources.value) return []
  return globalItemSources.value[props.item.typeId] || []
})

const groupedSources = computed(() => {
  const groups = {
    achievement: { name: '成就', icon: '🏆', sources: [] },
    task: { name: '任务', icon: '📜', sources: [] },
    pvp: { name: '挑战赛', icon: '🏆', sources: [] },
    monster: { name: '怪物掉落', icon: '⚔️', sources: [] },
    recipe: { name: '配方制作', icon: '🍳', sources: [] },
    exchange: { name: '兑换', icon: '💰', sources: [] },
    hidden: { name: '被隐藏的物品', icon: '🎁', sources: [] },
    other: { name: '其他', icon: '📜', sources: [] }
  }
  
  currentItemSources.value.forEach(src => {
    if (groups[src.type]) {
      groups[src.type].sources.push(src)
    } else {
      groups['other'].sources.push(src)
    }
  })
  
  return Object.values(groups).filter(g => g.sources.length > 0)
})

const expandedSourceGroups = ref({})
const toggleSourceGroup = (groupName) => {
  expandedSourceGroups.value[groupName] = !expandedSourceGroups.value[groupName]
}

watch(currentItemSources, () => {
  expandedSourceGroups.value = {}
  groupedSources.value.forEach(g => {
    expandedSourceGroups.value[g.name] = false // Closed by default
  })
}, { immediate: true })

const hasItemSources = computed(() => currentItemSources.value.length > 0)

const canNavigateToSource = (src) => {
  return ['monster', 'achievement', 'recipe', 'pvp', 'hidden'].includes(src.type)
}

const handleSourceClick = (src) => {
  if (!canNavigateToSource(src)) return
  
  // Close the item modal and clear itemId from url
  emit('update:visible', false)
  if (route && route.query.itemId) {
    const newQuery = { ...route.query }
    delete newQuery.itemId
    router.replace({ query: newQuery })
  }
  
  setTimeout(() => {
    let targetPath = '/'
    let targetQuery = {}
    
    if (src.type === 'monster') targetPath = '/monsters'
    else if (src.type === 'achievement') targetPath = '/achievements'
    else if (src.type === 'recipe') targetPath = '/items'
    else if (src.type === 'pvp') {
      targetPath = '/rewards'
      targetQuery = { id: src.id || '' }
    }
    else if (src.type === 'hidden') {
      targetPath = '/rewards'
      targetQuery = { id: `hidden-${src.id}` }
    }

    router.push({ path: targetPath, query: Object.keys(targetQuery).length ? targetQuery : undefined })
  }, 300)
}

const PREVIEW_AVAILABLE_IDS = new Set([
  'item_30022', 'item_30023', 'item_30024', 'item_30025', 'item_30026', 'item_30027', 
  'item_30028', 'item_30029', 'item_30030', 'item_30031', 'item_30032', 'item_30033',
  'item_30034', 'item_30035', 'item_30036', 'item_30037', 'item_30038', 'item_30039',
  'item_30040', 'item_30041', 'item_30042', 'item_30043', 'item_30044', 'item_30046',
  'item_30047', 'item_30048'
])

const GENERIC_FOOD_TYPE_MAP = {
  '1': { typeId: 'item_10006', name: '兽肉' },
  '2': { typeId: 'item_10056', name: '野菜' },
  '3': { typeId: 'item_10055', name: '浆果' },
  '4': { typeId: 'item_10057', name: '地菇' }
}

const recipeInfo = computed(() => {
  if (!props.item?.typeId) return null
  const m = menuDict.value[props.item.typeId]
  if (!m) return null
  
  const ingredients = []
  if (m.food && Array.isArray(m.food) && m.food.length > 0) {
    m.food.forEach(f => {
      const ingId = f.typeId
      const count = f.num || 1
      const matchedItem = getCachedItem(ingId) || {}
      const ingName = matchedItem.name || ingId
      const ingImgKey = matchedItem.img || ingId
      
      ingredients.push({
        typeId: ingId,
        name: ingName,
        count,
        icon: getImageUrl(`/Common_ItemIcon/${ingImgKey}.png`)
      })
    })
  }
  
  if (m.foodType && Array.isArray(m.foodType) && m.foodType.length > 0) {
    m.foodType.forEach(ft => {
      const genInfo = GENERIC_FOOD_TYPE_MAP[String(ft.type)] || { typeId: 'item_10006', name: '兽肉' }
      const count = ft.num || 1
      const matchedItem = getCachedItem(genInfo.typeId) || {}
      const ingImgKey = matchedItem.img || genInfo.typeId
      
      ingredients.push({
        typeId: genInfo.typeId,
        name: genInfo.name,
        count,
        icon: getImageUrl(`/Common_ItemIcon/${ingImgKey}.png`)
      })
    })
  }
  
  return { ...m, ingredients }
})

const goRecipeSearch = () => {
  if (!props.item?.name) return
  emit('update:visible', false)
  router.push({ path: '/recipes', query: { q: props.item.name } })
}

const handleIngredientClick = (typeId) => {
  const targetItem = getCachedItem(typeId)
  if (targetItem) {
    pushItemDetail(targetItem)
  }
}
</script>

<style scoped>
:deep(.value-highlight) {
  color: #3b82f6;
  font-weight: bold;
}

.recipe-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 12px;
  flex-wrap: wrap;
}
.recipe-ingredients-mini {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}
.ingredient-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.ingredient-chip.clickable {
  cursor: pointer;
  transition: all 0.2s;
}
.ingredient-chip.clickable:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}
.ing-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.ing-name, .ing-count {
  font-size: 13px;
  color: #444;
}
.ing-count {
  color: #3b82f6;
  font-weight: bold;
}
.go-recipe-btn {
  padding: 6px 12px;
  background: var(--primary, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}
.go-recipe-btn:hover {
  opacity: 0.85;
}
.recipe-title {
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}
.book-content-box {
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--bg-card, #fff);
  padding: 12px;
  border: 1px solid rgba(0,0,0,0.05);
}
.origin-section {
  background: var(--bg-card, #fff);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.source-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 12px;
}

.source-group-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-chip {
  display: flex;
  align-items: center;
  padding: 2px 2px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  gap: 12px;
  transition: all 0.2s;
}

.source-group-card {
  background: var(--bg-card, #fff);
  border-color: rgba(59, 130, 246, 0.2);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
}

.source-chip.clickable {
  cursor: pointer;
}

.source-chip.clickable:hover {
  background: rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

.source-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.source-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.source-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-des {
  font-size: 12px;
  color: var(--text-sub, #666);
  margin-top: 2px;
}

.source-toggle-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-sub, #888);
  transition: transform 0.3s ease;
}

.source-toggle-icon.open {
  transform: rotate(180deg);
}

.source-drawer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  margin-left: 8px;
  margin-right: 8px;
}

.source-drawer-grid.drawer-open {
  max-height: 1000px;
  opacity: 1;
}

.drawer-chip {
  background: rgba(255,255,255,0.8);
  border-color: rgba(0,0,0,0.03);
  margin-bottom: 0;
  padding: 8px 12px;
}

.drawer-chip:hover {
  background: rgba(255,255,255,1);
}

.drawer-icon-placeholder {
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.source-action-text {
  font-size: 13px;
  color: var(--text-sub, #666);
  white-space: nowrap;
}
.book-para {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin-bottom: 8px;
  text-indent: 2em;
}
.recipe-preview-box {
  margin-top: 12px;
  border-radius: 8px;
   /* background: var(--bg-card, #fff);*/
  padding: 12px;
  /* 取消整体居中 */
  text-align: left;
}
.recipe-preview-box .recipe-title {
  text-align: left;
}
.recipe-prev-img {
  max-width: 380px; /* 自定义最大宽度 */
  height: auto;     /* 高度自适应 */
  object-fit: contain;
  border-radius: 12px;
  display: block;
}

.item-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-color, #f5f6f8);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 0;
  overflow: hidden;
}

.item-modal-content {
  background: var(--bg-color, #f5f6f8);
  width: 100%;
  max-width: none;
  height: 100%;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-sub, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--primary, #3b82f6);
  background-color: var(--bg-hover, rgba(0,0,0,0.05));
}

.modal-header {
  padding: 24px;
  display: flex;
  gap: 20px;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.1);
}

.item-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.header-info {
  flex: 1;
}

.item-name {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: bold;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-color, #333);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.copy-tag {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;
}

.copy-tag:active {
  opacity: 0.5;
}

.modal-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-color, #fff);
  color: var(--text-color, #333);
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  font-size: 15px;
  margin: 0 0 12px;
  color: var(--text-color, #333);
  border-left: 4px solid #a3c4f3;
  padding-left: 8px;
}

.desc-section p {
  font-size: 14px;
  line-height: 1.6;
  color: #666;
  white-space: pre-wrap;
}

.attr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.attr-item {
  background: rgba(0, 0, 0, 0.03);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.attr-name {
  color: #666;
}

.attr-val {
  font-weight: bold;
  color: #2b8a2b;
}

.equip-meta {
  font-size: 13px;
  color: #666;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.origin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.02);
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.origin-val {
  font-size: 14px;
  color: #444;
}

.go-battle-btn {
  background: #a3c4f3;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.empty-tip {
  color: var(--text-sub);
  font-size: 13px;
}

/* 掉落物/奖励区样式 */
.reward-section {
  margin-top: 16px;
}
.reward-group {
  margin-top: 12px;
  background: rgba(0,0,0,0.02);
  padding: 10px;
  border-radius: 8px;
}
.group-title {
  font-size: 13px;
  color: var(--text-sub);
  margin-bottom: 8px;
  font-weight: 500;
}
.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}
.reward-item-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card, #fff);
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.reward-item-card.clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}
.reward-item-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-color: var(--primary, #3b82f6);
}
.r-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.r-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}
.r-info {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  line-height: 1.2;
}
.r-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
.r-qty {
  color: var(--text-main);
  margin-top: 2px;
}
.r-prob {
  color: var(--text-sub);
  font-size: 11px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
