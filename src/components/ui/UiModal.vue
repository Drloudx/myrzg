<template>
  <component :is="teleportTo ? Teleport : 'div'" :to="teleportTo">
    <Transition :name="fullscreen ? 'ui-modal-slide' : 'ui-modal-fade'">
      <div
        v-if="visible"
        class="ui-modal-overlay"
        :class="{ 'is-fullscreen': fullscreen, 'is-teleported': !!teleportTo }"
        :style="{ zIndex }"
        @click.self="onOverlayClick"
      >
        <div
          class="ui-modal-window paper-panel corner-nails"
          :class="{ 'is-fullscreen': fullscreen, 'is-teleported': !!teleportTo }"
          :style="fullscreen || !teleportTo ? {} : { maxWidth }"
        >
          <!-- 顶部木质标题条 -->
          <div class="ui-modal-header">
            <div class="ui-modal-header__content">
              <slot name="header">
                <h3 class="ui-modal-title">{{ title }}</h3>
              </slot>
            </div>
            <button v-if="closable" class="ui-modal-close" @click="close" title="关闭" aria-label="关闭">✕</button>
          </div>

          <!-- 内容区 -->
          <div class="ui-modal-body" :id="scrollId">
            <slot />
          </div>

          <!-- 底部按钮区 -->
          <div v-if="$slots.footer" class="ui-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </component>
</template>

<script setup>
import { Teleport } from 'vue'

/**
 * UiModal —— 羊皮纸详情/弹窗组件
 * 默认模式：内嵌在中间主区域（所占空间与中间区域严格一致，周围不遮挡、不变暗）
 * teleportTo: 若传入 'body' 则以全局居中弹窗遮罩呈现（用于系统公告/关于等）
 */
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  maxWidth: { type: String, default: '100%' },
  fullscreen: { type: Boolean, default: false },
  closable: { type: Boolean, default: true },
  closeOnOverlay: { type: Boolean, default: false },
  scrollId: { type: String, default: 'uiModalScroll' },
  zIndex: { type: Number, default: 500 },
  teleportTo: { type: [String, Boolean], default: null }
})
const emit = defineEmits(['update:visible', 'close'])

const close = () => {
  emit('update:visible', false)
  emit('close')
}
const onOverlayClick = () => {
  if (props.closeOnOverlay) close()
}
</script>

<style scoped>
/* 过渡动画 */
.ui-modal-fade-enter-active, .ui-modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ui-modal-fade-enter-from, .ui-modal-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.ui-modal-slide-enter-active, .ui-modal-slide-leave-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.ui-modal-slide-enter-from, .ui-modal-slide-leave-to {
  transform: translateY(100%);
}

/* 默认内嵌覆盖：100% 占满中间主要视图区，周围不变暗、不遮挡左右栏 */
.ui-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
  z-index: 500;
  box-sizing: border-box;
  overflow: hidden;
}

/* 全局弹窗模式（如 teleportTo="body"） */
.ui-modal-overlay.is-teleported {
  position: fixed;
  background: var(--modal-overlay, rgba(24, 14, 6, 0.55));
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 3000;
}
.ui-modal-overlay.is-fullscreen.is-teleported {
  padding: 0;
  align-items: stretch;
}

/* 弹窗窗体：默认撑满中间区域，具备完整的羊皮纸与边框钉扣质感 */
.ui-modal-window {
  background-color: var(--modal-bg, #efe2c4);
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border-radius: 4px;
}
.ui-modal-window.is-teleported {
  height: auto;
  max-height: 86vh;
}
.ui-modal-window.is-fullscreen {
  border-radius: 0;
}

/* 木质标题条 */
.ui-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(180deg, var(--wood-soft, #463424), var(--wood, #2b1f15));
  border-bottom: 3px solid var(--border-color, #8f7351);
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}
.ui-modal-header__content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ui-modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--paper, #dfceb3);
  letter-spacing: 1.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ui-modal-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid rgba(223, 206, 179, 0.35);
  color: var(--paper, #dfceb3);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  padding: 0;
}
.ui-modal-close:hover {
  background: rgba(223, 206, 179, 0.16);
  border-color: var(--paper, #dfceb3);
}

/* 内容区 */
.ui-modal-body {
  padding: 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  color: var(--modal-text, #3e2a14);
  font-size: 14px;
  line-height: 1.65;
}

/* 底部 */
.ui-modal-footer {
  padding: 12px 18px calc(14px + var(--safe-bottom, 0px));
  border-top: 1px dashed var(--border-soft, rgba(143, 115, 81, 0.45));
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
</style>
