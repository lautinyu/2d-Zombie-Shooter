import type { Mission } from './missions'
import type { Weapon } from './weapons'
import { weaponById } from './weapons'
import type { Character } from './characters'
import { characterById } from './characters'
import { SCRAP_PER_BUG, SCRAP_PER_KILL } from './profile'
import { playShot } from './audio'
import type { GameMap, Rect } from './maps'
import { circleHitsWall, mapById } from './maps'
import { extractionField, flowDirection } from './nav'
import { drawCharacterSkin } from './skins'

export type GameState = 'menu' | 'playing' | 'won' | 'lost'

interface Player {
  id: 1 | 2
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  speed: number
  angle: number
  hurtCooldown: number
  character: Character
  weapon: Weapon
  mag: number
  reserve: number
  reloadTimer: number
  fireTimer: number
  shotsFired: number
  shooting: boolean
  queuedShot: boolean
  stings: number
  lives: number
  safeTimer: number
  down: boolean
  /** Player 2 aims and fires at the nearest enemy on its own. */
  auto: boolean
}

export type EnemyKind = 'zombie' | 'bug'

interface Enemy {
  kind: EnemyKind
  x: number
  y: number
  r: number
  hp: number
  speed: number
  attackCooldown: number
  wobble: number
  retreat: number
  baseSpeed: number
  poison: number
  burn: number
  vision: number
  aware: boolean
  driftAngle: number
}

interface Survivor {
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  speed: number
  safe: boolean
  hurtCooldown: number
}

interface Turret {
  x: number
  y: number
  r: number
  angle: number
  cooldown: number
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  damage: number
  pierce: boolean
  poison: boolean
  ignite: boolean
  color: string
  width: number
  hit: Set<Enemy>
  maxLife: number
  falloff: number
  tracerLength: number
}

interface AmmoBox {
  x: number
  y: number
  amount: number
}

export interface HudSurvivor {
  hp: number
  maxHp: number
  safe: boolean
  /** False while no player is close enough to escort them. */
  moving: boolean
}

export interface HudPlayer {
  id: 1 | 2
  name: string
  characterName: string
  color: string
  hp: number
  maxHp: number
  mag: number
  magSize: number
  reserve: number
  reloading: boolean
  stings: number
  lives: number
  down: boolean
}

export interface Hud {
  players: HudPlayer[]
  kills: number
  target: number
  missionName: string
  objective: string
  mapName: string
  maxStings: number
  weaponName: string
  perkName: string
  scrap: number
  survivors: HudSurvivor[]
  extracted: number
  isProtect: boolean
}

export type DeathCause = 'wounds' | 'infection' | 'survivor'

const PLAYER_RADIUS = 16
const PLAYER_BASE_SPEED = 260
const ZOMBIE_VISION = 620
const BUG_VISION = 780
/** Awareness is kept until the player breaks well past the spotting range. */
const VISION_HYSTERESIS = 1.5
const MAX_STINGS = 5
const POISON_DURATION = 3
const POISON_DPS = 14
const BURN_DURATION = 2.5
const BURN_DPS = 16
const BURN_SLOW = 0.45
const ACID_SHOT_INTERVAL = 5
const IGNITE_CHANCE = 0.3
const BUG_SPAWN_CHANCE = 0.2
const HIVE_BUG_SPAWN_CHANCE = 0.45
const EXTRACTION_RADIUS = 70
const SURVIVOR_SPEED = 54
/** Survivors only advance while a player is close enough to escort them. */
const ESCORT_RADIUS = 240
const SURVIVOR_MAX_HP = 100
const SURVIVOR_ZOMBIE_DAMAGE = 16
const SURVIVOR_BUG_DAMAGE = 22
/** Survivors only pull aggro when clearly closer than a player. */
const SURVIVOR_AGGRO_BIAS = 0.75
/** Co-op camera keeps this much slack around the pair before zooming out. */
const COOP_CAMERA_MARGIN = 420
const MIN_ZOOM = 0.5
const P2_AUTO_FIRE_RANGE = 620
const TURRET_RANGE = 460
const TURRET_INTERVAL = 0.55
const TURRET_DAMAGE = 9

export class Game {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  state: GameState = 'menu'
  mission: Mission | null = null
  kills = 0
  scrapEarned = 0
  extracted = 0
  deathCause: DeathCause = 'wounds'
  weapon: Weapon = weaponById('rusty-pistol')
  character: Character = characterById('nature-lover')
  map: GameMap = mapById('streets')

  private players: Player[] = []
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private ammoBoxes: AmmoBox[] = []
  private survivors: Survivor[] = []
  private turret: Turret | null = null

  private spawnTimer = 0
  private spawned = 0

  private keys = new Set<string>()
  private mouseWorld = { x: 0, y: 0 }
  private mouseScreen = { x: 0, y: 0 }

  private camera = { x: 0, y: 0 }
  private zoom = 1
  private last = 0
  private running = false

  onHud: (hud: Hud) => void = () => {}
  onStateChange: (state: GameState) => void = () => {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    this.bindInput()
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private makePlayer(
    id: 1 | 2,
    x: number,
    y: number,
    weapon: Weapon,
    character: Character,
    auto: boolean
  ): Player {
    return {
      id,
      x,
      y,
      r: PLAYER_RADIUS,
      hp: 100,
      maxHp: 100,
      speed: PLAYER_BASE_SPEED * character.speedMultiplier,
      angle: 0,
      hurtCooldown: 0,
      character,
      weapon,
      mag: weapon.magSize,
      reserve: weapon.reserveStart,
      reloadTimer: 0,
      fireTimer: 0,
      shotsFired: 0,
      shooting: false,
      queuedShot: false,
      stings: 0,
      lives: character.extraLives,
      safeTimer: 0,
      down: false,
      auto,
    }
  }

  private get p1(): Player {
    return this.players[0]
  }

  private get alivePlayers(): Player[] {
    return this.players.filter((p) => !p.down)
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase())
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      const key = e.key.toLowerCase()
      if (key === 'r') this.startReload(this.p1)
      if (key === '.') {
        const p2 = this.players[1]
        if (p2) p2.queuedShot = true
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => this.keys.clear())

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      this.mouseScreen.x = e.clientX - rect.left
      this.mouseScreen.y = e.clientY - rect.top
    })
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.p1) {
        this.p1.shooting = true
        this.p1.queuedShot = true
      }
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.p1) this.p1.shooting = false
    })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(window.innerWidth * dpr)
    this.canvas.height = Math.floor(window.innerHeight * dpr)
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private get viewW() {
    return window.innerWidth
  }

  private get viewH() {
    return window.innerHeight
  }

  startMission(mission: Mission, weapon: Weapon, characters: Character[]) {
    this.mission = mission
    this.weapon = weapon
    this.character = characters[0]
    // Only the mission's own map is instantiated — other maps never load.
    this.map = mapById(mission.map)
    this.kills = 0
    this.scrapEarned = 0
    this.extracted = 0
    this.spawned = 0
    this.spawnTimer = 0
    this.deathCause = 'wounds'
    this.enemies = []
    this.bullets = []
    this.ammoBoxes = []
    this.zoom = 1

    this.players = []
    characters.slice(0, 2).forEach((c, i) => {
      const id: 1 | 2 = i === 0 ? 1 : 2
      const spawn =
        i === 0
          ? this.openSpot(PLAYER_RADIUS + 10)
          : this.openSpot(PLAYER_RADIUS + 10, this.players[0], 50, 180)
      this.players.push(this.makePlayer(id, spawn.x, spawn.y, weapon, c, id === 2))
    })

    this.survivors = []
    for (let i = 0; i < mission.survivors; i++) {
      let spot = this.openSpot(20, this.p1, 120, 700)
      // Keep the walk to extraction long enough to be a real escort.
      for (let tries = 0; tries < 60; tries++) {
        if (Math.hypot(spot.x - this.map.extraction.x, spot.y - this.map.extraction.y) > 750) break
        spot = this.openSpot(20, this.p1, 120, 700)
      }
      this.survivors.push({
        x: spot.x,
        y: spot.y,
        r: 13,
        hp: SURVIVOR_MAX_HP,
        maxHp: SURVIVOR_MAX_HP,
        speed: SURVIVOR_SPEED,
        safe: false,
        hurtCooldown: 0,
      })
    }

    const engineer = this.players.find((p) => p.character.turret)
    this.turret = engineer
      ? {
          x: engineer.x + 40,
          y: engineer.y,
          r: 14,
          angle: 0,
          cooldown: 0,
        }
      : null
    if (engineer && this.turret && circleHitsWall(this.map, this.turret.x, this.turret.y, this.turret.r)) {
      this.turret.x = engineer.x - 40
    }

    this.setState('playing')
    this.start()
  }

  /** Finds a wall-free point, optionally within a distance band of an anchor. */
  private openSpot(
    radius: number,
    anchor?: { x: number; y: number },
    min = 0,
    max = Infinity
  ): { x: number; y: number } {
    const m = this.map
    for (let i = 0; i < 800; i++) {
      const x = 60 + Math.random() * (m.width - 120)
      const y = 60 + Math.random() * (m.height - 120)
      if (circleHitsWall(m, x, y, radius)) continue
      if (anchor) {
        const d = Math.hypot(x - anchor.x, y - anchor.y)
        if (d < min || d > max) continue
      }
      return { x, y }
    }
    return { x: m.width / 2, y: m.height / 2 }
  }

  private setState(s: GameState) {
    this.state = s
    this.onStateChange(s)
  }

  toMenu() {
    this.running = false
    this.setState('menu')
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.loop)
  }

  private loop = (now: number) => {
    if (!this.running) return
    const dt = Math.min((now - this.last) / 1000, 0.05)
    this.last = now
    if (this.state === 'playing') this.update(dt)
    this.render()
    this.emitHud()
    requestAnimationFrame(this.loop)
  }

  private emitHud() {
    const mission = this.mission
    this.onHud({
      players: this.players.map((p) => ({
        id: p.id,
        name: `Player ${p.id}`,
        characterName: p.character.name,
        color: p.character.color,
        hp: Math.max(0, Math.round(p.hp)),
        maxHp: p.maxHp,
        mag: p.mag,
        magSize: p.weapon.magSize,
        reserve: p.reserve,
        reloading: p.reloadTimer > 0,
        stings: p.stings,
        lives: p.lives,
        down: p.down,
      })),
      kills: this.kills,
      target: mission?.target ?? 0,
      missionName: mission?.name ?? '',
      objective: mission?.objective ?? '',
      mapName: this.map.name,
      maxStings: MAX_STINGS,
      weaponName: this.weapon.name,
      perkName: this.weapon.perk === 'none' ? '' : this.weapon.perkName,
      scrap: this.scrapEarned,
      survivors: this.survivors.map((s) => ({
        hp: Math.max(0, Math.round(s.hp)),
        maxHp: s.maxHp,
        safe: s.safe,
        moving: this.alivePlayers.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < ESCORT_RADIUS),
      })),
      extracted: this.extracted,
      isProtect: mission?.type === 'protect',
    })
  }

  private update(dt: number) {
    for (const p of this.players) {
      if (p.down) continue
      this.updatePlayer(p, dt)
      this.updateWeapon(p, dt)
    }
    this.updateBullets(dt)
    this.updateSurvivors(dt)
    this.updateTurret(dt)
    this.updateEnemies(dt)
    this.updatePickups()
    this.updateSpawning(dt)
    this.updateCamera()
    this.checkOutcome()
  }

  private checkOutcome() {
    const mission = this.mission
    if (!mission) return

    if (mission.type === 'protect') {
      if (this.survivors.some((s) => s.hp <= 0)) {
        this.deathCause = 'survivor'
        this.finish('lost')
        return
      }
      if (this.survivors.length && this.survivors.every((s) => s.safe)) {
        this.finish('won')
        return
      }
    } else if (this.kills >= mission.target) {
      this.finish('won')
      return
    }

    for (const p of this.players) {
      if (p.down) continue
      const infected = p.stings >= MAX_STINGS
      if (!infected && p.hp > 0) continue
      if (p.lives > 0) {
        // Medic's field triage: burn a life instead of going down.
        p.lives -= 1
        p.hp = p.maxHp
        p.stings = 0
        p.hurtCooldown = 0.6
        continue
      }
      p.hp = 0
      p.down = true
      p.shooting = false
      this.deathCause = infected ? 'infection' : 'wounds'
    }

    if (this.players.length && this.players.every((p) => p.down)) this.finish('lost')
  }

  private finish(state: GameState) {
    this.running = false
    this.setState(state)
  }

  private updatePlayer(p: Player, dt: number) {
    const k = this.keys
    const solo = this.players.length === 1
    let dx = 0
    let dy = 0
    if (p.id === 1) {
      if (k.has('w') || (solo && k.has('arrowup'))) dy -= 1
      if (k.has('s') || (solo && k.has('arrowdown'))) dy += 1
      if (k.has('a') || (solo && k.has('arrowleft'))) dx -= 1
      if (k.has('d') || (solo && k.has('arrowright'))) dx += 1
    } else {
      if (k.has('arrowup')) dy -= 1
      if (k.has('arrowdown')) dy += 1
      if (k.has('arrowleft')) dx -= 1
      if (k.has('arrowright')) dx += 1
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy)
      dx /= len
      dy /= len
    }
    const step = p.speed * dt
    this.moveCircle(p, dx * step, dy * step)

    if (p.auto) {
      const mark = this.nearestEnemyTo(p, 1200)
      if (mark) p.angle = Math.atan2(mark.y - p.y, mark.x - p.x)
      // Hold fire unless the target is close and not behind a building.
      const inRange = mark && Math.hypot(mark.x - p.x, mark.y - p.y) < P2_AUTO_FIRE_RANGE
      p.shooting = Boolean(inRange && mark && this.hasLineOfSight(p, mark))
      if (p.mag === 0) this.startReload(p)
    } else {
      this.mouseWorld.x = this.mouseScreen.x / this.zoom + this.camera.x
      this.mouseWorld.y = this.mouseScreen.y / this.zoom + this.camera.y
      p.angle = Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x)
    }
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt)

    const c = p.character
    if (c.regenFraction > 0) {
      p.safeTimer += dt
      if (p.safeTimer >= c.regenInterval) {
        p.safeTimer = 0
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * c.regenFraction)
      }
    }
  }

  private hasLineOfSight(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const steps = Math.ceil(Math.hypot(dx, dy) / 24)
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      if (circleHitsWall(this.map, from.x + dx * t, from.y + dy * t, 2)) return false
    }
    return true
  }

  private nearestEnemyTo(from: { x: number; y: number }, range: number): Enemy | null {
    let best: Enemy | null = null
    let bestD = range
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - from.x, e.y - from.y)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best
  }

  private moveCircle(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    const m = this.map
    if (dx) {
      const nx = clamp(e.x + dx, e.r, m.width - e.r)
      if (!circleHitsWall(m, nx, e.y, e.r)) e.x = nx
    }
    if (dy) {
      const ny = clamp(e.y + dy, e.r, m.height - e.r)
      if (!circleHitsWall(m, e.x, ny, e.r)) e.y = ny
    }
  }

  private startReload(p: Player | undefined) {
    if (this.state !== 'playing' || !p || p.down) return
    if (p.reloadTimer > 0 || p.mag === p.weapon.magSize || p.reserve <= 0) return
    p.reloadTimer = p.weapon.reloadTime * p.character.reloadMultiplier
  }

  private updateWeapon(p: Player, dt: number) {
    p.fireTimer = Math.max(0, p.fireTimer - dt)
    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt
      if (p.reloadTimer <= 0) {
        const need = p.weapon.magSize - p.mag
        const take = Math.min(need, p.reserve)
        p.mag += take
        p.reserve -= take
        p.reloadTimer = 0
      }
      return
    }
    if ((p.shooting || p.queuedShot) && p.fireTimer === 0) {
      if (p.mag > 0) {
        this.fire(p)
        p.fireTimer = p.weapon.fireInterval
        p.queuedShot = false
      } else {
        p.queuedShot = false
        this.startReload(p)
      }
    }
  }

  private fire(p: Player) {
    const w = p.weapon
    p.shotsFired += 1
    const acidShot = w.perk === 'acidic-spray' && p.shotsFired % ACID_SHOT_INTERVAL === 0

    for (let i = 0; i < w.pellets; i++) {
      const spread = (Math.random() - 0.5) * w.spread * (w.pellets > 1 ? 2 : 1)
      const a = p.angle + spread
      const speed = w.bulletSpeed * (w.pellets > 1 ? 0.85 + Math.random() * 0.3 : 1)
      this.bullets.push({
        x: p.x + Math.cos(a) * (p.r + 6),
        y: p.y + Math.sin(a) * (p.r + 6),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: w.bulletLife,
        maxLife: w.bulletLife,
        falloff: w.falloff ?? 1,
        tracerLength: w.perk === 'armor-piercing' ? 56 : w.pellets > 1 ? 10 : 18,
        damage: w.damage,
        pierce: w.perk === 'armor-piercing',
        poison: acidShot,
        ignite: w.perk === 'dragons-breath',
        color: acidShot ? '#7cf03d' : w.perk === 'dragons-breath' ? '#ff7a18' : '#ffe066',
        width: acidShot ? w.tracerWidth + 1 : w.tracerWidth,
        hit: new Set<Enemy>(),
      })
    }
    p.mag -= 1
    playShot(w)
  }

  private updateTurret(dt: number) {
    const t = this.turret
    if (!t) return
    t.cooldown = Math.max(0, t.cooldown - dt)

    let closest: Enemy | null = null
    let best = TURRET_RANGE
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - t.x, e.y - t.y)
      if (d < best) {
        best = d
        closest = e
      }
    }
    if (!closest) return

    t.angle = Math.atan2(closest.y - t.y, closest.x - t.x)
    if (t.cooldown > 0) return
    t.cooldown = TURRET_INTERVAL
    this.bullets.push({
      x: t.x + Math.cos(t.angle) * (t.r + 6),
      y: t.y + Math.sin(t.angle) * (t.r + 6),
      vx: Math.cos(t.angle) * 900,
      vy: Math.sin(t.angle) * 900,
      life: 0.7,
      maxLife: 0.7,
      falloff: 1,
      tracerLength: 14,
      damage: TURRET_DAMAGE,
      pierce: false,
      poison: false,
      ignite: false,
      color: '#a78bfa',
      width: 2,
      hit: new Set<Enemy>(),
    })
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life -= dt
      let dead = b.life <= 0 || circleHitsWall(this.map, b.x, b.y, 2)
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j]
          if (b.hit.has(e)) continue
          if (Math.hypot(e.x - b.x, e.y - b.y) >= e.r + 2) continue
          b.hit.add(e)
          const travelled = 1 - b.life / b.maxLife
          e.hp -= b.damage * (1 - (1 - b.falloff) * travelled)
          if (b.poison) e.poison = POISON_DURATION
          if (b.ignite && e.kind === 'bug' && Math.random() < IGNITE_CHANCE) e.burn = BURN_DURATION
          if (e.hp <= 0) this.killEnemy(j)
          if (!b.pierce) {
            dead = true
            break
          }
        }
      }
      if (dead) this.bullets.splice(i, 1)
    }
  }

  private killEnemy(index: number) {
    const z = this.enemies[index]
    this.enemies.splice(index, 1)
    this.kills += 1
    this.scrapEarned += z.kind === 'bug' ? SCRAP_PER_BUG : SCRAP_PER_KILL
    if (Math.random() < 0.22) {
      this.ammoBoxes.push({ x: z.x, y: z.y, amount: 20 })
    }
  }

  private updateSurvivors(dt: number) {
    const exit = this.map.extraction
    const field = extractionField(this.map, 20)
    for (const s of this.survivors) {
      if (s.safe || s.hp <= 0) continue
      s.hurtCooldown = Math.max(0, s.hurtCooldown - dt)
      const dx = exit.x - s.x
      const dy = exit.y - s.y
      const d = Math.hypot(dx, dy) || 1
      if (d < EXTRACTION_RADIUS) {
        s.safe = true
        this.extracted += 1
        continue
      }

      const escorted = this.alivePlayers.some(
        (p) => Math.hypot(p.x - s.x, p.y - s.y) < ESCORT_RADIUS
      )
      if (!escorted) continue

      // Follow the pre-computed route field so corners and buildings are
      // steered around rather than walked into.
      const flow = flowDirection(field, s.x, s.y) ?? { x: dx / d, y: dy / d }
      const sep = this.survivorSeparation(s)
      let ux = flow.x + sep.x
      let uy = flow.y + sep.y
      const len = Math.hypot(ux, uy) || 1
      ux /= len
      uy /= len

      const step = s.speed * dt
      const base = Math.atan2(uy, ux)
      for (const offset of [0, 0.5, -0.5, 1.1, -1.1, 1.7, -1.7]) {
        const a = base + offset
        const nx = s.x + Math.cos(a) * step
        const ny = s.y + Math.sin(a) * step
        if (circleHitsWall(this.map, nx, ny, s.r)) continue
        s.x = nx
        s.y = ny
        break
      }
    }
  }

  /** Keeps escorted survivors from stacking into one another. */
  private survivorSeparation(self: Survivor): { x: number; y: number } {
    let x = 0
    let y = 0
    for (const other of this.survivors) {
      if (other === self || other.safe || other.hp <= 0) continue
      const dx = self.x - other.x
      const dy = self.y - other.y
      const d = Math.hypot(dx, dy)
      if (d > 0 && d < self.r * 3) {
        x += dx / d
        y += dy / d
      }
    }
    return { x: x * 0.6, y: y * 0.6 }
  }

  /** Enemies prefer whichever survivor or player is closest. */
  private targetFor(z: Enemy): {
    x: number
    y: number
    survivor: Survivor | null
    player: Player | null
  } {
    let best: { x: number; y: number; survivor: Survivor | null; player: Player | null } = {
      x: z.x,
      y: z.y,
      survivor: null,
      player: null,
    }
    let bestD = Infinity
    for (const p of this.alivePlayers) {
      const d = Math.hypot(p.x - z.x, p.y - z.y)
      if (d < bestD) {
        bestD = d
        best = { x: p.x, y: p.y, survivor: null, player: p }
      }
    }
    for (const s of this.survivors) {
      if (s.safe || s.hp <= 0) continue
      const d = Math.hypot(s.x - z.x, s.y - z.y)
      if (d < bestD * SURVIVOR_AGGRO_BIAS) {
        bestD = d
        best = { x: s.x, y: s.y, survivor: s, player: null }
      }
    }
    return best
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const z = this.enemies[i]
      z.wobble += dt
      if (z.poison > 0) {
        z.poison -= dt
        z.hp -= POISON_DPS * dt
      }
      if (z.burn > 0) {
        z.burn -= dt
        z.hp -= BURN_DPS * dt
      }
      if (z.hp <= 0) {
        this.killEnemy(i)
        continue
      }
      z.speed = z.burn > 0 ? z.baseSpeed * BURN_SLOW : z.baseSpeed

      const target = this.targetFor(z)
      if (!target.survivor && !target.player) continue
      const dx = target.x - z.x
      const dy = target.y - z.y
      const d = Math.hypot(dx, dy) || 1
      const step = z.speed * dt
      const wob = Math.sin(z.wobble * 4) * 0.25
      z.retreat = Math.max(0, z.retreat - dt)

      // Camouflage only hides players; survivors are spotted normally.
      const sight = z.vision * (target.player ? target.player.character.aggroMultiplier : 1)
      z.aware = z.aware ? d < sight * VISION_HYSTERESIS : d < sight
      if (!z.aware) {
        z.driftAngle += (Math.random() - 0.5) * dt * 2
        this.moveCircle(
          z,
          Math.cos(z.driftAngle) * step * 0.3,
          Math.sin(z.driftAngle) * step * 0.3
        )
        continue
      }

      const dir = z.retreat > 0 ? -1 : 1
      const ux = (dx / d) * dir
      const uy = (dy / d) * dir
      const px = -uy * wob
      const py = ux * wob
      this.moveCircle(z, (ux + px) * step, (uy + py) * step)

      z.attackCooldown = Math.max(0, z.attackCooldown - dt)
      const victim = target.survivor
      const hunted = target.player
      const reach = z.r + (victim ? victim.r : hunted ? hunted.r : 0)
      if (d < reach && z.attackCooldown === 0) {
        if (victim) {
          victim.hp -= z.kind === 'bug' ? SURVIVOR_BUG_DAMAGE : SURVIVOR_ZOMBIE_DAMAGE
          victim.hurtCooldown = 0.25
          z.attackCooldown = z.kind === 'bug' ? 1.5 : 0.9
          if (z.kind === 'bug') z.retreat = 0.9
        } else if (hunted && z.kind === 'bug') {
          hunted.stings += 1
          z.attackCooldown = 2.2
          z.retreat = 1.1
          hunted.hurtCooldown = 0.25
          hunted.safeTimer = 0
        } else if (hunted) {
          hunted.hp -= 8
          z.attackCooldown = 0.7
          hunted.hurtCooldown = 0.25
          hunted.safeTimer = 0
        }
      }
    }
  }

  private updatePickups() {
    for (let i = this.ammoBoxes.length - 1; i >= 0; i--) {
      const a = this.ammoBoxes[i]
      const taker = this.alivePlayers.find((p) => Math.hypot(a.x - p.x, a.y - p.y) < p.r + 14)
      if (taker) {
        taker.reserve += a.amount
        this.ammoBoxes.splice(i, 1)
      }
    }
  }

  private updateSpawning(dt: number) {
    const mission = this.mission
    if (!mission) return
    const protect = mission.type === 'protect'
    const maxAlive = protect
      ? 4 + mission.survivors * 2
      : Math.min(14, Math.max(4, Math.ceil(mission.target / 3)))
    if (this.enemies.length >= maxAlive) return
    if (!protect) {
      const remaining = mission.target - this.kills
      if (this.spawned - this.kills >= remaining + 4) return
    }

    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer = protect ? 1.5 : 0.9

    const spot = this.spawnPoint()
    if (!spot) return
    const bugChance = mission.type === 'hive' ? HIVE_BUG_SPAWN_CHANCE : BUG_SPAWN_CHANCE
    this.enemies.push(Math.random() < bugChance ? this.makeBug(spot) : this.makeZombie(spot))
    this.spawned += 1
  }

  private makeZombie(spot: { x: number; y: number }): Enemy {
    const brute = Math.random() > 0.85
    return {
      kind: 'zombie',
      x: spot.x,
      y: spot.y,
      r: brute ? 20 : 14,
      hp: brute ? 120 : 60,
      speed: 0,
      baseSpeed: brute ? 70 : 95 + Math.random() * 30,
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
      poison: 0,
      burn: 0,
      vision: ZOMBIE_VISION,
      aware: false,
      driftAngle: Math.random() * Math.PI * 2,
    }
  }

  private makeBug(spot: { x: number; y: number }): Enemy {
    return {
      kind: 'bug',
      x: spot.x,
      y: spot.y,
      r: 10,
      hp: 34,
      speed: 0,
      baseSpeed: 1.5 * (95 + Math.random() * 30),
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
      poison: 0,
      burn: 0,
      vision: BUG_VISION,
      aware: false,
      driftAngle: Math.random() * Math.PI * 2,
    }
  }

  private spawnPoint() {
    const m = this.map
    const players = this.alivePlayers
    if (!players.length) return null
    for (let i = 0; i < 300; i++) {
      const x = 40 + Math.random() * (m.width - 80)
      const y = 40 + Math.random() * (m.height - 80)
      const d = Math.min(...players.map((p) => Math.hypot(x - p.x, y - p.y)))
      if (d < 380 || d > 1300) continue
      if (circleHitsWall(m, x, y, 22)) continue
      return { x, y }
    }
    return null
  }

  /** Shared co-op camera: centred between both players, zoomed to fit them. */
  private updateCamera() {
    const m = this.map
    const tracked = this.alivePlayers.length ? this.alivePlayers : this.players
    if (!tracked.length) return

    const xs = tracked.map((p) => p.x)
    const ys = tracked.map((p) => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const spanX = Math.max(...xs) - Math.min(...xs) + COOP_CAMERA_MARGIN
    const spanY = Math.max(...ys) - Math.min(...ys) + COOP_CAMERA_MARGIN

    const fit = Math.min(this.viewW / spanX, this.viewH / spanY, 1)
    const target = clamp(fit, MIN_ZOOM, 1)
    this.zoom += (target - this.zoom) * 0.08

    const worldW = this.viewW / this.zoom
    const worldH = this.viewH / this.zoom
    this.camera.x = clamp(cx - worldW / 2, 0, Math.max(0, m.width - worldW))
    this.camera.y = clamp(cy - worldH / 2, 0, Math.max(0, m.height - worldH))
  }

  private render() {
    const ctx = this.ctx
    const m = this.map
    ctx.fillStyle = '#0b0f0d'
    ctx.fillRect(0, 0, this.viewW, this.viewH)
    ctx.save()
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-this.camera.x, -this.camera.y)

    ctx.fillStyle = m.color
    ctx.fillRect(0, 0, m.width, m.height)
    this.drawFloor()
    this.drawMapLabel()
    if (this.mission?.type === 'protect') this.drawExtraction()

    for (const w of m.walls) this.drawStructure(w)

    for (const a of this.ammoBoxes) {
      ctx.fillStyle = '#f4c542'
      ctx.fillRect(a.x - 8, a.y - 6, 16, 12)
      ctx.strokeStyle = '#8a6b12'
      ctx.lineWidth = 2
      ctx.strokeRect(a.x - 8, a.y - 6, 16, 12)
    }

    for (const s of this.survivors) this.drawSurvivor(s)
    if (this.mission?.type === 'protect') this.drawSurvivorHealthBars()
    if (this.turret) this.drawTurret(this.turret)

    for (const e of this.enemies) {
      if (e.kind === 'bug') this.drawBug(e)
      else this.drawZombie(e)
    }

    for (const b of this.bullets) {
      ctx.strokeStyle = b.color
      ctx.lineWidth = b.width
      ctx.lineCap = 'round'
      const len = Math.min(b.tracerLength, Math.hypot(b.vx, b.vy) * 0.03)
      const nx = b.vx / (Math.hypot(b.vx, b.vy) || 1)
      const ny = b.vy / (Math.hypot(b.vx, b.vy) || 1)
      ctx.beginPath()
      ctx.moveTo(b.x - nx * len, b.y - ny * len)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    for (const p of this.players) this.drawPlayer(p)
    ctx.restore()

    this.drawCrosshair()
    this.drawMinimap()
  }

  /** Floor texture: asphalt seams, warehouse planks, hive veins, camp dirt. */
  private drawFloor() {
    const ctx = this.ctx
    const m = this.map
    const x0 = Math.max(0, this.camera.x - 200)
    const y0 = Math.max(0, this.camera.y - 200)
    const x1 = Math.min(m.width, this.camera.x + this.viewW / this.zoom + 200)
    const y1 = Math.min(m.height, this.camera.y + this.viewH / this.zoom + 200)

    ctx.save()
    if (m.floor === 'asphalt') {
      ctx.fillStyle = 'rgba(255,255,255,0.02)'
      for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
        for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
          ctx.fillRect(x + ((y / 60) % 2 ? 45 : 0), y, 86, 56)
        }
      }
      // Road markings down the main avenues.
      ctx.strokeStyle = 'rgba(240,220,120,0.16)'
      ctx.lineWidth = 6
      ctx.setLineDash([40, 34])
      for (let y = Math.floor(y0 / 520) * 520 + 260; y < y1; y += 520) {
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
      }
      ctx.setLineDash([])
    } else if (m.floor === 'wood') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'
      ctx.lineWidth = 2
      for (let y = Math.floor(y0 / 42) * 42; y < y1; y += 42) {
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      for (let y = Math.floor(y0 / 42) * 42; y < y1; y += 42) {
        for (let x = Math.floor(x0 / 180) * 180 + ((y / 42) % 2 ? 90 : 0); x < x1; x += 180) {
          ctx.fillRect(x, y + 3, 176, 36)
        }
      }
    } else if (m.floor === 'organic') {
      ctx.strokeStyle = 'rgba(224,163,255,0.12)'
      ctx.lineWidth = 3
      for (let y = Math.floor(y0 / 140) * 140; y < y1; y += 140) {
        ctx.beginPath()
        for (let x = x0; x < x1; x += 40) {
          ctx.lineTo(x, y + Math.sin(x / 90 + y) * 18)
        }
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.16)'
      for (let y = Math.floor(y0 / 70) * 70; y < y1; y += 70) {
        for (let x = Math.floor(x0 / 70) * 70; x < x1; x += 70) {
          const r = ((x * 31 + y * 17) % 9) + 3
          ctx.beginPath()
          ctx.ellipse(x + 20, y + 30, r, r * 0.6, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  /** Buildings get brick courses, window grids and a rooftop cap. */
  private drawStructure(w: Rect) {
    const ctx = this.ctx
    const m = this.map
    ctx.save()
    ctx.fillStyle = m.wallColor
    ctx.fillRect(w.x, w.y, w.w, w.h)

    if (w.kind !== 'barrier') {
      ctx.beginPath()
      ctx.rect(w.x, w.y, w.w, w.h)
      ctx.clip()

      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 1.5
      for (let y = w.y + 14; y < w.y + w.h; y += 14) {
        ctx.beginPath()
        ctx.moveTo(w.x, y)
        ctx.lineTo(w.x + w.w, y)
        ctx.stroke()
      }
      let row = 0
      for (let y = w.y; y < w.y + w.h; y += 14, row++) {
        for (let x = w.x + (row % 2 ? 0 : 14); x < w.x + w.w; x += 28) {
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + 14)
          ctx.stroke()
        }
      }

      // Window grid with a couple of lit panes.
      const stepX = 42
      const stepY = 46
      for (let y = w.y + 20; y < w.y + w.h - 22; y += stepY) {
        for (let x = w.x + 18; x < w.x + w.w - 20; x += stepX) {
          const lit = ((x * 7 + y * 13) % 11) < 3
          ctx.fillStyle = lit ? 'rgba(255,212,121,0.5)' : 'rgba(15,23,32,0.72)'
          ctx.fillRect(x, y, 22, 24)
          ctx.strokeStyle = 'rgba(0,0,0,0.45)'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, 22, 24)
          ctx.beginPath()
          ctx.moveTo(x + 11, y)
          ctx.lineTo(x + 11, y + 24)
          ctx.moveTo(x, y + 12)
          ctx.lineTo(x + 22, y + 12)
          ctx.stroke()
        }
      }

      // Rooftop lip and vents.
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(w.x, w.y, w.w, 10)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      for (let x = w.x + 24; x < w.x + w.w - 20; x += 96) {
        ctx.fillRect(x, w.y + 2, 26, 6)
      }
    }

    ctx.restore()
    ctx.strokeStyle = m.wallEdge
    ctx.lineWidth = 3
    ctx.strokeRect(w.x, w.y, w.w, w.h)
  }

  private drawExtraction() {
    const ctx = this.ctx
    const { x, y } = this.map.extraction
    ctx.save()
    ctx.setLineDash([14, 10])
    ctx.strokeStyle = 'rgba(61,220,132,0.85)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, EXTRACTION_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(61,220,132,0.12)'
    ctx.fill()
    ctx.fillStyle = 'rgba(61,220,132,0.9)'
    ctx.font = 'bold 18px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('EXTRACTION', x, y + 6)
    ctx.textAlign = 'left'
    ctx.restore()
  }

  private drawSurvivor(s: Survivor) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = s.safe ? '#94a3b8' : s.hurtCooldown > 0 ? '#fecaca' : '#e2e8f0'
    ctx.fill()
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawSurvivorHealthBars() {
    for (const s of this.survivors) this.drawSurvivorHealthBar(s)
  }

  private drawSurvivorHealthBar(s: Survivor) {
    const ctx = this.ctx
    const bw = 40
    const bh = 6
    const bx = s.x - bw / 2
    const by = s.y - s.r - 14
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2)
    const pct = Math.max(0, s.hp) / s.maxHp
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444'
    ctx.fillRect(bx, by, bw * pct, bh)
    if (s.safe) {
      ctx.fillStyle = '#22c55e'
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('SAFE', s.x, by - 5)
      ctx.textAlign = 'left'
    }
  }

  private drawTurret(t: Turret) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(t.x, t.y)
    ctx.beginPath()
    ctx.arc(0, 0, t.r, 0, Math.PI * 2)
    ctx.fillStyle = '#6d28d9'
    ctx.fill()
    ctx.strokeStyle = '#c4b5fd'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.rotate(t.angle)
    ctx.fillStyle = '#c4b5fd'
    ctx.fillRect(t.r - 3, -3, 18, 6)
    ctx.restore()
  }

  private drawStatusRing(e: Enemy) {
    const ctx = this.ctx
    if (e.poison <= 0 && e.burn <= 0) return
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.r + 5, 0, Math.PI * 2)
    ctx.strokeStyle = e.burn > 0 ? 'rgba(255,122,24,0.9)' : 'rgba(124,240,61,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawZombie(z: Enemy) {
    const ctx = this.ctx
    this.drawStatusRing(z)
    ctx.beginPath()
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2)
    ctx.fillStyle = z.r > 16 ? '#8b1414' : '#d62828'
    ctx.fill()
    ctx.strokeStyle = '#4a0a0a'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  private drawBug(b: Enemy) {
    const ctx = this.ctx
    this.drawStatusRing(b)
    const flap = Math.sin(b.wobble * 22) * 0.6
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.fillStyle = 'rgba(255, 213, 128, 0.45)'
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.rotate(side * (0.7 + flap * side))
      ctx.beginPath()
      ctx.ellipse(0, -b.r * 1.3, b.r * 0.5, b.r * 1.1, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, Math.PI * 2)
    ctx.fillStyle = '#ffa41b'
    ctx.fill()
    ctx.strokeStyle = '#8a4b00'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  private drawMapLabel() {
    const ctx = this.ctx
    const m = this.map
    ctx.font = 'bold 64px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillText(m.name.toUpperCase(), m.width / 2, 140)
    ctx.fillText(m.name.toUpperCase(), m.width / 2, m.height - 100)
    ctx.textAlign = 'left'
  }

  private drawPlayer(p: Player) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(p.x, p.y)
    if (p.down) ctx.globalAlpha = 0.4

    ctx.save()
    ctx.rotate(p.angle)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(p.r - 4, -4, 22, 8)
    ctx.restore()

    drawCharacterSkin(ctx, p.character.id, p.r, p.angle, p.hurtCooldown > 0)

    if (this.players.length > 1) {
      ctx.fillStyle = p.id === 1 ? '#34d399' : '#60a5fa'
      ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(p.down ? `P${p.id} DOWN` : `P${p.id}`, 0, -p.r - 8)
      ctx.textAlign = 'left'
    }
    ctx.restore()
  }

  private drawCrosshair() {
    if (this.state !== 'playing') return
    const ctx = this.ctx

    const p2 = this.players[1]
    if (p2 && !p2.down) {
      // Show where player 2's auto-aim is pointing.
      const len = 70
      ctx.save()
      ctx.scale(this.zoom, this.zoom)
      ctx.translate(-this.camera.x, -this.camera.y)
      ctx.strokeStyle = 'rgba(96,165,250,0.55)'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 8])
      ctx.beginPath()
      ctx.moveTo(p2.x, p2.y)
      ctx.lineTo(p2.x + Math.cos(p2.angle) * len, p2.y + Math.sin(p2.angle) * len)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }

    const { x, y } = this.mouseScreen
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.moveTo(x - 16, y)
    ctx.lineTo(x - 4, y)
    ctx.moveTo(x + 4, y)
    ctx.lineTo(x + 16, y)
    ctx.moveTo(x, y - 16)
    ctx.lineTo(x, y - 4)
    ctx.moveTo(x, y + 4)
    ctx.lineTo(x, y + 16)
    ctx.stroke()
  }

  private drawMinimap() {
    const ctx = this.ctx
    const m = this.map
    const mw = 240
    const mh = (mw * m.height) / m.width
    const mx = this.viewW - mw - 20
    const my = this.viewH - mh - 20
    const s = mw / m.width

    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = '#050807'
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12)

    ctx.fillStyle = m.color
    ctx.fillRect(mx, my, mw, mh)

    ctx.fillStyle = m.wallColor
    for (const w of m.walls) {
      ctx.fillRect(mx + w.x * s, my + w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s))
    }

    if (this.mission?.type === 'protect') {
      ctx.strokeStyle = '#3ddc84'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx + m.extraction.x * s, my + m.extraction.y * s, 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#e2e8f0'
      for (const sv of this.survivors) {
        if (sv.hp <= 0) continue
        ctx.beginPath()
        ctx.arc(mx + sv.x * s, my + sv.y * s, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (const e of this.enemies) {
      ctx.fillStyle = e.kind === 'bug' ? '#ffa41b' : '#d62828'
      ctx.beginPath()
      ctx.arc(mx + e.x * s, my + e.y * s, e.kind === 'bug' ? 2 : 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.turret) {
      ctx.fillStyle = '#a78bfa'
      ctx.beginPath()
      ctx.arc(mx + this.turret.x * s, my + this.turret.y * s, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const p of this.players) {
      ctx.fillStyle = p.down ? '#64748b' : p.character.color
      ctx.beginPath()
      ctx.arc(mx + p.x * s, my + p.y * s, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = p.id === 1 ? '#34d399' : '#60a5fa'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(m.name, mx + 4, my + 14)
    ctx.restore()
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
