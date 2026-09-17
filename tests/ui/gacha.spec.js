import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 模拟招募页面（/gacha）回归：
 *   1. 资源与错误：无控制台报错、无失败请求，画布内所有图片都真正解码成功；
 *   2. 布局：关键元素的实际屏幕位置与原始 prefab 设计坐标（1534×750、原点居中）一致；
 *   3. 交互：抽一次 → 揭晓演出三段可点击推进 → 结果一览；
 *   4. 弹层：概率详情（原表 percTip）+ 记录查询（本地模拟记录分页）。
 * 截图输出到项目外 `ui-checks/gacha-replica/`，供人工核对视觉。
 */

const SHOT_ROOT = join(process.cwd(), '..', 'ui-checks', 'gacha-replica')
const DESIGN = { width: 1534, height: 750 }

test.beforeAll(() => {
  mkdirSync(SHOT_ROOT, { recursive: true })
})

/** 截图路径按 project 分目录：桌面与移动端不得写同名文件，否则会互相覆盖。 */
function shotPath(testInfo, name) {
  return join(SHOT_ROOT, testInfo.project.name, name)
}

/** 打开卡池页并等待画布与图片就绪。 */
async function openGacha(page) {
  const problems = []
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`)
  })
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
  page.on('response', response => {
    if (response.status() >= 400) problems.push(`http ${response.status()}: ${response.url()}`)
  })

  await page.goto('/#/gacha')
  await expect(page.locator('.gacha-canvas')).toBeVisible()
  await page.waitForFunction(() => Array.from(document.images).every(img => img.complete))
  return problems
}

/** 点击抽取后先经过翻卡演出（GachaCardPanel）：跳过它直接进入揭晓
 *  （WebGL 不可用时演出会自动跳过，此时已在揭晓，跳过按钮不存在）。 */
async function skipCardAni(page) {
  await page.locator('.card-skip').click({ timeout: 5000 }).catch(() => {})
}

test('卡池页资源全部可加载且无运行时报错', async ({ page }, testInfo) => {
  const problems = await openGacha(page)

  const broken = await page.evaluate(() => Array.from(document.images)
    .filter(img => img.naturalWidth === 0)
    .map(img => img.currentSrc || img.src))
  expect(broken, `以下图片解码失败：\n${broken.join('\n')}`).toEqual([])
  expect(problems, problems.join('\n')).toEqual([])
  await page.screenshot({ path: shotPath(testInfo, '01-pool.png') })
})

test('关键元素位置与 prefab 设计坐标一致', async ({ page }, testInfo) => {
  // 设计坐标断言在桌面视口下进行：移动端容器过窄，画布被等比缩到很小，
  // 位置换算虽同样成立但分辨率不足以支撑 2px 精度；移动端另有横向溢出与提示的用例。
  test.skip(testInfo.project.name !== 'desktop', '设计坐标断言只在桌面视口执行')
  await openGacha(page)

  // 设计坐标 → 期望屏幕中心：画布中心 + (x, -y) × 缩放
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('.gacha-canvas')
    const rect = canvas.getBoundingClientRect()
    return {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      scale: rect.width / 1534
    }
  })
  expect(metrics.scale).toBeGreaterThan(0.3)

  const cases = [
    { selector: '.pool-tab >> nth=0', x: -469, y: 135, label: '卡池页签首个（Toggles -469,135，左边缘对齐 -631）' },
    { selector: '.pool-tab >> nth=1', x: -469, y: 45, label: '卡池页签第二个（Vertical 排列，cellHeight=90）' },
    { selector: '.draw-btn >> nth=0', x: 196, y: -316, label: '单抽按钮（Buttons/One 400-204, -340+24）' },
    { selector: '.draw-btn >> nth=1', x: 487, y: -316, label: '十连按钮（Buttons/Ten 400+87, -340+24）' },
    { selector: '.draw-cost >> nth=0', x: 196, y: -264, label: '单取消耗行（按钮上方 52，gacha_btn_tag 底板）' },
    { selector: '.draw-cost >> nth=1', x: 487, y: -264, label: '十连消耗行' },
    { selector: '.close-btn', x: 587, y: 335, label: '返回按钮（TopRight/Back 587,335）' },
    { selector: '.pool-period', x: 461, y: 227, label: '期次贴图（periodType 461,227）' }
  ]

  for (const item of cases) {
    const box = await page.locator(item.selector).boundingBox()
    expect(box, `${item.label} 未渲染`).not.toBeNull()
    const actualX = box.x + box.width / 2
    const actualY = box.y + box.height / 2
    const expectX = metrics.centerX + item.x * metrics.scale
    const expectY = metrics.centerY - item.y * metrics.scale
    expect(Math.abs(actualX - expectX), `${item.label} 横坐标偏差 ${(actualX - expectX).toFixed(1)}px`).toBeLessThan(2)
    expect(Math.abs(actualY - expectY), `${item.label} 纵坐标偏差 ${(actualY - expectY).toFixed(1)}px`).toBeLessThan(2)
  }

  // 画布尺寸即设计分辨率（未缩放前的布局尺寸）
  const canvasSize = await page.locator('.gacha-canvas').evaluate(el => ({
    width: el.offsetWidth,
    height: el.offsetHeight
  }))
  expect(canvasSize).toEqual(DESIGN)
})

test('固定尺寸按钮与页签使用预渲染纹理（sliced_buttons）', async ({ page }, testInfo) => {
  await openGacha(page)

  // 已定尺寸的按钮/页签不做 CSS 切片，改用 `public/images/sliced_buttons` 的预渲染纹理，
  // 以 `background-size: 100% 100%` 整幅铺满（见 features/gacha/GACHA.md「布局与素材」）。
  // 需变尺寸的切片（com_info_botm、item_info_color* 等）仍走 border-image，不在本条覆盖范围。
  const slices = await page.evaluate(() => {
    const read = selector => {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector
      if (!el) return null
      const style = getComputedStyle(el)
      return {
        backgroundImage: style.backgroundImage,
        backgroundSize: style.backgroundSize,
        borderImageSource: style.borderImageSource
      }
    }
    const draws = document.querySelectorAll('.draw-btn')
    return {
      tab: read('.pool-tab__bg'),
      draw: read(draws[0]),
      drawTen: read(draws[1]),
      mini: read('.mini-btn')
    }
  })

  for (const [name, expectSprite] of [
    ['tab', 'sliced_buttons/gacha_page'],
    ['draw', 'sliced_buttons/com_btn_N_sp'],
    ['drawTen', 'sliced_buttons/com_btn_Y_sp'],
    ['mini', 'sliced_buttons/com_btn_mini']
  ]) {
    expect(slices[name]?.backgroundImage, `${name} 应使用预渲染纹理`).toContain(expectSprite)
    expect(slices[name]?.backgroundSize, `${name} 应整幅铺满`).toBe('100% 100%')
    expect(slices[name]?.borderImageSource, `${name} 不应再重复切片`).toBe('none')
  }
})

test('概率详情与记录查询弹层可用', async ({ page }, testInfo) => {
  await openGacha(page)

  // 概率详情：正文来自原表 percTip，含名单替换后的角色名
  await page.locator('.mini-btn').first().click()
  await expect(page.locator('.tip-panel')).toBeVisible()
  await expect(page.locator('.tip-panel__title')).toContainText('概率详情')
  // 覆盖层必须真的落在视口内：每个面板各有自己的 GachaStage，
  // 若不绝对定位会被排到页面下方裁掉，而 toBeVisible 不会发现这一点
  const tipBox = await page.locator('.tip-panel').boundingBox()
  const viewport = page.viewportSize()
  expect(tipBox.y, `弹层顶部 ${tipBox.y} 应在视口内`).toBeGreaterThanOrEqual(0)
  expect(tipBox.y + tipBox.height, '弹层底部应在视口内').toBeLessThanOrEqual(viewport.height + 1)
  expect(tipBox.x + tipBox.width, '弹层右侧应在视口内').toBeLessThanOrEqual(viewport.width + 1)
  const rateText = await page.locator('.tip-rate__body').innerText()
  expect(rateText).toContain('概率说明')
  expect(rateText).not.toContain('{rare5List}')
  expect(rateText).toContain('保底抽取')
  await page.screenshot({ path: shotPath(testInfo, '02-rate.png') })

  await page.locator('.tip-panel__close').click()
  await expect(page.locator('.tip-panel')).toBeHidden()

  // 记录查询：未抽过时显示空态说明
  await page.locator('.mini-btn').nth(1).click()
  await expect(page.locator('.tip-record__empty')).toBeVisible()
  await page.screenshot({ path: shotPath(testInfo, '03-record-empty.png') })

  // 点面板空白底板不关闭（关闭只走面板外的遮罩区域或 ✕）
  const canvas = await page.evaluate(() => {
    const rect = document.querySelector('.gacha-canvas').getBoundingClientRect()
    return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, scale: rect.width / 1534 }
  })
  // 面板内空白点：页码(-60~60)与「上一页」按钮(-329~-199)之间的空档，design (-150,-327)
  await page.mouse.click(canvas.centerX - 150 * canvas.scale, canvas.centerY + 327 * canvas.scale)
  await expect(page.locator('.tip-panel')).toBeVisible()

  // 点面板外的遮罩区域关闭。
  // 用 dispatchEvent 而非坐标点击：窄屏（手机竖屏）下 800 宽的底板被缩到整个视口宽度，
  // 视口内已不存在「面板外」的遮罩可见区域（按设计坐标算出的点会落进 .tip-scroll-wrap），
  // 坐标点击在手机端不可靠；遮罩本身的关闭行为两端一致，故直接派发 click。
  await page.locator('.tip-root__mask').dispatchEvent('click')
  await expect(page.locator('.tip-panel')).toBeHidden()
})

test('抽卡到揭晓演出再到结果一览', async ({ page }, testInfo) => {
  await openGacha(page)

  // 页签切换（vue-router 不对查询值做百分号编码，冒号原样保留）
  await page.locator('.pool-tab').nth(1).click()
  await expect(page).toHaveURL(/pool=hero:2:2:0/)

  // 十连
  await page.locator('.draw-btn').nth(1).click()
  // 翻卡演出先挂载（Spine 画布挂在自己的包裹节点 `.card-spine-wrap` 里，
  // 由 `gachaSpinePlayer` 注入 <canvas>；断言包裹节点与 canvas 同时就位）
  await expect(page.locator('.card-spine-wrap')).toBeVisible()
  await expect(page.locator('.card-spine-wrap canvas')).toBeAttached()
  await skipCardAni(page)
  const catcher = page.locator('.reveal-click-catcher')
  await expect(catcher).toBeVisible()

  // 三段推进：step1 星级 → step2 背框 → step3 立绘/台词
  // （每个角色单独走这三段；点击跳段按稀有度而定，故直接轮询到立绘出现）
  await expect(page.locator('.reveal-bigstar-item').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: shotPath(testInfo, '04-reveal-stars.png') })
  await catcher.click()
  const portrait = page.locator('.reveal-portrait__img')
  for (let attempt = 0; attempt < 12 && !(await portrait.isVisible().catch(() => false)); attempt += 1) {
    await catcher.click().catch(() => {})
    await page.waitForTimeout(150)
  }
  await expect(portrait).toBeVisible()
  await page.screenshot({ path: shotPath(testInfo, '06-reveal-portrait.png') })

  // 跳过 → 直接进入结果一览（跳过后只保留 5 星，除非已到最后一个）
  const skip = page.locator('.reveal-skip')
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await page.locator('.result-diamond').first().isVisible().catch(() => false)) break
    if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {})
    else await catcher.click().catch(() => {})
    await page.waitForTimeout(150)
  }
  await expect(page.locator('.result-diamonds')).toBeVisible({ timeout: 15_000 })
  expect(await page.locator('.result-diamond').count()).toBeGreaterThan(0)
  // 结果面板按 HeroShowUI：十连只有「招募十次」+ 消耗行，右上角货币条 + ✕ 关闭
  const resultScope = page.locator('.gacha-overlay:has(.result-diamonds)')
  await expect(resultScope.locator('.result-btn__label--ten')).toContainText(/招募|购买/)
  await expect(resultScope.locator('.draw-cost')).toBeVisible()
  await expect(resultScope.locator('.currency-row .currency-slot')).toHaveCount(3)
  await expect(resultScope.locator('.result-close img')).toHaveAttribute('src', /com_btn_close/)
  await page.screenshot({ path: shotPath(testInfo, '07-result.png') })

  // 返回卡池页：保底提示与已抽次数应更新
  await page.locator('.result-close').click()
  await expect(page.locator('.safe-hint')).toBeVisible()
  await expect(page.locator('.sim-note')).toContainText('已抽')
  await page.screenshot({ path: shotPath(testInfo, '08-pool-after.png') })
})

test('货币条按 prefab 位置渲染，余额不足时变红并禁用抽取', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '货币槽坐标断言只在桌面视口执行')
  // 预置一个空钱包：验证「不足」分支（正常首次进入会带上模拟额度）
  // pinia-plugin-persistedstate 直接持久化 store 的 state 对象，不做外层包装
  await page.addInitScript(() => {
    window.localStorage.setItem('gachaState', JSON.stringify({
      runtimeByPool: {},
      records: [],
      owned: [],
      fragmentsByHero: {},
      crystals: 0,
      wallet: { item_20004: 0 },
      walletSeed: { item_20004: 0 },
      soundOn: false
    }))
  })
  await openGacha(page)

  const metrics = await page.evaluate(() => {
    const rect = document.querySelector('.gacha-canvas').getBoundingClientRect()
    return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, scale: rect.width / 1534 }
  })

  /**
   * 货币条整行右锚定在 design x=462（prefab 原为 526，本页在货币条与关闭按钮之间
   * 腾出音效开关后整行左移 64）；槽内是统一的「图标→数字→+」，数字变长时整行向左
   * 生长，故断言**行末位置**与行高，而不是每个图标的绝对坐标（图标位置会随数字长度浮动）。
   */
  async function expectRowAnchored() {
    const rowBox = await page.locator('.currency-row').boundingBox()
    const expectRight = metrics.centerX + 462 * metrics.scale
    expect(Math.abs(rowBox.x + rowBox.width - expectRight), '货币条行末应与 design x=462 对齐').toBeLessThan(3)
    const expectY = metrics.centerY - 335 * metrics.scale
    expect(Math.abs(rowBox.y + rowBox.height / 2 - expectY), '货币条应在 y=335').toBeLessThan(3)
    // 底牌高度必须仍是 28（不能被 40 高的「+」撑高）
    const plate = await page.locator('.currency-slot__bg').first().boundingBox()
    expect(Math.abs(plate.height - 28 * metrics.scale), '底牌高度应为 28').toBeLessThan(2)
    // 底牌必须与槽内内容垂直对齐（曾因残留 translateY(-50%) 整体偏高半格）
    const slotBox = await page.locator('.currency-slot').first().boundingBox()
    expect(Math.abs(plate.y + plate.height / 2 - (slotBox.y + slotBox.height / 2)), '底牌应与数据垂直居中对齐').toBeLessThan(2)
  }

  // 角色池：消耗券(-304→74) + 氪金(-152→226) + 神晶(+17→395)
  await expect(page.locator('.currency-slot__icon')).toHaveCount(3)
  await expectRowAnchored()

  // 余额不足：数值变红；但按钮**保持可点**并按 `buildDrawOptions` 的 `enabled = unit > 0`
  // （只取决于卡池是否有消耗，与钱包无关）。点击后走替代货币购买券的消耗确认弹窗，
  // 而不是把按钮禁用——对应 `HeroPoolUI` 的券不足分支。
  const ticketLabel = page.locator('.currency-slot').nth(0).locator('.currency-slot__label')
  await expect(ticketLabel).toHaveClass(/g-text--danger/)
  await expect(page.locator('.draw-btn').nth(0)).toBeEnabled()
  await expect(page.locator('.draw-btn').nth(1)).toBeEnabled()

  await page.locator('.draw-btn').nth(0).click()
  await expect(page.locator('.consume-modal-root')).toBeVisible()
  await expect(page.locator('.consume-modal-msg')).toContainText('购买')
  await page.screenshot({ path: shotPath(testInfo, '10-wallet-empty.png') })
  await page.locator('.consume-btn--cancel').click()
  await expect(page.locator('.consume-modal-root')).toBeHidden()

  // 点「+」补充模拟额度后恢复，且不再变红
  await page.locator('.currency-slot').nth(0).locator('.currency-slot__add').click()
  await expect(ticketLabel).not.toHaveClass(/g-text--danger/)
  await expect(page.locator('.draw-btn').nth(0)).toBeEnabled()
  const before = Number(await ticketLabel.innerText())
  expect(before).toBeGreaterThan(0)

  // 抽一次：跳过翻卡演出进入结果一览，返回后消耗券应减少 1
  await page.locator('.draw-btn').nth(0).click()
  await skipCardAni(page)
  await expect(page.locator('.reveal-click-catcher')).toBeVisible()
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await page.locator('.result-close').isVisible().catch(() => false)) break
    if (await page.locator('.reveal-skip').isVisible().catch(() => false)) await page.locator('.reveal-skip').click()
    else await page.locator('.reveal-click-catcher').click().catch(() => {})
    await page.waitForTimeout(120)
  }
  await expect(page.locator('.result-close')).toBeVisible()
  await page.locator('.result-close').click()
  await expect(ticketLabel).toHaveText(String(before - 1))

  // 记录查询：抽过之后应有一条落在弹层内的记录行（列表定位错会排到面板上方看不见）
  await page.locator('.mini-btn').nth(1).click()
  // 弹层必须真的留在文档里：曾出现「点开后被 URL 同步立刻关闭」的问题
  await expect(page.locator('.tip-panel')).toBeVisible()
  await expect(page.locator('.tip-panel__title')).toContainText('记录查询')
  const row = page.locator('.tip-record__row').first()
  await expect(row).toBeVisible()
  const rowBox = await row.boundingBox()
  const panelBox = await page.locator('.tip-panel__bg').boundingBox()
  expect(rowBox.y, '记录行应在弹层内').toBeGreaterThan(panelBox.y)
  expect(rowBox.y + rowBox.height).toBeLessThan(panelBox.y + panelBox.height)
  await expect(row).toContainText('星')
  await page.screenshot({ path: shotPath(testInfo, '13-record-rows.png') })
})

test('蛋池货币槽按源码分支：特别贩售=券+氪金+神晶，常规贩售=券+银币', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '货币槽坐标断言只在桌面视口执行')
  await openGacha(page)
  await page.locator('.kind-toggle').nth(1).click()
  await expect(page).toHaveURL(/kind=pet/)

  const metrics = await page.evaluate(() => {
    const rect = document.querySelector('.gacha-canvas').getBoundingClientRect()
    return { centerX: rect.left + rect.width / 2, scale: rect.width / 1534 }
  })

  // 默认选中「特别贩售」：源码 InitRight 对名字含「特别」的池（不分角色/蛋池）
  // 显示 消耗券 + 氪金 + 神晶（tipPosX[0/1/2]），隐藏银币。
  await expect(page.locator('.currency-slot__icon')).toHaveCount(3)
  const slotTitles = await page.locator('.currency-slot__label').evaluateAll(els =>
    els.map(el => el.getAttribute('title') ?? '')
  )
  expect(slotTitles.join('|'), '特别贩售应显示消耗券+氪金+神晶，不含银币').not.toContain('银币')
  expect(slotTitles.filter(t => t.includes('神晶')).length, '应包含神晶槽').toBe(1)

  // 行末仍右锚定 design 462，数字变长时整行向左生长、不会压到音效开关与关闭按钮。
  const rowBox = await page.locator('.currency-row').boundingBox()
  const expectRight = metrics.centerX + 462 * metrics.scale
  expect(Math.abs(rowBox.x + rowBox.width - expectRight), '货币条行末应与 design x=462 对齐').toBeLessThan(3)
  await page.screenshot({ path: shotPath(testInfo, '11-wallet-pet-special.png') })

  // 切到「常规贩售」：ke/payKe 隐藏，显示 银币(tipPosX[4]=+35) + 消耗券(tipPosX[3]=-116)。
  await page.locator('.pool-tab').nth(1).click()
  await expect(page.locator('.currency-slot__icon')).toHaveCount(2)
  const regularTitles = await page.locator('.currency-slot__label').evaluateAll(els =>
    els.map(el => el.getAttribute('title') ?? '')
  )
  expect(regularTitles.join('|'), '常规贩售应包含银币槽').toContain('银币')
  const rowBox2 = await page.locator('.currency-row').boundingBox()
  expect(Math.abs(rowBox2.x + rowBox2.width - expectRight), '常规贩售货币条行末同样对齐 462').toBeLessThan(3)
  await page.screenshot({ path: shotPath(testInfo, '11-wallet-pet-regular.png') })
})

test('窄视口下画布完整，手机横置、桌面保留横屏提示', async ({ page, isMobile }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openGacha(page)

  const box = await page.locator('.gacha-canvas').boundingBox()
  const stage = await page.locator('.gacha-stage').boundingBox()
  // contain 缩放：画布完整落在容器内，不超出边界
  expect(box.x).toBeGreaterThanOrEqual(stage.x - 1)
  expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1)
  await expect(page.locator('.gacha-viewport')).toHaveAttribute('data-rotated', String(isMobile))
  if (isMobile) {
    await expect(page.locator('.gacha-rotate-hint')).toHaveCount(0)
  } else {
    await expect(page.locator('.gacha-rotate-hint')).toBeVisible()
    const hintEvents = await page.locator('.gacha-rotate-hint').evaluate(el => getComputedStyle(el).pointerEvents)
    expect(hintEvents).toBe('none')
  }
  await page.screenshot({ path: shotPath(testInfo, '12-portrait-hint.png') })
})

test('魔物蛋卡池可切换且贴图正确', async ({ page }, testInfo) => {
  await openGacha(page)

  await page.locator('.kind-toggle').nth(1).click()
  await expect(page).toHaveURL(/kind=pet/)
  await expect(page.locator('.pool-period')).toBeVisible()
  // 切换卡池后封面是**新图**，仍在异步下载：这里必须轮询等它解码完成。
  // （`openGacha` 的等图发生在点切换之前，覆盖不到切换后新挂载的封面，
  //   直接读 naturalWidth 会与图片加载赛跑，属于测试竞态而非页面缺陷。）
  await expect.poll(
    () => page.locator('.pool-cover').evaluate(el => el.naturalWidth),
    { message: '蛋池封面应完成加载（宽度 > 800）' }
  ).toBeGreaterThan(800)
  await page.locator('.draw-btn').first().click()
  // 蛋池走 GachaPetPanel（PetGachaAniPanel 完整还原）：蛋袋等待点击 → 出蛋揭晓 UI
  await expect(page.locator('.pet-catcher')).toBeVisible()
  const diamond = page.locator('.pet-diamond')
  for (let attempt = 0; attempt < 6 && !(await diamond.isVisible().catch(() => false)); attempt += 1) {
    await page.locator('.pet-catcher').click()
    await page.waitForTimeout(600)
  }
  await expect(diamond).toBeVisible()
  await expect(page.locator('.pet-name__text').first()).toBeVisible()
  await page.screenshot({ path: shotPath(testInfo, '09-pet-reveal.png') })
})
