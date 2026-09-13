/** Scoped migration of the 98 gacha artwork variants. Preview first; backups precede all writes. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const images = path.join(root, 'public/images')
const backup = path.resolve(root, '../vue-myrzg备份-资源/gacha-sharing-2026-09-11')
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const inside = (base, relative) => {
  const file = path.resolve(base, relative)
  const rel = path.relative(base, file)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Out of scope: ${file}`)
  // Reject symlinks/junctions in every existing component, not only the leaf.
  for (let cursor = file; cursor !== base; cursor = path.dirname(cursor)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Linked path: ${cursor}`)
  }
  return file
}
const list = dir => {
  const absolute = inside(images, dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true }).filter(entry => {
    if (entry.isSymbolicLink()) throw new Error(`Linked entry: ${entry.name}`)
    if (entry.isFile() && !entry.name.endsWith('.png')) throw new Error(`Unexpected file: ${entry.name}`)
    return entry.isFile()
  }).map(entry => entry.name)
}
const writes = new Map()
const remove = new Set()
const originals = [
  ['portraits', 'chara', 'chara/l', '../4.24路资源包/assets/res/texture/chara/l'],
  ['fragments', 'HeroInfoPanel', 'HeroInfoPanel_Atlas', '../UI_Atlases/HeroInfoPanel_Atlas/sprites'],
  ['eggs', 'eggs', 'eggs', '../4.24路资源包/assets/res/texture/pet/eggs'],
]
for (const [sub, oldDir, newDir, sourceDir] of originals) {
  if (oldDir !== newDir) for (const name of list(oldDir)) {
    if (!fs.existsSync(path.resolve(root, sourceDir, name))) throw new Error(`Unknown source name: ${name}`)
    writes.set(`${newDir}/${name}`, `${oldDir}/${name}`)
    remove.add(`${oldDir}/${name}`)
  }
  for (const name of list(`gacha/${sub}`)) {
    const from = `gacha/${sub}/${name}`
    if (sha(inside(images, from)) !== sha(path.resolve(root, sourceDir, name))) throw new Error(`Not original: ${from}`)
    writes.set(`${newDir}/${name}`, from)
    remove.add(from)
  }
}
const snapshots = new Map()
for (const file of new Set([...remove, ...writes.keys(), ...writes.values()])) {
  const absolute = inside(images, file)
  if (fs.existsSync(absolute)) snapshots.set(file, { file, bytes: fs.statSync(absolute).size, sha256: sha(absolute) })
}
const plan = [...writes].map(([to, from]) => ({ from, to, sha256: sha(inside(images, from)) }))
// Pre-existing destinations may only differ for the explicitly selected shared eggs.
for (const entry of plan) {
  const to = inside(images, entry.to)
  if (fs.existsSync(to) && sha(to) !== entry.sha256 && !entry.to.startsWith('eggs/')) throw new Error(`Conflicting target: ${entry.to}`)
}
const removedBytes = [...remove].reduce((n, file) => n + snapshots.get(file).bytes, 0)
const writtenDelta = plan.reduce((n, entry) => n + snapshots.get(entry.from).bytes - (snapshots.get(entry.to)?.bytes || 0), 0)
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', images, backup,
  backups: snapshots.size, writes: plan.length, removals: remove.size, savedBytes: removedBytes - writtenDelta,
  destinations: originals.map(entry => entry[2]) }, null, 2))
if (process.argv.includes('--apply') && plan.length) {
  for (const entry of snapshots.values()) {
    const saved = inside(backup, `images/${entry.file}`)
    fs.mkdirSync(path.dirname(saved), { recursive: true })
    if (!fs.existsSync(saved)) fs.copyFileSync(inside(images, entry.file), saved, fs.constants.COPYFILE_EXCL)
    if (sha(saved) !== entry.sha256) throw new Error(`Backup differs: ${entry.file}`)
  }
  const manifestFile = inside(backup, `manifest-${Date.now()}.json`)
  fs.writeFileSync(manifestFile, JSON.stringify({ snapshots: [...snapshots.values()], writes: plan, remove: [...remove] }, null, 2))
  for (const entry of snapshots.values()) {
    if (sha(inside(images, entry.file)) !== entry.sha256) throw new Error(`Changed since planning: ${entry.file}`)
  }
  for (const entry of plan) {
    const destination = inside(images, entry.to)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(inside(images, entry.from), destination)
    if (sha(destination) !== entry.sha256) throw new Error(`Copy differs: ${entry.to}`)
  }
  for (const file of remove) {
    const absolute = inside(images, file)
    if (sha(absolute) !== snapshots.get(file).sha256) throw new Error(`Changed before deletion: ${file}`)
    fs.unlinkSync(absolute)
  }
  for (const dir of ['gacha/portraits', 'gacha/fragments', 'gacha/eggs', 'HeroInfoPanel']) {
    const absolute = inside(images, dir)
    if (fs.existsSync(absolute) && fs.readdirSync(absolute).length === 0) fs.rmdirSync(absolute)
  }
  console.log('Shared originals verified; all replaced or removed files are backed up. No images re-encoded.')
}
