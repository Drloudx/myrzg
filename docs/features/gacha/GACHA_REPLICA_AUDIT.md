# 模拟招募（/gacha）复刻审计：资源、布局真值、演出参数与现存问题

> 审计日期：2026-09-13 ｜ 范围：`src/components/gacha/`、`src/utils/gacha*.js`、`src/stores/gachaState.js`、`src/assets/gacha.css`、`public/images/gacha|eggs|Hero*_Atlas|uipanel|ItemBagPanel|Common_Atlas`
> 对照来源：`源码/源码/Assembly-CSharp/*.cs`、`4.24路资源包/assets/res/prefab/uiprefab/{heropoolpanel,herogachaanipanel,herogachashowpanel,heroshowpanel,petgachaanipanel,tipsmanager}`（组件 dump）、`4.24路资源包/assets/res/spine/**`、`UI_Atlases/*_Atlas/*.json`（border 真值）
> 实测证据：`ui-checks/gacha-probe/*`（本地 Vite + Playwright 分段截图与 DOM 取数）

## 0. 一句话结论

1. **资源能找齐**：卡池三页 + 演出所需图/音/骨骼在资源包内齐全；项目侧只缺 4 项硬资源 + 51 个 Npc 骨架 + 2 条断链（见 §3）。
2. **数据能对齐**：三个面板的坐标/尺寸/Tween 序列已从 prefab 与源码取到真值（见 §2、§4）；此前「prefab 锚点不可靠」的结论不成立——真正不可得的是 **Transform 绝对坐标**，锚定矩形与 tween 值都是可信真值。
3. **现存问题三类**：① 揭晓 Q 版小人被立绘盖住 + 大量演出段缺失（角色动画"没完成"的实感来源）；② 蛋池演出是简化实现（取景/星条/出蛋轨迹/背景/星色/皮肤都对不上）；③ **两池结束状态都不对**：蛋池应为 `GetRewardTip` 结算弹层（完全未实现），角色池结果页标题与货币条重叠且卡片表现缺失。

---

## 1. 面板 ↔ 代码 ↔ 数据源对照

| 游戏面板 | prefab / 数据结构 | 项目实现 | 现状 |
| --- | --- | --- | --- |
| `HeroPoolPanel` 卡池列表页 | `heropoolpanel`（231 组件） | `GachaPoolPanel.vue` | 基本完成（迭代最多） |
| `HeroPoolTips` 概率详情 / 记录查询 | 同在 `heropoolpanel`（**不是** tipsmanager）：UIPanel d620，概率区 698×668、记录区 780×578 | `GachaTipPanel.vue` | 基本完成 |
| `HeroGachaAniPanel` 翻卡演出 | `herogachaanipanel`：Timeline `gacha_ani` **10.6667s@60fps** + 3 个 Animator + Spine `elsa_rawcard`/`elsa_rawcard_desk` | `GachaCardPanel.vue` | 部分（缺信号/后处理/时序） |
| `HeroGachaShowPanel` 揭晓演出 | `herogachashowpanel`（159 GameObject / 83 粒子）：5 组 `ExtentionTweenPlay` 共 93 段 | `GachaRevealPanel.vue` | 部分（缺 `spineStage` 28 段、`classStars` 8 段、`heroName` 22 段、粒子） |
| `HeroShowPanel` 结果一览（角色池结束状态） | `heroshowpanel`（543 组件、`HeroShowItem` ×11） | `GachaResultPanel.vue` | 差异大 |
| `PetGachaAniPanel` 蛋池演出 | `petgachaanipanel`：`bgAniTween` 8 段 + `petShowObj` 2 段 + `petShowUI` 24 段 | `GachaPetPanel.vue` | 简化实现 |
| `GetRewardTip` 结算（蛋池结束状态） | `tipsmanager` 内 `item_get` 弹窗（UIPanel d1080、mask α0.502、`ItemBagCell` Large） | `GachaPetResult.vue` | **未实现：文件 0 字节且未被任何代码引用** |

### 坐标口径（重要，别再当"不可得"）

- 设计根 = **1334×750**（由 `white` 1534×750 的 `L rel0/abs-100`+`R rel1/abs+100` 反推），`UIRoot.scalingStyle=1, manualHeight=750`。
- 项目 `GachaStage` 用 1534×750、原点居中 → **中心相对坐标与 prefab 完全等价**（例：skip 在根内 x 1151…1279，中心 1215−667=+548 = 项目 `gachaPos(548,-302)` ✓）。1334/1534 的差异只影响**贴屏边**的元素（用 `hud` 槽处理）与底色/遮罩宽度。
- `UIWidget.Pivot`：0=TopLeft 1=Top 2=TopRight 3=Left 4=Center 5=Right 6=BottomLeft 7=Bottom 8=BottomRight。
- `ExtentionTweenPlay.tweenerList[].type`：**0=Position 1=Rotation 2=Scale 3=Color 4=Alpha 5=Size(mWidth)**；`loopType{type:1,loops:-1}`=无限 Yoyo；`ease=0`=自定义 curve。

---

## 2. 布局真值（与项目当前值的差异）

### 2.1 卡池列表页（已对齐项略）

| 元素 | prefab 真值 | 项目当前 | 处理 |
| --- | --- | --- | --- |
| 页签 | 普通/选中/禁用用 168×84 位图（`gacha_page_chara/_on`、`gacha_page_egg/_on/_disable`）；通用底 `gacha_page`/`_on` 128×84 **L60 R60** | ✅ | 保持 |
| `gacha_page_sp` | **border 全 0（非九宫格）** | `gacha.css` 套了 `0 60 0 60` | **应改 `0`** |
| 单抽/十连按钮 | `com_btn_Y_sp`(单)/`com_btn_N_sp`(十) 292×72，原图 128×72 **L60 R60** | ✅ `0 60 0 60` | 保持 |
| 消耗行底板 | `gacha_btn_tag` 280×40，原图 64×32 **无切片**（X4.375/Y1.25 整体拉伸） | ✅ 逐字拉伸 | 保持 |
| 概率/记录按钮 | `com_btn_mini` 152×40（L24 R24） | ✅ | 保持 |
| 货币条 | `com_top_item` 136/154×28（L20 R20）+ `M_rt_btn_add` 40×40 | ✅ 但结果页引错目录 | 见 §3.3 |
| 保底提示 | `icon_info` 28×28 + 文案 400×20 fs20 `#F8EEDC` | ✅ | 保持 |
| 指定伙伴格 | `at_f_{3,4,5}` 100×100；概率页用 `at_f_{star+2}`、卡池页用 `at_f_{star+3}`（**源码自身不一致**） | 按卡池页 | 保持，勿"统一" |

### 2.2 蛋池演出（`petgachaanipanel`）—— 与项目差异最大

| 元素 | prefab 真值 | 项目当前 | 结论 |
| --- | --- | --- | --- |
| 菱形蛋框 `eggDi` | `gacha_egg_{star+2}` **300×300**（atlas 400×400）depth 5 | 340×340 | 改 300×300 |
| 蛋图 `eggTex` | UITexture **132×138**，depth 7，位于 `outbag`，y≈+20 | 132×138 @(0,0) | 位置按 +20 核对 |
| 出蛋位移 | `TweenPosition` **(0,−360) → (0,+40)**，delay **0.14**、dur **0.36**、OutQuad | CSS `translateY(164)→−274→0`，0.7s | 按真值重写 |
| 容器二次弹跳 `petShowObj` | position (0,280)→(0,20) + scale **1.15→1.4**，各 0.25s | 无 | 补 |
| 星级 | **5 个独立 `gacha_star` 72×72**，UIGrid `arrangement=0`、`cellWidth=40` @(0,−137)；每颗「亮星 α0→1 dur0.3 + scale 2→1 dur0.3」+「闪光星 α1→0 dur0.5」，delay **0.10 / 0.22 / 0.34 / 0.46 / 0.58** | `com_stars_{n}` 连体条 @(0,−100) + 单次 pop；模板里 `starStripW` **未定义**（Vue 警告） | 按真值重写 |
| 名牌 | `gacha_egg_name` 374×100 @**(0,−183)**，α0→1 dur0.5 delay0.1，**宽度 224→374 展开** dur0.5 delay0.1 | @(0,−168)，无展开 | 补 |
| 名字 | UILabel 256×36 **36px `#F8EEDC`** | ✅ 36px `#F8EEDC` | 保持 |
| 新获得 | `gacha_new` 144×92 @**(94,96)**，scale 1.5→1（过冲 1.35）dur0.4 delay0.2 + α dur0.25 delay0.15 | @(88,108) | 补 |
| ShineEft | 星色：3★ 蓝(0.27,0.4,1)、4★ 紫(0.95,0.44,1)、5★ 金(0.88,0.78,0.2)；闪一次 dur1.8 → delay2.4 起 3.2s 无限循环 | 固定蓝色 CSS 光晕 | 补星色 |
| 「触摸继续」 | UISprite **`com_tap` 160×40** @(0,−280)，`TweenAlpha` 0.2↔1 dur1.0 PingPong | 文字「· 触摸继续 ·」 | 换贴图 |
| 跳过 | `gacha_btn_skip` **128×60 @(548,−302)**（UIButton→`OnSkip`，音 `btn_cancel`） | hud 视口锚定 109×51 | 按真值核对 |
| 分享 | `gacha_btn_share` 96×96 @(−560,−302) 存在，但 **`PetGachaAniPanel.cs` 无任何 share 引用**（蛋池无分享逻辑） | 加了分享按钮（复制文本） | 要么移除，要么明确标注为本站新增 |
| 开场背景 | 8 段 tween 全 dur1.0：foreground `scale 1.834→1.005` / `y −100→0`；background `1.834→1.01` / `y 200→0`；第三层 `1.834→1.0` / `y −400→−260`；`BG_main_blured α1→0`；`BG_HL α1→0`（HL 自身 0.5↔0.65 dur0.075 高频闪） | 只有整体 `pet-cam` scale + 桌面 top 位移 | 按 8 段重做；**y 方向需以 Unity y-up 校对（−400→−260 = 上移 140）** |
| 取景 | 源码 `localScale=100`、父 `model` (0,−100)；**无相机操作** | `createSpineScene(..., {fit:'height', pad:1.08})`，但播放器**未实现 `pad`** | 见 §4.2 |

### 2.3 角色池揭晓（`herogachashowpanel`）—— 项目已按源码对齐的部分不再列

需补的段（全部有真值）：

| 组 | 段数 | 关键内容 |
| --- | --- | --- |
| `spineStageTweenPlay` | 28 | 段[0..7] 换人转场：backFrame/`elementAlpha`→(−160,0)、`stage`/`midFrameScale`/`lineblock`/`heroAnimRoot`/`blockAlpha`→(**360**,·)、`lineblock` scale→0.6；段[8..15] `elementAlpha` 四边 α→0 且 y/ x 由 ±460 收到 ±360；段[16..20] `blockAlpha` α 与四方块 2s ∞ 呼吸；段[21..26] `midFrameScale` α→1、`PIC`(立绘) α→1 dur0.5、`shineLT/RB` α→1 后 2s ∞；段[27] **立绘 (128,0)→(−128,0) dur4.0**（缓慢横移）并 `startParticPlay` 流星 ×2 |
| `classStarsTweenPlay` | 8 | `class`（`spGachaClass0XBlack` 576×576，scale1.4）：scale 5 帧曲线 dur2.5 + color 5 段（0.301/0.918 蓝白渐变）dur2.25，末段 α→0；段[7] 1.6s 计时回调 `Step1Finish()` + 2 个粒子 |
| `heroNameTweenPlay` | 22 | 名字 `(0,36)→(−120,36)` dur0.5；`nameBase`/`elementTextBase` scale+α；**星级灯 starDX2..5 逐颗 (−80)→(−40/40/80) delay0.5**；`newIcon` scale 2→1（过冲 1.283）；段[17] 回调 `Step3Finish()` |
| `stars1TweenPlay` | 5 | 5 段空转计时，各触发一颗星的粒子 |
| `gachaTextTweenPlay` | 3 | 台词底板 **256×88 → 960×88** dur0.8 + α |
| `textRing` 旋转 | — | `ring`（`spGachaTxtRing01` **UITexture 866×864**，α0.75）**−360°/8s 无限**（ETP 段[11] 与独立 TweenRotation 双份） |

### 2.4 结果一览（`heroshowpanel`，角色池结束状态）

| 项 | prefab 真值 | 项目当前 |
| --- | --- | --- |
| 卡片单元 `HeroShowItem` | depth 19 `gacha_card_botm{3,4,5}` 256×256 → 24 `gacha_card_frame{rare}` 224×224 → 25 `gacha_card_class{job}` 64×64 + `gacha_card_atr{element}` 64×64 + `gacha_card_new` 60×24 / `gacha_card_reget` 128×68（拉 1.875×）→ 29/30 **`com_stars_{rare}` 126×48 连体星条** → 31/32 `gacha_card_white` 高光条 | 用 `spGachaStar02` 逐颗拼星级；**无职业/属性标**；无碎片层 |
| 入场 | 单抽：`heroSingle` 大卡 `popUpAni`；十连：`grid` 逐格 `popUpAni`（起始 `localScale (0,1,1)` **横向展开**→1），每格 0.15s 播 `card` 音（**index 1/4/7 跳过音效与间隔**），0.7s 后 `CheckHeroExcit()` | 静态网格，无入场 |
| 重复/新角色 | `#2` 碎片：`fragment` 亮 + `fragmentX10`；`#3` 转星币：`fragmentCrystal` + `fragmentX10.text="×N"`；`#1` 新角色：`newIcon` 动画 + 5★ `heroIconShine` PingPong α0→0.2 | 只有「新」角标 |
| 5★ 氛围 | 每格 `grid.transform.parent.child(1).GetChild(n)` 粒子仅 rare==5 开 | 无 |
| 底部/右上 | `onceButton`/`tenButton`（`slotId!="4"` 才显示单抽钮）+ 消耗行 + `topRightObj`（货币条 `itemTip/keTip/payKeTip`，**无 coinTip**）+ `shareButton` | 按钮/消耗/货币条已做；货币槽数按 kind 分支 |
| 关闭 | `Close()` → BGM 回 `gacha_shop`；`slotId=="4"` 才重开卡池页；否则卡池页一直在下面 | ✅ 近似 |

**实测缺陷**：`.result-title`（`gachaPos(0,330)`）与右上货币条（`top: calc(50% - 335px)`，高 28）**同一水平线重叠**，截图可见（`ui-checks/gacha-probe/*/hero-10-result.png`）。

### 2.5 蛋池结算（`GetRewardTip`，**未实现**）

- 结构：`mask` = `white` 1534×750 **α0.502**；主底板 **`item_get` 1534×472**（TipsManager_Atlas，原图 512×472，border 全 0 → 横向非等比拉伸，原设计如此）depth1；标题条 **`item_get_titel` 220×44** depth2；`UIPanel mDepth=1080`（盖在卡池页 d610 之上）。
- 格子：`ItemBagCell` **Large 档** → `item_f_{quality}` 128×128、icon 96×96、数量 Label ≈(50,−50)；**魔物蛋特例**：`category[0]==6` → **不显示数量**；`com_stars_{star+2}` 连体条 @(0,39)、h34、宽 68/84/100（3/4/5 星）；★ 连体条统一按 **0.6 缩放**。
- 逐格出现：`ItemFlashEffect` 品质闪光（按 quality 分级）+ α=1 + **`itemGet` 音** + **0.1s** 间隔；可上下拖动（`UIDragScrollView`），无分页。
- **两段式关闭**：第 1 次点 → 停协程、剩余格子一次性补完（不关）；第 2 次点 → 关闭回到卡池页（消耗与保底此时已刷新）。
- 与角色池的分工：**普通抽卡角色池不弹此面板**（`HeroServerData` 走 `GetRewardData` 纯数据 + `HeroShowPanel`）；`GetHeroRewardTip` 只在「使用道具获得伙伴」且 `roomDataType==camp` 时出现。

---

## 3. 资源盘点与缺口

### 3.1 已齐（可放心使用）

- `HeroPoolPanel_Atlas` 33/33；`Common_Atlas` 168/168（含 `com_stars_1..5`、`com_tap`）；`HeroGachaShowPanel_Atlas` 97/97；`uipanel/herogachashowpanel` 22/22；`ItemBagPanel_Atlas` 31/31；`HeadIconAtals`、`MainPanel`、`InsBattlePanel_Atlas`、`HeroInfoPanel_Atlas`、`TipsManager_Atlas/item_info_color1..5` 所需的单张均在。
- 音频：抽卡 5 支 BGM + 11 支关键音效 **全部与 Unity 源 MD5 一致**（`card2/3/7/8/9/10/11/12`、`get3/get5/getcard`、`shining1`、`gacha_*`）。
- Spine：`elsa_rawcard`（json+atlas+png+tail）、`elsa_rawcard_desk`（2 页）、`perform_bag`（skel+atlas+png）齐全。
- 动画名核对：`elsa_rawcard` = `startopen / startopen_waitclick / startopen_noeffectclick / idle / common_onecard / common_tencard / surprised_onecard / surprised_tencard / end`；`elsa_rawcard_desk` = `idle / common / surprised / end`；`perform_bag` = `idle_front / open / open_blue / open_purple / open_gold / open_idle / open_jump / open_yb`（皮肤 **`def`**）。项目用到的名字全部存在 ✓。

### 3.2 硬缺口

| 项 | 说明 |
| --- | --- |
| **TipsManager_Atlas 仅 5/97** | 结算面板依赖 `item_get`、`item_get_titel`（+ `item_info*`、`item_q1..6`、`com_sys_window*`、`com_select_botm`、`M_tips_botm*` 等 60+ 张） |
| `UI_itembag_frame_shine.png`(76×76) | `ItemFlashEffect`（结算格闪光 / 结果页闪光） |
| `chara_detail_botm.png`(512×512)、`gacha_info.png`(964×352) | 卡池页依赖；项目误把 236×32 的 `gacha_info_tip` 当替代 |
| `elsa_desk_foreground.png` 尺寸不符 | 项目 1680×**1000**，Unity 真值 1680×**456** |
| 立绘 `chara001_0` | 项目 `images/chara/l/` 为 711×935（Unity 712×936）；`heroPicShadow` 无独立贴图（原 prefab `mTexture PathID=0`，运行时赋值） |
| `com_up` | Unity 在 `HeroPoolPanel_Atlas`，项目只在 `Common_Atlas`（图形相同，引用需一致即可） |
| 音频（低优先） | `card / card4 / card5 / card6 / card13 / get / get1 / get2 / get4 / get6 / get7 / itemGet / shining / shining2 / shining3 / bagclose / btn_normal / btn_cancel` 未落盘；`asset-manifest.json` 漏登 `card11/get3/getcard/shining1` |

### 3.3 Spine 与依赖断链

- `spine/model/npc/` Unity 89 个骨架 → 项目 **38 个（缺 51）**，含 `Npc_001/001_boy/003/004/006/010/013/013_2/015_1/018/022/024/028/030/032/038/npc_039/040/042/044/048/049_1/050_1/052/054/056/057/059/060/061/063/067/068/069/070/071/911-914/921-924/cart/cart02/obj/shop_demon/shop_rabbit/obj_006` 等；其中若干骨架**没有 `win`/`win_idle`**（`GachaRevealPanel` 硬编码播 `win`→`win_idle`，命中即黑屏/报错），且 `Npc_002_2` 也缺。
- 脏目录：`public/images/gacha/spine/heroes/Npc_001Girl/`（空目录）。
- **断链 2 条**（实测 404）：
  - `GachaResultPanel.vue` → `/images/Common_Atlas/M_rt_btn_add.png`（应为 `/images/MainPanel/M_rt_btn_add.png`）
  - `GachaRevealPanel.vue` → `/images/HeroGachaShowPanel_Atlas/gacha_reget.png`（应为 `gacha_card_reget.png`；`gacha_reget` 是卡池页 167×212 的另一资源）
- 冗余：`images/gacha|HeroGachaShowPanel_Atlas|uipanel/_common` 共约 59 个「` #数字`」重复导出（**注意与无 `#` 版本并非同文件**）；`spGachaTag*03 - 副本.png` 4 个；`images/HeroGachaShowPanel/` 与 `HeroGachaShowPanel_Atlas/` 整目录重复。

---

## 4. 现存问题（用户指认三项的根因）

### 4.1 角色（揭晓 Q 版小人）"没完成"

- **小人本身能渲染**：用与面板相同参数独立渲染 `Npc_012-normal-win`、`Npc_011-default-win` 均正常（截图 `ui-checks/gacha-probe/chibi-standalone-*`）；在揭晓页里把立绘临时隐藏后，小人正确站在 `spGachaDitai01` 台座上（`chibi-hidden-*`）。
- **真正的现象**：`.reveal-portrait`（立绘，DOM 在小人之后、同属 `.g-layer-art`）**完全盖住小人** → 视觉上"小人没做/没出来"。游戏里小人 `heroAnimRoot` depth **75**、scale **0.95**、layer 15，立绘是 `heroPic/PIC`（712×936）+ 位移 tween，两者不重叠在同一区域。
- 次要：小人画布背衬在 `GachaStage` 量到缩放**之前**就写死（实测 460×460，而显示 500×500）→ 画面偏软；应在下一帧或 ResizeObserver 里按变换后尺寸设置。
- 缺失段：§2.3 的 `spineStage`/`classStars`/`heroName`/`stars1`/`gachaText` + 粒子 + `star4/5Gradient` + `elementColors`（水 `#007ACC`/火 `#AD290D`/风 `#80941A`/地 `#8C6600`）。
- 翻卡段（`GachaCardPanel`）：动画名映射正确，但缺 Timeline 信号语义（**6.35s 跳段**、**7.334s 直接出卡**、1.0s `clickSignal`、2.667s `resetClick`）、缺 `card3/card8(rare)/card7` 时序与 `shining1`（tail_tip 5s 后每 3s）、缺 URP 后处理（色差/畸变/暗角/曝光）、`startopen_waitclick` 被 `idle` 替代（有视频依据，保留）；**卡面本体是否出现需人工对照**（本地分段截图只见艾尔莎与卷轴+光效）。

### 4.2 魔物（蛋池）抽卡动画问题

1. **`pad: 1.08` 未实现**：`gachaSpinePlayer.js` 只处理 `fit:'bounds'|'width'|'height'`，蛋袋取景按骨架数据头包围盒，实测袋身明显过大并溢出画布（截图 `pet-01-bag-idle`、`pet7-*`）。
2. 星条：应为 **5 颗 `gacha_star` 72×72（cellWidth 40）逐颗 0.12s 弹出**，项目用 `com_stars_*` 连体条 + 单次 pop，且 `starStripW` 未定义。
3. 出蛋轨迹/容器弹跳/蛋框尺寸/名牌展开/新获得坐标/星色/触摸提示 与真值不符（见 §2.2 表）。
4. 背景只做了整体缩放，缺 3 层卡背 + HL/blured 的 8 段 tween 与粒子层（`par_sys_dust 1/2/3`、`spr_tyndall_light_top/side`、`spr_backlight` α0.1↔0.15）。
5. 蛋图取景/位置：`eggTex` 132×138 在 `outbag`，`MakePixelPerfect` 后按原像素显示；项目用 `object-fit` 固定 132×138（可保留，但 y 与容器关系需按 §2.2 校对）。

### 4.3 两池"抽卡结束状态"

- **蛋池 = 语义错误**：游戏是 `GetRewardTip` 结算弹层（道具格 + 连体星条 + 逐格 0.1s + `itemGet` + 两段式关闭），项目**两池共用**角色池风格结果面板（`GachaResultPanel`），而 `GachaPetResult.vue` 是 **0 字节空文件且未被引用**。这就是"抽完样式不是魔物池自己的"。
- **角色池 = 近似实现 + 布局 bug**：标题与货币条重叠（§2.4 实测）；缺逐张入场、`com_stars` 星条、职业/属性标、重复（碎片/星币）表现、5★ 粒子。
- 共同：结果页的货币条锚点 `right: calc(50% - 526px)` 与 prefab 一致 ✓；`slotId=="4"`（引导池）分支未实现（项目无账号概念，可显式标注为本站不实现）。

---

## 5. 建议施工顺序

**P0（可见度高、改动小）**
1. 修两条 404 断链（`M_rt_btn_add`、`gacha_card_reget`）。
2. `gacha.css` 的 `gacha_page_sp` 切片改 `0`。
3. 揭晓：把 `.reveal-portrait` 与 Q 版小人的层级/位置按游戏口径分开（小人 depth 高于立绘，或立绘按 `ImgPos` 侧移），并修小人画布分辨率时机；`starStripW` 补上定义。
4. 结果页标题与货币条错行（各自让出 40px）。

**P1（对齐演出）**
5. 蛋池：实现 `pad` 取景；按 §2.2 重写星条/出蛋轨迹/容器弹跳/蛋框/名牌展开/新获得/星色/触摸手势/背景 8 段。
6. 揭晓：补 `heroName`(22 段) 与 `classStars`(8 段) 的数值、`spineStage` 的立绘位移与换人转场、`gachaText` 底板 256→960。
7. 角色池结束页：星条换 `com_stars_{rare}`、补 `gacha_card_class/atr`、加逐张 `popUpAni`（(0,1,1)→1 + 0.15s `card` 音，跳过 1/4/7）。

**P2（资源与结算）**
8. 补 `TipsManager_Atlas` 的 `item_get`/`item_get_titel` 等结算所需精灵，实现 `GachaPetResult.vue`（Large 格 + 连体星条 + 不显示数量 + 0.1s 逐格 + `itemGet` + 两段式关闭），并在 `GachaView` 按 `kind` 分流。
9. 补 51 个 Npc 骨架（至少补齐卡池候选对应的角色与 `win/win_idle`），并给缺失骨架做 `idle_front` 回落。
10. 清理「` #数字`」重复与 `- 副本`、空目录 `Npc_001Girl`；把 `asset-manifest.json` 漏登的 4 条音频补上。

---

## 7. 修复状态（2026-09-13 施工记录）

### 已修

| 项 | 处理 |
| --- | --- |
| 音效开关只能拦新播放、切面板重启音乐 | 新增 `src/utils/gachaAudio.js`（模块级 BGM 单例）：**同名曲不重启**（保留播放进度）、开关真正暂停/续播当前 BGM、离开 `/gacha` 才停；面板不再各自 `new Audio`。实测：开关切换后新增音频请求 0；整段流程 `gacha_shop.wav` 仅 1 次请求 |
| BGM 缺失/断续 | 卡池页播 `gacha_shop`、翻卡 `gacha_ready_chara`→`gacha_show_chara`、揭晓 `gacha_show_chara`、结果/结算回 `gacha_shop`（按源码），面板卸载不停 BGM |
| `starStripW` 未定义 | 蛋池星条改用 5 颗独立 `gacha_star`，该绑定消失 |
| 两条 404 | `M_rt_btn_add` → `/images/MainPanel/`；揭晓里的重复角标按源码移除（游戏只有 `newIcon`），`gacha_card_reget` 改在结果页使用 |
| `gacha_page_sp` 切片 | 去掉错误的 `0 60 0 60`，改用整体拉伸（原图 border 全 0） |
| 揭晓 Q 版小人"没出来" | 立绘与小人按 prefab `mDepth` 分层（立绘 40 < 名牌 59 < midFrame 60 < 台座 61 < 图标 65/66 < **小人 75**），小人画布 380×380、`scale 0.95`、位置 (0,-114)，并等一帧再设画布分辨率 |
| 结果页标题压货币条 | 移除本站自加的标题（prefab 无该文本），并按 `HeroShowItem` 重排卡片 |
| 蛋池演出与真值不符 | 菱形框 300×300、星级改 5×`gacha_star`(72, cellWidth 40)@(0,-137) 逐颗 0.12s、名牌 374×100@(0,-183) 且宽度 224→374、新获得 (94,96)、蛋图轨迹 `(0,-360)→(0,+40)` delay0.14/dur0.36 + 容器 `(0,280)→(0,20)` 与 `scale 1.15→1.4`、星色按 3/4/5★ 蓝/紫/金、触摸提示改 `com_tap` 贴图、分享/跳过按 prefab 坐标 (∓560/548, −302)、桌面自下方上升 100 归位 |
| **蛋袋取景铺满整屏（对照游戏截图第二轮修正）** | 数据头包围盒对 `perform_bag` 不可靠（内容远大于头部尺寸）→ 改按**运行时包围盒**取景 `{ fit:'bounds', initialAnimation:'idle_front', padding: 1.3 }`，袋身约占画布高 78%、居中偏上、四周留出书桌/货架与桌面辉光，与游戏画面一致；`gachaSpinePlayer` 的 `pad` 语义修正为**乘数（>1 = 视野更大 = 内容更小）**，并按备份实现口径提供 `padding` |
| **结算弹层盖在黑底上（对照游戏截图第二轮修正）** | 结算面板改用 `<GachaStage clear>`，且卡池页在 `result` 阶段**保持可见**（`v-show="stage === 'pool' \\|\\| stage === 'result'"`）→ 与游戏一致：结算/结果都是盖在仍开着的卡池页之上、由 α0.502 的 mask 压暗。格子改**一行 8 格**、星条在框内顶部、非蛋产物右下显示数量（`category[0]==6` 的蛋不显示），逐格 0.3s 弹出带品质辉光 |
| 播放器 `pad` 未实现 | `gachaSpinePlayer` 支持 `pad`/`padding` 取景参数（见上） |
| **蛋池白光（第三轮）** | `gacha_cardforeground_output_outline` 实为 512×388 软边轮廓（配描边材质），按 1680×1000 拉伸成 3.6 倍后变成整片白光 → 已移除该层 |
| **第 2 只起「只有菱形没有蛋」（第三轮）** | `nextPet()` 的「320ms 隐藏旧蛋」计时器在 `startEgg()`（200ms 挂载新蛋）之后执行，把新蛋一起卸载 → 旧蛋改用独立节点 `leavingItem` 飞走，当前蛋在 `startEgg` 时挂载。实测十连 10/10 蛋图均加载 |
| **星级数量错误（第三轮）** | `starSlots` 生成 5 个布尔槽位而模板未按值过滤 → 3★/4★ 也画 5 颗星；改为按数量生成并按亮起数量整组居中（3★ -40/0/40、4★ -60/-20/20/60、5★ -80…80） |
| **角色翻卡开场硬边「阴影」（第三轮）** | `.card-dark` 用 `gachaPos()` 的 left/top=50% 与 CSS `inset:0` 叠加后只剩右下四分之一（实测 916×408）→ 改整屏 `inset:0`；并取消对 Spine 舞台的 CSS 放大（骨架自带背景/桌面贴图，放大会露硬边），开场推近只作用于背景整幅贴图（1.35→1.0 / 2.4s） |
| 蛋池结束状态语义错误 | 新增 `GachaPetResult.vue`（`GetRewardTip` 还原：`item_get` 1534×472 底板 + `item_get_titel` + `ItemBagCell` Large 128×128/96×96 + 连体星条 68/84/100 @(0,39) + **蛋不显示数量** + 0.1s 逐格 + `itemGet` 音 + 两段式点击），`GachaView` 按 `kind` 分流 |
| 缺资源 | 从 `UI_Atlases/TipsManager_Atlas/sprites` 导入 22 张结算所需精灵；补入 `card.wav`、`itemGet.wav` 并把 `scripts/dev/import-gacha-assets.mjs` 的音效清单补到 14 支（重跑后 manifest 296 条 / 音频 19 条；代码引用的 11 支音效全部存在） |
| 揭晓演出缺段 | 补：`heroName` 名字左滑 (0,36)→(-120,34)、星级灯 5 颗自 -80 滑到 -80/-40/0/40/80、`classStars` 职业底图（`spGachaClass0XBlack` 576×576 scale1.4 + 色变 + 2.5s 淡出）、`elementAlpha` 风纹回到真值 ±460（step3 内收 ±360 并淡出）、`cornerAlpha` 角饰 ±479、`gachaText` 底板 256→960 展开、`ring` 进场 1.54→1、立绘 (128,0)→(-128,0) 4s 横移；名牌 `nameBase` 按 pivot=BottomRight@(0,-14) 定位 |
| 结果卡片按真值 | `com_stars_{rare}` 连体星条（96/120/144×48）、`gacha_card_class{job}`/`gacha_card_atr{element}` 64×64、重复转化戳 `gacha_card_reget` 240×68 + 数量、`popUpAni` 横向展开 (0,1,1)→1 与 0.15s `card` 音（index 1/4/7 跳过）、5★ 氛围光 |
| 回归套件 | `tests/ui/gacha.spec.js` 里蛋池主视觉断言是**非重试断言**（切池后 `naturalWidth` 在解码前为 0，本地约 200ms 才就绪），已改为先 `waitForFunction` 等图就绪再断言；`.pet-catcher` 在整段演出期间保持挂载（动画中点击由 phase 忽略），修掉"点空/超时" |

**验证**：`vite build` 通过；`npx playwright test tests/ui/gacha.spec.js` **桌面+移动 15 过 3 跳（与历史基线一致）**；`node scripts/dev/audit-text-encoding.mjs` 1908 文件通过；gacha 相关 `/images/**` 引用 0 缺失。

### 未修 / 已知限制

| 项 | 说明 |
| --- | --- |
| `Npc_007`（拉碧丝）骨架渲染错乱 | `.skel`/`.atlas`/`.png` 与资源包**逐字节一致**且为 Spine 4.0.09，但 spine-webgl 4.0.31 解析后附件尺寸/位置错乱（`win`/`idle_front`/换皮肤都一样）；对照 `Npc_005/011/012/015/033/050` 正常。已加 `BROKEN_CHIBI_SKELETONS` 名单，该角色改用游戏卡面 `gacha_at*.png` 静态代替。需另找可解析的骨架来源或升级播放器后移除名单 |
| 卡面本体 | 分段截图未见明显"卡牌翻面"画面（翻卡段是艾尔莎与卷轴+光效），是否缺卡面需与实机画面对照 |
| 粒子/后处理 | 83 个粒子系统、URP 色差/畸变/暗角/曝光仍用 CSS 近似；未接角色抽卡语音（配置本身是占位） |
| 其它资源 | `UI_itembag_frame_shine.png`、`chara_detail_botm.png`、`gacha_info.png`、51 个 Npc 骨架、剩余音效（`card4/5/6/13`、`get/get1/2/4/6/7`、`shining/2/3`、`bagclose`、`btn_normal/btn_cancel`）仍缺——当前演出未依赖，来源路径见 §3.2 |


## 6. 验证方式（本次实际执行）

- 本地 Vite（已运行的 5173）+ Playwright 探针脚本：分段截图 + DOM 设计坐标取数 + 元素级裁剪截图；产物在 `ui-checks/gacha-probe/`。
- 独立渲染验证：用与揭晓面板相同参数单独渲染 Npc 骨架（截图 `chibi-standalone-*`）；隐藏立绘后再截小人（`chibi-hidden-*`）。
- 静态引用核对：对 `src/components/gacha`、`GachaView.vue`、`gacha*.js`、`gacha.css` 的 79 条 `/images/...` 引用逐个测存在性 → 2 条 404。
- 临时探针脚本与临时页面已删除，未改动项目源码。
