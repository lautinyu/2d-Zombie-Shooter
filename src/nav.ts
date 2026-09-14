import type { GameMap, MapId } from './maps'
import { circleHitsWall } from './maps'

const CELL = 24
const UNREACHABLE = -1

export interface FlowField {
  cols: number
  rows: number
  cell: number
  /** BFS step count to the goal, or UNREACHABLE. */
  dist: Int32Array
}

const cache = new Map<MapId, FlowField>()

function index(f: FlowField, cx: number, cy: number) {
  return cy * f.cols + cx
}

function passable(map: GameMap, cx: number, cy: number, clearance: number) {
  const x = cx * CELL + CELL / 2
  const y = cy * CELL + CELL / 2
  if (x < clearance || y < clearance || x > map.width - clearance || y > map.height - clearance) {
    return false
  }
  return !circleHitsWall(map, x, y, clearance)
}

/**
 * Breadth-first distance field flowing to the map's extraction point, so
 * escorted survivors follow corridors around buildings instead of pressing
 * into their walls. Cached per map since maps are static.
 */
export function extractionField(map: GameMap, clearance: number): FlowField {
  const cached = cache.get(map.id)
  if (cached) return cached
  const field = goalField(map, clearance, [map.extraction])
  cache.set(map.id, field)
  return field
}

/**
 * Same breadth-first field, but flowing to an arbitrary point — enemies use one
 * aimed at the player so they round corners instead of pressing into walls.
 */
export function goalField(
  map: GameMap,
  clearance: number,
  goals: { x: number; y: number }[]
): FlowField {
  const cols = Math.ceil(map.width / CELL)
  const rows = Math.ceil(map.height / CELL)
  const field: FlowField = { cols, rows, cell: CELL, dist: new Int32Array(cols * rows).fill(UNREACHABLE) }

  const open: boolean[] = new Array(cols * rows)
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      open[index(field, cx, cy)] = passable(map, cx, cy, clearance)
    }
  }

  const queue: number[] = []
  for (const g of goals) {
    const goal = nearestOpenCell(field, open, g.x, g.y)
    if (goal < 0 || field.dist[goal] === 0) continue
    field.dist[goal] = 0
    queue.push(goal)
  }
  if (!queue.length) return field

  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]
    const cx = at % cols
    const cy = Math.floor(at / cols)
    const next = field.dist[at] + 1
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue
        const nx = cx + ox
        const ny = cy + oy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        // Diagonals may not cut a wall corner.
        if (ox && oy && (!open[index(field, cx + ox, cy)] || !open[index(field, cx, cy + oy)])) continue
        const ni = index(field, nx, ny)
        if (!open[ni] || field.dist[ni] !== UNREACHABLE) continue
        field.dist[ni] = next
        queue.push(ni)
      }
    }
  }

  return field
}

function nearestOpenCell(f: FlowField, open: boolean[], x: number, y: number): number {
  const cx = clampInt(Math.floor(x / f.cell), 0, f.cols - 1)
  const cy = clampInt(Math.floor(y / f.cell), 0, f.rows - 1)
  if (open[index(f, cx, cy)]) return index(f, cx, cy)
  for (let radius = 1; radius < 24; radius++) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue
        const nx = cx + ox
        const ny = cy + oy
        if (nx < 0 || ny < 0 || nx >= f.cols || ny >= f.rows) continue
        if (open[index(f, nx, ny)]) return index(f, nx, ny)
      }
    }
  }
  return -1
}

/**
 * Unit vector pointing at the neighbouring cell closest to the goal, or null
 * when no route exists from here.
 */
export function flowDirection(f: FlowField, x: number, y: number): { x: number; y: number } | null {
  const cx = clampInt(Math.floor(x / f.cell), 0, f.cols - 1)
  const cy = clampInt(Math.floor(y / f.cell), 0, f.rows - 1)
  const here = f.dist[index(f, cx, cy)]

  let bestDist = here === UNREACHABLE ? Infinity : here
  let bestX = -1
  let bestY = -1
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue
      const nx = cx + ox
      const ny = cy + oy
      if (nx < 0 || ny < 0 || nx >= f.cols || ny >= f.rows) continue
      const d = f.dist[index(f, nx, ny)]
      if (d === UNREACHABLE || d >= bestDist) continue
      bestDist = d
      bestX = nx
      bestY = ny
    }
  }
  if (bestX < 0) return null

  // Aim at the centre of the better cell so movement hugs open corridors.
  const tx = bestX * f.cell + f.cell / 2
  const ty = bestY * f.cell + f.cell / 2
  const dx = tx - x
  const dy = ty - y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function clampInt(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
