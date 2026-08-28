<script setup>
import { UiModal, UiButton, UiTag } from './ui/index.js'

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const close = () => {
  emit('update:modelValue', false)
}
</script>

<template>
  <UiModal
    :visible="modelValue"
    title="关于我们"
    max-width="420px"
    teleport-to="body"
    @update:visible="close"
  >
    <div class="author-section">
      <img src="/ui/author_avatar.jpg" class="about-logo" alt="作者头像" />
      <h4 class="author-name">云汐渚梦</h4>
      <div class="social-links">
        <a href="https://www.taptap.cn/user/34448185?share_id=06714cbc47ff&utm_medium=share&utm_source=copylink" target="_blank" class="social-item taptap">
          <span class="social-icon">T</span>
          TapTap
        </a>
        <a href="https://b23.tv/xGNrRhf" target="_blank" class="social-item bilibili">
          <span class="social-icon">B</span>
          Bilibili
        </a>
      </div>
    </div>

    <div class="credits-section paper-panel-solid">
      <div class="credits-title">—— 感谢名单 ——</div>
      <div class="credits-list">
        <div class="credit-item">
          <span class="credit-name">测试1</span>
          <span class="credit-desc">测试111</span>
        </div>
        <div class="credit-item">
          <span class="credit-name">测试2</span>
          <span class="credit-desc">测试222</span>
        </div>
        <div class="credit-item">
          <span class="credit-name">测试3</span>
          <span class="credit-desc">测试333</span>
        </div>
        <div class="credit-item">
          <span class="credit-name">测试4</span>
          <span class="credit-desc">测试444</span>
        </div>
        <div class="credit-item">
          <span class="credit-name">所有反馈问题的玩家</span>
          <span class="credit-desc">让工具变得更好</span>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="primary" @click="close">关闭</UiButton>
    </template>
  </UiModal>
</template>

<style scoped>
.author-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 18px;
}
.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  margin-bottom: 10px;
  border: 2px solid var(--border-color, #8f7351);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
.author-name {
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 2px;
}
.social-links {
  display: flex;
  gap: 14px;
}
.social-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.social-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 10px;
  font-weight: bold;
  color: white;
}
.taptap {
  background: rgba(0, 153, 153, 0.12);
  color: #007777;
  border-color: rgba(0, 153, 153, 0.35);
}
.taptap .social-icon { background: #008a8a; }
.bilibili {
  background: rgba(251, 114, 153, 0.12);
  color: #c23b62;
  border-color: rgba(251, 114, 153, 0.35);
}
.bilibili .social-icon { background: #fb7299; }
.social-item:hover {
  text-decoration: none;
  filter: brightness(1.05);
}

.credits-section {
  padding: 14px;
}
.credits-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-align: center;
  letter-spacing: 2px;
}
.credits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.credit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  padding-bottom: 7px;
  border-bottom: 1px dashed var(--border-faint);
}
.credit-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.credit-name {
  color: var(--text-main);
  font-weight: 600;
}
.credit-desc {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
