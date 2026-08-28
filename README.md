# 深歌小助手（vue-myrzg）

深渊之歌 Wiki 工具 —— Web + Android（Capacitor）双端。

## 文档

- [docs/SPEC.md](./docs/SPEC.md) —— 前端总规范（路由/设计 Token/组件/页面/数据管线/DRY 红线）
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) —— 项目架构说明（目录/分层/数据流/机制）
- [docs/UI_COMPONENT_LIBRARY.md](./docs/UI_COMPONENT_LIBRARY.md) —— UI 组件库规则（羊皮纸风格 Wiki 设计系统，所有页面必须从这里引用组件）
- [docs/dev-logs/](./docs/dev-logs/) —— 开发记录（同一天、同一功能按批次合并，格式见 dev-logs/README.md）

## 设计主题

基于 `ui模板.html` 的羊皮纸 Wiki 主题：深原木顶栏 + 半透明羊皮纸面板 + 地图铺底。
设计系统入口：`src/assets/theme.css`；组件库：`src/components/ui/`。

## 常用命令

```bash
npm run dev            # 开发
npm run data:build     # 仅数据预处理（遗留表 + 页面级预解析 → public/data/parsed/）
npm run search:update  # 仅更新全局搜索索引（覆盖所有页面）
npm run build          # data:build + 生产构建（一键发布）
npm run verify         # 一键验收：产物齐全 + 无旧脚本残留 + build 通过
npm run preview        # 预览
npx cap sync android   # 同步 Android 原生壳
```

## Git 提交规范

- 提交时机：改完 → 验证通过（`npm run verify`）→ 写 dev-log → 文档同步完成后再 commit。
- 格式：`{type}: {简述}`，type ∈ `feat` / `fix` / `refactor` / `docs` / `data` / `chore`。
- 范围约定：
  - `dist/` 为构建产物：**不手动提交**，按现有策略由发布流程产出（改动大时仅提交 `dist/index.html` 或整包需与热更流程一致）；
  - 数据产物 `public/data/parsed/*.json`（预解析表）入库，保证新环境无需解密源也能 `npm run build`；
  - docs/dev-logs 在功能批次收口时随代码一同提交，连续微调不必逐次新建日志。
- 一次提交只做一个主题；数据 + 代码混合改动可拆 `data:` 与 `feat/fix:` 两次提交。

## 页面路由

/items 物品图鉴 · /heroes 角色图鉴 · /pets 魔物图鉴 · /equip 装备图鉴 · /recipes 菜谱查询 ·
/petseggs 魔物收益 · /achievement 成就查询 · /monsters 怪物图鉴 · /tasks 任务图鉴 ·
/events 事件图鉴 · /exchange 兑换 · /rewards 其他 · /dungeons 副本图鉴
