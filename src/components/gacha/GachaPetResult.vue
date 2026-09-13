<template>
  <!-- 蛋池结算弹层（游戏 `GetRewardTip`）：
       mask(`white` 1534×750 α0.502) + 底板 `item_get`(1534×472) + 标题条 `item_get_titel`(220×44)
       + `ItemBagCell` Large 格（`item_f_{quality}` 128×128 / icon 96×96 / 连体星条 `com_stars_{rarity}`）。
       逐格 0.1s 出现 + `itemGet` 音；点击两段式：第一下补完剩余格、第二下关闭回到卡池页。 -->
  <GachaStage clear>
    <div class="g-abs g-layer-bg tip-mask" :style="gachaPos(0, 0)" @click="handleClick"></div>

    <div class="g-abs g-layer-ui tip-plate" :style="gachaPos(0, 0)" @click="handleClick">
      <img :src="getImageUrl('/images/TipsManager_Atlas/item_get.png')" alt="" class="tip-plate__bg" />
      <img :src="getImageUrl('/images/TipsManager_Atlas/item_get_titel.png')" alt="获得物品" class="tip-plate__title" />
      <p class="tip-plate__tip g-text g-text--xs">{{ showComplete ? '再次点击关闭' : '点击补齐全部结果' }}</p>
    </div>

    <!-- 结算格：`ItemBagCell` Large（140×140 槽位、128×128 品质框、96×96 图标），
         游戏里一行 **8 格**；魔物蛋不显示数量（源码 `category[0]==6 → SetCnt(0)`），
         非蛋产物在右下显示数量；星级连体条在**框内顶部**（`(0,39)`）。
         结算格在游戏里不可单独点击（点整层 = 补完/关闭），不跳转图鉴。 -->
    <div class="g-abs g-layer-ui tip-grid" :style="gachaPos(0, -10)">
      <div
        v-for="(item, index) in items"
        :key="`${item.typeId}-${index}`"
        class="tip-cell"
        :class="[{ 'tip-cell--in': visibleCount > index }, `tip-cell--q${cellQuality(item)}`]"
        :title="cellTitle(item)"
      >
        <img
          :src="getImageUrl(`/images/ItemBagPanel/item_f_${cellQuality(item)}.png`)"
          alt=""
          class="tip-cell__frame"
        />
        <img :src="getImageUrl(cellIcon(item))" :alt="item.name" class="tip-cell__icon" />
        <img
          :src="getImageUrl(`/images/Common_Atlas/com_stars_${cellQuality(item)}.png`)"
          alt=""
          class="tip-cell__stars"
        />
        <span v-if="showCount(item)" class="g-text g-text--sm tip-cell__count">{{ item.count }}</span>
      </div>
    </div>
  </GachaStage>
</template>

<script setup>
/**
 * 魔物蛋池「抽蛋结束」结算面板（游戏 `GetRewardTip` 的还原）。
 *
 * 数据链路（源码）：`PetGachaAniPanel.OnClickNext` 最后一只 → `Close()` +
 * `backpackServerData.GetReward(reward, "抽蛋继续显示")` → `GetRewardUI` → `TipsManager.ShowReward`
 * → `getRewardTip.ShowRewardList(...)`。面板是**盖在卡池页之上的弹层**（UIPanel depth 1080），
 * 关掉后才回到仍开着的卡池页（消耗与保底此时已刷新）。
 *
 * 逐格出现：`GetRewardTip.ShowRewardItem` 每格 `ItemFlashEffect.StartRewardDisplayEffect`
 * （按品质分级的框/图标闪光）+ α=1 + `PlayUISound("itemGet")` + `WaitForSecondsRealtime(0.1)`。
 * 点击行为（`GetRewardTip.Close`）：`!showComplete` → 停协程、剩余格一次性补完，**不关**；
 * 已 `showComplete` → 关闭并回调（蛋池的 `getHeroRewardTip` 恒为空，关闭后即回卡池页）。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { playSfx } from '../../utils/gachaAudio'

const props = defineProps({
  /** 本次抽取结果列表（结算格顺序即结果顺序）。 */
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])

/** 逐格出现节奏：`SHOW_TIME = 0.1f`（源码常量）。 */
const SHOW_TIME = 100
const visibleCount = ref(0)
const showComplete = ref(false)
let timers = []

/** 品质（3/4/5）→ 品质框与连体星条档位。 */
function cellQuality(item) {
  const value = Number(item.rank ?? item.quality ?? 3)
  return [3, 4, 5].includes(value) ? value : 3
}

/** 结算格图标：魔物蛋用蛋图（`Texture/pet/eggs/*`，与游戏一致）。 */
function cellIcon(item) {
  return item.egg || item.icon || ''
}

/** 魔物蛋不显示数量（源码 `ItemBagCellUI.InitRewardShowUI` 对 `category[0]==6` 调 `SetCnt(0)`）。 */
function isPetEgg(item) {
  return Boolean(item.egg)
}

function showCount(item) {
  return !isPetEgg(item) && Number(item.count ?? 1) > 1
}

function cellTitle(item) {
  const count = Number(item.count ?? 1)
  return isPetEgg(item) || count <= 1 ? item.name : `${item.name} ×${count}`
}

function scheduleShow() {
  timers = []
  visibleCount.value = 0
  showComplete.value = false
  if (!props.items.length) {
    showComplete.value = true
    return
  }
  props.items.forEach((item, index) => {
    timers.push(window.setTimeout(() => {
      visibleCount.value = index + 1
      playSfx('itemGet')
      if (index === props.items.length - 1) showComplete.value = true
    }, index * SHOW_TIME + 60))
  })
}

/** 点击：未补完 → 一次性补完；已补完 → 关闭回到卡池页（源码 `GetRewardTip.Close`）。 */
function handleClick() {
  if (!showComplete.value) {
    timers.forEach(id => window.clearTimeout(id))
    timers = []
    visibleCount.value = props.items.length
    showComplete.value = true
    return
  }
  emit('close')
}

onMounted(scheduleShow)
onBeforeUnmount(() => { timers.forEach(id => window.clearTimeout(id)) })
</script>

<style scoped>
/* mask：源码 UISprite `white`、mColor.a=0.502 —— **白 50% 冲洗**盖在仍开着的卡池页上
   （实机结算截图：背景整体变淡发白，衬托底板），不是压暗。
   舞台用 `clear`：卡池页仍在背后可见。 */
.tip-mask {
  width: 1534px;
  height: 750px;
  background: rgba(255, 255, 255, 0.502);
  cursor: pointer;
}

/* 底板 `item_get` 512×472 → 显示 1534×472（原图 border 全 0，横向非等比拉伸是原设计） */
.tip-plate {
  width: 1534px;
  height: 472px;
  cursor: pointer;
}

.tip-plate__bg {
  position: absolute;
  inset: 0;
  width: 1534px;
  height: 472px;
  object-fit: fill;
}

/* 标题条 `item_get_titel` 220×44：实机截图里**水平居中**于底板顶部（»获得物品«） */
.tip-plate__title {
  position: absolute;
  left: 50%;
  top: 26px;
  width: 220px;
  height: 44px;
  transform: translateX(-50%);
}

.tip-plate__tip {
  position: absolute;
  right: 44px;
  bottom: 20px;
  color: #533e26;
  opacity: 0.85;
}

/* 格网格：`ItemBagCell` Large 140×140 槽位，**一行 8 格**（游戏 UIGrid）；
   行距略松、整体放在底板中上部，与游戏截图一致。 */
.tip-grid {
  width: 1176px;
  max-height: 340px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  /* 行内**左对齐**（游戏 UIGrid 逐格排布；最后一行不足 8 格时靠左） */
  justify-content: flex-start;
  gap: 10px 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  transform: translate(-50%, -50%);
  padding: 4px;
}

.tip-cell {
  position: relative;
  width: 140px;
  height: 140px;
  flex: 0 0 auto;
  padding: 0;
  opacity: 0;
  transform: scale(0.6);
}

/* 逐格出现（源码：品质闪光 + α=1；这里用弹出 + 品质色辉光近似） */
.tip-cell--in {
  animation: tip-cell-in 0.3s ease-out both;
}

@keyframes tip-cell-in {
  0% { opacity: 0; transform: scale(0.6); filter: brightness(2.6); }
  70% { opacity: 1; transform: scale(1.06); filter: brightness(1.2); }
  100% { opacity: 1; transform: scale(1); filter: brightness(1); }
}

.tip-cell__frame {
  position: absolute;
  inset: 6px;
  width: 128px;
  height: 128px;
}

.tip-cell__icon {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 96px;
  height: 96px;
  transform: translate(-50%, -50%);
  object-fit: contain;
}

/* 数量：非蛋产物在右下（`ItemBagCellUI.InitTag`：帧右下内缩 14） */
.tip-cell__count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  color: #f8eedc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

/* 连体星条：Large 档 (0,39)、高 34、宽 68/84/100（`ItemBagCellUI.CheckPetEggItem`） */
.tip-cell__stars {
  position: absolute;
  left: 50%;
  top: 39px;
  height: 34px;
  transform: translateX(-50%);
  filter: drop-shadow(0 0 3px rgba(255, 215, 100, 0.6));
}

.tip-cell--q3 .tip-cell__stars { width: 68px; }
.tip-cell--q4 .tip-cell__stars { width: 84px; }
.tip-cell--q5 .tip-cell__stars { width: 100px; }

/* 品质闪光：`ItemFlashEffect.StartRewardDisplayEffect` 按品质分级的框外辉光 */
.tip-cell--q3 .tip-cell__frame { filter: drop-shadow(0 0 6px rgba(63, 162, 255, 0.5)); }
.tip-cell--q4 .tip-cell__frame { filter: drop-shadow(0 0 8px rgba(238, 98, 241, 0.55)); }
.tip-cell--q5 .tip-cell__frame { filter: drop-shadow(0 0 10px rgba(255, 182, 77, 0.6)); }
</style>
