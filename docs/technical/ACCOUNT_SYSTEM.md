# 账号体系落地方案（深歌小助手）

> 状态：**方案，未实施**。2026-10-03 制定，取代早期评估稿
> [ACCOUNT_SYSTEM_EVALUATION.md](ACCOUNT_SYSTEM_EVALUATION.md)（那份保留为"为什么不做自己存密码"的证据）。
> 关联：[评论后端方案](COMMENTS_BACKEND.md)（本方案是它的账号层）、
> [改名落地文档](../rename-myrzg-to-syzg.md)（域名与仓库改名，**建议先做**）。

---

## 〇、前置阻塞项（不做完不要开工）

### 0.1 🔴 线上 Functions 目前没生效，评论功能其实还不可用

2026-10-03 实测：

```
GET https://myrzg.yxzmy.top/api/health
→ HTTP 200  Content-Type: text/html; charset=utf-8  (994 字节)
```

`text/html` = 被 SPA 兜底吃掉了。账号体系完全依赖这个后端，**先修好它**：

1. 按 [HANDOFF 〇·0.8](../HANDOFF.md) 的上线清单推送 `main`；
2. 实测 `/api/health` 返回 **JSON**；
3. 复测 `/api/comments` 能读能写（发一条评论看列表）。

### 0.2 🔴 发信通道必须先跑通（账号的关键卡点）

邮箱验证码方案的全部风险集中在"能不能发出去、会不会进垃圾箱"。
**先做 ≤20 行的发信最小验证**（见第五节），这一步不通后面全白做。

### 0.3 域名先定下来

验证邮件里的链接、隐私政策页、前端基址都写域名。建议**先执行
[改名落地文档](../rename-myrzg-to-syzg.md)**，否则这些地方要改两遍。
发信域名的 SPF/DKIM 记录也要跟着域名走。

---

## 一、需求与三条路线

用户原话："邮箱注册 + 改密码 + 能验证身份"。

| | A. 托管认证<br>（Supabase / Clerk / Auth0） | B. 自己实现<br>（Workers + D1 + 密码） | C. 邮箱验证码<br>（无密码） |
| --- | --- | --- | --- |
| 密码哈希 | 对方做（不受 CPU 限制） | **受 Workers 10ms CPU 限制** | 不需要 |
| "忘记密码/改密码" | 现成 | 全部自己写 | **概念不存在**（重发码即可） |
| 开发量 | 约 1~2 天 | 约 4~7 天 | 约 2~3 天 |
| 新增外部依赖 | 1 个（认证服务） | 2 个（邮件 + 防滥用） | 1 个（邮件） |
| 用户数据在哪 | **在对方** | 全在自己库 | 全在自己库 |
| 月费用 | 0 元（额度内） | 0 元 | 0 元 |

### 推荐：**C（邮箱验证码）**

理由（都是已核实的，不是偏好）：

1. **10ms CPU 是硬限**：实测 PBKDF2-SHA256 600k 轮（OWASP 现行推荐）= **104ms**，超限 10 倍；
   100k 轮 = 18.7ms 仍超限；能塞进 10ms 的只有 10k 轮级（2.5ms），**远低于安全推荐值**。
   自己存密码 = 必然做实质安全妥协。
2. C **顺手消灭了"改密码/忘记密码"这个需求本身**（重发验证码即可），开发量最小。
3. 数据留在自己 D1 里，符合"这是一个自己维护的工具站"的取向。

**若坚持要密码** → 走 A（把密码学交给专业服务），我们只存 `auth_provider_id → user` 的映射。
**不要走 B**——除非你明确接受"弱哈希"这个妥协并写进文档。

> 用户选了"先把方案写成落地文档"，所以本文把 **C 作为默认路线**写细，
> A/B 的差异只在第四节标出接口替换点。

---

## 二、C 路线：用户流程

```
注册与登录是同一个流程（无需区分）：

  1. 用户填邮箱 → POST /api/auth/code
  2. 服务端生成 6 位数字码（10 分钟有效），存 D1，通过腾讯云 SES 发出
  3. 用户填码 → POST /api/auth/verify
  4a. 该邮箱首次出现 → 建 users 行（此时才需要昵称/头像）→ 登录成功
  4b. 已存在 → 直接登录成功
  5. 服务端返回会话令牌（session token，30 天），前端存 localStorage
  6. 之后评论带 Authorization: Bearer <token>，服务端解析出 user_id
```

补充约定：

- **未登录仍可评论**（保持现状的"本机身份"），只是没有账号的 `user_id`。
  这是已上线行为，不能因为加账号而回退。
- **昵称与头像**：已登录时用 `users` 表里的值（可在账号弹窗里改，写回服务端）；
  未登录时继续用 localStorage 的本机身份。`utils/identity.js` 改成两层读取。
- **改昵称/头像/邮箱**：邮箱改动要重新验证（发一次码到新邮箱）。
- **退出登录**：删本地 token + 服务端 `sessions` 行作废。

---

## 三、数据模型（D1 迁移脚本）

现有 `comments` 表**不动结构**，只加一列；历史匿名评论 `user_id = NULL` 继续显示。

```sql
-- 迁移 1：用户表
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,      -- 明文邮箱：要发信，且用户要能看见自己账号
  email_hash    TEXT    NOT NULL,             -- SHA-256(email + 盐)，用于去重查询与审计，避免明文入库检索
  nick          TEXT    NOT NULL,
  avatar        TEXT    DEFAULT NULL,         -- 复用评论的头像 ID 体系（avatarCatalog.json）
  status        INTEGER NOT NULL DEFAULT 1,   -- 1 正常 / 2 封禁
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER DEFAULT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- 迁移 2：验证码（一次性，短命）
CREATE TABLE IF NOT EXISTS auth_codes (
  email_hash TEXT    NOT NULL,
  code_hash  TEXT    NOT NULL,      -- 存哈希不存明文，避免日志/备份泄漏即被盗用
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,   -- 试错次数，超过 5 次作废
  created_at INTEGER NOT NULL,
  PRIMARY KEY (email_hash)
);
-- 同一邮箱只保留最新一条：用 UPSERT 覆盖（见接口实现）
-- 说明：不加 created_at 索引——写入按行计费，清理查询极少执行（与 comments 表的取舍一致）

-- 迁移 3：会话
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,   -- SHA-256(token)；明文只在登录响应里给一次
  user_id    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER DEFAULT NULL,
  ua_hash    TEXT    DEFAULT NULL,
  ip_hash    TEXT    DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 迁移 4：评论挂账号（可空，历史数据不变）
ALTER TABLE comments ADD COLUMN user_id INTEGER DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
```

**D1 额度核对**（免费版：读 500 万行/天、写 10 万行/天，索引写入也算行）：

| 动作 | 写行数（估） |
| --- | --- |
| 发一次验证码 | 1（UPSERT auth_codes）+ 1~2（rate_limits） |
| 验证一次登录 | 1（删 auth_codes）+ 1（users upsert 或 last_login 更新）+ 1（sessions） |
| 发一条评论 | 1（comments）+ 1（rate_limits） |

日均几十次登录 ≈ 几百行写入，**远低于 10 万行/天**。

---

## 四、接口契约（与评论接口同一文件风格）

放在 `functions/api/[[path]].js` 同一路由内（沿用现有 `onRequest` 分发）。
**改完必须重启 `npm run dev:api`**——wrangler 不热加载 `functions/`（这条踩过两次）。

| 方法 | 路径 | 请求体 | 成功响应 | 失败文案（面向用户，中文） |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/code` | `{ email }` | `{ ok:true, cooldown:60 }` | 邮箱格式不对 / 发送过于频繁，请 N 分钟后再试 / 邮件服务暂时不可用 |
| POST | `/api/auth/verify` | `{ email, code, nick?, avatar? }` | `{ ok:true, token, user:{ id,email,nick,avatar } }` | 验证码错误或已过期 / 尝试次数过多，请重新获取 |
| GET | `/api/auth/me` | — (Bearer) | `{ ok:true, user:{...} }` | 登录状态已过期，请重新登录 |
| PATCH | `/api/auth/me` | `{ nick?, avatar? }` | `{ ok:true, user:{...} }` | 昵称不能为空 / 昵称最多 N 字 |
| POST | `/api/auth/logout` | — (Bearer) | `{ ok:true }` | —（幂等） |
| POST | `/api/auth/email` | `{ email }` (Bearer) | `{ ok:true }` | 该邮箱已被使用 / 需要先验证新邮箱 |

**硬性契约**（与评论接口保持一致，有单测锁住）：

1. **不泄漏**：任何响应都不得出现 `email_hash`、`token_hash`、`code_hash`、`ip_hash`、`ua_hash`。
2. **限流**：同一邮箱 60 秒内只能发一次码；同一 IP 每小时最多 5 次、每天 20 次（沿用 `rate_limits` 表）。
   阈值可被环境变量覆盖（便于本地端到端测试），**生产不设**。
3. **验证码**：6 位数字、10 分钟有效、错 5 次作废、验证成功后立即删除（一次性）。
4. **会话**：30 天；`/api/auth/me` 每次更新 `last_seen_at`（可选，注意写入计费）。
5. **邮箱变更**要重新走一次 `/api/auth/code`（发到**新**邮箱）。
6. **封禁**（`users.status=2`）时拒绝登录与发评论，文案"该账号已被停用"。

**A 路线（托管认证）的替换点**：只替换"发码 / 验码"两步为托管服务的
`signInWithOtp` + `verifyOtp`，`/api/auth/verify` 拿到对方签发的 JWT 后，
换成在本地 `users` 表里 upsert 一条映射（`auth_provider_id`）并签发**我们自己的 session**。
这样前端与其余接口不变，迁移成本被限制在两个函数里。

---

## 五、发信通道：先做最小验证（**开工前必做**）

### 5.1 为什么不能"用个人邮箱 SMTP 直连"

| 问题 | 说明 |
| --- | --- |
| Workers 封禁 25 端口 | 官方原文：不能建到 25 端口的出站 TCP，只能用 587/465 |
| IP 信誉 | Workers 出口 IP 来自共享池、不公开，收信方易判垃圾 |
| 🔴 国内邮箱异地登录风控 | QQ/163 对新地点登录会拦截，Workers 出口 IP 每次都不同 → 反复被拦甚至锁号 |

### 5.2 推荐：腾讯云 SES（HTTP API 发信，绕开上面三条）

| 项目 | 数值（2026-10-02 核实于官方价格页） |
| --- | --- |
| 免费额度 | 每账号 **1000 封**，**不限有效期、用完为止** |
| 超出后 | **0.0019 元/封** |
| 前置要求 | **必须绑定自己的域名**并配置 SPF/DKIM 解析记录 |

阿里云 DirectMail 备选：免费 2000 封（每天最多免费发 200 封）、2 元/1000 封。

> ⚠️ 两家的免费额度都是**一次性总量**，不是每天/每月刷新。

### 5.3 最小验证步骤（≤20 行，不动现有代码）

- [ ] 5.3.1 腾讯云 SES 控制台创建**发信域名**（建议 `mail.yxzmy.top` 或 `syzg.yxzmy.top`）。
- [ ] 5.3.2 按提示到 **DNSPod** 加 SPF / DKIM /（如需）MX 记录，等验证通过。
- [ ] 5.3.3 建一个发信模板（验证码），拿到 `TemplateId`。
- [ ] 5.3.4 建一个**临时**接口 `GET /api/_mailtest?to=你的邮箱`，只做一件事：调 SES HTTP API 发一封。
- [ ] 5.3.5 验收：
      - 落**收件箱**还是垃圾箱？（决定要不要再调 SPF/DKIM/DMARC）
      - 连发 5 封是否被限流？
      - 到信耗时多久？
- [ ] 5.3.6 **跑通后删掉临时接口**，把结论写进当日开发日志。

> 这一步不过，不要开始写账号代码（发了码收不到 = 用户直接流失）。

---

## 六、前端改造点

| 文件 | 改动 |
| --- | --- |
| `src/utils/identity.js` | 从"纯 localStorage"升级为**两层**：已登录读服务端 `user`，未登录回落本机身份 |
| `src/utils/authApi.js`（新） | `requestCode / verifyCode / fetchMe / updateMe / logout`，与 `commentApi.js` 同风格（错误文案面向用户中文，技术原因写控制台） |
| `src/components/AccountModal.vue` | 加"登录/注册"流程：邮箱 → 验证码 → 设昵称 + 选头像（复用现有 86 个头像清单） |
| `src/components/CommentComposer.vue` | 已登录时用服务端昵称/头像；未登录保持现状（并给一个"登录后可跨设备同步"的入口） |
| `src/utils/commentApi.js` | `postComment` 带上 `Authorization` 头；`COMMENT_PAGE_PREFIX` 不需要动 |
| `functions/api/[[path]].js` | 新增 `/api/auth/*` 分发；`createComment` 解析 Bearer 得到 `user_id` 落库 |
| `src/views/AdminCommentsView.vue` | 列表显示该评论是否来自注册账号（便于处理冒充/滥用） |

**不能回退的行为**（写进验收）：

- 未登录用户仍能评论、仍能自删（浏览器令牌机制不变）；
- 本机身份与账号身份在 UI 上**明确区分**，不假装本机身份是账号；
- 账号弹窗里如实写明"账号只用于跨设备同步昵称与头像、以及标识你的评论"，
  **不要暗示它能防冒充**（昵称仍可被未登录用户取相同名字）。

---

## 七、工作量与里程碑

| 里程碑 | 内容 | 估时 | 验收 |
| --- | --- | --- | --- |
| M0 | 前置：线上 Functions 可用 + 发信最小验证通 | 0.5~1 天 | `/api/health` 是 JSON；测试邮件进收件箱 |
| M1 | D1 迁移 + `users/auth_codes/sessions` 落库 + 接口 + 限流 | 1~1.5 天 | 接口单测（含限流、不泄漏、幂等） |
| M2 | 前端登录/注册流程 + identity 两层改造 | 0.5~1 天 | 浏览器端到端：注册 → 发评论 → 退出 → 再登录 |
| M3 | 评论挂 `user_id` + 管理端显示来源 + 回归 | 0.5 天 | 既有 6 套评论测试全绿 |
| M4 | 文档同步 + 开发日报 + 上线验收 | 0.5 天 | `npm run verify` 全绿、线上实测 |

合计约 **3~4.5 天**（C 路线）。

---

## 八、非技术成本（比开发量更值得先想）

存了用户邮箱就从"纯静态工具站"上台阶到"**持有个人数据的服务**"，性质变化大于工作量：

- [ ] 需要一份**隐私政策**（收集什么、干什么用、怎么删）；
- [ ] 需要能响应**删除请求**（`DELETE /api/auth/me` + 连带处理其评论，或匿名化）；
- [ ] 承担**泄露风险**：`email` 明文入库是必要的（要发信），所以库权限与备份要收紧；
- [ ] 若将来接第三方登录（GitHub/QQ），要额外考虑**授权范围与 token 存储**。

建议：M0 之前先把隐私政策页的**位置**定下来（`/#/privacy`），内容是后话。

---

## 九、待你确认的决策（阻塞项）

1. **路线确认**：C（邮箱验证码，推荐）/ A（托管认证 + 密码）/ B（自己存密码，不推荐）？
2. **发信域名**：用 `yxzmy.top` 的子域（如 `mail.yxzmy.top`）还是别的主域？
   你愿意去 DNSPod 加那几条 SPF/DKIM 记录吗？
3. **账号能做什么**：只同步昵称/头像 + 标识评论，还是也要"评论编辑/删除历史/我的评论列表"？
   （后者会显著增加工作量）
4. **昵称是否要唯一**？（要唯一就得处理抢注与改名，且和"本机身份可重名"产生不一致）
5. **隐私政策页**谁来写/放哪？

---

## 十、明确不做的事（避免范围蔓延）

- **不做**邮箱+密码自实现（10ms CPU 决定的，见第一节）；
- **不做** 邮箱验证以外的实名/手机号；
- **不做** 账号与游戏数据的绑定（本站不连游戏账号，这是 SPEC 的既定边界）；
- **不删** 现有的本机身份与匿名评论；
- **不改** 评论的现有接口契约（只加 `Authorization` 这个**可选**头）。
