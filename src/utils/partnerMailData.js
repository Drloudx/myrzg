import { parseRewardGroups, REWARD_MODE_INFO } from './acquisitionRules.js'
import { getItemImageUrl } from './itemParser.js'

// EmailItemTemp.Init(HeroMailData): always use the colored variant in the catalogue.
export function getPartnerMailPresentation(mail) {
  if (mail?.mailType === 2) return {
    icon: 'mail_list_new_task', rewardLabel: { sprite: 'com_item_archive', text: '档案奖励' }
  }
  if (mail?.taskTypeId) return {
    icon: 'mail_list_new_task_pt', rewardLabel: { sprite: 'com_item_task', text: '任务奖励' }
  }
  return {
    icon: mail?.hasAttachment ? 'mail_list_new_item' : 'mail_list_new',
    rewardLabel: { sprite: 'com_item_encl', text: '附件奖励' }
  }
}

export function parseHeroMail(id, { mailDatas, archivesDatas, rewards, items }) {
  const source = mailDatas[id]
  if (!source) return null
  const mailType = Number(source.mailType)
  const archive = (archivesDatas[source.heroTypeId] || []).find(entry => entry.mailTypeId === id)
  // HeroMailServerData.GetMail / EmailPanelUI.InitHeroMail discard orphan archive mail.
  if (mailType === 2 && !archive) return null
  // RefreshHeroMailUI shows archive rewards or ordinary attachments, not task completion rewards.
  const rewardId = mailType === 2 ? archive.reward : source.taskTypeId ? '' : source.reward
  const rewardItems = parseRewardGroups(rewardId, { rewards, items, getItemImageUrl }).flatMap(group =>
    group.rules.filter(rule => rule.typeId && rule.actualProb !== 0).map(rule => ({
      id: REWARD_MODE_INFO[rule.mode] ? rule.mode : rule.typeId,
      typeId: rule.typeId,
      name: rule.targetName,
      img: rule.targetImg,
      quality: rule.targetQuality,
      count: rule.min === rule.max ? rule.min : `${rule.min}–${rule.max}`,
      chance: rule.actualProb
    })))
  return {
    id, mailType,
    title: source.title || '',
    content: source.content || '',
    hasAttachment: Boolean(source.reward),
    reward: rewardId ? { id: rewardId, items: rewardItems } : null,
    taskTypeId: source.taskTypeId || '',
    getTaskText: source.getTaskText || '',
    image: source.img ? `/images/uipanel/emailpanel/heromailimg/${source.img}.png` : ''
  }
}

export function buildPartnerMailboxes({ heroDatas, ...context }) {
  const mailboxes = new Map()
  for (const [id, source] of Object.entries(context.mailDatas)) {
    const hero = heroDatas[source.heroTypeId]
    if (!hero) throw new Error(`邮件 ${id} 缺少发件人配置 ${source.heroTypeId}`)
    const mail = parseHeroMail(id, context)
    if (!mail) continue
    if (!mailboxes.has(source.heroTypeId)) {
      // Mail senders are independent of the playable hero catalogue's hide flag.
      mailboxes.set(source.heroTypeId, {
        id: source.heroTypeId, name: hero.name, name2: hero.name2 || '', icon: hero.icon || '',
        rare: hero.rare, job: hero.job, element: hero.element, mails: []
      })
    }
    mailboxes.get(source.heroTypeId).mails.push(mail)
  }
  // Preserve source mail order; no fictional account delivery timestamps.
  return [...mailboxes.values()].sort((a, b) => b.rare - a.rare || a.id.localeCompare(b.id))
}
