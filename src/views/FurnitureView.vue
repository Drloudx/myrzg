<template>
  <div class="page-view-container" data-view="furniture" data-image-fallback="custom">
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索家具名称、描述、材料..." />

      <UiFilterRow label="一级分类：">
        <UiFilterPill :active="selectedMain === null" @click="selectMain(null)">全部</UiFilterPill>
        <UiFilterPill
          v-for="category in categories"
          :key="category.type"
          :active="sameValue(selectedMain, category.type)"
          @click="selectMain(category.type)"
        >
          {{ category.name }}
        </UiFilterPill>
      </UiFilterRow>

      <UiFilterRow v-if="subCategories.length" label="二级分类：">
        <UiFilterPill :active="selectedSub === null" @click="selectedSub = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="category in subCategories"
          :key="category.type"
          :active="sameValue(selectedSub, category.type)"
          @click="selectedSub = category.type"
        >
          {{ category.name }}
        </UiFilterPill>
      </UiFilterRow>

      <UiFilterRow label="品质：">
        <UiFilterPill :active="selectedQuality === null" @click="selectedQuality = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="quality in qualityOptions"
          :key="quality"
          :quality="quality"
          :active="selectedQuality === quality"
          @click="selectedQuality = quality"
        >
          {{ getRarityName(quality) }}
        </UiFilterPill>
      </UiFilterRow>

      <UiFilterRow label="放置区域：">
        <UiFilterPill :active="selectedPlace === null" @click="selectedPlace = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="place in placeOptions"
          :key="place.value"
          :active="selectedPlace === place.value"
          @click="selectedPlace = place.value"
        >
          {{ place.label }}
        </UiFilterPill>
      </UiFilterRow>

      <UiFilterRow label="家具图纸：">
        <UiFilterPill :active="blueprintFilter === 'all'" @click="blueprintFilter = 'all'">全部</UiFilterPill>
        <UiFilterPill :active="blueprintFilter === 'with'" @click="blueprintFilter = 'with'">有图纸</UiFilterPill>
        <UiFilterPill :active="blueprintFilter === 'without'" @click="blueprintFilter = 'without'">无图纸</UiFilterPill>
        <template #right>
          <span class="furniture-count">共 {{ filteredFurniture.length }} 件家具</span>
        </template>
      </UiFilterRow>
    </div>

    <UiVirtualGrid
      v-if="isDataReady"
      ref="furnitureGrid"
      id="furnitureGridScroll"
      class="furniture-grid"
      :items="filteredFurniture"
      item-key="id"
      :estimate-size="245"
    >
      <template #default="{ item }">
        <FurnitureCard
          :data-furniture-id="item.id"
          :furniture="item"
          @click="openDetail(item)"
        />
      </template>
      <template #empty>
        <UiEmptyState text="未找到符合条件的家具" />
      </template>
    </UiVirtualGrid>

    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage">
      <template #action>
        <UiButton @click="loadFurniture">重试</UiButton>
      </template>
    </UiEmptyState>
    <UiEmptyState v-else type="loading" text="家具数据加载中..." />

    <UiBackToTop scroll-container="#furnitureGridScroll" />

    <UiModal
      :visible="detailVisible"
      :title="selectedFurniture?.name || '家具详情'"
      max-width="820px"
      scroll-id="furnitureModalScroll"
      :z-index="3000"
      @update:visible="handleDetailVisibility"
    >
      <template v-if="selectedFurniture">
        <div
          class="furniture-portrait-section paper-panel"
          :class="`quality-bg-${selectedFurniture.quality}`"
          :data-detail-furniture-id="selectedFurniture.id"
        >
          <div class="furniture-portrait-section__preview">
            <img
              :class="{ 'is-placeholder': !furnitureImage(selectedFurniture) }"
              :src="furnitureImage(selectedFurniture) || missingImageUrl"
              :alt="selectedFurniture.name"
              @error="handlePreviewFallback"
              @load="handlePreviewLoad"
            />
          </div>
        </div>
        <div class="furniture-badges-row">
          <UiTag>ID: {{ selectedFurniture.id }}</UiTag>
          <UiTag :quality="Number(selectedFurniture.quality)">
            {{ getRarityName(selectedFurniture.quality) }}
          </UiTag>
          <UiTag v-if="selectedFurniture.blueprints?.length" tone="accent">有家具图纸</UiTag>
        </div>

        <UiSection title="家具信息">
          <UiInfoRow label="分类" :value="categoryText(selectedFurniture)" />
          <UiInfoRow
            v-if="selectedFurniture.sourceLabels?.length || selectedFurniture.sourceTags?.length"
            label="来源标记"
            :value="(selectedFurniture.sourceLabels || selectedFurniture.sourceTags).join(' / ')"
          />
          <UiInfoRow label="放置范围" :value="selectedFurniture.placeName || selectedFurniture.place || '未标注'" />
          <UiInfoRow label="装饰值" :value="decorationText(selectedFurniture.dec)" />
          <UiInfoRow label="基础库存上限" :value="Number(selectedFurniture.cntMax) || 0" />
          <UiInfoRow
            v-if="Number(selectedFurniture.initialNum) > 0"
            label="初始配置"
            :value="`${Number(selectedFurniture.initialNum)} 件`"
          />
          <UiInfoRow
            v-if="Number(selectedFurniture.sellMoney) > 0"
            label="出售价格"
            :value="`${Number(selectedFurniture.sellMoney)} 银币`"
          />
          <UiInfoRow
            v-if="selectedFurniture.condition?.summary"
            class="furniture-condition-row"
            :label="selectedFurniture.condition.label || '开放条件'"
            :value="selectedFurniture.condition.summary"
          />
        </UiSection>

        <UiSection v-if="selectedFurniture.desc" title="描述">
          <p class="furniture-description">{{ selectedFurniture.desc }}</p>
        </UiSection>

        <UiSection title="制作材料">
          <div v-if="selectedFurniture.crafting?.available !== false && craftMaterials.length" class="material-grid">
            <UiRewardCard
              v-for="material in craftMaterials"
              :key="materialKey(material)"
              :data-item-id="material.typeId || undefined"
              :clickable="!!material.typeId"
              :rule="{
                targetName: material.name || material.typeId || material.id,
                targetImg: material.img ? getImageUrl(material.img) : '',
                targetQuality: Number(material.quality) || 0,
                min: Number(material.num) || 0,
                max: Number(material.num) || 0,
                typeId: material.typeId
              }"
              @click="openItem(material.typeId)"
            />
          </div>
          <p v-else class="empty-detail-text">
            {{ selectedFurniture.crafting?.note || '无制作材料配置' }}
          </p>
        </UiSection>

        <UiSection v-if="selectedFurniture.skins?.length" title="外观列表">
          <div class="skin-grid">
            <div
              v-for="skin in selectedFurniture.skins"
              :key="skin.type"
              class="skin-entry"
              :data-skin-id="skin.type"
            >
              <div class="skin-entry__preview">
                <img
                  :class="{ 'is-placeholder': !(skin.image || buildItemImage(skin.icon)) }"
                  :src="skin.image ? getImageUrl(skin.image) : (buildItemImage(skin.icon) || missingImageUrl)"
                  :alt="skin.name"
                  loading="lazy"
                  @error="handlePreviewFallback"
                  @load="handlePreviewLoad"
                />
              </div>
              <div class="skin-entry__content">
                <div class="skin-entry__heading">
                  <strong>{{ skin.name || '未命名外观' }}</strong>
                  <UiTag v-if="skin.configDefault" tone="accent">配置默认</UiTag>
                </div>
                <span v-if="skin.homeLevel" class="skin-entry__requirement">设施等级 {{ skin.homeLevel }}</span>
              </div>
            </div>
          </div>
        </UiSection>

        <UiSection title="家具图纸">
          <div v-if="selectedFurniture.blueprints?.length" class="blueprint-list">
            <button
              v-for="blueprint in selectedFurniture.blueprints"
              :key="blueprint.typeId"
              type="button"
              class="blueprint-entry"
              :data-item-id="blueprint.typeId"
              @click="openItem(blueprint.typeId)"
            >
              <span class="blueprint-entry__preview" :class="`quality-bg-${Number(blueprint.quality) || 1}`">
                <img
                  :class="{ 'is-placeholder': !buildItemImage(blueprint.icon) }"
                  :src="buildItemImage(blueprint.icon) || missingImageUrl"
                  :alt="blueprint.name"
                  loading="lazy"
                  @error="handlePreviewFallback"
                  @load="handlePreviewLoad"
                />
              </span>
              <span class="blueprint-entry__content">
                <strong :class="`quality-text-${Number(blueprint.quality) || 1}`">{{ blueprint.name }}</strong>
                <small>{{ blueprint.typeId }}</small>
                <span v-if="blueprint.skinNames?.length">包含外观：{{ blueprint.skinNames.join('、') }}</span>
              </span>
              <span class="blueprint-entry__action">查看物品</span>
            </button>
          </div>
          <p v-else class="empty-detail-text">该家具没有对应的家具图纸</p>
        </UiSection>

        <UiBackToTop scroll-container="#furnitureModalScroll" />
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FurnitureCard from '../components/FurnitureCard.vue'
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'
import {
  UiBackToTop,
  UiButton,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiInfoRow,
  UiModal,
  UiRewardCard,
  UiSearchInput,
  UiSection,
  UiTag
} from '../components/ui/index.js'
import { fetchFurnitureData } from '../utils/furnitureData.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { getRarityName } from '../utils/gameMappings.js'

const route = useRoute()
const router = useRouter()

const allFurniture = shallowRef([])
const categories = ref([])
const isDataReady = ref(false)
const errorMessage = ref('')
const furnitureGrid = ref(null)
const selectedFurniture = ref(null)
const detailVisible = ref(false)

const searchQuery = ref('')
const selectedMain = ref(null)
const selectedSub = ref(null)
const selectedQuality = ref(null)
const selectedPlace = ref(null)
const blueprintFilter = ref('all')

let loadOperation = 0
let initialDetailId = normalizeQueryValue(route.query.id)

function normalizeQueryValue(value) {
  const normalized = Array.isArray(value) ? value[0] : value
  return normalized == null ? '' : String(normalized)
}

const sameValue = (left, right) => String(left) === String(right)

const buildItemImage = icon => {
  if (!icon) return ''
  return getImageUrl(`/BuildItem/${String(icon).replace(/\.png$/i, '')}.png`)
}

const missingImageUrl = getImageUrl('/ui/visibility-off.svg')
const furnitureImage = furniture => furniture?.displayImage
  ? getImageUrl(furniture.displayImage)
  : buildItemImage(furniture?.displayIcon)

const handlePreviewFallback = event => {
  event?.currentTarget?.classList.add('is-placeholder')
  handleImageFallback(event)
}

const handlePreviewLoad = event => {
  const image = event?.currentTarget
  if (image && !String(image.getAttribute('src') || '').includes('/ui/visibility-off.svg')) {
    image.classList.remove('is-placeholder')
  }
}

const categoryText = furniture => {
  const labels = [furniture?.mainName, furniture?.subName].filter(Boolean)
  return labels.length ? labels.join(' / ') : '未分类'
}

const decorationText = value => {
  const number = Number(value) || 0
  return number > 0 ? `+${number}` : '0'
}

const selectMain = value => {
  selectedMain.value = value
  selectedSub.value = null
}

const subCategories = computed(() => {
  if (selectedMain.value === null) return []
  return categories.value.find(category => sameValue(category.type, selectedMain.value))?.info || []
})

const qualityOptions = computed(() => [...new Set(allFurniture.value
  .map(furniture => Number(furniture.quality))
  .filter(quality => Number.isInteger(quality) && quality > 0))]
  .sort((left, right) => left - right))

const placeOptions = computed(() => {
  const seen = new Set()
  const options = []
  allFurniture.value.forEach(furniture => {
    const value = String(furniture.place || '')
    if (!value || seen.has(value)) return
    seen.add(value)
    options.push({ value, label: furniture.placeName || value })
  })
  return options
})

const compareSourceOrder = (left, right) => {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' })
}

const furnitureSearchText = furniture => [
  furniture.name,
  furniture.id,
  furniture.desc,
  furniture.mainName,
  furniture.subName,
  ...(furniture.categoryNames || []),
  ...(furniture.sourceTags || []),
  furniture.placeName,
  furniture.condition?.summary,
  ...(furniture.skins || []).flatMap(skin => [skin.name, skin.desc]),
  ...(furniture.blueprints || []).map(blueprint => blueprint.name),
  ...(furniture.crafting?.available === false ? [] : (furniture.consume?.items || []).map(item => item.name)),
  ...(furniture.crafting?.available === false ? [] : (furniture.consume?.currencies || []).map(item => item.name))
].filter(Boolean).join(' ').toLowerCase()

const filteredFurniture = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return allFurniture.value.filter(furniture => {
    if (selectedMain.value !== null && !sameValue(furniture.mainType, selectedMain.value)) return false
    if (selectedSub.value !== null && !sameValue(furniture.subType, selectedSub.value)) return false
    if (selectedQuality.value !== null && Number(furniture.quality) !== selectedQuality.value) return false
    if (selectedPlace.value !== null && String(furniture.place || '') !== selectedPlace.value) return false

    const hasBlueprint = (furniture.blueprints || []).length > 0
    if (blueprintFilter.value === 'with' && !hasBlueprint) return false
    if (blueprintFilter.value === 'without' && hasBlueprint) return false
    if (query && !furnitureSearchText(furniture).includes(query)) return false
    return true
  }).sort((left, right) => {
    const mainDifference = compareSourceOrder(left.mainType, right.mainType)
    if (mainDifference) return mainDifference
    const subDifference = compareSourceOrder(left.subType, right.subType)
    if (subDifference) return subDifference
    return compareSourceOrder(left.configOrder, right.configOrder)
  })
})

const craftMaterials = computed(() => {
  if (!selectedFurniture.value?.consume || selectedFurniture.value?.crafting?.available === false) return []
  return [
    ...(selectedFurniture.value.consume.items || []),
    ...(selectedFurniture.value.consume.currencies || [])
  ]
})

const materialKey = material => `${material.typeId || material.id || material.name}-${material.num || 0}`

const syncDetailFromRoute = async rawId => {
  if (!isDataReady.value) return
  const id = normalizeQueryValue(rawId)
  if (!id) {
    detailVisible.value = false
    selectedFurniture.value = null
    return
  }

  const furniture = allFurniture.value.find(entry => String(entry.id) === id)
  if (!furniture) {
    detailVisible.value = false
    selectedFurniture.value = null
    const query = { ...route.query }
    delete query.id
    await router.replace({ query })
    return
  }

  selectedFurniture.value = furniture
  detailVisible.value = true
}

const loadFurniture = async () => {
  const operation = ++loadOperation
  isDataReady.value = false
  errorMessage.value = ''
  try {
    const data = await fetchFurnitureData()
    if (operation !== loadOperation) return
    allFurniture.value = data.furniture || []
    categories.value = data.categories || []
    isDataReady.value = true
    await syncDetailFromRoute(route.query.id)
  } catch (error) {
    if (operation !== loadOperation) return
    errorMessage.value = '家具数据加载失败，请重试'
    console.error('Failed to load furniture data:', error)
  }
}

const openDetail = furniture => {
  initialDetailId = ''
  router.push({ query: { ...route.query, id: furniture.id } })
}

const closeDetail = async () => {
  const closedId = selectedFurniture.value?.id || normalizeQueryValue(route.query.id)
  detailVisible.value = false
  selectedFurniture.value = null
  if (route.query.id == null) return

  const query = { ...route.query }
  delete query.id
  await router.replace({ query })

  if (!initialDetailId || initialDetailId !== String(closedId)) return
  initialDetailId = ''
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  await furnitureGrid.value?.scrollToItem(closedId)
}

const handleDetailVisibility = visible => {
  if (!visible) closeDetail()
}

const openItem = typeId => {
  if (!typeId) return
  router.push({ query: { ...route.query, itemId: typeId } })
}

watch(() => route.query.id, newId => {
  syncDetailFromRoute(newId)
})

onMounted(loadFurniture)
onBeforeUnmount(() => { loadOperation += 1 })
</script>

<style scoped>
.furniture-grid :deep(.ui-card-grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.furniture-count {
  color: var(--text-muted, #6b5134);
  font-size: 12px;
  letter-spacing: 0;
}

.furniture-portrait-section {
  position: relative;
  min-height: 300px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  overflow: hidden;
}

.furniture-portrait-section__preview {
  width: min(76%, 460px);
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.furniture-portrait-section__preview img {
  width: min(90%, 340px);
  height: auto;
  max-width: 100%;
  max-height: 270px;
  object-fit: contain;
  filter: drop-shadow(0 6px 9px rgba(43, 31, 21, 0.34));
}

.furniture-portrait-section__preview img.is-placeholder,
.skin-entry__preview img.is-placeholder,
.blueprint-entry__preview img.is-placeholder {
  width: 42px;
  height: 42px;
  padding: 11px;
  border-radius: 4px;
  background: var(--wood-soft, #463424);
  opacity: 0.72;
  filter: none;
}

.furniture-badges-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 14px;
}

.furniture-description {
  margin: 0;
  color: var(--text-main, #3e2a14);
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.skin-entry {
  min-width: 0;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 5px;
  background: var(--paper-soft, #eadcc3);
}

.skin-entry__preview {
  width: 96px;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(143, 115, 81, 0.08);
  border-radius: 4px;
}

.skin-entry__preview img {
  width: 94%;
  height: 94%;
  object-fit: contain;
}

.skin-entry__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.skin-entry__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.skin-entry__heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
}

.skin-entry__requirement {
  color: var(--text-faint, #8a6d4d);
  font-size: 11px;
}

.blueprint-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blueprint-entry {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 8px;
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 5px;
  background: var(--paper-soft, #eadcc3);
  color: var(--text-main, #3e2a14);
  cursor: pointer;
  font: inherit;
  letter-spacing: 0;
  text-align: left;
}

.blueprint-entry:hover {
  border-color: var(--accent-bright, #7a9a99);
  background: var(--hover-bg, rgba(85, 117, 116, 0.14));
}

.blueprint-entry__preview {
  width: 72px;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.blueprint-entry__preview img {
  width: 92%;
  height: 92%;
  object-fit: contain;
}

.blueprint-entry__content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.blueprint-entry__content strong,
.blueprint-entry__content small,
.blueprint-entry__content span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.blueprint-entry__content strong {
  font-size: 14px;
}

.blueprint-entry__content small,
.blueprint-entry__content span {
  color: var(--text-muted, #6b5134);
  font-size: 11px;
  line-height: 1.45;
}

.blueprint-entry__action {
  margin-right: 8px;
  color: var(--accent-ink, #557574);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.empty-detail-text {
  margin: 0;
  color: var(--text-faint, #8a6d4d);
  font-size: 13px;
  font-style: italic;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .furniture-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .furniture-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .furniture-portrait-section {
    min-height: 250px;
  }

  .furniture-portrait-section__preview {
    width: min(88%, 380px);
    height: 230px;
  }

  .furniture-portrait-section__preview img {
    max-height: 225px;
  }
}

@media (max-width: 1024px) and (max-height: 520px) {
  .filter-panel {
    max-height: clamp(72px, 30dvh, 132px);
  }

  .furniture-grid {
    padding-bottom: calc(10px + var(--safe-bottom, 0px));
  }
}

@media (max-width: 1024px) {
  :global(.app-container:has([data-view="furniture"] > .ui-modal-host.ui-modal-open) > .nav-fab-btn) {
    display: none !important;
  }
}

@media (max-width: 480px) {
  .furniture-condition-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }

  .furniture-condition-row :deep(.ui-info-row__value) {
    width: 100%;
    text-align: left;
    word-break: normal;
    overflow-wrap: break-word;
  }

  .material-grid,
  .skin-grid {
    grid-template-columns: 1fr;
  }

  .skin-entry {
    grid-template-columns: 82px minmax(0, 1fr);
  }

  .skin-entry__preview {
    width: 82px;
  }

  .blueprint-entry {
    grid-template-columns: 62px minmax(0, 1fr);
  }

  .blueprint-entry__preview {
    width: 62px;
  }

  .blueprint-entry__action {
    grid-column: 2;
    justify-self: start;
    margin-right: 0;
  }
}
</style>
