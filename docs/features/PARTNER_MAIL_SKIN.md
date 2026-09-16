# 伙伴邮件

静态伙伴邮箱与原素材阅读器。页面契约见 [SPEC](../SPEC.md#三页面契约)，历史资源核对与像素调整见 [2026-09-10](../dev-logs/2026-09/2026-09-10.md) 和 [2026-09-11](../dev-logs/2026-09/2026-09-11.md)。

## 数据与覆盖范围

- `scripts/parse/heroes.mjs → heroParser → partnerMailData` 在构建期生成 `parsed/heroes.json.mailboxes`；`fetchHeroData` 缓存、`resourceSchemas` 校验，缺少邮箱字段的旧产物应报错。浏览器不另加载原表。
- 遍历完整 `heroMail`，按源码过滤没有同角色档案关联的档案邮件；不因发件人在可玩角色图鉴中标记 `hide` 而裁掉邮箱。角色档案复用同一解析函数。`eventMail/questionnaireMail` 无 `heroTypeId`，不猜测角色归属。
- 正文复用 `cleanMailContent`、通用对白清洗及 `CALL_NAME_REPLACE`，保留换行。两种 `callName4` 标记统一显示“大哥哥（大姐姐）”。邮件按原表顺序展示；搜索覆盖全部邮箱标题，选中发件人后显示其全部有效邮件。
- 静态图鉴不模拟发送时间、已读、领取或任务完成状态。后续来信的 `condition` 是解锁条件，不等同于邮件附带可接取任务。

## 类型与奖励

以原始 `heroMail.mailType` 判断，禁止替换成 `heroArchives.type`。按以下顺序匹配：

| 条件 | EmailPanel 彩色图标 | Common 奖励标签 |
| --- | --- | --- |
| `mailType=2` | `mail_list_new_task` | `com_item_archive`，奖励取关联档案 |
| `mailType=1` 且有 `taskTypeId` | `mail_list_new_task_pt` | `com_item_task` |
| `mailType=1` 且有附件奖励 | `mail_list_new_item` | `com_item_encl` |
| 普通无任务、无奖励 | `mail_list_new` | 不显示奖励区 |

奖励复用 `UiItemCard`（`showName=false`、数量走 `extra`）；真实物品 ID 保存在共享解析的 `typeId`，包括货币。点击或 Enter/空格打开全局物品详情，关闭后保留邮件选择和正文位置。货币品质查物品表，不写死。筛选与选信为页面本地状态，打开物品只追加 `itemId`，不声明未实现的选信 URL 参数。

## 阅读器布局

- `PartnerMailsView` 管筛选与选择，`PartnerMailReader` 管阅读器。`App.vue` 的 `is-mail-reader` 仅在邮件路由锁定外层视口；筛选占固定高度，其余空间交给阅读器，离开后恢复普通图鉴滚动。
- 头像、选信和正文独立滚动，使用 `minmax(0,1fr)`、`min-height:0` 和 `overscroll-behavior:contain`。隐藏原生滚动条，以方向提示表示剩余内容；正文提示位于文字下方、奖励上方，到末端隐藏，尺寸变化时重算。
- 桌面选信卡等高，标题单行按可用宽度拟合，空间恢复允许放大；窄屏改头像横栏、横向吸附选信卡与剩余高度正文。滑停选最近邮件，前后按钮首尾不循环，仅一封时隐藏；最小高度不能撑破横屏视口。
- 标题测量响应字体加载、选择和尺寸变化；监听合并到动画帧，卸载清理监听与定时器。

## 原素材与文字

| 资源 | 项目目录 |
| --- | --- |
| EmailPanel 图集 | `public/images/EmailPanel_Atlas/` |
| 头像框、选中框和奖励标签 | 共享 `public/images/Common_Atlas/` |
| 完整信纸与邮件附图 | `public/images/uipanel/emailpanel/mail_botm.png`、`heromailimg/01.png` |

原图从 `UI_Atlases` 对应图集与 `4.24路资源包/assets/res/texture/uipanel/emailpanel` 获取，保留原字节。切片依据图集 `mSprites` 与 prefab 的 `mBorder`，使用 CSS `border-image`；营地场景不是邮件背景贴图，不额外复制截图背景。

网页统一使用 `--font-ui` 的 HarmonyOS 400/700 字重：标题常规、正文与发件人粗体，正文行高 1.4。标题 `#CFBA96`，正文/发件人 `#533E26`（发件人 alpha≈0.698），强调 `#A36F0A`；副文字 `#F8EEDC`、alpha≈0.502，奖励数量 `#F8EEDC`。NGUI 字号不直接等同 CSS px，不引入游戏字库。

## 验证与追溯

检查全部类型图标、隐藏角色邮箱、称呼换行、奖励详情返回，以及明暗主题、窄屏选信和长正文滚动。2026-09-11 日志记有 844×390 长邮件正文不可见的自动化失败；本轮文档整理未复测，不能据历史其他通过项宣称此项已修复。

皮肤改造前快照位于项目同级 `vue-myrzg备份-资源/partner-mail-before-game-skin-2026-09-10`；图片去重前快照位于项目同级 `backups/image-consolidation-2026-09-11/EmailPanel`。恢复旧目录时需配套旧代码引用。
