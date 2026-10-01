/**
 * 评论审核词表（唯一来源，被 functions/api/[[path]].js 直接 import）
 *
 * ## 来源
 * 按类别从游戏聊天风控词库筛选：`../Config_decrypted/words.json`
 * （约 14,078 条，逗号分隔的单个字符串）
 *
 * ## 为什么不整表同步（2026-10-01 实测，依据 docs/technical/COMMENTS_BACKEND.md）
 * 1. **误伤**：游戏表含大量日常词——比例、真实、购买、买菜、我爸、炸鸡、善良、香港、港口…
 *    整表导入会让正常图鉴讨论全部进待审。
 * 2. **性能**：Workers 免费版只有 10ms CPU/次调用。本地实测每条评论：
 *    全表扫描 0.82ms / 筛后词表+首字索引 0.024ms / **本文件的类别正则 0.0040ms**。
 *
 * ## 表示法：类别正则（而不是逐词表）
 * 实测正则比 97 条逐词匹配快 6 倍，且维护面小。每个模式都刻意避开单字与日常词，
 * 例如【赌博】收 `赌博/赌场/赌球/下注/博彩`，不收单字 `赌`（否则「别赌气」会被拦）。
 *
 * ## 刻意排除的日常词（在游戏表里，但本站不用）
 * `发票`、`办证`、`银行卡`、`诈骗`、`兼职`、`按摩`、`比例`、`真实`、`购买`、`买菜`、
 * `我爸`、`炸鸡`、`善良`、`香港`、`港口`、`毒`、`草`、`杀`（多为单字，误伤极高）
 *
 * ## 命中后的语义是「进待审（status=0）」，不是拒收
 * 误伤的内容不会丢，管理员在管理页面一键放行。
 */

export const BLOCKLIST_SOURCE = 'Config_decrypted/words.json'

/**
 * 分类正则 → 命中即进待审。
 * 键名会作为「命中原因」显示在管理页面，便于你判断是误伤还是真垃圾。
 */
export const BLOCKLIST_CATEGORY_PATTERNS = {
  赌博: /赌博|赌场|赌球|赌马|赌具|赌币|赌盘|赌网|轮盘赌|在线赌钱|下注|博彩|百家乐|棋牌|彩票|时时彩|六合彩|老虎机|筹码/,
  色情: /卖淫|嫖娼|嫖客|嫖资|嫖鸡|援交|约炮|色情|情色|裸聊|成人电影|成人网站|嫩模|外围女|楼凤|桑拿技师|qvod|买春|招妓/,
  违禁药: /毒品|冰毒|大麻|摇头丸|迷药|吗啡|杜冷丁|三唑仑|咪达唑仑|氯硝安定|氟硝安定|麻黄碱|曲马多|氯尼他秦|伟哥|万艾可|西地那非|壮阳|男根|延时丸|延时液|催情/,
  违禁品: /枪支|弹药|炸药|管制刀具|仿真枪|手雷/,
  诈骗: /办假证|假证|洗钱|钓鱼网站/,
  引流: /加微信|加qq|私聊|薇信|威信|代刷|刷单|兼职刷|网络炒作|扫码进群/,
  政治敏感: /法轮|台独|港独|藏独|疆独|颠覆中国政权|和平演变|一中一台|反共|六四/
}

/**
 * 结构性规则（不来自游戏表，本站自加）。
 * 用字符串而非 RegExp 字面量，便于将来移到后台编辑。
 */
export const BLOCKLIST_STRUCTURAL_PATTERNS = [
  { name: '外链', pattern: 'https?://', note: '图鉴讨论不需要外链，广告的主要形态' },
  {
    name: 'HTML 标签',
    pattern: '<\\s*/?\\s*[a-zA-Z][^>]*>',
    note: '本站一律按纯文本渲染，出现标签基本是攻击或粘贴垃圾'
  }
]

/** 预编译正则，避免在请求热路径上重复构造 */
const COMPILED = Object.entries(BLOCKLIST_CATEGORY_PATTERNS).map(([name, re]) => ({ name, re }))
const COMPILED_STRUCTURAL = BLOCKLIST_STRUCTURAL_PATTERNS.map((p) => ({
  name: p.name,
  re: new RegExp(p.pattern, 'i')
}))

/**
 * 判断文本是否应进待审。
 * 返回命中的来源名数组（类别名/结构性规则名）；空数组表示干净。
 *
 * 性能：约 0.0040ms/条（本地实测），远低于免费版 10ms CPU 预算。
 */
export function matchReview(text) {
  const hits = []
  if (!text) return hits
  for (const { name, re } of COMPILED) if (re.test(text)) hits.push(name)
  for (const { name, re } of COMPILED_STRUCTURAL) if (re.test(text)) hits.push(name)
  return hits
}
