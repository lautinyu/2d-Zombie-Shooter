/**
 * Environmental hazards for the Chapter 4 rustlands: oil slicks that rob the
 * ground of friction and derelict industrial turrets that sweep the yard with
 * a damaging laser. The manager owns placement, simulation and drawing, and
 * treats every registered body the same way, so both co-op players and the
 * infected are equally at its mercy.
 */

import type { GameMap } from './maps'
import { circleHitsWall } from './maps'
import { AoeTicker } from './aoe'

/** Fraction of normal ground friction removed while standing in oil. */
export const OIL_FRICTION_LOSS = 0.6
/** Seconds a player keeps sliding after touching a slick. */
export const OIL_SLIDE_TIME = 1.5

const TURRET_RANGE = 420
const TURRET_SPIN = Math.PI * 0.55
const BEAM_HALF_WIDTH = 7

export interface OilSpill {
  x: number
  y: number
  r: number
  /** Drives the slow rainbow shimmer on the surface. */
  phase: number
}

export interface LaserTurret {
  x: number
  y: number
  angle: number
  spin: number
  range: number
  /** Live beam length after the raycast stops at the first wall. */
  beam: number
  /** Per-body tick budget, reset when the beam sweeps off a body. */
  ticker: AoeTicker<HazardBody>
}

/** Anything a hazard can touch: both players and zombies qualify. */
export interface HazardBody {
  x: number
  y: number
  r: number
}

export interface HazardHooks {
  /** Every body the beam may burn, with the damage sink for each. */
  bodies: { body: HazardBody; hurt: (amount: number) => void }[]
}

/** Deterministic per-map layout so a stage always has the same hazards. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export class HazardManager {
  readonly spills: OilSpill[] = []
  readonly turrets: LaserTurret[] = []

  private readonly map: GameMap

  constructor(map: GameMap, spillCount: number, turretCount: number) {
    this.map = map
    const rng = seededRandom(hashString(map.id))
    const spawn = map.spawn ?? { x: -9999, y: -9999 }
    const place = (r: number): { x: number; y: number } | null => {
      for (let tries = 0; tries < 60; tries++) {
        const x = r + rng() * (map.width - r * 2)
        const y = r + rng() * (map.height - r * 2)
        if (circleHitsWall(map, x, y, r)) continue
        // Never drop a hazard on top of the insertion or extraction point.
        if (Math.hypot(x - spawn.x, y - spawn.y) < 320) continue
        if (Math.hypot(x - map.extraction.x, y - map.extraction.y) < 320) continue
        return { x, y }
      }
      return null
    }

    for (let i = 0; i < spillCount; i++) {
      const r = 70 + rng() * 60
      const spot = place(r)
      if (spot) this.spills.push({ x: spot.x, y: spot.y, r, phase: rng() * Math.PI * 2 })
    }
    for (let i = 0; i < turretCount; i++) {
      const spot = place(26)
      if (!spot) continue
      this.turrets.push({
        x: spot.x,
        y: spot.y,
        angle: rng() * Math.PI * 2,
        spin: TURRET_SPIN * (rng() < 0.5 ? -1 : 1),
        range: TURRET_RANGE,
        beam: TURRET_RANGE,
        ticker: new AoeTicker<HazardBody>(),
      })
    }
  }

  /** True when the given circle is standing in an oil slick. */
  slippery(x: number, y: number, r: number): boolean {
    return this.spills.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r)
  }

  /** Spins every turret and burns whatever its raycast lands on. */
  update(dt: number, hooks: HazardHooks) {
    for (const s of this.spills) s.phase += dt * 0.8

    for (const t of this.turrets) {
      t.angle += t.spin * dt
      t.beam = this.castBeam(t)
      const ux = Math.cos(t.angle)
      const uy = Math.sin(t.angle)
      for (const entry of hooks.bodies) {
        const b = entry.body
        const along = (b.x - t.x) * ux + (b.y - t.y) * uy
        const px = t.x + ux * along
        const py = t.y + uy * along
        const lit =
          along >= 0 && along <= t.beam && Math.hypot(b.x - px, b.y - py) <= b.r + BEAM_HALF_WIDTH
        if (!lit) {
          t.ticker.reset(b)
          continue
        }
        const damage = t.ticker.tick(b, dt)
        if (damage) entry.hurt(damage)
      }
    }
  }

  /** Marches the beam forward until it meets a wall or runs out of reach. */
  private castBeam(t: LaserTurret): number {
    const step = 14
    for (let d = step; d <= t.range; d += step) {
      const x = t.x + Math.cos(t.angle) * d
      const y = t.y + Math.sin(t.angle) * d
      if (x < 0 || y < 0 || x > this.map.width || y > this.map.height) return d
      if (circleHitsWall(this.map, x, y, 2)) return d
    }
    return t.range
  }

  render(ctx: CanvasRenderingContext2D, time: number) {
    for (const s of this.spills) {
      ctx.save()
      const glow = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r)
      glow.addColorStop(0, 'rgba(12,10,18,0.92)')
      glow.addColorStop(0.75, 'rgba(24,18,34,0.78)')
      glow.addColorStop(1, 'rgba(24,18,34,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
      // Oil-slick sheen: a couple of drifting iridescent rings.
      ctx.globalAlpha = 0.35
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = ['#7c3aed', '#0ea5e9', '#f472b6'][i]
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * (0.35 + i * 0.22) + Math.sin(s.phase + i) * 5, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    for (const t of this.turrets) {
      const ux = Math.cos(t.angle)
      const uy = Math.sin(t.angle)
      ctx.save()
      ctx.strokeStyle = 'rgba(248,113,113,0.85)'
      ctx.lineWidth = BEAM_HALF_WIDTH * 2
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.5 + Math.sin(time * 18) * 0.15
      ctx.beginPath()
      ctx.moveTo(t.x + ux * 20, t.y + uy * 20)
      ctx.lineTo(t.x + ux * t.beam, t.y + uy * t.beam)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#fee2e2'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(t.x + ux * 20, t.y + uy * 20)
      ctx.lineTo(t.x + ux * t.beam, t.y + uy * t.beam)
      ctx.stroke()

      ctx.fillStyle = '#334155'
      ctx.beginPath()
      ctx.arc(t.x, t.y, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#94a3b8'
      ctx.beginPath()
      ctx.arc(t.x, t.y, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(t.x + ux * 12 - 5, t.y + uy * 12 - 5, 10, 10)
      ctx.restore()
    }
  }
}

/**
 * Chapter 4 yards are rigged; everywhere else is clean. The rail mission is
 * skipped because its players are bolted into a moving truck bed.
 */
export function buildHazards(map: GameMap, chapter: number, missionType: string): HazardManager | null {
  if (chapter !== 4 || missionType === 'rail') return null
  return new HazardManager(map, 4, 3)
}
