import { expect, test } from '@playwright/test'

async function openItem(page, path, id) {
  await page.goto(`/#${path}?itemId=${id}`)
  for (let attempt = 0; attempt < 10; attempt++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(150)
  }
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await expect(modal).toBeVisible()
  return modal
}

for (const path of ['/items', '/equip']) {
  test(`${path} consumes the shared selection rules and follows nested reward links`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const modal = await openItem(page, path, 'item_26006')
    const groups = modal.locator('.acquisition-group')
    await expect(groups).toHaveCount(1)
    await expect(groups.locator('.ui-reward-card')).toHaveCount(4)
    await expect(groups.getByText('自选获得', { exact: true })).toHaveCount(4)
    await expect(groups.getByText(/必定获得/)).toHaveCount(0)
    await groups.scrollIntoViewIfNeeded()
    const layout = await groups.evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }))
    expect(layout.content).toBeLessThanOrEqual(layout.width + 1)
    await expect.poll(() => groups.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('selection.png') })
    const targetName = await groups.locator('.ui-reward-card__name').first().innerText()
    await groups.locator('.ui-reward-card').first().click()
    await expect(modal.locator('.ui-modal-title')).toHaveText(targetName)
    await modal.locator('.ui-modal-close').click()
    await expect(modal.locator('.ui-modal-title')).toHaveText('元素碎片自选包')
    expect(errors).toEqual([])
  })
}

test('appraisal shows real currency cost and probabilities without a separate page', async ({ page }, testInfo) => {
  const modal = await openItem(page, '/items', 'item_19304')
  const cost = modal.locator('.acquisition-costs')
  await expect(cost.getByText('银币', { exact: true })).toBeVisible()
  await expect(cost.getByText('×100', { exact: true })).toBeVisible()
  const groups = modal.locator('.acquisition-group')
  await expect(groups.locator('.ui-reward-card')).toHaveCount(12)
  await expect(groups.getByText('单次抽取 23.50%', { exact: true })).toHaveCount(4)
  await cost.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('appraisal.png') })
  const layout = await modal.evaluate(element => ({ width: element.clientWidth, content: element.scrollWidth }))
  expect(layout.content).toBeLessThanOrEqual(layout.width + 1)
})

test('locked chest exposes the required key and nested detail returns to the chest', async ({ page }) => {
  const modal = await openItem(page, '/items', 'item_20001')
  const cost = modal.locator('.acquisition-costs')
  await expect(cost.getByText('铜钥匙', { exact: true })).toBeVisible()
  await cost.getByText('铜钥匙', { exact: true }).click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('铜钥匙')
  await modal.locator('.ui-modal-close').click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('上锁的铜宝箱')
})
