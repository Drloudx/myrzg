<template>
  <GachaStage :backdrop="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')">
    <!-- 背板：游戏结果页背后是揭晓同一张暗色殿堂底图（1700×1220，中央带纹章）——
         此前用纯色渐变，用户指认「没有背景」。这里铺 `bg.png`，再叠 `Rconer` / `Rconer2`
         两张原图（prefab 里 α0.2549 / 0.0510 的同尺寸压角层）。 -->
    <div class="g-abs g-layer-bg result-backdrop" :style="gachaPos(0, 0)">
      <img :src="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')" alt="" class="result-backdrop__bg" />
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/Rconer.png')" alt="" class="result-backdrop__corner" />
      <img
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/Rconer2.png')"
        alt=""
        class="result-backdrop__corner result-backdrop__corner--soft"
      />
    </div>

    <!-- 游戏结果页没有标题文本（prefab 只有 22 个 UILabel：×N / 或 / 数字 / 按钮文案），
         本站此前的「招募结果 · 本次共 N 个」会与右上货币条同一行重叠，故移除。 -->

    <!-- 结果一览：**蜂窝错半格网格**（prefab `HeroShowPanel/Scrollview/grid` 真实坐标：
         中排 4 张 (-420/−140/140/420, 0)、上排 3 张 (-280/0/280, 140)、下排 3 张 (-280/0/280, -140)，
         列步进 140、行距 140、卡片 256×256（`gacha_card_botm` 原始尺寸），对角相邻互相咬合。
         卡片序号 0/3/6/9 在中排、1/4/7 在上排、2/5/8 在下排——不是按顺序切行。
         卡片在游戏里**不可点击**（`HeroShowItem` 无交互），不跳转图鉴。 -->
    <div class="g-abs g-layer-ui result-diamonds" :style="gachaPos(0, 0)">
      <div
        v-for="(item, index) in items"
        :key="`${item.typeId}-${index}`"
        class="result-diamond"
        :class="`result-diamond--q${cardQuality(item)}`"
        :style="diamondStyle(index)"
        :title="`${item.name}（${cardQuality(item)} 星${item.isNew ? ' · 新获得' : ''}）`"
      >
        <img
          class="rd__base"
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/gacha_card_botm${cardQuality(item)}.png`)"
          alt=""
        />
        <img class="rd__portrait" :src="getImageUrl(cardFace(item))" :alt="item.name" />
        <!-- 重复获得底衬：`gacha_card_reget` 240×68 @(0,-48)（prefab `fragmentBg`，
             重复获得时由 fragmentEndAni 淡入；新角色不显示）。 -->
        <img
          v-if="!item.isNew"
          class="rd__reget"
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_card_reget.png')"
          alt=""
        />
        <img
          class="rd__frame"
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/gacha_card_frame${cardQuality(item)}.png`)"
          alt=""
        />
        <!-- 职业 / 属性角标 64×64：class @(68,-40)、element @(102,-6)（prefab `new/class`、`new/element`） -->
        <img
          v-if="item.job"
          class="rd__class"
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/gacha_card_class${item.job}.png`)"
          alt=""
        />
        <img
          v-if="item.element"
          class="rd__atr"
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/gacha_card_atr${item.element}.png`)"
          alt=""
        />
        <!-- 新角色：`gacha_card_new` 60×24 ×scale3 @(0,-48)，坐在底衬位（居中） -->
        <img
          v-if="item.isNew"
          class="rd__new"
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_card_new.png')"
          alt="新"
        />
        <!-- 重复获得：碎片图标 108×108 @(-10,8) + ×N 计数 20px @(18,-40)
             （prefab `fragment` / `fragmentCnt`；碎片图取 `icon.Replace("at","chara")+"_p"`） -->
        <template v-else-if="fragmentCount(item)">
          <span class="rd__frag">
            <img :src="getImageUrl(item.fragment || item.icon)" alt="" />
          </span>
          <em class="rd__frag-cnt g-text">×{{ fragmentCount(item) }}</em>
        </template>
        <!-- 星级：`com_stars_{rare}` 连体星条（3/4/5 星 = 96/120/144×48） -->
        <img
          class="rd__stars"
          :src="getImageUrl(`/images/Common_Atlas/com_stars_${cardQuality(item)}.png`)"
          alt=""
        />
      </div>
    </div>

    <!-- ── BottomRight：OnceButton / TenButton（com_btn_N_sp / com_btn_Y_sp 292×72）。
         源码 `HeroShowUI.CheckHeroExcit`：单抽结果只显示 onceButton（slotId≠4），十连只显示
         tenButton；消耗行按 `SetPoolButtonConsume`（券 ×N 或 交换货币 ×M），样式与卡池页一致。 ── -->
    <template v-if="drawOption">
      <button
        class="g-abs g-layer-interactive g-hit g-focusable g-slice result-btn"
        :class="drawOption.count === 1 ? 'g-slice--btn-n' : 'g-slice--btn-y'"
        :style="gachaPos(400 + drawOption.offsetX, -316)"
        type="button"
        :disabled="!drawOption.enabled"
        @click="emit('again', drawOption.count)"
      >
        <span class="g-text g-text--lg result-btn__label" :class="{ 'result-btn__label--ten': drawOption.count === 10 }">
          {{ drawOption.label }}
        </span>
      </button>
      <!-- 抽取消耗行：与卡池页同款（gacha_btn_tag 底板，浮在按键上方 52） -->
      <div class="g-abs g-layer-ui draw-cost" :style="gachaPos(400 + drawOption.offsetX, -264)">
        <img class="draw-cost__plate" :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_btn_tag.png')" alt="" />
        <img class="draw-cost__icon" :src="getImageUrl(drawOption.ticket.icon)" alt="" />
        <span class="g-text g-text--md" :class="{ 'g-text--danger': !drawOption.ticket.enough }">{{ drawOption.ticket.text }}</span>
        <template v-if="drawOption.exchange">
          <span class="g-text g-text--md draw-cost__or">或</span>
          <img class="draw-cost__icon" :src="getImageUrl(drawOption.exchange.icon)" alt="" />
          <span class="g-text g-text--md">{{ drawOption.exchange.text }}</span>
        </template>
      </div>
    </template>

    <!-- ── TopRight：货币条（itemTip/keTip/payKeTip，槽位同卡池页）+ 关闭 com_btn_close。
         源码 `CheckHeroExcit` 结束后 `topRightObj.SetActive(true)`；本页无音效开关，
         整行右锚定回 prefab 原位 526（卡池页因音效开关左移到 462）。 ── -->
    <div
      class="g-abs g-layer-ui currency-row"
      :style="{ right: 'calc(50% - 526px)', top: 'calc(50% - 335px)', transform: 'translateY(-50%)' }"
    >
      <div v-for="slot in currencySlots" :key="slot.key" class="currency-slot">
        <div class="g-slice g-slice--top-item currency-slot__bg" aria-hidden="true"></div>
        <img :src="getImageUrl(slot.icon)" :alt="slot.name" class="currency-slot__icon" />
        <span
          class="g-text currency-slot__label"
          :class="{ 'g-text--danger': !slot.enough }"
          :title="`${slot.name}：模拟持有 ${slot.hold}`"
        >
          {{ slot.hold }}
        </span>
        <button
          class="g-hit g-focusable currency-slot__add"
          type="button"
          :title="`补充模拟${slot.name}`"
          @click="emit('topup', slot.typeId)"
        >
          <img :src="getImageUrl('/images/MainPanel/M_rt_btn_add.png')" alt="补充" />
        </button>
      </div>
    </div>

    <!-- Share (-560,-310)：gacha_btn_share 96×96，本页用于复制结果摘要 -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable result-share"
      :style="gachaPos(-560, -310)"
      type="button"
      title="复制本次结果摘要"
      @click="copySummary"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_share.png')" alt="分享" />
    </button>

    <button
      class="g-abs g-layer-interactive g-hit g-focusable result-close"
      :style="gachaPos(587, 335)"
      type="button"
      title="关闭"
      @click="emit('close')"
    >
      <img :src="getImageUrl('/images/Common_Atlas/com_btn_close.png')" alt="关闭" />
    </button>

    <div v-if="copied" class="g-abs g-layer-ui g-text g-text--sm g-text--gold result-toast" :style="gachaPos(-560, -240)">
      已复制结果摘要
    </div>
  </GachaStage>
</template>

<script setup>
/**
 * 招募结果一览（游戏 `HeroShowPanel`）。
 *
 * 卡片使用 `gacha_card_botm{品质}` / `gacha_card_frame{品质}`（256×256、224×224，取自 prefab
 * `HeroShowPanel/Hero/HeroShowItem`），星级用 `spGachaStar02`，新获得角标 `gacha_card_new`。
 * 底部按钮沿用 `com_btn_N_sp` / `com_btn_Y_sp`（292×72，9 宫格切片）。
 *
 * 差异：游戏在 `HeroShowUI` 里用 ExtentionTweenPlay 逐张入场并支持左右分屏立绘背景，
 * 这里改为静态网格；分享按钮在游戏里是截图分享，本页改为复制文本摘要。
 */
import { computed, onMounted, ref } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { buildCurrencySlots, buildDrawOptions } from '../../utils/gachaCurrency'
import { playSfx } from '../../utils/gachaAudio'

const props = defineProps({
  /** 本次结果列表。 */
  items: { type: Array, default: () => [] },
  /** 当前卡池（消耗券与替代消耗来自这里）。 */
  pool: { type: Object, default: null },
  /** 池类型：hero | pet（决定「招募/购买」文案与货币条槽位）。 */
  kind: { type: String, default: 'hero' },
  /** 模拟钱包（货币条持有量与消耗行是否变红）。 */
  wallet: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['again', 'close', 'topup'])

const copied = ref(false)

/**
 * 结果面板的抽取按钮：源码 `HeroShowUI.CheckHeroExcit` 单抽只亮 onceButton、十连只亮
 * tenButton，这里按本次抽取次数取对应档位（文案/消耗/可用性共用卡池页的构建器）。
 */
const drawOption = computed(() => {
  const count = props.items.length === 1 ? 1 : 10
  return buildDrawOptions(props.pool, props.wallet, props.kind).find(option => option.count === count) ?? null
})

const currencySlots = computed(() => buildCurrencySlots(props.pool, props.wallet, props.kind))

/** 卡框品质：角色池取 rank（3/4/5），魔物蛋池取 quality（3/4/5）。 */
function cardQuality(item) {
  const value = Number(item.rank ?? item.quality ?? 3)
  return [3, 4, 5].includes(value) ? value : 3
}

/** 卡面：游戏取 `hero.icon.Replace("at","gacha_at")`（`gacha_at*.png` 200×200）。 */
function cardFace(item) {
  return item.card || item.icon
}

/** 重复获得的转化数量（碎片 / 星币）。 */
function fragmentCount(item) {
  return Number(item.fragments ?? 0)
}

/**
 * 蜂窝错半格网格：prefab `Scrollview/grid` 的真实卡位（NGUI +y 向上）。
 * 中排 4 张（序号 0/3/6/9）、上排 3 张（1/4/7）、下排 3 张（2/5/8），
 * 列步进 140、行距 140、卡片 256×256；单抽 `heroSingle` 居中 (0,0)。
 */
const DIAMOND_SIZE = 256
const GRID_POSITIONS = [
  [-420, 0], [-280, 140], [-280, -140], [-140, 0], [0, 140],
  [0, -140], [140, 0], [280, 140], [280, -140], [420, 0]
]
function diamondStyle(index) {
  const total = props.items.length
  const [gx, gy] = total === 1 ? [0, 0] : (GRID_POSITIONS[index] ?? [0, 0])
  return {
    width: `${DIAMOND_SIZE}px`,
    height: `${DIAMOND_SIZE}px`,
    left: `calc(50% + ${gx}px)`,
    top: `calc(50% - ${gy}px)`,
    '--index': String(index)
  }
}

/**
 * 逐张入场：源码 `HeroShowUI.ShowHeroTween` 每格播 `popUpAni` 并间隔 0.15s 播 `card` 音，
 * **index 1/4/7 跳过音效与间隔**（硬编码的真正值，别按行列重排）。
 */
function popupDelay(index) {
  let delay = 0
  for (let i = 0; i < index; i += 1) {
    if (i === 1 || i === 4 || i === 7) continue
    delay += 0.15
  }
  return Number(delay.toFixed(2))
}

/** 入场音效：与 `popupDelay` 同一节奏（组件挂载时排程）。 */
function schedulePopupSounds() {
  const list = props.items ?? []
  list.forEach((item, index) => {
    if (index === 1 || index === 4 || index === 7) return
    window.setTimeout(() => playSfx('card'), popupDelay(index) * 1000 + 80)
  })
}

/** 复制结果摘要（替代游戏的截图分享，避免伪造分享图）。 */
async function copySummary() {
  const text = props.items.map(item => `${item.rank ?? item.quality}星 ${item.name}`).join('\n')
  try {
    await navigator.clipboard.writeText(`深歌小助手 · 模拟招募\n${text}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch {}
}

onMounted(schedulePopupSounds)
</script>

<style scoped>
/* 结果页背板：揭晓同一张殿堂底图（`bg.png` 1684×1204）+ Rconer/Rconer2 压角层。
   底图整幅铺满（多余部分裁掉），保证中央纹章与四条斜纹都在画面内。 */
.result-backdrop {
  width: 1534px;
  height: 750px;
  overflow: hidden;
}

.result-backdrop__bg,
.result-backdrop__corner {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1684px;
  height: 1204px;
  transform: translate(-50%, -50%);
  object-fit: fill;
}

.result-backdrop__corner { opacity: 0.2549; }
.result-backdrop__corner--soft { opacity: 0.051; }

/* 结果区：菱形卡绝对定位（位置由 `diamondStyle()` 给，prefab 蜂窝网格），不是网格流布局 */
.result-diamonds {
  width: 1534px;
  height: 750px;
  pointer-events: none;
}

/* 菱形卡：`gacha_card_botm{rare}` 256×256 底板 + 200×200 卡面 + `gacha_card_frame{rare}` 224×224 边框。
   入场 = popUpAni：localScale **(0,1,1) → (1,1,1)**（横向展开），delay 由 `popupDelay()` 给。
   卡片在游戏里不可点击（`HeroShowItem` 无交互），`pointer-events:none` 防止点击推进时误触。 */
.result-diamond {
  position: absolute;
  border: 0;
  padding: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: result-diamond-popup 0.4s cubic-bezier(0.22, 1.2, 0.36, 1) calc(var(--index, 0) * 0.15s) both;
  transform-origin: center center;
}

@keyframes result-diamond-popup {
  0% { opacity: 0; transform: translate(-50%, -50%) scaleX(0); filter: brightness(2.8); }
  60% { opacity: 1; transform: translate(-50%, -50%) scaleX(1.04); filter: brightness(1.25); }
  to { opacity: 1; transform: translate(-50%, -50%) scaleX(1); filter: brightness(1); }
}

/* 卡内元素统一以 256 卡片为基准的百分比定位（prefab `HeroShowItem` 子节点）：
   百分比 = 50% + 坐标/256，尺寸 = 原始像素/256。 */
.rd__base,
.rd__frame {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.rd__base { width: 100%; height: 100%; object-fit: contain; }

/* 重复获得底衬 `gacha_card_reget` 240×68 @(0,-48) */
.rd__reget {
  position: absolute;
  left: 50%;
  top: 68.75%;
  width: 93.75%;
  height: 26.56%;
  transform: translate(-50%, -50%);
  object-fit: fill;
  pointer-events: none;
  animation: reveal-fade-in 0.3s ease-out both;
}

/* 卡面 `heroIcon` = `gacha_at*.png` 200×200 居中 */
.rd__portrait {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 78.125%;
  height: 78.125%;
  transform: translate(-50%, -50%);
  object-fit: contain;
  pointer-events: none;
}

/* 职业 / 属性角标 64×64：class @(68,-40)、element @(102,-6)（prefab `new/class`、`new/element`） */
.rd__class,
.rd__atr {
  position: absolute;
  width: 25%;
  height: 25%;
  transform: translate(-50%, -50%);
  object-fit: contain;
  pointer-events: none;
}

.rd__class { left: 76.56%; top: 65.63%; }
.rd__atr { left: 89.84%; top: 52.34%; }

/* 新角色角标：`gacha_card_new` 60×24 ×scale3 = 180×72 @(0,-48)（坐在 reget 底衬位，居中） */
.rd__new {
  position: absolute;
  left: 50%;
  top: 68.75%;
  width: 70.31%;
  height: 28.13%;
  transform: translate(-50%, -50%);
  object-fit: contain;
  pointer-events: none;
  animation: reveal-star-pop 0.45s ease-out both;
}

/* 重复获得：碎片图标 108×108 @(-10,8) + ×N 20px @(18,-40) */
.rd__frag {
  position: absolute;
  left: 46.09%;
  top: 46.88%;
  width: 42.19%;
  height: 42.19%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.rd__frag img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.55));
}

.rd__frag-cnt {
  position: absolute;
  left: 57.03%;
  top: 65.63%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  font-style: normal;
  color: #fff6e2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}

/* 星级：`com_stars_{rare}` 连体星条 @(0,-77)，3/4/5 星 = 96/120/144 × 48 */
.rd__stars {
  position: absolute;
  left: 50%;
  top: 80.08%;
  height: 18.75%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.result-diamond--q3 .rd__stars { width: 37.5%; }
.result-diamond--q4 .rd__stars { width: 46.88%; }
.result-diamond--q5 .rd__stars { width: 56.25%; }

.result-btn {
  width: 292px;
  height: 72px;
  background: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-btn .g-text {
  position: relative;
  z-index: 1;
}

/* 按钮文案颜色与卡池页一致：一次 = 米金 #cfba96（红钮），十次 = 青 #33dad0（青钮） */
.result-btn__label {
  font-size: 24px;
  font-weight: 700;
  color: #cfba96;
}

.result-btn__label--ten {
  color: #33dad0;
}

.result-share {
  border: 0;
  width: 96px;
  height: 96px;
  background: none;
  padding: 0;
}

.result-share img { width: 96px; height: 96px; }

.result-close {
  border: 0;
  width: 100px;
  height: 68px;
  background: none;
  padding: 0;
}

.result-close img { width: 100px; height: 68px; }

.result-toast {
  width: 260px;
  text-align: center;
}
</style>
