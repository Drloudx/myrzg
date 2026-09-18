import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadSkinModelImages } from '../../scripts/parse/skin-models.mjs'

test('skin previews require the exact configured skeleton and skin, not a matching name', () => {
  const skins = JSON.parse(readFileSync(new URL('../../raw/skin.json', import.meta.url), 'utf8'))
  const images = loadSkinModelImages(skins)
  assert.ok(images.hero_005_skin01?.endsWith('/hero_005_skin01.webp'))
  assert.ok(images.hero_036_skin01?.endsWith('/hero_036_skin01.webp'))
  skins.datas.hero_005_skin01.skeletonName = 'Npc_005'
  skins.datas.hero_036_skin01.skinName = 'different'
  assert.deepEqual(loadSkinModelImages(skins), {})
})
