<template>
  <UiModal
    :visible="visible"
    :title="item?.name || '物品详情'"
    max-width="820px"
    scroll-id="itemModalScroll"
    :z-index="3000"
    @update:visible="handleClose"
  >
    <template v-if="item">
    <!-- 顶部信息区（品质色） -->
    <div class="item-head" :class="`quality-bg-${item.quality}`">
      <div class="icon-wrapper" :class="`quality-bg-${item.quality}`">
        <img :src="getImageUrl(getItemImageUrl(item))" :alt="item.name" class="item-icon" loading="lazy" />
      </div>
      <div class="head-info">
        <h2 class="item-name" :class="item.quality ? `quality-text-${item.quality}` : ''">
          {{ item.name }}
        </h2>
        <div class="item-tags">
          <UiTag class="copy-tag" @click="copyId(item.typeId)" title="点击复制 ID">ID: {{ item.typeId }}</UiTag>
          <UiTag v-if="categoryName">{{ categoryName }}</UiTag>
          <UiTag v-if="item.maxNum > 1">可堆叠 ({{ item.maxNum }})</UiTag>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <UiSection v-if="item.desc" title="描述">
      <p class="desc-text">{{ item.desc }}</p>
    </UiSection>

    <!-- 装备属性 -->
    <UiSection v-if="item.itemType === 2 && item.equip" title="装备属性">
      <div class="equip-meta-list">
        <div class="equip-meta-item" v-if="item.equip.equipLevel">
          <span class="meta-label">装备品阶:</span>
          <span class="meta-val">{{ item.equip.equipLevel }}</span>
        </div>
        <div class="equip-meta-item" v-if="jobList && jobList.length > 0">
          <span class="meta-label">适用职业:</span>
          <div class="job-tags">
            <UiTag v-for="job in jobList" :key="job" tone="accent">{{ job }}</UiTag>
          </div>
        </div>
        <div class="equip-meta-item">
          <span class="meta-label">品质属性:</span>
          <div class="equip-quality-toggles">
            <UiFilterPill
              v-for="(name, q) in {1: '白', 2: '绿', 3: '蓝', 4: '紫', 5: '橙'}"
              :key="q"
              :quality="Number(q)"
              :active="selectedAttrQuality == q"
              @click="selectedAttrQuality = Number(q)"
            >
              {{ name }}
            </UiFilterPill>
          </div>
        </div>
      </div>

      <UiStatGrid v-if="computedUnitData" :items="computedUnitItems" />
    </UiSection>

    <!-- 使用效果 / 内容展示 -->
    <UiSection
      v-if="item.useDes || recipeInfo || bookContent"
      :title="(bookContent && !item.useDes && !recipeInfo) ? '内容展示' : '使用效果'"
    >
      <!-- 书籍内容 -->
      <div v-if="bookContent" class="book-content-box paper-panel-solid">
        <template v-for="(para, i) in bookContent.split('\n')" :key="i">
          <p v-if="para.trim()" class="book-para">{{ para.trim() }}</p>
        </template>
      </div>

      <p v-if="item.useDes" class="use-des" v-html="formatUseDes(item.useDes)"></p>
      
      <div v-if="recipeInfo" class="recipe-container">
        <div class="recipe-title">配方</div>
        <div class="recipe-ingredients-mini" v-if="recipeInfo.ingredients && recipeInfo.ingredients.length">
          <div
            v-for="(ing, idx) in recipeInfo.ingredients"
            :key="idx"
            class="ingredient-chip"
            @click="handleIngredientClick(ing.typeId)"
          >
            <img :src="ing.icon" :alt="ing.name" class="ing-icon-img" loading="lazy" />
            <span class="ing-name">{{ ing.name }}</span>
            <span class="ing-count">× {{ ing.count }}</span>
          </div>
        </div>
      </div>
      
      <!-- 预览图 -->
      <div v-if="recipeInfo && PREVIEW_AVAILABLE_IDS.has(recipeInfo.typeId)" class="recipe-preview-box">
        <div class="recipe-title">预览图</div>
        <img :src="getImageUrl(`/menu_prev/${recipeInfo.typeId}_prev.png`)" alt="预览图" class="recipe-prev-img" />
      </div>
    </UiSection>

    <!-- 符石效果 -->
    <UiSection v-if="runeEffect" :title="'符石效果：' + runeEffect.skillName">
      <div class="rune-effect-box paper-panel-solid" v-html="runeEffect.desHtml"></div>
    </UiSection>

    <!-- 宝箱/奖励掉落 -->
    <UiSection v-if="rewardDrops && rewardDrops.length > 0" title="使用效果">
      <div v-for="(group, idx) in rewardDrops" :key="idx" class="reward-group paper-panel-solid">
        <div class="group-title">
          <UiTag v-if="group.isSelect" tone="gold">[自选池] 从以下奖励中自选 1 个</UiTag>
          <UiTag v-else-if="group.rate < 1" tone="gold">[概率池] {{ (group.rate * 100).toFixed(1) }}% 概率从以下奖励中抽取 1 个</UiTag>
          <UiTag v-else tone="gold">[必出池] 从以下奖励中抽取 1 个</UiTag>
          <span v-if="group.num > 1 && !group.isSelect" class="pool-num">(抽取 {{ group.num }} 次)</span>
        </div>
        <div class="reward-grid">
          <UiRewardCard
            v-for="(rule, rIdx) in group.rules"
            :key="rIdx"
            :rule="{ ...rule, targetImg: getImageUrl(rule.targetImg) }"
            :clickable="!!rule.typeId"
            @click="handleRewardClick(rule)"
          />
        </div>
      </div>
    </UiSection>

    <!-- 装备组展示 -->
    <UiSection v-if="equipGroupItems && equipGroupItems.length > 0 && !isEquipsPage" title="包含内容">
      <div class="reward-grid">
        <UiRewardCard
          v-for="(rule, rIdx) in equipGroupItems"
          :key="rIdx"
          :rule="{ ...rule, targetImg: getImageUrl(rule.targetImg) }"
          :clickable="!!rule.typeId"
          @click="handleRewardClick(rule)"
        />
      </div>
    </UiSection>

    <!-- 套装效果 -->
    <UiSection v-if="suitInfo" :title="suitInfo.suitName">
      <div class="suit-items-title">同套装装备</div>
      <div class="reward-grid">
        <UiRewardCard
          v-for="(rule, rIdx) in suitInfo.suitItems"
          :key="rIdx"
          :rule="{ ...rule, targetImg: getImageUrl(rule.targetImg) }"
          :clickable="!!rule.typeId"
          @click="handleRewardClick(rule)"
        />
      </div>
      <div class="suit-effects-list paper-panel-solid">
        <div v-for="(eff, eIdx) in suitInfo.suitEffects" :key="eIdx" class="suit-effect-row">
          <span class="suit-num-badge">【{{ eff.num }}件套】</span>
          <span class="suit-desc" v-html="eff.desHtml"></span>
        </div>
      </div>
    </UiSection>

    <!-- 词条效果 (可携带效果) -->
    <UiSection v-if="affixGroups" title="可携带效果">
      <div class="affix-groups-list">
        <div v-for="(group, gIdx) in affixGroups" :key="gIdx" class="affix-group-block paper-panel-solid">
          <div v-for="(affix, aIdx) in group.prefixes" :key="aIdx" class="affix-row">
            <div class="affix-name">{{ affix.skillName }}</div>
            <div class="affix-desc" v-html="affix.desHtml"></div>
          </div>
        </div>
      </div>
    </UiSection>

    <!-- 解锁内容 -->
    <UiSection v-if="unlockText" title="解锁内容">
      <p class="unlock-text">{{ unlockText }}</p>
    </UiSection>

    <!-- 基础信息 -->
    <UiSection v-if="item.sellable" title="基础信息">
      <UiInfoRow label="售价" :value="item.sellPrice + ' 银币'" />
    </UiSection>

    <!-- 获取途径 -->
    <UiSection v-if="!isEquipsPage" title="获取途径">
      <div v-if="hasItemSources" class="source-list">
        <UiAccordion
          v-for="group in groupedSources"
          :key="group.name"
          :model-value="!!expandedSourceGroups[group.name]"
          @update:model-value="(v) => expandedSourceGroups[group.name] = v"
        >
          <template #title>
            <span class="source-group-name">{{ group.name }}</span>
          </template>
          <div class="source-drawer-grid">
            <div
              v-for="(src, idx) in group.sources"
              :key="idx"
              class="drawer-chip"
              :class="{ clickable: canNavigateToSource(src) }"
              @click="handleSourceClick(src)"
            >
              <div class="source-info">
                <span class="source-name">{{ src.name }}</span>
                <span class="source-des" v-if="src.des">{{ src.des }}</span>
              </div>
              <span class="source-action-text" v-if="canNavigateToSource(src)">前往 ▸</span>
            </div>
          </div>
        </UiAccordion>
      </div>

      <div v-else-if="item.origin && item.origin.length > 0">
        <div v-for="(org, idx) in item.origin" :key="idx" class="origin-item ui-list-row">
          <span class="origin-val">{{ org.value || org }}</span>
          <UiButton v-if="org.battleId" variant="secondary" size="sm">前往</UiButton>
        </div>
      </div>

      <div v-else class="origin-placeholder">
        <p class="empty-tip">数据未补充...</p>
      </div>
    </UiSection>

    <UiBackToTop scroll-container="#itemModalScroll" />
    </template>
  </UiModal>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getImageUrl } from '../utils/env'
import { translateJobArray, translateAttr, translateCategory, parseItemUnlocks, getItemImageUrl, parseItemRewards, getCachedItem, getCachedItemDict, parseRuneEffect, parseEquipGroup, parseEquipSuit, parseItemAffixes } from '../utils/itemParser'
import { pushItemDetail, popItemDetail } from '../utils/itemModalState'
import { fetchWithFallback } from '../utils/request.js'
import { PREVIEW_AVAILABLE_IDS, buildRecipeIngredients } from '../utils/recipeUtils'
import { formatHighlightedText } from '../utils/gameMappings.js'
import { compareExchangeSources } from '../utils/exchangeData.js'
import { UiModal, UiSection, UiTag, UiInfoRow, UiButton, UiFilterPill, UiStatGrid, UiRewardCard, UiAccordion, UiBackToTop } from './ui/index.js'

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

const isEquipsPage = computed(() => route.path === '/equip')

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

const jobList = computed(() => {
  if (!props.item?.equip?.job) return []
  return translateJobArray(props.item.equip.job)
})

const unlockText = computed(() => {
  return parseItemUnlocks(props.item)
})

const runeEffect = computed(() => {
  return parseRuneEffect(props.item)
})

const equipGroupItems = computed(() => {
  return parseEquipGroup(props.item)
})

const suitInfo = computed(() => {
  return parseEquipSuit(props.item)
})

// === 装备属性计算 ===
const QUALITY_ADDITION = {
  1: { permin: 0.9, permax: 0.95 },
  2: { permin: 0.95, permax: 1.0 },
  3: { permin: 1.0, permax: 1.1 },
  4: { permin: 1.1, permax: 1.2 },
  5: { permin: 1.3, permax: 1.35 },
  6: { permin: 1.45, permax: 1.45 }
}
const EQUIP_LEVEL_ADDITION = {
  1: 1.0, 2: 1.25, 3: 1.5, 4: 1.75, 5: 2.0
}
const MULTIPLIER_ATTRS = new Set(['phyAtk', 'magicAtk', 'phyDef', 'magicDef', 'maxHp'])

const selectedAttrQuality = ref(5)

watch(() => props.item, (newVal) => {
  if (newVal) {
    selectedAttrQuality.value = 5
  }
}, { immediate: true })

const computedUnitData = computed(() => {
  if (!props.item?.equip?.unitData) return null;
  const rawData = props.item.equip.unitData;
  const equipLevel = props.item.equip.equipLevel || 1;
  
  const levelMult = EQUIP_LEVEL_ADDITION[equipLevel] || 1.0;
  const qualData = QUALITY_ADDITION[selectedAttrQuality.value] || QUALITY_ADDITION[1];
  const minMult = levelMult * qualData.permin;
  const maxMult = levelMult * qualData.permax;

  const result = {};
  for (const [key, val] of Object.entries(rawData)) {
    if (MULTIPLIER_ATTRS.has(key)) {
      const minVal = Math.floor(val * minMult);
      const maxVal = Math.floor(val * maxMult);
      result[key] = minVal === maxVal ? `+${minVal}` : `+${minVal}~${maxVal}`;
    } else {
      result[key] = `+${val}`;
    }
  }
  return result;
})

const computedUnitItems = computed(() => {
  if (!computedUnitData.value) return []
  return Object.entries(computedUnitData.value).map(([key, val]) => ({
    label: translateAttr(key),
    value: val,
    tone: 2
  }))
})
// ===================

const affixGroups = computed(() => {
  return parseItemAffixes(props.item)
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

const formatUseDes = (text) => formatHighlightedText(text)

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
    const srcRes = await fetchWithFallback('data/parsed/item-sources.json')
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
    achievement: { name: '成就', sources: [] },
    task: { name: '任务', sources: [] },
    pvp: { name: '挑战赛', sources: [] },
    monster: { name: '怪物掉落', sources: [] },
    recipe: { name: '配方制作', sources: [] },
    exchange: { name: '兑换', sources: [] },
    hidden: { name: '被隐藏的物品', sources: [] },
    other: { name: '其他', sources: [] }
  }
  
  currentItemSources.value.forEach(src => {
    if (groups[src.type]) {
      groups[src.type].sources.push(src)
    } else {
      groups['other'].sources.push(src)
    }
  })

  // 兑换来源按兑换页分类顺序排列，委托兑换内部复用地图映射顺序。
  groups.exchange.sources.sort(compareExchangeSources)
  
  return Object.values(groups).filter(g => g.sources.length > 0)
})

const expandedSourceGroups = ref({})

watch(currentItemSources, () => {
  expandedSourceGroups.value = {}
  groupedSources.value.forEach(g => {
    expandedSourceGroups.value[g.name] = false // Closed by default
  })
}, { immediate: true })

const hasItemSources = computed(() => currentItemSources.value.length > 0)

const canNavigateToSource = (src) => {
  return ['monster', 'achievement', 'recipe', 'pvp', 'hidden', 'task', 'exchange'].includes(src.type)
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
    else if (src.type === 'achievement') targetPath = '/achievement'
    else if (src.type === 'recipe') {
      targetPath = '/recipes'
      targetQuery = { id: src.id || '' }
    }
    else if (src.type === 'pvp') {
      targetPath = '/rewards'
      targetQuery = { id: src.id || '' }
    }
    else if (src.type === 'hidden') {
      targetPath = '/rewards'
      targetQuery = { id: `hidden-${src.id}` }
    }
    else if (src.type === 'task') {
      targetPath = '/tasks'
      targetQuery = { task: src.id || '' }
    }
    else if (src.type === 'exchange') {
      targetPath = '/exchange'
      targetQuery = {
        cat: src.category || 'entrust',
        sub: src.sub || undefined
      }
    }

    router.push({ path: targetPath, query: Object.keys(targetQuery).length ? targetQuery : undefined })
  }, 300)
}

const recipeInfo = computed(() => {
  if (!props.item?.typeId) return null
  const m = menuDict.value[props.item.typeId]
  if (!m) return null

  const ingredients = buildRecipeIngredients(m, getCachedItemDict()).map(ing => ({
    ...ing,
    icon: getImageUrl(ing.icon)
  }))

  return { ...m, ingredients }
})

const handleIngredientClick = (typeId) => {
  const targetItem = getCachedItem(typeId)
  if (targetItem) {
    pushItemDetail(targetItem)
  }
}
</script>

<style scoped>
/* 顶部品质信息区 */
.item-head {
  display: flex;
  gap: 16px;
  align-items: center;
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 5px;
  padding: 16px;
  margin-bottom: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
}
.icon-wrapper {
  width: 76px;
  height: 76px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(43, 31, 21, 0.2);
}
.item-icon {
  width: 62px;
  height: 62px;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
}
.head-info {
  flex: 1;
  min-width: 0;
}
.item-name {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 700;
  text-shadow: none;
  -webkit-font-smoothing: antialiased;
}
.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.copy-tag {
  cursor: pointer;
  user-select: none;
}
.copy-tag:active {
  opacity: 0.6;
}

.desc-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  white-space: pre-wrap;
  text-align: justify;
}

/* 装备属性 */
.equip-meta-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.equip-meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.meta-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  min-width: 64px;
}
.meta-val {
  font-size: 13px;
  color: var(--text-main, #3e2a14);
}
.equip-quality-toggles, .job-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* 使用效果 */
.use-des {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  white-space: pre-wrap;
}
.book-content-box {
  margin-bottom: 12px;
  padding: 12px 14px;
}
.book-para {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  margin: 0 0 8px;
  text-indent: 2em;
  text-align: justify;
}
.book-para:last-child {
  margin-bottom: 0;
}

/* 配方 */
.recipe-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.recipe-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  letter-spacing: 1px;
}
.recipe-ingredients-mini {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ingredient-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(43, 31, 21, 0.08);
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  cursor: pointer;
  transition: all 0.18s;
  box-shadow: inset 0 1px 2px rgba(43, 31, 21, 0.1);
}
.ingredient-chip:hover {
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
  border-color: var(--accent-bright, #7a9a99);
}
.ing-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.ing-name {
  font-size: 13px;
  color: var(--text-main, #3e2a14);
  font-weight: 600;
}
.ing-count {
  font-size: 13px;
  color: var(--accent-ink, #557574);
  font-weight: 700;
}
.dark-mode .ing-count {
  color: var(--accent-bright, #93b3b2);
}
.recipe-preview-box {
  margin-top: 12px;
  text-align: left;
}
.recipe-preview-box .recipe-title {
  margin-bottom: 8px;
}
.recipe-prev-img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
  border-radius: 6px;
  border: 2px solid var(--border-color, #8f7351);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: block;
}

/* 符石 */
.rune-effect-box {
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
}

/* 奖励 */
.reward-group {
  padding: 12px;
  margin-bottom: 10px;
}
.reward-group:last-child {
  margin-bottom: 0;
}
.group-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.pool-num {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
}
.reward-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

/* 套装 */
.suit-items-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted, #6b5134);
  margin: 0 0 8px;
}
.suit-effects-list {
  margin-top: 12px;
  padding: 12px 14px;
}
.suit-effect-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 1.65;
}
.suit-effect-row:last-child {
  margin-bottom: 0;
}
.suit-num-badge {
  color: var(--accent-ink, #557574);
  font-weight: 700;
  flex-shrink: 0;
}
.dark-mode .suit-num-badge {
  color: var(--accent-bright, #93b3b2);
}
.suit-desc {
  color: var(--text-main, #3e2a14);
}

/* 词条 */
.affix-groups-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.affix-group-block {
  padding: 12px 14px;
}
.affix-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.affix-row:last-child {
  margin-bottom: 0;
}
.affix-name {
  color: var(--accent-ink, #557574);
  font-weight: 700;
  font-size: 14px;
}
.dark-mode .affix-name {
  color: var(--accent-bright, #93b3b2);
}
.affix-desc {
  color: var(--text-main, #3e2a14);
  font-size: 13px;
  line-height: 1.65;
}

.unlock-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-main, #3e2a14);
  white-space: pre-wrap;
}

/* 获取途径 */
.source-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.source-group-name {
  display: inline-flex;
  align-items: center;
}
.source-drawer-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.drawer-chip {
  display: flex;
  align-items: center;
  background: rgba(233, 220, 195, 0.75);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 8px 12px;
  transition: all 0.15s;
}
.dark-mode .drawer-chip {
  background: rgba(63, 48, 32, 0.55);
}
.drawer-chip.clickable {
  cursor: pointer;
}
.drawer-chip.clickable:hover {
  border-color: var(--accent-bright, #7a9a99);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.22);
}
.source-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.source-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main, #3e2a14);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-des {
  font-size: 12px;
  color: var(--text-muted, #6b5134);
  margin-top: 1px;
}
.source-action-text {
  font-size: 12px;
  color: var(--accent-ink, #557574);
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.dark-mode .source-action-text {
  color: var(--accent-bright, #93b3b2);
}
.origin-item {
  margin-bottom: 8px;
}
.origin-val {
  font-size: 14px;
  color: var(--text-main, #3e2a14);
}
.origin-placeholder {
  padding: 8px 0;
}
</style>
