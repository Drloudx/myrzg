<template>
  <div class="dialog-lines paper-panel-solid">
    <div
      v-for="(line, idx) in lines"
      :key="idx"
      class="dialog-line"
      :class="{ 'option-row': line.isOption }"
    >
      <template v-if="line.isOption">
        <span class="dialog-name">小工匠：</span>
        <div class="options-container">
          <div v-for="(opt, oIdx) in line.options" :key="oIdx" class="option-bubble">
            <span class="option-num">{{ oIdx + 1 }}.</span>
            <span class="option-text">{{ opt }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <span v-if="line.speaker" class="dialog-name">{{ line.speaker }}：</span>
        <span class="dialog-text">{{ line.text }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
/**
 * TaskDialogLines —— 任务对话展示（羊皮纸便签风格）
 */
defineProps({
  lines: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.dialog-lines {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 6px 0 2px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.dialog-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main, #3e2a14);
  min-width: 0;
  text-align: left;
  text-shadow: none;
  -webkit-font-smoothing: antialiased;
}
.dialog-name {
  flex: 0 0 auto;
  font-weight: 700;
  color: var(--accent-ink, #557574);
  text-align: left;
}
.dark-mode .dialog-name {
  color: var(--accent-bright, #93b3b2);
}
.dialog-text {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  text-align: left;
}

.options-container {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  text-align: left;
}

.option-bubble {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  background: rgba(233, 220, 195, 0.8);
  border: 1px solid var(--border-faint, rgba(143, 115, 81, 0.25));
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--text-main, #3e2a14);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
  text-align: left;
}

.option-num {
  font-weight: 700;
  color: var(--accent-ink, #557574);
  flex-shrink: 0;
}
.dark-mode .option-num {
  color: var(--accent-bright, #93b3b2);
}

.option-text {
  font-weight: 500;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;
}
</style>
