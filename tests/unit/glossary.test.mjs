import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  STATUS_RULES,
  isCookBuff,
  isInternalBuffName,
  matchCanonicalStatus
} from '../../src/utils/buffParser.js'
import { buildGlossaryData, facetCountsForGroup, GLOSSARY_SECTIONS } from '../../src/utils/glossaryData.js'

const readRaw = name => JSON.parse(readFileSync(new URL(`../../raw/${name}`, import.meta.url), 'utf8'))
const buffJson = readRaw('buff.json')
const readParsed = name => JSON.parse(readFileSync(new URL(`../../public/data/parsed/${name}`, import.meta.url), 'utf8'))
const monstersJson = readParsed('monsters.json').monsters
const glossary = buildGlossaryData({
  buffJson,
  heroJson: readRaw('hero.json'),
  petJson: readRaw('pet.json'),
  monJson: readRaw('mon.json'),
  skillJson: readRaw('skill.json'),
  skillTriggerJson: readRaw('skillTrigger.json'),
  itemJson: readRaw('item.json'),
  heroSkillUpgradeJson: readRaw('heroSkillUpgrade.json'),
  fileMonJson: readRaw('fileMon.json'),
  monstersJson
})
const buffData = buffJson

test('三大板块分组清晰，且每组的 count 与实际词条数一致', () => {
  assert.deepEqual(GLOSSARY_SECTIONS.map(g => g.id), ['status', 'stats', 'mechanics'])
  assert.deepEqual(glossary.sections.map(g => g.id), ['status', 'stats', 'mechanics'])
  for (const sec of glossary.sections) {
    const actual = glossary.entries.filter(entry => entry.group === sec.id).length
    assert.equal(sec.count, actual, `分组「${sec.name}」标注 ${sec.count}，实际 ${actual}`)
    assert.ok(sec.count > 0, `分组「${sec.name}」不应为空`)
  }
  const known = new Set(GLOSSARY_SECTIONS.map(g => g.id))
  for (const entry of glossary.entries) {
    assert.ok(known.has(entry.group), `${entry.name} 的分组 ${entry.group} 未定义`)
  }
  assert.equal(glossary.sections.reduce((sum, g) => sum + g.count, 0), glossary.meta.entries)
})

test('词条名唯一，且每条词条都具备百科人话摘要与规则列表', () => {
  const names = glossary.entries.map(e => e.name)
  assert.equal(new Set(names).size, names.length, '词条名不应重复')
  for (const entry of glossary.entries) {
    assert.ok(entry.summary && entry.summary.trim().length > 0, `词条「${entry.name}」缺少百科摘要`)
    assert.ok(entry.rules && entry.rules.length > 0, `词条「${entry.name}」缺少规则列表`)
    for (const r of entry.rules) {
      assert.ok(r.label && r.label.trim().length > 0, `词条「${entry.name}」有空 label 规则`)
      assert.ok(r.value && r.value.trim().length > 0, `词条「${entry.name}」有空 value 规则`)
    }
  }
})

test('分类筛选按当前大组准确统计，且不漏项', () => {
  for (const sec of glossary.sections) {
    const { categories } = facetCountsForGroup(glossary.entries, sec.id)
    const scoped = glossary.entries.filter(entry => entry.group === sec.id)
    for (const { category, count } of categories) {
      const actual = scoped.filter(e => e.category === category).length
      assert.equal(count, actual, `分组「${sec.name}」分类「${category}」计数 ${count}，实际 ${actual}`)
    }
  }
})

test('异常状态板块包含玩家重点关注的核心状态', () => {
  const statusNames = glossary.entries.filter(e => e.group === 'status').map(e => e.name)
  for (const expected of ['中毒', '燃烧', '流血', '撕裂', '眩晕', '定身', '嘲讽', '护盾', '防御下降']) {
    assert.ok(statusNames.includes(expected), `异常状态板块应包含「${expected}」`)
  }
})

test('自动提取施加来源：中毒与眩晕包含角色与怪物跳转数据', () => {
  const poison = glossary.entries.find(e => e.name === '中毒')
  assert.ok(poison, '应存在中毒词条')
  assert.ok(poison.sources.heroes.length > 0, '中毒应有施加角色')
  assert.ok(poison.sources.monsters.length > 0, '中毒应有施加怪物')
  assert.ok(poison.sources.heroes.every(h => h.id && h.name), '角色的来源数据必须包含 id 和 name')
  assert.ok(poison.sources.monsters.every(m => m.id && m.name), '怪物的来源数据必须包含 id 和 name')

  // 黑名单联动校验：黑森林与霜烬平原怪物不应出现在来源中
  const poisonMonNames = poison.sources.monsters.map(m => m.name)
  assert.ok(!poisonMonNames.some(n => n.includes('蕈')), '黑森林蕈类怪物（如腐朽蕈、尸术蕈、尖笑蕈）必须从来源中过滤')
  assert.ok(!poisonMonNames.some(n => n.includes('辛普拉')), '黑森林怪物辛普拉的长子必须从来源中过滤')
  assert.ok(!poisonMonNames.some(n => n.includes('艾伦瑟')), '腐朽灵鹿艾伦瑟必须从来源中过滤')
  assert.ok(poisonMonNames.includes('砂蜘蛛女王'), '正常大世界怪物（砂蜘蛛女王）必须保留')

  const stun = glossary.entries.find(e => e.name === '眩晕')
  assert.ok(stun, '应存在眩晕词条')
  assert.ok(stun.sources.heroes.length > 0, '眩晕应有施加角色')
  assert.ok(stun.sources.monsters.length > 0, '眩晕应有施加怪物')
  assert.ok(stun.tags.includes('特殊眩晕'), '眩晕标签中应包含「特殊眩晕」别名以供搜索')
  const tulode = stun.sources.monsters.find(m => m.name.includes('图洛德'))
  assert.ok(tulode, '眩晕施加来源中应包含怪物“魔爪”图洛德')
  assert.equal(tulode.skillName, '尖刺', '图洛德施加特殊眩晕的技能应为「尖刺」')

  // 怪物图鉴技能名与实体对齐校验：
  const kongshou = stun.sources.monsters.find(m => m.name.includes('强壮恐兽'))
  assert.ok(kongshou, '眩晕施加怪物中应包含强壮恐兽')
  assert.notEqual(kongshou.skillName, 'mon_04702', '强壮恐兽技能名不应为内部代码 ID mon_04702')
  assert.equal(kongshou.skillName, '技能1', '强壮恐兽技能名应与怪物图鉴完全一致显示为「技能1」')

  const ansen = stun.sources.monsters.find(m => m.name.includes('安瑟恩单元'))
  if (ansen) {
    assert.notEqual(ansen.skillName, '遗迹boss三技能', '安瑟恩单元不应显示废弃占位名「遗迹boss三技能」')
  }

  assert.ok(!stun.sources.monsters.some(m => m.name.includes('木桩') || m.name.includes('稻草人')), '怪物来源不应包含攻击木桩与稻草人等道具')
  assert.ok(!stun.sources.monsters.some(m => m.name.includes('米拉贝尔') || m.name.includes('埃迪蒂') || m.name.includes('艾尔菲帕')), '怪物来源不应包含NPC角色')

  const shield = glossary.entries.find(e => e.name === '护盾')
  assert.ok(shield, '应存在护盾词条')
  assert.ok(shield.tags.includes('水盾'), '护盾标签中应包含「水盾」以供搜索')
  const alexia = shield.sources.heroes.find(h => h.name.includes('阿莱克西娅'))
  assert.ok(alexia, '护盾施加角色应包含阿莱克西娅')
  assert.equal(alexia.skillName, '胜军之加护', '阿莱克西娅施加护盾技能应为「胜军之加护」')
})

test('料理与内部代号不进入词条百科', () => {
  for (const entry of glossary.entries) {
    assert.equal(isInternalBuffName(entry.name), false, `「${entry.name}」是内部代号，不应进入百科`)
    assert.equal(/^料理：/.test(entry.name), false, `料理「${entry.name}」不应进入百科`)
  }
  for (const buff of Object.values(buffData)) {
    if (buff.buffType === 'cook') {
      assert.equal(isCookBuff(buff), true)
    }
  }
})

test('战斗属性板块包含硬性上限约束与公式', () => {
  const statsEntries = glossary.entries.filter(e => e.group === 'stats')
  const atkSpeed = statsEntries.find(e => e.name.includes('攻击速度'))
  assert.ok(atkSpeed, '应包含攻击速度词条')
  assert.ok(atkSpeed.rules.some(r => r.value.includes('300%')), '攻速词条必须明确标注 +300% 上限')

  const cdReduce = statsEntries.find(e => e.name.includes('冷却缩减'))
  assert.ok(cdReduce, '应包含冷却缩减词条')
  assert.ok(cdReduce.rules.some(r => r.value.includes('50%')), '冷却缩减词条必须明确标注 50% 上限')
})

test('核心机制板块包含伤害结算与等级压制机制', () => {
  const mechEntries = glossary.entries.filter(e => e.group === 'mechanics')
  const dmgFlow = mechEntries.find(e => e.name.includes('伤害计算流程'))
  assert.ok(dmgFlow, '应包含伤害计算流程词条')

  const levelSupp = mechEntries.find(e => e.name.includes('等级压制'))
  assert.ok(levelSupp, '应包含等级压制词条')
  assert.ok(levelSupp.rules.some(r => r.value.includes('50%')), '等级压制必须说明 50% 减伤上限')
})
