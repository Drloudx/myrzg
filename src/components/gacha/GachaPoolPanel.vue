<template>
  <!-- 窄窗口完整缩放固定坐标控件，宽窗口只延展布景，立绘与按钮保持原比例。 -->
  <GachaStage :backdrop="getImageUrl('/images/gacha/gacha_cardbackground_main_output.webp')" fit="height">
    <!-- ── 背景层：prefab `gacha_pool_BG`（深度 0~3），贴图由 TextureLoad 在 Awake 加载，
         对应关系取自 prefab：BG_main→`gacha_cardbackground_main_output_blur.webp`(2048×1024，与
         该 UITexture 尺寸完全一致)、BG_main_blured→`..._blured.webp`(1024×512，scale 2)、
         BG_HL→`..._HL_output.webp`(1680×1000)、desk→`elsa_desk_foreground.webp`(1680×1000，scale 1.25)
         ── -->
    <div class="g-abs g-layer-bg pool-scenery" :style="gachaPos(0, 0)">
      <img
        :src="getImageUrl('/images/gacha/gacha_cardbackground_main_output_blur.webp')"
        alt=""
        class="pool-bgmain"
      />
    </div>
    <div class="g-abs g-layer-bg pool-scenery" :style="gachaPos(0, 0)">
      <img
        :src="getImageUrl('/images/gacha/gacha_cardbackground_main_output_blured.webp')"
        alt=""
        class="pool-bgblur"
      />
    </div>
    <!-- BG_HL：depth 1，TweenAlpha 0.5↔0.65 呼吸（style=2 ping-pong） -->
    <div class="g-abs g-layer-bg pool-scenery" :style="gachaPos(0, 0)">
      <img
        :src="getImageUrl('/images/gacha/gacha_cardbackground_HL_output.webp')"
        alt=""
        class="pool-hl"
      />
    </div>
    <!-- desk：前景桌面，depth 1，scale 1.25 @(0,-18) -->
    <div class="g-abs g-layer-bg pool-foreground" :style="gachaPos(0, -18)">
      <img :src="getImageUrl('/images/gacha/elsa_desk_foreground.webp')" alt="" />
    </div>
    <!-- TweenParent/mask：fb_page_black 480×750，pos (-767,0)，depth 2（左侧压暗） -->
    <div class="g-abs g-layer-bg" :style="gachaPos(-767, 0)">
      <img :src="getImageUrl('/images/InsBattlePanel_Atlas/fb_page_black.webp')" alt="" class="pool-side-mask" />
    </div>
    <!-- Draw/Heros：depth 3，切池时 TweenScale 1.2→1.0 + TweenAlpha 0→1。
         游戏用 `MakePixelPerfect` 按贴图原始像素显示（角色池 1680×1000、魔物蛋池 879×946），
         所以这里不给宽高，避免把竖幅的蛋池主视觉横向拉伸。 -->
    <div class="g-abs g-layer-bg" :style="gachaPos(0, 0)">
      <img
        :key="pool.id"
        :src="getImageUrl(pool.assets.cover)"
        alt=""
        class="pool-cover"
      />
    </div>

    <!-- ── 标题：Title (-500,315)，titleHero / titlePetEgg 为 512×152 原画
         （prefab 里两张按角色/魔物蛋切换，此处直接按 kind 取对应图）。
         prefab 另有 `Title/bg`(com_info_botm 217×24) 与 `Title/Label`（「招募来自各地的伙伴」），
         但源码从不给它们赋值、游戏画面里也不出现，故不渲染。 ── -->
    <div class="g-abs g-layer-ui" :style="gachaPos(-500, 315)">
      <img
        :src="getImageUrl(`/images/HeroPoolPanel_Atlas/${kind === 'hero' ? 'gacha_title_chara' : 'gacha_title_egg'}.webp`)"
        :alt="kind === 'hero' ? '伙伴招募' : '魔物蛋贩售'"
        class="pool-title-art"
      />
    </div>

    <!-- ── 保底提示：RareTip (-609,-283)，icon_info 28×28 + Label（prefab fontSize=20）。
         **左对齐**：图标左边缘与下方「概率详情」按钮左边缘同在 design −631（用户要求这几项左对齐）。 ── -->
    <div v-if="safeHint" class="g-abs g-layer-ui safe-hint" :style="{ left: 'calc(50% - 631px)', top: 'calc(50% + 283px)' }">
      <img :src="getImageUrl('/images/Common_Atlas/icon_info.webp')" alt="" class="safe-hint__icon" />
      <span class="g-text g-text--md safe-hint__text">{{ safeHint }}</span>
    </div>

    <!-- ── 概率详情 / 记录查询：Rate (-555,-330)、record (-399,-330)，com_btn_mini 152×40 sliced；
         Label 字号 18（prefab）── -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable g-slice g-slice--btn-mini mini-btn"
      :style="gachaPos(-555, -330)"
      type="button"
      @click="emit('rate')"
    >
      <span class="g-text">概率详情</span>
    </button>
    <button
      class="g-abs g-layer-interactive g-hit g-focusable g-slice g-slice--btn-mini mini-btn"
      :style="gachaPos(-399, -330)"
      type="button"
      @click="emit('record')"
    >
      <span class="g-text">记录查询</span>
    </button>

    <!-- ── 货币条：TopRight (378,335)，SmalInfoTip ×4，槽位与顺序按 prefab ──
         每个 SmalInfoTip = bg(com_top_item 154/136×28, pivot=Left, 位于 -23) + icon(36×36 @0)
         + Label(90×24 @61) + add(M_rt_btn_add 40×40 @119)。显隐规则对应 HeroPoolUI.InitRight：
         **卡池名含「特别」**（不分角色/蛋池）与普通角色池显示 氪金/神晶/消耗券（coin 隐藏，
         item 在 tipPosX[0]=-304）；普通蛋池显示 银币/消耗券（ke/payKe 隐藏，item 移到
         tipPosX[3]=-116、银币在 PoolUiTitle 的 tipPosX[4]=+35）。数值为**模拟持有量**，不足时变红。 -->
    <!-- 货币条：整行右锚定（行末贴在 design x=462）。prefab 原本右缘 526（底牌右边缘），
         本页在货币条与关闭按钮（从 537 起）之间腾出音效开关的位置（中心 498），
         故整行左移 64px；槽内是统一的「图标 → 数字 → +」，数字变长时整行向左生长。 -->
    <div
      class="g-abs g-layer-ui currency-row"
      :style="{ right: 'calc(50% - 462px)', top: 'calc(50% - 335px)', transform: 'translateY(-50%)' }"
    >
      <div
        v-for="slot in currencySlots"
        :key="slot.key"
        class="currency-slot"
      >
        <div class="g-slice g-slice--top-item currency-slot__bg" aria-hidden="true"></div>
      <img :src="getImageUrl(slot.icon)" :alt="slot.name" class="currency-slot__icon" />
      <span
        class="g-text currency-slot__label"
        :class="{ 'g-text--danger': !slot.enough }"
        :title="`${slot.name}：模拟持有 ${slot.hold}${slot.need ? `，本次抽取需要 ${slot.need}` : ''}`"
      >
        {{ slot.hold }}
      </span>
      <button
        class="g-hit g-focusable currency-slot__add"
        type="button"
        :title="`补充模拟${slot.name}`"
        @click="emit('topup', slot.typeId)"
      >
        <img :src="getImageUrl('/images/MainPanel/M_rt_btn_add.webp')" alt="补充" />
      </button>
    </div>

    </div>

    <!-- ── 期次：periodType (461,227)，贴图为 gacha_name_chara/egg（312×76） ── -->
    <div class="g-abs g-layer-ui" :style="gachaPos(461, 227)">
      <img :src="getImageUrl(`/images/HeroPoolPanel_Atlas/${periodSprite}.webp`)" alt="" class="pool-period" />
    </div>
    <!-- longPeriod (-1,-54)：永久池显示「永·久·开·放」，底板 `gacha_name_stay` 228×32（prefab `longPeriod/bg`） -->
    <div v-if="isPermanent" class="g-abs g-layer-ui period-badge" :style="gachaPos(460, 173)">
      <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_name_stay.webp')" alt="" class="period-badge__bg" />
      <span class="g-text g-text--xs period-badge__text">永·久·开·放</span>
    </div>
    <!-- limitedPeriod (-47,-54)：限时池显示倒计时，底板 `gacha_name_limit` 228×32 -->
    <div v-else class="g-abs g-layer-ui period-badge" :style="gachaPos(414, 173)">
      <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_name_limit.webp')" alt="" class="period-badge__bg" />
      <span class="g-text g-text--xs period-badge__text">{{ remainingText }}</span>
      <span class="g-text g-text--xs period-badge__text">后结束</span>
    </div>
    <!-- exchangeBtn (461,111)：有礼包入口时显示兑换按钮 -->
    <button
      v-if="hasExchange"
      class="g-abs g-layer-interactive g-hit g-focusable exchange-btn"
      :style="gachaPos(461, 111)"
      type="button"
      :title="`打开礼包：${pool.packDisplay}`"
      @click="emit('exchange')"
    >
      <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_btn_exchange.webp')" alt="礼包兑换" />
    </button>

    <!-- ── 角色 / 魔物蛋 切换：heroTypeTog (-561,233)、petTypeTog (-393,233)，168×84 ── -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable kind-toggle"
      :style="gachaPos(-561, 233)"
      type="button"
      :aria-pressed="kind === 'hero'"
      @click="emit('update:kind', 'hero')"
    >
      <img :src="getImageUrl(`/images/HeroPoolPanel_Atlas/${kind === 'hero' ? 'gacha_page_chara_on' : 'gacha_page_chara'}.webp`)" alt="角色招募" />
    </button>
    <button
      v-if="petOpen"
      class="g-abs g-layer-interactive g-hit g-focusable kind-toggle"
      :style="gachaPos(-393, 233)"
      type="button"
      :aria-pressed="kind === 'pet'"
      @click="emit('update:kind', 'pet')"
    >
      <img :src="getImageUrl(`/images/HeroPoolPanel_Atlas/${kind === 'pet' ? 'gacha_page_egg_on' : 'gacha_page_egg'}.webp`)" alt="魔物蛋贩售" />
    </button>
    <div v-else class="g-abs g-layer-ui" :style="gachaPos(-393, 233)">
      <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_page_egg_disable.webp')" alt="魔物蛋（未开放）" />
    </div>

    <!-- ── 卡池页签：Toggles (-484,135)，UIGrid arrangement=1 即 Vertical、cellHeight=90，
         页签向下竖排。按用户要求把牌面**左边缘对齐到 design −631**（与「概率详情」「保底提示」同一条左基准），
         故中心由 −484 移到 −469（324 宽的一半）。 ── -->
    <button
      v-for="(item, index) in pools"
      :key="item.id"
      class="g-abs g-layer-interactive g-hit g-focusable pool-tab"
      :style="gachaPos(-469, 135 - index * 90)"
      type="button"
      :aria-pressed="item.id === pool.id"
      @click="emit('select-pool', item.id)"
    >
      <div
        class="pool-tab__bg g-slice"
        :class="tabSliceClass(item)"
        aria-hidden="true"
      ></div>
      <img
        :src="getImageUrl(`/images/HeroPoolPanel_Atlas/${item.assets.poolSprite}.webp`)"
        alt=""
        class="pool-tab__icon"
        :class="item.kind === 'hero' ? 'pool-tab__icon--hero' : 'pool-tab__icon--pet'"
      />
      <span class="g-text g-text--sm pool-tab__label">{{ item.name }}</span>
      <template v-if="tabTime(item)">
        <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_page_time.webp')" alt="" class="pool-tab__time-icon" />
        <span class="g-text g-text--xs g-text--gold pool-tab__time">{{ tabTime(item) }}</span>
      </template>
    </button>

    <!-- ── 指定伙伴：ChanceUp (573,-60)；文案与字号严格按 prefab：
         descBg `gacha_up_botm` 400×140 @(-99,-53)（绝对 474,-113）
         desc1 「指定伙伴/指定魔物蛋」 fontSize=28、pivot=Right、右端落在 489
         desc0 「概率提升！」 @(566,-124)、desc2 提示 @(617,-155) ── -->
    <template v-if="upCandidates.length">
      <div class="g-abs g-layer-art up-plate-wrap" :style="gachaPos(474, -113)">
        <img :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_up_botm.webp')" alt="" class="up-plate" />
      </div>
      <div class="g-abs g-layer-ui g-text up-label" :style="gachaPos(489, -124)">
        {{ kind === 'hero' ? '指定伙伴' : '指定魔物蛋' }}
      </div>
      <div class="g-abs g-layer-ui g-text up-label up-boost" :style="gachaPos(596, -124)">概率提升！</div>

      <button
        v-for="(candidate, index) in upCandidates"
        :key="candidate.typeId"
        class="g-abs g-layer-interactive g-hit g-focusable up-slot"
        :style="gachaPos(573 + index * 100, -60)"
        type="button"
        :title="`${candidate.name}（点击查看详情）`"
        @click="emit('open-candidate', candidate)"
      >
        <img :src="getImageUrl(`/images/HeroPoolPanel_Atlas/at_f_${candidate.quality}.webp`)" alt="" class="up-slot__frame" />
        <img :src="getImageUrl(upAvatar(candidate))" :alt="candidate.name" class="up-slot__icon" />
        <!-- 概率提升角标：prefab `chanceUp` = com_up 24×56 @(37.9,0) -->
        <img :src="getImageUrl('/images/Common_Atlas/com_up.webp')" alt="" class="up-slot__badge" />
      </button>
    </template>

    <!-- ── 抽取按钮：Buttons (400,-340)，One (-204,24)、Ten (87,24)。
         **两个按钮精灵不同**：单抽 `com_btn_N_sp`（红 均色 127,48,24）、十连 `com_btn_Y_sp`（青 30,92,103），
         均为 128×72 经 9 宫格拉伸到 292×72；按钮内只有「招募一次/十次」文案。 ── -->
    <button
      v-for="option in drawOptions"
      :key="option.count"
      class="g-abs g-layer-interactive g-hit g-focusable g-slice draw-btn"
      :class="[option.count === 1 ? 'g-slice--btn-n' : 'g-slice--btn-y', { 'g-hit--disabled': !option.enabled }]"
      :style="gachaPos(400 + option.offsetX, -316)"
      type="button"
      :disabled="!option.enabled"
      @click="emit('draw', option.count)"
    >
      <span class="g-text draw-btn__label" :class="{ 'draw-btn__label--ten': option.count === 10 }">{{ option.label }}</span>
    </button>

    <!-- ── 抽取消耗行：在按键**上方**（用户对照游戏截图指认：消耗行不在按键内）。
         底板 = `gacha_btn_tag`（HeroPoolPanel_Atlas 64×32，深棕核心、四周软渐变、无装饰；
         图集元数据 border 全 0，即整图拉伸）。此前误用 com_info_botm（两端带 « » 角标）、
         再误用 com_txt_botm2，均由用户指认后更换。位置按软边核算：可见底边距按钮顶边
         约 4px（几何底边与按钮顶边相切，y=-264 即按钮中心上方 52）。消耗行不参与点击
        （pointer-events:none），与按钮重叠部分的点击穿透到按键。 ── -->
    <div
      v-for="option in drawOptions"
      :key="`cost-${option.count}`"
      class="g-abs g-layer-ui draw-cost"
      :style="gachaPos(400 + option.offsetX, -264)"
    >
      <img class="draw-cost__plate" :src="getImageUrl('/images/HeroPoolPanel_Atlas/gacha_btn_tag.webp')" alt="" />
      <img class="draw-cost__icon" :src="getImageUrl(option.ticket.icon)" alt="" />
      <span class="g-text g-text--md" :class="{ 'g-text--danger': !option.ticket.enough }">{{ option.ticket.text }}</span>
      <template v-if="option.exchange">
        <span class="g-text g-text--md draw-cost__or">或</span>
        <img class="draw-cost__icon" :src="getImageUrl(option.exchange.icon)" alt="" />
        <span class="g-text g-text--md" :class="{ 'g-text--danger': !option.exchange.enough }">{{ option.exchange.text }}</span>
      </template>
    </div>

    <!-- ── 关闭：TopRight/Back (587,335)，prefab 用的是 com_btn_close（✕） ── -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable close-btn"
      :style="gachaPos(587, 335)"
      type="button"
      title="返回"
      @click="emit('close')"
    >
      <img :src="getImageUrl('/images/Common_Atlas/com_btn_close.webp')" alt="返回" />
    </button>

    <!-- ── 音效开关（本页新增，游戏内无对应控件）：放在货币条与关闭按钮之间腾出的空位
         （货币条行末 462、✕ 从 537 起，本钮中心 498，与 ✕ 同一水平线）。
         图标用游戏自己的语音按钮 `chara_btn_voice(/_press)`（HeroInfoPanel_Atlas 72×72）——
         已核对全游戏图集，这是唯一的音量图标（set 系是齿轮/开关/编辑，不是音量）；
         去掉「开/关」小字，关闭态用变暗灰化表达，按下态用 _press 精灵。 ── -->
    <button
      class="g-abs g-layer-interactive g-hit g-focusable sound-btn"
      :class="{ 'sound-btn--off': !soundOn }"
      :style="gachaPos(498, 335)"
      type="button"
      :title="soundOn ? '关闭演出音效' : '开启演出音效'"
      @click="emit('toggle-sound')"
    >
      <img
        :src="getImageUrl(soundOn ? '/images/HeroInfoPanel_Atlas/chara_btn_voice.webp' : '/images/HeroInfoPanel_Atlas/chara_btn_voice_press.webp')"
        :alt="soundOn ? '音效开' : '音效关'"
      />
    </button>

    <!-- 模拟数据说明：静态图鉴没有账号数据，必须明确标注；「重置」紧跟其右（两字）。
         位置：按用户标注放在标题横幅正下方，最终微调为设计 y≈277~310（用户校准值，
         顶部盖住横幅深色底边），底边距「伙伴/魔物蛋」按钮可见顶缘（y≈268）尚有空隙。
         左边缘沿用左基准 −631；不设最大宽度，「已抽 N 次」后缀完整显示不截断。 -->
    <div class="g-abs g-layer-ui sim-note" :style="{ left: 'calc(50% - 631px)', top: 'calc(50% - 310px)', transform: 'none' }">
      <span class="g-text g-text--xs sim-note__text">
        模拟招募 · 抽卡资源与数据均为本地推演{{ pullCount ? ` · 已抽 ${pullCount} 次` : '' }}
      </span>
      <button
        class="sim-note__reset g-focusable"
        type="button"
        title="清空本地模拟数据（保底、记录、钱包）"
        @click="emit('reset')"
      >
        <span class="g-text g-text--xs">重置</span>
      </button>
    </div>

    <slot />
  </GachaStage>
</template>

<script setup>
/**
 * 卡池主页面（游戏 `HeroPoolPanel` + `HeroPoolUI` 的还原）。
 *
 * 布局坐标全部取自原始 prefab（`assets/Android/AssetBundle/prefab/uiprefab/heropoolpanel`），
 * 注释里的 `(x, y)` 即 prefab 中的 Transform 局部坐标（设计画布 1534×750，原点居中）。
 * 组件只负责展示与交互事件，抽卡规则在 `utils/gachaSim.js`，状态在 `stores/gachaState.js`。
 *
 * 与游戏的已知差异（有意为之，见 dev-log）：
 *   - 未实现右上角货币条：余额属于账号数据，静态图鉴不虚构；
 *   - 未实现卡池物品格 `itemTemp`、蜡烛/灯光粒子与 3D 演出，用 CSS 近似；
 *   - 新增「音效开关 / 模拟说明 / 重置」三个本页控件（游戏内无对应元素）。
 */
import { computed } from 'vue'
import GachaStage from './GachaStage.vue'
import { gachaPos } from '../../utils/gachaLayout'
import { getImageUrl } from '../../utils/env'
import { buildCurrencySlots, buildDrawOptions } from '../../utils/gachaCurrency'
import { getPityConfig } from '../../utils/gachaSim'

const props = defineProps({
  /** 当前大类：hero（角色）或 pet（魔物蛋）。 */
  kind: { type: String, default: 'hero' },
  /** 当前大类下的卡池列表（用于页签）。 */
  pools: { type: Array, default: () => [] },
  /** 当前选中的卡池。 */
  pool: { type: Object, required: true },
  /** 模拟运行时（保底计数），未抽过为 null。 */
  runtime: { type: Object, default: null },
  /** 模拟累计抽取次数，仅用于展示。 */
  pullCount: { type: Number, default: 0 },
  /** 魔物蛋入口是否开放（对应 `UIManager.GuidePanel.CheckPetOpen()`）。 */
  petOpen: { type: Boolean, default: true },
  /** 演出音效开关状态。 */
  soundOn: { type: Boolean, default: true },
  /** 模拟钱包持有量：typeId → 数量（货币与消耗券共用）。 */
  wallet: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'update:kind', 'select-pool', 'rate', 'record', 'draw',
  'close', 'exchange', 'open-candidate', 'toggle-sound', 'reset', 'topup'
])

/** 指定伙伴 / 指定魔物蛋：候选里 isUp 的项。 */
const upCandidates = computed(() =>
  (props.pool.tiers ?? []).flatMap(tier => tier.candidates ?? []).filter(item => item.isUp)
)

/** 期次贴图：原表 `imgTitle`（gacha_name_chara / _sp / gacha_name_egg / _sp）。 */
const periodSprite = computed(() => props.pool.assets?.titleSprite || 'gacha_name_chara')

/** 永久池判定：游戏按 `closeTimeSpan - now` 是否 ≥365 天选择 longPeriod 或倒计时。 */
const isPermanent = computed(() => {
  const closes = Number(props.pool.closesAt)
  if (!Number.isFinite(closes)) return true
  return (closes - Date.now()) / 86400000 >= 365
})

/** 限时池倒计时文案（游戏 `ExtentionMethod.TimeFormat3`，此处按天/小时给出可读剩余）。 */
const remainingText = computed(() => {
  const closes = Number(props.pool.closesAt)
  if (!Number.isFinite(closes)) return ''
  const remain = closes - Date.now()
  if (remain <= 0) return '已结束'
  const days = Math.floor(remain / 86400000)
  const hours = Math.floor((remain % 86400000) / 3600000)
  return days > 0 ? `${days} 天 ${hours} 小时` : `${hours} 小时`
})

/** 有礼包入口才显示兑换按钮（对应 `exchangeBtn.SetActive(!string.IsNullOrEmpty(packDisplay))`）。 */
const hasExchange = computed(() => Boolean(props.pool.packDisplay))

/** 保底提示：对应 `HeroPoolUI.RefreshSafe`，文案与源码逐字一致（`$"{text}{safe}次后必为5星{text2}！"`）。 */
const safeHint = computed(() => {
  const config = getPityConfig(props.pool)
  if (!config.topSafe) return ''
  const pity = Number(props.runtime?.pity?.[config.topRank] ?? 0)
  const left = Math.max(config.topSafe - pity, 0)
  const noun = props.kind === 'hero' ? '伙伴' : '魔物'
  const verb = props.kind === 'hero' ? '招募' : '购买'
  if (left <= 1) return `本次${verb}必为5星${noun}！`
  return `${verb}${left}次后必为5星${noun}！`
})

/** 页签底图：永久池用 gacha_page、限时池用 gacha_page_sp（对应 HeroPoolUI.Init）；选中态用 gacha_page_on。 */
function tabSprite(item) {
  const closes = Number(item.closesAt)
  const permanent = !Number.isFinite(closes) || (closes - Date.now()) / 86400000 >= 365
  return permanent ? 'gacha_page' : 'gacha_page_sp'
}

/** 页签底图类：选中时换成高亮图 `gacha_page_on`（游戏里选中页签明显更亮）。 */
function tabSliceClass(item) {
  if (item.id === props.pool.id) return 'g-slice--tab-on'
  return tabSprite(item) === 'gacha_page' ? 'g-slice--tab' : 'g-slice--tab-sp'
}

/** 页签倒计时：永久池不显示（对应 `Time`/`TimeIcon` 的 SetActive）。 */
function tabTime(item) {
  const closes = Number(item.closesAt)
  if (!Number.isFinite(closes)) return ''
  const remain = closes - Date.now()
  if (remain <= 0) return '已结束'
  if ((remain / 86400000) >= 365) return ''
  const days = Math.floor(remain / 86400000)
  const hours = Math.floor((remain % 86400000) / 3600000)
  return days > 0 ? `${days}天 ${hours}时` : `${hours}时`
}

/** 单抽 / 十连按钮与货币条：与招募结果一览共用同一构建器（utils/gachaCurrency.js）。 */
const drawOptions = computed(() => buildDrawOptions(props.pool, props.wallet, props.kind))
const currencySlots = computed(() => buildCurrencySlots(props.pool, props.wallet, props.kind))

/**
 * 指定伙伴头像：游戏的 `HeroPoolUI` 用的是 `heroDataById.Icon`（`at*_0` 圆形头像，
 * 资源在 `public/images/HeadIconAtals/`），不是卡面 `chara*_ka`（160×256 半身，
 * 填进 100×100 的框里会像「整幅立绘」）。映射 `hero_064 → at064_0`、
 * `new_hero_002 → at002_1` 已逐个核对过全部角色候选（均存在）；魔物蛋池仍用候选自带图标。
 */
function upAvatar(candidate) {
  const typeId = String(candidate?.typeId ?? '')
  if (props.kind === 'hero') {
    // 头像文件已统一为 .webp（`at<3位编号>_0.webp` / `_1.webp`）
    const plain = /^hero_0*(\d+)$/.exec(typeId)
    if (plain) return `/images/HeadIconAtals/at${String(plain[1]).padStart(3, '0')}_0.webp`
    const variant = /^new_hero_0*(\d+)$/.exec(typeId)
    if (variant) return `/images/HeadIconAtals/at${String(variant[1]).padStart(3, '0')}_1.webp`
  }
  return candidate?.icon ?? ''
}
</script>

<style scoped>
.pool-scenery {
  width: max(100%, 1680px);
  height: 1000px;
  overflow: hidden;
}

/* 两张模糊纹理共用主图裁切框（次级模糊边略外扩），角色立绘不拉伸。 */
.pool-bgmain,
.pool-bgblur {
  position: absolute;
  width: calc(100% * 2048 / 1680);
  height: calc(100% * 1024 / 1000);
  left: calc(-100% * 184 / 1680);
  top: calc(-100% * 12 / 1000);
  max-width: none;
}

/* BG_main_blured：1024×512，prefab 里 scale=(2,2) */
.pool-bgblur {
  opacity: 0.55;
}

.pool-hl {
  width: 100%;
  height: 100%;
  animation: gacha-breathe 2.4s ease-in-out infinite;
  pointer-events: none;
}

/* Draw/Heros：按贴图原始像素显示（角色池 1680×1000、魔物蛋池 879×946），
   依赖 MakePixelPerfect 语义，不做拉伸 */
.pool-cover {
  animation: gacha-scale-in 0.5s ease-out both;
  pointer-events: none;
}

.pool-foreground {
  width: max(100%, 2100px);
  height: 1250px;
  pointer-events: none;
}

.pool-foreground img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  opacity: 0.9;
}

.pool-side-mask {
  width: 480px;
  height: 750px;
  opacity: 0.72;
}

.pool-title-art {
  width: 512px;
  height: 152px;
}

.pool-title-plate {
  width: 217px;
  height: 24px;
  /* prefab `Title/bg` 的 UISprite mPivot=3 → Left：从 (-274.7,336.9) 向右展开 */
  left: calc(50% - 274.7px);
  transform: translateY(-50%);
}

.safe-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  /* 左边缘锚定（左对齐），不再做水平居中 */
  transform: translateY(-50%);
  white-space: nowrap;
  /* prefab UILabel #49693: mEffectStyle=2 (Outline), mEffectColor=#000000 */
  text-shadow: -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000;
}

/* 货币槽：bg 位于 -23（pivot=Left，向右展开），icon @0，Label @61，add @119。
   内容宽 162、槽间距 152（item→ke）与 169（ke→payKe），prefab 中相邻槽本就轻微交叠，
   NGUI 靠 mDepth（add=7 > 下一个槽的 bg=5）保证「+」可点；DOM 里改用 pointer-events：
   容器与背景不接收事件，只有 add 按钮可点，避免后一个槽挡住前一个槽的按钮。 */
/* 货币槽改为**行内统一布局**：图标 → 数字 → 「+」，间距固定。
   prefab 的 Label 是 90 宽居中框，3 位数在框内居中后比 5 位数更靠右，
   导致「契约书的数量偏右」，与氪金/神晶/银币不统一；行内布局让数字左边缘
   与图标的间距对所有槽一致。底牌按内容宽度 9 宫格拉伸。 */
/* 货币条槽位样式已抽到 assets/gacha.css（与招募结果一览共用，见 utils/gachaCurrency.js） */

.safe-hint__icon {
  width: 22px;
  height: 22px;
}

.mini-btn {
  width: 152px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  /* prefab UILabel：概率详情/记录查询 = #cfba96（ColorString[2]）18px。
     注意：此元素自带 border-image（g-slice--btn-mini），不能写 `border` 简写——
     简写会把 border-image 一起重置掉（精灵消失，切片测试会抓到）。 */
  color: #cfba96;
}

/* 期次贴图 312×76 */
.pool-period {
  width: 312px;
  height: 76px;
  pointer-events: none;
}

/* 永久开放 / 限时倒计时的底板：gacha_name_stay / gacha_name_limit 228×32 */
.period-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 228px;
  height: 32px;
}

.period-badge__bg {
  position: absolute;
  inset: 0;
  width: 228px;
  height: 32px;
}

.period-badge__text {
  position: relative;
  /* prefab UILabel：永·久·开·放 = #cfba96（ColorString[2]）18px */
  color: #cfba96;
}

.exchange-btn {
  border: 0;
  width: 260px;
  height: 72px;
  background: none;
  padding: 0;
}

.exchange-btn img { width: 260px; height: 72px; }

.kind-toggle {
  border: 0;
  width: 168px;
  height: 84px;
  background: none;
  padding: 0;
}

.kind-toggle img { width: 168px; height: 84px; }

/* 卡池页签：底图 128×84 经 9 宫格拉伸到 324×84（与 prefab mWidth 一致）；
   Icon 是**宽幅头像牌**（gacha_at_chara*_0 为 165×66、pet 为 184×84），
   必须按原图自然尺寸放在 -70 处，压成方块会把头像挤扁。 */
.pool-tab {
  border: 0;
  width: 324px;
  height: 84px;
  background: none;
  padding: 0;
  display: block;
  overflow: hidden;
}

.pool-tab__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pool-tab__icon {
  position: absolute;
  left: calc(50% - 70px);
  top: 50%;
  transform: translate(-50%, -50%);
  /* 页签头像牌按卡池类型分开定尺寸（用户口径）：
     魔物蛋页签 height 84（贴图原生 184×84，蛋对位于贴图中段，左右为透明边距——
     底板边框从透明边距透出，层级天然高于图片）；伙伴页签维持 66 高、left −64。 */
  height: 84px;
  width: auto;
}

.pool-tab__icon--hero {
  height: 66px;
  left: calc(50% - 64px);
}

.pool-tab__label {
  position: absolute;
  left: calc(50% + 70px);
  top: 50%;
  width: 168px;
  transform: translate(-50%, -50%);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* prefab UILabel #49708: fontSize=26, mColor=#e6d2af */
  font-size: 26px;
  font-weight: 600;
  color: #e6d2af;
}

.pool-tab__time-icon {
  position: absolute;
  left: calc(50% + 81px);
  top: calc(50% - 16px);
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
}

.pool-tab__time {
  position: absolute;
  left: calc(50% + 42px);
  top: calc(50% - 30px);
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

/* 指定伙伴区块：底板 400×140；`指定伙伴` 为 28px、右端贴 489（prefab pivot=Right） */
.up-plate {
  width: 400px;
  height: 140px;
}

/* 底板左端渐隐：游戏里这块底板左边缘是淡出的，硬边矩形会像一条横带切过立绘 */
.up-plate-wrap {
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 26%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 26%, #000 100%);
}

.up-label {
  width: 180px;
  font-size: 28px;
  font-weight: 700;
  text-align: right;
  transform: translate(-100%, -50%);
  /* prefab UILabel #49806: 指定伙伴 = #cfba96 (ColorString[2]) */
  color: #cfba96;
}

/* desc0「概率提升！」与 desc1 同一行、同为 fontSize=28（prefab），此处改为左对齐排在右侧 */
.up-boost {
  text-align: left;
  transform: translate(-50%, -50%);
  /* prefab UILabel #49818: 概率提升！ = #f8eedc (ColorString[1]) */
  color: var(--gacha-ink);
}

.up-slot {
  border: 0;
  width: 100px;
  height: 100px;
  background: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 层级按 prefab 的 mDepth：`icon` 是 6、外框 `at_f_*` 是 7、角标 `com_up` 是 8
   → **外框必须压在头像之上**（此前我把头像写在后面，头像盖住了外框）。
   另外外框的开窗偏下，头像要往下挪一点才落在框内（游戏里头顶上方留出一圈金边）。*/
.up-slot__frame {
  position: absolute;
  inset: 0;
  width: 100px;
  height: 100px;
  z-index: 2;
}

.up-slot__icon {
  position: relative;
  top: 8px;
  z-index: 1;
  width: 76px;
  height: 76px;
  object-fit: contain;
}

/* com_up 24×56 @(37.9, 0)：贴在头像右侧的「概率提升」角标 */
.up-slot__badge {
  position: absolute;
  z-index: 3;
  left: calc(50% + 37.9px);
  top: 50%;
  width: 24px;
  height: 56px;
  transform: translate(-50%, -50%);
}

/* 抽取按钮：com_btn_Y_sp 128×72 经 9 宫格拉伸到 292×72。
   按游戏排版：按钮内只有「招募一次/十次」，消耗行独立浮在按钮上方（见 .draw-cost） */
.draw-btn {
  width: 292px;
  height: 72px;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.draw-btn__label {
  position: relative;
  font-size: 24px;
  font-weight: 700;
  /* prefab UILabel：招募/购买一次 = #cfba96（ColorString[2] 米金，配红钮） */
  color: #cfba96;
}

/* 招募/购买十次 = #33dad0（ColorString[6] 青，配青钮） */
.draw-btn__label--ten {
  color: #33dad0;
}

/* 抽取消耗行样式已抽到 assets/gacha.css（与招募结果一览共用） */

.close-btn {
  border: 0;
  width: 100px;
  height: 68px;
  background: none;
  padding: 0;
}

.close-btn img { width: 100px; height: 68px; }

.sound-btn {
  width: 48px;
  height: 48px;
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: relative;
}

.sound-btn img {
  width: 48px;
  height: 48px;
}

.sound-btn:active img { filter: brightness(1.15); }

/* 关闭态：灰化变暗（无独立关图标，游戏只有开/按下两态） */
.sound-btn--off img {
  filter: grayscale(1) brightness(0.55);
  opacity: 0.8;
}

/* 重置模拟数据：按用户要求放在抽卡资源下方居中 */
.sim-note__reset {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid rgba(248, 238, 220, 0.32);
  background: rgba(20, 14, 8, 0.5);
  cursor: pointer;
}

.sim-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(12, 8, 4, 0.62);
  border: 1px solid rgba(248, 238, 220, 0.22);
  transform: translate(-50%, -50%);
  white-space: nowrap;
  /* 说明条按用户要求浮在画面最上层（高于交互层 60），且不设最大宽度——
     「已抽 N 次」后缀不得被省略号截断。 */
  z-index: 65;
}

/* 自己定义交互态：`.g-hit:active` 带 translate(-50%,-50%)，只适用于 .g-abs 居中元素，
   用在流内按钮上会让它按下时整体位移（用户报告「点重置按钮飞起来」）。 */
.sim-note__reset:hover { filter: brightness(1.15); }
.sim-note__reset:active { transform: scale(0.95); }

.sim-note__text {
  color: var(--gacha-ink-gold);
}

</style>
