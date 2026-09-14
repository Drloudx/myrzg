<template>
  <div class="gacha-page">
    <template v-if="errorMessage">
      <div class="gacha-fallback">
        <UiEmptyState type="error" :text="errorMessage" />
      </div>
    </template>
    <template v-else-if="!ready">
      <div class="gacha-fallback">
        <UiEmptyState type="loading" text="卡池数据加载中..." />
      </div>
    </template>

    <template v-else>
      <!-- 卡池列表页：作为招募底层面板常驻（游戏 `HeroPoolPanel` 全程不关，
           演出、揭晓、结算与提示等所有弹层均作为覆盖层浮于其上；不使用 v-show 隐藏，
           避免抽卡结束切回时触发浏览器 CSS 动画重置，导致中间立绘多动一次） -->
      <GachaPoolPanel
        :inert="stage !== 'pool' && stage !== 'result'"
        v-model:kind="kind"
        :pools="poolsOfKind"
        :pool="currentPool"
        :runtime="runtime"
        :pull-count="pullCount"
        :pet-open="petOpen"
        :sound-on="soundOn"
        :wallet="wallet"
        @select-pool="selectPool"
        @draw="handleDraw"
        @rate="openTip('rate')"
        @record="openTip('record')"
        @close="handleBack"
        @exchange="handleExchange"
        @open-candidate="openCandidate"
        @toggle-sound="store.toggleSound"
        @reset="handleReset"
        @topup="handleTopUp"
      />

      <!-- 翻卡演出（覆盖层：HeroGachaAniPanel 的网页还原，elsa_rawcard Spine 翻卡；
           蛋池走 GachaPetPanel（PetGachaAniPanel 完整还原：袋+桌面+出蛋+逐蛋揭晓）） -->
      <div v-if="stage === 'card'" class="gacha-overlay">
        <GachaPetPanel
          v-if="kind === 'pet'"
          :items="petShowItems"
          @done="stage = 'result'"
          @share="copyShareText"
        />
        <GachaCardPanel
          v-else
          :count="drawCount"
          :rare="hasRareDraw"
          @done="stage = 'reveal'"
        />
      </div>

      <!-- 揭晓演出（覆盖层：与卡池面板同时挂载时必须绝对定位，见 gacha.css .gacha-overlay；
           仅角色池：HeroGachaShowPanel 三段式，蛋池揭晓在 GachaPetPanel 内完成） -->
      <div v-if="stage === 'reveal'" class="gacha-overlay">
        <GachaRevealPanel
          :items="revealItems"
          @finish="handleRevealFinish"
        />
      </div>

      <!-- 结果一览：角色池走 `HeroShowPanel`（卡牌阵列）；魔物蛋池走 `GetRewardTip`
           结算弹层（源码里两条完全不同的结束链路，不能共用同一面板）。
           蛋池结算 = 蛋 + 卡池赠品（petPool.reward → mowuPool_1：每抽赠 1 个翼型徽印，
           源码 `ResponsePetRouterGacha` 把 `data.reward` 聚合进同一结算）。 -->
      <div v-if="stage === 'result'" class="gacha-overlay">
        <GachaPetResult
          v-if="kind === 'pet'"
          :items="petSettlementItems"
          @close="handleResultClose"
        />
        <GachaResultPanel
          v-else
          :items="revealItems"
          :pool="currentPool"
          :kind="kind"
          :wallet="wallet"
          @again="handleDraw"
          @close="handleResultClose"
          @topup="handleTopUp"
        />
      </div>

      <!-- 概率详情 / 记录查询（与卡池面板同时显示，必须是覆盖层） -->
      <div v-if="tipMode" class="gacha-overlay">
        <GachaTipPanel
          :mode="tipMode"
          :pool="currentPool"
          :records="recordsOfKind"
          :kind="kind"
          @close="closeTip"
          @open-candidate="openCandidate"
        />
      </div>

      <!-- 消耗确认弹窗（ConsumeTips）：当抽卡券不足时提示用货币兑换 -->
      <div v-if="consumeModalVisible" class="gacha-overlay">
        <GachaConsumeModal
          :title="consumeModalData.title"
          :msg="consumeModalData.msg"
          :items="consumeModalData.items"
          :can-afford="consumeModalData.canAfford"
          :error-msg="consumeModalData.errorMsg"
          @confirm="handleConfirmConsume"
          @cancel="handleCancelConsume"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * 模拟招募页面（`/gacha`）。
 *
 * 数据：`data/parsed/gacha.json`（卡池、星级权重、保底次数、原表概率说明）+
 * `data/parsed/gacha-presentation.json`（角色揭晓立绘与抽卡台词）。
 * 规则：`utils/gachaSim.js`（按原表权重与保底重写的本地模拟）；状态：`stores/gachaState.js`。
 *
 * 明确标注为「模拟」：真实抽取在服务端完成，本地不模拟账号余额、限购与已拥有状态。
 * URL 契约沿用历史入口：`?kind=hero|pet&pool=<poolId>&view=pool`（`view=pool` 打开概率详情），
 * 与 `item-sources` 里既有的「前往」链接保持一致。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GachaPoolPanel from '../components/gacha/GachaPoolPanel.vue'
import GachaCardPanel from '../components/gacha/GachaCardPanel.vue'
import GachaPetPanel from '../components/gacha/GachaPetPanel.vue'
import GachaRevealPanel from '../components/gacha/GachaRevealPanel.vue'
import GachaResultPanel from '../components/gacha/GachaResultPanel.vue'
import GachaPetResult from '../components/gacha/GachaPetResult.vue'
import GachaTipPanel from '../components/gacha/GachaTipPanel.vue'
import GachaConsumeModal from '../components/gacha/GachaConsumeModal.vue'
import { HERO_SPINE_ASSETS, PET_SPINE_ASSETS } from '../components/gacha/gachaSpineAssets'
import { UiEmptyState } from '../components/ui/index.js'
import { fetchWithFallback } from '../utils/request'
import { isBlacklisted } from '../config/blacklist'
import { BASE_REWARD_ICONS } from '../utils/gameMappings'
import { getImageUrl } from '../utils/env'
import { useGachaStateStore } from '../stores/gachaState'
import { createRuntime, drawMany, getPityConfig, normalizeRuntime, resolveDuplicate } from '../utils/gachaSim'
import { calculateExchangePlan } from '../utils/gachaCurrency'
import { disposeSharedCanvases, disposeSharedSpineScenes, preloadGachaSpineAssets } from '../utils/gachaSpinePlayer'
import { playBgm, setSoundEnabled, stopBgm, preloadAudio } from '../utils/gachaAudio'
import { preloadGachaRevealStaticAssets, preloadGachaResultAssets } from '../utils/gachaPreload'
import '../assets/gacha.css' 

const route = useRoute()
const router = useRouter()
const store = useGachaStateStore()

const ready = ref(false)
const errorMessage = ref('')
const pools = ref([])
const presentation = ref({})
const initialWallet = ref(null)
const kind = ref('hero')
const poolId = ref('')
const stage = ref('pool')          // pool | card | reveal | result
const tipMode = ref('')            // '' | rate | record
const revealItems = ref([])
const drawCount = ref(1)           // 本次抽取次数（翻卡演出与结果按钮共用）
/** 稀有判定（源码 HeroGachaAniPanel.OpenPanel：结果含 5 星 → surprised 段）。 */
const hasRareDraw = computed(() => revealItems.value.some(item => Number(item.rank ?? item.quality) >= 5))

/** 蛋池出蛋演出列表（PetGachaAniPanel：按抽取顺序逐只出蛋展示，**只有蛋**）。 */
const petShowItems = computed(() => revealItems.value)

/**
 * 蛋池结算列表（GetRewardTip）：蛋 + 卡池赠品聚合条目。
 * 源码 `ResponsePetRouterGacha`：`rewardData.reward += data.reward` —— 蛋逐只入列后
 * 把 `petPool.reward`（mowuPool_1，每抽赠 1 个翼型徽印）整体追加进同一结算，
 * 徽印按数量聚合成一条（游戏截图：10 连 = 10 蛋 + 翼型徽印 ×10）。
 */
const petSettlementItems = computed(() => {
  const bonus = currentPool.value?.bonus ?? []
  if (!bonus.length) return revealItems.value
  const extras = bonus.map(entry => ({
    typeId: entry.typeId,
    name: entry.name,
    quality: Number(entry.quality) || 3,
    icon: entry.icon,
    count: (Number(entry.count) || 1) * drawCount.value,
    isBonus: true
  }))
  return [...revealItems.value, ...extras]
})

/** 复制抽蛋结果摘要（PetGachaAniPanel 的分享按钮，同结果一览口径）。 */
async function copyShareText() {
  const text = revealItems.value.map(item => `${item.rank ?? item.quality}星 ${item.name}`).join('\n')
  try {
    await navigator.clipboard.writeText(`深歌小助手 · 模拟招募\n${text}`)
  } catch {}
}

/**
 * 模拟额度：静态图鉴没有账号余额，钱包以**原表初始配置量**（`playerInit.json`）起算，
 * 再叠加一份固定的模拟额度，使页面开箱即可试抽。数值是本页的模拟经济，不是账号数据；
 * 金币条上的「+」按钮按 `SIM_TOPUP_*` 补充（用户指定：券 +10、氪金/神晶 +2000），
 * 重置后回到本基准。
 */
const SIM_ALLOWANCE = { money: 300000, ke: 2000, payKe: 2000 }
const SIM_TICKET_ALLOWANCE = 100
/** 「+」按钮每次补充的模拟额度：券 +10、氪金/神晶 +2000、银币 +3 万（用户指定）。 */
const SIM_TOPUP = { money: 30000, ke: 2000, payKe: 2000 }
const SIM_TICKET_TOPUP = 10

const soundOn = computed(() => store.soundOn)
const wallet = computed(() => store.wallet ?? {})

/** 消耗确认弹窗状态（ConsumeTips）：当抽卡券不足时提示用货币兑换 */
const consumeModalVisible = ref(false)
const consumeModalData = ref({
  title: '提示',
  msg: '',
  items: [],
  canAfford: true,
  errorMsg: '',
  spendItems: [],
  drawCount: 0
})

/**
 * 音效开关：真正作用在播放中的 BGM 上（暂停/续播，**不重启、不换曲**），
 * 而不是只拦截之后的播放——见 `utils/gachaAudio.js`。
 */
watch(soundOn, value => setSoundEnabled(value), { immediate: true })

/**
 * 模拟额度明细（typeId → 每次补充量）：货币用公共 `BASE_REWARD_ICONS` 的 typeId，
 * 消耗券按数据中实际出现的卡池消耗道具生成，避免在页面写死某个券的 ID。
 */
const allowance = computed(() => {
  const map = {
    [BASE_REWARD_ICONS.money]: SIM_ALLOWANCE.money,
    [BASE_REWARD_ICONS.ke]: SIM_ALLOWANCE.ke,
    [BASE_REWARD_ICONS.payKe]: SIM_ALLOWANCE.payKe
  }
  for (const pool of pools.value) {
    for (const cost of pool.costs ?? []) {
      if (cost?.typeId) map[cost.typeId] = SIM_TICKET_ALLOWANCE
    }
  }
  return map
})

/** 「+」每次补充量（typeId → 数量）：与种子额度相互独立，券 +10、氪金/神晶 +2000。 */
const topupAllowance = computed(() => {
  const map = {
    [BASE_REWARD_ICONS.money]: SIM_TOPUP.money,
    [BASE_REWARD_ICONS.ke]: SIM_TOPUP.ke,
    [BASE_REWARD_ICONS.payKe]: SIM_TOPUP.payKe
  }
  for (const pool of pools.value) {
    for (const cost of pool.costs ?? []) {
      if (cost?.typeId) map[cost.typeId] = SIM_TICKET_TOPUP
    }
  }
  return map
})
const poolsOfKind = computed(() => pools.value.filter(pool => pool.kind === kind.value))
const currentPool = computed(() =>
  poolsOfKind.value.find(item => item.id === poolId.value) ?? poolsOfKind.value[0] ?? null)
const runtime = computed(() => currentPool.value ? store.runtimeOf(currentPool.value.id) : null)
const pullCount = computed(() => currentPool.value ? store.pullCountOf(currentPool.value.id) : 0)
/** 记录查询在游戏里按大类查询（`queryType = heroOrPet ? "hero" : "gacha"`）。 */
const recordsOfKind = computed(() => store.records.filter(item => item.kind === kind.value))
/** 魔物蛋入口开放：对应 `UIManager.GuidePanel.CheckPetOpen()`，此处以是否存在开放蛋池近似。 */
const petOpen = computed(() => pools.value.some(pool => pool.kind === 'pet' && pool.open !== false))

/** 载入卡池与揭晓数据；失败时显示错误态，不回退原始表。 */
async function load() {
  try {
    const [poolData, presentationData] = await Promise.all([
      fetchWithFallback('data/parsed/gacha.json'),
      fetchWithFallback('data/parsed/gacha-presentation.json').catch(() => ({}))
    ])
    const list = (poolData?.pools ?? []).filter(pool => !isBlacklisted({ id: pool.id, name: pool.name }))
    if (!list.length) {
      errorMessage.value = '卡池数据为空，请先执行 npm run data:build。'
      return
    }
    pools.value = list
    presentation.value = presentationData || {}
    initialWallet.value = poolData?.initialWallet ?? null
    ensureWallet()
    syncFromRoute()
    ready.value = true
    // 演出资源预热：进页即后台拉取两套骨骼（atlas/skel/贴图进内存缓存），
    // 点击抽卡时面板秒开，不再有可感知的加载延迟；音频一并预热（BGM 首次播放不卡）
    setTimeout(() => {
      const warm = defs => preloadGachaSpineAssets(defs.map(def => ({
        ...def,
        atlas: getImageUrl(def.atlas),
        skeleton: getImageUrl(def.skeleton)
      })))
      warm(PET_SPINE_ASSETS)
      warm(HERO_SPINE_ASSETS)
      preloadAudio(['gacha_shop', 'gacha_ready_chara', 'gacha_show_chara', 'gacha_ready_egg', 'gacha_show_egg'])
      preloadGachaRevealStaticAssets()
    }, 400)
    // 卡池页 BGM（源码 `HeroPoolPanel.Open/Close` 一律播 gacha_shop；同名不重启）
    playBgm('gacha_shop')

    if (import.meta.env.DEV) {
      window.__gachaStore = store
      window.__testReveal = (items) => {
        const fullItems = items.map(item => {
          const preset = presentation.value[item.typeId] || {}
          return {
            typeId: item.typeId,
            name: item.name || preset.name || '',
            quality: item.quality ?? (preset.job ? 5 : 3),
            rank: item.rank ?? (preset.job ? 5 : 3),
            element: item.element || preset.element || 1,
            job: item.job || preset.job || 1,
            portrait: item.portrait || preset.portrait || '',
            dialogue: item.dialogue || preset.dialogue || '',
            skeleton: item.skeleton || preset.name || '',
            skin: item.skin || preset.skin || '',
            imgPos: item.imgPos || preset.imgPos || null,
            isNew: true
          }
        })
        revealItems.value = fullItems
        preloadGachaResultAssets(fullItems)
        stage.value = 'reveal'
      }
    }
  } catch (error) {
    errorMessage.value = `卡池数据加载失败：${error?.message ?? error}`
  }
}

/** 读取 URL 的 kind / pool / view，并修正到有效值。 */
function syncFromRoute() {
  const queryKind = String(route.query.kind ?? '')
  if (queryKind === 'hero' || queryKind === 'pet') kind.value = queryKind
  if (!poolsOfKind.value.length) kind.value = kind.value === 'hero' ? 'pet' : 'hero'

  const queryPool = String(route.query.pool ?? '')
  if (queryPool && poolsOfKind.value.some(pool => pool.id === queryPool)) {
    poolId.value = queryPool
  } else if (!poolsOfKind.value.some(pool => pool.id === poolId.value)) {
    poolId.value = poolsOfKind.value[0]?.id ?? ''
  }
  tipMode.value = route.query.view === 'pool'
    ? 'rate'
    : (route.query.view === 'record' ? 'record' : '')
}

/**
 * 写回 URL（不新增历史条目，保留其他查询参数）。
 * 覆盖层状态必须与 URL 一一对应：`view=pool`（历史契约，概率详情）/ `view=record`（记录查询）。
 * 否则 `syncFromRoute` 会在 replace 后的 watcher 里把刚打开的记录查询立刻重置关闭。
 */
function syncToRoute() {
  const query = { ...route.query, kind: kind.value }
  if (poolId.value) query.pool = poolId.value
  else delete query.pool
  if (tipMode.value === 'rate') query.view = 'pool'
  else if (tipMode.value === 'record') query.view = 'record'
  else delete query.view
  router.replace({ query })
}

watch(() => route.query, () => { if (ready.value) syncFromRoute() })
watch(kind, () => {
  poolId.value = poolsOfKind.value[0]?.id ?? ''
  tipMode.value = ''
  stage.value = 'pool'
  syncToRoute()
})

function selectPool(id) {
  poolId.value = id
  stage.value = 'pool'
  syncToRoute()
}

function openTip(mode) {
  tipMode.value = mode
  syncToRoute()
}

function closeTip() {
  tipMode.value = ''
  syncToRoute()
}

/** 打开候选详情：跳转角色/魔物图鉴（等价源码 `OnClickOpenPicHandBookPanel`）。 */
function openCandidate(candidate) {
  const target = candidate?.detail
  if (target?.path) {
    router.push({ path: target.path, query: { ...(target.query ?? {}) } })
    return
  }
  router.push({ path: kind.value === 'hero' ? '/heroes' : '/pets', query: { id: candidate?.typeId ?? '' } })
}

function handleExchange() {
  const pack = currentPool.value?.packDisplay
  if (!pack) return
  router.push({ path: '/exchange', query: { q: pack } })
}

function handleReset() {
  if (!currentPool.value) return
  store.resetPool(currentPool.value.id)
}

/** 建立模拟钱包：原表初始配置量与模拟额度取较大值（首次进入时生效，已有存档不覆盖）。
 *  不能相加：`playerInit` 的 initItems 本来就送普通招待券 ×1，再叠加 100 份模拟额度
 *  会出现「默认 101 张」的怪数（用户指认）；取较大值保证每种消耗券至少有一份模拟额度。 */
function ensureWallet() {
  const init = initialWallet.value
  const seed = {}
  if (init) {
    seed[BASE_REWARD_ICONS.money] = init.money ?? 0
    seed[BASE_REWARD_ICONS.ke] = init.ke ?? 0
    seed[BASE_REWARD_ICONS.payKe] = init.payKe ?? 0
    for (const item of init.items ?? []) seed[item.typeId] = item.count ?? 0
  }
  for (const [typeId, amount] of Object.entries(allowance.value)) {
    seed[typeId] = Math.max(seed[typeId] ?? 0, amount)
  }
  store.ensureWallet(seed)
}

/** 货币条「+」：补充一份模拟额度（券 +10、氪金/神晶 +2000）。 */
function handleTopUp(typeId) {
  const amount = topupAllowance.value[typeId]
  if (!amount) return
  store.topUp({ [typeId]: amount })
}

function handleBack() {
  if (window.history.length > 1) router.back()
  else router.push('/')
}

/**
 * 抽取：按原表权重与保底推演，写入本地模拟状态后进入揭晓演出。
 * 演出数据补上立绘与台词（角色取 `gacha-presentation.json`，魔物蛋用蛋图）。
 * 若抽卡券不足，自动计算所需货币并在必要时通过神晶 1:1 折算，弹出 ConsumeTips 确认弹窗。
 */
function handleDraw(count) {
  const pool = currentPool.value
  if (!pool) return

  const exchangePlan = calculateExchangePlan(pool, store.wallet, count)
  if (exchangePlan.needExchange) {
    consumeModalData.value = {
      title: exchangePlan.title || '提示',
      msg: exchangePlan.msg || '',
      items: exchangePlan.items || [],
      canAfford: exchangePlan.canAfford,
      errorMsg: exchangePlan.errorMsg || '',
      spendItems: exchangePlan.spendItems || [],
      drawCount: count
    }
    consumeModalVisible.value = true
    return
  }

  executeDrawWithSpend(count, exchangePlan.spendItems)
}

function handleConfirmConsume() {
  if (!consumeModalData.value.canAfford) return
  const count = consumeModalData.value.drawCount
  const spendItems = consumeModalData.value.spendItems
  consumeModalVisible.value = false
  executeDrawWithSpend(count, spendItems)
}

function handleCancelConsume() {
  consumeModalVisible.value = false
}

function executeDrawWithSpend(count, spendItems) {
  const pool = currentPool.value
  if (!pool) return
  if (!store.spend(spendItems)) {
    return
  }
  const state = normalizeRuntime(pool, store.runtimeOf(pool.id) ?? createRuntime(pool))
  const { pulls, runtime: nextRuntime } = drawMany(pool, state, count)
  if (!pulls.length) return
  store.setRuntime(pool.id, nextRuntime)

  const results = pulls.map(pull => {
    const candidate = pull.candidate
    const isNew = !store.isOwned(candidate.typeId)
    const duplicate = isNew
      ? { fragments: 0, converted: false, overflow: null, ownedAfter: 0 }
      : resolveDuplicate(candidate, store.fragmentsOf(candidate.typeId))
    const entry = {
      typeId: candidate.typeId,
      name: candidate.name,
      quality: candidate.quality,
      rank: pull.tierRank,
      icon: candidate.icon,
      overview: candidate.overview ?? null,
      isNew,
      converted: duplicate.converted,
      fragments: duplicate.fragments,
      overflow: duplicate.overflow,
      element: candidate.element,
      job: candidate.job
    }
    store.commitDraw(pool, entry, nextRuntime)
    const preset = presentation.value[candidate.typeId]
    return {
      ...entry,
      portrait: preset?.portrait ?? candidate.portrait ?? candidate.icon,
      dialogue: preset?.dialogue ?? '',
      // 揭晓 Q 版小人的骨架与皮肤（gacha-presentation：name = Npc 骨架名）
      skeleton: preset?.name ?? '',
      skin: preset?.skin ?? '',
      // 游戏卡面 `gacha_at*.png`（骨架解析异常时的静态替代）与碎片图标（重复获得 ×N）
      card: preset?.card ?? candidate.icon ?? '',
      fragment: preset?.fragment ?? '',
      // 立绘锚点（源码 `hero.ImgPos`，形如 "10_-147"；`gachaCharaOffset` 在 prefab 里是 (0,0)）
      imgPos: preset?.imgPos ?? null,
      // 蛋池出蛋贴图（Texture/pet/eggs，GachaPetPanel 用）
      egg: preset?.egg ?? candidate.icon ?? ''
    }
  })

  revealItems.value = results
  drawCount.value = count
  tipMode.value = ''
  preloadGachaResultAssets(results)
  stage.value = 'card'
}

/** 演出结束：进入结果一览（对应 `HeroShowPanel.Open(allHeroList)`）。
 *  BGM 不在这里切：源码结果页打开时继续播 `gacha_show_chara`，
 *  关闭结果页（`HeroShowPanel.Close`）才回 `gacha_shop`（handleResultClose 已处理）。 */
function handleRevealFinish() {
  stage.value = 'result'
}

/** 结果/结算面板关闭：回到卡池页；此后 BGM 仍是 `gacha_shop`（同名不重启）。 */
function handleResultClose() {
  stage.value = 'pool'
  playBgm('gacha_shop')
}

onMounted(load)
onBeforeUnmount(() => {
  // 只有离开招募页才停 BGM：演出面板之间必须连续（此前每个面板各自播放/停止，
  // 导致同一首 BGM 在切面板时被从头重启）。
  stopBgm()
  // 离开 /gacha 才统一销毁共享演出场景（画布/上下文/纹理）；抽卡过程中面板卸载
  // 只解除引用（releaseSharedSpineScene），避免反复建/丢 WebGL 上下文累积显存挂死
  disposeSharedSpineScenes()
  disposeSharedCanvases()
})
</script>

<style scoped>
.gacha-page {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.gacha-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
