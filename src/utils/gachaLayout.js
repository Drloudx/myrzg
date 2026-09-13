/**
 * 卡池页面坐标系（游戏原始设计分辨率）。
 *
 * 来源：`game.taptap.tqpmyrzg/assets/Android/AssetBundle/prefab/uiprefab/heropoolpanel`
 * 的 NGUI prefab。原始 Transform 坐标以画面中心为原点，参考分辨率由这些证据确定：
 *   - `background/white` 平铺贴图 1534×750（同 UIPanel 的 `mask`/`fb_page_black` 高 750）
 *   - `TweenParent/mask` 位于 x=-767（左边界）、`TopRight/Back` 位于 (587,335)（右上角）
 *   - `periodType` x=461、`Buttons` 锚点 pixelOffset (-267,35)（右下角）
 * 半宽 767 = 1534/2、半高 375 = 750/2，因此设计画布为 1534×750。
 *
 * 页面按 min(容器宽/1534, 容器高/750) 等比缩放后居中，保证与游戏构图一致且不裁切。
 */

export const GACHA_DESIGN_WIDTH = 1534
export const GACHA_DESIGN_HEIGHT = 750

/** 设计坐标 → CSS 定位（canvas 已固定为 1534×750 且居中，故可直接用百分比 + 偏移）。 */
export function gachaPos(x = 0, y = 0) {
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% - ${y}px)`
  }
}

/** 等比适配缩放比（宽高都要放得下，contain）；尺寸为 0 时回退 1，避免 0 尺寸容器把画布压成 0。 */
export function gachaFitScale(width, height) {
  if (!width || !height) return 1
  return Math.min(width / GACHA_DESIGN_WIDTH, height / GACHA_DESIGN_HEIGHT)
}

/**
 * 仅按高度适配的缩放比。
 * 游戏（NGUI UIRoot 按高度缩放）实际是这一个；网页为了不裁切左右内容改用 contain，
 * 两者差值可用于判断「宽度不够（竖屏）」，据此给出横屏提示。
 */
export function gachaFitScaleByHeight(height) {
  if (!height) return 0
  return height / GACHA_DESIGN_HEIGHT
}
