import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('every published handbook card and form has a real image after removing the duplicate directory', () => {
  const root = new URL('../../public/', import.meta.url)
  const { monsters } = JSON.parse(readFileSync(new URL('data/parsed/monsters.json', root)))
  assert.ok(monsters.length > 0)
  for (const monster of monsters) {
    assert.ok(existsSync(new URL(`images/PicHandBookPanel_Atlas/${monster.icon}.png`, root)), monster.id)
    for (const form of [...monster.forms, ...(monster.summons || [])]) {
      assert.ok(form.portraitPath, form.id)
      assert.ok(existsSync(new URL(form.portraitPath.replace(/^\//, ''), root)), `${form.id}: ${form.portraitPath}`)
    }
  }
  assert.equal(existsSync(new URL('images/MonstersView/', root)), false)
})
