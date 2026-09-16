# 营地设施

`/facilities` 保留原设施配方，并提供营地升级和属性研究；这是配置图鉴，不模拟账号升级、研究队列或已完成状态。

## 数据与职责

`scripts/parse/facilities.mjs → facilityData/campFacilityData → parsed/facilities.json`。原配方数组末尾追加 `key:camp` 对象，`resourceSchemas` 校验两种结构，浏览器不重读原表。固定奖励复用公共解析，配方图标沿构建期 `recipe.output.img` 传入，不另加载物品全表。

`FacilitiesView` 管页签与路由，`CampFacilitiesPanel` 管建筑/研究，`CampResearchTree` 与 `campResearchLayout` 管节点和连线。图片来自 `UI_Atlases/CampCenterPanel_Atlas`，使用项目 `public/images/CampCenterPanel/`。

## 路由协议

| 内容 | query |
| --- | --- |
| 营地建筑 | `facility=camp&mode=building&building=<建筑>&level=<当前级>` |
| 研究树/详情 | `facility=camp&mode=research&group=<分类>&research=<项目>&level=<目标级>` |
| 原设施配方 | `facility/mode/level/item`，保留旧 `tier` |
| 共用 | `q` 搜索，`level=all` 全部等级，奖励/材料只追加 `itemId` |

建筑来源用当前级，`upgrade.toLevel` 才是目标级；研究用目标级。有效 `research` 显示详情，返回树清除项目/等级并保留分类。营地未指定有效等级显示第一级，无建筑时取过滤首项；配方定位优先，不覆盖已有目标。筛选 replace，跨建筑/配方/家具 push；只有目标等级实际存在才生成跳转。

## 数据规则与依据

原始输入：`homeLevel`、`campResearch`、`roomBuild`、`consume`、`condition`、`task`、`reward`、`item`、`homeItem`，以及现有设施配方所需表。更新原表前按同步工具预览核对版本。

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

## 展示与交互

- 筛选顺序为搜索、三类页签、筛选、计数；`section-tabs` 保持筛选与正文同级，纸色只放正文，加载/错误时仍保留入口。切页签使用 `resolveScrollTarget`，材料详情返回保留状态。
- 建筑卡选择当前建筑，等级下展示当前/升级后外观、效果、条件、材料、奖励和开放配方；满级只显示当前效果。多档桌面两列、手机单列。
- 研究按采集/生产/冒险分组，仅沿真实 prerequisite 连线。搜索保留命中节点的祖先并淡化祖先，计数只算命中；空图安全处理，循环依赖报错，不伪造节点账号状态。布局由关系计算，不冒称原 prefab 坐标复刻。
- 节点与连线尺寸共用 `CAMP_RESEARCH_NODE`，原底板与图标保持比例。研究树从左向右展开，手机只在树内横滑，首次定位起点；桌面拖动超过阈值才捕获指针，拖动松开不误点节点，键盘仍可操作。

## 验证与发布

专项入口：`tests/unit/camp-facilities.test.mjs`、`tests/unit/camp-research-layout.test.mjs`、`tests/ui/camp-facilities.spec.js`。检查当前/目标级、前置研究、末级费用、原配方及来源、物品详情返回、明暗主题和手机树起点。发布同步设施产物与新增素材，构建写产物时不并发跑读取同目录的回归；实际结果写当日日志。
