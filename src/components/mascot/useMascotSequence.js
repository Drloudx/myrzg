import { onBeforeUnmount, watch } from 'vue'

// Finite browser-owned clips. Only stage boundaries run JS; visibility and pause freeze the clips.
export function useMascotSequence(root, isPlaying) {
  const running = new Set()
  const styled = new Map()
  let generation = 0
  function clear() {
    for (const [element, properties] of styled) for (const property of properties) element.style.removeProperty(property)
    styled.clear()
  }
  function stop() {
    generation++
    for (const animation of running) animation.cancel()
    running.clear()
    clear()
  }
  async function run(tracks, duration, easing = 'ease-in-out') {
    const version = generation
    const animations = tracks.flatMap(({ selector, frames }) => [...root.value.querySelectorAll(selector)].map(element => {
      const animation = element.animate(frames, { duration, easing, fill: 'both' })
      running.add(animation)
      if (!isPlaying()) animation.pause()
      return { element, animation, last: frames.at(-1) }
    }))
    const results = await Promise.allSettled(animations.map(({ animation }) => animation.finished))
    if (generation !== version || results.some(result => result.status === 'rejected')) return false
    for (const { element, animation, last } of animations) {
      const properties = styled.get(element) || new Set()
      for (const [key, value] of Object.entries(last)) {
        if (['offset', 'easing', 'composite'].includes(key)) continue
        element.style.setProperty(key, value)
        properties.add(key)
      }
      styled.set(element, properties)
      animation.cancel()
      running.delete(animation)
    }
    return true
  }
  watch(isPlaying, playing => {
    for (const animation of running) playing ? animation.play() : animation.pause()
  })
  onBeforeUnmount(stop)
  return { run, clear, stop }
}
