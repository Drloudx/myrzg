# 深歌小助手（vue-myrzg）

深渊之歌 Wiki 工具 —— Web + Android（Capacitor）双端。

## 文档

- [docs/SPEC.md](./docs/SPEC.md) —— 前端总规范（路由/设计 Token/组件/页面/数据管线/DRY 红线）
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) —— 项目架构说明（目录/分层/数据流/机制）
- [docs/UI_COMPONENT_LIBRARY.md](./docs/UI_COMPONENT_LIBRARY.md) —— UI 组件库规则（羊皮纸风格 Wiki 设计系统，所有页面必须从这里引用组件）
- [docs/dev-logs/README.md](./docs/dev-logs/README.md) —— 开发日志规范（每天一份 `YYYY-MM/YYYY-MM-DD.md`，按模块汇总）
- [docs/README.md](./docs/README.md) —— 文档导航（专题、技术、审计资料）

## 设计主题

基于 `ui模板.html` 的羊皮纸 Wiki 主题：深原木顶栏 + 半透明羊皮纸面板 + 地图铺底。
设计系统入口：`src/assets/theme.css`；组件库：`src/components/ui/`。

## 常用命令

```bash
npm run dev            # 开发
npm run data:build     # 仅数据预处理（遗留表 + 页面级预解析 → public/data/parsed/）
npm run search:update  # 仅更新全局搜索索引（覆盖所有页面）
npm run build          # data:build + 生产构建（生成产物，不自动发布）
npm run verify         # 一键验收：产物齐全 + 无旧脚本残留 + build 通过
npm run preview        # 预览
npx cap sync android   # 同步 Android 原生壳
```

## 构建前置与原表维护

- 完整构建需要本机 `raw/` 原表与项目派生输入，`raw/` 不入库。已有 `public/data/parsed/` 不能替代 `npm run build` 的原表依赖。
- 游戏配置默认位于项目同级 `Config_decrypted`，剧情在 `GAoNano_decrypted`，游戏源码在 `源码`；可通过 `MYRZG_CONFIG_DIR`、`MYRZG_DIALOG_DIR`、`MYRZG_SOURCE_DIR` 或维护脚本参数指定。
- `node scripts/dev/sync-raw.mjs` 只预览；加 `--apply` 补缺，加 `--apply --replace` 才更新已有完整原表及 `hero/`、`pet/`、`equip/`、`task/` 兼容别名。先检查预览；副本提取表和 `monsterTowerUsage.json` 等派生输入不会被覆盖，新环境需从可信备份补齐或按对应维护流程生成。
- 源目录含无效 JSON 时，预览会列出全部问题；实际同步默认拒绝，只有人工确认这些表可排除后才加 `--skip-invalid`。已有原表与源版本不同的组不会仅补一个新版本别名，需先复核 `--replace` 计划。
- `mon.json` 使用完整游戏原表，`cirtDam` 字段及头像引用在预处理内存中归一化，不改写原文件；`battle.json`、`room.json` 同样不能被任务专用裁剪表覆盖。
- `node scripts/dev/check-task-data.mjs` 默认只读检查；加 `--apply` 才补缺原表、剧情及写入索引/报告。
- Web 与 Android 构建均保留运行时数据和图片。旧 `clean_dist.bat` 的删除策略已停用，禁止删除 `dist/data`、`dist/images` 后再同步 Android。

## Git 提交规范

- 提交时机：改完 → 验证通过（`npm run verify`）→ 写 dev-log → 文档同步完成后再 commit。
- 格式：`{type}: {简述}`，type ∈ `feat` / `fix` / `refactor` / `docs` / `data` / `chore`。
- 范围约定：
  - `dist/` 为构建产物：不手动提交，由完整构建与发布流程产出；不得只更新 `index.html` 而遗漏它引用的资源；
  - 数据产物 `public/data/parsed/*.json`（预解析表）入库，供页面运行；重新预处理或完整构建仍需本机原表及派生输入；
  - `docs/dev-logs/YYYY-MM/YYYY-MM-DD.md` 在阶段收口时随代码提交，同一天的不同模块也合并到同一日报。
- 一次提交只做一个主题；数据 + 代码混合改动可拆 `data:` 与 `feat/fix:` 两次提交。

## 页面路由

/items 物品图鉴 · /furniture 家具图鉴 · /facilities 设施功能 · /heroes 角色图鉴 · /pets 魔物图鉴 · /equip 装备图鉴 · /recipes 菜谱查询 ·
/petseggs 魔物收益 · /achievement 成就查询 · /monsters 怪物图鉴 · /tasks 任务图鉴 ·
/events 事件图鉴 · /exchange 兑换 · /rewards 其他 · /dungeons 副本图鉴
