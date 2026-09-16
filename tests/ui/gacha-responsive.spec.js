import { expect, test } from '@playwright/test'

// 回归真实窗口缩放：仅检查 canvas 的宽度不足以发现固定坐标按钮被裁到两侧。
async function expectInsideStage(stage, selectors) {
  await expect(stage).toBeVisible()
  await expect.poll(async () => stage.evaluate((root, targets) => {
    const bounds = root.getBoundingClientRect()
    const outside = []
    for (const selector of targets) {
      const elements = [...root.querySelectorAll(selector)]
      if (!elements.length) outside.push(`${selector}: missing`)
      for (const el of elements) {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0 || rect.left < bounds.left - 1
          || rect.top < bounds.top - 1 || rect.right > bounds.right + 1
          || rect.bottom > bounds.bottom + 1) outside.push(selector)
      }
    }
    return outside
  }, selectors)).toEqual([])
}

const poolTargets = ['.gacha-canvas', '.kind-toggle', '.pool-tab', '.draw-btn',
  '.draw-cost', '.currency-row', '.close-btn', '.mini-btn']

test('卡池随同一窗口缩窄和放大，角色与蛋池全部操作保持可见', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 914 })
  await page.goto('/#/gacha')
  const stage = page.locator('.gacha-stage').first()
  await expectInsideStage(stage, poolTargets)
  const originalWidth = (await page.locator('.draw-btn').first().boundingBox()).width

  for (const viewport of [{ width: 1241, height: 914 }, { width: 590, height: 676 },
    { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await expectInsideStage(stage, poolTargets)
    await expect.poll(async () => (await page.locator('.draw-btn').first().boundingBox()).width)
      .toBeLessThan(originalWidth)
    await page.locator('.kind-toggle').nth(1).click()
    await expect(page).toHaveURL(/kind=pet/)
    await expectInsideStage(stage, poolTargets)
    await page.locator('.mini-btn').first().click()
    await expectInsideStage(page.locator('.gacha-overlay .gacha-stage'), ['.tip-panel', '.tip-panel__close'])
    await page.locator('.tip-panel__close').click()
    await page.locator('.kind-toggle').first().click()
  }

  await page.setViewportSize({ width: 590, height: 676 })
  await expectInsideStage(stage, poolTargets)
  await page.screenshot({ path: testInfo.outputPath('pool-590.png') })
  await page.setViewportSize({ width: 1920, height: 914 })
  await expectInsideStage(stage, poolTargets)
  await expect.poll(async () => Math.abs((await page.locator('.draw-btn').first().boundingBox()).width - originalWidth))
    .toBeLessThan(1)
})

for (const kind of ['hero', 'pet']) {
  test(`${kind} 十连演出与完整结算在窄窗口可操作`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 590, height: 676 })
    await page.goto(`/#/gacha?kind=${kind}`)
    await expectInsideStage(page.locator('.gacha-stage').first(), poolTargets)
    await page.locator('.draw-btn').nth(1).click()

    const stage = page.locator('.gacha-overlay .gacha-stage')
    if (kind === 'hero') {
      await expectInsideStage(stage, ['.gacha-canvas', '.card-skip'])
      await page.locator('.card-skip').click()
      await expect(page.locator('.reveal-skip')).toBeVisible()
      await expectInsideStage(stage, ['.gacha-canvas', '.reveal-skip'])
      for (let i = 0; i < 12 && !(await page.locator('.result-close').isVisible()); i++) {
        await page.locator('.reveal-skip').click()
      }
      await expect(page.locator('.result-diamond')).toHaveCount(10)
      await expectInsideStage(stage, ['.gacha-canvas', '.result-diamond', '.result-close', '.result-btn', '.currency-row'])
    } else {
      await expectInsideStage(stage, ['.gacha-canvas', '.pet-skip'])
      await page.locator('.pet-skip').click()
      await expect(page.locator('.tip-cell__stars')).toHaveCount(10)
      await expectInsideStage(stage, ['.gacha-canvas', '.tip-cell', '.tip-plate__title'])
    }
    // 演出/结算仍支持宽屏延展；来回改变尺寸不会重新抽取或丢失结果。
    for (const viewport of [{ width: 1920, height: 750 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await expectInsideStage(stage, kind === 'hero'
        ? ['.gacha-canvas', '.result-diamond', '.result-close', '.result-btn']
        : ['.gacha-canvas', '.tip-cell', '.tip-plate__title'])
    }
    await page.screenshot({ path: testInfo.outputPath(`${kind}-result-390.png`) })
    if (kind === 'hero') await page.locator('.result-close').click()
    else {
      await expect(page.locator('.tip-plate__tip')).toHaveText('再次点击关闭')
      await page.locator('.tip-plate__title').click()
    }
    await expect(page.locator('.gacha-overlay')).toHaveCount(0)
    await expectInsideStage(page.locator('.gacha-stage').first(), poolTargets)
  })
}
