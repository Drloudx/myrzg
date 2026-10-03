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
          load-more-on-scroll
          @loading-earlier="(busy) => (suppressAutoScroll = busy)"
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
 * 抑制"自动滚到最新"的标志。
 *
 * 往上翻历史（自动加载更早消息）时，`commentsLength` 会变化，
 * 若不管就会把用户又拽回底部（同时也会覆盖 CommentsPanel 内部的锚点补偿）。
 */
let suppressAutoScroll = false

/**
 * 发表后：
 *   - 正常评论：**只把新那一条并进列表**（不重拉整页，避免列表重建导致滚动条闪烁）；
 *   - 进了待审（`pending`）：它不在公开列表里，才需要重拉一次以保持与真实状态一致。
 * 两种情况都滚到最新一条。
 */
async function onPosted(data) {
  if (data?.pending) {
    await listRef.value?.reload()
  } else if (data?.comment) {
    listRef.value?.addPostedComment(data.comment)
  }
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

/** 列表条数变化（首次载入完成／发表追加）后滚到最新；往上翻历史时不滚 */
watch(
  () => listRef.value?.commentsLength,
  async (n) => {
    if (!n || suppressAutoScroll) return
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
 *
 * `overflow-anchor: none`：关掉浏览器的**滚动锚定**。它在追加内容时会自行调整滚动位置，
 * 与我们的"滚到最新"互相打架，表现为发表瞬间位置抖动、滚动条闪一下（用户反馈）。
 *
 * `scrollbar-gutter: stable`：滚动条出现/消失不再改变内容宽度，
 * 避免"滚动条一变、列表重排一下"的连带闪烁。
 */
.discussion-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  overflow-anchor: none;
  scrollbar-gutter: stable;
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
 * 面板高度用 CSS 固定值（**不要改成脚本量高度**，见下）。
 *
 * 桌面端 App.vue 会把 `[data-main-scroll]` 的滚动整个禁用
 * （`overflow-y: visible !important; max-height: none !important`），改由整页滚动。
 * 不封顶的话讨论列表会无限长、发表区被顶出屏幕、整页多出一条滚动条
 * （实测：.app-container scrollHeight 950 > 900）。
 *
 * `- 190px` 覆盖：顶部 33px 吸附留白 + 面板内边距 + 标题栏 + 发表区。
 *
 * ⚠️ 曾经改成"用 JS 量出真实高度"（`innerHeight - top - 8`）想消除闪烁，
 * 结果**高度不对**（用户反馈），已回退到这个 CSS 固定值。
 * 若要再动高度，务必先在 1025 / 1161 / 1440 三种视口下核对
 * 「输入区底边 ≤ 视口高」且「.app-container 无纵向溢出」。
 */
@media (min-width: 1025px) {
  .discussion-panel {
    height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 190px);
  }
}
</style>
