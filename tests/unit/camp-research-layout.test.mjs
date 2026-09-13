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
      assert.ok(child.y > parent.y)
    }
    assert.equal(JSON.stringify(entries), before)
  }
})

test('empty and partial diagrams are supported; cyclic dependencies fail explicitly', () => {
  assert.deepEqual(layoutCampResearch([]).nodes, [])
  assert.equal(layoutCampResearch([{ id: 'a', prerequisite: { id: 'missing' } }]).edges.length, 0)
  assert.throws(() => layoutCampResearch([{ id: 'a', prerequisite: { id: 'b' } }, { id: 'b', prerequisite: { id: 'a' } }]), /Cyclic/)
})
