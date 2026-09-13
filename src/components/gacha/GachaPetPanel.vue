<template>
  <!-- 整页演出：PetGachaAniPanel（魔物蛋池抽蛋）的还原。
       场景 = 卡背栈（BG_main 2048×1024 d0 / BG_main_blured 1024×512 d1 / HL 1680×1000 d4）
       + 蛋池桌面 gacah_pet_desk_foreground（d3，开场自下方上升 100 归位）
       + perform_bag 蛋袋 Spine（皮肤 def）+ 出蛋与逐蛋揭晓 UI（petShowUI 24 段）。 -->
  <GachaStage :backdrop="BG_BLUR">
    <!-- ── 背景层：bgAniTween（8 段，全部 dur 1.0）。卡背整体 scale 1.834→1.005，
         过曝层 `_blured` 与高光层 `_HL` α1→0 退场，桌面自下方上升归位。 ── -->
    <div class="pet-cam" :class="{ 'pet-cam--settle': camSettled }">
      <img :src="getImageUrl(BG_BLUR)" alt="" class="pet-bg" />
      <img :src="getImageUrl('/images/gacha/gacha_cardbackground_main_output_blured.png')" alt="" class="pet-bg pet-bg--blured" />
      <img :src="getImageUrl('/images/gacha/gacha_cardbackground_HL_output.png')" alt="" class="pet-bg pet-bg--hl" />
      <img :src="getImageUrl('/images/gacha/gacah_pet_desk_foreground.png')" alt="" class="pet-bg pet-bg--desk" />
      <!-- 注：prefab 里的 `gacha_cardforeground_output_outline` 是一张 **512×388 的软边轮廓**、
           配合描边材质使用；按 1680×1000 拉伸后会变成一大片白光（用户指认的「白光」），
           故不渲染该层（需要时按原像素尺寸贴到桌面上、不要拉伸）。 -->
    </div>

    <!-- 蛋袋 Spine（perform_bag，皮肤 def）：按高度取景，相机 pad=1.08（源码口径，
         袋身约占画布高 92%，见 `utils/gachaSpinePlayer.js` 的 `pad` 实现） -->
    <div class="pet-spine-cam">
      <canvas
        ref="canvasEl"
        class="pet-spine"
        style="left: calc(50% - 767px); top: calc(50% - 375px)"
      ></canvas>
    </div>

  <!-- ── 出蛋：`eggTex`（蛋贴图 132×138）从袋口下方升起——源码 `WaitShowPet`
       TweenPosition (0,-360)→(0,+40)、delay 0.14、dur 0.36（OutQuad，`time=0.36`）。
       动画挂在 `.pet-egg__inner` 包裹层上；蛋图自身保持静态 `translate(-50%,-50%)` 居中
       —— 关键帧若直接覆盖图片 transform 会丢掉居中基准（曾导致蛋偏移 + 放大变形）。
       层级：源码 `eggTex` depth 7/8 > `eggDi` depth 5 → **蛋压在菱形框之上**，
       所以它必须排在菱形之后（DOM 顺序同层时后者在上）。 ── -->
  <!-- 上一只：`OnClickNext` 里旧蛋向上飞走淡出（实机视频确认：旧蛋一直可见地
       升到货架高度再消失，约 0.8s，不是快速淡出） -->
  <div
    v-if="leavingItem"
    class="g-abs g-layer-art pet-egg"
    :style="{ ...gachaPos(0, -20), zIndex: 12 }"
  >
    <div class="pet-egg__inner pet-egg__inner--leave">
      <img :src="getImageUrl(leavingItem.egg ?? leavingItem.icon ?? '')" alt="" class="pet-egg__img" />
    </div>
  </div>
  <div
    v-if="eggVisible"
    :key="'egg-' + cursor"
    class="g-abs g-layer-art pet-egg"
    :style="{ ...gachaPos(0, -20), zIndex: 12 }"
  >
    <div class="pet-egg__inner" :class="`pet-egg__inner--${eggStage}`">
      <div class="pet-egg__shine" :style="starGlowStyle" aria-hidden="true"></div>
      <img :src="getImageUrl(eggImage)" alt="" class="pet-egg__img" />
    </div>
  </div>

    <!-- ── 揭晓 UI（petShowUI）：菱形蛋框 → 名牌展开 → 星级逐颗 → 新获得 ── -->
    <template v-if="uiVisible">
      <!-- 菱形蛋框 eggDi：`gacha_egg_{star+2}` 300×300（atlas 400×400），α0→1 dur0.5 -->
      <div :key="'di-' + cursor" class="g-abs g-layer-art pet-diamond-wrap" :style="{ ...gachaPos(0, 0), zIndex: 11 }">
        <div class="pet-diamond__glow" :style="starGlowStyle" aria-hidden="true"></div>
        <img
          :src="getImageUrl(`/images/gacha/ui/gacha_egg_${starCount}.png`)"
          alt=""
          class="pet-diamond"
        />
      </div>
      <!-- 名牌 nameDi：`gacha_egg_name` 374×100 @(0,-163)；α dur0.5 delay0.1，宽度 224→374 展开 -->
      <div :key="'name-' + cursor" class="g-abs g-layer-ui pet-name" :style="gachaPos(0, -163)">
        <img :src="getImageUrl('/images/gacha/ui/gacha_egg_name.png')" alt="" class="pet-name__banner" />
        <p class="g-text pet-name__text">{{ currentItem.name }}</p>
      </div>
      <!-- 星级：5 个独立 `gacha_star` 72×72，UIGrid cellWidth 40 @(0,-120)。
           第 j 颗：「亮星 α0→1 dur0.3 + scale 2→1 dur0.3」与「闪光星 α1→0 dur0.5」，
           delay = 0.10 + j*0.12（0.10/0.22/0.34/0.46/0.58）。
           **只渲染亮起的星并按数量居中**（源码 UIGrid `hideInactive=1` + `Reposition()`：
           隐藏的星不占位，整组以格心为基准居中）。 -->
      <div :key="'stars-' + cursor" class="g-abs g-layer-ui pet-stars" :style="gachaPos(0, -120)">
        <div
          v-for="(slot, index) in starSlots"
          :key="index"
          class="pet-star"
          :style="{ left: `${starOffset(index)}px`, '--pet-star-delay': `${starDelay(index)}s` }"
        >
          <img :src="getImageUrl('/images/gacha/ui/gacha_star.png')" alt="" class="pet-star__base" />
          <img
            :src="getImageUrl('/images/gacha/ui/gacha_star.png')"
            alt=""
            class="pet-star__shine"
          />
        </div>
      </div>
      <!-- 新获得 news：`gacha_new` 144×92 @(94,96)；α dur0.25 delay0.15，scale 1.5→1 dur0.4 delay0.2 -->
      <div
        v-if="currentItem.isNew"
        :key="'new-' + cursor"
        class="g-abs g-layer-ui"
        :style="gachaPos(94, 96)"
      >
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_new.png')"
          alt="新获得"
          class="pet-new"
        />
      </div>
    </template>

    <!-- 「点击开袋 / 点击继续」提示：源码用 `com_tap` 160×40 手势贴图（不是文字）。
         开袋前 `openBagBtn` @(0,-280) α0.2↔1 PingPong；揭晓后可翻页 `nextBtn` @(0,-300)。 -->
    <img
      v-if="phase === 'bag'"
      class="g-abs g-layer-ui pet-tap"
      :style="gachaPos(0, -280)"
      :src="getImageUrl('/images/Common_Atlas/com_tap.png')"
      alt="点击开袋"
    />
    <img
      v-else-if="phase === 'show'"
      class="g-abs g-layer-ui pet-tap pet-tap--next"
      :style="gachaPos(0, -300)"
      :src="getImageUrl('/images/Common_Atlas/com_tap.png')"
      alt="点击继续"
    />

    <!-- 点击推进：等待阶段开袋（OnClickOpen），展示阶段下一只（OnClickNext）。
         推进层在整段演出期间保持挂载（源码也是两张常驻的全屏点击遮罩，按阶段切换响应），
         动画进行中的点击由 `advance()` 按 phase 忽略——避免"点空"和自动化重试超时。 -->
    <button
      v-if="phase !== 'loading' && phase !== 'done'"
      class="pet-catcher g-focusable"
      type="button"
      aria-label="继续"
      @click="advance"
    ></button>

    <!-- 分享（本站新增；prefab 有 share 节点但 `PetGachaAniPanel.cs` 无分享逻辑）与
         跳过（`gacha_btn_skip` 128×60 @(548,-302) → `OnSkip`）。位置按 prefab 设计坐标，
         挂在画布内随画布缩放（不放进 HUD——HUD 是视口坐标，会与游戏构图错位）。 -->
    <button
      v-if="phase !== 'bag' && phase !== 'loading'"
      class="g-abs g-layer-interactive g-hit g-focusable pet-share"
      :style="gachaPos(-560, -302)"
      type="button"
      title="分享"
      @click.stop="emit('share', { items })"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_share.png')" alt="分享" />
    </button>
    <button
      v-if="phase !== 'loading'"
      class="g-abs g-layer-interactive g-hit g-focusable pet-skip"
      :style="gachaPos(548, -302)"
      type="button"
      title="跳过"
      @click.stop="finishAll"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png')" alt="跳过" />
    </button>
  </GachaStage>
</template>

<script setup>
/**
 * 魔物蛋池抽蛋演出（游戏 `PetGachaAniPanel` 的还原）。
 *
 * 源码流程：`OpenPanel`（BGM `gacha_ready_egg` + `card11` + bgAniTween）→ 蛋袋 `idle_front`
 * 循环 → 点击 `OnClickOpen`：按**整批最高星级** `maxStar` 播 `open_blue/open_purple/open_gold`
 * → `open_idle` 循环 → 0.36s 后 `WaitShowPet`：蛋图从 (0,-360) 升到 (0,+40)（delay 0.14、
 * dur 0.36、OutQuad），容器再弹跳 (0,280)→(0,20) 且 scale 1.15→1.4（dur 0.25）→ `ShowPetUI`
 * 揭晓（菱形框 `gacha_egg_{star+2}`、名牌 224→374 展开、5 颗 `gacha_star` 逐颗 0.12s 弹出、
 * 新获得角标、ShineEft 星色）→ 点击 `OnClickNext` 逐只（旧蛋向上飞走 + `open_jump`）→
 * 最后一只 `Close()` + `GetReward(...)`（结算面板由 `GachaPetResult.vue` 承担）。
 *
 * 数值来源：prefab `petgachaanipanel` 组件 dump（`bgAniTween` 8 段、`petShowObj` 2 段、
 * `petShowUI` 24 段、`TweenPosition`/`UISprite`/`UILabel` 尺寸与坐标）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { createSpineScene } from '../../utils/gachaSpinePlayer'
import { playBgm, playSfx } from '../../utils/gachaAudio'
import { PET_SPINE_ASSETS } from './gachaSpineAssets'

const props = defineProps({
  /** 本次抽取结果列表（顺序即出蛋顺序）。 */
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['done', 'share'])

/** PetGachaAniPanel 的 TextureLoad（Awake）：模糊主背景（2048×1024）。 */
const BG_BLUR = '/images/gacha/gacha_cardbackground_main_output_blur.png'
/** 星级光效颜色（源码 `ShowPetUI` 的 ShineEft startColor）：3★ 蓝 / 4★ 紫 / 5★ 金。 */
const STAR_COLORS = {
  3: { core: 'rgba(69, 102, 255, 0.55)', halo: 'rgba(69, 102, 255, 0.20)' },
  4: { core: 'rgba(242, 112, 255, 0.55)', halo: 'rgba(242, 112, 255, 0.20)' },
  5: { core: 'rgba(224, 199, 51, 0.55)', halo: 'rgba(224, 199, 51, 0.20)' }
}
/** 每颗星的 delay：0.10 + j*0.12（prefab `petShowUI` 段 6..20）。 */
const STAR_DELAY_BASE = 0.1
const STAR_DELAY_STEP = 0.12

const phase = ref('loading') // loading | bag（等待开袋）| opening | egg（出蛋中）| show | done
const cursor = ref(0)
const eggVisible = ref(false)
/** 上一只蛋（`OnClickNext` 时向上飞走淡出）；与当前蛋分开成两个节点，避免计时器互相覆盖。 */
const leavingItem = ref(null)
/** 出蛋动画阶段：rise（TweenPosition 升起）→ bounce（容器弹跳）→ settled。 */
const eggStage = ref('rise')
const uiVisible = ref(false)
const camSettled = ref(false)
const canvasEl = ref(null)
let scene = null
const timers = []

const currentItem = computed(() => props.items[cursor.value] ?? {})
/** 蛋图星级 = `quality`（原表里蛋的 quality 即 star+2：3/4/5）。 */
const starCount = computed(() => Number(currentItem.value.quality ?? currentItem.value.rank ?? 3))
/** 亮起的星数 = star+2（与 `CheckPetEggItem` 的 `com_stars_{star+2}` 一致）。
 *  **按数量生成槽位**（只渲染亮起的星，整组再居中）——此前生成 5 个布尔槽位、
 *  模板又没有按值过滤，导致 3★ 也画出 5 颗星。 */
const starSlots = computed(() => Array.from({ length: starCount.value }, (_, index) => index))
const starGlow = computed(() => STAR_COLORS[starCount.value] ?? STAR_COLORS[3])
const starGlowStyle = computed(() => ({
  '--pet-glow-core': starGlow.value.core,
  '--pet-glow-halo': starGlow.value.halo
}))
const eggImage = computed(() => currentItem.value.egg ?? currentItem.value.icon ?? '')

function starDelay(index) {
  return Number((STAR_DELAY_BASE + index * STAR_DELAY_STEP).toFixed(2))
}

/** 星星横向位置：按**亮起数量**居中（3★ 为 -40/0/40、4★ 为 -60/-20/20/60、5★ 为 -80…80）。 */
function starOffset(index) {
  return (index - (starCount.value - 1) / 2) * 40
}

function later(fn, ms) {
  timers.push(window.setTimeout(fn, ms))
}

function clearTimers() {
  while (timers.length) window.clearTimeout(timers.pop())
}

/** 蛋袋开包动画名：源码 `OnClickOpen` 按**整批**最高星级（1/2/3 → blue/purple/gold）。 */
function openAnimation() {
  const top = props.items.reduce((max, item) => Math.max(max, Number(item.quality ?? item.rank ?? 3)), 0)
  return top >= 5 ? 'open_gold' : top >= 4 ? 'open_purple' : 'open_blue'
}

/** 开袋 → 0.36s 后出蛋（OnClickOpen + WaitShowPet）。 */
function openBag() {
  if (phase.value !== 'bag') return
  phase.value = 'opening'
  playSfx('get5')
  scene?.play('bag', openAnimation(), {
    onComplete: () => scene?.play('bag', 'open_idle', { loop: true })
  })
  // `time = 0.36`（prefab 覆盖源码默认值 1）：袋口先透光，随后蛋升起
  later(startEgg, 360)
}

/** 出蛋第一步：蛋图自 (0,-360) 升到 (0,+40)（delay 0.14 + dur 0.36，OutQuad）。 */
function startEgg() {
  phase.value = 'egg'
  eggVisible.value = true
  eggStage.value = 'rise'
  playBgm('gacha_show_egg')
  later(() => {
    // 落位后容器弹跳：position (0,280)→(0,20)、scale 1.15→1.4（dur 0.25）
    eggStage.value = 'bounce'
    later(() => {
      eggStage.value = 'settled'
      uiVisible.value = true
      phase.value = 'show'
    }, 250)
  }, 500)
}

/** 下一只（OnClickNext / OnClickShowPet）：旧蛋上飞淡出 + `open_jump` + 重新出蛋。 */
function nextPet() {
  uiVisible.value = false
  if (cursor.value + 1 >= props.items.length) {
    cursor.value += 1
    finishAll()
    return
  }
  // 旧蛋交给独立节点飞走（动画 0.8s，节点必须存活到动画结束）；当前蛋先隐藏，
  // 等 startEgg 再挂载（此前用一个计时器隐藏，会把已经升起的下一只蛋一起卸掉 → 第二只起「只有菱形没有蛋」）。
  leavingItem.value = props.items[cursor.value] ?? null
  eggVisible.value = false
  later(() => { leavingItem.value = null }, 850)
  cursor.value += 1
  phase.value = 'opening'
  playSfx('get5')
  scene?.play('bag', 'open_jump', {
    onComplete: () => scene?.play('bag', 'open_idle', { loop: true })
  })
  // `OnClickShowPet` 不再等 0.36s，直接进入升起
  later(startEgg, 200)
}

/** 跳过（OnSkip）/ 展示完毕（最后一只点完）：BGM 换 `gacha_shop`，交给结算面板。 */
function finishAll() {
  if (phase.value === 'done') return
  phase.value = 'done'
  clearTimers()
  playBgm('gacha_shop')
  emit('done')
}

function advance() {
  if (phase.value === 'bag') openBag()
  else if (phase.value === 'show') nextPet()
}

onMounted(async () => {
  try {
    const rect = canvasEl.value.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvasEl.value.width = Math.max(1, Math.round(rect.width * dpr))
    canvasEl.value.height = Math.max(1, Math.round(rect.height * dpr))
    // 取景：按**运行时包围盒**取景（数据头包围盒对蛋袋不可靠——内容远大于头部尺寸，
    // 会让袋身铺满整屏、桌面被完全遮住）。`padding` 留白 ≈ 1.3，袋身约占画布高 77%，
    // 与游戏画面（袋身约 8 成高、居中偏下、四周留出书桌与货架）一致。
    scene = await createSpineScene(canvasEl.value, PET_SPINE_ASSETS.map(def => ({
      ...def,
      atlas: getImageUrl(def.atlas),
      skeleton: getImageUrl(def.skeleton)
    })), { fit: 'bounds', initialAnimation: 'idle_front', padding: 1.3 })
  } catch (error) {
    // 演出不可用（无 WebGL / 资产缺失）：直接进结算，不阻塞抽卡
    finishAll()
    return
  }
  // OpenPanel：BGM gacha_ready_egg + card11，背景开场动画，蛋袋 idle_front 循环
  playBgm('gacha_ready_egg')
  playSfx('card11')
  camSettled.value = true
  phase.value = 'bag'
  scene.play('bag', 'idle_front', {
    loop: true,
    // 源码 idle_front 循环完成时播 card11
    onComplete: () => playSfx('card11')
  })
})

onBeforeUnmount(() => {
  clearTimers()
  // BGM 交给页面统一管理（离开 /gacha 才停），演出之间保持连续
  scene?.dispose()
  scene = null
})
</script>

<style scoped>
/* 背景开场（bgAniTween）：卡背整体 scale 1.834→1.005 归位，1.0s。
   普通定位层（transform 缩放会覆盖 .g-abs 的居中位移，故不用 g-abs）。 */
.pet-cam {
  position: absolute;
  inset: 0;
  overflow: hidden;
  transform: scale(1.834);
  transform-origin: 50% 50%;
  transition: transform 1s ease-out;
  pointer-events: none;
}

.pet-cam--settle {
  transform: scale(1.005);
}

.pet-bg {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2048px;
  height: 1024px;
  transform: translate(-50%, -50%);
}

/* 过曝层（1024×512，prefab scale=2）与 HL 高光层：随开场淡出（8 段 tween 里的 α1→0） */
.pet-bg--blured {
  opacity: 1;
  transition: opacity 1s ease-out;
}

.pet-bg--hl {
  width: 1680px;
  height: 1000px;
  opacity: 1;
  transition: opacity 1s ease-out;
}

.pet-cam--settle .pet-bg--blured,
.pet-cam--settle .pet-bg--hl {
  opacity: 0;
}

/* 蛋池桌面：1680×1000 原表尺寸 ×1.108 = 1862×1104，中心 (-24,+30)（实测值）。
   开场按 bgAniTween 的位移从下方 100px 升上来（源码 foreground pos y −100→0）。 */
.pet-bg--desk {
  width: 1862px;
  height: 1104px;
  left: calc(50% - 24px);
  top: calc(50% + 70px);
  transition: top 1s ease-out;
}

/* 注：不需要 `pet-bg--outline` 样式——prefab 的 outline 是 512×388 软边轮廓，
   拉伸到 1680×1000 会变成整片白光，已在模板中移除该层。 */

.pet-cam--settle .pet-bg--desk {
  top: calc(50% - 30px);
}

.pet-spine {
  position: absolute;
  z-index: 5;
  width: 1534px;
  height: 750px;
  pointer-events: none;
}

/* ── 出蛋 ──
   蛋图 132×138；rise 段沿 TweenPosition (0,-360)→(0,+40)（delay .14 / dur .36 / OutQuad），
   bounce 段是容器 (0,280)→(0,20) + scale 1.15→1.4（dur .25）。
   注意 CSS 的 y 轴与设计坐标相反：设计 +40 = 屏幕上移 40。 */
/* 蛋容器：定位在展示位 (0,-20)（SPEC：蛋从袋口弹出后落回展示位 (0,-20)）。
   升起/落位/飞走动画全部挂在 `.pet-egg__inner` 包裹层，蛋图保持静态居中。 */
.pet-egg {
  width: 0;
  height: 0;
  pointer-events: none;
}

.pet-egg__inner {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
}

/* rise：自袋口 (0,-360) 升到展示位，delay 0.14 / dur 0.36（OutQuad），scale 0.85→1（源码 DOScale 0.8→1） */
.pet-egg__inner--rise {
  animation: pet-egg-rise 0.36s cubic-bezier(0, 0, 0.58, 1) 0.14s both;
}

@keyframes pet-egg-rise {
  from { transform: translateY(340px) scale(0.85); opacity: 0; }
  15% { opacity: 1; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* 落位：轻微下沉回弹（petShowObj 弹跳 (0,280)→(0,20) 的收敛近似），scale 1.06→1 */
.pet-egg__inner--bounce {
  animation: pet-egg-bounce 0.25s ease-out both;
}

.pet-egg__inner--settled {
  transform: none;
}

@keyframes pet-egg-bounce {
  from { transform: translateY(-26px) scale(1.06); }
  to { transform: translateY(0) scale(1); }
}

/* 翻页：旧蛋向上飞走淡出（实机视频：约 0.8s 升到货架高度，末端才淡出） */
.pet-egg__inner--leave {
  animation: pet-egg-fly 0.8s ease-in both;
}

@keyframes pet-egg-fly {
  0% { transform: translateY(0); opacity: 1; }
  55% { opacity: 1; }
  100% { transform: translateY(-520px); opacity: 0; }
}

.pet-egg__img {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 132px;
  height: 138px;
  /* 终位 = 菱形中心略上（源码 `eggTex` 落点 (0,40) 相对 showPetUi）；**静态居中**，
     不参与任何关键帧（此前 rise/bounce 关键帧覆盖图片 transform，
     丢掉 translate(-50%,-50%) 的同时把放大倍数叠到 1.22×1.4 ≈ 1.7 倍 —— 蛋撑满菱形的变形根因） */
  transform: translate(-50%, -50%) translateY(-20px);
}

/* 蛋光晕 / 菱形光晕：ShineEft 星色（3★ 蓝 / 4★ 紫 / 5★ 金），
   一次闪（dur 1.8）后进入 3.2s 无限循环（prefab 段 21/22） */
.pet-egg__shine,
.pet-diamond__glow {
  position: absolute;
  left: 0;
  top: 0;
  width: 300px;
  height: 300px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, var(--pet-glow-core) 0%, var(--pet-glow-halo) 45%, transparent 70%);
  animation: pet-shine-loop 3.2s ease-in-out infinite;
  pointer-events: none;
}

/* 光晕包裹层跟随蛋位（蛋静态上移 20px）；落位后光晕让位给菱形框，淡出 */
.pet-egg__shine { top: -20px; width: 240px; height: 240px; }

.pet-egg__inner--settled .pet-egg__shine {
  opacity: 0;
  transition: opacity 0.4s ease-out;
  animation: none;
}

@keyframes pet-shine-loop {
  0%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}

/* 菱形蛋框：`gacha_egg_{star+2}` 300×300（atlas 400×400），α0→1 dur 0.5。
   绝对定位居中（g-abs 收缩包裹下负 margin 会把 shrink-to-fit 宽度算进居中基准） */
.pet-diamond-wrap { width: 0; height: 0; pointer-events: none; }

.pet-diamond {
  position: absolute;
  left: 0;
  top: 0;
  width: 300px;
  height: 300px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: pet-fade-in 0.5s ease-out both;
}

/* 名牌：374×100 @(0,-183)，α dur0.5 delay0.1 + **宽度 224→374 横向展开** dur0.5 delay0.1 */
.pet-name {
  width: 374px;
  height: 100px;
  transform: translate(-50%, -50%);
  animation: pet-name-in 0.5s ease-out 0.1s both;
}

@keyframes pet-name-in {
  from { opacity: 0; width: 224px; }
  to { opacity: 1; width: 374px; }
}

.pet-name__banner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pet-name__text {
  position: relative;
  margin: 0;
  padding: 0;
  width: 100%;
  text-align: center;
  font-size: 36px;
  line-height: 100px;
  font-weight: 700;
  color: #f8eedc;
}

/* 星级行：UIGrid cellWidth=40，星 72×72（相邻重叠 32px）；@(0,-137)。
   每颗「亮星」α0→1 + scale 2→1（各 dur 0.3），上层「闪光星」α1→0（dur 0.5），
   delay 由外层通过 `--pet-star-delay` 下发（0.10 / 0.22 / 0.34 / 0.46 / 0.58）。 */
.pet-stars {
  width: 0;
  height: 0;
  pointer-events: none;
}

.pet-star {
  position: absolute;
  left: 0;
  top: 0;
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
}

.pet-star__base,
.pet-star__shine {
  position: absolute;
  inset: 0;
  width: 72px;
  height: 72px;
}

.pet-star__base {
  animation: pet-star-pop 0.3s ease-out var(--pet-star-delay, 0s) both;
}

.pet-star__shine {
  animation: pet-star-flash 0.5s ease-in var(--pet-star-delay, 0s) both;
}

@keyframes pet-star-pop {
  from { transform: scale(2); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes pet-star-flash {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* 新获得：144×92 @(94,96)，α dur0.25 delay0.15，scale 1.5→1（过冲 1.35）dur0.4 delay0.2 */
.pet-new {
  position: absolute;
  left: 0;
  top: 0;
  width: 144px;
  height: 92px;
  transform: translate(-50%, -50%);
  animation: pet-new-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both,
             pet-fade-in 0.25s ease-in 0.15s both;
}

@keyframes pet-new-pop {
  from { transform: translate(-50%, -50%) scale(1.5); }
  to { transform: translate(-50%, -50%) scale(1); }
}

/* 点击提示：com_tap 160×40，α0.2↔1 dur1.0 PingPong（prefab 的 TweenAlpha/段 23·24） */
.pet-tap {
  width: 160px;
  height: 40px;
  pointer-events: none;
  animation: pet-tap-breathe 1s ease-in-out infinite alternate;
}

.pet-tap--next {
  animation: pet-fade-in 1.2s ease-out both, pet-tap-breathe 1s ease-in-out 1.2s infinite alternate;
}

@keyframes pet-tap-breathe {
  from { opacity: 0.2; }
  to { opacity: 1; }
}

@keyframes pet-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 分享 / 跳过：prefab 设计坐标（share 96×96 @(-560,-302)、skip 128×60 @(548,-302)），
   与其余演出元素同层（随画布缩放）。 */
.pet-share,
.pet-skip {
  border: 0;
  background: none;
  padding: 0;
}

.pet-share { width: 96px; height: 96px; }
.pet-skip { width: 128px; height: 60px; }

.pet-share img { width: 96px; height: 96px; }
.pet-skip img { width: 128px; height: 60px; }
.pet-skip:active img { content: url('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip_press.png'); }

/* 点击推进层 */
.pet-catcher {
  position: absolute;
  inset: 0;
  z-index: 50;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
</style>
