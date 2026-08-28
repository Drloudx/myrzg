<template>
  <div
    class="ui-item-card"
    :title="name"
    @click="emit('click')"
  >
    <div
      class="ui-item-card__slot"
      :style="{ backgroundImage: `url('${getImageUrl(`/ItemBagPanel/item_f_${getQualityFrame(quality)}.png`)}')` }"
    >
      <img
        v-if="img"
        :src="img"
        :alt="name"
        class="ui-item-card__icon"
        loading="lazy"
        @error="emit('img-error', $event)"
      />
      <slot name="icon" />
      <div v-if="$slots.extra" class="ui-item-card__badge">
        <slot name="extra" />
      </div>
    </div>
    <div class="ui-item-card__name" :class="quality ? `quality-text-${quality}` : ''">
      {{ name }}
    </div>
  </div>
</template>

<script setup>
/**
 * UiItemCard —— 图鉴网格卡片
 * 使用游戏原生 ItemBagPanel 背景框（item_f_1 ~ item_f_6.png）
 */
import { getImageUrl } from '../../utils/env'

const props = defineProps({
  name: { type: String, default: '' },
  img: { type: String, default: '' },
  quality: { type: [Number, String], default: 0 }
})
const emit = defineEmits(['click', 'img-error'])

const getQualityFrame = (q) => {
  const num = Number(q)
  if (!num || num < 1) return 1
  if (num > 6) return 6
  return Math.floor(num)
}
</script>

<style scoped>
.ui-item-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 2px;
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease;
  box-sizing: border-box;
  min-width: 0;
  background: transparent;
  border: none;
  width: 100%;
  max-width: 86px;
  margin: 0 auto;
}

.ui-item-card:hover {
  transform: translateY(-3px);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
}

.ui-item-card:active {
  transform: scale(0.96);
}

/* 游戏原生品质背景框（item_f_1 ~ item_f_6.png） */
.ui-item-card__slot {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  box-sizing: border-box;
}

/* 中间图标微调适中（68% 大小） */
.ui-item-card__icon {
  max-width: 68%;
  max-height: 68%;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
}

/* 名称底板复用游戏图鉴资源 colect_list_mx.png，避免网页自定义纯色与游戏视觉不一致。 */
.ui-item-card__name {
  margin: 3px auto 0;
  width: calc(100% - 10px);
  box-sizing: border-box;
  background: transparent;
  color: var(--text-main, #382410);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  padding: 1px 0;
  min-height: 21px;
  border: 4px solid transparent;
  border-image-source: url('/images/PicHandBookPanel/colect_list_mx.png');
  border-image-slice: 20 32 fill;
  border-image-width: 4px 8px;
  border-image-outset: 0;
  border-image-repeat: stretch;
  box-shadow: none;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

/* 品质 5（传说/橙金）：自然温润的琥珀橙金色，无描边突兀感，阅读清晰自然 */
.ui-item-card__name.quality-text-5 {
  color: var(--q5-text, #b15d00) !important;
  text-shadow: none !important;
}

.dark-mode .ui-item-card__name {
  background: transparent;
  border-image-source: url('/images/PicHandBookPanel/colect_list_mx.png');
  color: #eaddc2;
}

.ui-item-card__badge {
  position: absolute;
  right: 4px;
  bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}
</style>
