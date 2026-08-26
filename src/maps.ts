export type StructureKind = 'building' | 'barrier'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
  /** Buildings get brickwork and windows; barriers are plain map edges. */
  kind?: StructureKind
}

export type MapId =
  | 'streets'
  | 'warehouse'
  | 'hive'
  | 'refuge'
  | 'alley'
  | 'rooftop'
  | 'highway'
  | 'deadend'
  | 'fogward'
  | 'glacier'
  | 'cryolab'
  | 'camp'
  | 'frozencore'

/** Ground texture painted under everything else. */
export type FloorStyle = 'asphalt' | 'wood' | 'organic' | 'dirt' | 'ice' | 'snow'

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

/** Interior walls: flat partitions rather than windowed exterior buildings. */
function partitions(rects: Omit<Rect, 'kind'>[]): Rect[] {
  return rects.map((r) => ({ ...r, kind: 'barrier' as const }))
}

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
  // Four storage rooms around a cross of hallways; every room has a doorway.
  walls: [
    ...border(1700, 1400),
    ...partitions([
      // Spine between the west and east rooms, broken by hallway openings.
      { x: 780, y: 120, w: 40, h: 240 },
      { x: 780, y: 440, w: 40, h: 200 },
      { x: 780, y: 760, w: 40, h: 210 },
      { x: 780, y: 1060, w: 40, h: 220 },

      // Room walls north of the east–west hallway.
      { x: 120, y: 600, w: 300, h: 40 },
      { x: 520, y: 600, w: 260, h: 40 },
      { x: 820, y: 600, w: 300, h: 40 },
      { x: 1240, y: 600, w: 340, h: 40 },

      // Room walls south of it.
      { x: 120, y: 760, w: 260, h: 40 },
      { x: 480, y: 760, w: 300, h: 40 },
      { x: 820, y: 760, w: 340, h: 40 },
      { x: 1260, y: 760, w: 320, h: 40 },

      // Partitions that turn each room into short aisles.
      { x: 300, y: 180, w: 40, h: 280 },
      { x: 340, y: 180, w: 220, h: 40 },
      { x: 1160, y: 180, w: 40, h: 300 },
      { x: 940, y: 440, w: 260, h: 40 },
      { x: 300, y: 940, w: 40, h: 260 },
      { x: 340, y: 940, w: 240, h: 40 },
      { x: 1160, y: 920, w: 40, h: 300 },
      { x: 940, y: 1180, w: 260, h: 40 },

      // Loose crates for cover — square footprints, not aisle-length shelving.
      { x: 560, y: 320, w: 70, h: 70 },
      { x: 1000, y: 250, w: 70, h: 70 },
      { x: 620, y: 1000, w: 70, h: 70 },
      { x: 1320, y: 1030, w: 70, h: 70 },
      { x: 1380, y: 300, w: 70, h: 70 },
      { x: 200, y: 1280, w: 70, h: 70 },
    ]),
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

/** Path 1: claustrophobic back alleys behind the quarantine line. */
const ALLEY: GameMap = {
  id: 'alley',
  name: 'City Alleys',
  width: 1500,
  height: 1300,
  color: '#1d2024',
  wallColor: '#6f5340',
  wallEdge: '#42301f',
  floor: 'asphalt',
  accent: '#ffcf8a',
  extraction: { x: 1360, y: 1160 },
  walls: [
    ...border(1500, 1300),
    // Long tenement blocks leaving narrow lanes between them.
    { x: 140, y: 140, w: 380, h: 220 },
    { x: 640, y: 140, w: 240, h: 380 },
    { x: 1000, y: 140, w: 360, h: 200 },
    { x: 140, y: 520, w: 300, h: 240 },
    { x: 1080, y: 460, w: 280, h: 300 },
    { x: 560, y: 660, w: 320, h: 190 },
    { x: 140, y: 920, w: 340, h: 240 },
    { x: 620, y: 1000, w: 260, h: 160 },
    { x: 1020, y: 920, w: 200, h: 240 },
    ...partitions([
      { x: 460, y: 400, w: 90, h: 90 },
      { x: 940, y: 700, w: 90, h: 90 },
      { x: 520, y: 900, w: 70, h: 70 },
    ]),
  ],
}

/** Path 2: wide open rooftops where the swarm owns the sky. */
const ROOFTOP: GameMap = {
  id: 'rooftop',
  name: 'The Rooftops',
  width: 1900,
  height: 1500,
  color: '#3b3f45',
  wallColor: '#8d9299',
  wallEdge: '#4d5359',
  floor: 'wood',
  accent: '#cde5ff',
  extraction: { x: 1740, y: 1340 },
  walls: [
    ...border(1900, 1500),
    ...partitions([
      // Low parapets, vents and stair housings — plenty of open sky.
      { x: 420, y: 300, w: 260, h: 40 },
      { x: 1180, y: 300, w: 300, h: 40 },
      { x: 300, y: 700, w: 40, h: 260 },
      { x: 1560, y: 620, w: 40, h: 300 },
      { x: 780, y: 640, w: 220, h: 140 },
      { x: 620, y: 1120, w: 320, h: 40 },
      { x: 1240, y: 1080, w: 40, h: 260 },
      { x: 980, y: 260, w: 80, h: 80 },
      { x: 500, y: 980, w: 80, h: 80 },
    ]),
  ],
}

/** Path 3: a barricaded stretch of highway used as an evacuation lane. */
const HIGHWAY: GameMap = {
  id: 'highway',
  name: 'The Evac Highway',
  width: 2000,
  height: 1200,
  color: '#26282c',
  wallColor: '#7b7f86',
  wallEdge: '#464a50',
  floor: 'asphalt',
  accent: '#ffe08a',
  extraction: { x: 1840, y: 600 },
  walls: [
    ...border(2000, 1200),
    ...partitions([
      // Jersey barriers and stalled traffic forming a guarded corridor.
      { x: 240, y: 300, w: 320, h: 44 },
      { x: 700, y: 300, w: 380, h: 44 },
      { x: 1240, y: 300, w: 420, h: 44 },
      { x: 240, y: 860, w: 380, h: 44 },
      { x: 780, y: 860, w: 340, h: 44 },
      { x: 1300, y: 860, w: 400, h: 44 },
      { x: 520, y: 520, w: 120, h: 70 },
      { x: 980, y: 620, w: 120, h: 70 },
      { x: 1480, y: 500, w: 120, h: 70 },
      { x: 300, y: 640, w: 120, h: 70 },
    ]),
  ],
}

/** Runner Alpha arena: a debris-choked dead end. */
const DEADEND: GameMap = {
  id: 'deadend',
  name: 'The Dead End',
  width: 1500,
  height: 1200,
  color: '#191b1f',
  wallColor: '#6b4a34',
  wallEdge: '#3d2919',
  floor: 'asphalt',
  accent: '#ff9d6b',
  extraction: { x: 1340, y: 1060 },
  walls: [
    ...border(1500, 1200),
    { x: 120, y: 120, w: 260, h: 260 },
    { x: 1120, y: 120, w: 260, h: 260 },
    { x: 120, y: 820, w: 260, h: 260 },
    { x: 1120, y: 820, w: 260, h: 260 },
    ...partitions([
      // Skips and rubble piles the Alpha vaults over.
      { x: 560, y: 220, w: 140, h: 90 },
      { x: 840, y: 460, w: 120, h: 120 },
      { x: 480, y: 700, w: 150, h: 100 },
      { x: 900, y: 880, w: 130, h: 90 },
    ]),
  ],
}

/** Camo Stalker arena: a fogged-in loading dock. */
const FOGWARD: GameMap = {
  id: 'fogward',
  name: 'The Fog Ward',
  width: 1600,
  height: 1400,
  color: '#20262b',
  wallColor: '#5f6b6f',
  wallEdge: '#333c40',
  floor: 'wood',
  accent: '#a8e6d6',
  extraction: { x: 1440, y: 1240 },
  walls: [
    ...border(1600, 1400),
    ...partitions([
      { x: 320, y: 300, w: 340, h: 44 },
      { x: 940, y: 300, w: 340, h: 44 },
      { x: 320, y: 1060, w: 340, h: 44 },
      { x: 940, y: 1060, w: 340, h: 44 },
      { x: 300, y: 520, w: 44, h: 360 },
      { x: 1260, y: 520, w: 44, h: 360 },
      // Stacked dock pallets to break line of sight.
      { x: 620, y: 560, w: 120, h: 120 },
      { x: 880, y: 740, w: 120, h: 120 },
      { x: 480, y: 860, w: 100, h: 100 },
      { x: 1000, y: 460, w: 100, h: 100 },
    ]),
  ],
}

/** Chapter 2: the frozen approach to the Project Horizon facility. */
const GLACIER: GameMap = {
  id: 'glacier',
  name: 'Glacier Approach',
  width: 1900,
  height: 1500,
  color: '#33505f',
  wallColor: '#9fc7dd',
  wallEdge: '#4d7a94',
  floor: 'snow',
  accent: '#e0f2fe',
  extraction: { x: 1740, y: 1340 },
  walls: [
    ...border(1900, 1500),
    { x: 240, y: 220, w: 300, h: 200 },
    { x: 980, y: 180, w: 340, h: 180 },
    { x: 1520, y: 420, w: 240, h: 260 },
    { x: 200, y: 780, w: 260, h: 240 },
    { x: 720, y: 640, w: 320, h: 200 },
    { x: 1180, y: 900, w: 300, h: 220 },
    ...partitions([
      // Ice ridges and frozen crates scattered along the approach.
      { x: 620, y: 320, w: 120, h: 90 },
      { x: 1420, y: 1100, w: 140, h: 90 },
      { x: 520, y: 1140, w: 200, h: 80 },
      { x: 900, y: 1240, w: 120, h: 90 },
    ]),
  ],
}

/** Chapter 2: a sealed cryo lab used for the Hold the Line siege. */
const CRYOLAB: GameMap = {
  id: 'cryolab',
  name: 'Cryo Lab',
  width: 1300,
  height: 1100,
  color: '#2b4655',
  wallColor: '#8fb6cc',
  wallEdge: '#3f5b6b',
  floor: 'ice',
  accent: '#bae6fd',
  extraction: { x: 1160, y: 960 },
  // One sealed chamber: pillars and cryo pods for cover, no way out.
  walls: [
    ...border(1300, 1100),
    ...partitions([
      { x: 300, y: 260, w: 110, h: 110 },
      { x: 880, y: 260, w: 110, h: 110 },
      { x: 300, y: 720, w: 110, h: 110 },
      { x: 880, y: 720, w: 110, h: 110 },
      { x: 590, y: 500, w: 120, h: 120 },
      { x: 120, y: 520, w: 90, h: 70 },
      { x: 1090, y: 520, w: 90, h: 70 },
    ]),
  ],
}

/** Chapter 2: an exposed camp built around a single power generator. */
const CAMP: GameMap = {
  id: 'camp',
  name: 'Generator Camp',
  width: 1700,
  height: 1400,
  color: '#35525f',
  wallColor: '#7f9aa8',
  wallEdge: '#3d5460',
  floor: 'snow',
  accent: '#d1f0ff',
  extraction: { x: 1540, y: 1240 },
  walls: [
    ...border(1700, 1400),
    { x: 220, y: 220, w: 240, h: 160 },
    { x: 1240, y: 220, w: 240, h: 160 },
    { x: 220, y: 1020, w: 240, h: 160 },
    { x: 1240, y: 1020, w: 240, h: 160 },
    ...partitions([
      // Sandbag lines ringing the generator pad, with gaps to defend.
      { x: 560, y: 420, w: 260, h: 36 },
      { x: 900, y: 420, w: 240, h: 36 },
      { x: 560, y: 944, w: 240, h: 36 },
      { x: 880, y: 944, w: 260, h: 36 },
      { x: 520, y: 520, w: 36, h: 200 },
      { x: 520, y: 800, w: 36, h: 140 },
      { x: 1144, y: 520, w: 36, h: 200 },
      { x: 1144, y: 800, w: 36, h: 140 },
    ]),
  ],
}

/** Chapter 2: the frost core chamber where the Cryo-Stalker is contained. */
const FROZEN_CORE: GameMap = {
  id: 'frozencore',
  name: 'The Frozen Core',
  width: 1600,
  height: 1300,
  color: '#294455',
  wallColor: '#a8cfe4',
  wallEdge: '#456b83',
  floor: 'ice',
  accent: '#e0f7ff',
  extraction: { x: 1440, y: 1160 },
  // A round-ish arena ringed with shattered ice pods to break line of sight.
  walls: [
    ...border(1600, 1300),
    ...partitions([
      { x: 300, y: 240, w: 90, h: 150 },
      { x: 520, y: 170, w: 90, h: 150 },
      { x: 1000, y: 170, w: 90, h: 150 },
      { x: 1220, y: 240, w: 90, h: 150 },
      { x: 180, y: 560, w: 150, h: 90 },
      { x: 1280, y: 560, w: 150, h: 90 },
      { x: 300, y: 930, w: 90, h: 150 },
      { x: 520, y: 1000, w: 90, h: 150 },
      { x: 1000, y: 1000, w: 90, h: 150 },
      { x: 1220, y: 930, w: 90, h: 150 },
    ]),
  ],
}

export const MAPS: GameMap[] = [
  STREETS,
  WAREHOUSE,
  HIVE,
  REFUGE,
  ALLEY,
  ROOFTOP,
  HIGHWAY,
  DEADEND,
  FOGWARD,
  GLACIER,
  CRYOLAB,
  CAMP,
  FROZEN_CORE,
]

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
