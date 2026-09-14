/**
 * THE ENDLESS HIGHWAY GAUNTLET — a standalone arcade cabinet built on the
 * Chapter 4 truck-bed rail mechanic: the rig never stops, the horde never ends,
 * and the only way back is to keep the chassis welded together.
 *
 * Like the other cabinets it owns its overlay, canvas, loop, input and storage,
 * so the campaign state is never touched.
 */

import { playSfx } from './audio'
import { recordPlay, readGauntletStats, saveGauntletRun, submitScore } from './arcadeStats'

const VIEW_W = 840
const VIEW_H = 520

/** Metres of highway covered per second at cruising speed. */
const RIG_SPEED = 26
/** Difficulty steps up on every one of these. */
const MILESTONE_METRES = 500
const SPAWN_RATE_STEP = 0.15
const ENEMY_SPEED_STEP = 0.05

export const MAX_RIG_INTEGRITY = 1000
/** Integrity welded back per second of held repair, shared by both players. */
const REPAIR_RATE = 55
/** Chassis damage a zombie deals when it reaches the rig. */
const RAM_DAMAGE = 42
const BASE_SPAWN_INTERVAL = 1.15
const BULLET_SPEED = 900
const FIRE_INTERVAL = 0.14

/** A boss rolls up on every 1,000 m mark and holds the road until it dies. */
const BOSS_INTERVAL_METRES = 1000
const BOSS_RAM_DAMAGE = 110
/** Scrap plating on the crawler halves every bullet that lands on it. */
const CRAWLER_ARMOUR = 0.5
const BOSS_NAMES: Record<'crawler' | 'charger', string> = {
  crawler: 'ARMORED HIGHWAY CRAWLER',
  charger: 'MUTATED CHARGER',
}

const TRUCK_X = 210
const TRUCK_Y = VIEW_H / 2
const TRUCK_HW = 130
const TRUCK_HH = 62
/** The cab end of the rig: stand here to weld the engine block. */
const ENGINE_X = TRUCK_X - TRUCK_HW + 34
const REPAIR_RANGE = 78

const SEATS = [
  { x: 46, y: -26 },
  { x: 46, y: 26 },
]

type Phase = 'attract' | 'playing' | 'over'

interface Gunner {
  id: 1 | 2
  x: number
  y: number
  angle: number
  fireTimer: number
  /** Seconds of held repair, for the welding spark animation. */
  welding: number
}

interface Zombie {
  x: number
  y: number
  r: number
  hp: number
  speed: number
  hue: number
  flash: number
}

type BossKind = 'crawler' | 'charger'

/**
 * Gauntlet boss. The crawler grinds forward behind scrap plating and slams
 * the rig; the charger circles out of reach then dashes straight through it.
 */
interface Boss {
  kind: BossKind
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  speed: number
  flash: number
  /** Seconds until the next dash (charger) or plate slam (crawler). */
  attackTimer: number
  /** Seconds left of an active dash; 0 while circling or grinding in. */
  dash: number
  vx: number
  vy: number
  orbit: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

interface Spark {
  x: number
  y: number
  life: number
  color: string
}

export interface GauntletCabinet {
  open: () => void
  close: () => void
  isOpen: () => boolean
}

export function mountEndlessGauntlet(onQuit: () => void): GauntletCabinet {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-40 hidden flex-col items-center justify-center bg-black/98 p-4'
  overlay.innerHTML = `
    <div class="flex w-full max-w-[880px] items-center justify-between pb-2">
      <div class="text-xs font-black uppercase tracking-[0.35em] text-amber-400">The Endless Highway Gauntlet</div>
      <button id="gauntlet-quit" class="rounded-lg bg-amber-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200 ring-1 ring-amber-400/60 hover:bg-amber-500/35">Quit to Main Menu</button>
    </div>
  `

  const frame = document.createElement('div')
  frame.className =
    'rounded-2xl bg-slate-950 p-3 ring-2 ring-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.3)]'
  const canvas = document.createElement('canvas')
  canvas.width = VIEW_W
  canvas.height = VIEW_H
  canvas.className = 'block w-[min(92vw,880px)] rounded-lg bg-black'
  frame.appendChild(canvas)
  overlay.appendChild(frame)

  const legend = document.createElement('div')
  legend.className = 'pt-3 text-center text-[11px] uppercase tracking-[0.25em] text-slate-500'
  legend.textContent =
    'P1 mouse aims · click or space fires · hold E at the engine to repair · P2 arrows aim, / fires, M repairs'
  overlay.appendChild(legend)

  document.body.appendChild(overlay)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('endless gauntlet canvas context unavailable')

  let open = false
  let phase: Phase = 'attract'
  let raf = 0
  let last = 0
  let blink = 0
  let shake = 0
  let overTimer = 0

  let distance = 0
  let kills = 0
  let rigIntegrity = MAX_RIG_INTEGRITY
  let spawnTimer = BASE_SPAWN_INTERVAL
  let scroll = 0
  let stats = readGauntletStats()

  const held = new Set<string>()
  let pointer = { x: VIEW_W * 0.75, y: VIEW_H / 2 }
  let pointerDown = false

  const gunners: Gunner[] = [
    { id: 1, x: 0, y: 0, angle: 0, fireTimer: 0, welding: 0 },
    { id: 2, x: 0, y: 0, angle: 0, fireTimer: 0, welding: 0 },
  ]
  let zombies: Zombie[] = []
  let boss: Boss | null = null
  let bossesDown = 0
  let nextBossAt = BOSS_INTERVAL_METRES
  let bullets: Bullet[] = []
  let sparks: Spark[] = []

  const dust = Array.from({ length: 60 }, () => ({
    x: Math.random() * VIEW_W,
    y: Math.random() * VIEW_H,
    speed: 90 + Math.random() * 260,
    size: 1 + Math.random() * 2,
  }))

  /** Completed 500 m steps; every one makes the horde thicker and faster. */
  const milestones = () => Math.floor(distance / MILESTONE_METRES)
  const spawnInterval = () => BASE_SPAWN_INTERVAL / (1 + SPAWN_RATE_STEP * milestones())
  const enemySpeedScale = () => 1 + ENEMY_SPEED_STEP * milestones()

  const seat = (g: Gunner) => {
    const s = SEATS[g.id - 1]
    g.x = TRUCK_X + s.x
    g.y = TRUCK_Y + s.y
  }

  const reset = () => {
    distance = 0
    kills = 0
    rigIntegrity = MAX_RIG_INTEGRITY
    spawnTimer = BASE_SPAWN_INTERVAL
    overTimer = 0
    shake = 0
    zombies = []
    bullets = []
    sparks = []
    boss = null
    bossesDown = 0
    nextBossAt = BOSS_INTERVAL_METRES
    for (const g of gunners) {
      g.angle = 0
      g.fireTimer = 0
      g.welding = 0
      seat(g)
    }
  }

  const gameOver = () => {
    phase = 'over'
    overTimer = 0
    shake = 1
    playSfx('explosion')
    stats = saveGauntletRun(distance, kills)
    submitScore('endless-gauntlet', distance)
  }

  const spawnZombie = () => {
    // Runners pour in from the road ahead and from both shoulders.
    const edge = Math.random()
    const x = edge < 0.65 ? VIEW_W + 30 : 60 + Math.random() * (VIEW_W - 120)
    const y = edge < 0.65 ? 60 + Math.random() * (VIEW_H - 120) : Math.random() < 0.5 ? -30 : VIEW_H + 30
    const tough = Math.random() < Math.min(0.45, 0.08 + milestones() * 0.04)
    zombies.push({
      x,
      y,
      r: tough ? 18 : 14,
      hp: (tough ? 150 : 70) * (1 + milestones() * 0.1),
      speed: (tough ? 58 : 82) * enemySpeedScale(),
      hue: tough ? 14 : 96,
      flash: 0,
    })
  }

  /** Every 1,000 m the horde stands down and one of two bosses rolls in. */
  const spawnBoss = () => {
    const wave = bossesDown
    const kind: BossKind = wave % 2 === 0 ? 'crawler' : 'charger'
    const tier = 1 + wave * 0.45
    const hp = (kind === 'crawler' ? 2200 : 1500) * tier
    boss = {
      kind,
      x: VIEW_W + 90,
      y: TRUCK_Y + (Math.random() - 0.5) * 160,
      r: kind === 'crawler' ? 44 : 30,
      hp,
      maxHp: hp,
      speed: (kind === 'crawler' ? 46 : 74) * enemySpeedScale(),
      flash: 0,
      attackTimer: kind === 'crawler' ? 3 : 2.2,
      dash: 0,
      vx: 0,
      vy: 0,
      orbit: Math.random() * Math.PI * 2,
    }
    shake = Math.max(shake, 0.6)
    playSfx('explosion')
  }

  /** Crawler plating soaks half of every round; the charger takes it raw. */
  const bossArmour = (b: Boss) => (b.kind === 'crawler' ? CRAWLER_ARMOUR : 1)

  const updateBoss = (b: Boss, dt: number) => {
    b.flash = Math.max(0, b.flash - dt)
    b.attackTimer -= dt
    const dx = TRUCK_X - b.x
    const dy = TRUCK_Y - b.y
    const len = Math.hypot(dx, dy) || 1

    if (b.kind === 'charger') {
      if (b.dash > 0) {
        b.dash -= dt
        b.x += b.vx * dt
        b.y += b.vy * dt
      } else {
        // Circle the rig at a stand-off distance, winding up the next dash.
        b.orbit += dt * 1.1
        const ring = 300
        const tx = TRUCK_X + Math.cos(b.orbit) * ring
        const ty = TRUCK_Y + Math.sin(b.orbit) * ring * 0.55
        const ox = tx - b.x
        const oy = ty - b.y
        const olen = Math.hypot(ox, oy) || 1
        b.x += (ox / olen) * b.speed * 1.6 * dt
        b.y += (oy / olen) * b.speed * 1.6 * dt
        if (b.attackTimer <= 0) {
          b.attackTimer = 2.6
          b.dash = 1.1
          b.vx = (dx / len) * b.speed * 6
          b.vy = (dy / len) * b.speed * 6
          playSfx('sting')
        }
      }
    } else {
      b.x += (dx / len) * b.speed * dt
      b.y += (dy / len) * b.speed * dt
      // Plate slam: a shockwave of shrapnel thrown down the road.
      if (b.attackTimer <= 0) {
        b.attackTimer = 3.4
        shake = Math.max(shake, 0.35)
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2
          sparks.push({ x: b.x + Math.cos(a) * b.r, y: b.y + Math.sin(a) * b.r, life: 0.4, color: '#fb923c' })
        }
      }
    }

    b.x = Math.max(-120, Math.min(VIEW_W + 140, b.x))
    b.y = Math.max(-80, Math.min(VIEW_H + 80, b.y))

    if (hitsRig(b.x, b.y, b.r)) {
      rigIntegrity -= BOSS_RAM_DAMAGE
      shake = Math.max(shake, 0.7)
      playSfx('explosion')
      sparks.push({ x: b.x, y: b.y, life: 0.4, color: '#f87171' })
      // Bounced off the chassis: the boss is thrown clear and resets.
      b.dash = 0
      b.x = VIEW_W + 80
      b.y = TRUCK_Y + (Math.random() - 0.5) * 200
      b.attackTimer = b.kind === 'charger' ? 2.6 : 3.4
    }

    if (b.hp <= 0) {
      bossesDown += 1
      kills += 1
      nextBossAt = (Math.floor(distance / BOSS_INTERVAL_METRES) + 1) * BOSS_INTERVAL_METRES
      shake = Math.max(shake, 0.8)
      playSfx('explosion')
      for (let i = 0; i < 24; i++) {
        sparks.push({
          x: b.x + (Math.random() - 0.5) * b.r * 3,
          y: b.y + (Math.random() - 0.5) * b.r * 3,
          life: 0.5,
          color: Math.random() < 0.5 ? '#fbbf24' : '#f97316',
        })
      }
      boss = null
    }
  }

  const fire = (g: Gunner) => {
    if (g.fireTimer > 0) return
    g.fireTimer = FIRE_INTERVAL
    const muzzle = 22
    bullets.push({
      x: g.x + Math.cos(g.angle) * muzzle,
      y: g.y + Math.sin(g.angle) * muzzle,
      vx: Math.cos(g.angle) * BULLET_SPEED,
      vy: Math.sin(g.angle) * BULLET_SPEED,
      life: 0.9,
    })
    playSfx('sting')
  }

  const hitsRig = (x: number, y: number, r: number) => {
    const nx = Math.max(TRUCK_X - TRUCK_HW, Math.min(TRUCK_X + TRUCK_HW, x))
    const ny = Math.max(TRUCK_Y - TRUCK_HH, Math.min(TRUCK_Y + TRUCK_HH, y))
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r
  }

  const update = (dt: number) => {
    blink += dt
    shake = Math.max(0, shake - dt)
    scroll = (scroll + RIG_SPEED * 14 * dt) % 240
    for (const d of dust) {
      d.x -= d.speed * dt
      if (d.x < -4) {
        d.x = VIEW_W + 4
        d.y = Math.random() * VIEW_H
      }
    }
    for (const s of sparks) s.life -= dt
    sparks = sparks.filter((s) => s.life > 0)

    if (phase === 'over') {
      overTimer += dt
      return
    }
    if (phase !== 'playing') return

    distance += RIG_SPEED * dt

    // Player 1 tracks the mouse; player 2 aims with the arrow cluster.
    const p1 = gunners[0]
    p1.angle = Math.atan2(pointer.y - p1.y, pointer.x - p1.x)
    const p2 = gunners[1]
    const ax = (held.has('arrowright') ? 1 : 0) - (held.has('arrowleft') ? 1 : 0)
    const ay = (held.has('arrowdown') ? 1 : 0) - (held.has('arrowup') ? 1 : 0)
    if (ax !== 0 || ay !== 0) p2.angle = Math.atan2(ay, ax)

    for (const g of gunners) {
      g.fireTimer = Math.max(0, g.fireTimer - dt)
      g.welding = Math.max(0, g.welding - dt)
    }
    if (pointerDown || held.has(' ')) fire(p1)
    if (held.has('/')) fire(p2)

    // Repairs: hold the weld key while stood over the engine block.
    const repairKeys: Record<number, string> = { 1: 'e', 2: 'm' }
    for (const g of gunners) {
      if (!held.has(repairKeys[g.id])) continue
      if (Math.abs(g.x - ENGINE_X) > REPAIR_RANGE) continue
      if (rigIntegrity >= MAX_RIG_INTEGRITY) continue
      rigIntegrity = Math.min(MAX_RIG_INTEGRITY, rigIntegrity + REPAIR_RATE * dt)
      g.welding = 0.12
      if (Math.random() < 0.5) {
        sparks.push({ x: ENGINE_X + (Math.random() - 0.5) * 24, y: TRUCK_Y + (Math.random() - 0.5) * 40, life: 0.25, color: '#fde68a' })
      }
    }

    if (!boss && distance >= nextBossAt) spawnBoss()

    // Standard waves stand down for the duration of a boss encounter.
    if (!boss) {
      spawnTimer -= dt
      if (spawnTimer <= 0) {
        spawnTimer = spawnInterval()
        spawnZombie()
        if (milestones() >= 4 && Math.random() < 0.35) spawnZombie()
      }
    }

    for (const b of bullets) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life -= dt
    }
    bullets = bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < VIEW_W + 40 && b.y > -40 && b.y < VIEW_H + 40)

    for (const z of zombies) {
      z.flash = Math.max(0, z.flash - dt)
      const dx = TRUCK_X - z.x
      const dy = TRUCK_Y - z.y
      const len = Math.hypot(dx, dy) || 1
      z.x += (dx / len) * z.speed * dt
      z.y += (dy / len) * z.speed * dt
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]
      if (boss && (boss.x - b.x) ** 2 + (boss.y - b.y) ** 2 < boss.r * boss.r) {
        boss.hp -= 46 * bossArmour(boss)
        boss.flash = 0.1
        sparks.push({ x: b.x, y: b.y, life: 0.18, color: '#fde68a' })
        bullets.splice(i, 1)
        continue
      }
      for (const z of zombies) {
        if (z.hp <= 0) continue
        if ((z.x - b.x) ** 2 + (z.y - b.y) ** 2 > z.r * z.r) continue
        z.hp -= 46
        z.flash = 0.1
        sparks.push({ x: b.x, y: b.y, life: 0.18, color: '#fca5a5' })
        bullets.splice(i, 1)
        break
      }
    }

    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i]
      if (z.hp <= 0) {
        zombies.splice(i, 1)
        kills += 1
        sparks.push({ x: z.x, y: z.y, life: 0.3, color: '#86efac' })
        continue
      }
      if (!hitsRig(z.x, z.y, z.r)) continue
      zombies.splice(i, 1)
      rigIntegrity -= RAM_DAMAGE
      shake = Math.max(shake, 0.4)
      sparks.push({ x: z.x, y: z.y, life: 0.3, color: '#fb923c' })
      playSfx('explosion')
    }

    if (boss) updateBoss(boss, dt)

    if (rigIntegrity <= 0) {
      rigIntegrity = 0
      gameOver()
    }
  }

  const drawRoad = () => {
    ctx.fillStyle = '#221a12'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.fillStyle = '#2f2a24'
    ctx.fillRect(0, 70, VIEW_W, VIEW_H - 140)
    ctx.fillStyle = '#4b3f31'
    ctx.fillRect(0, 62, VIEW_W, 8)
    ctx.fillRect(0, VIEW_H - 70, VIEW_W, 8)
    ctx.fillStyle = 'rgba(250,204,21,0.65)'
    for (let x = -scroll; x < VIEW_W; x += 240) {
      ctx.fillRect(x, VIEW_H / 2 - 3, 130, 6)
    }
    ctx.fillStyle = 'rgba(226,232,240,0.25)'
    for (const d of dust) ctx.fillRect(d.x, d.y, d.size * 6, d.size)
  }

  const drawTruck = () => {
    ctx.save()
    ctx.translate(TRUCK_X, TRUCK_Y)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(-TRUCK_HW, -TRUCK_HH, TRUCK_HW * 2, TRUCK_HH * 2)
    ctx.fillStyle = '#334155'
    ctx.fillRect(-TRUCK_HW + 8, -TRUCK_HH + 8, TRUCK_HW * 2 - 16, TRUCK_HH * 2 - 16)
    // Cab and engine block at the front of the rig.
    ctx.fillStyle = '#475569'
    ctx.fillRect(-TRUCK_HW, -TRUCK_HH, 58, TRUCK_HH * 2)
    ctx.fillStyle = '#f59e0b'
    ctx.globalAlpha = 0.35 + Math.sin(blink * 6) * 0.15
    ctx.fillRect(ENGINE_X - TRUCK_X - 14, -22, 28, 44)
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    ctx.strokeRect(ENGINE_X - TRUCK_X - 14, -22, 28, 44)
    ctx.restore()
  }

  const drawGunner = (g: Gunner) => {
    ctx.save()
    ctx.translate(g.x, g.y)
    ctx.rotate(g.angle)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(6, -3, 26, 6)
    ctx.restore()
    ctx.beginPath()
    ctx.fillStyle = g.id === 1 ? '#38bdf8' : '#f472b6'
    ctx.arc(g.x, g.y, 13, 0, Math.PI * 2)
    ctx.fill()
    if (g.welding > 0) {
      ctx.fillStyle = 'rgba(253,224,71,0.8)'
      ctx.fillRect(g.x - 3, g.y - 22, 6, 10)
    }
  }

  const bar = (x: number, y: number, w: number, h: number, pct: number, color: string) => {
    ctx.fillStyle = 'rgba(15,23,42,0.85)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = color
    ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, Math.min(1, pct)), h - 4)
    ctx.strokeStyle = 'rgba(148,163,184,0.7)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }

  const retroText = (text: string, y: number, size: number, color: string, flashing = false) => {
    if (flashing && Math.floor(blink * 2) % 2 === 0) return
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = `bold ${size}px ui-monospace, monospace`
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 16
    ctx.fillText(text, VIEW_W / 2, y)
    ctx.restore()
  }

  const drawHud = () => {
    ctx.save()
    ctx.font = 'bold 15px ui-monospace, monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fbbf24'
    ctx.fillText(`RIG INTEGRITY  ${Math.ceil(rigIntegrity)} / ${MAX_RIG_INTEGRITY}`, 16, 26)
    bar(16, 34, 300, 14, rigIntegrity / MAX_RIG_INTEGRITY, '#f97316')
    ctx.textAlign = 'right'
    ctx.fillStyle = '#7dd3fc'
    ctx.fillText(`${Math.floor(distance)} M`, VIEW_W - 16, 26)
    ctx.fillStyle = '#86efac'
    ctx.fillText(`KILLS ${kills}`, VIEW_W - 16, 46)
    ctx.fillStyle = '#fca5a5'
    ctx.fillText(`THREAT x${(1 + SPAWN_RATE_STEP * milestones()).toFixed(2)}`, VIEW_W - 16, 66)
    ctx.restore()
    if (boss) drawBossBar(boss)
  }

  const drawBossBar = (b: Boss) => {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.font = 'bold 15px ui-monospace, monospace'
    ctx.fillStyle = '#f87171'
    ctx.fillText(BOSS_NAMES[b.kind], VIEW_W / 2, VIEW_H - 44)
    ctx.restore()
    bar(VIEW_W / 2 - 220, VIEW_H - 34, 440, 16, b.hp / b.maxHp, '#ef4444')
  }

  const drawBoss = (b: Boss) => {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.fillStyle = b.flash > 0 ? '#fff' : b.kind === 'crawler' ? '#57534e' : '#7f1d1d'
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, Math.PI * 2)
    ctx.fill()
    if (b.kind === 'crawler') {
      // Bolted scrap plates across the front of the hull.
      ctx.fillStyle = '#a8a29e'
      for (let i = -1; i <= 1; i++) ctx.fillRect(-b.r * 0.2, i * 18 - 7, b.r * 0.9, 14)
    } else {
      ctx.fillStyle = b.dash > 0 ? '#fca5a5' : '#ef4444'
      ctx.beginPath()
      ctx.arc(0, 0, b.r * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, b.r + 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const render = () => {
    ctx.save()
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12)
    drawRoad()
    drawTruck()
    for (const z of zombies) {
      ctx.beginPath()
      ctx.fillStyle = z.flash > 0 ? '#fff' : `hsl(${z.hue} 45% 40%)`
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(15,23,42,0.6)'
      ctx.fillRect(z.x - z.r * 0.4, z.y - z.r * 0.3, z.r * 0.8, z.r * 0.25)
    }
    if (boss) drawBoss(boss)
    for (const b of bullets) {
      ctx.fillStyle = '#fde68a'
      ctx.fillRect(b.x - 4, b.y - 2, 8, 4)
    }
    if (phase === 'playing') for (const g of gunners) drawGunner(g)
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life * 4)
      ctx.fillStyle = s.color
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6)
      ctx.globalAlpha = 1
    }
    ctx.restore()

    drawHud()

    if (phase === 'attract') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('THE ENDLESS HIGHWAY', VIEW_H / 2 - 110, 46, '#fbbf24')
      retroText('GAUNTLET', VIEW_H / 2 - 62, 46, '#f97316')
      retroText('INSERT COIN', VIEW_H / 2 + 4, 28, '#fcd34d', true)
      retroText('PRESS START  [ENTER]', VIEW_H / 2 + 48, 16, '#e2e8f0', true)
      retroText(`BEST ${stats.maxDistance} M  ·  LIFETIME KILLS ${stats.zombiesKilled}`, VIEW_H / 2 + 104, 16, '#7dd3fc')
      retroText('HOLD E (P1) / M (P2) AT THE ENGINE BLOCK TO REPAIR', VIEW_H / 2 + 144, 13, '#94a3b8')
    }

    if (phase === 'over') {
      ctx.fillStyle = 'rgba(20,6,0,0.82)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('RIG DESTROYED', VIEW_H / 2 - 70, 48, '#f97316', true)
      retroText(`${Math.floor(distance)} METRES  ·  ${kills} KILLS`, VIEW_H / 2 - 10, 24, '#fcd34d')
      retroText(`BEST ${stats.maxDistance} M  ·  LIFETIME KILLS ${stats.zombiesKilled}`, VIEW_H / 2 + 30, 18, '#7dd3fc')
      if (overTimer > 1.2) retroText('PRESS START TO RIDE AGAIN', VIEW_H / 2 + 100, 16, '#e2e8f0', true)
    }
  }

  const frameStep = (now: number) => {
    if (!open) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    update(dt)
    render()
    raf = window.requestAnimationFrame(frameStep)
  }

  const start = () => {
    reset()
    phase = 'playing'
    recordPlay('endless-gauntlet')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    const key = e.key.toLowerCase()
    e.stopPropagation()
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', '/'].includes(key)) e.preventDefault()
    held.add(key)
    if (key === 'escape') {
      close()
      return
    }
    if (phase !== 'playing' && (key === 'enter' || key === ' ')) {
      if (phase === 'attract' || overTimer > 1.2) start()
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (!open) return
    e.stopPropagation()
    held.delete(e.key.toLowerCase())
  }

  const onMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    pointer = {
      x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
    }
  }

  function close() {
    if (!open) return
    open = false
    window.cancelAnimationFrame(raf)
    held.clear()
    pointerDown = false
    overlay.classList.add('hidden')
    overlay.classList.remove('flex')
    onQuit()
  }

  overlay.querySelector<HTMLButtonElement>('#gauntlet-quit')?.addEventListener('click', () => close())
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mousedown', () => (pointerDown = true))
  window.addEventListener('mouseup', () => (pointerDown = false))
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)

  return {
    open: () => {
      if (open) return
      open = true
      stats = readGauntletStats()
      phase = 'attract'
      reset()
      overlay.classList.remove('hidden')
      overlay.classList.add('flex')
      last = performance.now()
      raf = window.requestAnimationFrame(frameStep)
    },
    close,
    isOpen: () => open,
  }
}
