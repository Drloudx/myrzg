<template>
  <!-- 整页演出：与揭晓/结果同款 GachaStage（1534×750 设计画布、原点居中）。
       场景 = 商店背景（HeroGachaAniPanel 的 TextureLoad：`_blur` 模糊版，2048×1024）
       + elsa_rawcard（艾尔莎与卡牌 Spine）+ elsa_rawcard_desk（桌面前景 Spine）。
       两个骨架共用同一坐标空间（包围盒一致），渲染顺序 desk 在上（遮住艾尔莎下半身）。
       开场相机（Timeline 0~2.67s 的 startopen 段）：画面从暗场 + 艾尔莎脸部特写
       （gacha_BG_in 淡入 + 相机推近）拉开到全景桌面，用外层 transform 模拟 3D 相机
       推拉；点击跳段时立即复位。 -->
  <GachaStage :backdrop="bgUrl" fit="height">
    <!-- 开场相机（Timeline startopen 的「由近到远」运镜）：背景与 Spine 演出层同处
         card-cam 内一起缩放——初始超近景脸胸部特写 scale(2.25) origin(50% 86%)，平滑拉远到全景 1.0 -->
    <div class="card-cam" :class="{ 'card-cam--open': cameraOpen, 'card-cam--done': cameraDone }">
      <div class="g-abs g-layer-bg card-bg" :style="gachaPos(0, 0)">
        <img :src="bgUrl" alt="" />
      </div>
      <!-- Spine 舞台（elsa_rawcard + elsa_rawcard_desk 桌面前景）。
           注：prefab 打包的 gacha_cardforeground_output.png 静态桌面图不再渲染——它与
           elsa_rawcard_desk 骨架内容完全重复（实测隐藏后画面零变化），且开场缩放时与
           Spine 桌面错位形成「双重桌沿」，已移除。 -->
      <div ref="canvasHost" class="card-spine-wrap"></div>
      <!-- 桌面底色延展层：消除宽屏/缩放边缘黑边缝隙 -->
      <div class="card-desk-fill" aria-hidden="true"></div>
    </div>

    <!-- 开场纯黑转场淡入（对齐真机 Frame 096~104 的暗场切入，0.35s 快速淡出） -->
    <div class="card-black" :class="{ 'card-black--out': cameraOpen }" aria-hidden="true"></div>

    <!-- 开场暗场（gacha_BG_in：暗场起手，随相机拉开退场）。
         注意：这是**整屏铺满**层，不能用 `gachaPos()`（那会写 left/top=50%，与 CSS 的
         `inset:0` 叠加后只剩右下四分之一，表现为画面中间一道硬边「阴影」）。 -->
    <div class="card-dark" :class="{ 'card-dark--out': cameraOpen }" aria-hidden="true"></div>
    <!-- URP 后处理近似（源码 `VolumeOn`：ColorAdjustments postExposure 0.08 / contrast 5、
         ChromaticAberration 0.2→0.075、LensDistortion 0.4→0.2、Vignette 0.5→0.35）：
         用常驻暗角 + 轻微过曝 + 开场期的色边近似（WebGL 里没有后处理管线）。 -->
    <div class="card-post" :class="{ 'card-post--open': cameraOpen }" aria-hidden="true"></div>

    <!-- 触摸继续（源码 continueObj）：prefab 原版使用 com_tap 160×40 贴图与 α0.2↔1 呼吸动画（同宠物池一致） -->
    <img
      v-if="phase === 'wait' || phase === 'cards'"
      class="g-abs g-layer-ui card-tap"
      :style="gachaPos(0, -300)"
      :src="getImageUrl('/images/Common_Atlas/com_tap.png')"
      alt="触摸继续"
    />

    <!-- tail_tip：游戏实机等待画面没有可见的白色提示贴图（用户实机对照），源码的
         tail_tip 特效在网页端无法以正常混合还原，只保留其 shining1 提示音。 -->

    <!-- 等待阶段或翻卡阶段点击任意处推进（源码点击 elsa 模型 / 触摸继续 → SetClickCount / SkipAni） -->
    <button v-if="phase === 'wait' || phase === 'cards'" class="card-catcher g-focusable" type="button" aria-label="继续" @click="onCatcherClick"></button>

    <!-- 跳过：prefab 设计坐标 gacha_btn_skip 128×60 @(548,-302)，与蛋池（GachaPetPanel）一致 -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable card-skip"
      :style="gachaPos(548, -302)"
      type="button"
      title="跳过"
      @click="finish"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png')" alt="跳过" />
    </button>
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
import { mountSharedSpineScene, releaseSharedSpineScene } from '../../utils/gachaSpinePlayer'
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
const canvasHost = ref(null)
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
  // 翻卡阶段桌面层同步切换 common 动态（蜡烛光晕与墨水反光），避免桌面层重复叠加碰头特效
  scene?.play('desk', 'common', { loop: true })
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

/** 翻卡段播完 → 直接进入揭晓面板（源码 HeroGachaAniBGPanel.CallBackEvent -> StartShowHero）。 */
function finishCards() {
  finish()
}

function onCatcherClick() {
  if (phase.value === 'wait') {
    startCards()
  } else if (phase.value === 'cards') {
    finish()
  }
}

function finish() {
  if (done) return
  done = true
  emit('done')
}

onMounted(async () => {
  try {
    // 共享场景：画布/上下文/纹理跨抽卡复用（mountSharedSpineScene 内部处理尺寸与比例重建）
    const { canvas, ready } = mountSharedSpineScene(
      'gacha-hero-card',
      canvasHost.value,
      HERO_SPINE_ASSETS.map(def => ({
        ...def,
        atlas: getImageUrl(def.atlas),
        skeleton: getImageUrl(def.skeleton)
      })),
      { fit: 'card-stage', zoom: 1.2 },
      { left: '0', top: '0', width: '100%', height: '100%', position: 'absolute', pointerEvents: 'none' }
    )
    scene = await ready
    scene.resume()
  } catch (error) {
    console.error('[GachaCardPanel error]:', error)
    // 演出不可用（无 WebGL / 资产缺失）：跳过动画直接进揭晓，不阻塞抽卡
    finish()
    return
  }
  playBgm('gacha_ready_chara')
  playSfx('card3')
  // 桌面层常驻 idle 待机（蜡烛微光与墨水反光），在开场特写与等待点击阶段绝不触发碰头或卡牌特效
  scene.play('desk', 'idle', { loop: true })
  // 开场相机：超近景脸胸特写（scale 2.25 origin 50% 86%）→ 1.4s 电影级拉回全景（对齐真机 Frame 096~128）
  window.setTimeout(() => { cameraOpen.value = true }, 50)
  scene.play('elsa', 'startopen', {
    onComplete: () => {
      if (phase.value !== 'enter') return
      phase.value = 'wait'
      cameraDone.value = true
      // 等待阶段播 `startopen_waitclick`（趴到桌子底下、只露头发的姿态，4s 循环）——
      // 与 Timeline 的 startopen_waitclick 段一致：**这才是等待点击的状态**（2026-09-14
      // 实机视频逐帧：开场坐姿 2.67s 后自动趴下，触摸继续显示在趴桌阶段；点击后端着
      // 卡牌从桌下起身直接翻卡）。此前误用坐姿 idle，导致点击后「先趴下再起身」的错序。
      scene.play('elsa', 'startopen_waitclick', { loop: true })
      scheduleTailTipSound()
    }
  })
})

onBeforeUnmount(() => {
  window.clearTimeout(rareTimer)
  clearTailTipTimers()
  // BGM 不在这里停：演出之间要连续（源码 HeroGachaAniPanel.Close 不停 BGM，
  // 由下一段 HeroGachaShowPanel 改播 gacha_show_chara），离开 /gacha 时由页面统一停。
  // 只解除共享引用（引用归零暂停渲染循环），不销毁场景/上下文——
  // 销毁重建交给 mountSharedSpineScene 的比例变化分支与 disposeSharedSpineScenes。
  releaseSharedSpineScene('gacha-hero-card')
  scene = null
})
</script>

<style scoped>
/* ── 开场相机推近（Timeline startopen 还原）──
   整场景（背景 + 角色 Spine + 桌面）统一置于 card-cam 内缩放：
   初始 2.25 倍超近景脸胸部特写（焦距在项圈与胸前，origin 50% 86%），
   入场黑屏 0.35s 快速淡入，镜头 1.4s 平滑拉回 1.0 全景桌面。 */
.card-cam {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: scale(2.25);
  transform-origin: 50% 86%;
  pointer-events: none;
}

.card-cam--open {
  transition: transform 1.4s cubic-bezier(0.22, 0.61, 0.36, 1);
  transform: scale(1);
}

.card-cam--done {
  transition: none;
  transform: scale(1);
}

/* 共享画布以自身 CSS 尺寸取景，铺满延展后的舞台；随 card-cam 参与开场缩放。 */
.card-spine-wrap {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 5;
  pointer-events: none;
}

.card-desk-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 120px;
  background: linear-gradient(to bottom, #2b453d 0%, #203730 75%, #182823 100%);
  z-index: 4;
  pointer-events: none;
}

.card-bg {
  width: max(100%, 1680px);
  height: 1000px;
  overflow: hidden;
}

.card-bg img {
  /* 原图 2048×1024 的有效区域为 x=184..1863、y=12..1011。
     按有效区域放大并反向裁掉透明边，宽屏延展时两侧仍保持连续背景。 */
  position: absolute;
  width: calc(100% * 2048 / 1680);
  height: calc(100% * 1024 / 1000);
  left: calc(-100% * 184 / 1680);
  top: calc(-100% * 12 / 1000);
  max-width: none;
  object-fit: fill;
}

/* 开场黑屏淡入（对齐真机 Frame 096~104） */
.card-black {
  position: absolute;
  inset: 0;
  z-index: 22;
  background: #000;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.35s ease-out;
}

.card-black--out {
  opacity: 0;
}

/* 开场暗场（gacha_BG_in）：整屏压暗，相机拉开时退场。
   `inset:0` 铺满舞台（不要再用 gachaPos / translate 居中）；用大幅椭圆做整体压暗 + 轻微暗角，
   避免小半径热点在画面里形成可见的明暗分界。 */
.card-dark {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: radial-gradient(ellipse 130% 130% at 50% 45%, rgba(10, 7, 4, 0.5) 0%, rgba(10, 7, 4, 0.78) 100%);
  transition: opacity 1.4s ease-out;
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
  transition: opacity 1.4s ease-out;
}

.card-post::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 60, 60, 0.05) 0%, rgba(255, 60, 60, 0) 18%),
    linear-gradient(270deg, rgba(50, 140, 255, 0.05) 0%, rgba(50, 140, 255, 0) 18%);
  opacity: 1;
  transition: opacity 1.4s ease-out;
}

.card-post--open::before {
  opacity: 0;
}

/* 触摸继续：com_tap 160×40，α0.2↔1 dur1.0 PingPong（对齐宠物池与 Unity prefab continueObj） */
.card-tap {
  width: 160px;
  height: 40px;
  z-index: 40;
  pointer-events: none;
  animation: card-tap-in 1.2s ease-out both, card-tap-breathe 1s ease-in-out 1.2s infinite alternate;
}

@keyframes card-tap-breathe {
  from { opacity: 0.2; }
  to { opacity: 1; }
}

@keyframes card-tap-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 跳过：prefab 设计坐标（gacha_btn_skip 128×60 @(548,-302)），随画布缩放（同蛋池） */
.card-skip {
  border: 0;
  width: 128px;
  height: 60px;
  background: none;
  padding: 0;
}

.card-skip img { width: 128px; height: 60px; }
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
