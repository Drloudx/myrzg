<template>
  <button
    type="button"
    class="furniture-card"
    :class="`quality-border-${quality}`"
    :data-quality="quality"
    :data-main-type="furniture.mainType"
    :data-sub-type="furniture.subType"
    :data-has-blueprint="hasBlueprint"
    data-image-fallback="custom"
    :title="`${furniture.name} - 查看详情`"
    :aria-label="`查看家具 ${furniture.name} 的详情`"
    @click="emit('click')"
  >
    <span class="furniture-card__preview" :class="`quality-bg-${quality}`">
      <img
        class="furniture-card__image"
        :class="{ 'is-placeholder': !imageUrl }"
        :src="imageUrl || missingImageUrl"
        :alt="furniture.name"
        loading="lazy"
        @error="handlePreviewFallback"
        @load="handlePreviewLoad"
      />
      <span v-if="hasBlueprint" class="furniture-card__blueprint">有图纸</span>
    </span>

    <span class="furniture-card__body">
      <strong class="furniture-card__name" :class="`quality-text-${quality}`">
        {{ furniture.name }}
      </strong>
      <span class="furniture-card__category">{{ categoryText }}</span>
      <span class="furniture-card__meta">
        <span>装饰 {{ decorationText }}</span>
        <span>{{ furniture.placeName || furniture.place || '未标注' }}</span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { getImageUrl, handleImageFallback } from '../utils/env.js'

const props = defineProps({
  furniture: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click'])

const quality = computed(() => {
  const value = Number(props.furniture?.quality) || 1
  return Math.min(5, Math.max(1, Math.floor(value)))
})

const imageUrl = computed(() => {
  if (props.furniture?.displayImage) return getImageUrl(props.furniture.displayImage)
  const icon = props.furniture?.displayIcon
  if (!icon) return ''
  // 全站图片已统一为 .webp；仍兼容传入带扩展名的 icon，故先剥掉再拼
  return getImageUrl(`/BuildItem/${String(icon).replace(/\.(?:png|jpe?g|webp)$/i, '')}.webp`)
})

const missingImageUrl = getImageUrl('/ui/visibility-off.svg')

const handlePreviewFallback = event => {
  event?.currentTarget?.classList.add('is-placeholder')
  handleImageFallback(event)
}

const handlePreviewLoad = event => {
  const image = event?.currentTarget
  if (image && !String(image.getAttribute('src') || '').includes('/ui/visibility-off.svg')) {
    image.classList.remove('is-placeholder')
  }
}

const hasBlueprint = computed(() => (props.furniture?.blueprints || []).length > 0)

const categoryText = computed(() => {
  const labels = [props.furniture?.mainName, props.furniture?.subName].filter(Boolean)
  return labels.length ? labels.join(' / ') : '未分类'
})

const decorationText = computed(() => {
  const value = Number(props.furniture?.dec) || 0
  return value > 0 ? `+${value}` : '0'
})
</script>

<style scoped>
.furniture-card {
  width: 100%;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  text-align: left;
  color: var(--text-main, #3e2a14);
  background: var(--paper-soft, #eadcc3);
  border: 1px solid var(--border-soft, rgba(143, 115, 81, 0.45));
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(43, 31, 21, 0.18);
  cursor: pointer;
  font: inherit;
  letter-spacing: 0;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  -webkit-tap-highlight-color: transparent;
}

.furniture-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(43, 31, 21, 0.26);
}

.furniture-card:active {
  transform: scale(0.985);
}

.furniture-card:focus-visible {
  outline: 2px solid var(--accent-bright, #7a9a99);
  outline-offset: 2px;
}

.furniture-card.quality-border-1 { border-color: var(--q1); }
.furniture-card.quality-border-2 { border-color: var(--q2); }
.furniture-card.quality-border-3 { border-color: var(--q3); }
.furniture-card.quality-border-4 { border-color: var(--q4); }
.furniture-card.quality-border-5 { border-color: var(--q5); }

.furniture-card__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
}

.furniture-card__image {
  width: 88%;
  height: 88%;
  object-fit: contain;
  filter: drop-shadow(0 5px 5px rgba(43, 31, 21, 0.28));
}

.furniture-card__image.is-placeholder {
  width: 42px;
  height: 42px;
  padding: 11px;
  border-radius: 4px;
  background: var(--wood-soft, #463424);
  opacity: 0.72;
  filter: none;
}

.furniture-card__blueprint {
  position: absolute;
  top: 7px;
  right: 7px;
  padding: 3px 7px;
  border: 1px solid rgba(85, 117, 116, 0.55);
  border-radius: 3px;
  background: var(--quality-label-bg, rgba(238, 231, 211, 0.93));
  color: var(--accent-ink, #557574);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
  box-shadow: 0 1px 3px rgba(43, 31, 21, 0.18);
}

.furniture-card__body {
  min-width: 0;
  padding: 9px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.furniture-card__name {
  width: 100%;
  min-height: 21px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-all;
}

.furniture-card__category {
  min-height: 18px;
  overflow: hidden;
  color: var(--text-muted, #6b5134);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.furniture-card__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-faint, #8a6d4d);
  font-size: 11px;
  line-height: 1.4;
}

.furniture-card__meta span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

@media (max-width: 768px) {
  .furniture-card__body {
    padding: 7px 6px 8px;
    gap: 2px;
  }

  .furniture-card__name {
    min-height: 20px;
    font-size: 13px;
  }

  .furniture-card__category {
    min-height: 17px;
    font-size: 11px;
  }

  .furniture-card__meta {
    gap: 4px;
    font-size: 10px;
  }

  .furniture-card__blueprint {
    top: 5px;
    right: 5px;
    padding: 2px 5px;
    font-size: 10px;
  }
}

</style>
