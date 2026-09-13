<template>
  <!-- 整页演出：HeroGachaShowPanel（角色揭晓）的三段式完整还原。
       背景 = 揭晓 prefab 专属暗黑殿堂 `bg.png`（1700×1220，depth 0），非卡池商店；
       step1 星级弹出（classStars 大星 → stars 星级行）→ step2 backFrame 构建
       （spGachaBox01/02 菱形双框 + 属性染色光晕 + 符文环 + 角饰）与 Q 版小人
       `win → win_idle` → step3 立绘 + 名牌 + 台词。
       注意：`.g-abs` 靠 transform 居中，凡做 transform 动画的元素一律包一层
       静默 g-abs 容器，动画只挂在内部 img 上。 -->
  <GachaStage :backdrop="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')" fit="height">
    <!-- ── 背景层 ── -->
    <!-- 揭晓殿堂底（prefab UITexture 1700×1220 depth 0 = bg.png） -->
    <div class="g-abs g-layer-bg reveal-bg" :style="gachaPos(0, 0)">
      <img :src="getImageUrl('/images/uipanel/herogachashowpanel/bg.png')" alt="" />
    </div>
    <!-- lineAlpha：spGachaLine01（958×958）@974×974，backFrame 段 alpha 0→1（tween[13]） -->
    <div v-if="phaseIndex >= 1" class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaLine01.png')" alt="" class="reveal-line" />
    </div>
    <template v-if="phaseIndex >= 1">
      <!-- 属性染色光晕（elementTex/elementPar 按 InitElementColor 染色，色值取 prefab
           elementColors）+ spGachaColor01 740×740（backFrameStar，tween[5] alpha 0→0.5） -->
      <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
        <div class="reveal-glow" aria-hidden="true"></div>
      </div>
      <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaColor01.png')"
          alt=""
          class="reveal-colordiamond"
        />
      </div>
      <!-- 菱形双框：spGachaBox02（外 1024）+ spGachaBox01（内 975），scale 弹入（tween[0]/[8]/[9]） -->
      <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
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
      </div>
      <!-- ring：spGachaTxtRing01（850×848）@866×864 = **符文文字环**（textRingRot），
           alpha 0→0.75（tween[12]），TweenRotation 0→-360 8s 匀速（tween[11]）；
           白色符文按属性染色（InitElementColor → elementTex） -->
      <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
        <div class="reveal-ring" aria-hidden="true"></div>
      </div>
      <!-- 四角闪块：spGachaStar02 410×410（四角自带闪块），alpha 0→1（tween[15]）+ 呼吸 -->
      <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaStar02.png')"
          alt=""
          class="reveal-sparkles"
        />
      </div>
      <!-- 风纹 elementAlpha：`spGachaWind01` 80×80 @(0,±460)/(±460,0)（初始 α=1）；
           step3 时内收到 ±360 并淡出（`spineStageTweenPlay` 段 8~15）。 -->
      <div
        v-for="wind in windMarks"
        :key="wind.key"
        class="g-abs g-layer-bg"
        :class="{ 'reveal-wind--in': phaseIndex >= 2 }"
        :style="gachaPos(wind.x, wind.y)"
      >
        <div class="reveal-wind" :style="{ backgroundImage: `url('${getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGacha${elementSlug}01.png`)}')` }"></div>
      </div>
    </template>

    <!-- classStars 底图：`spGachaClass0{job}Black` 576×576（scale 1.4，depth 2）。
         `classStarsTweenPlay`：scale 2.5s 脉冲 + 5 段色变（深蓝 → 白）dur 2.25 → 2.5s 后淡出。 -->
    <div v-if="classSprite" class="g-abs g-layer-bg reveal-class" :style="gachaPos(0, 0)">
      <img :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/${classSprite}.png`)" alt="" class="reveal-class__img" />
    </div>

    <!-- 粒子近似（源码 83 个 ParticleSystem：`par_sys_dust` 浮尘、`classGlow` 纹章辉光、
         `star5FX` 的流星 meteorFire1/2、每颗星的星屑爆闪）：用 CSS 关键帧近似，不改演出时序。 -->
    <div class="g-abs g-layer-deco reveal-dust" :style="gachaPos(0, 0)" aria-hidden="true">
      <span v-for="mote in dustMotes" :key="mote.key" :style="mote.style"></span>
    </div>
    <template v-if="starCount >= 5">
      <div
        v-for="meteor in meteors"
        :key="meteor.key"
        class="g-abs g-layer-deco reveal-meteor"
        :style="{ ...gachaPos(meteor.x, meteor.y), '--meteor-delay': `${meteor.delay}s` }"
        aria-hidden="true"
      ></div>
    </template>

    <!-- ── 角色层（游戏 mDepth 40~75）──
         step3 站位（源码 `spineStageTweenPlay` 段 0~7 与 21）：立绘淡入后，
         **台座 + Q 版小人一起右移到 +360**，`midFrame`（spGachaBlock01 492×492 灰菱形托板）
         α→1 垫在下面，星级与新获得跟着走；大菱形框左移 160。这与游戏画面一致：
         立绘居中偏左、右侧一块灰菱形托板里站着 Q 版小人 + 星级 + 新获得。 -->
    <div
      v-if="phaseIndex >= 2"
      class="g-abs g-layer-art reveal-panel"
      :style="{ ...gachaPos(360, -110), zIndex: 13 }"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock01.png')" alt="" class="reveal-panel__img" />
    </div>
    <!-- nameBase：spGachaNameDown01 512×512，pivot=BottomRight（depth 59） -->
    <div class="g-abs g-layer-art reveal-namebase" :style="{ ...nameBaseStyle, zIndex: 12 }">
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaNameDown01.png')" alt="" />
    </div>
    <!-- heroPic / heroPicShadow：prefab `heroPic/PIC` 712×936（depth 40，立绘在最下）。
         位置 = **逐角色的 `hero.ImgPos`**（源码 `heroPic.localPosition = ImgPos + gachaCharaOffset`，
         后者 prefab 序列化为 (0,0)）；缺该字段时退回居中偏左。 -->
    <div
      v-if="phaseIndex >= 2"
      class="g-abs g-layer-art reveal-portrait"
      :style="{ ...gachaPos(portraitX, portraitY), zIndex: 11 }"
    >
      <img :key="current.typeId" :src="getImageUrl(current.portrait)" :alt="current.name" />
    </div>
    <!-- midFrame：UITexture 492×492（depth 60）。InitStar：`midFrame.alpha = (rare==3) ? 1 : 0`
         —— 3 星的中心底盘（chara_bg_center_only 1080×1080） -->
    <div v-if="starCount === 3" class="g-abs g-layer-art" :style="{ ...gachaPos(0, 0), zIndex: 13 }">
      <img
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/chara_bg_center_only.png')"
        alt=""
        class="reveal-midframe"
      />
    </div>
    <!-- stage：spGachaDitai01 380×380 @(0,-116)（depth 61）→ step3 与小人一起右移到 +360 -->
    <div
      class="g-abs g-layer-art reveal-stage-wrap"
      :class="{ 'reveal-out': leaving }"
      :style="{ ...gachaPos(phaseIndex >= 2 ? 360 : 0, -116), zIndex: 14 }"
    >
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaDitai01.png')" alt="" class="reveal-stage" />
    </div>
    <!-- elementIcon 与 classFrame/classIcon：prefab @(510,122) / @(573,79)（托板右上角，随 step3 定位） -->
    <template v-if="phaseIndex >= 2">
      <div class="g-abs g-layer-art" :style="{ ...gachaPos(510, 122), zIndex: 15 }">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}03.png`)"
          alt=""
          class="reveal-tag-img"
        />
      </div>
      <template v-if="current.job">
        <div class="g-abs g-layer-art" :style="{ ...gachaPos(573, 79), zIndex: 15 }">
          <img
            :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock05.png')"
            alt=""
            class="reveal-tag-img"
          />
          <img
            :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaClass0${current.job}.png`)"
            alt=""
            class="reveal-tag-img reveal-tag-img--stack"
          />
        </div>
      </template>
    </template>
    <!-- heroAnimRoot：Q 版小人 Spine（**mDepth 75、scale 0.95**）。它必须在立绘之上
         （此前 DOM 顺序让立绘盖住了小人，表现为「小人没做出来」）。step3 随台座右移 +360。 -->
    <div
      class="g-abs g-layer-art reveal-chibi-wrap"
      :class="{ 'reveal-out': leaving }"
      :style="{ ...gachaPos(phaseIndex >= 2 ? 360 : 0, -114), zIndex: 16 }"
    >
      <canvas v-if="!chibiFallback" ref="chibiCanvasEl" class="reveal-chibi"></canvas>
      <!-- 骨架解析异常的角色：用游戏内卡面 `gacha_at*.png` 静态代替，避免错乱模型 -->
      <img
        v-else
        :key="current.typeId"
        :src="getImageUrl(current.card)"
        :alt="current.name"
        class="reveal-chibi reveal-chibi--fallback"
      />
    </div>

    <!-- ── 星级（step1）── -->
    <!-- classStars：大星在角色身后中央弹出（InitStar 逐颗 num+j*gap，音效 card2/card9），
         HideStarIE 0.2s 后隐藏并显示下方星级行 -->
    <div v-if="bigStarsVisible" class="g-abs g-layer-ui reveal-bigstars" :style="gachaPos(0, -20)">
      <img
        v-for="(star, index) in starCount"
        :key="index"
        :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaMeteor01.png')"
        alt=""
        class="reveal-bigstar"
        :style="{ animationDelay: `${starTiming.delay + index * starTiming.gap}s` }"
      />
    </div>
    <!-- stars：星级行。prefab `stage(0,-118)` 下的 `stars2(0,-53)` → 绝对 (0,-171)；
         step3 台座右移 +360 时跟随（`InitStar` 的 x 偏移 (5-rare)*20 只作用于 step1/2）。 -->
    <div
      class="g-abs g-layer-ui reveal-stars"
      :style="{ ...gachaPos(phaseIndex >= 2 ? 360 : (5 - starCount) * 20, -171), opacity: plainStarsVisible ? 1 : 0 }"
    >
      <img
        v-for="(star, index) in starCount"
        :key="index"
        :src="getImageUrl('/images/gacha/ui/gacha_star.png')"
        alt=""
        class="reveal-star"
        :style="{ '--star-from': `${-80 - (-80 + index * 40)}px`, animationDelay: `${0.5 + index * starTiming.gap}s` }"
      />
    </div>

    <!-- ── 文字与徽标层（depth 77~100）：坐标取 prefab `nameRoot(248,-104)` / `classRoot(246,-126)`
         的序列化值 —— name 右端 (128,-70)、block (158,-68)、职业/属性标签一排在 y=-126
         （class 左缘 94 / element 右缘 131）、elementTextBase 底带中心 (104,-126)。 ── -->
    <template v-if="phaseIndex >= 2">
      <!-- elementTextBase：`spGachaTag{Element}02` 320×320 中心 (104,-126)（软边横带贴图，按原尺寸渲染） -->
      <div class="g-abs g-layer-ui" :style="gachaPos(104, -126)" aria-hidden="true">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}02.png`)"
          alt=""
          class="reveal-tag-img reveal-tag-img--base"
        />
      </div>
      <!-- classText 128×128 pivot=Left，左缘 94 → 中心 (158,-126) -->
      <div v-if="current.job" class="g-abs g-layer-ui" :style="gachaPos(158, -126)">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTagClass0${current.job}.png`)"
          alt=""
          class="reveal-tag-img"
        />
      </div>
      <!-- elementText 64×64 pivot=Right，右缘 131 → 中心 (99,-126) -->
      <div class="g-abs g-layer-ui" :style="gachaPos(99, -126)">
        <img
          :src="getImageUrl(`/images/HeroGachaShowPanel_Atlas/spGachaTag${elementSlug}01.png`)"
          alt=""
          class="reveal-tag-img reveal-tag-img--sm"
        />
      </div>
      <!-- block 56×56 @(158,-68)、name 48px pivot=Right 右端 (128,-70) -->
      <div class="g-abs g-layer-ui" :style="gachaPos(158, -68)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock03.png')"
          alt=""
          class="reveal-nameblock"
        />
      </div>
      <div class="g-abs g-layer-ui g-text reveal-name" :style="gachaPos(128, -70)">{{ current.name }}</div>
      <!-- newIcon (464,-108)：gacha_new 144×92 + newIconShine 同位置加色叠加（depth 91~92）。
           `HeroGachaShowPanelUI.InitData`：`iconNew.SetActive(newHero)` —— **只有新角色显示角标**；
           重复获得在揭晓里不显示任何角标（此前本站额外挂的 gacha_reget 取图 404，已移除）。 -->
      <div v-if="current.isNew" class="g-abs g-layer-ui" :style="gachaPos(464, -108)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_new.png')"
          alt="新伙伴"
          class="reveal-new"
        />
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_new.png')"
          alt=""
          class="reveal-new reveal-new--shine"
        />
      </div>
    </template>
    <!-- 四向角饰（Step1Pos (0,±460)/(±460,0)，scale 2→1 弹入后 1↔0.275 呼吸）
         与四方块（(±194,±194) 24×24） -->
    <template v-if="phaseIndex >= 1">
      <div v-for="angle in angleOrnaments" :key="angle.key" class="g-abs g-layer-ui" :style="gachaPos(angle.x, angle.y)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaAngle01.png')"
          alt=""
          class="reveal-angle"
        />
      </div>
      <div v-for="block in blockOrnaments" :key="block.key" class="g-abs g-layer-ui" :style="gachaPos(block.x, block.y)">
        <img
          :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/spGachaBlock04.png')"
          alt=""
          class="reveal-block"
        />
      </div>
    </template>
    <!-- Rconer / Rconer2：1700×1220 全屏角框，alpha 0.25 / 0.05（prefab depth 100） -->
    <div class="g-abs g-layer-ui reveal-corner" :style="gachaPos(0, 0)">
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/Rconer.png')" alt="" class="reveal-corner__one" />
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/Rconer2.png')" alt="" class="reveal-corner__two" />
    </div>

    <!-- ── 抽卡台词（gachaTextRoot，UIAnchor 底部偏移 93 → y≈-282；源码 step3 后
         UISprite 宽度改 960）── -->
    <div v-if="phaseIndex >= 2 && current.dialogue" class="g-abs g-layer-interactive reveal-text" :style="gachaPos(0, -282)">
      <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_text.png')" alt="" class="reveal-text__bg" />
      <p class="g-text reveal-text__body">{{ typedText }}</p>
    </div>

    <!-- 进度提示：对应 ShowHeroTime 的「第 x / n 位」 -->
    <div v-if="displayItems.length > 1" class="g-abs g-layer-ui g-text g-text--sm g-text--dim reveal-progress" :style="gachaPos(-660, 330)">
      {{ cursor + 1 }} / {{ displayItems.length }}
    </div>

    <!-- 点击推进（HeroGachaShowPanelUI.Click：按稀有度跳段） -->
    <button class="reveal-click-catcher g-focusable" type="button" aria-label="继续" @click="advance"></button>

    <!-- 跳过：HUD 层（视口锚定） -->
    <template #hud>
      <button class="reveal-skip" type="button" title="跳过（跳过后只保留 5 星）" @click="skipAll">
        <img :src="getImageUrl('/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png')" alt="跳过" />
      </button>
    </template>
  </GachaStage>
</template>

<script setup>
/**
 * 揭晓演出（游戏 `HeroGachaShowPanel` + `HeroGachaShowPanelUI` 的完整还原）。
 *
 * 布局坐标与贴图来自原始 prefab `herogachashowpanel` 组件转储；动画节奏来自
 * `HeroGachaShowPanelUI` 的 ExtentionTweenPlay 序列（backFrame 30 段）与 `InitStar`：
 *   - 背景：揭晓殿堂 `bg.png`（prefab UITexture 1700×1220 depth 0），Rconer/Rconer2
 *     压顶（alpha 0.25/0.05）；
 *   - step1 星级：classStars 大星在角色身后逐颗弹出（3★ 0.25/1.6s、4★ 0.75/1.9s、
 *     5★ 0.5/2.25s，星间距 5★ 0.2s 其余 0.08s，音效 card2 起始 + card9 逐颗），
 *     `HideStarIE` 0.2s 后切换到下方星级行 (0,-171)；
 *   - step2 backFrame：spGachaColor01（740×740，属性染色光晕）→ spGachaBox02/Box01
 *     菱形双框弹入 → 符文文字环（spGachaTxtRing01，属性染色 8s 旋转）→ 四向角饰 (0,±460)/(±460,0) 与
 *     四方块 (±194,±194) scale 2→1；同时 Q 版小人（gacha-presentation 的 Npc 骨架）播
 *     `win` → `win_idle`；`InitStar`：midFrame 仅 3★ 可见；
 *   - step3：立绘 heroPic/heroPicShadow（712×936）、名牌、属性/职业标签、新/重复
 *     徽标、台词打字机，textRing 旋转（TweenRotation 0→-360 8s）；
 *   - 点击跳段（源码 Click）：3/4 星一击直达 step3；5 星第一击跳过 step1+2、
 *     第二击跳过 step3；新角色在徽标动画完成前点击无效（newHeroSkip）。
 *
 * 与游戏的差异：83 个粒子系统（星星粒子、star4/5FX、流星）用 CSS 近似；立绘未按
 * `hero.ImgPos` 精确定位（产物不含该字段，改为居中缩放）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { createSpineScene } from '../../utils/gachaSpinePlayer'
import { playBgm, playSfx } from '../../utils/gachaAudio'

const props = defineProps({
  /** 本次抽取结果列表（顺序即演出顺序）。 */
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['finish', 'share'])
const ELEMENT_SLUGS = { 1: 'Water', 2: 'Fire', 3: 'Wind', 4: 'Ground' }
/** InitElementColor 的 elementColors（prefab HeroGachaShowPanelUI 序列化值）。 */
const ELEMENT_COLORS = {
  1: 'rgb(0, 122, 204)',
  2: 'rgb(173, 41, 13)',
  3: 'rgb(128, 148, 26)',
  4: 'rgb(140, 102, 0)'
}

/** prefab `cornerAlpha/{top,bottom,left,right}`：`spGachaAngle01` 128×128 @(0,±479)/(±480,-1)。 */
const ANGLE_ORNAMENTS = [
  { key: 'top', x: 0, y: 479 },
  { key: 'bottom', x: 0, y: -481 },
  { key: 'left', x: -480, y: -1 },
  { key: 'right', x: 480, y: -1 }
]

/** prefab `blockAlpha/{top,bottom,left,right}`：`spGachaBlock04` 24×24 @(±194,±194)。 */
const BLOCK_ORNAMENTS = [
  { key: 'top', x: -194, y: 194 },
  { key: 'bottom', x: 194, y: -194 },
  { key: 'left', x: -194, y: -194 },
  { key: 'right', x: 194, y: 194 }
]

/** prefab `elementAlpha/{top,bottom,left,right}`：`spGachaWind01` 80×80 @(0,±460)/(±460,0)。
 *  step3 时四边同时内收到 ±360 并淡出（`spineStageTweenPlay` 段 8~15）。 */
const WIND_MARKS = [
  { key: 'top', x: 0, y: 460 },
  { key: 'bottom', x: 0, y: -460 },
  { key: 'left', x: -460, y: 0 },
  { key: 'right', x: 460, y: 0 }
]

/** `classStars` 底图：`spGachaClass0{job}Black` 576×576（prefab `classTex`，scale 1.4、depth 2）。 */
const CLASS_BG = {
  1: 'spGachaClass01Black',
  2: 'spGachaClass02Black',
  3: 'spGachaClass03Black',
  4: 'spGachaClass04Black',
  5: 'spGachaClass05Black',
  6: 'spGachaClass06Black'
}

/**
 * 已知骨架解析异常的角色（Spine `.skel` 与 spine-webgl 4.0.31 不兼容，附件尺寸/位置错乱，
 * 表现为「碎片堆」）。实测：`Npc_007`（拉碧丝）异常，`Npc_005/011/012/015/033/050` 正常；
 * 这些角色的 Q 版小人改用其**卡面** `gacha_at*.png` 静态代替（游戏原素材），不显示错乱模型。
 * 若后续换用可正确解析的骨架（或升级播放器），把该骨架从名单移除即可恢复 Spine 演出。
 */
const BROKEN_CHIBI_SKELETONS = new Set([])

const cursor = ref(0)
/** 0 = step1 星级，1 = step2 backFrame+小人，2 = step3 立绘与名牌。 */
const phaseIndex = ref(0)
const bigStarsVisible = ref(true)
const plainStarsVisible = ref(false)
const newHeroSkip = ref(true)
const typedText = ref('')
const chibiCanvasEl = ref(null)
let chibiScene = null
let chibiLoadSeq = 0
let typeTimer = null
const stepTimers = []
/** 换人滑动过渡（源码转场 ExtentionTweenPlay #43848：台座与小人 (0,·)→(360,·) 0.5s）。 */
const leaving = ref(false)

/**
 * 揭晓展示列表：props.items 的本地副本。跳过时（对应 `HeroGachaShowPanel.Skip`）
 * 只在副本里保留 5 星继续展示——**不得直接 splice props.items**：那是共享的
 * revealItems，结果一览（HeroShowPanel）要展示完整名单。
 */
const displayItems = ref([...props.items])
const current = computed(() => displayItems.value[cursor.value] ?? {})
const angleOrnaments = computed(() => ANGLE_ORNAMENTS)
const blockOrnaments = computed(() => BLOCK_ORNAMENTS)
const windMarks = computed(() => WIND_MARKS)
const elementSlug = computed(() => ELEMENT_SLUGS[current.value.element] ?? 'Water')
/** 骨架解析异常时改用卡面静态图（见 `BROKEN_CHIBI_SKELETONS`）。 */
const chibiFallback = computed(() => BROKEN_CHIBI_SKELETONS.has(String(current.value.skeleton ?? '')))
/** 立绘站位：逐角色 `hero.ImgPos`（源码口径 `ImgPos + gachaCharaOffset(0,0)`）；
 *  数据缺失时退回「居中偏左」兜底。 */
const portraitX = computed(() => Number(current.value.imgPos?.x ?? -140))
const portraitY = computed(() => Number(current.value.imgPos?.y ?? -30))

/** 背景浮尘（`par_sys_dust` 1/2 @(0,500)、3 @(0,-13) 的近似）：固定图案 + 错开延迟。 */
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

/** 5 星流星（`star5FX` 的 meteorFire1 @(-997,-115)、meteorFire2 @(220,-800)）：
 *  粒子贴图当静态 img 渲染会变成一大块棕色方框，改用 CSS 光痕近似。 */
const meteors = [
  { key: 'm1', x: -560, y: 120, delay: 0 },
  { key: 'm2', x: 320, y: -180, delay: 1.1 }
]
/** 职业底图（`classStars` 的 `classTex`）：`spGachaClass0{job}Black` 576×576（scale 1.4）。
 *  `classStarsTweenPlay` 在 2.5s 时把它淡出，但游戏画面里 step3 仍能看到**背景底图上的
 *  巨大职业纹章**（`bg.png` 自带的纹章 + 这一层的余留），所以这里保留整段可见、只压低不透明度。 */
const classSprite = computed(() => CLASS_BG[current.value.job] ?? '')
const elementColor = computed(() => ELEMENT_COLORS[current.value.element ?? 1] ?? ELEMENT_COLORS[1])
const starCount = computed(() => Number(current.value.rank ?? current.value.quality ?? 3))
const starTiming = computed(() => {
  const rarity = starCount.value
  return {
    delay: rarity === 3 ? 0.25 : rarity === 4 ? 0.75 : 0.5,
    gap: rarity === 5 ? 0.2 : 0.08,
    duration: rarity === 3 ? 1.6 : rarity === 4 ? 1.9 : 2.25
  }
})

/** 逐星音效节奏（源码 InitStar / PlayStarsPopUpSound）：card2 首颗、card9 后续。 */
function scheduleStarSounds() {
  const { delay, gap } = starTiming.value
  later(() => {
    playSound('card2')
    for (let i = 1; i < starCount.value; i += 1) {
      window.setTimeout(() => playSound('card9'), i * gap * 1000)
    }
  }, Math.max(delay - 0.1, 0) * 1000)
}

/** `nameBase` 用 prefab 的 pivot 定位：`spGachaNameDown01` 512×512、**mPivot=8（BottomRight）**，
 *  节点 localPosition (0,-14) → 贴图矩形的**右下角落在设计 (0,-14)**（即 x∈[-512,0]、y∈[-14,498]）。 */
const nameBaseStyle = computed(() => ({
  right: '50%',
  bottom: 'calc(50% + 14px)',
  transform: 'none'
}))

/** 音效：统一走 `utils/gachaAudio.js`（音效开关在那里统一生效，关闭时不发声）。 */
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

/** Q 版小人：按 Npc 骨架加载并播 win → win_idle（源码 scale 0.95，进场即播）。 */
async function loadChibi() {
  const seq = ++chibiLoadSeq
  chibiScene?.dispose()
  chibiScene = null
  const preset = current.value
  const canvas = chibiCanvasEl.value
  if (!canvas || !preset?.skeleton || chibiFallback.value) return
  try {
    // 等一帧再量尺寸：GachaStage 的画布缩放由父组件 onMounted 里测量，
    // 子组件先挂载时 `getBoundingClientRect` 还是未缩放的 460 → 背衬偏小、画面发软。
    await new Promise(resolve => requestAnimationFrame(() => resolve()))
    if (seq !== chibiLoadSeq) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round((rect.width || 460) * dpr))
    canvas.height = Math.max(1, Math.round((rect.height || 460) * dpr))
    const scene = await createSpineScene(canvas, [
      {
        key: 'hero',
        atlas: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.atlas`),
        skeleton: getImageUrl(`/images/gacha/spine/heroes/${preset.skeleton}/${preset.skeleton}.skel`),
        binary: true,
        skin: preset.skin,
        premultiply: true
      }
    ], { fit: 'bounds', initialAnimation: 'win' })
    if (seq !== chibiLoadSeq) {
      scene.dispose()
      return
    }
    chibiScene = scene
    scene.play('hero', 'win', {
      onComplete: () => scene.play('hero', 'win_idle', { loop: true })
    })
  } catch (error) {
    // 小人演出不可用（无 WebGL / 骨架缺失）：保持立绘演出，不阻塞揭晓
  }
}

function enterStep3() {
  phaseIndex.value = 2
  startTypewriter()
}

/** step2（backFrame 构建）时长：源码 `tween[28].duration` —— 3★ 时 `InitStar` 固定为
 *  `min(delayWin=1.05, 3)` 秒；4/5★ 取 Spine `win` 动画时长（无逐角色数据，按 3s 上限）。
 *  十连全 3★ 时每只节省约 2 秒。 */
function step2Duration() {
  return starCount.value === 3 ? 1050 : 3000
}

/** 进入某个结果（InitData + PlayGachaShowAnim）：step1 星级 → step2 backFrame → step3。 */
function enterResult() {
  clearTimers()
  phaseIndex.value = 0
  bigStarsVisible.value = true
  plainStarsVisible.value = false
  // 新角色在「新获得」徽标动画期间点击无效（源码 newHeroSkip），动画后恢复可跳段
  newHeroSkip.value = !current.value.isNew
  later(() => { newHeroSkip.value = true }, 1500)
  loadChibi()
  scheduleStarSounds()
  if (replayMode.value) playSound('get3')
  const { duration, gap } = starTiming.value
  later(() => {
    // Step1Finish → HideStarIE（0.2s 后换普通星级行）→ backFrame 构建（step2）
    later(() => {
      bigStarsVisible.value = false
      plainStarsVisible.value = true
    }, 200)
    phaseIndex.value = 1
    playSound('card10')
    // backFrame 主段（源码 tween[28]）后进 step3
    later(enterStep3, step2Duration())
  }, (duration + starCount.value * gap) * 1000)
}

/**
 * 点击推进（源码 Click）：3/4 星一击直达 step3；5 星第一击跳到 step2 尾、第二击进
 * step3；step3 中点击 → 下一个结果。
 */
function advance() {
  if (leaving.value) return
  if (phaseIndex.value >= 2) {
    nextHero()
    return
  }
  if (!newHeroSkip.value) return
  if (starCount.value <= 4) {
    jumpToStep3()
    return
  }
  // 5 星：两段跳（第一击 step1+2，第二击 step3）
  if (phaseIndex.value === 0) {
    clearTimers()
    bigStarsVisible.value = false
    plainStarsVisible.value = true
    phaseIndex.value = 1
    playSound('card10')
    later(enterStep3, step2Duration())
    return
  }
  jumpToStep3()
}

/** 直达 step3（SetTweenPlayFinish：全部 tween 置终态）。 */
function jumpToStep3() {
  clearTimers()
  bigStarsVisible.value = false
  plainStarsVisible.value = true
  enterStep3()
}

/** 换人滑动转场（源码 #43848：台座/小人 0.5s 滑出右侧）后进入下一个结果。 */
function nextHero() {
  if (cursor.value + 1 >= displayItems.value.length) {
    emit('finish', { skipped: false })
    return
  }
  leaving.value = true
  later(() => {
    leaving.value = false
    cursor.value += 1
    enterResult()
  }, 500)
}

/** 跳过补展示模式（源码 `ShowRest5StarHeroTime`）：剩余 5★ 逐只重演，每只开头播 `get3`。 */
const replayMode = ref(false)

/** 跳过：等价 `HeroGachaShowPanel.Skip()` —— 只保留 5 星继续展示，其余直接结束。 */
function skipAll() {
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
  // 揭晓 BGM：`HeroGachaShowPanelUI` 在揭晓阶段播 `gacha_show_chara`（翻卡段已切到这首，
  // 同名不重启，保证音乐连续）。
  playBgm('gacha_show_chara')
  if (displayItems.value.length) enterResult()
})
onBeforeUnmount(() => {
  clearTimers()
  chibiLoadSeq += 1
  chibiScene?.dispose()
  chibiScene = null
})
</script>

<style scoped>
.reveal-bg {
  width: 1534px;
  height: 750px;
  overflow: hidden;
}

.reveal-bg img {
  width: 1700px;
  height: 1220px;
  object-fit: fill;
}

/* lineAlpha：974×974 大花纹，backFrame 段淡入 */
.reveal-line {
  width: 974px;
  height: 974px;
  opacity: 0.9;
  pointer-events: none;
  animation: reveal-fade-in 0.3s ease-out both;
}

/* 属性染色光晕（elementColors 染色，随 backFrame 渐入） */
.reveal-glow {
  width: 1100px;
  height: 1100px;
  border-radius: 50%;
  background: radial-gradient(circle, v-bind(elementColor) 0%, transparent 62%);
  opacity: 0.34;
  filter: blur(6px);
  pointer-events: none;
  animation: reveal-fade-in 0.6s ease-out both;
}

/* backFrameStar：spGachaColor01 740×740（tween[5] alpha 0→0.5，tween[4] 高光 1s 后退场） */
.reveal-colordiamond {
  display: block;
  width: 740px;
  height: 740px;
  pointer-events: none;
  animation: reveal-diamond-in 1.3s ease-out both;
}

@keyframes reveal-diamond-in {
  0% { opacity: 0; transform: scale(1.35); }
  30% { opacity: 1; transform: scale(1); }
  62% { opacity: 1; }
  100% { opacity: 0.5; transform: scale(1); }
}

/* 菱形双框：spGachaBox02 1024（外）/ spGachaBox01 975（内），scale 弹入 */
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
}

.reveal-box--inner {
  width: 975px;
  height: 975px;
  margin: -487px 0 0 -487px;
  animation-duration: 0.3s;
  animation-delay: 0.1s;
}

@keyframes reveal-box-pop {
  from { opacity: 0; transform: scale(1.6); }
  to { opacity: 1; transform: scale(1); }
}

/* ring：符文文字环 866×864，alpha 0.75，step2 起 8 秒一圈（TweenRotation 0→-360），
   白色符文按属性染色（mask + 背景色，同 elementTex 染色语义） */
/* ring：符文文字环 866×864，α 0.75；进场 ringScale 1.54→1 dur0.6（backFrameTweenPlay 段 10），
   之后 8 秒一圈（段 11 / 独立 TweenRotation 双份真值）。 */
.reveal-ring {
  width: 866px;
  height: 864px;
  background-color: v-bind(elementColor);
  mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaTxtRing01.png');
  mask-size: 100% 100%;
  -webkit-mask-image: url('/images/HeroGachaShowPanel_Atlas/spGachaTxtRing01.png');
  -webkit-mask-size: 100% 100%;
  filter: drop-shadow(0 0 10px v-bind(elementColor));
  opacity: 0.75;
  pointer-events: none;
  animation: reveal-ring-in 0.6s ease-out both, gacha-ring-spin 8s linear infinite;
}

@keyframes reveal-ring-in {
  from { transform: scale(1.54); }
  to { transform: scale(1); }
}

/* 四角闪块：spGachaStar02 410×410（自带四角闪块） */
.reveal-sparkles {
  display: block;
  width: 410px;
  height: 410px;
  pointer-events: none;
  animation: reveal-fade-in 0.3s ease-out both, gacha-breathe-strong 2.6s ease-in-out 0.5s infinite;
}

/* 风纹 elementAlpha：`spGachaWind01` 80×80 @(0,±460)/(±460,0)，初始 α=1；
   step3 内收到 ±360 并淡出（`spineStageTweenPlay` 段 8~15） */
.reveal-wind {
  width: 80px;
  height: 80px;
  opacity: 1;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  pointer-events: none;
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}

.reveal-wind--in {
  opacity: 0;
}
.reveal-wind--in .reveal-wind {
  transform: scale(0.78);
}

/* classStars 底图：576×576、scale 1.4（prefab `class`，即游戏里背景上的巨大职业纹章），
   2.5s 脉冲 + 色变后留一层很淡的余影（step3 仍可见，对应游戏画面） */
.reveal-class {
  width: 806px;
  height: 806px;
  pointer-events: none;
}

.reveal-class__img {
  display: block;
  width: 806px;
  height: 806px;
  animation: reveal-class-play 2.75s ease-out both;
}

@keyframes reveal-class-play {
  0% { transform: scale(1.4); filter: brightness(0.35) saturate(1.4); opacity: 0; }
  8% { opacity: 1; }
  12% { filter: brightness(0.55) saturate(1.3); }
  28% { filter: brightness(1.05) saturate(1); }
  78% { opacity: 1; }
  100% { transform: scale(1); filter: brightness(1.1); opacity: 0.34; }
}

/* step3 的右侧托板：`spGachaBlock01` 492×492（prefab `midFrame`），垫在 Q 版小人下面 */
.reveal-panel {
  width: 492px;
  height: 492px;
  pointer-events: none;
}

.reveal-panel__img {
  display: block;
  width: 492px;
  height: 492px;
  animation: reveal-fade-in 0.5s ease-out both;
}

@keyframes reveal-fade-in {
  from { opacity: 0; }
}

.reveal-midframe {
  display: block;
  width: 492px;
  height: 492px;
  pointer-events: none;
}

.reveal-stage {
  display: block;
  width: 380px;
  height: 380px;
  animation: reveal-fade-in 0.4s ease-out both;
}

/* Q 版小人画布：heroAnimRoot @(0,-114)（mDepth 75），源码 **localScale = 0.95**。
   画布尺寸对齐台座 `spGachaDitai01` 的 380×380（游戏里小人正好站在台座上），
   由 `createSpineScene({fit:'bounds'})` 按运行时包围盒取景。 */
.reveal-chibi {
  display: block;
  width: 380px;
  height: 380px;
  transform: scale(0.95);
  pointer-events: none;
}

.reveal-chibi-wrap {
  pointer-events: none;
}

/* 骨架异常角色的卡面替代（游戏 `gacha_at*.png` 200×200 卡面） */
.reveal-chibi--fallback {
  width: 380px;
  height: 380px;
  object-fit: contain;
  animation: reveal-fade-in 0.4s ease-out both;
}

.reveal-tag-img {
  display: block;
  width: 128px;
  height: 128px;
}

/* elementTextBase：`spGachaTag{Element}02` 320×320 原尺寸（软边横带含在方形贴图内） */
.reveal-tag-img--base { width: 320px; height: 320px; }

/* elementText：64×64 */
.reveal-tag-img--sm { width: 64px; height: 64px; }

/* 同点双层（职业框 + 职业图标）：第二张绝对定位叠加 */
.reveal-tag-img--stack {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.reveal-portrait {
  /* prefab `heroPic/PIC`：712×936（MakePixelPerfect 按贴图原始像素）。立绘属于角色层最底
     （mDepth 40），名牌/台座/Q 版小人都压在它之上。**高度按设计画布收敛**：936 会切掉头顶，
     这里用 700 并整体上移一点，使脚部落在台座（y≈-116）附近。 */
  width: 712px;
  height: 700px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: reveal-fade-in 0.5s ease-out both;
}

.reveal-portrait img {
  max-width: 712px;
  max-height: 700px;
  object-fit: contain;
  filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.6));
  /* `spineStageTweenPlay` 段 27：立绘 (128,0) → (-128,0) dur4.0（缓慢横移，曲线 0.125→0.85） */
  animation: reveal-portrait-drift 4s ease-out both;
}

@keyframes reveal-portrait-drift {
  from { transform: translateX(128px); }
  to { transform: translateX(-128px); }
}

/* classStars：大星在角色身后中央逐颗弹出（scale 1.5→1，音效节奏同 InitStar） */
.reveal-bigstars {
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
}

.reveal-bigstar {
  width: 130px;
  height: 130px;
  margin-left: -46px;
  animation: reveal-star-pop 0.5s ease-out both;
}

.reveal-bigstar:first-child { margin-left: 0; }

@keyframes reveal-star-pop {
  from { opacity: 0; transform: scale(1.5); }
  70% { opacity: 1; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}

.reveal-stars {
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  transition: opacity 0.2s ease-out;
}

.reveal-star {
  width: 48px;
  height: 48px;
  margin-left: -8px;
  /* 星级灯 starDX1..5：终位 x = -80/-40/0/40/80，入场自 -80 滑到位（heroNameTweenPlay 段 14~17） */
  animation: reveal-star-slide 0.3s ease-out both, reveal-star-pop 0.42s ease-out both;
}

@keyframes reveal-star-slide {
  from { transform: translateX(var(--star-from, 0)); }
  to { transform: translateX(0); }
}

.reveal-star:first-child { margin-left: 0; }

/* 名牌：pivot=BottomRight，512×512 向左上展开 */
.reveal-namebase {
  position: absolute;
  width: 512px;
  height: 512px;
}

.reveal-namebase img { width: 512px; height: 512px; display: block; }

.reveal-nameblock {
  display: block;
  width: 56px;
  height: 56px;
}

/* 粒子近似：背景浮尘（缓慢上浮 + 闪烁），纹章辉光由 `.reveal-class__img` 的 filter 承担，
   5 星流星沿左上→右下划过（`star5FX` 的 meteorFire1/2 近似） */
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

/* 5 星流星：CSS 光痕（细长渐变条沿左上→右下划过），不用粒子贴图静态图 */
.reveal-meteor {
  width: 260px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(255, 232, 170, 0) 0%, rgba(255, 232, 170, 0.9) 55%, rgba(255, 246, 220, 0) 100%);
  filter: drop-shadow(0 0 6px rgba(255, 226, 150, 0.7));
  transform: rotate(-24deg);
  pointer-events: none;
  opacity: 0;
  animation: reveal-meteor-fly 2.2s linear var(--meteor-delay, 0s) infinite;
}

@keyframes reveal-meteor-fly {
  0% { transform: rotate(-24deg) translate(-240px, 110px); opacity: 0; }
  18% { opacity: 0.9; }
  70% { opacity: 0.55; }
  100% { transform: rotate(-24deg) translate(300px, -140px); opacity: 0; }
}

.reveal-name {
  width: 400px;
  font-size: 48px;
  font-weight: 700;
  text-align: right;
  /* prefab `name`：pivot=Right @(-120,34) in nameRoot(248,-104) → 右端 (128,-70)，
     入场自 (0,36) 左滑 dur0.5（heroNameTweenPlay 段 09） */
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
/* newIconShine：同图叠加的加色高光，做呼吸 */
.reveal-new--shine {
  mix-blend-mode: screen;
  animation: gacha-glow-pulse 1.8s ease-in-out infinite;
}

/* 四向角饰（(0,±460)/(±460,0) 128×128）与四方块（(±194,±194) 24×24）：
   scale 2→1 弹入后 1↔0.275 呼吸 */
.reveal-angle {
  display: block;
  width: 128px;
  height: 128px;
  pointer-events: none;
  animation: reveal-ornament-pop 0.3s ease-out both, gacha-breathe-strong 2.6s ease-in-out 0.4s infinite;
}

.reveal-block {
  display: block;
  width: 24px;
  height: 24px;
  pointer-events: none;
  animation: reveal-ornament-pop 0.3s ease-out 0.2s both, gacha-breathe-strong 2.6s ease-in-out 0.6s infinite;
}

@keyframes reveal-ornament-pop {
  from { opacity: 0; transform: scale(2); }
  to { opacity: 1; transform: scale(1); }
}

.reveal-skip {
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

.reveal-skip img { width: 109px; height: 51px; }

/* 换人滑动转场（源码 #43848：台座/小人 0.5s 滑出右侧；g-abs 元素居中靠 transform，
   动画关键帧必须带 -50% 基准） */
.reveal-out {
  animation: reveal-slide-out 0.5s ease-in both;
}

@keyframes reveal-slide-out {
  from { transform: translate(-50%, -50%); opacity: 1; }
  to { transform: translate(calc(-50% + 360px), -50%); opacity: 0; }
}

/* Rconer(0.25) / Rconer2(0.05)：全屏角框，盖在角色层之上但低于交互层 */
.reveal-corner {
  width: 1700px;
  height: 1220px;
  pointer-events: none;
}

.reveal-corner img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.reveal-corner__one { opacity: 0.25; }
.reveal-corner__two { opacity: 0.05; }

.reveal-text {
  width: 960px;
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
}

/* gachaTextBg：`gacha_text` UISprite 256×88 → **宽 256→960 展开** dur0.8（gachaTextTweenPlay 段 01） */
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

/* 点击推进层：位于所有演出元素之上、跳过按钮之下 */
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
