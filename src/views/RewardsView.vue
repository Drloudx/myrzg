<template>
  <div class="page-view-container">

    <!-- 筛选区：半透明羊皮纸面板（分类 / 状态 / 子状态 分段页签） -->
    <div class="filter-sticky-bar rewards-filter-sticky paper-panel">
      <!-- 主分类（Row 1） -->
      <div class="control-row-1">
        <UiSegmentedTabs
          v-model="currentMainCat"
          :options="mainCategories.map(cat => ({ value: cat.id, label: cat.name }))"
        />
      </div>

      <!-- PVP 子分类（Row 2） -->
      <div class="control-row-2" v-if="currentMainCat === 'pvp'">
        <UiSegmentedTabs
          v-model="currentSubCat"
          :options="pvpSubCategories.map(sub => ({ value: sub.id, label: sub.name }))"
        />
      </div>

      <!-- 隐藏物品地图子分类（Row 2） -->
      <div class="control-row-2" v-if="currentMainCat === 'hidden'">
        <UiSegmentedTabs
          v-model="currentHiddenCat"
          :options="hiddenMapCategories.map(mapName => ({ value: mapName, label: mapName }))"
        />
      </div>

      <!-- 兑换三级分类（Row 3） -->
      <div class="control-row-3" v-if="currentMainCat === 'pvp' && currentSubCat === 'exchange'">
        <UiSegmentedTabs
          v-model="currentExchangeCat"
          :options="Object.keys(pvpRewards?.exchange || {}).map(subCat => ({ value: subCat, label: subCat === 's1' ? 'S1 兑换' : subCat + ' 兑换' }))"
        />
      </div>
    </div>

    <!-- 加载态 -->
    <UiEmptyState v-if="loading" type="loading" text="正在装配奖励数据..." />

    <!-- 主内容区 -->
    <div v-else-if="pvpRewards" class="rewards-content" id="rewardsScroll">

      <template v-if="currentMainCat === 'pvp'">

        <!-- 兑换奖励 -->
        <div v-if="currentSubCat === 'exchange'" class="reward-list-container">
          <div v-if="pvpRewards.exchange[currentExchangeCat]" class="exchange-trade-list">
            <UiExchangeTrade
              v-for="ex in pvpRewards.exchange[currentExchangeCat]"
              :key="ex.id"
              :id="`pvpExchange-${ex.id}`"
              :title="pvpExchangeTitle(ex)"
              :reward-items="flattenPvpItems(ex.rewardItems)"
              :consume-items="flattenPvpItems(ex.consumeItems)"
              :limit-text="pvpLimitText(ex.limitCondition)"
              @item-click="openItem"
            />
          </div>
        </div>

        <!-- 段位奖励 -->
        <div v-if="currentSubCat === 'tier'" class="reward-list-container">
          <UiListRow v-for="tier in pvpRewards.tier" :key="tier.id" :id="`tier-${tier.id}`">
            <div class="row-left">
              <span class="row-title">{{ tier.name }}</span>
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
        </div>

        <!-- 排名奖励 -->
        <div v-if="currentSubCat === 'rank'" class="reward-list-container">
          <UiListRow v-for="rank in pvpRewards.rank" :key="rank.start" :id="`rank-${rank.start}`">
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
        </div>

        <!-- 战斗结算 -->
        <div v-if="currentSubCat === 'battle'" class="reward-list-container">
          <UiListRow v-if="pvpRewards.battle.win" id="battle-win">
            <div class="row-left">
              <span class="row-title win-title">战斗胜利</span>
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

          <UiListRow v-if="pvpRewards.battle.fail" id="battle-fail">
            <div class="row-left">
              <span class="row-title fail-title">战斗失败</span>
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
        </div>

      </template>

      <!-- 被隐藏的物品 -->
      <template v-else-if="currentMainCat === 'hidden'">
        <div class="reward-list-container">
          <UiListRow
            v-for="(group, idx) in groupedHiddenRewards"
            :key="idx"
            :id="`hidden-${group.roomId}`"
          >
            <div class="hidden-row-title">{{ group.areaName }} - {{ group.roomName }}</div>
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
          <UiListRow>
            <div class="slot-cost-title">培育室槽位扩张费用</div>

            <div class="slot-costs-grid-layout" v-if="slotCosts">
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
            <UiEmptyState v-else text="暂无育室槽位数据" />
          </UiListRow>
        </div>
      </template>

      <!-- 占位 -->
      <template v-else>
        <UiEmptyState text="该板块奖励数据暂未开放，敬请期待..." />
      </template>
    </div>

    <UiBackToTop scroll-container="#rewardsScroll" />

    <!-- 点位预览图全屏查看 -->
    <div v-if="prevImgModal.visible" class="prev-img-overlay" @click="closePrevImg">
      <img :src="prevImgModal.url" class="prev-img-full" alt="点位预览大图" @click.stop />
      <div class="prev-img-close" @click="closePrevImg">✕</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiSegmentedTabs,
  UiEmptyState,
  UiListRow,
  UiExchangeTrade,
  UiRewardCard,
  UiTag,
  UiBackToTop
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import { getCachedItem, fetchItemData } from '../utils/itemParser'
import { getImageUrl } from '../utils/env'
import { isBlacklisted } from '../config/blacklist.js'
import { fetchPetData } from '../utils/petParser'
import { REWARD_MODE_INFO } from '../utils/gameMappings'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const pvpRewards = ref(null)

const mainCategories = [
  { id: 'pvp', name: '挑战赛奖励' },
  { id: 'hidden', name: '被隐藏的物品' },
  { id: 'slot_cost', name: '育室槽位消耗' },
  { id: 'ph3', name: '占位奖励3' }
]
const currentMainCat = ref('pvp')

const pvpSubCategories = [
  { id: 'exchange', name: '兑换奖励' },
  { id: 'tier', name: '段位奖励' },
  { id: 'rank', name: '排名奖励' },
  { id: 'battle', name: '战斗结算' }
]
const currentSubCat = ref('exchange')
const currentExchangeCat = ref('s1')

const hiddenRewardsData = ref([])
const currentHiddenCat = ref('')
const slotCosts = ref(null)

const hiddenMapCategories = computed(() => {
  const maps = new Set(hiddenRewardsData.value.map(h => h.bigMapName))
  return Array.from(maps)
})

const groupedHiddenRewards = computed(() => {
  return hiddenRewardsData.value.filter(h => h.bigMapName === currentHiddenCat.value)
})

onMounted(async () => {
  // Ensure item data is loaded so getIcon and getCachedItem work
  try {
    await fetchItemData()
  } catch (e) {
    console.error('Failed to init item data for RewardsView', e)
  }

  let pvpRes = null
  let hiddenRes = null

  try {
    pvpRes = await fetchWithFallback('data/parsed/parsed-pvp.json')
  } catch (e) {
    console.error('Failed to load parsed/parsed-pvp.json', e)
  }

  try {
    hiddenRes = await fetchWithFallback('data/parsed/parsed-hidden.json')
  } catch(e) {
    console.error('Failed to load parsed-hidden.json', e)
  }

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
      currentHiddenCat.value = hiddenRewardsData.value[0].bigMapName
    }
  }

  try {
    const petData = await fetchPetData()
    if (petData && petData.petSetting) {
      slotCosts.value = petData.petSetting
    }
  } catch (e) {
    console.error('Failed to load petSetting for slotCosts', e)
  }

  loading.value = false
  setTimeout(() => scrollToTarget(), 300)
})

const scrollToTarget = () => {
  const { id } = route.query
  if (!id) return

  if (String(id).startsWith('hidden-')) {
    currentMainCat.value = 'hidden'
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
    const roomId = id.replace('hidden-', '')
    const rewardGroup = hiddenRewardsData.value.find(h => h.roomId === roomId)
    if (rewardGroup) {
      currentHiddenCat.value = rewardGroup.bigMapName
    }
  }

  nextTick(() => {
    if (targetId) {
      const el = document.getElementById(targetId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('highlight-section')
        setTimeout(() => el.classList.remove('highlight-section'), 2000)
      }
    }
  })
}

watch(() => route.query.id, () => {
  if (pvpRewards.value) {
    setTimeout(scrollToTarget, 100)
  }
})

const getIcon = (typeId) => {
  const item = getCachedItem(typeId)
  if (item && item.img) {
    return getImageUrl(`/Common_ItemIcon/${item.img}.png`)
  }
  return getImageUrl('/ui/default_item.svg')
}

const flattenPvpItems = (groups = []) => {
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

.control-row-1 .ui-segmented {
  width: 100%;
}
.control-row-1 :deep(.ui-segmented__item) {
  flex: 1;
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

.win-title {
  color: var(--q2);
}

.fail-title {
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
  background-color: rgba(122, 154, 153, 0.2) !important;
  border-color: var(--accent-bright) !important;
  box-shadow: 0 0 0 2px rgba(122, 154, 153, 0.35) !important;
}

/* 被隐藏的物品 */
.hidden-row-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
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

/* 点位预览大图遮罩（羊皮纸化） */
.prev-img-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--modal-overlay);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.prev-img-full {
  max-width: 95vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.prev-img-close {
  position: fixed;
  top: 16px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(223, 206, 179, 0.15);
  border: 1px solid rgba(223, 206, 179, 0.35);
  color: var(--paper);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.prev-img-close:hover {
  background: rgba(223, 206, 179, 0.28);
}
</style>
