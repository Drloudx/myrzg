/** Export static skin previews from original Spine packages; see docs/SKIN_MODEL_EXPORT.md. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const baseURL = process.env.SKIN_PREVIEW_URL || 'http://127.0.0.1:4187'
const sourceRoot = path.resolve(root, '../4.24路资源包/assets/res/spine/model/npc')
const { values: options } = parseArgs({ options: {
  hero: { type: 'string' },
  'all-heroes': { type: 'boolean', default: false },
  'output-dir': { type: 'string' }
} })
if (options.hero && options['all-heroes']) throw new Error('--hero and --all-heroes cannot be combined')
const heroMode = Boolean(options.hero || options['all-heroes'])
if (heroMode && !options['output-dir']) throw new Error('Hero export requires --output-dir')
if (!heroMode && options['output-dir']) throw new Error('--output-dir requires --hero or --all-heroes')
const outputDir = options['output-dir'] ? path.resolve(root, options['output-dir']) : path.join(root, 'public/images/skin-models')
let skins = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'raw/skin.json'), 'utf8')).datas)
  .filter(skin => skin.show && skin.heroTypeId && skin.skeletonName)
if (heroMode) {
  const heroes = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'raw/hero/hero.json'), 'utf8')).datas)
  const selected = options['all-heroes'] ? heroes.filter(hero => hero.hide !== true)
    : heroes.filter(hero => hero.typeId === options.hero)
  if (!selected.length) throw new Error(`Hero not found: ${options.hero}`)
  skins = selected.map(hero => {
    if (!hero.viewData?.skeletonName) throw new Error(`Hero model not found: ${hero.typeId}`)
    return { ...hero.viewData, typeId: hero.typeId, name: hero.name }
  })
}
const manifest = {}
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const skin of skins) {
    const name = skin.skeletonName
    if (!/^[\w-]+$/.test(name) || !/^[\w-]+$/.test(skin.typeId)) throw new Error('Invalid model identifier')
    const dir = path.join(sourceRoot, name.toLowerCase())
    const page = await browser.newPage({ viewport: { width: 640, height: 768 } })
    const inputs = new Map()
    const textureAdjustments = []
    await page.route('**/__skin-source/*', async route => {
      const file = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
      if (!/^[\w.-]+$/.test(file)) return route.abort()
      let bytes = fs.readFileSync(path.join(dir, file))
      inputs.set(file, crypto.createHash('sha256').update(bytes).digest('hex'))
      // The clean Npc_007 Sprite export is cropped from its 512x512 texture.
      // Restore its original position in memory; never edit the source PNG.
      if (name === 'Npc_007' && file === 'Npc_007.png') {
        const metadata = await sharp(bytes).metadata()
        if (metadata.width === 510 && metadata.height === 359) {
          const padding = { left: 1, right: 1, top: 153, bottom: 0 }
          bytes = await sharp(bytes).extend({ ...padding, background: '#00000000' }).png().toBuffer()
          textureAdjustments.push({ file, operation: 'restore-cropped-sprite-canvas', ...padding })
        }
      }
      await route.fulfill({ body: bytes, contentType: file.endsWith('.png') ? 'image/png' : 'application/octet-stream' })
    })
    await page.route(`${baseURL}/__skin-preview`, route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><canvas width="640" height="768"></canvas>'
    }))
    await page.goto(`${baseURL}/__skin-preview`)
    const result = await page.evaluate(async ({ name, skinName }) => {
      const spine = await import('/node_modules/@esotericsoftware/spine-webgl/dist/index.js')
      const canvas = document.querySelector('canvas')
      const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true })
      if (!gl) throw new Error('WebGL unavailable')
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      const renderer = new spine.SceneRenderer(canvas, gl)
      const textures = []
      try {
        const atlas = new spine.TextureAtlas(await (await fetch(`/__skin-source/${name}.atlas`)).text())
        for (const atlasPage of atlas.pages) {
          const image = new Image()
          image.src = `/__skin-source/${atlasPage.name}`
          await image.decode()
          const texture = new spine.GLTexture(gl, image)
          textures.push(texture)
          atlasPage.setTexture(texture)
        }
        const binary = new Uint8Array(await (await fetch(`/__skin-source/${name}.skel`)).arrayBuffer())
        const data = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(binary)
        const skeleton = new spine.Skeleton(data)
        if (!data.findSkin(skinName)) throw new Error(`Missing configured skin: ${skinName}`)
        skeleton.setSkinByName(skinName)
        skeleton.setToSetupPose()
        const animation = 'idle_front'
        if (!data.findAnimation(animation)) throw new Error(`Missing front idle: ${data.animations.map(a => a.name).join(',')}`)
        const state = new spine.AnimationState(new spine.AnimationStateData(data))
        state.setAnimation(0, animation, true)
        state.apply(skeleton)
        skeleton.updateWorldTransform()
        const offset = new spine.Vector2(), size = new spine.Vector2()
        skeleton.getBounds(offset, size, [])
        const aspect = canvas.width / canvas.height
        const height = Math.max(size.y, size.x / aspect) * 1.12
        renderer.camera.viewportWidth = height * aspect
        renderer.camera.viewportHeight = height
        renderer.camera.position.set(offset.x + size.x / 2, offset.y + size.y / 2, 0)
        renderer.camera.update()
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        renderer.begin()
        renderer.drawSkeleton(skeleton, true)
        renderer.end()
        return { image: canvas.toDataURL('image/png'), animation, version: data.version }
      } finally {
        textures.forEach(texture => texture.dispose())
        renderer.dispose()
      }
    }, { name, skinName: skin.skinName || 'default' })
    fs.mkdirSync(outputDir, { recursive: true })
    const image = Buffer.from(result.image.split(',')[1], 'base64')
    // New rendered assets only: lossless trim, with transparent breathing room.
    const png = await sharp(image).trim({ threshold: 1 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#00000000' }).png().toBuffer()
    fs.writeFileSync(path.join(outputDir, `${skin.typeId}.png`), png)
    manifest[skin.typeId] = {
      ...(heroMode ? { name: skin.name } : {}),
      ...(textureAdjustments.length ? { textureAdjustments } : {}),
      skeletonName: name, skinName: skin.skinName || 'default', animation: result.animation, frameTime: 0,
      spineVersion: result.version, image: heroMode ? `${skin.typeId}.png` : `/images/skin-models/${skin.typeId}.png`,
      source: path.relative(path.resolve(root, '..'), dir).replaceAll('\\', '/'),
      inputHashes: Object.fromEntries(inputs), sha256: crypto.createHash('sha256').update(png).digest('hex')
    }
    console.log(`${skin.typeId}: ${name}/${skin.skinName}, ${result.animation}, ${(png.length / 1024).toFixed(0)} KB`)
    await page.close()
  }
  if (!heroMode || options['all-heroes']) {
    const manifestName = heroMode ? 'hero-models.json' : 'manifest.json'
    fs.writeFileSync(path.join(outputDir, manifestName), JSON.stringify(manifest, null, 2) + '\n')
  }
} finally {
  await browser.close()
}
