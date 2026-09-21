<template>
  <UiModal
    :visible="rewardModalState.visible"
    :title="`${rewardModalState.title} · 掉落概率明细`"
    max-width="640px"
    :z-index="13000"
    teleport-to="body"
    @update:visible="val => !val && closeRewardDetail()"
  >
    <div class="reward-prob-modal-body">
      <RewardPools breakdown :entries="rewardModalState.entries" @item-click="handleItemClick" />
    </div>
  </UiModal>
</template>

<script setup>
import { UiModal } from './ui/index.js'
import RewardPools from './RewardPools.vue'
import { rewardModalState, closeRewardDetail } from '../utils/rewardModalState.js'
import { openItemDetail } from '../utils/itemModalState.js'

const handleItemClick = (typeId) => {
  openItemDetail({ typeId })
}
</script>

<style scoped>
.reward-prob-modal-body {
  padding: 4px 0 12px;
}
</style>
