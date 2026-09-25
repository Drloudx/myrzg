<template>
  <div class="page-view-container dungeon-page">
    <UiFilterPanel class="dungeon-filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索副本、关卡或掉落物品..." />
      </template>
      <UiFilterRow label="地图：">
        <UiFilterPill
          v-for="option in mapOptions"
          :key="option.key"
          :active="mapFilter === option.key"
          @click="mapFilter = option.key"
        >{{ option.label }}</UiFilterPill>
      </UiFilterRow>
      <div class="dungeon-count">共 <span class="count-num">{{ filteredDungeons.length }}</span> 个副本，<span class="count-num">{{ battleCount }}</span> 个关卡<span v-if="storyBattleCount">，另有 <span class="count-num">{{ storyBattleCount }}</span> 个剧情入口</span></div>
    </UiFilterPanel>

    <UiEmptyState v-if="!isReady" type="loading" text="正在装配副本数据..." />
    <UiEmptyState v-else-if="filteredDungeons.length === 0" text="未找到符合条件的副本" />

    <div v-else id="dungeonGrid" class="dungeon-scroll" data-main-scroll>
      <section v-for="dungeon in filteredDungeons" :key="dungeon.id" class="dungeon-card paper-panel">
        <div class="dungeon-card__cover">
          <img
            v-if="dungeon.background"
            class="dungeon-card__cover-image"
            v-lazy-cover="getImageUrl(dungeon.background)"
            alt=""
            width="1680"
            height="1000"
            loading="lazy"
            decoding="async"
            @error="handleImageFallback"
          />
          <div class="dungeon-card__cover-shade"></div>
          <div class="dungeon-card__heading">
            <div>
              <h2>{{ dungeon.name }}</h2>
              <p>{{ dungeon.mapName }} · {{ dungeon.battles.length }} 个关卡<span v-if="dungeon.storyBattles?.length"> · {{ dungeon.storyBattles.length }} 个剧情入口</span></p>
            </div>
          </div>
          <p v-if="dungeon.des" class="dungeon-card__description">{{ dungeon.des }}</p>
        </div>

        <div class="dungeon-battle-list">
          <button
            v-for="battle in dungeon.battles"
            :key="battle.id"
            type="button"
            class="dungeon-battle-row"
            @click="openBattle(dungeon, battle)"
          >
            <span class="dungeon-battle-row__main">
              <strong>{{ battle.name }}</strong>
            </span>
            <span class="dungeon-battle-row__meta">
              <UiTag v-if="battle.level" tone="accent">Lv.{{ battle.level }}</UiTag>
              <span class="dungeon-battle-row__arrow">›</span>
            </span>
          </button>
        </div>

        <details
          class="story-battles"
          :class="{ 'story-battles--empty': !dungeon.storyBattles?.length }"
          :open="isStoryOpen(dungeon.id)"
          @toggle="setStoryOpen(dungeon.id, $event.target.open)"
        >
          <summary
            :aria-disabled="!dungeon.storyBattles?.length"
            @click="handleStorySummaryClick(dungeon.id, dungeon.storyBattles?.length || 0, $event)"
          >
            <span>剧情</span>
            <UiTag tone="muted">{{ dungeon.storyBattles?.length || 0 }} 个 · {{ isStoryOpen(dungeon.id) ? '收起' : '展开' }}</UiTag>
          </summary>
          <div v-if="dungeon.storyBattles?.length" class="dungeon-battle-list dungeon-battle-list--story">
            <button
              v-for="battle in dungeon.storyBattles"
              :key="battle.id"
              type="button"
              class="dungeon-battle-row"
              @click="openBattle(dungeon, battle)"
            >
              <span class="dungeon-battle-row__main">
                <strong>{{ battle.name }}</strong>
              </span>
              <span class="dungeon-battle-row__meta">
                <UiTag v-if="battle.level" tone="muted">Lv.{{ battle.level }}</UiTag>
                <span class="dungeon-battle-row__arrow">›</span>
              </span>
            </button>
          </div>
        </details>
      </section>
    </div>

    <UiBackToTop scroll-container="#dungeonGrid" />

    <UiModal
      v-model:visible="detailVisible"
      :title="selectedBattle ? selectedBattle.name : '副本关卡详情'"
      max-width="1100px"
      scroll-id="dungeonDetailScroll"
      :restore-scroll-top="detailSavedScrollTop"
      @close="closeBattle"
    >
      <UiEmptyState v-if="detailLoading" type="loading" text="正在加载关卡详情..." />
      <UiEmptyState v-else-if="detailError" type="error" :text="detailError" />
      <template v-else-if="selectedBattle">
        <div class="detail-badges">
          <UiTag tone="accent">{{ selectedDungeon?.mapName }}</UiTag>
          <UiTag v-if="selectedBattle.level" tone="gold">推荐等级 Lv.{{ selectedBattle.level }}</UiTag>
        </div>

        <UiSection title="关卡信息">
          <UiInfoRow label="所属副本" :value="selectedDungeon?.name || '未知'" />
          <UiInfoRow label="战斗名称" :value="selectedBattle.name" />
          <UiInfoRow label="进入消耗">
            <span v-if="selectedBattle.consumeCost?.ti > 0" class="dungeon-entry-cost">
              <img :src="getImageUrl(BASE_REWARD_PATHS.ti)" alt="体力" />
              <span>×{{ selectedBattle.consumeCost.ti }}</span>
            </span>
            <span v-else>无</span>
          </UiInfoRow>
          <UiInfoRow v-if="selectedBattle.des" label="关卡描述" :value="selectedBattle.des" />
        </UiSection>

        <UiSection v-if="selectedBattle.routes?.length" title="随机房间路线">
          <p class="drop-note drop-note--room-intro">路线来自游戏副本配置：每次进入会先随机选择布局，再从节点的候选房间中随机确定实际房间。点击节点查看该位置可能遇到的内容。</p>
          <DungeonRouteMap
            v-model:route-index="selectedRouteIndex"
            v-model:room-id="selectedRouteRoomId"
            v-model:variant-id="selectedRouteVariantId"
            :routes="selectedBattle.routes"
          />
          <div v-if="selectedRouteRoom" class="route-room-detail">
            <div class="route-room-detail__heading">
              <div>
                <span class="route-room-detail__eyebrow">已选房间</span>
                <h3>{{ selectedRouteRoom.name }}</h3>
              </div>
              <div class="detail-badges">
                <UiTag :tone="roomKindTone(selectedRouteRoom)">{{ selectedRouteRoom.kind }}</UiTag>
                <UiTag v-if="selectedRouteRoom.level" tone="muted">Lv.{{ selectedRouteRoom.level }}</UiTag>
              </div>
            </div>
            <div class="route-room-detail__grid">
              <div>
                <strong>可能遇到的怪物</strong>
                <template v-if="selectedRouteRoom.monsters?.length">
                  <p v-for="line in monsterWaveLines(selectedRouteRoom)" :key="line.key"><strong v-if="line.wave">第{{ line.wave }}波：</strong>{{ line.text }}</p>
                </template>
                <p v-else class="route-room-detail__muted">无战斗配置</p>
              </div>
              <div>
                <strong>房间交互</strong>
                <p v-if="selectedRouteRoom.collections?.length">{{ collectionSummary(selectedRouteRoom.collections) }}</p>
                <p v-else-if="selectedRouteRoom.npcCount">NPC ×{{ selectedRouteRoom.npcCount }}</p>
                <p v-else class="route-room-detail__muted">普通战斗房间</p>
              </div>
            </div>
            <div v-if="selectedRouteRoom.effects?.length" class="room-effects room-effects--route">
              <div v-for="effect in selectedRouteRoom.effects" :key="`${selectedRouteRoom.typeId}-${effect.type}`" class="room-effect">
                <strong>{{ effect.title }}</strong>
                <p>{{ effect.summary }}</p>
                <div v-if="effect.options?.length" class="room-effect__options">
                  <span v-for="option in effect.options" :key="`${effect.type}-${option.name}`">
                    <b>{{ option.name }}</b>{{ option.detail }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="selectedRouteDrops.length" class="route-room-detail__drops">
              <strong>可能掉落</strong>
              <div class="route-room-detail__drop-list">
                <UiTag v-for="entry in selectedRouteDrops" :key="entry.typeId" tone="default" :quality="entry.quality || 0">{{ entry.name }}</UiTag>
              </div>
            </div>
            <p v-if="selectedRouteRoom.variants?.length > 1" class="route-room-detail__candidates">该位置有 {{ selectedRouteRoom.variants.length }} 种候选房间，进入副本时按游戏配置随机确定。</p>
            <div v-if="selectedRouteNode?.candidateOptions?.length > 1" class="route-room-detail__options">
              <strong>随机候选</strong>
              <span v-for="option in selectedRouteNode.candidateOptions" :key="`${selectedRouteNode.id}-${option.typeId}`">{{ candidateLabel(option) }}</span>
            </div>
          </div>
        </UiSection>

        <UiSection v-if="selectedBattle.rooms?.length" title="房间内容与掉落来源">
          <RoomContentList :rooms="displayRoomCards" @item-click="goToItem" />
        </UiSection>

        <div v-if="specialDropTotal" ref="specialDropsAnchorRef" class="special-drops-anchor">
        <UiSection v-model:open="specialDropsOpen" title="特殊掉落" collapsible class="special-drops">
          <UiSegmentedTabs v-model="specialDropTab" :options="SPECIAL_DROP_TABS" class="special-drops__tabs" />
          <div v-if="activeSpecialDrops.length" class="special-drop-list">
            <article
              v-for="entry in activeSpecialDrops"
              :key="`${entry.specialCategory}-${entry.typeId}`"
              class="special-drop-card"
              :class="{ 'special-drop-card--focused': isFocusedSpecialDrop(entry) }"
              :data-drop-entry="entry.typeId"
            >
              <div class="special-drop-card__heading">
                <strong>{{ entry.name }}</strong>
                <button
                  v-if="specialDropSources(entry).length <= 1 && specialDropAllRewards(entry).length"
                  type="button"
                  class="prob-detail-btn"
                  @click.stop="openRewardDetail(entry.name, specialDropAllRewards(entry))"
                >
                  概率明细
                </button>
                <div class="special-drop-card__tags">
                  <UiTag :tone="specialDropTone(entry)">{{ SPECIAL_DROP_TABS.find(tab => tab.key === entry.specialCategory)?.label }}</UiTag>
                  <UiTag v-if="entry.level" tone="default">Lv.{{ entry.level }}</UiTag>
                </div>
              </div>
              <div v-if="specialDropSources(entry).length" class="special-drop-sources">
                <section v-for="source in specialDropSources(entry)" :key="`${entry.typeId}-${source.key}`" class="special-drop-source">
                  <div v-if="shouldShowSourceHeading(source, entry)" class="special-drop-source__heading">
                    <span class="special-drop-source__title">
                      <strong v-if="source.label">{{ source.label }}</strong>
                      <button
                        v-if="specialDropSources(entry).length > 1 && source.reward?.length"
                        type="button"
                        class="prob-detail-btn"
                        @click.stop="openRewardDetail(source.label || entry.name, source.reward)"
                      >
                        概率明细
                      </button>
                    </span>
                    <small v-if="source.note && source.note !== entry.name">{{ source.note }}</small>
                  </div>
                  <RewardPools dense :entries="source.reward" @item-click="goToItem" />
                </section>
              </div>
              <p v-else class="special-drop-card__empty">暂无可展示的掉落配置</p>
            </article>
          </div>
          <UiEmptyState v-else text="当前关卡没有此类特殊掉落" />
        </UiSection>
        </div>

        <UiSection v-model:open="settlementDropsOpen" title="通关结算掉落" data-source-entry="settlement" collapsible>
          <template #title-end>
            <button
              v-if="selectedBattle.reward?.length"
              type="button"
              class="prob-detail-btn prob-detail-btn--section"
              @click.stop="openRewardDetail('通关结算掉落', selectedBattle.reward)"
            >
              概率明细
            </button>
          </template>
          <RewardPools v-if="selectedBattle.reward.length" :entries="selectedBattle.reward" @item-click="goToItem" />
          <p v-else class="empty-reward">暂无可展示的掉落配置</p>
        </UiSection>

        <UiSection v-if="selectedBattle.previewReward.length" v-model:open="previewDropsOpen" title="副本预览掉落" collapsible>
          <template #title-end>
            <button
              type="button"
              class="prob-detail-btn prob-detail-btn--section"
              @click.stop="openRewardDetail('副本预览掉落', selectedBattle.previewReward)"
            >
              概率明细
            </button>
          </template>
          <RewardPools :entries="selectedBattle.previewReward" :source-of="previewGroupSourceLabel" @item-click="goToItem" />
        </UiSection>

        <UiSection v-if="selectedBattle.firstReward.length" v-model:open="firstDropsOpen" title="首次通关奖励" data-source-entry="first" collapsible>
          <template #title-end>
            <button
              type="button"
              class="prob-detail-btn prob-detail-btn--section"
              @click.stop="openRewardDetail('首次通关奖励', selectedBattle.firstReward)"
            >
              概率明细
            </button>
          </template>
          <RewardPools :entries="selectedBattle.firstReward" @item-click="goToItem" />
        </UiSection>

        <UiBackToTop scroll-container="#dungeonDetailScroll" />
      </template>
    </UiModal>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiBackToTop,
  UiEmptyState,
  UiFilterPill,
  UiFilterRow,
  UiInfoRow,
  UiModal,
  UiFilterPanel, UiSearchInput,
  UiSection,
  UiSegmentedTabs,
  UiTag
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import DungeonRouteMap from '../components/dungeons/DungeonRouteMap.vue'
import RoomContentList from '../components/RoomContentList.vue'
import RewardPools from '../components/RewardPools.vue'
import { openRewardDetail } from '../utils/rewardModalState.js'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { BASE_REWARD_PATHS, MAP_NAMES } from '../utils/gameMappings.js'
import { resolveScrollTarget } from '../utils/scrollTarget.js'
import { isBlacklisted } from '../config/blacklist.js'
import {
  chestTier,
  monsterWaveLines,
  roomKindTone,
  sortedCollections,
  uniqueRewards
} from '../utils/roomDisplay.js'

const coverObservers = new WeakMap()
const observeCover = (image, source) => {
  coverObservers.get(image)?.disconnect()
  if (!('IntersectionObserver' in window)) {
    image.src = source
    return
  }
  // Browser-native lazy loading can prefetch this entire two-column page.
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    image.src = source
    observer.disconnect()
    coverObservers.delete(image)
  }, { rootMargin: '360px 0px' })
  coverObservers.set(image, observer)
  observer.observe(image)
}
const vLazyCover = {
  mounted: (image, binding) => observeCover(image, binding.value),
  updated: (image, binding) => {
    if (binding.value !== binding.oldValue) observeCover(image, binding.value)
  },
  unmounted: image => coverObservers.get(image)?.disconnect()
}

const route = useRoute()
const router = useRouter()
const dungeons = shallowRef([])
const isReady = ref(false)
const mapFilter = ref(route.query.map || 'all')
const searchQuery = ref(route.query.q || '')
const detailVisible = ref(false)
// 打开详情前捕获 .app-container 的真实滚动位置，作为 UiModal 的 restoreScrollTop，关闭时恢复。
// 覆盖式详情打开会锁 app-main 为视口高、浏览器把 scrollTop 钳到 0/18；此时如果依赖内部 lastScrollTop
// 会被钳制值污染。因此在"用户点击打开那一瞬"（detailVisible=true 之前）捕获真实值。
const detailSavedScrollTop = ref(0)
const selectedDungeon = ref(null)
const selectedBattle = shallowRef(null)
const detailLoading = ref(false)
const detailError = ref('')
const selectedRouteIndex = ref(0)
const selectedRouteRoomId = ref('')
const selectedRouteVariantId = ref('')
const specialDropsAnchorRef = ref(null)
const focusedSpecialDropEntry = ref('')
const storyOpenState = ref({})
const specialDropsOpen = ref(true)
const settlementDropsOpen = ref(true)
const previewDropsOpen = ref(true)
const firstDropsOpen = ref(false)
const specialDropTab = ref('chest')
let detailRequestId = 0
let specialDropHighlightTimer = 0
const battleDetailCache = new Map()
const SPECIAL_DROP_TABS = [
  { key: 'chest', label: '箱子' },
  { key: 'merchant', label: '黑商人' },
  { key: 'boss', label: 'BOSS' }
]

const specialDropCategory = (room, variant) => {
  const name = String(variant?.name || '')
  const kind = String(variant?.kind || '')
  const text = `${name} ${kind}`
  if (name.includes('箱') && chestTier(text) > 0) return 'chest'
  if (/黑商/.test(text)) return 'merchant'
  if (/boss|首领/i.test(text) || /boss|首领/i.test(String(room?.label || ''))) return 'boss'
  return ''
}

const mapOptions = computed(() => [
  { key: 'all', label: '全部' },
  ...Object.entries(MAP_NAMES)
    // 黑名单：被隐藏的地区（如黑森林/霜烬平原）不作为筛选按钮出现，
    // 否则点进去是空列表（条目本身已被 filteredDungeons 过滤）
    .filter(([, label]) => !isBlacklisted(label))
    .filter(([key]) => dungeons.value.some(dungeon => dungeon.chapter === key && (dungeon.battles?.length || 0) > 0))
    .map(([key, label]) => ({ key, label }))
])

const battleCount = computed(() => filteredDungeons.value.reduce((sum, dungeon) => sum + dungeon.battles.length, 0))
const storyBattleCount = computed(() => filteredDungeons.value.reduce((sum, dungeon) => sum + (dungeon.storyBattles?.length || 0), 0))
const selectedRouteLayer = computed(() => selectedBattle.value?.routes?.[selectedRouteIndex.value] || null)
const selectedRouteNode = computed(() => selectedRouteLayer.value?.nodes?.find(item => item.id === selectedRouteRoomId.value) || null)
const selectedRouteRoom = computed(() => {
  const node = selectedRouteNode.value
  const room = selectedBattle.value?.rooms?.find(item => item.roomId === (node?.roomId || node?.id))
  const variants = room?.variants || []
  const first = variants.find(variant => variant.typeId === selectedRouteVariantId.value) || variants[0]
  if (!room || !first) return null
  return { ...first, label: room.label, level: room.level, variants }
})
const selectedRouteDrops = computed(() => {
  if (!selectedRouteRoom.value) return []
  const monsterDrops = (selectedRouteRoom.value.monsters || []).flatMap(monster => (monster.drops || []).flatMap(drop => drop.reward || []))
  const collectionDrops = (selectedRouteRoom.value.collections || []).flatMap(collection => collection.reward || [])
  return uniqueRewards([...monsterDrops, ...collectionDrops])
})
const specialDropGroups = computed(() => {
  const groups = { chest: new Map(), merchant: new Map(), boss: new Map() }
  ;(selectedBattle.value?.specialDrops?.chestSources || []).forEach(source => {
    const key = `chest-${source.tier || chestTier(source.name)}`
    if (!groups.chest.has(key)) {
      groups.chest.set(key, {
        typeId: key,
        name: source.name,
        kind: source.name,
        specialCategory: 'chest',
        sources: []
      })
    }
    groups.chest.get(key).sources.push(source)
  })
  ;(selectedBattle.value?.rooms || []).forEach(room => {
    ;(room.variants || []).forEach(variant => {
      const category = specialDropCategory(room, variant)
      if (!category) return
      if (category === 'chest' && selectedBattle.value?.specialDrops?.chestSources?.length) return
      const key = category === 'chest'
        ? `${category}-${chestTier(`${variant.name} ${variant.kind}`)}`
        : category === 'merchant'
          ? `${category}-${variant.name}`
          : variant.typeId || `${category}-${variant.name}`
      if (!groups[category].has(key)) {
        groups[category].set(key, {
          ...variant,
          level: room.level,
          specialCategory: category,
          variants: [variant]
        })
      } else {
        groups[category].get(key).variants.push(variant)
      }
    })
  })
  return {
    chest: [...groups.chest.values()].sort((a, b) => chestTier(`${b.name} ${b.kind}`) - chestTier(`${a.name} ${a.kind}`)
      || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')),
    merchant: [...groups.merchant.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN')),
    boss: [...groups.boss.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
  }
})
const specialDropTotal = computed(() => SPECIAL_DROP_TABS.reduce((sum, tab) => sum + specialDropGroups.value[tab.key].length, 0))
const activeSpecialDrops = computed(() => specialDropGroups.value[specialDropTab.value] || [])
const specialDropContains = (entry, typeId) => {
  if (!typeId) return false
  return specialDropSources(entry).some(source => (source.reward || []).some(reward => reward.typeId === typeId))
}
const isFocusedSpecialDrop = entry => {
  return entry?.typeId === focusedSpecialDropEntry.value
}
const displayRoomCards = computed(() => {
  const rooms = selectedBattle.value?.rooms || []
  const roomId = selectedRouteNode.value?.roomId
  const scopedRooms = roomId ? rooms.filter(room => room.roomId === roomId) : rooms
  if (!selectedRouteVariantId.value) return scopedRooms
  return scopedRooms
    .map(room => ({ ...room, variants: room.variants.filter(variant => variant.typeId === selectedRouteVariantId.value) }))
    .filter(room => room.variants.length)
})
const filteredDungeons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return dungeons.value
    .filter(dungeon => mapFilter.value === 'all' || dungeon.chapter === mapFilter.value)
    .map(dungeon => {
      if (!query) return dungeon
      const matches = battle => {
        const text = `${battle.name || ''} ${battle.searchText || ''}`.toLowerCase()
        return text.includes(query)
      }
      return { ...dungeon, battles: dungeon.battles.filter(matches), storyBattles: (dungeon.storyBattles || []).filter(matches) }
    })
    .filter(dungeon => dungeon.battles.length > 0 || dungeon.storyBattles?.length > 0)
    // 黑名单：副本名/地区命中即隐藏。
    // 必须用 mapName（「黑森林」）而不是 chapter（「c4」）——黑名单里存的是地区名，用章节代号匹配不到，
    // 结果是筛选按钮被隐藏、卡片却还在。
    .filter(dungeon => !isBlacklisted({ id: dungeon.id, name: dungeon.name, label: dungeon.mapName }))
})

onMounted(async () => {
  try {
    const data = await fetchWithFallback('data/parsed/dungeons.json')
    dungeons.value = data.dungeons || []
    if (mapFilter.value !== 'all' && !mapOptions.value.some(option => option.key === mapFilter.value)) mapFilter.value = 'all'
    isReady.value = true
    if (route.query.battle) {
      const match = findBattle(route.query.battle)
      if (match) openBattle(match.dungeon, match.battle, false)
    }
  } catch (error) {
    console.error('加载副本数据失败:', error)
    isReady.value = true
  }
})

const findBattle = (id) => {
  for (const dungeon of dungeons.value) {
    const battle = [...dungeon.battles, ...(dungeon.storyBattles || [])].find(item => item.id === id)
    if (battle) return { dungeon, battle }
  }
  return null
}

const loadBattleDetail = (battle) => {
  if (battleDetailCache.has(battle.id)) return battleDetailCache.get(battle.id)
  const request = fetchWithFallback(`data/parsed/${battle.detailFile}`).catch(error => {
    battleDetailCache.delete(battle.id)
    throw error
  })
  battleDetailCache.set(battle.id, request)
  return request
}

const initializeBattleDetail = (battle) => {
  focusedSpecialDropEntry.value = ''
  if (specialDropHighlightTimer) clearTimeout(specialDropHighlightTimer)
  specialDropHighlightTimer = 0
  selectedBattle.value = battle
  selectedRouteIndex.value = 0
  selectedRouteRoomId.value = battle.routes?.[0]?.startRoomId || battle.routes?.[0]?.nodes?.[0]?.id || ''
  selectedRouteVariantId.value = battle.routes?.[0]?.nodes?.find(node => node.id === selectedRouteRoomId.value)?.variantOptions?.[0]?.typeId || ''
  specialDropsOpen.value = true
  settlementDropsOpen.value = true
  previewDropsOpen.value = true
  firstDropsOpen.value = false
  specialDropTab.value = SPECIAL_DROP_TABS.find(tab => specialDropGroups.value[tab.key].length)?.key || 'chest'
}

const findRequestedDropTarget = (requestedItem, requestedEntry) => {
  const scrollRoot = document.getElementById('dungeonDetailScroll')
  if (['rooms', 'settlement', 'first'].includes(String(route.query.dropTab))) {
    return [...(scrollRoot?.querySelectorAll('[data-source-entry]') || [])]
      .find(element => element.dataset.sourceEntry === requestedEntry) || null
  }
  const cards = [...(scrollRoot?.querySelectorAll('[data-drop-entry]') || [])]
  if (requestedEntry) return cards.find(element => element.dataset.dropEntry === requestedEntry) || null
  return cards.find(element => {
    const entry = activeSpecialDrops.value.find(item => item.typeId === element.dataset.dropEntry)
    return specialDropContains(entry, requestedItem)
  }) || null
}

const alignRequestedDrop = element => {
  const scrollTarget = resolveScrollTarget('#dungeonDetailScroll')
  if (scrollTarget === window) {
    const top = window.scrollY + element.getBoundingClientRect().top - Math.max(12, (window.innerHeight - element.offsetHeight) / 2)
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
    return
  }

  const targetRect = element.getBoundingClientRect()
  const rootRect = scrollTarget.getBoundingClientRect()
  const top = scrollTarget.scrollTop + targetRect.top - rootRect.top - Math.max(12, (scrollTarget.clientHeight - targetRect.height) / 2)
  scrollTarget.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
}

const focusRequestedDrop = async () => {
  const requestedItem = String(route.query.drop || '')
  const requestedEntry = String(route.query.dropEntry || '')
  if ((!requestedItem && !requestedEntry) || !selectedBattle.value) return

  const requestedTab = String(route.query.dropTab || 'chest')
  const isDirectReward = ['rooms', 'settlement', 'first'].includes(requestedTab)
  if (requestedTab === 'rooms') {
    const room = selectedBattle.value.rooms?.find(room => room.variants.some(variant => requestedEntry.startsWith(`${variant.typeId}:`)))
    const variant = room?.variants.find(variant => requestedEntry.startsWith(`${variant.typeId}:`))
    const routeIndex = selectedBattle.value.routes?.findIndex(layer => layer.nodes?.some(node => node.roomId === room?.roomId
      && node.variantOptions?.some(option => option.typeId === variant?.typeId))) ?? -1
    if (routeIndex >= 0) {
      selectedRouteIndex.value = routeIndex
      selectedRouteRoomId.value = selectedBattle.value.routes[routeIndex].nodes.find(node => node.roomId === room.roomId).id
      await nextTick()
      selectedRouteVariantId.value = variant.typeId
    } else {
      // Some configured reward rooms have no route-map node; show the matching room without a stale filter.
      selectedRouteRoomId.value = ''
      selectedRouteVariantId.value = variant?.typeId || ''
    }
  }
  specialDropTab.value = SPECIAL_DROP_TABS.some(tab => tab.key === requestedTab) ? requestedTab : 'chest'
  specialDropsOpen.value = !isDirectReward
  if (requestedTab === 'settlement') settlementDropsOpen.value = true
  if (requestedTab === 'first') firstDropsOpen.value = true
  await nextTick()

  const requestedDrop = isDirectReward ? null : requestedEntry
    ? activeSpecialDrops.value.find(entry => entry.typeId === requestedEntry)
    : activeSpecialDrops.value.find(entry => specialDropContains(entry, requestedItem))
  focusedSpecialDropEntry.value = requestedDrop?.typeId || ''
  if (specialDropHighlightTimer) clearTimeout(specialDropHighlightTimer)
  let aligned = false

  // 跨路由时旧物品弹窗仍在退场，页面可能短暂不可渲染；多次重新取节点并校正定位。
  for (const delay of [0, 120, 280, 520]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    if (String(route.query.drop || '') !== requestedItem || String(route.query.dropEntry || '') !== requestedEntry) return
    await nextTick()
    const target = findRequestedDropTarget(requestedItem, requestedEntry) || (!isDirectReward && specialDropsAnchorRef.value)
    const page = target?.closest('.page-view-container')
    if (!target?.isConnected || target.getBoundingClientRect().height <= 0 || (page && getComputedStyle(page).display === 'none')) continue
    alignRequestedDrop(target)
    aligned = true
  }

  if (aligned && String(route.query.drop || '') === requestedItem && String(route.query.dropEntry || '') === requestedEntry) {
    const query = { ...route.query }
    delete query.drop
    delete query.dropTab
    delete query.dropEntry
    await router.replace({ query })
  }

  if (focusedSpecialDropEntry.value) {
    const highlightedEntry = focusedSpecialDropEntry.value
    specialDropHighlightTimer = window.setTimeout(() => {
      if (focusedSpecialDropEntry.value === highlightedEntry) focusedSpecialDropEntry.value = ''
      specialDropHighlightTimer = 0
    }, 2000)
  }
}

const openBattle = async (dungeon, battle, syncUrl = true) => {
  const requestId = ++detailRequestId
  selectedDungeon.value = dungeon
  selectedBattle.value = battle
  detailLoading.value = true
  detailError.value = ''
  // 在覆盖式详情打开（app-main 被锁、scrollTop 被钳）之前捕获列表位置，关闭时经 restoreScrollTop 恢复。
  detailSavedScrollTop.value = document.querySelector('.app-container')?.scrollTop || 0
  detailVisible.value = true
  if (syncUrl) router.replace({ query: { ...route.query, battle: battle.id } })
  try {
    const detail = await loadBattleDetail(battle)
    if (requestId !== detailRequestId) return
    initializeBattleDetail(detail)
  } catch (error) {
    if (requestId !== detailRequestId) return
    console.error('加载副本关卡详情失败:', error)
    detailError.value = '关卡详情加载失败，请稍后重试'
  } finally {
    if (requestId === detailRequestId) {
      detailLoading.value = false
      await nextTick()
      await focusRequestedDrop()
    }
  }
}

const closeBattle = () => {
  detailRequestId += 1
  detailVisible.value = false
  selectedDungeon.value = null
  selectedBattle.value = null
  detailLoading.value = false
  detailError.value = ''
  selectedRouteIndex.value = 0
  selectedRouteRoomId.value = ''
  selectedRouteVariantId.value = ''
  focusedSpecialDropEntry.value = ''
  if (specialDropHighlightTimer) clearTimeout(specialDropHighlightTimer)
  specialDropHighlightTimer = 0
  specialDropsOpen.value = false
  settlementDropsOpen.value = false
  previewDropsOpen.value = false
  specialDropTab.value = 'chest'
  const from = route.query.from
  const fromChapter = route.query.fromChapter
  if (from === 'chapters') {
    router.push({
      path: '/chapters',
      query: fromChapter && fromChapter !== 'all' ? { chapter: fromChapter } : {}
    })
    return
  }

  const query = { ...route.query }
  delete query.battle
  delete query.drop
  delete query.dropTab
  delete query.dropEntry
  router.replace({ query })
}

onBeforeUnmount(() => {
  if (specialDropHighlightTimer) clearTimeout(specialDropHighlightTimer)
})

const goToItem = (typeId) => {
  if (!typeId || typeId === '随机装备') return
  router.push({ query: { ...route.query, itemId: typeId } })
}

const collectionSummary = (collections = []) => collections.map(collection => `${collection.name}${collection.count > 1 ? ` ×${collection.count}` : ''}`).join('、')
const previewRewardSourceGroups = () => {
  const sources = []
  const addSource = (label, entries) => {
    if (!entries?.length) return
    sources.push({ label, typeIds: new Set(entries.map(entry => entry?.typeId).filter(Boolean)) })
  }

  addSource('通关结算', selectedBattle.value?.reward || [])
  ;(selectedBattle.value?.rooms || []).forEach(room => {
    ;(room.variants || []).forEach(variant => {
      if (specialDropCategory(room, variant) !== 'boss') return
      ;(variant.monsters || []).forEach(monster => {
        ;(monster.drops || []).forEach(drop => addSource('BOSS 掉落', drop.reward || []))
      })
    })
  })
  return sources
}
const previewGroupSourceLabel = (group) => {
  const typeIds = new Set((group?.entries || []).map(entry => entry?.typeId).filter(Boolean))
  const labels = previewRewardSourceGroups()
    .filter(source => [...typeIds].some(typeId => source.typeIds.has(typeId)))
    .map(source => source.label)
  return [...new Set(labels)].join(' / ') || '预览配置未注明'
}
const specialDropSources = (entry) => {
  if (entry?.specialCategory === 'chest' && entry.sources?.length) {
    return entry.sources.map(source => ({
      key: `reward-${source.rewardId}`,
      label: source.sourceLabel,
      note: source.name,
      reward: source.reward || []
    }))
  }
  const variants = entry?.variants || [entry]
  const sources = entry?.specialCategory === 'boss'
    ? variants.flatMap(variant => (variant.monsters || []).flatMap(monster => (monster.drops || []).map(drop => ({
        key: `monster-${drop.collectTypeId}-${monster.typeId}`,
        label: monster.name,
        note: drop.dropRate ? `${(drop.dropRate * 100).toFixed(0)}%` : '',
        reward: drop.reward || []
      }))))
    : sortedCollections(variants.flatMap(variant => variant.collections || [])
        .filter(collection => entry?.specialCategory !== 'chest'
          || /[金银铜]宝箱/.test(String(collection?.name || ''))))
      .map(collection => ({
        key: `collect-${collection.collectTypeId}`,
        label: collection.name,
        note: '',
        reward: collection.reward || []
      }))
  const unique = new Map()
  sources.forEach(source => {
    if (!source.reward.length) return
    const rewardKey = source.reward.map(reward => `${reward.typeId}:${reward.groupIndex}:${reward.actualProb}`).join('|')
    const key = `${source.label}:${rewardKey}`
    if (!unique.has(key)) unique.set(key, source)
  })
  return [...unique.values()].sort((a, b) => chestTier(b.label) - chestTier(a.label)
    || Math.max(...b.reward.map(entry => Number(entry.quality || 0)), 0) - Math.max(...a.reward.map(entry => Number(entry.quality || 0)), 0))
}
const specialDropAllRewards = (entry) => {
  return specialDropSources(entry).flatMap(source => source.reward || [])
}
const shouldShowSourceHeading = (source, entry) => {
  if (source?.label) return true
  if (source?.note && source.note !== entry?.name) return true
  return false
}
const specialDropTone = (entry) => entry?.specialCategory === 'boss' ? 'danger' : entry?.specialCategory === 'merchant' ? 'accent' : 'gold'
const isStoryOpen = (dungeonId) => !!storyOpenState.value[dungeonId]
const setStoryOpen = (dungeonId, open) => {
  if (!dungeonId) return
  storyOpenState.value = { ...storyOpenState.value, [dungeonId]: !!open }
}
const handleStorySummaryClick = (dungeonId, count, event) => {
  if (count > 0) return
  event.preventDefault()
  setStoryOpen(dungeonId, false)
}

const candidateLabel = (option) => selectedRouteRoom.value?.variants?.find(variant => variant.typeId === option?.typeId)?.name || '未命名候选'

watch([mapFilter, searchQuery], () => {
  const query = {}
  if (mapFilter.value !== 'all') query.map = mapFilter.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  for (const key of ['battle', 'drop', 'dropTab', 'dropEntry']) {
    if (route.query[key]) query[key] = route.query[key]
  }
  router.replace({ query })
})

watch(() => [route.query.battle, route.query.drop, route.query.dropTab, route.query.dropEntry], async ([battleId]) => {
  if (!isReady.value) return
  if (!battleId) {
    if (detailVisible.value) closeBattle()
    return
  }
  const match = findBattle(battleId)
  if (match && selectedBattle.value?.id !== battleId) openBattle(match.dungeon, match.battle, false)
  else if (match && !detailLoading.value) await focusRequestedDrop()
})
</script>

<style scoped>
.dungeon-filter-panel { margin: 0 0 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.dungeon-count { color: var(--text-muted); font-size: 13px; font-weight: 600; }
.dungeon-scroll { flex: 1; overflow-y: auto; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; grid-auto-rows: max-content; gap: 14px; padding-bottom: 14px; }
.dungeon-card { overflow: visible; min-width: 0; align-self: start; }
.dungeon-card__cover { min-height: 156px; position: relative; background: linear-gradient(135deg, var(--wood-soft), var(--wood)); background-size: cover; background-position: center; color: var(--on-image-text); padding: 16px; display: flex; flex-direction: column; justify-content: flex-end; }
.dungeon-card__cover-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.dungeon-card__cover-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(28, 18, 10, .16), rgba(28, 18, 10, .88)); }
.dungeon-card__heading, .dungeon-card__description { position: relative; z-index: 1; }
.dungeon-card__heading { display: flex; align-items: center; }
.dungeon-card__heading h2 { margin: 0; font-size: 18px; letter-spacing: 1px; }
.dungeon-card__heading p { margin: 4px 0 0; font-size: 12px; color: var(--on-image-text-muted); }
.dungeon-card__description { margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: var(--on-image-text-muted); }
.dungeon-battle-list { padding: 4px 10px 8px; }
.story-battles { margin: 0 10px 10px; border-top: 1px solid var(--border-soft); }
.story-battles--empty { opacity: .72; }
.story-battles summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 4px 5px; color: var(--text-muted); font-size: 12px; font-weight: 700; cursor: pointer; list-style-position: inside; }
.story-battles--empty summary { cursor: default; }
.story-battles summary::marker { color: var(--accent); }
.story-battles--empty summary::marker { color: transparent; }
.dungeon-battle-list--story { padding: 0 0 2px; }
.dungeon-battle-list--story .dungeon-battle-row { padding-left: 4px; padding-right: 4px; }
.dungeon-battle-row { width: 100%; border: 0; border-bottom: 1px dashed var(--border-soft); background: transparent; color: var(--text-main); display: flex; align-items: center; gap: 8px; padding: 10px 4px; text-align: left; cursor: pointer; }
.dungeon-battle-row:last-child { border-bottom: 0; }
.dungeon-battle-row:hover { background: var(--hover-bg); }
.dungeon-battle-row__main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.dungeon-battle-row__main strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
.dungeon-battle-row__main small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text-muted); font-size: 11px; }
.dungeon-battle-row__meta { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.dungeon-battle-row__arrow { color: var(--text-muted); font-size: 20px; line-height: 1; }
.detail-badges { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 4px; }
.dungeon-entry-cost { display: inline-flex; align-items: center; justify-content: flex-end; gap: 3px; font-weight: 700; white-space: nowrap; }
.dungeon-entry-cost img { width: 22px; height: 22px; object-fit: contain; }
/* 奖励池与房间内容的卡片样式随 RewardPools / RoomContentList 组件走。 */
.empty-reward, .drop-note { color: var(--text-muted); font-size: 13px; margin: 0; }
.drop-note { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-soft); line-height: 1.6; }
.drop-note--room-intro { margin: 0 0 10px; padding: 0 0 8px; border-top: 0; border-bottom: 1px dashed var(--border-soft); }
/* 房间内容与掉落来源的卡片样式随 RoomContentList 组件走，这里只保留路线详情用到的效果块。 */
.room-effects { display: grid; gap: 6px; margin-top: 7px; }
.room-effects--route { margin-top: 9px; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.room-effect { min-width: 0; border-left: 2px solid var(--accent); padding-left: 8px; }
.room-effect > strong { color: var(--text-main); font-size: 11px; }
.room-effect > p { margin: 2px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.5; }
.room-effect__options { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.room-effect__options span { border: 1px solid var(--border-soft); border-radius: 3px; background: var(--paper-solid); padding: 3px 6px; color: var(--text-sub); font-size: 11px; line-height: 1.4; }
.room-effect__options b { margin-right: 5px; color: var(--text-main); }
.special-drops { margin: 0 0 18px; }
.special-drops :deep(.ui-empty-state) { padding: 24px 16px; }
.special-drops__tabs { width: 100%; margin-bottom: 9px; }
.special-drops__tabs :deep(.ui-segmented__item) { flex: 1; }
.special-drop-list { display: flex; flex-direction: column; gap: 8px; }
.special-drop-card { min-width: 0; border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-soft); padding: 9px 10px; }
.special-drop-card--focused { border-color: var(--gold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 72%, transparent); }
.special-drop-card__heading { display: flex; align-items: center; gap: 8px; min-width: 0; }
.special-drop-card__heading > strong { min-width: 0; color: var(--text-main); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.special-drop-card__heading > .prob-detail-btn { flex-shrink: 0; }
.special-drop-card__tags { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-shrink: 0; }
.special-drop-sources { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
.special-drop-source { min-width: 0; }
.special-drop-source:not(:first-child) { border-top: 1px dashed var(--border-soft); padding-top: 10px; }
.special-drop-source__heading { display: flex; align-items: center; justify-content: space-between; gap: 7px; min-width: 0; margin-bottom: 10px; color: var(--text-main); font-size: 12px; }
.special-drop-source__title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.special-drop-source__title > strong { min-width: 0; }
.special-drop-source__title > .prob-detail-btn { flex-shrink: 0; }
.special-drop-source__heading small { color: var(--text-muted); font-size: 11px; font-weight: 600; }
.special-drop-card__empty { margin: 7px 0 0; color: var(--text-muted); font-size: 12px; }
.route-room-detail { margin-top: 8px; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-soft); padding: 10px; }
.route-room-detail__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.route-room-detail__eyebrow { color: var(--text-muted); font-size: 10px; font-weight: 700; }
.route-room-detail h3 { margin: 2px 0 0; color: var(--text-main); font-size: 15px; }
.route-room-detail__candidates { margin: 7px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.55; }

.route-room-detail__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 9px; }
.route-room-detail__grid > div { min-width: 0; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.route-room-detail__grid strong, .route-room-detail__drops > strong { color: var(--text-main); font-size: 11px; }
.route-room-detail__grid p { margin: 3px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.5; }
.route-room-detail__muted { color: var(--text-muted) !important; }
.route-room-detail__drops { margin-top: 9px; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.route-room-detail__drop-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.route-room-detail__options { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px; margin-top: 8px; border-top: 1px dashed var(--border-soft); padding-top: 7px; color: var(--text-muted); font-size: 11px; }
.route-room-detail__options strong { color: var(--text-main); }
.route-room-detail__options span { padding: 2px 5px; border: 1px solid var(--border-soft); border-radius: 3px; background: var(--paper-solid); }
@media (max-width: 1024px) {
  .dungeon-scroll { padding-bottom: calc(88px + var(--floating-control-size, 44px) + var(--safe-bottom, 0px)); }
}
@media (max-width: 760px) {
  .dungeon-scroll { display: flex; flex-direction: column; gap: 10px; }
  .dungeon-card { width: 100%; align-self: stretch; }
  .dungeon-card__cover { min-height: 140px; }
}
@media (max-width: 440px) {
  .dungeon-card__heading h2 { font-size: 16px; }
  .route-room-detail__grid { grid-template-columns: 1fr; }
}
</style>
