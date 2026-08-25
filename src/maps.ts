export type StructureKind = 'building' | 'barrier'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
  /** Buildings get brickwork and windows; barriers are plain map edges. */
  kind?: StructureKind
}

export type MapId = 'streets' | 'warehouse' | 'hive' | 'refuge'

/** Ground texture painted under everything else. */
export type FloorStyle = 'asphalt' | 'wood' | 'organic' | 'dirt'

export interface GameMap {
  id: MapId
  name: string
  width: number
  height: number
  /** Ground fill for the whole instance. */
  color: string
  wallColor: string
  wallEdge: string
  floor: FloorStyle
  /** Accent used for roofs, window glow and floor detailing. */
  accent: string
  walls: Rect[]
  /** Where escorted survivors run to. */
  extraction: { x: number; y: number }
}

const BORDER = 30

function border(width: number, height: number): Rect[] {
  return [
    { x: 0, y: 0, w: width, h: BORDER, kind: 'barrier' },
    { x: 0, y: height - BORDER, w: width, h: BORDER, kind: 'barrier' },
    { x: 0, y: 0, w: BORDER, h: height, kind: 'barrier' },
    { x: width - BORDER, y: 0, w: BORDER, h: height, kind: 'barrier' },
  ]
}

const STREETS: GameMap = {
  id: 'streets',
  name: 'The Streets',
  width: 1900,
  height: 1500,
  color: '#23262a',
  wallColor: '#8b5a2b',
  wallEdge: '#5c3a1c',
  floor: 'asphalt',
  accent: '#ffd479',
  extraction: { x: 1740, y: 750 },
  walls: [
    ...border(1900, 1500),
    { x: 200, y: 180, w: 320, h: 170 },
    { x: 760, y: 150, w: 190, h: 360 },
    { x: 1220, y: 240, w: 380, h: 150 },
    { x: 220, y: 600, w: 170, h: 400 },
    { x: 600, y: 760, w: 400, h: 130 },
    { x: 1300, y: 640, w: 150, h: 420 },
    { x: 180, y: 1200, w: 360, h: 150 },
    { x: 780, y: 1120, w: 150, h: 300 },
    { x: 1080, y: 1220, w: 420, h: 130 },
  ],
}

const WAREHOUSE: GameMap = {
  id: 'warehouse',
  name: 'The Warehouse',
  width: 1700,
  height: 1400,
  color: '#3a2d20',
  wallColor: '#9a6a34',
  wallEdge: '#63421d',
  floor: 'wood',
  accent: '#ffcf8a',
  extraction: { x: 1540, y: 700 },
  walls: [
    ...border(1700, 1400),
    { x: 220, y: 200, w: 620, h: 55 },
    { x: 980, y: 200, w: 480, h: 55 },
    { x: 220, y: 460, w: 480, h: 55 },
    { x: 860, y: 460, w: 600, h: 55 },
    { x: 220, y: 720, w: 620, h: 55 },
    { x: 1000, y: 720, w: 460, h: 55 },
    { x: 220, y: 980, w: 480, h: 55 },
    { x: 860, y: 980, w: 600, h: 55 },
    { x: 820, y: 240, w: 55, h: 220 },
    { x: 820, y: 760, w: 55, h: 220 },
  ],
}

const HIVE: GameMap = {
  id: 'hive',
  name: 'The Infected Hive',
  width: 1800,
  height: 1600,
  color: '#241a2b',
  wallColor: '#6d3f7a',
  wallEdge: '#3f2049',
  floor: 'organic',
  accent: '#e0a3ff',
  extraction: { x: 1620, y: 1440 },
  walls: [
    ...border(1800, 1600),
    // Chambered hive tunnels
    { x: 300, y: 300, w: 55, h: 500 },
    { x: 300, y: 300, w: 500, h: 55 },
    { x: 1000, y: 300, w: 500, h: 55 },
    { x: 1445, y: 300, w: 55, h: 500 },
    { x: 300, y: 1000, w: 55, h: 300 },
    { x: 300, y: 1245, w: 500, h: 55 },
    { x: 1000, y: 1245, w: 500, h: 55 },
    { x: 1445, y: 1000, w: 55, h: 300 },
    { x: 780, y: 640, w: 260, h: 260 },
  ],
}

const REFUGE: GameMap = {
  id: 'refuge',
  name: 'Ridgeline Refuge',
  width: 1800,
  height: 1400,
  color: '#1c3326',
  wallColor: '#7c6a3f',
  wallEdge: '#4d4126',
  floor: 'dirt',
  accent: '#ffe3a3',
  extraction: { x: 1620, y: 200 },
  walls: [
    ...border(1800, 1400),
    // Fenced compound with a shelter in the middle
    { x: 260, y: 260, w: 700, h: 50 },
    { x: 260, y: 260, w: 50, h: 420 },
    { x: 260, y: 900, w: 50, h: 240 },
    { x: 260, y: 1090, w: 620, h: 50 },
    { x: 1180, y: 1090, w: 360, h: 50 },
    { x: 1490, y: 620, w: 50, h: 520 },
    { x: 1180, y: 420, w: 360, h: 50 },
    { x: 720, y: 620, w: 380, h: 200 },
  ],
}

export const MAPS: GameMap[] = [STREETS, WAREHOUSE, HIVE, REFUGE]

export function mapById(id: MapId): GameMap {
  const m = MAPS.find((mm) => mm.id === id)
  if (!m) throw new Error(`unknown map ${id}`)
  return m
}

export function circleHitsWall(map: GameMap, x: number, y: number, r: number): boolean {
  for (const w of map.walls) {
    const nx = Math.max(w.x, Math.min(x, w.x + w.w))
    const ny = Math.max(w.y, Math.min(y, w.y + w.h))
    const dx = x - nx
    const dy = y - ny
    if (dx * dx + dy * dy < r * r) return true
  }
  return false
}
