import { expect, test } from '@playwright/test'

const dismissGlobalModals = async page => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) return
    await close.click()
    await page.waitForTimeout(150)
  }
}

for (const path of ['/equip', '/items']) {
  test(`${path} equipment detail shows source-backed smithing materials`, async ({ page }) => {
    await page.goto(`/#${path}?itemId=item_421013`)
    await dismissGlobalModals(page)

    const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByText('锻造台打造', { exact: true })).toBeVisible()
    await expect(modal.locator('.smithing-recipe__head').getByText('第 4 阶装备打造', { exact: true })).toBeVisible()
    await expect(modal.getByText('蓝 25%', { exact: true })).toBeVisible()
    await expect(modal.getByText('紫 60%', { exact: true })).toBeVisible()
    await expect(modal.getByText('橙 15%', { exact: true })).toBeVisible()
    await expect(modal.getByText('铜锭', { exact: true })).toBeVisible()
    await expect(modal.getByText('结实的板材', { exact: true })).toBeVisible()

    const section = modal.locator('.smithing-recipe')
    const layout = await section.evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      materialCount: element.querySelectorAll('.ui-reward-card').length
    }))
    expect(layout.materialCount).toBe(4)
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
  })
}

test('smithing material opens its item detail and facility link opens the blacksmith', async ({ page }) => {
  await page.goto('/#/equip?itemId=item_421013')
  await dismissGlobalModals(page)
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await modal.getByText('铜锭', { exact: true }).click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('铜锭')

  await modal.locator('.ui-modal-close').click()
  await expect(modal.getByText('锻造台打造', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: '查看锻造台' }).click()
  await expect(page).toHaveURL(/#\/facilities\?facility=blacksmith&mode=equipment&level=4&item=item_421013$/)
  await expect(page.getByText('魔花头盔', { exact: true }).first()).toBeVisible()
})
