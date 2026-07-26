<script setup>
import BaseModal from './BaseModal.vue'

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
  <BaseModal
    :visible="modelValue"
    title="关于我们"
    @close="close"
  >
    <div class="author-section">
      <img src="/ui/author_avatar.jpg" class="about-logo" />
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

    <div class="credits-section">
      <div class="credits-title">感谢名单</div>
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
      <button class="modal-btn-confirm" @click="close">关闭</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.about-modal-card {
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
}
.author-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}
.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.author-name {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: var(--text-main);
}
.social-links {
  display: flex;
  gap: 16px;
}
.social-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
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
  background: #00cccc20;
  color: #008a8a;
}
.taptap .social-icon { background: #00cccc; }
.bilibili {
  background: #fb729920;
  color: #e83e6d;
}
.bilibili .social-icon { background: #fb7299; }

.credits-section {
  background: var(--bg);
  padding: 16px;
  border-radius: 12px;
}
.credits-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-sub);
  margin-bottom: 12px;
  text-align: center;
}
.credits-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.credit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.credit-name {
  color: var(--text-main);
  font-weight: 600;
}
.credit-desc {
  color: var(--text-sub);
  font-size: 12px;
}
</style>
