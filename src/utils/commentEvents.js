import { ref } from 'vue'

/**
 * 评论事件的跨组件广播。
 *
 * 为什么需要：发表区（`CommentComposer`）与右栏预览（`App.vue`）是**互不相识的两棵子树**，
 * 而发表成功后右栏必须立刻更新——否则用户会看到"我刚发的评论只出现在左边"
 * （用户实际反馈过："发完右边没同步过去"）。
 *
 * 用一个极小的共享信号而不是把状态提升/层层透传：
 * 右栏只需 watch 这个信号，发表方 bump 一下即可，两边解耦。
 *
 * 信号里带**新评论对象**：消费方可以直接把它插进自己的列表，不必重新请求接口。
 * 重新拉取会替换整个列表（DOM 销毁重建），表现为"右栏闪一下"（实测反馈）；
 * 插入一条则零重建。
 */
export const commentPostedAt = ref(0)
export const lastPostedComment = ref(null)

/** 发表成功后调用，通知关心评论列表的地方去更新 */
export function notifyCommentPosted(comment = null) {
  lastPostedComment.value = comment
  commentPostedAt.value += 1
}
