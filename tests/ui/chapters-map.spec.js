import { expect, test } from '@playwright/test'

/**
 * 关卡图鉴 /chapters：地区路线图的节点装配与交互回归。
 *
 * 覆盖本轮修的东西：
 *  - 三种节点的图都从构建期产物取，且**名称牌不与关卡石台重叠**（地区图比关卡大得多，
 *    偏移不够就会把正下方的关卡整个盖住，水晶从牌子里戳出来）；
 *  - 关卡编号是白字描边、没有底板；
 *  - 副本名压在图标自带的石牌上（在图形内部，不是挂到图外）；
 *  - 地区节点带游戏原图的橙环 / 角标 / 名称牌 / 「自由探索」标签；
 *  - 点关卡节点能开详情，缩放与「返回世界地图」可用。
 *
 * 地区地图只在桌面端出现（手机恒为列表），所以这些用例只在 desktop 工程跑。
 */

const CHAPTER = 'c1'

test.beforeEach(async ({ page }) => {
  await page.route('**/data/notice.json*', route => route.fulfill({ json: { notices: [] } }))
})

/** 打开地区路线图并等节点装配完。 */
async function openRegionMap(page) {
  const errors = []
  const failed = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => failed.push(request.url()))
  await page.goto(`/#/chapters?chapter=${CHAPTER}`)
  await expect(page.locator('.region-map__viewport')).toBeVisible()
  await expect(page.locator('.region-map__node.is-stage').first()).toBeVisible()
  return { errors, failed }
}

test('region route map renders every node kind from build products', async ({ page }) => {
  const { errors, failed } = await openRegionMap(page)

  await expect(page.locator('.region-map__node.is-stage')).toHaveCount(15)
  await expect(page.locator('.region-map__node.is-area')).toHaveCount(5)
  await expect(page.locator('.region-map__node.is-instance')).toHaveCount(2)
  await expect(page.locator('.region-map__node.is-explore')).toHaveCount(6)
  await expect(page.locator('.region-map__links line')).toHaveCount(21)

  // 底图与节点图都真的解码成功（SPA fallback 会对缺图返回 200 + HTML，只有解码失败才暴露）
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('.region-map__bg, .region-map__node-art'))
    return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.currentSrc || img.src)
  })
  expect(broken).toEqual([])

  // 地区节点的「自由探索」标签挂上了；橙环是游戏的选中态装饰，本站不显示
  await expect(page.locator('.region-map__node.is-area .region-map__node-tag')).toHaveCount(5)
  await expect(page.locator('.region-map__node-ring')).toHaveCount(0)
  await expect(page.locator('.region-map__node-corner')).toHaveCount(0)

  expect(errors).toEqual([])
  expect(failed).toEqual([])
})

test('node art sits on its node point (area disc centre, instance centre)', async ({ page }) => {
  await openRegionMap(page)

  // 连线端点就是节点坐标本身。地区节点的圆盘底座中心（sprite 高度 75.4% 处）精准落在节点坐标上
  const area = await page.locator('.region-map__node.is-area').first().evaluate(el => {
    const node = el.getBoundingClientRect()
    const art = el.querySelector('.region-map__node-art').getBoundingClientRect()
    const anchorY = node.top + node.height * 0.754
    const discCenterY = art.top + art.height * 0.754
    return { anchorY, discCenterY }
  })
  expect(Math.abs(area.discCenterY - area.anchorY)).toBeLessThan(2)

  // 副本底座中心（sprite 高度 70% 处）精准落在节点坐标上
  const inst = await page.locator('.region-map__node.is-instance').first().evaluate(el => {
    const node = el.getBoundingClientRect()
    const art = el.querySelector('.region-map__node-art').getBoundingClientRect()
    const anchorY = node.top + node.height * 0.70
    const discCenterY = art.top + art.height * 0.70
    return { anchorY, discCenterY }
  })
  expect(Math.abs(inst.discCenterY - inst.anchorY)).toBeLessThan(2)
})

test('area name plaque does not bury the stage platform below it', async ({ page }) => {
  await openRegionMap(page)

  // 地区图比关卡石台大得多。游戏里名称牌紧贴圆盘下缘，两者仅轻微相碰，不应大幅深埋石台
  const overlaps = await page.evaluate(() => {
    const rect = el => el.getBoundingClientRect()
    const out = []
    const stages = Array.from(document.querySelectorAll('.region-map__node.is-stage'))
    for (const plaque of document.querySelectorAll('.region-map__node-label.is-plaque')) {
      const pr = rect(plaque)
      for (const stage of stages) {
        const sr = rect(stage)
        const ox = Math.min(pr.right, sr.right) - Math.max(pr.left, sr.left)
        const oy = Math.min(pr.bottom, sr.bottom) - Math.max(pr.top, sr.top)
        if (ox > 0 && oy > 0) out.push({ text: plaque.textContent.trim(), stage: stage.getAttribute('title'), ox: Math.round(ox), oy: Math.round(oy), h: Math.round(pr.height) })
      }
    }
    return out
  })
  const buried = overlaps.filter(o => o.oy > o.h * 0.6)
  expect(buried, `名称牌盖住关卡石台过多：${JSON.stringify(buried)}`).toEqual([])
})

test('node labels follow the game: plain outlined stage number, instance name on its own plate', async ({ page }) => {
  await openRegionMap(page)

  const stage = await page.locator('.region-map__node.is-stage .region-map__node-label').first().evaluate(el => {
    const cs = getComputedStyle(el)
    return { background: cs.backgroundColor, borderWidth: cs.borderTopWidth, stroke: cs.webkitTextStrokeWidth }
  })
  // 关卡编号：没有底板、白字 + 深色描边
  expect(stage.background).toBe('rgba(0, 0, 0, 0)')
  expect(stage.borderWidth).toBe('0px')
  expect(parseFloat(stage.stroke)).toBeGreaterThan(0)

  // 副本名压在图标**内部**自带的石牌上
  const inside = await page.locator('.region-map__node.is-instance').first().evaluate(el => {
    const art = el.querySelector('.region-map__node-art').getBoundingClientRect()
    const label = el.querySelector('.region-map__node-label.is-builtin').getBoundingClientRect()
    return { labelTop: label.top, labelBottom: label.bottom, artTop: art.top, artBottom: art.bottom }
  })
  expect(inside.labelTop).toBeGreaterThanOrEqual(inside.artTop)
  expect(inside.labelBottom).toBeLessThanOrEqual(inside.artBottom + 1)
})

test('stage node opens its detail, zoom controls and back-to-world work', async ({ page }) => {
  const { errors } = await openRegionMap(page)

  const zoom = page.locator('.region-map__toolbar output')
  const before = await zoom.innerText()
  await page.locator('.region-map__toolbar button[aria-label="放大地图"]').click()
  await expect(zoom).not.toHaveText(before)
  await page.locator('.region-map__toolbar button[aria-label="恢复默认视图"]').click()
  await expect(zoom).toHaveText(before)

  const node = page.locator('.region-map__node.is-stage').first()
  const label = (await node.locator('.region-map__node-label').innerText()).trim()
  await node.click()
  await expect(page.locator('.ui-modal-window .ui-modal-title')).toContainText(label)
  await expect(page).toHaveURL(new RegExp(`chapter=${CHAPTER}&stage=`))

  await page.locator('.ui-modal-close:visible').first().click()
  await expect(page.locator('.ui-modal-overlay:visible')).toHaveCount(0)
  await expect(page).not.toHaveURL(/stage=/)

  await page.locator('.region-map__back').click()
  await expect(page.locator('.chapter-map__canvas')).toBeVisible()
  await expect(page.locator('.region-map__viewport')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('area exploration node opens detail modal, and list difficulty filter supports 自由探索', async ({ page }) => {
  const { errors } = await openRegionMap(page)

  // 1. 地图上小地区节点可点击并打开详情弹窗
  const areaNode = page.locator('.region-map__node.is-area').first()
  const areaName = (await areaNode.locator('.region-map__node-label').innerText()).trim()
  await areaNode.click()

  const modal = page.locator('.ui-modal-window')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.ui-modal-title')).toContainText('自由探索')
  await expect(modal.locator('.ui-modal-title')).toContainText(areaName)
  await expect(modal.locator('.ui-section__title', { hasText: '探索产出' })).toBeVisible()
  await expect(modal.locator('.ui-section__title', { hasText: '房间内容与掉落来源' })).toBeVisible()
  await expect(modal.locator('.room-collection').first()).toBeVisible()
  await expect(modal.locator('.reward-slot').first()).toBeVisible()

  // 关闭弹窗
  await page.locator('.ui-modal-close:visible').first().click()
  await expect(page.locator('.ui-modal-overlay:visible')).toHaveCount(0)

  // 2. 点击「展开列表」切到列表视图
  await page.locator('.region-map__list-btn').click()
  await expect(page.locator('.filter-panel')).toBeVisible()

  // 3. 验证难度筛选行包含「自由探索」，且位于困难之后
  const diffRow = page.locator('.ui-filter-row', { hasText: '难度：' })
  const pills = diffRow.locator('.ui-filter-pill')
  const pillTexts = await pills.allInnerTexts()
  expect(pillTexts).toEqual(['全部', '简单', '普通', '困难', '自由探索'])

  // 4. 点击「自由探索」进行筛选
  await diffRow.locator('.ui-filter-pill', { hasText: '自由探索' }).click()
  await expect(page).toHaveURL(/diff=%E8%87%AA%E7%94%B1%E6%8E%A2%E7%B4%A2/)

  // 筛选出来的列表项全部为自由探索小地区
  const cards = page.locator('.stage-list-row')
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    await expect(card.locator('.stage-card-no')).toHaveText('自由探索')
  }

  expect(errors).toEqual([])
})

