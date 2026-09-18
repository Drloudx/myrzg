<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板（分类 / 状态 / 子状态 分段页签） -->
    <UiFilterPanel class="filter-sticky-bar rewards-filter-sticky paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" :placeholder="currentMainCat === 'combat_rules' ? '搜索战斗规则，如冷却、暴击、护盾...' : '搜索奖励、物品、地图或说明...'" />
      </template>

      <!-- 主分类（Row 1） -->
      <div class="control-row-1">
        <UiFilterRow label="板块：">
          <UiFilterPill
            v-for="cat in mainCategories"
            :key="cat.id"
            :active="currentMainCat === cat.id"
            @click="currentMainCat = cat.id"
          >{{ cat.name }}</UiFilterPill>
        </UiFilterRow>
      </div>

      <!-- PVP 子分类（Row 2） -->
      <div class="control-row-2" v-if="currentMainCat === 'pvp'">
        <UiFilterRow label="类型：">
          <UiFilterPill
            v-for="sub in pvpSubCategories"
            :key="sub.id"
            :active="currentSubCat === sub.id"
            @click="currentSubCat = sub.id"
          >{{ sub.name }}</UiFilterPill>
        </UiFilterRow>
      </div>

      <!-- 隐藏物品地图子分类（Row 2） -->
      <div class="control-row-2" v-if="currentMainCat === 'hidden'">
        <UiFilterRow label="地图：">
          <UiFilterPill
            v-for="option in hiddenMapOptions"
            :key="option.value"
            :active="currentHiddenCat === option.value"
            @click="currentHiddenCat = option.value"
          >{{ option.label }}</UiFilterPill>
        </UiFilterRow>
      </div>

      <UiFilterRow v-if="currentMainCat === 'hidden'" label="状态：">
        <UiFilterPill
          v-for="status in hiddenStatusOptions"
          :key="status.value"
          :active="currentHiddenStatus === status.value"
          @click="currentHiddenStatus = status.value"
        >
          {{ status.label }}
        </UiFilterPill>
      </UiFilterRow>

      <div v-if="currentMainCat === 'hidden'" class="hidden-count">
        共有 <span class="count-num">{{ mapHiddenRewards.length }}</span> 个点位
        <span class="hidden-count__divider">·</span>
        已收集 <span class="count-num">{{ hiddenCollectedCount }}</span> / {{ mapHiddenRewards.length }}
      </div>

      <!-- 兑换三级分类（Row 3） -->
      <div class="control-row-3" v-if="currentMainCat === 'pvp' && currentSubCat === 'exchange'">
        <UiFilterRow label="赛季：">
          <UiFilterPill
            v-for="subCat in Object.keys(pvpRewards?.exchange || {})"
            :key="subCat"
            :active="currentExchangeCat === subCat"
            @click="currentExchangeCat = subCat"
          >{{ subCat === 's1' ? 'S1 兑换' : `${subCat} 兑换` }}</UiFilterPill>
        </UiFilterRow>
      </div>
    </UiFilterPanel>

    <!-- 加载态 -->
    <UiEmptyState v-if="loading && currentMainCat !== 'combat_rules'" type="loading" text="正在装配奖励数据..." />

    <!-- 主内容区 -->
    <div v-else-if="pvpRewards || currentMainCat === 'combat_rules'" class="rewards-content" id="rewardsScroll" data-main-scroll>

      <CombatRules v-if="currentMainCat === 'combat_rules'" :query="searchQuery" />

      <template v-else-if="currentMainCat === 'pvp'">

        <!-- 挑战赛规则 -->
        <div v-if="currentSubCat === 'rules' && pvpRewards.rules && matchesRewardQuery(pvpRewards.rules, '挑战赛 赛事 赛区 规则 追加挑战')" class="pvp-rules-container">
          <UiSection title="挑战赛规则">
            <div class="pvp-rule-copy">
              <p v-for="(line, index) in ruleLines(pvpRewards.rules.sessionDescription)" :key="index">
                {{ line }}
              </p>
            </div>
            <div class="pvp-purchase-rule">
              <span>追加挑战</span>
              <strong>
                {{ pvpRewards.rules.purchase.price }} 氪金 / {{ pvpRewards.rules.purchase.count }} 次，
                每日最多 {{ pvpRewards.rules.purchase.dailyMax }} 次
              </strong>
            </div>
          </UiSection>

          <UiSection title="赛区规则">
            <div class="pvp-area-grid">
              <article v-for="area in pvpRewards.rules.areas" :key="area.name" class="pvp-area-rule">
                <div class="pvp-area-rule__head">
                  <h4>{{ area.name }}</h4>
                  <span v-if="area.specialDescription">{{ area.specialDescription }}</span>
                  <span v-else>{{ area.modeDescription }}</span>
                </div>
                <p>{{ area.description }}</p>
              </article>
            </div>
          </UiSection>
        </div>
        <UiEmptyState v-if="currentSubCat === 'rules' && !matchesRewardQuery(pvpRewards.rules, '挑战赛 赛事 赛区 规则 追加挑战')" text="未找到匹配的赛事规则" />

        <!-- 兑换奖励 -->
        <div v-if="currentSubCat === 'exchange'" class="reward-list-container">
          <div v-if="filteredPvpExchanges.length" class="exchange-trade-list">
            <UiExchangeTrade
              v-for="ex in filteredPvpExchanges"
              :key="ex.id"
              :id="`pvpExchange-${ex.id}`"
              :title="pvpExchangeTitle(ex)"
              :reward-items="flattenPvpItems(ex.rewardItems)"
              :consume-items="flattenPvpItems(ex.consumeItems)"
              :limit-text="pvpLimitText(ex.limitCondition)"
              @item-click="openItem"
            />
          </div>
          <UiEmptyState v-else text="未找到匹配的兑换奖励" />
        </div>

        <!-- 段位奖励 -->
        <div v-if="currentSubCat === 'tier'" class="reward-list-container">
          <UiListRow v-for="tier in filteredPvpTiers" :key="tier.id" :id="`tier-${tier.id}`">
            <div class="row-left">
              <div class="tier-heading">
                <span class="row-title">{{ tier.name }}</span>
                <span class="tier-score">所需积分 {{ tier.score }}</span>
              </div>
            </div>
            <template #right>
              <div class="row-right flex-start">
                <div class="items-flex">
                  <div v-for="group in tier.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                    <UiRewardCard
                      v-for="rule in group.rules"
                      :key="rule.typeId"
                      :rule="{
                        targetName: (getCachedItem(rule.typeId) || {}).name || rule.typeId,
                        targetImg: getIcon(rule.typeId),
                        targetQuality: (getCachedItem(rule.typeId) || {}).quality || 1,
                        min: rule.min !== undefined ? rule.min : (rule.num !== undefined ? rule.num : undefined),
                        max: rule.max !== undefined ? rule.max : (rule.num !== undefined ? rule.num : undefined),
                        num: rule.num,
                        typeId: rule.typeId
                      }"
                      @click="openItem(rule.typeId)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UiListRow>
          <UiEmptyState v-if="!filteredPvpTiers.length" text="未找到匹配的段位奖励" />
        </div>

        <!-- 排名奖励 -->
        <div v-if="currentSubCat === 'rank'" class="reward-list-container">
          <UiListRow v-for="rank in filteredPvpRanks" :key="rank.start" :id="`rank-${rank.start}`">
            <div class="row-left">
              <span class="row-title">{{ rank.end === -1 ? `${rank.start}名以后` : `${rank.start}-${rank.end}名` }}</span>
            </div>
            <template #right>
              <div class="row-right flex-start">
                <div class="items-flex">
                  <div v-for="group in rank.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                    <UiRewardCard
                      v-for="rule in group.rules"
                      :key="rule.typeId"
                      :rule="{
                        targetName: (getCachedItem(rule.typeId) || {}).name || rule.typeId,
                        targetImg: getIcon(rule.typeId),
                        targetQuality: (getCachedItem(rule.typeId) || {}).quality || 1,
                        min: rule.min !== undefined ? rule.min : (rule.num !== undefined ? rule.num : undefined),
                        max: rule.max !== undefined ? rule.max : (rule.num !== undefined ? rule.num : undefined),
                        num: rule.num,
                        typeId: rule.typeId
                      }"
                      @click="openItem(rule.typeId)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UiListRow>
          <UiEmptyState v-if="!filteredPvpRanks.length" text="未找到匹配的排名奖励" />
        </div>

        <!-- 战斗结算 -->
        <div v-if="currentSubCat === 'battle'" class="reward-list-container">
          <UiListRow v-if="pvpRewards.battle.win && matchesRewardQuery(pvpRewards.battle.win, '战斗胜利')" id="battle-win">
            <div class="row-left">
              <div class="tier-heading">
                <span class="row-title win-title">战斗胜利</span>
                <span class="tier-score battle-score battle-score--win">积分 +{{ pvpRewards.battle.win.score }}</span>
              </div>
            </div>
            <template #right>
              <div class="row-right flex-start">
                <div class="items-flex">
                  <div v-for="group in pvpRewards.battle.win.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                    <UiRewardCard
                      v-for="rule in group.rules"
                      :key="rule.typeId"
                      :rule="{
                        targetName: (getCachedItem(rule.typeId) || {}).name || rule.typeId,
                        targetImg: getIcon(rule.typeId),
                        targetQuality: (getCachedItem(rule.typeId) || {}).quality || 1,
                        min: rule.min !== undefined ? rule.min : (rule.num !== undefined ? rule.num : undefined),
                        max: rule.max !== undefined ? rule.max : (rule.num !== undefined ? rule.num : undefined),
                        num: rule.num,
                        typeId: rule.typeId
                      }"
                      @click="openItem(rule.typeId)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UiListRow>

          <UiListRow v-if="pvpRewards.battle.fail && matchesRewardQuery(pvpRewards.battle.fail, '战斗失败 不获得积分')" id="battle-fail">
            <div class="row-left">
              <div class="tier-heading">
                <span class="row-title fail-title">战斗失败</span>
                <span class="tier-score battle-score battle-score--fail">不获得积分</span>
              </div>
            </div>
            <template #right>
              <div class="row-right flex-start">
                <div class="items-flex">
                  <div v-for="group in pvpRewards.battle.fail.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                    <UiRewardCard
                      v-for="rule in group.rules"
                      :key="rule.typeId"
                      :rule="{
                        targetName: (getCachedItem(rule.typeId) || {}).name || rule.typeId,
                        targetImg: getIcon(rule.typeId),
                        targetQuality: (getCachedItem(rule.typeId) || {}).quality || 1,
                        min: rule.min !== undefined ? rule.min : (rule.num !== undefined ? rule.num : undefined),
                        max: rule.max !== undefined ? rule.max : (rule.num !== undefined ? rule.num : undefined),
                        num: rule.num,
                        typeId: rule.typeId
                      }"
                      @click="openItem(rule.typeId)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </UiListRow>
          <UiEmptyState v-if="!hasFilteredBattleRewards" text="未找到匹配的战斗奖励" />
        </div>

      </template>

      <!-- 被隐藏的物品 -->
      <template v-else-if="currentMainCat === 'hidden'">
        <div class="reward-list-container">
          <UiListRow
            v-for="group in groupedHiddenRewards"
            :key="group.id || group.roomId"
            :id="`hidden-${group.id || group.roomId}`"
            class="hidden-list-row"
            :class="{ 'is-collected': isHiddenCollected(group) }"
          >
            <div class="hidden-row-head">
              <div class="hidden-row-title">{{ group.areaName }} - {{ group.roomName }}</div>
              <UiCollectionToggle :active="isHiddenCollected(group)" @toggle="toggleHiddenCollected(group)" />
            </div>
            <div class="hidden-row-info">
              <span class="row-title">{{ group.collectName }}</span>
              <span v-if="group.collectTip" class="collect-tip">{{ group.collectTip }}</span>
            </div>
            <div class="items-flex">
              <div v-for="grp in group.rewardItems" :key="grp.typeId || Math.random()" class="item-group">
                <UiRewardCard
                  v-for="rule in grp.rules"
                  :key="rule.typeId"
                  :rule="{
                    targetName: (getCachedItem(rule.typeId) || {}).name || rule.typeId,
                    targetImg: getIcon(rule.typeId),
                    targetQuality: (getCachedItem(rule.typeId) || {}).quality || 1,
                    min: rule.min !== undefined ? rule.min : (rule.num !== undefined ? rule.num : undefined),
                    max: rule.max !== undefined ? rule.max : (rule.num !== undefined ? rule.num : undefined),
                    num: rule.num,
                    typeId: rule.typeId
                  }"
                  @click="openItem(rule.typeId)"
                />
              </div>
            </div>
            <!-- 点位预览图：独占一行，放在点位信息下方 -->
            <img
              v-if="group.prevImg"
              :src="getImageUrl(group.prevImg)"
              class="hidden-prev-img"
              alt="点位预览"
              loading="lazy"
              @click="openPrevImg(group.prevImg)"
            />
          </UiListRow>

          <UiEmptyState v-if="!groupedHiddenRewards.length" text="当前地图下暂无隐藏场景宝箱数据" />
        </div>
      </template>

      <!-- 育室槽位消耗 -->
      <template v-else-if="currentMainCat === 'slot_cost'">
        <div class="reward-list-container">
          <UiListRow v-if="slotCosts && matchesRewardQuery(slotCosts, '培育室 槽位 扩张 银币 金币 冒险等级')">
            <div class="slot-cost-title">培育室槽位扩张费用</div>

            <div class="slot-costs-grid-layout">
              <!-- 银币扩建 -->
              <div class="slot-column-card">
                <h4 class="slot-column-title">银币扩建</h4>
                <div class="slot-cost-list-item" v-for="(item, idx) in slotCosts.petSlotMoney" :key="idx">
                  <span class="slot-times-label">第 {{ idx + 1 }} 次扩建</span>
                  <div class="slot-cost-details">
                    <span class="slot-level-req">需要冒险等级 {{ item.level }}</span>
                    <div class="slot-cost-badge">
                      <img :src="getImageUrl(REWARD_MODE_INFO.money.icon)" class="mini-coin-icon" />
                      <span>×{{ item.value }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 金币扩建 -->
              <div class="slot-column-card">
                <h4 class="slot-column-title">金币扩建</h4>
                <div class="slot-cost-list-item" v-for="(item, idx) in slotCosts.petSlotKe" :key="idx">
                  <span class="slot-times-label">第 {{ idx + 1 }} 次扩建</span>
                  <div class="slot-cost-details">
                    <span class="slot-level-req">需要冒险等级 {{ item.level }}</span>
                    <div class="slot-cost-badge">
                      <img :src="getImageUrl(REWARD_MODE_INFO.ke.icon)" class="mini-coin-icon" />
                      <span>×{{ item.value }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </UiListRow>
          <UiEmptyState v-else :text="slotCosts ? '未找到匹配的育室槽位数据' : '暂无育室槽位数据'" />
        </div>
      </template>

      <template v-else>
        <UiEmptyState text="该板块奖励数据暂未开放，敬请期待..." />
      </template>
    </div>

    <UiBackToTop scroll-container="#rewardsScroll" />

    <!-- 点位预览图全屏查看 -->
    <UiModal
      v-model:visible="prevImgModal.visible"
      title="点位预览"
      max-width="1100px"
      scroll-id="rewardPreviewScroll"
      teleport-to="body"
      :close-on-overlay="true"
      @close="closePrevImg"
    >
      <img :src="prevImgModal.url" class="prev-img-full" alt="点位预览大图" decoding="async" />
    </UiModal>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiCollectionToggle,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiListRow,
  UiExchangeTrade,
  UiRewardCard,
  UiModal,
  UiSection,
  UiFilterPanel, UiSearchInput,
  UiBackToTop
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import { getCachedItem, fetchItemData } from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { isBlacklisted } from '../config/blacklist.js'
import { REWARD_MODE_INFO } from '../utils/gameMappings'
import { resolveScrollTarget } from '../utils/scrollTarget.js'
import { useAppStateStore } from '../stores/appState.js'
import CombatRules from '../components/CombatRules.vue'

const route = useRoute()
const router = useRouter()
const appStateStore = useAppStateStore()
const loading = ref(true)
const pvpRewards = ref(null)

const mainCategories = [
  { id: 'pvp', name: '挑战赛奖励' },
  { id: 'hidden', name: '被隐藏的物品' },
  { id: 'slot_cost', name: '育室槽位消耗' },
  { id: 'combat_rules', name: '战斗规则' }
]
const resolveMainCategory = value => {
  if (value === 'ph3') return 'combat_rules'
  return mainCategories.some(cat => cat.id === value) ? value : 'pvp'
}
const currentMainCat = ref(resolveMainCategory(route.query.tab))

const pvpSubCategories = [
  { id: 'exchange', name: '兑换奖励' },
  { id: 'tier', name: '段位奖励' },
  { id: 'rank', name: '排名奖励' },
  { id: 'battle', name: '战斗结算' },
  { id: 'rules', name: '赛事规则' }
]
const currentSubCat = ref('exchange')
const currentExchangeCat = ref('s1')
const routeTabsReady = ref(false)
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')

const hiddenRewardsData = ref([])
const currentHiddenCat = ref('')
const currentHiddenStatus = ref('all')
const slotCosts = ref(null)

const hiddenStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'collected', label: '已收集' },
  { value: 'uncollected', label: '未收集' }
]

const hiddenMapCategories = computed(() => {
  const maps = new Set(hiddenRewardsData.value.map(h => h.bigMapName))
  return Array.from(maps)
})

const hiddenMapOptions = computed(() => [
  { value: 'all', label: '全部' },
  ...hiddenMapCategories.value.map(mapName => ({ value: mapName, label: mapName }))
])

const mapHiddenRewards = computed(() => {
  if (currentHiddenCat.value === 'all') return hiddenRewardsData.value
  return hiddenRewardsData.value.filter(h => h.bigMapName === currentHiddenCat.value)
})

const groupedHiddenRewards = computed(() => {
  let groups = mapHiddenRewards.value
  if (currentHiddenStatus.value === 'collected') groups = groups.filter(isHiddenCollected)
  if (currentHiddenStatus.value === 'uncollected') groups = groups.filter(group => !isHiddenCollected(group))
  return groups.filter(group => matchesRewardQuery(group))
})

const hiddenProgressId = group => {
  const relationId = [group.roomId, group.collectId, group.rewardId].filter(Boolean).join('|')
  return relationId || group.id || group.roomId
}

const isHiddenCollected = group => {
  const collectedIds = appStateStore.collectedHiddenRewardIds
  return Array.isArray(collectedIds) && collectedIds.includes(hiddenProgressId(group))
}

const toggleHiddenCollected = group => {
  appStateStore.toggleHiddenRewardCollected(hiddenProgressId(group))
}

const hiddenCollectedCount = computed(() => {
  return mapHiddenRewards.value.filter(isHiddenCollected).length
})

const queryText = value => {
  const resolved = Array.isArray(value) ? value[0] : value
  return typeof resolved === 'string' ? resolved : ''
}

/**
 * 物品表按需加载完成前后的响应式触发器。
 * `getCachedItem` 读的是 itemParser 的模块级缓存（非响应式），
 * 下面三个消费函数必须先触摸本 ref，物品到达后使用它们的计算属性才会重算。
 */
const trackItemData = () => itemDataVersion.value

const rewardSearchText = value => {
  trackItemData()
  const parts = []
  const visit = entry => {
    if (entry === null || entry === undefined) return
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }
    if (typeof entry === 'object') {
      if (entry.typeId) {
        const item = getCachedItem(entry.typeId)
        if (item?.name) parts.push(item.name)
      }
      Object.values(entry).forEach(visit)
      return
    }
    parts.push(String(entry))
  }
  visit(value)
  return parts.join(' ').toLowerCase()
}

const matchesRewardQuery = (value, extra = '') => {
  const query = searchQuery.value.trim().toLowerCase()
  return !query || `${extra} ${rewardSearchText(value)}`.toLowerCase().includes(query)
}

const filteredPvpExchanges = computed(() =>
  (pvpRewards.value?.exchange?.[currentExchangeCat.value] || []).filter(exchange => matchesRewardQuery(exchange, pvpExchangeTitle(exchange)))
)
const filteredPvpTiers = computed(() =>
  (pvpRewards.value?.tier || []).filter(tier => matchesRewardQuery(tier, tier.name))
)
const filteredPvpRanks = computed(() =>
  (pvpRewards.value?.rank || []).filter(rank => matchesRewardQuery(rank, `${rank.start} ${rank.end} 排名`))
)
const hasFilteredBattleRewards = computed(() =>
  (pvpRewards.value?.battle?.win && matchesRewardQuery(pvpRewards.value.battle.win, '战斗胜利'))
  || (pvpRewards.value?.battle?.fail && matchesRewardQuery(pvpRewards.value.battle.fail, '战斗失败 不获得积分'))
)

const applyTabsFromRoute = () => {
  searchQuery.value = queryText(route.query.q)

  const requestedMain = queryText(route.query.tab)
  currentMainCat.value = resolveMainCategory(requestedMain)

  if (currentMainCat.value === 'pvp') {
    const requestedSub = queryText(route.query.sub)
    currentSubCat.value = pvpSubCategories.some(cat => cat.id === requestedSub) ? requestedSub : 'exchange'

    if (currentSubCat.value === 'exchange') {
      const exchangeCategories = Object.keys(pvpRewards.value?.exchange || {})
      const requestedSeason = queryText(route.query.season)
      currentExchangeCat.value = exchangeCategories.includes(requestedSeason)
        ? requestedSeason
        : (exchangeCategories[0] || '')
    }
  } else if (currentMainCat.value === 'hidden') {
    const requestedMap = queryText(route.query.map)
    currentHiddenCat.value = requestedMap === 'all' || hiddenMapCategories.value.includes(requestedMap)
      ? requestedMap
      : 'all'
    const requestedStatus = queryText(route.query.status)
    currentHiddenStatus.value = hiddenStatusOptions.some(status => status.value === requestedStatus)
      ? requestedStatus
      : 'all'
  }
}

const syncTabsToRoute = async () => {
  if (!routeTabsReady.value && currentMainCat.value !== 'combat_rules') return

  const query = { ...route.query, tab: currentMainCat.value }
  delete query.sub
  delete query.season
  delete query.map
  delete query.status
  delete query.q

  if (currentMainCat.value === 'pvp') {
    query.sub = currentSubCat.value
    if (currentSubCat.value === 'exchange' && currentExchangeCat.value) {
      query.season = currentExchangeCat.value
    }
  } else if (currentMainCat.value === 'hidden' && currentHiddenCat.value) {
    query.map = currentHiddenCat.value
    query.status = currentHiddenStatus.value
  }
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()

  const currentQuery = route.query
  const keys = new Set([...Object.keys(currentQuery), ...Object.keys(query)])
  const unchanged = [...keys].every(key => queryText(currentQuery[key]) === queryText(query[key]))
  if (!unchanged) await router.replace({ query })
}

onMounted(async () => {
  // 挑战赛与隐藏点位两张小表互相独立：并行取，不要串成一条等待链。
  const [pvpRes, hiddenRes] = await Promise.all([
    fetchWithFallback('data/parsed/parsed-pvp.json').catch(e => {
      console.error('Failed to load parsed/parsed-pvp.json', e)
      return null
    }),
    fetchWithFallback('data/parsed/parsed-hidden.json').catch(e => {
      console.error('Failed to load parsed-hidden.json', e)
      return null
    })
  ])

  if (pvpRes) {
    pvpRewards.value = pvpRes
    if (pvpRes.exchange) {
      const keys = Object.keys(pvpRes.exchange)
      if (keys.length > 0) currentExchangeCat.value = keys[0]
    }
  }

  if (hiddenRes) {
    hiddenRewardsData.value = hiddenRes.filter(h => !isBlacklisted({
      name: `${h.bigMapName} ${h.areaName} ${h.roomName} ${h.collectName || ''}`
    }))
    if (hiddenRewardsData.value.length > 0) {
      currentHiddenCat.value = 'all'
    }
  }

  // 育室槽位只消费 petSetting：取 3KB 的小表透传，不再为一项配置加载整张魔物图鉴表。
  try {
    slotCosts.value = await fetchWithFallback('data/parsed/petSetting.json')
  } catch (e) {
    console.error('Failed to load petSetting for slotCosts', e)
  }

  applyTabsFromRoute()
  routeTabsReady.value = true
  await syncTabsToRoute()
  loading.value = false
  setTimeout(() => scrollToTarget(), 300)

  // 物品表（2.4MB）只服务奖励卡上的物品名与图标，不阻塞页面装配：
  // 上面渲染完成后按需加载，到达时 targetName/targetImg 由计算属性自行重算。
  ensureItemData()
})

/**
 * 奖励卡的 targetName / targetQuality / targetImg 依赖 `getCachedItem` / `getIcon` 背后的物品表。
 * 该表体积远大于本页自身的两张小表，因此不放进 onMounted 的等待链：先让页面可读，
 * 再按需加载。战斗规则页签完全不消费物品表，此时不会触发这次请求。
 */
let itemDataPromise = null
const itemDataVersion = ref(0)
const ITEM_CONSUMING_CATS = new Set(['pvp', 'hidden'])
const needsItemData = () =>
  currentMainCat.value === 'combat_rules'
    ? false
    : ITEM_CONSUMING_CATS.has(currentMainCat.value)
      ? true
      : false

const ensureItemData = () => {
  if (!needsItemData() || itemDataPromise) return itemDataPromise
  itemDataPromise = fetchItemData()
    .then(() => { itemDataVersion.value += 1 })
    .catch(err => {
      console.error('Failed to load item data for RewardsView', err)
      itemDataPromise = null
    })
  return itemDataPromise
}

// 页签切到真正消费物品表的分支时再补加载（含深链直达 combat_rules 时完全不加载）。
watch([currentMainCat, currentSubCat], ensureItemData)

const waitForRenderableTarget = async (element, timeout = 1500) => {
  const startedAt = performance.now()
  while (performance.now() - startedAt < timeout) {
    const page = element.closest('.page-view-container')
    if (element.isConnected && element.getBoundingClientRect().height > 0 && (!page || getComputedStyle(page).display !== 'none')) return true
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return false
}

const alignTargetInViewport = element => {
  const scrollTarget = resolveScrollTarget('#rewardsScroll')
  if (scrollTarget === window) {
    const top = window.scrollY + element.getBoundingClientRect().top - (window.innerHeight - element.offsetHeight) / 2
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    return
  }

  const targetRect = element.getBoundingClientRect()
  const rootRect = scrollTarget.getBoundingClientRect()
  const top = scrollTarget.scrollTop + targetRect.top - rootRect.top - (scrollTarget.clientHeight - targetRect.height) / 2
  scrollTarget.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
}

const scrollToTarget = async () => {
  if (currentMainCat.value === 'combat_rules') return
  const { id } = route.query
  if (!id) return

  if (String(id).startsWith('hidden-')) {
    currentMainCat.value = 'hidden'
    currentHiddenStatus.value = 'all'
  } else {
    currentMainCat.value = 'pvp'
  }

  let targetId = ''
  if (String(id).startsWith('pvpExchange')) {
    currentSubCat.value = 'exchange'
    targetId = `pvpExchange-${id}`
  } else if (String(id).match(/^\d+$/) && pvpRewards.value.tier.find(t => t.id === id)) {
    currentSubCat.value = 'tier'
    targetId = `tier-${id}`
  } else if (String(id).startsWith('pvpRank')) {
    currentSubCat.value = 'rank'
    // To exact target if possible
    targetId = `rank-${id}` // id here is pvpRank00x, we didn't map perfectly for rank ID.
    // Let's just highlight the tab for rank
  } else if (id === 'pvpWin' || id === 'pvpFailure' || id === 'battle') {
    currentSubCat.value = 'battle'
    if (id === 'pvpWin') targetId = 'battle-win'
    if (id === 'pvpFailure') targetId = 'battle-fail'
  } else if (String(id).startsWith('hidden-')) {
    targetId = id
    // id 可能是唯一条目 id（roomId-摘要）或旧 roomId；匹配时按 id 优先，缺失再回退 roomId。
    const rawKey = id.replace('hidden-', '')
    const rewardGroup = hiddenRewardsData.value.find(h => h.id === rawKey || h.roomId === rawKey)
    if (rewardGroup) {
      currentHiddenCat.value = rewardGroup.bigMapName
    }
  }

  await nextTick()
  if (!targetId) return
  const el = document.getElementById(targetId)
  if (!el || !await waitForRenderableTarget(el)) return

  el.classList.add('highlight-section')
  // 路由弹窗退场和懒加载图片都可能在首次定位后改变布局，短时间内复核并校正落点。
  for (const delay of [0, 120, 280, 520]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    if (route.query.id !== id || !el.isConnected) break
    alignTargetInViewport(el)
  }
  setTimeout(() => el.classList.remove('highlight-section'), 2000)

  // 定位参数是一次性导航指令，消费后移除，避免关闭物品详情时再次触发相同定位。
  if (route.query.id === id) {
    const query = { ...route.query }
    delete query.id
    await router.replace({ query })
  }
}

watch(() => route.query.id, () => {
  if (pvpRewards.value) {
    setTimeout(scrollToTarget, 100)
  }
})

watch(
  () => [route.query.tab, route.query.sub, route.query.season, route.query.map, route.query.status, route.query.q],
  () => {
    if (routeTabsReady.value || resolveMainCategory(queryText(route.query.tab)) === 'combat_rules') applyTabsFromRoute()
  }
)

watch(
  [currentMainCat, currentSubCat, currentExchangeCat, currentHiddenCat, currentHiddenStatus, searchQuery],
  () => syncTabsToRoute()
)

const getIcon = (typeId) => {
  trackItemData()
  const item = getCachedItem(typeId)
  if (item && item.img) {
    return getImageUrl(`/Common_ItemIcon/${item.img}.webp`)
  }
  return getImageUrl('/ui/default_item.svg')
}

const flattenPvpItems = (groups = []) => {
  trackItemData()
  const items = []
  for (const group of groups || []) {
    const rules = group?.rules || [group]
    for (const rule of rules) {
      const typeId = rule?.typeId || group?.typeId
      if (!typeId) continue
      const item = getCachedItem(typeId) || {}
      const num = rule?.num ?? group?.num ?? rule?.min ?? rule?.max ?? 1
      items.push({
        typeId,
        num,
        name: item.name || typeId,
        icon: getIcon(typeId),
        quality: item.quality || 1
      })
    }
  }
  return items
}

const pvpExchangeTitle = (exchange) => {
  const firstReward = flattenPvpItems(exchange?.rewardItems)[0]
  return firstReward?.name || '兑换物品'
}

const pvpLimitText = (limit) => {
  if (!limit) return ''
  return limit.num ? `限购 ${limit.num} 次` : '限购'
}

const ruleLines = text => String(text || '')
  .split(/\r?\n/)
  .map(line => line.trim().replace(/^·\s*/, ''))
  .filter(Boolean)

const openItem = (typeId) => {
  const item = getCachedItem(typeId)
  if (item) {
    router.push({ query: { ...route.query, itemId: typeId } })
  }
}

// 点位预览图查看（全屏遮罩）
const prevImgModal = ref({ visible: false, url: '' })
const openPrevImg = (url) => {
  prevImgModal.value = { visible: true, url: getImageUrl(url) }
}
const closePrevImg = () => {
  prevImgModal.value.visible = false
}

</script>

<style scoped>
/* 筛选区（半透明羊皮纸面板） */
.rewards-filter-sticky {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.control-row-1, .control-row-2, .control-row-3 {
  width: 100%;
}

.hidden-count {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.hidden-count__divider {
  padding: 0 4px;
  color: var(--border-strong);
}

/* 主内容滚动区 */
.rewards-content {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0 14px 0;
  box-sizing: border-box;
  min-height: 0;
}

.reward-list-container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 8px;
}

.pvp-rules-container {
  width: 100%;
  padding: 12px 14px 14px;
  box-sizing: border-box;
  background: rgba(223, 206, 179, 0.94);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(62, 42, 20, 0.16);
}

:global(.dark-mode) .pvp-rules-container {
  background: rgba(46, 34, 23, 0.9);
}

.pvp-rule-copy {
  display: grid;
  gap: 8px;
}

.pvp-rule-copy p {
  position: relative;
  margin: 0;
  padding-left: 16px;
  color: var(--text-main);
  font-size: 14px;
  line-height: 1.75;
}

.pvp-rule-copy p::before {
  content: '';
  position: absolute;
  top: 0.68em;
  left: 2px;
  width: 6px;
  height: 6px;
  background: var(--accent-bright);
  transform: rotate(45deg);
}

.pvp-purchase-rule {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding: 10px 12px;
  border-top: 1px dashed var(--border-soft);
  border-bottom: 1px dashed var(--border-soft);
  color: var(--text-muted);
  font-size: 13px;
}

.pvp-purchase-rule strong {
  color: var(--text-main);
  text-align: right;
}

.pvp-area-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.pvp-area-rule {
  min-width: 0;
  padding: 12px;
  background: rgba(217, 198, 166, 0.62);
  border: 1px solid var(--border-faint);
  border-radius: 6px;
}

.pvp-area-rule__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid var(--border-faint);
}

.pvp-area-rule h4 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
}

.pvp-area-rule__head span {
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
}

.pvp-area-rule p {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.65;
}

:global(.dark-mode) .pvp-area-rule {
  background: rgba(35, 26, 17, 0.62);
}

.exchange-trade-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

/* PVP 兑换奖励较多，使用紧凑图标避免奖励列过度占高。 */
.exchange-trade-list :deep(.ui-exchange-trade__item--reward) {
  width: 82px;
}
.exchange-trade-list :deep(.ui-exchange-trade__item--reward img) {
  width: 42px;
  height: 42px;
  flex-basis: 42px;
}
.exchange-trade-list :deep(.ui-exchange-trade__reward-stage) {
  min-height: 74px;
}

@media (max-width: 640px) {
  .exchange-trade-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}

/* 列布局 */
.row-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.row-right.flex-start {
  justify-content: flex-start;
}

.row-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.row-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  min-width: 80px;
}

.tier-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.tier-score {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.win-title {
  color: var(--q2-text);
}

.fail-title {
  color: var(--danger);
}

.battle-score {
  font-size: 13px;
  font-weight: 700;
}

.battle-score--win {
  color: var(--q2-text);
}

.battle-score--fail {
  color: var(--danger);
}

.items-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.item-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 手机端：列表行纵向堆叠 */
@media (max-width: 640px) {
  .pvp-area-grid {
    grid-template-columns: 1fr;
  }

  .pvp-purchase-rule {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .pvp-purchase-rule strong {
    text-align: left;
  }

  .ui-list-row {
    flex-direction: column;
    align-items: stretch;
  }
  .ui-list-row :deep(.ui-list-row__right) {
    width: 100%;
    justify-content: flex-start;
  }
}

/* 锚点高亮 */
.highlight-section {
  border-color: var(--gold) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 72%, transparent) !important;
}

/* 被隐藏的物品 */
.hidden-list-row {
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.hidden-list-row.is-collected {
  border-color: rgba(122, 154, 153, 0.6);
  background-color: rgba(223, 206, 179, 0.96);
}

:global(.dark-mode) .hidden-list-row.is-collected {
  border-color: rgba(122, 154, 153, 0.45);
  background-color: rgba(56, 44, 32, 0.85);
}

.hidden-row-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.hidden-row-head :deep(.ui-collection-toggle) {
  flex-shrink: 0;
}

.hidden-row-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  min-width: 0;
}

.hidden-row-info {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.collect-tip {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}

.hidden-prev-img {
  display: block;
  width: 100%;
  max-width: 520px;
  aspect-ratio: 16 / 9;
  margin: 6px auto 0;
  border-radius: 4px;
  border: 1px solid var(--border-faint);
  cursor: zoom-in;
  object-fit: contain;
  background: rgba(217, 198, 166, 0.62);
}

/* 育室槽位消耗 */
.slot-cost-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 4px;
}

.slot-costs-grid-layout {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
}

@media (max-width: 600px) {
  .slot-costs-grid-layout {
    grid-template-columns: 1fr;
  }
}

.slot-column-card {
  background: rgba(217, 198, 166, 0.62);
  border: 1px solid var(--border-faint);
  border-radius: 4px;
  padding: 14px;
}

.slot-column-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 10px;
  color: var(--text-main);
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 6px;
}

.slot-cost-list-item {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-soft);
  font-size: 13px;
  line-height: 1.6;
}

.slot-cost-list-item:last-child {
  border-bottom: none;
}

.slot-times-label {
  color: var(--text-main);
  font-weight: 600;
}

.slot-cost-details {
  display: grid;
  grid-template-columns: minmax(0, 142px) 78px;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.slot-level-req {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  background: rgba(43, 31, 21, 0.14);
  padding: 3px 8px;
  border-radius: 3px;
  white-space: nowrap;
}

.slot-cost-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 78px;
  justify-content: flex-start;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
}

.dark-mode .hidden-prev-img,
.dark-mode .slot-column-card {
  background: rgba(35, 26, 17, 0.62);
}

@media (max-width: 600px) {
  .slot-cost-list-item {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .slot-cost-details {
    justify-content: start;
  }
}

.mini-coin-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.prev-img-full {
  display: block;
  width: 100%;
  max-height: calc(100dvh - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 128px);
  object-fit: contain;
  border-radius: 4px;
}
</style>
