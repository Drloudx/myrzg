import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

const ready = async (page, path = '/#/heroes', selector = '.hero-bag-card') => {
  await page.goto(path)
  await expect(page.locator(selector).first()).toBeVisible()
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
}

test('global modal locks the background, fits safe areas, and keeps its footer visible', async ({ page }) => {
  await page.setViewportSize({ width: page.viewportSize().width, height: 520 })
  await page.route('**/data/notice.json*', route => route.fulfill({ json: {
    notices: [{ title: '公告', isPinned: true, content: '更新内容\n'.repeat(100) }]
  } }))
  await ready(page)
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-top', '24px')
    document.documentElement.style.setProperty('--safe-bottom', '20px')
  })
  await page.getByTitle('设置', { exact: true }).click()
  await page.locator('.dropdown-item').filter({ hasText: /^公告$/ }).click()
  const modal = page.getByRole('dialog', { name: '公告与反馈' })
  await expect(modal).toBeVisible()
  const layout = await modal.evaluate(element => {
    const body = element.querySelector('.ui-modal-body')
    const footer = element.querySelector('.ui-modal-footer')
    return {
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      footerBottom: footer.getBoundingClientRect().bottom,
      scrollable: body.scrollHeight > body.clientHeight,
      inert: document.querySelector('.app-container').inert,
      overflow: getComputedStyle(document.querySelector('.app-container')).overflowY
    }
  })
  expect(layout.top).toBeGreaterThanOrEqual(24)
  expect(layout.bottom).toBeLessThanOrEqual(500)
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.bottom)
  expect(layout.scrollable).toBe(true)
  expect(layout.inert).toBe(true)
  expect(layout.overflow).toBe('hidden')
  await page.screenshot({ path: test.info().outputPath('safe-area-notice.png') })
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect.poll(() => page.locator('.app-container').evaluate(element => element.inert)).toBe(false)
})

test('Escape dismisses a global overlay before the underlying item detail', async ({ page }) => {
  await ready(page, '/#/items?itemId=item_30022', '#itemModalScroll')
  await page.getByTitle('设置', { exact: true }).click()
  await page.locator('.dropdown-item').filter({ hasText: /^公告$/ }).click()
  await expect(page.getByRole('dialog', { name: '公告与反馈' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '公告与反馈' })).toBeHidden()
  await expect(page.locator('#itemModalScroll')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#itemModalScroll')).toBeHidden()
  await expect(page).not.toHaveURL(/itemId=/)
})

test('hidden reward preview appears above the header and closes without navigation', async ({ page }) => {
  await ready(page, '/#/rewards?tab=hidden', '.hidden-prev-img')
  const before = page.url()
  await page.locator('.hidden-prev-img').first().click()
  const preview = page.getByRole('dialog', { name: '点位预览', exact: true })
  await expect(preview).toBeVisible()
  await expect(preview.locator('img')).toBeVisible()
  expect(await preview.evaluate(element => Number(getComputedStyle(element.parentElement).zIndex))).toBeGreaterThan(10000)
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  expect(page.url()).toBe(before)
  await expect.poll(() => page.locator('.app-container').evaluate(element => element.inert)).toBe(false)
})

test('missing CDN images retry the bundle once and finish on a visible placeholder', async ({ page }) => {
  const requests = []
  await page.route('**/images/__review_missing__.png*', route => {
    requests.push(route.request().url())
    return route.fulfill({ status: 404, body: 'missing' })
  })
  await ready(page)
  await page.evaluate(() => {
    const img = document.createElement('img')
    img.id = 'fallback-check'
    img.alt = 'fallback-check'
    img.width = img.height = 40
    document.querySelector('.header-left').append(img)
    img.src = 'https://myrzg.yxzmy.top/images/__review_missing__.png'
  })
  const image = page.locator('#fallback-check')
  await expect(image).toHaveAttribute('src', '/ui/visibility-off.svg')
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true)
  await page.waitForTimeout(100)
  expect(requests).toHaveLength(2)
  await expect(image).toBeVisible()
})

test('monster growth data failures show a retry state instead of fabricated stats', async ({ page }) => {
  let attempts = 0
  await page.route('**/data/parsed/monLevelStrength.json*', route => {
    if (++attempts === 1) return route.fulfill({ status: 503, body: 'temporarily unavailable' })
    return route.continue()
  })
  await ready(page, '/#/monsters', '.monsters-card-grid .ui-item-card')
  await page.locator('.monsters-card-grid .ui-item-card').first().click()
  const body = page.locator('#monsterModalScroll')
  await expect(body.locator('.ui-empty-state--error')).toBeVisible()
  await expect(body.locator('.level-slider')).toHaveCount(0)
  await body.getByRole('button', { name: '重新加载' }).click()
  await expect(body.locator('.level-slider')).toBeVisible()
  expect(attempts).toBe(2)
  await page.keyboard.press('Escape')
  await expect(body).toBeHidden()
})

test('long updates keep actions visible, block Back while active, and permit retry', async ({ page }) => {
  await page.route('**/src/utils/hotupdate.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export async function checkHotUpdate() {
      return { version: '1.0.1', downloadUrl: 'https://example.test/update.zip', body: '更新内容\\n'.repeat(100) }
    }
    export async function getCurrentWebVersion() { return '1.0.0' }
    export function applyHotUpdate(info, progress) {
      progress(50)
      return new Promise((resolve, reject) => { window.finishUpdate = resolve; window.failUpdate = () => reject(new Error('下载失败')) })
    }`
  }))
  await ready(page)
  const modal = page.getByRole('dialog', { name: '发现新版本 1.0.1' })
  await expect(modal).toBeVisible()
  const button = modal.getByRole('button', { name: '立即更新', exact: true })
  await expect(button).toBeInViewport()
  await button.click()
  await expect(modal.getByRole('button', { name: '更新中...' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(modal).toBeVisible()
  await page.evaluate(() => window.failUpdate())
  await expect(modal.getByRole('alert')).toContainText('下载失败')
  await button.click()
  await page.evaluate(() => window.finishUpdate())
  await expect(modal).toBeHidden()
  await expect.poll(() => page.locator('.app-container').evaluate(element => element.inert)).toBe(false)
})
