import { reactive } from 'vue'

export const rewardModalState = reactive({
  visible: false,
  title: '',
  entries: []
})

export function openRewardDetail(title, entries = []) {
  rewardModalState.title = title || '掉落'
  rewardModalState.entries = entries || []
  rewardModalState.visible = true
}

export function closeRewardDetail() {
  rewardModalState.visible = false
  rewardModalState.title = ''
  rewardModalState.entries = []
}
