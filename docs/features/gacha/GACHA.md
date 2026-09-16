# 模拟招募

本专题维护 `/gacha` 的功能边界、模块职责和复刻约定。像素坐标、时长、取景和资源清单由对应代码及原始资源维护，不在主规范重复抄录。

## 功能与数据

- 页面支持角色池与魔物蛋池，抽取、钱包、保底、持有、碎片和记录均为本地模拟；必须保留模拟标识，不能表述为游戏账号数据。
- URL 使用 `kind=hero|pet`、`pool=<poolId>`，`view=pool` 打开概率详情，`view=record` 打开记录；通过 `router.replace` 同步并保留其他查询参数。物品来源入口沿用这套定位方式。
- `parsed/gacha.json` 提供卡池、候选、权重、保底、消耗、赠品和概率说明；`parsed/gacha-presentation.json` 提供立绘、`imgPos`、骨架、皮肤及台词等展示数据。运行时不重新读取卡池原表。
- `scripts/parse/gacha.mjs` 依赖已有 `gacha.json` 的候选与权重，只从完整原表增量补充展示字段及初始钱包配置；不能据此宣称已能从零重建全部卡池。物品来源分析与模拟页共用该产物。
- 抽取规则集中在 `gachaSim.js`：按权重抽取，处理 `safe/firstSafe`、指定伙伴及重复转化。`secondSafeMin/secondSafeMax` 的服务端语义未证实，不推测实现。演出消费已生成结果，不二次随机。
- 钱包、记录及保底由 `gachaState.js` 持久化；初始额度、充值和迁移逻辑以 `GachaView.vue` 的模拟常量与原表初始配置为准。重置恢复模拟基线，不能把初始配置量当成账号库存。

## 模块职责

以下组件位于 `src/components/gacha/`，工具位于 `src/utils/`。

| 模块 | 职责 |
| --- | --- |
| `GachaView.vue` | 加载数据、维护阶段与 URL、生成结果、协调钱包和资源生命周期 |
| `GachaStage.vue` / `gachaLayout.js` | 统一画布、缩放、坐标、视口边缘控件 |
| `GachaPoolPanel.vue` | 卡池、概率入口、消耗和模拟钱包 |
| `GachaConsumeModal.vue` / `gachaCurrency.js` | 消耗确认、货币槽和单抽/十连费用的共享计算 |
| `GachaTipPanel.vue` | 概率说明和本地记录，覆盖在卡池之上 |
| `GachaCardPanel.vue` | 角色池开场与翻卡，对应 `HeroGachaAniPanel` |
| `GachaRevealPanel.vue` | 角色池星级、角色与立绘的分段揭晓，对应 `HeroGachaShowPanel` |
| `GachaResultPanel.vue` | 完整角色结果一览，对应 `HeroShowPanel` |
| `GachaPetPanel.vue` | 蛋袋、出蛋与逐只揭晓，对应 `PetGachaAniPanel` |
| `GachaPetResult.vue` | 蛋及赠品结算，对应 `GetRewardTip` |
| `gachaSpinePlayer.js` / `gachaPreload.js` | 骨架播放、缓存、预热及资源释放 |
| `gachaAudio.js` | BGM 和音效的统一播放、开关与停止 |

角色池流程为 `pool → card → reveal → result`；蛋池为 `pool → petcard → result`。两类结果分别使用角色卡片与奖励格，蛋池不经过角色翻卡和角色揭晓面板。

## 布局与素材

- 招募是独立的游戏皮肤页，`App.vue` 的 `is-gacha-stage` 隐藏 Wiki 外壳并释放整屏空间；布局和层级样式集中在 `src/assets/gacha.css`，不进入公共 UI 出口或 `theme.css`。公共数据、奖励映射和资源路径工具仍复用全站实现。
- 设计坐标以 1534×750、中心为原点，由 `GachaStage` 统一缩放，子组件不重复计算。缩放同时受可用宽、高限制：`contain` 保持固定设计画布，`height` 在宽屏延展背景、窄屏回到完整设计宽度，不再裁掉两侧内容。卡池首页使用 `contain`，演出/结算保留 `height` 的宽屏延展；窗口变化由 ResizeObserver 实时重算。竖屏整体缩小并提示横屏，提示不拦截操作。
- 分享、跳过等贴屏边缘控件使用舞台 `hud` 槽。整屏遮罩使用 `position:absolute; inset:0`，不再叠加居中定位；并列覆盖面板脱离文档流，避免被排到视口外。
- 按原 prefab 的 Transform、`mPivot` 和 `mDepth` 校对定位与遮挡。`BottomRight` 以右下角为锚点，内容向左上展开。视觉居中与 transform 动画分层，避免关键帧覆盖居中基准。
- 原图来自项目同级 `UI_Atlases`、`4.24路资源包/assets/res`，源码行为参考 `源码/源码/Assembly-CSharp`。图集精灵按原图集归档，独立纹理保留必要目录层级；导入由 `scripts/dev/import-gacha-assets.mjs` 及其清单维护。
- 九宫格边界从图集 `mSprites[].border*` 读取。现有固定尺寸按钮、页签使用 `public/images/sliced_buttons` 的预渲染纹理；需变尺寸的切片按实际样式与元数据处理，不要对已预渲染的按钮重复切片。
- 文字色、字号和贴图对应关系参考 prefab 的 UILabel 与源码赋值；原始布局单位与缩放后的 CSS 显示尺寸分开看。具体坐标和逐帧参数留在组件及资源证据中。

## 演出与交互约束

- 跳段和跳过只影响展示副本，不能删改完整抽取结果；角色结果始终显示完整名单。结果卡片、蛋池结算格按原交互处理，不附加图鉴跳转。
- 蛋池结算聚合蛋与 `pool.bonus` 赠品；蛋不显示数量，其他奖励按实际数量展示。点击先补完展示，再关闭。
- 概率说明消费原表 `percTip`，名单占位与数值高亮使用既有解析；不编造概率解释。概率和记录覆盖层保留卡池背景，隐藏滚动条时仍提供溢出提示。
- 资源加载失败或 WebGL 不可用时，保留结果并允许结束演出。预热和缓存由共享工具管理；卸载清理监听、计时器与本模块拥有的 WebGL 资源，共享纹理由共享生命周期释放，不能泄漏或提前销毁。
- 音频统一经过 `gachaAudio.js`：同名 BGM 不重复启动，关闭声音暂停并保留进度，重新开启续播；面板切换不自行停止全局音乐，离开页面统一停止。实际曲目切换以各阶段调用为准。
- 粒子与 3D Timeline/后处理存在网页近似实现，不将局部参数对齐等同完整复刻。骨架异常对照当前播放器与实际资源核验。

## 验证与历史参考

改动按范围检查两类卡池、单抽/十连、跳段、完整结果、消耗不足、重置、概率/记录覆盖、声音开关以及窄窗口与横屏。覆盖层既要可见，也要检查其边界落在视口内。反复抽取与退出页面时检查资源释放。

相关入口为 `tests/ui/gacha.spec.js`；窗口适配回归在 `tests/ui/gacha-responsive.spec.js`，检查连续缩窄/放大、两种卡池、概率弹层、十连演出与完整结算的实际边界和操作。数据或规则变化另检查对应单元测试，产物变化再执行数据构建。文档整理本身不代表这些运行时验证通过。

- [复刻审计与当时的修复记录](../../../backups/audits-archive/GACHA_REPLICA_AUDIT_2026-09-13.md)：2026-09-13 阶段证据，包含相互覆盖的历史状态。
- [主文档整理前摘录](../../../backups/audits-archive/DOC_DETAILS_2026-09-16.md)：旧坐标、调参和修复原文，仅用于追溯。
- 按日结果见 [开发日志目录](../../dev-logs/README.md)。稳定规则变更直接改本专题，主文档仅保留摘要和链接。
