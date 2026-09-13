<template>
  <article class="ui-exchange-trade" :class="{ 'is-pack': packImage, 'is-skin': skin, 'is-shop': shop, 'is-compact': compact, 'has-details': compact && (metaText || consumeItems.length > 1 || rewardItems.length > 1) }"
    :style="cardStyle">
    <div v-if="packImage" class="ui-exchange-trade__pack-visual">
      <img :src="packImage" :alt="title" @error="hidePackImage" />
    </div>

    <header class="ui-exchange-trade__header">
      <h3 class="ui-exchange-trade__title" :title="skin ? skin.heroName : cardTitle">{{ skin ? skin.heroName : cardTitle }}</h3>
      <span v-if="limitText && !skin" class="ui-exchange-trade__limit"
        :style="shop ? { backgroundImage: `url('${imageSrc('/PackPane/shop_tag_quota.png')}')` } : null">{{ limitText }}</span>
    </header>

    <button v-if="skin" type="button" class="ui-exchange-trade__skin-visual"
      :aria-label="`查看${skin.heroName}时装：${skin.name}`"
      @click="emit('item-click', rewardItems[0]?.typeId)">
      <img :src="imageSrc(skin.image) || '/ui/visibility-off.svg'" :alt="skin.name"
        width="240" height="432" loading="lazy" decoding="async" @error="handleImageFallback" />
      <span class="ui-exchange-trade__skin-name" :style="{ color: `var(--q${skin.quality || 1})` }">{{ skin.name }}</span>
    </button>

    <p v-if="metaText" class="ui-exchange-trade__meta">{{ metaText }}</p>

    <div class="ui-exchange-trade__reward-stage">
      <div class="ui-exchange-trade__items ui-exchange-trade__items--reward">
        <button
          v-for="(item, index) in rewardItems"
          :key="`reward-${item.typeId || index}`"
          type="button"
          class="ui-exchange-trade__item ui-exchange-trade__item--reward"
          :style="skin ? { backgroundImage: `url('${imageSrc(`/ItemBagPanel/item_f_${item.quality || 1}.png`)}')` } : null"
          :title="`${item.name || '物品'} ×${item.num ?? 1}`"
          @click="emit('item-click', item.typeId)"
        >
          <img :src="imageSrc(item.icon)" :alt="item.name || '物品'"
            :style="compact ? { '--exchange-icon-scale': compactIconScale(item.icon) } : null"
            @error="handleItemError" />
          <span v-if="!shop && !compact" class="ui-exchange-trade__item-count">{{ skin ? (item.num ?? 1) : `×${item.num ?? 1}` }}</span>
        </button>
        <span v-if="!rewardItems.length" class="ui-exchange-trade__empty">暂无</span>
      </div>
    </div>

    <footer class="ui-exchange-trade__consume-footer">
      <span v-if="!skin && !shop && !compact" class="ui-exchange-trade__label">消耗</span>
      <div class="ui-exchange-trade__items ui-exchange-trade__items--consume">
        <button
          v-for="(item, index) in consumeItems"
          :key="`consume-${item.typeId || index}`"
          type="button"
          class="ui-exchange-trade__item ui-exchange-trade__item--consume"
          :style="skin ? { '--skin-price-image': `url('${imageSrc('/PackPane/shop_vip_time.png')}')` } : null"
          :title="`${item.name || '物品'} ×${item.num ?? 1}`"
          @click="emit('item-click', item.typeId)"
        >
          <img :src="imageSrc(item.icon)" :alt="item.name || '物品'" @error="handleItemError" />
          <span class="ui-exchange-trade__item-count">{{ skin || shop || compact ? (item.num ?? 1) : `×${item.num ?? 1}` }}</span>
        </button>
        <span v-if="!consumeItems.length" class="ui-exchange-trade__empty">无需消耗</span>
      </div>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { getImageUrl, handleImageFallback } from '../../utils/env.js'

const props = defineProps({
  title: { type: String, default: '兑换物品' },
  rewardItems: { type: Array, default: () => [] },
  consumeItems: { type: Array, default: () => [] },
  limitText: { type: String, default: '' },
  metaText: { type: String, default: '' },
  packImage: { type: String, default: '' },
  skin: { type: Object, default: null },
  shop: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['item-click'])

const imageSrc = (path) => getImageUrl(path)

// 原图 alpha > 24 的可见包围盒测量：目标占原画布 84%，缩放限制在 0.9~1.14。
// 大部分图标接近满幅，统一留出 10%；这里只记录透明留白较多的例外，不改动原图。
const compactIconScaleOverrides = {
  item_20004: 0.97, item_10045: 1.06, item_27008: 0.92, item_27003: 0.99,
  item_27009: 0.92, item_20016: 0.92, item_10047: 1.14, item_10108: 1.14,
  item_10110: 0.92, item_10114: 0.92, item_10116: 1.1, item_10043: 0.92,
  item_10044: 0.92, item_10046: 0.92, item_10048: 0.95, item_10104: 0.92,
  item_10113: 1.14, item_10115: 1.14, item_30014: 0.93, item_30004: 0.98,
  item_30013: 0.94, item_30016: 0.95, item_31004: 1.02, item_31007: 0.97,
  item_31010: 0.93, item_30015: 0.97, item_31002: 1.01, item_31003: 1.04,
  item_31008: 0.99, item_30001: 1.14, item_31001: 1.05, item_20027: 0.97,
  item_00002: 0.92, item_00008: 0.97, item_19207: 1, item_27004: 1
}
const compactIconScale = icon => compactIconScaleOverrides[icon?.split('/').pop()?.replace(/\.png$/, '')] ?? 0.9

const cardTitle = computed(() => {
  if (!props.compact || !props.rewardItems.length) return props.title
  if (props.rewardItems.length > 1) {
    return props.rewardItems.map(item => `${item.name || '物品'}×${item.num ?? 1}`).join('、')
  }
  const suffix = `×${props.rewardItems[0].num ?? 1}`
  return props.title.endsWith(suffix) ? props.title : `${props.title}${suffix}`
})

const cardStyle = computed(() => {
  if (props.skin) return { borderImageSource: `url('${imageSrc('/PackPane/shop_list_skin.png')}')` }
  if (!props.shop) return null
  const quality = Math.min(5, Math.max(1, Number(props.rewardItems[0]?.quality) || 1))
  return {
    borderImageSource: `url('${imageSrc('/PackPane/shop_list_pack.png')}')`,
    '--shop-quality-image': `url('${imageSrc(`/Shop/item_info_f_${quality}.png`)}')`
  }
})

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
  grid-template-rows: auto auto minmax(76px, 1fr) auto;
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
.ui-exchange-trade.is-pack .ui-exchange-trade__meta,
.ui-exchange-trade.is-pack .ui-exchange-trade__reward-stage,
.ui-exchange-trade.is-pack .ui-exchange-trade__consume-footer {
  grid-column: 2;
}
.ui-exchange-trade.is-pack .ui-exchange-trade__header {
  grid-row: 1;
}
.ui-exchange-trade__meta {
  min-height: 2.8em;
  margin: -2px 0 7px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
}
.ui-exchange-trade.is-pack .ui-exchange-trade__meta {
  grid-row: 2;
  min-height: 0;
  margin: -4px 0 0;
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
  grid-row: 3;
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
  grid-row: 4;
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

/* 两类商品共用尺寸、内边距占位与图标容器，背景仅由各自变体决定。 */
.ui-exchange-trade:is(.is-compact, .is-shop) {
  display: grid;
  grid-template-rows: 42px auto minmax(0, 1fr) minmax(30px, max-content);
  height: auto;
  min-height: 0;
  aspect-ratio: 3 / 4;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__header {
  grid-row: 1;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  padding: 0;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__title {
  display: block;
  flex: 0 0 auto;
  min-height: 0;
  padding: 0 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 22px;
  text-align: center;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__reward-stage {
  grid-row: 3;
  min-height: 0;
  padding: 2px 8px 8px;
  background: transparent;
  border: 0;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__items--reward {
  height: 100%;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--reward {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--reward img {
  position: absolute;
  width: 100%;
  height: 100%;
  max-width: 116px;
  max-height: 116px;
  object-fit: contain;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__consume-footer {
  grid-row: 4;
  min-height: 0;
  padding: 0;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__items--consume {
  justify-content: center;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--consume {
  min-width: 0;
  padding: 0;
  gap: 3px;
  border: 0;
  background: transparent;
}
.ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--consume .ui-exchange-trade__item-count {
  font-size: 19px;
  font-weight: 400;
}
.ui-exchange-trade.is-compact {
  /* 1px 羊皮纸边框 + 5px 留白，与商店的 6px 边框占位相同。 */
  padding: 5px;
  grid-template-rows: 42px auto minmax(0, 1fr) minmax(24px, max-content);
}
.ui-exchange-trade.is-compact .ui-exchange-trade__header { gap: 4px; }
.ui-exchange-trade.is-compact .ui-exchange-trade__title {
  height: 20px;
  line-height: 20px;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__limit {
  align-self: flex-end;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0 4px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-muted) 4%, transparent);
  border-color: color-mix(in srgb, var(--border-faint) 45%, transparent);
  border-radius: 3px;
  font-size: 11px;
  font-weight: 400;
  line-height: 15px;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__meta {
  grid-row: 2;
  min-height: 0;
  margin: 0 0 4px;
  text-align: center;
  overflow-wrap: anywhere;
}
.ui-exchange-trade.is-compact.has-details {
  /* 有规则说明或多材料时增加实际内容空间，不裁掉数据或挤没图标。 */
  grid-template-rows: 42px max-content minmax(64px, 1fr) minmax(24px, max-content);
}
.ui-exchange-trade.is-compact.has-details .ui-exchange-trade__items--reward {
  flex-wrap: nowrap;
}
.ui-exchange-trade.is-compact.has-details .ui-exchange-trade__item--reward {
  flex: 1 1 0;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__reward-stage {
  padding: 3px 6px 6px;
  box-shadow: inset 0 -1px color-mix(in srgb, var(--border-faint) 50%, transparent);
}
.ui-exchange-trade.is-compact .ui-exchange-trade__item--reward img {
  transform: scale(var(--exchange-icon-scale, 0.9));
}
.ui-exchange-trade.is-compact .ui-exchange-trade__item--consume img {
  width: 20px;
  height: 20px;
  flex-basis: 20px;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__item--consume .ui-exchange-trade__item-count {
  color: var(--text-main);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__item {
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.ui-exchange-trade.is-compact .ui-exchange-trade__item:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: 2px;
}

/* PackCenterTempUI 商品卡：原版纸卡 + 品质渐变 + 大图标 + 底部价格。 */
.ui-exchange-trade.is-shop {
  position: relative;
  isolation: isolate;
  padding: 0;
  border: 6px solid transparent;
  border-image-slice: 60 40 fill;
  border-image-width: 45px 30px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.ui-exchange-trade.is-shop::before {
  content: '';
  position: absolute;
  inset: 26px 0 30px;
  z-index: -1;
  background: var(--shop-quality-image) center / 100% 100% no-repeat;
  pointer-events: none;
}
.ui-exchange-trade.is-shop .ui-exchange-trade__header {
  position: relative;
}
.ui-exchange-trade.is-shop .ui-exchange-trade__title {
  color: var(--wood-soft);
}
.ui-exchange-trade.is-shop .ui-exchange-trade__limit {
  align-self: flex-end;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0 5px 0 22px;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  background-size: 100% 100%;
  color: var(--on-image-text);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}
.ui-exchange-trade.is-shop .ui-exchange-trade__item--consume .ui-exchange-trade__item-count {
  color: var(--on-wood-text);
}
.ui-exchange-trade.is-shop .ui-exchange-trade__item:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: -2px;
}

/* 原版时装商店：纸质姓名栏 → 商店专用立绘 → 奖励 → 价格。
   以九宫格保留背景四角；静态图鉴不模拟账号已拥有状态。 */
.ui-exchange-trade.is-skin {
  min-height: 0;
  padding: 0;
  border: 8px solid transparent;
  border-image-slice: 56 16 20 fill;
  border-image-width: 40px 8px 12px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__header {
  min-height: 24px;
  padding: 0 22px 2px;
  align-items: center;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__title {
  min-height: 0;
  text-align: center;
  /* 原图姓名栏始终是浅色纸张，使用固定墨色 Token。 */
  color: var(--wood-soft);
  font-size: 15px;
  line-height: 1.6;
}
.ui-exchange-trade__skin-visual {
  display: block;
  position: relative;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}
.ui-exchange-trade__skin-visual:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: -2px;
}
.ui-exchange-trade__skin-visual img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 5 / 9;
  object-fit: contain;
}
.ui-exchange-trade__skin-name {
  position: absolute;
  bottom: 4.5%;
  left: 2px;
  right: 2px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  text-align: center;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__reward-stage {
  flex: 0 0 auto;
  min-height: 0;
  padding: 6px 0;
  border: 0;
  background: transparent;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--reward {
  width: 44px;
  height: 44px;
  min-height: 0;
  padding: 6px;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  background-size: 100% 100%;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--reward img {
  width: 32px;
  height: 32px;
  flex-basis: 32px;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--reward .ui-exchange-trade__item-count {
  bottom: 3px;
  right: 4px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--q1);
  font-size: 13px;
  font-weight: 400;
  line-height: 1;
  /* 小数字压在物品原图上，用轮廓阴影保持游戏式角标可读性。 */
  text-shadow: 0 1px 2px var(--wood-deep), 1px 0 2px var(--wood-deep);
}
.ui-exchange-trade.is-skin .ui-exchange-trade__consume-footer {
  padding: 0 0 4px;
  box-sizing: border-box;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__items--consume {
  justify-content: center;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--consume {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 30px;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: 0 solid transparent;
  border-radius: 0;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--consume::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  /* 只调整原图背景的叠色，图标和价格不受滤镜影响。 */
  border-image-source: var(--skin-price-image);
  border-image-slice: 6 30 fill;
  border-image-width: 4px 22px;
  filter: grayscale(1) brightness(0.45);
  opacity: 0.45;
}
.ui-exchange-trade.is-skin .ui-exchange-trade__item--consume .ui-exchange-trade__item-count {
  color: var(--on-wood-text);
  font-size: 18px;
  font-weight: 400;
}
@media (max-width: 640px) {
  .ui-exchange-trade {
    min-height: 208px;
    padding: 9px;
  }
  .ui-exchange-trade__title { font-size: 14px; }
  .ui-exchange-trade.is-skin { padding: 0; }
  .ui-exchange-trade:is(.is-compact, .is-shop) {
    grid-template-rows: 26px auto minmax(0, 1fr) minmax(20px, max-content);
  }
  .ui-exchange-trade.is-compact {
    padding: 2px;
    grid-template-rows: 30px auto minmax(0, 1fr) minmax(20px, max-content);
  }
  .ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__title {
    font-size: 9px;
    line-height: 14px;
  }
  .ui-exchange-trade.is-compact .ui-exchange-trade__limit {
    padding: 0 2px;
    font-size: 8px;
    line-height: 12px;
  }
  .ui-exchange-trade.is-compact .ui-exchange-trade__header { gap: 2px; }
  .ui-exchange-trade.is-compact .ui-exchange-trade__title {
    height: 14px;
    line-height: 14px;
  }
  .ui-exchange-trade.is-compact .ui-exchange-trade__meta { font-size: 10px; }
  .ui-exchange-trade.is-compact.has-details {
    grid-template-rows: 30px max-content minmax(40px, 1fr) minmax(20px, max-content);
  }
  .ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__reward-stage {
    padding: 2px 3px 4px;
  }
  .ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--consume img {
    width: 16px;
    height: 16px;
    flex-basis: 16px;
  }
  .ui-exchange-trade:is(.is-compact, .is-shop) .ui-exchange-trade__item--consume .ui-exchange-trade__item-count {
    font-size: 13px;
  }
  .ui-exchange-trade.is-compact .ui-exchange-trade__item--consume img {
    width: 14px;
    height: 14px;
    flex-basis: 14px;
  }
  .ui-exchange-trade.is-compact .ui-exchange-trade__item--consume .ui-exchange-trade__item-count { font-size: 12px; }
  .ui-exchange-trade.is-shop {
    padding: 0;
    border-width: 3px;
    border-image-width: 25px 16px;
  }
  .ui-exchange-trade.is-shop::before { inset: 18px 0 20px; }
  .ui-exchange-trade.is-shop .ui-exchange-trade__limit {
    padding: 0 2px 0 10px;
    font-size: 8px;
    line-height: 12px;
  }
  .ui-exchange-trade.is-skin .ui-exchange-trade__title { font-size: 15px; }
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
