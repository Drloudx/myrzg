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
 */
import { readJson } from './shared.mjs'

const PASSTHROUGH = [
  'menu.json',
  'diary.json',
  'monLevelStrength.json',
  'pet.json'
]

export function build() {
  return {
    files: PASSTHROUGH.map(name => ({ file: `parsed/${name}`, data: readJson(name) }))
  }
}
