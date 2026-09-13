import { expect, test } from '@playwright/test'

const dismissGlobalModals = async page => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) return
    await close.click()
    await page.waitForTimeout(100)
  }
}

test('all facility tabs share the search-first header and sticky clipping contract', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/facilities')
  await dismissGlobalModals(page)
  await expect(page.locator('.facility-recipe').first()).toBeVisible()
  const modes = [
    { name: '设施配方', count: '.facility-count', scroll: '#facilitiesScroll' },
    { name: '营地升级', count: '.camp-count', scroll: '#campFacilitiesScroll' },
    { name: '属性研究', count: '.camp-count', scroll: '#campFacilitiesScroll' }
  ]
  for (const [index, mode] of modes.entries()) {
    if (index) await page.getByRole('tab', { name: mode.name, exact: true }).click()
    const filter = page.locator('.facilities-page > .filter-panel')
    await expect(filter).toHaveCount(1)
    await expect(filter.getByRole('tab')).toHaveText(modes.map(entry => entry.name))
    const searchBox = await filter.locator('.ui-search').boundingBox()
    const tabsBox = await filter.getByRole('tablist').boundingBox()
    expect(tabsBox.y).toBeGreaterThanOrEqual(searchBox.y + searchBox.height)
    expect(await page.locator(mode.count).evaluate(element => ({
      size: getComputedStyle(element).fontSize, weight: getComputedStyle(element).fontWeight
    }))).toEqual({ size: '13px', weight: '600' })
    await expect.poll(() => page.evaluate(selector => {
      const root = innerWidth >= 1025 ? document.querySelector('.app-container') : document.querySelector(selector)
      return root.scrollTop
    }, mode.scroll)).toBe(0)
    await page.evaluate(selector => {
      const root = innerWidth >= 1025 ? document.querySelector('.app-container') : document.querySelector(selector)
      root.scrollTop = 450
    }, mode.scroll)
    await page.waitForTimeout(250)
    await expect(filter.getByRole('tab', { name: mode.name, exact: true })).toBeInViewport()
    if (testInfo.project.name === 'desktop') {
      const clip = await page.locator(mode.scroll).evaluate(element => ({
        top: element.getBoundingClientRect().top,
        clipped: parseFloat(element.style.getPropertyValue('--sticky-clip-top')),
        boundary: document.querySelector('.facilities-page > .filter-panel').getBoundingClientRect().bottom
      }))
      expect(Math.abs(clip.top + clip.clipped - clip.boundary)).toBeLessThan(2)
      expect(await page.locator('.facilities-page').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
    }
    expect(await page.locator('.facilities-page').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`facility-header-${index}.png`) })
  }
  await page.getByRole('tab', { name: '设施配方', exact: true }).click()
  await expect(page.locator('.facility-recipe').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => (innerWidth >= 1025
    ? document.querySelector('.app-container') : document.querySelector('#facilitiesScroll')).scrollTop)).toBe(0)
  expect(errors).toEqual([])
})

test('facility page exposes source-backed facilities and real level ranges', async ({ page }) => {
  await page.goto('/#/facilities')
  await dismissGlobalModals(page)

  await expect(page.getByRole('button', { name: '锻造台', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '工作台', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '制药台', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '磨坊', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '全部', exact: true }).last()).toBeVisible()
  await expect(page.getByText('装备打造', { exact: true })).toBeVisible()
  expect(await page.getByText('铜锭', { exact: true }).count()).toBeGreaterThan(0)

  await page.getByRole('button', { name: '工作台', exact: true }).click()
  await expect(page.getByRole('button', { name: '7级', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '7级', exact: true }).click()
  await expect(page.getByText('熔火护盾', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: '制药台', exact: true }).click()
  await expect(page.getByRole('button', { name: '6级', exact: true })).toBeVisible()

  const layout = await page.locator('.facility-recipe').first().evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    columns: getComputedStyle(element).gridTemplateColumns
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
  expect(layout.columns.split(' ').length).toBe(2)
})

test('ordinary crafted item links back to its facility recipe', async ({ page }) => {
  await page.goto('/#/items?itemId=item_10024')
  await dismissGlobalModals(page)
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await expect(modal.getByRole('heading', { name: '设施制作' })).toBeVisible()
  await expect(modal.getByText('磨坊 1 级制作', { exact: true })).toBeVisible()
  await modal.getByRole('button', { name: '查看设施' }).click()
  await expect(page).toHaveURL(/#\/facilities\?facility=mill&mode=crafting&level=1&item=item_10024$/)
  await expect(page.getByText('面粉', { exact: true }).first()).toBeVisible()
})
