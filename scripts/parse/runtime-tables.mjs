/**
 * 运行时小表透传：把 raw/ 里由组件直接 fetch 的运行时表透传为 parsed/ 产物，
 * 使浏览器运行时零 public/data 根目录原始表 fetch（只消费 parsed/）。
 * 这些表本就以最终运行形态存放于 raw/（无预处理），透传保持内容一致。
 *
 * 产物（均为透传，内容与原 raw/ 表完全一致）：
 *   parsed/menu.json             — 物品/料理详情弹窗（menuRes.datas）
 *   parsed/diary.json            — 物品详情 书籍/日记文本（taskMain/taskSub/word/book）
 *   parsed/monLevelStrength.json — 怪物详情 等级滑块（datas.monLevelStrength）
 *   parsed/pet.json              — 魔物蛋页 原始回退（datas）
 *   parsed/petSetting.json       — 育室槽位消耗（奖励页只需 petSetting，避免为此加载整张 parsed/pets.json）
 */
import { readJson } from './shared.mjs'

/** `source` 相对 raw/（readJson 在 raw/ 缺失时兜底 public/data），`file` 相对 parsed/。 */
const PASSTHROUGH = [
  { source: 'menu.json', file: 'menu.json' },
  { source: 'diary.json', file: 'diary.json' },
  { source: 'monLevelStrength.json', file: 'monLevelStrength.json' },
  { source: 'pet.json', file: 'pet.json' },
  { source: 'pet/petSetting.json', file: 'petSetting.json' }
]

export function build() {
  return {
    files: PASSTHROUGH.map(({ source, file }) => ({ file: `parsed/${file}`, data: readJson(source) }))
  }
}
