/**
 * 音频格式转换：WAV → Opus（**有损**，听觉近无损；这是本项目唯一的有损转换，需知悉）。
 *
 * 为什么需要：`public/images/gacha/audio` 的 19 个 WAV 共 66.45 MB，是 gacha 目录
 * 89.12 MB 的 75%，也是整个 `public/` 里单一目录最重的一块。WAV 是 1411 kbps
 * 未压缩 PCM，而抽卡音频本是手机游戏导出素材，Opus 在 96/64 kbps 下已超出其
 * 原始制作精度，属于「容器换更好的压缩」而非「降质」。
 *
 * ── 为什么容器是 MP4（.mp4）而不是 Ogg（.opus）——**不要改回去** ──
 * Opus 编码本身三家引擎都支持，但**容器**决定了能不能放。实测（Chromium 152 /
 * WebKit 26.5 / Firefox 153，真实文件播放验证）：
 *
 *   容器           Chromium   WebKit(≈Safari)   Gecko    体积
 *   Ogg/Opus        可播        **不可播**        可播     基准
 *   WebM/Opus       可播        **不可播**        可播     相同
 *   MP4/Opus        可播        可播             可播     相同
 *
 * Ogg/Opus 与 WebM/Opus 在 WebKit 上是**编码层拒绝**：`audio/ogg; codecs=opus` 的
 * `canPlayType` 返回空、解码报 `MEDIA_ERR_SRC_NOT_SUPPORTED`；WebM 则是
 * `readyState` 卡在 0、`duration` 为 NaN。
 *
 * 判据陷阱（**必须用真实播放验证，别用 canplaythrough**）：WebKit 对 1~2s 的短音效
 * 明明已解析出元数据、`readyState=3`，却始终不触发 `canplaythrough`。用该事件判定会
 * 得到 8/19 假失败。真正有意义的判据是 `play()` 之后 `currentTime` 是否推进——
 * 以此判定时三引擎均 19/19 通过。同理**绝不能用 `canPlayType` 选容器**：
 * WebKit 对 `audio/webm; codecs=opus` 谎报 `probably`，实际根本放不出来。
 *
 * MP4/Opus 体积与 Ogg 相同（`gacha_shop` 1026 KB → 1035 KB），却多覆盖 Safari/iOS，
 * 故取 MP4。注意 `.m4a` 后缀不可用：ffmpeg 会因此选 `ipod` muxer，而它不支持 Opus。
 *
 * 分类规则：**按时长**，不是按文件名硬编码——
 *   时长 > 20s  → BGM（96 kbps VBR / 立体声 / 48 kHz）
 *   时长 ≤ 20s  → 音效（64 kbps VBR / 单声道 / 48 kHz）
 * 实测本目录时长是干净的双峰分布：最短 BGM 41.8s，最长音效 4.6s，中间无样本，
 * 因此 20s 阈值不是拍脑袋的调参点。分类结果每次运行都会打印出来，可人工复核。
 *
 * 用法：
 *   node scripts/dev/convert-audio-opus.mjs            # 只预览（不写文件，编码到临时目录比对体积）
 *   node scripts/dev/convert-audio-opus.mjs --apply    # 实际生成 .mp4
 *   node scripts/dev/convert-audio-opus.mjs --apply --delete-source   # 生成后删除 .wav（体积才真正下降）
 *
 * 依赖：ffmpeg（含 libopus）。优先用系统 ffmpeg，找不到时回退到 python 的
 * `imageio-ffmpeg` 自带二进制（`python -m pip install imageio-ffmpeg`）。
 * 自检会在转换前跑一遍，避免跑到一半才失败。
 *
 * 重要：转换后还必须把代码里的引用改成 `.mp4`，见
 * `src/utils/gachaAudio.js` 的 `audioUrl()`——这是全项目唯一拼音频扩展名的地方。
 * 本脚本**不**碰源码，避免脚本隐式改代码。
 *
 * 回滚：原文件在 `E:\Desktop\html\myrzg\vue-myrzg备份-资源\audio-gacha-orig-*`（已 SHA-256 校验）。
 */
import { existsSync, readdirSync, statSync, mkdtempSync, rmSync, unlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    apply: { type: 'boolean' },
    'delete-source': { type: 'boolean' },
    root: { type: 'string' },
  },
})

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const audioDir = values.root ? join(repoRoot, values.root) : join(repoRoot, 'public/images/gacha/audio')

const BGM_SECONDS = 20
// 容器选择见文件头：MP4（非 Ogg/WebM）+ libopus，三引擎唯一全通且体积与 Ogg 相同。
// 输出后缀必须是 .mp4（`.m4a` 会让 ffmpeg 选不支持 Opus 的 ipod muxer）。
const BGM_ARGS = ['-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', '-ac', '2', '-ar', '48000']
const SFX_ARGS = ['-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-ac', '1', '-ar', '48000']
const OUT_EXT = '.mp4'

/** 系统 ffmpeg 优先，回退 imageio-ffmpeg 自带二进制。 */
function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return 'ffmpeg'
  } catch {
    /* 继续找 imageio-ffmpeg */
  }
  try {
    const py = process.platform === 'win32' ? 'python' : 'python3'
    const out = execFileSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], {
      encoding: 'utf8',
    }).trim()
    if (out && existsSync(out)) return out
  } catch {
    /* 下面统一报错 */
  }
  throw new Error(
    '找不到 ffmpeg（需含 libopus）。请安装系统 ffmpeg，或运行 python -m pip install imageio-ffmpeg。',
  )
}

/** 读 WAV 头算时长：不依赖 ffprobe，少一个依赖面。 */
function wavDuration(file) {
  const buf = readFileSync(file)
  if (buf.length < 44) return 0
  const channels = buf.readUInt16LE(22)
  const sampleRate = buf.readUInt32LE(24)
  const bits = buf.readUInt16LE(34)
  let offset = 12
  let dataSize = 0
  while (offset < buf.length - 8) {
    const id = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    if (id === 'data') {
      dataSize = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  const bytesPerSec = sampleRate * channels * (bits / 8)
  return bytesPerSec ? dataSize / bytesPerSec : 0
}

const ffmpeg = resolveFfmpeg()
try {
  const encoders = execFileSync(ffmpeg, ['-hide_banner', '-encoders'], { encoding: 'utf8' })
  if (!/libopus/.test(encoders)) throw new Error('no libopus')
} catch {
  throw new Error(`ffmpeg 缺少 libopus 编码器：${ffmpeg}`)
}

if (!existsSync(audioDir)) throw new Error(`目录不存在：${audioDir}`)

const sources = readdirSync(audioDir)
  .filter(f => f.toLowerCase().endsWith('.wav'))
  .sort()

// 上一版脚本产出过 Ogg 容器的 .opus，那是 WebKit 放不出来的错误容器。这里主动提示，
// 否则残留的 .opus 会一直躺在 public/ 里被部署（66 MB 的教训：没人会注意到多出来的文件）。
const legacyOgg = readdirSync(audioDir).filter(f => f.toLowerCase().endsWith('.opus'))

if (!sources.length) {
  console.log(`[opus] ${audioDir} 下没有 .wav，无需转换。`)
  if (legacyOgg.length) {
    console.log(`[opus] ⚠ 发现 ${legacyOgg.length} 个 .opus（Ogg 容器，WebKit/Safari 无法播放）。`)
    console.log('[opus]   先删掉它们，再从备份恢复 .wav 后重跑本脚本，才能得到 .mp4：')
    console.log(`[opus]   备份位于 …备份-资源\\audio-gacha-orig-*`)
  }
  process.exit(0)
}

const jobs = sources.map(name => {
  const from = join(audioDir, name)
  const seconds = wavDuration(from)
  return {
    name,
    from,
    to: join(audioDir, name.replace(/\.wav$/i, OUT_EXT)),
    seconds,
    oldBytes: statSync(from).size,
    isBgm: seconds > BGM_SECONDS,
  }
})

const scratch = values.apply ? null : mkdtempSync(join(tmpdir(), 'opus-preview-'))
const totalOld = jobs.reduce((n, j) => n + j.oldBytes, 0)
const totalNew = { bgm: 0, sfx: 0 }
const rows = []

// 源集合指纹必须在转换/删除**之前**算：--delete-source 之后 .wav 就没了。
// 用途是确认「本地备份 ↔ 本次转换输入」是同一批文件。
const digest = createHash('sha256')
for (const j of jobs) digest.update(readFileSync(j.from))
const sourceDigest = digest.digest('hex').slice(0, 16)

try {
  for (const job of jobs) {
    const out = values.apply ? job.to : join(scratch, job.name.replace(/\.wav$/i, OUT_EXT))
    execFileSync(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', job.from, ...(job.isBgm ? BGM_ARGS : SFX_ARGS), out],
      { stdio: 'inherit' },
    )
    const newBytes = statSync(out).size
    totalNew[job.isBgm ? 'bgm' : 'sfx'] += newBytes
    rows.push({ ...job, newBytes })
    if (values.apply && values['delete-source']) unlinkSync(job.from)
  }
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
}

const fmt = n => `${(n / 1048576).toFixed(2)} MB`
console.log(
  values.apply
    ? `[opus] 已写入 ${audioDir}（容器 MP4/Opus）`
    : '[opus] 预览（编码到临时目录比对体积，未改动任何源文件）',
)
console.log(`  文件`.padEnd(26) + `WAV`.padStart(9) + `Opus`.padStart(10) + `省`.padStart(8) + `  时长`.padStart(9) + '  分类')
for (const r of [...rows].sort((a, b) => b.newBytes - a.newBytes)) {
  console.log(
    '  ' +
      r.name.replace(/\.wav$/i, '').padEnd(24) +
      fmt(r.oldBytes).padStart(9) +
      fmt(r.newBytes).padStart(10) +
      `${((1 - r.newBytes / r.oldBytes) * 100).toFixed(1)}%`.padStart(8) +
      `${r.seconds.toFixed(1)}s`.padStart(9) +
      '  ' +
      (r.isBgm ? 'BGM(96k/2ch)' : 'SFX(64k/1ch)'),
  )
}
const sum = totalNew.bgm + totalNew.sfx
console.log(
  `  合计 ${fmt(totalOld)} → ${fmt(sum)}，省 ${fmt(totalOld - sum)}（${((1 - sum / totalOld) * 100).toFixed(1)}%）` +
    `  其中 BGM ${fmt(totalNew.bgm)}、SFX ${fmt(totalNew.sfx)}`,
)
if (legacyOgg.length) {
  console.log(`[opus] ⚠ 目录里还有 ${legacyOgg.length} 个 .opus（Ogg 容器，WebKit/Safari 放不出来），请删除。`)
}
if (!values.apply) {
  console.log(`[opus] 加 --apply 才实际生成 ${OUT_EXT}；再加 --delete-source 才会删掉 .wav。`)
} else if (!values['delete-source']) {
  console.log('[opus] .wav 已保留：体积要真正下降需 --delete-source，或手工删除。')
} else {
  console.log(`[opus] .wav 已删除。记得同步改 src/utils/gachaAudio.js 的扩展名为 ${OUT_EXT}。`)
}

// 输出一个稳定指纹，便于确认「备份 ↔ 转换源」是同一批文件
console.log(`[opus] 源集合 SHA-256: ${sourceDigest}（${jobs.length} 文件）`)
