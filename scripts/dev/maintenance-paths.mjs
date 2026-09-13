import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const rawRoot = join(projectRoot, 'raw')
export const publicDataRoot = join(projectRoot, 'public/data')
export const configRoot = resolve(process.env.MYRZG_CONFIG_DIR || join(projectRoot, '../Config_decrypted'))
export const dialogRoot = resolve(process.env.MYRZG_DIALOG_DIR || join(projectRoot, '../GAoNano_decrypted'))
export const gameSourceRoot = resolve(process.env.MYRZG_SOURCE_DIR || join(projectRoot, '../源码'))
export const imageBackupRoot = resolve(process.env.MYRZG_IMAGE_BACKUP_DIR || join(projectRoot, '../vue-myrzg备份-资源/images'))

export function resolveChild(root, child) {
  const result = resolve(root, child)
  const difference = relative(resolve(root), result)
  if (!difference || difference === '..' || difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error(`Path must be inside ${root}: ${child}`)
  }
  return result
}
