// Hand-drawn mascot roster; names checked against parsed/heroes.json and the reference manifest.
// Build-owned URLs receive content hashes. Only the selected illustration is fetched.
export const MASCOTS = [
  { id: '001', name: '希尔', standingHeight: 315.545, url: new URL('../assets/mascot/hero-001-idle.svg', import.meta.url).href },
  { id: '055', name: '迦南', standingHeight: 311.575, url: new URL('../assets/mascot/hero-055-idle.svg', import.meta.url).href },
  // Ground centers belong to the body, excluding off-center weapons, tails and baskets.
  { id: '062', name: '露比特·鲁特', groundX: 133, standingHeight: 323.587, url: new URL('../assets/mascot/hero-062-idle.svg', import.meta.url).href },
  { id: '053', name: '艾薇杜尔', groundX: 139, standingHeight: 327.545, url: new URL('../assets/mascot/hero-053-idle.svg', import.meta.url).href },
  { id: '034', name: '露帕·萝特', groundX: 126, standingHeight: 318.545, url: new URL('../assets/mascot/hero-034-idle.svg', import.meta.url).href },
  { id: '049', name: '菲莉娜', groundX: 123, standingHeight: 312.545, url: new URL('../assets/mascot/hero-049-idle.svg', import.meta.url).href },
  { id: '002', name: '米托拉', groundX: 123, standingHeight: 308.745, url: new URL('../assets/mascot/hero-002-idle.svg', import.meta.url).href },
]

// Visible idle silhouette at animation time 0, excluding the ground shadow.
// One fixed uniform scale per character: never resize when an action bends or sits.
export const MASCOT_DISPLAY_HEIGHT = 312
export const getMascotScale = id => MASCOT_DISPLAY_HEIGHT / (MASCOTS.find(character => character.id === id)?.standingHeight || MASCOT_DISPLAY_HEIGHT)
