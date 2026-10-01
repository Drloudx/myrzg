# 评论后端方案（Cloudflare 免费版）

> 状态：**已实施**（2026-10-02）。代码、数据表与本地验证已完成；**尚未部署上线**，上线动作见第十二节。
>
> 本文同时承担方案与实现说明：选型、数据表（已建）、接口（已实现）、防刷、CDN 配置与验收。
>
> 2026-10-02 实测确认两件关键事实：**EdgeOne 回源到 Cloudflare Pages**（源站类型 IP/域名 → `myrzg.pages.dev`，见 6.3），**且 EdgeOne 不缓存 JSON**（直接带 `immutable` 的线上 JSON 连打三次仍为 `MISS`，见 6.2）。
>
> 通用 UI 约束仍以 [UI 组件库](../UI_COMPONENT_LIBRARY.md) 为准。

## 〇、实施落点（2026-10-02）

| 文件 | 职责 |
| --- | --- |
| `functions/api/[[path]].js` | 评论 API：列表/发表/自删 + 管理端（列表/改状态/彻底删除） |
| `src/config/commentBlocklist.js` | 审核词表（类别正则），命中 = 进待审而非拒收 |
| `scripts/dev/sync-comment-blocklist.mjs` | 只读校验词表与游戏词库一致 + 误伤/漏检自检 |
| `src/utils/commentApi.js` | 前端 API 客户端（含原生端绝对地址处理与自删令牌本地存储） |
| `src/utils/identity.js` | **本机身份**（昵称 + 头像选择），非账号体系，见第〇·一节 |
| `scripts/dev/sync-avatar-catalog.mjs` | 生成 `public/data/parsed/avatarCatalog.json`（头像 ID ↔ 图片路径） |
| `src/components/CommentsPanel.vue` | 讨论区组件，业务组件不进通用 UI 出口 |
| `src/components/AccountModal.vue` | 账号弹窗（本机身份设置），由顶栏账号按钮打开 |
| `src/views/AdminCommentsView.vue` | 管理页 `/#/admin/comments` |
| `wrangler.toml` / `schema.sql` / `public/_routes.json` | D1 绑定、表结构、Functions 调用范围 |

D1 数据库：`myrzg-comments`，id `5f0d4c37-107f-4811-bc5e-768f73c51a3a`，region WNAM。

**已实测**：本地 API **25 项**端到端测试全过（CRUD、鉴权、限流、分页、无字段泄漏、头像 ID 往返与非法 ID 丢弃、XSS 原文存储）；浏览器 **29 项** UI 验证全过（三态、账号弹窗设昵称与头像、未设昵称时的引导、发表、自删、管理页、蜜罐不可见、图标真实加载）；`npm run verify` 通过。

### 一期范围与不做的事

- 评论只挂在**物品详情**（`ItemDetailModal`）。列表页不挂——首页就是物品图鉴，卡片点开极频繁，列表页挂载会产生大量无效请求。
- **不做账号体系**，改做**本机身份**（见下节）。原因见第七节「为什么不做账号」。
- **不做楼中楼**（表里保留 `parent_id` 备用）。
- 用户自删走**浏览器令牌**（发表时自动下发、存 localStorage），不需要记任何东西；换设备/清浏览器数据后需联系管理员。

## 〇·一、本机身份（昵称 + 头像）

「账号」按钮（原深色模式按钮的位置）打开 `AccountModal`，里面设置**昵称**与**头像**，
评论时自动带上，用户不必每次重填。

**它是本机身份，不是账号**：只存浏览器 localStorage（键 `myrzg:identity`），不注册、不登录、
无密码、不跨设备同步，**也不验证身份——任何人都能把昵称设成别人的名字**。这一点在弹窗里如实写明。
真正的账号体系需要后端认证，切入点与迁移路径见第七节。

流程约定（用户指定）：

1. 评论框**不再有昵称/邮箱输入**，只显示身份行（头像 + 「以 X 的身份发表」+ 修改）。
2. 未设昵称就点「发表」→ **自动弹出账号弹窗**并提示「请先设置昵称」，
   保存后再点发表才真正提交。**不自动用"匿名"顶替**，否则用户会以为设置已生效。

### 头像为什么用游戏素材、且存 ID

- 头像候选来自 `public/images/HeadIconAtals/`，由脚本生成清单：
  `node scripts/dev/sync-avatar-catalog.mjs --apply` → `public/data/parsed/avatarCatalog.json`。
  **只收录能对应到角色图鉴 / 魔物图鉴的头像**（用户要求"只显示角色图鉴和魔物图鉴里有的"）：
  - `at*` → 角色头像，按前三位数字对应 `hero_001` 形式；
  - `avatar_pet_*` → 魔物头像，对应 `pet_006` 形式；
  - `avatar_Mon*`（怪物头像）**完全不收录**。
  实测从 86 个筛到 **76 个**（角色 36 + 魔物 40），隐藏 10 个对不上图鉴的
  （`at002/003/010/022/028/047/057/059` 对应的角色未进图鉴，以及 `avatar_pet_098`）。
  脚本会逐个报告被跳过项，不会静默丢弃。
- 清单条目带**角色/魔物名**，选择器显示中文名而不是 `at001b_0` 这种内部编号；
  同一角色多个立绘时自动补序号（如「希尔」「希尔（2）」）。
- **评论只存头像 ID（如 `avatar_pet_006`），不存图片路径**。路径由清单查。
  好处：素材目录将来改名/迁移时只改清单，**库里的历史评论不会变成失效路径**；
  服务端也能用同一份 ID 规则校验，客户端塞不进任意字符串。
- 服务端只做**格式**校验（`^[A-Za-z0-9_]{1,40}$`），不校验是否在清单里——
  Worker 读不到 `public/` 下的文件，硬编码白名单会与素材脱节。非法 ID 被丢弃为 `null`
  （回退昵称首字占位），**不因此拒绝整条评论**。

### 为什么删掉了「邮箱生成头像」（Gravatar）

初版用邮箱哈希拼 `cn.gravatar.com` 取头像，**已移除**，两条硬伤：

1. Gravatar 是 Automattic 的服务，**国内用户绝大部分没有账号**，拿到的是随机几何图案，不是本人头像。
2. 它要求把邮箱标识发给第三方，与「只存哈希、不存明文邮箱」的隐私取向**自相矛盾**。

现在头像用游戏素材自选；没选或 ID 无效时回退**昵称首字圆形占位**。
`comments.email_hash` 列保留但不再使用（SQLite 删列代价高，留历史数据无害）。

## 一、结论

**Cloudflare 免费版可以支撑评论功能，不需要购买任何服务。** Cloudflare 免费账号自带 Workers / Pages Functions + D1（SQLite）+ KV + R2 + Turnstile，其中评论只需要用到 Functions、D1 和 Turnstile 三项。

本站当前架构（2026-10-02 实测）：

```
浏览器
  │  CNAME → myrzg.yxzmy.top.eo.dnse3.com   （腾讯云 EdgeOne，NS: peach/henry.dnspod.net）
  ▼
EdgeOne 边缘节点            Server: cloudflare / EO-Cache-Status / EO-LOG-UUID
  │  回源
  ▼
Cloudflare Pages（静态产物 + 可选 Pages Functions）
```

也就是说：**EdgeOne 在最外层，Cloudflare 在回源侧**，这个顺序决定了本方案最大的风险点是 EdgeOne 的缓存策略，而不是数据库或算力。

## 二、免费额度（官方文档核实，2026-10-02）

| 能力 | 免费额度 | 对评论的意义 |
| --- | --- | --- |
| Workers / Pages Functions 请求 | 100,000/天（UTC 零点重置） | 够；单条评论约占 2 次（读列表 + 发评论） |
| Workers CPU 时间 | **10 ms/次调用** | ⚠️ 硬约束，见 2.1 |
| D1 行读取 | 5,000,000/天 | 远够 |
| D1 行写入 | **100,000/天** | 约束点，见 2.2 |
| D1 存储 | 5 GB（账号合计） | 每条评论 < 1 KB，几十万条也够 |
| D1 出网流量 | 免费 | Cloudflare 全线不收 egress |
| KV | 读 100,000/天、**写 1,000/天** | 写入太少，**不能当评论主库**；只适合做缓存 |
| R2 | 10 GB、A 类 100 万/月、egress 免费 | 存表情包/附件够，评论文字用不上 |
| Durable Objects | 免费版**仅 SQLite 后端** | 做实时通知/在线人数才需要，一期不用 |
| Turnstile 人机验证 | **完全免费，挑战次数不限**，20 个 widget，10 hostname/widget | 防刷主力，白送 |
| 静态资源请求 | 免费且不限量 | 图鉴页面本体不占那 10 万次额度 |

### 2.1 CPU 10 ms 是硬约束

只统计**真正执行 JS 的 CPU 时间**；等 D1、等 fetch、等网络**不计入**。

- ✅ 校验 Turnstile、拼 JSON、写 D1：约 2～7 ms，安全
- ❌ **bcrypt / argon2 哈希密码**：单次 50～100 ms，必然超限（Error 1102）

因此：**若将来要做账号密码，必须用 WebCrypto 的 PBKDF2 或 scrypt**（原生实现，毫秒级），不得引入 bcrypt/argon2。一期匿名评论无密码，不触发此约束，但这条约束写在这里避免以后踩。

### 2.2 D1 写入按“行”计费，索引也算行

一次 `INSERT` 到带 3 个索引的表 = **4 行写入**（主表 1 + 索引 3）。加上限流计数，发一条评论约 5～6 行。10 万行/天 ≈ **1.5 万～2 万条评论/天**。

结论：索引要克制（本方案只建 3 个），限流表按“小时桶 UPSERT”而非“每次留言插一行”。

## 三、选型

| 方案 | 后端 | 成本 | 评价 |
| --- | --- | --- | --- |
| **A. Pages Functions + D1（自写 API）** | 自己的 | 全免费 | ✅ **推荐** |
| B. Giscus（GitHub Discussions） | GitHub 托管 | 全免费、零维护 | 评论者必须有 GitHub 账号；数据在 GitHub；样式不可控 |
| C. Waline / Artalk 现成系统 | 可挂 D1 | 全免费 | 省事，但自带样式与羊皮纸主题冲突，改不动 |

**选 A 的理由**（与本项目规范直接相关）：

1. UI 规范强制“一切视觉从 `components/ui/` 引用”，且必须支持羊皮纸/暗色双主题与品质色体系。现成系统的样式无法接入 `--paper-*` 变量，会破坏 `theme.css` 单一样式源。
2. 本站遵循“不伪造状态”原则（不模拟已读、已领取）。自写接口才能保证不出现平台自带的“点赞数/热度”等易失真的展示。
3. 数据契约、来源真实性边界可由本项目自行控制。

## 四、数据表（D1 / SQLite）

```sql
-- 评论主表
CREATE TABLE comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key     TEXT    NOT NULL,           -- 'item:30047' / 'monster:1002' / 'hero:hero_001'
  parent_id    INTEGER DEFAULT NULL,       -- 预留楼中楼，一期不使用
  nick         TEXT    NOT NULL,
  email_hash   TEXT    DEFAULT NULL,       -- 只存 SHA-256，用于 Gravatar；绝不存明文邮箱
  body         TEXT    NOT NULL,
  status       INTEGER NOT NULL DEFAULT 1, -- 1 正常 / 0 待审 / 2 已隐藏
  created_at   INTEGER NOT NULL,           -- Unix 秒
  ip_hash      TEXT    NOT NULL,           -- SHA-256(ip + 服务端盐)，仅用于限流与追溯
  ua_hash      TEXT    DEFAULT NULL
);

CREATE INDEX idx_comments_page   ON comments(page_key, status, created_at DESC); -- 列表查询
CREATE INDEX idx_comments_recent ON comments(created_at);                        -- 全局清理/统计

-- 限流计数：按小时桶 UPSERT，避免每次留言插新行
CREATE TABLE rate_limits (
  bucket   TEXT    NOT NULL,   -- 'ip:<sha256>:<YYYYMMDDHH>'
  counter  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket)
);
```

**关于邮箱**：只存 `SHA-256(小写去空格邮箱)`。Gravatar 所需的是 MD5，可在鉴权后的查询路径上由前端传入或服务端计算，但**明文邮箱不落库**——这样即使数据库泄漏也不暴露用户邮箱。

**关于 `page_key`**：与本站 URL query 体系对应，直接用业务 ID 而不是页面路径，避免分享链接带筛选参数时评论串页：

| 页面 | page_key 形式 |
| --- | --- |
| 物品 / 装备（共用详情） | `item:<typeId>` |
| 家具 | `furniture:<id>` |
| 角色 | `hero:<heroId>` |
| 魔物 / 怪物 | `pet:<id>` / `monster:<id>` |
| 任务 / 事件 / 副本 / 关卡 | `task:<id>` / `event:<id>` / `battle:<id>` / `stage:<stageId>` |
| 词条 | `glossary:<词条名>` |

## 五、接口设计

基址 `/api`，全部返回 `application/json; charset=utf-8`（**带 charset，见 6.3**）。

### `GET /api/comments?page=<page_key>&cursor=<id>&limit=20`

- 游标分页（按 `created_at DESC, id DESC`），不用 `OFFSET`
- `limit` 上限硬编码 50，非法值回落 20
- **不做 `COUNT(*)`**：D1 读按行计，`COUNT(*)` 是全表扫描。列表只返回 `has_more`
- 返回体不含 `ip_hash` / `email_hash`

```json
{
  "ok": true,
  "comments": [
    { "id": 12, "nick": "旅行者", "body": "这条路线..." , "createdAt": 1790889289, "gravatar": "https://..." }
  ],
  "nextCursor": 12,
  "hasMore": true
}
```

### `POST /api/comments`

请求体：

```json
{
  "page": "item:30047",
  "nick": "旅行者",
  "email": "a@b.com",
  "body": "评论内容",
  "token": "<Turnstile response>",
  "hp": ""            // 蜜罐字段，正常用户永远为空
}
```

服务端校验顺序（任一失败即返回 4xx，且**不写库**）：

1. `hp` 非空 → 直接拒绝（蜜罐，零成本拦机器人）
2. 字段长度：`nick` ≤ 24、`body` ≤ 1000、`page_key` ≤ 64 且匹配白名单前缀
3. Turnstile `siteverify`（`TURNSTILE_SECRET`）；`success !== true` → 403
4. 限流：同 `ip_hash` 每小时 ≤ 5 条、每天 ≤ 20 条
5. 内容净化：**不存 HTML**，把 `<>` 转义或剥离；换行统一 `\n`
6. 写入 → 返回新评论对象（前端乐观插入）

### `GET /api/health`

返回 `{"ok":true,"ts":...}`，用于第六节的缓存实测与线上探活。

### 对外错误文案契约（用户明确要求）

`error` 字段是**给普通用户看的字**，不是给开发者看的日志。规则：

- 只在下面这张表里选，不临时造新句子；
- **不出现技术名词、状态码、字段名、英文**——`JSON`、`page_key`、`D1`、`token` 这类字眼
  一律不出现在 `error` 里；
- 技术细节写进 `console.error` 的服务端日志（`wrangler pages dev` 的终端能看到）。

| 对外文案 | 何时用 | 内部含义 |
| --- | --- | --- |
| 评论不存在 | 目标评论已被删除或从未存在 | 404 |
| 无法连接评论服务器 | 服务端自身故障 | 500 |
| 请求太频繁，请稍后再试 | 触发小时限流 | 429 |
| 今天发言次数已达上限 | 触发日限流 | 429 |
| 评论内容不能为空 | 正文为空 | 400 |
| 请填写昵称 | 昵称为空 | 400 |
| 评论内容有误，请检查后重试 | 请求体非法 / 页面标识格式不对 | 400 |
| 提交失败，请刷新页面后重试 | 人机校验、蜜罐拦截、无删除权限 | 403 |
| 操作失败，请稍后再试 | 没有更贴切的归类时兜底 | 4xx/5xx |

契约写在 `functions/api/[[path]].js` 的 `ERR` 常量里；前端 `commentApi.js` 另有一组**只在
"请求根本没到服务端"** 时用的兜底文案（`无法连接评论服务器` / `网络连接异常` /
`网络连接超时，请稍后再试`）。API 测试逐条断言"文案在契约内且不含技术名词"。

### 管理端搜索在服务端做

`GET /api/admin/comments?q=<关键词>` 在**服务端**匹配正文 / 昵称 / 页面标识。
不放在前端过滤：评论会持续增长，管理端不该把全部数据拉到浏览器再筛。

- 用 `LIKE` 而不是 FTS：D1 免费版读便宜（500 万行/天）、写贵（10 万行/天），
  FTS 要额外索引（写入按行计费），而管理端查询低频，不值得增加写入成本。
- `%` / `_` / `\` **用 `ESCAPE` 子句按字面量匹配**，不能简单删掉：
  删了会变成空条件 → 静默返回全部，用户搜 `%` 却看到"全部"是最容易误判的行为。
- 前端输入防抖 400ms（每敲一个字都请求会打满免费额度），空态文案在有关键词时
  显示「没有匹配的评论」。

### 删除是幂等的
`DELETE /api/comments` 的目标状态是"这条评论不再可见"。**已经不可见（或从未存在）时返回成功**，
不再报"评论不存在"。原因：重复点击、多个标签页、列表是旧快照都会走到这条路径，
而"明明还在却说不存在"比直接消失更让用户困惑。前端同时把 404 当成功处理（容忍旧响应），
并在删除失败后重新拉一次列表让界面与真实状态对齐。

### 无 `_routes.json` 时的“静态请求免费额度”保护

一旦加入 `functions/` 目录，**默认所有请求都会调用 Function**，静态资源就不再免费。必须在构建产物根放 `_routes.json`：

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

`include` 只有 `/api/*`，图鉴页面本体的请求仍是“未调用 Function 的静态请求”，继续免费不限量。

## 六、必须处理的三个风险

### 6.1 SPA 兜底路由会吃掉 API 请求（已实测确认）

本站 `public/_redirects` 是 `/* /index.html 200`。实测访问 `https://myrzg.yxzmy.top/api/health` 返回：

```
Status: 200
Content-Type: text/html; charset=utf-8
```

**返回 200 且是 HTML**——说明该路径当前被兜底规则接住了。加了 Functions 之后，如果优先级处理不当，API 仍可能被兜底到 `index.html`，前端拿到 HTML 当 JSON 解析，报错信息会非常误导。

**处理**：

1. Functions 用**显式路径**（`functions/api/[[path]].js`），不要依赖兜底
2. 在 `_redirects` **顶部**加 `include` 式排除（Cloudflare Pages 的 `_redirects` **不支持 `!` 取反**，用显式放行规则）：
   ```
   /api/* /api/:splat 200
   /* /index.html 200
   ```
3. **部署后必须实测**（不能只看配置）：
   ```powershell
   curl.exe -i https://myrzg.yxzmy.top/api/health
   # 断言：Content-Type 含 application/json，而不是 text/html
   ```
   这条不通过，评论功能一律视为未接通。

> 依据：Cloudflare Pages 的 Functions 是文件路由，静态资源与 `_redirects` 的先后关系未在官方文档中明确承诺，因此本方案采用“显式路径 + 显式放行 + 实测断言”三重保险，而不是赌某一种优先级。

### 6.2 EdgeOne 缓存（2026-10-02 实测：**不缓存 JSON**）

风险原本是"评论发成功但刷新看不到"。实测后**该风险在本站当前配置下不成立**，但原因和"源站写了 no-store"无关，值得记下来避免以后误判。

**实测方法**（同一 URL 连打多次，看 `EO-Cache-Status` 与 `Age` 是否变化）：

| 探针 | 结果 | 结论 |
| --- | --- | --- |
| `/ui/logo.webp` ×3 | `HIT`，`Age` 435898 → 435899 → 435900 递增 | 缓存机制**确实在工作**（对照组成立） |
| `/data/parsed/items.json?same=1` ×3 | **`MISS` / `Age=0` / 始终不变** | 源站已带 `public, immutable, max-age=31536000`，EdgeOne **仍不回缓存** |
| `/update/hotupdate.json` | `MISS`，源站 `no-store` | 符合预期 |
| `/`（HTML） | `MISS`，源站 `no-cache` | HTML 不缓存 |
| `/api/health` ×4（当前被 SPA 兜底成 HTML） | `MISS` / `Age=0` | 未缓存 |

**结论**：该加速域名对 `application/json` 与 HTML **一律不缓存**，只有图片（`image/*`）按 `max-age=3600` 缓存。这与 [架构 4.7](../ARCHITECTURE.md#47-资源版本与容错) 记录的"`/images/*`、`/ui/*` 被压成 1 小时、而 `.json`/`.mp4` 仍按 `_headers` 拿到 7 天"完全一致——**EdgeOne 这里是按文件类型缓存，不是按路径**。评论接口返回 JSON，天然落在不缓存的那一类。

**但仍建议显式配一条规则**，理由有三：① 现在"不缓存"是默认行为，将来谁在控制台加一条 JSON 类型缓存规则就会静默改变评论行为；② 显式规则自解释，后人不用重新做上面这套实测；③ 规则引擎优先级高于站点加速，配了就不怕被别处覆盖。

**配置路径与要点**（腾讯云 EdgeOne 控制台）：

1. 进入站点 → **规则引擎**（站点加速 → 规则引擎）。文档明确：**规则引擎优先级高于站点加速侧配置**，同一操作以规则引擎为最终生效值。
2. 新建规则：匹配条件选路径类型，运算符"前缀匹配/等于"，值填 `/api/`；操作为 **节点缓存 TTL = 不缓存**（或"遵循源站"）。
3. **规则位置要放对**：文档明确"如果同时匹配到多条规则，**下方规则的操作将覆盖上方的规则**"。所以 `/api/` 这条要放在**下方**（细粒度规则在细处）；放上方会被通用缓存规则覆盖，这是最容易踩的坑。
4. 源站侧同时加 `Cache-Control: no-store`（`public/_headers` 的 `/api/*` 段）作为第二道防线，即使规则被误删也不会缓存。

**部署后回归**：

```powershell
# 连打两次，断言两次 EO-Cache-Status 均非 HIT 且 Age 不增长
1..2 | % { curl.exe -sI https://myrzg.yxzmy.top/api/health }
```

> 已有工具：`npm run cdn:check`（`scripts/dev/check-cdn-cache-headers.mjs`）已按文件类型核对缓存头。**建议扩展它增加一组 `/api/health` 断言**（`no-store` + `EO-Cache-Status` 非 HIT），让评论的缓存回归进现有验收流程，而不是靠人记得手动测。

### 6.3 域名与 DNS 现状（决定“能不能用子域绕开”）

实测：

```
yxzmy.top            NS:  peach.dnspod.net / henry.dnspod.net   （腾讯云 DNSPod）
myrzg.yxzmy.top      CNAME → myrzg.yxzmy.top.eo.dnse3.com       （EdgeOne 加速）
api.myrzg.yxzmy.top  A 28.0.0.116                                （已存在解析，疑似 EdgeOne 泛解析）
```

- 域名 DNS 在**腾讯云 DNSPod**，不在 Cloudflare。因此“把子域直接指向 Cloudflare Workers 以绕开 EdgeOne”需要先在 DNSPod 加 CNAME，**且必须确认该子域没有被 EdgeOne 的泛解析规则接管**（`api.` 当前已能解析，说明很可能被接管）。
- **EdgeOne 控制台已确认的配置**（用户提供截图，2026-10-02）：

  | 加速域名 | 状态 | 源站类型 | 源站配置 | HTTPS |
  | --- | --- | --- | --- | --- |
  | `myrzg.yxzmy.top` | 已生效 | IP/域名 | **`myrzg.pages.dev`** | 已部署 |
  | `hxsngh.yxzmy.top` | 已生效 | IP/域名 | `hxsngh.pages.dev` | 已部署 |

  这条解决了一个前置疑问：源站指向 `*.pages.dev`，即**回源到 Cloudflare Pages**，因此 Pages Functions 能在本站生效（若源站是静态存储桶，Functions 方案直接作废）。另一个站 `hxsngh` 是同套架构。
- 因此本方案**不依赖子域**：评论接口同域走 `/api`，靠 EdgeOne 规则保证不缓存（见 6.2）。这样只动一个控制台设置，不碰 DNS，风险最小。
- 若将来想彻底绕开 EdgeOne（例如要上 WebSocket 实时评论），再评估独立子域方案，届时需先确认 DNSPod 上没有 `*.myrzg` 泛解析。

## 七、部署与配置

### 为什么不做账号体系（2026-10-02 决策）

一期明确不做邮箱注册/登录，理由按重要性排序：

1. **免费版 CPU 上限让"自己存密码"不可取**。Workers 免费版每次调用只有 10ms CPU。
   本地实测 PBKDF2-SHA256：10,000 次 2.5ms / 100,000 次 18.7ms / **600,000 次（OWASP 现行推荐）104ms**。
   为了不触发 Error 1102，迭代次数只能压到 1 万上下，**比安全推荐值低约 60 倍**——
   做得出来，但不该用它存用户的真密码。
2. **想安全就只能走托管认证**（如 Supabase Auth、Auth0），即引入第二个外部服务依赖。
   这是一件值得**单独一期**认真做的事，不应塞在评论功能里顺带做。
3. **它解决不了真正的问题**。防机器人靠 Turnstile + 限流；删评论管理员已经能做。
   账号只多买到"知道谁在说话"，却同时带来注册、登录、忘记密码、异常账号处理等**更多**管理工作。
4. **隐私责任**。存了用户邮箱就要承担个人信息保护义务（隐私政策、删除请求、泄露风险）。
   本站规范里"不伪造账号状态"是声明，加了真实账号就变成义务。

**迁移余地已留好**：`comments` 表有 `nick`/`email_hash`，将来加账号只需补 `users` 表与
`user_id` 外键，**不需要重建已有数据**。

### 7.1 文件落位

```
vue-myrzg/
├── functions/
│   └── api/
│       └── [[path]].js        # 评论 API（单文件路由 /api/*）
├── wrangler.toml              # D1 绑定与兼容日期
└── public/
    ├── _routes.json           # include: ["/api/*"]
    ├── _redirects             # 顶部加 /api/* 放行规则
    └── _headers               # 加 /api/* → Cache-Control: no-store
```

### 7.2 `wrangler.toml` 要点

```toml
name = "myrzg-comments"
compatibility_date = "2026-10-02"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "myrzg-comments"
database_id = "<wrangler d1 create 输出的 id>"
```

密钥用 `wrangler pages secret put`，**不入库、不进 git**：

- `TURNSTILE_SECRET`
- `IP_HASH_SALT`（限流哈希用盐，换盐等于重置限流，注意副作用）

公开值放前端构建：

- `VITE_TURNSTILE_SITE_KEY`

### 7.3 本地开发（踩过的坑）

**`npm run dev`（Vite）不认识 `functions/` 目录**，Pages Functions 只在 `wrangler pages dev` 里运行。
没有代理时，Vite 把 `/api/*` 当未知路径回退成 `index.html`（实测返回 `200` + `text/html`），
前端 `response.json()` 解析失败，评论面板显示「评论服务返回了非预期内容」——
**看起来像评论坏了，其实只是 API 没在跑**。这个现象在开发时真的发生过一次。

现在的开发方式（**浏览器始终开 5173**，方向是单向的 Vite → wrangler）：

```bash
# 终端 1：前端（HMR）
npm run dev
# 终端 2：评论 API（Functions + 本地 D1）
npm run dev:api
```

- `vite.config.js` 的 `server.proxy` 把 `/api/*` 转发到 `http://127.0.0.1:8788`
  （可用 `MYRZG_API_ORIGIN` 覆盖）。不开 `dev:api` 时代理返回 502，
  前端提示「无法连接评论服务器」，指向解决办法。
- 只改前端、不碰评论时**不需要**开 `dev:api`，其它页面不受影响。
- 本地变量放 `.dev.vars`（`wrangler pages dev` 自动读取，**已在 .gitignore 中**）：
  `ADMIN_TOKEN`、`IP_HASH_SALT`，以及把限流阈值放大的 `RATE_LIMIT_PER_HOUR` / `RATE_LIMIT_PER_DAY`
  （端到端测试的 POST 数量超过默认 5 条/小时，不放大会被 429 挡成假失败；**生产不要设这两项**）。
- **站长认证本地与线上走同一条路径，没有"免验证旁路"**：本地 `.dev.vars` 的
  `ADMIN_TOKEN` 用短令牌 `yxzm` 方便敲，线上换成足够长的随机串。
  这样本地验到的行为就是线上行为，不会出现"本地能进、线上进不去"的错觉。
  访问 `/#/admin/comments` 需在登录框输入令牌；凭据存本机 localStorage，
  点「退出」清凭据并回到登录框。
  > 曾经做过 `ADMIN_AUTH_DISABLED=1` 的本地免验证开关，已按用户要求移除：
  > 它会让"退出"失去效果（服务端永远放行，客户端无法判断已退出），
  > 而且多一套只服务本地的分支，反而掩盖真实行为。
- 本地 D1 是独立副本，**建表要单独跑一次**（`--local`，去掉 `--remote`）：
  ```bash
  npx wrangler d1 execute myrzg-comments --file=./schema.sql --local
  ```
  忘了跑的症状是所有查库请求都 500（`no such table: comments`）。

### 7.4 首次初始化命令

```bash
wrangler d1 create myrzg-comments
wrangler d1 execute myrzg-comments --file=./schema.sql --remote
```

### 7.5 失败模式

Pages 的 **Fail open / closed**（Settings → Runtime）**必须设为 Fail open**：免费额度耗尽时静态站继续可用，只是评论接口报错。设成 Fail closed 会让整个图鉴站变成错误页——对本站是不可接受的降级。

## 八、前端接入

### 8.1 新增文件

| 文件 | 职责 |
| --- | --- |
| `src/utils/commentApi.js` | `fetchComments` / `postComment`；统一走 `fetchWithFallback` 的错误态语义，超时与 4xx/5xx 分开处理 |
| `src/components/CommentsPanel.vue` | 评论面板，**业务组件，不进 `components/ui/index.js` 通用出口**（避免首屏 chunk 变大，与 `FurnitureCard`、`AcquisitionRewards` 同类处理） |

`CommentsPanel.vue` 必须复用现有公共组件与变量，不得新写基础样式：

- 结构：`UiSection`（标题「讨论」）+ `UiEmptyState`（空/加载/错误三态齐全）
- 昵称/邮箱：`UiSearchInput` 或组件库内输入类组件
- 提交：`UiButton`
- 配色：只用 `--paper-*` / `--text-main` / `--text-muted` / `--border-*` 等语义变量，暗色模式零覆盖
- 正文 ≥ 13px、行高 ≥ 1.6；长文本 `word-break` 与换行保留

### 8.2 挂载位置

**一期只在详情弹窗/详情区挂载，列表页不挂**——列表页挂载会让长列表产生大量无效请求，且与虚拟列表的挂载/卸载语义冲突。

建议首批接入：物品详情（`ItemDetailModal`）、怪物详情（`MonsterDetailModal`）、角色详情。

### 8.3 与现有约定的一致性

- **不新增 URL query 参数**：评论归属由当前详情业务 ID 推导，评论面板自身的展开/收起是本地状态。SPEC 第四章「仅已实现的参数做 URL 同步」在此适用——不要发明 `?comment=` 之类的协议。
- 提交成功后**乐观插入**或重新拉取首页，不整页刷新，避免破坏详情滚动位置（[KNOWN_BUGS](KNOWN_BUGS_AND_FIXES.md) 第 3 条）。
- 评论不影响收集标记、备份导入导出等 `appState` 字段。

## 九、实施步骤（建议顺序）

1. `wrangler d1 create` + 建表，本地 `wrangler pages dev` 打通 `GET/POST`
2. 加 `_routes.json`、`_redirects` 放行、`_headers` 的 `/api/*` 段
3. 部署后**先跑第六节的 6.1 / 6.2 两条实测**，通过再接前端
4. EdgeOne 控制台配 `/api/*` 不缓存，再复测
5. 前端 `commentApi.js` + `CommentsPanel.vue`，先接物品详情一个页面
6. 扩展 `cdn:check` 增加 `/api/health` 断言；补单测
7. 写当日 dev-log，按 `{type}: {简述}` 提交（建议拆 `feat(comments)` 与 `docs(comments)` 两次）

## 十、验收清单

| 项 | 判据 |
| --- | --- |
| API 可达且是 JSON | `/api/health` 返回 `application/json`，**不是 `text/html`**（6.1） |
| 不被 CDN 缓存 | 连打两次 `/api/health`，`EO-Cache-Status` 均非 HIT、无 `Age` 增长（6.2） |
| 静态额度不受影响 | `_routes.json` 生效，`/items` 等静态请求不调用 Function |
| 三态齐全 | 评论面板的加载/空/错误态都走 `UiEmptyState` |
| 防刷有效 | 无 Turnstile token 的 POST 返回 403；超频返回 429 |
| 无 XSS | 提交 `<script>alert(1)</script>` 后原文展示，不执行 |
| 邮箱不落库 | 查库确认 `email_hash` 非明文；`SELECT` 结果不含 `ip_hash` |
| 双主题可读 | 亮/暗色下评论正文与时间戳对比度达标 |
| 额度告警 | 免费额度耗尽时（Fail open）静态站仍正常，评论显示错误态而非整站挂掉 |
| 构建通过 | `npm run build`；涉及滚动/弹窗时 `npm run test:ui` |

## 十一、核实状态

### 已确认（2026-10-02）

| # | 事项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | EdgeOne 是否缓存 `/api/*` 的 JSON | **不缓存**（源站带 `immutable` 的线上 JSON 连打三次仍 `MISS`） | 6.2 实测 |
| 2 | EdgeOne 回源地址 | **`myrzg.pages.dev`**（Cloudflare Pages），Functions 可用 | 用户控制台截图，6.3 |
| 3 | 域名/DNS 归属 | 腾讯云 DNSPod，非 Cloudflare | `Resolve-DnsName` 实测，6.3 |

### 仍需确认（上线前）

| # | 事项 | 为什么重要 | 怎么确认 |
| --- | --- | --- | --- |
| 4 | EdgeOne 是否给 `/api/*` 配了「不缓存」规则 | 虽然实测当前 JSON 就不缓存，但这是**默认行为**；将来谁加一条 JSON 类型缓存规则，评论会静默失效 | EdgeOne 控制台 → **规则引擎**（优先级高于站点加速）新建规则：路径前缀 `/api/` → 节点缓存 TTL = 不缓存。**放在规则列表下方**——下方规则覆盖上方 |
| 5 | EdgeOne 免费版对 POST 请求体大小/方法有无限制 | 限制过小会让长评论被拒 | 上线后发一条 1000 字评论实测 |
| 6 | `api.myrzg.yxzmy.top` 的 `28.0.0.116` 是谁建的 | 判断是否存在 `*.myrzg` 泛解析（影响将来是否能用独立子域） | 腾讯云 DNSPod 控制台查看该记录 |
| 7 | EdgeOne 免费版的边缘函数额度与是否支持 KV | 若可用，理论上能省掉 Cloudflare 这一跳（非必需） | **本次未核实到可靠来源**，需查腾讯云官方文档 |

## 十二、上线清单（部署前逐项确认）

| # | 动作 | 说明 |
| --- | --- | --- |
| 1 | 配 `ADMIN_TOKEN` | Cloudflare Pages 项目 → Settings → Environment variables。**未配置时管理接口直接 404**，管理页会提示「当前未开放评论管理」。⚠️ 必须用足够长的随机串；本地开发用的是短令牌 `yxzm`，**不要照搬上线** |
| 2 | 配 `IP_HASH_SALT` | 同上。用于 IP/邮箱哈希加盐。⚠️ 换盐等于重置全部限流计数 |
| 3 | 推送到 `main` | `origin` 是 `github.com/Drloudx/myrzg`，Pages 由 GitHub 自动部署，push 即上线 |
| 4 | **实测 `/api/health` 返回 JSON** | `curl.exe -i https://myrzg.yxzmy.top/api/health`，断言 `Content-Type: application/json` 而**不是 `text/html`**。被 SPA 兜底吃掉就说明 Functions 没生效 |
| 5 | **实测不被缓存** | 连打两次 `/api/health`，断言 `EO-Cache-Status` 均非 HIT、`Age` 不增长 |
| 6 | 加 EdgeOne 规则 | 见上表第 4 项 |
| 7 | 配 Turnstile（可延后） | 未配 `TURNSTILE_SECRET` 时接口跳过人机校验，功能可用。注册 Widget 后补 secret，代码不用改 |
| 8 | 扩展 `npm run cdn:check` | 建议加一组 `/api/health` 断言（`no-store` + `EO-Cache-Status` 非 HIT），让评论的缓存回归进现有验收流程 |

### 关于 `wrangler` 依赖

`wrangler` 已加入 `devDependencies`。Pages 的 CI 构建会安装它（比不加多约数十 MB 与一点时间），
这是官方对配置了 `wrangler.toml` 的 Pages 项目的推荐做法；也便于本机随时用
`npx wrangler d1 execute ... --remote` 直接查改线上数据（管理页面之外的兜底手段）。

## 十三、相关文档

- [SPEC 资源维护](../SPEC.md#六资源维护)：图片与缓存头约定
- [架构 4.7 资源版本与容错](../ARCHITECTURE.md#47-资源版本与容错)：CDN 与版本机制
- [UI 组件库](../UI_COMPONENT_LIBRARY.md)：评论面板必须复用的组件与可读性红线
- [疑难 Bug 与解决方案](../KNOWN_BUGS_AND_FIXES.md)：详情滚动位置恢复，评论提交后不得破坏

