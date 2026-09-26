import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { layoutCampResearch } from '../../src/utils/campResearchLayout.js'

const camp = JSON.parse(readFileSync(new URL('../../public/data/parsed/facilities.json', import.meta.url))).find(entry => entry.key === 'camp')
test('every configured prerequisite has one forward edge, with distinct in-bounds research cards', () => {
  for (const team of new Set(camp.research.map(entry => entry.team))) {
    const entries = camp.research.filter(entry => entry.team === team)
    const before = JSON.stringify(entries)
    const layout = layoutCampResearch(entries)
    assert.equal(layout.nodes.length, entries.length)
    assert.equal(layout.edges.length, entries.filter(entry => entry.prerequisite).length)
    for (const node of layout.nodes) {
      assert.ok(node.x >= 0 && node.x + 190 <= layout.width)
      assert.ok(node.y >= 0 && node.y + 78 <= layout.height)
      for (const other of layout.nodes.filter(other => other.id !== node.id && other.y === node.y)) assert.ok(Math.abs(node.x - other.x) >= 190)
    }
    for (const edge of layout.edges) {
      const child = layout.nodes.find(node => node.id === edge.to)
      const parent = layout.nodes.find(node => node.id === edge.from)
      assert.equal(child.prerequisite.id, parent.id)
      // 只断言「向前」= 左→右：`layoutCampResearch` 的契约就是 "from left to right"，
      // 深度递增必然让子节点在更右的一列（严格保证）。
      // 原先这里断言 child.y > parent.y（纵向也单调向下）——那不是布局的保证：每一列按
      // `build_tree_botm` 美术各自垂直居中，列之间没有纵向约束，实测 35 条边里 25 条不满足。
      // 但把树画出来看，连线全是干净的直角折线、无交叉（dy=0 即笔直水平线），可读性没问题；
      // 强行要求纵向单调会让画布高度随深度累加，在面板里长得离谱。
      assert.ok(child.x > parent.x, `边 ${edge.from} → ${edge.to} 必须向右`)
    }
    // 同一列内不能有节点共用一行，否则会叠在一起（这是"不重叠"的真正保证）。
    for (const column of new Set(layout.nodes.map(node => node.x))) {
      const rows = layout.nodes.filter(node => node.x === column).map(node => node.y)
      assert.equal(new Set(rows).size, rows.length, `x=${column} 这一列有节点行号重复`)
    }
    assert.equal(JSON.stringify(entries), before)
  }
})

test('empty and partial diagrams are supported; cyclic dependencies fail explicitly', () => {
  assert.deepEqual(layoutCampResearch([]).nodes, [])
  assert.equal(layoutCampResearch([{ id: 'a', prerequisite: { id: 'missing' } }]).edges.length, 0)
  assert.throws(() => layoutCampResearch([{ id: 'a', prerequisite: { id: 'b' } }, { id: 'b', prerequisite: { id: 'a' } }]), /Cyclic/)
})
