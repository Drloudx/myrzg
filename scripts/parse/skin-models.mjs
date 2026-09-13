import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Only publish a preview when its manifest matches the skin's actual model. */
export function loadSkinModelImages(skinRes) {
  const manifestUrl = new URL('../../public/images/skin-models/manifest.json', import.meta.url)
  if (!existsSync(manifestUrl)) return {}
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'))
  const images = {}
  for (const skin of Object.values(skinRes?.datas || {})) {
    const preview = manifest[skin.typeId]
    if (!preview || preview.skeletonName !== skin.skeletonName
      || preview.skinName !== (skin.skinName || 'default')) continue
    const expected = `/images/skin-models/${skin.typeId}.png`
    if (preview.image !== expected || !existsSync(fileURLToPath(new URL(`../../public${expected}`, import.meta.url)))) continue
    images[skin.typeId] = expected
  }
  return images
}
