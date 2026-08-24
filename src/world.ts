export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Zone extends Rect {
  id: ZoneId
  name: string
  color: string
  spawns: boolean
}

export type ZoneId = 'streets' | 'warehouse' | 'safe'

export const WORLD_WIDTH = 3200
export const WORLD_HEIGHT = 2000

export const ZONES: Zone[] = [
  {
    id: 'streets',
    name: 'The Streets',
    x: 0,
    y: 0,
    w: 1300,
    h: WORLD_HEIGHT,
    color: '#2b3230',
    spawns: true,
  },
  {
    id: 'warehouse',
    name: 'The Warehouse',
    x: 1300,
    y: 0,
    w: 1200,
    h: WORLD_HEIGHT,
    color: '#33291f',
    spawns: true,
  },
  {
    id: 'safe',
    name: 'The Safe Zone',
    x: 2500,
    y: 0,
    w: WORLD_WIDTH - 2500,
    h: WORLD_HEIGHT,
    color: '#1c3326',
    spawns: false,
  },
]

export const WALLS: Rect[] = [
  // Outer border
  { x: 0, y: 0, w: WORLD_WIDTH, h: 30 },
  { x: 0, y: WORLD_HEIGHT - 30, w: WORLD_WIDTH, h: 30 },
  { x: 0, y: 0, w: 30, h: WORLD_HEIGHT },
  { x: WORLD_WIDTH - 30, y: 0, w: 30, h: WORLD_HEIGHT },

  // The Streets: city blocks
  { x: 200, y: 200, w: 320, h: 180 },
  { x: 760, y: 160, w: 200, h: 380 },
  { x: 220, y: 640, w: 180, h: 420 },
  { x: 600, y: 820, w: 420, h: 140 },
  { x: 180, y: 1320, w: 380, h: 160 },
  { x: 820, y: 1240, w: 160, h: 460 },

  // Divider between Streets and Warehouse with two gaps
  { x: 1270, y: 30, w: 60, h: 560 },
  { x: 1270, y: 860, w: 60, h: 480 },
  { x: 1270, y: 1610, w: 60, h: 360 },

  // The Warehouse: crates and shelving
  { x: 1450, y: 260, w: 700, h: 60 },
  { x: 1450, y: 560, w: 700, h: 60 },
  { x: 1450, y: 860, w: 480, h: 60 },
  { x: 1700, y: 1160, w: 700, h: 60 },
  { x: 1450, y: 1460, w: 480, h: 60 },
  { x: 2200, y: 700, w: 60, h: 420 },

  // Divider between Warehouse and Safe Zone with one gap
  { x: 2470, y: 30, w: 60, h: 780 },
  { x: 2470, y: 1130, w: 60, h: 840 },

  // Safe Zone: sandbags
  { x: 2700, y: 400, w: 300, h: 60 },
  { x: 2700, y: 1500, w: 300, h: 60 },
]

export function zoneAt(x: number, y: number): Zone {
  for (const z of ZONES) {
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z
  }
  return ZONES[0]
}

export function zoneById(id: ZoneId): Zone {
  const z = ZONES.find((zz) => zz.id === id)
  if (!z) throw new Error(`unknown zone ${id}`)
  return z
}

export function circleHitsWall(x: number, y: number, r: number): boolean {
  for (const w of WALLS) {
    const nx = Math.max(w.x, Math.min(x, w.x + w.w))
    const ny = Math.max(w.y, Math.min(y, w.y + w.h))
    const dx = x - nx
    const dy = y - ny
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}
