import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

const listCases = [
  { route: 'items', grid: '#itemsGridScroll', card: '[data-item-id]', key: 'data-item-id', max: 160, target: 'item_30026', query: 'itemId' },
  { route: 'tasks', grid: '#tasksGridScroll', card: '[data-task-id]', key: 'data-task-id', max: 32, target: 'fav_hero_066_1', query: 'task' }
]

for (const list of listCases) {
  test(`${list.route} recycles offscreen rows and restores detail return`, async ({ page, isMobile }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/#/${list.route}`)
    const cards = page.locator(`${list.grid} ${list.card}`)
    await expect(cards.first()).toBeVisible()
    const firstKey = await cards.first().getAttribute(list.key)
    const owner = page.locator(isMobile ? list.grid : '.app-container')
    await owner.evaluate(element => element.scrollTo({ top: element.scrollHeight * 0.7, behavior: 'auto' }))
    await expect.poll(() => cards.first().getAttribute(list.key)).not.toBe(firstKey)
    expect(await cards.count()).toBeLessThan(list.max)

    const key = await cards.evaluateAll((elements, keyAttribute) => {
      const filterBottom = document.querySelector('.filter-panel').getBoundingClientRect().bottom
      const candidate = elements.find(element => {
        const rect = element.getBoundingClientRect()
        return rect.top >= filterBottom + 8 && rect.bottom < window.innerHeight - 20
      })
      return candidate?.getAttribute(keyAttribute)
    }, list.key)
    expect(key).toBeTruthy()
    const savedTop = await owner.evaluate(element => element.scrollTop)
    await page.locator(`${list.grid} [${list.key}="${key}"]`).click()
    const modal = page.locator('.ui-modal-overlay:not(.is-teleported)')
    await expect(modal).toBeVisible()
    await modal.locator('.ui-modal-close').click()
    await expect(modal).toBeHidden()
    await expect.poll(async () => Math.abs(await owner.evaluate(element => element.scrollTop) - savedTop)).toBeLessThanOrEqual(8)
    await expect(page.locator(`${list.grid} [${list.key}="${key}"]`)).toBeInViewport()

    await owner.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'auto' }))
    await expect.poll(() => cards.count()).toBeLessThan(list.max)
    await expect(cards.last()).toBeInViewport()
    if (isMobile) {
      const lastBottom = await cards.last().evaluate(element => element.getBoundingClientRect().bottom)
      const navigationTop = await page.locator('.nav-fab-btn').evaluate(element => element.getBoundingClientRect().top)
      expect(lastBottom).toBeLessThan(navigationTop)
    }
    const screenshotPath = testInfo.outputPath(`${list.route}-virtual-end.png`)
    await page.screenshot({ path: screenshotPath })
    await testInfo.attach(`${list.route}-virtual-end`, { path: screenshotPath, contentType: 'image/png' })

    await page.locator('.filter-panel input').fill('unmatched_virtual_list_probe')
    await expect(cards).toHaveCount(0)
    await expect(page.locator(`${list.grid} .ui-empty-state`)).toBeVisible()
    await page.locator('.filter-panel input').fill('')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThan(list.max)
    expect(errors).toEqual([])
  })

  test(`${list.route} shared detail returns to its virtualized target`, async ({ page }) => {
    await page.goto(`/#/${list.route}?${list.query}=${list.target}`)
    const modal = page.locator('.ui-modal-overlay:not(.is-teleported)')
    await expect(modal).toBeVisible()
    await modal.locator('.ui-modal-close').click()
    await expect(modal).toBeHidden()
    await expect(page.locator(`${list.grid} [${list.key}="${list.target}"]`)).toBeInViewport()
    expect(await page.locator(`${list.grid} ${list.card}`).count()).toBeLessThan(list.max)
  })
}

test('does not load the removed full game fonts', async ({ page }) => {
  const fontRequests = []
  page.on('request', request => {
    if (request.resourceType() === 'font') fontRequests.push(request.url())
  })
  await page.goto('/#/items')
  await expect(page.locator('#itemsGridScroll .ui-item-card').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(fontRequests.some(url => /MYR2Sans/i.test(url))).toBe(false)
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)).not.toContain('MYR2Sans')
})

test('loads dungeon covers near the viewport and uses theme-aware active tabs', async ({ page, isMobile }, testInfo) => {
  const coverRequests = new Set()
  page.on('request', request => {
    if (/\/images\/instancepanel\/fb_bg_/.test(request.url())) coverRequests.add(request.url())
  })
  await page.goto('/#/dungeons')
  const covers = page.locator('.dungeon-card__cover-image')
  await expect(covers.first()).toBeVisible()
  await expect.poll(() => covers.first().evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  const coverCount = await covers.count()
  expect(coverCount).toBeGreaterThan(1)
  expect(coverRequests.size).toBeLessThan(coverCount)
  expect(await covers.evaluateAll(images => images.every(image => image.loading === 'lazy' && image.decoding === 'async'))).toBe(true)

  const tab = page.locator('.dungeon-filter-panel .ui-filter-pill.is-active')
  const lightBackground = await tab.evaluate(element => getComputedStyle(element).backgroundColor)
  await page.getByTitle('切换暗色模式').click()
  await expect.poll(() => tab.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground)
  await expect(page.locator('.dungeon-card__heading h2').first()).toHaveCSS('color', 'rgb(255, 245, 225)')
  const owner = page.locator(isMobile ? '#dungeonGrid' : '.app-container')
  await owner.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'auto' }))
  await expect.poll(() => covers.last().evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
  if (isMobile) {
    const lastBottom = await page.locator('.dungeon-card').last().evaluate(element => element.getBoundingClientRect().bottom)
    const navigationTop = await page.locator('.nav-fab-btn').evaluate(element => element.getBoundingClientRect().top)
    expect(lastBottom).toBeLessThanOrEqual(navigationTop)
  }
  const screenshotPath = testInfo.outputPath('dungeon-lazy-covers-dark.png')
  await page.screenshot({ path: screenshotPath })
  await testInfo.attach('dungeon-lazy-covers-dark', { path: screenshotPath, contentType: 'image/png' })
})
