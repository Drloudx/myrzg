<template>
  <UiModal
    :visible="visible"
    :title="title"
    :max-width="maxWidth"
    @update:visible="emit('close')"
    @close="emit('close')"
  >
    <template #header>
      <slot name="header">
        <h3 class="base-modal-title">{{ title }}</h3>
      </slot>
    </template>
    <slot></slot>
    <template #footer>
      <slot name="footer"></slot>
    </template>
  </UiModal>
</template>

<script setup>
/**
 * BaseModal —— 兼容旧接口的弹窗外壳（内部统一走组件库 UiModal）
 * 保留 visible / title / maxWidth / close 事件，业务组件无需改动即可获得羊皮纸外观。
 */
import { UiModal } from './ui/index.js'

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  maxWidth: {
    type: String,
    default: '480px'
  }
})

const emit = defineEmits(['close'])
</script>

<style scoped>
.base-modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: inherit;
}
</style>
