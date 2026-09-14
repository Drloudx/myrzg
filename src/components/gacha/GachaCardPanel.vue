<template>
  <!-- 整页演出：与揭晓/结果同款 GachaStage（1534×750 设计画布、原点居中）。
       场景 = 商店背景（HeroGachaAniPanel 的 TextureLoad：`_blur` 模糊版，2048×1024）
       + elsa_rawcard（艾尔莎与卡牌 Spine）+ elsa_rawcard_desk（桌面前景 Spine）。
       两个骨架共用同一坐标空间（包围盒一致），渲染顺序 desk 在上（遮住艾尔莎下半身）。
       开场相机（Timeline 0~2.67s 的 startopen 段）：画面从暗场 + 艾尔莎脸部特写
       （gacha_BG_in 淡入 + 相机推近）拉开到全景桌面，用外层 transform 模拟 3D 相机
       推拉；点击跳段时立即复位。 -->
  <GachaStage :backdrop="bgUrl">
    <!-- 开场相机（Timeline startopen 的「由近到远」运镜）：背景与 Spine 演出层同处
         card-cam 内一起缩放——游戏是整幅 3D 场景推拉，网页没有后处理管线，用整场景
         transform 缩放近似（scale 1.35 → 1.0，2.4s；点击跳段立即复位）。 -->
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

    <!-- 开场暗场（gacha_BG_in：暗场起手，随相机拉开退场）。
         注意：这是**整屏铺满**层，不能用 `gachaPos()`（那会写 left/top=50%，与 CSS 的
         `inset:0` 叠加后只剩右下四分之一，表现为画面中间一道硬边「阴影」）。 -->
    <div class="card-dark" :class="{ 'card-dark--out': cameraOpen }" aria-hidden="true"></div>
    <!-- URP 后处理近似（源码 `VolumeOn`：ColorAdjustments postExposure 0.08 / contrast 5、
         ChromaticAberration 0.2→0.075、LensDistortion 0.4→0.2、Vignette 0.5→0.35）：
         用常驻暗角 + 轻微过曝 + 开场期的色边近似（WebGL 里没有后处理管线）。 -->
    <div class="card-post" :class="{ 'card-post--open': cameraOpen }" aria-hidden="true"></div>

    <!-- 触摸继续（源码 continueObj）：等待与翻卡段都显示——源码 SetClickCount 只隐藏
         tail_tip，continueObj 要到面板关闭才消失（2026-09-14 实机视频逐帧确认） -->
    <div v-if="phase === 'wait' || phase === 'cards'" class="g-abs g-layer-ui g-text card-continue" :style="gachaPos(0, -300)">
      · 触摸继续 ·
    </div>

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
  // 桌面层在开场时已按稀有度进入 common/surprised 循环（源码 gacha_BG 的 surprised 布尔
  // 在 SetCardType 一次设定、贯穿整段演出），这里不重播打断循环
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
      { fit: 'width', zoom: 1.2 },
      { left: 'calc(50% - 767px)', top: 'calc(50% - 375px)', width: '1534px', height: '750px', position: 'absolute', pointerEvents: 'none' }
    )
    scene = await ready
    scene.resume()
  } catch (error) {
    // 演出不可用（无 WebGL / 资产缺失）：跳过动画直接进揭晓，不阻塞抽卡
    finish()
    return
  }
  playBgm('gacha_ready_chara')
  playSfx('card3')
  // 桌面层按稀有度进入循环（源码 SetCardType：gacha_BG.SetBool("surprised", !common)
  // 在开场前一次设定、贯穿开场/等待/翻卡）——出 5 星时桌面进 surprised 状态而非 idle/common
  scene.play('desk', props.rare ? 'surprised' : 'common', { loop: true })
  // 开场相机：暗场 + 脸部特写（scale 2.2）→ 2.4s 拉回全景（startopen 全长 2.67s）
  requestAnimationFrame(() => { cameraOpen.value = true })
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

/* 共享画布由 `mountSharedSpineScene` 工厂创建（带不上 scoped 属性），定位用内联样式：
   left calc(50% - 767px) / top calc(50% - 375px)、1534×750；随 card-cam 一起参与开场缩放。 */
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

.card-desk-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 75px;
  background: linear-gradient(to top, #14171a 0%, #172a24 45%, #203c33 80%, transparent 100%);
  z-index: 4;
  pointer-events: none;
}

.card-bg img {
  width: 2048px;
  height: 1024px;
  object-fit: cover;
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

/* 共享画布由 `mountSharedSpineScene` 工厂创建（带不上 scoped 属性），定位用内联样式：
   left calc(50% - 767px) / top calc(50% - 375px)、1534×750——层级在背景图(.g-layer-bg=1)
   之上、UI 层(40)之下（wrap 的 z-index:5）。

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
