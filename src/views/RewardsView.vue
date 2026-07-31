<template>
  <div class="rewards-view">
    <!-- Top Filter Bar (matching AchievementView exact styles) -->
    <div class="filter-sticky-bar achievement-filter-sticky">
      <!-- Main Categories (Row 1) -->
      <div class="control-row-1">
        <div class="segmented-pill-container category-segmented">
          <div
            v-for="cat in mainCategories"
            :key="cat.id"
            :class="['segmented-pill-item', { active: currentMainCat === cat.id }]"
            @click="currentMainCat = cat.id"
          >
            {{ cat.name }}
          </div>
        </div>
      </div>

      <!-- Sub Categories for PVP (Row 2) -->
      <div class="control-row-2" v-if="currentMainCat === 'pvp'">
        <div class="segmented-pill-container status-segmented">
          <div
            v-for="sub in pvpSubCategories"
            :key="sub.id"
            :class="['segmented-pill-item', { active: currentSubCat === sub.id }]"
            @click="currentSubCat = sub.id"
          >
            {{ sub.name }}
          </div>
        </div>
      </div>
      
      <!-- Sub Categories for Hidden Rewards (Row 2) -->
      <div class="control-row-2" v-if="currentMainCat === 'hidden'">
        <div class="segmented-pill-container status-segmented">
          <div
            v-for="mapName in hiddenMapCategories"
            :key="mapName"
            :class="['segmented-pill-item', { active: currentHiddenCat === mapName }]"
            @click="currentHiddenCat = mapName"
          >
            {{ mapName }}
          </div>
        </div>
      </div>

      <!-- 3rd Level Categories for Exchange (Row 3) -->
      <div class="control-row-3" v-if="currentMainCat === 'pvp' && currentSubCat === 'exchange'">
        <div class="segmented-pill-container sub-status-segmented">
          <div
            v-for="(list, subCat) in pvpRewards?.exchange || {}"
            :key="subCat"
            :class="['segmented-pill-item', { active: currentExchangeCat === subCat }]"
            @click="currentExchangeCat = subCat"
          >
            {{ subCat === 's1' ? 'S1 兑换' : subCat + ' 兑换' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在加载数据...</p>
    </div>

    <!-- Main Content Area -->
    <div v-else-if="pvpRewards" class="rewards-content" id="rewardsScroll">

      <template v-if="currentMainCat === 'pvp'">
        
        <!-- 兑换奖励 -->
        <div v-if="currentSubCat === 'exchange'" class="reward-list-container">
          <div v-if="pvpRewards.exchange[currentExchangeCat]">
            <div class="list-row" v-for="ex in pvpRewards.exchange[currentExchangeCat]" :key="ex.id" :id="`pvpExchange-${ex.id}`">
              <div class="row-left">
                <span class="row-label">奖励</span>
                <div class="items-flex">
                  <div v-for="group in ex.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                    <div v-for="rule in group.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                      <img :src="getIcon(rule.typeId)" alt="icon" />
                      <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="row-right">
                <span class="row-label">消耗</span>
                <div class="items-flex">
                  <div v-for="cItem in ex.consumeItems" :key="cItem.typeId" class="item-group">
                    <div v-for="rule in cItem.rules || [cItem]" :key="rule.typeId || cItem.typeId" class="item-chip clickable" @click="openItem(rule.typeId || cItem.typeId)">
                      <img :src="getIcon(rule.typeId || cItem.typeId)" alt="icon" />
                      <span>×{{ rule.num || cItem.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                    </div>
                  </div>
                </div>
                <span v-if="ex.limitCondition" class="limit-badge">限购 {{ ex.limitCondition.num }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 段位奖励 -->
        <div v-if="currentSubCat === 'tier'" class="reward-list-container">
          <div class="list-row" v-for="tier in pvpRewards.tier" :key="tier.id" :id="`tier-${tier.id}`">
            <div class="row-left">
              <span class="row-title">{{ tier.name }}</span>
            </div>
            <div class="row-right flex-start">
              <div class="items-flex">
                <div v-for="group in tier.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                  <div v-for="rule in group.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                    <img :src="getIcon(rule.typeId)" alt="icon" />
                    <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 排名奖励 -->
        <div v-if="currentSubCat === 'rank'" class="reward-list-container">
          <div class="list-row" v-for="rank in pvpRewards.rank" :key="rank.start" :id="`rank-${rank.start}`">
            <div class="row-left">
              <span class="row-title">{{ rank.end === -1 ? `${rank.start}名以后` : `${rank.start}-${rank.end}名` }}</span>
            </div>
            <div class="row-right flex-start">
              <div class="items-flex">
                <div v-for="group in rank.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                  <div v-for="rule in group.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                    <img :src="getIcon(rule.typeId)" alt="icon" />
                    <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 战斗结算 -->
        <div v-if="currentSubCat === 'battle'" class="reward-list-container">
          <div class="list-row" v-if="pvpRewards.battle.win" id="battle-win">
            <div class="row-left">
              <span class="row-title win-title">战斗胜利</span>
            </div>
            <div class="row-right flex-start">
              <div class="items-flex">
                <div v-for="group in pvpRewards.battle.win.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                  <div v-for="rule in group.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                    <img :src="getIcon(rule.typeId)" alt="icon" />
                    <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="list-row" v-if="pvpRewards.battle.fail" id="battle-fail">
            <div class="row-left">
              <span class="row-title fail-title">战斗失败</span>
            </div>
            <div class="row-right flex-start">
              <div class="items-flex">
                <div v-for="group in pvpRewards.battle.fail.rewardItems" :key="group.typeId || Math.random()" class="item-group">
                  <div v-for="rule in group.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                    <img :src="getIcon(rule.typeId)" alt="icon" />
                    <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>

      <!-- Hidden Rewards -->
      <template v-else-if="currentMainCat === 'hidden'">
        <div class="reward-list-container">
          <div class="list-row" style="flex-direction: column; align-items: stretch;" v-for="(group, idx) in groupedHiddenRewards" :key="idx" :id="`hidden-${group.roomId}`">
            <div class="row-left" style="margin-bottom: 8px;">
              <span class="row-title" style="color: var(--primary, #3b82f6);">{{ group.areaName }} - {{ group.roomName }}</span>
            </div>
            
            <div class="list-row inner-reward-row" style="border: none; background: rgba(0,0,0,0.02); padding: 8px 12px; flex-wrap: wrap; gap: 8px;">
               <div class="row-left" style="flex: 1 1 auto; min-width: 200px; flex-wrap: wrap;">
                  <span class="row-title">{{ group.collectName }}</span>
                  <span class="row-label" style="white-space: normal; line-height: 1.4;" v-if="group.collectTip">{{ group.collectTip }}</span>
               </div>
               <div class="row-right flex-start" style="flex: 0 1 auto; flex-wrap: wrap;">
                  <div class="items-flex" style="flex-wrap: wrap; gap: 8px;">
                    <div v-for="grp in group.rewardItems" :key="grp.typeId || Math.random()" class="item-group">
                      <div v-for="rule in grp.rules" :key="rule.typeId" class="item-chip clickable" @click="openItem(rule.typeId)">
                        <img :src="getIcon(rule.typeId)" alt="icon" />
                        <span>×{{ rule.num || (rule.min === rule.max ? rule.min : `${rule.min}~${rule.max}`) }}</span>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
          
          <div v-if="!groupedHiddenRewards.length" class="placeholder-content">
            <p>当前地图下暂无隐藏场景宝箱数据</p>
          </div>
        </div>
      </template>

      <!-- Placeholder -->
      <template v-else>
        <div class="placeholder-content">
          <p>该板块奖励数据暂未开放，敬请期待...</p>
        </div>
      </template>
    </div>
    
    <BackToTop scroll-container="#rewardsScroll" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchWithFallback } from '../utils/request.js'
import { getCachedItem, fetchItemData } from '../utils/itemParser'
import { pushItemDetail } from '../utils/itemModalState'
import { getImageUrl } from '../utils/env'
import BackToTop from '../components/BackToTop.vue'
import { isBlacklisted } from '../config/blacklist.js'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const pvpRewards = ref(null)

const mainCategories = [
  { id: 'pvp', name: '挑战赛奖励' },
  { id: 'hidden', name: '被隐藏的物品' },
  { id: 'ph2', name: '占位奖励2' },
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

import { computed } from 'vue'

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

const openItem = (typeId) => {
  const item = getCachedItem(typeId)
  if (item) {
    router.push({ query: { ...route.query, itemId: typeId } })
  }
}

</script>

<style scoped>
.rewards-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main, #f5f7fa);
  overflow: hidden;
}

/* Tabs UI exactly matching AchievementView */
.filter-sticky-bar {
  background: var(--bg-card, #fff);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  z-index: 10;
  flex-shrink: 0;
}

/* Control Row 1: Full-Width Category Segmented Bar */
.control-row-1 {
  width: 100%;
}

/* Segmented Pill Track (分段控制器框架 - 灰底全圆角) */
.segmented-pill-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  background: var(--input-bg, #f0f2f5);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 14px;
  box-sizing: border-box;
}

/* Row 1: Category Pill Bar is 100% Full Width */
.category-segmented {
  width: 100%;
}
.category-segmented::after {
  content: "";
  flex: 10 1 auto;
}

/* Row 2/3: Status Pill Bar is Content Width */
.status-segmented, .sub-status-segmented {
  display: inline-flex;
  width: auto;
}

/* Segmented Pill Item (分段内部按钮) */
.segmented-pill-item {
  flex: 1 1 auto;
  text-align: center;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub, #666);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  white-space: nowrap;
}

.segmented-pill-item:hover {
  color: var(--text-main, #333);
}

/* Active Selected Item */
.segmented-pill-item.active {
  background: var(--card-bg, #ffffff);
  color: var(--primary, #3b82f6);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.control-row-2, .control-row-3 {
  width: 100%;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--text-sub, #666);
}

.rewards-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  position: relative;
}

.reward-list-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card, #fff);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 8px;
  padding: 12px 16px;
  transition: background-color 0.5s ease;
}

/* For mobile responsive */
@media (max-width: 600px) {
  .list-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.highlight-section {
  background-color: #f0f7ff !important;
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3) !important;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: flex-end;
  flex: 1;
}
.row-right.flex-start {
  justify-content: flex-start;
}

.row-label {
  font-size: 14px;
  color: var(--text-sub, #888);
  white-space: nowrap;
}

.row-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main, #333);
  min-width: 80px;
}
.win-title {
  color: #10b981;
}
.fail-title {
  color: #ef4444;
}

.items-flex {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.item-group {
  display: flex;
  gap: 4px;
}

.item-chip {
  display: flex;
  align-items: center;
  background: var(--bg-main, #f5f7fa);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(0,0,0,0.05);
  font-size: 13px;
  gap: 6px;
  color: var(--text-main, #333);
}

.item-chip img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.clickable {
  cursor: pointer;
  transition: transform 0.1s;
}
.clickable:hover {
  transform: translateY(-2px);
  background: rgba(0,0,0,0.04);
}

.limit-badge {
  background: #f59e0b;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.placeholder-content {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-sub, #888);
  font-size: 15px;
}
</style>
