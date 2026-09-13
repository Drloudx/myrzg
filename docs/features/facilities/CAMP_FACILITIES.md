# 营地设施开发与交接

## 范围

设施功能新增「营地升级」「属性研究」，保留原有四类设施配方。页面是配置图鉴，不连接游戏账号，不模拟实际升级或研究队列。不新增家具解锁页，不修改物品反向来源索引。

当前数据：7 类建筑、42 个建筑等级、35 次可配置升级；38 项研究、171 个研究等级；38 张研究图标及 2 张研究底板使用游戏原图，没有压缩或覆盖既有素材。

三个视图的筛选头统一按「搜索栏 → 设施配方/营地升级/属性研究页签 → 筛选 → 共 X 项」排列，计数为 13px、600 字重、`--text-muted`。`CampFacilitiesPanel` 通过 `section-tabs` 插槽接收页签，输出筛选框与正文同级片段，直接挂到页面根下以复用公共桌面吸顶和内容裁剪。纸色只放在 `camp-grid`，不覆盖吸顶栏上方地图留白。切换页签使用 `resolveScrollTarget` 重置真实滚动根；已有具体配方定位优先，不覆盖改良配方和材料来源链接的目标位置。加载或错误时仍保留搜索栏与三个页签。

## 文件边界

建筑等级的配方引用保留 `recipe.output.img` 作为 `img`，本级和升级后开放配方显示 22px 无底板物品图标，与名称一起跳转对应制作配方；不额外加载物品全表。

- `src/utils/campFacilityData.js`：营地建筑、研究、消耗、条件与关联配方解析。
- `src/utils/facilityData.js`：保持原配方数组，末尾追加 `key: camp` 的营地对象。
- `scripts/parse/facilities.mjs`：读取原表，生成 `public/data/parsed/facilities.json`。
- `src/utils/resourceSchemas.js`：设施资源校验区分原配方对象和营地对象。
- `src/views/FacilitiesView.vue`：三个页签、原设施配方及路由状态。
- `src/components/facilities/CampFacilitiesPanel.vue`：建筑与研究的筛选、分级查看、材料和关联跳转。
- `src/components/facilities/CampResearchTree.vue`：分组研究树、原节点贴图、可点击项目与横向滚动。
- `src/utils/campResearchLayout.js`：按前置关系计算节点层级和连线，不计算已研究状态。
- `public/images/CampCenterPanel/`：38 张原始研究图标，以及 `build_tree_botm.png`、`build_tree_iconbotm.png` 原始底板。
- `tests/unit/camp-facilities.test.mjs`、`tests/ui/camp-facilities.spec.js`：营地专项回归。

`facilityData.js` 中公共奖励解析属于其他并行任务的改动，本任务保留其实现；营地固定奖励复用 `gameMappings.parseRewardEntries` 兼容入口，不另写概率规则。

## 路由协议

页面使用项目既有 Hash 路由，以下为 Hash 后的路径：

| 用途 | 路径 |
| --- | --- |
| 营地升级入口 | `/facilities?facility=camp&mode=building` |
| 中心 1 升 2 的奖励 | `/facilities?facility=camp&mode=building&building=center&level=1` |
| 中心 3 升 4 的奖励 | `/facilities?facility=camp&mode=building&building=center&level=3` |
| 研究入口 | `/facilities?facility=camp&mode=research` |
| 采石技巧 2 级 | `/facilities?facility=camp&mode=research&research=collect_stone&level=2` |
| 改良木炭配方 | `/facilities?facility=blacksmith&mode=crafting&level=1&item=item_10083` |

- 建筑 `level` 始终为当前等级；`upgrade.toLevel` 才是升级目标。来源补全分支应使用当前等级定位奖励，不能用目标等级。
- 研究 `level` 为目标研究等级；`all` 显示全部等级。
- `group` 为研究分类（`collect/make/adv`），`q` 为搜索文字。未指定建筑时取当前过滤结果首项；没有 `research` 时显示研究树，有有效 `research` 时显示项目详情。
- 未指定有效等级时展示第一级；显式 `level=all` 展示全部等级。点击研究节点进入第一级详情，「返回研究树」清除研究 ID 和等级，保留分类。
- 材料与奖励只追加 `itemId`，关闭全局详情保留所有营地参数。原设施 `tier` 参数继续兼容。
- 本页筛选使用 replace；跨项目的建筑、配方与家具跳转使用 push，浏览器后退按 URL 恢复。
- 所要求建筑等级确实存在时才生成跳转按钮，不把超出表范围的等级指向错误页面。

## 数据规则与依据

原始输入：`homeLevel`、`campResearch`、`roomBuild`、`consume`、`condition`、`task`、`reward`、`item`、`homeItem`，以及现有设施配方所需表。已确认 `homeLevel/campResearch/consume/condition` 与 `Config_decrypted` 同名表完整一致，不需替换原表。

1. `CampBuildUpGradeUI.Refresh` 和 `FurnitureData.GetSysCampLevel`：当前等级 N 的 `consume/playerLevel/centerLevel` 对应 N 升 N+1；效果读取 N+1。末级即便仍有费用字段，也不生成下一次升级。
2. `homeLevel_center1` 的配置备注明确为营地中心 1 升 2 奖励，挂在当前 1 级；`homeLevel_center2` 挂在当前 3 级，对应升 4 级。奖励字段和升级消耗一起归入 `upgrade`。
3. `FurnitureData.SetHomeLevelAttr`：建筑 `att` 是当前等级的总加成，不能逐级相加。
4. `CampResearchData.RefreshPlayerAbilityInitData`：建筑 `playerAbility` 从 1 级累计到当前级；同一研究只取当前已完成等级的 `actionPara`，不同研究再相加。
5. `CampResearchItemUI.RefreshState`：前置研究要求存在已完成记录，并非要求前置满级；页面显示前置 1 级。
6. `CampResearchUpGradeUI`：研究消耗、时间、玩家等级和设施等级都取目标等级；效果展示沿用 `des + addDes`。
7. 研究 `action=formula` 沿精确配方 ID 关联现有设施配方，不用物品名猜测。`action=none` 的采集产量研究仍保留原表说明，不伪造 `playerAbility`。
8. 建筑开放条件复用家具条件解析器，读取实际条件规则与任务名称，不展示 `condition.desc` 内部备注。
9. 建筑 `roomBuild.camp.decMax + campDecMaxChange` 为该级装饰上限；不累计各级 `campDecMaxChange`。

## 内部配置差异

这些是维护核对信息，不作为页面提示、测试标记或来源状态显示：

| 项目 | 差异与处理 |
| --- | --- |
| 营地中心 5 级 | 文案写 175→200，但 `campDecMaxChange=200`，基础上限 100，源码实际读取结果是 300；6 级则为 225。页面使用数值字段，不擅自修原表。 |
| 货运站 3 级 | 文案写加成 5→10，但 2 级 `orderWeight=5`、3 级 `orderWeight=10` 按源码逐级累加，实际总加成为 15。页面显示累计加成。 |
| 伤口处理、快速搭建 | `addDes` 是 4%/8%/12%，`actionPara` 是 0.4/0.8/1.2，倍率单位与文案不能直接等同。页面保留游戏研究说明，不把原始数字另乘 100 显示。 |
| 破甲战术、元素克制 | 两项研究的 9/10 级要求中心 8 级，而建筑表最高中心 7 级。保留研究条件，但不生成中心 8 级链接，也不补造等级数据。 |
| 最高级残留费用 | 中心 7、锻造台 9 等末级仍有 consume/门槛字段，源码在不存在下一等级时屏蔽升级。本页同样不显示这些费用。 |

## 游戏风格界面（2026-09-09）

按用户要求重新设计营地升级与属性研究：

- 建筑筛选移入正文，用七张原建筑图标卡切换；手机每行四张。等级选择放在建筑标题下。每个升级档位使用卡片，当前与升级后的外观、说明和属性并排，条件、外观入口、材料和升级奖励位于下方；满级仅显示当前效果。单档全宽，多档桌面两列、手机单列。
- 研究项目移除下拉框，以采集、生产、冒险三组研究树呈现。节点使用原 `build_tree_botm` 底板和已有研究图标，详情标题使用 `build_tree_iconbotm` 菱形框；节点显示总等级，不伪造账号当前等级、锁定、进行中或已完成状态。
- `CampResearchPanelUI.RefreshUI` 按三组切换节点，点击节点打开研究详情；`CampResearchItemUI.RefreshUI/SetState` 读取原名称、图标、说明、等级与前置关系。网页沿用这种树状选择交互，但节点位置由 `prerequisite` 层级重新排列、连线由 SVG 绘制，并非 Unity 预制体坐标的逐像素复刻。
- 搜索保留命中研究的祖先路径，非命中的祖先节点淡化，计数仅包含命中项目。只按真实前置关系连线，空图安全返回，循环依赖显式报错。前置关系从左向右推进，同层分支上下排列；手机研究树只在自身区域左右滚动，首次显示时定位左侧起点，整页无横向溢出。
- 节点底板按原始 292×88 显示，保留左侧正方形图标框，图标以 60×60 contain 放入；名称、总等级在素材分隔线上方，描述在线下方。`CAMP_RESEARCH_NODE` 同时提供组件和布局连线尺寸，避免扩大节点后连线穿过卡片。「返回研究树」在详情正文右上角。
- 所有营地正文使用 `paper-panel` 外边框，根页面仍透明。保留共享吸顶裁剪、来源级别定位、物品详情历史和配方跳转。新增贴图与 `UI_Atlases/CampCenterPanel_Atlas/sprites` 对应原图 SHA-256 一致。

本轮相关单元测试 7/7，营地/原设施/来源的桌面与手机回归 24/24 通过；修正手机树起点后营地专项 10/10 再次通过，已查看研究树、研究详情、营地首屏及奖励区明暗截图。Vite 构建通过，未做 Android 真机验证。

## 合并与发布

研究树地图容器沿用副本的 `--paper-dark` 背景、`--border-soft` 1px 边框和 6px 圆角，隐藏滚动条。桌面支持鼠标左键水平拖动，包括从节点开始拖动；移动超过 4px 才捕获指针，松开不触发研究详情。手机保留原生滑动，键盘仍可聚焦滚动区和点击节点。

研究树地图容器沿用副本的 `--paper-dark` 背景、`--border-soft` 1px 边框和 6px 圆角，隐藏滚动条。桌面支持鼠标左键水平拖动，包括从节点开始拖动；移动超过 4px 才捕获指针，松开不触发研究详情。手机保留原生滑动，键盘仍可聚焦滚动区和点击节点。

来源补全任务只需按上述 query 协议跳转，无需修改营地组件。统一奖励规则任务可继续维护公共解析入口；本任务不修改 `ItemDetailModal.vue`、`searchData.js`、路由表或导航清单。

同步发布 `facilities.json`、38 张研究图标、2 张研究底板及本次页面代码；原表无需变更。为了避免并行任务互相覆盖派生产物，开发验证只重建设施数据并进行独立目录的 Vite 生产构建，整合后再统一执行完整 `npm run build` 和全站 UI 回归。

## 验证结果

- 营地与旧设施专项单元测试 6/6，全量单元测试 106/106 通过。
- 营地与旧设施桌面/手机 UI 测试最终 12/12 通过；保留原 45 秒超时和全部断言。并行构建期间出现的一轮加载超时已在单 worker 重跑中消除。
- 实际检查明亮/深色、桌面/手机截图，确认正文可读、原图显示、无横向溢出；研究筛选的暗色激活文本有独立断言。
- 当前派生产物通过运行时校验，并与构建函数输出一致；38 张图标 SHA-256 与资源包一致。
- Vite 独立目录生产构建通过。全站 UI 和 Android 真机检查留给整合阶段。
