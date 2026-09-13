import { expect, test } from '@playwright/test'
import { MASCOTS } from '../../src/config/mascots.js'

test('all 34 articulated mascots can be selected and stay inside the stage at both desktop sizes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop mascot only')
  test.setTimeout(120000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
  await page.addInitScript(() => localStorage.setItem('mitora-mascot-paused', 'true'))
  await page.goto('/#/runes')
  const shots = process.env.MASCOT_SCREENSHOT_DIR || 'test-results/mascot-catalog'
  expect(MASCOTS).toHaveLength(34)
  for (const character of MASCOTS) {
    await page.getByRole('button', { name: '切换吉祥物角色' }).click()
    const picker = page.getByRole('dialog', { name: '选择吉祥物' })
    if (!await picker.locator(`[data-character-option="${character.id}"]`).count()) {
      await page.getByRole('button', { name: '下一批角色' }).click()
    }
    await picker.locator(`[data-character-option="${character.id}"]`).click()
    await expect(page.locator('.mascot-art svg')).toHaveAttribute('data-character', character.id)
    await expect(page.locator('.mascot-art .mascot-arm')).toHaveCount(2)
    await expect(page.locator('.mascot-art .mascot-leg')).toHaveCount(2)
    await expect(page.locator('.mascot-art')).toHaveAttribute('data-action', 'idle')
    for (const height of [900, 700]) {
      await page.setViewportSize({ width: 1440, height })
      const frames = await page.locator('.mascot-art').evaluate(el => [0, 2400].map(time => {
        for (const animation of el.getAnimations({ subtree: true })) animation.currentTime = time
        const body = el.querySelector('.idle-body').getBoundingClientRect(), stage = el.getBoundingClientRect()
        return body.left >= stage.left && body.right <= stage.right && body.top >= stage.top && body.bottom <= stage.bottom
      }))
      expect(frames, character.id).toEqual([true, true])
      if (height === 900) await page.locator('.sidebar-mascot').screenshot({ path: `${shots}/${character.id}-idle.png` })
    }
  }
  expect(errors).toEqual([])
})
