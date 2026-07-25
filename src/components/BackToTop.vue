<template>
  <Transition name="fade-top">
    <button
      v-show="isVisible"
      class="back-to-top-btn"
      @click="scrollToTop"
      title="回到顶部"
    >
      <img src="/ui/down-top.svg" class="back-to-top-icon" alt="回到顶部" />
    </button>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  scrollContainer: {
    type: String,
    default: ''
  }
})

const isVisible = ref(false)

const getContainer = () => {
  if (props.scrollContainer) {
    return document.querySelector(props.scrollContainer)
  }
  return null
}

const handleScroll = (e) => {
  const container = getContainer()
  const el = container || (e && e.target ? e.target : window)
  const scrollTop = el.scrollTop !== undefined ? el.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0)
  isVisible.value = scrollTop > 100
}

const scrollToTop = () => {
  const container = getContainer()
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<style scoped>
.back-to-top-btn {
  position: fixed;
  right: 20px;
  bottom: calc(80px + var(--safe-bottom));
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #628fb8;
  border: none;
  box-shadow: 0 4px 12px rgba(98, 143, 184, 0.4);
  cursor: pointer;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-tap-highlight-color: transparent;
}

.back-to-top-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: brightness(0) invert(1);
  transform: scaleY(-1);
  transition: transform 0.2s ease;
}

@media (min-width: 800px) {
  .back-to-top-btn {
    right: calc(50% - 380px);
  }
}

.back-to-top-btn:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}

.fade-top-enter-active,
.fade-top-leave-active {
  transition: all 0.25s ease;
}

.fade-top-enter-from,
.fade-top-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
