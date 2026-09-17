import { expect, test } from '@playwright/test'

const routes = [
  '/items', '/furniture', '/equip', '/heroes', '/pets', '/monsters', '/tasks',
  '/events', '/exchange', '/recipes', '/achievement', '/petseggs', '/partner-mails',
  '/dungeons', '/runes', '/rewards', '/facilities',
  '/facilities?facility=camp&mode=building',
  '/facilities?facility=camp&mode=research'
]

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

for (const route of routes) {
  test(`search filters collapse without clearing controls: ${route}`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`/#${route}`)
    if (route.includes('facility=camp')) await expect(page.locator('.camp-filter-panel')).toBeVisible()
    const search = page.locator('.page-view-container .ui-search').first()
    const toggle = search.getByRole('button', { name: '收起筛选' })
    await expect(toggle).toBeVisible()
    const id = await toggle.getAttribute('aria-controls')
    const content = page.locator(`#${id}`)
    await expect(content).toBeVisible()
    const before = await content.evaluate(el => el.parentElement.getBoundingClientRect().height)
    const url = page.url()
    const active = await content.locator('.is-active').allTextContents()
    await toggle.click()
    const expand = search.getByRole('button', { name: '展开筛选' })
    await expect(expand).toHaveAttribute('aria-expanded', 'false')
    await expect(content).toBeHidden()
    await expect(search.locator('input')).toBeVisible()
    expect(page.url()).toBe(url)
    expect(await content.evaluate(el => el.parentElement.getBoundingClientRect().height)).toBeLessThan(before)
    if (route === '/petseggs') await expect(page.locator('.table-header-row')).toBeVisible()
    // Keep search, clear and toggle usable at narrow widths, including dark mode.
    await search.locator('input').fill('无匹配测试词')
    await search.getByRole('button', { name: '清空', exact: true }).click()
    await expect(search.locator('input')).toHaveValue('')
    await expect(expand).toBeVisible()
    await expect.poll(() => search.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expand.focus()
    await page.keyboard.press('Enter')
    await expect(content).toBeVisible()
    expect(await content.locator('.is-active').allTextContents()).toEqual(active)
    if (route === '/items') {
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'))
      await search.getByRole('button', { name: '收起筛选' }).click()
      await page.screenshot({ path: testInfo.outputPath('collapsed-dark.png') })
    }
    expect(errors).toEqual([])
  })
}

test('selected item category remains active while collapsed and list gains space', async ({ page }, testInfo) => {
  await page.goto('/#/items')
  const panel = page.locator('.filter-panel')
  await panel.getByRole('button', { name: '材料', exact: true }).click()
  const input = panel.locator('input')
  await input.fill('木')
  const grid = page.locator('#itemsGridScroll')
  await expect(grid.locator('.ui-item-card').first()).toBeVisible()
  const firstItem = await grid.locator('.ui-item-card').first().innerText()
  const oldHeight = await grid.evaluate(el => el.clientHeight)
  await panel.getByRole('button', { name: '收起筛选' }).click()
  await expect(input).toHaveValue('木')
  await expect(grid.locator('.ui-item-card').first()).toHaveText(firstItem)
  if (testInfo.project.name === 'mobile') {
    await expect.poll(() => grid.evaluate(el => el.clientHeight)).toBeGreaterThan(oldHeight)
  }
  await page.screenshot({ path: testInfo.outputPath('items-collapsed.png') })
  await panel.getByRole('button', { name: '展开筛选' }).click()
  await expect(panel.getByRole('button', { name: '材料', exact: true })).toHaveClass(/is-active/)
})

test('facility tabs retain working filter toggles after switching sections', async ({ page }) => {
  await page.goto('/#/facilities')
  for (const name of ['营地升级', '属性研究', '营地升级', '设施配方', '属性研究']) {
    await page.getByRole('tab', { name, exact: true }).click()
    const panel = page.locator('.facilities-page .filter-panel')
    await expect(panel.getByRole('tab', { name, exact: true })).toHaveClass(/is-active/)
    if (name !== '设施配方') await expect(page.locator('.camp-filter-panel')).toBeVisible()
    const toggle = panel.getByRole('button', { name: '收起筛选' })
    await expect(toggle).toBeVisible()
    const content = page.locator(`#${await toggle.getAttribute('aria-controls')}`)
    const url = page.url()
    await toggle.click()
    await expect(content).toBeHidden()
    await expect(panel.locator('input')).toBeVisible()
    expect(page.url()).toBe(url)
    await panel.getByRole('button', { name: '展开筛选' }).click()
    await expect(content).toBeVisible()
    await expect(panel.getByRole('tab', { name, exact: true })).toHaveClass(/is-active/)
  }
})

test('camp research paper stays aligned with sidebars when filters collapse', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop sidebars only')
  await page.setViewportSize({ width: 1912, height: 914 })
  await page.goto('/#/facilities?facility=camp&mode=research&research=collect_stone&level=1')
  const paper = page.locator('#campFacilitiesScroll')
  await expect(page.getByRole('heading', { name: '采石技巧', exact: true })).toBeVisible()
  const checkAlignment = async () => {
    for (const selector of ['.desktop-sidebar-container', '.desktop-right-container']) {
      await expect.poll(async () => {
        const content = await paper.boundingBox()
        const side = await page.locator(selector).boundingBox()
        return Math.abs(content.y + content.height - side.y - side.height)
      }).toBeLessThan(2)
    }
  }
  await checkAlignment()
  const before = await paper.boundingBox()
  await page.getByRole('button', { name: '收起筛选' }).click()
  await checkAlignment()
  expect((await paper.boundingBox()).height).toBeGreaterThan(before.height)
  await page.getByRole('button', { name: '展开筛选' }).click()
  await checkAlignment()
  // Long details must still grow and remain reachable through desktop scrolling.
  await page.locator('.camp-level-selector').getByRole('button', { name: '全部', exact: true }).click()
  const last = page.locator('.camp-level').last()
  await last.scrollIntoViewIfNeeded()
  await expect(last.getByRole('heading', { name: '3级研究' })).toBeInViewport()
})

test('collapsed filters leave room for mail content on a short landscape screen', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/#/partner-mails')
  await expect(page.locator('.mail-body')).toBeAttached()
  await page.getByRole('button', { name: '收起筛选' }).click()
  await expect(page.locator('.mail-body')).toBeVisible()
  await expect.poll(() => page.locator('.mail-body').evaluate(el => el.clientHeight)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: '展开筛选' })).toBeVisible()
})
