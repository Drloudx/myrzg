<template>
  <UiModal
    :visible="visible"
    :title="item?.name || '物品详情'"
    max-width="820px"
    scroll-id="itemModalScroll"
    :z-index="5000"
    :restore-scroll-top="itemModalState.savedScrollTop"
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

    <UiSection v-if="potionInfo" title="药水毒性">
      <UiInfoRow label="药水毒性" :value="potionInfo.toxicity" />
      <UiInfoRow label="毒性上限" :value="potionInfo.toxicityCap" />
      <UiInfoRow label="距毒性上限" :value="potionInfo.remainingFromZero" />
      <UiInfoRow
        v-if="potionInfo.toxicity > 0 && potionInfo.researchReduction > 0"
        :label="`${potionInfo.researchName}后`"
        :value="`${potionInfo.toxicityWithResearch} 毒性（降低 ${formatPercent(potionInfo.researchReduction)}）`"
      />
      <p v-if="potionInfo.toxicity > 0" class="parameter-note">当前毒性达到上限后，无法继续使用有毒药水。</p>
    </UiSection>

    <UiSection v-if="seedInfo" title="种植参数">
      <UiInfoRow label="成熟时间" :value="seedInfo.formattedGrowTime" />
      <UiInfoRow v-if="seedInfo.harvest" label="基础收获" :value="formatHarvest(seedInfo.harvest)" />
      <UiInfoRow
        v-for="harvest in seedInfo.researchHarvests"
        :key="harvest.level"
        :label="`${seedInfo.researchName} Lv.${harvest.level}`"
        :value="formatHarvest(harvest)"
      />
    </UiSection>

    <UiSection v-if="petEggInfo" title="孵化与收益">
      <UiInfoRow label="孵化时长" :value="petEggInfo.formattedEggTime" />
      <UiInfoRow label="出售金币" :value="`${petEggInfo.sellPrice} 金币`" />
      <UiInfoRow label="喂养经验" :value="`${petEggInfo.feedExp} 经验`" />
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
              v-for="(name, q) in EQUIP_QUALITY_LABELS"
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

      <div v-if="equipEnhanceConfig.maxLevel > 0" class="equip-enhance-control paper-panel-solid">
        <div class="equip-enhance-header">
          <span>强化等级</span>
          <strong>+{{ selectedEnhanceLevel }} / +{{ equipEnhanceConfig.maxLevel }}</strong>
        </div>
        <input
          v-model.number="selectedEnhanceLevel"
          class="equip-enhance-slider"
          type="range"
          min="0"
          :max="equipEnhanceConfig.maxLevel"
          step="1"
          aria-label="装备强化等级"
        />
        <div class="equip-enhance-summary">
          <span>每级基础属性 +{{ enhanceRatePercent }}%</span>
          <span>当前 +{{ enhanceBonusPercent }}%</span>
        </div>
      </div>

      <UiStatGrid v-if="computedUnitItems.length" :items="computedUnitItems" />
    </UiSection>

    <UiSection v-if="facilityCraftingRecipes.length" title="设施制作">
      <div v-for="recipe in facilityCraftingRecipes" :key="recipe.id" class="smithing-recipe paper-panel-solid">
        <div class="smithing-recipe__head">
          <span>{{ recipe.facilityName }} {{ recipe.level }} 级制作</span>
          <UiButton variant="link" size="sm" @click="handleFacilityNavigate(recipe)">查看设施</UiButton>
        </div>
        <p v-if="recipe.makeTime" class="smithing-recipe__output">制作时间：{{ formatCraftingDuration(recipe.makeTime) }}</p>
        <div class="smithing-recipe__materials">
          <span class="smithing-recipe__label">制作材料</span>
          <div class="reward-grid">
            <UiRewardCard
              v-for="material in recipe.materials"
              :key="material.typeId"
              :rule="{ targetName: material.name, targetImg: getImageUrl(material.img), targetQuality: material.quality, min: material.num, max: material.num, typeId: material.typeId }"
              :clickable="!!material.typeId"
              @click="handleSmithingMaterialClick(material.typeId)"
            />
          </div>
        </div>
      </div>
    </UiSection>

    <UiSection v-if="smithingRecipes.length" title="锻造台打造">
      <div v-for="recipe in smithingRecipes" :key="recipe.exchangeId" class="smithing-recipe paper-panel-solid">
        <div class="smithing-recipe__head">
          <span>第 {{ recipe.equipLevel }} 阶装备打造</span>
          <UiButton variant="link" size="sm" @click="handleSmithingNavigate(recipe)">查看锻造台</UiButton>
        </div>
        <div class="smithing-recipe__meta">
          <span>品质概率</span>
          <span v-for="chance in recipe.qualityChances" :key="chance.quality" :class="`quality-text-${chance.quality}`">
            {{ EQUIP_QUALITY_LABELS[chance.quality] || `品质${chance.quality}` }} {{ formatChance(chance.chance) }}
          </span>
        </div>
        <p class="smithing-recipe__output">
          {{ recipe.outputMode === 'equipGroup' ? '同类装备池中随机产出，品质按以上概率决定。' : '打造该装备，品质按以上概率决定。' }}
        </p>
        <div class="smithing-recipe__materials">
          <span class="smithing-recipe__label">制作材料</span>
          <div class="reward-grid">
            <UiRewardCard
              v-for="material in recipe.materials"
              :key="material.typeId"
              :rule="{ targetName: material.name, targetImg: getImageUrl(material.img), targetQuality: material.quality, min: material.num, max: material.num, typeId: material.typeId }"
              :clickable="!!material.typeId"
              @click="handleSmithingMaterialClick(material.typeId)"
            />
          </div>
        </div>
      </div>
    </UiSection>

    <!-- 使用效果 / 料理效果 / 内容展示 -->
    <UiSection
      v-if="displayUseDes || recipeInfo || bookContent || isRecipeItem"
      :title="effectSectionTitle"
    >
      <!-- 书籍内容 -->
      <div v-if="bookContent" class="book-content-box paper-panel-solid">
        <template v-for="(para, i) in bookContent.split('\n')" :key="i">
          <p v-if="para.trim()" class="book-para">{{ para.trim() }}</p>
        </template>
      </div>

      <template v-if="recipeInfo">
        <p v-if="recipeInfo.buffDes" class="use-des" v-html="formatUseDes(recipeInfo.buffDes)"></p>
        <div v-if="recipeInfo.effectStacks > 0" class="recipe-effect-stacks">
          <span>效果层数</span>
          <strong>{{ recipeInfo.effectStacks }}</strong>
        </div>
      </template>
      <p v-else-if="displayUseDes" class="use-des" v-html="formatUseDes(displayUseDes)"></p>
    </UiSection>

    <UiSection v-if="skinUnlock?.attributes?.length" title="皮肤属性">
      <div class="skin-attribute-list">
        <div v-for="attribute in skinUnlock.attributes" :key="attribute.key" class="skin-attribute-row">
          <span>{{ translateStatName(attribute.key) }}</span>
          <strong>{{ formatSkinAttribute(attribute) }}</strong>
        </div>
      </div>
    </UiSection>

    <UiSection v-if="recipeInfo" title="配方">
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
    </UiSection>

    <UiSection v-if="recipeInfo && PREVIEW_AVAILABLE_IDS.has(recipeInfo.typeId)" title="预览图">
      <div class="recipe-preview-box">
        <img :src="getImageUrl(`/menu_prev/${recipeInfo.typeId}_prev.webp`)" alt="预览图" class="recipe-prev-img" />
      </div>
    </UiSection>

    <!-- 符石效果 -->
    <UiSection v-if="runeEffect" :title="'符石效果：' + runeEffect.skillName">
      <div class="rune-effect-box paper-panel-solid" v-html="runeEffect.desHtml"></div>
      <UiInfoRow label="适用部位" :value="runeEffect.positionLabels.join('、')" />
    </UiSection>

    <!-- 宝箱/奖励掉落 -->
    <AcquisitionRewards :acquisition="acquisition" @item-click="handleRewardClick" />

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

    <!-- 用途 / 解锁内容 -->
    <UiSection v-if="unlockText || homeItemUnlocks.length" :title="usageSectionTitle">
      <div v-if="homeItemUnlocks.length" class="home-item-unlock-list">
        <UiButton
          v-for="unlock in homeItemUnlocks"
          :key="`${unlock.action}:${unlock.typeId}:${(unlock.skinIds || []).join(',')}`"
          class="home-item-unlock-link"
          variant="secondary"
          @click="handleHomeItemNavigate(unlock)"
        >
          <span class="home-item-unlock-icon" :class="`quality-bg-${Number(unlock.quality) || 1}`">
            <img
              v-if="unlock.icon"
              :src="getImageUrl(`/BuildItem/${unlock.icon}.webp`)"
              :alt="unlock.name"
              loading="lazy"
            />
          </span>
          <span class="home-item-unlock-copy">
            <strong>{{ unlock.name }}</strong>
            <small v-if="unlock.skinNames?.length">
              {{ unlock.action === 'unlockHomeItemSkin' ? '解锁外观' : '同时解锁外观' }}：{{ unlock.skinNames.join('、') }}
            </small>
            <small v-else>解锁家具</small>
          </span>
          <span class="home-item-unlock-action">查看家具</span>
        </UiButton>
      </div>
      <div v-else-if="heroUnlock" class="unlock-hero-usage">
        <span>解锁角色：</span>
        <UiButton class="unlock-hero-link" variant="link" size="sm" @click="handleHeroNavigate">
          <img
            v-if="heroUnlock.heroIcon"
            :src="getImageUrl(`/images/HeadIconAtals/${heroUnlock.heroIcon}.webp`)"
            :alt="heroUnlock.heroName"
            class="unlock-hero-icon"
          />
          <span class="unlock-hero-name">{{ heroUnlock.heroName }}</span>
          <span aria-hidden="true">›</span>
        </UiButton>
      </div>
      <div v-else-if="skinUnlock" class="unlock-hero-usage">
        <span>解锁皮肤：</span>
        <UiButton class="unlock-hero-link" variant="link" size="sm" @click="handleSkinNavigate">
          <img
            v-if="item.img"
            :src="getImageUrl(getItemImageUrl(item))"
            :alt="skinUnlock.skinName"
            class="unlock-hero-icon"
          />
          <span class="unlock-hero-name">{{ skinUnlock.skinName }}</span>
          <span class="unlock-skin-owner">{{ skinUnlock.heroName }}</span>
          <span aria-hidden="true">›</span>
        </UiButton>
      </div>
      <p v-else class="unlock-text">{{ unlockText }}</p>
      <div v-if="heroStarUsage" class="star-usage-list">
        <div v-for="stage in heroStarUsage.stages" :key="stage.stage" class="star-usage-row">
          <span class="star-usage-label">星阶 {{ stage.stage }}</span>
          <span class="star-usage-value">{{ stage.costs.join('、') }}</span>
        </div>
        <div class="star-usage-total">
          <span>全部所需</span>
          <strong>{{ heroStarUsage.total }}</strong>
        </div>
      </div>
    </UiSection>

    <UiSection v-if="skinUnlock" title="皮肤立绘">
      <div class="skin-portrait-preview" :class="[skinUnlock.quality ? `quality-border-${skinUnlock.quality}` : '', { 'has-model': skinUnlock.modelImage }]">
        <div class="skin-preview-pane">
          <img
            :src="getImageUrl(`/images/chara/l/${skinUnlock.img}.webp`)"
            :alt="`${skinUnlock.skinName}立绘`"
            loading="lazy"
          />
        </div>
        <div v-if="skinUnlock.modelImage" class="skin-preview-pane skin-preview-pane--model">
          <img :src="getImageUrl(skinUnlock.modelImage)" :alt="`${skinUnlock.skinName}小人模型`"
            loading="lazy" decoding="async" @error="handleImageFallback" />
        </div>
      </div>
    </UiSection>

    <!-- 基础信息 -->
    <UiSection v-if="item.sellable" title="基础信息">
      <UiInfoRow label="售价" :value="item.sellPrice + ' 银币'" />
    </UiSection>

    <!-- 获取途径 -->
    <UiSection title="获取途径">
      <div v-if="sharedResourcesLoading" class="empty-tip" role="status">来源与配方加载中...</div>
      <div v-else-if="sharedResourcesError" class="resource-load-error" role="alert">
        <p>{{ sharedResourcesError }}</p>
        <UiButton variant="secondary" size="sm" @click="loadSharedResources">重新加载</UiButton>
      </div>
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

      <div v-else-if="!sharedResourcesLoading && !sharedResourcesError" class="origin-placeholder">
        <p class="empty-tip">数据未补充...</p>
      </div>
    </UiSection>

    <UiBackToTop scroll-container="#itemModalScroll" />
    </template>
  </UiModal>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getImageUrl, handleImageFallback } from '../utils/env'
import { translateJobArray, translateAttr, translateCategory, parseItemUnlocks, getItemImageUrl, getItemAcquisition, getCachedItem, parseRuneEffect, parseEquipGroup, parseEquipSuit, parseItemAffixes, calculateEquipAttributeRange, buildEquipAttributeItems, getEquipEnhanceConfig } from '../utils/itemParser'
import AcquisitionRewards from './AcquisitionRewards.vue'
import { getRuneSourceTarget } from '../utils/runeData.js'
import { pushItemDetail, popItemDetail, itemModalState } from '../utils/itemModalState'
import { fetchWithFallback } from '../utils/request.js'
import { PREVIEW_AVAILABLE_IDS } from '../utils/recipeUtils'
import { formatHighlightedText, EQUIP_QUALITY_LABELS, translateStatName } from '../utils/gameMappings.js'
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
let bodyScrollOperation = 0
let bodyScrollFrame = 0

const isEquipsPage = computed(() => route.path === '/equip')

const cancelBodyScrollRestore = () => {
  bodyScrollOperation += 1
  if (!bodyScrollFrame) return
  cancelAnimationFrame(bodyScrollFrame)
  bodyScrollFrame = 0
}

const getModalBody = () => document.getElementById('itemModalScroll')

const setModalBodyScroll = async (top, expectedTypeId) => {
  cancelBodyScrollRestore()
  const operation = bodyScrollOperation
  const normalizedTop = Math.max(0, Number(top) || 0)

  await nextTick()
  const restore = () => {
    if (
      operation !== bodyScrollOperation ||
      !props.visible ||
      props.item?.typeId !== expectedTypeId
    ) return

    getModalBody()?.scrollTo({ top: normalizedTop, behavior: 'auto' })
  }

  restore()
  bodyScrollFrame = requestAnimationFrame(() => {
    bodyScrollFrame = 0
    restore()
  })
}

const openNestedItem = targetItem => {
  if (!targetItem) return

  const currentBodyScrollTop = getModalBody()?.scrollTop || 0
  pushItemDetail(targetItem, currentBodyScrollTop)
  setModalBodyScroll(0, targetItem.typeId)
}

const handleClose = () => {
  const previous = popItemDetail()
  if (previous) {
    setModalBodyScroll(previous.bodyScrollTop, previous.item.typeId)
    return
  }

  cancelBodyScrollRestore()

  emit('update:visible', false)
  if (route && route.query.itemId) {
    const newQuery = { ...route.query }
    delete newQuery.itemId
    router.replace({ query: newQuery })
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

const heroStarUsage = computed(() => props.item?.heroStarUsage || null)
const heroUnlock = computed(() => props.item?.heroUnlock || null)
const skinUnlock = computed(() => props.item?.skinUnlock || null)
const homeItemUnlocks = computed(() => (props.item?.homeItemUnlocks || [])
  .filter(unlock => unlock?.typeId && unlock.catalogVisible !== false))
const potionInfo = computed(() => props.item?.potionInfo || null)
const seedInfo = computed(() => props.item?.seedInfo || null)
const petEggInfo = computed(() => props.item?.petEggInfo || null)
const smithingRecipes = computed(() => props.item?.smithing?.recipes || [])
const facilityCraftingRecipes = computed(() => props.item?.facilityCrafting || [])
const usageSectionTitle = computed(() =>
  heroStarUsage.value || heroUnlock.value ? '用途' : '解锁内容'
)

const handleHomeItemNavigate = unlock => {
  if (!unlock?.typeId) return
  router
    .push({ path: '/furniture', query: { id: unlock.typeId } })
    .finally(() => emit('update:visible', false))
}

const handleHeroNavigate = () => {
  const heroTypeId = heroUnlock.value?.heroTypeId
  if (!heroTypeId) return
  router.push({ path: '/heroes', query: { id: heroTypeId } })
}

const handleSkinNavigate = () => {
  const heroTypeId = skinUnlock.value?.heroTypeId
  if (!heroTypeId) return
  router.push({ path: '/heroes', query: { id: heroTypeId, tab: 'skins' } })
}

const handleSmithingNavigate = recipe => {
  router.push({
    path: '/facilities',
    query: {
      facility: 'blacksmith',
      mode: 'equipment',
      level: recipe?.equipLevel || 1,
      item: props.item?.typeId || undefined
    }
  }).finally(() => emit('update:visible', false))
}

const handleFacilityNavigate = recipe => {
  if (!recipe?.facility) return
  router.push({
    path: '/facilities',
    query: {
      facility: recipe.facility,
      mode: 'crafting',
      level: recipe.level || 1,
      item: props.item?.typeId || undefined
    }
  }).finally(() => emit('update:visible', false))
}

const handleSmithingMaterialClick = typeId => {
  const targetItem = getCachedItem(typeId)
  if (targetItem) openNestedItem(targetItem)
}

const formatChance = chance => `${Number((Number(chance || 0) * 100).toFixed(1))}%`
const formatCraftingDuration = seconds => {
  const value = Number(seconds) || 0
  if (value < 60) return `${value} 秒`
  const minutes = Math.floor(value / 60)
  const remain = value % 60
  return `${minutes} 分${remain ? `${remain} 秒` : ''}`
}

const formatSkinAttribute = attribute => {
  const values = []
  if (attribute.baseValue) values.push(`+${attribute.baseValue}`)
  if (attribute.percent) {
    const percent = Math.abs(attribute.percent) <= 1 ? attribute.percent * 100 : attribute.percent
    values.push(`+${Number(percent.toFixed(2))}%`)
  }
  return values.join(' / ')
}

const formatPercent = value => `${Number((Number(value) * 100).toFixed(2))}%`
const formatHarvest = harvest => {
  if (!harvest) return ''
  const quantity = harvest.min === harvest.max ? `${harvest.min}` : `${harvest.min}～${harvest.max}`
  return `${harvest.name} × ${quantity}`
}

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
const selectedAttrQuality = ref(5)
const selectedEnhanceLevel = ref(0)
const equipEnhanceConfig = computed(() => getEquipEnhanceConfig())
const enhanceRatePercent = computed(() => Math.round(equipEnhanceConfig.value.attUp * 100))
const enhanceBonusPercent = computed(() => Math.round(selectedEnhanceLevel.value * equipEnhanceConfig.value.attUp * 100))

watch(() => props.item, (newVal) => {
  if (newVal) {
    selectedAttrQuality.value = 5
    selectedEnhanceLevel.value = 0
  }
}, { immediate: true })

const computedUnitData = computed(() => {
  return calculateEquipAttributeRange(
    props.item,
    selectedAttrQuality.value,
    selectedEnhanceLevel.value
  )
})

const computedUnitItems = computed(() => {
  if (!computedUnitData.value) return []
  return buildEquipAttributeItems(computedUnitData.value).map(attribute => ({
    label: translateAttr(attribute.key),
    value: attribute.min === attribute.max ? `+${attribute.min}` : `+${attribute.min}~${attribute.max}`,
    tone: 2
  }))
})
// ===================

const affixGroups = computed(() => {
  return parseItemAffixes(props.item)
})

const acquisition = computed(() => getItemAcquisition(props.item))

const handleRewardClick = (rule) => {
  if (rule.typeId) {
    const targetItem = getCachedItem(rule.typeId)
    if (targetItem) {
      openNestedItem(targetItem)
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
        const res = await fetchWithFallback('data/parsed/diary.json')
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

// Failed resources remain retryable; successful resources are cached by request.js.
let sharedResourcesLoaded = false
let sharedResourcesPending = null
const sharedResourcesLoading = ref(false)
const sharedResourcesError = ref('')
const loadSharedResources = () => {
  if (sharedResourcesLoaded) return Promise.resolve()
  if (sharedResourcesPending) return sharedResourcesPending
  sharedResourcesLoading.value = true
  sharedResourcesError.value = ''
  sharedResourcesPending = Promise.all([
    fetchWithFallback('data/parsed/recipes.json').then(data => {
      menuDict.value = Object.fromEntries(data.recipes.map(recipe => [recipe.id, recipe]))
    }),
    fetchWithFallback('data/parsed/item-sources.json').then(data => { globalItemSources.value = data })
  ]).then(() => {
    sharedResourcesLoaded = true
  }).catch(error => {
    sharedResourcesError.value = '部分来源或配方暂时无法加载，请重试。'
    console.error('Failed to load item detail resources:', error)
  }).finally(() => {
    sharedResourcesPending = null
    sharedResourcesLoading.value = false
  })
  return sharedResourcesPending
}

watch(() => props.visible, (v) => { if (v) loadSharedResources() }, { immediate: true })

const currentItemSources = computed(() => {
  if (!props.item?.typeId) return []
  const sources = [...(globalItemSources.value?.[props.item.typeId] || [])]
  const recipe = smithingRecipes.value[0]
  if (recipe) {
    sources.unshift({
      type: 'smithing',
      id: recipe.facilityId || 'sysBlacksmith',
      name: recipe.facilityName || '锻造台',
      des: `第 ${recipe.equipLevel} 阶装备打造`
    })
  }
  for (const facilityRecipe of facilityCraftingRecipes.value) {
    sources.unshift({
      type: 'facility',
      id: facilityRecipe.facilityId,
      facility: facilityRecipe.facility,
      name: facilityRecipe.facilityName,
      level: facilityRecipe.level,
      des: `${facilityRecipe.level} 级制作`
    })
  }
  return sources
})

const groupedSources = computed(() => {
  const groups = {
    achievement: { name: '成就', sources: [] },
    task: { name: '任务', sources: [] },
    event: { name: '随机事件', sources: [] },
    explore: { name: '探索区域', sources: [] },
    collect: { name: '采集', sources: [] },
    plant: { name: '种植', sources: [] },
    camp: { name: '营地升级', sources: [] },
    activity: { name: '活动奖励', sources: [] },
    signIn: { name: '签到奖励', sources: [] },
    firstReward: { name: '关卡首通', sources: [] },
    guide: { name: '新手引导', sources: [] },
    container: { name: '礼包与道具', sources: [] },
    dailyPlan: { name: '日常计划', sources: [] },
    gacha: { name: '招募与贩售', sources: [] },
    tower: { name: '塔层奖励', sources: [] },
    dismantle: { name: '装备分解', sources: [] },
    pvp: { name: '挑战赛', sources: [] },
    monster: { name: '怪物掉落', sources: [] },
    recipe: { name: '配方制作', sources: [] },
    exchange: { name: '兑换', sources: [] },
    runeAppraisal: { name: '符石鉴定', sources: [] },
    runeSynthesis: { name: '符石合成', sources: [] },
    dungeon: { name: '副本掉落', sources: [] },
    smithing: { name: '锻造台制作', sources: [] },
    facility: { name: '设施制作', sources: [] },
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

  // 保留关卡首次出现顺序；同一关卡内部按金、银、铜宝箱排列。
  const dungeonBattleOrder = new Map()
  groups.dungeon.sources.forEach((source, index) => {
    if (!dungeonBattleOrder.has(source.id)) dungeonBattleOrder.set(source.id, index)
  })
  const chestOrder = { 'chest-3': 0, 'chest-2': 1, 'chest-1': 2 }
  groups.dungeon.sources.sort((a, b) => {
    const battleDiff = dungeonBattleOrder.get(a.id) - dungeonBattleOrder.get(b.id)
    if (battleDiff) return battleDiff
    return (chestOrder[a.dropEntry] ?? 99) - (chestOrder[b.dropEntry] ?? 99)
  })
  
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
  if (getRuneSourceTarget(src)) return true
  return ['monster', 'achievement', 'recipe', 'pvp', 'hidden', 'task', 'exchange', 'dungeon', 'smithing', 'facility', 'event', 'explore', 'plant', 'camp', 'container'].includes(src.type)
}

const handleSourceClick = (src) => {
  if (!canNavigateToSource(src)) return

  let targetPath = '/'
  let targetQuery = {}

  const runeTarget = getRuneSourceTarget(src)
  if (runeTarget) {
    targetPath = runeTarget.path
    targetQuery = runeTarget.query
  }
  else if (src.type === 'monster') {
    targetPath = '/monsters'
    targetQuery = { id: src.id }
  }
  else if (src.type === 'event' || src.type === 'explore') {
    targetPath = '/events'
    targetQuery = { [src.type]: src.id }
  }
  else if (src.type === 'plant' || src.type === 'container') {
    const seed = getCachedItem(src.type === 'container' ? src.sourceItemId : src.seedId)
    if (seed) openNestedItem(seed)
    return
  }
  else if (src.type === 'camp') {
    targetPath = '/facilities'
    targetQuery = { facility: 'camp', mode: 'building', building: src.building, level: src.level }
  }
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
  else if (src.type === 'dungeon') {
    targetPath = '/dungeons'
    targetQuery = {
      battle: src.id || '',
      drop: src.itemId || props.item?.typeId || '',
      dropTab: src.dropTab || 'chest',
      dropEntry: src.dropEntry || ''
    }
  }
  else if (src.type === 'smithing') {
    targetPath = '/facilities'
    targetQuery = { facility: 'blacksmith', mode: 'equipment', level: smithingRecipes.value[0]?.equipLevel || 1, item: props.item?.typeId || '' }
  }
  else if (src.type === 'facility') {
    targetPath = '/facilities'
    targetQuery = { facility: src.facility || 'workbench', mode: 'crafting', level: src.level || 1, item: props.item?.typeId || '' }
  }

  router
    .push({ path: targetPath, query: Object.keys(targetQuery).length ? targetQuery : undefined })
    .finally(() => emit('update:visible', false))
}

const recipeInfo = computed(() => {
  if (!props.item?.typeId) return null
  const recipe = menuDict.value[props.item.typeId]
  if (!recipe) return null

  const ingredients = (recipe.ingredients || []).map(ing => ({
    ...ing,
    icon: getImageUrl(ing.icon)
  }))

  return { ...recipe, typeId: recipe.id, ingredients }
})

// 料理的 useDes 是旧版展示文案，实际结算和现版本界面均以绑定 Buff 为准。
const isRecipeItem = computed(() => {
  const buffId = props.item?.useActionPara2?.buff || ''
  return !!recipeInfo.value || buffId.startsWith('cook_')
})
const displayUseDes = computed(() => isRecipeItem.value ? '' : (props.item?.useDes || ''))
const effectSectionTitle = computed(() => {
  if (isRecipeItem.value) return '料理效果'
  if (bookContent.value && !displayUseDes.value) return '内容展示'
  return '使用效果'
})

const handleIngredientClick = (typeId) => {
  const targetItem = getCachedItem(typeId)
  if (targetItem) {
    openNestedItem(targetItem)
  }
}

watch(() => props.visible, visible => {
  if (!visible) cancelBodyScrollRestore()
})

onBeforeUnmount(cancelBodyScrollRestore)
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

.parameter-note {
  margin: 8px 2px 0;
  color: var(--text-muted, #6b5134);
  font-size: 12px;
  line-height: 1.6;
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
.equip-enhance-control {
  margin: 0 0 12px;
  padding: 11px 13px;
}
.equip-enhance-header,
.equip-enhance-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.smithing-recipe {
  padding: 11px 12px;
  margin-bottom: 10px;
}
.smithing-recipe:last-child {
  margin-bottom: 0;
}
.smithing-recipe__head,
.smithing-recipe__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.smithing-recipe__head {
  justify-content: space-between;
  color: var(--text-main, #3e2a14);
  font-size: 14px;
  font-weight: 700;
}
.smithing-recipe__meta {
  margin-top: 5px;
  color: var(--text-muted, #6b5134);
  font-size: 13px;
}
.smithing-recipe__meta > span:not(:first-child) {
  font-weight: 700;
}
.smithing-recipe__output {
  margin: 5px 0 0;
  color: var(--text-muted, #6b5134);
  font-size: 13px;
  line-height: 1.6;
}
.smithing-recipe__materials {
  margin-top: 10px;
}
.smithing-recipe__label {
  display: block;
  margin-bottom: 7px;
  color: var(--text-muted, #6b5134);
  font-size: 13px;
  font-weight: 700;
}
.smithing-recipe .reward-grid {
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
}
.equip-enhance-header {
  margin-bottom: 9px;
  color: var(--text-main, #3e2a14);
  font-size: 13px;
  font-weight: 700;
}
.equip-enhance-header strong {
  color: var(--accent-ink, #557574);
}
.equip-enhance-slider {
  display: block;
  width: 100%;
  height: 6px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--accent-bright, #7a9a99);
}
.equip-enhance-summary {
  margin-top: 9px;
  color: var(--text-muted, #6b5134);
  font-size: 12px;
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

/* 料理效果 / 配方 */
.recipe-effect-stacks {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 7px 2px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  color: var(--text-muted, #6b5134);
  font-size: 14px;
  font-weight: 700;
}
.recipe-effect-stacks strong {
  color: var(--accent-ink, #557574);
}
.skin-attribute-list {
  display: flex;
  flex-direction: column;
}
.skin-attribute-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 2px;
  border-bottom: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  color: var(--text-muted, #6b5134);
  font-size: 14px;
  font-weight: 700;
}
.skin-attribute-row:last-child {
  border-bottom: 0;
}
.skin-attribute-row strong {
  color: var(--accent-ink, #557574);
}
.unlock-skin-owner {
  color: var(--text-muted, #6b5134);
  font-size: 12px;
  font-weight: 400;
}
.skin-portrait-preview {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 360px;
  overflow: hidden;
  border-width: 1px;
  border-style: solid;
  border-radius: 4px;
  background: rgba(122, 154, 153, 0.08);
}
.skin-portrait-preview.has-model {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.skin-preview-pane {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
}
.skin-preview-pane--model {
  align-items: center;
  align-self: stretch;
  padding: 12px;
}
.skin-portrait-preview img {
  display: block;
  width: min(100%, 520px);
  height: 440px;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 4px 10px rgba(43, 31, 21, 0.3));
}
.skin-preview-pane--model img {
  width: min(100%, 280px);
  height: 300px;
  object-position: center;
}
@media (max-width: 560px) {
  .skin-portrait-preview {
    min-height: 300px;
  }
  .skin-portrait-preview img {
    height: 360px;
  }
  .skin-portrait-preview.has-model { min-height: 250px; }
  .has-model .skin-preview-pane img { height: 250px; }
  .has-model .skin-preview-pane--model img { height: 210px; }
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
  text-align: left;
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

.home-item-unlock-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.home-item-unlock-link {
  width: 100%;
  min-height: 66px;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px;
  text-align: left;
}

.home-item-unlock-icon {
  width: 50px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.home-item-unlock-icon img {
  width: 90%;
  height: 90%;
  object-fit: contain;
}

.home-item-unlock-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.home-item-unlock-copy strong,
.home-item-unlock-copy small {
  overflow-wrap: anywhere;
}

.home-item-unlock-copy strong {
  color: var(--text-main, #3e2a14);
  font-size: 14px;
}

.home-item-unlock-copy small {
  color: var(--text-muted, #6b5134);
  font-size: 12px;
  line-height: 1.45;
}

.home-item-unlock-action {
  color: var(--accent-ink, #557574);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .home-item-unlock-link {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .home-item-unlock-icon {
    width: 46px;
  }

  .home-item-unlock-action {
    grid-column: 2;
  }
}

.unlock-hero-usage {
  display: flex;
  align-items: center;
  min-height: 32px;
  color: var(--text-main, #3e2a14);
  font-size: 14px;
}

.unlock-hero-link {
  padding: 2px 6px;
  text-decoration: none;
}

.unlock-hero-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(43, 31, 21, 0.32));
}

.unlock-hero-name {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.star-usage-list {
  margin-top: 10px;
  border-top: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
}
.star-usage-row,
.star-usage-total {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 38px;
  padding: 6px 2px;
  border-bottom: 1px solid var(--border-faint, rgba(143, 115, 81, 0.2));
  font-size: 14px;
}
.star-usage-label,
.star-usage-total span {
  color: var(--text-secondary, #735c42);
}
.star-usage-value,
.star-usage-total strong {
  color: var(--text-main, #3e2a14);
  text-align: right;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.star-usage-total {
  border-bottom: 0;
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
