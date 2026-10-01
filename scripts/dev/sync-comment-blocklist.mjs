/**
 * 校验评论审核词表与游戏词库一致（**只读，不修改任何文件**）
 *
 * 职责：把 src/config/commentBlocklist.js 里的**类别正则**逐个应用到游戏词库
 * `Config_decrypted/words.json` 上，报告每个类别实际命中多少词、以及覆盖是否异常。
 *
 * 为什么是"校验"而不是"生成"：
 *   类别正则是按低误伤原则人工挑选的（刻意避开单字与日常词），无法自动推导。
 *   本脚本负责反向核对——每个类别在游戏表里究竟筛出哪些词、有没有筛出 0 条的可疑类别。
 *
 * 用法：
 *   node scripts/dev/sync-comment-blocklist.mjs           # 校验 + 统计
 *   node scripts/dev/sync-comment-blocklist.mjs --list    # 额外打印各类别命中的全部词
 *
 * 退出码：
 *   0  正常（含"缺游戏配置目录"的静默跳过——本脚本不参与 npm run verify）
 *   1  某类别命中 0 条（说明正则写错了或游戏表换了），或正则非法
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  BLOCKLIST_CATEGORY_PATTERNS,
  BLOCKLIST_STRUCTURAL_PATTERNS,
  BLOCKLIST_SOURCE,
  matchReview
} from '../../src/config/commentBlocklist.js'

const { values } = parseArgs({ options: { list: { type: 'boolean' } } })
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const configDir = process.env.MYRZG_CONFIG_DIR || join(repoRoot, '..', 'Config_decrypted')
const wordsFile = join(configDir, 'words.json')

if (!existsSync(wordsFile)) {
  console.log(`跳过：未找到游戏词库 ${wordsFile}`)
  console.log('（可用 MYRZG_CONFIG_DIR 指定配置目录；本脚本不参与 verify，跳过不算失败）')
  process.exit(0)
}

const raw = readFileSync(wordsFile, 'utf8').trim()
const gameWords = [...new Set(raw.split(',').map((w) => w.trim()).filter(Boolean))]

console.log(`游戏词库来源: ${BLOCKLIST_SOURCE}`)
console.log(`  共 ${gameWords.length.toLocaleString()} 条\n`)

let failed = 0
const excluded = new Set()
console.log('类别正则覆盖核对：')
for (const [category, re] of Object.entries(BLOCKLIST_CATEGORY_PATTERNS)) {
  let hits
  try {
    hits = gameWords.filter((w) => re.test(w))
  } catch (err) {
    console.log(`  ❌ ${category}: 正则非法 —— ${err.message}`)
    failed++
    continue
  }
  if (hits.length === 0) {
    console.log(`  ❌ ${category}: 命中 0 条（正则写错，或游戏表已更换）`)
    failed++
    continue
  }
  console.log(`  ✅ ${category}: ${hits.length} 条`)
  if (values.list) console.log(`       ${hits.join(' ')}`)
}

// 计算"被排除的日常词"：在游戏表里、但不会被任何类别正则命中
const EXCLUDED_NOTEWORTHY = [
  '比例', '真实', '真相', '购买', '买', '卖', '拍卖', '价格', '善良', '善意', '认真',
  '香港', '港口', '澳门', '西藏', '藏', '毒', '草', '妈', '爸', '爹', '爷', '奶',
  '鸡', '杀', '赌', '兼职', '按摩', '发票', '办证', '银行卡', '诈骗', '草'
]
for (const w of EXCLUDED_NOTEWORTHY) {
  if (gameWords.includes(w) && !matchReview(w).length) excluded.add(w)
}

console.log(`\n结构性规则（本站自加，不来自游戏表）：${BLOCKLIST_STRUCTURAL_PATTERNS.length} 条`)
for (const p of BLOCKLIST_STRUCTURAL_PATTERNS) {
  try {
    new RegExp(p.pattern, 'i')
    console.log(`  · ${p.name} —— ${p.note}`)
  } catch (err) {
    console.log(`  ❌ ${p.name}: 正则非法 —— ${err.message}`)
    failed++
  }
}

console.log(
  `\n刻意排除的高频日常词 ${excluded.size}/${EXCLUDED_NOTEWORTHY.length}（在游戏表里但本站不用，避免误伤）：`
)
console.log('  ' + [...excluded].join(' '))

// 自检：正常图鉴评论必须判为干净
const NORMAL_SAMPLES = [
  '这里的比例不太对，真实伤害应该是 305% 而不是 277%',
  '买菜任务在哪里接？我找了半天没找到那个 NPC',
  '我爸也玩这个游戏，他说爹系角色太少了',
  '香港服务器的玩家能看到这个活动吗',
  '别赌气，我只是问问这个机制怎么算',
  '这个副本推荐等级多少，装备强化到 +7 了还是差点',
  '魔物蛋卖和喂哪个划算？单价 1200 银币'
]
const falsePositives = NORMAL_SAMPLES.map((s) => ({ s, hits: matchReview(s) })).filter((r) => r.hits.length)
console.log(`\n正常评论误伤自检：${falsePositives.length}/${NORMAL_SAMPLES.length}`)
for (const fp of falsePositives) console.log(`  ⚠️ [${fp.hits.join(',')}] ← ${fp.s}`)

// 自检：垃圾样本必须被判为待审
const SPAM_SAMPLES = [
  '加微信 xxxxx 代刷好评',
  '澳门赌场上线啦，点 https://spam.example.com',
  '<script>alert(1)</script>',
  '出售壮阳药，货到付款',
  '办假证 假发票 联系我'
]
const missed = SPAM_SAMPLES.filter((s) => !matchReview(s).length)
console.log(`垃圾样本漏检：${missed.length}/${SPAM_SAMPLES.length}`)
for (const m of missed) console.log(`  ⚠️ 漏检 ← ${m}`)

if (failed || falsePositives.length || missed.length) {
  console.error('\n❌ 校验未通过，请修正 src/config/commentBlocklist.js')
  process.exit(1)
}

console.log('\n✅ 校验通过：类别正则覆盖正常、正常评论零误伤、垃圾样本全部命中。')
