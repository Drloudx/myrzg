<template>
  <div class="page-view-container discussions-page">
    <!--
      这是**站内总讨论区**：归属键固定为 `site:general`，与各图鉴页面的讨论
      （`item:xxx`、`hero:xxx`…）是**完全分开**的两套内容，不聚合、不互相搬运。
      各页面的讨论在各自详情里，右栏只做"全站最新"的发现入口。

      外层纸张面板：内容直接铺在地图背景上会看不清，与符石图鉴的内容区同一形态。
    -->
    <section class="discussion-panel paper-panel">
      <header class="discussion-head">
        <h3 class="discussion-title">◆ 站内讨论区</h3>
      </header>

      <!--
        正文区：**只有列表在这里滚**。
        `overflow-y: auto` + `min-height: 0` 让它受父级高度约束，消息再多也不会把整页撑长。
        `reverse` = 聊天式排序（最新在最后，紧挨下方输入框）；组件内部会自动滚到底。
      -->
      <div ref="scrollRoot" class="discussion-scroll">
        <CommentsPanel
          ref="listRef"
          :page-key="SITE_PAGE_KEY"
          :page-label="SITE_PAGE_LABEL"
          title=""
          read-only
          reverse
        />
      </div>

      <!--
        发表区：**放在滚动容器之外**，因此始终固定在面板底部（用户要求"悬浮"）。
        留在容器里就只能跟着列表滚，消息一多会被推出视野——那是"列表底部"不是"容器底部"。
      -->
      <CommentComposer
        class="discussion-composer"
        :page-key="SITE_PAGE_KEY"
        :page-label="SITE_PAGE_LABEL"
        @posted="onPosted"
      />
    </section>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import CommentsPanel from '../components/CommentsPanel.vue'
import CommentComposer from '../components/CommentComposer.vue'
import { SITE_PAGE_KEY, SITE_PAGE_LABEL } from '../utils/commentApi.js'

const listRef = ref(null)
/** 滚动容器 DOM（`ref` 在 setup 期间为 null，所以必须 watch 而不是直接调用） */
const scrollRoot = ref(null)

function scrollToLatest() {
  const el = scrollRoot.value
  if (el) el.scrollTop = el.scrollHeight
}

/**
 * 等布局真正落定后再滚。
 *
 * 只 `await nextTick()` 不够：实测"刚打开页面"时 `scrollTop` 仍是 0
 * （范围却有 1040px）——那时列表项刚插入但还没完成布局，`scrollHeight` 还是旧值。
 * 双 rAF 等到下一帧绘制后，高度才是最终值。
 */
function scrollToLatestAfterLayout() {
  requestAnimationFrame(() => requestAnimationFrame(scrollToLatest))
}

/**
 * 发表后刷新列表（发表区在列表组件之外，由这里把两者接起来），
 * 刷新完滚动到最新一条（刚发的内容在最下面）。
 */
async function onPosted() {
  await listRef.value?.reload()
  await nextTick()
  scrollToLatestAfterLayout()
}

/**
 * 聊天式视图应停在最新一条：列表首次载入后滚到底部。
 * watch `scrollRoot` 而不是在 setup 里直接滚动——setup 执行时 `ref` 还没绑定。
 */
watch(
  scrollRoot,
  async (el) => {
    if (!el) return
    await nextTick()
    scrollToLatestAfterLayout()
  },
  { immediate: true }
)

/** 列表条数变化（首次载入完成）后也滚到最新 */
watch(
  () => listRef.value?.commentsLength,
  async (n) => {
    if (!n) return
    await nextTick()
    scrollToLatestAfterLayout()
  }
)
</script>

<style scoped>
/* 只保留业务布局；按钮/空态等样式仍来自 theme.css 与 Ui 组件 */
.discussions-page {
  display: flex;
  flex-direction: column;
  /* 用 --vh100 而不是字面量 dvh：旧内核不认 dvh 会整条丢弃（见 UI 组件库 1.6） */
  min-height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
}

/*
 * 内容区纸张底：与符石图鉴的 `.runes-content`（`background: var(--paper)` + 内边距）同一形态。
 * 不加这层的话讨论直接铺在地图背景上，空态与提示文字几乎读不出来。
 */
.discussion-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 14px calc(14px + var(--safe-bottom, 0px));
  background: var(--paper);
}

.discussion-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-faint);
}

.discussion-title {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
  line-height: 1.6;
}

/*
 * 滚动容器：`min-height: 0` 是关键——flex 子项默认 min-height:auto 会被内容撑开，
 * 那样消息一多就会把整页撑长、滚动条跑到页面外层（正是用户要求避免的"超出区域"）。
 * 发表区**不在这里面**，所以它始终固定在面板底部。
 */
.discussion-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding-right: 2px;
}

/* 发表区：固定在滚动容器之外的下方，与列表之间加一条分隔线 */
.discussion-composer {
  flex: 0 0 auto;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-faint);
}

/*
 * 桌面端给面板一个**明确高度**，让内部 flex 自己去分配：
 * 列表区拿剩余空间（并内部滚动），发表区按内容高度固定在下沿。
 *
 * 为什么必须显式给高度：桌面端 App.vue 会把 `[data-main-scroll]` 的滚动整个禁用
 * （`overflow-y: visible !important; max-height: none !important`），改由整页滚动。
 * 若不在这里封顶，讨论列表会无限长，发表区被顶出屏幕、整页也会多出一条滚动条
 * （实测：.app-container scrollHeight 950 > 900）。
 *
 * `- 190px` 覆盖：顶部 33px 吸附留白 + 面板内边距 + 标题栏 + 发表区。
 */
@media (min-width: 1025px) {
  .discussion-panel {
    height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 190px);
  }
}
</style>
