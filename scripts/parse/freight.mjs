/**
 * 货运/贸易小车预解析：public/data/parsed/freight.json
 *
 * 数据来源（原表）：
 *   - `market.json`  —— 市场商品（51 条）：基础价、库存上限、补货、可买可卖
 *   - `newOrder.json`—— 委托订单（40 条）：NPC 要什么货、报酬
 *   - `item.json`    —— 物品名/图标/品质
 *
 * 本次只做「左侧物品列表 + 价格」所需的部分（用户要求先做这块）：
 *   - market 商品清单（含价格档位判定）
 *   - 标量配置（价格区间/刷新间隔/超重系数）
 * 订单部分一并透传（后续要做订单页时直接用）。
 *
 * 价格档位（照抄 `FreightMarketItemTemp.cs` 的判定，5 档）：
 *   step = (priceMax - priceMin) / 5
 *   priceScale > priceMin + step*4 → max；> +3 → high；> +2 → ori；> +1 → low；否则 min
 *   （priceScale = 当前价 / basePrice）
 */
import { readJson } from './shared.mjs'

const table = value => value?.datas || value || {}

/** 物品表索引：typeId → { name, img, quality } */
function buildItemIndex() {
  const items = table(readJson('item.json'))
  const index = new Map()
  for (const [typeId, entry] of Object.entries(items)) {
    index.set(typeId, {
      name: entry.name || typeId,
      img: entry.img || typeId,
      quality: Number(entry.quality) || 1,
      desc: entry.des || ''
    })
  }
  return index
}

/** 按源码判定价格档位，返回 sprite 名后缀 */
function priceTier(priceScale, priceMin, priceMax) {
  const step = (priceMax - priceMin) / 5
  if (priceScale > priceMin + step * 4) return 'max'
  if (priceScale > priceMin + step * 3) return 'high'
  if (priceScale > priceMin + step * 2) return 'ori'
  if (priceScale > priceMin + step * 1) return 'low'
  return 'min'
}

export function buildFreightFile() {
  const market = table(readJson('market.json'))
  const orders = table(readJson('newOrder.json'))
  const items = buildItemIndex()

  const priceMin = Number(market.priceMin) || 0.6
  const priceMax = Number(market.priceMax) || 1.4

  const goods = []
  for (const [typeId, conf] of Object.entries(market.goods || {})) {
    const info = items.get(typeId) || { name: typeId, img: typeId, quality: 1, desc: '' }
    const basePrice = Number(conf.basePrice) || 0
    // 网页版不连服务器，`priceScale` 固定为 1（= 基准价），故档位恒为 ori。
    // 保留字段与判定函数，将来若做本地价格模拟只需填真实 priceScale。
    const priceScale = 1
    goods.push({
      typeId,
      name: info.name,
      img: info.img,
      quality: info.quality,
      desc: info.desc,
      basePrice,
      price: basePrice,
      priceScale,
      priceTier: priceTier(priceScale, priceMin, priceMax),
      maxNum: Number(conf.maxNum) || 0,
      addNum: Number(conf.addNum) || 0,
      addTime: Number(conf.addTime) || 0,
      buyIn: conf.buyIn !== false,
      sellOut: conf.sellOut !== false,
      taskTypeId: conf.taskTypeId || '',
      tip: conf.tip || ''
    })
  }
  // 稳定排序：按基础价降序（贵的在前），同价按 typeId
  goods.sort((a, b) => (b.basePrice - a.basePrice) || a.typeId.localeCompare(b.typeId))

  const orderList = []
  for (const [orderTypeId, conf] of Object.entries(orders.goods || {})) {
    orderList.push({
      orderTypeId,
      name: conf.name || orderTypeId,
      chance: Number(conf.chance) || 0,
      baseValue: Number(conf.baseValue) || 0,
      orderValue: Number(conf.orderValue) || 0,
      charaText: conf.charaText || '',
      charaImg: conf.charaImg || '',
      taskTypeId: conf.taskTypeId || '',
      tip: conf.tip || '',
      items: (conf.items || []).map(it => ({
        typeId: it.typeId,
        num: Number(it.num) || 0,
        name: (items.get(it.typeId) || {}).name || it.typeId,
        img: (items.get(it.typeId) || {}).img || it.typeId
      }))
    })
  }

  return {
    file: 'parsed/freight.json',
    data: {
      schemaVersion: 1,
      modelVersion: 'config-v1',
      market: {
        priceMin,
        priceMax,
        priceInterval: Number(market.priceInterval) || 1800,
        priceOverScale: Number(market.priceOverScale) || 0.5,
        priceRandomArea: Number(market.priceRandomArea) || 0.45,
        priceRandomMaxChange: Number(market.priceRandomMaxChange) || 0.1,
        desc: market.desc || '',
        weightDesc: market.weightDesc || '',
        tip: market.tip || ''
      },
      order: {
        orderNumMax: Number(orders.orderNumMax) || 0,
        orderTimeSeconds: Number(orders.orderTimeSeconds) || 0,
        orderDailyTarget: orders.orderDailyTarget ?? null,
        priceTip: orders.priceTip || ''
      },
      goods,
      orders: orderList
    }
  }
}
