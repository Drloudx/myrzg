# 改名落地文档：`myrzg` → `syzg`

> 状态：**计划，未执行**。2026-10-03 制定。
> 目标：GitHub 仓库名、站点域名从 `myrzg` 改为 `syzg`，**全程不中断线上服务**。
> 约束来源：[SPEC 资源维护](SPEC.md#六资源维护)、[评论后端方案](technical/COMMENTS_BACKEND.md)、
> [交接文档](HANDOFF.md)。
>
> 关联：[账号体系落地方案](technical/ACCOUNT_SYSTEM.md)（**建议先做本迁移再做账号**，
> 否则验证邮件链接、隐私政策页、前端基址里的域名要改两遍）。

## 〇、🔴 执行前必须先知道的三件事

### 1. `myrzg.yxzmy.top` 是**已发布的 Android 端资源基址**，不能直接停

它是 `src/utils/env.js` 的 `CLOUD_URL`，也是线上热更包下载地址（`public/update/hotupdate.json`）。
**验证新域名完全可用之前，旧域名必须保持在线**，否则原生端在线资源整体失效。
→ 所以迁移方式是「**双域名并存**」，不是「切换」。

### 2. 线上 Functions **目前没生效**，评论功能其实还不可用

2026-10-03 实测：

```
GET https://myrzg.yxzmy.top/api/health
→ HTTP 200  Content-Type: text/html; charset=utf-8  (994 字节)
```

`text/html` 说明请求被 SPA 兜底吃掉了（Functions 没部署，或线上 `_redirects` 里那条
`/api/* /api/:splat 200` 放行规则还没上线）。**账号体系依赖一个能用的后端**，
所以这是一个**前置阻塞项**：先让 `/api/health` 返回 JSON，再谈账号。

排查顺序见 [评论后端方案](technical/COMMENTS_BACKEND.md) 第 6 节与第十二节上线清单。

### 3. `yxzmy.top` 的 DNS 在**腾讯云 DNSPod**，不在 Cloudflare

实测证据：

| 记录 | 值 |
| --- | --- |
| `myrzg.yxzmy.top` | CNAME → `myrzg.yxzmy.top.eo.dnse3.com`（EdgeOne）→ A `43.174.246.106` |
| `myrzg.pages.dev` | A `172.66.44.154`（Cloudflare Pages 源站） |
| NS | `peach.dnspod.net` / `henry.dnspod.net` |

结论：**Cloudflare 侧**能做 Pages 项目改名 / 自定义域名 / D1 改名 / 环境变量；
**DNS 记录与 EdgeOne 加速域名必须走腾讯云控制台**（或本机装 `tccli` 并配密钥）。

---

## 一、域名与项目名的对应关系（先看清，避免改错实体）

| 实体 | 现在 | 改成 | 谁负责 | 数据风险 |
| --- | --- | --- | --- | --- |
| GitHub 仓库 | `Drloudx/myrzg` | `Drloudx/syzg` | AI（`gh`） | 无（GitHub 保留旧名重定向） |
| git remote | `.../myrzg.git` | `.../syzg.git` | AI | 无 |
| Cloudflare Pages 项目 | `myrzg` | `syzg` | AI（需 token） | ⚠️ `.pages.dev` 域名会变，**EdgeOne 回源地址必须同步改** |
| 站点自定义域名 | `myrzg.yxzmy.top` | `syzg.yxzmy.top`（**新增**，旧的暂留） | Cloudflare + DNSPod + EdgeOne | 无 |
| EdgeOne 加速域名 | `myrzg.yxzmy.top` | 新增 `syzg.yxzmy.top` | **你**（控制台/tccli） | 无 |
| EdgeOne 回源地址 | `myrzg.pages.dev` | `syzg.pages.dev`（或旧的回源仍可用） | **你** | ⚠️ 改错会让整站 502 |
| D1 数据库 | `myrzg-comments` | `syzg-comments`（可选，纯改名） | AI | **无**（绑定走 `database_id`，改名不动数据） |
| 代码内域名 | 见第五节清单 | — | AI | 无（但 Android 要发一次热更包） |
| `wrangler.toml` | `name = "myrzg"`、库名、注释 | 同步 | AI | 无 |

> **D1 为什么安全**：Pages Functions 通过 `[[d1_databases]] binding = "DB"` 拿库，
> 生效的是 `database_id = 5f0d4c37-107f-4811-bc5e-768f73c51a3a`（不变），
> `database_name` 只是显示名。改名不动 ID、不动数据。
> 但仍建议**与上线动作分开做**，方便二分定位。

---

## 二、执行顺序（阶段化，每阶段都有验证点）

### 阶段 0：准备与备份（不改任何东西）

- [ ] 0.1 **截图备份 Cloudflare Pages → Settings 全页**：Git 关联、自定义域名、环境变量（值可不截）、构建配置。
      仓库改名后 Git 集成可能自动跟随、也可能失联，这是最可能出意外的一步。
- [ ] 0.2 截图备份 EdgeOne 的加速域名配置（源站类型、回源地址、缓存规则）。
- [ ] 0.3 截图备份 DNSPod 的 `myrzg` / `api.myrzg` 记录。
- [ ] 0.4 确认 Cloudflare 凭据就位（**凭据在项目外**，不进仓库）：
      用 `setx` 设在用户级环境变量里，AI 从注册表读
      （`[Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN','User')`）。
      权限清单见本文第四节。
- [ ] 0.5 `gh auth status`、`git status`、`git rev-list --count origin/main..HEAD` 记录基线。
- [ ] 0.6 **先把当前 27 个提交推上去并在线上验收一遍**（见 D-1 说明）。

> **D-1 为什么建议"先推一次再改名"**：本地从未推送过（领先 27 个提交），
> 线上跑的是旧代码。先推 = 站点进入已知状态，同时把「部署链路本身是否正常」这件事先验证掉；
> 之后再改名，如果出问题就能确定是改名引起的，而不是"本地代码本来就没上线"。

### 阶段 1：GitHub 重命名（AI 执行）

```powershell
gh repo rename syzg --repo Drloudx/myrzg --yes
cd E:\Desktop\html\myrzg\vue-myrzg
git remote set-url origin https://github.com/Drloudx/syzg.git
git remote -v
git ls-remote --heads origin   # 验证新地址可达
```

验证点：
- [ ] 1.1 `git ls-remote` 成功（说明 remote 与权限都对）。
- [ ] 1.2 GitHub 旧地址 `github.com/Drloudx/myrzg` 会 301 到新地址（正常）。
- [ ] 1.3 触发一次空提交或直接推，观察 **Cloudflare Pages 是否自动部署**：
      - 自动部署正常 → Git 集成已跟随，继续；
      - **没有自动部署** → 去 Pages → Settings → Builds & deployments 重新连接 `Drloudx/syzg`，
        这一步**你来做**（需要点授权），做完再推一次验证。

### 阶段 2：域名双跑（你执行；AI 可做 Cloudflare 侧那半）

顺序不能颠倒：

- [ ] 2.1 **Cloudflare Pages → Custom domains → 新增 `syzg.yxzmy.top`**（`myrzg.yxzmy.top` **保留**）。
      AI 可用 API 做；也可你在控制台点。等 SSL 证书签发完成。
- [ ] 2.2 **DNSPod → 新增 `syzg` 解析**：CNAME → `syzg.yxzmy.top.eo.dnse3.com`。
      必须先有 2.3 的加速域名才能拿到这个目标，见下。
- [ ] 2.3 **EdgeOne → 新建加速域名 `syzg.yxzmy.top`**：源站类型 `IP/域名`，
      回源填 **`syzg.pages.dev`**（如果阶段 1 已改 Pages 项目名）或先填 `myrzg.pages.dev`（仍有效时）。
      拿到 EdgeOne 给的 CNAME 目标后回填 2.2。
- [ ] 2.4 等解析生效，验证（**这是本阶段唯一真正的验收**）：

```powershell
# 必须是 JSON 而不是 HTML —— 被 SPA 兜底吃掉就说明 /api 放行规则或 Functions 没生效
curl.exe -i https://syzg.yxzmy.top/api/health

# 静态资源与缓存头
curl.exe -sI https://syzg.yxzmy.top/ui/logo.webp
```

- [ ] 2.5 浏览器打开 `https://syzg.yxzmy.top` 全站点一遍（物品/关卡/讨论区发一条评论）。

> ⚠️ 若阶段 0 发现线上 Functions 本来就没生效，**不要在这一步顺手排查账号**——
> 先把 `/api/health` 修成 JSON，再继续。

### 阶段 3：代码与包（AI 执行）

- [ ] 3.1 改域名引用（第六节清单），**`backups/` 里的历史归档不动**。
- [ ] 3.2 `wrangler.toml`：`name`、D1 `database_name`（若改名）、注释里的仓库地址。
- [ ] 3.3 `npm run verify` 必须全绿。
- [ ] 3.4 本地双服务复跑讨论区套件（改域名不该影响，但要证明）：
      `verify-post-scroll` / `verify-no-flicker` / `verify-discussions` / `verify-comment-mounts`。
- [ ] 3.5 **Android**：`CLOUD_URL` 编进代码，所以原生端要拿到新域名必须**发一次热更包**
      （`public/update/hotupdate.json` 的 `downloadUrl` 也要同步）。这一条要单独验收：
      旧包 + 新域名、新包 + 新域名两种组合都要能取到资源。

### 阶段 4：收尾（你确认后 AI 执行）

- [ ] 4.1 新域名稳定运行 ≥ 1~2 天、Android 热更包已铺开之后，
      再移除 `myrzg.yxzmy.top` 的 Pages 自定义域名与 EdgeOne 加速域名。
- [ ] 4.2 决定是否保留旧域名做跳转（建议保留 301 一段时间，避免老分享链接失效）。
- [ ] 4.3 更新权威文档：SPEC、ARCHITECTURE、HANDOFF、COMMENTS_BACKEND，并写当日开发日志。
- [ ] 4.4 D1 改名（若之前没做）：`myrzg-comments` → `syzg-comments`，改完立刻验证
      `/api/comments` 仍能读写（只改显示名，但要有证据）。

---

## 三、回滚点（每个阶段都能撤）

| 阶段 | 回滚动作 | 影响 |
| --- | --- | --- |
| 1 GitHub | `gh repo rename myrzg` | 无（remote 改回即可） |
| 2 域名 | 删掉 `syzg` 的 EdgeOne 加速域名 + DNSPod 记录 | 无（旧域名全程没动） |
| 2 Pages | 移除 `syzg.yxzmy.top` 自定义域名 | 无 |
| 3 代码 | `git revert` | 需重新构建；Android 已发出的热更包无法回收，靠下次热更覆盖 |
| 3 Pages 项目名 | 改回 `myrzg`，**同时把 EdgeOne 回源改回** | 回源与项目名必须一致，否则 502 |

**最关键的一条**：阶段 2 全程旧域名不动，所以任何一步失败，线上用户都不受影响。

---

## 四、我（AI）能做 / 不能做

| 事项 | AI | 说明 |
| --- | --- | --- |
| `gh repo rename`、改 remote、push | ✅ | `gh` 已登录 `Drloudx`，token 含 `repo` |
| Cloudflare Pages 改名 / 加自定义域名 / D1 改名 / 环境变量 | ✅（需 token 或 `wrangler login`） | 走 Cloudflare API，权限清单见第四节 |
| Cloudflare DNS 记录 | ⚠️ 仅当域名托管在 Cloudflare | **本域名在 DNSPod**，用不上 |
| 腾讯云 EdgeOne 加速域名 / DNSPod 解析 | ❌ | 无 `tccli`、无腾讯云凭据；要么你点控制台，要么装 `tccli` 并配密钥 |
| 改代码 / 文档 / 跑 verify | ✅ | |
| 发 Android 热更包、装 APK | ❌ | 需要你的签名与真机 |
| 判断"线上看起来对不对" | ⚠️ 只能命令行探测 | 最终观感要你确认 |

---

## 五、风险清单

| 风险 | 触发条件 | 后果 | 预防 |
| --- | --- | --- | --- |
| **Pages Git 集成失联** | 仓名改后 Cloudflare 仍指向旧名 | 推送不再自动部署，站点停在旧版 | 阶段 0 截图、阶段 1 推一次验证 |
| **EdgeOne 回源与 Pages 项目名不一致** | 只改了一边 | 整站 502/404 | 阶段 1.3 与 2.3 成对执行 |
| **Android 在线资源失效** | 旧域名先停 | 原生端图片/数据取不到 | 双域名并存，阶段 4 才停旧域名 |
| **`_redirects` 的 `/api/*` 放行丢失** | 换项目/换域名时漏配 | 评论与账号接口全被 SPA 兜底吃掉（**现状就是这样**） | 阶段 2.4 必须实测 JSON |
| **缓存里仍是旧图/旧 JSON** | `/ui/*`、`/images/*` 走 EdgeOne 缓存 | 换域名后旧缓存不再命中，反而"变正常" | 换域名天然清缓存；`npm run cdn:check` 复测 |
| **误提交凭据** | 把 token 写进仓库 | 账号被接管 | 凭据放项目外 `_ai-credentials/`，做完吊销 |

---

## 六、代码内 `myrzg` 引用清单（阶段 3 要改的全部位置）

**必须改（影响运行）**

| 文件 | 内容 |
| --- | --- |
| `src/utils/env.js` | `export const CLOUD_URL = 'https://myrzg.yxzmy.top'` |
| `public/update/hotupdate.json` | `downloadUrl` |
| `wrangler.toml` | `name`、`database_name`（若改名）、注释里的 `origin: Drloudx/myrzg` |

**应该改（测试/文档）**

| 文件 | 内容 |
| --- | --- |
| `tests/ui/resilience-overlays.spec.js` | 探活用的 `https://myrzg.yxzmy.top/images/...` |
| `docs/SPEC.md` | `CLOUD_URL` 说明 |
| `docs/ARCHITECTURE.md` | 缓存头例子里的域名 |
| `docs/HANDOFF.md` | 0.2/0.6 的库名、命令 |
| `docs/technical/COMMENTS_BACKEND.md` | 域名、库名、curl 示例、对照表 |
| `docs/KNOWN_BUGS_AND_FIXES.md` | 第 9 节里的报错 URL 示例 |
| `docs/dev-logs/**` | **不改**（历史记录，改了反而失真） |
| `backups/**` | **不改**（归档） |

**不要改**

- `game.taptap.tqpmyrzg`（游戏包名，不是我们的）
- `魔物蛋巢`、`4.24路资源包` 等资源目录名（与品牌无关）
- 任何 `backups/` 下的历史文本

替换命令（阶段 3 执行，先 `--dry-run` 看命中）：

```powershell
cd E:\Desktop\html\myrzg\vue-myrzg
# 只列命中，不写文件
Select-String -Path (Get-ChildItem src,docs,public,tests -Recurse -Include *.js,*.vue,*.json,*.md,*.mjs,*.toml | % FullName) -Pattern 'myrzg' |
  Select-Object Path, LineNumber, Line
```

> ⚠️ 按项目规范：**不能用 PowerShell 的 `Set-Content`/`Out-File` 写含中文的 UTF-8 文件**
> （会乱码或加 BOM）。改文档用编辑工具，改代码用编辑工具，脚本改写走 Node `fs.writeFileSync(..., 'utf8')`。

---

## 七、验收清单（改名完成的定义）

- [ ] `git remote -v` 指向 `Drloudx/syzg`
- [ ] 推送后 Cloudflare Pages **自动**产生新部署
- [ ] `https://syzg.yxzmy.top/` 正常打开，全站主要页面可点
- [ ] `https://syzg.yxzmy.top/api/health` 返回 **JSON**
- [ ] 讨论区能发一条评论并立刻看到
- [ ] `https://myrzg.yxzmy.top/` 仍然可用（并存期）
- [ ] `npm run verify` 全绿
- [ ] Android：新热更包 + 新域名能拉到图片与数据；旧包不崩
- [ ] 权威文档已同步，当日开发日志已写
