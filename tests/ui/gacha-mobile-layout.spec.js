import { expect, test } from '@playwright/test'

test('卡池宽屏布景覆盖两侧，角色与蛋池主视觉保持比例', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 472 })
  await page.goto('/#/gacha')
  for (const kind of ['hero', 'pet']) {
    if (kind === 'pet') await page.locator('.kind-toggle').nth(1).click()
    await expect(page.locator('.pool-cover')).toBeVisible()
    await expect.poll(() => page.locator('.pool-cover').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect.poll(() => page.locator('.pool-cover').evaluate(img => getComputedStyle(img).opacity)).toBe('1')
    const sizes = await page.locator('.pool-bgmain').evaluate(img => {
      const rect = img.getBoundingClientRect()
      const stage = img.closest('.gacha-stage').getBoundingClientRect()
      const cover = img.closest('.gacha-stage').querySelector('.pool-cover')
      return { left: rect.left + rect.width * 184 / 2048 - stage.left,
        right: stage.right - (rect.right - rect.width * 184 / 2048),
        coverRatio: cover.clientWidth / cover.clientHeight, originalRatio: cover.naturalWidth / cover.naturalHeight }
    })
    expect(sizes.left).toBeLessThan(1)
    expect(sizes.right).toBeLessThan(1)
    expect(sizes.coverRatio).toBeCloseTo(sizes.originalRatio, 2)
    await page.screenshot({ path: testInfo.outputPath(`pool-${kind}-wide.png`) })
  }
})

test('旋转时保留卡池与概率弹层，离开招募恢复普通页面', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/gacha?kind=pet')
  await page.locator('.mini-btn').first().click()
  const url = page.url()
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 780 }]) {
    await page.setViewportSize(viewport)
    await expect(page.locator('.gacha-viewport')).toHaveAttribute('data-rotated', String(isMobile && viewport.height > viewport.width))
    await expect(page.locator('.tip-panel__close')).toBeVisible()
    await expect(page).toHaveURL(url)
  }
  await page.locator('.tip-panel__close').click()
  await expect(page.locator('.gacha-overlay')).toHaveCount(0)
  await page.goto('/#/heroes')
  await expect(page.locator('.gacha-viewport')).toHaveCount(0)
})

test('超宽横屏翻卡有效背景铺满两侧，途中改比例不拉伸角色', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 472 })
  await page.goto('/#/gacha')
  await page.locator('.draw-btn').first().click()
  await expect(page.locator('.card-cam--done')).toBeVisible({ timeout: 20000 })
  for (const viewport of [{ width: 1280, height: 472 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.locator('.card-spine-wrap canvas').evaluate(canvas =>
      Math.abs(canvas.width / canvas.height - canvas.clientWidth / canvas.clientHeight)
    )).toBeLessThan(0.005)
    // CSS / 缓冲区比例正确不代表 GL 实际绘图区正确；遗漏 viewport 会把人和桌子压向左侧。
    await expect.poll(() => page.locator('.card-spine-wrap canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl')
      const viewport = [...gl.getParameter(gl.VIEWPORT)]
      return viewport[0] === 0 && viewport[1] === 0
        && viewport[2] === gl.drawingBufferWidth && viewport[3] === gl.drawingBufferHeight
    })).toBe(true)
    const coverage = await page.locator('.card-bg img').evaluate(img => {
      const image = img.getBoundingClientRect()
      const stage = img.closest('.gacha-stage').getBoundingClientRect()
      // 源图左右各 184px 透明 padding，不可把整张 img 的边界当成有效画面。
      return { left: image.left + image.width * 184 / 2048 - stage.left,
        right: stage.right - (image.right - image.width * 184 / 2048) }
    })
    expect(coverage.left).toBeLessThan(1)
    expect(coverage.right).toBeLessThan(1)
    await page.screenshot({ path: testInfo.outputPath(`card-${viewport.width}.png`) })
  }
  await page.locator('.card-catcher').click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: testInfo.outputPath('card-drawing.png') })
  await page.locator('.card-skip').click()
  await expect(page.locator('.reveal-skip')).toBeVisible()
})

for (const [typeId, name] of [['hero_031', '波特温'], ['hero_050', '米拉贝尔']]) {
  test(`${name} 在不同方向保持小人比例与站台位置`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/gacha')
    await page.waitForFunction(() => typeof window.__testReveal === 'function')
    // 使用现有开发入口固定角色，走真实揭晓组件、骨架资源和播放器。
    await page.evaluate(({ typeId, name }) => window.__testReveal([{ typeId, name, quality: 4 }]), { typeId, name })
    await expect(page.locator('.reveal-stage--step3')).toBeVisible({ timeout: 20000 })
    const canvas = page.locator('.reveal-chibi-host canvas')
    await expect(canvas).toBeVisible()
    // 等待 win 进入待机，截图对照台面；不能仅检查宿主方框是否在台上。
    await page.waitForTimeout(3000)
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 472 }]) {
      await page.setViewportSize(viewport)
      await expect.poll(() => canvas.evaluate(el => Math.abs(el.width / el.height - 440 / 520)))
        .toBeLessThan(0.002)
      await page.waitForTimeout(300)
      await page.screenshot({ path: testInfo.outputPath(`${typeId}-${viewport.width}.png`) })
    }
    expect(errors).toEqual([])
  })
}
