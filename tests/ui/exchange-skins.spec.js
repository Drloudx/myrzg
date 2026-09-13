import { expect, test } from '@playwright/test'

test('all currency shops use game cards with real item quantities, limits and currency icons', async ({ page }, testInfo) => {
  await page.goto('/#/exchange?cat=shop&sub=keShop')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(150)
  }
  const shops = [
    { key: 'keShop', label: '氪金商店', currency: '氪金', count: 10 },
    { key: 'heroJifen', label: '星型徽印', currency: '星型徽印', count: 8 },
    { key: 'petJifen', label: '翼型徽印', currency: '翼型徽印', count: 1 },
    { key: 'ptJifen', label: '回忆结晶', currency: '回忆结晶', count: 2 }
  ]
  for (const shop of shops) {
    await page.getByRole('button', { name: shop.label, exact: true }).click()
    const cards = page.locator('.ui-exchange-trade.is-shop')
    await expect(cards).toHaveCount(shop.count)
    await expect(cards.first().locator('.ui-exchange-trade__consume-footer img')).toHaveAttribute('alt', shop.currency)
    await expect(cards.locator('.ui-exchange-trade__label')).toHaveCount(0)
    await expect(cards.locator('.ui-exchange-trade__item--reward .ui-exchange-trade__item-count')).toHaveCount(0)
    await expect(cards.getByText(/已售罄|剩余/)).toHaveCount(0)
    for (const icon of await cards.locator('.ui-exchange-trade__item--reward img').all()) {
      await expect.poll(() => icon.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    }
    if (shop.key === 'keShop') {
      await expect(cards.locator('h3').filter({ hasText: '银币×2000' })).toHaveCount(1)
      await expect(cards.first().locator('.ui-exchange-trade__limit')).toHaveText('每日 1 次')
      await expect(cards.nth(4).locator('.ui-exchange-trade__limit')).toHaveText('每周 5 次')
    }
    expect(await page.locator('.exchange-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`shop-${shop.key}.png`), fullPage: true })
  }
  await page.getByRole('button', { name: '氪金商店', exact: true }).click()
  await page.locator('.is-shop .ui-exchange-trade__item--reward').first().click()
  await expect(page).toHaveURL(/cat=shop&sub=keShop&itemId=item_20004/)
  const modal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
  await expect(modal).toBeVisible()
  await modal.locator('.ui-modal-close').click()
  await expect(modal).toBeHidden()
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('shop-dark.png'), fullPage: true })
})

test('shop costumes show original portraits and prices, preserve legacy links and item navigation', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/exchange?cat=fashion&sub=fuZhuang')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(150)
  }
  await expect(page).toHaveURL(/cat=shop&sub=fuZhuang/)
  const cards = page.locator('.ui-exchange-trade.is-skin')
  await expect(cards).toHaveCount(2)
  await expect(page.getByRole('button', { name: '皮肤购买', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '商店积分', exact: true })).toHaveClass(/is-active/)
  await expect(cards.locator('h3')).toHaveText(['茜塔', '贝尔卡'])
  await expect(cards.locator('.ui-exchange-trade__skin-name')).toHaveText(['难得的休息日', '学院的优等生'])
  await expect(cards.locator('.ui-exchange-trade__consume-footer')).toHaveText(['100', '100'])
  await expect(cards.locator('.ui-exchange-trade__item--reward .ui-exchange-trade__item-count')).toHaveText(['1', '1'])
  await expect(cards.getByText('已拥有')).toHaveCount(0)
  for (const portrait of await cards.locator('.ui-exchange-trade__skin-visual img').all()) {
    await expect.poll(() => portrait.evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  expect(await page.locator('.exchange-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('costumes-light.png'), fullPage: true })
  await page.locator('.exchange-list--skin').screenshot({ path: testInfo.outputPath('costumes-cards.png') })
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('costumes-dark.png'), fullPage: true })
  await cards.first().getByRole('button', { name: '查看茜塔时装：难得的休息日' }).click()
  await expect(page).toHaveURL(/cat=shop&sub=fuZhuang&itemId=skin005a/)
  const modal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
  await expect(modal).toBeVisible()
  await modal.locator('.ui-modal-close').click()
  await expect(modal).toBeHidden()
  await expect(page).toHaveURL(/cat=shop&sub=fuZhuang$/)
  await page.getByRole('button', { name: '氪金商店', exact: true }).click()
  await expect(cards).toHaveCount(0)
  await expect(page.locator('.ui-exchange-trade').first()).toBeVisible()
  expect(errors).toEqual([])
})
