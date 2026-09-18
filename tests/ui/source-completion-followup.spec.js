import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const sources = JSON.parse(readFileSync(new URL('../../public/data/parsed/item-sources.json', import.meta.url), 'utf8'))
async function openItem(page, id) {
  await page.goto(`/#/items?itemId=${id}`)
  await expect(page.locator('.app-container')).not.toHaveClass(/is-boot-loading/)
  for (let attempt = 0; attempt < 10; attempt++) {
    const close = page.locator('.ui-modal-overlay.is-teleported .ui-modal-close:visible').first()
    if (!await close.count()) break
    await close.click()
    await page.waitForTimeout(100)
  }
  const modal = page.locator('.app-main > .ui-modal-host .ui-modal-overlay')
  await expect(modal.getByRole('heading', { name: '获取途径', exact: true })).toBeVisible()
  return modal
}
async function group(modal, name) {
  const section = modal.locator('.ui-accordion').filter({ has: modal.page().getByRole('button', { name, exact: true }) })
  await section.getByRole('button', { name, exact: true }).click()
  return section
}

test('named contract opens its self-select parent and returns without losing the child', async ({ page }, testInfo) => {
  const modal = await openItem(page, 'item_59050')
  const section = await group(modal, '礼包与道具')
  await expect(section).toContainText('自选指名契约书')
  await expect(section).toContainText('自选获得')
  await page.screenshot({ path: testInfo.outputPath('contract-source.png') })
  await section.locator('.drawer-chip').click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('自选指名契约书')
  await expect(modal).toContainText('指名契约书：米拉贝尔')
  await modal.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(modal.locator('.ui-modal-title')).toHaveText('指名契约书：米拉贝尔')
})

test('daily, tower and dismantling sources stay concise with no dead navigation', async ({ page }, testInfo) => {
  for (const [id, name, expected] of [
    ['item_00001', '日常计划', '通关结算奖励'],
    ['item_19015', '日常计划', '水火矿洞三层'],
    ['item_25002', '塔层奖励', '神匠之塔'],
    ['item_10075', '装备分解', '第 3 阶']
  ]) {
    const modal = await openItem(page, id)
    const section = await group(modal, name)
    await expect(section).toContainText(expected)
    await expect(section.locator('.source-action-text')).toHaveCount(0)
    await expect(section).not.toContainText('当前未发现正式来源')
    await expect(section).not.toContainText('存在测试配置引用')
    if (name === '日常计划') {
      await expect(section).toContainText('通关结算奖励')
      await expect(section).not.toContainText('通关《')
      await expect(section).not.toContainText('消耗：')
      await expect(section).not.toContainText('单次抽取')
      await page.screenshot({ path: testInfo.outputPath(`daily-source-${id}.png`) })
    }
  }
})

test('egg source opens the actual pet pool details', async ({ page }) => {
  const modal = await openItem(page, 'pet_074')
  const section = await group(modal, '招募与贩售')
  await section.locator('.drawer-chip').filter({ hasText: '特别贩售' }).click()
  // pool 用**完整 pool id**（`pet:1:1:0`），不是 poolTypeId（`1`）：
  // GachaView 的 syncFromRoute 按 pool.id 校验，传 poolTypeId 会被判无效并回退默认池。
  await expect(page).toHaveURL(/#\/gacha\?kind=pet&pool=pet:1:1:0&view=pool/)
  // 概率详情的标题由 GachaTipPanel 按池名生成（`${pool.name} · 概率详情`）；
  // 此前断言写的是「卡池详情」，该文案在源码中从未存在，属长期失效的断言。
  await expect(page.locator('.tip-panel__title')).toHaveText('特别贩售 · 概率详情')
  // 滚动容器是 `.tip-scroll`（此前断言的 `#gachaScroll` 在源码中不存在）。
  await expect(page.locator('.tip-scroll')).toContainText('宝石迷迷可的蛋')
})

test('unappraised rune navigates to its dungeon chest rewards', async ({ page }, testInfo) => {
  const modal = await openItem(page, 'item_19300')
  const section = await group(modal, '副本掉落')
  await section.locator('.drawer-chip').first().click()
  await expect(page).toHaveURL(/#\/dungeons\?battle=/)
  const focused = page.locator('.special-drop-card--focused')
  await expect(focused).toBeVisible()
  await expect(focused).toContainText('未鉴定的小型符石')
  await page.screenshot({ path: testInfo.outputPath('dungeon-source.png') })
})

test('settlement, first-clear and room sources select their actual reward sections', async ({ page }) => {
  for (const [id, tab] of [['item_20016', 'settlement'], ['item_00002', 'first'], ['item_10043', 'rooms']]) {
    const source = sources[id].find(source => source.type === 'dungeon' && source.dropTab === tab)
    expect(source).toBeTruthy()
    const modal = await openItem(page, id)
    const section = await group(modal, '副本掉落')
    const chip = section.locator('.drawer-chip').filter({ hasText: source.name }).filter({ hasText: source.des }).first()
    await chip.click()
    await expect(page).toHaveURL(/#\/dungeons\?battle=/)
    await expect(page.locator(`[data-source-entry="${source.dropEntry}"]`).first()).toBeVisible()
    await expect.poll(() => page.evaluate(entry => {
      const element = [...document.querySelectorAll('[data-source-entry]')].find(el => el.dataset.sourceEntry === entry)
      if (!element) return false
      const box = element.getBoundingClientRect()
      return box.top < window.innerHeight && box.bottom > 0
    }, source.dropEntry)).toBe(true)
    if (tab === 'settlement') await expect(page.getByRole('button', { name: '通关结算掉落' })).toHaveAttribute('aria-expanded', 'true')
  }
})
