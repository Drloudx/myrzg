/** One-time, explicitly scoped cleanup. Preview by default; --apply backs up every source first. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const images = path.join(root, 'public/images')
const backup = path.resolve(root, '../backups/image-consolidation-2026-09-11')
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const slash = value => value.replaceAll('\\', '/')
const files = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${entry.name}`)
  const file = path.join(dir, entry.name)
  return entry.isDirectory() ? files(file) : [file]
})
const plan = []
const inside = (base, file) => {
  const relative = path.relative(base, file)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Out of scope: ${file}`)
  return file
}
function add(from, to = null) {
  const source = inside(images, path.resolve(images, from))
  if (!fs.existsSync(source)) return
  const target = to ? inside(images, path.resolve(images, to)) : null
  const bytes = fs.readFileSync(source)
  if (target && fs.existsSync(target) && !fs.readFileSync(target).equals(bytes)) throw new Error(`Different target: ${to}`)
  plan.push({ from, to, bytes: bytes.length, sha256: hash(bytes), alreadyShared: !!target && fs.existsSync(target) })
}
for (const [oldDir, newDir] of [['PicHandBookPanel', 'PicHandBookPanel_Atlas'], ['CommonAtlas', 'Common_Atlas']]) {
  for (const file of files(path.join(images, oldDir))) add(slash(path.relative(images, file)), `${newDir}/${slash(path.relative(path.join(images, oldDir), file))}`)
}
for (const file of files(path.join(images, 'MonstersView'))) {
  const name = path.basename(file)
  // Preserve user-created model previews. Ordinary handbook pictures already live in its atlas.
  const to = name === 'colect_obj_mon055.png' ? 'model-previews/obj_mon055.png'
    : name === 'colect_obj_mon069.png' ? 'model-previews/obj_mon069.png' : null
  add(`MonstersView/${name}`, to)
}
for (const file of files(path.join(images, 'EmailPanel'))) {
  const name = path.basename(file)
  const folder = name === 'mail_botm.png' ? 'uipanel/emailpanel'
    : name.startsWith('mail_') ? 'EmailPanel_Atlas' : 'Common_Atlas'
  add(slash(path.relative(images, file)), `${folder}/${name}`)
}
for (const file of files(path.join(images, 'gacha/ui')).filter(file => path.basename(file).startsWith('com_'))) {
  add(slash(path.relative(images, file)), `Common_Atlas/${path.basename(file)}`)
}
for (const file of files(path.join(images, 'gacha/reveal'))) {
  add(slash(path.relative(images, file)), `uipanel/herogachashowpanel/${path.basename(file)}`)
}
add('gacha/reveal.png', 'uipanel/herogachashowpanel/bg.png')

// Validate collisions across planned targets, including targets created earlier in this run.
const targets = new Map()
for (const entry of plan.filter(entry => entry.to)) {
  if (targets.has(entry.to) && targets.get(entry.to) !== entry.sha256) throw new Error(`Conflicting planned target: ${entry.to}`)
  targets.set(entry.to, entry.sha256)
}
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', backup, files: plan.length,
  sourceBytes: plan.reduce((sum, entry) => sum + entry.bytes, 0), plan }, null, 2))
if (process.argv.includes('--apply')) {
  // Back up and validate the complete plan before removing any source.
  for (const entry of plan) {
    const source = path.join(images, entry.from)
    const saved = inside(backup, path.resolve(backup, entry.from))
    fs.mkdirSync(path.dirname(saved), { recursive: true })
    if (!fs.existsSync(saved)) fs.copyFileSync(source, saved, fs.constants.COPYFILE_EXCL)
    if (hash(fs.readFileSync(saved)) !== entry.sha256) throw new Error(`Backup differs: ${saved}`)
  }
  fs.mkdirSync(backup, { recursive: true })
  fs.writeFileSync(path.join(backup, `manifest-${Date.now()}.json`), JSON.stringify(plan, null, 2))
  for (const entry of plan.filter(entry => entry.to)) {
    const target = path.join(images, entry.to)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(images, entry.from), target, fs.constants.COPYFILE_EXCL)
    if (hash(fs.readFileSync(target)) !== entry.sha256) throw new Error(`Target differs: ${target}`)
  }
  for (const entry of plan) {
    const source = inside(images, path.resolve(images, entry.from))
    if (hash(fs.readFileSync(source)) !== entry.sha256) throw new Error(`Source changed: ${source}`)
    fs.unlinkSync(source)
  }
  // Only remove these explicitly named directories, and only when empty.
  for (const relative of ['MonstersView', 'PicHandBookPanel', 'CommonAtlas', 'EmailPanel/game-skin', 'EmailPanel', 'gacha/reveal']) {
    const dir = inside(images, path.resolve(images, relative))
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
  }
  console.log('Completed; every removed source is recoverable from the verified backup.')
}
