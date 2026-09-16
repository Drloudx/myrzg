# 皮肤小人图片导出

`scripts/dev/export-skin-models.mjs` 按角色/皮肤配置的 `skeletonName/skinName` 加载 Spine 4.0，导出 `idle_front` 第 0 帧透明 PNG。它是离线维护工具，普通构建不重新渲染模型。

## 准备与命令

在项目根安装依赖，准备 Google Chrome、`raw/skin.json`，以及项目同级 `4.24路资源包/assets/res/spine/model/npc/` 的完整 skel/atlas/png；角色模式另需 `raw/hero/hero.json`。先启动 Vite 开发服务（不能用生产 preview）：

```powershell
npm run dev -- --host 127.0.0.1 --port 4187 --strictPort
```

另一个终端在项目根执行。已有其他端口时设置 `$env:SKIN_PREVIEW_URL = 'http://127.0.0.1:实际端口'`。

| 目的 | 命令 |
| --- | --- |
| 正式额外皮肤 | `npm run skins:export` |
| 单角色 | `npm run skins:export -- --hero new_hero_002 --output-dir public/test2` |
| 全部正式角色（排除 hide） | `npm run skins:export -- --all-heroes --output-dir public/test2/hero` |

`--hero` 与 `--all-heroes` 互斥，角色模式必须指定 `--output-dir`；角色模式不包含额外时装，也不更新皮肤清单。

## 产物与更新

- 皮肤输出 `public/images/skin-models/{typeId}.png` 和 `manifest.json`；角色输出指定目录下 `{typeId}.png`，全角色模式另写 `hero-models.json`。清单记录来源、模型、动画及哈希，PNG 裁透明边并保留留白。
- 同名输出会被覆盖，不自动清理旧图，也不修改原模型、贴图或 raw。运行前核对目标；中途失败可能已更新部分图片，修复后完整重跑。
- 新皮肤补齐原表与原模型后重新导出，再执行 `npm run data:build`；构建校验清单并写入 `modelImage`，角色页与物品详情共用静态图。发布用完整构建。单角色实验导出不需要更新数据。

## 已知资源边界

`Npc_007` 有两条独立资源链：导出工具读取外部资源包，遇到 510×359 裁切图时仍在内存中补到 512×512（左/右各 1、上 153），记录 `textureAdjustments`；招募读取项目内贴图，其 2026-09-13 修复按 atlas 声明补为 524×524（左 4、上 158）。项目内补图不改变导出工具输入，不能把旧兼容分支当成通用修复算法。

`audit-spine-textures.mjs` 只读检查项目内 atlas/PNG 尺寸。透明补边不能恢复裁掉的像素，完整恢复需从 AssetBundle 重导原 Texture2D；相关备份在项目同级 `backups/spine-texture-canvas/`。Chrome、开发服务、配置皮肤或动画缺失会报错，按失败项核对，不用别的角色模型代替。
