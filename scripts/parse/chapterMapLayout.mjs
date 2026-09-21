/**
 * 章节拼块在世界地图底图（`map_w1_bg.png`，1680×1680）上的位置。
 *
 * 这些坐标不是配置项：`ChapterPanel` 的 prefab 导出里只有 UI 组件、**没有 GameObject/Transform 节点**，
 * 拼块的 localPosition 无从读取。它们由模板匹配**测量**得到——`map_w1_cN_lock.png` 是底图对应区域的
 * 单色版，拿它去底图上做全图搜索即可定位（匹配分是随机基线的 0.4%～7.1%，且把 6 块按测得坐标贴回
 * 底图后边缘逐块吻合，见 `scripts/dev/measure-chapter-map-tiles.mjs`）。
 *
 * 重测：`node scripts/dev/measure-chapter-map-tiles.mjs`
 * 底图换了尺寸或换图时必须重测，不能沿用旧值。
 */

/** 底图原始像素尺寸，拼块坐标即以此为参照。 */
export const CHAPTER_MAP_SIZE = { w: 1680, h: 1680 }

/** 已开放章节的彩色拼块矩形（左上角 x/y + 宽高，底图像素）。 */
export const CHAPTER_TILE_RECTS = {
  c0: { x: 676, y: 59, w: 360, h: 308 },
  c1: { x: 257, y: 232, w: 636, h: 368 },
  c2: { x: 193, y: 442, w: 652, h: 464 },
  c3: { x: 756, y: 140, w: 704, h: 524 },
  c4: { x: 762, y: 544, w: 528, h: 396 },
  c5: { x: 340, y: 799, w: 584, h: 420 }
}

/** 特殊章节（幽夜古堡 / 黏滑溪谷）不在世界地图上，没有拼块。 */
export const CHAPTER_MAP_TILE_PATH = id => `/images/chapters/map_w1_${id}.webp`

/** 章节地区地图底图（点进章节后的那张关卡地图，走 texture/area/bg）。 */
export const CHAPTER_REGION_BG_PATH = id => `/images/chapters/map_w1_${id}_bg.webp`

/**
 * 关卡节点石台：从 `atlas/uiatlas/mappanel/MapPanelAtlas.png` 里切出来。
 *
 * 矩形**直接取图集 sprite 表**（`UI_Atlases/MapPanelAtlas/MapPanelAtlas.json` 的 `mSprites`），
 * 不再用「连通域标记」自己量——源码里 `LevelStageItemUI.stageIcon` 用的就是 sprite 名：
 * 未开放 `map_s_lock`、已开放单难度 `map_s_1st`、已开放多难度 `map_s`，三张都是 128×128。
 * 图集坐标与 PNG 行号**同为左上原点**（实测 map_s 声明 y=1662，PNG 第 1672 行起才有不透明像素）。
 *
 * 旧的 x=402 那一列常量是错的：`AREA_TITLE_RECT` 指到空白区域（重跑导入会切出空图），
 * 核对入口 `scripts/dev/scratch/find-sprite-origin.mjs`。
 *
 * **必须用完整尺寸的那一张**：同目录 `MapPanelAtlas.png` 是 2047×1389 的缩略版，
 * sprite 表里的 y 会越界（`extract: bad extract area`）；完整版是 2048×2048 的
 * `MapPanelAtlas #11770.png`，与 `UI_Atlases/MapPanelAtlas/MapPanelAtlas.png` 逐字节一致。
 */
export const ATLAS_PATH = 'atlas/uiatlas/mappanel/MapPanelAtlas #11770.png'
export const STAGE_PLATFORM_RECT = { x: 401, y: 1662, w: 128, h: 128 }
export const STAGE_PLATFORM_LOCKED_RECT = { x: 401, y: 1791, w: 128, h: 128 }
export const STAGE_PLATFORM_PATH = '/images/chapters/stage_platform.webp'
export const STAGE_PLATFORM_LOCKED_PATH = '/images/chapters/stage_platform_locked.webp'

/** 地区名称牌的边框（同一张图集，深青底 + 金边 + 两端菱形）。 */
export const AREA_TITLE_RECT = { x: 317, y: 1342, w: 164, h: 52 }
export const AREA_TITLE_PATH = '/images/chapters/area_title.webp'

/**
 * 关卡石台顶上那三颗宝石（游戏原图，各自一张 sprite，不是滤镜染出来的）：
 * 中间一颗大的是 `STAGE_CRYSTAL_RECT`（图集 `map_star`），左右两颗小的是
 * `STAGE_CRYSTAL_SMALL_RECT`（图集 `map_reward_star`）。
 * 石台本体只有灰/橙两态，宝石是叠上去的一层；`LevelStageItemUI.levelSpList` 那三张
 * 就是「石台 + 宝石 + 状态」的分层。
 */
export const STAGE_CRYSTAL_RECT = { x: 557, y: 1149, w: 40, h: 40 }
export const STAGE_CRYSTAL_SMALL_RECT = { x: 2009, y: 1946, w: 32, h: 32 }
export const STAGE_CRYSTAL_PATH = '/images/chapters/stage_crystal.webp'
export const STAGE_CRYSTAL_SMALL_PATH = '/images/chapters/stage_crystal_small.webp'

/**
 * 地区名称牌上方的小标签，游戏里写「自由探索」（图集 `map_a_tag`）。
 *
 * 注意：图集里那组 `map_select_out` / `map_select_in` / `map_select_corner`
 * （两层同心橙环 + 四角回纹角标）是 `AreaItemUI.selectGo` 的**选中态**装饰；
 * 本站没有「当前选中地区」这个状态，按用户要求不显示，所以没有导入。
 */
export const AREA_TAG_RECT = { x: 1020, y: 1591, w: 120, h: 24 }
export const AREA_TAG_PATH = '/images/chapters/area_tag.webp'

/** 地区节点立体图（`texture/area/icon/<icon>.png`）与副本入口图（`texture/uipanel/instancepanel/<icon>.png`）。 */
export const AREA_ICON_PATH = icon => `/images/chapters/area/${icon}.webp`
export const INSTANCE_ICON_PATH = icon => `/images/chapters/instance/${icon}.webp`
