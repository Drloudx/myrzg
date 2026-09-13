import { getMascotScale } from '../config/mascots.js'

// Only accepts entries from the build-owned roster, never user-provided SVG markup.
const cache = new Map()

export async function loadMascotArtwork(character, signal) {
  if (cache.has(character.url)) return cache.get(character.url)
  // Ordinary asset requests can be retried after a network failure, unlike rejected module imports.
  const response = await fetch(character.url, { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(`Mascot artwork HTTP ${response.status}`)
  const svg = await response.text()
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  if (root.localName !== 'svg' || root.getAttribute('data-character') !== character.id) {
    throw new Error('Unexpected mascot artwork')
  }
  let artwork = svg
  if (character.groundX != null) {
    // Match the rigged scenes' 320x400 stage and (162,369) standing ground anchor.
    // Scale uniformly around the ground anchor, retaining all local animation pivots.
    root.setAttribute('viewBox', '0 0 320 400')
    const placement = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g')
    placement.setAttribute('class', 'mascot-standing-placement')
    placement.setAttribute('transform', `translate(162 369) scale(${getMascotScale(character.id)}) translate(${-character.groundX} -337)`)
    while (root.firstChild) placement.appendChild(root.firstChild)
    root.appendChild(placement)
    artwork = new XMLSerializer().serializeToString(root)
  }
  cache.set(character.url, artwork)
  return artwork
}
