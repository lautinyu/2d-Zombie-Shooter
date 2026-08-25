import type { Mission } from './missions'
import type { Weapon } from './weapons'
import { weaponById } from './weapons'
import type { Character } from './characters'
import { characterById } from './characters'
import { SCRAP_PER_BUG, SCRAP_PER_KILL } from './profile'
import { playShot } from './audio'
import type { GameMap } from './maps'
import { circleHitsWall, mapById } from './maps'

export type GameState = 'menu' | 'playing' | 'won' | 'lost'

interface Player {
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  speed: number
  angle: number
  hurtCooldown: number
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
}

export interface Hud {
  hp: number
  maxHp: number
  mag: number
  magSize: number
  reserve: number
  reloading: boolean
  kills: number
  target: number
  missionName: string
  objective: string
  mapName: string
  stings: number
  maxStings: number
  weaponName: string
  perkName: string
  scrap: number
  characterName: string
  lives: number
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
const SURVIVOR_SPEED = 66
/** Survivors only pull aggro when clearly closer than the player. */
const SURVIVOR_AGGRO_BIAS = 0.75
const TURRET_RANGE = 460
const TURRET_INTERVAL = 0.55
const TURRET_DAMAGE = 9

export class Game {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  state: GameState = 'menu'
  mission: Mission | null = null
  kills = 0
  stings = 0
  scrapEarned = 0
  extracted = 0
  deathCause: DeathCause = 'wounds'
  weapon: Weapon = weaponById('rusty-pistol')
  character: Character = characterById('nature-lover')
  map: GameMap = mapById('streets')

  private player: Player = this.makePlayer(0, 0)
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private ammoBoxes: AmmoBox[] = []
  private survivors: Survivor[] = []
  private turret: Turret | null = null
  private lives = 0
  private safeTimer = 0

  private mag = this.weapon.magSize
  private reserve = this.weapon.reserveStart
  private reloadTimer = 0
  private fireTimer = 0
  private shotsFired = 0

  private spawnTimer = 0
  private spawned = 0

  private keys = new Set<string>()
  private mouseWorld = { x: 0, y: 0 }
  private mouseScreen = { x: 0, y: 0 }
  private shooting = false
  private queuedShot = false

  private camera = { x: 0, y: 0 }
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

  private makePlayer(x: number, y: number): Player {
    return {
      x,
      y,
      r: PLAYER_RADIUS,
      hp: 100,
      maxHp: 100,
      speed: PLAYER_BASE_SPEED,
      angle: 0,
      hurtCooldown: 0,
    }
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase())
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      if (e.key.toLowerCase() === 'r') this.startReload()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => this.keys.clear())

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      this.mouseScreen.x = e.clientX - rect.left
      this.mouseScreen.y = e.clientY - rect.top
    })
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.shooting = true
        this.queuedShot = true
      }
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shooting = false
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

  startMission(mission: Mission, weapon: Weapon, character: Character) {
    this.mission = mission
    this.weapon = weapon
    this.character = character
    // Only the mission's own map is instantiated — other maps never load.
    this.map = mapById(mission.map)
    this.kills = 0
    this.scrapEarned = 0
    this.extracted = 0
    this.shotsFired = 0
    this.spawned = 0
    this.spawnTimer = 0
    this.stings = 0
    this.safeTimer = 0
    this.deathCause = 'wounds'
    this.enemies = []
    this.bullets = []
    this.ammoBoxes = []
    this.mag = weapon.magSize
    this.reserve = weapon.reserveStart
    this.reloadTimer = 0
    this.shooting = false
    this.queuedShot = false
    this.lives = character.extraLives

    const spawn = this.openSpot(PLAYER_RADIUS + 10)
    this.player = this.makePlayer(spawn.x, spawn.y)
    this.player.speed = PLAYER_BASE_SPEED * character.speedMultiplier

    this.survivors = []
    for (let i = 0; i < mission.survivors; i++) {
      const spot = this.openSpot(20, this.player, 90, 320)
      this.survivors.push({
        x: spot.x,
        y: spot.y,
        r: 13,
        hp: 140,
        maxHp: 140,
        speed: SURVIVOR_SPEED,
        safe: false,
        hurtCooldown: 0,
      })
    }

    this.turret = character.turret
      ? {
          x: this.player.x + 40,
          y: this.player.y,
          r: 14,
          angle: 0,
          cooldown: 0,
        }
      : null
    if (this.turret && circleHitsWall(this.map, this.turret.x, this.turret.y, this.turret.r)) {
      this.turret.x = this.player.x - 40
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
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: this.player.maxHp,
      mag: this.mag,
      magSize: this.weapon.magSize,
      reserve: this.reserve,
      reloading: this.reloadTimer > 0,
      kills: this.kills,
      target: mission?.target ?? 0,
      missionName: mission?.name ?? '',
      objective: mission?.objective ?? '',
      mapName: this.map.name,
      stings: this.stings,
      maxStings: MAX_STINGS,
      weaponName: this.weapon.name,
      perkName: this.weapon.perk === 'none' ? '' : this.weapon.perkName,
      scrap: this.scrapEarned,
      characterName: this.character.name,
      lives: this.lives,
      survivors: this.survivors.map((s) => ({
        hp: Math.max(0, Math.round(s.hp)),
        maxHp: s.maxHp,
        safe: s.safe,
      })),
      extracted: this.extracted,
      isProtect: mission?.type === 'protect',
    })
  }

  private update(dt: number) {
    this.updatePlayer(dt)
    this.updateWeapon(dt)
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

    if (this.stings >= MAX_STINGS) {
      this.player.hp = 0
      this.deathCause = 'infection'
      this.finish('lost')
    } else if (this.player.hp <= 0) {
      if (this.lives > 0) {
        // Medic's field triage: burn a life instead of dying.
        this.lives -= 1
        this.player.hp = this.player.maxHp
        this.player.hurtCooldown = 0.6
        return
      }
      this.deathCause = 'wounds'
      this.finish('lost')
    }
  }

  private finish(state: GameState) {
    this.running = false
    this.setState(state)
  }

  private updatePlayer(dt: number) {
    const k = this.keys
    let dx = 0
    let dy = 0
    if (k.has('w') || k.has('arrowup')) dy -= 1
    if (k.has('s') || k.has('arrowdown')) dy += 1
    if (k.has('a') || k.has('arrowleft')) dx -= 1
    if (k.has('d') || k.has('arrowright')) dx += 1
    if (dx || dy) {
      const len = Math.hypot(dx, dy)
      dx /= len
      dy /= len
    }
    const p = this.player
    const step = p.speed * dt
    this.moveCircle(p, dx * step, dy * step)

    this.mouseWorld.x = this.mouseScreen.x + this.camera.x
    this.mouseWorld.y = this.mouseScreen.y + this.camera.y
    p.angle = Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x)
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt)

    const c = this.character
    if (c.regenFraction > 0) {
      this.safeTimer += dt
      if (this.safeTimer >= c.regenInterval) {
        this.safeTimer = 0
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * c.regenFraction)
      }
    }
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

  private startReload() {
    if (this.state !== 'playing') return
    if (this.reloadTimer > 0 || this.mag === this.weapon.magSize || this.reserve <= 0) return
    this.reloadTimer = this.weapon.reloadTime * this.character.reloadMultiplier
  }

  private updateWeapon(dt: number) {
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        const need = this.weapon.magSize - this.mag
        const take = Math.min(need, this.reserve)
        this.mag += take
        this.reserve -= take
        this.reloadTimer = 0
      }
      return
    }
    if ((this.shooting || this.queuedShot) && this.fireTimer === 0) {
      if (this.mag > 0) {
        this.fire()
        this.fireTimer = this.weapon.fireInterval
        this.queuedShot = false
      } else {
        this.queuedShot = false
        this.startReload()
      }
    }
  }

  private fire() {
    const p = this.player
    const w = this.weapon
    this.shotsFired += 1
    const acidShot = w.perk === 'acidic-spray' && this.shotsFired % ACID_SHOT_INTERVAL === 0

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
    this.mag -= 1
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
      const step = s.speed * dt
      const base = Math.atan2(dy, dx)
      // Walk around blocking walls instead of grinding into them.
      for (const offset of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]) {
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

  /** Enemies prefer whichever survivor or the player is closest. */
  private targetFor(z: Enemy): { x: number; y: number; kind: 'player' | 'survivor'; ref: Survivor | null } {
    const p = this.player
    let best: { x: number; y: number; kind: 'player' | 'survivor'; ref: Survivor | null } = {
      x: p.x,
      y: p.y,
      kind: 'player',
      ref: null,
    }
    let bestD = Math.hypot(p.x - z.x, p.y - z.y)
    for (const s of this.survivors) {
      if (s.safe || s.hp <= 0) continue
      const d = Math.hypot(s.x - z.x, s.y - z.y)
      if (d < bestD * SURVIVOR_AGGRO_BIAS) {
        bestD = d
        best = { x: s.x, y: s.y, kind: 'survivor', ref: s }
      }
    }
    return best
  }

  private updateEnemies(dt: number) {
    const p = this.player
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
      const dx = target.x - z.x
      const dy = target.y - z.y
      const d = Math.hypot(dx, dy) || 1
      const step = z.speed * dt
      const wob = Math.sin(z.wobble * 4) * 0.25
      z.retreat = Math.max(0, z.retreat - dt)

      // Camouflage only hides the player; survivors are spotted normally.
      const sight = z.vision * (target.kind === 'player' ? this.character.aggroMultiplier : 1)
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
      const victim = target.ref
      const reach = z.r + (victim ? victim.r : p.r)
      if (d < reach && z.attackCooldown === 0) {
        if (victim) {
          victim.hp -= z.kind === 'bug' ? 8 : 6
          victim.hurtCooldown = 0.25
          z.attackCooldown = z.kind === 'bug' ? 1.8 : 1.2
          if (z.kind === 'bug') z.retreat = 0.9
        } else if (z.kind === 'bug') {
          this.stings += 1
          z.attackCooldown = 2.2
          z.retreat = 1.1
          p.hurtCooldown = 0.25
          this.safeTimer = 0
        } else {
          p.hp -= 8
          z.attackCooldown = 0.7
          p.hurtCooldown = 0.25
          this.safeTimer = 0
        }
      }
    }
  }

  private updatePickups() {
    const p = this.player
    for (let i = this.ammoBoxes.length - 1; i >= 0; i--) {
      const a = this.ammoBoxes[i]
      if (Math.hypot(a.x - p.x, a.y - p.y) < p.r + 14) {
        this.reserve += a.amount
        this.ammoBoxes.splice(i, 1)
      }
    }
  }

  private updateSpawning(dt: number) {
    const mission = this.mission
    if (!mission) return
    const protect = mission.type === 'protect'
    const maxAlive = protect
      ? 3 + mission.survivors
      : Math.min(14, Math.max(4, Math.ceil(mission.target / 3)))
    if (this.enemies.length >= maxAlive) return
    if (!protect) {
      const remaining = mission.target - this.kills
      if (this.spawned - this.kills >= remaining + 4) return
    }

    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer = protect ? 2.4 : 0.9

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
    const p = this.player
    for (let i = 0; i < 300; i++) {
      const x = 40 + Math.random() * (m.width - 80)
      const y = 40 + Math.random() * (m.height - 80)
      const d = Math.hypot(x - p.x, y - p.y)
      if (d < 380 || d > 1300) continue
      if (circleHitsWall(m, x, y, 22)) continue
      return { x, y }
    }
    return null
  }

  private updateCamera() {
    const m = this.map
    this.camera.x = clamp(this.player.x - this.viewW / 2, 0, Math.max(0, m.width - this.viewW))
    this.camera.y = clamp(this.player.y - this.viewH / 2, 0, Math.max(0, m.height - this.viewH))
  }

  private render() {
    const ctx = this.ctx
    const m = this.map
    ctx.fillStyle = '#0b0f0d'
    ctx.fillRect(0, 0, this.viewW, this.viewH)
    ctx.save()
    ctx.translate(-this.camera.x, -this.camera.y)

    ctx.fillStyle = m.color
    ctx.fillRect(0, 0, m.width, m.height)
    this.drawGrid()
    this.drawMapLabel()
    if (this.mission?.type === 'protect') this.drawExtraction()

    ctx.fillStyle = m.wallColor
    ctx.strokeStyle = m.wallEdge
    ctx.lineWidth = 3
    for (const w of m.walls) {
      ctx.fillRect(w.x, w.y, w.w, w.h)
      ctx.strokeRect(w.x, w.y, w.w, w.h)
    }

    for (const a of this.ammoBoxes) {
      ctx.fillStyle = '#f4c542'
      ctx.fillRect(a.x - 8, a.y - 6, 16, 12)
      ctx.strokeStyle = '#8a6b12'
      ctx.lineWidth = 2
      ctx.strokeRect(a.x - 8, a.y - 6, 16, 12)
    }

    for (const s of this.survivors) this.drawSurvivor(s)
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

    this.drawPlayer()
    ctx.restore()

    this.drawCrosshair()
    this.drawMinimap()
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

  private drawGrid() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    const startX = Math.floor(this.camera.x / 100) * 100
    const startY = Math.floor(this.camera.y / 100) * 100
    ctx.beginPath()
    for (let x = startX; x < this.camera.x + this.viewW + 100; x += 100) {
      ctx.moveTo(x, this.camera.y)
      ctx.lineTo(x, this.camera.y + this.viewH)
    }
    for (let y = startY; y < this.camera.y + this.viewH + 100; y += 100) {
      ctx.moveTo(this.camera.x, y)
      ctx.lineTo(this.camera.x + this.viewW, y)
    }
    ctx.stroke()
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

  private drawPlayer() {
    const ctx = this.ctx
    const p = this.player
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = p.hurtCooldown > 0 ? '#ff8a8a' : this.character.color
    ctx.fill()
    ctx.strokeStyle = '#14532d'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(p.r - 4, -4, 22, 8)
    ctx.restore()
  }

  private drawCrosshair() {
    if (this.state !== 'playing') return
    const ctx = this.ctx
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

    ctx.fillStyle = this.character.color
    ctx.beginPath()
    ctx.arc(mx + this.player.x * s, my + this.player.y * s, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(m.name, mx + 4, my + 14)
    ctx.restore()
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
