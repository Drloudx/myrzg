<template>
  <div class="page-view-container discussions-page">
    <!--
      讨论区是**独立路由**（不是就地替换内容区）：链接可分享可刷新、
      滚动隔离在这个容器里，也不必让各视图各自接入"聊天模式"状态。

      `?page=` 指定讨论归属（从详情进来时带上），缺省则是全站最新。
      URL 同步遵循 SPEC 第四章：只实现真正支持的参数。
    -->
    <!-- 外层不做 collapsible：UiSection 折叠时会把 title-end 渲染进 <button> 里，
         而这里放的是"查看全站最新"按钮，会形成按钮嵌套（非法）。 -->
    <UiSection :title="sectionTitle" class="discussion-main">
      <template #title-end>
        <button v-if="pageKey" type="button" class="discussion-switch" @click="showLatest">
          查看全站最新
        </button>
      </template>

      <!--
        讨论正文：**滚动只在这个容器内**（用户明确要求"内容只在这个区域内滚动，不能超出"）。
        `overflow-y: auto` + 受父级 flex 高度约束，因此消息再多也不会把整页撑长。
      -->
      <div class="discussion-scroll">
        <CommentsPanel
          v-if="pageKey"
          :key="pageKey"
          :page-key="pageKey"
          :page-label="pageLabel"
          title=""
        />
        <template v-else>
          <!-- 全站最新是只读预览，发表区在下面单独给（需要先选定讨论归属） -->
          <CommentsPanel title="" recent read-only :limit="50" show-page @open-page="goToPage" />
          <p class="discussion-hint">
            想发言请先打开对应的图鉴条目，在那里参与讨论——每条讨论都归属到具体的物品/角色/关卡。
          </p>
        </template>
      </div>
    </UiSection>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiSection } from '../components/ui/index.js'
import CommentsPanel from '../components/CommentsPanel.vue'

const route = useRoute()
const router = useRouter()

/** `?page=item:item_00001`；缺省为空 = 全站最新 */
const pageKey = computed(() => String(route.query.page || ''))

/** 归属页面的名字；从 query 带过来（详情页知道它，我们不必反查物品表） */
const pageLabel = computed(() => String(route.query.label || ''))

const sectionTitle = computed(() => (pageKey.value ? `讨论：${pageLabel.value || pageKey.value}` : '全站最新讨论'))

/** 回到全站最新（清掉 page/label，保留其它无关参数的行为与其它页面一致：只清自己的） */
function showLatest() {
  const query = { ...route.query }
  delete query.page
  delete query.label
  router.replace({ path: '/discussions', query })
}

/**
 * 点"来自某页面"的胶囊 → 切到那条讨论。
 * 不跳转到图鉴页（用户可能只想在这里接着看那条的讨论），只换 `page`。
 */
function goToPage(comment) {
  router.push({
    path: '/discussions',
    query: { page: comment.pageKey, label: comment.pageLabel || '' }
  })
}
</script>

<style scoped>
/* 只保留业务布局；面板/按钮/章节样式一律来自 theme.css 与 Ui 组件 */
.discussions-page {
  display: flex;
  flex-direction: column;
  /* 用 --vh100 而不是字面量 dvh：旧内核不认 dvh 会整条丢弃（见 UI 组件库 1.6） */
  min-height: calc(var(--vh100) - var(--header-height, 60px) - var(--safe-top, 0px) - 53px);
}

.discussion-main {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/*
 * 滚动容器：`min-height: 0` 是关键——flex 子项默认 min-height:auto 会被内容撑开，
 * 那样消息一多就会把整页撑长、滚动条跑到页面外层（正是用户要求避免的"超出区域"）。
 */
.discussion-scroll {
  flex: 1 1 auto;
  min-height: 0;
  max-height: min(72vh, calc(var(--vh100) - 320px));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.discussion-hint {
  margin: 10px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.discussion-switch {
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
