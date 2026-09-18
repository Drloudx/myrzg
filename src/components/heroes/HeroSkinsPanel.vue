<template>
  <div class="hero-skins-panel">
    <UiSection title="角色皮肤">
      <div class="skin-list">
        <article
          v-for="skin in skins"
          :key="skin.id"
          class="skin-entry paper-panel-solid"
          :class="[skin.quality ? `quality-border-${skin.quality}` : '', { 'has-model': skin.modelImage }]"
        >
          <div class="skin-portrait-wrap">
            <img
              :src="getImageUrl(`/images/chara/l/${skin.img}.webp`)"
              :alt="skin.name"
              class="skin-portrait"
              loading="lazy"
              @error="handleImageError"
            />
          </div>

          <div class="skin-info">
            <div class="skin-heading">
              <h4>{{ skin.name }}</h4>
              <UiTag v-if="skin.from" tone="accent">{{ skin.from }}</UiTag>
            </div>

            <div v-if="skin.attributes?.length" class="skin-attributes">
              <span class="skin-info-label">属性加成</span>
              <div class="skin-attribute-list">
                <UiTag
                  v-for="attribute in skin.attributes"
                  :key="attribute.key"
                  tone="gold"
                >
                  {{ translateStatName(attribute.key) }} {{ formatAttributeValue(attribute) }}
                </UiTag>
              </div>
            </div>
          </div>
          <div v-if="skin.modelImage" class="skin-model-wrap">
            <img :src="getImageUrl(skin.modelImage)" :alt="`${skin.name}小人模型`"
              class="skin-model" loading="lazy" decoding="async" @error="handleImageFallback" />
          </div>
        </article>
      </div>
    </UiSection>
  </div>
</template>

<script setup>
import { getImageUrl, handleImageFallback } from '../../utils/env.js'
import { translateStatName } from '../../utils/gameMappings.js'
import { UiSection, UiTag } from '../ui/index.js'

defineProps({
  skins: { type: Array, default: () => [] }
})

const formatAttributeValue = attribute => {
  const values = []
  if (attribute.baseValue) values.push(`+${attribute.baseValue}`)
  if (attribute.percent) {
    const percent = Math.abs(attribute.percent) <= 1 ? attribute.percent * 100 : attribute.percent
    values.push(`+${Number(percent.toFixed(2))}%`)
  }
  return values.join(' / ')
}

const handleImageError = event => {
  event.target.style.display = 'none'
}
</script>

<style scoped>
.hero-skins-panel {
  padding-bottom: 24px;
}

.skin-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.skin-entry {
  display: grid;
  grid-template-columns: minmax(180px, 42%) minmax(0, 1fr);
  min-height: 310px;
  overflow: hidden;
  border-width: 1px;
  border-style: solid;
  border-radius: 4px;
}

.skin-entry.has-model {
  grid-template-columns: minmax(0, 42fr) minmax(0, 27fr) minmax(0, 31fr);
}

.skin-model-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 16px 10px;
}

.skin-model {
  display: block;
  width: 100%;
  height: 270px;
  object-fit: contain;
}

.skin-portrait-wrap {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  padding: 12px 8px 0;
  background: rgba(122, 154, 153, 0.09);
  border-right: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
}

.skin-portrait {
  display: block;
  width: 100%;
  height: 298px;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 4px 8px rgba(43, 31, 21, 0.28));
}

.skin-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  min-width: 0;
  padding: 18px;
}

.skin-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.skin-heading h4 {
  margin: 0;
  color: var(--text-main, #3e2a14);
  font-size: 18px;
  font-weight: 700;
}

.skin-attributes {
  padding-top: 14px;
  border-top: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
}

.skin-info-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-muted, #6b5134);
  font-size: 13px;
  font-weight: 700;
}

.skin-attribute-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 560px) {
  .skin-list {
    grid-template-columns: 1fr;
  }

  .skin-entry {
    grid-template-columns: 1fr;
  }

  .skin-entry.has-model {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .has-model .skin-portrait-wrap { grid-column: 1; grid-row: 1; }
  .has-model .skin-model-wrap { grid-column: 2; grid-row: 1; }
  .has-model .skin-info { grid-column: 1 / -1; grid-row: 2; }
  .has-model .skin-portrait { height: 230px; }
  .has-model .skin-model { height: 200px; }

  .skin-portrait-wrap {
    border-right: 0;
    border-bottom: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  }

  .skin-portrait {
    height: 330px;
  }

  .skin-info {
    padding: 14px;
  }
}
</style>
