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
                <UiTag :tone="routeRoomTone(selectedRouteRoom)">{{ selectedRouteRoom.kind }}</UiTag>
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
          <div class="room-list">
            <article v-for="room in displayRoomCards" :key="`${room.layer}-${room.roomId}`" class="room-card">
              <div v-if="room.level || room.hidden" class="room-card__heading room-card__heading--meta-only">
                <UiTag v-if="room.level" tone="default">Lv.{{ room.level }}</UiTag>
                <UiTag v-if="room.hidden" tone="muted">隐藏</UiTag>
              </div>
              <div class="room-card__variants">
                <template v-for="variant in room.variants" :key="variant.typeId">
                <div class="room-variant">
                  <div class="room-variant__title">
                    <span>{{ variant.name }}</span>
                    <UiTag v-if="variant.source?.candidate" tone="muted">随机候选</UiTag>
                    <UiTag :tone="variant.kind.includes('宝箱') ? 'gold' : 'default'">{{ variant.kind }}</UiTag>
                  </div>
                  <div v-if="variant.effects?.length" class="room-effects">
                    <div v-for="effect in variant.effects" :key="`${variant.typeId}-${effect.type}`" class="room-effect">
                      <strong>{{ effect.title }}</strong>
                      <p>{{ effect.summary }}</p>
                      <div v-if="effect.options?.length" class="room-effect__options">
                        <span v-for="option in effect.options" :key="`${effect.type}-${option.name}`">
                          <b>{{ option.name }}</b>{{ option.detail }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <template v-if="variant.monsters.length">
                    <p v-for="line in monsterWaveLines(variant)" :key="line.key" class="room-variant__line"><strong v-if="line.wave">第{{ line.wave }}波：</strong><template v-else>怪物：</template>{{ line.text }}</p>
                  </template>
                  <p v-else-if="variant.notFightRoom" class="room-variant__line">非战斗房间</p>
                  <p v-if="variant.npcCount" class="room-variant__line">NPC：{{ variant.npcCount }} 个</p>
                  <div v-for="collection in sortedCollections(variant.collections)" :key="`${variant.typeId}-${collection.collectTypeId}`" :data-source-entry="`${variant.typeId}:${collection.collectTypeId}`" class="room-collection">
                    <div class="room-collection__heading">
                      <span>{{ collection.name }}<template v-if="collection.count > 1"> ×{{ collection.count }}</template></span>
                      <small v-if="collection.consume">{{ collectConsumeText(collection) }}</small>
                    </div>
                    <div v-if="collection.reward.length" class="reward-pools room-reward-pools">
                      <div v-for="group in rewardGroups(collection.reward)" :key="`${collection.collectTypeId}-pool-${group.index}`" class="reward-pool">
                        <div class="reward-pool__heading"><strong>奖励池 {{ group.index + 1 }}</strong><small>{{ rewardGroupLabel(group) }}</small></div>
                        <div class="room-reward-grid">
                          <UiRewardCard
                            v-for="(entry, index) in group.entries"
                            :key="`${collection.collectTypeId}-${entry.typeId}-${index}`"
                            :rule="rewardRule(entry)"
                            :clickable="isRewardClickable(entry)"
                            @click="goToItem(entry.typeId)"
                          />
                        </div>
                      </div>
                    </div>
                    <p v-else class="room-variant__line">已配置交互，奖励表未提供可展示条目</p>
                  </div>
                  <div v-for="monster in variant.monsters" :key="`${variant.typeId}-${monster.typeId}-drop`">
                    <div v-for="drop in monster.drops" :key="`${monster.typeId}-${drop.collectTypeId}`" :data-source-entry="`${variant.typeId}:${monster.typeId}:${drop.collectTypeId}`" class="room-collection room-collection--monster">
                      <div class="room-collection__heading"><span>{{ monster.name }} 自动掉落</span><small v-if="drop.dropRate">{{ (drop.dropRate * 100).toFixed(0) }}%</small></div>
                      <div v-if="drop.reward.length" class="reward-pools room-reward-pools">
                        <div v-for="group in rewardGroups(drop.reward)" :key="`${drop.collectTypeId}-pool-${group.index}`" class="reward-pool">
                          <div class="reward-pool__heading"><strong>奖励池 {{ group.index + 1 }}</strong><small>{{ rewardGroupLabel(group) }}</small></div>
                          <div class="room-reward-grid">
                            <UiRewardCard v-for="(entry, index) in group.entries" :key="`${drop.collectTypeId}-${entry.typeId}-${index}`" :rule="rewardRule(entry)" :clickable="isRewardClickable(entry)" @click="goToItem(entry.typeId)" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </template>
              </div>
            </article>
          </div>
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
                <UiTag :tone="specialDropTone(entry)">{{ SPECIAL_DROP_TABS.find(tab => tab.key === entry.specialCategory)?.label }}</UiTag>
                <UiTag v-if="entry.level" tone="default">Lv.{{ entry.level }}</UiTag>
              </div>
              <div v-if="specialDropSources(entry).length" class="special-drop-sources">
                <section v-for="source in specialDropSources(entry)" :key="`${entry.typeId}-${source.key}`" class="special-drop-source">
                  <div v-if="source.label || source.note" class="special-drop-source__heading">
                    <strong>{{ source.label }}</strong>
                    <small v-if="source.note">{{ source.note }}</small>
                  </div>
                  <div class="reward-pools room-reward-pools">
                    <div v-for="group in rewardGroups(source.reward)" :key="`${entry.typeId}-${source.key}-pool-${group.index}`" class="reward-pool">
                      <div class="reward-pool__heading"><strong>奖励池 {{ group.index + 1 }}</strong><small>{{ rewardGroupLabel(group) }}</small></div>
                      <div class="room-reward-grid">
                        <UiRewardCard
                          v-for="(reward, index) in group.entries"
                          :key="`${entry.typeId}-${source.key}-${reward.typeId}-${index}`"
                          :rule="rewardRule(reward)"
                          :clickable="isRewardClickable(reward)"
                          @click="goToItem(reward.typeId)"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
              <p v-else class="special-drop-card__empty">暂无可展示的掉落配置</p>
            </article>
          </div>
          <UiEmptyState v-else text="当前关卡没有此类特殊掉落" />
        </UiSection>
        </div>

        <UiSection v-model:open="settlementDropsOpen" title="通关结算掉落" data-source-entry="settlement" collapsible>
          <div v-if="selectedBattle.reward.length" class="reward-pools">
            <div v-for="group in rewardGroups(selectedBattle.reward)" :key="`reward-pool-${group.index}`" class="reward-pool">
              <div class="reward-pool__heading"><strong>奖励池 {{ group.index + 1 }}</strong><small>{{ rewardGroupLabel(group) }}</small></div>
              <div class="reward-grid">
                <UiRewardCard
                  v-for="(entry, index) in group.entries"
                  :key="`${entry.typeId}-${index}`"
                  :rule="rewardRule(entry)"
                  :clickable="isRewardClickable(entry)"
                  @click="goToItem(entry.typeId)"
                />
              </div>
            </div>
          </div>
          <p v-else class="empty-reward">暂无可展示的掉落配置</p>
        </UiSection>

        <UiSection v-if="selectedBattle.previewReward.length" v-model:open="previewDropsOpen" title="副本预览掉落" collapsible>
          <div class="reward-pools">
            <div v-for="group in rewardGroups(selectedBattle.previewReward)" :key="`preview-pool-${group.index}`" class="reward-pool">
              <div class="reward-pool__heading">
                <span class="reward-pool__heading-main">
                  <strong>奖励池 {{ group.index + 1 }}</strong>
                  <span class="reward-pool__source">来源：{{ previewGroupSourceLabel(group) }}</span>
                </span>
                <small>{{ rewardGroupLabel(group) }}</small>
              </div>
              <div class="reward-grid">
                <UiRewardCard
                  v-for="(entry, index) in group.entries"
                  :key="`preview-${entry.typeId}-${index}`"
                  :rule="rewardRule(entry)"
                  :clickable="isRewardClickable(entry)"
                  @click="goToItem(entry.typeId)"
                />
              </div>
            </div>
          </div>
          <p class="drop-note drop-note--inline">源码中 `showReward` 用于进入副本前的奖励预览，实际结算使用上方 `reward`。</p>
        </UiSection>

        <UiSection v-if="selectedBattle.firstReward.length" title="首次通关奖励" data-source-entry="first">
          <div class="reward-pools">
            <div v-for="group in rewardGroups(selectedBattle.firstReward)" :key="`first-pool-${group.index}`" class="reward-pool">
              <div class="reward-pool__heading"><strong>奖励池 {{ group.index + 1 }}</strong><small>{{ rewardGroupLabel(group) }}</small></div>
              <div class="reward-grid">
                <UiRewardCard
                  v-for="(entry, index) in group.entries"
                  :key="`first-${entry.typeId}-${index}`"
                  :rule="rewardRule(entry)"
                  :clickable="isRewardClickable(entry)"
                  @click="goToItem(entry.typeId)"
                />
              </div>
            </div>
          </div>
        </UiSection>

        <p class="drop-note">奖励卡中的“本次抽取”是当前奖励池抽中该物品的概率；如果同一奖励池会抽取多次，会同时显示多次抽取后至少获得一次的概率。“随机装备”表示游戏按品质和部位规则生成装备。</p>
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
  UiRewardCard,
  UiFilterPanel, UiSearchInput,
  UiSection,
  UiSegmentedTabs,
  UiTag
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import DungeonRouteMap from '../components/dungeons/DungeonRouteMap.vue'
import { getImageUrl, handleImageFallback } from '../utils/env.js'
import { BASE_REWARD_PATHS, MAP_NAMES } from '../utils/gameMappings.js'
import { resolveScrollTarget } from '../utils/scrollTarget.js'

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
const specialDropsOpen = ref(false)
const settlementDropsOpen = ref(false)
const previewDropsOpen = ref(false)
const specialDropTab = ref('chest')
let detailRequestId = 0
let specialDropHighlightTimer = 0
const battleDetailCache = new Map()
const SPECIAL_DROP_TABS = [
  { key: 'chest', label: '箱子' },
  { key: 'merchant', label: '黑商人' },
  { key: 'boss', label: 'BOSS' }
]

const chestTier = (value = '') => {
  const text = String(value)
  if (text.includes('金')) return 3
  if (text.includes('银')) return 2
  if (text.includes('铜')) return 1
  return 0
}
const specialDropCategory = (room, variant) => {
  const name = String(variant?.name || '')
  const kind = String(variant?.kind || '')
  const text = `${name} ${kind}`
  if (name.includes('箱') && chestTier(text) > 0) return 'chest'
  if (/黑商/.test(text)) return 'merchant'
  if (/boss|首领/i.test(text) || /boss|首领/i.test(String(room?.label || ''))) return 'boss'
  return ''
}
const rewardQualitySort = (a, b) => Number(b?.quality || 0) - Number(a?.quality || 0)
  || Number(b?.actualProb || 0) - Number(a?.actualProb || 0)
  || String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN')
const sortedCollections = (collections = []) => [...collections].sort((a, b) => chestTier(b?.name) - chestTier(a?.name)
  || String(a?.name || '').localeCompare(String(b?.name || ''), 'zh-CN'))

const mapOptions = computed(() => [
  { key: 'all', label: '全部' },
  ...Object.entries(MAP_NAMES)
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
  specialDropsOpen.value = false
  settlementDropsOpen.value = false
  previewDropsOpen.value = false
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
const monsterWaveLines = (room) => {
  const waves = room?.waves || []
  if (waves.length > 1) {
    return waves.map((wave, index) => ({
      key: `wave-${wave.round || index + 1}`,
      wave: wave.round || index + 1,
      text: (wave.monsters || []).map(monster => `${monster.name} ×${monster.count}`).join('、')
    }))
  }
  return [{ key: 'all', wave: 0, text: (room?.monsters || []).map(monster => `${monster.name} ×${monster.count}`).join('、') }]
}
const collectConsumeText = (collection) => collection?.consumeCost?.ti > 0 ? `消耗 ${collection.consumeCost.ti} 体力` : '无需消耗'
const isRewardClickable = (entry) => !!entry?.typeId && (entry.kind === 'item' || entry.kind === 'equip') && entry.typeId !== 'equipGroup'
const uniqueRewards = (entries = []) => {
  const rewards = new Map()
  entries.forEach((entry, index) => {
    if (!entry) return
    const key = entry.typeId || `${entry.name}-${index}`
    const current = rewards.get(key)
    if (!current || Number(entry.quality || 0) > Number(current.quality || 0)) rewards.set(key, entry)
  })
  return [...rewards.values()].sort((a, b) => Number(b.quality || 0) - Number(a.quality || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
}
const rewardRule = (entry) => ({
  ...entry,
  targetName: entry.name,
  targetImg: entry.icon ? getImageUrl(entry.icon) : '',
  targetQuality: entry.quality || 0
})
const rewardGroups = (entries = []) => {
  const groups = new Map()
  entries.forEach(entry => {
    const index = Number(entry.groupIndex || 0)
    if (!groups.has(index)) groups.set(index, { index, rate: Number(entry.groupRate ?? 1), count: Number(entry.groupCount || 1), entries: [] })
    groups.get(index).entries.push(entry)
  })
  return [...groups.values()]
    .map(group => ({ ...group, entries: [...group.entries].sort(rewardQualitySort) }))
    .sort((a, b) => a.index - b.index)
}
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
        label: `${monster.name} 自动掉落`,
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
const specialDropTone = (entry) => entry?.specialCategory === 'boss' ? 'danger' : entry?.specialCategory === 'merchant' ? 'accent' : 'gold'
const rewardGroupLabel = (group) => `${group.rate < 1 ? `${(group.rate * 100).toFixed(0)}% 概率触发` : '必定触发'} · ${group.count} 个奖励`
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
const routeRoomTone = (room) => room?.kind?.includes('宝箱') ? 'gold' : room?.kind === 'BOSS' ? 'danger' : room?.kind === '事件' ? 'accent' : 'default'

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
.reward-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.reward-pools { display: flex; flex-direction: column; gap: 9px; }
.reward-pool { min-width: 0; }
.reward-pool__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 0 5px; color: var(--text-main); font-size: 12px; }
.reward-pool__heading-main { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
.reward-pool__source { color: var(--accent-ink); background: var(--hover-bg); border: 1px solid var(--border-soft); border-radius: 3px; padding: 1px 5px; font-size: 10px; font-weight: 700; }
.reward-pool__heading small { color: var(--text-muted); font-size: 11px; font-weight: 600; }
.empty-reward, .drop-note { color: var(--text-muted); font-size: 13px; margin: 0; }
.drop-note { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-soft); line-height: 1.6; }
.drop-note--room-intro { margin: 0 0 10px; padding: 0 0 8px; border-top: 0; border-bottom: 1px dashed var(--border-soft); }
.room-list { display: flex; flex-direction: column; gap: 8px; overflow: visible; padding-right: 0; }
.room-card { border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-soft); padding: 9px 10px; }
.room-card__heading, .room-variant__title, .room-collection__heading { display: flex; align-items: center; gap: 7px; min-width: 0; }
.room-card__heading { color: var(--text-main); font-size: 13px; }
.room-card__heading strong { flex: 1; }
.room-card__heading--meta-only { justify-content: flex-end; }
.room-card__variants { display: flex; flex-direction: column; gap: 7px; margin-top: 7px; }
.room-variant { border-left: 3px solid var(--accent); padding: 6px 0 6px 9px; min-width: 0; }
.room-variant__title { font-size: 12px; font-weight: 700; color: var(--text-main); }
.room-variant__title span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.room-variant__line { margin: 4px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.room-effects { display: grid; gap: 6px; margin-top: 7px; }
.room-effects--route { margin-top: 9px; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.room-effect { min-width: 0; border-left: 2px solid var(--accent); padding-left: 8px; }
.room-effect > strong { color: var(--text-main); font-size: 11px; }
.room-effect > p { margin: 2px 0 0; color: var(--text-sub); font-size: 12px; line-height: 1.5; }
.room-effect__options { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.room-effect__options span { border: 1px solid var(--border-soft); border-radius: 3px; background: var(--paper-solid); padding: 3px 6px; color: var(--text-sub); font-size: 11px; line-height: 1.4; }
.room-effect__options b { margin-right: 5px; color: var(--text-main); }
.room-collection { margin-top: 6px; padding: 6px 7px; background: var(--paper-solid); border: 1px dashed var(--border-soft); border-radius: 4px; }
.room-collection--monster { border-style: solid; }
.room-collection__heading { justify-content: space-between; color: var(--text-main); font-size: 12px; font-weight: 700; }
.room-collection__heading small { color: var(--text-muted); font-weight: 600; }
.room-reward-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 6px; }
.room-reward-pools .reward-pool__heading { margin-top: 5px; padding: 0 2px; }
.special-drops { margin: 0 0 18px; }
.special-drops :deep(.ui-empty-state) { padding: 24px 16px; }
.special-drops__tabs { width: 100%; margin-bottom: 9px; }
.special-drops__tabs :deep(.ui-segmented__item) { flex: 1; }
.special-drop-list { display: flex; flex-direction: column; gap: 8px; }
.special-drop-card { min-width: 0; border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-soft); padding: 9px 10px; }
.special-drop-card--focused { border-color: var(--gold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 72%, transparent); }
.special-drop-card__heading, .special-drop-source__heading { display: flex; align-items: center; gap: 7px; min-width: 0; }
.special-drop-card__heading > strong { flex: 1; min-width: 0; color: var(--text-main); font-size: 13px; }
.special-drop-sources { display: flex; flex-direction: column; gap: 9px; margin-top: 7px; }
.special-drop-source { min-width: 0; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.special-drop-source__heading { justify-content: space-between; color: var(--text-main); font-size: 12px; }
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
  .reward-grid { grid-template-columns: 1fr; }
  .room-reward-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dungeon-card__heading h2 { font-size: 16px; }
  .route-room-detail__grid { grid-template-columns: 1fr; }
}
</style>
