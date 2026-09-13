/** Read-only image inventory. Does not rename, delete, compress or rebuild assets. */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const parent = dirname(root)
const imageRoot = join(root, 'public/images')
const imagePattern = /\.(png|jpe?g|webp|gif|avif|svg)$/i
const slash = value => value.replaceAll('\\', '/')
const hash = value => createHash('sha256').update(value).digest('hex')
const normalizedName = file => basename(file).replace(/\s+#\d+(?=\.)/, '').toLowerCase()
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : []
  })
}
const sourceIndex = new Map()
for (const source of ['UI_Atlases', '4.24路资源包']) {
  for (const file of walk(join(parent, source)).filter(file => imagePattern.test(file))) {
    const key = normalizedName(file)
    if (!sourceIndex.has(key)) sourceIndex.set(key, [])
    sourceIndex.get(key).push(file)
  }
}
const sourceHashes = new Map()
const sourceHash = file => {
  if (!sourceHashes.has(file)) sourceHashes.set(file, hash(readFileSync(file)))
  return sourceHashes.get(file)
}
const files = walk(imageRoot)
const entries = []
const errors = []
for (const file of files.filter(file => imagePattern.test(file))) {
  const bytes = readFileSync(file)
  const entry = { path: slash(relative(imageRoot, file)), bytes: bytes.length, hash: hash(bytes) }
  const candidates = sourceIndex.get(normalizedName(file)) || []
  entry.exactSources = candidates.filter(candidate => sourceHash(candidate) === entry.hash).map(candidate => slash(relative(parent, candidate)))
  entry.nameSources = candidates.map(candidate => slash(relative(parent, candidate)))
  if (extname(file).toLowerCase() !== '.svg') {
    try {
      const { data, info } = await sharp(bytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      entry.dimensions = `${info.width}x${info.height}x${info.channels}`
      entry.pixelHash = hash(Buffer.concat([Buffer.from(entry.dimensions), data]))
    } catch (error) { errors.push({ path: entry.path, error: error.message }) }
  }
  entries.push(entry)
}
function groups(key) {
  const grouped = new Map()
  for (const entry of entries) {
    if (!entry[key]) continue
    if (!grouped.has(entry[key])) grouped.set(entry[key], [])
    grouped.get(entry[key]).push(entry)
  }
  return [...grouped.values()].filter(group => group.length > 1).map(group => ({
    files: group.map(entry => entry.path),
    reclaimableBytes: group.reduce((sum, entry) => sum + entry.bytes, 0) - Math.min(...group.map(entry => entry.bytes)),
    byteIdentical: new Set(group.map(entry => entry.hash)).size === 1
  })).sort((a, b) => b.reclaimableBytes - a.reclaimableBytes)
}
const folderMap = new Map()
for (const entry of entries) {
  const folder = entry.path.split('/')[0]
  if (!folderMap.has(folder)) folderMap.set(folder, { folder, count: 0, bytes: 0, exactSourceCount: 0, nameOnlyCount: 0, noNameMatchCount: 0, sourceDirectories: {} })
  const row = folderMap.get(folder)
  row.count++
  row.bytes += entry.bytes
  if (entry.exactSources.length) row.exactSourceCount++
  else if (entry.nameSources.length) row.nameOnlyCount++
  else row.noNameMatchCount++
  for (const dir of new Set((entry.exactSources.length ? entry.exactSources : entry.nameSources).map(source => slash(dirname(source))))) {
    row.sourceDirectories[dir] = (row.sourceDirectories[dir] || 0) + 1
  }
}
const byteDuplicates = groups('hash')
const pixelDuplicates = groups('pixelHash')
const names = new Map()
for (const entry of entries) {
  const key = normalizedName(entry.path)
  if (!names.has(key)) names.set(key, [])
  names.get(key).push(entry)
}
const nameVariants = [...names.entries()]
  .filter(([, group]) => group.length > 1 && new Set(group.map(entry => entry.hash)).size > 1)
  .map(([name, group]) => ({ name, files: group.map(entry => ({ path: entry.path, bytes: entry.bytes, dimensions: entry.dimensions,
    exactSources: entry.exactSources.slice(0, 3) })) }))
const report = {
  summary: { allFiles: files.length, allBytes: files.reduce((sum, file) => sum + statSync(file).size, 0), imageFiles: entries.length,
    byteDuplicateGroups: byteDuplicates.length, byteExtraCopies: byteDuplicates.reduce((sum, group) => sum + group.files.length - 1, 0),
    byteReclaimableBytes: byteDuplicates.reduce((sum, group) => sum + group.reclaimableBytes, 0),
    pixelDuplicateGroups: pixelDuplicates.length, pixelExtraCopies: pixelDuplicates.reduce((sum, group) => sum + group.files.length - 1, 0),
    pixelReclaimableBytes: pixelDuplicates.reduce((sum, group) => sum + group.reclaimableBytes, 0) },
  folders: [...folderMap.values()], byteDuplicates, pixelDuplicates, nameVariants, errors,
  hashSuffixFiles: entries.filter(entry => basename(entry.path).includes('#')).map(entry => entry.path),
  entries: process.argv.includes('--details') ? entries : undefined
}
process.stdout.write(JSON.stringify(report))
