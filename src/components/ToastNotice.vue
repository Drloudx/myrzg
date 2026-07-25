<template>
  <Teleport to="body">
    <Transition name="toast-fade">
      <div v-if="visible" class="toast-wrapper" :class="`type-${type}`">
        <div class="toast-icon">{{ typeIcon }}</div>
        <div class="toast-content">{{ message }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info' // info, success, warning, error
  }
})

const typeIcon = computed(() => {
  switch (props.type) {
    case 'success': return '✓'
    case 'warning': return '⚠️'
    case 'error': return '✕'
    default: return 'ℹ️'
  }
})
</script>

<style scoped>
.toast-wrapper {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
}

.type-info {
  background: rgba(15, 23, 42, 0.88);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.type-success {
  background: rgba(16, 185, 129, 0.92);
  color: #ffffff;
}

.type-warning {
  background: rgba(245, 158, 11, 0.92);
  color: #ffffff;
}

.type-error {
  background: rgba(239, 68, 68, 0.92);
  color: #ffffff;
}

.toast-icon {
  font-size: 16px;
  font-weight: bold;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
