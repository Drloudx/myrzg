/**
 * 卡池数据（模拟招募页）。
 *
 * 结构说明：`parsed/gacha.json` 的候选池、星级权重与保底次数来自历史上游的重数据产物，
 * 数量大且与 `item-sources` 等既有产物同源，本模块**不重新生成这部分**，只做增量附加：
 * 从 `raw/heroPool.json`、`raw/petPool.json`、`raw/heroPoolTime.json`、`raw/petPoolTime.json`
 * 补上页面展示所需的原表字段（概率说明 `percTip`、指定伙伴 `upTypes`、礼包入口
 * `packDisplay`、兑换汇率 `para`、开放说明与卡池按钮贴图）。
 *
 * 这样做的原因：`percTip` 是官方概率文案（含 `{5星}`、`{rare5List}` 等占位符，由页面按
 * 游戏 `HeroPoolTips.GetFormatRaceStr` 的规则替换），网页不能自行编造概率说明；
 * 同时避免在浏览器端加载 `heroPool.json` 等原始表。
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parsedDir, readJson } from './shared.mjs'

const file = 'gacha.json'

/** 读取既有产物；缺失或损坏时返回空结构，由页面显示错误态而不是编造数据。 */
function readExisting(target) {
  if (!existsSync(target)) return null
  try {
    const data = JSON.parse(readFileSync(target, 'utf8'))
    if (data && Array.isArray(data.pools)) return data
  } catch {}
  return null
}

/**
 * 原表卡池配置索引：key = `${kind}:${poolTypeId}`。
 * `kind` 与解析产物的 `pool.kind` 一致（hero / pet）。
 */
function collectPoolMeta() {
  const meta = new Map()
  const collect = (poolsTable, timeTable, kind) => {
    for (const [poolTypeId, conf] of Object.entries(poolsTable?.datas ?? {})) {
      meta.set(`${kind}:${poolTypeId}`, { conf, time: null })
    }
    for (const [slotId, slot] of Object.entries(timeTable?.datas ?? {})) {
      for (const team of slot.heroTeam ?? []) {
        const entry = meta.get(`${kind}:${team.poolTypeId}`)
        if (!entry) continue
        entry.time = { ...team, slotId, slotDesc: slot.desc ?? '', open: Boolean(slot.open) }
      }
    }
  }
  collect(readJson('heroPool.json'), readJson('heroPoolTime.json'), 'hero')
  collect(readJson('petPool.json'), readJson('petPoolTime.json'), 'pet')
  return meta
}

/**
 * 新号初始持有（`raw/playerInit.json`）：`money/ke/payKe` 为初始货币量，
 * `initItems` 为初始道具（含卡池消耗券，如 `item_20025` 普通招待券）。
 * 页面用它作为**模拟钱包的起算值**——原表只定义「初始配置量」，不代表账号当前库存。
 */
function collectInitialWallet() {
  const init = readJson('playerInit.json') ?? {}
  return {
    money: Number(init.money) || 0,
    ke: Number(init.ke) || 0,
    payKe: Number(init.payKe) || 0,
    ti: Number(init.ti) || 0,
    items: (Array.isArray(init.initItems) ? init.initItems : [])
      .filter(entry => entry?.itemTypeId)
      .map(entry => ({ typeId: String(entry.itemTypeId), count: Number(entry.num) || 0 }))
  }
}

/** 把原表展示字段附加到已有卡池条目上；匹配不到的池保持原样，不丢弃。 */
function attachPoolMeta(pool, meta) {
  const entry = meta.get(`${pool.kind}:${pool.poolTypeId}`)
  if (!entry) return pool
  const { conf, time } = entry
  return {
    ...pool,
    des: conf.des ?? '',
    percTip: conf.percTip ?? '',
    upTypes: Array.isArray(conf.upTypes) ? conf.upTypes : [],
    packDisplay: conf.packDisplay ?? '',
    rewardId: conf.reward ?? '',
    consumeId: conf.consume ?? '',
    para: conf.para ?? {},
    typeGuaranty: conf.typeGuaranty ?? null,
    open: time ? time.open : true,
    slotDesc: time?.slotDesc ?? '',
    assets: {
      ...pool.assets,
      coverSprite: time?.img ?? pool.assets?.coverSprite,
      titleSprite: time?.imgTitle ?? pool.assets?.titleSprite
    }
  }
}

export function buildGachaFile() {
  const target = join(parsedDir, file)
  const existing = readExisting(target)
  if (!existing) {
    return { file, data: { schemaVersion: 1, modelVersion: 'config-v1', pools: [] } }
  }
  const meta = collectPoolMeta()
  const pools = existing.pools.map(pool => attachPoolMeta(pool, meta))
  return { file, data: { ...existing, initialWallet: collectInitialWallet(), pools } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = buildGachaFile()
  mkdirSync(parsedDir, { recursive: true })
  writeFileSync(join(parsedDir, output.file), JSON.stringify(output.data), 'utf8')
  const withTip = output.data.pools.filter(pool => pool.percTip).length
  console.log(`gacha.json: ${output.data.pools.length} pools（含概率说明 ${withTip}）`)
}
