<template>
  <div class="page-view-container freight-page">
    <UiFilterPanel class="filter-panel paper-panel">
      <template #search>
        <UiSearchInput v-model="searchQuery" placeholder="搜索商品名称、描述..." />
      </template>
      <UiFilterRow label="显示：">
        <UiFilterPill :active="filterMode === 'all'" @click="filterMode = 'all'">全部</UiFilterPill>
        <UiFilterPill :active="filterMode === 'buy'" @click="filterMode = 'buy'">可买入</UiFilterPill>
        <UiFilterPill :active="filterMode === 'sell'" @click="filterMode = 'sell'">可卖出</UiFilterPill>
      </UiFilterRow>
    </UiFilterPanel>

    <UiEmptyState v-if="errorMessage" type="error" :text="errorMessage" />
    <UiEmptyState v-else-if="!isDataReady" type="loading" text="货运数据加载中..." />

    <template v-else>
      <!--
        货运面板「左侧物品列表 + 价格」复刻。

        坐标取自游戏 prefab（NGUI 原始 Transform，画布中心为原点、Y 向上），
        做法与 gacha 一致：设计画布等比 contain 缩放 + 绝对定位落 prefab 原始坐标。
        画布 1334×804 由 prefab 坐标极值推得（X -668~667、Y -428~375.5）。

        每个元素的尺寸/位置都用 `pos()` 给出「中心点」，再配 `w()`/`h()` 生成的
        精确负 margin 做居中——**不要混用 transform**，否则会偏移两次。
      -->
      <div ref="stageRef" class="freight-stage">
        <div class="freight-canvas" :style="canvasStyle">
          <!-- 列表面板：prefab LeftUI/Scroll View @(-272, 11)，条目区 236 宽 -->
          <div class="freight-list-panel" :style="panelStyle">
            <div class="freight-list-title">货物行情</div>
            <div ref="listRef" class="freight-list-scroll" @scroll.passive="onScroll">
              <div class="freight-list-inner" :style="{ height: `${rows.length * ROW_H}px` }">
                <div
                  v-for="row in visibleRows"
                  :key="row.good.typeId"
                  class="freight-item"
                  :style="{ top: `${row.index * ROW_H}px` }"
                  :data-item-id="row.good.typeId"
                >
                  <!-- 条目底 228×72（prefab ItemTemp，Grid cell 236×80） -->
                  <img class="fi-bg" :src="img('cart_num')" alt="" />

                  <!-- 物品框 76×76 @(-76.8, 0) -->
                  <img :src="frameSrc(row.good)" class="fi-frame" :style="pos(-76.8, 0, 76, 76)"
                    :alt="row.good.name" loading="lazy" />
                  <img :src="itemIcon(row.good)" class="fi-icon" :style="pos(-76.8, 0, 62, 62)"
                    :alt="row.good.name" loading="lazy" @error="onIconError" />

                  <!-- 库存 140×20 @(-29, 16)（白色 fs20） -->
                  <span class="fi-cnt" :style="pos(-29, 16, 140, 20)">库存 {{ row.good.maxNum }}</span>

                  <!-- 价格：bg 148×28 @(36,-16) + 银币图标 36×36 @(-17,-16) + 数值 @(4,-16) -->
                  <img class="fi-price-bg" :src="img(`cart_price_${row.good.priceTier}`)"
                    :style="pos(36, -16, 148, 28)" alt="" />
                  <img class="fi-price-icon" :src="currencyIcon" :style="pos(-17, -16, 22, 22)" alt="银币" />
                  <span class="fi-price" :style="pos(14, -16, 100, 20)">{{ row.good.price }}</span>

                  <!-- 可买/可卖 -->
                  <em v-if="row.good.buyIn" class="fi-tag fi-tag--buy" :style="pos(96, 22, 34, 16)">买入</em>
                  <em v-if="row.good.sellOut" class="fi-tag fi-tag--sell" :style="pos(96, -2, 34, 16)">卖出</em>
                </div>
              </div>
            </div>
            <div class="freight-list-foot">
              共 {{ rows.length }} 种 · 价格区间 {{ Math.round(market.priceMin * 100) }}%~{{ Math.round(market.priceMax * 100) }}%
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getImageUrl } from '../utils/env'
import { fetchWithFallback } from '../utils/request'
import { UiEmptyState, UiFilterPanel, UiFilterPill, UiFilterRow, UiSearchInput } from '../components/ui/index.js'

/* ── 设计画布（由 prefab 坐标极值推得）── */
const DESIGN_W = 1334
const DESIGN_H = 804

/**
 * prefab 坐标 → CSS 定位。
 * `x/y` 是 prefab 的锚点（元素中心）；`w/h` 是元素尺寸。
 *
 * **必须显式给出 width/height**：绝对定位元素的 `width:auto` 会收缩到内容宽度，
 * 而内容又依赖容器宽度 → 容器塌陷（首版就踩了这个坑：面板宽只剩 20px）。
 */
const pos = (x = 0, y = 0, w = 0, h = 0) => ({
  left: `calc(50% + ${x}px)`,
  top: `calc(50% - ${y}px)`,
  width: `${w}px`,
  height: `${h}px`,
  marginLeft: `${-w / 2}px`,
  marginTop: `${-h / 2}px`
})

const ROW_H = 80          // prefab Grid cell=236×80
const ROW_W = 236
const VISIBLE_BUFFER = 4
const LIST_W = 376
const LIST_H = 560

const stageRef = ref(null)
const listRef = ref(null)
const scale = ref(1)

const goods = ref([])
const market = ref({ priceMin: 0.6, priceMax: 1.4 })
const isDataReady = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const filterMode = ref('all')
const scrollTop = ref(0)

const img = name => getImageUrl(`/images/FreightPanel_Atlas/${name}.webp`)
const currencyIcon = getImageUrl('/images/Common_ItemIcon/item_00001.webp')
const itemIcon = good => getImageUrl(`/images/Common_ItemIcon/${good.img}.webp`)
/** 品质框只做到 6 档（item_f_1..6） */
const frameSrc = good => getImageUrl(`/images/ItemBagPanel/item_f_${Math.min(6, Math.max(1, Number(good.quality) || 1))}.webp`)

const onIconError = e => { e.target.onerror = null; e.target.style.visibility = 'hidden' }

const rows = computed(() => {
  let list = goods.value
  if (filterMode.value === 'buy') list = list.filter(g => g.buyIn)
  else if (filterMode.value === 'sell') list = list.filter(g => g.sellOut)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter(g => `${g.name} ${g.typeId} ${g.tip}`.toLowerCase().includes(q))
  return list
})

const visibleRows = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_H) - VISIBLE_BUFFER)
  const count = Math.ceil((listRef.value?.clientHeight || LIST_H) / ROW_H) + VISIBLE_BUFFER * 2
  return rows.value.slice(start, start + count).map((good, i) => ({ good, index: start + i }))
})

const panelStyle = computed(() => pos(-272, 11, LIST_W, LIST_H))

const canvasStyle = computed(() => ({
  width: `${DESIGN_W}px`,
  height: `${DESIGN_H}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`
}))

function fit() {
  const el = stageRef.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  scale.value = Math.min(w / DESIGN_W, h / DESIGN_H)
}

let observer = null
onMounted(async () => {
  try {
    const data = await fetchWithFallback('data/parsed/freight.json')
    goods.value = data?.goods || []
    market.value = data?.market || market.value
    isDataReady.value = true
    await nextTick()
    fit()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(fit)
      if (stageRef.value) observer.observe(stageRef.value)
    }
    window.addEventListener('resize', fit)
  } catch (err) {
    errorMessage.value = '货运数据加载失败：' + (err?.message || err)
    console.error(err)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', fit)
})
</script>

<style scoped>
.freight-page { display: flex; flex-direction: column; min-height: 0; }

.freight-stage { position: relative; flex: 1; min-height: 420px; overflow: hidden; }
.freight-canvas { position: absolute; left: 50%; top: 50%; transform-origin: center center; }

/* 列表面板：prefab LeftUI/Scroll View @(-272, 11)，376×560 */
.freight-list-panel {
  position: absolute;
  box-sizing: border-box;
  padding: 40px 10px 34px;
  background: url('/images/FreightPanel_Atlas/cart_order_botm.webp') center / 100% 100% no-repeat;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.freight-list-title {
  position: absolute;
  left: 50%;
  top: 6px;
  width: 220px;
  height: 30px;
  margin-left: -110px;
  background: url('/images/FreightPanel_Atlas/cart_title.webp') center / 100% 100% no-repeat;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  line-height: 30px;
  color: #f8eedc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.freight-list-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.freight-list-inner { position: relative; }

/* 单个条目：prefab ItemTemp（Grid cell 236×80），条目盒以「网格单元中心」为锚 */
.freight-item {
  position: absolute;
  left: 50%;
  width: 236px;
  height: 80px;
  margin-left: -118px;
  margin-top: -40px;
}
.freight-item .fi-bg {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 228px;
  height: 72px;
  margin-left: -114px;
  margin-top: -36px;
}
/* 以下元素的位置与尺寸全部由 `pos()` 内联给出，CSS 只管外观 */
.freight-item .fi-frame,
.freight-item .fi-icon,
.freight-item .fi-cnt,
.freight-item .fi-price-bg,
.freight-item .fi-price-icon,
.freight-item .fi-price { position: absolute; }
.freight-item .fi-icon { object-fit: contain; }
.freight-item .fi-cnt {
  font-size: 20px;
  line-height: 20px;
  text-align: center;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
.freight-item .fi-price-icon { object-fit: contain; }
.freight-item .fi-price {
  padding-left: 18px;
  font-size: 20px;
  line-height: 20px;
  color: #f8eedc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  box-sizing: border-box;
}
.fi-tag {
  position: absolute;
  font-size: 12px;
  font-style: normal;
  line-height: 16px;
  text-align: center;
  border-radius: 3px;
  color: #fff;
}
.fi-tag--buy { background: rgba(58, 122, 120, 0.92); }
.fi-tag--sell { background: rgba(150, 96, 40, 0.92); }

.freight-list-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
}
</style>
