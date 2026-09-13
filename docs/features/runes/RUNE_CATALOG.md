# 符石图鉴（rune-appraisal）

## 范围

入口 `/runes`，完整导航中位于装备图鉴后。包含「符石列表 / 鉴定 / 合成」，不是仅有鉴定的独立页。列表展示 114 枚正式符石（19 系、每系 I 至 VI 级），9 类鉴定物品、95 个合成方案；提供效果搜索、等级与部位筛选，点击符石图标打开物品详情。列表不重复放置「查看详情」「合成下一级」按钮，合成从页签或物品来源进入。

不实现账号背包或实际消耗，不发送游戏请求；次数用于计算批量材料、银币和产出，以及按配置权重模拟鉴定。图片沿用 `public/images/Common_ItemIcon` 游戏原图，未新增、压缩或替换素材。

筛选区顺序固定为搜索栏、页签、等级/部位筛选、数量；计数与事件/兑换页保持 13px、600 字重和 `--text-muted`。纸色背景仅放在公共裁剪的正文容器，页面根保持透明，避免桌面吸顶后顶部 33px 留白露出实色条。切换页签或定位符石时通过 `resolveScrollTarget` 重置实际滚动根：桌面为 `.app-container`，手机为列表容器。

## 数据与源码依据

| 内容 | 正式关系 | 客户端依据 |
| --- | --- | --- |
| 符石效果与部位 | `item → equip/equipEnchant → skillTrigger.levelData` | `EquipFuMoUI.cs` 使用 position 限制装备部位 |
| 镶嵌费用 | `equipEnchant.consume → consume` | `EquipFuMoUI.FumoBack()` 的装备镶嵌消耗 |
| 鉴定 | `item.useAction=appraisal → useActionPara.reward/consume → reward/consume` | `ItemUseTip.cs`、`BackpackServerData.cs` |
| 合成 | `fushi_itemExchangeMapping[符石ID] → itemExchange → reward/consume` | `FumoItemInfo.cs`、`EquipFuMoExchangeUI.cs` |

`scripts/parse/runes.mjs → buildRuneData → parsed/runes.json` 随 `data:build` 生成。浏览器只读取派生产物，经资源客户端校验与缓存，不读取 raw。缺失效果、奖励、费用或引用，以及非同系升一级的合成配置会在构建期报错，禁止按 ID 相邻关系猜测。

- 可见性复用 `hide`、全局黑名单和兑换可见性函数。合成还必须存在客户端使用的映射。
- 合成输入是 3 枚同级同系符石，输出 1 枚下一级符石。费用取原表：I 至 V 级分别为 300、600、900、1200、1500 银币。VI 级没有后继合成方案。
- 镶嵌费用由原表解析，当前为 500 银币；适用部位复用装备分类名称，不单独维护一套中文映射。
- 鉴定权重、单次数量和银币全部调用 `acquisitionRules`。例如未鉴定的水火符石 I，每次消耗自身 1 个及 100 银币，12 个候选中前四项各 23.5%。
- `scaleAcquisition` 限定整数 1 至 999；固定组放大产物数量，随机组仅放大抽取次数，单次概率和单次产物数量不变，不生成未经确认的累计概率。

## 共用接口

- `buildRuneEffect(item, enchants, triggers)` 是效果唯一实现；物品、装备入口共用的 `itemParser.parseRuneEffect` 直接调用它。高亮使用全局 `value-highlight`。
- `AcquisitionRewards` 在物品、装备详情和符石鉴定共用，`costTitle` 可覆盖「额外消耗」标题。合成卡片使用同构 `plan.acquisition` 和 `UiRewardCard` 展示单次材料，效果直接使用 `plan.input/output.effect`，不复制解析逻辑。
- 搜索构建合并 `buildRuneData.sources`，新增 `runeAppraisal`、`runeSynthesis`。仅替换同一输出、同一兑换 ID 的重复 Gem 来源，保留其他来源；兑换页已移除 Gem 分类和条目，符石合成统一在本页查看。
- 全局搜索沿用物品索引，避免为同一符石再建立重复记录。

## 定位协议

| 入口 | URL query |
| --- | --- |
| 符石列表 | `tab=runes&focus=item_19310` |
| 鉴定方案 | `tab=appraisal&id=item_19304`（ID 是未鉴定物品 ID） |
| 合成方案 | `tab=synthesis&id=item_19311`（ID 是兑换 ID，不假定等于产物 ID） |
| 列表与合成筛选 | `q`、`level`、`position`；合成按产物等级和部位筛选 |
| 鉴定次数 | `count=1..999`；合成固定展示单次，忽略旧链接的 `count` |
| 叠加物品详情 | 保留已有 query，追加 `itemId`；关闭后保留页签、方案、数量与筛选 |

物品详情已移除重复的「查看符石图鉴 / 查看符石鉴定」按钮；`getRuneItemTarget` 保留为定位工具，`getRuneSourceTarget` 继续提供结果物品获取途径到具体鉴定/合成方案的链接。浏览器前进后退以 URL 为准，切换页签清除不适用筛选。

## 鉴定交互与概率核查（2026-09-09）

三个页签的正文容器使用魔物收益同款 `paper-panel` 外边框，保留公共滚动裁剪和透明页面根。选中物品使用 `UiItemCard` 原品质框，点击图标打开详情；「选择其他」展开其余八类未鉴定符石，点选后收起，不使用下拉框。次数为 1–999，增减按钮沿用导航的上下折线箭头形状。点击「鉴定」展示最近一批结果，同名符石合并数量；进入详情后返回保留结果，换鉴定方案或页签清空结果。调整次数时旧结果标题保留实际已抽次数，再鉴定替换该批。

已逐项对比项目 `raw/reward.json` 与 `Config_decrypted/reward.json` 的九个 `appraisal` 奖励配置，内容一致；每组 `rate=1`、`num=1`，所有候选 `min=max=1`。下表按 `chance / 全池权重之和` 计算，等级概率为该等级所有符石合计：

| 未鉴定物品 | 奖励 ID | 候选数 / 总权重 | I 级 | II 级 | III 级 |
| --- | --- | --- | --- | --- | --- |
| 小型 | appraisal001 | 33 / 1100 | 94% | 5% | 1% |
| 中型 | appraisal002 | 33 / 110 | 30% | 60% | 10% |
| 大型 | appraisal003 | 22 / 22 | 0% | 50% | 50% |
| 水火 I、风地 I | appraisal101、appraisal111 | 各 12 / 400 | 94% | 5% | 1% |
| 水火 II、风地 II | appraisal102、appraisal112 | 各 12 / 40 | 30% | 60% | 10% |
| 水火 III、风地 III | appraisal103、appraisal113 | 各 8 / 8 | 0% | 50% | 50% |

普通池每等级有 11 种符石、元素池每等级有 4 种，同行同等级候选等权。例如小型的每枚 I/II/III 级分别约 8.5455% / 0.4545% / 0.0909%；水火 I 每枚分别为 23.5% / 1.25% / 0.25%。旧统一格式只保留一位小数，后两项曾显示 1.3% / 0.3%；按用户要求，现统一保留两位小数，物品与装备详情同步生效。小型对应显示 8.55% / 0.45% / 0.09%，极小非零概率显示 `<0.01%`，不会伪装为零。展示近似值不参与抽样。

手机端（≤640px）的鉴定概率、抽取结果和展开选择列表均为两列。奖励名称允许换行，复用的概率卡仅在本页调整图标和间距，不改变其他页面列数。

源码证据位于 `源码/源码/Assembly-CSharp`：

- `ItemUseTip.cs:188` 的 `ShowRewardList`、`ItemCellUIGrid.cs:131`、`ExtentionMethod.cs:1150` 仅枚举可能获得的奖励；未在这些方法中按 `chance` 抽取。
- `ItemBagMsg.cs:54` 把物品 ID 和次数发到 `ItemRouterUseItem`；`:74` 反序列化服务器返回的 `RewardData`。
- `BackpackServerData.cs:255` 发起请求，`:282` 鉴定分支按次数扣除消耗并发放返回奖励。

因此可以确认表的引用、费用、奖励候选与配置权重；现有资料无法确认服务器随机数、批量内部处理、隐藏保底等实现。网页 `runeAppraisal.appraiseRunes` 采用逐次独立、有放回的配置模拟，复用现有 `pickWeighted`，不添加保底，也不声称复刻服务器算法。仅支持当前核查过的单组必触发、单次单件符石配置，遇到不同结构报错而不猜测。以上证据边界仅记录在内部文档。

## 合成卡片与移动端对齐（2026-09-09）

手机端「选择其他 / 次数 / 鉴定」操作栏独占一行并靠左对齐，沿用 `RuneCountInput` 上下箭头。合成页移除原生目标下拉框，改为与符石列表一致的卡片网格（桌面两列、手机一列），展示全部 95 个方案，每批懒加载 20 个。卡片包含产物品质框、名称、等级、部位、合成前后效果，以及两列排列的银币和输入符石；图标和材料均可打开物品详情。

按用户追加要求，合成不提供次数输入，始终展示单次原表数量（3 枚同级符石、对应银币 → 1 枚下一级符石），旧链接的 `count` 不改变卡片。页头支持名称/效果/材料搜索和产物等级、部位筛选。来源中的 `id` 方案排在首位并描边，避免第 20 项以后无法立即定位；详情返回保留筛选，切换来源定位重置实际滚动根。

兑换页从加载后的分类中排除 `gem`，连同对应条目一起移除，兼容旧缓存数据；旧 `cat=gem` 链接回落到首个有效兑换分类。原始 Gem 表和公用可见性判断继续用于符石数据解析，不删除合成所需原表。

## 内部配置说明

原附魔表的 126 条中，12 条属于「【未使用】守护符石 / 结界符石」，按既有黑名单排除；Gem 兑换全表 105 条，实际合成仅取正式符石对应的 95 条映射。该差异不在页面显示诊断标签。

## 验证入口

```sh
node --test tests/unit/runes.test.mjs tests/unit/rune-appraisal.test.mjs tests/unit/acquisition-rules.test.mjs
npx playwright test tests/ui/runes.spec.js --workers=1
npm run build
```

单元测试覆盖真实数量、图片、原表映射、3:1 消耗、顶级边界、错误引用、批量计算、来源去重和资源校验；页面回归覆盖桌面/手机筛选、鉴定、合成、物品与装备双入口来源定位、详情返回及加载失败重试。具体执行结果见当日日志。未做 Android 真机验证。
