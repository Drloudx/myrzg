<template>
  <!-- 游戏中 heroPoolTip 是 HeroPoolPanel 的子面板：打开时卡池页仍在背后可见，
       故舞台底色透明（clear），由根节点遮罩（0.5 黑）统一压暗。
       遮罩必须挂在弹层根（inset 0 盖满整个窗口）——挂在画布内只会盖住 1534×750，
       窗口比画布宽时两侧留黑区（用户指认的「阴影两边」）。 -->
  <div class="tip-root">
    <button class="tip-root__mask g-focusable" type="button" aria-label="关闭" @click="emit('close')"></button>
    <GachaStage clear>
    <!-- heroPoolTip：概率详情 / 记录查询共用弹层（prefab `heroPoolTip`，UIPanel depth 620） -->
    <div class="g-abs g-layer-overlay tip-panel" :style="gachaPos(0, 0)">
      <!-- Bg：800×750 底板 + white 平铺遮罩（1534×750，alpha 0.5）。
           点面板空白底板**不**关闭（用户指认：只有面板外的遮罩区域才关闭），关闭走遮罩或 ✕ -->
      <div class="tip-panel__bg"></div>

      <!-- title (0,338)：22px 标题 + 通栏平底灰带（800×36、直角，游戏采样 #a09783；
           此前用 com_txt_botm5 776×36 圆角贴图，两侧留空隙且带圆角，用户指认） -->
      <div class="g-abs tip-panel__title-bg" :style="gachaPos(0, 338)"></div>
      <div class="g-abs g-text g-text--lg g-text--center tip-panel__title" :style="gachaPos(0, 338)">
        {{ title }}
      </div>

      <!-- ── 概率详情：raceObj ── -->
      <template v-if="mode === 'rate'">
        <!-- 指定伙伴：ChanceUp (-306,261)，grid cell 100×100 -->
        <template v-if="upCandidates.length">
          <div class="g-abs g-slice g-slice--txt-botm4 tip-rate__up-bg" :style="gachaPos(0, 221)"></div>
          <button
            v-for="(candidate, index) in upCandidates"
            :key="candidate.typeId"
            class="g-abs g-hit g-focusable tip-up-slot"
            :style="gachaPos(-306 + index * 100, 261)"
            type="button"
            :title="`${candidate.name}（查看详情）`"
            @click="emit('open-candidate', candidate)"
          >
            <img :src="getImageUrl(`/images/HeroPoolPanel_Atlas/at_f_${candidate.quality}.webp`)" alt="" class="tip-up-slot__frame" />
            <img :src="getImageUrl(upAvatar(candidate))" :alt="candidate.name" class="tip-up-slot__icon" />
            <!-- 概率提升角标：prefab `heroPoolTip` 下 `chanceUp` = com_up 24×56 @(37.9,0) -->
            <img :src="getImageUrl('/images/Common_Atlas/com_up.webp')" alt="" class="tip-up-slot__badge" />
          </button>
        </template>
        <!-- ScrollView：
             源码 `HeroPoolTips.cs`：
             - 当有 UP 伙伴时，chanceUpObj 激活，raceDescScrollView.panel.topAnchor.absolute = -195
               文字区域顶端锚定在设计坐标 (-349, 180)，文字显示在分割线（y=221）下方，高 524px；
             - 当无 UP 伙伴时，chanceUpObj 隐藏，raceDescScrollView.panel.topAnchor.absolute = -79
               文字区域顶端吸顶在设计坐标 (-349, 296)，高 640px。
             游戏内无可见的原生滚动条 → 隐藏之；有更多内容时用项目通用的方向提示箭头。 -->
        <div class="tip-scroll-wrap" :class="{ 'tip-scroll-wrap--up': upCandidates.length > 0 }">
          <div ref="scrollEl" class="tip-scroll" @scroll.passive="updateCues">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="g-text tip-rate__body" v-html="rateHtml"></div>
          </div>
          <span v-if="canScrollUp" class="tip-scroll__cue tip-scroll__cue--up" aria-hidden="true"></span>
          <span v-if="canScrollDown" class="tip-scroll__cue tip-scroll__cue--down" aria-hidden="true"></span>
        </div>
      </template>

      <!-- ── 记录查询：recordObj ── -->
      <template v-else>
        <div class="g-abs g-slice g-slice--txt-botm4 tip-record__head-bg" :style="gachaPos(0, 301)"></div>
        <div
          v-for="column in recordColumns"
          :key="column.label"
          class="g-abs g-text g-text--md tip-record__head"
          :style="{ left: `calc(50% + ${column.x}px)`, top: 'calc(50% - 301px)' }"
        >
          {{ column.label }}
        </div>

        <!-- 记录列表：prefab 的 `Grid`(0,223) 是**网格原点**而非容器中心。
             列表必须落在表头 (y=301) 与分页按钮 (y=-327) 之间，否则第一行会排到面板上方看不见。 -->
        <div class="g-abs tip-record__list" :style="{ left: 'calc(50% - 400px)', top: 'calc(50% - 283px)' }">
          <div v-if="!pageRecords.length" class="g-text g-text--sm g-text--dim tip-record__empty">
            还没有模拟记录，抽一次就会出现。
          </div>
          <div
            v-for="row in pageRecords"
            :key="row.id"
            class="tip-record__row"
            :class="row.quality >= 4 ? `tip-record__row--q${row.quality}` : ''"
          >
            <span class="g-text g-text--md tip-record__cell" :style="{ left: `${recordCellLeft.star}px` }">{{ row.rank }}星</span>
            <span class="g-text g-text--md tip-record__cell" :style="{ left: `${recordCellLeft.name}px` }">{{ row.name }}</span>
            <span class="g-text g-text--md tip-record__cell" :style="{ left: `${recordCellLeft.pool}px` }">{{ row.poolName }}</span>
            <span class="g-text g-text--md tip-record__cell" :style="{ left: `${recordCellLeft.time}px` }">{{ formatTime(row.at) }}</span>
          </div>
        </div>

        <button
          class="g-abs g-hit g-focusable tip-record__page-btn"
          :class="{ 'g-hit--disabled': page <= 1 }"
          :style="gachaPos(-264, -327)"
          type="button"
          :disabled="page <= 1"
          @click="goPage(-1)"
        >
          <i class="tip-record__btn-bg g-slice g-slice--chara-change" aria-hidden="true"></i>
          <span class="g-text">上一页</span>
        </button>
        <button
          class="g-abs g-hit g-focusable tip-record__page-btn"
          :class="{ 'g-hit--disabled': page >= pageMax }"
          :style="gachaPos(264, -327)"
          type="button"
          :disabled="page >= pageMax"
          @click="goPage(1)"
        >
          <i class="tip-record__btn-bg g-slice g-slice--chara-change tip-record__btn-bg--flip" aria-hidden="true"></i>
          <span class="g-text">下一页</span>
        </button>

        <!-- 页码：源码 `"1".WithColor(15) + $"/{pageMax}".WithColor(10)`——当前页暗金、/总页深棕 -->
        <div class="g-abs g-text g-text--center tip-record__page" :style="gachaPos(0, -326)">
          <span class="tip-record__page-cur">{{ page }}</span><span class="tip-record__page-total"> / {{ pageMax }}</span>
        </div>
      </template>

      <!-- Back (587,335)：com_btn_back 100×68 -->
      <button
        class="g-abs g-hit g-focusable tip-panel__close"
        :style="gachaPos(587, 335)"
        type="button"
        title="关闭"
        @click="emit('close')"
      >
        <img :src="getImageUrl('/images/Common_Atlas/com_btn_back.webp')" alt="关闭" />
      </button>
    </div>
    </GachaStage>
  </div>
</template>

<script setup>
/**
 * 卡池提示弹层：概率详情（`HeroPoolTips.OpenHeroPoolRace`）与记录查询
 * （`HeroPoolTips.OpenHeroPoolRecord`）共用同一面板，对应 prefab `heroPoolTip`。
 *
 * 概率文案直接使用原表 `heroPool.percTip` / `petPool.percTip`，按游戏
 * `HeroPoolTips.GetFormatRaceStr` 的规则把 `{rareNList}` 替换为名单，其余 `{值}`
 * 交给公共 `gameMappings.formatHighlightedText` 高亮（DRY：不在此处另写高亮规则）。
 *
 * 记录查询在游戏里走服务端分页（`PlayerMsg.RequestQueryPageData`）；静态图鉴没有账号
 * 数据，这里展示的是**本地模拟抽取记录**，页面已标明「模拟」。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { formatHighlightedText } from '../../utils/gameMappings'

const props = defineProps({
  /** 'rate' 概率详情 | 'record' 记录查询 */
  mode: { type: String, default: 'rate' },
  /** 当前卡池（概率详情用）。 */
  pool: { type: Object, default: null },
  /** 模拟记录（记录查询用），按时间倒序。 */
  records: { type: Array, default: () => [] },
  /** 伙伴池 'hero' | 魔物池 'pet' */
  kind: { type: String, default: 'hero' }
})

/**
 * 指定伙伴头像：游戏的 `HeroPoolUI` 与 `HeroPoolTips` 用的是 `heroDataById.Icon`
 * （`at*_0` 圆形面部头像，资源在 `public/images/HeadIconAtals/`），
 * 与卡池外侧面板完全一致；魔物蛋池则保持蛋自身图标。
 */
function upAvatar(candidate) {
  const typeId = String(candidate?.typeId ?? '')
  if (props.kind === 'hero' || (!props.kind && typeId.includes('hero'))) {
    const plain = /^hero_0*(\d+)$/.exec(typeId)
    if (plain) return `/images/HeadIconAtals/at${String(plain[1]).padStart(3, '0')}_0.png`
    const variant = /^new_hero_0*(\d+)$/.exec(typeId)
    if (variant) return `/images/HeadIconAtals/at${String(variant[1]).padStart(3, '0')}_1.png`
  }
  return candidate?.icon ?? ''
}

const emit = defineEmits(['close', 'open-candidate'])

/** 记录每页行数：游戏按 `recordScrollView.panel.GetViewSize().y / 36` 计算，可视高 578 → 16 行。 */
const PAGE_SIZE = 16
const page = ref(1)

/** 记录表列位置取自 prefab `recordObj/title` 的 UILabel 坐标（mPivot=3 → Left，从该 x 向右排）。 */
const recordColumns = [
  { label: '星级', x: -310 },
  { label: '名称', x: -220 },
  { label: '卡池', x: -40 },
  { label: '时间', x: 97 }
]

/**
 * 记录行内单元格的左侧偏移：行宽 776、居中，故行左边缘在设计坐标 -388；
 * prefab `poolTemp` 的标签坐标（-308/-220/-40/97）减去 388 即行内偏移。
 */
const recordCellLeft = { star: 92, name: 180, pool: 360, time: 497 }

const title = computed(() => (props.mode === 'rate'
  ? `${props.pool?.name ?? ''} · 概率详情`
  : '记录查询'))

const upCandidates = computed(() =>
  (props.pool?.tiers ?? []).flatMap(tier => tier.candidates ?? []).filter(item => item.isUp)
)

/** 名单占位符替换 + 数值高亮；`{rare1List}`~`{rare5List}` 取对应星级的正式候选名。 */
const rateHtml = computed(() => {
  const raw = props.pool?.percTip
  if (!raw) return '<p>该卡池没有配置概率说明。</p>'
  let text = raw
  for (const tier of props.pool.tiers ?? []) {
    const names = (tier.candidates ?? []).map(item => item.name).join('、')
    text = text.replaceAll(`{${tier.key}List}`, names)
  }
  return formatHighlightedText(text)
})

const pageMax = computed(() => Math.max(Math.ceil(props.records.length / PAGE_SIZE), 1))
const pageRecords = computed(() =>
  props.records.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)

watch(() => props.mode, () => { page.value = 1 })

/** 滚动方向提示：原生滚动条隐藏（游戏无可视滚动条），用项目通用的箭头提示还有内容。 */
const scrollEl = ref(null)
const canScrollUp = ref(false)
const canScrollDown = ref(false)
function updateCues() {
  const el = scrollEl.value
  if (!el) {
    canScrollUp.value = false
    canScrollDown.value = false
    return
  }
  canScrollUp.value = el.scrollTop > 4
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 4
}
watch([rateHtml, () => props.mode], () => nextTick(updateCues))
onMounted(() => {
  updateCues()
  window.addEventListener('resize', updateCues, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', updateCues))

function goPage(step) {
  const next = page.value + step
  if (next < 1 || next > pageMax.value) return
  page.value = next
}

/** 记录时间：游戏用 `TimestampConverter.ToLongDate`，此处给出等价可读格式。 */
function formatTime(timestamp) {
  const date = new Date(Number(timestamp))
  if (Number.isNaN(date.getTime())) return ''
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>

<style scoped>
.tip-panel {
  width: 1534px;
  height: 750px;
}

.tip-panel__bg {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 800px;
  height: 750px;
  transform: translate(-50%, -50%);
  /* 拦截面板范围内的点击（面板空白不关闭），但不带关闭行为，故不显示手型 */
  /* 游戏截图采样：面板为**平的米黄纸底** (205,197,178)，四角/边缘略有做旧暗角，
     无边框无纹理。此前误做成近黑深底（用户指认）。 */
  background: #cdc5b2;
  box-shadow:
    inset 0 0 46px rgba(83, 62, 38, 0.28),
    inset 0 0 6px rgba(83, 62, 38, 0.22);
}

.tip-root {
  position: absolute;
  inset: 0;
}

.tip-root__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border: 0;
  padding: 0;
  cursor: pointer;
}

/* 舞台本体、画布壳与面板根都对点击透传——面板根是 1534×750 的整块盒子，
   不透传会把面板左右两侧（遮罩区域）的点击也拦住；只有面板内的内容恢复可点：
   800×750 底板拦截面板范围内的点击（点面板空白不关闭），交互元素正常可操作 */
.tip-root .gacha-stage,
.tip-root .gacha-stage :deep(.gacha-canvas),
.tip-root .gacha-stage :deep(.tip-panel) {
  pointer-events: none;
}
.tip-root .gacha-stage :deep(.tip-panel *) {
  pointer-events: auto;
}
/* 竖屏提示条本身不拦截点击（通配恢复会盖掉它自带的 none；
   提示条是 GachaStage 内部元素，需 :deep 穿透） */
.tip-root :deep(.gacha-rotate-hint),
.tip-root :deep(.gacha-rotate-hint *) {
  pointer-events: none !important;
}

.tip-panel__bg { z-index: 1; }


.tip-panel__title-bg {
  z-index: 2;
  width: 800px;
  height: 36px;
  background: #a09783;
}

.tip-panel__title {
  z-index: 3;
  width: 500px;
  /* 游戏标题为深棕字（非米白） */
  color: var(--gacha-brown);
}

.tip-rate__up-bg {
  z-index: 2;
  width: 800px;
  height: 36px;
}

.tip-up-slot {
  border: 0;
  z-index: 4;
  width: 100px;
  height: 100px;
  background: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 层级按 prefab 的 mDepth：`icon` 是 6、外框 `at_f_*` 是 7、角标 `com_up` 是 8
   → 外框必须压在头像之上，头像微下移 8px 适配圆形开窗 */
.tip-up-slot__frame {
  position: absolute;
  inset: 0;
  width: 100px;
  height: 100px;
  z-index: 2;
}

.tip-up-slot__icon {
  position: relative;
  top: 8px;
  z-index: 1;
  width: 76px;
  height: 76px;
  object-fit: contain;
}

/* com_up 24×56 @(37.9, 0)：贴在头像右侧的「概率」彩色角标 */
.tip-up-slot__badge {
  position: absolute;
  z-index: 3;
  left: calc(50% + 37.9px);
  top: 50%;
  width: 24px;
  height: 56px;
  transform: translate(-50%, -50%);
}

/* 正文滚动区：prefab `raceObj/ScrollView`(-349,72.93)
   - 无 UP 伙伴：topAnchor=-79 → 设计坐标 (-349, 296)，top: calc(50% - 296px)，高 640px
   - 有 UP 伙伴：topAnchor=-195 → 设计坐标 (-349, 180)，top: calc(50% - 180px)，高 524px
   文字完全显示在分割线（y=221）下方，绝无任何遮挡 */
.tip-scroll-wrap {
  position: absolute;
  z-index: 3;
  left: calc(50% - 349px);
  top: calc(50% - 296px);
  width: 698px;
  height: 640px;
}

.tip-scroll-wrap--up {
  top: calc(50% - 180px);
  height: 524px;
}

.tip-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding-right: 10px;
  /* 游戏内无可见的原生滚动条 → 隐藏，改用下方方向提示箭头 */
  scrollbar-width: none;
}
.tip-scroll::-webkit-scrollbar { display: none; }

/* 方向提示箭头：复用项目通用箭头形制（NavigationMenu `.side-scroll-cue` 的折角箭头）。
   按用户要求**不带渐隐阴影**——只保留裸箭头。 */
.tip-scroll__cue {
  position: absolute;
  left: 0;
  right: 0;
  height: 26px;
  z-index: 3;
  pointer-events: none;
}
.tip-scroll__cue::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid rgba(83, 62, 38, 0.75);
  border-bottom: 2px solid rgba(83, 62, 38, 0.75);
}
.tip-scroll__cue--down {
  bottom: 0;
}
.tip-scroll__cue--down::after {
  bottom: 2px;
  transform: translateX(-50%) rotate(45deg);
}
.tip-scroll__cue--up {
  top: 0;
}
.tip-scroll__cue--up::after {
  top: 2px;
  transform: translateX(-50%) rotate(-135deg);
}

.tip-rate__body {
  white-space: pre-wrap;
  font-size: 19px;
  line-height: 1.75;
  word-break: break-word;
  /* 源码 `HeroPoolTips.OpenHeroPoolRace` 调 `ReplaceDescValue(percTip, 10, 15)`：
     正文整体 = Const.ColorString[10]（#533e26 深棕），{值}/<值> = ColorString[15]
     （#a36f0a 金棕）。此前误用米白正文 + 主题金高亮（用户指认），此处按游戏改。 */
  color: #533e26;
}

.tip-rate__body :deep(.value-highlight) {
  color: #a36f0a;
}

.tip-record__head-bg {
  z-index: 2;
  width: 800px;
  height: 36px;
}

.tip-record__head {
  z-index: 3;
  width: 200px;
  text-align: left;
  transform: translateY(-50%);
  /* 游戏表头为暗金（源码 ReplaceDescValue 值色 ColorString[15]），非米金 */
  color: var(--gacha-brown-gold);
}

.tip-record__list {
  z-index: 3;
  width: 800px;
  height: 578px;
  /* 顶锚定：首行紧贴表头下缘（inline 已给 left/top，去掉 .g-abs 的居中位移） */
  transform: none;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.tip-record__list::-webkit-scrollbar { display: none; }

.tip-record__row {
  position: relative;
  box-sizing: border-box;
  height: 36px;
  /* 通栏 800（与面板同宽、贴边无空隙），直角色块——此前用 item_info_color 贴图
     0 8 0 8 切片，两端留 12px 空隙且带圆角，与游戏不符（用户指认） */
  width: 800px;
  /* 行间分隔线：游戏里每行之间有一条细线（实测约 1px，粗了发闷） */
  border-bottom: 1px solid rgba(83, 62, 38, 0.32);
}

/* 源码 `RefreshRecordUI`：底色条仅 rare>=4 启用（4星粉 / 5星金），
   3星行为纯透明的米黄纸底，无衬底。色值为贴图中心色在纸底上的合成结果（游戏采样） */
.tip-record__row--q4 {
  background: #cf9bc6;
}

.tip-record__row--q5 {
  background: #cfb35c;
}

.tip-record__cell {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  white-space: nowrap;
  /* 游戏记录行文字为深棕（源码 ReplaceDescValue 同款基色），非米白 */
  color: #533e26;
}

.tip-record__page-cur {
  color: var(--gacha-brown-gold);
}

.tip-record__page-total {
  color: var(--gacha-brown);
}

.tip-record__empty {
  padding: 18px 12px;
  color: #533e26;
}

.tip-record__page-btn {
  border: 0;
  z-index: 4;
  width: 129px;
  height: 36px;
  background: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 按钮底图独立成层：下一页水平翻转，让箭头 ► 朝右（游戏如此） */
.tip-record__btn-bg {
  position: absolute;
  inset: 0;
}

/* 文字置于底图层之上（底图是定位元素，非定位内容会被盖住） */
.tip-record__page-btn .g-text {
  position: relative;
  z-index: 1;
  /* prefab UILabel：上一页/下一页 = #cfba96（ColorString[2]） */
  color: #cfba96;
}
.tip-record__btn-bg--flip {
  transform: scaleX(-1);
}


.tip-record__page {
  z-index: 3;
  width: 120px;
  font-size: 24px;
}

.tip-panel__close {
  z-index: 5;
  width: 100px;
  height: 68px;
  background: none;
  border: 0;
  padding: 0;
}

.tip-panel__close img { width: 100px; height: 68px; }
</style>
