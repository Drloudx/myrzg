/**
 * 抽卡演出音频（BGM / 音效）统一管理。
 *
 * 为什么需要它：此前每个面板各自 `new Audio()` 播放，`soundOn` 只拦截「新的播放」，
 * 于是出现两个用户可感知的问题——① 音效开关只能拦住之后的声音，**正在播的 BGM 不会停**；
 * ② 面板切换（卡池页 → 翻卡 → 揭晓 → 结果）时各自重新 `play()`，**同一首 BGM 被从头重启**。
 *
 * 这里改成模块级单例：
 *   - `playBgm(name)`：**同名且正在播 → 什么都不做**（不重启、不断点）；换曲才切；
 *   - `setSoundEnabled(false)`：暂停当前 BGM（保留进度）并静音后续音效；
 *     `setSoundEnabled(true)`：从**原进度**继续，不重头播；
 *   - 面板卸载不再停止 BGM（只有离开 `/gacha` 页由 `GachaView` 停），保证演出之间连续。
 *
 * 游戏侧对应：`AudioManager.PlaySound(name, BGM|EFFECT)`（`AudioManager.cs:58-89`），
 * BGM 走 `bgmPlayer`、EFFECT 走 `soundEffectPlayer`；音频文件在
 * `public/images/gacha/audio/`（源：`4.24路资源包/assets/res/audio/{bgm,effect/ui}`）。
 */
import { getImageUrl } from './env'

/** BGM 音量（游戏 BGMPlayer 有 0.5s 淡入，这里用固定音量近似）。 */
const BGM_VOLUME = 0.5
/** 音效默认音量；个别音源本身很响，单独压低。 */
const SFX_VOLUME_DEFAULT = 0.6
const SFX_VOLUME = {
  card2: 0.5,
  card9: 0.45,
  card10: 0.5,
  card12: 0.5,
  get5: 0.5,
  get3: 0.5,
  shining1: 0.5
}

let enabled = true
/** 当前 BGM：`{ name, el }`，null 表示没有在播。 */
let bgm = null
/** 已创建过 BGM 元素的缓存：同名曲再次播放时复用元素（保留播放进度）。 */
const bgmCache = new Map()

function audioUrl(name) {
  return getImageUrl(`/images/gacha/audio/${name}.wav`)
}

/**
 * 音效开关。关闭时暂停 BGM（保留进度），开启时从原进度继续——不重新从头播放。
 * 把开关状态同步给本模块是调用方（`GachaView`）的职责。
 */
export function setSoundEnabled(value) {
  enabled = Boolean(value)
  if (!bgm) return
  if (enabled) {
    if (bgm.el.paused) bgm.el.play().catch(() => {})
  } else {
    bgm.el.pause()
  }
}

/** 当前开关状态（供调试与回归测试断言）。 */
export function isSoundEnabled() {
  return enabled
}

/** 当前 BGM 名（供回归测试断言「同一首没有重启」）。 */
export function currentBgmName() {
  return bgm?.name ?? ''
}

/** 当前 BGM 元素的播放位置（秒），供回归测试断言进度未被重置。 */
export function currentBgmTime() {
  return bgm?.el?.currentTime ?? 0
}

/**
 * 取（或创建）某首 BGM 的元素。**默认 `preload='none'`**：BGM 单支就有 7~17MB，
 * 若进页就 `auto` 预取会与卡池图片抢带宽（实测会把卡池主视觉的加载拖到图片断言超时）。
 * 只有真正切到该曲时才置 `auto` 并播放。
 */
function bgmElement(name) {
  let el = bgmCache.get(name)
  if (!el) {
    el = new Audio(audioUrl(name))
    el.loop = true
    el.volume = BGM_VOLUME
    el.preload = 'none'
    bgmCache.set(name, el)
  }
  return el
}

/**
 * 播放 BGM。**同一首正在播时不做任何事**（这是"不重启音乐"的关键）。
 * @param {string} name 音频名（不含扩展名），如 `gacha_shop` / `gacha_ready_chara`
 */
export function playBgm(name) {
  if (!name) return
  if (bgm && bgm.name === name) {
    // 同名：可能是被静音暂停过，恢复播放但不重头开始
    if (enabled && bgm.el.paused) bgm.el.play().catch(() => {})
    return
  }
  const el = bgmElement(name)
  const previous = bgm
  bgm = { name, el }
  if (previous && previous.el !== el) previous.el.pause()
  if (enabled) {
    el.preload = 'auto'
    try {
      el.currentTime = 0
    } catch { /* 元数据未加载时忽略 */ }
    el.play().catch(() => {})
  }
}

/** 停止 BGM（离开招募页时调用）。 */
export function stopBgm() {
  if (!bgm) return
  bgm.el.pause()
  bgm = null
}

/**
 * 播放一次性音效（`EFFECT` 通道）。与游戏一致：同名音效允许并发，
 * 播完即释放，不进入 BGM 状态。
 */
export function playSfx(name) {
  if (!name || !enabled) return
  try {
    const el = new Audio(audioUrl(name))
    el.volume = SFX_VOLUME[name] ?? SFX_VOLUME_DEFAULT
    el.play().catch(() => {})
  } catch { /* 音频不可用时静默（不阻塞抽卡流程） */ }
}

/**
 * 预建 BGM 元素（**不预取字节**，`preload='none'`）：只是省掉首次播放时的元素创建，
 * 避免进页就下载几十 MB 音频与卡池贴图抢带宽。
 */
export function preloadAudio(names = []) {
  for (const name of names) bgmElement(name)
}

/** 清空音频缓存（页面卸载时释放）。 */
export function disposeAudio() {
  stopBgm()
  for (const el of bgmCache.values()) {
    try {
      el.pause()
    } catch { /* 忽略 */ }
  }
  bgmCache.clear()
}
