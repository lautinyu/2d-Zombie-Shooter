import type { Mission } from './missions'
import type { Zone } from './world'
import {
  WALLS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
  circleHitsWall,
  zoneAt,
  zoneById,
} from './world'

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
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

interface AmmoBox {
  x: number
  y: number
  amount: number
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
  zoneName: string
  currentZoneName: string
  inMissionZone: boolean
  stings: number
  maxStings: number
}

export type DeathCause = 'wounds' | 'infection'

const PLAYER_RADIUS = 16
const BULLET_SPEED = 900
const BULLET_DAMAGE = 34
const MAG_SIZE = 15
const RELOAD_TIME = 1.1
const FIRE_INTERVAL = 0.14
const MAX_STINGS = 5
const BUG_SPAWN_CHANCE = 0.2

export class Game {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  state: GameState = 'menu'
  mission: Mission | null = null
  kills = 0
  stings = 0
  deathCause: DeathCause = 'wounds'

  private player: Player = this.makePlayer(0, 0)
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private ammoBoxes: AmmoBox[] = []

  private mag = MAG_SIZE
  private reserve = 90
  private reloadTimer = 0
  private fireTimer = 0

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
      speed: 260,
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

  startMission(mission: Mission) {
    this.mission = mission
    this.kills = 0
    this.spawned = 0
    this.spawnTimer = 0
    this.stings = 0
    this.deathCause = 'wounds'
    this.enemies = []
    this.bullets = []
    this.ammoBoxes = []
    this.mag = MAG_SIZE
    this.reserve = 90
    this.reloadTimer = 0
    this.shooting = false
    this.queuedShot = false

    const spawn = this.playerSpawnPoint(zoneById(mission.zone))
    this.player = this.makePlayer(spawn.x, spawn.y)
    this.setState('playing')
    this.start()
  }

  private playerSpawnPoint(zone: Zone) {
    for (let i = 0; i < 500; i++) {
      const x = zone.x + 80 + Math.random() * (zone.w - 160)
      const y = zone.y + 80 + Math.random() * (zone.h - 160)
      if (!circleHitsWall(x, y, PLAYER_RADIUS + 10)) return { x, y }
    }
    return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 }
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
    const zone = zoneAt(this.player.x, this.player.y)
    this.onHud({
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: this.player.maxHp,
      mag: this.mag,
      magSize: MAG_SIZE,
      reserve: this.reserve,
      reloading: this.reloadTimer > 0,
      kills: this.kills,
      target: mission?.target ?? 0,
      missionName: mission?.name ?? '',
      zoneName: mission ? zoneById(mission.zone).name : '',
      currentZoneName: zone.name,
      inMissionZone: mission ? zone.id === mission.zone : false,
      stings: this.stings,
      maxStings: MAX_STINGS,
    })
  }

  private update(dt: number) {
    this.updatePlayer(dt)
    this.updateWeapon(dt)
    this.updateBullets(dt)
    this.updateEnemies(dt)
    this.updatePickups()
    this.updateSpawning(dt)
    this.updateCamera()

    if (this.mission && this.kills >= this.mission.target) {
      this.running = false
      this.setState('won')
    } else if (this.stings >= MAX_STINGS) {
      this.player.hp = 0
      this.deathCause = 'infection'
      this.running = false
      this.setState('lost')
    } else if (this.player.hp <= 0) {
      this.deathCause = 'wounds'
      this.running = false
      this.setState('lost')
    }
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
  }

  private moveCircle(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    if (dx) {
      const nx = clamp(e.x + dx, e.r, WORLD_WIDTH - e.r)
      if (!circleHitsWall(nx, e.y, e.r)) e.x = nx
    }
    if (dy) {
      const ny = clamp(e.y + dy, e.r, WORLD_HEIGHT - e.r)
      if (!circleHitsWall(e.x, ny, e.r)) e.y = ny
    }
  }

  private startReload() {
    if (this.state !== 'playing') return
    if (this.reloadTimer > 0 || this.mag === MAG_SIZE || this.reserve <= 0) return
    this.reloadTimer = RELOAD_TIME
  }

  private updateWeapon(dt: number) {
    this.fireTimer = Math.max(0, this.fireTimer - dt)
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        const need = MAG_SIZE - this.mag
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
        this.fireTimer = FIRE_INTERVAL
        this.queuedShot = false
      } else {
        this.queuedShot = false
        this.startReload()
      }
    }
  }

  private fire() {
    const p = this.player
    const spread = (Math.random() - 0.5) * 0.05
    const a = p.angle + spread
    this.bullets.push({
      x: p.x + Math.cos(a) * (p.r + 6),
      y: p.y + Math.sin(a) * (p.r + 6),
      vx: Math.cos(a) * BULLET_SPEED,
      vy: Math.sin(a) * BULLET_SPEED,
      life: 1.2,
    })
    this.mag -= 1
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life -= dt
      let dead = b.life <= 0 || circleHitsWall(b.x, b.y, 2)
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j]
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 2) {
            e.hp -= BULLET_DAMAGE
            dead = true
            if (e.hp <= 0) {
              this.killEnemy(j)
            }
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
    if (this.mission && zoneAt(z.x, z.y).id === this.mission.zone) {
      this.kills += 1
    }
    if (Math.random() < 0.22) {
      this.ammoBoxes.push({ x: z.x, y: z.y, amount: 20 })
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player
    for (const z of this.enemies) {
      z.wobble += dt
      const dx = p.x - z.x
      const dy = p.y - z.y
      const d = Math.hypot(dx, dy) || 1
      const step = z.speed * dt
      const wob = Math.sin(z.wobble * 4) * 0.25
      z.retreat = Math.max(0, z.retreat - dt)
      const dir = z.retreat > 0 ? -1 : 1
      const ux = (dx / d) * dir
      const uy = (dy / d) * dir
      const px = -uy * wob
      const py = ux * wob
      this.moveCircle(z, (ux + px) * step, (uy + py) * step)

      z.attackCooldown = Math.max(0, z.attackCooldown - dt)
      if (d < z.r + p.r && z.attackCooldown === 0) {
        if (z.kind === 'bug') {
          this.stings += 1
          z.attackCooldown = 2.2
          z.retreat = 1.1
        } else {
          p.hp -= 8
          z.attackCooldown = 0.7
        }
        p.hurtCooldown = 0.25
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
    const zone = zoneById(mission.zone)
    const remaining = mission.target - this.kills
    const maxAlive = Math.min(14, Math.max(4, Math.ceil(mission.target / 3)))
    if (this.enemies.length >= maxAlive) return
    if (this.spawned - this.kills >= remaining + 4) return

    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer = 0.9

    const spot = this.spawnPoint(zone)
    if (!spot) return
    this.enemies.push(
      Math.random() < BUG_SPAWN_CHANCE ? this.makeBug(spot) : this.makeZombie(spot)
    )
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
      speed: brute ? 70 : 95 + Math.random() * 30,
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
    }
  }

  private makeBug(spot: { x: number; y: number }): Enemy {
    return {
      kind: 'bug',
      x: spot.x,
      y: spot.y,
      r: 10,
      hp: 34,
      speed: 1.5 * (95 + Math.random() * 30),
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
    }
  }

  private spawnPoint(zone: Zone) {
    const p = this.player
    for (let i = 0; i < 200; i++) {
      const x = zone.x + 40 + Math.random() * (zone.w - 80)
      const y = zone.y + 40 + Math.random() * (zone.h - 80)
      const d = Math.hypot(x - p.x, y - p.y)
      if (d < 420 || d > 1400) continue
      if (circleHitsWall(x, y, 22)) continue
      return { x, y }
    }
    return null
  }

  private updateCamera() {
    this.camera.x = clamp(this.player.x - this.viewW / 2, 0, Math.max(0, WORLD_WIDTH - this.viewW))
    this.camera.y = clamp(this.player.y - this.viewH / 2, 0, Math.max(0, WORLD_HEIGHT - this.viewH))
  }

  private render() {
    const ctx = this.ctx
    ctx.fillStyle = '#0b0f0d'
    ctx.fillRect(0, 0, this.viewW, this.viewH)
    ctx.save()
    ctx.translate(-this.camera.x, -this.camera.y)

    for (const z of ZONES) {
      ctx.fillStyle = z.color
      ctx.fillRect(z.x, z.y, z.w, z.h)
    }
    this.drawGrid()
    this.drawZoneLabels()

    ctx.fillStyle = '#8b5a2b'
    ctx.strokeStyle = '#5c3a1c'
    ctx.lineWidth = 3
    for (const w of WALLS) {
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

    for (const e of this.enemies) {
      if (e.kind === 'bug') this.drawBug(e)
      else this.drawZombie(e)
    }

    ctx.fillStyle = '#ffe066'
    for (const b of this.bullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    this.drawPlayer()
    ctx.restore()

    this.drawCrosshair()
    this.drawMinimap()
  }

  private drawZombie(z: Enemy) {
    const ctx = this.ctx
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

  private drawZoneLabels() {
    const ctx = this.ctx
    ctx.font = 'bold 64px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (const z of ZONES) {
      ctx.fillText(z.name.toUpperCase(), z.x + z.w / 2, 140)
      ctx.fillText(z.name.toUpperCase(), z.x + z.w / 2, WORLD_HEIGHT - 100)
    }
    ctx.textAlign = 'left'
  }

  private drawPlayer() {
    const ctx = this.ctx
    const p = this.player
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = p.hurtCooldown > 0 ? '#ff8a8a' : '#3ddc84'
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
    const mw = 240
    const mh = (mw * WORLD_HEIGHT) / WORLD_WIDTH
    const mx = this.viewW - mw - 20
    const my = this.viewH - mh - 20
    const s = mw / WORLD_WIDTH

    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = '#050807'
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12)

    for (const z of ZONES) {
      ctx.fillStyle = z.color
      ctx.fillRect(mx + z.x * s, my + z.y * s, z.w * s, z.h * s)
      if (this.mission && z.id === this.mission.zone) {
        ctx.strokeStyle = '#f4c542'
        ctx.lineWidth = 2
        ctx.strokeRect(mx + z.x * s + 1, my + z.y * s + 1, z.w * s - 2, z.h * s - 2)
      }
    }

    ctx.fillStyle = 'rgba(139,90,43,0.9)'
    for (const w of WALLS) {
      ctx.fillRect(mx + w.x * s, my + w.y * s, Math.max(1, w.w * s), Math.max(1, w.h * s))
    }

    for (const e of this.enemies) {
      ctx.fillStyle = e.kind === 'bug' ? '#ffa41b' : '#d62828'
      ctx.beginPath()
      ctx.arc(mx + e.x * s, my + e.y * s, e.kind === 'bug' ? 2 : 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = '#3ddc84'
    ctx.beginPath()
    ctx.arc(mx + this.player.x * s, my + this.player.y * s, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    for (const z of ZONES) {
      ctx.fillText(z.name, mx + z.x * s + 4, my + 14)
    }
    ctx.restore()
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}
