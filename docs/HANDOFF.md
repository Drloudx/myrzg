# 项目交接说明文档 (HANDOFF)

> 更新时间：2026-10-03（最近一次：修复「讨论区发表时闪一下」；下面〇节是最新状态，建议先读）
> 项目路径：`E:\Desktop\html\myrzg\vue-myrzg`（Vue 3 + Vite 8 + Pinia + Capacitor Android）
> 适用对象：后续接手开发对话/工程师

---

## 〇、最新状态（2026-10-02）：评论与讨论系统

> 这一节是给接手者的**入口**，覆盖本日新增的后端与讨论区。
> 完整设计见 [评论后端方案](technical/COMMENTS_BACKEND.md)，
> 当日过程/踩坑见 [开发日志 2026-10-02](dev-logs/2026-10/2026-10-02.md)。

### 0.1 一句话状态

**已上线**（2026-10-03 首次推送 `main`，Pages 自动部署成功；线上接口全部实测通过，见 0.8）。
功能完整、本地与线上验证均通过，闪烁问题已解决（见 0.5）。
**下一步是仓库/域名改名与账号体系**，两者都已写成落地文档：
[改名落地文档](rename-myrzg-to-syzg.md)、[账号体系落地方案](technical/ACCOUNT_SYSTEM.md)。

### 0.2 这块是什么：全站唯一需要后端的部分

整站其余部分都是**纯静态**（游戏文件在构建期生成 JSON，用户只读）。
只有评论/讨论需要"一个用户写、所有人读"，所以必须有存储与服务端：

| 组件 | 位置 |
| --- | --- |
| 存储 | Cloudflare **D1**（SQLite），库名 `myrzg-comments`，id `5f0d4c37-107f-4811-bc5e-768f73c51a3a` |
| 服务端 | Cloudflare **Pages Functions**，单文件 `functions/api/[[path]].js` |
| 前端 | `src/components/CommentsPanel.vue`（列表）+ `CommentComposer.vue`（发表区） |
| 客户端 | `src/utils/commentApi.js`（接口 + `page_key` 前缀表）、`identity.js`（本机身份/头像）、`commentEvents.js`（跨组件广播） |
| 管理端 | `/#/admin`（评论管理；本地令牌 `yxzm`，线上换随机串） |

费用为 0：Functions 10 万次/天、D1 读 500 万行/天、写 10 万行/天，当前用量远低于此；
**静态图鉴不限量不计费**，只有评论那点 JSON 走 API。

### 0.3 讨论区怎么用

- **顶栏聊天图标** → `/#/discussions`：站内讨论区（归属键 `site:general`），
  与各图鉴页面的讨论 `item:xxx` / `hero:xxx` …**完全分开**，不聚合。
- **各图鉴详情里的「讨论」**：物品 / 角色 / 魔物 / 家具 / 副本 / 关卡 / 怪物 / 任务 / 事件，共 9 处。
  符石与菜谱**刻意不单独挂**（它们点卡片走全局物品详情，那里已有讨论区）。
- **右栏「最新讨论」**：只显示站内讨论区的最新 5 条，只读、不放输入框。
- **别人发的消息会自动出现**（2026-10-03 起）：中间区域与右栏都是 **20 秒前台轮询**，
  不必重开页面。中间区域此前**完全没有自动刷新**（`pageKey` 恒定不变、本机广播不跨设备），
  表现就是"右栏有了、中间没有"。轮询只挂讨论区；**物品详情等页面的评论面板不轮询**——
  那会把"每次打开详情一次请求"放大成"停留期间每 20 秒一次"。详见
  [评论后端方案](technical/COMMENTS_BACKEND.md#讨论区中间的自动刷新2026-10-03-补)。

### 0.4 三个必须知道的开发约定（不然一定踩）

1. **改了 `functions/` 必须重启 API**：`npm run dev:api` 起的 wrangler **不热加载**。
   本日在此踩了两次（改 `MAX_BODY`、加 `site:` 白名单后没生效，误以为代码错）。
2. **新增页面挂讨论区要改两处**：`src/utils/commentApi.js` 的 `COMMENT_PAGE_PREFIX`
   **和** `functions/api/[[path]].js` 的 `PAGE_KEY_RE`；并记得把页面人话名字用 `pageLabel` 传上去
   （否则管理端只显示 `item:item_00001` 这种内部标识）。
3. **本站是 hash 路由**：站内切页**不重载应用**。所以"只在启动时拉一次"的写法
   （右栏最初就是这样）会导致用户发完评论后数据一直是旧的。改数据要显式触发刷新。

### 0.5 ✅ 已解决：发表时的闪烁（2026-10-03）
用户反馈"中间区域发消息的时候闪一下"。**已定位并修复**，成因与交接时假设的**不一样**：

| 交接时列的成因 | 复核结论 |
| --- | --- |
| 发表后重拉整页 → 列表 DOM 全部重建 | ✅ 早已修掉（只追加一条），列表 MutationObserver 只记录 `+1/-0` 一次 |
| 浏览器滚动锚定与"滚到最新"打架 | ✅ 已由 `overflow-anchor: none` + `scrollbar-gutter: stable` 处理 |
| 面板高度用 `--vh100` 推算有偏差 | ❌ **实测不成立**：6 种视口下面板底边恒在视口下 20px、输入区底边最小余量 36px、`.app-container` 纵向溢出 0px |

**真正根因是"滚动跟随"本身**（逐帧数据）：

1. 新评论插入后**晚两帧才滚**（`scrollToLatestAfterLayout` 的双 rAF 等布局），
   中间会先绘制一帧"新消息已插进视野、列表还没跟下去"的画面，紧接下一帧整块再动；
2. 滚动是 `scrollTop = scrollHeight` 的**一次瞬移**——用户往上翻着历史时点发表，
   实测 `scrollTop 577 → 1196`，**619px 在一帧内甩过去**。

修法在 `src/views/DiscussionsView.vue`：滚动位置收敛为**唯一决策点**
（`watch(commentsLength, { flush:'post' })`，在"DOM 已更新、尚未绘制"这一帧决定），
首次载入直接落底、之后走 260ms 动画曲线，且**只在插入前就贴着底部（120px 内）时才自动跟随**；
用户往上翻历史时原地不动。A/B 对照：旧实现单帧 **78px** 瞬移 + 翻历史漂移 **619px**；
修复后单帧最大 **14px**、漂移 **0.0px**。

回归入口：`node scripts/dev/scratch/verify-post-scroll.mjs [宽] [高]`
（桌面 1440×900 与手机 390×844 各 12/12；交接文档既有的 5 套专项全部复跑无回归）。
完整分析见 [评论后端方案](technical/COMMENTS_BACKEND.md)，过程见
[开发日志 2026-10-03](dev-logs/2026-10/2026-10-03.md)。

> ⚠️ `- 190px` 这个面板高度魔数**仍是推算值**，且在 1025 宽时与其它视口差 12px；本轮刻意不动它
> （上次改成脚本量高度被用户实测"高度不对"而回退）。要改请按评论后端方案里的三视口复核流程走。

### 0.6 本地怎么跑起来（两个服务，缺一不可）

```powershell
# 1) 前端（5173）
npm run dev

# 2) 评论 API（8788）——不启动则页面上评论/讨论会报"无法连接评论服务器"
npm run dev:api
```

- Vite 已配 `/api` 代理到 `127.0.0.1:8788`（否则 `npm run dev` 下评论不可用，早期踩过）。
- 本地环境变量在 `.dev.vars`（gitignored）：`ADMIN_TOKEN=yxzm`、`IP_HASH_SALT=local-dev-salt`、
  放宽的限流阈值。**线上必须换成足够长的随机 `ADMIN_TOKEN`**，且不存在免密旁路。
- 本地 D1 里留了 **5 条演示数据**（站内讨论，含带头像/无头像两种，用户名是「旅行者/老玩家/萌新/工匠/路人」），
  便于直接看效果。清库：`npx wrangler d1 execute myrzg-comments --local --command "DELETE FROM comments; DELETE FROM rate_limits;"`
  重建演示数据：`node scripts/dev/scratch/seed-site-discussion.mjs`。
  ⚠️ **注意**：`scripts/dev/scratch/` 下的评论类测试脚本（`verify-no-flicker` / `verify-chat-order` /
  `verify-autoscroll` / `verify-discussions*`）**开跑前会 `DELETE FROM comments` 再自己造数**，
  跑完不会还原——跑完记得用上面的命令重建演示数据（2026-10-03 修闪烁时踩到过）。

### 0.7 测试脚本（都在 `scripts/dev/scratch/`，gitignored）

| 脚本 | 覆盖 |
| --- | --- |
| `test-comments-api.py` | 43 项：接口契约、错误文案、限流、幂等删除、超长拒绝 |
| `verify-comments-ui.mjs` | 67 项：详情里评论全流程（发帖/自删/账号弹窗/管理页/顶栏标题） |
| `verify-discussions.mjs` | 36 项：站内讨论区、发表区固定、右栏归属与样式 |
| `verify-chat-order.mjs` | 11 项：最新在下、上滑自动加载 |
| `verify-no-flicker.mjs` | 9 项：**逐帧采样 130 帧**证明布局不抖动 |
| `verify-comment-mounts.mjs` | 27 项：9 个页面逐个验证挂载与 `page_key` 合法性 |
| `verify-discussions-order.mjs` | 9 项：排序与 200 字上限 |
| `verify-autoscroll.mjs` | 6 项：打开/发表后停在最新一条 |
| `verify-hero-comment-e2e.mjs` | 4 项：非物品页面发帖 → 管理页可见 |

**跑测试前先清限流**，否则会因限流误判失败：

```powershell
npx wrangler d1 execute myrzg-comments --local --command "DELETE FROM rate_limits; DELETE FROM comments;"
```

### 0.8 上线清单（**2026-10-03 已执行并实测通过**）

1. ✅ Cloudflare Pages 项目 → Settings → Environment variables：`ADMIN_TOKEN`、`IP_HASH_SALT` 已配。
2. ✅ **已推送 `main`**（29 个提交，首个从 `952e06b6` 推到 `b67f6e07`），Pages 自动部署成功。
3. ✅ **实测线上 `/api/health` 返回 JSON**：推送后 **40 秒**即生效
   （此前是 `200 + text/html`，被 SPA 兜底吃掉）。同时确认 `_redirects` 的
   `/api/*` 放行已上线：不存在的路径 → `200 text/html`（SPA 兜底正常），
   不存在的 `/api/*` → `404`（不再被兜底吃掉）。
4. ✅ 缓存头复测：`/api/health`、`/api/comments` 均为 `cache-control: no-store`（不会被 EdgeOne 缓存）；
   `/data/parsed/items.json` 为 `public, immutable, max-age=31536000`；
   `/ui/logo.webp` 仍是 `max-age=3600`（EdgeOne 按文件类型改写，已知且接受，见架构 4.7）。
5. ⬜ Turnstile 仍未配（不影响功能，未配 `TURNSTILE_SECRET` 时自动跳过人机校验）。
6. ⬜ **Fail open 必须保持**：Pages 的 Fail open/closed 要选 Fail open，
   否则免费额度耗尽会让整个图鉴站变成错误页。

**线上接口验收（2026-10-03 实测）**

| 接口 | 结果 |
| --- | --- |
| `GET /api/health` | `200` + JSON |
| `GET /api/comments?page=site:general` | `200` + JSON，公开列表 **0 条**（生产库为空，属正常） |
| `GET /api/recent` | `200` + JSON |
| `POST /api/comments` 非法 `page_key` | `400`（白名单生效） |
| `POST /api/comments` 空内容 | `400` |
| `GET /api/admin/comments` 无令牌 | `401` |
| `POST /api/comments` 正常写入（探测用、已自删） | `201`，`status=0` 进待审（命中「外链」规则），自删 `200` |
| 远程 D1 建表 | ✅ 写入/查询/删除全通，说明 `schema.sql` 已在远程执行过 |

> 线上评论列表目前是空的：本地那 5 条演示数据只在**本地** D1，生产库没有。
> 想造演示数据可对远程执行 `wrangler d1 execute myrzg-comments --remote --file=...`，
> 或直接在线上发几条。

### 0.9 账号体系（方案已落地成文档，未实施）

用户提过"邮箱注册 + 改密码"。**落地版方案见 [账号体系落地方案](technical/ACCOUNT_SYSTEM.md)**
（早期评估稿 [ACCOUNT_SYSTEM_EVALUATION.md](technical/ACCOUNT_SYSTEM_EVALUATION.md) 已被取代，
只保留"不要自己存密码"的实测证据与邮件额度核实记录）。要点：

- Workers 免费版 **10ms CPU 硬限**，PBKDF2 600k 轮实测 104ms → 自己存密码必然要做安全妥协。
- Workers **封禁 25 端口**；且国内邮箱对"异地登录"会反复拦截（出口 IP 每次都可能不同）→
  **不要走"个人邮箱 SMTP 直连"**。
- 推荐路线：**邮箱验证码（无密码）** > 托管认证 > 自己实现。
- 发信必须走云厂商邮件推送（腾讯云 SES / 阿里云 DirectMail），需为域名加 SPF/DKIM 解析记录。

---

## 一、当前项目状态概览

1. **分支状态**：
   - 处于 `main` 分支，**领先 `origin/main` 26 个提交，尚未推送**（用户要求先把页面做好再推）。
   - 推送动作请由用户在本地终端执行（其环境网络存在代理限制）。
2. **开发服务器（两个都要起）**：
   - 前端 `npm run dev` → `5173`；
   - **评论 API `npm run dev:api` → `8788`**（不起这个，评论/讨论会报"无法连接评论服务器"）。
   - 详见上文〇·0.6。
3. **构建与健康状态**：
   - `npm run verify`（`data:build` + `vite build` + 产物完整性与残留校验）已**全部通过**。
   - 评论/讨论相关的 9 个专项脚本全部通过（数字见〇·0.7）。
4. **代码整洁度**：
   - 探索性的词条/Buff 实验模块已彻底清理，未留存多余文件或无用依赖。
   - 评论/讨论的后端只有**一个文件**：`functions/api/[[path]].js`。

---

## 二、近期核心功能与改动梳理

### 1. 关卡图鉴（`/chapters`）
- **导航图标更换**：关卡图鉴导航侧边栏已换用全新素材 `/ui/stage_crystal.webp`。
- **两级地图与路线图体系**：
  - **世界地图**（`ChapterMapCanvas.vue`）：底图 + 6 块章节拼块。
  - **地区路线图**（`RegionRouteMap.vue`）：底图 + 关卡节点 + 连线 + 锚点校准（地区立体图圆盘中心锚定、副本图标中心锚定）。
- **房间标签筛选胶囊（关卡详情 & 自由探索小地区）**：
  - 在「房间内容与掉落来源」标题下方注入了房间筛选胶囊（`UiFilterRow` + `UiFilterPill`）。
  - 支持「全部」、各具体房间（房间 1、房间 2...）以及**「带隐藏物品」**专属快捷胶囊。
  - **带隐藏物品筛选逻辑**：智能过滤包含隐藏房间、被隐藏的物品、以及带有 `？？？` 描述的房间内容。
  - **移动端多行对齐**：移动端下标签文字（如「房间：」）与首行胶囊保持顶部对齐（`align-items: flex-start; line-height: 25px;`），多行折行排版自然舒适。

### 2. 战利品货架与掉落概率明细（`RewardPools.vue` / `RewardProbabilityModal.vue`）
- **掉落规则解析与跨池去重**：
  - 支持复杂掉落规则（分组抽取率、组内单件概率、单次抽取率与综合最终获得率）。
  - 遇到同名/同 ID 跨奖励池掉落时，明细浮层与卡片自动进行来源聚合与概率合并。
- **Tooltip 浮窗边界自适应与遮挡 Bug 彻底修复**：
  - **Bug 根因**：原 Tooltip 默认使用 `display: none`，首次 `@mouseenter` 触发时浏览器尚未计算 `:hover` 渲染树，导致 `getBoundingClientRect()` 读取宽度为 0，误判为未溢出而保持居中 `translateX(-50%)`，使左右边缘卡片的浮窗直接刺出弹窗被硬遮挡截断。
  - **优雅修复方案**：
    1. CSS 将 Tooltip 默认隐藏方式改为 `visibility: hidden; opacity: 0; pointer-events: none;`，让 DOM 在初始渲染时就完成物理排版与尺寸布局（随时具备真实 `offsetWidth`）；
    2. JS 水平边界检测改用**纯几何数学推导**（依赖卡片中心点 `slotCenterX` 与浮窗物理宽度 `tooltipWidth`，结合弹窗左右边界安全垫 `pad = 12px`），彻底消除对历史残留 `transform` 的依赖；
    3. 小三角指示箭头（`--arrow-shift`）与浮窗平移联动，始终精准指向物品卡片中心；
    4. 移出（`mouseleave`）时同步清理样式。
  - **效果**：无论是否首次 hover、无论从何处移入，左侧与右侧边缘浮窗均在弹窗内部完整呈现，左右安全边距一致，不发生任何截断或跳动。

### 3. 物品详情与装备改造（`ItemDetailModal.vue` / `AcquisitionRewards.vue`）
- **传说装备品质展示方案 A**：
  - 游戏内传说装备默认品质为橙色（无其他品质），详情中的品质属性行调整为固定展示橙色品质，不出现无意义的灰阶品质项。
- **药水使用效果与设施制作顺序调优**：
  - 药水类物品详情中，将「使用效果」展示块调整至「设施制作」上方，符合玩家阅读直觉与消耗品优先级。
- **符石包与特殊物品隐藏**：
  - 符石开包与特殊掉落逻辑规范化，避免未开放或内部道具泄露到公开货架。

### 4. 怪物详情 — 界面清爽化与阶段流转卡优化
- **移除多余图标与误导文案**：
  - 移除了阶段流转卡中无实义的小闪电图标。
  - 清除二阶段误导文案（如 `已进入狂暴变身状态...` 以及硬编码 `(变身狂暴)`），全面规整为客观精确的 `二阶段` 或专属阶段名。
- **形态切换按钮样式调优**：
  - 桌面端阶段流转卡底部操作栏改为靠右对齐（`justify-content: flex-end`），按钮视觉更精致平衡；移动端保持全宽撑满触控友好。
- **形态 Tab 前缀自动呼应**：
  - `formTabOptions` 计算中，二阶段（`after`）形态自动寻找其对应的一阶段形态前缀；
  - 效果：若一阶段为 `剧情 / 探索`，则二阶段自动展示为 `剧情 / 探索 (二阶段)`，不再出现前后缀割裂。

### 5. 怪物技能触发条件解析增强
- **主客体与动作明确**（在 `monsterParser.js` 中解析 AI 状态转移树 `triList`）：
  - `triType: 2` → `自身生命值降至 XX% 及以下`
  - `triType: 7` → `自身普攻 X 次后`
  - `triType: 16` → `自身受到 X 次攻击后`
  - `triType: 1` → `战斗持续 X 秒后`
  - `triType: 8` → `自身死亡时`
- **离散随机概率精准标注**：
  - 对于区间型判定（如普攻 2~4 次），计算出各档位的离散几率：
    - 例：`自身普攻 2~4 次后（各 33.3% 几率）`

### 6. 全怪物普通攻击（普攻）展示修复
- **问题根因**：原先怪物技能解析中，普攻（`skillType: 0`）在去重和未命名过滤时被判定为开发者占位符，导致大量怪物的普攻未被渲染。
- **修复方案**：
  - 放行怪物的默认普通攻击，统一将其规范命名为【普通攻击】；
  - 补全普通攻击的段数伤害拆解（`damageHits`）、倍率以及附加状态。

### 7. 砂蜘蛛织网者（012 / 012_1）专属机制 —「方案一」落地
- **底层机制揭秘**：
  - **一阶段（012）**：悬挂于半空蛛网，处于固定射手状态，击退抗性高达 `999999999`（绝对霸体，无法击退与打断）；
  - **击落条件**：受到玩家任意攻击命中 4 次后，触发动作 `down` 摔至地面，形态切换为 `012_1`；
  - **二阶段（012_1）**：掉落至地面后击退抗性暴跌为 `0`（完全破防，玩家可随意打断与击退）；在地面仓皇反抗普攻 2 次后触发 `goAway` 并执行动作 `up_2` 重新结网逃窜回天花板，变回一阶段。
- **定制化呈现**：
  - **形态 Tab 标签**：`空中结网 (一阶段)` / `坠地虚弱 (二阶段)`
  - **阶段 Badge**：`当前查看：空中结网 · 霸体` / `当前查看：坠地虚弱 · 破防`
  - **动态条件气泡**：一阶段显示 `条件：被命中 4 次后击落`；二阶段显示 `回网：完成 2 次攻击后逃窜回网`
  - **切换按键文案**：`查看【坠地虚弱 · 破防】➔` / `🠔 返回【空中结网 · 霸体】`

### 8. 词条百科（`/glossary`）—— 方案 A 全自动化重构
- **核心定位革新**：彻底摒弃底层配置参数查看器模式，构建面向玩家的清爽 Wiki 词条百科。
- **三大板块知识体系**：
  - **异常与状态**（持续伤害、强力控制、削弱减益、增益生存、怪物异变）；
  - **战斗属性**（基础面板、高级进阶与硬性上限如攻速+300%、冷却缩减50%）；
  - **核心机制**（普攻/主动/被动/星阶技能系统、伤害结算七步流、等级压制50%）。
- **全自动化数据管道**：
  - 自动扫描全量 `buff.json`，根据 `STATUS_RULES` 自动匹配各状态；
  - 自动聚合计算持续时间区间（如 `3 ~ 10 秒`）、跳字结算频率（如 `每 1 秒结算一次`）、伤害元素属性；
  - 自动反查施加来源（`hero.json` / `mon.json` / `pet.json` / `item.json`），提取施加角色（附技能名）、怪物、魔物与道具；
  - 未来更新游戏原表，只需运行 `npm run data:build`，所有新角色、新怪物、新技能、新数值范围全自动同步更新。
- **图鉴深度联动**：词条详情弹窗中，点击施加角色直达角色图鉴（`/heroes?id=`），点击怪物直达怪物图鉴（`/monsters?id=`），点击魔物直达魔物图鉴（`/pets?id=`），点击道具直达全局物品详情。

---

## 三、核心文件与代码架构

### 1. 关键文件速查表

| 文件路径 | 核心职责 |
| :--- | :--- |
| `src/utils/monsterParser.js` | 怪物数据预解析纯函数。包含 `SPECIAL_TRANSFORM_CONFIGS` 配置表、AI 触发条件格式化、普通攻击过滤修正与变身边关系提取。 |
| `src/components/MonsterDetailModal.vue` | 怪物详情弹窗组件。承载形态 Tab 联动、阶段流转卡（支持定制节点名与动态回网条件）、技能详情与召唤物联动。 |
| `scripts/parse/monsters.mjs` | 构建期怪物数据编译脚本。调用 `monsterParser.js` 输出预解析产物 `public/data/parsed/monsters.json`。 |
| `scripts/parse/index.mjs` | 数据预编译总调度。定义构建任务队列与执行顺序（`items` 必须先于其他任务构建）。 |
| `scripts/dev/verify.mjs` | 全局自动化验收脚本。检查全图鉴 Tab 命名无冲突、产物大小完整性、浏览器运行时纯净度与构建验证。 |
| `src/views/ChaptersView.vue` | 关卡图鉴主页。管理世界地图、地区路线图与关卡详情的层级导航。 |
| `src/components/RewardPools.vue` | 战利品货架。承载奖励池展示、掉落概率明细弹窗与跨池去重聚合。 |
| `src/components/ItemDetailModal.vue` | 物品详情弹窗。处理装备品质展示、药水效果排序与符石包过滤。 |

### 2. 数据流水线与预解析（`scripts/parse/`）
- **数据源单一真实性**：
  - 运行时纯粹读取 `public/data/parsed/` 下的预处理 JSON，前端禁止直接引用 `raw/` 下的原始大表。
  - 每次改动数据解析脚本后，必须运行 `npm run build` 或 `npm run verify` 生成并验证对应清单。
- **构建顺序**：`items` 必须先构建，其他解析模块依赖 `itemData`。

---

## 四、特殊变身阶段配置规范（拓展指南）

若后续游戏更新或需为其他拥有特殊机制的怪物配置生动的阶段展示，只需在 `src/utils/monsterParser.js` 的 `SPECIAL_TRANSFORM_CONFIGS` 中注册对应的怪物 ID：

```javascript
const SPECIAL_TRANSFORM_CONFIGS = {
  // 怪物基础 ID 或变身发起 ID
  '012': {
    stage1Name: '空中结网 · 霸体',        // 节点 1 名称
    stage2Name: '坠地虚弱 · 破防',        // 节点 2 名称
    stage1Tab: '空中结网 (一阶段)',       // 一阶段 Tab 显示文本
    stage2Tab: '坠地虚弱 (二阶段)',       // 二阶段 Tab 显示文本
    condition: '被命中 4 次后击落',       // 阶段 1 -> 阶段 2 触发条件（可选覆盖）
    reverseCondition: '完成 2 次攻击后逃窜回网' // 阶段 2 -> 阶段 1 逆向逃窜条件（可选覆盖）
  }
}
```

配置后，`MonsterDetailModal.vue` 会自动优先读取这些字段，未配置的普通变身怪（如角布林头领）将优雅回退为默认的 `一阶段` / `二阶段`，完全向前向后兼容。

---

## 五、关键架构与技术要点（避坑指南）

### 1. 样式的布局与测量安全性
- **动态测量元素（Tooltip / 弹出气泡）**：
  - 避免用 `display: none` 配合 JS 首次 hover 测量尺寸。若需要读取元素宽高，优先使用 `visibility: hidden; opacity: 0;` 让其保留在 Layout Tree 中。
- **弹窗内相对容器定位**：
  - 弹窗内容区带有 `overflow-y: auto` 和边框，Tooltip 计算容器优先通过 `slot.closest('.ui-modal-body, .ui-modal-window')` 获取可视边界。

### 2. 坐标转换与地图画布规范
- **Unity 坐标系到 Web 坐标系**：
  - Unity UI 的 `localPosition` 是 `+y` 向上，CSS 的 `top` 是 `+y` 向下。统一使用 `y_css = size.h - y_unity`。
  - 节点坐标、连线端点、底图中心点均需同步翻转，任何偏移量（如地区 -80、副本 -75）需在 Unity 坐标系内先行相加再行翻转。
- **地图缩放与事件捕获**：
  - 地区路线图交互使用显式偏移（Translate），禁止使用 `scrollLeft/scrollTop`。
  - 节点使用 `1/zoom` 反向补偿缩放，确保在任意视口缩放下保持物理像素清晰与视觉尺寸稳定。

### 3. Windows / PowerShell 开发注意事项
- **编码问题**：
  - 禁止使用 PowerShell 自带的 `Out-File` 或 `Set-Content` 直接写入 UTF-8 中文字符串（容易引发乱码或引入 BOM）。推荐使用专用的文件写入工具或 Node.js `fs.writeFileSync(file, content, 'utf8')`。
- **npm 执行策略限制**：
  - 在当前 Windows 环境下，直接在 PowerShell 终端执行 `npm` 命令可能会受到脚本执行策略限制，必须使用 `cmd.exe /c <command>`。
- **自动化校验**：
  - 提交前务必运行 `node scripts/dev/verify.mjs`，确保全部数据校验、死链检查和产物构建通过。

---

## 六、常用命令一览

| 目标 | 执行命令 | 说明 |
| --- | --- | --- |
| 本地开发 | `cmd.exe /c npm run dev` | 启动 Vite 开发服务器（支持热重载） |
| **评论 API（本地必需）** | `cmd.exe /c npm run dev:api` | 启动 wrangler Pages Functions（8788）；**改了 `functions/` 必须重启** |
| 数据预构建 | `cmd.exe /c npm run data:build` | 重新生成所有 `parsed/*.json` 数据 |
| 全量校验 | `cmd.exe /c npm run verify` | 执行完整预解析检查与生产构建打包 |
| UI 自动化测试 | `cmd.exe /c npm run test:ui` | 运行 Playwright UI 交互与回归测试 |
| 清本地评论/限流 | 见上文 0.7 | 跑评论测试前必须先清，否则被限流误判 |

> **提示**：修改了 `monsterParser.js`、`items.mjs` 等预解析逻辑或原始配置表后，必须执行 `data:build` 重新生成 JSON 文件。交付前必须确保 `verify` 命令退出码为 0（全部 ✅）。

---

## 七、后续可关注优化方向

0. **[最优先] 推送上线**（〇·0.8 清单）——闪烁问题已于 2026-10-03 修复（见〇·0.5），
   上线前唯一未做的是线上三项实测（`/api/health` 是 JSON、不被 EdgeOne 缓存、静态请求不调用 Function）。
1. 讨论区面板高度仍是 `calc(--vh100 - … - 190px)` 的**推算魔数**（〇·0.5 末尾），
   要动它必须先在 1025 / 1161 / 1440 三视口复核；
2. 关卡图鉴中更多特殊关卡（如隐藏探索点位、支线任务交互）的视觉高亮与过滤增强；
3. 移动端在极端小屏（< 360px）下复杂概率文本的字号与排版微调；
4. 为更多拥有特殊战斗机制的 Boss 配置 `SPECIAL_TRANSFORM_CONFIGS`，丰富阶段展示；
5. 怪物 Buff / 异常状态数值补全（已做前期数据探索，`raw/buff.json` 中含完整 Buff 定义，可在后续版本中落地为独立模块）；
6. 后续版本若有新增关卡/怪物/装备数据，运行 `scripts/parse/` 重新构建即可平滑接入。
