<!--
  房间内容与掉落（副本图鉴 / 关卡图鉴共用）。

  消费构建期产物里同构的 `rooms` 数组：房间 → 候选变体 → 效果 / 怪物波次 / 采集物 / 怪物自动掉落。
  两个页面的数据结构、波次文案、奖励池分组和可点击判断完全一致，因此渲染与样式只在这里维护一份；
  页面负责章节/关卡归属和打开全局物品详情。
  `data-source-entry` 保留在元素上，供来源直达按 `dropEntry` 定位。
-->
<template>
  <div class="room-list">
    <article v-for="room in rooms" :key="`${room.layer}-${room.roomId}`" class="room-card">
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
            <div
              v-for="collection in sortedCollections(variant.collections)"
              :key="`${variant.typeId}-${collection.collectTypeId}`"
              :data-source-entry="`${variant.typeId}:${collection.collectTypeId}`"
              class="room-collection"
            >
              <div class="room-collection__heading">
                <span>{{ collection.name }}<template v-if="collection.count > 1"> ×{{ collection.count }}</template></span>
                <small v-if="collection.consume">{{ collectConsumeText(collection) }}</small>
              </div>
              <RewardPools v-if="collection.reward.length" dense :entries="collection.reward" @item-click="emit('item-click', $event)" />
              <p v-else class="room-variant__line">已配置交互，奖励表未提供可展示条目</p>
            </div>
            <div v-for="monster in variant.monsters" :key="`${variant.typeId}-${monster.typeId}-drop`">
              <div
                v-for="drop in monster.drops"
                :key="`${monster.typeId}-${drop.collectTypeId}`"
                :data-source-entry="`${variant.typeId}:${monster.typeId}:${drop.collectTypeId}`"
                class="room-collection room-collection--monster"
              >
                <div class="room-collection__heading"><span>{{ monster.name }} 自动掉落</span><small v-if="drop.dropRate">{{ (drop.dropRate * 100).toFixed(0) }}%</small></div>
                <RewardPools v-if="drop.reward.length" dense :entries="drop.reward" @item-click="emit('item-click', $event)" />
              </div>
            </div>
          </div>
        </template>
      </div>
    </article>
  </div>
</template>

<script setup>
import { UiTag } from './ui/index.js'
import RewardPools from './RewardPools.vue'
import {
  collectConsumeText,
  monsterWaveLines,
  sortedCollections
} from '../utils/roomDisplay.js'

defineProps({
  rooms: { type: Array, default: () => [] }
})
const emit = defineEmits(['item-click'])
</script>

<style scoped>
.room-list { display: flex; flex-direction: column; gap: 8px; overflow: visible; padding-right: 0; }
.room-card { border: 1px solid var(--border-soft); border-radius: 5px; background: var(--paper-soft); padding: 9px 10px; }
.room-card__heading, .room-variant__title, .room-collection__heading { display: flex; align-items: center; gap: 7px; min-width: 0; }
.room-card__heading { color: var(--text-main); font-size: 13px; }
.room-card__heading--meta-only { justify-content: flex-end; }
.room-card__variants { display: flex; flex-direction: column; gap: 7px; margin-top: 7px; }
.room-variant { border-left: 3px solid var(--accent); padding: 6px 0 6px 9px; min-width: 0; }
.room-variant__title { font-size: 12px; font-weight: 700; color: var(--text-main); }
.room-variant__title span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.room-variant__line { margin: 4px 0 0; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.room-effects { display: grid; gap: 6px; margin-top: 7px; }
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
</style>
