# 符石图鉴

入口 `/runes`，包含列表、鉴定、合成；静态图鉴与本地鉴定模拟不连接账号、不实际消耗材料。图片复用 `Common_ItemIcon`。

## 数据与职责

| 内容 | 正式关系 | 游戏依据 |
| --- | --- | --- |
| 效果和部位 | `item → equipEnchant → skillTrigger.levelData` | `EquipFuMoUI` |
| 镶嵌费用 | `equipEnchant.consume → consume` | `EquipFuMoUI.FumoBack` |
| 鉴定 | `item.useAction=appraisal → useActionPara.reward/consume` | `ItemUseTip`、`BackpackServerData` |
| 合成 | `fushi_itemExchangeMapping → itemExchange → reward/consume` | `FumoItemInfo`、`EquipFuMoExchangeUI` |

`scripts/parse/runes.mjs → runeData → parsed/runes.json` 构建与校验；浏览器不加载 raw。缺少效果、费用、奖励引用或非同系升一级映射应报错，不能按相邻 ID 猜。可见性复用 hide、黑名单和正式兑换映射；最高级无后继方案，未使用符石不进入页面。

- `buildRuneEffect` 是唯一效果实现，物品详情经 `itemParser.parseRuneEffect` 适配；部位名和高亮使用共享工具。
- 鉴定与合成使用 [统一奖励规则](../../technical/ACQUISITION_RULES.md)，鉴定展示复用 `AcquisitionRewards`，合成卡消费 `plan.acquisition/input/output.effect`。
- 搜索合并 `buildRuneData.sources` 的 `runeAppraisal/runeSynthesis`，只替换同输出、同兑换 ID 的重复 Gem 来源。符石沿用物品搜索索引，兑换页不重复展示 Gem；旧 `cat=gem` 回落有效分类，原始合成表仍保留。

## 定位协议

| 入口 | query |
| --- | --- |
| 符石列表 | `tab=runes&focus=<物品ID>` |
| 鉴定 | `tab=appraisal&id=<未鉴定物品ID>&count=1..999` |
| 合成 | `tab=synthesis&id=<兑换ID>`，不能假定等于产物 ID |
| 列表/合成筛选 | `q/level/position`，合成按产物筛选 |
| 物品详情 | 保留 query，追加 `itemId` |

来源用 `getRuneSourceTarget` 定位，`getRuneItemTarget` 保留为工具，不恢复物品详情内重复导航按钮。前进后退以 URL 为准，切页签清理不适用筛选，详情返回保留筛选和方案。

## 鉴定与合成

- 鉴定次数为 1～999；“选择其他”展开其他方案，选中后收起。显示最近一批结果并合并同名符石；修改次数不改旧结果标题，重新鉴定替换结果，换方案/页签清空，详情返回保留。
- `runeAppraisal.appraiseRunes` 逐次独立、有放回地按配置权重抽取，不添加保底。只支持已核对的单组必触发、单次单件结构，其他结构报错。客户端 `ItemBagMsg → ItemRouterUseItem` 请求服务器并接收奖励，现有证据不能证明服务器随机数、批量处理或隐藏保底，不能声称复刻服务器算法。
- 概率格式统一由 `formatRewardProbability` 控制，展示近似值不参与抽样；批量只放大费用和抽取次数，不生成未经确认的累计概率。历史逐项权重核对见 [2026-09-09 日志](../../dev-logs/2026-09/2026-09-09.md)。
- 合成只展示单次正式材料与费用，旧 `count` 不生效；输入/输出沿映射校验同系升一级，不手抄费用或以物品名推测。来源指定方案排首位并高亮，避免分页后不可定位。

## 布局与回归

搜索、页签、筛选、计数按顺序排列；筛选作为页面根直接子元素，纸色只放正文。切换用 `resolveScrollTarget` 重置真实滚动根。鉴定的操作栏手机独占一行、靠左；概率/结果/选择区手机两列，合成桌面两列、手机一列。图标与材料可打开详情，不重复放置多余操作按钮。

验证入口：`tests/unit/runes.test.mjs`、`tests/unit/rune-appraisal.test.mjs`、`tests/unit/acquisition-rules.test.mjs`、`tests/ui/runes.spec.js`。检查映射、顶级边界、批量/概率、来源去重、筛选、鉴定结果返回与加载失败；实际结果写当日日志，历史通过项不代替当前回归。
