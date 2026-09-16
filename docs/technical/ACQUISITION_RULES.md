# 统一奖励规则接口

## 实现范围

`src/utils/acquisitionRules.js` 是无浏览器、无网络依赖的纯规则模块。普通奖励、固定装备、随机装备池、礼包、自选包、带钥匙宝箱与符石鉴定共用这里的解析。旧 `gameMappings` 奖励映射及解析函数保持原导出路径，通过重导出使用同一实现，不存在循环依赖。

已接入物品/装备共同使用的 `ItemDetailModal`、锻造台装备候选关系、普通设施制作产出，以及任务/事件/成就原有奖励解析入口。符石鉴定与合成同样使用该接口；抽奖规则和正式来源入口由业务模块负责。

## 输入与输出

所有解析函数都不修改传入原表。`context` 可包含：

| 字段 | 内容 |
| --- | --- |
| `items` | 物品 ID 字典、`{ datas }` 原表或物品数组 |
| `rewards` | 奖励 ID 字典或 `{ datas }` 原表 |
| `consumes` | 消耗 ID 字典或 `{ datas }` 原表 |
| `equipGroups` | 完整装备组表，包含 `equipGroups` 与 `qualityGroups`；仅解析装备候选时也支持装备组字典 |
| `getItemImageUrl` | 可选的已有关联图标解析函数；构建物品数据时注入，家具图纸和角色碎片不另写图片规则 |

| 函数 | 返回内容 |
| --- | --- |
| `parseRewardGroups(rewardOrId, context)` | 奖励组数组；可传奖励对象，也可传奖励 ID |
| `parseEquipmentPool(rule, context)` | 随机装备候选数组，池内权重概率不冒充最终获取概率 |
| `parseAcquisitionCosts(consumeOrId, context)` | 消耗卡片数组，支持货币与材料 |
| `parseItemAcquisition(item, context)` | 完整使用规则；非奖励类物品返回 `null` |
| `getObtainableRewardRules(groups)` | 反向来源共用实际产物筛选；排除零触发/次数/数量/权重与随机装备预览，保留自选和所属组信息 |
| `scaleAcquisition(acquisition, count)` | 1..999 整数批量计算；固定产物/费用放大数量，随机奖励放大次数，不改变单次概率 |
| `formatRewardGroupLabel(group)` | 固定、随机、自选组的共用业务文案 |
| `formatRewardProbability(rule)` | 奖励卡共用概率文案；自选项只写“自选获得” |
| `getRewardItemTarget(typeId)` | `{ query: { itemId } }` 局部定位信息；调用方保留原有路由/详情历史 |

`parseItemAcquisition` 返回：

```js
{
  action, rewardId, consumeId, conditionId,
  sourceItemId, sourceItemCount: 1,
  costs: [],
  groups: [{ kind, rate, num, rules: [] }]
}
```

`kind` 为 `fixed`、`random` 或 `select`。自选组和自选条目另有 `isSelect: true`，兼容现有详情组件。

规则卡片统一提供 `mode`、`min/max`、`targetName/targetImg/targetQuality`。已能定位到物品的条目提供 `typeId` 和 `target`；未知物品不产生可点击的 `target`。随机装备池不提供固定 `typeId`，而是保留 `equipTypeGroup`、`qualityGroup`、`candidates`、`qualities`；`showItemTypeId` 只能是预览配置，不能作为实际产物反向建立来源。固定装备保留 `quality/equipLevel/prefix` 等生成字段，展示品质取奖励指定品质。

## 概率与数量边界

- `group.num` 为抽取次数，`rule.min/max` 为单次抽中后的数量区间，二者不得混写。
- 完整、非负且总和大于零的权重，按 `chance / sum(chance)` 得到 `prob`；`actualProb = rate × prob`。零次数时实际获得概率为零。
- 零触发率、零数量和零权重不能用 `|| 1` 改成一。缺失/无效/全零权重不推导均匀分布，也不显示单项必得；兼容旧精简奖励时，缺失 `rate/num` 仍按 1 展示组结构。
- 自选项没有随机概率，也不意味着所有候选同时获得。
- 顶层货币是固定获得组，不能与随机候选混成一个多选一池。
- 不把多次抽取直接推导为累计概率：当前奖励客户端字段没有说明组触发时点及是否放回。公共格式化函数兼容其他模块已确认的 `cumulativeProb`，但本解析器不自行生成。
- 抽奖保底、UP 状态、账号持有及重复角色转换由 `gachaSim.js` 与 `gachaState.js` 管理；这些不在通用奖励原表内，不能从礼包权重推测。动画消费实际抽奖结果，不通过本模块再次随机。

`getRewardCost` 额外消耗取 `useActionPara.itemTypeId/itemNum`；`appraisal` 取 `useActionPara.consume` 指向的消耗表。`costs` 不包含被使用物品本身，该物品单独由 `sourceItemId/sourceItemCount` 表示。`getRewardCondition` 保留条件 ID，不在通用奖励层实现账号条件判断。

## 调用边界

`buildItemData` 生成 `item.acquisition`，浏览器 `fetchItemData/getItemAcquisition` 读取；旧 `parseItemRewards` 仍返回奖励组或 null。页面不另加载奖励/消耗原表。

展示统一用 [AcquisitionRewards](../UI_COMPONENT_LIBRARY.md#24-acquisitionrewards-共用奖励区)，父页面处理物品点击、URL 和详情历史。符石专属模型和定位见 [符石专题](../features/runes/RUNE_CATALOG.md)。

本模块不判断账号状态、正式开放入口或黑名单；来源反查由 `searchData` 及业务来源模块处理，不能因存在奖励就认定玩法已开放。
## 兼容与验证入口

`gameMappings.parseRewardObject` 继续返回 `{ rewards, rewardItemNames }`，`parseRewardEntries` 继续返回 `{ entries, text }`。这两个旧摘要接口保持原字段结构，不作为概率页面的数据接口；概率、数量区间和候选池必须用 `parseRewardGroups`。

- 规则与真实鉴定表：`node --test tests/unit/acquisition-rules.test.mjs`。
- 原有奖励、锻造、设施：`node --test tests/unit/reward-style.test.mjs tests/unit/smithing.test.mjs tests/unit/facilities.test.mjs`。
- 桌面/手机详情：`npx playwright test tests/ui/acquisition-rules.spec.js tests/ui/smithing.spec.js tests/ui/facilities.spec.js`。
- 发布前运行 `npm run build` 同步预解析数据和前端包；构建写数据期间不要同时运行读取生成目录的全量回归。
