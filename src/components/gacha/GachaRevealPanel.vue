<template>
  <!-- 整页演出：HeroGachaShowPanel（角色揭晓）的三段式完整还原。
       背景 = 揭晓 prefab 专属暗黑殿堂 bg.png（1700×1220，depth 0）；
       step1 星级弹出（classStars 大星 → gacha_star_L.png 逐颗弹入）→
       step2 舞台构建与 Q 版小人（spGachaBox01/02 菱形门 + spGachaBlock01 盾牌托板 +
             spGachaDitai01 石质台座 + Q 版小人 win → win_idle 站在台座上）→
       step3 立绘展开与台座右移（菱形大框与立绘左移至 -160，台座总装右移至 +360，
             台座正面浮现 gacha_star_M.png 星级、新获得、右上角属性/职业徽标、名牌与台词）。 -->
  <GachaStage :backdrop="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')" fit="height">
    <!-- ── 背景层 ── -->
    <div class="g-layer-bg reveal-bg">
      <img :src="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')" alt="" />
    </div>

    <!-- 粒子近似（浮尘） -->
    <div class="g-abs g-layer-deco reveal-dust" :style="gachaPos(0, 0)" aria-hidden="true">
      <span v-for="mote in dustMotes" :key="mote.key" :style="mote.style"></span>
    </div>

    <!-- ── Step 1: 职业图腾与大星 ── -->
    <!-- 职业底图：spGachaClass0{job}Black 或支援专属 chara_bg_class_6 576×576（进入 Step 2 时角色/台子出现，图腾与星星淡出） -->
    <div
      v-if="totemVisible && current.job"
      class="g-abs g-layer-bg reveal-class"
      :class="{
        'reveal-class--job6': current.job === 6,
        'reveal-class--fadeout': totemFading
      }"
      :style="gachaPos(0, 0)"
    >
      <img :src="getClassTotemUrl(current.job)" alt="" class="reveal-class__img" />
    </div>

    <!-- Step 1 大星：gacha_star_L.png（76×76 金色立体星，自左向右逐颗弹跳进场，50px 间距居中） -->
    <div
      v-if="bigStarsVisible"
      class="g-abs g-layer-ui reveal-bigstars-container"
      :class="{ 'reveal-bigstars--fadeout': bigStarsFading }"
      :style="gachaPos(0, 0)"
    >
      <div
        v-for="(star, index) in starCount"
        :key="index"
        class="reveal-bigstar-item"
        :style="{
          left: `calc(50% + ${(index - (starCount - 1) / 2) * 50}px)`,
          zIndex: starCount - index,
          animationDelay: `${starTiming.delay + index * starTiming.gap}s`
        }"
      >
        <img
          :src="getImageUrl('/images/gacha/gacha_star_L.png')"
          alt="star"
          class="reveal-bigstar-img"
        />
      </div>
    </div>

    <!-- ── Step 2 & 3: BackFrame 菱形大框 ──
         Step 2: 位于中央 (0, 0)
         Step 3: 随 Tween[0] 平滑滑移至 (-240, 0) -->
    <div
      v-if="phaseIndex >= 1"
      class="g-abs g-layer-bg reveal-backframe-assembly"
      :class="[
        `reveal-backframe--star${starCount}`,
        { 'reveal-backframe--step3': phaseIndex >= 2, 'reveal-fade-out': leaving }
      ]"
      :style="gachaPos(0, 0)"
    >
      <!-- 菱形双框：spGachaBox02 (672) + spGachaBox01 (640)（内部透明无底色，实机1:1尺寸） -->
      <img
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBox02.png')"
        alt=""
        class="reveal-box reveal-box--outer"
      />
      <img
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBox01.png')"
        alt=""
        class="reveal-box reveal-box--inner"
      />

      <!-- 四角闪块 spGachaStar02 (410×410) -->
      <img
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaStar02.png')"
        alt=""
        class="reveal-sparkles"
      />

      <!-- 4星专属角光芒 (shineLT & shineRB) -->
      <div v-if="starCount === 4" class="reveal-star4-shines" aria-hidden="true">
        <span class="reveal-shine reveal-shine--lt">✦</span>
        <span class="reveal-shine reveal-shine--rb">✦</span>
      </div>
    </div>

    <!-- ── Step 3: 角色立绘层（居中偏左，在 BackFrame 之上、名牌和右侧台座之下） ── -->
    <div
      v-if="phaseIndex >= 2"
      class="g-abs g-layer-art reveal-portrait"
      :class="{ 'reveal-fade-out': leaving }"
      :style="{ ...gachaPos(portraitX, portraitY), zIndex: 11 }"
    >
      <img
        :key="current.typeId"
        :src="getImageUrl(current.portrait)"
        :alt="current.name"
        class="reveal-portrait__img"
      />
    </div>

    <!-- ── Step 2 & 3: 符文圆环与角向饰件（归属台座小人总装层，Step 3 跟随小人右移至 +360，z-index 位于立绘之后） ── -->
    <div
      v-if="phaseIndex >= 1 && starCount >= 4"
      class="g-abs reveal-stage-ring"
      :class="{ 'reveal-stage-ring--step3': phaseIndex >= 2, 'reveal-fade-out': leaving }"
      :style="gachaPos(0, 0)"
    >
      <!-- lineAlpha：spGachaLine01 (974×974) -->
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaLine01.png')" alt="" class="reveal-line" />

      <!-- 4星 & 5星专属：符文文字环 spGachaTxtRing01 (866×864) -->
      <div
        class="reveal-ring"
        aria-hidden="true"
      ></div>

      <!-- 四向角饰与四方块（跟随台座小人，属性染色） -->
      <div v-for="angle in angleOrnaments" :key="angle.key" class="reveal-ornament-angle" :style="ornamentPos(angle.x, angle.y)">
        <div class="reveal-angle" aria-hidden="true"></div>
      </div>
      <div v-for="block in blockOrnaments" :key="block.key" class="reveal-ornament-block" :style="ornamentPos(block.x, block.y)">
        <div class="reveal-block" aria-hidden="true"></div>
      </div>
    </div>

    <!-- ── Step 2 & 3: 台座总装（Stage Assembly）──
         Step 2: 位于屏幕中央 (0, 0)
         Step 3: 随 Tween[2,3,6] 平滑滑移至 (+360, 0)
         结构整体化：
           - 灰盾牌托板：spGachaBlock01 (492×492)
           - 石质台座：spGachaDitai01 (380×380) @(0,-118)
           - Q 版小人：Spine 380×380 @(0,-118)，Spine 摄像机绝对锚定台面中心
           - 台座正面星级：gacha_star_M.png @ y=-171（Step 3 浮现）
           - 新伙伴角标：gacha_new.png @ (104,-108)（Step 3 浮现）
           - 属性菱形标：spGachaTag{Element}03 @ (150,122)（Step 3 浮现）
           - 职业菱形标：spGachaBlock05 + spGachaClass0{job} @ (213,79)（Step 3 浮现）
    -->
    <div
      v-if="phaseIndex >= 1"
      class="g-abs g-layer-art reveal-stage-assembly"
      :class="{ 'reveal-stage--step3': phaseIndex >= 2, 'reveal-out': leaving }"
      :style="gachaPos(0, 0)"
    >
      <!-- 托板：spGachaBlock01 492×492（Step 2/3 舞台托板） -->
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock01.png')" alt="" class="reveal-stage-block" />

      <!-- 石台座：spGachaDitai01 380×380 @(0,-118) -->
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaDitai01.png')" alt="" class="reveal-stage-ditai" />

      <!-- Q 版小人：Spine 挂载宿主 380×380 @(0,-118) -->
      <div v-show="!chibiFallback" ref="chibiHost" class="reveal-chibi-host"></div>
      <img
        v-if="chibiFallback"
        :key="current.typeId"
        :src="getImageUrl(current.card)"
        :alt="current.name"
        class="reveal-chibi-fallback"
      />

      <!-- Step 3 附属装饰（台座正面星级、新获得、右上角属性与职业标） -->
      <template v-if="phaseIndex >= 2">
        <!-- 台座正面星级行（gacha_star_M.png 紧密重叠 @ y=-171） -->
        <div class="reveal-pedestal-stars">
          <img
            v-for="index in starCount"
            :key="index"
            :src="getImageUrl('/images/gacha/gacha_star_M.png')"
            alt=""
            class="reveal-pedestal-star"
            :style="{
              zIndex: starCount - index + 1,
              animationDelay: `${0.1 + (index - 1) * 0.08}s`
            }"
          />
        </div>

        <!-- 新伙伴角标（只有新角色显示，pinned to 右台阶 @ (104, -108)） -->
        <div v-if="current.isNew" class="reveal-stage-new">
          <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_new.png')" alt="新伙伴" class="reveal-new" />
          <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_new.png')" alt="" class="reveal-new reveal-new--shine" />
        </div>

        <!-- 属性菱形标 @ (148, 118) -->
        <div class="reveal-stage-element">
          <img
            :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}03.png`)"
            alt=""
            class="reveal-element-img"
          />
        </div>

        <!-- 职业菱形标 @ (208, 79) -->
        <div v-if="current.job" class="reveal-stage-class">
          <img
            :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock05.png')"
            alt=""
            class="reveal-class-frame"
          />
          <img
            :src="getClassIconUrl(current.job)"
            alt=""
            class="reveal-class-icon"
          />
        </div>
      </template>
    </div>

    <!-- ── Step 3: 角色名牌与标签层（位于立绘右侧，y ≈ -70 ~ -126） ── -->
    <template v-if="phaseIndex >= 2">
      <!-- nameBase: spGachaNameDown01 512×512 -->
      <div class="g-abs g-layer-ui reveal-namebase" :class="{ 'reveal-fade-out': leaving }" :style="nameBaseStyle">
        <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaNameDown01.png')" alt="" />
      </div>

      <!-- elementTextBase: spGachaTag{Element}02 -->
      <div class="g-abs g-layer-ui" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(104, -126)" aria-hidden="true">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}02.png`)"
          alt=""
          class="reveal-tag-img reveal-tag-img--base"
        />
      </div>

      <!-- classText: 128×128 -->
      <div v-if="current.job" class="g-abs g-layer-ui" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(158, -126)">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTagClass0${current.job}.png`)"
          alt=""
          class="reveal-tag-img"
        />
      </div>

      <!-- elementText: 64×64 -->
      <div class="g-abs g-layer-ui" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(99, -126)">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}01.png`)"
          alt=""
          class="reveal-tag-img reveal-tag-img--sm"
        />
      </div>

      <!-- block 56×56 @(158,-68) 与 name 48px 右端 @(128,-70) -->
      <div class="g-abs g-layer-ui" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(158, -68)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock03.png')"
          alt=""
          class="reveal-nameblock"
        />
      </div>
      <div class="g-abs g-layer-ui g-text reveal-name" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(128, -70)">
        {{ current.name }}
      </div>
    </template>

    <!-- ── Step 3: 台词打字机 ── -->
    <div v-if="phaseIndex >= 2 && current.dialogue" class="g-abs g-layer-interactive reveal-text" :class="{ 'reveal-fade-out': leaving }" :style="gachaPos(0, -282)">
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_text.png')" alt="" class="reveal-text__bg" />
      <p class="g-text reveal-text__body">{{ typedText }}</p>
    </div>

    <!-- 进度提示 -->
    <div v-if="displayItems.length > 1" class="g-abs g-layer-ui g-text g-text--sm g-text--dim reveal-progress" :style="gachaPos(-660, 330)">
      {{ cursor + 1 }} / {{ displayItems.length }}
    </div>

    <!-- 点击推进 -->
    <button class="reveal-click-catcher g-focusable" type="button" aria-label="继续" @click="advance"></button>

    <!-- 跳过 -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable reveal-skip"
      :style="gachaPos(548, -302)"
      type="button"
      title="跳过（跳过后只保留 5 星）"
      @click="skipAll"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png')" alt="跳过" />
    </button>
  </GachaStage>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { mountCanvasScene, pauseCanvasScenes, preloadGachaSpineAssets, releaseSharedCanvas } from '../../utils/gachaSpinePlayer'
import { playBgm, playSfx } from '../../utils/gachaAudio'

const props = defineProps({
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['finish', 'share'])
const ELEMENT_SLUGS = { 1: 'Water', 2: 'Fire', 3: 'Wind', 4: 'Ground' }
const ELEMENT_COLORS = {
  1: 'rgb(0, 122, 204)',
  2: 'rgb(173, 41, 13)',
  3: 'rgb(128, 148, 26)',
  4: 'rgb(140, 102, 0)'
}

const ANGLE_ORNAMENTS = [
  { key: 'top', x: 0, y: 260 },
  { key: 'bottom', x: 0, y: -260 },
  { key: 'left', x: -260, y: 0 },
  { key: 'right', x: 260, y: 0 }
]

const BLOCK_ORNAMENTS = [
  { key: 'top', x: -105, y: 105 },
  { key: 'bottom', x: 105, y: -105 },
  { key: 'left', x: -105, y: -105 },
  { key: 'right', x: 105, y: 105 }
]

const CLASS_BG = {
  1: 'spGachaClass01Black',
  2: 'spGachaClass02Black',
  3: 'spGachaClass03Black',
  4: 'spGachaClass04Black',
  5: 'spGachaClass05Black',
  6: 'spGachaClass06Black'
}

const BROKEN_CHIBI_SKELETONS = new Set([])

const cursor = ref(0)
const phaseIndex = ref(0)
const totemVisible = ref(true)
const totemFading = ref(false)
const bigStarsVisible = ref(true)
const bigStarsFading = ref(false)
const newHeroSkip = ref(true)
const typedText = ref('')
const chibiHost = ref(null)
let chibiLoadSeq = 0
let typeTimer = null
const stepTimers = []
const leaving = ref(false)

const displayItems = ref([...props.items])
const current = computed(() => displayItems.value[cursor.value] ?? {})
const angleOrnaments = computed(() => ANGLE_ORNAMENTS)
const blockOrnaments = computed(() => BLOCK_ORNAMENTS)
const elementSlug = computed(() => ELEMENT_SLUGS[current.value.element] ?? 'Water')
const chibiFallback = computed(() => BROKEN_CHIBI_SKELETONS.has(String(current.value.skeleton ?? '')))
const portraitX = computed(() => Number(current.value.imgPos?.x ?? 0))
const portraitY = computed(() => Number(current.value.imgPos?.y ?? 0))

function ornamentPos(x, y) {
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% - ${y}px)`
  }
}

const DUST = [
  { x: -612, y: 318, d: 0.0, s: 3 }, { x: -388, y: 356, d: 1.4, s: 2 },
  { x: -140, y: 330, d: 2.8, s: 4 }, { x: 126, y: 352, d: 0.7, s: 2 },
  { x: 402, y: 322, d: 2.1, s: 3 }, { x: 636, y: 346, d: 3.4, s: 2 },
  { x: -520, y: 40, d: 1.1, s: 2 }, { x: -246, y: -30, d: 3.9, s: 3 },
  { x: 88, y: 12, d: 2.4, s: 2 }, { x: 356, y: -56, d: 4.6, s: 3 },
  { x: 592, y: 26, d: 1.8, s: 2 }, { x: -66, y: -300, d: 3.1, s: 2 }
]
const dustMotes = DUST.map((mote, index) => ({
  key: `dust-${index}`,
  style: {
    left: `calc(50% + ${mote.x}px)`,
    top: `calc(50% - ${mote.y}px)`,
    width: `${mote.s}px`,
    height: `${mote.s}px`,
    animationDelay: `${mote.d}s`
  }
}))

function getClassTotemUrl(job) {
  if (job === 6) return getImageUrl('/images/gacha/chara_bg_class_6.png')
  return getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaClass0${job}Black.png`)
}

function getClassIconUrl(job) {
  return getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaClass0${job}.png`)
}

const elementColor = computed(() => ELEMENT_COLORS[current.value.element ?? 1] ?? ELEMENT_COLORS[1])
const starCount = computed(() => Number(current.value.rank ?? current.value.quality ?? 3))
const starTiming = computed(() => {
  const rarity = starCount.value
  return {
    delay: rarity === 3 ? 0.2 : rarity === 4 ? 0.35 : 0.25,
    gap: rarity === 5 ? 0.14 : 0.08,
    duration: rarity === 3 ? 1.05 : rarity === 4 ? 1.25 : 1.45
  }
})

function scheduleStarSounds() {
  const { delay, gap } = starTiming.value
  later(() => {
    playSound('card2')
    for (let i = 1; i < starCount.value; i += 1) {
      window.setTimeout(() => playSound('card9'), i * gap * 1000)
    }
  }, Math.max(delay - 0.1, 0) * 1000)
}

const nameBaseStyle = computed(() => ({
  right: 'calc(50% - 248px)',
  bottom: 'calc(50% - 118px)',
  width: '512px',
  height: '512px',
  transform: 'none',
  zIndex: 12
}))

function playSound(name) {
  playSfx(name)
}

function later(fn, ms) {
  stepTimers.push(window.setTimeout(fn, ms))
}

function clearTimers() {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
  while (stepTimers.length) window.clearTimeout(stepTimers.pop())
}

function startTypewriter() {
  clearTimers()
  const full = current.value.dialogue ?? ''
  typedText.value = ''
  if (starCount.value !== 3) playSound('card12')
  if (!full) return
  let index = 0
  typeTimer = setInterval(() => {
    index += 1
    typedText.value = full.slice(0, index)
    if (index >= full.length) {
      clearInterval(typeTimer)
      typeTimer = null
    }
  }, 38)
}

async function loadChibi() {
  const seq = ++chibiLoadSeq
  await nextTick()
  if (seq !== chibiLoadSeq) return
  const preset = current.value
  const host = chibiHost.value
  if (!host || !preset?.skeleton || chibiFallback.value) {
    pauseCanvasScenes('gacha-chibi')
    return
  }
  try {
    await new Promise(resolve => requestAnimationFrame(() => resolve()))
    if (seq !== chibiLoadSeq) return
    const { ready } = mountCanvasScene(
      'gacha-chibi',
      `chibi:${preset.skeleton}:${preset.skin ?? ''}`,
      host,
      [{
        key: 'hero',
        atlas: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.atlas`),
        skeleton: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.skel`),
        binary: true,
        skin: preset.skin,
        premultiply: true
      }],
      { fit: 'stage', initialAnimation: 'win', groundY: 282, viewportHeight: 2800 },
      {
        position: 'absolute',
        left: '-30px',
        top: '-110px',
        width: '440px',
        height: '520px',
        display: 'block',
        pointerEvents: 'none'
      }
    )
    const scene = await ready
    if (seq !== chibiLoadSeq) {
      pauseCanvasScenes('gacha-chibi')
      return
    }
    scene.play('hero', 'win', {
      onComplete: () => scene.play('hero', 'win_idle', { loop: true })
    })
  } catch (error) {
    console.warn('[GachaRevealPanel] loadChibi error:', error)
  }
}

function enterStep3() {
  phaseIndex.value = 2
  startTypewriter()
}

function step2Duration() {
  return starCount.value === 3 ? 1050 : 2400
}

function preloadCurrentChibi() {
  const preset = current.value
  if (!preset?.skeleton || chibiFallback.value) return
  preloadGachaSpineAssets([{
    key: 'hero',
    atlas: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.atlas`),
    skeleton: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.skel`),
    binary: true,
    skin: preset.skin
  }])
}

function enterResult() {
  clearTimers()
  phaseIndex.value = 0
  totemVisible.value = true
  totemFading.value = false
  bigStarsVisible.value = true
  bigStarsFading.value = false
  newHeroSkip.value = true
  scheduleStarSounds()
  if (replayMode.value) playSound('get3')
  preloadCurrentChibi()

  const { duration } = starTiming.value
  later(() => {
    // 关键过渡：角色和小人台子立即浮现，图腾和星星平滑淡出
    phaseIndex.value = 1
    playSound('card10')
    loadChibi()
    totemFading.value = true
    later(() => { totemVisible.value = false }, 400)
    later(() => { bigStarsFading.value = true }, 200)
    later(() => { bigStarsVisible.value = false }, 400)
    later(enterStep3, step2Duration())
  }, duration * 1000)
}

function advance() {
  if (leaving.value) return
  if (phaseIndex.value >= 2) {
    nextHero()
    return
  }
  if (starCount.value <= 4) {
    jumpToStep3()
    return
  }
  if (phaseIndex.value === 0) {
    clearTimers()
    totemFading.value = true
    later(() => { totemVisible.value = false }, 300)
    bigStarsVisible.value = false
    phaseIndex.value = 1
    playSound('card10')
    loadChibi()
    later(enterStep3, step2Duration())
    return
  }
  jumpToStep3()
}

function jumpToStep3() {
  clearTimers()
  totemVisible.value = false
  totemFading.value = false
  bigStarsVisible.value = false
  bigStarsFading.value = false
  phaseIndex.value = 2
  loadChibi()
  enterStep3()
}

function nextHero() {
  if (cursor.value + 1 >= displayItems.value.length) {
    emit('finish', { skipped: false })
    return
  }
  leaving.value = true
  clearTimers()
  later(() => {
    leaving.value = false
    cursor.value += 1
    enterResult()
  }, 450)
}

const replayMode = ref(false)

function skipAll() {
  clearTimers()
  const rest = displayItems.value.slice(cursor.value + 1).filter(item => Number(item.rank ?? item.quality) >= 5)
  if (!rest.length) {
    emit('finish', { skipped: true })
    return
  }
  displayItems.value.splice(cursor.value + 1, displayItems.value.length, ...rest)
  leaving.value = false
  cursor.value += 1
  replayMode.value = true
  enterResult()
}

watch(() => props.items, () => { displayItems.value = [...props.items]; cursor.value = 0; enterResult() })
onMounted(() => {
  playBgm('gacha_show_chara')
  if (displayItems.value.length) enterResult()
})
onBeforeUnmount(() => {
  clearTimers()
  chibiLoadSeq += 1
  pauseCanvasScenes('gacha-chibi')
  releaseSharedCanvas('gacha-chibi')
})
</script>

<style scoped>
.reveal-bg {
  position: absolute;
  inset: 0;
}

.reveal-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Step 1 职业图腾与金色大星 ── */
.reveal-class {
  width: 576px;
  height: 576px;
  pointer-events: none;
  transition: opacity 0.35s ease-out;
}

.reveal-class--fadeout {
  opacity: 0 !important;
}

.reveal-class__img {
  display: block;
  width: 576px;
  height: 576px;
  animation: reveal-class-play 1.8s ease-out both;
}

@keyframes reveal-class-play {
  0% { transform: scale(1.4); filter: brightness(0.3) saturate(1.4); opacity: 0; }
  8% { opacity: 0.9; }
  20% { transform: scale(0.7); filter: brightness(1.05) saturate(1); opacity: 0.85; }
  80% { transform: scale(0.65); filter: brightness(1.0); opacity: 0.6; }
  100% { transform: scale(0.63); opacity: 0.35; }
}

.reveal-bigstars-container {
  width: 500px;
  height: 120px;
  pointer-events: none;
  transition: opacity 0.25s ease-out;
}

.reveal-bigstars--fadeout {
  opacity: 0 !important;
}

.reveal-bigstar-item {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 76px;
  height: 76px;
  animation: reveal-bigstar-pop 0.45s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
}

.reveal-bigstar-img {
  width: 76px;
  height: 76px;
  display: block;
  filter: drop-shadow(0 0 14px rgba(255, 215, 0, 0.9)) drop-shadow(0 2px 5px rgba(0, 0, 0, 0.75));
}

@keyframes reveal-bigstar-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.1);
  }
  65% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.35);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.0);
  }
}

/* ── Step 2 & 3 BackFrame 菱形大框 ── */
.reveal-backframe-assembly {
  width: 1024px;
  height: 1024px;
  pointer-events: none;
  transition: transform 0.5s cubic-bezier(0.12, 0.82, 0.28, 1);
  z-index: 5;
}

.reveal-backframe--step3 {
  transform: translate(calc(-50% - 80px), -50%) !important;
}

.reveal-box {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  pointer-events: none;
  animation: reveal-box-pop 0.5s ease-out both;
}

.reveal-box--outer {
  width: 1024px;
  height: 1024px;
  margin: -512px 0 0 -512px;
  filter: drop-shadow(0 0 8px v-bind(elementColor));
}

.reveal-box--inner {
  width: 975px;
  height: 975px;
  margin: -487px 0 0 -487px;
  animation-duration: 0.3s;
  animation-delay: 0.1s;
}

@keyframes reveal-box-pop {
  0% { opacity: 0; transform: scale(0.35); }
  70% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}

.reveal-class--job6 .reveal-class__img {
  filter: brightness(0.25) contrast(1.3) drop-shadow(0 0 16px rgba(80, 140, 220, 0.45));
}

.reveal-backframe--star4 .reveal-box--outer,
.reveal-backframe--star5 .reveal-box--outer {
  animation: reveal-box-pop 0.5s ease-out both, reveal-box-breathe 2.4s ease-in-out infinite;
}

@keyframes reveal-box-breathe {
  0%, 100% { filter: drop-shadow(0 0 8px v-bind(elementColor)) drop-shadow(0 0 16px v-bind(elementColor)); }
  50% { filter: drop-shadow(0 0 14px v-bind(elementColor)) drop-shadow(0 0 28px v-bind(elementColor)); }
}

.reveal-star4-shines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.reveal-shine {
  position: absolute;
  color: #66f0ff;
  font-size: 32px;
  filter: drop-shadow(0 0 10px #00e1ff);
  animation: gacha-breathe-strong 2s ease-in-out infinite;
}

.reveal-shine--lt { left: 16%; top: 16%; }
.reveal-shine--rb { right: 16%; bottom: 16%; animation-delay: 1s; }

/* ── Step 2 & 3 台座符文环与角饰（跟随台座小人，真机1:1尺寸） ── */
.reveal-stage-ring {
  width: 480px;
  height: 480px;
  pointer-events: none;
  transition: transform 0.5s cubic-bezier(0.12, 0.82, 0.28, 1);
  z-index: 8;
}

.reveal-stage-ring--step3 {
  transform: translate(calc(-50% + 360px), -50%) !important;
}

.reveal-line {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 530px;
  height: 530px;
  margin: -265px 0 0 -265px;
  opacity: 0.9;
  pointer-events: none;
  animation: reveal-line-pop 0.5s ease-out both;
}

@keyframes reveal-line-pop {
  0% { opacity: 0; transform: scale(0.35); }
  70% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 0.9; transform: scale(1); }
}

.reveal-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 470px;
  height: 470px;
  margin: -235px 0 0 -235px;
  background-color: v-bind(elementColor);
  mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaTxtRing01.png');
  mask-size: 100% 100%;
  -webkit-mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaTxtRing01.png');
  -webkit-mask-size: 100% 100%;
  filter: drop-shadow(0 0 8px v-bind(elementColor));
  opacity: 0.85;
  pointer-events: none;
  animation: reveal-ring-in 0.5s ease-out both, gacha-ring-spin 8s linear infinite;
  z-index: 0;
}

@keyframes reveal-ring-in {
  0% { opacity: 0; transform: scale(0.35); }
  70% { opacity: 0.85; transform: scale(1.03); }
  100% { opacity: 0.75; transform: scale(1); }
}

.reveal-sparkles {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 410px;
  height: 410px;
  margin: -205px 0 0 -205px;
  pointer-events: none;
  animation: reveal-fade-in 0.3s ease-out both, gacha-breathe-strong 2.6s ease-in-out 0.5s infinite;
}

.reveal-ornament-angle {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 0;
}

.reveal-angle {
  display: block;
  width: 70px;
  height: 70px;
  background-color: v-bind(elementColor);
  mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaAngle01.png');
  mask-size: 100% 100%;
  -webkit-mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaAngle01.png');
  -webkit-mask-size: 100% 100%;
  filter: drop-shadow(0 0 5px v-bind(elementColor));
  pointer-events: none;
  animation: reveal-ornament-pop 0.4s ease-out both, gacha-breathe-strong 2.6s ease-in-out 0.4s infinite;
}

.reveal-ornament-block {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 0;
}

.reveal-block {
  display: block;
  width: 14px;
  height: 14px;
  background-color: v-bind(elementColor);
  mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaBlock04.png');
  mask-size: 100% 100%;
  -webkit-mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaBlock04.png');
  -webkit-mask-size: 100% 100%;
  pointer-events: none;
}

@keyframes reveal-ornament-pop {
  0% { opacity: 0; transform: scale(0.35); }
  70% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}

/* ── Step 3 立绘 ── */
.reveal-portrait {
  width: 0;
  height: 0;
  pointer-events: none;
  animation: reveal-fade-in 0.4s ease-out both;
}

.reveal-portrait__img {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: none;
  max-height: none;
  filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.65));
  animation: reveal-portrait-drift 4s cubic-bezier(0.1, 0.85, 0.25, 1) both;
}

@keyframes reveal-portrait-drift {
  0% { transform: translate(-50%, -50%) translateX(128px); }
  12.5% { transform: translate(-50%, -50%) translateX(-90px); }
  100% { transform: translate(-50%, -50%) translateX(-128px); }
}

/* ── Step 2 & 3 台座总装（Stage Assembly） ── */
.reveal-stage-assembly {
  width: 492px;
  height: 492px;
  pointer-events: none;
  transition: transform 0.5s cubic-bezier(0.12, 0.82, 0.28, 1);
  z-index: 15;
}

.reveal-stage--step3 {
  transform: translate(calc(-50% + 360px), -50%) !important;
}

/* 灰底盾牌托板：spGachaBlock01 492×492 @(0,0) */
.reveal-stage-block {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 492px;
  height: 492px;
  margin: -246px 0 0 -246px;
  z-index: 1;
  animation: reveal-fade-in 0.4s ease-out both;
}

/* 石质台座：spGachaDitai01 380×380 @(0,-118)（Step 2 登场弹入，还原 tweener 8/26 缩放弹起） */
.reveal-stage-ditai {
  position: absolute;
  left: 50%;
  top: calc(50% + 118px);
  width: 380px;
  height: 380px;
  margin: -190px 0 0 -190px;
  z-index: 2;
  animation: reveal-ditai-pop 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.25) both;
}

@keyframes reveal-ditai-pop {
  0% { transform: scale(0.1); opacity: 0; }
  65% { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* 小人宿主：380×380 @(0,-118) */
.reveal-chibi-host {
  position: absolute;
  left: 50%;
  top: calc(50% + 118px);
  width: 380px;
  height: 380px;
  margin: -190px 0 0 -190px;
  z-index: 5;
}

.reveal-chibi-fallback {
  position: absolute;
  left: 50%;
  top: calc(50% + 118px);
  width: 380px;
  height: 380px;
  margin: -190px 0 0 -190px;
  object-fit: contain;
  z-index: 5;
  animation: reveal-fade-in 0.4s ease-out both;
}


/* 台座正面星级行 @ y=-171 */
.reveal-pedestal-stars {
  position: absolute;
  left: 50%;
  top: calc(50% + 171px);
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  pointer-events: none;
}

.reveal-pedestal-star {
  position: relative;
  width: 48px;
  height: 48px;
  margin: 0 -9px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 6px rgba(255, 200, 50, 0.45));
  animation: reveal-pedestal-star-in 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
}

@keyframes reveal-pedestal-star-in {
  0% { opacity: 0; transform: scale(1.6); }
  100% { opacity: 1; transform: scale(1.0); }
}

/* 新获得 @ (104, -108) */
.reveal-stage-new {
  position: absolute;
  left: calc(50% + 104px);
  top: calc(50% + 108px);
  transform: translate(-50%, -50%);
  z-index: 7;
}

/* 属性菱形标 @ pos=(510, 122) in Unity -> dx=+148, dy=+118 from stage */
.reveal-stage-element {
  position: absolute;
  left: calc(50% + 148px);
  top: calc(50% - 118px);
  width: 72px;
  height: 72px;
  transform: translate(-50%, -50%);
  z-index: 7;
  animation: reveal-fade-in 0.4s ease-out both;
  pointer-events: none;
}

.reveal-element-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 职业菱形标 @ pos=(573, 79) in Unity -> dx=+208, dy=+79 from stage */
.reveal-stage-class {
  position: absolute;
  left: calc(50% + 208px);
  top: calc(50% - 79px);
  width: 120px;
  height: 120px;
  transform: translate(-50%, -50%);
  z-index: 8;
  animation: reveal-fade-in 0.4s ease-out both;
  pointer-events: none;
}

.reveal-class-frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.reveal-class-icon {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* ── Step 3 名牌与徽标 ── */
.reveal-tag-img {
  display: block;
  width: 128px;
  height: 128px;
}

.reveal-tag-img--base { width: 320px; height: 320px; }
.reveal-tag-img--sm { width: 64px; height: 64px; }

.reveal-namebase {
  position: absolute;
  width: 512px;
  height: 512px;
  animation: reveal-fade-in 0.5s ease-out both;
}

.reveal-namebase img { width: 512px; height: 512px; display: block; }

.reveal-nameblock {
  display: block;
  width: 56px;
  height: 56px;
}

.reveal-name {
  width: 400px;
  font-size: 48px;
  font-weight: 700;
  text-align: right;
  transform: translate(-100%, -50%);
  animation: reveal-name-slide 0.5s ease-out both;
  color: #fff8e8;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}

@keyframes reveal-name-slide {
  from { transform: translate(calc(-100% + 120px), -50%); opacity: 0; }
  to { transform: translate(-100%, -50%); opacity: 1; }
}

.reveal-new { display: block; width: 144px; height: 92px; animation: reveal-star-pop 0.45s ease-out both; }
.reveal-new + .reveal-new { position: absolute; left: 0; top: 0; }
.reveal-new--shine {
  mix-blend-mode: screen;
  animation: gacha-glow-pulse 1.8s ease-in-out infinite;
}

/* ── 粒子近似 ── */
.reveal-dust {
  width: 0;
  height: 0;
  pointer-events: none;
}

.reveal-dust span {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 240, 200, 0.85);
  box-shadow: 0 0 6px rgba(255, 226, 150, 0.8);
  animation: reveal-dust-drift 6.5s ease-in-out infinite;
}

@keyframes reveal-dust-drift {
  0% { transform: translateY(10px) scale(0.6); opacity: 0; }
  35% { opacity: 0.9; }
  100% { transform: translateY(-46px) scale(1); opacity: 0; }
}

/* ── 转场与退出 ── */
.reveal-out {
  animation: reveal-slide-out 0.45s cubic-bezier(0.32, 0, 0.67, 0) both !important;
}

@keyframes reveal-slide-out {
  from { transform: translate(calc(-50% + 360px), -50%); opacity: 1; }
  to { transform: translate(calc(-50% + 720px), -50%); opacity: 0; }
}

.reveal-fade-out {
  animation: reveal-fade-out 0.45s ease-in both !important;
}

@keyframes reveal-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes reveal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── 跳过与台词 ── */
.reveal-skip {
  border: 0;
  width: 128px;
  height: 60px;
  background: none;
  padding: 0;
}

.reveal-skip img { width: 128px; height: 60px; }
.reveal-skip:active img { content: url('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip_press.png'); }

.reveal-text {
  width: 960px;
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
}

.reveal-text__bg {
  position: absolute;
  inset: 0;
  height: 88px;
  width: 100%;
  object-fit: fill;
  opacity: 0.92;
  animation: reveal-text-expand 0.8s ease-out both;
}

@keyframes reveal-text-expand {
  from { width: 256px; left: calc(50% - 128px); }
  to { width: 960px; left: calc(50% - 480px); }
}

.reveal-text__body {
  position: relative;
  width: 900px;
  margin: 0;
  font-size: 20px;
  line-height: 1.4;
  text-align: center;
  white-space: pre-wrap;
  color: #fff6e2;
}

.reveal-progress {
  width: 120px;
  text-align: left;
}

.reveal-click-catcher {
  position: absolute;
  inset: 0;
  z-index: 50;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  transform: none;
}
</style>
