// 快速 SFC 语法自检：parse + compileTemplate + compileScript（不检查绑定）
// 用法: node scratch/check-sfc.mjs <file1> <file2> ...
import { parse, compileTemplate, compileScript } from '@vue/compiler-sfc'
import fs from 'fs'

const files = process.argv.slice(2)
let fail = 0
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  try {
    const { descriptor, errors } = parse(src, { filename: f })
    if (errors.length) throw errors[0]
    if (descriptor.template) {
      const t = compileTemplate({
        source: descriptor.template.content,
        filename: f,
        id: 'check',
        compilerOptions: { whitespace: 'condense' }
      })
      if (t.errors.length) throw t.errors[0]
    }
    if (descriptor.scriptSetup || descriptor.script) {
      compileScript(descriptor, { id: 'check' })
    }
    console.log('OK   ' + f)
  } catch (e) {
    fail++
    console.log('FAIL ' + f + ' :: ' + (e && e.message ? e.message.split('\n')[0] : e))
  }
}
process.exit(fail ? 1 : 0)
