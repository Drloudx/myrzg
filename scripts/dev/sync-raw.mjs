/**
 * 同步完整原表及解析器使用的兼容别名；派生 raw 表始终保留。
 * 默认只读预览；--apply 补缺，--apply --replace 显式更新已有原表。
 * 原始表不做改名字段/裁剪，mon.json 归一化由 scripts/parse 处理。
 */
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { configRoot, rawRoot } from './maintenance-paths.mjs'
import { applyRawSyncPlan, createRawSyncPlan } from './raw-sync.mjs'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { apply: { type: 'boolean' }, replace: { type: 'boolean' }, 'skip-invalid': { type: 'boolean' }, help: { type: 'boolean' } }
})
if (values.help) {
  console.log('Usage: node scripts/dev/sync-raw.mjs [Config_decrypted] [--apply] [--replace] [--skip-invalid]')
  console.log('Default is read-only. --apply fills missing originals and aliases; add --replace to refresh existing originals.')
} else {
  if (positionals.length > 1) throw new Error('Only one source directory is accepted')
  const sourceRoot = resolve(positionals[0] || configRoot)
  const invalidSources = []
  const plan = createRawSyncPlan({ sourceRoot, targetRoot: rawRoot, replace: !!values.replace, onInvalid: entry => invalidSources.push(entry) })
  for (const entry of invalidSources) console.warn(`[invalid] ${entry.sourceName}: ${entry.error}`)
  for (const entry of plan.filter(entry => entry.action !== 'unchanged')) {
    console.log(`[${entry.action}] ${entry.sourceName} -> raw/${entry.targetName}`)
  }
  const counts = Object.fromEntries(['add', 'replace', 'keep', 'blocked', 'unchanged'].map(action => [action, plan.filter(entry => entry.action === action).length]))
  console.log(`[sync-raw] ${sourceRoot} -> ${rawRoot}`, { ...counts, invalid: invalidSources.length })
  if (counts.blocked) console.log('[sync-raw] Missing aliases were blocked because existing copies use a different version. Review with --replace before applying.')
  if (values.apply && invalidSources.length && !values['skip-invalid']) {
    console.error('[sync-raw] No files changed: invalid source JSON must be fixed, or explicitly reviewed and excluded with --skip-invalid.')
    process.exitCode = 1
  } else {
    console.log(values.apply ? `[sync-raw] Applied ${applyRawSyncPlan(plan)} complete table copies.` : '[sync-raw] Preview only; no files changed. Use --apply to copy, and --replace only when refreshing existing originals.')
  }
}
