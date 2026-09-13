import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildHeroesFile } from '../../scripts/parse/heroes.mjs'
import { buildPartnerMailboxes, getPartnerMailPresentation, parseHeroMail } from '../../src/utils/partnerMailData.js'
import { validateResource } from '../../src/utils/resourceSchemas.js'
import { CALL_NAME_REPLACE, cleanDialogueLine, cleanMailContent } from '../../src/utils/gameMappings.js'

const read = relative => JSON.parse(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
const itemData = read('public/data/parsed/items.json')
const mailTable = read('raw/hero/heroMail.json').datas
const archiveTable = read('raw/hero/heroArchives.json').archives

test('mail uses shared names for both square and curly placeholders without losing line breaks', () => {
  for (const [key, value] of Object.entries(CALL_NAME_REPLACE)) {
    const text = `[myName]${key}\n{myName}[${key.slice(1, -1)}]`
    assert.equal(cleanMailContent(text), `小工匠${value}\n小工匠${value}`)
    assert.equal(cleanDialogueLine(text), cleanMailContent(text))
  }
  assert.equal(cleanMailContent('[hide]{邮筒}\n[b]你好[bEnd]'), '邮筒\n你好')
  assert.ok(cleanMailContent(mailTable.mail_s_3_1_2.content).includes('大哥哥（大姐姐）'))
  for (const mail of Object.values(mailTable)) assert.doesNotMatch(cleanMailContent(mail.content), /[\[{](?:callName[1-4]|myName)[\]}]/)
})

test('mailboxes cover every game-visible source mail, including hidden catalogue senders', () => {
  const data = buildHeroesFile(itemData).data
  assert.equal(validateResource('data/parsed/heroes.json', data), true)
  assert.throws(() => validateResource('data/parsed/heroes.json', { ...data, mailboxes: undefined }))
  const { heroes, mailboxes } = data
  const actual = mailboxes.flatMap(box => box.mails.map(mail => ({ ...mail, heroId: box.id })))
  const expected = Object.entries(mailTable).filter(([id, mail]) => mail.mailType !== 2 ||
    (archiveTable[mail.heroTypeId] || []).some(archive => archive.mailTypeId === id))
  assert.deepEqual(actual.map(mail => mail.id).sort(), expected.map(([id]) => id).sort())
  assert.equal(actual.length, 61)
  assert.equal(mailboxes.length, 36)
  for (const mail of actual) {
    assert.equal(mail.heroId, mailTable[mail.id].heroTypeId)
    assert.equal(mail.content, mailTable[mail.id].content)
  }
  for (const id of ['hero_028', 'hero_047', 'hero_057']) {
    assert.ok(mailboxes.find(box => box.id === id)?.mails.length)
    assert.ok(!heroes.some(hero => hero.id === id), 'do not unhide the hero catalogue')
  }
  for (const hero of heroes) for (const archive of hero.archives.filter(a => a.mail)) {
    assert.deepEqual(mailboxes.find(box => box.id === hero.id).mails.find(m => m.id === archive.mail.id), archive.mail)
  }
})

test('plain mail, story attachments, task invitations and archive tasks use distinct colored icons', () => {
  const context = { mailDatas: mailTable, archivesDatas: archiveTable, rewards: itemData.rewards, items: itemData.items }
  assert.equal(getPartnerMailPresentation(parseHeroMail('mail_m_1_1', context)).icon, 'mail_list_new')
  const story = parseHeroMail('mail_m_1_2', context)
  assert.equal(getPartnerMailPresentation(story).icon, 'mail_list_new_item')
  assert.equal(getPartnerMailPresentation(story).rewardLabel.sprite, 'com_item_encl')
  assert.deepEqual(story.reward.items.map(item => [item.id, item.count]), [['money', 500], ['item_30012', 3], ['item_30015', 3]])
  assert.deepEqual(story.reward.items.map(item => item.typeId), ['item_00001', 'item_30012', 'item_30015'])
  assert.equal(story.image, '/images/uipanel/emailpanel/heromailimg/01.png')
  const archive = parseHeroMail('mail_fav_hero_025_1', context)
  assert.equal(getPartnerMailPresentation(archive).icon, 'mail_list_new_task')
  assert.equal(getPartnerMailPresentation(archive).rewardLabel.sprite, 'com_item_archive')
  // No type-1 task invitations exist in the current table; preserve priority for future data.
  const task = parseHeroMail('task', { ...context, mailDatas: {
    task: { ...mailTable.mail_m_1_2, mailType: 1, taskTypeId: 'test_task' }
  } })
  assert.equal(getPartnerMailPresentation(task).icon, 'mail_list_new_task_pt')
  assert.equal(task.reward, null, 'task completion rewards are not mail attachments')
  assert.equal(getPartnerMailPresentation({ mailType: 1, hasAttachment: true, reward: null }).icon, 'mail_list_new_item')
})

test('orphan archive mail is discarded by sender relation and duplicate links do not duplicate mail', () => {
  const source = { typeId: 'hero', name: '角色', rare: 3, job: 1, element: 1 }
  const mailDatas = { letter: { heroTypeId: 'hero', mailType: 2, title: '来信' } }
  const context = { heroDatas: { hero: source }, mailDatas, rewards: {}, items: [] }
  assert.deepEqual(buildPartnerMailboxes({ ...context, archivesDatas: { other: [{ mailTypeId: 'letter' }] } }), [])
  const boxes = buildPartnerMailboxes({ ...context, archivesDatas: { hero: [{ mailTypeId: 'letter' }, { mailTypeId: 'letter' }] } })
  assert.equal(boxes[0].mails.length, 1)
})

test('mail type and archive rewards come from the corresponding source tables', () => {
  const { heroes } = buildHeroesFile(itemData).data
  const visit = heroes.find(hero => hero.id === 'hero_025').archives.find(archive => archive.mail)
  assert.equal(visit.type, 1)
  assert.equal(visit.mail.mailType, 2)
  assert.equal(visit.mail.reward.id, 'heroArchives01')
  let checked = 0
  for (const hero of heroes) for (const archive of hero.archives.filter(entry => entry.mail)) {
    const mail = archive.mail
    assert.equal(mail.mailType, mailTable[mail.id].mailType, mail.id)
    if (mail.mailType === 2) {
      const source = archiveTable[hero.id].find(entry => entry.mailTypeId === mail.id)
      assert.equal(mail.reward?.id || '', source.reward || '', mail.id)
    }
    checked++
  }
  assert.ok(checked > 30)
})

test('currency reward frames follow item quality and preserve the configured amounts', () => {
  // Deliberately vary catalogue quality to catch a fixed white or gold frame in the parser.
  const changed = structuredClone(itemData)
  changed.items.find(item => item.typeId === 'item_00001').quality = 3
  changed.items.find(item => item.typeId === 'item_00002').quality = 4
  const { heroes } = buildHeroesFile(changed).data
  const reward = heroes.find(hero => hero.id === 'hero_025').archives.find(archive => archive.mail).mail.reward
  assert.deepEqual(reward.items.map(item => [item.id, item.quality, item.count]), [['money', 3, 1000], ['ke', 4, 100]])
})
