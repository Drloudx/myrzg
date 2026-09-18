import { expect, test } from '@playwright/test'

test('handbook and special summon images load from their shared resources', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const cases = [
    ['055', '/images/PicHandBookPanel_Atlas/colect_mon_055.webp'],
    ['Mon055StoneMon', '/images/model-previews/obj_mon055.webp'],
    ['069_jianci', '/images/model-previews/obj_mon069.webp'],
    ['003SummonMon', '/images/Common_ItemIcon/item_10043.webp'],
    ['013_baby', '/images/PicHandBookPanel_Atlas/colect_mon_013_s.webp']
  ]
  for (const [id, file] of cases) {
    await page.goto(`/#/monsters?id=${id}`)
    for (let i = 0; i < 10; i++) {
      const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
      if (!await close.count()) break
      await close.click()
    }
    const portrait = page.locator('.portrait-img')
    await expect(portrait).toBeVisible()
    await expect(portrait).toHaveAttribute('src', new RegExp(file.replaceAll('.', '\\.')))
    await expect.poll(() => portrait.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    if (['Mon055StoneMon', '069_jianci', '003SummonMon'].includes(id)) {
      await page.locator('.portrait-section').screenshot({ path: testInfo.outputPath(`${id}.png`) })
    }
  }
  expect(errors).toEqual([])
})
