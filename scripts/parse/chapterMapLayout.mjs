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
