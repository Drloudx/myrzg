import { getImageUrl } from './env'

/**
 * 抽卡揭晓面板静态素材列表（UI 框、台座、徽标、文字标签、星星、底板等）
 * 提前预热到浏览器缓存，避免切换到揭晓或换人时发生网络延迟与闪烁
 */
const STATIC_REVEAL_IMAGES = [
  // 背景与基本 UI
  '/images/uipanel/herogachashowpanel/bg.png',
  '/images/gacha/gacha_star_L.png',
  '/images/gacha/gacha_star_M.png',
  '/images/HeroGachaShowPanel_Atlas/gacha_new.png',
  '/images/HeroGachaShowPanel_Atlas/gacha_text.png',
  '/images/HeroGachaShowPanel_Atlas/gacha_btn_skip.png',
  '/images/HeroGachaShowPanel_Atlas/gacha_btn_skip_press.png',

  // 舞台与菱形背框
  '/images/HeroGachaShowPanel_Atlas/spGachaDitai01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBlock01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBox01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBox02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaColor01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaLine01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTxtRing01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaStar02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaAngle01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBlock04.png',
  '/images/HeroGachaShowPanel_Atlas/chara_bg_center_only.png',

  // 名牌与角标底座
  '/images/HeroGachaShowPanel_Atlas/spGachaNameDown01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBlock03.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaBlock05.png',

  // Step 1 职业图腾
  '/images/HeroGachaShowPanel_Atlas/spGachaClass01Black.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaClass02Black.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaClass03Black.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaClass04Black.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaClass05Black.png',
  '/images/gacha/chara_bg_class_6.png',

  // 职业徽标（台座右上）
  '/images/gacha/gacha_class1.png',
  '/images/gacha/gacha_class2.png',
  '/images/gacha/gacha_class3.png',
  '/images/gacha/gacha_class4.png',
  '/images/gacha/gacha_class5.png',
  '/images/gacha/gacha_class6.png',

  // 职业名签
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass03.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass04.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass05.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagClass06.png',

  // 四属性元素标签 (01=文字, 02=底图, 03=右上角标)
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWater01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWater02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWater03.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagFire01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagFire02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagFire03.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWind01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWind02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagWind03.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagGround01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagGround02.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaTagGround03.png',

  // 属性四向菱形标
  '/images/HeroGachaShowPanel_Atlas/spGachaWater01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaFire01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaWind01.png',
  '/images/HeroGachaShowPanel_Atlas/spGachaGround01.png'
]

const preloadedCache = new Set()

/**
 * 单图预加载 Promise
 */
function preloadSingleImage(src) {
  if (!src || preloadedCache.has(src)) return Promise.resolve()
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      preloadedCache.add(src)
      resolve()
    }
    img.onerror = () => {
      preloadedCache.add(src)
      resolve()
    }
    img.src = src
  })
}

/**
 * 预加载揭晓面板所有静态素材
 */
export function preloadGachaRevealStaticAssets() {
  return Promise.all(STATIC_REVEAL_IMAGES.map(path => preloadSingleImage(getImageUrl(path))))
}

/**
 * 抽卡结果生成后立即预热对应角色的立绘和卡面（在翻卡阶段还在进行时就在后台下载完成）
 */
export function preloadGachaResultAssets(items = []) {
  if (!Array.isArray(items) || !items.length) return Promise.resolve()
  const urls = []
  for (const item of items) {
    if (item.portrait) urls.push(getImageUrl(item.portrait))
    if (item.card) urls.push(getImageUrl(item.card))
  }
  return Promise.all(urls.map(preloadSingleImage))
}
