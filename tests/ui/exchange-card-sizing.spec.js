import { expect, test } from '@playwright/test'

test('ordinary exchanges keep uniform frames with single-line titles and balanced icon spacing', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/exchange?cat=shop&sub=keShop')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const shopCard = page.locator('.is-shop').first()
  await expect(shopCard).toBeVisible()
  const measure = card => card.evaluate(el => {
    const frame = el.getBoundingClientRect()
    const relativeBox = selector => {
      const rect = el.querySelector(selector).getBoundingClientRect()
      return { width: rect.width, height: rect.height, top: rect.top - frame.top }
    }
    return {
      width: frame.width, height: frame.height,
      title: relativeBox('h3'),
      icon: relativeBox('.ui-exchange-trade__item--reward img'),
      reward: relativeBox('.ui-exchange-trade__reward-stage'),
      price: relativeBox('.ui-exchange-trade__consume-footer')
    }
  })
  const reference = await measure(shopCard)
  expect(Math.abs(reference.height - reference.width * 4 / 3)).toBeLessThan(1)
  await page.screenshot({ path: testInfo.outputPath('shop-size-reference.png'), fullPage: true })

  await page.getByRole('button', { name: '委托兑换', exact: true }).click()
  const cards = page.locator('.is-compact')
  await expect(cards.first()).toBeVisible()
  const ordinaryReference = await measure(cards.first())
  const bounds = await cards.evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect()
    return { top: r.top, width: r.width, height: r.height }
  }))
  expect(bounds.length).toBeGreaterThan(6)
  const columns = bounds.filter(rect => Math.abs(rect.top - bounds[0].top) < 1).length
  expect(columns).toBe(testInfo.project.name === 'mobile' ? 4 : 6)
  for (const card of await cards.all()) {
    const actual = await measure(card)
    for (const field of ['width', 'height']) {
      expect(Math.abs(actual[field] - reference[field])).toBeLessThan(1)
    }
    for (const part of ['title', 'reward', 'price']) {
      for (const field of ['width', 'height', 'top']) {
        expect(Math.abs(actual[part][field] - ordinaryReference[part][field]), `${part}.${field}`).toBeLessThan(1)
      }
    }
    const title = card.locator('h3')
    await expect(title).toHaveAttribute('title', await title.textContent())
    expect(await title.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    expect(actual.title.top + actual.title.height).toBeLessThan(actual.reward.top)
    expect(actual.reward.top + actual.reward.height).toBeLessThanOrEqual(actual.price.top + 1)
    await expect.poll(() => card.locator('.ui-exchange-trade__item--reward img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  }
  await expect(cards.first().locator('h3')).toHaveText('契约书×1')
  const longTitle = cards.locator('h3').filter({ hasText: '木架盆栽制作图' }).first()
  expect(await longTitle.evaluate(el => el.clientHeight <= parseFloat(getComputedStyle(el).lineHeight) + 1)).toBe(true)
  await expect(cards.locator('.ui-exchange-trade__label')).toHaveCount(0)
  await expect(cards.locator('.ui-exchange-trade__item--reward .ui-exchange-trade__item-count')).toHaveCount(0)
  expect(await cards.first().locator('.ui-exchange-trade__item--reward').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  expect(await page.locator('.exchange-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('ordinary-uniform.png'), fullPage: true })
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('ordinary-dark.png'), fullPage: true })

  await cards.first().locator('.ui-exchange-trade__item--reward').click()
  await expect(page).toHaveURL(/itemId=item_20004/)
  const modal = page.locator('.app-main > .ui-modal-host > .ui-modal-overlay')
  await expect(modal).toBeVisible()
  await modal.locator('.ui-modal-close').click()
  await expect(page).toHaveURL(/cat=entrust/)
  await expect(modal).toBeHidden()

  for (const category of ['种子兑换', '兔子商人', '活跃兑换']) {
    await page.getByRole('button', { name: category, exact: true }).click()
    await expect(cards.first()).toBeVisible()
    await expect(cards.locator('.ui-exchange-trade__meta')).toHaveCount(0)
    for (const card of await cards.all()) {
      const actual = await measure(card)
      expect(Math.abs(actual.width - reference.width)).toBeLessThan(1)
      expect(Math.abs(actual.height - reference.height)).toBeLessThan(1)
      expect(Math.abs(actual.reward.height - ordinaryReference.reward.height)).toBeLessThan(1)
      await expect.poll(() => card.locator('.ui-exchange-trade__item--reward img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    }
    await page.screenshot({ path: testInfo.outputPath(`uniform-${category}.png`), fullPage: true })
  }
  expect(errors).toEqual([])
})

test('refresh rules move out of seed and rabbit cards and preserve share links and filters', async ({ page }, testInfo) => {
  await page.goto('/#/exchange?cat=seed&sub=random&view=rules')
  for (let i = 0; i < 10; i++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
  }
  const panel = page.locator('.exchange-rules')
  const rulesButton = page.getByRole('button', { name: '刷新规则', exact: true })
  await expect(panel).toBeVisible()
  await expect(rulesButton).toHaveClass(/is-active/)
  await expect(page.locator('.ui-exchange-trade')).toHaveCount(0)
  await expect(panel).toContainText('每池 5 选 2')
  await expect(panel).toContainText('金铃草种子')
  await expect(panel).toContainText('完成《往日的阴影》后解锁')
  await expect(panel).toContainText('完成《融合的真相》后解锁')
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('seed-rules-tab.png'), fullPage: true })
  await page.getByRole('button', { name: '固定商品', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.is-compact')).toHaveCount(4)
  await expect(page.locator('.exchange-summary, .ui-exchange-trade__meta')).toHaveCount(0)
  await expect(page).not.toHaveURL(/view=rules/)

  await page.getByRole('button', { name: '兔子商人', exact: true }).click()
  await expect(page.locator('.filter-panel').getByText('子类：', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '全部候选', exact: true })).toHaveCount(1)
  await expect(rulesButton).toHaveCount(1)
  await page.getByRole('button', { name: '白', exact: true }).click()
  await expect(page.locator('.is-compact')).toHaveCount(3)
  await rulesButton.click()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('每次共出现 10 项')
  await expect(panel).toContainText('白色池 3 选 1 · 每次可买 2 个')
  await expect(panel).toContainText('绿色池 19 选 4')
  await expect(page).toHaveURL(/view=rules/)
  await page.reload()
  await expect(panel).toBeVisible()
  await expect(rulesButton).toHaveClass(/is-active/)
  await page.screenshot({ path: testInfo.outputPath('rabbit-rules-tab.png'), fullPage: true })
  await page.getByTitle('切换暗色模式', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('rabbit-rules-dark.png'), fullPage: true })
  await page.getByRole('button', { name: '白', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.is-compact')).toHaveCount(3)
  await page.getByRole('button', { name: '活跃兑换', exact: true }).click()
  await expect(page.locator('.filter-panel').getByText('子类：', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 's1', exact: true })).toHaveCount(0)
  await expect(rulesButton).toHaveCount(0)
  await expect(page.locator('.is-compact')).toHaveCount(16)
})
