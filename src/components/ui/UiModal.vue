<template>
  <component
    :is="teleportTo ? Teleport : 'div'"
    :to="teleportTo"
    :class="teleportTo ? undefined : ['ui-modal-host', { 'ui-modal-open': visible }]"
  >
    <Transition
      :name="fullscreen ? 'ui-modal-slide' : 'ui-modal-fade'"
      :css="!!teleportTo || fullscreen"
    >
      <div
        v-if="visible"
        class="ui-modal-overlay"
        :class="{ 'is-fullscreen': fullscreen, 'is-teleported': !!teleportTo }"
        :style="{ zIndex: teleportTo ? Math.max(zIndex, 12000) : zIndex }"
        @click.self="onOverlayClick"
      >
        <div
          ref="modalWindow"
          class="ui-modal-window paper-panel corner-nails"
          role="dialog"
          :aria-modal="teleportTo ? 'true' : undefined"
          :aria-label="title || '详情'"
          tabindex="-1"
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
import { Teleport, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useOverlay } from '../../composables/useOverlay.js'
import { acquireGlobalModalLock, releaseGlobalModalLock } from '../../utils/globalModalLock.js'
import {
  acquireModalScroll,
  releaseModalScroll,
  scrollModalRootToTop
} from '../../utils/modalScrollCoordinator.js'

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
  teleportTo: { type: [String, Boolean], default: null },
  // 用户打开弹窗前列表所在的滚动位置（Number|null）。提供时不读取实时 scrollTop，
  // 因为覆盖式详情打开会锁 app-main 为视口高度、把页面钳到顶部，导致实时 scrollTop 被钳到 0。
  restoreScrollTop: { type: Number, default: null }
})
const emit = defineEmits(['update:visible', 'close'])
const modalWindow = ref(null)

const scrollOwner = Symbol('ui-modal-scroll-owner')
let ownsParentScrollPosition = false
let scrollOperation = 0
// 在可见前（flush:'pre'，DOM 尚未应用覆盖式弹窗的 max-height 钳制）捕获 app-container 的滚动位置，
// 避免被钳到 0 —— 供页面内嵌详情（无 restoreScrollTop prop）关闭时恢复到点击处。
let preOpenScrollTop = 0

const usesDesktopParentScroll = () => (
  !props.teleportTo &&
  !props.fullscreen &&
  window.innerWidth >= 1025
)

// 弹窗可见前一行（pre）捕获：此刻覆盖式弹窗尚未渲染、max-height 钳制未生效，scrollTop 仍是用户所在位置。
watch(() => props.visible, (v) => {
  if (v && usesDesktopParentScroll()) {
    preOpenScrollTop = document.querySelector('.app-container')?.scrollTop || 0
  }
}, { flush: 'pre' })

const handleParentScroll = async visible => {
  const operation = ++scrollOperation

  if (visible && usesDesktopParentScroll()) {
    const root = document.querySelector('.app-container')
    const restoreTop = props.restoreScrollTop != null
      ? props.restoreScrollTop
      : (preOpenScrollTop || root?.scrollTop || 0)
    ownsParentScrollPosition = acquireModalScroll(scrollOwner, root, restoreTop)
    await nextTick()
    if (operation === scrollOperation && props.visible && ownsParentScrollPosition) {
      scrollModalRootToTop(scrollOwner)
    }
    return
  }

  if (!visible && ownsParentScrollPosition) {
    ownsParentScrollPosition = false
    releaseModalScroll(scrollOwner, {
      canRestore: () => operation === scrollOperation && !props.visible
    })
  }
}

watch(() => props.visible, handleParentScroll, { flush: 'post', immediate: true })

onBeforeUnmount(() => {
  scrollOperation += 1
  if (!ownsParentScrollPosition) return
  ownsParentScrollPosition = false
  releaseModalScroll(scrollOwner, { restore: false })
})

const close = () => {
  if (!props.closable) return
  emit('update:visible', false)
  emit('close')
}
const onOverlayClick = () => {
  if (props.closeOnOverlay) close()
}

const { isTopOverlay } = useOverlay(() => props.visible, {
  priority: props.teleportTo ? Math.max(props.zIndex, 12000) : props.zIndex,
  canClose: () => props.closable,
  close
})

let ownsGlobalLock = false
let previousFocus = null
let focusOperation = 0
watch(() => props.visible && !!props.teleportTo, async active => {
  const operation = ++focusOperation
  if (active) {
    previousFocus = document.activeElement
    acquireGlobalModalLock(scrollOwner)
    ownsGlobalLock = true
    await nextTick()
    if (operation === focusOperation && isTopOverlay()) modalWindow.value?.focus({ preventScroll: true })
  } else if (ownsGlobalLock) {
    ownsGlobalLock = false
    releaseGlobalModalLock(scrollOwner)
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    previousFocus = null
  }
}, { flush: 'post', immediate: true })

const containFocus = event => {
  if (event.key !== 'Tab' || !props.visible || !props.teleportTo || !isTopOverlay()) return
  const window = modalWindow.value
  if (!window) return
  const focusable = [...window.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
    .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) ||
      (!event.shiftKey && (document.activeElement === last || !window.contains(document.activeElement)))) {
    event.preventDefault()
    ;(event.shiftKey ? last || window : first || window).focus({ preventScroll: true })
  }
}
document.addEventListener('keydown', containFocus)
onBeforeUnmount(() => {
  focusOperation += 1
  document.removeEventListener('keydown', containFocus)
  if (ownsGlobalLock) releaseGlobalModalLock(scrollOwner)
})
</script>

<style scoped>
/* 系统级 Teleport / fullscreen 弹窗保留动画；普通内嵌详情关闭时直接切回列表，避免滚动恢复期间双层画面叠帧。 */
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

.ui-modal-host {
  display: block;
  width: 100%;
  min-width: 0;
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
  height: 100dvh;
  padding: calc(16px + var(--safe-top, 0px)) calc(16px + env(safe-area-inset-right, 0px)) calc(16px + var(--safe-bottom, 0px)) calc(16px + env(safe-area-inset-left, 0px));
  overscroll-behavior: contain;
  z-index: 3000;
}
.ui-modal-overlay.is-fullscreen.is-teleported {
  padding: var(--safe-top, 0px) env(safe-area-inset-right, 0px) var(--safe-bottom, 0px) env(safe-area-inset-left, 0px);
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
  min-height: 0;
  max-height: 100%;
  outline: none;
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
  color: var(--on-wood-text);
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
  color: var(--on-wood-text);
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
  border-color: var(--on-wood-text);
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
  overflow-wrap: anywhere;
  overscroll-behavior-y: contain;
}

@media (min-width: 1025px) {
  .ui-modal-overlay:not(.is-teleported) {
    position: relative;
    inset: auto;
    height: auto;
    min-height: calc(100dvh - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
    overflow: visible;
  }
  .ui-modal-window:not(.is-teleported) {
    height: auto;
    min-height: inherit;
    max-height: none;
    overflow: visible;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
  .ui-modal-window:not(.is-teleported)::before,
  .ui-modal-window:not(.is-teleported)::after {
    content: none;
  }
  .ui-modal-overlay:not(.is-teleported) .ui-modal-body {
    flex: 1;
    min-height: 0;
    overflow: visible;
    clip-path: inset(var(--sticky-clip-top, 0px) 0 0);
    background-color: var(--modal-bg, #efe2c4);
    border-right: 2px solid var(--border-color, #8f7351);
    border-bottom: 2px solid var(--border-color, #8f7351);
    border-left: 2px solid var(--border-color, #8f7351);
  }
  .ui-modal-overlay:not(.is-teleported) .ui-modal-header {
    position: sticky;
    top: calc(var(--header-height, 60px) + var(--safe-top, 0px) + 35px);
    z-index: 40;
    border-top: 2px solid var(--border-color, #8f7351);
    border-right: 2px solid var(--border-color, #8f7351);
    border-left: 2px solid var(--border-color, #8f7351);
  }

  /* 页面内详情（角色、魔物、怪物、任务、事件、副本等）覆盖当前页面内容。
     配合下方 pvc :has() 把 .page-view-container 锁为视口高度（max-height）并隐藏其同层列表，
     使详情恰好填满中间区、锁死页面：短详情不会露出列表/地图空白、左右栏保持固定、无"可滚到底部的空白"；
     弹窗窗口固定为视口高，正文在弹窗内部滚动（长详情在弹窗内滚，不撑破视口）。 */
  .page-view-container > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) {
    position: absolute;
    inset: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .page-view-container > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-window {
    height: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .page-view-container > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-body {
    overflow-y: auto;
    overflow-x: hidden;
    clip-path: none;
  }
  .page-view-container > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-header {
    position: static;
    flex-shrink: 0;
  }

  /* 全局物品详情（app-main 内、与 router-view 同级）：覆盖式模态。
     配合下方 app-main :has() 把 app-main 锁为视口高度（max-height）并隐藏其同层 router-view：
     短详情不会露出列表、也不会有"可滚到底部的空白"；弹窗窗口固定为视口高，正文在弹窗内部滚动。 */
  .app-main > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) {
    position: absolute;
    inset: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .app-main > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-window {
    height: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .app-main > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-body {
    overflow-y: auto;
    overflow-x: hidden;
    clip-path: none;
  }
  .app-main > .ui-modal-host > .ui-modal-overlay:not(.is-teleported) .ui-modal-header {
    position: static;
    flex-shrink: 0;
  }
}

/* 页面级详情打开时保留列表布局高度，但避免列表内容透到详情下面。
   以宿主上的 ui-modal-open 类（随 visible 即时移除）为开关，而非以 overlay 是否存在为准。
   普通内嵌详情不执行 CSS 离场动画，关闭时 overlay 与隐藏状态同步移除，直接显示已复位的列表。 */
:global(.page-view-container:has(> .ui-modal-host.ui-modal-open) > :not(.ui-modal-host)) {
  visibility: hidden !important;
  pointer-events: none !important;
}
/* 页面级详情打开时把 .page-view-container 锁为视口高度（max-height + overflow:hidden）：
   内容被裁到视口内、页面不可滚到空白，短详情恰好填满中间区、左右栏固定。 */
:global(.page-view-container:has(> .ui-modal-host.ui-modal-open)) {
  max-height: calc(100dvh - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
  overflow: hidden;
}

/* 全局物品详情（app-main 内）：打开时隐藏其同层的 router-view（页面列表），使详情真正覆盖中间区、
   列表不再从详情下方露出；关闭时 overlay 与 ui-modal-open 同步移除，直接恢复列表。
   用 visibility（而非 display:none）：列表保持渲染与布局高度，关闭后 app-main 高度不变、滚动恢复正确，
   且列表在打开期间不可见、不会从详情下方透出。
   同时把 app-main 锁为视口高度（max-height + overflow:hidden）——列表/页面内容被裁到视口内。 */
:global(.app-main:has(> .ui-modal-host.ui-modal-open) > :not(.ui-modal-host)) {
  visibility: hidden !important;
  pointer-events: none !important;
}
/* 任意详情弹窗打开时把 app-main 锁为视口高度（max-height + overflow:hidden）。
   用后代选择器（.ui-modal-host）同时匹配页面内嵌详情的宿主（在 page-view-container 内）与全局物品详情的宿主（app-main 直接子级）。 */
:global(.app-main:has(.ui-modal-host.ui-modal-open)) {
  max-height: calc(100dvh - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
  overflow: hidden;
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
.ui-modal-window.is-teleported .ui-modal-footer {
  padding-bottom: 14px;
}
</style>
