/**
 * 招募页货币条与抽取消耗的共享构建器。
 *
 * 卡池列表页（HeroPoolPanel）与招募结果一览（HeroShowPanel）的右上角货币条、
 * 单抽/十连按钮消耗行共用同一套规则，禁止两个面板各自维护一份：
 *   - 货币名称与图标一律取公共 `gameMappings.BASE_REWARD_*`（DRY 红线），消耗券取卡池 `costs[0]`；
 *   - 货币条槽位遵循 `HeroPoolUI.InitRight`：角色池与卡池名含「特别」的池（不分角色/蛋池）
 *     显示 消耗券/氪金/神晶，普通蛋池显示 消耗券/银币；
 *   - 按钮消耗行遵循 `HeroPoolUI.InitRight` 与 `HeroShowUI.SetPoolButtonConsume`：
 *     `[券] ×N 或 [货币] ×M`，替代消耗来自 `para.gachaTicketsExchangeRate`，十连自动 ×10。
 * 数值都是**本地模拟持有量**（`stores/gachaState.js` 的钱包），不是账号数据。
 */
import { BASE_REWARD_ICONS, BASE_REWARD_NAMES, BASE_REWARD_PATHS } from './gameMappings'

/** 从公共映射取货币的名称与图标路径。 */
function rewardMeta(mode) {
  return {
    typeId: BASE_REWARD_ICONS[mode],
    name: BASE_REWARD_NAMES[mode],
    icon: BASE_REWARD_PATHS[mode]
  }
}

/** 货币槽：只展示持有量，不显示单价（银币/氪金/神晶不是本次消耗）。 */
function tipSlot(key, base, offsetX, hold) {
  return {
    key,
    typeId: base.typeId,
    icon: base.icon,
    name: base.name,
    offsetX,
    wide: true,
    hold,
    need: 0,
    enough: true
  }
}

/**
 * 货币条槽位。
 * 位置遵循 `HeroPoolUI`：角色池与「特别」池 = 消耗券 `tipPosX[0]`=-304、氪金 -152、神晶 +17；
 * 普通蛋池 = 消耗券 `tipPosX[3]`=**-116**、银币 `PoolUiTitle` 的 `tipPosX[4]`=**+35**。
 */
export function buildCurrencySlots(pool, wallet, kind) {
  const cost = pool?.costs?.[0] ?? null
  const unit = Number(cost?.count) || 0
  const heroKind = kind === 'hero'
  const money = rewardMeta('money')
  const ke = rewardMeta('ke')
  const payKe = rewardMeta('payKe')
  // 源码 `HeroPoolUI.InitRight`：卡池名含「特别」时（不分角色/蛋池）按角色池槽位排布。
  const isSpecial = String(pool?.name ?? '').includes('特别')
  const hold = Number(wallet?.[cost?.typeId]) || 0
  const ticket = {
    key: 'item',
    typeId: cost?.typeId ?? '',
    icon: cost?.icon ?? '',
    name: cost?.name ?? '消耗道具',
    offsetX: heroKind || isSpecial ? -304 : -116,
    wide: false,
    hold,
    need: unit,
    enough: hold >= unit
  }
  const keHold = Number(wallet?.[ke.typeId]) || 0
  const payKeHold = Number(wallet?.[payKe.typeId]) || 0
  const moneyHold = Number(wallet?.[money.typeId]) || 0
  return heroKind || isSpecial
    ? [ticket, tipSlot('ke', ke, -152, keHold), tipSlot('payKe', payKe, 17, payKeHold)]
    : [ticket, tipSlot('coin', money, 35, moneyHold)]
}

/**
 * 单抽 / 十连的消耗与按钮信息。
 *   - 券：`consume.items[0]`，数量 ×N，持有不足时 `enough=false`（展示层用危险色，对应 `WithColor(7)`）；
 *   - 替代：`para.gachaTicketsExchangeRate` 存在时返回 `exchange`（「或 [货币] ×M」），十连 ×10。
 * `offsetX` 为相对 Buttons(400,-340) 的按钮偏移：One (-204)、Ten (+87)。
 */
export function buildDrawOptions(pool, wallet, kind) {
  const cost = pool?.costs?.[0] ?? null
  const unit = Number(cost?.count) || 0
  const heroKind = kind === 'hero'
  const hold = Number(wallet?.[cost?.typeId]) || 0
  const ticketIcon = cost?.icon ?? ''
  const alternative = pool?.exchangeCosts?.gachaTicketsExchangeRate?.[0] ?? null
  const build = (count) => ({
    count,
    offsetX: count === 1 ? -204 : 87,
    label: count === 1 ? (heroKind ? '招募一次' : '购买一次') : (heroKind ? '招募十次' : '购买十次'),
    enabled: unit > 0 && hold >= unit * count,
    ticket: {
      icon: ticketIcon,
      text: `×${unit * count}`,
      enough: hold >= unit * count
    },
    exchange: alternative
      ? {
        icon: alternative.icon,
        text: `×${(Number(alternative.count) || 0) * count}`
      }
      : null
  })
  return [build(1), build(10)]
}
