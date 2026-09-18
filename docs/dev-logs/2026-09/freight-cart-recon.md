# 贸易小车（FreightPanel / 货运）资源与数据勘察报告

勘察时间：2026-09-19
用途：为「按伙伴邮件的方式复刻」做前置盘点

## 一、这是什么

游戏内的 **`FreightPanel`（货运面板）** —— 玩家用小车运货做买卖的玩法，入口是营地的
`carriage`（货车/马车）建筑。UI 是**左右双页签**：

| 页签 | 子 UI | 内容 |
| --- | --- | --- |
| 0 订单 | `FreightOrderUI` | 委托订单列表（NPC 委托要什么货、给多少报酬），发车后进入运输中/已返回状态 |
| 1 市场 | `FreightMarketUI` | 买卖货物：按市场价买入、卖出，价格随时间波动 |

面板顶部显示 `carriage` 建筑等级（`GetSysCampLevel("carriage")`），可点开升级提示。

## 二、数据表（完整，可直接解析）

### `Config_decrypted/newOrder.json` —— 订单配置

标量配置：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `orderNumMax` | 9 | 最大可存储订单数 |
| `orderTimeSeconds` | 1800 | 订单刷新时间（30 分钟） |
| `orderDailyTarget` | — | 每日完成订单奖励（按订单数量，只有一档） |
| `priceTip` | — | 价格公式说明：`300 + 道具成本 × 倍率`，倍率 2 / 2.5 / 3 |

`goods`：**40 条**订单，key 形如 `buildingMaterial`、`c1_1` … `c1_19`（按地区分组）。
每条结构：

```json
{
  "orderTypeId": "buildingMaterial",
  "chance": 1,
  "items": [{ "num": 3, "typeId": "item_10079" }, { "num": 5, "typeId": "item_10080" }],
  "name": "货仓修补",
  "baseValue": 300,
  "orderValue": 2,
  "taskTypeId": "",
  "charaText": "破损的货仓一定要即时修补！",
  "charaImg": "cart_at_npc_006",
  "tip": "lv1，比绍，木板+石砖"
}
```

> `charaImg` 指向 `cart_at_npc_*` 立绘，即**委托人的角色图**。

### `Config_decrypted/market.json` —— 市场配置

标量配置：

| 字段 | 值 | 含义 |
| --- | --- | --- |
| `priceInterval` | 1800 | 价格刷新间隔（30 分钟） |
| `priceMin` / `priceMax` | 0.6 / 1.4 | 价格浮动区间（相对 basePrice） |
| `priceRandomArea` | 0.45 | 随机浮动范围 |
| `priceRandomMaxChange` | 0.1 | 单次最大变动 |
| `priceOverScale` | 0.5 | 超重惩罚系数 |
| `desc` / `weightDesc` | — | 商品右侧问号、载重右侧问号的说明文案 |

`goods`：**51 条**商品（key = `item_10001` 等）：

```json
{
  "itemTypeId": "item_10001",
  "basePrice": 9,
  "maxNum": 100,
  "addNum": 5,          // 每轮补货数量
  "addTime": 1800,      // 补货间隔
  "buyIn": true,        // 允许买入
  "sellOut": true,      // 允许卖出
  "taskTypeId": "",
  "tip": "c1木柴"
}
```

## 三、UI 布局（已导出完整坐标）

来源：`game.taptap.tqpmyrzg/assets/Android/AssetBundle/prefab/uiprefab/freightpanel/freightpanel.asset`
（UnityFS 包，用 **UnityPy 1.25.3** 解析，系统 python 已装）

导出脚本：`vue-myrzg/scripts/dev/scratch/codec/dump-freight-full.py`
导出结果：`vue-myrzg/scripts/dev/scratch/codec/freight-prefab.txt`（257 行，275 节点）

**坐标系**：NGUI 原始 Transform，画布中心为原点，Y 向上。

**画布尺寸推算**：
- 坐标极值 X `-668 ~ 667`、Y `-428 ~ 375.5`
- 右上角锚点 `RightTop @(667, 375)` 与 X 最大值吻合
- → 设计画布约 **1334 × 804**（比 gacha 的 1534×750 窄而高）

### 关键节点（节选）

```
FreightPanel @(0,0)
  MarketUI @(0,0)
    RightUI @(0,0)
      cartUI @(0,0)
        Doing @(335,0)          ← 运输中状态
          timeLabel @(9,-94)         Label("180:00" fs=22 102x22)
          cartOut @(-3,198)          UISprite(cart_out_txt 256x84)
            label @(0,-42)             Label("正在运输交易的货物" fs=20 220x100)
          slider @(0,-221)           UISprite(cart_bar_blue 400x12)
          sliderMask @(0,-221)       UISprite(cart_bar_mask 600x38)
          sliderTag @(200,-165)      UISprite(cart_bar_tag_ing 80x92)
          sliderBotm @(0,-242)       UISprite(cart_bar_botm 600x120)
          downLabel @(0,-306)        Label("…运输中…" fs=18 250x18)
        WaitDo @(335,0)          ← 待发车状态
          stateLabel @(-2,-147)      Label("运回时间 100分钟60秒 [严重超重]" fs=18 300x18)
          YesBtn @(0,-305)           UIButton + UISprite(com_btn_Y 252x68)
            Label @(0,-1)              Label("发车" fs=22 100x40)
          stateLabel1 @(-1,-250)     Label("运出载重：54/60" fs=20 300x20)
          noneLabel @(0,-306)        Label("请选择要交易的商品" fs=20 250x20)
          cartIdle @(-3,198)         UISprite(cart_idle_txt 256x84)
            label @(0,-42)             Label("选择要买入或卖出的货物" fs=20 220x100)
          helpBtn @(153,-147)        UIButton + UISprite(icon_help 28x28)
        Done @(335,0)            ← 已返回待结算
          bg @(0,-245)               UISprite(cart_back 512x200)
          Label @(0,-235)            Label("货车已返回,确认以完成结算" fs=20 400x20)
          YesBtn @(0,-305)           UISprite(com_btn_Y 252x68) + UIButton
            Label @(0,-1)              Label("确认" fs=22 100x40)
          Finish @(-2,200)           UISprite(cart_ok_txt 176x44)
            right @(108,0) / left @(-107,0)   UISprite(cart_ok 40x44)
        cartGo @(334,15)         ← 小车本体（分层 UITexture）
          hood @(0,78)   UITexture(492x404 d=20)
          back @(1,-63)  UITexture(556x432 d=1)
          front @(9,-92) UITexture(540x268 d=9)
          box @(11,-37)  UITexture(176x192 d=8)
          wheel1/wheel2  w0..w3 各 UITexture(272x212)
          1..5           货箱分层 UITexture
      RightTop @(667,375)        ← 右上角货币条（同 gacha 的 RightTop 约定）
        PlayerInfoShow @(-254,-40)
          bg @(-23,0)   UISprite(com_top_item 136x28)
          icon @(0,0)   UISprite(item_00001 36x36)
          Label @(61,0) Label("999/999" fs=20 90x24)
          add @(119,0)  UISprite(M_rt_btn_add 40x40) + UIButton
      LeftUI @(0,0)
        Scroll View @(-272,11)   UIScrollView
          grid @(-108,170)       Grid(cell=236x80)
            ItemTemp @(0,0)      ← 货物条目（市场/订单列表项）
              cntLabel @(-29,16)      Label("库存 2" fs=20 140x20)
              priceLabel @(4,-16)     Label("999999" fs=20 100x20)
              priceIcon @(-17,-16)    UISprite(item_00001 36x36)
              priceBg @(36,-16)       UISprite(cart_price_max 148x28)
              selectCntBg @(-75,16)   UISprite(cart_num_select 88x32)
              itemTemp @(-76.8,0)
                frame @(0,0)            UISprite(item_f_1 76x76)
                select @(0,0)           UISprite(item_f_select 140x140)
                cnt @(55,-57)           Label("999" fs=18 34x18)
                topTag @(-60,60)        UISprite(icon_lock 20x24)
                select1 @(72,72)        UISprite(chara_lvup_less 36x36)
                framePJ @(0,-21.5)      Grid(cell=24x46)  星级
```

完整清单见 `freight-prefab.txt`。

## 四、UI 设计规格

- **字体字号**（从 `UILabel` 的 `mFontSize` 取）：面板标题/按钮 22、正文与数值 20、
  次要说明 18、小号 16
- **配色**：沿用 NGUI `Const.ColorString`（项目已有该约定，见 gacha 复刻）
- **背景**：`cart_bg.png` 1680×1000（比画布大，属溢出底图）
- **页签**：`cart_page` / `cart_page_on`
- **进度条**：`cart_bar_*` 系列（blue/green/orange/red 四色 = 状态配色）+ `cart_bar_mask`
- **状态角标**：`cart_bar_tag_ing`（运输中）/ `cart_bar_tag_ok`（可发车）/ `cart_bar_tag_overload`（超重）
- **价格提示**：`cart_price_min` / `_low` / `_ori` / `_high` / `_max` 五档 + `cart_order_price`
- **列表项**：`cart_num` / `cart_num_on` / `cart_num_select` / `cart_num_disable`

## 五、图片资源（齐全，无缺失）

### 专用图集：`UI_Atlases/FreightPanel_Atlas/sprites/` —— 35 张，已切好

```
cart_back  cart_bar_blue  cart_bar_botm  cart_bar_green  cart_bar_mask
cart_bar_orange  cart_bar_red  cart_bar_tag_ing  cart_bar_tag_ok  cart_bar_tag_overload
cart_del  cart_del_press  cart_idle_txt  cart_num  cart_num_disable  cart_num_on
cart_num_select  cart_ok  cart_ok_txt  cart_order_price  cart_order_say  cart_out_txt
cart_page  cart_page_on  cart_price_high  cart_price_low  cart_price_max  cart_price_min
cart_price_ori  cart_select_botm  cart_speed_icon  cart_time  cart_tips_botm
cart_tips_pricetag  cart_title
```

原始图集：`4.24路资源包/assets/res/atlas/uiatlas/freightpanel/FreightPanel_Atlas.png`（969×1023）

### 预制体目录内的大图：`4.24路资源包/assets/res/prefab/uiprefab/freightpanel/`

```
cart_bg.png 1680x1000              ← 面板底图
cart_market_botm.png 512x512       ← 市场页底
cart_order_botm.png 376x280        ← 订单页底
cart_order_empty.png 376x280       ← 订单空态
cyyd_cart001_{1..5,back,front,hood,treasure_box,w0..w3}.png  ← 小车分层部件
cyyd_huoyunzhan001_shine.png       ← 货运站高光
cart_at_npc_003.png                ← 委托人立绘（示例）
```

### 委托人立绘：`4.24包/Sprite/cart_at_npc_*.png` —— **70 张**

覆盖全部委托 NPC（含 `cart_at_npc_003/004/…/056` 与具名角色
`Aradiel`、`Arnbjorg`、`Benno`、`Chiira`、`Yngvild` 等）。

### 小车 Spine 模型：`4.24包/MonoBehaviour/`

```
Npc_cart_Atlas.json + Npc_cart_SkeletonData.json
Npc_cart02_Atlas.json + Npc_cart02_SkeletonData.json
```

### 音频

```
4.24路资源包/assets/res/audio/effect/ui/carriage1.wav
4.24路资源包/assets/res/audio/effect/ui/carriage2.wav
```

### 对话

```
game.taptap.tqpmyrzg/assets/GAoNano/daily_carriage_1.asset
```

### 覆盖度核验结论

预制体共引用 **59 个 UISprite**：

- **35 个**货运专用 → `FreightPanel_Atlas` 全有
- **7 个**曾判定缺失 → **实际全部可得**（`gacha_btn_tag`、`at002_1`、`map_info`、
  `colect_star` 已在项目 `public/images`；`make_tag_speed`、`map_reward_box_ok`、
  `yc_lvup_shine` 在 `UI_Atlases` 其他图集里待切）
- **27 个**通用 sprite → **27/27 已在项目 `public/images`**

**结论：图片资源 100% 齐全，无需再从游戏提取。**

## 六、源码参考（复刻逻辑依据）

`源码/源码/Assembly-CSharp/` 下 11 个 `Freight*` 类：

| 文件 | 作用 |
| --- | --- |
| `FreightPanel.cs` | 主面板（双页签切换、等级标签、红点） |
| `FreightOrderUI.cs` | 订单页（列表、发车、奖励领取、状态切换） |
| `FreightMarketUI.cs` | 市场页（1019 行，买卖切换、价格波动、补货、载重） |
| `FreightData.cs` / `FreightInfo.cs` | 数据模型 |
| `FreightMarketData.cs` | 市场数据 |
| `FreightMarketItemTemp.cs` / `FreightMarketNumData.cs` / `FreightMarketPriceGoodData.cs` | 列表项 |
| `FreightOrderItemTemp.cs` | 订单列表项 |
| `FreightServerData.cs` / `FreightMsg.cs` | 服务器交互协议 |

## 七、与「伙伴邮件」复刻模式的对应关系

伙伴邮件的复刻结构（`PartnerMailsView` + `PartnerMailReader` + `partnerMailData.js`）
可直接套用：

| 伙伴邮件 | 贸易小车对应 |
| --- | --- |
| `heroMail.json` | `newOrder.json`（订单）+ `market.json`（市场） |
| 邮件列表 | 订单列表 / 市场商品列表（`grid cell=236x80`） |
| `PartnerMailReader` 详情面板 | 右侧 `cartUI` 三态（Doing / WaitDo / Done） |
| `mail_at` 等皮肤 sprite | `cart_page`、`cart_bar_*`、`cart_price_*` |
| `heromailimg/*` 插图 | `cart_at_npc_*` 委托人立绘（70 张） |
| `getPartnerMailPresentation()` | 需新写：订单/商品 → 展示态映射 |

## 八、复刻前还需确认的点

1. **画布尺寸**：推得 1334×804，建议按 gacha 的方式（`gachaPos` 同款 helper）建
   `freightLayout.js`，写 prefab 原始坐标 + 等比 contain 缩放
2. **小车本体**：prefab 里是 12 层 UITexture 拼装（hood/back/front/box/5 个货箱/2 组轮子），
   另有 Spine 模型 `Npc_cart`。**用分层图还是 Spine 需定**（Spine 需先导出静态图，
   可复用 `export-skin-models.mjs`）
3. **三个 `UI_Atlases` 待切图**：`make_tag_speed`、`map_reward_box_ok`、`yc_lvup_shine`
4. **市场价格的运行时波动**：`FreightMarketUI.cs` 是服务器驱动的，网页复刻需决定
   是「按公式本地模拟」（像 gacha 那样标注为模拟）还是只展示静态 basePrice
5. **数据是否需要进 `scripts/parse/`**：若要做成页面，需新增解析器把
   `newOrder.json` / `market.json` 转成 `public/data/parsed/freight.json`
