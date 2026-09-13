<template>
  <!-- 整页演出：与揭晓/结果同款 GachaStage（1534×750 设计画布、原点居中）。
       场景 = 商店背景（HeroGachaAniPanel 的 TextureLoad：`_blur` 模糊版，2048×1024）
       + elsa_rawcard（艾尔莎与卡牌 Spine）+ elsa_rawcard_desk（桌面前景 Spine）。
       两个骨架共用同一坐标空间（包围盒一致），渲染顺序 desk 在上（遮住艾尔莎下半身）。
       开场相机（Timeline 0~2.67s 的 startopen 段）：画面从暗场 + 艾尔莎脸部特写
       （gacha_BG_in 淡入 + 相机推近）拉开到全景桌面，用外层 transform 模拟 3D 相机
       推拉；点击跳段时立即复位。 -->
  <GachaStage :backdrop="bgUrl" fit="height">
    <div class="card-cam" :class="{ 'card-cam--open': cameraOpen, 'card-cam--done': cameraDone }">
      <div class="g-abs g-layer-bg card-bg" :style="gachaPos(0, 0)">
        <img :src="bgUrl" alt="" />
      </div>
      <!-- 桌面底图（prefab herogachaanipanel 打包的 gacha_cardforeground_output 1680×1000）：
           elsa 桌面 Spine 内容只覆盖 ±767，宽视口下两侧用它垫底补齐 -->
      <div class="g-abs g-layer-bg card-desk" :style="gachaPos(0, 0)">
        <img :src="getImageUrl('/images/gacha/gacha_cardforeground_output.png')" alt="" />
      </div>
    </div>

    <!-- Spine 舞台：铺满 1534×750 设计画布，像素尺寸按实际渲染尺寸 × dpr 设置。
         **不平移缩放**：elsa_rawcard / elsa_rawcard_desk 骨架内部自带背景与桌面贴图，
         对画布做 transform 放大会露出这些贴图的硬边（表现为画面中间一道「阴影」分界线）。
         开场推近改由背景/桌面图层（整幅贴图）承担。 -->
    <div class="card-spine-wrap">
      <canvas
        ref="canvasEl"
        class="card-spine"
        style="left: calc(50% - 767px); top: calc(50% - 375px)"
      ></canvas>
    </div>

    <!-- 开场暗场（gacha_BG_in：暗场起手，随相机拉开退场）。
         注意：这是**整屏铺满**层，不能用 `gachaPos()`（那会写 left/top=50%，与 CSS 的
         `inset:0` 叠加后只剩右下四分之一，表现为画面中间一道硬边「阴影」）。 -->
    <div class="card-dark" :class="{ 'card-dark--out': cameraOpen }" aria-hidden="true"></div>
    <!-- URP 后处理近似（源码 `VolumeOn`：ColorAdjustments postExposure 0.08 / contrast 5、
         ChromaticAberration 0.2→0.075、LensDistortion 0.4→0.2、Vignette 0.5→0.35）：
         用常驻暗角 + 轻微过曝 + 开场期的色边近似（WebGL 里没有后处理管线）。 -->
    <div class="card-post" :class="{ 'card-post--open': cameraOpen }" aria-hidden="true"></div>

    <!-- 触摸继续（源码 continueObj）：等待点击阶段显示 -->
    <div v-if="phase === 'wait'" class="g-abs g-layer-ui g-text card-continue" :style="gachaPos(0, -300)">
      · 触摸继续 ·
    </div>

    <!-- tail_tip（源码 tail_tip，elsa_rawcard_tail 158×173）：指向艾尔莎的点击提示，
         位置按游戏截图（头部右上方），带轻微浮动（Eft_Ani 循环的近似） -->
    <img
      v-if="phase === 'wait'"
      class="g-abs g-layer-ui card-tail"
      :style="gachaPos(135, 248)"
      :src="getImageUrl('/images/gacha/spine/elsa_rawcard_tail.png')"
      alt=""
    />

    <!-- 等待阶段点击任意处开始翻卡（源码点击 elsa 模型 → SetClickCount → 跳到卡牌段） -->
    <button v-if="phase === 'wait'" class="card-catcher g-focusable" type="button" aria-label="继续" @click="startCards"></button>

    <!-- 跳过：HUD 层（视口锚定） -->
    <template #hud>
      <button class="card-skip" type="button" title="跳过" @click="finish">
        <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png')" alt="跳过" />
      </button>
    </template>
  </GachaStage>
</template>

<script setup>
/**
 * 翻卡演出（游戏 `HeroGachaAniPanel` 的网页还原，仅角色池；蛋池走 GachaPetPanel）。
 *
 * 源码流程：OpenPanel（BGM gacha_ready_chara + card3）→ Timeline 前段 startopen/startopen_waitclick
 * （等待点击，continueObj + tail_tip 显示）→ 点击后跳到 waitTime=6.35s 播卡牌段
 * （common/surprised × one/ten，同时 BGM 换 gacha_show_chara；稀有判定在此后播 card8，普通 card7）
 * → cardTime 之后 `end` → StartShowHero 进入揭晓。网页版由 elsa_rawcard 的同名 Spine 动画
 * 直接替代 Timeline+FBX+Animator（动画名与 cardAni 四个 clip 一致）。
 *
 * 开场相机：Timeline 的 startopen（0~2.67s）由 3D 相机完成「暗场 → 艾尔莎脸部特写 →
 * 拉回全景」（VolumeOn 同时开启色差/镜头畸变/暗角后期），网页用背景与 Spine 舞台的
 * transform 缩放（特写中心取艾尔莎脸部 ≈ 画布 (0,90)，origin 50% 62%）+ 暗场层近似。
 *
 * 稀有判定取源码口径：本次结果中存在 5 星（fragments/newHeros rare>=5）→ surprised。
 * 演出资产加载失败（无 WebGL 等）时跳过动画直接进入揭晓，不阻塞抽卡流程。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { createSpineScene } from '../../utils/gachaSpinePlayer'
import { playBgm, playSfx } from '../../utils/gachaAudio'
import { HERO_SPINE_ASSETS } from './gachaSpineAssets'

const props = defineProps({
  /** 本次抽取次数：1 / 10（决定 onecard / tencard） */
  count: { type: Number, default: 1 },
  /** 是否稀有（存在 5 星 → surprised 段） */
  rare: { type: Boolean, default: false }
})

const emit = defineEmits(['done'])

const phase = ref('enter') // enter（startopen）| wait（等待点击）| cards（翻卡）| out（end）
const cameraOpen = ref(false) // 相机拉开（startopen 起手即开始过渡）
const cameraDone = ref(false) // 相机复位（startopen 结束 / 点击跳段时立即置位）
const canvasEl = ref(null)
let scene = null
let rareTimer = 0
let tailTipTimer = 0
let tailTipEcho = 0
let done = false

/** 背景：HeroGachaAniPanel/petgachaanipanel 的 TextureLoad 均为 `_blur` 模糊版（2048×1024）。 */
const bgUrl = getImageUrl('/images/gacha/gacha_cardbackground_main_output_blur.png')
/** 卡牌段动画：与源码 cardAni 四个 clip 同名。 */
const cardAnimation = computed(() => {
  if (props.count === 10) return props.rare ? 'surprised_tencard' : 'common_tencard'
  return props.rare ? 'surprised_onecard' : 'common_onecard'
})

/** 等待点击 → 翻卡段（源码 SetClickCount：BGM 换 gacha_show_chara；GetRareCardSound 播 card8/card7）。 */
function startCards() {
  if (phase.value !== 'wait') return
  phase.value = 'cards'
  cameraDone.value = true
  clearTailTipTimers()
  playBgm('gacha_show_chara')
  scene?.play('elsa', cardAnimation.value, { onComplete: finishCards })
  scene?.play('desk', props.rare ? 'surprised' : 'common')
  rareTimer = window.setTimeout(() => playSfx(props.rare ? 'card8' : 'card7'), 1200)
}

/** tail_tip 的提示音：源码 `ShowTailTip` 等 5s 播一次 `shining1`，之后每 3s 一次。 */
function scheduleTailTipSound() {
  clearTailTipTimers()
  tailTipTimer = window.setTimeout(() => {
    if (phase.value !== 'wait') return
    playSfx('shining1')
    tailTipEcho = window.setInterval(() => {
      if (phase.value !== 'wait') return clearTailTipTimers()
      playSfx('shining1')
    }, 3000)
  }, 5000)
}

function clearTailTipTimers() {
  window.clearTimeout(tailTipTimer)
  window.clearInterval(tailTipEcho)
  tailTipTimer = 0
  tailTipEcho = 0
}

/** 翻卡段播完 → end 段（源码 Timeline 结尾 → StartShowHero）。 */
function finishCards() {
  if (phase.value !== 'cards') return
  phase.value = 'out'
  scene?.play('elsa', 'end', { onComplete: finish })
  scene?.play('desk', 'end')
}

function finish() {
  if (done) return
  done = true
  emit('done')
}

onMounted(async () => {
  try {
    // 画布像素按实际渲染尺寸 × dpr（GachaStage 会做 CSS transform 缩放）
    const rect = canvasEl.value.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvasEl.value.width = Math.max(1, Math.round(rect.width * dpr))
    canvasEl.value.height = Math.max(1, Math.round(rect.height * dpr))
    scene = await createSpineScene(canvasEl.value, HERO_SPINE_ASSETS.map(def => ({
      ...def,
      atlas: getImageUrl(def.atlas),
      skeleton: getImageUrl(def.skeleton)
    })), { fit: 'width' })
  } catch (error) {
    // 演出不可用（无 WebGL / 资产缺失）：跳过动画直接进揭晓，不阻塞抽卡
    finish()
    return
  }
  playBgm('gacha_ready_chara')
  playSfx('card3')
  // 开场相机：暗场 + 脸部特写（scale 2.2）→ 2.4s 拉回全景（startopen 全长 2.67s）
  requestAnimationFrame(() => { cameraOpen.value = true })
  scene.play('elsa', 'startopen', {
    onComplete: () => {
      if (phase.value !== 'enter') return
      phase.value = 'wait'
      cameraDone.value = true
      // 等待阶段播 `idle`（坐姿）——`startopen_waitclick` 实际是趴桌仅露头发的过渡姿态，
      // 与游戏等待画面（图4：坐姿+触摸继续）不符，实机视频/截图对照后改用 idle
      scene.play('elsa', 'idle', { loop: true })
      scene.play('desk', 'idle', { loop: true })
      scheduleTailTipSound()
    }
  })
  scene.play('desk', 'idle', { loop: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(rareTimer)
  clearTailTipTimers()
  // BGM 不在这里停：演出之间要连续（源码 HeroGachaAniPanel.Close 不停 BGM，
  // 由下一段 HeroGachaShowPanel 改播 gacha_show_chara），离开 /gacha 时由页面统一停。
  scene?.dispose()
  scene = null
})
</script>

<style scoped>
/* ── 开场相机推近（Timeline startopen 的近似）──
   **只缩放背景/桌面这一整幅贴图层**：Spine 舞台保持 1:1，否则骨架内部的背景/桌面贴图
   边缘会露出来（画面中间出现硬边「阴影」）。初始 1.35 倍、焦点在艾尔莎脸部附近，
   配暗场层；camera-open 时拉回 1.0（2.4s），camera-done 立即复位。 */
.card-cam {
  position: absolute;
  left: 0;
  top: 0;
  width: 1534px;
  height: 750px;
  overflow: hidden;
  transform: scale(1.35);
  transform-origin: 50% 19%;
  pointer-events: none;
}

.card-cam--open {
  transition: transform 2.4s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: scale(1);
}

.card-cam--done {
  transition: none;
  transform: scale(1);
}

/* Spine 舞台包裹层：不参与任何缩放 */
.card-spine-wrap {
  position: absolute;
  left: 0;
  top: 0;
  width: 1534px;
  height: 750px;
  overflow: hidden;
  z-index: 5;
  pointer-events: none;
}

.card-bg img {
  width: 2048px;
  height: 1024px;
  object-fit: cover;
}

.card-desk img {
  width: 1700px;
  height: 1012px;
  object-fit: fill;
}

/* 开场暗场（gacha_BG_in）：整屏压暗，相机拉开时退场。
   `inset:0` 铺满舞台（不要再用 gachaPos / translate 居中）；用大幅椭圆做整体压暗 + 轻微暗角，
   避免小半径热点在画面里形成可见的明暗分界。 */
.card-dark {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: radial-gradient(ellipse 130% 130% at 50% 45%, rgba(10, 7, 4, 0.5) 0%, rgba(10, 7, 4, 0.78) 100%);
  transition: opacity 1.6s ease-out;
  pointer-events: none;
}

.card-dark--out {
  opacity: 0;
}

/* URP 后处理近似：常驻暗角（Vignette 0.35）+ 轻微过曝的中心（postExposure 0.08）；
   开场期（未 camera-open）额外叠一层极淡的红/青色边（ChromaticAberration 0.2 的近似），
   随相机拉开降到 0.075 的观感（这里直接过渡到 0，避免色边长期存在）。 */
.card-post {
  position: absolute;
  inset: 0;
  z-index: 21;
  pointer-events: none;
  background:
    radial-gradient(ellipse 78% 78% at 50% 48%, rgba(255, 246, 224, 0.06) 0%, rgba(255, 246, 224, 0) 55%),
    radial-gradient(ellipse 120% 120% at 50% 50%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.35) 100%);
  box-shadow: inset 0 0 0 0 transparent;
  transition: opacity 2.4s ease-out;
}

.card-post::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 60, 60, 0.05) 0%, rgba(255, 60, 60, 0) 18%),
    linear-gradient(270deg, rgba(50, 140, 255, 0.05) 0%, rgba(50, 140, 255, 0) 18%);
  opacity: 1;
  transition: opacity 2.4s ease-out;
}

.card-post--open::before {
  opacity: 0;
}

.card-spine {
  position: absolute;
  /* 背景图(.g-layer-bg=1)之上、UI 层(40)之下：elsa 与桌面的 Spine 场景层 */
  z-index: 5;
  width: 1534px;
  height: 750px;
  pointer-events: none;
}

/* 触摸继续：底部居中的米白提示（源码 continueObj，prefab 文本米白系） */
.card-continue {
  z-index: 40;
  color: #f8eedc;
  animation: card-continue-in 1.2s ease-out both;
}

@keyframes card-continue-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* tail_tip：白色闪光提示（源码 tint (1,0.95,0.7) + Eft_Ani 循环 → 金色脉动近似） */
.card-tail {
  z-index: 40;
  width: 158px;
  height: 173px;
  filter: sepia(0.5) saturate(1.6) brightness(1.05);
  animation: card-tail-float 1.6s ease-in-out infinite;
}

@keyframes card-tail-float {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

/* 跳过：HUD 层（视口锚定，约 0.85 缩放同游戏） */
.card-skip {
  position: absolute;
  right: max(24px, env(safe-area-inset-right) + 12px);
  bottom: max(30px, env(safe-area-inset-bottom) + 18px);
  border: 0;
  width: 109px;
  height: 51px;
  background: none;
  padding: 0;
  z-index: 60;
}

.card-skip img { width: 109px; height: 51px; }
.card-skip:active img { content: url('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip_press.png'); }

/* 点击推进层：铺满整个窗口，仅在等待阶段挂载 */
.card-catcher {
  position: absolute;
  inset: 0;
  z-index: 50;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
</style>
