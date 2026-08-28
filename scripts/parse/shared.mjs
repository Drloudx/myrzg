/**
 * scripts/parse 共用工具：读取 public/data 原始 JSON
 * 所有预解析脚本（*.mjs）统一从这里取数据，产物统一写到 public/data/parsed/
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const publicDataDir = join(repoRoot, 'public', 'data')
export const parsedDir = join(publicDataDir, 'parsed')

/** 读取 public/data 下的原始 JSON 文件 */
export function readJson(relativePath) {
  return JSON.parse(readFileSync(join(publicDataDir, relativePath), 'utf8'))
}

/** 输出文件体积（KB） */
export function sizeOf(data) {
  return Math.round(Buffer.byteLength(JSON.stringify(data), 'utf8') / 1024)
}
