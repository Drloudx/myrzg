# 伙伴邮件原素材皮肤

正文下滚提示定位在 `.mail-body-area` 底部留白的水平中心，位于可滚动文字区域下方、奖励栏上方；不再定位到整个阅读器右下角。有无奖励均跟随正文高度，滚到底后隐藏，不随文字一起滚走。

## 等高标题与手机选信

桌面列表卡片固定 66px 高；标题单行显示，从 13px 起每次减少 1px，直到实际文字宽度不超过可用宽度。ResizeObserver、角色/邮件变化、字体加载完成均触发重新测量，空间恢复后允许字号增大；副文案保持单行，避免撑高卡片。

≤700px 时布局为头像横栏（68px）、邮件选择栏（64px）、全宽正文。选信卡片为 56px 高，横向滑动并吸附；停稳后选中最近的一封，右侧前后按钮和封数同步。只有一封时隐藏按钮，首尾不循环。标题拟合与滚动提示共用合并到动画帧的尺寸监听，卸载清理监听及定时器。正文、奖励点击、原信纸皮肤与字体沿用既有实现。

## 固定阅读区域与内部滚动

邮件路由在 `App.vue` 通过 `is-mail-reader` 限制外层视口，明确覆盖桌面通用的 `height:auto / overflow:visible`。中间页总高与左右栏共用 `100dvh - header-height - safe-top - 53px`，顶部筛选占固定内容高度，其余全部留给阅读器。只在该路由锁定外页，离开后恢复普通图鉴的页面滚动。

阅读器使用 `minmax(0,1fr)` 网格行，头像、邮件列表、正文独立 `overflow:auto` 与 `overscroll-behavior:contain`，滚到首尾不把滚轮交给外页。隐藏原生滚动条，有未读到的下方/右侧内容时显示方向提示，到末端消失；尺寸和筛选改变时重新计算。窄屏不再设置 470px 最低高度，头像横排，正文使用剩余高度。保留移除内嵌小边框后的单层结构。

资源根目录：`E:\Desktop\html\myrzg`。2026-09-10 按用户截图引入原图；2026-09-11 去掉邮件专用目录中的重复副本。当前邮件贴图统一为 `public/images/EmailPanel_Atlas/`，头像框、选中框和通用奖励图标直接共享 `public/images/Common_Atlas/`，完整信纸放 `public/images/uipanel/emailpanel/mail_botm.png`。不再使用 `EmailPanel/game-skin`，不压缩或重编码原图。

| 原始目录 | 文件 | 用途 |
| --- | --- | --- |
| `UI_Atlases/EmailPanel_Atlas/sprites` | `mail_at.png` | 头像栏纵向底图，上下各切 40 像素 |
| 同上 | `mail_page.png`、`mail_page_on.png` | 信件默认、选中底图，左切 90、右切 50 像素 |
| 同上 | `mail_list_new_task.png`、`mail_list_new_task_pt.png`、`mail_list_new_item.png`、`mail_list_new.png` | 按邮件类型使用彩色图标，不使用灰色 `read` 图标 |
| `UI_Atlases/Common_Atlas/sprites` | `at_f_M.png`、`chara_srat_now.png` | 多边形头像框与金色选中角框 |
| `4.24路资源包/assets/res/texture/uipanel/emailpanel` | `mail_botm.png` | 完整信纸，含标题、分隔线与纸边 |

证据：`EmailPanel_Atlas.json` 的 `mSprites` 切片字段；资源包 `prefab/uiprefab/emailpanel/UISprite*.json` 的贴图名称；`UITexture #36901.json` 的信纸四边 `mBorder=150`；游戏源码 `EmailPanelUI.cs` 和 `EmailItemTemp.cs` 的头像、发件人、邮件类型逻辑。Web 使用 CSS border-image 对应切片；信纸绘制边宽 90px，保留纸边与标题比例，不平铺原图。

截图背景是运行时营地场景，不是一张 EmailPanel 背景图；网页继续沿用当前地图背景。静态资料库不具有账号收件时间或完成状态，故不复制“18 小时前”“已达成”及领取标记。邮箱遍历完整 `heroMail`，不再限于角色档案已关联的邮件。

## 邮件覆盖范围（2026-09-11）

正文与角色档案共用 `cleanMailContent`，该函数复用通用对白清洗及 `CALL_NAME_REPLACE`。`[callName4]` / `{callName4}` 均显示“大哥哥（大姐姐）”，保留原换行；不在邮箱页面复制称呼表。奖励点击或 Enter/空格打开全局物品详情，真实物品 ID 从共享奖励解析保存在 `typeId` 中，包括银币等货币；关闭详情保留当前信件和正文滚动位置。

项目两份 `raw/heroMail.json` / `raw/hero/heroMail.json` 与 `Config_decrypted/heroMail.json` 均有 77 条且内容一致，遗漏发生在消费方式。原先页面只有 37 封档案邮件；现由 `partnerMailData` 生成独立的 `mailboxes`，包含 38 封有效档案邮件、22 封附件邮件和 1 封普通邮件，共 61 封、36 位发件人。格薇勒、阿迪拉、艾茵虽在角色图鉴原表标记 `hide`，仍作为邮箱发件人保留。`heroes` 的原有可玩角色筛选不变。

另 16 条 `mail_fav_hero_043/046/047/065` 的 `_2` 至 `_5` 邮件没有同角色档案关联；`HeroMailServerData.GetMail` 与 `EmailPanelUI.InitHeroMail` 明确过滤这类记录，邮箱同步过滤，原表不删除。当前没有 `mailType=1` 且 `taskTypeId` 非空的配置，但仍保留普通任务邀请的正确图标分支并用构造数据验证。

主线、支线的后续来信由 `HeroMailServerData.CheckUnLockMail` 检查 `condition` 解锁，例如 `mail_s_1_1` 的条件是完成 `s_1_1`。这不等同邮件附带可接取任务，图标必须根据邮件自身字段判断。`eventMail` / `questionnaireMail` 属于普通系统邮箱，缺少 `heroTypeId`，不猜测归到角色名下。

两封信原 `img=01`，按源码 `Texture/UIPanel/EmailPanel/HeroMailImg/` 读取；附图从 `4.24路资源包/assets/res/texture/uipanel/emailpanel/heromailimg/01.png` 原字节复制到相同业务层级，导入前确认项目无同内容副本。搜索覆盖全部邮箱标题，按发件人切换时展示该角色全部有效邮件；邮件保留原表顺序，不虚构发送时间。

## 邮件类型与奖励（2026-09-11）

奖励区为 `flex: 0 0 64px; margin: 0 6px 24px`，移除顶部分隔线；标签 30×60px，右侧奖励格同步为 60×60px。数量使用游戏 `ItemBagCellUI.SetCnt` 指定的 `#F8EEDC`，网页字号为 13px，仅作用于邮件奖励。

已按 `EmailPanelUI` / `EmailItemTemp` 的控件引用核对原始 `emailpanel.asset`，并与 `4.24路资源包/assets/res/prefab/uiprefab/emailpanel` 导出 JSON 交叉确认。此前将奖励数量的 `#F8EEDC` 套用到标题是错误判断，两处标题已纠正为 `#CFBA96`。

| 控件 | 游戏颜色 | 原 UILabel 字号 | 游戏字体 | 导出资源 |
| --- | --- | --- | --- | --- |
| 左侧邮件标题 | `#CFBA96`，alpha=1 | 22 | `HeiTi → MYR2SansRegular` | `UILabel #37007.json` |
| 右侧正文标题 | `#CFBA96`，alpha=1 | 24 | `HeiTi → MYR2SansRegular` | `UILabel #37078.json` |
| 发件人 | `#533E26`，alpha≈0.698 | 18 | `CuHeiTi → MYR2SansBold` | `UILabel #36789.json` |
| 正文 | 运行时由 `ReplaceDescValue(...,10,15)` 设置普通字色 `#533E26`、强调色 `#A36F0A` | 20，`mSpacingY=8` | `CuHeiTi → MYR2SansBold` | `UILabel #37020.json` |

原始包位于 `game.taptap.tqpmyrzg/assets/Android/AssetBundle/prefab/uiprefab/emailpanel/emailpanel.asset`。列表标题 PathID 为 `5186371626743767534`，右标题为 `8686398985320486196`；两者 `mColor` 均为 RGB(207,186,150)，关闭渐变且无文字特效。字体由同一 AssetBundle 根目录下 `font/heiti.asset`、`font/cuheiti.asset` 的动态字体引用与依赖确认，实际字库为 `font/ttf/myr2sansregular.asset` / `myr2sansbold.asset`。此前“资源里没有字体”的记录不成立。

上述字号为游戏 NGUI 布局单位，不直接等同网页 CSS px。按用户最终指定，网页使用 `public/fonts/HarmonyOS_Sans_SC_Regular.ttf` / `HarmonyOS_Sans_SC_Bold.ttf`，统一通过 `var(--font-ui)` 选择 400/700 字重；标题及列表副文字为常规，正文与发件人为粗体，不引入游戏字库。正文行高按原字号 20 与额外行距 8 的比例设置为 1.4。发件人采用原 `#533E26` 与 alpha≈0.698，顶部留 8px 间距；信纸顶部切片同步增加 12px，避免发件人压到分隔线。左侧“某某的来信”是网页副文案，复用游戏原列表 `timeLabel` 的 `#F8EEDC`、alpha≈0.502（PathID `-4986188954514892633`），不表示游戏原文就是这段文案。

黑色标题条中心位于原信纸约 y=44，顶部切片绘制为 102px 后对应约 30px。右标题相对下移 3px，使 25px 行盒中心与黑条中心对齐；仅改变标题视觉位置，发件人与正文不随之移动。

奖励数量的颜色依据是 `Const.ColorString[1]` 与 `ItemBagCellUI.SetCnt`，不代表其字体、字号和阴影已完成原资源对齐；网页数量右侧内缩由 4px 改为 7px，仅作用于邮件奖励，避免压住边框。

`partnerMailData.parseHeroMail` 保留原 `heroMail.mailType`，页面不得以 `heroArchives.type` 代替。嘉莉缇的 `mail_fav_hero_025_1` 在项目原表、`Config_decrypted` 与源码配套 CDN 配置中均为 `mailType=2`，但关联档案的 `type=1`；此前误用档案类型造成了礼盒图标和“任务奖励”标签。

按 `EmailItemTemp.Init(HeroMailData)` 与 `EmailPanelUI.RefreshHeroMailUI` 的分支显示：

| 条件（按顺序） | 彩色图标 | 奖励标签 |
| --- | --- | --- |
| `mailType=2` | `mail_list_new_task` | `com_item_archive`（档案奖励），奖励取关联档案配置 |
| `mailType=1` 且有 `taskTypeId` | `mail_list_new_task_pt` | `com_item_task`（任务奖励） |
| `mailType=1` 且有附件奖励 | `mail_list_new_item` | `com_item_encl`（附件奖励） |
| 普通无任务、无奖励邮件 | `mail_list_new` | 不显示奖励区 |

列表按钮悬停保持原浅色文字，局部覆盖 `UiButton` 的 ghost 悬停颜色。奖励复用物品图鉴 `UiItemCard`，通过 `showName=false` 保留紧凑图标布局，数量走 `extra` 插槽；背景框及图标比例均由公共组件管理。银币、氪金的品质按公共货币 ID 从物品表查询，不再写死为 1；当前两者均为品质 5。颜色不表示账号已领取状态。

皮肤改造前页面和 EmailPanel 资源备份在 `E:\Desktop\html\myrzg\vue-myrzg备份-资源\partner-mail-before-game-skin-2026-09-10`；本次去重前的所有邮件图片在 `E:\Desktop\html\myrzg\backups\image-consolidation-2026-09-11\EmailPanel`，恢复旧结构时需要同时恢复旧代码引用。
