/** Back up and remove legacy fragmented Markdown logs. Default is read-only. */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { projectRoot, resolveChild } from './maintenance-paths.mjs'

const { values } = parseArgs({ options: { apply: { type: 'boolean' } } })
const sourceRoot = join(projectRoot, 'docs/dev-logs')
const backupRoot = join(projectRoot, '../backups/dev-logs')
const files = []
const directories = []
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      directories.push(full)
      walk(full)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const name = relative(sourceRoot, full).replaceAll('\\', '/')
      if (name === 'README.md' || /^\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}\.md$/.test(name)) continue
      files.push({ path: name, bytes: statSync(full).size, sha256: hash(full) })
    }
  }
}
walk(sourceRoot)
files.sort((a, b) => a.path.localeCompare(b.path))
console.log(`[legacy-logs] ${files.length} fragmented Markdown files, ${files.reduce((sum, file) => sum + file.bytes, 0)} bytes`)
console.log(`[legacy-logs] Source: ${sourceRoot}`)
console.log(`[legacy-logs] External backup parent: ${backupRoot}`)
if (!values.apply || !files.length) {
  console.log('[legacy-logs] Preview only or nothing to archive. README and canonical daily logs are preserved.')
} else {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archive = resolveChild(backupRoot, timestamp)
  mkdirSync(backupRoot, { recursive: true })
  mkdirSync(archive)
  for (const file of files) {
    const source = resolveChild(sourceRoot, file.path)
    const target = resolveChild(join(archive, 'files'), file.path)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
  const manifest = { schema: 1, createdAt: new Date().toISOString(), sourceRoot, files }
  writeFileSync(join(archive, 'manifest.json'), JSON.stringify(manifest, null, 2))
  // Check all originals and backup bytes before deleting the first original.
  for (const file of files) {
    const source = resolveChild(sourceRoot, file.path)
    const backup = resolveChild(join(archive, 'files'), file.path)
    if (hash(source) !== file.sha256 || hash(backup) !== file.sha256 || statSync(backup).size !== file.bytes) {
      throw new Error(`Backup validation failed; originals were preserved: ${file.path}`)
    }
  }
  for (const file of files) unlinkSync(resolveChild(sourceRoot, file.path))
  for (const directory of directories.sort((a, b) => b.length - a.length)) {
    if (readdirSync(directory).length === 0) rmdirSync(directory)
  }
  console.log(`[legacy-logs] Verified and archived ${files.length} originals. Recovery files and SHA-256 manifest: ${archive}`)
}
