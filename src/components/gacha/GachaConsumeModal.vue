<template>
  <div class="consume-modal-root">
    <!-- 全屏半透明黑色遮罩，点击触发取消 (UISprite white 1534×750 rgba(0,0,0,0.502)) -->
    <button
      class="consume-modal-mask"
      type="button"
      aria-label="关闭"
      @click="handleCancel"
    ></button>

    <GachaStage clear>
      <!-- 总容器：宽 768px，高 540px，居中对齐设计画布中心 (0, 0)
           由上部 768×448 主窗口与下部 768×68 悬浮按钮排组成，垂直间距 24px -->
      <div class="g-abs g-layer-overlay consume-modal-container" :style="gachaPos(0, 0)">
        <!-- 弹窗主框：768×448 com_sys_window_item.png -->
        <div class="consume-modal-window">
          <!-- 顶部标题：24px 提示，居中于青色顶条 (top: 22px, height: 34px) -->
          <div class="consume-modal-title">
            {{ title }}
          </div>

          <!-- 消息正文：20px，米白基础色 #f8eedc，金色高亮数值 #ffd270，垂直居中在上半区 -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="consume-modal-msg" v-html="formattedMsg"></div>

          <!-- 分割线中心药丸文字：18px，消耗道具，精确嵌入六边形凹槽 (top: 281px, height: 22px) -->
          <div class="consume-modal-centerlabel">
            消耗道具
          </div>

          <!-- 消耗道具列表（格子展示，居于下半区中央 top: 332px） -->
          <div class="consume-modal-grid">
            <div
              v-for="item in items"
              :key="item.typeId"
              class="consume-item-cell"
            >
              <img
                class="consume-item-cell__frame"
                :src="getImageUrl('/images/ItemBagPanel/item_f_' + (item.quality || 5) + '.png')"
                alt=""
              />
              <img class="consume-item-cell__icon" :src="getImageUrl(item.icon)" :alt="item.name" />
              <span class="consume-item-cell__count">{{ item.count }}</span>
            </div>
          </div>
        </div>

        <!-- 底部取消与确认按钮：独立悬浮排布于主窗口下方 (top: 472px, 宽 376×2, 间距 16px) -->
        <div class="consume-modal-actions">
          <button
            class="consume-btn consume-btn--cancel"
            type="button"
            @click="handleCancel"
          >
            取消
          </button>
          <button
            class="consume-btn consume-btn--confirm"
            type="button"
            @click="handleConfirm"
          >
            确认
          </button>
        </div>

        <!-- 轻提示浮层 -->
        <transition name="consume-toast">
          <div v-if="toastText" class="consume-modal-toast">
            {{ toastText }}
          </div>
        </transition>
      </div>
    </GachaStage>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import GachaStage from './GachaStage.vue'

const props = defineProps({
  title: {
    type: String,
    default: '提示'
  },
  msg: {
    type: String,
    default: ''
  },
  items: {
    type: Array,
    default: () => []
  },
  canAfford: {
    type: Boolean,
    default: true
  },
  errorMsg: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['confirm', 'cancel'])

const toastText = ref('')
let toastTimer = null

function showToast(text) {
  if (toastTimer) clearTimeout(toastTimer)
  toastText.value = text
  toastTimer = setTimeout(() => {
    toastText.value = ''
    toastTimer = null
  }, 2000)
}

function handleCancel() {
  emit('cancel')
}

function handleConfirm() {
  if (!props.canAfford) {
    showToast(props.errorMsg || '道具数量不足!')
    return
  }
  emit('confirm')
}

/**
 * 将源码格式的花括号 `{num}` 解析替换为金色高亮标签，
 * 并将空格显式替换为 &nbsp; 避免被 HTML 默认折叠，
 * 精准呈现 ExtentionMethod.ReplaceDescValue(msg, 1, 3) 的米白+金字效果。
 */
const formattedMsg = computed(() => {
  if (!props.msg) return ''
  return props.msg
    .replace(/ /g, '&nbsp;')
    .replace(/\{([^}]+)\}/g, '<span class="consume-highlight">$1</span>')
})
</script>

<style scoped>
.consume-modal-root {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.consume-modal-mask {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.502);
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  z-index: 0;
}

/* 包含 768×448 主窗与 768×68 悬浮按键，总高 540px，完美居中在画面中心 */
.consume-modal-container {
  width: 768px;
  height: 540px;
  user-select: none;
  pointer-events: none;
}

.consume-modal-window {
  position: absolute;
  top: 0;
  left: 0;
  width: 768px;
  height: 448px;
  background: url('/images/TipsManager_Atlas/com_sys_window_item.png') no-repeat center / 100% 100%;
  pointer-events: auto;
}

/* 顶部青色梯形条标题：24px，淡青色 #33dad0 (Const.ColorString[6])，居中于青色顶条 */
.consume-modal-title {
  position: absolute;
  top: 22px;
  left: 0;
  width: 100%;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui, sans-serif);
  font-size: 24px;
  font-weight: bold;
  color: #33dad0;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
  letter-spacing: 2px;
}

/* 描述正文：20px，垂直居中在上半区域，基础色米白 #f8eedc (Const.ColorString[1])，数值金色 #ffd270 (Const.ColorString[3]) */
.consume-modal-msg {
  position: absolute;
  top: 64px;
  left: 32px;
  right: 32px;
  height: 216px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui, sans-serif);
  font-size: 20px;
  line-height: 1.5;
  color: #f8eedc;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
  text-align: center;
  white-space: nowrap;
}

:deep(.consume-highlight) {
  color: #ffd270;
  font-weight: bold;
}

/* 中间分割线中央药丸文字：18px，暖米色 #cfba96 (Const.ColorString[2])，精确嵌在六边形底衬中 */
.consume-modal-centerlabel {
  position: absolute;
  top: 281px;
  left: 0;
  width: 100%;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui, sans-serif);
  font-size: 18px;
  font-weight: bold;
  color: #cfba96;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
  letter-spacing: 1px;
}

/* 消耗道具列表：居于分割线下方中央 (top: 322px, 尺寸 96×96) */
.consume-modal-grid {
  position: absolute;
  top: 322px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.consume-item-cell {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.consume-item-cell__frame {
  position: absolute;
  inset: 0;
  width: 96px;
  height: 96px;
  pointer-events: none;
}

.consume-item-cell__icon {
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.consume-item-cell__count {
  position: absolute;
  right: 7px;
  bottom: 4px;
  font-family: var(--font-ui, sans-serif);
  font-size: 20px;
  font-weight: bold;
  color: #cfba96;
  line-height: 1;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
}

/* 底部按键排：独立悬浮排布于主窗口底框下方 (top: 472px, 间距 24px) */
.consume-modal-actions {
  position: absolute;
  top: 472px;
  left: 0;
  width: 768px;
  height: 68px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: auto;
}

.consume-btn {
  width: 376px;
  height: 68px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-ui, sans-serif);
  font-size: 22px;
  font-weight: bold;
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  transition: filter 0.15s ease, transform 0.08s ease;
}

.consume-btn:active {
  transform: scale(0.98);
}

/* 取消按钮：红底金边 (UISprite #70409 com_btn_N)，文字 #cfba96 (Const.ColorString[2]) */
.consume-btn--cancel {
  background: url('/images/sliced_buttons/com_btn_N_376x68.png') no-repeat center / 100% 100%;
  color: #cfba96;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
}

.consume-btn--cancel:hover {
  filter: brightness(1.08);
}

.consume-btn--cancel:active {
  background-image: url('/images/sliced_buttons/com_btn_N_press_376x68.png');
}

/* 确认按钮：青底金边 (UISprite #73117 com_btn_Y)，文字 #33dad0 (Const.ColorString[6]) */
.consume-btn--confirm {
  background: url('/images/sliced_buttons/com_btn_Y_376x68.png') no-repeat center / 100% 100%;
  color: #33dad0;
  text-shadow:
    -1px -1px 0 #170e07,
    1px -1px 0 #170e07,
    -1px 1px 0 #170e07,
    1px 1px 0 #170e07,
    0 2px 0 #170e07,
    2px 0 0 #170e07,
    0 -2px 0 #170e07,
    -2px 0 0 #170e07;
}

.consume-btn--confirm:hover {
  filter: brightness(1.08);
}

.consume-btn--confirm:active {
  background-image: url('/images/sliced_buttons/com_btn_Y_press_376x68.png');
}

/* 轻提示浮层 */
.consume-modal-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid #ffd270;
  border-radius: 4px;
  padding: 10px 24px;
  color: #ffd270;
  font-size: 18px;
  font-family: var(--font-ui, sans-serif);
  pointer-events: none;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
}

.consume-toast-enter-active,
.consume-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.consume-toast-enter-from,
.consume-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -40%);
}
</style>
