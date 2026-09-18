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

    <!--
      货运面板「左侧物品列表 + 价格」复刻。

      布局：内容区**铺满**导航与右栏之间的可用区域（首版死套 prefab 的固定画布
      1334×804 等比缩放，结果面板只占中间一小块、内容挤成一团，已废弃该做法）。

      虚拟化复用项目通用的 `UiVirtualGrid`（内部走 @tanstack/vue-virtual），
      与家具图鉴/物品图鉴一致，不再自己实现滚动与裁剪。

      视觉元素全部取自 prefab（NGUI 原始坐标换算的尺寸比例）：
        面板底 cart_order_botm、标题 cart_title、条目底 cart_num、
        品质框 item_f_1..6、价格底 cart_price_{tier}、货币图标 item_00001。
    -->
    <div v-else class="freight-body">
      <div class="freight-panel">
        <div class="freight-panel__title">货物行情</div>

        <!-- 包一层用于量取「列表可用高度」（见 gridHeight 注释） -->
        <div ref="listWrapRef" class="freight-list-wrap">
          <UiVirtualGrid
            id="freightScroll"
            ref="gridEl"
            class="freight-grid"
            :items="rows"
            item-key="typeId"
            :estimate-size="104"
          >
          <template #default="{ item }">
            <div class="freight-item" :data-item-id="item.typeId">
              <img class="fi-bg" :src="img('cart_num')" alt="" />

              <!-- 物品框 + 图标（prefab：框 76×76，图标约占框内 82%） -->
              <span class="fi-cell">
                <img :src="frameSrc(item)" class="fi-frame" :alt="item.name" loading="lazy" />
                <img :src="itemIcon(item)" class="fi-icon" :alt="item.name" loading="lazy" @error="onIconError" />
              </span>

              <span class="fi-main">
                <strong class="fi-name" :class="`quality-text-${item.quality}`">{{ item.name }}</strong>
                <span class="fi-sub">
                  <span class="fi-cnt">库存 {{ item.maxNum }}</span>
                  <em v-if="item.buyIn" class="fi-tag fi-tag--buy">买入</em>
                  <em v-if="item.sellOut" class="fi-tag fi-tag--sell">卖出</em>
                </span>
              </span>

              <!-- 价格：底图按档位换色 + 银币图标 + 数值（prefab 顺序：图标在数值左侧） -->
              <span class="fi-price-wrap">
                <img class="fi-price-bg" :src="img(`cart_price_${item.priceTier}`)" alt="" />
                <img class="fi-price-icon" :src="currencyIcon" alt="银币" />
                <span class="fi-price">{{ item.price }}</span>
              </span>
            </div>
          </template>
          <template #empty>
            <UiEmptyState text="未找到符合条件的货物" />
          </template>
          </UiVirtualGrid>
        </div>

        <div class="freight-panel__foot">
          共 {{ rows.length }} 种货物 · 价格区间 {{ Math.round(market.priceMin * 100) }}%~{{ Math.round(market.priceMax * 100) }}%
          <span class="freight-panel__hint">（价格为基准价，未做波动模拟）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getImageUrl } from '../utils/env'
import { fetchWithFallback } from '../utils/request'
import {
  UiEmptyState, UiFilterPanel, UiFilterPill, UiFilterRow, UiSearchInput
} from '../components/ui/index.js'
// UiVirtualGrid 未从 ui/index.js 导出，与家具图鉴/物品图鉴一致直接引组件
import UiVirtualGrid from '../components/ui/UiVirtualGrid.vue'

const goods = ref([])
const market = ref({ priceMin: 0.6, priceMax: 1.4 })
const isDataReady = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const filterMode = ref('all')

const img = name => getImageUrl(`/images/FreightPanel_Atlas/${name}.webp`)
const currencyIcon = getImageUrl('/images/Common_ItemIcon/item_00001.webp')
const itemIcon = good => getImageUrl(`/images/Common_ItemIcon/${good.img}.webp`)
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

/**
 * 网格高度约束。
 *
 * 为什么这么绕：项目全局有 `transition: all`，实测**不带 `!important` 的
 * `max-height` 会被吃掉**（内联 style 明明写着 `max-height: 624px`，
 * `getComputedStyle` 却返回 `none`、高度仍按内容撑开）；
 * 注入 `!important` 后立刻生效（h 2760 → 400 且可滚动）。
 * Vue 的 `:style` 绑定加不了 `!important`，故用 ref + `setProperty(..., 'important')`。
 */
const gridEl = ref(null)
const listWrapRef = ref(null)

function measure() {
  const wrap = listWrapRef.value
  // `gridEl` 绑定的是 UiVirtualGrid 组件实例；若尚未挂载则跳过（onMounted 后会再试一次）
  const grid = gridEl.value?.$el || gridEl.value
  if (!wrap || !grid || typeof grid.style?.setProperty !== 'function') return
  const top = wrap.getBoundingClientRect().top
  const h = Math.max(320, Math.round(window.innerHeight - top - 24))
  grid.style.setProperty('max-height', `${h}px`, 'important')
  grid.style.setProperty('overflow-y', 'auto', 'important')
  grid.style.setProperty('min-height', '0', 'important')
}

let observer = null
onMounted(async () => {
  try {
    const data = await fetchWithFallback('data/parsed/freight.json')
    goods.value = data?.goods || []
    market.value = data?.market || market.value
    isDataReady.value = true
    await nextTick()
    // 等一帧确保 v-else 分支的子组件已挂载，ref 才拿得到
    requestAnimationFrame(() => {
      measure()
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(measure)
        if (listWrapRef.value) observer.observe(listWrapRef.value)
      }
    })
    window.addEventListener('resize', measure)
  } catch (err) {
    errorMessage.value = '货运数据加载失败：' + (err?.message || err)
    console.error(err)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.freight-page { display: flex; flex-direction: column; min-height: 0; }

/* 内容区：铺满「导航与右栏之间」的可用区域 */
.freight-body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 12px;
  box-sizing: border-box;
}
.freight-panel {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 46px 14px 34px;
  /*
   * 面板底：游戏原图 `cart_order_botm` 是 376×280 的九宫格，只够小面板用；
   * 本页列表区远大于它，无论 `background-size:100% 100%`（拉伸变形）
   * 还是 border-image 九宫格（边角错位成斜向明暗）都会失真。
   * 故这里用**半透明羊皮纸底**保证可读性，不硬套小尺寸切图。
   */
  background: rgba(214, 200, 172, 0.94);
  border: 1px solid rgba(120, 96, 64, 0.5);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px rgba(255, 245, 225, 0.35), 0 4px 14px rgba(40, 28, 16, 0.22);
}
.freight-panel__title {
  position: absolute;
  left: 50%;
  top: 10px;
  width: 240px;
  height: 30px;
  margin-left: -120px;
  text-align: center;
  font-size: 19px;
  font-weight: 700;
  line-height: 30px;
  letter-spacing: 2px;
  color: #4a3418;
  text-shadow: 0 1px 0 rgba(255, 248, 232, 0.6);
  z-index: 1;
}
.freight-panel__title::before,
.freight-panel__title::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 56px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(120, 96, 64, 0.55));
}
.freight-panel__title::before { left: -8px; }
.freight-panel__title::after { right: -8px; transform: scaleX(-1); }

/*
 * 高度约束：`.app-main` 是 `height:100% + overflow:hidden`，但项目里
 * 家具/物品图鉴页同样是「页面被内容撑高、由外层 .app-container 滚动」的模式
 * （实测家具页 7529px）。本页内容只有 51 条，撑高后会把面板标题顶出视口，
 * 故这里给滚动容器**显式 max-height**，让列表在面板内滚动、整页不再被顶开。
 */
.freight-grid { flex: 1; min-height: 0; max-height: calc(100vh - 300px); }
.freight-grid :deep(.ui-card-grid) {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 8px 12px;
  align-content: start;
}

/* 单个货物条目：左侧物品框 + 中间名称/库存 + 右侧价格 */
.freight-item {
  position: relative;
  height: 88px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 6px;
  box-sizing: border-box;
}
/*
 * 条目底图：原图 `cart_num` 只有 28×28，游戏 prefab 把它**自己拉成 148×28**
 * （横向 5.3 倍）——复刻过来就是变形的观感。这里不再使用该图，
 * 改用温和的行底（圆角 + 半透明）做视觉分隔，避免任何拉伸。
 */
.freight-item .fi-bg {
  position: absolute;
  inset: 3px 0;
  width: 100%;
  height: auto;
  border-radius: 6px;
  background: rgba(255, 250, 238, 0.42);
  box-shadow: inset 0 0 0 1px rgba(140, 116, 84, 0.18);
}
.freight-item > *:not(.fi-bg) { position: relative; }

.fi-cell {
  position: relative;
  flex: 0 0 auto;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fi-frame { width: 76px; height: 76px; display: block; }
.fi-icon {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 58px;
  height: 58px;
  margin-left: -29px;
  margin-top: -29px;
  object-fit: contain;
}

.fi-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.fi-name {
  font-size: 16px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fi-sub { display: flex; align-items: center; gap: 6px; }
.fi-cnt {
  font-size: 14px;
  line-height: 18px;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
.fi-tag {
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
  padding: 0 5px;
  border-radius: 3px;
  color: #fff;
  white-space: nowrap;
}
.fi-tag--buy { background: rgba(58, 122, 120, 0.92); }
.fi-tag--sell { background: rgba(150, 96, 40, 0.92); }

/*
 * 价格：底图 `cart_price_*` 原图 64×28，而内容（银币图标 20 + 三位数价格）约 100px，
 * 按原宽显示会裁掉右侧。这里只做**适度**横向铺满（约 1.5 倍，远小于游戏 prefab
 * 自身把它拉到 148px 的 2.3 倍），纵向保持 28px 不变，避免明显变形。
 */
.fi-price-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 104px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fi-price-bg {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 28px;
}
.fi-price-icon { position: relative; width: 20px; height: 20px; object-fit: contain; }
.fi-price {
  position: relative;
  padding-left: 4px;
  font-size: 18px;
  line-height: 20px;
  color: #f8eedc;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}

.freight-panel__foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted, #6b5134);
}
.freight-panel__hint { opacity: 0.75; }
</style>
