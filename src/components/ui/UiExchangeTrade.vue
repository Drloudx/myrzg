<template>
  <article class="ui-exchange-trade" :class="{ 'is-pack': packImage }">
    <div v-if="packImage" class="ui-exchange-trade__pack-visual">
      <img :src="packImage" :alt="title" @error="hidePackImage" />
    </div>

    <header class="ui-exchange-trade__header">
      <h3 class="ui-exchange-trade__title">{{ title }}</h3>
      <span v-if="limitText" class="ui-exchange-trade__limit">{{ limitText }}</span>
    </header>

    <div class="ui-exchange-trade__reward-stage">
      <div class="ui-exchange-trade__items ui-exchange-trade__items--reward">
        <button
          v-for="(item, index) in rewardItems"
          :key="`reward-${item.typeId || index}`"
          type="button"
          class="ui-exchange-trade__item ui-exchange-trade__item--reward"
          :title="`${item.name || '物品'} ×${item.num ?? 1}`"
          @click="emit('item-click', item.typeId)"
        >
          <img :src="imageSrc(item.icon)" :alt="item.name || '物品'" @error="handleItemError" />
          <span class="ui-exchange-trade__item-count">×{{ item.num ?? 1 }}</span>
        </button>
        <span v-if="!rewardItems.length" class="ui-exchange-trade__empty">暂无</span>
      </div>
    </div>

    <footer class="ui-exchange-trade__consume-footer">
      <span class="ui-exchange-trade__label">消耗</span>
      <div class="ui-exchange-trade__items ui-exchange-trade__items--consume">
        <button
          v-for="(item, index) in consumeItems"
          :key="`consume-${item.typeId || index}`"
          type="button"
          class="ui-exchange-trade__item ui-exchange-trade__item--consume"
          :title="`${item.name || '物品'} ×${item.num ?? 1}`"
          @click="emit('item-click', item.typeId)"
        >
          <img :src="imageSrc(item.icon)" :alt="item.name || '物品'" @error="handleItemError" />
          <span class="ui-exchange-trade__item-count">×{{ item.num ?? 1 }}</span>
        </button>
        <span v-if="!consumeItems.length" class="ui-exchange-trade__empty">无需消耗</span>
      </div>
    </footer>
  </article>
</template>

<script setup>
import { getImageUrl } from '../../utils/env.js'

defineProps({
  title: { type: String, default: '兑换物品' },
  rewardItems: { type: Array, default: () => [] },
  consumeItems: { type: Array, default: () => [] },
  limitText: { type: String, default: '' },
  packImage: { type: String, default: '' }
})

const emit = defineEmits(['item-click'])

const imageSrc = (path) => getImageUrl(path)

const handleItemError = (event) => {
  event.target.style.opacity = '0.25'
}

const hidePackImage = (event) => {
  event.target.closest('.ui-exchange-trade__pack-visual')?.classList.add('is-missing')
}
</script>

<style scoped>
.ui-exchange-trade {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  height: 100%;
  min-width: 0;
  min-height: 224px;
  padding: 11px 12px 10px;
  box-sizing: border-box;
  background: var(--paper-soft);
  border: 1px solid var(--border-faint);
  border-bottom-color: var(--border-soft);
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(43, 31, 21, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}
.ui-exchange-trade.is-pack {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  grid-template-rows: auto minmax(76px, 1fr) auto;
  column-gap: 11px;
  row-gap: 7px;
  align-items: stretch;
  min-height: 188px;
}
.ui-exchange-trade:hover {
  border-color: var(--accent-bright);
  box-shadow: 0 4px 10px rgba(43, 31, 21, 0.2);
  transform: translateY(-1px);
}
.ui-exchange-trade__pack-visual {
  width: 100%;
  min-width: 0;
  height: 60px;
  padding: 0 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-bottom: 1px solid var(--border-faint);
}
.ui-exchange-trade.is-pack .ui-exchange-trade__pack-visual {
  grid-column: 1;
  grid-row: 1 / -1;
  width: 92px;
  height: 100%;
  min-height: 156px;
  padding: 6px 8px 6px 0;
  border-right: 1px solid var(--border-faint);
  border-bottom: 0;
}
.ui-exchange-trade__pack-visual img {
  display: block;
  width: 100%;
  height: 54px;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(43, 31, 21, 0.24));
}
.ui-exchange-trade.is-pack .ui-exchange-trade__pack-visual img {
  width: 82px;
  height: 100%;
  max-height: 190px;
}
.ui-exchange-trade__pack-visual.is-missing { display: none; }
.ui-exchange-trade__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  padding-bottom: 8px;
}
.ui-exchange-trade.is-pack .ui-exchange-trade__header,
.ui-exchange-trade.is-pack .ui-exchange-trade__reward-stage,
.ui-exchange-trade.is-pack .ui-exchange-trade__consume-footer {
  grid-column: 2;
}
.ui-exchange-trade.is-pack .ui-exchange-trade__header {
  grid-row: 1;
}
.ui-exchange-trade__title {
  display: -webkit-box;
  min-width: 0;
  flex: 1;
  min-height: 2.7em;
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}
.ui-exchange-trade__limit {
  flex: 0 0 auto;
  max-width: 84px;
  padding: 3px 6px;
  color: var(--accent-ink);
  background: var(--hover-bg);
  border: 1px solid var(--accent-bright);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}
.ui-exchange-trade__reward-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88px;
  padding: 9px 0;
  background: rgba(255, 255, 255, 0.08);
  border-top: 1px solid var(--border-faint);
  border-bottom: 1px solid var(--border-faint);
}
.ui-exchange-trade.is-pack .ui-exchange-trade__reward-stage {
  grid-row: 2;
  min-height: 76px;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 7px 0;
}
.ui-exchange-trade__consume-footer {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-width: 0;
  padding-top: 8px;
}
.ui-exchange-trade.is-pack .ui-exchange-trade__consume-footer {
  grid-row: 3;
  padding-top: 6px;
  border-top: 1px solid var(--border-faint);
}
.ui-exchange-trade__label {
  flex: 0 0 30px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
  text-align: left;
}
.ui-exchange-trade__items {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.ui-exchange-trade__items--reward {
  justify-content: center;
  flex-wrap: wrap;
}
.ui-exchange-trade__items--consume {
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  overflow: visible;
}
.ui-exchange-trade__item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-width: 0;
  max-width: 100%;
  padding: 3px 6px 3px 3px;
  color: var(--text-main);
  background: var(--paper);
  border: 1px solid var(--border-faint);
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}
.ui-exchange-trade__item:hover,
.ui-exchange-trade__item:focus-visible {
  border-color: var(--accent-bright);
  background: var(--hover-bg);
  outline: none;
}
.ui-exchange-trade__item img {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  object-fit: contain;
}
.ui-exchange-trade__item--reward {
  position: relative;
  width: 108px;
  min-height: 68px;
  justify-content: center;
  padding: 4px;
  background: var(--paper-solid);
}
.ui-exchange-trade__item--reward img {
  width: 48px;
  height: 48px;
  flex-basis: 48px;
}
.ui-exchange-trade__item--reward .ui-exchange-trade__item-count {
  position: absolute;
  right: 5px;
  bottom: 4px;
  padding: 2px 4px;
  border: 1px solid var(--border-faint);
  border-radius: 999px;
  background: var(--paper);
  font-size: 12px;
}
.ui-exchange-trade__item--consume {
  min-width: 64px;
  justify-content: center;
  padding: 3px 6px 3px 4px;
}
.ui-exchange-trade__item--consume img {
  width: 24px;
  height: 24px;
  flex-basis: 24px;
}
.ui-exchange-trade__item-count {
  flex: 0 0 auto;
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.ui-exchange-trade__empty {
  color: var(--text-faint);
  font-size: 13px;
  font-style: italic;
}
@media (max-width: 640px) {
  .ui-exchange-trade {
    min-height: 208px;
    padding: 9px;
  }
  .ui-exchange-trade__title { font-size: 14px; }
  .ui-exchange-trade__limit { max-width: 72px; }
  .ui-exchange-trade.is-pack {
    grid-template-columns: 78px minmax(0, 1fr);
    column-gap: 9px;
  }
  .ui-exchange-trade.is-pack .ui-exchange-trade__pack-visual {
    width: 78px;
    padding-right: 6px;
  }
  .ui-exchange-trade.is-pack .ui-exchange-trade__pack-visual img {
    width: 70px;
  }
  .ui-exchange-trade.is-pack .ui-exchange-trade__item--reward {
    width: 84px;
    min-height: 54px;
    padding: 3px;
  }
  .ui-exchange-trade.is-pack .ui-exchange-trade__item--reward img {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
  }
}
</style>
