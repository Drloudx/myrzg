<template>
  <!-- 整页演出：PetGachaAniPanel（魔物蛋池抽蛋）的还原。
       场景 = 卡背栈（BG_main 2048×1024 d0 / BG_main_blured 1024×512 d1 / HL 1680×1000 d4）
       + 蛋池桌面 gacah_pet_desk_foreground（d3，开场自下方上升 100 归位）
       + perform_bag 蛋袋 Spine（皮肤 def）+ 出蛋与逐蛋揭晓 UI（petShowUI 24 段）。 -->
  <GachaStage :backdrop="BG_BLUR" fit="height">
    <!-- 全景统一相机容器：背景 + 蛋池桌面 + 蛋袋 Spine 骨架一同包含在此容器内，
         由近及远统一缩放（scale 1.834 → 1.0，聚焦中心 50% 51%），
         使桌面左侧书本与右侧相框/药水瓶随镜头拉远自然同步自两侧收拢入画，杜绝割裂横移。 -->
    <div class="pet-stage-cam" :class="{ 'pet-stage-cam--settle': camSettled }">
      <div class="pet-bg-wrap">
        <img :src="getImageUrl(BG_BLUR)" alt="" class="pet-bg" />
        <img :src="getImageUrl('/images/gacha/gacha_cardbackground_main_output_blured.png')" alt="" class="pet-bg pet-bg--blured" />
        <img :src="getImageUrl('/images/gacha/gacha_cardbackground_HL_output.png')" alt="" class="pet-bg pet-bg--hl" />
      </div>

      <!-- 蛋池桌面前景：层级在 Spine 背包背后（depth 3 < depth 6），
           底沿贴紧屏幕底端（bottom: -120px），宽度 100% 满屏展示左右全景（左侧铃兰花瓶、右侧相框与药水瓶），
           中央绿叶堆紧贴并托抱背包下沿。 -->
      <div class="pet-desk-wrap">
        <img :src="getImageUrl('/images/gacha/gacah_pet_desk_foreground.png')" alt="" class="pet-desk-fg" />
      </div>

      <!-- 蛋袋 Spine（perform_bag，皮肤 def） -->
      <div ref="canvasHost" class="pet-spine-cam"></div>
    </div>

    <!-- 开场黑屏淡入（对齐真机转场，0.35s 快速淡出） -->
    <div class="pet-black" :class="{ 'pet-black--out': camSettled }" aria-hidden="true"></div>


  <!-- ── 出蛋：**Inbag 裁剪区**（prefab `showPet/Inbag` UIPanel clipRange 410×410 @（0,240)）。
       蛋沿 TweenPosition (0,-360)→(0,+40) 升起（delay 0.14 / dur 0.36 / OutQuad），
       但下半段全程在裁剪区外 + 袋身后——可见观感 =「蛋从袋口噗地弹出」，
       **不是**从屏幕底部升上来。动画挂 `.pet-egg__inner` 包裹层，蛋图静态居中。
       层级：源码 `eggTex` depth 7/8 > `eggDi` depth 5 → 蛋压在菱形框之上。
       旧蛋消失 = 源码 `OnClickNext` 的 `SetActive(false)`：**瞬时消失、无飞走动画**
       （游戏视频逐帧：点击后下一帧蛋与揭晓 UI 全部消失，袋子空转 ~0.4s 出下一只）。 -->
  <div class="pet-egg-clip" aria-hidden="true">
    <div
      v-if="eggVisible && eggStage === 'rise'"
      :key="'egg-' + cursor"
      class="pet-egg"
      :style="{ left: '205px', top: '165px', zIndex: 12 }"
    >
      <div class="pet-egg__inner pet-egg__inner--rise">
        <img :src="getImageUrl(eggImage)" alt="" class="pet-egg__img" />
      </div>
    </div>
  </div>
  <!-- 落位阶段：源码 rise onFinished 把蛋**回挂 outbag（无裁剪）**——fall/settled 的蛋
       不在 Inbag 裁剪区内（否则蛋的下半会被裁剪区下缘切掉），起点 = 高点 (0,+280)，
       由 fall 动画落进菱形框 (0,+10)（实测游戏画面：蛋心在菱形中心略下方）。 -->
  <div
    v-if="eggVisible && eggStage !== 'rise'"
    :key="'egg-free-' + cursor"
    class="g-abs g-layer-art pet-egg"
    :style="{ ...gachaPos(0, 280), zIndex: 12 }"
  >
    <div class="pet-egg__inner" :class="`pet-egg__inner--${eggStage}`">
      <img :src="getImageUrl(eggImage)" alt="" class="pet-egg__img" />
    </div>
  </div>
  <!-- 蛋的光晕（ShineEft）：源码里是面板级粒子系统，**不在 Inbag 裁剪区内**，且
       弹出阶段跟随**高点**（蛋被挂到 Inbag 下后 Tween 终点 (0,40) 是 Inbag 局部坐标
       = 世界 (0,+280)，接近货架——用户指的「很高的弹出高度」）；落位后淡出。 -->
  <div
    v-if="eggVisible"
    class="g-abs g-layer-art"
    :style="{ ...gachaPos(0, 280), zIndex: 12 }"
    aria-hidden="true"
  >
    <div class="pet-egg__shine" :class="{ 'pet-egg__shine--out': eggStage === 'settled' }" :style="starGlowStyle"></div>
  </div>

    <!-- ── 揭晓 UI（petShowUI）：菱形蛋框 → 名牌展开 → 星级逐颗 → 新获得 ──
         prefab `showPetUI` 组整体在 (0,+20)，下列坐标为组内局部值。 -->
    <template v-if="uiVisible">
      <!-- 菱形蛋框 eggDi：`gacha_egg_{star+2}` 300×300（atlas 400×400），α0→1 dur0.5 -->
      <div :key="'di-' + cursor" class="g-abs g-layer-art pet-diamond-wrap" :style="{ ...gachaPos(0, 20), zIndex: 11 }">
        <div class="pet-diamond__glow" :style="starGlowStyle" aria-hidden="true"></div>
        <img
          :src="getImageUrl(`/images/HeroGachaPanel_Atlas/gacha_egg_${starCount}.png`)"
          alt=""
          class="pet-diamond"
        />
      </div>
      <!-- 名牌 nameDi：`gacha_egg_name` 374×100，组内 (0,-183) → 绝对 (0,-163)；α dur0.5 delay0.1，
           宽度 224→374 展开。文字用**魔物名**（prefab UILabel 示例「宝石迷迷可」），
           蛋候选名带「的蛋」后缀需去掉。 -->
      <div :key="'name-' + cursor" class="g-abs g-layer-ui pet-name" :style="gachaPos(0, -163)">
        <img :src="getImageUrl('/images/HeroGachaPanel_Atlas/gacha_egg_name.png')" alt="" class="pet-name__banner" />
        <p class="g-text pet-name__text">{{ petDisplayName }}</p>
      </div>
      <!-- 星级：5 个独立 `gacha_star` 72×72，UIGrid cellWidth 40，组内 (0,-137) → 绝对 (0,-117)。
           第 j 颗：「亮星 α0→1 dur0.3 + scale 2→1 dur0.3」与「闪光星 α1→0 dur0.5」，
           delay = 0.10 + j*0.12（0.10/0.22/0.34/0.46/0.58）。
           **只渲染亮起的星并按数量居中**（源码 UIGrid `hideInactive=1` + `Reposition()`）。
           prefab 里 star1..5 的 mDepth 递减（12→8）——**左边的星盖住右边的星**，
           用 z-index 递减复现。 -->
      <div :key="'stars-' + cursor" class="g-abs g-layer-ui pet-stars" :style="gachaPos(0, -117)">
        <div
          v-for="(slot, index) in starSlots"
          :key="index"
          class="pet-star"
          :style="{ left: `${starOffset(index)}px`, zIndex: starSlots.length - index, '--pet-star-delay': `${starDelay(index)}s` }"
        >
          <img :src="getImageUrl('/images/HeroGachaPanel_Atlas/gacha_star.png')" alt="" class="pet-star__base" />
          <img
            :src="getImageUrl('/images/HeroGachaPanel_Atlas/gacha_star.png')"
            alt=""
            class="pet-star__shine"
          />
        </div>
      </div>
      <!-- 新获得 news：`gacha_new` 144×92，组内 (94,96) → 绝对 (94,116)；α dur0.25 delay0.15，scale 1.5→1 dur0.4 delay0.2 -->
      <div
        v-if="currentItem.isNew"
        :key="'new-' + cursor"
        class="g-abs g-layer-ui"
        :style="gachaPos(94, 116)"
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
      :style="gachaPos(0, -325)"
      :src="getImageUrl('/images/Common_Atlas/com_tap.png')"
      alt="点击开袋"
    />
    <img
      v-else-if="phase === 'show'"
      class="g-abs g-layer-ui pet-tap pet-tap--next"
      :style="gachaPos(0, -325)"
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
import { mountSharedSpineScene, releaseSharedSpineScene } from '../../utils/gachaSpinePlayer'
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
const STAR_DELAY_BASE = 0.35
const STAR_DELAY_STEP = 0.12
/** 蛋袋取景标定（详见 onMounted 注释）：视野留白 + 画布内下移（设计像素）。 */
const PET_BAG_FRAMING = { padding: 1.62, biasY: 470 }

const phase = ref('loading') // loading | bag（等待开袋）| opening | egg（出蛋中）| show | done
const cursor = ref(0)
const eggVisible = ref(false)
/** 出蛋动画阶段：rise（弹向高点）→ fall（落进菱形框）→ settled。 */
const eggStage = ref('rise')
const uiVisible = ref(false)
const camSettled = ref(false)
const canvasHost = ref(null)
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
/** 揭晓名牌显示**魔物名**：蛋候选名是蛋道具名（如「魔水黏团的蛋」），去掉「的蛋」后缀。 */
const petDisplayName = computed(() => String(currentItem.value.name ?? '').replace(/的蛋$/, ''))

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

/** 开袋 → 1s 后出蛋（OnClickOpen + WaitShowPet）。 */
function openBag() {
  if (phase.value !== 'bag') return
  phase.value = 'opening'
  scene?.play('bag', openAnimation(), {
    onComplete: () => scene?.play('bag', 'open_idle', { loop: true })
  })
  // 源码 WaitShowPet 的 `time` 序列化值 = 1s（0.36 是蛋自身 DOScale 时长）；实机观感 1s 偏拖，
  // 按用户反馈收敛到 **700ms**——袋口张开的瞬间蛋就开始升（600ms 时袋口刚张开，见实测截图）。
  later(startEgg, 700)
}

/** 出蛋第一步：蛋自袋身后 (0,-120) 弹到高点 (0,+280)（delay 0.14 + dur 0.36，OutQuad），再落进菱形框 (0,+10)（0.35s 带轻弹）。
 *  get5 音效与 `gacha_show_egg` BGM 都在蛋出现时播（源码 WaitShowPet 等 1s 后同播这两条）。 */
function startEgg() {
  phase.value = 'egg'
  eggVisible.value = true
  eggStage.value = 'rise'
  playSfx('get5')
  playBgm('gacha_show_egg')
  later(() => {
    // 高点 → 落位（源码 rise onFinished 把蛋回挂 outbag）
    eggStage.value = 'fall'
    // 蛋开始下落时菱形/名牌就开始出现，落到时刚好加载完（用户逐帧对照）
    uiVisible.value = true
    phase.value = 'show'
    later(() => {
      eggStage.value = 'settled'
    }, 350)
  }, 500)
}

/** 下一只（OnClickNext / OnClickShowPet）：旧蛋与揭晓 UI **瞬时隐藏**
 *  （源码 `petShowObj.SetActive(false)` + `petShowUIObj.SetActive(false)`，无飞走动画），
 *  袋子播 open_jump，蛋**立即**从袋口弹出（源码 OnClickShowPet 无等待，
 *  rise 动画自带的 delay 0.14 就是袋子起跳与出蛋的节拍）。 */
function nextPet() {
  uiVisible.value = false
  eggVisible.value = false
  if (cursor.value + 1 >= props.items.length) {
    cursor.value += 1
    finishAll()
    return
  }
  cursor.value += 1
  phase.value = 'opening'
  scene?.play('bag', 'open_jump', {
    onComplete: () => scene?.play('bag', 'open_idle', { loop: true })
  })
  startEgg()
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
  camSettled.value = true
  if (phase.value === 'bag') openBag()
  else if (phase.value === 'show') nextPet()
}

onMounted(async () => {
  try {
    // 共享场景：画布/上下文/纹理跨抽卡复用（mountSharedSpineScene 内部处理尺寸与比例重建）
    // 取景：按**运行时包围盒**取景（数据头包围盒对蛋袋不可靠——内容远大于头部尺寸，
    // 会让袋身铺满整屏、桌面被完全遮住）。
    // `padding` / `biasY` 标定口径（2026-09-16 对照实机截图）：
    //  - 袋身宽约占可见画布宽 36%、底边正好坐在桌面草地绿带上，左右两侧口袋完整可见；
    //  - `padding` 只放大视野（内容等比变小），`biasY` 把内容在画布内下移（世界单位 =
    //    设计像素，此骨架按 1:1 设计像素装配）。
    // 这两个值由 tests/ui/gacha.spec.js 的蛋池量测断言守卫，改动需同步实测。
    const { ready } = mountSharedSpineScene(
      'gacha-pet-bag',
      canvasHost.value,
      PET_SPINE_ASSETS.map(def => ({
        ...def,
        atlas: getImageUrl(def.atlas),
        skeleton: getImageUrl(def.skeleton)
      })),
      { fit: 'bounds', initialAnimation: 'idle_front', padding: 1.35, yOffset: 195 },
      { left: 'calc(50% - 767px)', top: 'calc(50% - 375px)', width: '1534px', height: '750px', position: 'absolute', pointerEvents: 'none' }
    )
    scene = await ready
    scene.resume()
  } catch (error) {
    // 演出不可用（无 WebGL / 资产缺失）：直接进结算，不阻塞抽卡
    console.error('[gacha-pet] scene mount failed:', error)
    finishAll()
    return
  }
  // OpenPanel：BGM gacha_ready_egg + card11，全景运镜由近及远拉回，蛋袋 idle_front 循环
  playBgm('gacha_ready_egg')
  playSfx('card11')
  timers.push(window.setTimeout(() => {
    camSettled.value = true
  }, 50))
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
  // 只解除共享引用（引用归零暂停渲染循环），不销毁场景/上下文
  releaseSharedSpineScene('gacha-pet-bag')
  scene = null
})
</script>

<style scoped>
/* ── 开场相机推拉（PetGachaAniPanel bgAniTween 还原）──
   整场景（背景 + 桌面前景 + 蛋袋 Spine）统一置于 pet-stage-cam 内由近及远缩放：
   初始 1.834 倍近景特写（焦距在背包兔脸徽章，origin 50% 51%），
   黑屏快速淡出，镜头 0.9s 平滑拉回 1.0 全景，左右侧书本与相框药水瓶自然同步移入画面。 */
.pet-stage-cam {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: scale(1.834);
  transform-origin: 50% 51%;
  pointer-events: none;
  transition: transform 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) 0.2s;
}

.pet-stage-cam--settle {
  transform: scale(1);
}

/* 开场黑屏淡入（对齐真机转场） */
.pet-black {
  position: absolute;
  inset: 0;
  z-index: 25;
  background: #000;
  pointer-events: none;
  opacity: 1;
  transition: opacity 0.3s ease-out;
}

.pet-black--out {
  opacity: 0;
}

/* 背景包装层：宽度撑满舞台（视口），高度与桌面前景按 1680:1000 严格同步，
   底部贴紧屏幕，杜绝留黑与悬空。 */
.pet-bg-wrap {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  height: 940px;
  bottom: -120px;
  overflow: hidden;
}

/* 主背景：原生纹理为 2048×1024，核心画面为 (184,12) 处的 1680×1000 区域。
   通过精确负偏移裁切左右 184px 透明留白，使画面 100% 满屏无缝展开，完整展现左右两侧药水瓶与书架。 */
.pet-bg {
  position: absolute;
  width: calc(100% * 2048 / 1680);
  height: calc(100% * 1024 / 1000);
  left: calc(-100% * 184 / 1680);
  top: calc(-100% * 12 / 1000);
}

/* 过曝层与 HL 高光层：随开场淡出（8 段 tween 里的 α1→0） */
.pet-bg--blured,
.pet-bg--hl {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 1;
  transition: opacity 1s ease-out;
}

.pet-stage-cam--settle .pet-bg--blured,
.pet-stage-cam--settle .pet-bg--hl {
  opacity: 0;
}

/* 蛋池桌面前景：1132×672 纹理。
   游戏原版机制为背景之上的道具层（NGUI depth 3，Spine 蛋袋 depth 6 位于其上）：
   ① 与背景保持等宽（100%）并按同比例对齐，左右两端完整展现铃兰花瓶、相框、药水瓶与木格爬藤墙；
   ② 底部贴附屏幕边缘（bottom: -120px），使绿草堆自然延伸至屏幕底端，底边无空隙、无黑条；
   ③ 前景绿草堆紧密托抱蛋袋底沿，背包底面稳稳嵌入草丛。
   不再独立做 translateY 移动，随 pet-stage-cam 统一由近及远缩放。 */
.pet-desk-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -120px;
  width: 100%;
  height: 940px;
  pointer-events: none;
  z-index: 3;
}

.pet-desk-fg {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
}

/* 共享画布由 `mountSharedSpineScene` 工厂创建（带不上 scoped 属性），定位用内联样式：
   left calc(50% - 767px) / top calc(50% - 375px)、1534×750、absolute；
   wrap（.pet-spine-cam）沿用与翻卡段一致的层级：背景之上、UI 层之下（z-index 5）。 */
.pet-spine-cam {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 5;
  pointer-events: none;
}

/* ── 出蛋 ──
   蛋图按**纹理原生像素**显示（源码 MakePixelPerfect 覆盖序列化的 132×138/scale2，
   蛋纹理 110~155px 不等）。蛋运行时被挂到 Inbag（中心 (0,240)）下，TweenPosition
   (0,-360)→(0,+40) 是 **Inbag 局部坐标** = 世界 (0,-120)→(0,+280)：从袋身后（裁剪区外、
   不可见）一路弹到接近货架的高点 (0,+280)，落位时回挂 outbag 落进菱形框 (0,+40)。
   裁剪区 = prefab `Inbag` clipRange 410×410 @（0,240)（y ∈ [35,445]）。
   注意 CSS 的 y 轴与设计坐标相反。 */
/* 蛋容器：裁剪区局部坐标 (205,165) = 世界高点 (0,+280)（内联样式给出）。
   升起/下落动画挂在 `.pet-egg__inner` 包裹层，蛋图保持静态居中。 */
.pet-egg-clip {
  position: absolute;
  left: calc(50% - 205px);
  top: calc(50% - 445px);
  width: 410px;
  height: 410px;
  overflow: hidden;
  z-index: 12;
  pointer-events: none;
}

.pet-egg {
  position: absolute;
  width: 0;
  height: 0;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.pet-egg__inner {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
}

/* rise：自袋身后 (0,-120)（裁剪区外，不可见）弹到高点 (0,+280)；位移 400px =
   裁剪局部 (205,565) → (205,165)；delay 0.14 / dur 0.36（OutQuad），scale 0.8→1（源码 DOScale） */
.pet-egg__inner--rise {
  animation: pet-egg-rise 0.36s cubic-bezier(0, 0, 0.58, 1) 0.14s both;
}

@keyframes pet-egg-rise {
  from { transform: translateY(400px) scale(0.85); opacity: 0; }
  15% { opacity: 1; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* fall：高点 (0,+280) 落进菱形框 (0,+10)（ty 0 → 270），带一次轻弹——
   源码在 rise onFinished 里把蛋回挂 outbag；落点按用户对照截图逐像素实测：
   蛋心在菱形中心（+20）略下方 ≈ +10（此前 +40 偏高 24 设计像素）。 */
.pet-egg__inner--fall {
  animation: pet-egg-fall 0.35s cubic-bezier(0.5, 0, 0.5, 1) both;
}

.pet-egg__inner--settled {
  transform: translateY(270px);
}

@keyframes pet-egg-fall {
  0% { transform: translateY(0) scale(1); }
  60% { transform: translateY(282px) scale(1); }
  80% { transform: translateY(259px) scale(1); }
  to { transform: translateY(270px) scale(1); }
}

/* 蛋图：**纹理原生像素**（源码 MakePixelPerfect 覆盖序列化的 132×138/scale2，
   蛋纹理 110~155px 不等），不写死宽高——img 自然尺寸即设计像素。 */
.pet-egg__img {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: auto;
  height: auto;
  /* 显示倍率：用户对照截图（扬沙芙洛波）逐像素实测——同屏下游戏蛋宽 ≈164px、
     网页（×1.65）蛋宽 ≈197px，游戏/网页 ≈ 0.83 → 1.65 × 0.83 ≈ **1.4**。
     终位由容器给出；img 本体静态居中，不参与关键帧（动画全挂在 .pet-egg__inner 上）。 */
  transform: translate(-50%, -50%) scale(1.4);
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

/* 蛋的光晕比菱形光晕小一圈（240），跟随弹出高点（容器在高点 (0,+280)，落位后淡出） */
.pet-egg__shine { top: 0; width: 240px; height: 240px; }

/* 落位后光晕让位给菱形框：淡出（元素随蛋独立于裁剪区之外） */
.pet-egg__shine--out {
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

/* 闪光星：延迟期间必须**不可见**（opacity:0 + forwards；此前用 both 会把 from 的
   opacity:1 反向填充到延迟期——星星还没轮到就整颗亮着，等动画再「消失」，
   观感即用户指的「星级先出来、然后才播出现动画」）。 */
.pet-star__shine {
  opacity: 0;
  animation: pet-star-flash 0.5s ease-in var(--pet-star-delay, 0s) forwards;
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
  animation: pet-new-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s both,
             pet-fade-in 0.25s ease-in 0.8s both;
}

@keyframes pet-new-pop {
  from { transform: translate(-50%, -50%) scale(1.5); }
  to { transform: translate(-50%, -50%) scale(1); }
}

/* 点击提示：com_tap 160×40，α0.2↔1 dur1.0 PingPong（prefab 的 TweenAlpha/段 23·24）
   开场待运镜拉回全景后淡入（delay 0.85s） */
.pet-tap {
  width: 160px;
  height: 40px;
  pointer-events: none;
  animation: pet-fade-in 0.3s ease-out 0.85s both, pet-tap-breathe 1s ease-in-out 0.85s infinite alternate;
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
.pet-skip {
  width: 128px;
  height: 60px;
  animation: pet-fade-in 0.3s ease-out 0.85s both;
}

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
