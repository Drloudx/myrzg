# 2026-09-16 主文档整理前摘录

> 历史资料，不是现行规范。以下保留移出主文档的原文，含已被后续修复取代的结论；不要将其中状态、坐标或操作建议直接用于当前实现。现行入口见 [文档导航](../../docs/README.md)。文本块内路径和链接仅是原始记录。

## 1. docs/SPEC.md：9.8 模拟招募

~~~~text
### 9.8 模拟招募 `/gacha` — `GachaView.vue`

- **定位**：按游戏原素材还原的卡池界面（游戏皮肤页，与伙伴邮件同属「业务皮肤」例外）。所有视觉元素来自 `src/components/gacha/` 与 `src/assets/gacha.css`，不进入通用 UI 出口，也不把游戏皮肤样式写进 `theme.css`。
- **整页全屏**：本页是整屏游戏画面，`App.vue` 以 `is-gacha-stage`（`route.path === '/gacha'`）隐藏 Wiki 顶栏、左导航、右信息栏与移动端导航悬浮按钮，主视图区独占 `100dvh`。注意 `.main-layout-row` 是 `grid-template-columns: 250px 1fr 300px`，**只把左右栏 `display:none` 不够**——唯一剩下的子元素会落进第一列 250px（画布被压到 250/1534 缩放），必须同时把行布局改成单列 flex。桌面端基础规则为页面滚动预留的 `scrollbar-gutter: stable` 也要在该路由置回 `auto`，否则右边缘会留出一条露出页面地图背景的槽宽；移动端媒体查询（≤1024px）给行容器加的 `padding: 8px + safe-area !important` 页边距同样要以 `padding: 0 !important` 压回（横屏手机的刘海/手势条 inset 可达几十像素，`!important` 竞争输给普通声明时整页四周会露出 body 羊皮纸背景）。画布之外的留白由 `GachaStage` 的 `backdrop`（当前卡池主视觉的模糊放大版）铺满，避免出现硬边黑框；画布本身始终 **contain 不裁切**，不用「按宽度铺满」去切掉左右内容。
- **坐标系**：设计画布固定 `1534×750`、原点在画面中心，容器按 `min(容器宽/1534, 容器高/750)` 等比缩放居中（`utils/gachaLayout.js` 的 `gachaPos(x, y)` / `gachaFitScale`）。模板里的坐标直接写 prefab 原始值，不做响应式重排；禁止各子组件自行再算缩放。参考分辨率由 prefab 证据确定：`background/white` 平铺 1534×750、`mask` 位于 x=-767、`Back` 位于 (587,335)。
- **NGUI pivot 与会话约定**：`UIWidget.Pivot` 为 `TopLeft=0, Top=1, TopRight=2, Left=3, Center=4, Right=5, BottomLeft=6, Bottom=7, BottomRight=8`，写定位前必须先看 `mPivot`（例如 `spGachaNameDown01` 名牌是 `mPivot=8` 即 **BottomRight**，右下角贴坐标点向左上展开；`Title/bg`、`SmalInfoTip/bg` 是 `mPivot=3` 即 Left，从坐标点向右展开）。`UIAnchor` 的序列化 `pixelOffset` 与 Transform 位置在当前资源里并不一致（`Buttons`、`upObj` 的锚点值都推不出游戏画面里的实际位置），**以 Transform 位置为准**，不按 UIAnchor 反推。
- **层叠**：`.gacha.css` 定义 `.g-layer-bg(1) < .g-layer-art(10) < .g-layer-deco(20) < .g-layer-ui(40) < .g-layer-interactive(60) < .g-layer-overlay(80)`；同层内按 prefab `mDepth` 由小到大排列（DOM 顺序决定），并在注释里写明 depth。跨层放错会让元素压住不该压的东西（例如揭晓里把 `midFrame` 放到角色之上）。
- **覆盖层必须绝对定位**：每个面板各有自己的 `GachaStage`（100% 高的画布）。概率详情 / 记录查询要与卡池面板**同时**显示，若不包在 `.gacha-overlay`（`position:absolute; inset:0`）里，第二个画布会被排到 100% 高度之外、被页面裁掉——此时元素仍「可见」（有非零盒子）但根本不在视口内，`toBeVisible` 断言发现不了，必须在测试里断言盒子落在视口内。
- **背景贴图来源**（`TextureLoad` 在 Awake 加载，导出里看不到引用）：`BG_main` = `gacha_cardbackground_main_output_blur.png`(2048×1024，与该 UITexture 尺寸完全一致)、`BG_main_blured` = `..._blured.png`(1024×512, scale 2)、`BG_HL` = `..._HL_output.png`(1680×1000)、`desk` = `elsa_desk_foreground.png`、`Draw/Heros` = 卡池主视觉（按贴图原始像素显示，对应源码 `MakePixelPerfect`，**不得固定宽高**，否则竖幅的蛋池主视觉会被横向拉伸）。`Draw/HerosName`（`gacha_chara_name.png`）内是测试用名字，网页不展示该层。
- **数据源**：`parsed/gacha.json`（卡池、星级权重 `tier.weight`、保底 `safe/firstSafe`、重复转化 `duplicate`、原表概率说明 `percTip`、指定伙伴 `upTypes`、礼包入口 `packDisplay`）+ `parsed/gacha-presentation.json`（角色揭晓立绘与抽卡台词）。构建期不重新生成候选池，由 `scripts/parse/gacha.mjs` 从 `raw/*Pool*.json` 增量附加展示字段。
- **抽取规则**（`utils/gachaSim.js`，纯函数）：按 `chance` 权重抽星级与候选；**只实现可在配置中证实的保底**——星级硬保底 `safe`（5★=36、4★=10）、一次性首次保底 `firstSafe`（首十连必出 5★）、指定伙伴 `guaranty`（作用于最高星级）。原表 `secondSafeMin/secondSafeMax` 的服务端语义未证实，模拟不采用，也不在页面编造解释。重复获得按 `duplicate.fragments/limit/overflow` 转记忆碎片与记忆结晶。
- **演出流程**：角色池 `pool → card（GachaCardPanel 相机开场+翻卡）→ reveal（GachaRevealPanel 三段式）→ result（结果一览）`；**蛋池不走 elsa 翻卡与 HeroGachaShowPanel**，改为 `pool → petcard（GachaPetPanel：PetGachaAniPanel 完整还原——开袋出蛋逐只揭晓）→ result`，覆盖层 stage 一一对应。Spine 演出由 `utils/gachaSpinePlayer.js`（极简 Spine 4.0 播放器：SceneRenderer + 显式皮肤 + PMA 上下文；直通 alpha 贴图载入时预乘；`fit:'bounds'` 按运行时包围盒取景——骨架数据头部 setup 包围盒会被未启用的战斗特效附件撑大，只用于 elsa/蛋袋，揭晓小人必须用 bounds）实现：
  - **角色池翻卡（GachaCardPanel）**：背景为 HeroGachaAniPanel/petgachaanipanel 的 TextureLoad `gacha_cardbackground_main_output_blur.png`（2048×1024 模糊版，**不是**清晰版 main_output——那是旧结论）。`elsa_rawcard`（艾尔莎与卡牌）+ `elsa_rawcard_desk`（桌面前景）双骨架同坐标空间渲染，desk 在上。流程 `startopen（开场相机：暗场 gacha_BG_in + 脸部特写 scale≈2.3 origin 50% 19% → 2.4s 拉回全景，近似源码 Timeline 0~2.67s 的 3D 推拉与 VolumeOn 后期）→ startopen_waitclick 循环（触摸继续 + tail_tip 金色脉动提示）→ 点击 → common/surprised × one/ten 翻卡（与源码 cardAni 四个 clip 同名，surprised = 结果含 5 星）→ end → 揭晓`。BGM 对应源码：`gacha_ready_chara` → 点击后 `gacha_show_chara`，翻卡起始 `card3`，稀有判定后 `card8`（普通 `card7`）。elsa 相机取骨架数据头部包围盒**按宽铺满、底边对齐**（桌沿贴住画布底边）。
  - **舞台缩放口径（`GachaStage` 新增 `fit` 属性）**：`'contain'`（默认，卡池列表页沿用，完整不裁切）| `'height'`（**游戏 NGUI UIRoot 口径：按高度缩放撑满，画布宽 = 视口宽/缩放，宽度随窗口延伸、窄窗对称裁切**）。抽卡演出三面板（CardPanel/PetPanel/RevealPanel）都用 `height`——此前 contain 信箱式导致「按键/构图比例与游戏不符」的观感偏差。另新增 `hud` 具名槽：不随画布缩放、直接锚定视口边缘，承载分享/跳过等屏幕边按钮（游戏 NGUI 锚定屏幕而非 1534 画布）。
  - **资源预热（点击抽卡零延迟）**：`gachaSpinePlayer` 增加模块级资源缓存（atlas/skel/贴图 fetch 一次进内存 Map）与 `preloadGachaSpineAssets(layers)`；两套骨骼清单集中在 `components/gacha/gachaSpineAssets.js`（PET/HERO_SPINE_ASSETS，`<script setup>` 不能 export 故单独成模块）。`GachaView` 进页 400ms 后台预热两套资源，抽卡面板挂载即命中缓存秒开（此前点击后要现拉数百 KB 资源才有画面）。播放器另补 `defaultMix = 0.12` 动画混合（备份实现同款）与 `pad` 取景参数。
  - **魔物蛋池（GachaPetPanel，`components/gacha/GachaPetPanel.vue`）**：`perform_bag`（二进制 .skel，皮肤 **`def`**——源码 `BuildSpineObj(..., "def", ...)`，构造器不会自动套用皮肤）。场景 = 模糊背景（TextureLoad ×3：`_blur`/`_blured`/`_HL`，开场 bgAniTween 1s：整体 scale 1.834→1.005、过曝与 HL 层淡出）+ 蛋池桌面 `gacah_pet_desk_foreground`（**1862×1104、中心 (-24,+30)**——游戏实机按原表 1680×1000 再 ×1.108 显示，逐帧视频混合对齐：书右缘 ≈-508、卷轴红结 ≈(+685,-261)；prefab 锚点/组件尺寸推算在该面板不可靠，**以视频实测为准**）+ 蛋袋（fit height 相机 **pad 1.08**——数据高 ×1.08 取景居中，袋身约占画布高 92%，备份实现同款口径）。流程 `idle_front 循环（每次循环播 card11）→ 点击 → open_blue/purple/gold（按本次最高星级 3/4/5★，袋口先透金光）→ open_idle 循环 → 约 0.5s 后出蛋：蛋运行时被回挂到 `Inbag`（clipRange 410×410 @（0,240)，y ∈ [35,445]）下，TweenPosition (0,-360)→(0,+40) 是 **Inbag 局部坐标 = 世界 (0,-120)→(0,+280)**——蛋从袋身后（裁剪区外）**弹到接近货架的高点 (0,+280)** 再落回菱形框 (0,+40)（rise onFinished 回挂 **outbag（无裁剪）**——fall/settled 阶段蛋移出裁剪区从高点落进菱形框（留在 Inbag 内会被下缘切掉下半）；蛋与袋子 open 动画**同时**开始（源码 WaitShowPet 的 0.36s 等待实测观感为「动画结束蛋才出来」，按实机对照取同起）；蛋按原生像素 × **scale(1.6)** 显示（真机 MakePixelPerfect 乘 UIRoot pixelSizeAdjustment，实机截图蛋占菱形宽约 6 成）；菱形/名牌在蛋开始下落时即淡入（落到时刚好加载完）；DOScale 0.8→1，OutQuad；蛋按纹理原生像素显示——MakePixelPerfect 覆盖序列化的 132×138/scale2，蛋纹理 110~155px 不等；ShineEft 光晕是面板级粒子、不在裁剪区内）→ 揭晓 UI（**`showPetUI` 组整体在 (0,+20)**，下列为组内坐标：菱形蛋框 eggDi = gacha_egg_{star+2} 300×300 @(0,0)、蛋图压框上、星级 gacha_star 72×72 逐颗 scale 2→1 间隔 0.12s @(0,-137)→绝对 (0,-117)、**star1..5 的 mDepth 递减即左边星盖住右边星**、星级在蛋落位后逐颗弹出（闪光层延迟期间必须不可见）**、名牌 gacha_egg_name 374×100 @(0,-183)→绝对 (0,-163) + 名字 36px #f8eedc（**用魔物名，蛋候选名去掉「的蛋」后缀**）、新获得 gacha_new 144×92 组内 @(94,96)、ShineEft 星色 1星蓝(0.27,0.4,1)/2星紫(0.95,0.44,1)/3星金(0.88,0.78,0.2)）→ 触摸继续逐只翻页（OnClickNext：旧蛋与揭晓 UI **SetActive(false) 瞬时消失、无飞走动画**，open_jump 后 `time`=0.36s 出下一只），最后一只关闭并发放奖励（BGM gacha_shop）`。分享/跳过按钮开袋后才出现，挂在 `hud` 槽按视口边缘锚定（左/右 24-28px、底部 24-30px + 安全区），尺寸按游戏 UI 的 0.85 比例（share 82×82、skip 109×51）；分享复制结果摘要，跳过直接结束。BGM `gacha_ready_egg → gacha_show_egg`，音效 `card11`/`get5`。**出蛋动画写法（2026-09-14 校正，实机视频对照）**：升起/落位/飞走动画必须挂在 `.pet-egg__inner` 包裹层，蛋图保持静态 `translate(-50%,-50%)` 居中——关键帧直接覆盖图片 transform 会丢掉居中基准并把缩放叠到 ≈1.7 倍（蛋撑满菱形的「变形」根因）；蛋终态 = **纹理原生像素、落位 (0,+40)**（prefab TweenPosition to），光晕包裹层落位后淡出让位菱形框；旧蛋飞走约 0.8s 升到货架高度、末端才淡出（实机视频 3.8s/14.6s 帧可见），承载节点须存活到动画结束。
  - 「跳过」按钮（gacha_btn_skip @(612,-330)）直接进入揭晓；WebGL 不可用或资产加载失败时演出自动跳过，不阻塞抽卡。
- **结果一览**（`GachaResultPanel.vue`，`HeroShowUI`）：抽取按钮按本次次数**只显示一个**——单抽 `onceButton`（com_btn_N_sp 红钮 @(196,-316)）、十连 `tenButton`（com_btn_Y_sp 青钮 @(487,-316)），文案「招募/购买一次/十次」，上方消耗行与卡池页同款（`券 ×N 或 货币 ×M`）。右上角为**货币条 + ✕（com_btn_close）**：无音效开关，整行右锚定回 prefab 原位 526；货币条槽位与卡池页共用 `utils/gachaCurrency.js` 的 `buildCurrencySlots`/`buildDrawOptions`（DRY）。揭晓的「跳过只保留 5 星」只作用于揭晓自身的展示副本（`displayItems`），**禁止 splice 共享的 revealItems**——结果一览始终展示完整名单。
- **本地状态**（`stores/gachaState.js`，persist）：保底计数、模拟记录（上限 300 条）、已拥有、记忆碎片、记忆结晶、**模拟钱包**、音效开关。**这些都不是账号数据**：页面在标题横幅正下方常驻标注「模拟招募 · 抽卡资源与数据均为本地推演」（已抽时附加次数后缀，浮于卡池画面最上层，左缘对齐 −631 基准），「重置」清空当前卡池保底与记录，并把模拟钱包还原为默认额度；不模拟余额上限、限购与已售罄。
- **货币条**（`TopRight` 的 `SmalInfoTip` ×4）：按 prefab 槽位还原 —— 每槽为 `bg`(`com_top_item` 154/136×28，pivot=Left，位于 -23) + `icon`(36×36 @0) + `Label`(90×24 @61) + `add`(`M_rt_btn_add` 40×40 @119)。显隐与位置遵循 `HeroPoolUI.InitRight`：**角色池**显示 消耗券(-304)/氪金(-152)/神晶(+17) 且隐藏银币，**魔物蛋池**显示 银币(-304)/消耗券(`tipPosX[3]`=-116) 且隐藏氪金与神晶。货币名称与图标一律取公共 `gameMappings.BASE_REWARD_ICONS/NAMES/PATHS`（DRY 红线），消耗券名称与图标取卡池 `costs[0]`。数值为**模拟持有量**：不足时按游戏口径变为危险色（`Const.ColorString[7]`），并同时禁用单抽/十连；消耗券在每次抽取后扣减。
  - 钱包起算值 = 原表 `playerInit.json` 的初始配置量（`money/ke/payKe` 与 `initItems`）与页面固定**模拟额度**（货币 30 万银币/2000 氪金/100 神晶、每种消耗券 100 张）逐项**取较大值**——不得相加，否则 `playerInit` 自带的普通招待券 ×1 会叠成默认 101 张。`add` 按钮每次按 `SIM_TOPUP` 常量补充（券 +10、氪金/神晶 +2000，与起算额度相互独立），重置后回到该基准；基线随常量/原表刷新，未动过的旧镜像钱包（新旧基线键集合一致、仅数值随常量变化）在进入页面时一并迁移。**禁止**把余额表述为账号库存，也不得用 `playerInit` 冒充当前持有。
  - 相邻货币槽在 prefab 中本就轻微交叠（内容宽 162、间距 152/169），游戏靠 NGUI `mDepth`（`add`=7 > 下一槽 `bg`=5）保证「+」可点；网页端必须用 `pointer-events` 复现同样的可点性（容器与背景不接事件，只有 `add` 按钮接）。**同一个 depth 关系也决定可见性**：`add` 在 +119、40 宽（+99…+139）会越出本槽范围落进下一个槽的盒子里，同层时后续 DOM 的底板会把它压住一半，必须给 `add` 加 `z-index` 提到兄弟槽之上（或按 depth 重新分配层）。
  - **行末锚点与音效开关**：prefab 货币条底牌右缘在 design 526，本页为在货币条与关闭按钮（✕ 从 537 起）之间放入音效开关（本页新增控件，中心 498、与 ✕ 同一水平线），整行右锚定左移至 **462**。游戏图集中唯一的音量图标是 `chara_btn_voice(/_press)`（HeroInfoPanel_Atlas 72×72），关闭态用灰化变暗表达、不渲染「开/关」小字。
  - **每个货币槽的位置按 `HeroPoolUI.InitRight` 分支取**：**卡池名含「特别」的池优先判断且不分角色/蛋池**，与普通角色池同样显示 消耗券/氪金/神晶 = `tipPosX[0/1/2]`(-304/-152/+17) 且隐藏银币；只有普通蛋池显示 银币 = `PoolUiTitle` 里的 `tipPosX[4]`(**+35**)、消耗券 = `tipPosX[3]`(**-116**) 且隐藏氪金与神晶。别把两个分支用同一组坐标，也不要只按 `kind` 判断而漏掉「特别」分支。
- **字号以 prefab 的 `mFontSize` 为准**（不要凭观感取档）：页签 26、保底提示 20、`概率提升！`/`指定伙伴` 28、抽取按钮文案 24、`概率详情/记录查询` 18、消耗行 `×N`/`或` 20、记录表头 18 / 记录行 20、弹层标题 22、货币 Label 20、分页标签 24。`gacha.css` 的 `.g-text--md` 即 20px 档。标签的 `mWidth` 是**框宽**、不是可见文字宽度，pivot=Right/Left 时按框边对齐。
- **文本颜色按 prefab UILabel 序列化色**（4.24包/MonoBehaviour 的 UILabel dump）：招募/购买一次 #cfba96（ColorString[2] 米金）、招募/购买十次 #33dad0（ColorString[6] 青，配青钮）、消耗行「或」#cfba96、永·久·开·放与概率详情/记录查询按钮 #cfba96 18px、tip 弹层标题 #533e26 22px；货币数字/消耗行 ×N/保底提示/页签为运行时文本（米白系，WithColor(1)，不足变红 WithColor(7)）。`.g-text` 基类为米白 #f8eedc，上述元素各自覆盖。
- **抽取消耗行在按键外**：`[券] ×N 或 [货币] ×M` 不放进按键——底板用 `gacha_btn_tag`（HeroPoolPanel_Atlas 64×32，深棕核心、四周软渐变无装饰，图集 border 全 0 即整图拉伸），悬浮于按钮中心上方 52（y=-264，min-width 292 与按钮同宽、高 34，可见底边距按钮顶边约 4px，`pointer-events:none` 不拦截点击），与游戏截图一致；按键内只有「招募一次/十次」文案。
- **三段式揭晓**（`GachaRevealPanel.vue`，对应 `HeroGachaShowPanelUI.PlayGachaShowAnim`，**仅角色池**；蛋池揭晓在 GachaPetPanel 内完成）：
  **step1** classStars 大星在角色身后中央逐颗弹出（节奏取自源码 `InitStar`：3★ 0.25/1.6s、4★ 0.75/1.9s、5★ 0.5/2.25s，星间距 5★ 0.2s 其余 0.08s；音效 card2 首颗 + card9 逐颗；`HideStarIE` 在 step1 完成后 0.2s 隐藏大星并显示 (0,-171) 的星级行）→ **step2 backFrame**（`backFrameTweenPlay` 30 段：spGachaColor01 740×740 属性染色光晕 → spGachaBox02/Box01 菱形双框弹入 → 四向角饰 Step1Pos (0,±460)/(±460,0) 与四方块 (±194,±194) scale 2→1 后 1↔0.275 呼吸；**Q 版小人同屏**：heroAnimRoot @(0,-114) 挂 `hero.viewData` 骨架（gacha-presentation 的 Npc_XXX，scale 0.95）进场即播 `win → win_idle`，约 3s（tween[28] = win 时长，上限 3s））→ **step3** 立绘（heroPic/heroPicShadow 712×936，按 `hero.ImgPos + general.gachaCharaOffset` 定位；产物无 ImgPos，网页居中缩放）+ 名称标签 + 台词打字机 + 新/重复角标 + textRing 旋转。
  - **点击跳段按稀有度**（源码 `Click`）：3/4 星一击直达 step3；5 星第一击跳过 step1+2、第二击进 step3；新角色在「新获得」徽标动画期间点击无效（newHeroSkip，网页 1.5s 后放行）；step3 中点击 → 换人（源码转场 #43848：台座/小人 0.5s 滑出右侧）。音效 card10 进 step2、card12 step3（rare≠3）。「跳过」等价 `HeroGachaShowPanel.Skip()`：跳过后只保留 5 星继续展示。
  - **几个 UITexture 的贴图按尺寸与语义对应**（原 prefab 里是运行时赋值，导出看不到引用）：`lineAlpha` 974×974 = `spGachaLine01`(958×958)、**`ring`/`textRing` 866×864 = `spGachaTxtRing01`(850×848)——这是符文文字环本体**（TweenRotation `textRingRot` 0→-360 8s 匀速、alpha 0→0.75，白色符文按属性染色，不是花纹环）、`midFrame` 492×492 = `chara_bg_center_only`(1080×1080，**仅 3★ 可见**——`InitStar: midFrame.alpha = (rare==3)?1:0`)、`Rconer`/`Rconer2` 1700×1220 = 同名图集精灵（alpha 0.25 / 0.05；**网页版不渲染**——浅色圆角框贴图在宽视口下软边带露出屏幕两侧，揭晓与结算均已移除）、菱形双框 = `spGachaBox02`(1024 外)/`spGachaBox01`(975 内)、属性染色光晕菱形 = `spGachaColor01`(740，tween[5] alpha 0→0.5)、四角闪块 = `spGachaStar02`(410，四角自带闪块)、台座 = `spGachaDitai01`(380×380 @(0,-116))。**不要**拿 `spGachaBlock01`（中性灰方块）当角色底盘——它会把立绘压得发灰。
  - **揭晓背景**：底图 = 揭晓 prefab 专属暗黑殿堂 `bg.png`（uipanel/herogachashowpanel，UITexture 1700×1220 depth 0）——**此前「揭晓仍见商店」的结论是错的**（2026-09-12 游戏截图对照纠正）；蛋池的桌面场景属于 GachaPetPanel（模糊商店背景 + `gacah_pet_desk_foreground`），不进本面板。属性染色取 prefab `elementColors`：水 rgb(0,122,204)、火 rgb(173,41,13)、风 rgb(128,148,26)、地 rgb(140,102,0)（`InitElementColor` 作用于 elementSprite/elementTex/elementPar，网页用 mask+背景色与 drop-shadow 等价实现）。
  - 名称组坐标取自 prefab：`name` 48px、pivot=Right、右端在 (128,-70)；`block` 56×56 @(158,-68)；属性/职业标签在 (94~131,-126)；`elementIcon` @(510,122)、`classFrame`/`classIcon` @(573,79)；`newIcon` @(464,-108)。立绘挂在 `heroAnimRoot` (0,-114)，网页用 `chara/l` 立绘居中缩放（游戏是 Spine 骨骼）；Q 版小人画布 460×460 挂 @(0,-10)，`fit:'bounds'` 取景。布局注意：`.g-abs` 靠 `transform: translate(-50%,-50%)` 居中，**凡做 transform 动画的元素必须包一层静默 g-abs 容器、动画只挂内部 img**，且收缩包裹内负 margin 会把 shrink-to-fit 宽度算进居中基准（蛋框曾因此偏移 75px）。
- **弹层**：概率详情与记录查询共用 `GachaTipPanel.vue`（prefab `heroPoolTip`）。游戏中 heroPoolTip 是 HeroPoolPanel 的子面板，打开时卡池页仍在背后可见——舞台用 `clear` 变体（底色透明）+ 0.5 黑遮罩压暗，不再用实底黑盖住卡池页。概率正文区**隐藏原生滚动条**（游戏无可视滚动条），有更多内容时显示项目通用的方向提示箭头（NavigationMenu `.side-scroll-cue` 的折角箭头形制，**不带渐隐底**，随滚动位置显隐）；记录查询为分页制，**两个滚动条均隐藏**；点面板外的遮罩任意空白区域关闭弹层，点面板空白底板**不**关闭（遮罩挂在弹层根 `.tip-root` 上、盖满整个窗口而非仅画布；`.tip-root .gacha-stage` 对点击透传、仅内容可点，竖屏提示条排除在外）。页签头像牌按卡池类型分开定尺寸：魔物蛋页签 height 84（贴图原生 184×84、左右透明边距让底板边框透出），伙伴页签 height 66、left calc(50% - 64px)。（概率详情 + 记录查询；此前给记录列表补的装饰滚动条已按用户要求移除）。标题条为**通栏平底灰带**（800×36、直角、#a09783，无圆角不留边），标题文字深棕。表头文字暗金（ColorString[15]）、行文字深棕（ColorString[10]）；页码按源码 `"1".WithColor(15) + "/N".WithColor(10)`——当前页暗金 #a36f0a、`/总页` 深棕 #533e26。`.g-text` 无 text-shadow（游戏文本无阴影）。卡池页 `<button>` 若自身不带 border-image 必须显式 `border: 0`（UA 默认边框会显示为细灰框）；自带 border-image 的元素（mini/draw 按钮）禁止写 `border` 简写——简写会把 border-image 一起重置掉；同理这类 `.g-abs` 定位的按钮不能加 `position: relative`（会覆盖 `.g-abs` 的绝对定位导致按钮跑位）。全项目 `<button>` 凡不用 border-image 的（含 tip-panel__close、result-share/close、reveal-skip 等图片子元素按钮）一律显式 `border: 0`。border-image 在亚像素缩放下切片边界会露出 1px 渲染缝隙——按用户要求不做补丁处理，接受该缝隙。分页按钮底图独立成层，下一页水平翻转使箭头 ► 朝右。正文颜色按源码 `ReplaceDescValue(percTip, 10, 15)`：整体 `Const.ColorString[10]`（#533e26 深棕），`{值}`/`<值>` 为 `ColorString[15]`（#a36f0a 金棕）。
  - **面板底色**：游戏截图采样为**平的米黄纸底 (205,197,178)**、四角轻微做旧暗角，无边框无纹理（此前两版深色底均为误判）。记录行规则按源码 `RefreshRecordUI`：底色条仅 `rare >= 4` 启用（4星粉 / 5星金，3星无条；宠物蛋档位 rank≤3 全无条），色块为**通栏 800 直角**（贴边无空隙，不用 item_info_color 贴图的圆角切片），每行之间有 1px 深棕半透明分隔线；表头底图通栏 800（其下缘即表头与首行之间的分隔线，不留边）；表头文字暗金、与行同字号 20px、行文字深棕。概率正文直接使用原表 `percTip`，按游戏 `HeroPoolTips.GetFormatRaceStr` 规则替换 `{rareNList}` 名单，其余 `{值}` 交给公共 `gameMappings.formatHighlightedText` 高亮；记录查询展示本地模拟记录（游戏走服务端分页，静态图鉴没有账号数据）。
- **9 宫格**：需要跨尺寸拉伸的精灵统一用 `border-image`，切片值**取自图集元数据** `mSprites[].borderLeft/Right/Top/Bottom`（`4.24路资源包/.../uiprefab/*_Atlas.json`），禁止目测；`gacha_page`、`com_btn_N_sp`（单抽，红）、`com_btn_Y_sp`（十连，青）为 `0 60 0 60`，`com_btn_mini` 为 `0 24 0 24`，记录行为 `0 8 0 8`。切片只拉伸中间 8px 带、左右各 60px 角保持原尺寸，因此按钮精灵自带的上下软边会被拉成「边缘淡」的阴影——**不需要额外的阴影资源**，prefab 的 `One`/`Ten` 也只有 UIButton+UIPlaySound+UISprite。
- **布局推导**：`UIGrid.arrangement` 中 `0=Horizontal`、`1=Vertical`。卡池页签所在的 `Toggles` 是 **Vertical**（`cellHeight=90`），因此页签自 (-484,135) 起向下竖排，左侧 `fb_page_black`（480×750）正是这列压暗底板；`recordObj` 的行网格同样是 Vertical（36px 行高，与源码 `pageSize = viewSize.y / 36` 一致）。
- **与游戏的差异**（有意为之）：未实现卡池物品格 `itemTemp` 与泰坦灯烛/灯光粒子、未接入 BGM 与语音（只播放 `card2/card9/card10/card12/get3` 翻牌音效）、未实现 3D Timeline 演出（`gacha_elsa`/`gacha_BG` 的 16 个 AnimationClip + PlayableDirector）与 83 个粒子系统（用 CSS 动画近似）、立绘未按 `hero.ImgPos` 精确定位（产物不含该字段，改为居中缩放）；货币条为模拟额度而非账号余额。
- **窄视口处理**：设计画布是 1534×750 的横屏比例（2.045），竖屏容器只能等比缩成一条窄带。此时 `GachaStage` 给出**非阻塞**的横屏提示（`pointer-events:none`，不接管点击、不改变构图），画面仍完整不裁切；禁止改成「按宽度铺满」而切掉左右内容。判断依据：`gachaFitScaleByHeight`（游戏 UIRoot 的按高缩放）明显大于实际 contain 缩放。
- **URL 参数**：`?kind=hero|pet`、`?pool=<poolId>`、`?view=pool`（打开概率详情）双向同步，均为 `router.replace`，保留其他查询参数。
- **音效（`utils/gachaAudio.js`，2026-09-13）**：全部演出音频走模块级单例，不再由各面板各自 `new Audio`。语义：`playBgm(name)` **同名曲正在播时什么都不做**（不重启、不断点），换曲才切；`setSoundEnabled(false)` **暂停当前 BGM 并保留进度**、`true` 时从原进度续播；离开 `/gacha` 由 `GachaView` 统一 `stopBgm()`，**面板卸载不停 BGM**。曲目按源码切换：卡池页 `gacha_shop` → 翻卡 `gacha_ready_chara` → 点击后 `gacha_show_chara` → 揭晓 `gacha_show_chara` → 结果/结算回 `gacha_shop`；蛋池 `gacha_ready_egg` → 每只 `gacha_show_egg` → 收尾 `gacha_shop`。BGM 元素默认 `preload='none'`（单支 7~17MB，进页预取会与贴图抢带宽，曾把卡池主视觉的加载拖到图片断言超时）。
- **揭晓层级（2026-09-13，按 prefab `mDepth`）**：立绘 40 < 名牌底 59 < midFrame 60 < 台座 61 < 属性/职业图标 65/66 < **Q 版小人 75**。此前 DOM 顺序让立绘盖住小人（表现为「小人没做出来」）。立绘按 `heroPic/PIC` 的 712×936 @(154,-110) 摆放（高度收敛到设计画布 700，避免切掉头顶）；小人 `heroAnimRoot` @(0,-114)、`scale 0.95`、画布 380×380（对齐台座 `spGachaDitai01`），并需在 `GachaStage` 量到画布缩放**之后一帧**再设画布分辨率。名牌 `nameBase` 按 pivot=BottomRight 落在 (0,-14)。
- **蛋池结束状态 = `GetRewardTip`（2026-09-13，2026-09-14 校正）**：`GachaPetResult.vue` 还原结算弹层——`mask`（prefab `GetRewardTip.mask` = UISprite #70307，PathID 与脚本字段一致：sprite 名 "white" 但染色 rgba(0,0,0,0.502) —— **黑 50% 压暗**卡池页；此前按 sprite 名误判为白冲洗，实机截图为暗） + 底板 `item_get` 1534×472（原图 border 全 0，整图横向拉伸是原设计）+ 标题条 `item_get_titel` 220×44（**水平居中**，实机截图核对）+ `ItemBagCell` Large（`item_f_{quality}` 128×128、图标 80×80 @top55%、**连体星条仅魔物蛋显示**（`CheckPetEggItem` 仅 `isPetEgg`）高 34 @top19、数量 18px #f8eedc（ColorString[1]）+ 深棕描边 rgb(23,14,7) 在帧右下内缩 ≈8/4px、**魔物蛋不显示数量**；品质档取 `quality`——蛋池 `rank` 是 rare1/2/3 保底档位不是显示星级）；结算条目 = 蛋 + `petPool.reward`（mowuPool_1）聚合赠品（源码 `ResponsePetRouterGacha`：`rewardData.reward += data.reward`，每抽赠 1 个翼型徽印 ×抽数聚合一条，用 `parsed/gacha.json` 的 `pool.bonus`），逐格 0.1s + `itemGet` 音；点击两段式：第一下补完剩余格（不关）、第二下关闭回到卡池页。结算格与结算卡在游戏里都**不可点击跳转图鉴**（整层点击 = 补完/关闭）。角色池仍走 `HeroShowPanel`（`GachaResultPanel.vue`），两者在 `GachaView` 按 `kind` 分流，**不得共用同一面板**。
- **结果一览真值（2026-09-14 按 prefab `backups/gacha-recon/05-HeroShowPanel.txt` 全面校正，推翻 09-13 的「3-4-3」结论）**：结果页是**蜂窝错半格网格**——中排 4 张（序号 0/3/6/9，x=-420/-140/140/420，y=0）、上排 3 张（1/4/7，x=-280/0/280，y=140）、下排 3 张（2/5/8，x=-280/0/280，y=-140），列步进 140、行距 140、卡片 256×256（`gacha_card_botm` 原始尺寸），对角相邻互相咬合；单抽 `heroSingle` 居中。卡片在游戏里**不可点击**（`HeroShowItem` 无交互）。每张卡内部（以 256 卡中心为原点，y 向上）= `gacha_card_botm{rare}` 256 底板 + 卡面 `gacha_at*.png` 200×200 居中 + `gacha_card_frame{rare}` 224×224 + `gacha_card_class{job}` 64×64 @(68,-40) / `gacha_card_atr{element}` 64×64 @(102,-6)（右中区域，**仅「新获得」显示**——两者在 prefab `new` 组内，重复获得卡无角标）+ `gacha_card_new` **60×24 原尺寸**（tween `scale 3→1`，起始放大倍数不是终态）@(0,-48)（下缘居中，仅新角色）+ 重复获得：`gacha_card_reget` 阴影底衬 240×68 @(0,-48)（depth 25，压边框、垫角标与碎片）+ **小拼图碎片图标**（`chara*_p` 是「头像嵌小拼图」图标，非大半身图；渲染 sprite 108 ×0.5 ≈ 54px，中心 (-30,-40)，紧挨 ×10 左侧）+ ×N 20px @(18,-40)；**碎片溢出转化**（源码 `CheckHeroExcit` case "3"）：`converted` 时同位改显示记忆结晶图标（`duplicate.overflow.icon`）与转化数 `overflow.count` + **`com_stars_{rare}` 连体星条** @(0,-77)（3/4/5 星 = 96/120/144×48）；**不显示名字文本**。入场 `popUpAni` 由 `localScale (0,1,1)` 横向展开，逐格 0.15s 播 `card` 音（**index 1/4/7 跳过音效与间隔**，源码硬编码）。结果页打开时继续播 `gacha_show_chara`，关闭（`HeroShowPanel.Close`）才回 `gacha_shop`。舞台用 `fit="height"`（NGUI 按高缩放，画布精确铺满视口），背景 `bg.png` 以 `inset:0` 整幅铺满——整屏层**不能挂 `g-abs`**（`translate(-50%,-50%)` 会把 inset 盒子推出左上只剩部分覆盖，表现为半屏明暗矩形接缝）；**不放 Rconer/Rconer2 压角层**（1700×1220 浅色圆角框贴图，宽视口下软边带会露出屏幕两侧，游戏结算背景组合里没有这两层）；背景按实机截图提亮（`brightness(2.1) saturate(0.85)`——游戏结算的 `bg_bottom + bg_toplight` 组合观感远亮于揭晓殿堂原图）。**WebGL 资源释放**：`gachaSpinePlayer.createSpineScene` 的 `dispose()` 必须同时释放场景内创建的 `GLTexture`（`renderer.dispose()` 不含图集纹理）——揭晓每换一个角色重建一次场景，不释放则每次泄漏一整张贴图，多次抽卡后显存耗尽会把整个窗口挂死（无法点击、无法打开开发者工具，而 JS 主线程仍响应）。
- **揭晓 step2/名称组（2026-09-14 校正）**：step2（backFrame 构建）时长 = 源码 `tween[28].duration`——**3★ 固定 1.05s**（`InitStar` 的 `delayWin`），4/5★ 为 Spine `win` 动画时长（上限 3s），不得对所有星级一刀切 3s。step3 名称/标签组按 prefab：`nameRoot(248,-104)`（name pivot=Right 右端 `(128,-70)`、block `@(158,-68)`）、`classRoot(246,-126)`（classText 左缘 94 / elementText 右缘 131 / elementTextBase 320×320 中心 `(104,-126)`，整排在 y=-126）、`elementIcon @(510,122)`、`classFrame/classIcon @(573,79)`；星级行 = `stage(0,-118)` 下 `stars2(0,-53)` → 绝对 `(0,-171)`，step3 随台座移到 `(360,-171)`。跳过补展示剩余 5★（`ShowRest5StarHeroTime`）每只开头播 `get3`。
- **已知骨架限制（2026-09-13）**：`Npc_007`（拉碧丝）的 `.skel` 与资源包逐字节一致且为 Spine 4.0.09，但 spine-webgl 4.0.31 解析后附件错乱；`GachaRevealPanel` 用 `BROKEN_CHIBI_SKELETONS` 名单让这类角色改用卡面 `gacha_at*.png` 静态代替（名字清空即恢复 Spine 演出）。骨架清单/真值与缺口见 [GACHA_REPLICA_AUDIT.md](features/gacha/GACHA_REPLICA_AUDIT.md)。
- **整屏层的写法（2026-09-13，踩坑）**：铺满舞台的层（开场暗场 `card-dark`、结算 mask 等）**必须用 `position:absolute; inset:0`，不要再叠加 `gachaPos()`**——`gachaPos` 会写 `left/top: 50%`，与 `inset:0` 的 right/bottom 叠加后盒子只剩右下四分之一，表现为画面中间一道硬边「阴影」（曾实测盒子 916×408 / 应 1832×816）。
- **Spine 舞台不要做 CSS 放大**：`elsa_rawcard` / `elsa_rawcard_desk` / `perform_bag` 骨架内部自带背景、桌面等大贴图，对画布做 `transform: scale()` 会把这些贴图的边缘露出来形成硬边（角色池开场推近改由背景整幅贴图承担，1.35→1.0 / 2.4s）；蛋袋取景用 `fit:'bounds' + padding`（1.3）。
~~~~

## 2. docs/SPEC.md：招募数据

~~~~text
### 招募数据

招募模拟页面曾于 2026-09-11 按要求下线，2026-09-12 以「模拟招募」形式恢复：页面路由 `/gacha`（见 §九.9.8），素材、演出手法与坐标推导来自游戏 `HeroPoolPanel` / `HeroGachaAniPanel` / `HeroGachaShowPanel` / `HeroShowPanel` 原始 prefab。构建脚本 `scripts/parse/gacha.mjs` 的产物 `parsed/gacha.json` 同时供 `remainingItemSources.js` 做物品反向获取途径分析，两条用途共用同一份数据，不再维护第二套。
~~~~

## 3. docs/SPEC.md：吉祥物站位统一：

~~~~text
吉祥物站位统一：全部 34 名角色主插画和选择预览共用 320×400 画布，主插画桌面宽 192px、矮窗口宽 144px；待机与思考的身体落脚中心统一为 (162,369)，不按包含武器、篮子、尾羽的整幅外接框定位。非关节 SVG 按 `MASCOTS.groundX` 在加载时平移装配，不改变角色局部比例和动画轴；切角色不能改变画布尺寸、控制行或脚底基准。问号统一放在右上方，尾巴指向左下的人物，菲莉娜不再保留左侧例外。

吉祥物大小统一：`MASCOTS.standingHeight` 记录待机第 0 帧的可见轮廓身高（不含地面阴影），`getMascotScale` 将其等比例归一到 312 模型单位；桌面显示约 187.2px、矮窗口约 140.4px。每人只使用一个固定比例，围绕公共落脚点缩放；选择预览同样应用。禁止按思考/坐姿的实时外接框重新缩放，保留胖瘦、发型和服装比例；关节模型的道具和人物一起缩放，保持握点、坐垫与鱼线连接。

**右栏吉祥物**：`SidebarMascot.vue` 按 `public/test2/hero/hero-models.json` 覆盖全部 34 名角色，默认 001 希尔。首批 001、055、062、053、034、049、002 保留原风格；其余 27 名按同样的细描边、平涂和分区阴影重绘，全部为四动作关节角色，不内嵌 PNG。素材放在 `src/assets/mascot/`，共用 `idle.css` 的呼吸、眨眼与轻摆待机动画。App 在非原生、宽度 ≥1025px 且高度 ≥700px 的普通 Wiki 页面按需加载，招募独立布局不挂载。插画处于说明下方正常布局流并靠右下，装饰不截获点击。公共 `UiButton` 提供播放/暂停与角色切换，分别记忆暂停偏好和所选角色；后台及不可见时暂停，减少动态效果时保留静态插画与角色选择。

点击“切换”用公共 `UiPopover` 向上展开每批 7 人的角色选择窗，共 5 批、末批 6 人。标题旁的“‹ 上一批 / 下一批 ›”沿用手机邮件页箭头样式，并显示批次；首尾禁用越界按钮，翻批只更新候选列表，点选才切换角色，重新打开定位当前角色所在批次。沿用右侧栏 `paper-panel corner-nails` 的羊皮纸底色与棕色描边；点选成功后收起，点窗外、Esc 或路由切换关闭。`UiPopover` 是锚定按钮的非模态选择层，Teleport 到 body、防止侧栏裁切，登记 `useOverlay`（6003），不加遮罩或锁正文滚动；详情和系统弹窗仍一律用 `UiModal`。模型源 SVG 通过 `?raw` 随懒加载侧栏模块进入；独立 SVG 请求和静态预览仅针对当前角色及展开的批次，翻批取消旧批待完成请求，成功资源内存缓存；失败保留当前角色与存档并允许重试。不引入动画引擎，不下载或修改参考 PNG。

吉祥物动作能力以实际注册的关节模型为准：当前 34 名均支持四动作，目录不再保留 `idleOnly`。切换角色保留动作偏好；预览禁用动画，暂停、后台不可见和减少动态效果沿用公共机制。后续 27 名以人工编写曲线路径重绘，头发、头部、服装、武器和配饰按语义拆件；禁止用整图平涂旋转冒充关节动作。

后续模型配置分为 `mascotRedrawnModels.js` 与 `mascotRedrawnBatch3/4/5.js`，共享关节求解和场景流程，分别适配绷带、火焰、盔甲、爪靴、异色袜靴等。SVG 文件保存绘制分件，页面与预览由 `MascotFigure` 补齐真实关节四肢，裸分件 SVG 不是最终完整姿势。`scripts/dev/mascot-drawings*.mjs` 和 `mascot-drawing-details.mjs` 保存离线曲线绘制源，`review-mascots.mjs` 生成原图与四动作对照图，检查边界、缺失肢体及浏览器 SVG 错误。

服饰精修使用可选的关节局部分件 `upperArm/cuff/thigh/shin/boot`；带 `-left/-right` 的分件优先于双侧共用版本。肩袖随上臂、袖口随手腕、腿饰随对应腿段，不能把服饰固定在身体上冒充关节适配。首批七人无这些分件时保持原样。佩饰层级由模型 `satchelLayer` 指定：默认在身体后，`waist` 在躯干前、手臂后，`shield` 在手臂前；每次只渲染一份，仍复用同一坐姿轨迹。形象检查必须同时查看原图与完整装配的待机、思考、秋千、钓鱼画面，特别核对配件是否实际可见；仅在 SVG 源码中存在不能视为检查通过。

关节动作：全部 34 名角色均支持待机、思考、秋千、钓鱼及完整进出场。动作按钮打开公共 `UiPopover` 点选；切换角色时不支持的场景回退待机，切换到另一关节角色则保留动作并取消旧角色尚未结束的片段。思考分段抬臂、托腮、偏头，停留时轻动手指、变化视线并渐显问号，退出时先收手再回正头部。秋千采用握绳坐姿、同悬点摆动与小腿随动；钓鱼采用坐姿握竿、看漂、咬钩和提竿收线。全部沿用暂停、刷新记忆与减少动态效果规则。

关节模型由 `MascotScene` / `MascotFigure` 装配，`MascotArm` / `MascotLeg` 共享手臂和髋膝结构；`mascotModels.js` 集中配置角色的原 SVG 分组、肩点、臂长、托腮握点、手型、服装配色与随身物件。希尔保留手套、绑腿和辫子，迦南保留裸手、褶边袖口、护腿、长靴、佩剑和披风；迦南坐姿时佩剑略贴背、披风收短，起身连续恢复。米托拉保留红白长发、披肩和水晶吊坠，使用交叉绑带袖口、左侧露指手套及不对称袜靴；坐下时长发沿发根收拢，起身连续恢复，头部保留原 .9 比例，托腮握点独立适配。露比特的菜篮和园艺手套、艾薇杜尔的灯杖和长袍、露帕的法杖和披风、菲莉娜的尾羽/箭筒与爪靴分别拆分适配；随身物件在坐姿收拢，双手可握绳/拿竿，露帕有独立托腮袖管投影比例。34 名角色四动作画布统一 320×400（桌面宽 192px，700~780px 高的窗口宽 144px），选择窗也复用模型。道具握点共用，关节长度各自适配；新增角色仍需拆件并检查握点与遮挡，不能只换颜色便视为完成。

手臂默认以手掌中心求解，将掌心偏移纳入前臂可达距离，手腕顺着前臂，禁止用固定手腕角度造成反折。思考使用独立双臂姿势，肩肘腕一起抬起，另一只手自然垂落；前臂循环仅保留轻微活动，不再从待机肘点旋转整只前臂至下巴。秋千和钓鱼均检查左右肘低于肩点；自由换姿按肩角与相对肘角插值，拿竿/放竿按同一道具轨迹解算握点，避免切换弯曲分支时跳帧。

思考以原版斜托下巴为姿势参考：托腮肘点向外，前臂斜抬，避免竖直拳头顶脸。该姿势允许专门配置折叠袖管的投影比例，上下段总长度与手掌缩放不变；换姿时袖管轮廓、肘点和腕点同步插值，不能在姿势完成时突然替换长短袖管。秋千和钓鱼继续使用各自已适配的比例与握点。

共用流程包括秋千出现 → 靠近 → 握绳 → 坐下 → 轻荡，离开时减速 → 松手 → 跳下 → 落地 → 走开 → 收起；钓鱼包括凳子/道具出现 → 侧身坐下 → 伸手拿竿 → 放线到潭心 → 看漂，离开时回稳 → 收线 → 放回竿 → 松手起身 → 走开 → 收道具。`useMascotChoreography` 保留同一个人物节点，当前进出场完成后响应最后一次动作选择；暂停和后台冻结片段，减少动态效果或已暂停时主动选动作直接显示目标静态姿势。水潭与靴子、凳子之间保留岸边，鱼漂与鱼线全程相连。
~~~~

## 4. docs/ARCHITECTURE.md：- 模拟招募 /gacha

~~~~text
- 模拟招募 `/gacha`（`GachaView.vue` + `components/gacha/`）：按游戏原素材还原的卡池页与演出，属「业务皮肤」例外，不进通用 UI 出口。设计画布固定 1534×750、原点居中，由 `GachaStage.vue` 统一等比缩放（`utils/gachaLayout.js`），子组件用 prefab 原始坐标定位、不做响应式重排；`assets/gacha.css` 只服务该页面，9 宫格切片值取自图集元数据 `mSprites[].border*`。抽卡规则集中在纯函数 `utils/gachaSim.js`（星级权重、`safe/firstSafe` 保底、指定伙伴、重复转碎片与结晶），本地模拟状态在 `stores/gachaState.js`（persist），页面必须标注「模拟」——余额、限购与已拥有不属于静态图鉴。数据来自 `parsed/gacha.json`（`scripts/parse/gacha.mjs` 增量附加原表 `percTip`/`upTypes`/`packDisplay` 等展示字段）与 `parsed/gacha-presentation.json`（含揭晓小人的 Npc 骨架名与皮肤）。职责拆分：`GachaCardPanel.vue` 还原 `HeroGachaAniPanel`（模糊背景 + 开场相机推拉 + elsa_rawcard 翻卡，仅角色池）；`GachaPetPanel.vue` 还原 `PetGachaAniPanel`（背景 bgAniTween 开场 + 蛋池桌面 + perform_bag 开袋出蛋 + 逐蛋揭晓 UI，蛋池全程在本面板内完成，不走 HeroGachaShowPanel）；`GachaRevealPanel.vue` 还原 `HeroGachaShowPanel` 三段式（暗黑殿堂 bg.png、backFrame 菱形门与属性染色符文环、Q 版小人 win→win_idle、classStars→stars 双星级行、按稀有度点击跳段），揭晓小人经 `utils/gachaSpinePlayer.js` 的 `fit:'bounds'`（运行时包围盒取景）按需加载。坐标与演出手法的推导记录见 `docs/dev-logs/2026-09/2026-09-12.md`，完整规范见 `SPEC.md` §九.9.8。

  2026-09-13 校正：音频统一走 `utils/gachaAudio.js`（BGM 模块级单例：同名曲不重启、音效开关真正暂停/续播当前曲、面板卸载不停曲，离开页面才停）；**两池结束状态分流**——角色池 `GachaResultPanel.vue`（`HeroShowPanel`/`HeroShowItem`：连体星条 `com_stars_{rare}`、职业/属性标、`popUpAni` 逐张展开），魔物蛋池 `GachaPetResult.vue`（`GetRewardTip` 结算弹层：`item_get` 底板 + `ItemBagCell` Large + 0.1s 逐格 + 两段式关闭，蛋不显示数量）；`GachaRevealPanel` 的角色层按 prefab `mDepth` 排序（立绘 40 < 名牌 59 < 台座 61 < **Q 版小人 75**，此前立绘把小人盖住）。骨架真值、缺口与已知限制（`Npc_007` 解析异常 → 卡面代替）见 `docs/features/gacha/GACHA_REPLICA_AUDIT.md`。
~~~~

## 5. docs/ARCHITECTURE.md：- App.vue 根据桌面视口

~~~~text
- `App.vue` 根据桌面视口、原生环境和独立布局按需挂载 `SidebarMascot.vue`；组件管理角色/暂停偏好、可见性、IntersectionObserver 和减少动态效果设置，卸载时清理监听及中止请求。`config/mascots.js` 统一 34 名角色及 Vite 构建资产 URL，`utils/mascotArtwork.js` 用可重试的 fetch 加载可信本地 SVG、校验根节点及角色 ID，并缓存成功结果；首屏只加载当前角色，选择窗展开才补齐缩略图。`src/assets/mascot/idle.css` 共用关键帧，缩略图禁用动画，没有逐帧 JavaScript 或新动画依赖。`UiPopover` 统一非模态锚定选择层的上方定位、主题面板、窗外关闭、焦点及覆盖层登记（6003），业务组件只提供角色选项；路由变化关闭选择窗。图形尺寸与右栏布局遵循 UI 组件库约定。
~~~~

## 6. docs/ARCHITECTURE.md：- 皮肤模型静态图：

~~~~text
- 皮肤模型静态图：`scripts/dev/export-skin-models.mjs` 使用已安装的 Spine 4.0 渲染库，将 `4.24路资源包/assets/res/spine/model/npc/{skeletonName小写}` 的原始 skel/atlas/png 按配置皮肤渲染 `idle_front` 第 0 帧，输出透明 PNG 与来源哈希清单到 `public/images/skin-models/`。导出需要本机 Vite（默认 4187，可通过 `SKIN_PREVIEW_URL` 指定）；原始贴图不修改。`scripts/parse/skin-models.mjs` 核对清单的 skeletonName、skinName 和图片存在性后，为 items/heroes 构建提供共用路径映射，分别写入 `skinUnlock.modelImage` / `skins[].modelImage`。详情页面只加载静态 PNG，不加载 Spine 或原表；已有图片与清单入库，普通构建不重新渲染模型。
~~~~

## 7. docs/ARCHITECTURE.md：伙伴邮件视图

~~~~text
### 伙伴邮件视图

桌面列表卡片固定高度；`PartnerMailReader` 在 ResizeObserver / 字体加载完成后按 1px 递减测量标题，使用 requestAnimationFrame 合并布局工作，卸载取消回调与定时器。≤700px 改为头像横栏、邮件选择栏、全宽正文三行；选择栏横滑吸附，滚动停稳后选中最近邮件，右侧按钮通过现有 `select-mail` 事件切换。选中邮件变化时同步标题可见位置，正文滚回顶部；切换物品详情不改变邮件选择。

邮件正文与角色档案共用 `gameMappings.cleanMailContent → cleanDialogueLine → CALL_NAME_REPLACE`，同时支持方括号/花括号称呼，不在页面另建映射。奖励预解析保留公共规则的真实 `typeId`，阅读器通过 `select-reward` 交给页面追加当前路由 `itemId`，由 App 现有全局物品详情加载流程处理，保留邮箱状态。

`scripts/parse/heroes.mjs → heroParser.buildHeroData → partnerMailData` 遍历完整 `heroMail`，生成 `parsed/heroes.json` 的独立 `mailboxes[].mails`；`fetchHeroData` 同步缓存邮箱。邮箱保留原发件人 `heroTypeId`，不套用可玩角色图鉴的 `hide` 过滤；只按游戏源码剔除失去同角色档案关联的 `mailType=2` 邮件。当前为 36 个邮箱、61 封邮件。角色图鉴的 `archives[].mail` 仍保留，且复用同一个 `parseHeroMail`。

`partnerMailData.getPartnerMailPresentation` 统一彩色图标和奖励标签：档案任务、普通任务、附件、普通信件按 `mailType/taskTypeId/hasAttachment` 区分，`hasAttachment` 来自原始 `reward` 字段，不依赖解析结果。附件/档案奖励用 `acquisitionRules.parseRewardGroups` 解析数量与物品品质，任务完成奖励不挪入邮箱；`UiItemCard` 共用图鉴背景框和图标比例。原 `img` 转为 `uipanel/emailpanel/heromailimg` 路径，仅有附图的信件加载。`resourceSchemas` 验证邮箱结构，旧数据缺少邮箱字段时明确报错。

该路由通过 App 外壳 `is-mail-reader` 建立视口高度约束，覆盖桌面通用页面滚动规则。中间页与侧栏等高，筛选后的剩余空间交给阅读器；三个内部滚动容器禁止滚动链传到外页。路由离开后类名自动移除，不影响普通图鉴。方向提示由容器滚动事件和 ResizeObserver 维护，卸载断开观察。

`PartnerMailsView.vue` 负责筛选与选择状态，`components/heroes/PartnerMailReader.vue` 负责游戏邮件皮肤和正文滚动。复用角色预解析数据，不新增原表或构建链。邮件图复用 `public/images/EmailPanel_Atlas`，通用框/图标复用 `Common_Atlas`，信纸使用 `uipanel/emailpanel/mail_botm.png`；来源及切片约定见 `features/PARTNER_MAIL_SKIN.md`。
~~~~

## 8. docs/UI_COMPONENT_LIBRARY.md：关节吉祥物（全部 34 名）

~~~~text
**关节吉祥物（全部 34 名）**：全部角色通过 `MascotScene` / `MascotFigure`、`MascotArm` / `MascotLeg` 共用动作与关节绘制，`mascotModels.js` 提供专属形象、肩点/臂长、托腮握点、袖口/手型、腿部配色和随身物件。希尔保留原手套与服装；迦南使用裸手、白色褶边袖口、护腿、长靴，以及连续佩剑和披风。坐姿时迦南佩剑略贴背、披风适度收短，起身连续恢复。米托拉保留原头部 .9 比例、红白长发、披肩和蓝色吊坠；绑带袖口、左露指手套、左右不同的袜靴随关节动作，坐下时长发收拢、起身恢复。露比特的菜篮/园艺手套、艾薇杜尔的灯杖/长袍、露帕的法杖/披风、菲莉娜的尾羽/箭筒/爪靴分别适配，双手按场景握绳或握竿，长装饰坐姿收拢。全部角色的待机、思考、秋千、钓鱼使用同一 320×400 画布与 1:1 模型坐标，桌面宽 192px、矮窗口宽 144px；不因道具额外缩小人物，选择预览使用本人静态模型。

关节角色手腕默认沿前臂，袖筒以曲线衔接关节；思考同时调整肩肘腕与自然垂下的另一只手，不能只旋转待机前臂。握绳和握竿时两肘保持下沉，钓鱼右手握加长握柄的前段、左手靠近卷线轮，避免双手挤在肩部。检查真实掌心与道具接触、肘部方向及腕部折角，不以预设坐标代替实际 SVG 关节位置。

米托拉的鱼竿停放位置向外避让，取竿、抬竿与放竿全程保持右肘在肩点外侧偏下，避免前臂穿过胸口。鱼竿从出现、转身、坐下到伸手取竿始终保持同一停放位置，拿竿首帧必须与此前道具位置衔接，不能先悬在胸前再跳到旁边。取放握点与道具轨迹共用计算；不得仅翻转肘部方向而使抬竿时肘点升到肩上，也不得通过缩放手掌补偿握点。

托腮以旧版斜托下巴的轮廓为准，肘部向外、前臂斜抬。思考可专门适配袖管折叠比例，但不能改变总臂长或手掌缩放；过渡同步改变袖管轮廓与关节位置。通用关节不要求所有姿势共用完全相同的袖管投影比例。

思考进入为抬臂 → 托腮 → 偏头，停留时轻动手指、变化视线并渐显问号，离开先收手再恢复头部。秋千为道具出现、靠近、握绳、坐下和轻荡；离开减速、松手跳下、落地缓冲、走开和道具淡出。钓鱼为凳子出现、侧身坐下、拿竿、放线看漂；停留时调整握姿、咬钩提竿；离开先收线，再放竿、松手起身、收起道具。握点、鱼线和浮漂连续跟随，人物保持可见；连续点选只记最后一次请求，完整退出后再进入新动作。新增片段与装饰细节统一响应暂停、可见性和减少动态效果设置。

`UiPopover` 复用侧栏边框与装饰钉，底色使用不透明 `var(--paper)`（明暗主题同色系），避免浮窗透出下层文字与角色。

吉祥物 SVG 统一按 `hero-<三位英雄编号>-idle.svg` 命名（米托拉为 `hero-002-idle.svg`），选择窗仍展示角色中文名。

角色服饰细节可使用 SVG 的 `upperArm/cuff/thigh/shin/boot` 局部分件（左右差异用 `-left/-right`），由共用四肢组件随关节装配；护腕和袖口不参与掌心尺寸判断。腰包、书袋、锁链、盾牌应按实际穿戴关系配置 `satchelLayer`，禁止整件被身体挡住后仅凭源码存在认定保留。原图与四动作成品须逐批对照，核对头饰、发型、武器形状、左右服装差异和坐姿遮挡；配色、细描边、平涂阴影沿用首批风格，不能用增加纹路代替正确轮廓。

**右侧栏吉祥物**：`SidebarMascot.vue` 是按需加载的业务插画组件，不进入通用 UI 出口。SVG 参考 `public/test2/hero` 重绘，覆盖参考清单全部 34 名角色，首批为 001、055、062、053、034、049、002；固有色保留在矢量素材中，不套用品质色，仅插画配色属于此例外。全部角色主画布统一 320×400、桌面宽 192px、700~780px 高窗口宽 144px；选择窗也使用同一 4:5 画布。待机/思考以身体落脚中心 (162,369) 对齐，不按武器、篮子或尾羽的外接框居中，切角色不改变主画布和控制行位置。全部角色的问号统一在右上方，气泡尾巴朝左下指向人物。更矮窗口、移动端和原生端不挂载。右侧 `.info-body` 使用纵向 flex，将插画放在说明之后并以自动顶部间距靠右下，禁止绝对定位遮住正文。

全部 34 名角色以待机第 0 帧可见身高（不含阴影）统一到 312 模型单位，桌面约 187.2px、矮窗口约 140.4px；角色比例来自 `MASCOTS.standingHeight` / `getMascotScale`，主插画与选择预览一致。只围绕落脚点等比例调整，保留各自宽窄和造型；动作中保持固定比例，不能因坐下、托腮或摆动而重新归一外接框。

全部 34 名角色提供“待机”“思考”“秋千”“钓鱼”；关节与道具使用共享 CSS 和有限 Web Animations 片段，无滤镜、粒子和常驻逐帧脚本。装饰使用 `aria-hidden` 与鼠标穿透；公共 `UiButton` 承载播放/暂停、动作切换和角色“切换”，使用 13px 主题文字、键盘语义，分别持久化暂停、动作和角色选择。动作按钮显示当前动作，点击展开公共 UiPopover 动作选择窗；控制行始终靠右，矮窗口允许比缩小后的插画稍宽但不超出侧栏。后台及不可见时暂停，系统减少动态效果时隐藏动作/暂停按钮与问号，完全关闭关键帧、保留静态姿势和角色切换。

全部角色的思考由关节配置生成专属托腮姿势，保留袖口、肤色和手掌比例；选择预览保持静态。后续 27 名已按首批深色细描边、平涂阴影风格重绘为语义分件，运行时补齐真实关节四肢；切换角色保留当前动作。特殊宽武器/翅膀优先完整展示，不能横向挤压人物。

“切换”向上展开 `UiPopover`，每批横排七个静态小像与名称，共五批、末批六人。标题旁用手机邮件页样式的 ‹ / › 箭头加“上一批 / 下一批”文字与批次编号；首尾按钮禁用，翻批仅换候选，重新打开回到当前角色所在批次。当前角色高亮；成功点选后收起并恢复按钮焦点，失败保留原角色并提供重试。模型源路径随懒加载侧栏模块进入；独立 SVG 请求与预览挂载仅针对当前及当前批次，展开和翻批时补齐并缓存，关闭/翻批取消待完成的旧请求。选择窗直接复用 `paper-panel corner-nails` 的侧栏底色与边框，边界收敛到视口内；点窗外、Esc、路由变化或卸载时关闭。这是非模态锚定选择层，不锁背景、不画全屏遮罩；详情及系统模态窗口继续使用 `UiModal`，禁止业务页面复制选择窗定位/关闭骨架。

设施功能的营地视图由 `CampFacilitiesPanel.vue` 组合公共筛选、网格、章节、属性行和奖励卡。按用户要求，建筑使用带原图的选择卡，升级档位以卡片并排比较前后效果；研究使用 `CampResearchTree.vue` 的可点击前置关系树，复用原 `build_tree_botm` 节点底板，详情使用原菱形图标框，不再使用下拉选单。研究树按前置关系从左向右推进，同层分支上下排列，连线为 SVG；手机在树内横向滚动、初始定位左侧起点，不让整页溢出。节点保留底板原始 292×88 比例与左侧方框，图标使用 60×60 的 contain 区域；名称与总等级在素材横线上方，描述在线下方。布局连线与节点共用尺寸常量，详情的「返回研究树」与研究图标、名称同一行并靠右对齐，减少顶部垂直占用。无账号状态时不显示锁定或已完成。

三个视图均先搜索、再页签、再筛选和数量（13px、600 字重）。营地组件用片段输出筛选区和正文，`section-tabs` 插槽由父页面传入，筛选框必须成为 `.page-view-container` 的直接子元素以接入公共吸顶裁剪。正文使用 `paper-panel` 边框，背景放在 `camp-grid` 而非页面根；等级选择移至实体标题下，材料和奖励复用公共卡片。营地激活筛选文字使用 `--on-wood-text`，避免暗色模式把背景变量当文字色；正文和奖励名称允许换行。滚动区固定为 `#campFacilitiesScroll`，手机底部保留浮动导航避让空间。
~~~~

## 9. docs/UI_COMPONENT_LIBRARY.md：4.1 游戏皮肤页

~~~~text
### 4.1 游戏皮肤页：模拟招募（`/gacha`）

`src/components/gacha/` 是按游戏原素材还原的**业务皮肤**，与伙伴邮件阅读器同属「不进通用 UI 出口」的例外。规则：

- `GachaStage.vue` 是唯一画布容器：固定 `1534×750`、原点居中，按 `min(容器宽/1534, 容器高/750)` 等比缩放居中（`utils/gachaLayout.js`）。子元素用 `gachaPos(x, y)` 写 prefab 原始坐标，配合 `.g-abs`（`position:absolute; transform:translate(-50%,-50%)`）定位；**禁止在业务组件里另算缩放或改坐标**。
- **整页全屏**：该路由在 `App.vue` 用 `is-gacha-stage` 隐藏顶栏 / 左导航 / 右信息栏 / 移动端悬浮导航，主视图区 `100dvh`；`.main-layout-row` 必须从三列 grid 改成单列 flex（否则唯一的子元素会落进第一列 250px，画布被压成 250/1534）。画布外的留白用 `GachaStage` 的 `backdrop`（主视觉模糊放大版）铺满，避免硬边黑框；画布始终 contain、不裁切。
- **NGUI pivot 必须先查**：`UIWidget.Pivot` = `TopLeft0/Top1/TopRight2/Left3/Center4/Right5/BottomLeft6/Bottom7/BottomRight8`。`mPivot=8` 是 BottomRight（向右上展开）、`mPivot=3` 是 Left（向右展开）；`.g-abs` 的居中 translate 只适用于 `mPivot=4`，其余必须在 scoped 样式里改用 `left/right/top/bottom` 锚定并去掉 translate。`UIAnchor` 的序列化 `pixelOffset` 与画面实际位置在当前资源里不一致，**以 Transform 坐标为准**。
- **层叠用 `.g-layer-*`**：`bg(1) < art(10) < deco(20) < ui(40) < interactive(60) < overlay(80)`，同层内按 prefab `mDepth` 由小到大决定 DOM 顺序，注释里写明 depth。放错层会让元素压住不该压的东西（揭晓里 `midFrame` 必须在角色之下、`Rconer` 角框在角色之上）。
- `src/assets/gacha.css` 只服务该页面：提供画布、层叠层级（`.g-layer-bg/art/deco/ui/interactive/overlay`）、游戏文本色（`--gacha-ink` 等，取自 `Const.cs` 的 `ColorString`）与演出关键帧。品质色仍用 theme.css 的 `--q1`~`--q5`，不重复定义。
- **9 宫格切片必须在图集元数据里取真实值**：`4.24路资源包/assets/Android/AssetBundle/../uiprefab/*_Atlas.json` 的 `mSprites[].borderLeft/Right/Top/Bottom`。已用切片：`gacha_page`/`gacha_page_sp`/`com_btn_Y_sp`/`com_btn_N_sp` = `0 60 0 60`，`com_btn_mini` = `0 24 0 24`，`com_info_botm` = `0 15 0 15`，`com_top_item` = `0 20 0 20`，`chara_btn_change` = `0 24 0 24`，`item_info_color1~5` = `0 8 0 8`，`com_txt_botm4` = `4 4 4 4`，`com_txt_botm5` = `16 4 16 4`。新增切片精灵时到元数据里核对，**不要目测**。
- 层叠优先级：背景/前景美术 `.g-layer-*` 之外的点击层（演出推进）用 z-index 50、跳过按钮 60、弹层 80；同一图层内按 prefab `mDepth` 顺序排列，写进注释。
- 减少动态效果时由 `gacha.css` 的 `prefers-reduced-motion` 统一关闭该页关键帧，业务组件不各自判断。
- 该页不套用 `UiCardGrid` / `UiModal` 等羊皮纸组件（设计体系不同）；但**数据获取、黑名单、奖励解析、图片路径**仍必须走 `fetchWithFallback`、`isBlacklisted`、`gameMappings` 与 `getImageUrl`。
~~~~

## 10. docs/UI_COMPONENT_LIBRARY.md：伙伴邮件原素材皮肤

~~~~text
### 伙伴邮件原素材皮肤

图片按原来源共享：邮件贴图使用 `EmailPanel_Atlas`，头像框、选中角框和通用奖励图标使用 `Common_Atlas`，信纸使用 `uipanel/emailpanel/mail_botm.png`。不为阅读器再复制 `game-skin` 子目录。公共 `UiItemCard` 名称底板及角色/魔物图鉴共用 `PicHandBookPanel_Atlas`；招募的通用按钮同样共用 `Common_Atlas`，揭晓背景使用 `uipanel/herogachashowpanel/bg.png`。
邮件区域是固定阅读器，不使用 UiCardGrid 的桌面文档流策略；App 外壳为此路由设置与侧栏相同的高度限制。网格行与各层 flex 必须允许收缩，窄屏也不得用固定最小高度撑高外页。头像、信件列表、正文分别内部滚动并阻止边缘滚动传递；隐藏原生滚动条时保留溢出方向提示。内层不再添加独立边框。

`PartnerMailReader.vue` 是用户指定的游戏原素材业务皮肤，按需随邮件页加载。角色与信件按钮复用 `UiButton`，仅在组件内覆盖贴图所需背景、间距和状态。信纸和列表使用原配置切片，图片统一经 `getImageUrl`。原信纸固定为浅色，因此纸上墨色和标题文字采用局部固定配色，周围筛选仍随全站主题切换。手机将头像栏横排，正文至少保留可阅读宽度；不缩放整页字号。此例外不改变其他页面与公共按钮的主题。
~~~~

## 11. docs/UI_COMPONENT_LIBRARY.md：符石图鉴筛选区按

~~~~text
符石图鉴筛选区按「搜索栏 → 页签 → 筛选行 → 数量」排列，数量样式与事件/兑换页一致（13px、600 字重、`--text-muted`）。使用公共桌面吸顶裁剪时，实色正文背景必须放在 `[data-main-scroll]` 内，不给页面根铺实色，以免背景穿过筛选区上方留白；页签切换使用 `resolveScrollTarget` 操作实际滚动根。回归应包含滚动中的截图和切换后的起始位置，而不只检查首屏。

符石合成与符石列表共用卡片外观和网格密度（桌面两列、手机一列），合成卡展示产物、效果前后对照和单次材料；没有目标下拉框或合成次数输入，来源方案排在首位并高亮。鉴定的操作栏在手机独占一行且左对齐，次数输入使用 `components/runes/RuneCountInput.vue`。兑换页不再展示符石合成分类和条目。

注：原招募模拟页面 `/gacha` 已于 2026-09-11 按要求下线移除，无需再对其进行 UI 组件回归。
~~~~

## 12. docs/ARCHITECTURE.md：7. Git 提交与推送约定

~~~~text
## 7. Git 提交与推送约定

> 目的：把「本地提交」当存档点用，保证任何时候改坏代码、数据或图片都能精确恢复；「推送」只是把存档同步到 GitHub，两者分开对待。

### 1. 核心认知

- git 每次提交存的是当时**所有被跟踪文件的完整快照，图片等二进制资源也在内**。删除或修改前只要提交过，事后即可按提交号精确还原该版本（单文件恢复：`git checkout <提交> -- <路径>`；整体回滚：`git reset --hard <提交>`）。历史只会累积，不会覆盖。
- git 无法恢复**从未提交过就被删除/覆盖**的文件。所以「动手前先提交」是唯一的兜底规则，新导入的图片、新写的脚本先 commit 再动工。
- 仓库体积与恢复正确性是两回事：图片反复修改提交会让历史永久变大（胖），但不影响恢复（准）。不要为了省体积少提交。

### 2. 什么时候提交

| 时机 | 动作 |
| :--- | :--- |
| 动手改之前 | 工作区有未提交改动时先提交一档再开始，尤其 AI 大规模重构、批量改脚本、换表之前 |
| 一个说得清的改动完成并验证后 | 提交单位 = 一条提交能用一句话说清楚干了什么（如“修复某页问题”“跑通 data:build”）；说不清说明该拆或没做完 |
| 实验性尝试前 | 先提交当前状态再折腾；试成继续，试砸 `git reset --hard` 回来 |
| 一天结束时 | 即使进行中也提交一档，备注写“进行中：xxx”，不让改动在目录里裸奔 |

### 3. 提交内容边界

- **代码/文档改动与数据重建分开提交**：只改代码就只提交代码；跑过 `npm run data:build` 重新生成的 `parsed/` 产物单独一档，哪次改坏数据一眼能定位。
- **临时文件一律写进 `.gitignore`**，不混进提交：`.html`、`.tools/`、`*.tmp.mjs`、`*~` 备份后缀、`test-results/` 等试错产物。它们不是资源，恢复也不需要。
- **图片资源**：新导入的图片先提交再动工；压缩/替换前先按 `SPEC.md`「资源备份与图片压缩约定」备份原图到 `E:\Desktop\html\myrzg\vue-myrzg备份-资源\`。git 快照与备份目录互补：git 管“各开发阶段的快照”，备份目录管“压缩前原图永久留底”。

### 4. 推送与历史改写

- 推送节奏随意（阶段性推送即可），推送前 `npm run verify` 通过再推。
- **未推送的本地提交**可随意 `reset`/`rebase` 改写；**已推送的提交不要 force push / 改写历史**，除非确认远程只有自己且确有必要。
- 远程分叉时禁止直接合并旧快照把已删除文件带回来：先看清远程提交内容，若本地严格更新则用 `git merge -s ours` 只接历史、内容以本地为准；正常分叉用普通 merge 解决冲突。
~~~~


## 第二轮清理：副本、邮件与过期说明

以下是精简前的证据与实现摘录；含已过期的接口和布局结论，不要直接照此施工。

### 伙伴邮件整理前全文

~~~~text
# 伙伴邮件原素材皮肤

`PartnerMailsView.vue` 管理筛选与选择，`PartnerMailReader.vue` 管理阅读器。`scripts/parse/heroes.mjs → heroParser → partnerMailData` 在构建期生成 `parsed/heroes.json.mailboxes[].mails`，`fetchHeroData` 缓存邮箱，`resourceSchemas` 校验结构；缺少邮箱字段的旧数据应报错。角色档案仍复用同一个邮件解析函数，运行时不另加载原表。

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
~~~~

### 营地设施整理前全文

~~~~text
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

来源补全任务只需按上述 query 协议跳转，无需修改营地组件。统一奖励规则任务可继续维护公共解析入口；本任务不修改 `ItemDetailModal.vue`、`searchData.js`、路由表或导航清单。

同步发布 `facilities.json`、38 张研究图标、2 张研究底板及本次页面代码；原表无需变更。为了避免并行任务互相覆盖派生产物，开发验证只重建设施数据并进行独立目录的 Vite 生产构建，整合后再统一执行完整 `npm run build` 和全站 UI 回归。

## 验证结果

- 营地与旧设施专项单元测试 6/6，全量单元测试 106/106 通过。
- 营地与旧设施桌面/手机 UI 测试最终 12/12 通过；保留原 45 秒超时和全部断言。并行构建期间出现的一轮加载超时已在单 worker 重跑中消除。
- 实际检查明亮/深色、桌面/手机截图，确认正文可读、原图显示、无横向溢出；研究筛选的暗色激活文本有独立断言。
- 当前派生产物通过运行时校验，并与构建函数输出一致；38 张图标 SHA-256 与资源包一致。
- Vite 独立目录生产构建通过。全站 UI 和 Android 真机检查留给整合阶段。
~~~~

### 架构 4.3 原数据流

~~~~text
34 名吉祥物在主插画和选择预览中共用 320×400 画布。`MASCOTS.groundX` 记录非关节素材的身体落脚中心，`loadMascotArtwork` 验证仓库 SVG 后加平移分组，将原 (groundX,337) 对齐到公共 (162,369)，并缓存装配结果；原有局部坐标和动画轴保留，不复制角色素材。关节模型直接使用同一画布。菲莉娜的原 SVG 将身体居中，尾羽向下收拢并将旋转固化到路径，避免嵌套旋转的宽松包围框越界；她的 `groundX` 已计入素材内平移。

`MASCOTS.standingHeight` 保存待机第 0 帧的可见身高，`getMascotScale` 统一计算 `312 / standingHeight`。非关节素材在同一装配分组内以落脚点为原点等比例缩放；`MascotScene` 在人物及道具外增加固定比例分组，所有场景和预览复用。角色不按实时姿势改比例，无逐帧尺寸测量；局部动画轴、肢体关系及道具轨迹保留。

关节吉祥物由 `components/mascot/MascotScene.vue` 装配道具、`MascotFigure.vue` 装配角色、`mascotParts.js` 提取仓库内 SVG 语义分组。`mascotModels.js` 与 `mascotRedrawnModels.js`、`mascotRedrawnBatch3/4/5.js` 为全部 34 名角色定义肩点、臂长、托腮握点、配色、袖口/手型/腿部变体及随身物件；全部模型共用 `MascotArm` / `MascotLeg` 和场景坐标，不复制整套动作。原 SVG 通过 `?raw` 导入纳入 Vite 更新追踪；其余 27 名已改为人工曲线路径及语义分件，通过相同四肢组件装配四动作；原整图变换的 generic 分支已删除。关节角色选择预览也复用对应模型并禁用动画，切换角色按编号重建场景、取消旧片段，保留支持的动作偏好。

`useMascotSequence.js` 以 Web Animations API 执行有限关键帧，负责暂停、恢复和卸载取消；`useMascotChoreography.js` 统一调度思考、秋千和钓鱼完整进出场。`mascotRig.js` 在片段开始时按角色关节计算插值，`hilFishingMotion.js` 共用道具路径并按当前模型计算握竿位置，无逐帧 JavaScript。`HilFishingProps.vue` 分离道具前后遮挡层，`hil.css` 的动作选择器已按关节模型能力生效。模型的随身物件也通过同一片段系统变化；迦南佩剑保持整件连续几何，披风在坐下时收短，站起恢复。米托拉用 `wrap` 袖口与 `mitora` 腿部变体保留服饰；062 园艺手套/靴子与菜篮、053 灯杖/长袍、034 毛边袖口/法杖/披风、049 尾羽/箭筒/爪靴均保留独立装饰与坐姿配置；`artOffset` 将原素材对齐公共模型坐标，`rig-satchel` / `rig-skirt` 支持坐姿收拢。露帕法杖固定旋转固化到路径，仅保留小幅姿态变化，避免嵌套旋转扩大包围框。通用 `.rig-hair-left/right` 内层按模型配置插值坐姿收拢，外层继续轻摆。最终姿势存入 CSS 变量，有限片段清理后不会跳回站姿；恢复头部原缩放不与场景统一身高重复计算。流程和道具可复用，但不同体形、服装、武器仍需要模型适配和实际画面检查。

`mascotRig.solveArm` 默认以掌心为末端、前臂加掌心偏移为有效长度求解，使手腕沿前臂；显式手腕角度仅留作未来特殊持物适配。自由换姿插值肩角和相对肘角，避免目标姿势的 IK 弯曲方向直接覆盖起始帧；拿竿/放竿则沿道具握点求解。思考有独立 `think-raise` / `think` 双臂姿势；非托腮手也参与换姿，停留循环只轻动前臂和手指。

托腮使用姿势级袖管投影比例：总臂长不变，折叠上臂短一些、抬起前臂长一些。`armSleevePaths` 是静态绘制与有限片段共用的路径来源；比例变化时同时插值袖管 `d`、肘点和腕点，手掌不缩放。`think-raise` 属于站立姿势，佩剑与披风保持站立状态。

钓鱼模型可配置 `fishing.parkedOffsetX`，仅调整停放鱼竿的横向位置，正式握竿姿势不变。`fishingGripPoint` 共用于取竿姿势和拿竿/放竿片段，`fishingParkedTransform` 输出 SVG/CSS 共用的矩阵；鱼竿本体通过 `transform` 和 `transform-origin` 属性自带初始停放姿势，不依赖父层 CSS 变量和额外停放样式。取放片段沿同一矩阵过渡，结束清理后回到正确的静态姿势；米托拉配置为 40，道具坐标经现有场景变换后桌面约外移 31px。062、053、034、049 与后续 27 名重绘角色同样采用外侧取竿握点（40）；仅 001 希尔与 055 迦南保持默认 0，原位置和轨迹不变。

`MASCOTS` 覆盖参考清单的 34 名角色，首批七人保留原顺序，其余按编号排列，全部注册真实关节模型，不再使用 `idleOnly`。新增分件素材按首批描边和平涂风格人工绘制，无内嵌位图，装配后使用 320×400 画布；按实测待机身高归一到 312 单位，动作间保持比例。武器、翅膀与长发分别适配坐姿，不以裁切或横向压缩容纳。模型 `?raw` 源码随懒加载侧栏模块进入，独立素材请求只针对当前及当前批次；`SidebarMascot` 每批最多挂载七个静态预览，翻批/关闭取消旧批请求，成功内容缓存。`UiPopover` 的 `heading-actions` 插槽承载批次按钮，弹层位置、焦点恢复和关闭仍由公共组件负责。

`mascotParts` 额外提取可选 `upperArm/cuff/thigh/shin/boot` 及左右专属分件，`MascotArm/Leg` 把它们装配到对应关节局部坐标。袖口在手掌下层，随同手腕动画，不改变掌心握点；缺省时不影响首批七人的原绘制。`MascotFigure` 按 `satchelLayer` 渲染唯一随身配件节点：默认背后、`waist` 躯干前、`shield` 手臂前；027 的书袋和 046 的腰链使用腰侧层，026 的花瓣盾使用盾牌层；同一 `.rig-satchel` 继续使用既有坐姿/起身变换，避免新增静态副本或切层丢失轨迹。

奖励公共底层为 `acquisitionRules.js`（无网络、缓存或组件依赖），`gameMappings` 重导出旧映射及摘要解析接口。物品构建器在完成名称和图标关联后生成 `item.acquisition`；`ItemDetailModal → AcquisitionRewards → UiRewardCard` 共用消耗、奖励池和概率展示，物品、装备与符石图鉴不再各自解析使用动作。锻造装备候选与普通设施产出也调用该底层。正式来源入口判断、抽奖保底与重复转换各归其业务模块，不进入通用奖励解析。接口详见 [ACQUISITION_RULES.md](technical/ACQUISITION_RULES.md)。

1. 构建时 `npm run build` → `scripts/parse/index.mjs`（一键数据入口）优先读取仓库根 `raw/` 原始表（仅为兼容未迁移数据才兜底 `public/data/`），
   生成 `public/data/parsed/*.json`（全局搜索索引、物品来源反查表、页面级预解析文件等）。物品/装备链同时读取 `item.json`、分类树、`equip/equipGroup.json`、`equip/equipSuit.json`、词缀表、`hero/hero.json`、`hero/heroStar.json`、`homeLevel.json` 和 `equip/装备符石数据对应表equipGlobalConfig.json`，由 `itemParser` 统一提供正式装备判定、属性系数、强化等级计算、默认排序及角色碎片逐星阶消耗。装备强化上限取 `homeLevel.datas.blacksmith.level` 与 `smithyCfg` 的正式交集，当前为锻造台 9 级 / 装备强化 50 级；强化按 `生成属性 × (1 + 强化等级 × attUp)` 线性作用于五项装备基础属性，990~995 测试档保留在原始配置中但不参与有效强化上限。角色预解析另读取 `general.jobPaBuffConfDes`，沿其中的 Buff ID 关联 `buff.json`，把当前职业的一至两条正式职业特性写入每个角色；同时读取 `skin.json`，只把 `show=true` 且有正式角色绑定的额外皮肤写入对应角色，页面按数据动态显示皮肤页签。角色与魔物预解析共同读取 `playerLevel.json`，由 `levelConfig` 把末尾下一等级经验边界转换为正式可达上限（当前 50），分别写入 `parsed/heroes.json` 与 `parsed/pets.json`；角色滑条再与品阶上限取交集，魔物等级不得超过玩家等级。词缀反查只采用正式奖励实际引用的装备组，排除“暂不使用/测试/废弃/弃用”奖励组并合并重复前缀集合。副本页读取 `instance.json`、提取版 `dungeonBattle.json`、`dungeonBattleRooms.json`、`dungeonBattleRoutes.json`、`reward.json`、`consume.json`、`roomCollect.json`、`roomCollectType.json`、`mon.json` 与 `item.json`，生成轻量 `parsed/dungeons.json` 索引及按关卡拆分的 `parsed/dungeons/{battleId}.json` 详情；其中 `mode:equip` 固定装备再生成 `parsed-dungeon-sources.json`，记录关卡、箱型、目标物品和奖励组综合概率，由搜索构建器合并进统一 `item-sources.json`，运行时据此跳转并定位副本详情中的目标箱子；`mode:equipGroup` 随机池不反推具体装备来源。怪物页由 `fileMon/mon/ai/skill/buff/reward/equipGroup/item` 生成单个 `parsed/monsters.json`，产物只包含 `monsters` 正式图鉴数组，不生成 `mon.json` 全量单位 handbook；构建期再从 `exploreArea/room/battle/dungeonBattle/dungeonBattleRooms` 提取轻量形态用途，沿 `ai.type=6` 的状态入口反查触发条件，并合并 `monsterTowerUsage.json` 中由完整 `tower → battle → room` 生成的实际塔层。塔层索引依据源码正式 Boss 判定（`monRank=3` 或 `unitData.keyList` 含 `boss`）过滤普通小怪；`*_boss` 形态的塔层摘要同时以 `towerBossAppearances` 关联到同组通用形态，详情页复用“出现位置 / 出现楼层”展示但不改变通用形态的属性身份；最终只保留本体/变身/探索/剧情/副本/日常/爬塔标签、变身链和 Boss 塔层摘要，来源明细不会写入产物，浏览器也不请求这些来源表；
   纯函数位于 `src/utils/*.js`（`taskParser`、`furnitureData` 等），浏览器与构建脚本共用。家具预解析以 `homeItem.objType` 构造图鉴分类，将 `homeItem.category` 原样保存在 `sourceTags`，并沿 `consume/condition/playerInit/task` 保留制作、初始配置量及开放信息；开放条件复刻 `CheckResultConditions` 的 `rules[].type/para/need` AND 语义与条件级 `reverse`，`condition.desc` 仅作为 `configNote`，不能替代真实条件。图纸关系解析只按 `item.useActionPara.homeItems[].typeId/skin[]` 建立正反向关系，黑名单属于视图/图鉴组装策略，不进入纯关系解析函数。142 件是静态配置图鉴，不等同账号运行态列表；客户端运行态仍依赖条件、服务器 `HomeItemData` 和 `unlocked`。成就预解析由 `achievementData` 将 `achiAction + para` 转成实际达成条件；剧情任务、指定副本、魔物类别和战斗事件保留配置中的完整条件文案，并把 `unlock/next` 转成公开成就名称关系。PVP 预解析由 `pvpData` 写入段位积分、战斗积分与正式赛事/赛区规则，过滤测试说明、旧赛季时间及内部模式字段。家具、成就、配方、事件页面运行时只读取各自的 `parsed/*.json`，不得在浏览器重新加载原始表并执行构建期解析器；解析失败应显示错误态，避免同一数据规则在构建期和手机端重复维护。
2. 运行时视图通过 `utils/request.js` 的 `fetchWithFallback` 拉取 JSON（多路径回退，
   原生端可走 CDN）。副本页首次只加载摘要索引，用户打开关卡后才请求对应详情；怪物页读取单个正式图鉴 `monsters.json`，打开详情时另取轻量 `monLevelStrength.json` 支持等级滑块。NPC、友方、剧情临时单位和孤立配置不进入运行时怪物页；移除前快照已移至项目外 `E:\Desktop\html\myrzg\backups\full-monster-handbook\2026-08-31\`，不参与构建。云端失败时由 `fetchWithFallback` 读取热更包内同路径产物，不在手机端重新组合原始表。
   兑换页以 `itemExchange.json` 解析内容，但可见性必须与 `shop.json`、`general.json`、`packDisplay.json`、`activityList.json` 的正式入口求交集；地区商店、种子商店、兔子商人、积分商店、皮肤商店和每日补给均不得仅凭 `team/category` 展示。没有入口的 `monyshop`、`zhongziShop`、`payKeShop`、隐藏礼包及孤立兑换项不进入页面和 `item-sources`。锻造台由 `ProducePanel → SmithPanelUI` 独立读取 `itemExchangeRandom.json`，两条数据流不混用。
3. 解析逻辑集中在 `utils/*Parser.js` / `*Data.js`，视图只消费解析结果。`supplementalItemSources.js` 提供地图、营地、活动等来源，`remainingItemSources.js` 提供日常计划、塔层、分解、招募与从已有入口可达的容器反查，统一由 `searchData` 合并。实际产物筛选复用 `acquisitionRules.getObtainableRewardRules`，不将随机装备预览当成固定产物。完整构建传入本次副本来源；独立搜索构建从原表重算副本来源，并保留已有 PVP/隐藏产物，避免陈旧副本来源文件导致遗漏复发。来源只序列化简短说明和实际消费的定位字段：副本保留 `type/id/name/des/dropTab/dropEntry`，目标物品由外层键和当前弹窗提供，概率写入箱子说明，不复制完整关卡名、条件、消耗和奖励数量。塔层、分解按产物合并有效档位，详细玩法规则留在各机制产物中。来源无法确认的候选只记录内部文档。实现与边界见历史归档备份（`backups/audits-archive/SOURCE_COMPLETION_FOLLOWUP.md`）。
4. `raw/mon.json` 使用完整原表；字段拼写和头像引用只在 `shared.mjs` 归一化时修改内存。`sync-raw.mjs` 默认预览，`--apply` 补缺，`--apply --replace` 才刷新已有原表及兼容别名；副本中间表与塔层索引不参与覆盖。`check-task-data.mjs` 同样默认只读，禁止再输出裁剪版 battle/room 到原表路径。
~~~~

### SPEC 原副本数据链

~~~~text
- 副本数据链：`instance.json` 的副本入口 → `dungeonBattle.json`（战斗结算/预览/首次通关）与 `dungeonBattleRooms.json`（从解密 `battle.json`、`room.json` 提取的正式房间/随机候选）→ `reward/showReward/firstReward`，或房间 `spObj.caijiTypeId` / 怪物 `caijiTypeId` → `roomCollect.json` 的 `collectTypeId` → `roomCollectType.json` → `reward.json` 奖励组 → `item.json` 图标与名称；禁止跳过 `roomCollect.json` 直接用场景采集对象 ID 查询采集类型。关卡与采集类型的 `consume` 另关联 `consume.json`，页面必须显示其中的实际体力/货币/物品消耗，不得暴露 `consume_battle_d`、`collect_white` 等内部编号。路线图另由解密 `battle.json` 提取为 `dungeonBattleRoutes.json`，保留每个随机布局的 `map.levelRoom` 节点坐标、`map.link` 连线、起点/终点及布局概率。`parsed/dungeons.json` 只保存副本/关卡摘要、搜索词和详情文件引用；路线、房间、怪物、采集与掉落按关卡写入 `parsed/dungeons/{battleId}.json`，点击关卡时按需加载并在会话内缓存，禁止重新把全部详情嵌入索引。详情文件应尽量移除无用重复字段、保持较小体积，但不设置固定大小上限；`npm run verify` 必须报告最大详情文件及大小作为优化提示，不得仅因超过某个体积阻断构建。完整配置中的女神房 `buffGive`、泉水房 `spObjAddBuff` 必须在维护时通过 `npm run data:dungeons:effects` 提取为结构化效果，页面显示全队 Buff 候选或实际恢复比例，不得只显示“女神房/泉水房”名称，也不得暴露内部 Buff ID。具体装备规则 `mode:'equip'` 必须保留装备 ID、品质、装备等级和奖励组概率；`mode:'equipGroup'` 必须按 `equipGroup.showItemTypeId` 和 `qualityGroup` 匹配游戏中的展示物品图标与品质，存在 `showItemTypeId` 时应允许打开对应物品详情。`roomCollect.name` 中的 `3boos大` 等值是内部掉落池名称，不是实际物品，不得作为“可能掉落”展示或参与可见内容搜索。同一房间重复摆放的相同采集实体必须合并为“名称 ×数量”；房间掉落摘要按物品 ID 去重并按品质降序展示。房间 `name` 与 `typeId` 相同或路线节点标为“未命名关卡”时，展示层必须使用实际房间类型兜底，不得暴露内部 ID；场景制作描述 `desc` 不在房间详情展示。多波战斗必须保留 `monRounds` 的逐波怪物与数量，按“第 N 波”展示，不得用跨波合计反推。房间对象的 `layer` 仅为配置布局数组索引，不代表玩家可见的真实楼层，不得在房间标题中展示。配置/战斗名称含“停用”的入口仅在运行期过滤，不删除原始 JSON；“大扫除/回忆/测试”或 ID 为 `sldsd_*` 且未停用的入口归入剧情折叠区；`dungeonD`（蛇腹矿坑）属于主线矿坑与日常元素石采集混合配置，不纳入标准副本卡片；每张副本卡固定显示“剧情”栏，无入口时显示 `0 个 · 展开` 且不可点击；正式副本为 0 的地图/卡片不显示。路线节点点击后只展示配置能证明的怪物、事件、宝箱、采集与掉落，未提供的连接关系不得自行推断。索利德山地两个正式副本的铜箱奖励组和房间均已配置：蔓晶采石场仅 `c2_d1/c2_d1_2` 路线引用铜箱，`c2_d2/c2_d2_d` 未引用；阿娜希塔遗迹仅 `c2_d3/c2_d3_2` 引用铜箱，`c2_d4/c2_d4_d` 未引用。展示层必须遵循每个关卡的实际路线引用，不得把前段铜箱补进后段或噩梦关卡。
~~~~

### 排障文档第 8 节旧结论

~~~~text
普通列表页把外层页面撑开，导致顶栏错位

**现象**

新增页面如果直接让内容区使用普通 `div` 滚动，桌面端可能继承 `.app-main` 的页面滚动模式：筛选栏和列表一起推动外层 `.app-container`，切换页面后还可能看到内容从顶栏下方露出。

**根因**

桌面端 `.app-main` 会把普通 `.page-view-container` 交给页面级滚动；现有角色、物品、任务等长列表页面则通过 `UiCardGrid` 生成带 `data-main-scroll` 的统一滚动容器。新页面若绕过该组件，内部滚动与页面滚动的职责就会混用。

**当前解法**

- 普通列表/多栏内容的主滚动区必须使用 `UiCardGrid`（或 `UiVirtualGrid`），让滚动宿主带有 `data-main-scroll`；
- 页面根保留 `height:100%; min-height:0`，业务内部容器使用 `overflow-y:auto`；
- 不在业务页面自行给 `.app-container`、`.app-main` 添加滚动或固定顶栏规则；
- 详情覆盖层仍按本文第 1～3 节的 `UiModal`、`modalScrollCoordinator` 和内部正文滚动规则处理。

**检查方式**

新增页面至少核对：

1. 顶部筛选栏是否仍处于顶栏下方的正常位置；
2. 列表滚动时 `.app-container.scrollTop` 是否保持稳定；
3. 切换到角色图鉴、物品图鉴后，顶栏和筛选栏是否恢复正常；
4. 移动端是否仍由页面内部列表自然滚动。

伙伴邮件页面采用的三栏结构即按此规则：`UiCardGrid#partnerMailsGrid` 负责页面列表滚动，三栏内部仅负责各自内容滚动。
- `docs/UI_COMPONENT_LIBRARY.md` §「使用规则·3」、`docs/SPEC.md` 第十节
~~~~

## 整体重整前快照：SPEC 与专题

本节保留本轮开始时的完整文本，包含冗余 API 表、历史概率/调参记录和旧章节编号。它们已被现行精简文档取代，不能作为当前操作指南。

### 重整前 docs/SPEC.md

~~~~~text
# 深歌小助手 前端规范文档（SPEC）(UI & DRY 设计规范)

> 原表约定：`raw/mon.json` 保留 `Config_decrypted/mon.json` 完整原表；允许核对来源后同步新版原表。`cirtDam → critDam` 和特殊头像引用由 `scripts/parse/shared.mjs` 在内存中归一化，不回写原文件。历史“项目自建表、只增不改、禁止整表替换”的结论已废弃。
>
> 本文档维护全站通用约束、数据接口与页面契约；UI 组件用法、架构机制和复杂功能细节分别见对应文档，入口见 [文档导航](README.md)。
> 后续开发必须遵守 **DRY（Don't Repeat Yourself）** 原则：凡本文档列出的映射与工具，**一律从对应模块 import，禁止在页面里各自写死**。

---

## 目录

1. [项目概览与技术栈](#一项目概览与技术栈)
2. [路由规范](#二路由规范)
3. [通用配置层（强制复用）](#三通用配置层强制复用)
4. [全局设计 Token 与 CSS 变量](#四全局设计-token-与-css-变量)
5. [全局通用布局与 UI 字典](#五全局通用布局与-ui-字典)
6. [全局公共组件规范](#六全局公共组件规范)
7. [工具函数层](#七工具函数层)
8. [状态管理（Pinia）](#八状态管理pinia)
9. [页面规范（每个页面）](#九页面规范每个页面)
10. [详情弹窗与 URL 双向同步规范](#十详情弹窗与-url-双向同步规范)
11. [数据管线（构建时清洗）](#十一数据管线构建时清洗)
12. [热更新与双轨分离架构](#十二热更新与双轨分离架构)
13. [DRY 红线清单](#十三dry-红线清单)
14. [文档维护约定](#十四文档维护约定)
15. [资源备份与图片压缩约定](#十五资源备份与图片压缩约定)

---

## 一、项目概览与技术栈

| 项 | 值 |
| :--- | :--- |
| 框架 | Vue 3（`<script setup>` 组合式 API） |
| 构建 | Vite 8 + `@vitejs/plugin-vue` |
| 路由 | vue-router 4（Hash 模式，全部路由懒加载） |
| 状态 | Pinia 4 + `pinia-plugin-persistedstate`（LocalStorage 持久化） |
| 原生壳 | Capacitor 8（Android）+ `@capgo/capacitor-updater` 热更 |
| 源码根目录 | `src/` |

```
src/
├── main.js                 # 应用入口（挂载 Pinia / Router / 全局样式）
├── App.vue                 # 全局壳：Header + 全局搜索 + 设置菜单 + 路由出口 + 全局弹窗
├── composables/app/        # 全局搜索、原生生命周期、备份导入导出
├── assets/theme.css        # 全局设计 Token + 通用布局类（唯一全局样式）
├── config/blacklist.js     # 全局黑名单配置（模糊/精确匹配）
├── router/index.js         # 路由表（全部懒加载，beforeEach 关物品弹窗）
├── stores/appState.js      # Pinia 持久化状态（成就收集）
├── utils/
│   ├── gameMappings.js     # ★ 全局映射与公共工具（全站唯一映射源）
│   ├── recipeUtils.js      # 食谱共享工具（预览清单 / 通用食材 / 食材组装）
│   ├── itemParser.js       # 物品/分类/奖励/符石/词条/套装解析（带缓存）
│   ├── heroParser.js       # 角色图鉴解析 + 属性/升级费用计算器
│   ├── petParser.js        # 魔物图鉴解析
│   ├── monsterParser.js    # 正式怪物图鉴解析
│   ├── taskParser.js       # 任务图鉴解析
│   ├── itemModalState.js   # 物品详情弹窗的全局状态（含历史栈）
│   ├── request.js          # 智能 fetch（云端 → 本地降级）
│   ├── scrollTarget.js     # 页面滚动目标与滚动指标统一解析
│   ├── env.js              # 环境识别 + 资源路径规则
│   └── hotupdate.js        # Capgo 热更新检查/应用
├── components/             # 全局组件（见第六章）
│   ├── heroes/HeroStoryPanels.vue   # 角色档案、互动和对话加载
│   └── dungeons/DungeonRouteMap.vue # 副本路线图交互
└── views/                  # 业务页面（见路由表与第九章）
```

---

## 二、路由规范

路由表位于 [src/router/index.js](../src/router/index.js)，**全部使用动态 import 懒加载**（禁止静态 import 页面）。

| 路径 | 名称 | 页面组件 | 页面标题（App.vue pageTitle） |
| :--- | :--- | :--- | :--- |
| `/` | - | 重定向到 `/recipes` | - |
| `/recipes` | `RecipesView` | `views/RecipesView.vue` | 菜谱查询 |
| `/items` | `items` | `views/ItemsView.vue` | 物品图鉴 |
| `/furniture` | `furniture` | `views/FurnitureView.vue` | 家具图鉴 |
| `/facilities` | `facilities` | `views/FacilitiesView.vue` | 设施功能 |
| `/heroes` | `heroes` | `views/HeroesView.vue` | 角色图鉴 |
| `/partner-mails` | `partner-mails` | `views/PartnerMailsView.vue` | 伙伴邮件 |
| `/pets` | `pets` | `views/PetsView.vue` | 魔物图鉴 |
| `/petseggs` | `PetsEggsView` | `views/PetsEggsView.vue` | 魔物收益 |
| `/equip` | `equip` | `views/EquipsView.vue` | 装备图鉴 |
| `/runes` | `runes` | `views/RunesView.vue` | 符石图鉴 |
| `/monsters` | `monsters` | `views/MonstersView.vue` | 怪物图鉴 |
| `/achievement` | `AchievementView` | `views/AchievementView.vue` | 成就查询 |
| `/tasks` | `tasks` | `views/TasksView.vue` | 任务图鉴 |
| `/events` | `events` | `views/EventsView.vue` | 事件图鉴 |
| `/exchange` | `exchange` | `views/ExchangeView.vue` | 兑换 |
| `/dungeons` | `dungeons` | `views/DungeonsView.vue` | 副本图鉴 |
| `/gacha` | `gacha` | `views/GachaView.vue` | 模拟招募 |
| `/rewards` | `RewardsView` | `views/RewardsView.vue` | 其他 |

**全局路由守卫**：`router.beforeEach` 统一调用 `closeItemDetail()`，确保切换页面时物品详情弹窗被关闭。

路由 `path` 与 `name` 均须唯一；`/runes`、`/partner-mails` 各注册一次，不通过重复声明增加导航入口。

**符石图鉴 `/runes`**：符石列表、鉴定、合成三个页签；完整导航入口位于装备图鉴后。`tab=runes|appraisal|synthesis`，列表用 `focus/q/level/position` 定位筛选，鉴定用未鉴定物品 `id`，合成用兑换 `id`。合成采用列表式卡片，支持 `q/level/position` 按产物筛选，来源方案优先展示；`count` 仅用于鉴定，合成固定单次。兑换页排除 `gem` 分类及条目，符石合成统一在本页查看。材料详情仅追加 `itemId`。`runeData.js` 统一符石效果、正式合成映射与反向来源，`acquisitionRules` 统一奖励、费用和批量计算；页面只读取 `parsed/runes.json`。完整契约见 [RUNE_CATALOG.md](features/runes/RUNE_CATALOG.md)。

**设施功能 `/facilities`**：保留原设施配方，增加「营地升级 / 属性研究」页签。营地入口为 `facility=camp&mode=building|research`；建筑用 `building` 定位、`level` 表示当前等级，研究用 `research` 定位、`level` 表示目标研究等级；`group` 为研究分类，`q` 为搜索。材料详情仅追加 `itemId`，不得清空营地筛选；旧配方的 `facility/mode/level/tier/item` 继续兼容。完整字段与源码依据见 [CAMP_FACILITIES.md](features/facilities/CAMP_FACILITIES.md)。

**当前默认导航顺序**（`NavigationMenu.vue` 的 `defaultNavList`）：物品图鉴 → 家具图鉴 → 设施功能 → 角色图鉴 → 伙伴邮件 → 魔物图鉴 → 装备图鉴 → 符石图鉴 → 菜谱查询 → 魔物收益 → 成就查询 → 怪物图鉴 → 任务图鉴 → 事件图鉴 → 副本图鉴 → 兑换 → 模拟招募 → 其他。`NavigationMenuLite.vue` 是 Git 上传版本的备用精简导航，仅保留角色图鉴、魔物图鉴、菜谱查询、魔物收益和成就查询；未切换时不影响本地完整导航，被隐藏的页面和路由始终保留。

**模拟招募 `/gacha`**：使用独立游戏皮肤布局；页面与 URL 约定见第九章，演出和资源维护见 [模拟招募专题](features/gacha/GACHA.md)。

---

## 三、通用配置层（强制复用）

### 1. `src/utils/gameMappings.js` —— 全站唯一映射源

> 文件头注释即规范：「全站统一从这里取映射，禁止在页面里各自写死」。

| 导出 | 内容 | 说明 |
| :--- | :--- | :--- |
| `TASK_TYPE_LABELS` | `{1:'主线',2:'支线',3:'委托',4:'伙伴',5:'活动'}` | 任务类型中文名 |
| `TASK_TYPE_ORDER` | `{1:0,...,5:4}` | 任务类型排序 |
| `STEP_TYPE_NAMES` | 14 种步骤类型中文名 | 任务步骤类型 |
| `DIFFICULTY` | `{'1':'简单','2':'普通','3':'困难'}` | 副本难度 |
| `BASE_REWARD_ICONS` | `{money:'item_00001', ke:'item_00002', payKe:'item_00003', exp:'item_00004', ti:'item_00005', heroExp:'item_00006', equipExp:'item_00007', speed:'item_00008'}` | 基础货币/经验图标 ID |
| `BASE_REWARD_NAMES` | 与上对应的中文名 | 基础货币/经验名称 |
| `BASE_REWARD_PATHS` | 与上对应的完整图标路径 `/images/Common_ItemIcon/*.png` | **展示图标一律用它** |
| `REWARD_MODE_INFO` | 基础货币/经验及 `randomMoney/randomKe` → `{id, name, icon}` | 奖励 `rule.mode` → 展示信息 |
| `JOB_NAMES` | `{1:'近卫',2:'守护',3:'秘术',4:'射手',5:'突袭',6:'支援'}` | 职业中文名 |
| `JOB_SLUGS` | `{1:'zs',2:'qs',3:'fs',4:'yx',5:'ck',6:'fz'}` | 职业图标 slug |
| `ELEMENT_NAMES` | `{1:'水',2:'火',3:'风',4:'地'}` | 属性中文名 |
| `ELEMENT_SLUGS` | `{1:'Water',...}` | 属性 slug（大写开头） |
| `ELEMENT_SLUGS_LOWER` | `{1:'water',...}` | 属性 slug（全小写） |
| `RARITY_NAMES` | `{1:'普通',2:'稀少',3:'珍贵',4:'罕见',5:'传说'}` | 品质/稀有度中文名（**游戏官方体系** EatCookPanelUI.cs + lan.json equip_qual；物品/装备/事件探索全站统一） |
| `getRarityName(r)` | 查 `RARITY_NAMES`，兜底普通 | 品质名称工具 |
| `ITEM_CATEGORY_NAMES` | 包含所有大类、中类（11/12/13/14/16, 21/22/24, 31/32/33, 41~47, 51/52/54/55, 71~76）、小类的完整中文映射 | 物品与全局搜索分类映射 |
| `getCategoryName(code)` | 根据分类代号获取中文名 | 单个分类名称查询 |
| `buildFullCategoryTree(raw)` | 补全 gameSetting 缺失的中类小类树 | 物品图鉴级联分类树 |
| `resolveItemCategoryTags(category)` | 将 category 数组转为可读标签数组，剔除未映射纯数字 | 全局搜索与物品标签生成 |
| `STAT_NAMES` | 27 个战斗/基础属性中文名 | 属性翻译字典 |
| `translateStatName(key)` | 查 `STAT_NAMES`，兜底原 key | 属性翻译工具 |
| `getCleanSkillName(raw)` | 去掉技能名里的 `Lv: N` 后缀 | 技能名清洗 |
| `formatHighlightedText(text)` | `{数值}` / `<数值>` → 高亮 span | 技能/效果描述高亮 |
| `TAG_LABELS` | 20+ 个任务 tag 目标中文名 | 任务步骤 tag |
| `CALL_NAME_REPLACE` | `{callName1..4}` 占位替换 | 主角称呼占位 |
| `NAME_TEXT_REPLACERS` | `{myName}/[myName]/主角 → 小工匠` | 通用文本替换表 |
| `cleanDialogueBase(text)` | 标记 + 富文本（`[color=xxx]`/`[size=xx]`/`[wait=xx]`/`[b]` 家族）+ 称呼基础清洗 | 角色图鉴/任务图鉴对话共用 |
| `cleanDialogueLine(text)` | 基础清洗 + callName 主角称呼（兼容 `{callNameN}` / `[callNameN]`） | 任务/全局对话清洗 |
| `cleanMailContent(text)` | 复用 `cleanDialogueLine` + 邮筒占位 | 角色档案/伙伴邮箱共用清洗 |
| `SKIP_SKINS` | 默认皮肤后缀列表 | 怪物头像跳过名单 |
| `getMonsterIcon(icon, skinName)` | avatar→colect、小写、跳默认皮肤 | 怪物头像规则 |
| `chapterSortKey(label)` / `subSortKey(type,label)` | 章节目录/二级分类排序 | 任务分类排序 |
| `MAP_NAMES` | `{c0:'求生者草原', ..., c5:'霜烬平原'}` | 大地图名（c0~c5 及 C0/C5/c0_map 归一化） |
| `getMapName(key)` | 归一化后查 `MAP_NAMES`，兜底原值 | 地图名工具 |
| `EQUIP_QUALITY_LABELS` | 装备品质标签（用于装备详情品质切换） | 装备品质标签 |
| `parseRewardObject(r, itemMap)` | 奖励对象 → `{rewards, rewardItemNames}` | 兼容摘要接口，重导出自 `acquisitionRules` |
| `parseRewardEntries(rewardMap, itemMap, rewardId)` | 奖励组 → `{entries, text}`（任务/事件共用） | 奖励条目解析 |
| `resolveDialogMeta(raw, name)` | 对话块 meta 解析（选项/文本/称呼） | 剧情对话清洗辅助 |

**统一奖励规则**：奖励映射仍可从 `gameMappings` 导入，定义与纯解析集中在 `src/utils/acquisitionRules.js`。新礼包/鉴定/装备奖励功能使用 `parseRewardGroups`、`parseItemAcquisition`，禁止在页面重算权重、消耗或自选规则。`group.num` 是抽取次数，不是每件奖励数量；零触发率不得默认为 1，自选候选不得显示为逐项必得，随机装备池不得用展示 ID 伪造固定来源。`buildItemData` 预生成 `item.acquisition`，物品、装备详情与符石图鉴复用 `AcquisitionRewards.vue` 和同构规则，批量计算统一用 `scaleAcquisition`。完整接口与跨分支边界见 [ACQUISITION_RULES.md](technical/ACQUISITION_RULES.md)。

### 2. `src/config/blacklist.js` —— 全局黑名单

| 导出 | 说明 |
| :--- | :--- |
| `FUZZY_BLACKLIST` | 模糊匹配名单：名称中包含该关键字即隐藏 |
| `EXACT_BLACKLIST` | 精确匹配名单：ID / typeId / 完整名称完全匹配才隐藏 |
| `isBlacklisted(item)` | 校验函数，支持 `{id,name,desc,tip,source,label,keywords,category,categories,place,mark}` 对象或字符串/数字 |

**生效范围**：全局搜索下拉、角色/装备/物品图鉴、成就查询、食谱配方、魔物收益、怪物图鉴、任务奖励数据、兑换页，以及构建脚本 `scripts/parse/search.mjs` 的搜索索引过滤。条目的 `category/categories` 分类字段也参与模糊匹配，因此配置 `未使用` 会同步隐藏兑换页中标记为该分类的条目。希尔旧版获取道具 `item_59001/item_5900101/item_5900102` 按精确 ID 从网页图鉴、搜索及 `?itemId=` 直达详情隐藏，原始 JSON 不删除。**新增条目时禁止重复添加**（名单需保持唯一）。

### 3. `src/utils/env.js` —— 环境与资源路径

| 导出 | 说明 |
| :--- | :--- |
| `CLOUD_URL` | 云端 CDN 域名 `https://myrzg.yxzmy.top` |
| `isNative` | 是否 Android 原生 APP 环境（Capacitor） |
| `getResourceBaseUrl()` | 资源基准路径：原生端在线→CDN、离线→本地；Web 端→空 |
| `getImageUrl(path)` | 图片全路径规则（见下） |

**`getImageUrl` 路径规则（全站图片唯一入口）**：
- `/ui/` 或 `ui/` 开头的 UI 图标：本地打包，不请求 CDN；
- 其他路径：自动补 `/images` 前缀（`/Common_ItemIcon/x.png` → `/images/Common_ItemIcon/x.png`）；
- 原生端在线时拼 `CLOUD_URL` 前缀，离线回退本地。

### 4. `src/utils/request.js` —— 智能 fetch

- `fetchWithFallback(relativePath)`：dev 环境 JSON 请求加时间戳防缓存；生产环境走 CDN/浏览器 HTTP 缓存（静态数据不重复下载）；云端失败自动降级读取本地打包资源，并发 `network-fallback` 事件供 UI 提示。**所有静态 JSON 数据获取统一走它**（页面内直接 `fetch` 仅限剧本分段等特殊场景）。

---

## 四、全局设计 Token 与 CSS 变量

全局变量定义于 [src/assets/theme.css](../src/assets/theme.css)，支持亮色/暗色切换（`html.dark-mode`）。

### 1. 主题与基础调色板

调色板与字体用法统一见 [UI 设计系统](UI_COMPONENT_LIBRARY.md#1-设计系统themecss)。新代码使用 `--paper-*`、`--accent-*`、`--text-*` 等语义变量；`--bg/--bg-color`、`--bg-card/--card-bg`、`--primary`、`--text-sub` 仅作旧代码兼容别名。

### 2. 品质配色 Token 与类名

| 品质 | 变量 | 文本类 | 背景类 | 徽章类 |
| :--- | :--- | :--- | :--- | :--- |
| 传说 5 | `--rarity-legend` `#ffb64d` | `.quality-text-5` | `.quality-bg-5` | `.badge-5` |
| 罕见 4 | `--rarity-epic` `#ee62f1` | `.quality-text-4` | `.quality-bg-4` | `.badge-4` |
| 珍贵 3 | `--rarity-rare` `#3fa2ff` | `.quality-text-3` | `.quality-bg-3` | `.badge-3` |
| 稀少 2 | - | `.quality-text-2` | `.quality-bg-2` | `.badge-2` |
| 普通 1 | `--q1` `#cfba96` | `.quality-text-1` | `.quality-bg-1` | `.badge-1` |

> 品质名称从 `RARITY_NAMES/getRarityName` 读取；品质类统一使用全局定义，页面不重复定义。旧 `.filter-btn` 仅兼容存量，新页面使用 `UiFilterPill`。

> 颜色来源：游戏源码 `Const.cs` 的 `QualityColorString` / `ExtentionMethod.GetQulityColorString`；Q1=`#cfba96`、Q2=`#a7c037`、Q3=`#3fa2ff`、Q4=`#ee62f1`、Q5=`#ffb64d`。
>
> 可读性约定：`--q1` ~ `--q5` 始终保留游戏原色，用于品质边框、实底徽章和激活态背景；浅色羊皮纸上的文字使用 `--q1-text` ~ `--q5-text`，避免亮色原色直接落在浅底上造成低对比度。`--qN-bg` 是半透明品质浅底，详情面板等大块区域统一使用 `.quality-bg-N`。
>
> 叠加在插画上的小型品质角标使用 `--quality-label-bg` 不透明羊皮纸底，再叠加品质文字和边框；禁止使用半透明品质底直接压在复杂插画上。

### 字体渲染

- 全局正文和标题优先使用本地 `HarmonyOS` 常规/粗体，实际文件为 `public/fonts/HarmonyOS_Sans_SC_Regular.ttf` / `HarmonyOS_Sans_SC_Bold.ttf`，同一字体族对应 400/700 字重；禁止引用不存在的无 `_SC` 文件名或重复定义无人使用的字体族。缺字或字体不可用时回落设备原生无衬线字体。伙伴邮件也使用这两款字体。禁止为回退额外下载完整 `MYR2Sans` 游戏字库，也不加载 Google Fonts、Cinzel 或 Noto Serif SC。
- 公共字体栈统一使用 `--font-ui`。木质标题栏、关闭按钮与悬浮控件使用 `--on-wood-text`；副本封面使用 `--on-image-text` / `--on-image-text-muted`。不得用随主题变化的背景变量 `--paper` 充当前景文字色。
- `html, body` 统一启用 `-webkit-font-smoothing: antialiased`、`-moz-osx-font-smoothing: grayscale` 和 `text-rendering: optimizeLegibility`。
- 任务剧情与物品详情标题不使用装饰性 `text-shadow`，避免小字号出现边缘毛刺；阴影仅用于图标或容器层次。
- 图鉴物品名称底板使用游戏 `PicHandBookPanel_Atlas/colect_list_mx.png`，通过 CSS `border-image` 九宫格切片保留四角比例，禁止整张图片强制拉伸。

### 3. 安全区与布局变量

| 变量 | 表达式 | 用途 |
| :--- | :--- | :--- |
| `--safe-top` | `max(env(safe-area-inset-top),0px)` | 顶部刘海/状态栏 |
| `--safe-bottom` | `max(env(safe-area-inset-bottom),0px)` | 底部手势条 |
| `--safe-left` / `--safe-right` | `env(...)` | 横屏安全距离 |
| `--header-height` | `60px` | 顶部导航栏高度 |

---

## 五、全局通用布局与 UI 字典

所有业务无关的通用布局骨架定义于 `theme.css`，**子组件严禁重复定义**。

### 1. 页面容器

- `.page-view-container`：占满高度的页面主骨架（`width:100%; height:100%; display:flex; flex-direction:column; min-height:0`）。
- `.max-w-wrapper`：限宽 860px 居中容器（带 16px 安全 padding）。
- `.app-main`：路由出口容器（`width:100%; height:100%; overflow:hidden; position:relative; display:flex; flex-direction:column; min-width:0`），桌面端三栏 grid（左 250 / 中 1fr / 右 300，最大 1400px），≤1024px 移动端全屏单列；全屏详情覆盖层（如角色/魔物详情）使用 `position:absolute; inset:0` 挂在其内。
- `.filter-sticky-bar`：吸顶筛选栏（`max-height:55vh; overflow-y:auto` 防占屏）。
- `.data-grid-scroll`：可滚动数据区（`flex:1; overflow-y:auto`）。
- `.global-loading-state` / `.global-loading-spinner`：全站统一加载态。
- `.no-data`：空数据提示（`grid-column:1/-1; text-align:center`）。
- `.modal-body [class*="-list"]`：弹窗内列表不追加底部留白。

### 2. 控件使用

搜索、筛选、页签、卡片、标签和按钮统一使用 [UI 组件库](UI_COMPONENT_LIBRARY.md#2-组件库目录srccomponentsui)，不要复制旧 `.filter-btn`、`.segmented-pill-*`、`.search-input` 或 `.modal-btn-confirm` 样式。存量类只供兼容，不作为新页面模板。业务专用的任务徽章与关卡芯片保留在各自组件。

### 4. 悬浮按钮

- `.nav-fab-btn`（功能导航）：右下角 `right:20px; bottom: calc(80px + var(--safe-bottom))`，44px 圆形木质按钮，三横线汉堡；与回到顶部共用 `--floating-control-*` 尺寸、配色、阴影及层级（当前 `6002`），浮于业务详情之上。
- `UiBackToTop`：右下角 `right:20px; bottom: calc(24px + var(--safe-bottom))`，44px 圆形木质按钮，向上箭头；同样使用 `--floating-control-z`，仅滚动超过阈值时显示，监听指定容器并通过 `scrollTarget` 统一解析桌面/移动端实际滚动 owner。

---

## 六、全局公共组件规范

所有组件位于 `src/components/`。每个页面新增弹窗一律基于 `components/ui/UiModal`，**禁止再自建遮罩/弹窗骨架**。

**右栏吉祥物**：`SidebarMascot.vue` 是普通 Wiki 桌面布局按需加载的业务插画，复用公共按钮与 `UiPopover`；不进入通用 UI 出口。角色、模型、尺寸、动作与加载约定统一见 [右栏吉祥物](features/SIDEBAR_MASCOT.md)。

### 1. `UiModal.vue` 通用弹窗

普通图鉴详情默认内嵌，系统公告、关于、更新及全局图片预览使用 `teleport-to="body"`。统一复用公共弹窗、滚动协调器和覆盖层登记；参数、插槽与示例见 [UiModal 组件接口](UI_COMPONENT_LIBRARY.md#25-uimodal-组件接口)。

### 2. `GlobalSearchBox.vue` 全局搜索框（App.vue 内）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `containerClass` | String | 外层附加类（`desktop-search` / `mobile-search`） |
| `modelValue` | String | 搜索关键词（v-model） |
| `isSearchOpen` | Boolean | 是否展开下拉 |
| `results` | Array | 过滤后的搜索结果（App.vue 的 `filteredSearchIndex`） |

- Events：`@focus`（打开下拉并懒加载搜索索引）、`@select`（点击结果项）。
- 桌面与移动端共用同一组件，仅外层容器类不同（CSS 由组件自带 scoped 样式 + App.vue 控制显隐）。

### 3. `NavigationMenu.vue` 功能导航（三模式）

- `NavigationMenu.vue` 是当前默认的完整导航，保留侧栏、底部抽屉、顶部下拉三种模式，并支持通过 `items` 属性传入定制条目。
- `NavigationMenuLite.vue` 复用完整导航的布局与交互，仅维护 5 个公开入口；它作为 Git 上传版本备用，当前 `App.vue` 不默认引用。

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `isOpen` | Boolean | 是否展开 |
| `menuMode` | String | `'side'`（默认）/ `'bottom'` / `'top'` |
| `isDesktop` | Boolean | 桌面端常驻侧边栏模式 |

- Events：`@close`。
- 菜单数据集中在 `navList`（路径/名称/图标），三模式共用。
- 图标统一走 `getImageUrl()`；菜单模式持久化在 `localStorage['menuMode']`。

### 4. `UiBackToTop.vue` 回到顶部

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `scrollContainer` | String | 滚动容器选择器（如 `#itemsGridScroll`），空则监听 window |

### 5. `ItemDetailModal.vue` 物品详情（全局覆盖）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `visible` | Boolean | 显隐 |
| `item` | Object | 当前物品 |
| `categoryTree` | Array | 分类树（来源 `fetchItemData()`） |

- Events：`@update:visible`。
- 显示逻辑（全部复用 `itemParser`）：分类名、装备属性计算（品质切换 + 强化等级滑条）、使用效果、符石效果、奖励掉落、装备组/套装/词条、用途/解锁内容、获取途径分组、书籍内容、配方（复用 `recipeUtils`）。装备强化按源码公式 `生成属性 × (1 + 强化等级 × attUp)` 线性计算，只作用于物攻、魔攻、物防、魔防、生命五项基础属性；当前正式上限由 `homeLevel.json` 已开放锻造台等级与 `equipGlobalConfig.smithyCfg` 交叉确定，禁止使用 990~995 测试档。角色碎片的用途显示“用于{角色名}升星”，并读取 `heroStar.json` 展示逐星阶消耗及全部所需；指名契约统一显示“用途 / 解锁角色：{角色名}”，角色名前使用 `HeadIconAtals/{avatar.img}.png` 的 30px 行内头像，并按 `useActionPara.heros[].heroTypeId` 跳转对应角色详情；同一副本关卡的箱子来源固定按金、银、铜排序。
- 内部通过 `pushItemDetail` / `popItemDetail` 维护查看历史栈，关闭时回溯而非直接关闭。

### 6. `MonsterDetailModal.vue` 怪物详情（全局覆盖）

| Prop | 类型 | 说明 |
| :--- | :--- | :--- |
| `visible` | Boolean | 显隐 |

- Events：`@update:visible`。
- 监听 `route.query.id`（仅 `/monsters` 路径）自动打开；形态 Tab 切换、等级成长模拟（`monLevelStrength.json` 系数）、弱点/携带效果/技能组/战利品展示。

### 7. 其他业务弹窗

| 组件 | Props | Events | 说明 |
| :--- | :--- | :--- | :--- |
| `MenuModeModal.vue` | `modelValue`、`mode` | `update:modelValue`、`update:mode` | 切换菜单模式（写 `localStorage['menuMode']`） |
| `NoticeModal.vue` | `modelValue` | `update:modelValue` | 公告列表 + 首次弹窗（`lastNoticeDate` 去重） |
| `VersionCheckModal.vue` | `modelValue` | `update:modelValue`、`request-update` | 版本检查；发现更新后发 `request-update` 交给 App.vue 调 UpdateModal |
| `AboutModal.vue` | `modelValue` | `update:modelValue` | 关于我们 |
| `UpdateModal.vue` | 无 | 无 | APK 大更新 / 热更小包下载；暴露 `startUpdateWithInfo(info)` |
| `TaskDialogLines.vue` | `lines` | 无 | 任务剧情对话行渲染（选项/文本两种行） |

---

## 七、工具函数层

### 1. `src/utils/recipeUtils.js`（食谱共享工具）

| 导出 | 说明 |
| :--- | :--- |
| `PREVIEW_AVAILABLE_IDS` | 预览大图可用料理 ID 集合（硬编码防 Vite 误打包） |
| `GENERIC_FOOD_TYPE_MAP` | 通用食材映射：`1→兽肉(item_10006)`、`2→野菜(item_10056)`、`3→浆果(item_10055)`、`4→地菇(item_10057)` |
| `buildRecipeIngredients(menuEntry, itemDict)` | 组装食材列表（`food` + `foodType` 两种来源），返回 `{typeId, name, count, icon(相对路径)}`，调用方再包 `getImageUrl` |

**RecipesView 与 ItemDetailModal 的食材组装一律使用该函数，禁止各自实现。**

### 2. `src/utils/itemParser.js`（物品解析，带模块级缓存）

| 导出 | 说明 |
| :--- | :--- |
| `fetchItemData()` | 读取并缓存 `data/parsed/items.json`；原表关联在构建期完成。角色碎片附带角色名及逐星阶消耗，`item_5900103` 保留原描述，其余正式角色碎片统一命名为“{角色名}碎片” |
| `translateJobArray(jobIndices)` | 职业索引 → 中文名（数组；原 `translateJob` 字符串返回版已删除，统一用本函数） |
| `translateAttr(attrKey)` | 属性 key → lan.json 翻译 |
| `translateCategory(categoryArray, categoryTree)` | 分类数组 → 树形名称链（`A > B > C`） |
| `parseItemUnlocks(item)` | 使用效果（角色碎片/皮肤解锁）文本 |
| `getItemImageUrl(item)` | 物品图标智能路径（碎片用角色头像、其余用 img） |
| `parseItemRewards(item)` | 奖励掉落结构化解析（含概率计算，货币走 `REWARD_MODE_INFO`） |
| `getCachedItem(typeId)` / `getCachedItemDict()` | 缓存物品单查/整表字典 |
| `parseRuneEffect(item)` | 符石效果（含 `{值}` 高亮 HTML） |
| `parseEquipGroup(item)` / `parseEquipSuit(item)` / `parseItemAffixes(item)` | 装备组/套装/词条解析 |
| `buildEquipEnhanceConfig(...)` / `getEquipEnhanceConfig()` | 由当前开放锻造台等级解析正式强化上限与每级属性增幅，排除测试档 |
| `calculateEquipAttributeRange(item, quality, enhanceLevel)` | 按源码计算品阶、品质与强化等级共同作用后的装备属性区间 |
| `compareItemsByCategoryQuality(a, b)` | 物品/装备共用默认排序：三级分类升序 → 品质降序 → ID → 中文名 |
| `roundToEven(value)` | 游戏数值共用取整：对应 C# `Math.Round` 的中点取偶数 |

### 3. `src/utils/heroParser.js`（角色解析 + 计算器）

| 导出 | 说明 |
| :--- | :--- |
| `fetchHeroData()` | 组装角色全量数据（基础/技能/星阶/天赋/职业特性/档案/互动/星币上限），职业特性按 `general.jobPaBuffConfDes → buff.json` 解析，并由 `playerLevel.json` 输出当前正式玩家等级上限 |
| `calculateStats(unitData, level, rank, heroLevelConfig, heroRankConfig)` | 等级/品阶属性计算（成长率默认 5%，rank attUp 累加，最终按 C# `Math.Round` 中点取偶数） |
| `calculateUpgradeCosts(targetLevel, targetRank, rarity, job, ...)` | 累计经验/银币/突破材料汇总 |

### 4. `src/utils/petParser.js`（魔物解析）

`fetchPetData()`：组装魔物全量数据（普攻/特性/主动技能、变异、基础属性、星级映射 `star + 2`），并由 `playerLevel.json` 输出当前正式玩家等级上限。元素映射与技能名清洗来自 `gameMappings`。

### 5. `src/utils/monsterParser.js`（怪物解析）

| 导出 | 说明 |
| :--- | :--- |
| `fetchMonsterLevelStrength()` | 等级强度系数表；详情页 1~101 级滑块据此实时计算成长属性 |
| `fetchMonsterData()` | 官方图鉴（`fileMon` 为主，骨骼家族内按基础 ID 精确归属变种） |

- `skeletonName` 只定义同模型候选家族；`fileMon.monTypeId` 是官方本体锚点，最终形态关系必须结合 `exploreArea`、实际房间/战役引用和 `aiModel(type=6)` 的变身目标判定，禁止再用 `_1/_2/_3`、`_tower` 等后缀猜“特殊”或具体爬塔层数，也禁止让共享骨骼的 007/008 等条目互相混入。变身链需从 `type=6` 状态反向追踪 `triEnter` 到真实触发器，详情展示变身前、条件、当前状态和变身后；爬塔楼层必须由 `tower.layers[].battles → battle.roomTypeId → room.monRounds` 反查，同一形态可对应多层。
- 非官方形态仅在存在实际探索/房间引用、有效 AI 变身链，或属于明确召唤物/蛋形态时进入官方怪物详情；独立正式名称直接作为 Tab 名，同名配置按“剧情 / 探索 / 副本 / 日常 / 爬塔”用途区分，超过两类用途时收敛为“通用版本”。测试专用或无任何有效引用的孤立配置不展示。
- 详情页的成长属性按 `mon.json` 基础值 × `monLevelStrength` 当前等级系数计算；只显示滑块当前等级的结果，不显示基础值、箭头或场景来源。生命值、物理/魔法攻击、物理/魔法防御作为成长属性排在上方；暴击、攻击距离、伤害浮动、移动速度等固定属性另起下一行连续展示，不添加重复的小标题。
- `buffsList` 单项为固定携带，多项为按权重随机选一项；技能按 `aniEvents` 解析伤害段、范围、附加状态、召唤与陷阱。技能名称优先使用配置中的正式可读名称，纯数字、`mon_*` 等内部 ID 不得展示；没有正式名称时按当前怪物的无名技能顺序显示“技能1、技能2……”；ID 形式的描述同样不展示。技能附加 Buff 不能只显示名称，还需输出配置说明和可证实的持续/解除条件；`mon069StunBuff` 保留游戏配置名“特殊眩晕”，另依据源码补充其禁止移动、攻击和施法且直至尖刺被破坏才解除的实际行为。
- 召唤事件除 `summonData` 外必须同时读取同级 `monList`、`monCnt`：候选池由源码逐次独立随机，页面需列出候选单位、召唤数量、是否可能重复、场上上限和继承比例。明确的召唤实体需作为独立形态 Tab 展示完整属性，例如 `069_jianci` 尖刺与 `Mon055StoneMon` 晶石；技能卡只保留召唤摘要，不重复整套属性。怪物携带效果若通过 `actionPara.addBuffs/addBuffId` 追加二级 Buff，必须继续解析其持续时间、周期、伤害/恢复倍率和范围，不得只展示效果名称。
- 头像规则复用 `gameMappings.getMonsterIcon`（含 egg / hero 皮肤特例）。

### 6. `src/utils/taskParser.js`（任务解析）

`loadTaskData()`：运行时读取 `parsed/tasks.json`；多表关联由构建期 `buildTaskData()` 生成任务列表/二级分类选项/统计。`fileMon.json` 与 `mon.json` 的正式骨骼分组共同标记任务目标是否可打开怪物详情，NPC、剧情单位和隐藏怪物只展示名称与头像；步骤类型、难度、货币映射、怪物头像、分类排序全部来自 `gameMappings`；奖励图标基础货币用 `BASE_REWARD_PATHS`。

### 7. `src/utils/itemModalState.js`（物品弹窗全局状态）

| 导出 | 说明 |
| :--- | :--- |
| `itemModalState` | reactive：`visible / item / categoryTree / history` |
| `openItemDetail(item, categoryTree, savedScrollTop=null)` | 打开并记录外层滚动位置；详情历史另存正文位置 |
| `pushItemDetail(item)` / `popItemDetail()` | 查看历史栈进出 |
| `closeItemDetail()` | 关闭并清空历史 |

### 8. `src/utils/hotupdate.js`

- `checkHotUpdate()`：原生端先查 Gitee APK 大版本，再查云端 `hotupdate.json` 小包（版本比较 `compareVersions`）。
- `applyHotUpdate(manifest, onProgress)`：校验并下载热更包、注册进度监听，最后调用 `CapacitorUpdater.set()`；兼容显示键 `local_web_version` 只在检查确认当前 bundle 后写入，不在下载中提前写入。
- manifest URL 基于 `CLOUD_URL` 拼接，禁止写死域名。

---

## 八、状态管理（Pinia）

位于 [src/stores/appState.js](../src/stores/appState.js)，使用 `persist: true` 持久化到 `localStorage['appState']`。

| state | 说明 |
| :--- | :--- |
| `collectedAchievementIds: []` | 成就收集状态 |

| action | 说明 |
| :--- | :--- |
| `toggleAchievementCollected(achId)` | 切换成就收集（内部 `toggleInList` 工具） |

> 规范：收藏类状态若新增，统一用 `toggleInList(list, id)` 语义实现；导出/导入备份直接读写 `localStorage['appState']`。

---

## 九、页面规范（每个页面）

> 每个页面遵守：加载/错误/空态用 `UiEmptyState`，列表滚动区配 `UiBackToTop`，已声明的筛选参数与 URL Query 双向同步（页面本地状态按各条目约定），黑名单统一 `isBlacklisted` 过滤。

### 1. 物品图鉴 `/items` — `ItemsView.vue`

- **数据源**：`fetchItemData()` 读取预解析物品与分类树，原表关联在构建期完成。
- **长列表**：使用按需导入的 `UiVirtualGrid`，以 `typeId` 为稳定键，保留原响应式列数与总高度占位；不再累加挂载完整列表。普通详情返回保留原位置，冷链接没有原锚点时才调用 `scrollToItem` 定位。
- **筛选**：搜索（名称/描述/ID）、级联大类/中类/小类（分类树逐级 `category[0/1/2]`，大类 2 特判好感礼物 `fav_gift`，不展示已废弃的中类入口 `24 / 旧版符石`）、稀有度（`getRarityName` 来自配置）。
- **排序与收集筛选**：普通大类按大类 → 中类 → 小类 → 品质降序 → ID → 中文名；收集大类因原表大量条目缺失中类，改按实际用途分为“指名契约 → 角色碎片 → 配方 → 家具图纸 → 日志文本 → 外观皮肤 → 其他”，组内再按子用途 → 品质降序 → ID → 中文名稳定排列。“配方”筛选同时匹配 `category[1]=51`、`useAction=unlockMenu` 和 `unlockFormula`，排序时先聚合食谱，再聚合药水/工具制作配方；家具图纸筛选匹配 `unlockHomeItem / unlockHomeItemSkin`，并要求 `useActionPara.homeItems[]` 至少关联一个静态家具图鉴条目。指名契约使用 `item.json` 的 `item_charaXXX` 契约书图标，只有名称含“碎片”的物品才替换为角色头像。
- **交互**：点击卡片 `router.push({query:{...route.query, itemId}})` 唤起全局物品弹窗。
- **URL 参数**：`?itemId=` 打开物品详情（App.vue 全局监听）。

### 1.5 家具图鉴 `/furniture` — `FurnitureView.vue`

- **数据源与口径**：运行时只读取 `parsed/furniture.json`；构建期由 `furnitureData` 联结 `homeItem / item / gameSetting / consume / playerInit / condition / task`。当前 142 件是 `homeItem` 静态配置经本站图鉴规则筛出的配置全集，不代表任一游戏账号当前已解锁的家具列表。客户端 `HomeItemLogic.GetHomeItemInfo` 还会检查 `CheckResultConditions(condition)`、服务器 `HomeItemData` 是否存在且 `unlocked=true`；`cultivation001` 是源码显式排除项，名称或来源标签含“废稿”的 13 条则按表内语义执行本站展示过滤，不宣称是客户端中的显式废稿判断。
- **分类与筛选**：`homeItem.objType` 是图鉴一级/二级分类，`homeItem.category` 作为来源标签原样保存在 `sourceTags`，两者禁止混用；支持名称、描述、外观、图纸和材料搜索，以及分类、品质、放置区域、有无家具图纸筛选。
- **源码基线与图纸绑定**：分类遵循 `HomeItemLogic.GetCurrentItemList` 的 `objType[0/1]`；默认外观遵循 `FurnitureData.GetDefaltHomeItemSkin`。图纸只接受 `BackpackServerData` 实际处理的 `unlockHomeItem / unlockHomeItemSkin`，并严格按 `HomeItemLogic.UnlockHomeItemByItem` 读取的 `useActionPara.homeItems[].typeId/skin[]` 建立关系，不按名称相似度推断。`NewItemTips.SetItemDesc` 规定普通家具图纸使用 `homeItem.icon`，皮肤图纸使用首个指定皮肤的 `icon`；关系解析层保留原表关系，黑名单只在可见图鉴组装层处理。家具详情可打开图纸的全局物品详情，物品图鉴“收集 → 家具图纸”也展示有静态图鉴关联的两类图纸，并可跳回 `?id=<家具ID>`。
- **详情与开放条件**：显示图鉴分类、放置范围、装饰值、基础库存上限、制作消耗、外观和关联图纸；`playerInit` 只表示初始配置量，不冒充账号当前库存。开放条件严格按 `ExtentionMethod.CheckResultConditions` 的 `rules[].type/para/need` 逐条判断、全部取 AND 后再应用 `reverse`，任务条件由 `task.json` 补全任务名和步骤；`condition.desc` 只是配置备注，仅保存在 `configNote`，不得直接显示为真实开放条件。卡片、详情与外观缩略图只使用 `BuildItem_Atlas` 对应 UI 图；游戏房间内 `roomObj.viewData[].img` 的场景立绘不进入网页产物，也不作为回退图。
- **缺图语义**：配置引用的 UI 图不存在或图标字段为空时显示统一 `visibility-off.svg` 占位。不得回退到家具基础图，也不得改用场景立绘，否则会把具体皮肤错误展示成另一外观。当前已知缺图严格为 `build_roomLittle_yma7_2`、`build_roomLittle_yma8_2`、`build_roomLittle_yma8_3`、`build_roomOther_xca4_1`。
- **URL 参数**：`?id=` 打开家具详情；详情内图纸/材料用 `?itemId=` 叠加全局物品详情，关闭后仍保留家具详情。

### 2. 装备图鉴 `/equip` — `EquipsView.vue`

- **数据源**：`fetchItemData()`，按游戏 `PicHandBookPanel` 规则只保留 `category[0]==='4'`、`hide=false`、`equip.equipLevel>0` 的正式装备，剔除 `show_` 开头的奖励展示占位项。
- **筛选**：部位（分类树节点 4 的子节点）、品阶（`equip.equipLevel` 1~5）、稀有度。
- **排序**：与物品图鉴装备分类共用 `compareItemsByCategoryQuality`，固定为大类 → 部位 → 小类 → 品质降序 → ID → 中文名；品阶只用于筛选，不额外改变默认顺序。
- **交互**：点击唤起物品弹窗；物品图鉴与装备图鉴共用装备详情中的品质切换和 `+0~+50` 强化等级滑条，属性实时更新；装备图鉴内隐藏仅服务奖励组的「包含内容」，但保留「获取途径」，固定副本装备可查看并跳转到对应副本关卡。

### 3. 角色图鉴 `/heroes` — `HeroesView.vue`

- **主角立绘**：仅 `hero_001`（希尔）使用男女双版本，依据游戏 `ExtentionMethod.SetSexHeroImg` 的 `chara001_0 → chara001b_0` 映射。桌面左女右男各占一半，手机（≤640px）默认女主、右上角 `UiButton` 切换男主/女主；切换只影响立绘，不改角色资料或路由，重新打开角色时重置女主。女主沿用原图，男主展示 `chara/protagonist/chara001b_0.png`；其他角色保留原有单立绘结构。
- **数据源**：`fetchHeroData()`（heroParser）+ `consume.json`；职业特性读取 `general.json` 的 `jobPaBuffConfDes`，其中引用的 Buff 名称与说明再关联 `buff.json`；皮肤读取 `skin.json`，按 `heroTypeId` 关联角色。
- **筛选**：搜索（名称/称号/描述/职业/属性）、稀有度（3/4/5 星）、职业（`JOB_NAMES`）。
- **卡片**：`/images/HeroBagPanel/card_{rare}.png` 边框 + `card_{rare}_botm.png` 底图 + `{img}_ka.png` 卡面 + 属性/职业图标（slug 来自 `gameMappings`）。
- **职业特性**：详情顶部职业徽标为可点击按钮，仅展开当前角色所属职业，不提供六职业切换；展开区位于徽标行和主标签之间。近卫/守护/突袭各有两条特性，秘术/射手/支援各有一条，数量必须按配置数组渲染，不得在页面硬编码。
- **详情全屏覆盖层**（`position:absolute` 挂 app-main 内）默认四个 Tab；角色有正式额外皮肤时动态增加“皮肤”Tab：
  - **技能星阶**：主动技能/天赋选择（`formatHighlightedText` 高亮描述、升级计划消耗汇总）、星阶命座（碎片消耗、满命转化）；
- **基础属性**：等级滑条上限由 `playerLevel.json` 的正式可达边界与 `heroRank.heroMaxLevel` 共同决定，当前为 1~50；品阶不提供手动选择，10/20/30/40/50 级默认按已完成对应突破计算，50 级为品阶 5（突破已开放，但受玩家等级限制暂时不能升至 51 级）。游戏界面的正式操作名为“等级突破”，`heroRank.rankDesc` 的“品阶”仅作为配置状态；页面以“等级突破 N 次”展示当前状态。五项成长属性按 `基础值 × (1 + (等级-1)×heroLevel.attUp + 已完成品阶attUp累计)` 计算，最终取整与游戏一致；页面同时展示每级与每次突破的基础属性增量、静态属性、累计升级和突破消耗（`calculateStats` / `calculateUpgradeCosts`）；
  - **角色档案**：好感档案（`cleanDialogueBase` 清洗任务文本、`cleanMailContent` 清洗信件、剧情奖励、内嵌剧情展开）；
  - **皮肤**：仅展示 `show=true` 且有角色绑定和立绘的正式条目，包含皮肤名称、获取来源、属性加成与立绘。`HeroSkinsPanel` 在桌面按左立绘、中信息、右小人模型布局，获取来源单独放在皮肤名下；手机先并排显示立绘/模型，再显示信息。物品详情“皮肤立绘”区左右各半显示立绘与同一小人静态图。模型必须来自该皮肤 `skeletonName/skinName` 对应原始 Spine 的正面待机帧，由导出清单核对后写入预解析 `modelImage`；无对应图时保留原立绘布局，不猜用基础角色模型。无额外皮肤的角色不显示空 Tab，策划备注字段不进入页面；
  - **互动**：好感对话/营地事件/野外探索/战斗/赠礼与获取/摸头/路过/自言自语（剧情动态加载 `data/dialogs/*.json`）。`heroTalk` 中由 `explorePlan.type` 调用的 `start/fight/win/exploreTalk/loopEnd/readyGoHome/over` 归入野外探索；战斗房间结算触发的 `roomFinishLeader/roomFinishMember` 归入战斗；`getGift/gacha` 分别归入收到赠礼与招募获得。随机候选语句无固定先后顺序，正文不得显示“台词”或人为编号。
- **URL 参数**：`?id=` 打开详情（watcher 同步）。
- 喜爱礼物点击 → `?itemId=` 唤起物品弹窗。
- **职责边界**：列表、详情状态、技能与属性计算保留在 `HeroesView.vue`；档案、互动子页签、对话缓存和按需加载统一由 `HeroStoryPanels.vue` 维护。
- **营地测试事件**：`HeroStoryPanels` 按事件标题过滤，凡 `title` 包含“测试”的营地事件均不显示，不限定角色；正常事件保留。保留“营地事件”页签和章节标题，原始表与预解析数据不删除，其他互动不受影响。

### 3.5 伙伴邮件 `/partner-mails` — `PartnerMailsView.vue`

- **定位**：使用原素材信纸的静态伙伴邮箱，不模拟账号收件时间、已读或领取状态。
- **数据源**：`parsed/heroes.json.mailboxes`，独立于可玩角色档案筛选；邮件类型、正文与奖励在构建期统一解析。
- **交互**：搜索与角色筛选、切换发件人和邮件；固定阅读区域，头像、选信和正文独立滚动，窄屏改横向选信。
- **URL**：筛选与选信为本地状态；奖励只追加 `itemId` 打开全局物品详情，关闭后保留信件及正文位置。
- **详细约定**：覆盖范围、类型与奖励、原素材和响应式布局见 [伙伴邮件专题](features/PARTNER_MAIL_SKIN.md)。

### 4. 魔物图鉴 `/pets` — `PetsView.vue`

- **数据源**：`fetchPetData()`。
- **筛选**：搜索、稀有度（3/4/5 星，`starDisplay`）、形态（可变异）。
- **卡片**：`petcard_{starDisplay}.png` 边框 + `petcard_botm_{starDisplay}.png` 底图 + `PicHandBookPanel_Atlas/{monImg}.png` 头像（变异 `_a` 后缀）。
- **详情全屏覆盖层**两个 Tab：
  - **技能特性**：普攻/特性/主动技能选择、技能等级滑条、突破要求（`petSetting.petTpExp` / `petTjExp`）；
  - **基础属性**：基础值/成长区间、成长系数调参（C/B/A/S 评级：区间前 25%/50%/75% 划分）、等级模拟（当前 1~50，上限来自 `playerLevel.json`；累计经验来自 `petLevel.json`）、好感配置。属性公式与源码 `PetServerData.GetAttrValueRate` 一致，为 `floor(基础值 + 成长值 × 当前等级)`，1 级即计入一份成长值；等级滑条下使用与装备/角色一致的弱提示样式标明“每级基础属性 + 当前成长值”，具体四项数值与评级保留在下方成长格，不得误写成统一百分比。
- **URL 参数**：`?id=` 打开详情。

### 5. 魔物收益 `/petseggs` — `PetsEggsView.vue`

- **数据源**：运行时读取 `parsed/pet-eggs.json`，由 `src/utils/petEggsData.js` 在构建期从 `pet.json` 生成；本页只取蛋收益指标。
- **筛选**：行 1（全部/金币池/氪金池/3星/4星/5星，池名单 `goldPoolNames`/`premiumPoolNames`）、行 2（全部/卖/喂/按需选择）+ 重置按钮。
- **显示字段控制**：8 个可选列（时间/银币/经验/银币分/经验分/银经比/经银比/建议），默认 `['sellPrice','exp','recommend']`，列序固定按 `allFields` 定义。
- **排序**：默认星级降序，点击表头切换升降序。
- **处置推荐规则**：`R = sellPrice / exp`，表示换取 1 点基础喂养经验所放弃的银币；当前全量表在 `2.2` 与 `3.0` 附近存在自然断层，因此 `R < 2.2` → **喂**，`2.2 ≤ R ≤ 3.0` → **按需选择**，`R > 3.0` → **卖**。游戏源码没有官方推荐或银币/经验兑换率，页面必须将其表述为数据建议，不能称为游戏内置结论。
- **适用边界**：默认标签只比较 `pet.json` 中刚孵化个体的基础售价和喂养经验；孵化时间在同一个体的卖/喂比较中会约掉，只用于比较优先孵化对象。变异、突破和培养信息由魔物图鉴负责，本页不重复展示。
- **URL 参数**：`?pool=gold|premium`、`?tag=3星|4星|5星|卖|喂|按需选择`、`?id=` 打开详情弹窗。

### 6. 怪物图鉴 `/monsters` — `MonstersView.vue`

- **数据源**：`fetchMonsterData()`，只展示 `fileMon.json` 中未隐藏的正式图鉴本体及有源码用途证据的关联形态。
- **筛选**：按 `label` 种类筛选；不提供 `mon.json` 全量单位入口，NPC、友方、剧情临时单位和孤立配置不作为怪物图鉴展示。
- **搜索**：`keywords` 模糊匹配。
- **图标**：普通怪物与任务目标直接使用 `/images/PicHandBookPanel_Atlas/{icon}.png`；旧 `MonstersView` 目录已删除，不维护旧文件名兼容映射。砂蜘蛛幼体使用原图集名 `colect_mon_013_s`。详情消费构建期 `portraitPath`：晶石、尖刺分别使用 `model-previews/obj_mon055.png`、`obj_mon069.png`，蛛网复用 `Common_ItemIcon/item_10043.png`；缺图回退只在现有图集内进行。
- **交互**：点击 `?id=` 唤起 `MonsterDetailModal`。
- **详情属性**：提供 1~101 级滑块，成长属性随拖动直接更新为当前值；Boss 与普通怪物使用相同的等级系数展示方式。
- **形态关系**：官方本体、AI 变身阶段、探索/剧情/副本/日常/爬塔版本和召唤物均由构建期源码引用链生成；页面不得根据 ID 后缀临时拼接“特殊”或楼层标签。形态 Tab 下方按当前形态展示变身链信息；塔名及实际楼层只对 `monRank=3` 或 `unitData.keyList` 含 `boss` 的正式 Boss 配置生成，普通塔内小怪不写入 `monsterTowerUsage.json` 和 `parsed/monsters.json` 的塔层字段，原始官方塔/战斗/房间表保持不改。若通用形态对应的同组 `*_boss` 形态存在正式塔层，则仅在解析产物中写入 `towerBossAppearances` 摘要，复用 Boss 的出现位置/楼层展示，不把通用形态误标为 Boss。
- **技能/效果**：技能展示伤害段、伤害类型、倍率、击退/硬直、范围、位移、附加状态的具体效果与解除条件、召唤继承参数与陷阱；专用事件字段（如 `lineDamage`、`atkDamage`、`addBuff` 数组、`monId/createMonPos`）必须按源码类实现映射，不能只显示技能名称。携带效果明确区分固定与随机权重。尖刺、晶石等有独立单位配置的召唤物使用单独形态 Tab 展示属性。
- **掉落**：`fileMon.reward` 显示为“图鉴战利品”，`mon.json` 当前形态自身配置的奖励显示为“怪物配置奖励”；怪物页不加载或展示地图/副本来源链。

### 7. 成就查询 `/achievement` — `AchievementView.vue`

- **数据源**：运行时读取 `data/parsed/achievements.json`；奖励与物品关联在构建期完成。
- **奖励拼装**：银币/氪金图标**必须**用 `REWARD_MODE_INFO`（禁止手写路径）；道具图标 `getImageUrl('/Common_ItemIcon/...')`；隐藏名称提取进 `rewardItemNames` 供搜索。
- **达成条件与阶段**：列表与详情统一只显示“达成条件”。可直接表达的目标上限按源码 `AchievementData.InitAchiInfo` 实际读取的 `achiAction + para` 生成；剧情任务、指定副本、魔物类别和战斗事件采用配置中的完整条件文案，避免退化为“指定任务/指定关卡/对应类别”。当前服务器配置中 `10502`“厨房老手”为累计制作 50 个料理。`unlock/next` 关系转换为可读的“解锁前置/完成后解锁”成就名称，不展示任务、战斗或奖励内部编号。`alwaysHide=true` 的章节宝箱和活动检查项不写入页面预解析产物。
- **筛选**：状态（全部/已收集/未收集，Pinia `collectedAchievementIds`）、分类（adv/exp/live/hide）、搜索（名称/描述/奖励名）。
- **交互**：自定义开关切换收集；`?id=/?q=` 定位并高亮卡片（`.card-highlight-pulse`）。
- **URL 参数**：`?status=/?category=/?q=` 双向同步。

### 8. 菜谱查询 `/recipes` — `RecipesView.vue`

- **数据源**：构建期关联 `menu/item/buff/gameSetting`，运行时只读取 `parsed/recipes.json`，不回退原表重建。
- **食材组装**：一律用 `recipeUtils.buildRecipeIngredients`；图标 `item.img` 优先。
- **预览**：`PREVIEW_AVAILABLE_IDS.has(typeId)` 时显示预览按钮 → `/menu_prev/{typeId}_prev.png`。
- **Buff**：`buffDes` 纯文本（`{值}` 去花括号）。
- **获取途径**：`RECIPE_SOURCE_CONFIG` 表（`targetType`：`achievement` → 跳成就查询 `?id=&q=`；`task` → 跳任务图鉴详情 `?task=任务id`，任务名以任务图鉴为准）。
- **成品点击**：卡片头部（图标/名称/食材区）`handleRecipeClick` → `?itemId=` 唤起全局物品详情弹窗。
- **URL 参数**：`?tag=/?q=` 双向同步；`?id=/?q=` 定位高亮；`?itemId=` 唤起物品弹窗。

### 9. 任务图鉴 `/tasks` — `TasksView.vue`

- **数据源**：`loadTaskData()` 读取 `parsed/tasks.json`；正式怪物判定与剧情分段索引在构建期关联，剧情文本按入口单独加载。
- **长列表**：单列 `UiVirtualGrid`，动态行高（估算 150px）；直达任务先定位目标再开详情，正常关闭/嵌套返回不重置列表位置。
- **开发者开关**：`HIDE_CLOSED_TASKS = true`（隐藏已下架任务）。
- **筛选**：一级类型（1~5，`TASK_TYPE_LABELS`）、二级分类（数据驱动 `subOptions`，分段标签均分 + `.sub-wrap` 允许换行）、搜索。
- **委托分类地图名**：委托任务（taskType 3）的二级分类 C0~C5 经 `formatEntrustLabel` 直接显示大地图名（去掉 C 前缀，如 `C1`→秋日荒野；C0→求生者草原…C5→霜烬平原）。
- **详情全屏**：接取信息（NPC/条件/交互对话/剧情）、后续任务、解锁任务/关卡、奖励、步骤列表（可展开，含 NPC/怪物/道具/剧情），剧情动态加载 `data/taskDialogs/{dialogId}.json`。`addTask` 单独显示为后续任务，并按客户端逻辑排除已下架目标；任务标签与 `unlockTask` 样式一致，但 `unlockTask` 仍表示仅开放接取资格，二者不得合并。顶层 `unlockStage` 仅在有值时显示；`stepUnlockStage` 保留在实际生效的步骤内，不得汇总成任务完成解锁。
- **数量计数器**：`共 X 个任务` 显示在搜索框下方、居左（`.control-row-4`，`.collection-counter` 内联 `margin-left:0; padding:0`）。
- **URL 参数**：`?type=/?sub=/?q=` 双向同步；`?task=` 直达详情。

### 9.5 事件图鉴 `/events` — `EventsView.vue`

**两个 Tab**（`?tab=` 切换）：`random` 随机事件 / `explore` 探索区域，共用图片网格与详情弹层。

- **地图筛选**：`UiSegmentedTabs`（全部+5 大地图：秋日荒野/索利德山地/魔爪湖畔/黑森林/霜烬平原），两 Tab 共用，手机端自动适配；大地图名由预解析 `events.json.mapNameMap` 提供。

- **随机事件 Tab**：
  - 数据源：运行时读取 `data/parsed/events.json`；事件与地图、分组、概率和奖励关联在构建期完成。
  - 卡片：**纯图片网格**（`UiCardGrid` + `UiItemCard`，桌面 3 列 / 手机 2 列），16:9 cover 大图 + 底部名称胶囊 + 右下角分组徽标（普通 rare1 / 稀有 rare2；颜色映射到品质体系 rare1→q1 灰、rare2→q3 蓝，与物品页面统一）。
  - 详情：事件大图、描述、交互按钮、出现地图（chip）、刷新概率（chance%）、冷却 CD、**事件奖励**（`reward-grid` 同任务样式，点击 `goToItem` 打开物品）。
  - URL：`?tab=random&map=&q=&event=`。
- **数量计数器**：`共 X 个事件/探索区域` 显示在搜索框下方、居左（`.control-row-4`，同任务图鉴），数量取当前页签经地区和搜索条件过滤后的实际结果。
- **探索区域 Tab**：
  - 构建期数据源：`raw/exploreArea.json`（地图归属按 id 前缀 explore1→c1_map…）+ `raw/mon.json`（敌人名）+ `raw/consume.json`（消耗）+ `raw/reward.json`；页面只读取预解析事件数据，不重新请求原表。
  - 卡片：同图片网格（`ts_*`/`explore*` 场景图），右下角品质徽标（名称 `getRarityName`：普通/稀少/珍贵，颜色走 theme.css 品质色 `--qN`）。
  - 详情：区域描述、所属地图、探索等级 Lv、耗时（分钟）、队伍人数、消耗（G）、探索点位、遭遇敌人（chip）、**探索奖励**（同任务样式）。
  - URL：`?tab=explore&map=&q=&explore=`。
  - **图片**：`/images/event/{img}.png`；原图按资源包中的事件/探索业务目录归档。
- **卡片名称**：使用 `UiItemCard` 默认名称胶囊（底部、暖棕羊皮纸底）。
- **奖励解析**：复用 `gameMappings.parseRewardEntries`（任务/事件共用，输出 `{entries, text}`）+ `reward.json` 的 `items[].rules[]`。

### 9.6 兑换 `/exchange` — `ExchangeView.vue`

- **数据源**：`parsed/parsed-exchange.json`（[scripts/parse/exchange.mjs](../scripts/parse/exchange.mjs) 从 `itemExchange/reward/consume/item` 解析内容，并联 `shop/general/packDisplay/activityList/condition/task` 判定正式入口、随机池、开放时段与种子解锁任务）。
- **模型**：`itemExchange.json` 只定义兑换内容，不能单独证明条目已实装。地区、种子、兔子、积分、皮肤与补给类必须被当前游戏入口引用才可展示；同一可见性索引同时用于兑换页、全局搜索和物品获取途径。
- **一级分类**（筛选按钮，10 个大类）：委托兑换 / 地区商店 / 兔子商人 / 活跃兑换 / 商店积分 / 种子兑换 / 每日补给 / 爬塔兑换 / PVP兑换 / 通用兑换。符石合成移至符石图鉴，兑换页不展示其分类或条目。地区商店只取地图按钮实际打开的 4 个商店，共 37 项；黑森林与霜烬平原共用 `c4_map_shop`。商店积分合并 `packDisplay` 中可见的 `packType=2/5` 入口，依配置顺序展示氪金商店、时装、星型徽印、翼型徽印、回忆结晶；原 21 项积分/氪金商品加 2 款时装，共 23 项。无入口的 `monyshop`、`zhongziShop`、`payKeShop`、隐藏礼包，以及 `baodimap*`、旧测试组和停用工资兑换均不展示。
- **时装卡片**：复用 `UiExchangeTrade` 的 `skin` 竖卡变体，遵循 `PackHeroSkinTempUI` 的角色名 → 商店立绘/品质色皮肤名 → 奖励道具 → 价格布局。构建期按 `shop.shopList[].skins[].heroSkin → skin.heroTypeId → hero.name` 关联角色，封面严格使用 `skins[].img` 对应 `PackPane/shop_skin*.png` 原图。底部从 `itemExchange.consume → consume` 展示金额与货币，两款当前均为 100 氪金；静态图鉴没有账号拥有数据，不显示“已拥有”或绿色领取勾。封面和道具可打开物品详情。统一来源索引指向 `?cat=shop&sub=fuZhuang`，旧 `?cat=fashion` 链接兼容迁移并保留搜索和物品详情参数。
- **二级子分类**：地区商店按正式商店入口分为秋日荒野 / 索利德山地 / 魔爪湖畔 / 黑森林与霜烬平原；共用商店的筛选标签固定为“黑森林/霜烬平原”，并由全局黑名单中的同名组合项控制。种子兑换取消原始地区分类，改为全部候选 14 项 / 固定商品 4 项 / 随机商品 10 项；两个随机池均为 5 选 2，并从 `showCondition → condition → task` 显示正式解锁任务。兔子商人直接展示后续版本的完整 37 项候选，只保留紫/蓝/绿/白品质筛选；随机规则为紫 5 选 2、蓝 10 选 3、绿 19 选 4、白 3 选 1，每次共出现 10 项。委托兑换保持原分类，不附加解锁条件。
- **商城商品卡片**：氪金商店、星型徽印、翼型徽印和回忆结晶使用 `UiExchangeTrade` 的 `shop` 变体，遵循 `PackCenterTempUI.RefreshItemExchangeUI` 的配置商品名（含数量）→ 品质渐变与大图标 → 货币图标和价格布局。底板、绿色限购条、品质渐变均使用原版图片；3:4 卡片桌面多列、手机四列。限购展示配置上限，不模拟账号剩余次数或已售罄状态。
- **其他兑换卡片**：使用 `UiExchangeTrade` 多列羊皮纸卡片网格。`limitText` 展示每日/每周/每月/总限；种子和兔子卡片不再展示 `metaText`，改在刷新规则页集中展示。每日补给只保留活动入口引用的下午茶和晚宴，并显示 12:00-23:59 / 18:00-23:59。点击物品 → `?itemId=` 打开物品详情。
- **普通兑换紧凑布局**：除商城和礼包专用布局外，兑换页启用 `compact` 羊皮纸变体；名称与奖励数量单行居中，长名称省略并提供完整悬停标题。限购下一行靠右并弱化边框底色，物品图标去除底框和上方分隔线，按原图透明留白等比微调；底部仅显示居中的材料图标与数量，价格用主题正文色并缩小。普通商品与商城保持同样的 3:4 外框，内部间距按各自样式细调；多个材料自然换行，有额外内容时允许增加高度。两类商品统一桌面最小列宽 110px、手机每行四张。
- **地图名全局映射**：`gameMappings.MAP_NAMES` / `getMapName`（c0~c5 及 C0/C5/c0_map 归一化）。
- **刷新规则**：兔子商人隐藏独立的“全部候选”子类行，在品质筛选末尾增加“刷新规则”；活跃兑换隐藏无实际选择意义的“s1”子类行；种子在全部候选/固定商品/随机商品末尾增加“刷新规则”。列表顶部摘要和种子/兔子商品规则说明移入规则页，复用 `UiSection`、`UiListRow` 和羊皮纸面板，按预解析 `metaText` 分组展示对应商品；保留候选池、每次购买数量、种子解锁条件，原表和预解析内容不删除。规则始终取完整候选，不受当前品质或固定/随机筛选影响。
- **URL 参数**：`?cat=/?sub=/?rarity=/?q=/?view=rules` 双向同步；`rarity` 仅用于兔子商人，`view=rules` 仅用于种子和兔子规则页，切回商品筛选时清除。旧 `sub=all/s1` 链接继续有效。
- **PVP 兑换**：`pvp` 一级分类里包含（现有 RewardsView「挑战赛奖励-兑换奖励」也有一份，暂并存，待定保留哪个）。

### 9.7 副本图鉴 `/dungeons` — `DungeonsView.vue`

- **职责边界**：页面负责关卡与房间详情、掉落来源；`DungeonRouteMap.vue` 独立负责路线切换、节点聚合、缩放、鼠标/触摸拖动与房间选择事件，父组件不得再复制地图手势状态。
- **详情区块**：“特殊掉落”“通关结算掉落”“副本预览掉落”使用 `UiSection` 折叠结构，打开关卡时默认收起；“首次通关奖励”保持直接展示。
- **预览来源**：`showReward` 展示名统一为“副本预览掉落”；奖励池按物品与当前关卡的 `reward`、BOSS 自动掉落链交叉匹配，标注“通关结算”或“BOSS 掉落”，无法由配置证明时显示“预览配置未注明”。禁止仅凭同名物品推断宝箱或采集来源。
- **房间标题**：布局节点的 `room.name` 可能是 `1/2/3`、`A/B`、`start/boss` 等内部布局标记，不作为房间卡片标题展示；页面只展示解析后的实际房间内容名称、等级与隐藏状态。
- **数据与 URL**：摘要和关卡详情按需加载；`map/q` 筛选，`battle` 打开详情，掉落定位保留 `drop/dropTab/dropEntry`。解析链、房间规则及定位见 [副本图鉴专题](features/DUNGEONS.md)。

### 9.8 模拟招募 `/gacha` — `GachaView.vue`

- **定位**：独立全屏的游戏皮肤页，支持角色与魔物蛋的本地模拟招募；保留模拟标识，不表示账号真实结果。
- **数据源**：`parsed/gacha.json` 与 `parsed/gacha-presentation.json`；规则复用 `gachaSim.js`，本地状态由 `gachaState.js` 管理。
- **交互**：角色池为翻卡、揭晓、角色结果；蛋池为开袋、逐蛋揭晓、奖励结算。跳过演出不得改变完整抽取结果。
- **布局**：`GachaStage` 统一画布与缩放，业务样式集中在 `gacha.css`，不进入公共 UI 出口。
- **URL 参数**：`kind=hero|pet`、`pool=<poolId>`、`view=pool`（概率详情），双向同步并保留其他查询参数。
- **详细约定**：模块职责、素材、缩放模式、音频与验证见 [模拟招募专题](features/gacha/GACHA.md)。

### 10. 其他 `/rewards` — `RewardsView.vue`

- **数据源**：`parsed/parsed-pvp.json`（挑战赛）、`parsed/parsed-hidden.json`（隐藏物品）、`petSetting`（槽位消耗）。
- **Tab**：挑战赛奖励（兑换/段位/排名/战斗结算/赛事规则）、被隐藏的物品（按大地图分组）、育室槽位消耗（银币/氪金扩建，图标用 `REWARD_MODE_INFO`）、占位奖励。
- **挑战赛完整信息**：段位奖励逐项显示 `rankInfo.score` 积分门槛，战斗结算显示胜负积分结果；赛事规则读取游戏界面实际使用的 `sessionDes` 和 `pvpArea[].des`，补充每日挑战次数、胜负奖励、付费追加次数及三个赛区的当前限制。`pvpDes` 测试文案、内部队伍/模式 ID 和可能过期的 `sessionTime` 不进入预解析产物或页面。
- **被隐藏的物品点位预览图**：`parsed-hidden.json` 条目带 `prevImg`（`/images/hidden_prev/{点位名}_prev.{png|jpg}`），有图则显示缩略图（`.hidden-prev-img`，点击全屏查看 `.prev-img-overlay`），无图不显示；图片来自 TapTap 帖子《被隐藏的物品点位》（27 张），映射表维护在 `scripts/parse/hidden-rewards.mjs` 使用的 `HIDDEN_PREV_MAP`（roomId → 文件名，见 `src/utils/hiddenRewardsData.js`），重新生成数据不丢失。
- **交互**：物品点击 → `?itemId=` 唤起物品弹窗。
- **URL 参数**：`?id=pvpExchange*/tier/rank/pvpWin/pvpFailure/hidden-*` 定位并高亮对应区块。

---

## 十、详情弹窗与 URL 双向同步规范

满足"外部组件/页面全局唤起详情"统一性，图鉴详情一律走 **URL Query 监听 + 顶层/全局弹窗**，避免路由跳转丢状态。

| 参数 | 含义 | 监听方 | 弹窗 |
| :--- | :--- | :--- | :--- |
| `?itemId=` | 物品详情（全站通用） | `App.vue` watcher | `ItemDetailModal` |
| `?id=` | 角色/魔物/怪物/魔物蛋详情 | 对应视图 | 各视图弹窗/覆盖层 |
| `?task=` | 任务详情 | `TasksView` watcher | 页面任务详情 |
| `?event=` / `?explore=` | 事件/探索详情 | `EventsView` watcher | 页面事件详情 |
| `?battle=` | 副本关卡详情 | `DungeonsView` watcher | 页面副本详情 |

**双向同步约定**：
1. 列表点击 → `router.push({ query: { ...route.query, itemId: item.id } })`（或 `id`），**不直接操作弹窗 visible**；跨页面点击物品时不得写死跳转 `/items`，必须保留当前页面路径及已有查询参数；
2. 弹窗关闭 → 必须清除对应 URL 参数（`router.replace`），触发 watcher 自动隐藏；
3. 顶层 watcher（App.vue）统一处理 `itemId`，其他 `id` 由各视图处理；
4. 物品弹窗内部历史栈（`pushItemDetail`/`popItemDetail`）用于"查看上一个"回退；历史项固定为 `{ item, bodyScrollTop }`，深入奖励/配方原料时保存当前正文位置并将新物品置顶，返回时用“立即 + rAF”恢复上一件物品正文位置。
5. 弹窗层级固定为：页面详情 `2000~3000` < 全局物品详情 `5000` < 顶栏/设置 `10000` < 公告、关于、提示等系统弹窗 `12000` < 更新提醒 `13000`。从成就、任务等详情打开物品时，物品详情必须覆盖当前页面详情；系统信息必须覆盖所有业务详情。
   全局更新与图片预览同样复用 `UiModal teleport-to="body"`，通过 `globalModalLock` 统一锁背景，按 `100dvh` 与安全区限高，正文滚动、头部/底栏保持可触达。所有覆盖界面用 `useOverlay` / `overlayStack` 登记关闭动作；原生 `backButton` 仅在存在覆盖层时临时注册，先处理最上层，关闭全部后注销监听以恢复 WebView 原生历史返回。不得另加按主页路径退出逻辑。
6. **桌面详情使用覆盖式布局**：`.app-container` 为页面滚动根，详情锁视口、正文内部滚动，关闭后返回原位置；嵌套层共享滚动所有权，路由变化清理旧状态。组件参数与生命周期见 [UI 使用规则](UI_COMPONENT_LIBRARY.md#3-使用规则强制)，滚动残影、位置丢失和安全区故障见 [排障记录](KNOWN_BUGS_AND_FIXES.md)。

---

## 十一、数据管线（构建时清洗）

设施预解析由 `scripts/parse/facilities.mjs → facilityData / campFacilityData` 生成 `parsed/facilities.json`。原有四类设施结构保留，追加 `key:camp`（`buildings/research`）；原表仅在构建期读取。建筑 N 升 N+1 的费用、条件和奖励来自 N 级，效果来自 N+1；满级不生成升级条目。建筑 `att` 取当前级，建筑 `playerAbility` 逐级累加，同一研究的能力只取选定等级，不逐级叠加。研究效果沿用游戏 `des/addDes`，前置、费用、时间与改良配方外键分别保留。配置差异仅记录内部文档，不显示审计状态。

**构建前置**：完整数据再生成需要 `raw/`、副本派生输入及剧情资源；当前入口也支持缺原表时沿用已有产物，条件和限制见 [README 构建前置](../README.md#构建前置与原表维护)。沿用产物不代表重新校验或生成了数据。

**显式同步**：`node scripts/dev/sync-raw.mjs` 默认预览所有变更；`--apply` 仅补缺，`--apply --replace` 才更新已有完整原表和解析器所用的兼容别名（如 `hero.json → hero/hero.json`、`equipGlobalConfig.json → equip/装备符石数据对应表equipGlobalConfig.json`）。所有 JSON 先校验再执行，不混用一个源表的不同版本。`dungeonBattle*`、`monsterTowerUsage.json` 等派生输入不参与原表覆盖，须从可信备份补齐或按维护流程提取；副本路线/房间效果维护默认写入 `raw/`，不再写入已弃用的 `public/data` 根路径。

预览会汇总无效源 JSON，`--apply` 默认拒绝这类源目录；只有确认不需要的无效表可排除后才使用 `--skip-invalid`。已有版本不匹配时，缺失别名标为 `blocked`，不在补缺期间制造原表/别名版本混用；需要更新时重新预览 `--replace`。

> **目录约定**：构建期完整游戏原表统一放仓库根 `raw/`（`.gitignore` 忽略，不进 dist）。`readJson` 优先读 `raw/<path>`，仅为兼容旧输入及中间产物兜底 `public/data/<path>`。浏览器使用的派生产物统一写 `public/data/parsed/`；副本提取表、`monsterTowerUsage.json` 等供下一轮构建使用的中间输入保留在 `raw/`。禁止任务维护脚本将完整 `battle.json`、`room.json` 替换成裁剪版。
>
> **运行时只保留 parsed + 少数 app 内容 JSON 在 `public/data/`**：`notice.json`（公告）、`dialogs/*`、`taskDialogs/*`（剧情）和 `parsed/*`。请求失败只可回退同版本包内运行时产物，禁止回退原始游戏表。组件直接读取的小表已透传进 `parsed/`：`menu.json`、`diary.json`、`monLevelStrength.json`、`pet.json`。
>
> **room 单表定论**（经原始表核对，纠正了"两表互补不可合并"的结论）：`raw/room.json` = Config_decrypted 原始完整房间表（31.4MB，battleData 含 `monRounds/spObj/npcList` 等全部字段）。一个原始表即可同时供 monsters/tasks（读 `monRounds`）、hidden-rewards（读 `spObj` 采集点定位）；构建函数各自自取所需字段，无需预裁剪。`raw/newOrder.json`（委托订单，goods 数组）由 tasks 链读取；`raw/market.json`（货运小车）当前为孤儿（兑换分类 market 来自 `itemExchange.json`，不是本文件）。
>
> **隐藏奖励「前往」精确定位**：一个物理房间（roomId）可含**多个采集点/奖励组**，`parsed-hidden.json` 会为每个采集点生成**独立一条**（同一 roomId 多条，勿合并——这是正确数据）。为让「前往」精确定位到具体采集点，每条隐藏奖励带稳定唯一 `id` = `roomId + 奖励项摘要hash`；`item-sources` 的 hidden 源 `id` 用同一值，Rewards 页 DOM id 为 `hidden-<id>`、`scrollToTarget` 按 `id` 匹配。切忌只用 roomId 作 DOM id（同房多采集点会 id 冲突导致前往命中错条目）。

成就、配方、事件页面是 parsed-only 运行模式：浏览器只读取 `parsed/achievements.json`、`parsed/recipes.json`、`parsed/events.json`，不得在预解析失败时回退加载多张原始表并再次运行构建解析逻辑。

| 原始表 | 当前来源 | 关联页面/产物 | 更新要求 |
| :--- | :--- | :--- | :--- |
| `mon.json` | `Config_decrypted/mon.json` 完整原表 | 正式怪物图鉴、搜索、副本怪物 | 预览核对后可同步新版完整原表；归一化仅在构建内存发生；执行 `npm run data:build` 并核对字段及关联 |
| `skill.json` | `Config_decrypted/skill.json` | 角色图鉴、魔物图鉴、怪物图鉴及 `heroes/pets/monsters.json` | 换表后必须重建全部页面预解析产物，并复核技能字段兼容性 |
| `skin.json` | `Config_decrypted/skin.json` | 角色图鉴皮肤页及 `parsed/heroes.json` | 只采用 `show=true` 且有正式角色绑定的条目；换表后执行 `npm run data:build` |
| `equip/装备符石数据对应表equipGlobalConfig.json` | 游戏装备全局配置 | 装备详情属性预览（品质/品阶/强化系数） | 装备规则变更后执行 `npm run data:build`，页面不得另写一套系数 |
| `homeLevel.json` | `Config_decrypted/homeLevel.json` | 装备详情正式强化上限（当前锻造台开放至 9 级，对应强化 50 级） | 营地建筑等级表更新后与 `equipGlobalConfig` 同批替换并执行 `npm run data:build` |
| `playerLevel.json` | `Config_decrypted/playerLevel.json` | 角色/魔物等级模拟的正式玩家等级上限；当前 51 档是下一等级经验边界，正式可达上限为 50 | 玩家等级表更新后执行 `npm run data:build`，页面禁止写死 80/100 |
| `homeItem.json` | `Config_decrypted/homeItem.json` | 家具图鉴主体、外观 UI 图标引用、制作消耗 ID 与来源标签 | `objType` 与 `category/sourceTags` 分开处理；更新后重建 `furniture.json` 并核对正式/废稿集合及缺图清单 |
| `item.json` | `Config_decrypted/item.json` | 物品图鉴及家具图纸正反向关系 | 家具/皮肤图纸只按 `useActionPara.homeItems[].typeId/skin[]` 精确绑定，不按名称猜测 |
| `consume.json / playerInit.json / condition.json / task.json` | `Config_decrypted` 对应完整原表 | 家具制作材料、初始配置量与源码开放条件摘要 | 条件按 `rules/need/reverse` 解析并由任务表补全步骤；与 `homeItem.json` 同批更新后执行 `npm run data:build` |
| `ai.json` | `Config_decrypted/ai.json`，SHA-256 `ED60FC97...D8C8FA7` | 仅怪物图鉴构建链，用 `mon.aiId` 过滤当前 AI 实际调用的技能 | 与 `mon.json` 同批更新，换表后同步更新本表来源/摘要并重建 `monsters.json` |
| `monsterTowerUsage.json` | 完整 `Config_decrypted/tower.json`、`battle.json`、`room.json` 的轻量派生索引（产物写 `raw/`） | 怪物图鉴爬塔形态的塔名与全部实际楼层 | 完整配置换表后执行 `npm run data:monsters:tower`，再执行 `npm run data:build` |

- 预处理脚本（统一入口 `node scripts/parse/index.mjs`，即 `npm run data:build`；`npm run build` 自动先执行，全部产物再生成）：
  - [scripts/parse/search.mjs](../scripts/parse/search.mjs) → 生成 `parsed/search-index.json`、`parsed/item-sources.json` + `src/types/data-types.d.ts`（内部合并 PVP/隐藏/副本固定装备来源）
  - [scripts/parse/pvp.mjs](../scripts/parse/pvp.mjs) → `parsed/parsed-pvp.json`、`parsed/parsed-pvp-sources.json`
  - [scripts/parse/hidden-rewards.mjs](../scripts/parse/hidden-rewards.mjs)（场景宝箱）→ `parsed/parsed-hidden.json`、`parsed/parsed-hidden-sources.json`；**数据源为 `raw/room.json`（Config_decrypted 原始完整房间表）**，`buildHiddenRewards` 遍历时用其 `spObj` 采集点引用定位，不依赖额外裁剪；条目带 `prevImg` 点位预览图（映射表 `HIDDEN_PREV_MAP`，图片在 `images/hidden_prev/`）
  - [scripts/parse/affixes.mjs](../scripts/parse/affixes.mjs) → `parsed/itemAffixes.json`；只反查未标记“暂不使用/测试/废弃/弃用”的奖励实际引用的装备组，并合并同一装备的重复前缀集合，禁止把旧版测试词缀当作正式可携带效果
  - [scripts/parse/exchange.mjs](../scripts/parse/exchange.mjs) → `parsed/parsed-exchange.json`
  - [scripts/parse/items.mjs / runes.mjs / furniture.mjs / tasks.mjs / heroes.mjs / pets.mjs / monsters.mjs / recipes.mjs / achievements.mjs / events.mjs / pet-eggs.mjs / dungeons.mjs](../scripts/parse) → 页面级预解析文件；副本大型详情按实体拆分并按需加载，同时生成 `parsed-dungeon-sources.json` 供统一物品来源索引合并，家具与其余页面保持单文件（纯函数与浏览器端共用）
  - [scripts/parse/runtime-tables.mjs](../scripts/parse/runtime-tables.mjs) → 运行时小表透传：把 `raw/` 中本就以最终形态存放、由组件直接 fetch 的表原样输出为 `parsed/menu.json`、`parsed/diary.json`、`parsed/monLevelStrength.json`、`parsed/pet.json`，使浏览器运行时零 `public/data` 根目录原始表请求
  - [scripts/parse/gacha.mjs](../scripts/parse/gacha.mjs) → `parsed/gacha.json`：候选池、星级权重与保底次数沿用既有重数据产物（与 `item-sources` 同源），本模块只做**增量附加**，从 `raw/heroPool.json`、`raw/petPool.json`、`raw/heroPoolTime.json`、`raw/petPoolTime.json` 补上 `percTip`（官方概率文案，保留 `{5星}`、`{rareNList}` 占位符由页面替换）、`upTypes`、`packDisplay`、`para`、`typeGuaranty`、开放说明与卡池按钮贴图，并从 `raw/playerInit.json` 输出 `initialWallet`（新号初始货币与道具，供页面作为模拟钱包起算值）；产物缺失时返回空 `pools`，由页面显示错误态而不是编造数据
  - [scripts/parse/skin-models.mjs](../scripts/parse/skin-models.mjs) → 皮肤小人静态图映射，供 `items.mjs` / `heroes.mjs` 构建共用；核对 `public/images/skin-models/manifest.json` 的 skeletonName、skinName 与图片存在性后写入 `skinUnlock.modelImage` / `skins[].modelImage`，本身不单独产出 parsed 文件
  - [scripts/parse/extractDungeonRoutes.mjs](../scripts/parse/extractDungeonRoutes.mjs)（开发机手动执行，不被 `index.mjs` 自动调用）→ 从解密版 `battle.json` 提取副本路线图所需的最小字段写入 `raw/`，再由 `dungeons.mjs` 发布
  - `scripts/dev/check-task-data.mjs` 默认只读检查。`--apply` 才生成 `parsed/dialogIndex.json`、`parsed/dialogSegments.json`、任务引用报告并复制缺失剧情，同时补缺完整 `raw/battle.json`、`raw/room.json`、`raw/condition.json` 及其兼容别名；更新已有原表需额外 `--replace`，绝不裁剪原表。
  - [scripts/dev/update-monster-tower-usage.mjs](../scripts/dev/update-monster-tower-usage.mjs)（怪物爬塔楼层维护，开发机手动执行）→ 从完整塔层、战斗和房间配置生成约 1.5KB 的 `raw/monsterTowerUsage.json`；按游戏源码使用的 `monRank=3` / `keyList: boss` 判定只保留 Boss，不复制三张大型原表。原始表源在 `raw/`（mon.json 读 `raw/mon.json`）。
  - 产物统一在 `public/data/parsed/`：`search-index.json`、`item-sources.json`、`dialogIndex.json`、`dialogSegments.json`、`parsed-pvp.json`、`parsed-pvp-sources.json`、`parsed-hidden.json`、`parsed-hidden-sources.json`、`parsed-dungeon-sources.json`、`itemAffixes.json`、`parsed-exchange.json`、`furniture.json` 及页面级摘要/详情文件；副本详情按关卡生成在 `parsed/dungeons/*.json`，怪物列表、形态、技能机制与配置奖励统一写入 `parsed/monsters.json`。
  - 怪物数据链：`fileMon.json` 定义官方本体、图鉴说明与图鉴战利品；`mon.json` 提供基础属性、完整技能槽、`aiId`、携带效果和模型家族；`ai.json` 的 `aiModel` 提供当前实际调用的技能槽下标，并以 `type=6 / para.string_para` 定义真实变身目标；`skill.json` / `buff.json` 提供技能事件与 Buff 配置。构建顺序必须是 `mon.aiId → ai.aiModel(type=1).para.int_para → mon.skillList[index] → skill.json`，AI 有明确技能节点时不得把未引用的历史技能展示出来；倍率与基础伤害均为 0 的事件不得标成“0% 伤害”。形态关系在构建期额外读取 `exploreArea.json`、完整 `raw/room.json` 与 `raw/battle.json`、派生 `dungeonBattle.json` 与 `dungeonBattleRooms.json`；`monsterTowerUsage.json` 是通过 `npm run data:monsters:tower` 从完整 `tower/battle/room` 表生成的轻量实际楼层索引。对于 `*_boss` 与去后缀通用形态的同组关系，构建器额外生成 `towerBossAppearances`，只保留塔名与楼层摘要。`parsed/monsters.json` 只输出 `monsters` 正式图鉴数组，不再生成 `handbook` 全量单位数据；最终只把关系类型、变身条件和塔层摘要写入产物，不输出房间/关卡来源明细。`monLevelStrength.json` 在详情打开时单独加载（`parsed/monLevelStrength.json`）用于等级滑块计算；运行时怪物页不请求上述来源表，也不生成来源分片。移除前代码、旧产物和头像完整快照已移至项目外 `E:\Desktop\html\myrzg\backups\full-monster-handbook\2026-08-31\`，不参与构建。
  - 副本：输出轻量 `parsed/dungeons.json` 与按关卡加载的 `parsed/dungeons/{battleId}.json`。房间、采集、效果、实际掉落与反向来源约束统一见 [副本图鉴专题](features/DUNGEONS.md)。
- 搜索索引构建来源：hero / item（含碎片名智能映射）/ homeItem / pet / achievement / menu / buff / mon / fileMon / task / randomEventInfo + randomEventArea / exploreArea / itemExchange / parsed-hidden（覆盖 14 类：角色、物品、装备、家具、魔物、魔物蛋、成就、料理、怪物、任务、事件、探索、兑换、隐藏宝箱）。
  副本来源：普通物品、魔物蛋与固定装备均沿实际奖励反查；随机装备预览不能反推固定来源。定位字段与去重规则见 [副本图鉴专题](features/DUNGEONS.md#掉落与来源定位)。
  索引维护：`npm run search:update` 重建搜索索引、来源及类型文件，会从原表重新计算副本来源，并合并已有 PVP/隐藏产物；不能只依赖陈旧的副本来源文件。全量数据使用 `npm run data:build`。
  匹配规则（App.vue filteredSearchIndex）：多词查询按空格切词 AND 匹配（每个词都命中 keywords 即命中），排序 精确 > 前缀 > 包含。
- 反向来源表：保留怪物掉落、成就奖励、任务奖励、配方制作及 PVP/隐藏/副本来源；`supplementalItemSources.js` 补充实际引用的随机事件、探索、采集、种植、怪物图鉴战利品、营地升级、活动签到、章节首通和初始引导战役。新增来源仅反查实际物品身份，排除零权重/零数量及测试奖励，不展开 `equipGroup`。采集图鉴先经 `roomCollect` 外键查询类型，研究额外产出保留研究等级条件。营地奖励绑定升级前档位，并记录 `level/targetLevel`；来源按 `/facilities?facility=camp&mode=building&building=&level=` 定位。事件/探索分别使用 `event/explore` 参数，探索直达必须同步为探索页签；没有真实详情页的来源不显示“前往”。通行证赛季和旧签到入口未确认的部分仅记入历史归档备份（`backups/audits-archive/SOURCE_COMPLETION_HANDOFF.md`），不生成用户可见的内部审计标签。
- 黑名单在**构建期**即过滤搜索索引与兑换预解析（`isBlacklisted`），运行期列表页再过滤一次。
- 来源后续补全：`remainingItemSources.js` 增加 `container/dailyPlan/gacha/tower/dismantle`；实际产物筛选统一调用 `acquisitionRules.getObtainableRewardRules`。容器必须从已有入口可达，点击父物品使用既有嵌套详情历史。招募来源以 `/gacha?kind=&pool=&view=pool` 打开现有卡池详情，不将记忆碎片状态映射为同名物品。普通来源只显示简短获取方式，不附加任务全文、消耗、数量、必得提示或卡池日期；保留宝箱/特殊装备/符石鉴定概率、采集位置、首通与必要的产出限制。塔层、分解按实际产物合并，不因数量不同重复展示；无对应页面时不显示“前往”。副本定位字段见副本专题。冗余文案和未消费字段在生成阶段去掉，不能只在页面隐藏。测试奖励和内部诊断不进入来源展示。详见历史归档备份（`backups/audits-archive/SOURCE_COMPLETION_FOLLOWUP.md`）。

---

## 十二、热更新与双轨分离架构

### 1. 双轨架构

- **轨道 A（核心代码）**：`dist` 产物（HTML/JS/CSS），走 Capgo Updater 原生持久化热更（zip 增量包）。
- **轨道 B（海量素材）**：原生图片/运行时 JSON 优先 CDN，失败回退包内同路径资源。JSON 必须与当前代码所属的清单 hash 一致；图片附构建版本参数并有限回退。完整包仍需含 `data` 与 `images`，CDN 优先不等于可以删除离线资源。

**运行版本**：热更新检查使用 `CapacitorUpdater.current()` 的实际 bundle 版本；builtin 采用插件/原生版本。仅在 ready 确认后同步兼容显示键 `local_web_version`，下载/切换前不得提前写入新版本。监听在失败或跳转前释放，回滚后再次读取实际 bundle，不能以旧 localStorage 值跳过可用更新。

**JSON 版本清单**：Vite 按 `data/parsed`、`data/parsed/dungeons`、`data/dialogs`、`data/taskDialogs` 四组生成带 hash 文件名的清单（`dist/assets/data-manifests/`），代码内携带路径及 SHA-256。首次请求对应目录时才读取并校验包内清单；CDN JSON 校验不符、8 秒超时、HTTP/格式错误时回退包内同版本文件并再次核验。Web 同域冲突显示错误并要求更新页面，不静默混用。`notice.json` 为实时公告例外。同路径请求去重，失败缓存清除以允许重试。

### 2. 发版流程

1. `npm run build`；
2. 将 `dist/` 全部文件（`index.html` 必须位于 zip 第一层根目录）打包为 `dist-{version}.zip`；
3. 上传 CDN，更新云端 `hotupdate.json`：

```json
{
  "version": "1.0.1",
  "downloadUrl": "https://myrzg.yxzmy.top/update/dist-1.0.1.zip",
  "body": "更新说明"
}
```

4. App 启动 `checkHotUpdate()` 比对版本（先查 Gitee APK 大版本，再查小包）→ `UpdateModal` 提示下载。

### 3. 发布前检查清单

发布前逐项确认，全部通过再打热更包：

- [ ] `npm run data:build` 已执行且无报错（parsed 产物为最新）
- [ ] `npm run verify` 通过（产物齐全 + 无旧脚本残留 + build 成功）
- [ ] `grep` 无旧脚本/旧文件残留（clean-data、common.css、*.bak、UI_REFACTOR_GUIDE）
- [ ] 无文本编码损坏：`node scripts/dev/audit-text-encoding.mjs` 通过（检测双重编码、非法 UTF-8 与替换字符；`npm run verify` 已含该静态检查）
- [ ] `dist/` 含 `data/parsed/` 全部新产物（页面级 + 既有表）
- [ ] `dist/data`、`dist/images` 与分组 JSON 清单齐全；不运行旧的 dist 删除清理策略
- [ ] CDN 上传完整同次构建产物；缓存过渡期保留旧的带 hash 的 `assets` 文件
- [ ] Web 正式部署使用 HTTPS（JSON SHA-256 校验依赖 WebCrypto）；版本检查失败显示可重试错误，不误报已是最新
- [ ] 版本号一致：`dist-{version}.zip` 文件名、`hotupdate.json.version`、`downloadUrl` 三处同步
- [ ] 轨道 A/B 双轨齐备：热更 zip（核心代码）+ CDN 素材（图片/大 JSON）
- [ ] 数据管线变更时已同步 `docs/SPEC.md`（数据管线章节）+ `docs/ARCHITECTURE.md`（数据流）

---

## 十三、DRY 红线清单

以下内容**禁止**在页面/解析器内重新定义，必须从对应模块 import：

| 内容 | 唯一来源 |
| :--- | :--- |
| 货币/氪金/经验的名称、图标 ID、图标路径 | `gameMappings.BASE_REWARD_*`、`REWARD_MODE_INFO` |
| 奖励 `rule.mode`（money/randomMoney/ke）展示 | `REWARD_MODE_INFO` |
| 职业/属性（元素）中文名与 slug | `gameMappings.JOB_*`、`ELEMENT_*` |
| 稀有度名称 | `gameMappings.RARITY_NAMES` / `getRarityName` |
| 属性 key 中文名 | `gameMappings.STAT_NAMES` / `translateStatName` |
| 技能名清洗（去 `Lv: N`） | `gameMappings.getCleanSkillName` |
| 技能/效果描述 `{值}` / `<值>` 高亮 | `gameMappings.formatHighlightedText` |
| 对话/邮件文本清洗 | `gameMappings.cleanDialogueBase/cleanDialogueLine/cleanMailContent` |
| 怪物头像规则（avatar→colect） | `gameMappings.getMonsterIcon` + `SKIP_SKINS` |
| 食谱预览清单、通用食材映射、食材组装 | `recipeUtils.PREVIEW_AVAILABLE_IDS / GENERIC_FOOD_TYPE_MAP / buildRecipeIngredients` |
| 物品/分类/奖励解析与缓存 | `itemParser` 各导出 |
| 全局黑名单 | `blacklist.isBlacklisted` |
| 图片/资源路径 | `env.getImageUrl` |
| JSON 数据获取 | `request.fetchWithFallback` |
| 弹窗骨架 | `UiModal` |
| 覆盖层关闭顺序 / 原生返回接入 | `overlayStack` + `useOverlay` + `nativeBackHandler` |
| 全局弹窗背景锁 / 内嵌详情位置恢复 | `globalModalLock` / `modalScrollCoordinator`（职责不同，不混用） |
| 全局搜索框 | `GlobalSearchBox` |
| 回到顶部 | `UiBackToTop`（`src/components/ui/UiBackToTop.vue`） |
| 抽卡星级权重 / 保底 / 重复转化 | `utils/gachaSim.js`（页签与演出不得自行算概率） |
| 卡池设计坐标系与等比缩放 | `utils/gachaLayout.js`（`gachaPos` / `gachaFitScale`） |
| 招募货币条槽位 / 抽取消耗行构建 | `utils/gachaCurrency.js`（`buildCurrencySlots` / `buildDrawOptions`，卡池页与结果一览共用） |
| Spine 演出加载与渲染 | `utils/gachaSpinePlayer.js`（`createSpineScene`，禁止页面各自搭 WebGL 管线；`fit`/`pad` 取景口径同源） |
| 抽卡演出音频（BGM 单例 / 音效开关） | `utils/gachaAudio.js`（`playBgm`/`playSfx`/`setSoundEnabled`，禁止面板各自 `new Audio`） |

**新增代码检查清单**：先用 `grep` 确认 gameMappings / recipeUtils / itemParser 是否已有同功能；有了就复用，没有才新增到对应模块（而不是页面里）。凡新增全局映射，一律放进 `gameMappings.js` 并在此文档补一行。

---

## 十四、文档维护约定

同一规则只在一个位置维护：本文件保留跨页面约束和页面契约，架构文档说明职责与数据流，UI 文档说明公共组件，功能细节放专题。其他文档只写必要摘要并链接来源。页面条目按定位、数据源、交互、URL 和专题链接组织；不追加逐帧参数、修复过程或聊天式纠正。参数以代码和原资源为准，修复过程写日报；历史审计注明日期与历史性质，不能作为当前功能状态。详见 [文档导航](README.md)。

> 目的：保证文档与代码现状一致，开发记录每天仅一份，按 UI 与交互、数据与解析、Bug 修复、重构与维护等模块汇总，在阶段完成、提交或发布前补全；不按修改次数、主题或时分秒拆文件。

| 操作类型 | 必须更新的 md |
| :--- | :--- |
| 代码/数据/配置形成可交付结果 | `docs/dev-logs/YYYY-MM/YYYY-MM-DD.md`（同日不同模块也复用同一日报，模板见 `docs/dev-logs/README.md`） |
| 路由 / 页面结构 / 通用规范变更 | `docs/SPEC.md`（总规范） |
| 目录结构 / 分层 / 数据流 / 构建链变更 | `docs/ARCHITECTURE.md` |
| UI 组件库 / 设计系统 / 页面骨架变更 | `docs/UI_COMPONENT_LIBRARY.md` |
| 数据管线（预处理脚本 / parsed 产物）变更 | `docs/SPEC.md`（「数据管线」章节）+ `docs/ARCHITECTURE.md`（数据流） |

**自检规则**：无需每次小调整后立即写日志；在阶段完成、提交或发布前，执行与改动范围匹配的验证，集中更新日报与权威文档，并在“验证 / 文档同步”明确完成和未执行事项。完整验收 `npm run verify` 包含重新构建，前提是原表及派生输入完整。

**文本编码约定**：文档、脚本与配置一律以 UTF-8 读写；脚本读取文本必须显式指定编码（Node 用 `readFileSync(path, 'utf8')`，Python 用 `open(..., encoding='utf-8')`），禁止依赖系统区域默认编码。遗漏编码参数会把 UTF-8 正文按 GBK/CP1252 误读后重存，产生“看着像中文、读起来全是错字”的双重编码损坏，且 Markdown 结构、换行与部分字符会被一并吞掉（2026-09-12 的 `SPEC.md` / `ARCHITECTURE.md` 事故即属此类，`AndroidManifest.xml` 注释亦曾长期处于 CP1252 误读状态）。只读检查入口 `node scripts/dev/audit-text-encoding.mjs` 已纳入 `npm run verify`；判定方式是把文本按 GBK 编回字节再按 UTF-8 解码——损坏文件会还原出可读原文，正常文件只会得到乱码。

---

## 十五、资源备份与图片压缩约定

> 目标：图片等大体积资源默认**使用原图**，只在明确指令下压缩；压缩前先备份原图，保证可回退。避免"图破了才发现没备份"。

### 1. 备份目录
- 原图/资源全量备份在：`E:\Desktop\html\myrzg\vue-myrzg备份-资源\`（`images` / `fonts` / `ui` / `data` 四个子目录）。
- **任何压缩/替换资源前，必须先确认该目录含当前资源的原图**。若缺失，先执行备份（robocopy）再操作。

### 1.1 原资源来源与目录命名（2026-09-11）

- 图片从项目同级 `UI_Atlases` 和 `4.24路资源包` 查找。后续导入按原业务目录/图集名归档，保留大小写与拼写：如 `Common_Atlas`、`BuildItem_Atlas`、`TipsManager_Atlas`，不再按使用页面新建 `MonstersView`、`Shop` 等副本目录。`sprites` 是图集导出容器，资源归属以其上层原图集名为准。
- 单独纹理保留原目录名；末级为 `l`、`obj` 等通用名或发生重名时保留必要层级，如 `chara/l`、`spriteimage/c001/obj`。多个页面复用同一路径，不为页面独立复制同一份图片。
- 当前魔物蛋纹理位于 `public/images/eggs`，魔物收益与招募数据生成器使用 `/images/eggs/`；资源包原位置仍是 `assets/res/texture/pet/eggs`。`Common_ItemIcon` 中的蛋道具图标裁切不同，不可直接混用。
- 历史目录迁移须同时更新动态路径、CSS、解析器与运行时产物、导入脚本和资源清单；上述命名是后续导入/整理要求，不代表当前所有旧目录已经迁移。原图与压缩/水印版、图集小图与 Spine 整张纹理需分别核对，不能只凭同名删除。
- 当前已删除 `MonstersView`，图集目录统一为 `PicHandBookPanel_Atlas`、`Common_Atlas`、`EmailPanel_Atlas`。邮件通用框直接共用 `Common_Atlas`，信纸归 `uipanel/emailpanel`；招募通用按钮共用 `Common_Atlas`，揭晓原纹理归 `uipanel/herogachashowpanel`，背景仅保留 `bg.png`。源码、构建产物和招募导入清单同步使用新路径，不保留旧目录兼容映射。
- 用户从模型获取的两张静态预览保留原像素，仅按模型名改为 `model-previews/obj_mon055.png`、`obj_mon069.png`；它们是派生预览，不是原 Spine 拼合纹理。模型原目录在资源包 `assets/res/spine/model/mon/obj_mon055`、`obj_mon069`，不把截图伪装成原图集小图。
- 图片重复检查是时点结果，不作为永久状态；运行 `node scripts/dev/audit-image-resources.mjs` 获取当前报告（只读）。2026-09-11 结果保存在 `backups/audits-archive/IMAGE_RESOURCE_AUDIT_2026-09-11.md`，同名但像素不同的加工版与原图应分别保留。

### 2. 压缩触发约定
- **默认不回退、不压缩**：项目里图片先用原图。
- **当用户说"压缩图片"时**才执行压缩；压缩前先把"将被压缩的原图"备份到上述备份目录（若尚未备份），然后把项目换成压缩版。
- 压缩后原图仍留在备份目录，可随时回退。

### 3. 压缩命令与说明
```bash
node scripts/dev/compress-images.mjs            # 只预览，绝不改图片
node scripts/dev/compress-images.mjs <子目录>    # 仅允许 public/images 及其子目录
# 只有用户明确要求压缩，且逐文件原图备份校验通过后才执行：
node scripts/dev/compress-images.mjs <子目录> --apply --allow-lossy
```
- 脚本逐文件核对备份的相对路径及 SHA-256，备份缺失或不匹配则拒绝执行；不允许用 `FORCE` 绕过。备份必须位于 `public/images` 外，可用 `--backup` 或 `MYRZG_IMAGE_BACKUP_DIR` 指定完整 images 备份根。
- **PNG**：256 色调色板量化是有损处理，不得称为无损或近无损；可能损失立绘细节和渐变色阶。
- **JPG**：quality 85 重编码也是有损处理。询问“是否压缩过”不构成再次压缩的授权。
- 小文件（<2KB）跳过；只有结果严格变小才写回（否则保留原图）。

### 4. 发布/构建影响
- 压缩只改 `public/images` 下文件内容，不改路径与引用 → 需重新 `npm run build` 打热更包 + CDN 素材更新。
- `npm run verify` 不校验图片内容大小，仅校验产物存在；图片质量由上述约定人工把关。

### 5. 回退
- 若某图压缩后观感下降，用备份目录同名原图覆盖回 `public/images` 对应路径即可。
~~~~~

### 重整前 docs/features/runes/RUNE_CATALOG.md

~~~~~text
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

筛选区按搜索、页签、筛选行、数量排列，数量采用 13px、600 字重及 `--text-muted`。公共吸顶裁剪要求筛选区是页面容器的直接子元素，实色正文背景放在 `[data-main-scroll]` 内；切换页签通过 `resolveScrollTarget` 操作实际滚动根。验证包含滚动中的布局及切换后的起始位置。

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
~~~~~

### 重整前 docs/features/facilities/CAMP_FACILITIES.md

~~~~~text
# 营地设施

## 范围

设施功能新增「营地升级」「属性研究」，保留原有四类设施配方。页面是配置图鉴，不连接游戏账号，不模拟实际升级或研究队列。材料、配方及来源跳转复用已有入口。


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

营地固定奖励复用 `gameMappings.parseRewardEntries` 兼容入口，不另写概率规则。

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

- 建筑 `level` 始终为当前等级；`upgrade.toLevel` 才是升级目标。来源跳转使用当前等级定位奖励，不能用目标等级。
- 研究 `level` 为目标研究等级；`all` 显示全部等级。
- `group` 为研究分类（`collect/make/adv`），`q` 为搜索文字。未指定建筑时取当前过滤结果首项；没有 `research` 时显示研究树，有有效 `research` 时显示项目详情。
- 未指定有效等级时展示第一级；显式 `level=all` 展示全部等级。点击研究节点进入第一级详情，「返回研究树」清除研究 ID 和等级，保留分类。
- 材料与奖励只追加 `itemId`，关闭全局详情保留所有营地参数。原设施 `tier` 参数继续兼容。
- 本页筛选使用 replace；跨项目的建筑、配方与家具跳转使用 push，浏览器后退按 URL 恢复。
- 所要求建筑等级确实存在时才生成跳转按钮，不把超出表范围的等级指向错误页面。

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

## 界面规则

- 建筑筛选移入正文，用七张原建筑图标卡切换；手机每行四张。等级选择放在建筑标题下。每个升级档位使用卡片，当前与升级后的外观、说明和属性并排，条件、外观入口、材料和升级奖励位于下方；满级仅显示当前效果。单档全宽，多档桌面两列、手机单列。
- 研究项目移除下拉框，以采集、生产、冒险三组研究树呈现。节点使用原 `build_tree_botm` 底板和已有研究图标，详情标题使用 `build_tree_iconbotm` 菱形框；节点显示总等级，不伪造账号当前等级、锁定、进行中或已完成状态。
- `CampResearchPanelUI.RefreshUI` 按三组切换节点，点击节点打开研究详情；`CampResearchItemUI.RefreshUI/SetState` 读取原名称、图标、说明、等级与前置关系。网页沿用这种树状选择交互，但节点位置由 `prerequisite` 层级重新排列、连线由 SVG 绘制，并非 Unity 预制体坐标的逐像素复刻。
- 搜索保留命中研究的祖先路径，非命中的祖先节点淡化，计数仅包含命中项目。只按真实前置关系连线，空图安全返回，循环依赖显式报错。前置关系从左向右推进，同层分支上下排列；手机研究树只在自身区域左右滚动，首次显示时定位左侧起点，整页无横向溢出。
- 节点底板按原始 292×88 显示，保留左侧正方形图标框，图标以 60×60 contain 放入；名称、总等级在素材分隔线上方，描述在线下方。`CAMP_RESEARCH_NODE` 同时提供组件和布局连线尺寸，避免扩大节点后连线穿过卡片。「返回研究树」在详情正文右上角。
- 所有营地正文使用 `paper-panel` 外边框，根页面仍透明。保留共享吸顶裁剪、来源级别定位、物品详情历史和配方跳转。新增贴图与 `UI_Atlases/CampCenterPanel_Atlas/sprites` 对应原图 SHA-256 一致。


## 验证与发布

研究树地图容器沿用副本的 `--paper-dark` 背景、`--border-soft` 1px 边框和 6px 圆角，隐藏滚动条。桌面支持鼠标左键水平拖动，包括从节点开始拖动；移动超过 4px 才捕获指针，松开不触发研究详情。手机保留原生滑动，键盘仍可聚焦滚动区和点击节点。


发布时同步 `facilities.json`、新增素材及对应页面代码。构建与回归不要并发读写同一生成目录。

验证入口：`tests/unit/camp-facilities.test.mjs`、`tests/unit/camp-research-layout.test.mjs`、`tests/ui/camp-facilities.spec.js`；同时检查旧设施配方和来源定位。

重点检查建筑来源等级/目标等级、研究前置、末级费用隐藏、材料详情返回、长研究树拖动及移动端起点。明暗主题与 Android 真机按变更范围复测；历史测试计数只见 [每日日志](../../dev-logs/README.md)，不作为当前通过证明。
~~~~~

### 重整前 docs/technical/ACQUISITION_RULES.md

~~~~~text
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

## 符石接入

`buildItemData` 已在构建期为奖励类物品生成 `item.acquisition`，写入 `public/data/parsed/items.json`。浏览器通过 `fetchItemData()` 获取，直接读取该字段或调用 `getItemAcquisition(item)`，无需额外加载原始奖励表或消耗表。旧 `parseItemRewards(item)` 仍返回奖励组数组或 `null`。

符石图鉴的鉴定页签筛选正式 `useAction === 'appraisal'` 的物品，复用 `src/components/AcquisitionRewards.vue`；合成页签消费同构规则，完整实现见 [RUNE_CATALOG.md](../features/runes/RUNE_CATALOG.md)：

```vue
<AcquisitionRewards
  :acquisition="selectedItem.acquisition"
  title="鉴定"
  @item-click="handleItemClick"
/>
```

组件负责消耗、分组、概率、自选和随机装备候选展开，`costTitle` 可指定消耗区标题。父页面负责物品详情打开与返回，不复制弹窗历史、奖励规则或 URL 同步。符石实际属性通过 `runeData.buildRuneEffect` 统一，`itemParser.parseRuneEffect` 是其缓存适配入口。

解析器保留数据关系，不负责判断正式开放入口和全局黑名单。新页面仍需遵守项目图鉴可见性规则；测试配置和“未发现正式来源”诊断不加入页面文案。来源页路由、正式来源筛选与反查由 `searchData` 及对应业务来源模块负责，不通过奖励存在就认定玩法已开放。

## 兼容与验证入口

`gameMappings.parseRewardObject` 继续返回 `{ rewards, rewardItemNames }`，`parseRewardEntries` 继续返回 `{ entries, text }`。这两个旧摘要接口保持原字段结构，不作为概率页面的数据接口；概率、数量区间和候选池必须用 `parseRewardGroups`。

- 规则与真实鉴定表：`node --test tests/unit/acquisition-rules.test.mjs`。
- 原有奖励、锻造、设施：`node --test tests/unit/reward-style.test.mjs tests/unit/smithing.test.mjs tests/unit/facilities.test.mjs`。
- 桌面/手机详情：`npx playwright test tests/ui/acquisition-rules.spec.js tests/ui/smithing.spec.js tests/ui/facilities.spec.js`。
- 发布前运行 `npm run build` 同步预解析数据和前端包；构建写数据期间不要同时运行读取生成目录的全量回归。
~~~~~

### 重整前 docs/technical/SKIN_MODEL_EXPORT.md

~~~~~text
# 皮肤小人图片导出工具

脚本：`scripts/dev/export-skin-models.mjs`，快捷命令：`npm run skins:export`。

工具读取 `raw/skin.json` 中可展示且配置了角色、骨骼的皮肤，按 `skeletonName` 和 `skinName` 加载原版 Spine 模型，导出正面待机动画 `idle_front` 的第 0 帧透明 PNG。当前支持项目使用的 Spine 4.0 模型。

## 准备

- 在项目根目录 `vue-myrzg` 执行命令，已安装项目依赖（首次使用执行 `npm install`）。
- 本机安装 Google Chrome；脚本通过 Playwright 使用 Chrome 的 WebGL 渲染。
- 保留项目同级的 `4.24路资源包/assets/res/spine/model/npc/`。例如 `Npc_005_1` 对应 `npc_005_1/Npc_005_1.skel`、同名 `.atlas` 和图集引用的 `.png`。

## 使用

先在一个终端启动本地开发服务并保持运行：

```powershell
npm run dev -- --host 127.0.0.1 --port 4187 --strictPort
```

再在项目根目录打开另一个终端执行：

```powershell
npm run skins:export
npm run data:build
```

如果已有其他端口的本地 Vite 开发服务，可以直接复用，在导出终端指定实际地址：

```powershell
$env:SKIN_PREVIEW_URL = 'http://127.0.0.1:5173'
npm run skins:export
npm run data:build
```

导出依赖 Vite 提供渲染库模块，请使用开发服务，不使用生产预览服务。需要生成发布产物时执行 `npm run build`（已包含数据构建）。

## 输出与后续增加皮肤

也可以按角色 ID 导出普通角色的小人图到指定目录，例如米托拉：

```powershell
npm run skins:export -- --hero new_hero_002 --output-dir public/test2
```

此模式读取 `raw/hero/hero.json` 的 `viewData`，输出 `{角色typeId}.png`，不更新皮肤清单，也不需要构建数据。开发服务准备同上。

批量导出角色图鉴全部正式角色（排除 `hide: true` 的隐藏旧版，不读取 NPC 或怪物表）：

```powershell
npm run skins:export -- --all-heroes --output-dir public/test2/hero
```

每个角色按配置的 `viewData.skinName` 导出一张正面待机图。输出目录附带 `hero-models.json`，记录中文角色名、图片文件名、模型及来源哈希，方便查找；不包含额外时装。`--all-heroes` 与 `--hero` 不能同时使用，重复执行会重写同名图片和角色清单。

`Npc_007` 有两条不同的资源链，不能混用尺寸结论：

- **静态导出工具**读取项目同级资源包；遇到 510×359 的裁切图时，现有脚本在内存中补到 512×512（左/右各 1、上 153），记录到 `textureAdjustments`，不修改源 PNG。这是现有特殊兼容分支，不能作为通用 atlas 修复算法。
- **招募运行时**读取项目内 `public/images/gacha/spine/`。2026-09-13 按该 atlas 的 524×524 声明补图（左 4、上 158）；备份位于项目同级 `backups/spine-texture-canvas/`。此处补图不会改变导出工具所读取的外部资源。

同类问题用 `node scripts/dev/audit-spine-textures.mjs` 检查项目内 atlas/PNG 尺寸；补透明画布不能恢复已裁掉的像素。需完整恢复时从 AssetBundle 重导原始 Texture2D，并对导出与运行时分别核验。

- 图片：`public/images/skin-models/{皮肤typeId}.png`，透明背景，自动裁掉空白并保留 12px 边距。
- 清单：同目录 `manifest.json`，记录模型、动画、来源和文件哈希，供数据构建校验。
- 同名导出图片和清单会被重写；原版模型、贴图和 `raw` 表不会被修改。旧图片不会自动清理。
- 新皮肤的正式配置和原模型资源补齐后，重新运行上述导出与构建命令即可；脚本自动遍历符合条件的皮肤，不需要手动增加图片映射。
- 角色页与物品详情共用静态图，页面不运行模型动画；普通构建不重新导出图片。

找不到 Chrome 时先安装 Google Chrome；连接失败时确认 Vite 地址与 `SKIN_PREVIEW_URL` 一致；模型文件、配置皮肤或 `idle_front` 动画缺失时脚本会报错，需要检查原资源和配置。导出失败可能已更新前面的图片，应修正问题后完整重跑，再构建数据。
~~~~~
