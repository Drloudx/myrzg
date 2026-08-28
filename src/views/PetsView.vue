<template>
  <div class="page-view-container pets-page">

    <!-- 筛选区 -->
    <div class="filter-panel paper-panel">
      <UiSearchInput v-model="searchQuery" placeholder="搜索魔物名称、特性、描述..." />

      <!-- 稀有度筛选 -->
      <UiFilterRow label="稀有度：">
        <UiFilterPill :active="selectedStar === null" @click="selectedStar = null">全部</UiFilterPill>
        <UiFilterPill
          v-for="starVal in [5, 4, 3]"
          :key="starVal"
          :quality="starVal"
          :active="selectedStar === starVal"
          @click="selectedStar = starVal"
        >{{ starVal }}星</UiFilterPill>
      </UiFilterRow>

      <!-- 形态筛选 -->
      <UiFilterRow label="形态：">
        <UiFilterPill :active="filterVariant === null" @click="filterVariant = null">全部</UiFilterPill>
        <UiFilterPill :active="filterVariant === true" @click="filterVariant = true">可变异</UiFilterPill>
      </UiFilterRow>
    </div>

    <!-- 列表区（5列大幅面卡片展示，懒加载每批 60 项） -->
    <UiCardGrid id="petsGridScroll" class="pets-card-grid" v-if="isDataReady">
      <UiItemCard
        v-for="pet in displayedPets"
        :key="pet.id"
        :name="pet.name"
        :quality="pet.starDisplay"
        @click="handlePetClick(pet)"
      >
        <template #icon>
          <div class="pet-card-art">
            <img
              :src="getImageUrl(`/images/PetPanel/petcard_botm_${pet.starDisplay}.png`)"
              class="pet-card-background"
              alt=""
            />
            <img
              :src="getImageUrl(`/images/PicHandBookPanel/${pet.monImg}.png`)"
              :alt="pet.name"
              class="pet-card-avatar"
              loading="lazy"
              @error="handleImgError"
            />
            <img
              :src="getImageUrl(`/images/PetPanel/petcard_${pet.starDisplay}.png`)"
              class="pet-card-frame"
              alt=""
            />
          </div>
        </template>
      </UiItemCard>
      <UiEmptyState v-if="filteredPets.length === 0" text="未找到匹配的魔物数据" />
    </UiCardGrid>
    <UiEmptyState v-else-if="errorMessage" type="error" :text="errorMessage" />
    <UiEmptyState v-else type="loading" text="正在装配魔物图鉴数据..." />

    <UiBackToTop scroll-container="#petsGridScroll" />

    <!-- FULLSCREEN DETAIL MODAL -->
    <UiModal
      v-model:visible="detailVisible"
      :title="selectedPet ? selectedPet.name : '魔物详情'"
      max-width="820px"
      scroll-id="petModalScroll"
      :z-index="2000"
      @close="closePetDetail"
    >
      <template v-if="selectedPet">
        <!-- TOP PORTRAIT SECTION -->
        <div class="portrait-section" :class="{ 'has-variants-layout': selectedPet.hasVariant }">
          <div class="pet-portraits-row">
            <!-- Regular Portrait -->
            <div class="pet-portrait-box">
              <div class="portrait-label-pos"><UiTag tone="wood">普通形态</UiTag></div>

              <!-- 右上角带图标的属性 -->
              <div class="portrait-element-badge" v-if="selectedPet.element">
                <img :src="getImageUrl(`/images/HeroGachaShowPanel/spGachaTag${getSpGachaElementSlug(selectedPet.element)}03.png`)" class="top-right-badge-icon" alt="" />
                <span :class="`element-${selectedPet.element}`">{{ selectedPet.elementName || getElementName(selectedPet.element) }}</span>
              </div>

              <img
                :src="getImageUrl(`/images/PicHandBookPanel/${selectedPet.monImg}.png`)"
                :alt="selectedPet.name"
                class="pet-portrait-img"
                @error="handleImgError"
              />
            </div>

            <!-- Variant Portrait (if can mutate) -->
            <div class="pet-portrait-box" v-if="selectedPet.hasVariant">
              <div class="portrait-label-pos"><UiTag tone="accent">变异形态</UiTag></div>

              <!-- 右上角带图标的属性 -->
              <div class="portrait-element-badge" v-if="selectedPet.element">
                <img :src="getImageUrl(`/images/HeroGachaShowPanel/spGachaTag${getSpGachaElementSlug(selectedPet.element)}03.png`)" class="top-right-badge-icon" alt="" />
                <span :class="`element-${selectedPet.element}`">{{ selectedPet.elementName || getElementName(selectedPet.element) }}</span>
              </div>

              <img
                :src="getImageUrl(`/images/PicHandBookPanel/${selectedPet.monImg}_a.png`)"
                :alt="selectedPet.name"
                class="pet-portrait-img"
                @error="handleImgError"
              />
            </div>
          </div>

          <!-- Pet Description Box below portraits -->
          <div class="pet-description-text" v-if="selectedPet.des">
            {{ selectedPet.des }}
          </div>

          <!-- Mutant variant details description under portraits -->
          <div class="variant-effect-box" v-if="selectedPet.hasVariant && selectedPet.variants.length > 0">
            <span class="variant-effect-title">变异效果:</span>
            <span
              class="variant-effect-txt"
              v-html="formatSkillDescription(selectedPet.variants[0].des)"
            ></span>
            <span class="variant-effect-txt" v-if="selectedPet.variants[0].lifeTimeAdd > 0">
              ，上场时间增加 +{{ selectedPet.variants[0].lifeTimeAdd }}秒
            </span>
            <span class="variant-effect-txt" v-if="selectedPet.variants[0].sellPriceAdd > 0">
              ，售价增加 +{{ selectedPet.variants[0].sellPriceAdd }}
            </span>
          </div>
        </div>

        <!-- MIDDLE TABS NAVIGATION -->
        <div class="detail-tabs-wrap">
          <UiTabs
            v-model="activeTab"
            :options="[{ value: 'skills', label: '技能特性' }, { value: 'stats', label: '基础属性' }]"
          />
        </div>

        <!-- TAB CONTENT 1: SKILLS -->
        <div class="tab-pane-content" v-if="activeTab === 'skills'">
          <!-- Skills Select Grid matching Character Handbook -->
          <div class="skills-select-grid">
            <div
              v-for="(sk, idx) in selectedPet.skills"
              :key="idx"
              class="skill-select-card"
              :class="{ active: selectedSkillIdx === idx }"
              @click="selectSkill(idx)"
            >
              <!-- Trait (特性) with Circular inner avatar and frame -->
              <div class="skill-select-icon-wrap" v-if="sk.type === 'trait'">
                <img :src="getImageUrl(sk.innerIcon)" class="trait-inner-avatar" alt="" />
                <img :src="getImageUrl(sk.icon)" class="trait-frame-border" alt="" />
              </div>
              <!-- Normal active skill icon (only render if active and has icon) -->
              <img
                v-else-if="sk.type === 'active' && sk.icon"
                :src="getImageUrl(sk.icon)"
                class="skill-select-icon active-skill-sprite"
                alt=""
              />
              <!-- Text labels -->
              <div class="skill-select-info">
                <UiTag :tone="(sk.type === 'trait' || idx === 3) ? 'accent' : 'gold'">
                  {{ sk.type === 'normal' ? '普攻' : (sk.type === 'trait' ? '特性' : (idx === 3 ? '队伍被动' : '技能')) }}
                </UiTag>
                <span class="sk-name">{{ sk.name }}</span>
              </div>
            </div>
          </div>

          <!-- Detail panel below -->
          <div class="skill-desc-detail-card" v-if="activeSkill">
            <header class="sk-detail-header">
              <span class="sk-detail-title">{{ activeSkill.name }}</span>
              <UiTag :tone="activeSkill.type === 'normal' ? 'default' : ((activeSkill.type === 'trait' || selectedSkillIdx === 3) ? 'accent' : 'gold')">
                {{ activeSkill.type === 'normal' ? '普通攻击' : (activeSkill.type === 'trait' ? '被动特性' : (selectedSkillIdx === 3 ? '队伍被动' : '主动技能')) }}
              </UiTag>
            </header>

            <!-- Skill Level Selector Slider -->
            <div class="level-slider-block" v-if="activeSkill.maxLevel > 1">
              <div class="slider-labels">
                <span class="slider-title">技能等级:</span>
                <span class="slider-value">Lv.{{ selectedSkillLevel }} / {{ activeSkill.maxLevel }}</span>
              </div>
              <input
                type="range"
                min="1"
                :max="activeSkill.maxLevel"
                v-model.number="selectedSkillLevel"
                class="range-slider-m"
              />
            </div>

            <!-- Skill Stats & Cd/Cost -->
            <UiStatGrid
              v-if="activeSkillLevelData && (activeSkillLevelData.cd || activeSkillLevelData.cost)"
              :items="[
                ...(activeSkillLevelData.cd ? [{ label: '冷却时间', value: activeSkillLevelData.cd + '秒' }] : []),
                ...(activeSkillLevelData.cost ? [{ label: '魔力消耗', value: activeSkillLevelData.cost }] : [])
              ]"
            />

            <!-- Skill Level Description -->
            <div class="sk-description-body" v-if="activeSkillLevelData">
              <div class="lvl-subname">{{ activeSkillLevelData.name }}</div>
              <p v-html="formatSkillDescription(activeSkillLevelData.des)"></p>
            </div>

            <!-- Breakthrough/Upgrade Costs Requirements -->
            <div class="sk-upgrade-cost-alert-box" v-if="activeSkill.type !== 'normal'">
              <div class="alert-title">培育提升要求:</div>

              <!-- Active skills upgrade lists -->
              <div v-if="activeSkill.type === 'active'" class="alert-text">
                每级突破所需。
                <br />
                <span>突破分别所需数量：</span>
                <template v-for="(cost, index) in getPetBreakthroughCosts" :key="index">
                  <span
                    :style="{
                      color: getActiveBreakthroughStepIndex === index ? 'var(--danger)' : 'inherit',
                      fontWeight: getActiveBreakthroughStepIndex === index ? 'bold' : 'normal'
                    }"
                  >
                    {{ cost }}
                  </span>
                  <span v-if="index < getPetBreakthroughCosts.length - 1">、</span>
                </template>
              </div>

              <!-- Trait skill upgrade lists -->
              <div v-else-if="activeSkill.type === 'trait'" class="alert-text">
                提升特性等级需要孵化同种魔物获得图鉴值（育成数）。
                <br />
                <span class="highlight-orange">
                  {{ getTraitLevelHatchRequirement() }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB CONTENT 2: STATS & GROWTHS -->
        <div class="tab-pane-content" v-if="activeTab === 'stats'">
          <div class="stats-growth-layout">
            <!-- 基础属性与成长区间 -->
            <UiSection title="基础属性与成长范围">
              <UiStatGrid :items="[
                { label: '生命', value: selectedPet.hp },
                { label: '成长', value: `${selectedPet.hpMin} ~ ${selectedPet.hpMax}` },
                { label: '攻击', value: selectedPet.atk },
                { label: '成长', value: `${selectedPet.atkMin} ~ ${selectedPet.atkMax}` },
                { label: '防御', value: selectedPet.def },
                { label: '成长', value: `${selectedPet.defMin} ~ ${selectedPet.defMax}` },
                { label: '敏捷', value: selectedPet.dex },
                { label: '成长', value: `${selectedPet.dexMin} ~ ${selectedPet.dexMax}` }
              ]" />
            </UiSection>

            <!-- 其他属性 -->
            <UiSection title="其他属性">
              <UiInfoRow label="孵化时间" :value="formatHatchTime(selectedPet.eggTime)" />
              <UiInfoRow label="出售价值">
                <span class="inline-icon-value">
                  <img :src="getImageUrl(BASE_REWARD_PATHS.money)" class="mini-attr-icon" alt="" />
                  <span>{{ selectedPet.sellPrice }}</span>
                </span>
              </UiInfoRow>
              <UiInfoRow label="孵化经验">
                <span class="inline-icon-value">
                  <img :src="getImageUrl(BASE_REWARD_PATHS.heroExp)" class="mini-attr-icon" alt="" />
                  <span>{{ selectedPet.exp }}</span>
                </span>
              </UiInfoRow>
              <UiInfoRow label="战斗CD" :value="`${selectedPet.petCd}秒`" />
              <UiInfoRow label="房间CD" :value="`${selectedPet.roomCd}间`" />
              <UiInfoRow label="上场时间" :value="`${selectedPet.lifeTime}秒`" />
            </UiSection>

            <!-- 好感相关 -->
            <UiSection title="好感相关">
              <UiStatGrid v-if="petSetting" :items="[
                { label: '总好感上限', value: petSetting.maxFavor },
                { label: '每日好感上限', value: petSetting.maxFavorDaily },
                { label: '上场加时转化', value: `1秒 / ${petSetting.lifeTimeFavor}好感` },
                { label: '抚摸增加好感', value: `+${petSetting.favorActionAdd}` }
              ]" />
            </UiSection>

            <!-- 成长系数调参 -->
            <UiSection title="成长系数调参">
              <div class="stats-inputs-grid">
                <!-- HP Growth -->
                <div class="stat-input-row">
                  <div class="stat-meta">
                    <span class="name">生命成长值:</span>
                    <span class="range">({{ selectedPet.hpMin }} ~ {{ selectedPet.hpMax }})</span>
                  </div>
                  <div class="slider-container-row">
                    <input
                      type="range"
                      :min="selectedPet.hpMin"
                      :max="selectedPet.hpMax"
                      step="0.1"
                      v-model.number="growthHp"
                      class="range-slider-m"
                    />
                    <span class="current-val">{{ growthHp.toFixed(1) }}</span>
                    <span class="rank-badge" :class="getGrowthRankBadge('hp', growthHp)">
                      {{ getGrowthRankLabel('hp', growthHp) }}
                    </span>
                  </div>
                </div>

                <!-- ATK Growth -->
                <div class="stat-input-row">
                  <div class="stat-meta">
                    <span class="name">攻击成长值:</span>
                    <span class="range">({{ selectedPet.atkMin }} ~ {{ selectedPet.atkMax }})</span>
                  </div>
                  <div class="slider-container-row">
                    <input
                      type="range"
                      :min="selectedPet.atkMin"
                      :max="selectedPet.atkMax"
                      step="0.1"
                      v-model.number="growthAtk"
                      class="range-slider-m"
                    />
                    <span class="current-val">{{ growthAtk.toFixed(1) }}</span>
                    <span class="rank-badge" :class="getGrowthRankBadge('atk', growthAtk)">
                      {{ getGrowthRankLabel('atk', growthAtk) }}
                    </span>
                  </div>
                </div>

                <!-- DEF Growth -->
                <div class="stat-input-row">
                  <div class="stat-meta">
                    <span class="name">防御成长值:</span>
                    <span class="range">({{ selectedPet.defMin }} ~ {{ selectedPet.defMax }})</span>
                  </div>
                  <div class="slider-container-row">
                    <input
                      type="range"
                      :min="selectedPet.defMin"
                      :max="selectedPet.defMax"
                      step="0.1"
                      v-model.number="growthDef"
                      class="range-slider-m"
                    />
                    <span class="current-val">{{ growthDef.toFixed(1) }}</span>
                    <span class="rank-badge" :class="getGrowthRankBadge('def', growthDef)">
                      {{ getGrowthRankLabel('def', growthDef) }}
                    </span>
                  </div>
                </div>

                <!-- DEX Growth -->
                <div class="stat-input-row">
                  <div class="stat-meta">
                    <span class="name">敏捷成长值:</span>
                    <span class="range">({{ selectedPet.dexMin }} ~ {{ selectedPet.dexMax }})</span>
                  </div>
                  <div class="slider-container-row">
                    <input
                      type="range"
                      :min="selectedPet.dexMin"
                      :max="selectedPet.dexMax"
                      step="0.1"
                      v-model.number="growthDex"
                      class="range-slider-m"
                    />
                    <span class="current-val">{{ growthDex.toFixed(1) }}</span>
                    <span class="rank-badge" :class="getGrowthRankBadge('dex', growthDex)">
                      {{ getGrowthRankLabel('dex', growthDex) }}
                    </span>
                  </div>
                </div>
              </div>
            </UiSection>

            <!-- 等级数值模拟 -->
            <UiSection title="等级数值模拟">
              <div class="level-slider-block">
                <div class="slider-labels">
                  <span class="slider-title">目标等级:</span>
                  <span class="slider-value">Lv.{{ calcLevel }}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  v-model.number="calcLevel"
                  class="range-slider-m"
                />
              </div>

              <!-- Exp cumulative and slime equivalent -->
              <div class="exp-cost-box">
                <div class="exp-summary-row">
                  <span>累计升级所需经验:</span>
                  <strong class="highlight-accent">{{ cumulativeLevelExp }} EXP</strong>
                </div>
                <div class="exp-slime-row">
                  <span>约等于绿色史莱姆数量:</span>
                  <div class="slime-chip">
                    <img :src="getImageUrl('/images/PicHandBookPanel/colect_mon_072.png')" class="mini-slime-icon" alt="" />
                    <span>×{{ (cumulativeLevelExp / 125).toFixed(1) }} </span>
                  </div>
                </div>
              </div>

              <!-- Dual-Column Stats Display -->
              <div class="pet-base-stats-grid">
                <!-- Row 1: 生命 & 生命成长 -->
                <div class="pet-attr-cell">
                  <span class="attr-label">生命</span>
                  <span class="attr-val">{{ Math.floor(selectedPet.hp + growthHp * calcLevel) }}</span>
                </div>
                <div class="pet-attr-cell">
                  <span class="attr-label">成长</span>
                  <div class="attr-val-badge-container">
                    <span class="attr-val">{{ growthHp.toFixed(1) }}</span>
                    <span class="growth-rank-badge" :class="getGrowthRankBadge('hp', growthHp)">
                      {{ getGrowthRankLetter('hp', growthHp) }}
                    </span>
                  </div>
                </div>

                <!-- Row 2: 攻击 & 攻击成长 -->
                <div class="pet-attr-cell">
                  <span class="attr-label">攻击</span>
                  <span class="attr-val">{{ Math.floor(selectedPet.atk + growthAtk * calcLevel) }}</span>
                </div>
                <div class="pet-attr-cell">
                  <span class="attr-label">成长</span>
                  <div class="attr-val-badge-container">
                    <span class="attr-val">{{ growthAtk.toFixed(1) }}</span>
                    <span class="growth-rank-badge" :class="getGrowthRankBadge('atk', growthAtk)">
                      {{ getGrowthRankLetter('atk', growthAtk) }}
                    </span>
                  </div>
                </div>

                <!-- Row 3: 防御 & 防御成长 -->
                <div class="pet-attr-cell">
                  <span class="attr-label">防御</span>
                  <span class="attr-val">{{ Math.floor(selectedPet.def + growthDef * calcLevel) }}</span>
                </div>
                <div class="pet-attr-cell">
                  <span class="attr-label">成长</span>
                  <div class="attr-val-badge-container">
                    <span class="attr-val">{{ growthDef.toFixed(1) }}</span>
                    <span class="growth-rank-badge" :class="getGrowthRankBadge('def', growthDef)">
                      {{ getGrowthRankLetter('def', growthDef) }}
                    </span>
                  </div>
                </div>

                <!-- Row 4: 敏捷 & 敏捷成长 -->
                <div class="pet-attr-cell">
                  <span class="attr-label">敏捷</span>
                  <span class="attr-val">{{ Math.floor(selectedPet.dex + growthDex * calcLevel) }}</span>
                </div>
                <div class="pet-attr-cell">
                  <span class="attr-label">成长</span>
                  <div class="attr-val-badge-container">
                    <span class="attr-val">{{ growthDex.toFixed(1) }}</span>
                    <span class="growth-rank-badge" :class="getGrowthRankBadge('dex', growthDex)">
                      {{ getGrowthRankLetter('dex', growthDex) }}
                    </span>
                  </div>
                </div>
              </div>
            </UiSection>
          </div>
        </div>
      </template>

      <UiBackToTop scroll-container="#petModalScroll" />
    </UiModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { fetchPetData } from '../utils/petParser'
import { getImageUrl } from '../utils/env'
import { useRoute, useRouter } from 'vue-router'
import {
  UiSearchInput,
  UiFilterRow,
  UiFilterPill,
  UiCardGrid,
  UiItemCard,
  UiEmptyState,
  UiBackToTop,
  UiModal,
  UiTabs,
  UiSection,
  UiInfoRow,
  UiStatGrid,
  UiTag
} from '../components/ui/index.js'
import { isBlacklisted } from '../config/blacklist.js'
import { ELEMENT_SLUGS, ELEMENT_NAMES, formatHighlightedText, BASE_REWARD_PATHS } from '../utils/gameMappings'
import { useLazyList } from '../composables/useLazyList'

const route = useRoute()
const router = useRouter()

const allPets = ref([])
const petLevelData = ref(null)
const petSetting = ref(null)
const isDataReady = ref(false)
const detailVisible = ref(false)
const selectedPet = ref(null)
const errorMessage = ref('')

const searchQuery = ref('')
const selectedStar = ref(null)
const filterVariant = ref(null)

// Detail Drawer States
const activeTab = ref('skills')
const selectedSkillIdx = ref(0)
const selectedSkillLevel = ref(1)

// Stats Sliders
const growthHp = ref(0)
const growthAtk = ref(0)
const growthDef = ref(0)
const growthDex = ref(0)
const calcLevel = ref(1)

// 获取首字母大写的属性英文名，用于拼接图片路径
const getSpGachaElementSlug = (element) => ELEMENT_SLUGS[element] || 'Water'

// 兜底的属性中文名
const getElementName = (element) => ELEMENT_NAMES[element] || '水'

onMounted(async () => {
  try {
    const data = await fetchPetData()
    allPets.value = data.pets
    petLevelData.value = data.petLevel
    petSetting.value = data.petSetting
    isDataReady.value = true

    // Check URL Query parameter for auto-open
    if (route.query.id) {
      const pet = allPets.value.find(p => p.id === route.query.id)
      if (pet) {
        openPetDetail(pet)
      }
    }
  } catch (err) {
    errorMessage.value = '加载失败: ' + err.message
    console.error(err)
  }
})

watch(() => route.query.id, (newId) => {
  if (newId) {
    const pet = allPets.value.find(p => p.id === newId)
    if (pet) {
      openPetDetail(pet)
    }
  } else {
    closePetDetail()
  }
})

// Filter computation
const filteredPets = computed(() => {
  if (!isDataReady.value) return []
  
  let result = allPets.value.filter(p => !isBlacklisted(p))
  
  // Star Filter
  if (selectedStar.value !== null) {
    result = result.filter(p => p.starDisplay === selectedStar.value)
  }
  
  // Variant Filter
  if (filterVariant.value === true) {
    result = result.filter(p => p.hasVariant)
  }
  
  // Search Query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    result = result.filter(p => p.keywords.includes(q))
  }
  
  // Sort: First by star rating descending, then by pet ID ascending
  result.sort((a, b) => {
    if (b.starDisplay !== a.starDisplay) {
      return b.starDisplay - a.starDisplay
    }
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
  })
  
  return result
})

const { displayedItems: displayedPets } = useLazyList(filteredPets, 60, '#petsGridScroll')

// Navigation & Detail toggle
const handlePetClick = (pet) => {
  router.push({ query: { ...route.query, id: pet.id } })
}

const openPetDetail = (pet) => {
  selectedPet.value = pet
  detailVisible.value = true
  activeTab.value = 'skills'
  selectedSkillIdx.value = 0
  selectedSkillLevel.value = 1

  // Set default growth factors to best potential (75% mark of range)
  growthHp.value = pet.hpMin + (pet.hpMax - pet.hpMin) * 0.75
  growthAtk.value = pet.atkMin + (pet.atkMax - pet.atkMin) * 0.75
  growthDef.value = pet.defMin + (pet.defMax - pet.defMin) * 0.75
  growthDex.value = pet.dexMin + (pet.dexMax - pet.dexMin) * 0.75
  calcLevel.value = 1
}

const closePetDetail = () => {
  detailVisible.value = false
  if (route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } })
  }
}

// Format Skill description values
const formatSkillDescription = formatHighlightedText

// Skills Logic
const activeSkill = computed(() => {
  if (!selectedPet.value) return null
  return selectedPet.value.skills[selectedSkillIdx.value] || null
})

const activeSkillLevelData = computed(() => {
  if (!activeSkill.value) return null
  return activeSkill.value.levelData.find(ld => ld.level === selectedSkillLevel.value) || activeSkill.value.levelData[0] || null
})

const selectSkill = (idx) => {
  selectedSkillIdx.value = idx
  selectedSkillLevel.value = 1
}

// Active Skill Breakthrough costs list (e.g. [1, 1, 1, 2, 2, 2])
const getPetBreakthroughCosts = computed(() => {
  if (!selectedPet.value || !petSetting.value) return []
  const star = selectedPet.value.star
  const starExp = petSetting.value.petTpExp[star] || {}
  
  const costs = []
  for (let i = 0; i < 6; i++) {
    costs.push(starExp[String(i)] || 0)
  }
  return costs
})

// Active Breakthrough Step Index (0-5) mapping based on skill type and selected level
const getActiveBreakthroughStepIndex = computed(() => {
  if (!selectedPet.value || selectedSkillLevel.value >= 4) return -1
  
  const activeSkills = selectedPet.value.skills ? selectedPet.value.skills.filter(s => s.type === 'active') : []
  const currentActiveIndex = activeSkills.findIndex(s => s.id === activeSkill.value?.id)
  
  if (currentActiveIndex === 0) {
    if (selectedSkillLevel.value === 1) return 0
    if (selectedSkillLevel.value === 2) return 2
    if (selectedSkillLevel.value === 3) return 4
  } else if (currentActiveIndex === 1) {
    if (selectedSkillLevel.value === 1) return 1
    if (selectedSkillLevel.value === 2) return 3
    if (selectedSkillLevel.value === 3) return 5
  }
  return -1
})

const getTraitLevelHatchRequirement = () => {
  if (!selectedPet.value || !petSetting.value) return ''
  const star = selectedPet.value.star
  const starTj = petSetting.value.petTjExp[star] || {}
  
  const nextCost = starTj[selectedSkillLevel.value] || 0
  if (nextCost === 0 || nextCost > 90000) {
    return '已达最大等级'
  }
  return `下一级需育成数: ${nextCost}`
}

// Stats Ratings (C, B, A, S) Logic
const getGrowthRankLabel = (type, val) => {
  if (!selectedPet.value) return 'C'
  const pet = selectedPet.value
  let min = 0, max = 0
  if (type === 'hp') { min = pet.hpMin; max = pet.hpMax; }
  else if (type === 'atk') { min = pet.atkMin; max = pet.atkMax; }
  else if (type === 'def') { min = pet.defMin; max = pet.defMax; }
  else if (type === 'dex') { min = pet.dexMin; max = pet.dexMax; }

  const range = max - min
  if (range <= 0) return 'C'
  const ratio = (val - min) / range

  if (ratio < 0.25) return 'C'
  if (ratio < 0.50) return 'B'
  if (ratio < 0.75) return 'A'
  return 'S'
}

const getGrowthRankBadge = (type, val) => {
  const lbl = getGrowthRankLabel(type, val)
  if (lbl.includes('C')) return 'rank-c'
  if (lbl.includes('B')) return 'rank-b'
  if (lbl.includes('A')) return 'rank-a'
  return 'rank-s'
}

const getGrowthRankLetter = (type, val) => {
  const lbl = getGrowthRankLabel(type, val)
  return lbl.charAt(lbl.length - 1)
}

// Cumulative Upgrade Exp
const cumulativeLevelExp = computed(() => {
  if (!petLevelData.value) return 0
  let total = 0
  for (let lvl = 1; lvl < calcLevel.value; lvl++) {
    const lvlConfig = petLevelData.value[lvl] || petLevelData.value[String(lvl)]
    if (lvlConfig) {
      total += lvlConfig.exp || 0
    }
  }
  return total
})

// Time formatter
const formatHatchTime = (seconds) => {
  if (!seconds) return '0秒'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  let res = ''
  if (h > 0) res += `${h}小时`
  if (m > 0) res += `${m}分钟`
  if (s > 0 || res === '') res += `${s}秒`
  return res
}

const handleImgError = (e) => {
  e.target.style.opacity = '0.3'
}
</script>

<style scoped>
.pets-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ====== 筛选面板（半透明羊皮纸容器） ====== */
.filter-panel {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
  margin: 0 0 12px 0;
}

/* ====== 魔物卡牌网格（大幅面 5 列精致展示） ====== */
.pets-card-grid :deep(.ui-card-grid) {
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.pets-card-grid :deep(.ui-item-card) {
  max-width: 140px;
  width: 100%;
}

.pets-card-grid :deep(.ui-item-card__slot) {
  max-width: 140px;
  width: 100%;
  background: transparent !important;
  box-shadow: none;
  border: none;
}

.pets-card-grid :deep(.ui-item-card__name) {
  width: calc(100% - 6px);
  margin-top: 4px;
  font-size: 12px;
  padding: 2.5px 4px;
}

.pet-card-art {
  position: relative;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
}

.pet-card-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  object-fit: cover;
}

.pet-card-frame {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
}

.pet-card-avatar {
  position: absolute;
  top: 10%;
  left: 15%;
  width: 70%;
  height: 70%;
  object-fit: contain;
  z-index: 1;
}

@media (max-width: 1100px) {
  .pets-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
}

@media (max-width: 768px) {
  .pets-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .pets-card-grid :deep(.ui-card-grid) {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}

/* ====== 详情弹窗顶部立绘区 ====== */
.portrait-section {
  position: relative;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: calc(100% - 32px);
  max-width: calc(800px - 32px);
  margin: 16px auto;
  box-sizing: border-box;
}

.pet-portraits-row {
  display: flex;
  gap: 24px;
  justify-content: center;
  width: 100%;
  max-width: 600px;
}

.portrait-section.has-variants-layout .pet-portraits-row {
  justify-content: space-between;
}

.pet-portrait-box {
  flex: 1;
  max-width: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(43, 31, 21, 0.05);
  border-radius: 8px;
  border: 1px dashed var(--border-soft);
  padding: 12px;
  position: relative;
}

.portrait-label-pos {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 5;
}

.pet-portrait-img {
  max-height: 180px;
  max-width: 100%;
  object-fit: contain;
  margin-top: 14px;
}

.pet-description-text {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.7;
  margin: 14px 8px 4px;
  text-align: left;
  width: 100%;
}

/* 变异效果说明 */
.variant-effect-box {
  margin-top: 16px;
  background: rgba(126, 42, 168, 0.08);
  border: 1px solid rgba(126, 42, 168, 0.25);
  padding: 10px 16px;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  text-align: center;
  font-size: 13px;
  line-height: 1.6;
}

.variant-effect-title {
  font-weight: bold;
  color: var(--q4);
  margin-right: 6px;
}

.variant-effect-txt {
  color: var(--text-main);
}

/* 右上角属性角标定位 */
.portrait-element-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: bold;
  z-index: 5;
}

.top-right-badge-icon {
  width: 20px;
  height: 20px;
}

/* 属性颜色（走主题色） */
.element-1 { color: var(--q3); }   /* 水 - 蓝 */
.element-2 { color: var(--danger); } /* 火 - 红 */
.element-3 { color: var(--q2); }   /* 风 - 绿 */
.element-4 { color: var(--q5); }   /* 地 - 棕 */

/* ====== 详情页签包装（吸顶） ====== */
.detail-tabs-wrap {
  width: calc(100% - 32px);
  max-width: calc(800px - 32px);
  margin: 0 auto 16px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--paper);
  border-radius: 6px 6px 0 0;
  box-sizing: border-box;
}

/* ====== 页签内容块 ====== */
.tab-pane-content {
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  padding: 16px;
  width: calc(100% - 32px);
  max-width: calc(800px - 32px);
  margin: 0 auto 40px;
  box-sizing: border-box;
}

/* ====== 技能选择网格（页特有卡组） ====== */
.skills-select-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

@media (max-width: 500px) {
  .skills-select-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.skill-select-card {
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--paper-soft);
  cursor: pointer;
  transition: all 0.2s;
}

.skill-select-card:hover {
  background: var(--hover-bg);
}

.skill-select-card.active {
  border-color: var(--accent-bright);
  background: rgba(122, 154, 153, 0.12);
}

.skill-select-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(43, 31, 21, 0.10);
}

.skill-select-icon-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.trait-inner-avatar {
  position: absolute;
  top: 9%;
  left: 9%;
  width: 82%;
  height: 82%;
  border-radius: 50%;
  object-fit: cover;
}

.trait-frame-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.active-skill-sprite {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.skill-select-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  min-width: 0;
}

.sk-name {
  font-size: 12px;
  font-weight: bold;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ====== 技能详情卡 ====== */
.skill-desc-detail-card {
  flex: 1;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sk-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 8px;
}

.sk-detail-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-main);
}

.sk-description-body {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.7;
  background: var(--paper-solid);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-faint);
}

.lvl-subname {
  font-size: 13px;
  font-weight: bold;
  color: var(--text-main);
  margin-bottom: 4px;
}

/* 培育提升要求提示框 */
.sk-upgrade-cost-alert-box {
  background: rgba(138, 106, 31, 0.08);
  border: 1px solid rgba(138, 106, 31, 0.28);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.7;
}

.sk-upgrade-cost-alert-box .alert-title {
  font-weight: bold;
  color: var(--gold);
  margin-bottom: 4px;
}

.sk-upgrade-cost-alert-box .alert-text {
  color: var(--text-main);
  line-height: 1.7;
}

.highlight-orange {
  color: var(--gold);
  font-weight: bold;
}

/* ====== 属性/成长区 ====== */
.stats-growth-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 成长等级徽章（C/B/A/S，对应品质色） */
.rank-badge,
.growth-rank-badge {
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fdf6e3;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.rank-badge {
  width: 45px;
  flex-shrink: 0;
}

.growth-rank-badge {
  width: 20px;
  height: 20px;
  padding: 0;
}

.rank-badge.rank-c, .growth-rank-badge.rank-c { background: var(--q2); }
.rank-badge.rank-b, .growth-rank-badge.rank-b { background: var(--q3); }
.rank-badge.rank-a, .growth-rank-badge.rank-a { background: var(--q4); }
.rank-badge.rank-s, .growth-rank-badge.rank-s { background: var(--q5); }

/* 等级模拟输出网格（带字母徽章，页特有） */
.pet-base-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pet-attr-cell {
  background: var(--paper-soft);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-faint);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  line-height: 1.6;
  min-width: 0;
}

.pet-attr-cell .attr-label {
  color: var(--text-muted);
  font-weight: 600;
}

.pet-attr-cell .attr-val {
  color: var(--text-main);
  font-weight: bold;
}

.attr-val-badge-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ====== 成长系数输入行 ====== */
.stats-inputs-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stat-input-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.stat-meta .name {
  font-weight: bold;
  color: var(--text-main);
}

.stat-meta .range {
  color: var(--text-muted);
}

.slider-container-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-container-row .range-slider-m {
  flex: 1;
}

.slider-container-row .current-val {
  font-size: 13px;
  font-weight: bold;
  color: var(--text-main);
  width: 45px;
  text-align: right;
  flex-shrink: 0;
}

/* ====== 滑块（页特有控件） ====== */
.level-slider-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.slider-title {
  color: var(--text-muted);
}

.slider-value {
  font-weight: bold;
  color: var(--accent-ink);
}

.range-slider-m {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-soft);
  outline: none;
  -webkit-appearance: none;
}

.range-slider-m::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.range-slider-m::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.range-slider-m::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  border: none;
}

/* ====== 经验换算 ====== */
.exp-cost-box {
  background: var(--paper-solid);
  border: 1px solid var(--border-soft);
  padding: 10px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.exp-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-main);
}

.highlight-accent {
  color: var(--accent-ink);
  font-weight: bold;
}

.exp-slime-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.slime-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--paper-soft);
  border: 1px solid var(--border-soft);
  padding: 2px 8px;
  border-radius: 12px;
}

.mini-slime-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

/* 属性图标（其他属性中的钱币/经验图标） */
.inline-icon-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: bold;
  color: var(--text-main);
}

.mini-attr-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
</style>