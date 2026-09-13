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
  { id: '005', name: '茜塔', standingHeight: 314.630, url: new URL('../assets/mascot/hero-005-idle.svg', import.meta.url).href },
  { id: '007', name: '拉碧丝', standingHeight: 312.545, url: new URL('../assets/mascot/hero-007-idle.svg', import.meta.url).href },
  { id: '008', name: '夏库塔拉', standingHeight: 315.718, url: new URL('../assets/mascot/hero-008-idle.svg', import.meta.url).href },
  { id: '009', name: '可可娜', standingHeight: 314.545, url: new URL('../assets/mascot/hero-009-idle.svg', import.meta.url).href },
  { id: '011', name: '缇莎', standingHeight: 315.545, url: new URL('../assets/mascot/hero-011-idle.svg', import.meta.url).href },
  { id: '012', name: '沃夫加', standingHeight: 314.545, url: new URL('../assets/mascot/hero-012-idle.svg', import.meta.url).href },
  { id: '014', name: '皮塔', standingHeight: 314.545, url: new URL('../assets/mascot/hero-014-idle.svg', import.meta.url).href },
  { id: '015', name: '芭杜尔', standingHeight: 314.545, url: new URL('../assets/mascot/hero-015-idle.svg', import.meta.url).href },
  { id: '019', name: '奇瓦', standingHeight: 308.545, url: new URL('../assets/mascot/hero-019-idle.svg', import.meta.url).href },
  { id: '023', name: '卡夫', standingHeight: 309.718, url: new URL('../assets/mascot/hero-023-idle.svg', import.meta.url).href },
  { id: '025', name: '嘉莉缇', standingHeight: 313.545, url: new URL('../assets/mascot/hero-025-idle.svg', import.meta.url).href },
  { id: '026', name: '贝拉多娜', standingHeight: 323.545, url: new URL('../assets/mascot/hero-026-idle.svg', import.meta.url).href },
  { id: '027', name: '梅莉莉', standingHeight: 316.795, url: new URL('../assets/mascot/hero-027-idle.svg', import.meta.url).href },
  { id: '029', name: '安娜', standingHeight: 313.545, url: new URL('../assets/mascot/hero-029-idle.svg', import.meta.url).href },
  { id: '031', name: '波特温', standingHeight: 314.545, url: new URL('../assets/mascot/hero-031-idle.svg', import.meta.url).href },
  { id: '033', name: '乌帕·萝特', standingHeight: 310.545, url: new URL('../assets/mascot/hero-033-idle.svg', import.meta.url).href },
  { id: '036', name: '贝尔卡', standingHeight: 315.545, url: new URL('../assets/mascot/hero-036-idle.svg', import.meta.url).href },
  { id: '037', name: '剋', standingHeight: 305.892, url: new URL('../assets/mascot/hero-037-idle.svg', import.meta.url).href },
  { id: '041', name: '埃迪蒂', standingHeight: 313.545, url: new URL('../assets/mascot/hero-041-idle.svg', import.meta.url).href },
  { id: '043', name: '阿娜洛洁', standingHeight: 303.545, url: new URL('../assets/mascot/hero-043-idle.svg', import.meta.url).href },
  { id: '045', name: '艾尔菲帕', standingHeight: 316.545, url: new URL('../assets/mascot/hero-045-idle.svg', import.meta.url).href },
  { id: '046', name: '迈妮娅', standingHeight: 314.545, url: new URL('../assets/mascot/hero-046-idle.svg', import.meta.url).href },
  { id: '050', name: '米拉贝尔', standingHeight: 313.545, url: new URL('../assets/mascot/hero-050-idle.svg', import.meta.url).href },
  { id: '051', name: '阿莱克西娅', standingHeight: 325.545, url: new URL('../assets/mascot/hero-051-idle.svg', import.meta.url).href },
  { id: '064', name: '伽拉忒亚', standingHeight: 304.545, url: new URL('../assets/mascot/hero-064-idle.svg', import.meta.url).href },
  { id: '065', name: '乌尔勒', standingHeight: 313.545, url: new URL('../assets/mascot/hero-065-idle.svg', import.meta.url).href },
  { id: '066', name: '奥格', standingHeight: 301.911, url: new URL('../assets/mascot/hero-066-idle.svg', import.meta.url).href }
]

// Visible idle silhouette at animation time 0, excluding the ground shadow.
// One fixed uniform scale per character: never resize when an action bends or sits.
export const MASCOT_DISPLAY_HEIGHT = 312
export const getMascotScale = id => MASCOT_DISPLAY_HEIGHT / (MASCOTS.find(character => character.id === id)?.standingHeight || MASCOT_DISPLAY_HEIGHT)
