<template>
  <div class="page-view-container dungeon-page">
    <div class="dungeon-filter paper-panel">
      <UiSegmentedTabs :model-value="mapFilter" :options="mapOptions" @update:model-value="mapFilter = $event" />
      <UiSearchInput v-model="searchQuery" placeholder="搜索副本、关卡或掉落物品..." />
      <div class="dungeon-count">共 <span class="count-num">{{ filteredDungeons.length }}</span> 个副本，<span class="count-num">{{ battleCount }}</span> 个关卡<span v-if="storyBattleCount">，另有 <span class="count-num">{{ storyBattleCount }}</span> 个剧情入口</span></div>
    </div>

    <UiEmptyState v-if="!isReady" type="loading" text="正在装配副本数据..." />
    <UiEmptyState v-else-if="filteredDungeons.length === 0" text="未找到符合条件的副本" />

    <div v-else id="dungeonGrid" class="dungeon-scroll">
      <section v-for="dungeon in filteredDungeons" :key="dungeon.id" class="dungeon-card paper-panel">
        <div class="dungeon-card__cover" :style="coverStyle(dungeon)">
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
          <div class="route-layout-tabs" role="tablist" aria-label="随机布局">
            <button
              v-for="(layer, index) in selectedBattle.routes"
              :key="layer.id"
              type="button"
              class="route-layout-tab"
              :class="{ 'route-layout-tab--active': selectedRouteIndex === index }"
              role="tab"
              :aria-selected="selectedRouteIndex === index"
              @click="selectRouteLayer(index)"
            >
              {{ routeLabel(index) }}<small>{{ routeChance(layer) }}</small>
            </button>
          </div>
          <div v-if="selectedRouteLayer" class="route-map-shell">
            <div class="route-map-toolbar" role="group" aria-label="地图缩放控制">
              <button type="button" title="缩小地图" aria-label="缩小地图" :disabled="routeZoom <= 0.7" @click="zoomRouteBy(-0.1)">−</button>
              <output aria-label="当前地图缩放比例">{{ Math.round(routeZoom * 100) }}%</output>
              <button type="button" title="放大地图" aria-label="放大地图" :disabled="routeZoom >= 2.4" @click="zoomRouteBy(0.1)">+</button>
              <button type="button" title="恢复默认视图" aria-label="恢复默认视图" @click="resetRouteMap">↺</button>
            </div>
            <div
              class="route-map-scroll"
              ref="routeMapScrollRef"
              @wheel="handleRouteWheel"
              @dblclick="handleRouteDoubleClick"
              @touchstart="handleRouteTouchStart"
              @touchmove="handleRouteTouchMove"
              @touchend="handleRouteTouchEnd"
              @touchcancel="handleRouteTouchEnd"
              @pointerdown="handleRoutePointerDown"
              @pointermove="handleRoutePointerMove"
              @pointerup="handleRoutePointerUp"
              @pointercancel="handleRoutePointerUp"
            >
              <div class="route-map-space" :style="routeMapSpaceStyle(displayRouteLayer)">
                <div class="route-map" :style="routeMapStyle(displayRouteLayer)">
                <svg class="route-map__links" :viewBox="`0 0 ${displayRouteLayer.size.w} ${displayRouteLayer.size.h}`" preserveAspectRatio="none" aria-hidden="true">
                  <polyline
                    v-for="(link, index) in displayRouteLayer.links"
                    :key="`route-link-${index}`"
                    :points="link.points"
                    class="route-map__link"
                    :class="{ 'route-map__link--active': isRouteLinkActive(link) }"
                  />
                </svg>
                <div
                  v-for="node in displayRouteLayer.nodes"
                  :key="node.id"
                  class="route-node-group"
                  :style="routeNodeStyle(node, displayRouteLayer)"
                >
                  <button
                    v-if="node.variantOptions?.length > 1"
                    type="button"
                    class="route-node-expand"
                    :aria-label="isRouteNodeExpanded(node) ? '收起候选房间' : `展开 ${node.variantOptions.length} 个候选房间`"
                    @click.stop="toggleRouteNodeExpanded(node.id)"
                  >
                    {{ isRouteNodeExpanded(node) ? '−' : '+' }}
                  </button>
                  <button
                    v-for="(variant, variantIndex) in visibleRouteVariants(node)"
                    :key="`${node.id}-${variant.typeId}`"
                    type="button"
                    class="route-node"
                    :class="routeNodeClass(node, variant.typeId)"
                    :aria-label="routeNodeLabel(node, variant)"
                    @click="selectRouteRoom(node.id, variant.typeId)"
                  >
                    <img v-if="routeIconPath(variant)" :src="routeIconPath(variant)" alt="" />
                    <span v-else class="route-node__fallback" :aria-label="variantIndex === 0 ? routeIconGlyph(node) : '房间图标'">
                      {{ variantIndex === 0 ? routeIconGlyph(node) : '' }}
                    </span>
                    <i v-if="node.candidates && variantIndex === 0" class="route-node__random">{{ node.candidates + 1 }}</i>
                  </button>
                </div>
                </div>
              </div>
            </div>
          </div>
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
                  <div v-for="collection in sortedCollections(variant.collections)" :key="`${variant.typeId}-${collection.collectTypeId}`" class="room-collection">
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
                    <div v-for="drop in monster.drops" :key="`${monster.typeId}-${drop.collectTypeId}`" class="room-collection room-collection--monster">
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

        <UiSection v-if="specialDropTotal" v-model:open="specialDropsOpen" title="特殊掉落" collapsible class="special-drops">
          <UiSegmentedTabs v-model="specialDropTab" :options="SPECIAL_DROP_TABS" class="special-drops__tabs" />
          <div v-if="activeSpecialDrops.length" class="special-drop-list">
            <article v-for="entry in activeSpecialDrops" :key="`${entry.specialCategory}-${entry.typeId}`" class="special-drop-card">
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

        <UiSection v-model:open="settlementDropsOpen" title="通关结算掉落" collapsible>
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

        <UiSection v-if="selectedBattle.firstReward.length" title="首次通关奖励">
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
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UiBackToTop,
  UiEmptyState,
  UiInfoRow,
  UiModal,
  UiRewardCard,
  UiSearchInput,
  UiSection,
  UiSegmentedTabs,
  UiTag
} from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request.js'
import { getImageUrl } from '../utils/env.js'
import { BASE_REWARD_PATHS, MAP_NAMES } from '../utils/gameMappings.js'

const route = useRoute()
const router = useRouter()
const dungeons = shallowRef([])
const isReady = ref(false)
const mapFilter = ref(route.query.map || 'all')
const searchQuery = ref(route.query.q || '')
const detailVisible = ref(false)
const selectedDungeon = ref(null)
const selectedBattle = shallowRef(null)
const detailLoading = ref(false)
const detailError = ref('')
const selectedRouteIndex = ref(0)
const selectedRouteRoomId = ref('')
const selectedRouteVariantId = ref('')
const DEFAULT_ROUTE_ZOOM = 0.7
const routeZoom = ref(DEFAULT_ROUTE_ZOOM)
const routeMapScrollRef = ref(null)
const storyOpenState = ref({})
const expandedRouteNodes = ref(new Set())
const specialDropsOpen = ref(false)
const settlementDropsOpen = ref(false)
const previewDropsOpen = ref(false)
const specialDropTab = ref('chest')
let routeTouchGesture = null
let routeTouchPan = null
let routeTouchFrame = 0
let routeTouchRequest = null
let routeTouchMomentumFrame = 0
let routePointerDrag = null
let routeZoomFrame = 0
let routeZoomRequest = null
let detailRequestId = 0
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
const displayRouteLayer = computed(() => orientRouteLayer(selectedRouteLayer.value))
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
  selectedBattle.value = battle
  selectedRouteIndex.value = 0
  selectedRouteRoomId.value = battle.routes?.[0]?.startRoomId || battle.routes?.[0]?.nodes?.[0]?.id || ''
  selectedRouteVariantId.value = battle.routes?.[0]?.nodes?.find(node => node.id === selectedRouteRoomId.value)?.variantOptions?.[0]?.typeId || ''
  routeZoom.value = DEFAULT_ROUTE_ZOOM
  expandedRouteNodes.value = new Set()
  specialDropsOpen.value = false
  settlementDropsOpen.value = false
  previewDropsOpen.value = false
  specialDropTab.value = SPECIAL_DROP_TABS.find(tab => specialDropGroups.value[tab.key].length)?.key || 'chest'
  queueRouteViewportReset()
}

const openBattle = async (dungeon, battle, syncUrl = true) => {
  const requestId = ++detailRequestId
  selectedDungeon.value = dungeon
  selectedBattle.value = battle
  detailLoading.value = true
  detailError.value = ''
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
    if (requestId === detailRequestId) detailLoading.value = false
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
  routeZoom.value = DEFAULT_ROUTE_ZOOM
  expandedRouteNodes.value = new Set()
  specialDropsOpen.value = false
  settlementDropsOpen.value = false
  previewDropsOpen.value = false
  specialDropTab.value = 'chest'
  const query = { ...route.query }
  delete query.battle
  router.replace({ query })
}

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
const coverStyle = (dungeon) => dungeon.background ? { backgroundImage: `url(${getImageUrl(dungeon.background)})` } : {}

const selectRouteLayer = (index) => {
  selectedRouteIndex.value = index
  const layer = selectedBattle.value?.routes?.[index]
  selectedRouteRoomId.value = layer?.startRoomId || layer?.nodes?.[0]?.id || ''
  selectedRouteVariantId.value = layer?.nodes?.find(node => node.id === selectedRouteRoomId.value)?.variantOptions?.[0]?.typeId || ''
  routeZoom.value = DEFAULT_ROUTE_ZOOM
  expandedRouteNodes.value = new Set()
  queueRouteViewportReset()
}

const selectRouteRoom = (roomId, variantId = '') => {
  if (!roomId) return
  selectedRouteRoomId.value = roomId
  selectedRouteVariantId.value = variantId || selectedRouteLayer.value?.nodes?.find(node => node.id === roomId)?.variantOptions?.[0]?.typeId || ''
}

const MIN_ROUTE_ZOOM = 0.7
const MAX_ROUTE_ZOOM = 2.4
const clampRouteZoom = (value) => Math.min(MAX_ROUTE_ZOOM, Math.max(MIN_ROUTE_ZOOM, Number(value) || 1))
const setRouteZoom = (value) => {
  routeZoom.value = Number(clampRouteZoom(value).toFixed(2))
}
const ROUTE_MAP_WIDTH = 1400
const routeMapDimensions = (layer) => {
  const sourceWidth = Math.max(1, Number(layer?.size?.w || 1600))
  const sourceHeight = Math.max(1, Number(layer?.size?.h || 1000))
  return { width: ROUTE_MAP_WIDTH, height: Math.round(ROUTE_MAP_WIDTH * sourceHeight / sourceWidth) }
}
const zoomRouteAt = (value, clientX, clientY) => {
  routeZoomRequest = { value, clientX, clientY }
  if (routeZoomFrame) return
  routeZoomFrame = requestAnimationFrame(() => {
    routeZoomFrame = 0
    const request = routeZoomRequest
    routeZoomRequest = null
    const container = routeMapScrollRef.value
    const previousZoom = routeZoom.value
    if (!container || !request) {
      if (request) setRouteZoom(request.value)
      return
    }
    const rect = container.getBoundingClientRect()
    const focusX = Number.isFinite(request.clientX) ? request.clientX - rect.left : rect.width / 2
    const focusY = Number.isFinite(request.clientY) ? request.clientY - rect.top : rect.height / 2
    const contentX = container.scrollLeft + focusX
    const contentY = container.scrollTop + focusY
    setRouteZoom(request.value)
    nextTick(() => {
      const ratio = routeZoom.value / previousZoom
      container.scrollLeft = Math.max(0, contentX * ratio - focusX)
      container.scrollTop = Math.max(0, contentY * ratio - focusY)
    })
  })
}
const routeMapStyle = (layer) => ({
  width: `${routeMapDimensions(layer).width}px`,
  height: `${routeMapDimensions(layer).height}px`,
  transform: `scale(${routeZoom.value})`
})
const routeMapSpaceStyle = (layer) => {
  const dimensions = routeMapDimensions(layer)
  return {
    width: `${dimensions.width * routeZoom.value}px`,
    height: `${dimensions.height * routeZoom.value}px`
  }
}

const resetRouteViewport = () => {
  const container = routeMapScrollRef.value
  if (!container) return
  container.scrollLeft = 0
  container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
}
const queueRouteViewportReset = () => {
  nextTick(() => requestAnimationFrame(resetRouteViewport))
}

const handleRouteWheel = (event) => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const nextZoom = clampRouteZoom(routeZoom.value + (event.deltaY < 0 ? 0.1 : -0.1))
  if (nextZoom === routeZoom.value) return
  zoomRouteAt(nextZoom, event.clientX, event.clientY)
}
const zoomRouteBy = (amount) => {
  const container = routeMapScrollRef.value
  const rect = container?.getBoundingClientRect()
  zoomRouteAt(
    routeZoom.value + amount,
    rect ? rect.left + rect.width / 2 : undefined,
    rect ? rect.top + rect.height / 2 : undefined
  )
}
const resetRouteMap = () => {
  routeZoom.value = DEFAULT_ROUTE_ZOOM
  queueRouteViewportReset()
}
const handleRouteDoubleClick = (event) => {
  if (event.target?.closest?.('.route-node, .route-node-expand, .route-map-toolbar')) return
  event.preventDefault()
  zoomRouteAt(routeZoom.value + 0.2, event.clientX, event.clientY)
}
const touchDistance = (touches) => {
  if (!touches || touches.length < 2) return 0
  const [first, second] = touches
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}
const touchMidpoint = (touches) => {
  const [first, second] = touches
  return { x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2 }
}
const stopRouteTouchMomentum = () => {
  if (routeTouchMomentumFrame) cancelAnimationFrame(routeTouchMomentumFrame)
  routeTouchMomentumFrame = 0
}
const startRouteTouchMomentum = (state) => {
  let velocityX = Number(state?.velocityX || 0)
  let velocityY = Number(state?.velocityY || 0)
  const container = state?.container
  if (!container || Math.max(Math.abs(velocityX), Math.abs(velocityY)) < 0.35) return
  const step = () => {
    velocityX *= 0.9
    velocityY *= 0.9
    const previousLeft = container.scrollLeft
    const previousTop = container.scrollTop
    container.scrollLeft += velocityX
    container.scrollTop += velocityY
    if (container.scrollLeft === previousLeft) velocityX = 0
    if (container.scrollTop === previousTop) velocityY = 0
    if (Math.max(Math.abs(velocityX), Math.abs(velocityY)) >= 0.35) routeTouchMomentumFrame = requestAnimationFrame(step)
    else routeTouchMomentumFrame = 0
  }
  routeTouchMomentumFrame = requestAnimationFrame(step)
}
const handleRouteTouchStart = (event) => {
  const container = routeMapScrollRef.value
  if (!container) return
  stopRouteTouchMomentum()
  if (event.touches.length === 1) {
    const touch = event.touches[0]
    routeTouchGesture = null
    routeTouchPan = {
      container,
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      velocityX: 0,
      velocityY: 0
    }
    return
  }
  if (event.touches.length !== 2) return
  const midpoint = touchMidpoint(event.touches)
  routeTouchPan = null
  routeTouchGesture = {
    distance: touchDistance(event.touches),
    zoom: routeZoom.value,
    midpoint,
    left: container.scrollLeft,
    top: container.scrollTop
  }
}
const handleRouteTouchMove = (event) => {
  if (event.touches.length === 1 && routeTouchPan?.container) {
    event.preventDefault()
    const touch = event.touches[0]
    const now = performance.now()
    const deltaX = routeTouchPan.x - touch.clientX
    const deltaY = routeTouchPan.y - touch.clientY
    const elapsed = Math.max(1, now - routeTouchPan.time)
    routeTouchPan.container.scrollLeft += deltaX
    routeTouchPan.container.scrollTop += deltaY
    routeTouchPan.velocityX = deltaX / elapsed * 16
    routeTouchPan.velocityY = deltaY / elapsed * 16
    routeTouchPan.x = touch.clientX
    routeTouchPan.y = touch.clientY
    routeTouchPan.time = now
    return
  }
  if (event.touches.length !== 2 || !routeTouchGesture?.distance) return
  event.preventDefault()
  routeTouchRequest = {
    start: routeTouchGesture,
    midpoint: touchMidpoint(event.touches),
    zoom: routeTouchGesture.zoom * (touchDistance(event.touches) / routeTouchGesture.distance)
  }
  if (routeTouchFrame) return
  routeTouchFrame = requestAnimationFrame(() => {
    routeTouchFrame = 0
    const request = routeTouchRequest
    routeTouchRequest = null
    const container = routeMapScrollRef.value
    if (!request || !container) return
    setRouteZoom(request.zoom)
    nextTick(() => {
      const rect = container.getBoundingClientRect()
      const ratio = routeZoom.value / request.start.zoom
      const startX = request.start.midpoint.x - rect.left
      const startY = request.start.midpoint.y - rect.top
      const currentX = request.midpoint.x - rect.left
      const currentY = request.midpoint.y - rect.top
      container.scrollLeft = Math.max(0, (request.start.left + startX) * ratio - currentX)
      container.scrollTop = Math.max(0, (request.start.top + startY) * ratio - currentY)
    })
  })
}
const handleRouteTouchEnd = (event) => {
  if (event.touches?.length >= 2) return
  if (event.touches?.length === 1) {
    const touch = event.touches[0]
    const container = routeMapScrollRef.value
    routeTouchGesture = null
    routeTouchPan = container ? {
      container,
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      velocityX: 0,
      velocityY: 0
    } : null
    return
  }
  const touchPan = routeTouchPan
  routeTouchPan = null
  routeTouchGesture = null
  startRouteTouchMomentum(touchPan)
}
const handleRoutePointerDown = (event) => {
  if (event.pointerType === 'touch' || event.button !== 0 || !routeMapScrollRef.value || event.target?.closest?.('.route-node, .route-node-expand')) return
  const container = routeMapScrollRef.value
  routePointerDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: container.scrollLeft, top: container.scrollTop }
  container.setPointerCapture?.(event.pointerId)
}
const handleRoutePointerMove = (event) => {
  if (!routePointerDrag || event.pointerId !== routePointerDrag.pointerId) return
  const container = routeMapScrollRef.value
  if (!container) return
  container.scrollLeft = routePointerDrag.left - (event.clientX - routePointerDrag.x)
  container.scrollTop = routePointerDrag.top - (event.clientY - routePointerDrag.y)
}
const handleRoutePointerUp = (event) => {
  if (routePointerDrag?.pointerId === event.pointerId) routePointerDrag = null
}

const routeVariantPriority = (variant) => {
  const text = `${variant?.kind || ''} ${variant?.name || ''}`
  if (/宝箱|箱子/.test(text)) return 60
  if (/白兔|白商人|白商/.test(text)) return 50
  if (/黑商|黑兔|黑商人/.test(text)) return 40
  if (/蛋|孵化/.test(text)) return 30
  if (/采集|矿|草|花|蘑菇|水晶|硫磺|冰莲/.test(text)) return 20
  return 10
}
const routePrimaryVariant = (node) => [...(node?.variantOptions || [])]
  .sort((a, b) => routeVariantPriority(b) - routeVariantPriority(a) || String(a.typeId).localeCompare(String(b.typeId)))[0]
const isRouteNodeExpanded = (node) => expandedRouteNodes.value.has(node?.id)
const toggleRouteNodeExpanded = (nodeId) => {
  if (!nodeId) return
  const next = new Set(expandedRouteNodes.value)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  expandedRouteNodes.value = next
}
const visibleRouteVariants = (node) => isRouteNodeExpanded(node) ? node.variantOptions : [routePrimaryVariant(node)].filter(Boolean)

const orientRouteLayer = (layer) => {
  if (!layer?.nodes?.length) return layer

  // Preserve the game's original graph geometry. Normalize and flip the
  // source canvas so the entrance is lower-left and the exit is upper-right;
  // every edge remains a single straight segment between its real endpoints.
  const sourceNodes = layer.nodes.map(node => ({ ...node, sourceX: Number(node.x || 0), sourceY: Number(node.y || 0) }))
  const start = sourceNodes.find(node => node.id === layer.startRoomId) || sourceNodes[0]
  const end = sourceNodes.find(node => node.id === layer.endRoom) || sourceNodes[sourceNodes.length - 1]
  const sourceSpanX = Number(end.sourceX - start.sourceX) || 1
  const sourceSpanY = Number(end.sourceY - start.sourceY) || 1
  const innerWidth = 1100
  const innerHeight = 680
  const project = node => {
    // Keep branches outside the entrance/exit span instead of flattening them.
    const progressX = (node.sourceX - start.sourceX) / sourceSpanX
    const progressY = (node.sourceY - start.sourceY) / sourceSpanY
    return {
      x: progressX * innerWidth,
      y: (1 - progressY) * innerHeight,
      gridCol: Math.round(progressX * 12),
      gridRow: Math.round((1 - progressY) * 12)
    }
  }
  const rawNodes = sourceNodes.map(node => ({ ...node, ...project(node) }))
  const minX = Math.min(...rawNodes.map(node => node.x))
  const maxX = Math.max(...rawNodes.map(node => node.x))
  const minY = Math.min(...rawNodes.map(node => node.y))
  const maxY = Math.max(...rawNodes.map(node => node.y))
  const paddingX = 150
  const paddingY = 110
  const width = Math.max(900, Math.ceil(maxX - minX + paddingX * 2))
  const height = Math.max(560, Math.ceil(maxY - minY + paddingY * 2))
  const nodes = rawNodes.map(node => ({
    ...node,
    x: Math.round(node.x - minX + paddingX),
    y: Math.round(node.y - minY + paddingY)
  }))
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const links = (layer.links || []).flatMap(link => {
    const from = nodeMap.get(link.rooms?.[0])
    const to = nodeMap.get(link.rooms?.[1])
    if (!from || !to) return []
    return [{ ...link, x1: from.x, y1: from.y, x2: to.x, y2: to.y, points: `${from.x},${from.y} ${to.x},${to.y}` }]
  })
  return { ...layer, size: { w: width, h: height }, nodes, links }
}

const routeNodeStyle = (node, layer) => ({
  left: `${(Number(node.x || 0) / Math.max(1, Number(layer?.size?.w || 1600))) * 100}%`,
  top: `${(Number(node.y || 0) / Math.max(1, Number(layer?.size?.h || 1000))) * 100}%`
})

const routeIconPath = (node) => {
  const icon = Number(node?.icon || 0)
  return icon > 0 ? getImageUrl(`/instancepanel/MapPanelAtlas/map_r_fb_${String(icon).padStart(2, '0')}.png`) : ''
}

const routeChance = (layer) => {
  const layers = selectedBattle.value?.routes || []
  const total = layers.reduce((sum, item) => sum + Number(item.chance || 0), 0)
  if (layers.length === 1) return '固定布局'
  return total > 0 && Number(layer?.chance || 0) > 0 ? `约 ${(Number(layer.chance) / total * 100).toFixed(0)}%` : '未配置权重'
}
const routeLabel = (index) => ['路线一', '路线二', '路线三'][index] || `路线${index + 1}`
const candidateLabel = (option) => selectedRouteRoom.value?.variants?.find(variant => variant.typeId === option?.typeId)?.name || '未命名候选'
const routeIconGlyph = (node) => node?.id === selectedRouteLayer.value?.startRoomId ? '起' : node?.id === selectedRouteLayer.value?.endRoom ? '终' : '?'
const routeNodeLabel = (node, variant) => `${variant?.name || node?.label || '房间'}${node?.candidates ? `，${node.candidates + 1} 个候选` : ''}`
const routeNodeClass = (node, variantId) => ({
  'route-node--start': node?.id === selectedRouteLayer.value?.startRoomId,
  'route-node--end': node?.id === selectedRouteLayer.value?.endRoom,
  'route-node--selected': node?.id === selectedRouteRoomId.value && variantId === selectedRouteVariantId.value,
  'route-node--random': node?.candidates > 0
})
const isRouteLinkActive = (link) => link?.rooms?.includes(selectedRouteRoomId.value)
const routeRoomTone = (room) => room?.kind?.includes('宝箱') ? 'gold' : room?.kind === 'BOSS' ? 'danger' : room?.kind === '事件' ? 'accent' : 'default'

watch([mapFilter, searchQuery], () => {
  const query = {}
  if (mapFilter.value !== 'all') query.map = mapFilter.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  if (route.query.battle) query.battle = route.query.battle
  router.replace({ query })
})

watch(() => route.query.battle, (battleId) => {
  if (!isReady.value) return
  if (!battleId) {
    if (detailVisible.value) closeBattle()
    return
  }
  const match = findBattle(battleId)
  if (match && selectedBattle.value?.id !== battleId) openBattle(match.dungeon, match.battle, false)
})
</script>

<style scoped>
.dungeon-filter { margin: 0 0 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.dungeon-filter :deep(.ui-segmented) { width: 100%; }
.dungeon-filter :deep(.ui-segmented__item) { flex: 1; }
.dungeon-count { color: var(--text-muted); font-size: 13px; font-weight: 600; }
.dungeon-scroll { flex: 1; overflow-y: auto; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; grid-auto-rows: max-content; gap: 14px; padding-bottom: 14px; }
.dungeon-card { overflow: visible; min-width: 0; align-self: start; }
.dungeon-card__cover { min-height: 156px; position: relative; background: linear-gradient(135deg, var(--wood-soft), var(--wood)); background-size: cover; background-position: center; color: var(--paper); padding: 16px; display: flex; flex-direction: column; justify-content: flex-end; }
.dungeon-card__cover-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(28, 18, 10, .16), rgba(28, 18, 10, .88)); }
.dungeon-card__heading, .dungeon-card__description { position: relative; z-index: 1; }
.dungeon-card__heading { display: flex; align-items: center; }
.dungeon-card__heading h2 { margin: 0; font-size: 18px; letter-spacing: 1px; }
.dungeon-card__heading p { margin: 4px 0 0; font-size: 12px; color: rgba(255, 245, 225, .82); }
.dungeon-card__description { margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: rgba(255, 245, 225, .86); }
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
.special-drop-card { min-width: 0; border: 1px solid var(--border-soft); border-left: 3px solid var(--accent); border-radius: 5px; background: var(--paper-soft); padding: 9px 10px; }
.special-drop-card__heading, .special-drop-source__heading { display: flex; align-items: center; gap: 7px; min-width: 0; }
.special-drop-card__heading > strong { flex: 1; min-width: 0; color: var(--text-main); font-size: 13px; }
.special-drop-sources { display: flex; flex-direction: column; gap: 9px; margin-top: 7px; }
.special-drop-source { min-width: 0; border-top: 1px dashed var(--border-soft); padding-top: 7px; }
.special-drop-source__heading { justify-content: space-between; color: var(--text-main); font-size: 12px; }
.special-drop-source__heading small { color: var(--text-muted); font-size: 11px; font-weight: 600; }
.special-drop-card__empty { margin: 7px 0 0; color: var(--text-muted); font-size: 12px; }
.route-layout-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 1px 0 8px; }
.route-layout-tab { flex: 0 0 auto; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-muted); padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; }
.route-layout-tab small { display: block; margin-top: 2px; color: var(--text-sub); font-size: 10px; font-weight: 600; }
.route-layout-tab--active { border-color: var(--accent); background: var(--hover-bg); color: var(--text-main); }
.route-map-shell { position: relative; }
.route-map-toolbar { position: absolute; z-index: 5; top: 10px; left: 10px; display: grid; grid-template-columns: 30px 46px 30px 30px; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-solid); box-shadow: 0 2px 8px rgba(0, 0, 0, .22); }
.route-map-toolbar button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border-soft); border-radius: 4px; background: var(--paper-soft); color: var(--text-main); padding: 0; font-size: 17px; font-weight: 800; line-height: 1; cursor: pointer; }
.route-map-toolbar button:hover:not(:disabled) { border-color: var(--accent); background: var(--hover-bg); }
.route-map-toolbar button:disabled { opacity: .38; cursor: default; }
.route-map-toolbar output { color: var(--text-main); font-size: 11px; font-weight: 800; text-align: center; }
.route-map-scroll { position: relative; width: 100%; height: clamp(360px, 54vh, 620px); overflow: hidden; padding: 2px 0 8px; touch-action: none; overscroll-behavior: auto; cursor: grab; user-select: none; border: 1px solid var(--border-soft); border-radius: 6px; background: var(--paper-dark); }
.route-map-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.route-map-scroll::-webkit-scrollbar { display: none; }
.route-map-scroll:active { cursor: grabbing; }
.route-map-space { position: relative; min-width: 100%; min-height: 100%; }
.route-map { position: absolute; left: 0; top: 0; transform-origin: top left; overflow: visible; border: 0; border-radius: 0; background-color: transparent; box-shadow: none; }
.route-map__links { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.route-map__link { fill: none; stroke: rgba(220, 196, 147, .42); stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.route-map__link--active { stroke: var(--accent); stroke-width: 12; }
.route-node-group { position: absolute; z-index: 1; transform: translate(-50%, -50%); display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; max-width: 190px; }
.route-node-expand { position: absolute; z-index: 3; top: -18px; left: 50%; width: 20px; height: 20px; transform: translateX(-50%); display: grid; place-items: center; border: 1px solid rgba(84, 62, 34, .45); border-radius: 50%; background: var(--paper-soft); color: var(--text-main); font-size: 14px; font-weight: 800; line-height: 1; padding: 0; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,.25); }
.route-node-expand:hover { border-color: var(--accent); color: var(--accent-ink); }
.route-node { position: relative; width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border: 2px solid rgba(246, 227, 185, .76); border-radius: 50%; background: var(--paper-soft); color: var(--text-main); padding: 0; cursor: pointer; box-shadow: 0 2px 7px rgba(0,0,0,.35); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.route-node:hover, .route-node--selected { transform: scale(1.12); border-color: var(--accent); box-shadow: 0 0 0 3px rgba(85,117,116,.26), 0 3px 10px rgba(0,0,0,.38); }
.route-node img { width: 36px; height: 36px; object-fit: contain; pointer-events: none; }
.route-node span { font-size: 12px; font-weight: 800; }
.route-node__fallback { width: 10px; height: 10px; border: 2px solid var(--accent); border-radius: 50%; background: var(--paper-solid); }
.route-node--start { border-color: #65bb8c; }
.route-node--end { border-color: var(--rarity-legend); }
.route-node--random { background: var(--paper-solid); }
.route-node__random { position: absolute; right: -5px; top: -7px; display: grid; place-items: center; width: 14px; height: 14px; border: 1px solid var(--paper-solid); border-radius: 50%; background: var(--accent); color: #fff; font-size: 10px; font-style: normal; line-height: 1; }
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
@media (max-width: 760px) {
  .dungeon-scroll { display: flex; flex-direction: column; gap: 10px; }
  .dungeon-card { width: 100%; align-self: stretch; }
  .dungeon-card__cover { min-height: 140px; }
}
@media (max-width: 440px) {
  .reward-grid { grid-template-columns: 1fr; }
  .room-reward-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dungeon-card__heading h2 { font-size: 16px; }
  .route-map-scroll { height: clamp(320px, 48vh, 440px); }
  .route-room-detail__grid { grid-template-columns: 1fr; }
}
</style>
