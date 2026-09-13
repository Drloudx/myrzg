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

拉碧丝的 `Npc_007.png` 是裁切后的 510×359 Sprite。工具仅在导出内存中补回 512×512 画布（左 1、右 1、上 153），恢复与 atlas 对应的位置，避免部件错位；原文件不修改，处理记录写入角色清单的 `textureAdjustments`。

> 2026-09-13 补充：`Npc_007` 的贴图**已在项目里按图集画布补回 524×524**（偏移取图集区域包围盒 左 4 / 上 158，`Npc_007.atlas` 声明 `size:524,524`），因此招募揭晓的 Q 版小人不再错乱、`BROKEN_CHIBI_SKELETONS` 名单清空（原图备份在项目外 `backups/spine-texture-canvas/`）。同类问题（页面贴图被裁、尺寸与 `.atlas` 的 `size` 不一致导致 UV 偏移）用只读审计 `node scripts/dev/audit-spine-textures.mjs` 检查；彻底修法是从 AssetBundle 用 UnityPy 重导原始 Texture2D。

- 图片：`public/images/skin-models/{皮肤typeId}.png`，透明背景，自动裁掉空白并保留 12px 边距。
- 清单：同目录 `manifest.json`，记录模型、动画、来源和文件哈希，供数据构建校验。
- 同名导出图片和清单会被重写；原版模型、贴图和 `raw` 表不会被修改。旧图片不会自动清理。
- 新皮肤的正式配置和原模型资源补齐后，重新运行上述导出与构建命令即可；脚本自动遍历符合条件的皮肤，不需要手动增加图片映射。
- 角色页与物品详情共用静态图，页面不运行模型动画；普通构建不重新导出图片。

找不到 Chrome 时先安装 Google Chrome；连接失败时确认 Vite 地址与 `SKIN_PREVIEW_URL` 一致；模型文件、配置皮肤或 `idle_front` 动画缺失时脚本会报错，需要检查原资源和配置。导出失败可能已更新前面的图片，应修正问题后完整重跑，再构建数据。
