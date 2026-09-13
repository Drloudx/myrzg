import { expect, test } from '@playwright/test'

for (const skin of [
  { hero: 'hero_005', item: 'skin005a', name: '难得的休息日' },
  { hero: 'hero_036', item: 'skin036a', name: '学院的优等生' }
]) {
  test(`${skin.hero} skin model and portrait are paired in hero and item details`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/#/heroes?id=${skin.hero}&tab=skins`)
    for (let i = 0; i < 10; i++) {
      const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
      if (!await close.count()) break
      await close.click()
      await page.waitForTimeout(150)
    }
    const panel = page.locator('.skin-entry.has-model')
    await expect(panel).toBeVisible()
    const model = panel.getByAltText(`${skin.name}小人模型`)
    await expect.poll(() => model.evaluate(img => img.naturalWidth)).toBeGreaterThan(100)
    const name = await panel.locator('.skin-heading h4').boundingBox()
    const source = await panel.locator('.skin-heading .ui-tag').boundingBox()
    expect(source.y).toBeGreaterThanOrEqual(name.y + name.height)
    const portraitBox = await panel.locator('.skin-portrait-wrap').boundingBox()
    const modelBox = await panel.locator('.skin-model-wrap').boundingBox()
    expect(modelBox.x).toBeGreaterThanOrEqual(portraitBox.x + portraitBox.width - 1)
    await panel.screenshot({ path: testInfo.outputPath('hero-skin-model.png') })

    await page.goto(`/#/items?itemId=${skin.item}`)
    const preview = page.locator('.skin-portrait-preview.has-model')
    await expect(preview).toBeVisible()
    await expect.poll(() => preview.getByAltText(`${skin.name}小人模型`).evaluate(img => img.naturalWidth)).toBeGreaterThan(100)
    const panes = await preview.locator('.skin-preview-pane').evaluateAll(elements => elements.map(el => ({
      width: el.getBoundingClientRect().width, x: el.getBoundingClientRect().x
    })))
    expect(Math.abs(panes[0].width - panes[1].width)).toBeLessThan(1)
    expect(panes[1].x).toBeGreaterThan(panes[0].x)
    expect(await preview.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await preview.screenshot({ path: testInfo.outputPath('item-skin-model.png') })
    expect(errors).toEqual([])
  })
}
