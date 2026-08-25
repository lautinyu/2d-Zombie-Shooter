import type { Mission } from './missions'
import type { Weapon } from './weapons'
import { weaponById } from './weapons'
import type { Character } from './characters'
import { characterById } from './characters'
import { SCRAP_PER_BUG, SCRAP_PER_KILL } from './profile'
import { playMusic, playSfx, playShot } from './audio'
import type { TexturePack } from './theme'
import { BUILDING_HEIGHT, MAX_BUILDING_LIFT, UNIT_LIFT } from './theme'
import type { GameMap, Rect } from './maps'
import { circleHitsWall, mapById } from './maps'
import { extractionField, flowDirection, goalField } from './nav'
import type { FlowField } from './nav'
import { drawCharacterSkin } from './skins'
import { bindInput, clearInput, keysPressed } from './input'

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
  /** Velocity applied this frame, from the movement keys only. */
  vx: number
  vy: number
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
  /** Seconds left before the active ability can be triggered again. */
  abilityCooldown: number
  /** Seconds left on a timed ability effect (Overdrive, Camouflage Blend). */
  abilityActive: number
  /** Remaining uses of a charge-limited ability; -1 when unlimited. */
  abilityCharges: number
  barricadeCharges: number
  /** 1 right after a shot, decaying to 0 — drives the hand kickback. */
  recoil: number
}

export type EnemyKind = 'zombie' | 'bug' | 'runner' | 'camo'

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
  /** Camo zombies drop their disguise once they close in, and stay revealed. */
  revealed: boolean
}

/** Acid left by enemies killed under the Toxic Blood mutation. */
interface AcidPool {
  x: number
  y: number
  r: number
  life: number
  maxLife: number
}

export type MutationId = 'hyper-speed' | 'hardened' | 'toxic-blood'

interface Mutation {
  id: MutationId
  name: string
  blurb: string
  /** Seconds of effect left. */
  time: number
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
  /** Seconds spent making no progress; drives the unstick sidestep. */
  stuck: number
  /** Sidestep direction chosen while unsticking, in radians. */
  detour: number
}

interface Turret {
  x: number
  y: number
  r: number
  angle: number
  cooldown: number
  /** Seconds of operation left before the turret powers down. */
  life: number
}

interface Medkit {
  x: number
  y: number
  /** Short delay so the kit is visible before the dropper can grab it. */
  arm: number
}

interface Barricade {
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
}

/** The Hive Mother: a two-phase alpha bug that ends the campaign. */
interface Boss {
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  baseSpeed: number
  phase: 1 | 2
  wobble: number
  angle: number
  ringTimer: number
  broodTimer: number
  dashTimer: number
  /** Seconds left of the phase-2 charge; movement is locked to dashDir. */
  dashing: number
  dashDir: { x: number; y: number }
  hurt: number
  attackCooldown: number
}

/** Venom spat by the boss; a hit counts as a sting. */
interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
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

export interface HudAbility {
  name: string
  key: string
  cooldown: number
  cooldownTotal: number
  active: number
  /** Remaining uses, or -1 when the ability is cooldown-gated only. */
  charges: number
  barricades: number
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
  ability: HudAbility
}

export interface HudBoss {
  name: string
  hp: number
  maxHp: number
  phase: 1 | 2
}

export interface HudMutation {
  name: string
  blurb: string
  /** Seconds of effect left. */
  time: number
  /** True during the short "Virus Mutating!" alert. */
  alert: boolean
}

export interface Hud {
  players: HudPlayer[]
  boss: HudBoss | null
  mutation: HudMutation | null
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
/** Wall clearance used when routing enemies around structures. */
const ENEMY_CLEARANCE = 14
/** Seconds between rebuilds of the enemy route field. */
const CHASE_FIELD_INTERVAL = 0.4
const MAX_STINGS = 5
const POISON_DURATION = 3
const POISON_DPS = 14
const BURN_DURATION = 2.5
const BURN_DPS = 16
const BURN_SLOW = 0.45
const ACID_SHOT_INTERVAL = 5
const IGNITE_CHANCE = 0.3
const BUG_SPAWN_CHANCE = 0.2
/** Share of the non-bug spawns that come out as each zombie variant. */
const RUNNER_SPAWN_CHANCE = 0.24
const CAMO_SPAWN_CHANCE = 0.16
/** Runners: twice the pace of a normal zombie on 40% of its health. */
const RUNNER_SPEED = 2
const RUNNER_HP_FRACTION = 0.4
/** How close a camo zombie gets before it drops the disguise. */
const CAMO_REVEAL_RANGE = 130
/** Distance at which a camo zombie starts mimicking a nearby survivor. */
const CAMO_MIMIC_RANGE = 260
const MUTATION_INTERVAL = 45
const MUTATION_DURATION = 20
const MUTATION_ALERT_TIME = 4
const MUTATION_SPEED = 1.25
const MUTATION_ARMOUR = 0.7
const ACID_LIFE = 7
const ACID_RADIUS = 34
const ACID_DPS = 16
/** How fast a mutation skin fades in and back out again, in units per second. */
const MUTATION_SKIN_FADE = 2.5
/** How fast the hand kickback settles after a shot. */
const RECOIL_RECOVERY = 7

const MUTATION_SKINS: Record<MutationId, { body: string; trim: string }> = {
  'hyper-speed': { body: '#a855f7', trim: '#e9d5ff' },
  hardened: { body: '#64748b', trim: '#1e293b' },
  'toxic-blood': { body: '#22c55e', trim: '#bbf7d0' },
}

const MUTATIONS: Omit<Mutation, 'time'>[] = [
  { id: 'hyper-speed', name: 'Hyper-Speed Mutation', blurb: 'All infected move 25% faster.' },
  { id: 'hardened', name: 'Hardened Shell Mutation', blurb: 'Infected take 30% less bullet damage.' },
  {
    id: 'toxic-blood',
    name: 'Toxic Blood Mutation',
    blurb: 'Kills leave acid puddles that burn you.',
  },
]
const HIVE_BUG_SPAWN_CHANCE = 0.45
const EXTRACTION_RADIUS = 70
const SURVIVOR_SPEED = 54
/** Survivors only advance while a player is close enough to escort them. */
const ESCORT_RADIUS = 240
const SURVIVOR_MAX_HP = 80
const SURVIVOR_ZOMBIE_DAMAGE = 20
const SURVIVOR_BUG_DAMAGE = 28
/** Survivors only pull aggro when clearly closer than a player. */
const SURVIVOR_AGGRO_BIAS = 0.75
/** Co-op camera keeps this much slack around the pair before zooming out. */
const COOP_CAMERA_MARGIN = 420
const MIN_ZOOM = 0.5
const P2_AUTO_FIRE_RANGE = 620
const TURRET_RANGE = 460
const TURRET_INTERVAL = 0.55
const TURRET_DAMAGE = 9
const TURRET_LIFETIME = 30
const OVERDRIVE_SPEED = 1.2
const OVERDRIVE_DAMAGE = 1.5
const MEDKIT_HEAL_FRACTION = 0.5
const MEDKIT_ARM_TIME = 0.8
const BARRICADE_HP = 260
const BARRICADE_W = 130
const BARRICADE_H = 26
const BOSS_NAME = 'The Hive Mother'
const BOSS_MAX_HP = 1800
const BOSS_RADIUS = 62
const BOSS_SPEED = 62
const BOSS_ENRAGE_SPEED = 1.3
const BOSS_RING_INTERVAL = 3.4
const BOSS_RING_SHOTS = 12
const BOSS_BROOD_INTERVAL = 6
const BOSS_BROOD_MAX = 8
const BOSS_DASH_INTERVAL = 8
const BOSS_DASH_TIME = 0.75
const BOSS_DASH_SPEED = 640
const BOSS_CONTACT_DAMAGE = 22
const VENOM_SPEED = 210
const VENOM_LIFE = 3
/** How close a player must get to the hive centre to trigger the reveal. */
const BOSS_REVEAL_RANGE = 320
const BOSS_REVEAL_TIME = 3.6
const BOSS_REVEAL_LINE = 'There she is... the source of the infection. Eyes up, let\'s take it down!'

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
  /** Chosen on the intro splash; affects drawing only, never physics. */
  textures: TexturePack = 'classic'

  private players: Player[] = []
  private enemies: Enemy[] = []
  private bullets: Bullet[] = []
  private ammoBoxes: AmmoBox[] = []
  private survivors: Survivor[] = []
  private turrets: Turret[] = []
  private medkits: Medkit[] = []
  private boss: Boss | null = null
  private venom: Projectile[] = []
  private groanTimer = 2
  private barricades: Barricade[] = []
  /** Route field to the nearest player or survivor, rebuilt periodically. */
  private chaseField: FlowField | null = null
  private chaseTimer = 0
  private acid: AcidPool[] = []
  private mutation: Mutation | null = null
  private mutationTimer = MUTATION_INTERVAL
  /** Seconds left on the "Virus Mutating!" HUD alert. */
  private mutationAlert = 0
  /** Mutation whose skin is on screen; outlives the effect while fading out. */
  private mutationSkin: MutationId | null = null
  /** 0..1 blend of the mutation skin over the default enemy look. */
  private mutationFade = 0

  private spawnTimer = 0
  private spawned = 0

  private runAndGunChecked = false
  private mouseWorld = { x: 0, y: 0 }
  private mouseScreen = { x: 0, y: 0 }

  /**
   * Boss reveal cinematic. 'pending' keeps the Hive Mother dormant until a
   * player reaches the middle of the map; 'playing' locks controls while the
   * camera slides onto her; 'done' hands control back and starts phase 1.
   */
  private reveal: 'off' | 'pending' | 'playing' | 'done' = 'off'
  private revealTimer = 0
  private bubbleTimer = 0
  private shake = 0
  /** Seconds of eased camera motion left after the cinematic hands back. */
  private cameraEase = 0

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
      vx: 0,
      vy: 0,
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
      abilityCooldown: 0,
      abilityActive: 0,
      abilityCharges: character.ability.charges > 0 ? character.ability.charges : -1,
      barricadeCharges: character.barricades,
      recoil: 0,
    }
  }

  private get p1(): Player {
    return this.players[0]
  }

  private get alivePlayers(): Player[] {
    return this.players.filter((p) => !p.down)
  }

  /** Position snapshot used by the automated movement smoke tests. */
  debugState() {
    return {
      map: this.map.id,
      players: this.players.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      enemies: this.enemies.map((e) => ({
        x: Math.round(e.x),
        y: Math.round(e.y),
        kind: e.kind,
        aware: e.aware,
      })),
    }
  }

  private bindInput() {
    bindInput(this.canvas, {
      reload: () => this.startReload(this.p1),
      p1Ability: () => this.useAbility(this.p1),
      p2Ability: () => this.useAbility(this.players[1]),
      p1Barricade: () => this.deployBarricade(this.p1),
      p2Barricade: () => this.deployBarricade(this.players[1]),
      p1Shot: () => {
        if (this.p1) this.p1.queuedShot = true
      },
      p2Shot: () => {
        const p2 = this.players[1]
        if (p2) p2.queuedShot = true
      },
      aim: (x, y) => {
        this.mouseScreen.x = x
        this.mouseScreen.y = y
      },
      canShoot: () => this.state === 'playing' && Boolean(this.p1),
    })
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
    this.turrets = []
    this.medkits = []
    this.barricades = []
    this.venom = []
    this.boss = null
    this.groanTimer = 2
    this.chaseField = null
    this.chaseTimer = 0
    this.acid = []
    this.mutation = null
    this.mutationTimer = MUTATION_INTERVAL
    this.mutationAlert = 0
    this.mutationSkin = null
    this.mutationFade = 0
    this.zoom = 1
    this.runAndGunChecked = false
    this.reveal = mission.type === 'boss' ? 'pending' : 'off'
    this.revealTimer = 0
    this.bubbleTimer = 0
    this.shake = 0
    this.cameraEase = 0

    this.players = []
    characters.slice(0, 2).forEach((c, i) => {
      const id: 1 | 2 = i === 0 ? 1 : 2
      // Player 1 starts near the middle of the map, not pinned to an edge —
      // except on the finale, where the walk to the hive centre is the trigger
      // for the boss reveal.
      const centre = { x: this.map.width / 2, y: this.map.height / 2 }
      const solo =
        mission.type === 'boss'
          ? this.openSpot(PLAYER_RADIUS + 10, centre, BOSS_REVEAL_RANGE * 2.2, 1200)
          : this.openSpot(PLAYER_RADIUS + 10, centre, 0, 420)
      const spawn =
        i === 0 ? solo : this.openSpot(PLAYER_RADIUS + 10, this.players[0], 50, 180)
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
        stuck: 0,
        detour: 0,
      })
    }

    if (mission.type === 'boss') {
      // She nests in the middle of the hive, where the reveal fires.
      const spot = this.openSpot(
        BOSS_RADIUS + 12,
        { x: this.map.width / 2, y: this.map.height / 2 },
        0,
        260
      )
      this.boss = {
        x: spot.x,
        y: spot.y,
        r: BOSS_RADIUS,
        hp: BOSS_MAX_HP,
        maxHp: BOSS_MAX_HP,
        baseSpeed: BOSS_SPEED,
        phase: 1,
        wobble: 0,
        angle: 0,
        ringTimer: 2,
        broodTimer: 3,
        dashTimer: BOSS_DASH_INTERVAL,
        dashing: 0,
        dashDir: { x: 1, y: 0 },
        hurt: 0,
        attackCooldown: 0,
      }
    }

    playMusic(mission.type === 'boss' ? 'boss' : 'battle')
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
    // A press that started a mission must not linger as a held trigger.
    clearInput()
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
        ability: {
          name: p.character.ability.name,
          key: p.id === 1 ? 'E' : 'M',
          cooldown: Math.max(0, p.abilityCooldown),
          cooldownTotal: p.character.ability.cooldown,
          active: Math.max(0, p.abilityActive),
          charges: p.abilityCharges,
          barricades: p.barricadeCharges,
        },
      })),
      mutation:
        this.mutation && (this.mutationAlert > 0 || this.mutation.time > 0)
          ? {
              name: this.mutation.name,
              blurb: this.mutation.blurb,
              time: Math.max(0, this.mutation.time),
              alert: this.mutationAlert > 0,
            }
          : null,
      boss: this.boss
        ? {
            name: BOSS_NAME,
            hp: Math.max(0, Math.round(this.boss.hp)),
            maxHp: this.boss.maxHp,
            phase: this.boss.phase,
          }
        : null,
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
    this.shake = Math.max(0, this.shake - dt * 1.6)
    this.bubbleTimer = Math.max(0, this.bubbleTimer - dt)
    this.cameraEase = Math.max(0, this.cameraEase - dt)
    if (this.reveal === 'pending') this.checkRevealTrigger()
    if (this.reveal === 'playing') {
      // Controls are locked: nothing but the camera moves during the reveal.
      this.revealTimer -= dt
      if (this.revealTimer <= 0) {
        this.reveal = 'done'
        this.cameraEase = 1.2
        clearInput()
      }
      this.updateCamera()
      return
    }

    for (const p of this.players) {
      if (p.down) continue
      this.updatePlayer(p, dt)
      this.updateWeapon(p, dt)
    }
    this.updateBullets(dt)
    this.updateBoss(dt)
    this.updateVenom(dt)
    this.updateSurvivors(dt)
    this.updateTurrets(dt)
    this.updateEnemies(dt)
    this.updatePickups(dt)
    this.updateAcid(dt)
    this.updateMutation(dt)
    this.updateSpawning(dt)
    this.updateCamera()
    this.updateAmbience(dt)
    this.checkOutcome()
  }

  /** Walking into the middle of the hive hands the scene over to the boss. */
  private checkRevealTrigger() {
    const boss = this.boss
    if (!boss) return
    const cx = this.map.width / 2
    const cy = this.map.height / 2
    const arrived = this.alivePlayers.some(
      (p) => Math.hypot(p.x - cx, p.y - cy) < BOSS_REVEAL_RANGE
    )
    if (!arrived) return
    this.reveal = 'playing'
    this.revealTimer = BOSS_REVEAL_TIME
    this.bubbleTimer = BOSS_REVEAL_TIME + 0.8
    this.shake = 1
    clearInput()
    playSfx('boss-roar')
  }

  /** Rolls a fresh global enemy modifier every MUTATION_INTERVAL seconds. */
  private updateMutation(dt: number) {
    this.mutationAlert = Math.max(0, this.mutationAlert - dt)
    if (this.mutation) {
      this.mutation.time -= dt
      if (this.mutation.time <= 0) this.mutation = null
    }
    // Skins blend in when a mutation lands and blend back out when it expires.
    const step = dt * MUTATION_SKIN_FADE
    if (this.mutation) {
      this.mutationSkin = this.mutation.id
      this.mutationFade = Math.min(1, this.mutationFade + step)
    } else {
      this.mutationFade = Math.max(0, this.mutationFade - step)
      if (this.mutationFade === 0) this.mutationSkin = null
    }
    this.mutationTimer -= dt
    if (this.mutationTimer > 0) return
    this.mutationTimer = MUTATION_INTERVAL
    const rolled = MUTATIONS[Math.floor(Math.random() * MUTATIONS.length)]
    this.mutation = { ...rolled, time: MUTATION_DURATION }
    this.mutationAlert = MUTATION_ALERT_TIME
    playSfx('sting')
  }

  private get mutationSpeed(): number {
    return this.mutation?.id === 'hyper-speed' ? MUTATION_SPEED : 1
  }

  private get mutationArmour(): number {
    return this.mutation?.id === 'hardened' ? MUTATION_ARMOUR : 1
  }

  /** Toxic Blood puddles: hurt players who stand in them, then fade. */
  private updateAcid(dt: number) {
    for (let i = this.acid.length - 1; i >= 0; i--) {
      const pool = this.acid[i]
      pool.life -= dt
      if (pool.life <= 0) {
        this.acid.splice(i, 1)
        continue
      }
      for (const p of this.alivePlayers) {
        if (Math.hypot(p.x - pool.x, p.y - pool.y) > pool.r + p.r) continue
        p.hp -= ACID_DPS * dt
        p.hurtCooldown = 0.25
        p.safeTimer = 0
      }
    }
  }

  /** Occasional groans from the horde while enemies are around. */
  private updateAmbience(dt: number) {
    if (!this.enemies.length) return
    this.groanTimer -= dt
    if (this.groanTimer > 0) return
    this.groanTimer = 3 + Math.random() * 4
    playSfx('groan')
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
    } else if (mission.type === 'boss') {
      if (this.boss && this.boss.hp <= 0) {
        this.boss = null
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

  /** Triggers the character's active ability for that player. */
  private useAbility(p: Player | undefined) {
    if (this.state !== 'playing' || !p || p.down) return
    if (p.abilityCooldown > 0 || p.abilityCharges === 0) return
    const ability = p.character.ability

    switch (p.character.id) {
      case 'army-retiree':
        p.abilityActive = ability.duration
        playSfx('overdrive')
        break
      case 'nature-lover':
        p.abilityActive = ability.duration
        playSfx('cloak')
        break
      case 'medic':
        this.medkits.push({ x: p.x, y: p.y, arm: MEDKIT_ARM_TIME })
        playSfx('medkit')
        break
      case 'engineer': {
        // One turret runs at a time, twice per mission.
        if (this.turrets.length) return
        const spot = circleHitsWall(this.map, p.x, p.y, 14) ? null : { x: p.x, y: p.y }
        if (!spot) return
        this.turrets.push({ x: spot.x, y: spot.y, r: 14, angle: p.angle, cooldown: 0, life: TURRET_LIFETIME })
        playSfx('turret')
        break
      }
    }

    if (p.abilityCharges > 0) p.abilityCharges -= 1
    p.abilityCooldown = ability.cooldown
  }

  /** Engineer's secondary: a destructible wall that blocks the horde. */
  private deployBarricade(p: Player | undefined) {
    if (this.state !== 'playing' || !p || p.down || p.barricadeCharges <= 0) return
    const horizontal = Math.abs(Math.cos(p.angle)) < Math.abs(Math.sin(p.angle))
    const w = horizontal ? BARRICADE_W : BARRICADE_H
    const h = horizontal ? BARRICADE_H : BARRICADE_W
    // Slide the wall back toward the player until it clears the structures.
    for (const reach of [46, 34, 24, 16, 0]) {
      const x = p.x + Math.cos(p.angle) * reach - w / 2
      const y = p.y + Math.sin(p.angle) * reach - h / 2
      if (this.rectBlocked(x, y, w, h)) continue
      this.barricades.push({ x, y, w, h, hp: BARRICADE_HP, maxHp: BARRICADE_HP })
      playSfx('barricade')
      p.barricadeCharges -= 1
      return
    }
  }

  /** True when the rect overlaps a structure or leaves the map. */
  private rectBlocked(x: number, y: number, w: number, h: number): boolean {
    if (x < 0 || y < 0 || x + w > this.map.width || y + h > this.map.height) return true
    return this.map.walls.some(
      (s) => x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y
    )
  }

  private hitsBarricade(x: number, y: number, r: number): Barricade | null {
    for (const b of this.barricades) {
      const cx = clamp(x, b.x, b.x + b.w)
      const cy = clamp(y, b.y, b.y + b.h)
      if (Math.hypot(x - cx, y - cy) < r) return b
    }
    return null
  }

  private updatePlayer(p: Player, dt: number) {
    const k = keysPressed
    p.abilityCooldown = Math.max(0, p.abilityCooldown - dt)
    p.abilityActive = Math.max(0, p.abilityActive - dt)
    const solo = this.players.length === 1
    // Velocity is derived only from the movement flags — k.shooting is never
    // read here, so firing cannot stop or slow a run.
    let dx = 0
    let dy = 0
    if (p.id === 1) {
      if (k.w || (solo && k.up)) dy -= 1
      if (k.s || (solo && k.down)) dy += 1
      if (k.a || (solo && k.left)) dx -= 1
      if (k.d || (solo && k.right)) dx += 1
    } else {
      if (k.up) dy -= 1
      if (k.down) dy += 1
      if (k.left) dx -= 1
      if (k.right) dx += 1
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy)
      dx /= len
      dy /= len
    }
    const boosted = p.character.id === 'army-retiree' && p.abilityActive > 0
    const step = p.speed * (boosted ? OVERDRIVE_SPEED : 1) * dt
    p.vx = dx * step
    p.vy = dy * step
    this.moveCircle(p, p.vx, p.vy)
    this.checkRunAndGun(p, k.shooting)

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
      // Held mouse button keeps the trigger down; movement above already ran.
      p.shooting = keysPressed.shooting
    }
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt)
    p.recoil = Math.max(0, p.recoil - dt * RECOIL_RECOVERY)

    const c = p.character
    if (c.regenFraction > 0) {
      p.safeTimer += dt
      if (p.safeTimer >= c.regenInterval) {
        p.safeTimer = 0
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * c.regenFraction)
      }
    }
  }

  /**
   * Self-check for the run-and-gun contract: while the trigger is held and a
   * direction key is down, velocity must still be non-zero. Reports once.
   */
  private checkRunAndGun(p: Player, shooting: boolean) {
    if (this.runAndGunChecked || !shooting || !this.movementRequested(p)) return
    this.runAndGunChecked = true
    const ok = p.vx !== 0 || p.vy !== 0
    console[ok ? 'info' : 'error'](
      `[input] shooting=true velocity=(${p.vx.toFixed(1)}, ${p.vy.toFixed(1)}) ${
        ok ? 'OK — movement runs while firing' : 'FAIL — velocity cleared by shooting'
      }`
    )
  }

  private movementRequested(p: Player): boolean {
    const k = keysPressed
    if (p.id === 2) return k.up || k.down || k.left || k.right
    const solo = this.players.length === 1
    return k.w || k.a || k.s || k.d || (solo && (k.up || k.down || k.left || k.right))
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

  /** Enemy movement also respects deployed barricades. */
  private moveEnemy(z: Enemy, dx: number, dy: number) {
    const m = this.map
    if (dx) {
      const nx = clamp(z.x + dx, z.r, m.width - z.r)
      if (!circleHitsWall(m, nx, z.y, z.r) && !this.hitsBarricade(nx, z.y, z.r)) z.x = nx
    }
    if (dy) {
      const ny = clamp(z.y + dy, z.r, m.height - z.r)
      if (!circleHitsWall(m, z.x, ny, z.r) && !this.hitsBarricade(z.x, ny, z.r)) z.y = ny
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
    const overdrive = p.character.id === 'army-retiree' && p.abilityActive > 0
    const damage = w.damage * (overdrive ? OVERDRIVE_DAMAGE : 1)

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
        damage,
        pierce: w.perk === 'armor-piercing',
        poison: acidShot,
        ignite: w.perk === 'dragons-breath',
        color: acidShot
          ? '#7cf03d'
          : overdrive
            ? '#ff4d4d'
            : w.perk === 'dragons-breath'
              ? '#ff7a18'
              : '#ffe066',
        width: acidShot ? w.tracerWidth + 1 : w.tracerWidth,
        hit: new Set<Enemy>(),
      })
    }
    p.mag -= 1
    p.recoil = 1
    playShot(w)
  }

  /** True while Camouflage Blend hides this player from every enemy. */
  private isCloaked(p: Player): boolean {
    return p.character.id === 'nature-lover' && p.abilityActive > 0
  }

  private updateTurrets(dt: number) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i]
      t.life -= dt
      if (t.life <= 0) {
        this.turrets.splice(i, 1)
        continue
      }
      this.updateTurret(t, dt)
    }
  }

  private updateTurret(t: Turret, dt: number) {
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
      const boss = this.boss
      if (!dead && boss && boss.hp > 0 && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.r) {
        const travelled = 1 - b.life / b.maxLife
        boss.hp -= b.damage * (1 - (1 - b.falloff) * travelled)
        boss.hurt = 0.12
        if (boss.hp <= boss.maxHp / 2 && boss.phase === 1) {
          boss.phase = 2
          boss.dashTimer = 2
          playSfx('boss-roar')
        }
        if (!b.pierce) dead = true
      }
      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j]
          if (b.hit.has(e)) continue
          if (Math.hypot(e.x - b.x, e.y - b.y) >= e.r + 2) continue
          b.hit.add(e)
          const travelled = 1 - b.life / b.maxLife
          e.hp -= b.damage * (1 - (1 - b.falloff) * travelled) * this.mutationArmour
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
    if (this.mutation?.id === 'toxic-blood') {
      this.acid.push({ x: z.x, y: z.y, r: ACID_RADIUS, life: ACID_LIFE, maxLife: ACID_LIFE })
    }
    if (Math.random() < 0.22) {
      this.ammoBoxes.push({ x: z.x, y: z.y, amount: 20 })
    }
  }

  /**
   * Phase 1 stalks the nearest player, spitting venom rings and hatching
   * brood. Below half health she enrages: faster, and charging every 8s.
   */
  private updateBoss(dt: number) {
    const b = this.boss
    if (!b || b.hp <= 0) return
    // She only stirs once the reveal cinematic has played.
    if (this.reveal === 'pending' || this.reveal === 'playing') return
    b.wobble += dt
    b.hurt = Math.max(0, b.hurt - dt)
    b.attackCooldown = Math.max(0, b.attackCooldown - dt)

    const prey = this.nearestPlayerTo(b)
    if (prey) b.angle = Math.atan2(prey.y - b.y, prey.x - b.x)

    if (b.dashing > 0) {
      b.dashing -= dt
      this.moveCircle(b, b.dashDir.x * BOSS_DASH_SPEED * dt, b.dashDir.y * BOSS_DASH_SPEED * dt)
    } else if (prey) {
      const speed = b.baseSpeed * (b.phase === 2 ? BOSS_ENRAGE_SPEED : 1)
      this.moveCircle(b, Math.cos(b.angle) * speed * dt, Math.sin(b.angle) * speed * dt)
    }

    b.ringTimer -= dt
    if (b.ringTimer <= 0) {
      b.ringTimer = BOSS_RING_INTERVAL
      this.fireVenomRing(b)
    }

    b.broodTimer -= dt
    if (b.broodTimer <= 0) {
      b.broodTimer = BOSS_BROOD_INTERVAL
      if (this.enemies.length < BOSS_BROOD_MAX) {
        const spot = this.openSpot(12, b, 80, 220)
        this.enemies.push(this.makeBug(spot))
      }
    }

    if (b.phase === 2 && b.dashing <= 0) {
      b.dashTimer -= dt
      if (b.dashTimer <= 0 && prey) {
        b.dashTimer = BOSS_DASH_INTERVAL
        b.dashing = BOSS_DASH_TIME
        b.dashDir = { x: Math.cos(b.angle), y: Math.sin(b.angle) }
        playSfx('boss-dash')
      }
    }

    if (prey && b.attackCooldown === 0) {
      const d = Math.hypot(prey.x - b.x, prey.y - b.y)
      if (d < b.r + prey.r) {
        prey.hp -= BOSS_CONTACT_DAMAGE
        prey.hurtCooldown = 0.3
        prey.safeTimer = 0
        b.attackCooldown = 1
      }
    }
  }

  private fireVenomRing(b: Boss) {
    for (let i = 0; i < BOSS_RING_SHOTS; i++) {
      const a = (i / BOSS_RING_SHOTS) * Math.PI * 2 + b.wobble
      this.venom.push({
        x: b.x + Math.cos(a) * (b.r + 6),
        y: b.y + Math.sin(a) * (b.r + 6),
        vx: Math.cos(a) * VENOM_SPEED,
        vy: Math.sin(a) * VENOM_SPEED,
        r: 7,
        life: VENOM_LIFE,
      })
    }
  }

  private updateVenom(dt: number) {
    for (let i = this.venom.length - 1; i >= 0; i--) {
      const v = this.venom[i]
      v.x += v.vx * dt
      v.y += v.vy * dt
      v.life -= dt
      let dead = v.life <= 0 || circleHitsWall(this.map, v.x, v.y, v.r)
      if (!dead) {
        for (const p of this.alivePlayers) {
          if (this.isCloaked(p) || p.hurtCooldown > 0) continue
          if (Math.hypot(p.x - v.x, p.y - v.y) > p.r + v.r) continue
          // Venom is a sting: it feeds the infection meter, not just health.
          p.stings += 1
          p.hp -= 5
          p.hurtCooldown = 1.2
          p.safeTimer = 0
          playSfx('sting')
          dead = true
          break
        }
      }
      if (dead) this.venom.splice(i, 1)
    }
  }

  private nearestPlayerTo(from: { x: number; y: number }): Player | null {
    let best: Player | null = null
    let bestD = Infinity
    for (const p of this.alivePlayers) {
      if (this.isCloaked(p)) continue
      const d = Math.hypot(p.x - from.x, p.y - from.y)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best
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
      const base = Math.atan2(uy, ux) + (s.stuck > 0 ? s.detour : 0)
      const before = { x: s.x, y: s.y }
      for (const offset of [0, 0.4, -0.4, 0.9, -0.9, 1.4, -1.4, 2.1, -2.1]) {
        const a = base + offset
        const nx = s.x + Math.cos(a) * step
        const ny = s.y + Math.sin(a) * step
        if (circleHitsWall(this.map, nx, ny, s.r)) continue
        s.x = nx
        s.y = ny
        break
      }

      // Wedged against a corner: commit to a sidestep for a moment.
      if (Math.hypot(s.x - before.x, s.y - before.y) < step * 0.4) {
        if (s.stuck <= 0) s.detour = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2
        s.stuck = 0.7
      } else {
        s.stuck = Math.max(0, s.stuck - dt)
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
      // Camouflage Blend drops all aggro on that player.
      if (this.isCloaked(p)) continue
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

  /** Refreshes the shared route field enemies follow when a wall blocks them. */
  private updateChaseField(dt: number) {
    this.chaseTimer -= dt
    if (this.chaseField && this.chaseTimer > 0) return
    const goals: { x: number; y: number }[] = this.alivePlayers.filter((p) => !this.isCloaked(p))
    for (const s of this.survivors) if (!s.safe && s.hp > 0) goals.push(s)
    this.chaseField = goals.length ? goalField(this.map, ENEMY_CLEARANCE, goals) : null
    this.chaseTimer = CHASE_FIELD_INTERVAL
  }

  private updateEnemies(dt: number) {
    this.updateChaseField(dt)
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
      z.speed = (z.burn > 0 ? z.baseSpeed * BURN_SLOW : z.baseSpeed) * this.mutationSpeed

      const target = this.targetFor(z)
      if (!target.survivor && !target.player) continue
      const dx = target.x - z.x
      const dy = target.y - z.y
      const d = Math.hypot(dx, dy) || 1
      // A camo zombie keeps its disguise until a player is within striking range.
      if (z.kind === 'camo' && !z.revealed) {
        const hunter = this.nearestPlayerTo(z)
        if (hunter && Math.hypot(hunter.x - z.x, hunter.y - z.y) < CAMO_REVEAL_RANGE) {
          z.revealed = true
        }
      }
      const step = z.speed * dt
      const wob = Math.sin(z.wobble * 4) * 0.25
      z.retreat = Math.max(0, z.retreat - dt)

      // Camouflage only hides players; survivors are spotted normally.
      const sight = z.vision * (target.player ? target.player.character.aggroMultiplier : 1)
      z.aware = z.aware ? d < sight * VISION_HYSTERESIS : d < sight
      if (!z.aware) {
        z.driftAngle += (Math.random() - 0.5) * dt * 2
        this.moveEnemy(
          z,
          Math.cos(z.driftAngle) * step * 0.3,
          Math.sin(z.driftAngle) * step * 0.3
        )
        continue
      }

      // Walk straight when the target is visible, otherwise follow the route
      // field so walls are rounded instead of pressed into.
      let hx = dx / d
      let hy = dy / d
      if (this.chaseField && d > z.r + 8 && !this.hasLineOfSight(z, target)) {
        const flow = flowDirection(this.chaseField, z.x, z.y)
        if (flow) {
          hx = flow.x
          hy = flow.y
        }
      }
      const dir = z.retreat > 0 ? -1 : 1
      const ux = hx * dir
      const uy = hy * dir
      const px = -uy * wob
      const py = ux * wob
      this.moveEnemy(z, (ux + px) * step, (uy + py) * step)

      z.attackCooldown = Math.max(0, z.attackCooldown - dt)

      // Chew through any barricade standing between the enemy and its target.
      const wall = this.hitsBarricade(z.x + ux * (z.r + 6), z.y + uy * (z.r + 6), z.r)
      if (wall && z.attackCooldown === 0) {
        wall.hp -= z.kind === 'bug' ? 10 : 18
        z.attackCooldown = 0.6
        if (wall.hp <= 0) this.barricades.splice(this.barricades.indexOf(wall), 1)
        continue
      }
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

  private updatePickups(dt: number) {
    for (let i = this.ammoBoxes.length - 1; i >= 0; i--) {
      const a = this.ammoBoxes[i]
      const taker = this.alivePlayers.find((p) => Math.hypot(a.x - p.x, a.y - p.y) < p.r + 14)
      if (taker) {
        taker.reserve += a.amount
        this.ammoBoxes.splice(i, 1)
      }
    }

    for (let i = this.medkits.length - 1; i >= 0; i--) {
      const kit = this.medkits[i]
      kit.arm = Math.max(0, kit.arm - dt)
      if (kit.arm > 0) continue
      const taker = this.alivePlayers.find(
        (p) => p.hp < p.maxHp && Math.hypot(kit.x - p.x, kit.y - p.y) < p.r + 16
      )
      if (taker) {
        taker.hp = Math.round(
          Math.min(taker.maxHp, taker.hp + (taker.maxHp - taker.hp) * MEDKIT_HEAL_FRACTION)
        )
        this.medkits.splice(i, 1)
      }
    }
  }

  private updateSpawning(dt: number) {
    const mission = this.mission
    if (!mission) return
    const protect = mission.type === 'protect'
    const boss = mission.type === 'boss'
    const maxAlive = protect
      ? 4 + mission.survivors * 2
      : boss
        ? 6
        : Math.min(14, Math.max(4, Math.ceil(mission.target / 3)))
    if (this.enemies.length >= maxAlive) return
    if (!protect && !boss) {
      const remaining = mission.target - this.kills
      if (this.spawned - this.kills >= remaining + 4) return
    }

    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer = protect ? 1.5 : boss ? 2.4 : 0.9

    const spot = this.spawnPoint()
    if (!spot) return
    const bugChance = mission.type === 'hive' ? HIVE_BUG_SPAWN_CHANCE : BUG_SPAWN_CHANCE
    this.enemies.push(this.makeEnemy(spot, bugChance))
    this.spawned += 1
  }

  /** Waves mix normal zombies with bugs, runners and camo stalkers. */
  private makeEnemy(spot: { x: number; y: number }, bugChance: number): Enemy {
    const roll = Math.random()
    if (roll < bugChance) return this.makeBug(spot)
    const variant = Math.random()
    if (variant < RUNNER_SPAWN_CHANCE) return this.makeRunner(spot)
    if (variant < RUNNER_SPAWN_CHANCE + CAMO_SPAWN_CHANCE) return this.makeCamo(spot)
    return this.makeZombie(spot)
  }

  /** The Runner: twice the speed of a zombie, 40% of its health. */
  private makeRunner(spot: { x: number; y: number }): Enemy {
    return {
      kind: 'runner',
      x: spot.x,
      y: spot.y,
      r: 11,
      hp: 60 * RUNNER_HP_FRACTION,
      speed: 0,
      baseSpeed: RUNNER_SPEED * (95 + Math.random() * 30),
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
      poison: 0,
      burn: 0,
      vision: ZOMBIE_VISION,
      aware: false,
      driftAngle: Math.random() * Math.PI * 2,
      revealed: false,
    }
  }

  /** The Camo Zombie: blends into the floor and mimics survivors. */
  private makeCamo(spot: { x: number; y: number }): Enemy {
    return {
      kind: 'camo',
      x: spot.x,
      y: spot.y,
      r: 14,
      hp: 70,
      speed: 0,
      baseSpeed: 88 + Math.random() * 26,
      attackCooldown: 0,
      wobble: Math.random() * 10,
      retreat: 0,
      poison: 0,
      burn: 0,
      vision: ZOMBIE_VISION,
      aware: false,
      driftAngle: Math.random() * Math.PI * 2,
      revealed: false,
    }
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
      revealed: false,
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
      revealed: false,
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
    // Settle exactly on the target: an endlessly creeping zoom resamples every
    // texture line each frame, which reads as flickering while walking.
    if (Math.abs(target - this.zoom) < 0.002) this.zoom = target

    const worldW = this.viewW / this.zoom
    const worldH = this.viewH / this.zoom
    const boss = this.boss
    const focusBoss = this.reveal === 'playing' && boss !== null
    const fx = focusBoss && boss ? boss.x : cx
    const fy = focusBoss && boss ? boss.y : cy
    const camX = clamp(fx - worldW / 2, 0, Math.max(0, m.width - worldW))
    const camY = clamp(fy - worldH / 2, 0, Math.max(0, m.height - worldH))
    if (focusBoss || this.cameraEase > 0) {
      // Cinematic slide: ease onto the boss and back to the players after.
      this.camera.x += (camX - this.camera.x) * 0.07
      this.camera.y += (camY - this.camera.y) * 0.07
    } else {
      this.camera.x = camX
      this.camera.y = camY
    }
  }

  private render() {
    const ctx = this.ctx
    const m = this.map
    ctx.fillStyle = '#0b0f0d'
    ctx.fillRect(0, 0, this.viewW, this.viewH)
    ctx.save()
    if (this.shake > 0) {
      const amp = this.shake * 12
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp)
    }
    this.applyWorldTransform()

    ctx.fillStyle = m.color
    ctx.fillRect(0, 0, m.width, m.height)
    this.drawFloor()
    this.drawMapLabel()
    if (this.mission?.type === 'protect') this.drawExtraction()

    for (const w of m.walls) {
      if (this.textures === 'enhanced') this.drawStructure3D(w)
      else this.drawStructure(w)
    }

    for (const a of this.ammoBoxes) {
      ctx.fillStyle = '#f4c542'
      ctx.fillRect(a.x - 8, a.y - 6, 16, 12)
      ctx.strokeStyle = '#8a6b12'
      ctx.lineWidth = 2
      ctx.strokeRect(a.x - 8, a.y - 6, 16, 12)
    }

    for (const kit of this.medkits) this.drawMedkit(kit)
    for (const b of this.barricades) this.drawBarricade(b)

    for (const s of this.survivors) this.drawSurvivor(s)
    if (this.mission?.type === 'protect') this.drawSurvivorHealthBars()
    for (const t of this.turrets) this.drawTurret(t)

    for (const pool of this.acid) this.drawAcid(pool)

    for (const e of this.enemies) {
      if (e.kind !== 'camo' || e.revealed) this.drawGroundShadow(e.x, e.y, e.r)
      if (e.kind === 'bug') this.drawBug(e)
      else if (e.kind === 'camo') this.drawCamo(e)
      else if (e.kind === 'runner') this.drawRunner(e)
      else this.drawZombie(e)
    }

    if (this.boss) this.drawBoss(this.boss)
    for (const v of this.venom) this.drawVenom(v)

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

    for (const p of this.players) {
      this.drawGroundShadow(p.x, p.y, p.r)
      this.drawPlayer(p)
    }
    if (this.bubbleTimer > 0) this.drawRevealBubble()
    ctx.restore()

    this.drawCrosshair()
    this.drawMinimap()
  }

  /**
   * World transform for the camera, snapped to whole device pixels so floor
   * seams and shadows do not shimmer between frames while the player walks.
   */
  private applyWorldTransform() {
    const ctx = this.ctx
    const dpr = window.devicePixelRatio || 1
    const unit = this.zoom * dpr
    const cx = Math.round(this.camera.x * unit) / unit
    const cy = Math.round(this.camera.y * unit) / unit
    ctx.scale(this.zoom, this.zoom)
    ctx.translate(-cx, -cy)
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

  /**
   * Enhanced pack: extrude the footprint away from the map centre so the
   * building shows a lit top face and shaded sides, like a block. The centre is
   * fixed rather than camera-based, so blocks never shift while walking.
   */
  private drawStructure3D(w: Rect) {
    const ctx = this.ctx
    const m = this.map
    if (w.kind === 'barrier') {
      this.drawStructure(w)
      return
    }
    const cx = m.width / 2
    const cy = m.height / 2
    // Slide the roof away from the view centre by a small, clamped amount: a
    // proportional extrusion detaches distant blocks and reads as platforms.
    const dx = w.x + w.w / 2 - cx
    const dy = w.y + w.h / 2 - cy
    const dist = Math.hypot(dx, dy) || 1
    const lift = Math.min(dist * BUILDING_HEIGHT, MAX_BUILDING_LIFT)
    const top: Rect = {
      x: w.x + (dx / dist) * lift,
      y: w.y + (dy / dist) * lift,
      w: w.w,
      h: w.h,
      kind: w.kind,
    }

    // Footprint shadow, then the four side faces up to the roof outline.
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(w.x, w.y, w.w, w.h)

    const base = [
      { x: w.x, y: w.y },
      { x: w.x + w.w, y: w.y },
      { x: w.x + w.w, y: w.y + w.h },
      { x: w.x, y: w.y + w.h },
    ]
    const roof = [
      { x: top.x, y: top.y },
      { x: top.x + top.w, y: top.y },
      { x: top.x + top.w, y: top.y + top.h },
      { x: top.x, y: top.y + top.h },
    ]
    const shades = ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.38)']
    for (let i = 0; i < 4; i++) {
      const a = base[i]
      const b = base[(i + 1) % 4]
      const c = roof[(i + 1) % 4]
      const d = roof[i]
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineTo(c.x, c.y)
      ctx.lineTo(d.x, d.y)
      ctx.closePath()
      ctx.fillStyle = m.wallColor
      ctx.fill()
      ctx.fillStyle = shades[i]
      ctx.fill()
      ctx.strokeStyle = m.wallEdge
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()

    this.drawStructure(top)
  }

  /** Soft ellipse under a unit so it reads as standing on the ground. */
  private drawGroundShadow(x: number, y: number, r: number) {
    if (this.textures !== 'enhanced') return
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.beginPath()
    ctx.ellipse(x + r * 0.15, y + r * 0.55, r * 0.95, r * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawVenom(v: Projectile) {
    const ctx = this.ctx
    this.drawGroundShadow(v.x, v.y, v.r * 0.8)
    ctx.save()
    ctx.translate(v.x, this.textures === 'enhanced' ? v.y - UNIT_LIFT : v.y)
    const grad = ctx.createRadialGradient(-v.r * 0.3, -v.r * 0.3, 1, 0, 0, v.r)
    grad.addColorStop(0, '#d9ff8a')
    grad.addColorStop(1, '#5aa30d')
    ctx.fillStyle = this.textures === 'enhanced' ? grad : '#8fdb2e'
    ctx.beginPath()
    ctx.arc(0, 0, v.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(30,60,0,0.8)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  /** The Hive Mother: layered blocky body with wings floating over her shadow. */
  private drawBoss(b: Boss) {
    const ctx = this.ctx
    const enhanced = this.textures === 'enhanced'
    const lift = enhanced ? UNIT_LIFT * 3 : 0
    const flap = Math.sin(b.wobble * 9) * 0.45
    const enraged = b.phase === 2

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.beginPath()
    ctx.ellipse(b.x, b.y + b.r * 0.4, b.r * 1.05, b.r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(b.x, b.y - lift)
    ctx.rotate(b.angle)

    // Wings first so the body layers sit on top of them.
    ctx.fillStyle = enraged ? 'rgba(255,140,120,0.42)' : 'rgba(255, 213, 128, 0.4)'
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.rotate(side * (0.8 + flap * side))
      ctx.beginPath()
      ctx.ellipse(-b.r * 0.2, -b.r * 1.5 * side, b.r * 0.55, b.r * 1.25, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }

    const body = enraged ? '#e04a2f' : '#f0871b'
    const dark = enraged ? '#7c1d0f' : '#8a4b00'
    if (enhanced) {
      // Stacked blocks: abdomen, thorax, head, each with a lit top edge.
      const segments = [
        { dx: -b.r * 0.75, size: b.r * 1.05 },
        { dx: 0, size: b.r * 0.95 },
        { dx: b.r * 0.8, size: b.r * 0.68 },
      ]
      for (const seg of segments) {
        ctx.fillStyle = dark
        ctx.fillRect(seg.dx - seg.size / 2, -seg.size / 2, seg.size, seg.size)
        ctx.fillStyle = body
        ctx.fillRect(seg.dx - seg.size / 2, -seg.size / 2, seg.size, seg.size * 0.78)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(seg.dx - seg.size / 2, -seg.size / 2, seg.size, seg.size * 0.18)
        ctx.strokeStyle = dark
        ctx.lineWidth = 3
        ctx.strokeRect(seg.dx - seg.size / 2, -seg.size / 2, seg.size, seg.size)
      }
    } else {
      ctx.beginPath()
      ctx.ellipse(0, 0, b.r, b.r * 0.82, 0, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = dark
      ctx.lineWidth = 4
      ctx.stroke()
    }

    // Eyes and stinger point along her facing.
    ctx.fillStyle = enraged ? '#fff1a8' : '#2b0b00'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(b.r * 0.85, side * b.r * 0.22, b.r * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.moveTo(-b.r * 1.25, 0)
    ctx.lineTo(-b.r * 0.75, -b.r * 0.22)
    ctx.lineTo(-b.r * 0.75, b.r * 0.22)
    ctx.closePath()
    ctx.fill()

    if (b.hurt > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.beginPath()
      ctx.arc(0, 0, b.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    if (b.dashing > 0) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,80,60,0.8)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(b.x, b.y - lift, b.r + 12, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
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

  private drawMedkit(kit: Medkit) {
    const ctx = this.ctx
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(kit.x - 11, kit.y - 9, 22, 18)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.strokeRect(kit.x - 11, kit.y - 9, 22, 18)
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(kit.x - 2.5, kit.y - 6, 5, 12)
    ctx.fillRect(kit.x - 7, kit.y - 2.5, 14, 5)
  }

  private drawBarricade(b: Barricade) {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = '#7c5c2b'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = '#3f2d12'
    ctx.lineWidth = 3
    ctx.strokeRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 2
    const along = b.w > b.h
    for (let i = 14; i < (along ? b.w : b.h); i += 18) {
      ctx.beginPath()
      if (along) {
        ctx.moveTo(b.x + i, b.y)
        ctx.lineTo(b.x + i, b.y + b.h)
      } else {
        ctx.moveTo(b.x, b.y + i)
        ctx.lineTo(b.x + b.w, b.y + i)
      }
      ctx.stroke()
    }
    const pct = Math.max(0, b.hp) / b.maxHp
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444'
    ctx.fillRect(b.x, b.y - 8, b.w * pct, 4)
    ctx.restore()
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

  /** Body colour for an enemy, swapped out while a mutation skin is on. */
  private enemySkinColor(base: string): string {
    const skin = this.mutationSkin
    return skin && this.mutationFade > 0.5 ? MUTATION_SKINS[skin].body : base
  }

  /** Direction an enemy is lunging in: its prey, or its idle drift. */
  private enemyFacing(z: Enemy): number {
    const prey = this.nearestPlayerTo(z)
    if (!prey) return z.driftAngle
    return Math.atan2(prey.y - z.y, prey.x - z.x)
  }

  /**
   * Two fists clawing toward the prey, alternating so the enemy looks like it
   * is frantically grabbing as it closes in.
   */
  private drawReachingHands(z: Enemy, y: number, skin: string, outline: string) {
    const ctx = this.ctx
    const angle = this.enemyFacing(z)
    const hr = Math.max(3.5, z.r * 0.3)
    ctx.save()
    ctx.translate(z.x, y)
    ctx.rotate(angle)
    for (const side of [-1, 1]) {
      const cycle = Math.sin(z.wobble * 7 + (side > 0 ? Math.PI : 0))
      const reach = z.r + Math.max(7, z.r * 0.3) + z.r * 0.35 * cycle
      const lift = side * (Math.max(7, z.r * 0.55) - z.r * 0.12 * cycle)
      ctx.beginPath()
      ctx.moveTo(z.r * 0.35, side * z.r * 0.45)
      ctx.lineTo(reach, lift)
      ctx.strokeStyle = outline
      ctx.lineWidth = Math.max(2, z.r * 0.18)
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(reach, lift, hr, 0, Math.PI * 2)
      ctx.fillStyle = skin
      ctx.fill()
      ctx.strokeStyle = outline
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * Paints the active mutation's texture over an enemy body, fading in when the
   * virus mutates and back out when the modifier expires.
   */
  private drawMutationSkin(z: Enemy, y: number, r: number) {
    const skin = this.mutationSkin
    if (!skin || this.mutationFade <= 0.01) return
    const ctx = this.ctx
    const { body, trim } = MUTATION_SKINS[skin]
    const fade = this.mutationFade
    ctx.save()
    ctx.translate(z.x, y)
    ctx.globalAlpha = 0.92 * fade

    if (skin === 'hardened') {
      // Rocky plating with a spiked rim.
      ctx.beginPath()
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        const spike = i % 2 === 0 ? r * 1.28 : r * 0.94
        const px = Math.cos(a) * spike
        const py = Math.sin(a) * spike
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = trim
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(148,163,184,0.55)'
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.6
        ctx.beginPath()
        ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      return
    }

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = body
    ctx.fill()
    ctx.strokeStyle = trim
    ctx.lineWidth = 2
    ctx.stroke()

    if (skin === 'hyper-speed') {
      // Electric sparks trailing behind the direction of travel.
      const back = this.enemyFacing(z) + Math.PI
      ctx.globalAlpha = 0.8 * fade
      ctx.strokeStyle = trim
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        const a = back + (i - 1) * 0.4
        const jitter = Math.sin(z.wobble * 18 + i * 2) * 4
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        ctx.lineTo(Math.cos(a) * (r + 12 + jitter), Math.sin(a) * (r + 12 + jitter))
        ctx.stroke()
      }
      ctx.fillStyle = '#f5d0fe'
      for (let i = 0; i < 3; i++) {
        const a = back + Math.sin(z.wobble * 9 + i * 2.1) * 0.9
        const d = r + 6 + ((z.wobble * 40 + i * 9) % 14)
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      // Bubbling radioactive hide with droplets running off the body.
      ctx.globalAlpha = 0.85 * fade
      ctx.fillStyle = trim
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + z.wobble * 1.5
        const rad = r * 0.22 * (0.7 + 0.4 * Math.sin(z.wobble * 6 + i))
        ctx.beginPath()
        ctx.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#84cc16'
      for (let i = 0; i < 3; i++) {
        const drip = (z.wobble * 30 + i * 7) % 16
        ctx.beginPath()
        ctx.ellipse((i - 1) * r * 0.5, r * 0.6 + drip, 2.5, 4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  private drawZombie(z: Enemy) {
    const ctx = this.ctx
    this.drawStatusRing(z)
    const enhanced = this.textures === 'enhanced'
    const y = enhanced ? z.y - UNIT_LIFT : z.y
    const flat = z.r > 16 ? '#8b1414' : '#d62828'
    this.drawReachingHands(z, y, this.enemySkinColor(flat), '#4a0a0a')
    ctx.beginPath()
    ctx.arc(z.x, y, z.r, 0, Math.PI * 2)
    if (enhanced) {
      // Shaded sphere so the body reads as standing above its shadow.
      const grad = ctx.createRadialGradient(z.x - z.r * 0.35, y - z.r * 0.4, z.r * 0.15, z.x, y, z.r)
      grad.addColorStop(0, z.r > 16 ? '#c94141' : '#ff6b5e')
      grad.addColorStop(1, z.r > 16 ? '#5c0d0d' : '#8f1616')
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = flat
    }
    ctx.fill()
    ctx.strokeStyle = '#4a0a0a'
    ctx.lineWidth = 2
    ctx.stroke()
    this.drawMutationSkin(z, y, z.r)
  }

  /** Toxic Blood residue: a bubbling green puddle that fades out. */
  private drawAcid(pool: AcidPool) {
    const ctx = this.ctx
    const fade = Math.min(1, pool.life / pool.maxLife + 0.2)
    ctx.save()
    ctx.globalAlpha = 0.55 * fade
    ctx.beginPath()
    ctx.arc(pool.x, pool.y, pool.r, 0, Math.PI * 2)
    ctx.fillStyle = '#65a30d'
    ctx.fill()
    ctx.globalAlpha = 0.85 * fade
    ctx.strokeStyle = '#a3e635'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalAlpha = 0.5 * fade
    ctx.fillStyle = '#bef264'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + pool.life
      ctx.beginPath()
      ctx.arc(pool.x + Math.cos(a) * pool.r * 0.45, pool.y + Math.sin(a) * pool.r * 0.45, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /** The Runner: small, bright red, with motion streaks behind it. */
  private drawRunner(z: Enemy) {
    const ctx = this.ctx
    this.drawStatusRing(z)
    const y = this.textures === 'enhanced' ? z.y - UNIT_LIFT : z.y
    ctx.save()
    ctx.strokeStyle = 'rgba(255,60,60,0.35)'
    ctx.lineWidth = 3
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(z.x - Math.cos(z.driftAngle) * 0, y, z.r + i * 4, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    this.drawReachingHands(z, y, this.enemySkinColor('#ff1e1e'), '#7f1d1d')
    ctx.beginPath()
    ctx.arc(z.x, y, z.r, 0, Math.PI * 2)
    ctx.fillStyle = '#ff1e1e'
    ctx.fill()
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 2
    ctx.stroke()
    this.drawMutationSkin(z, y, z.r)
  }

  /**
   * The Camo Zombie: tinted to the floor until it closes in, and disguised as
   * a survivor whenever one is nearby.
   */
  private drawCamo(z: Enemy) {
    const ctx = this.ctx
    const y = this.textures === 'enhanced' ? z.y - UNIT_LIFT : z.y
    if (z.revealed) {
      this.drawStatusRing(z)
      this.drawReachingHands(z, y, this.enemySkinColor('#3f6212'), '#1a2e05')
      ctx.beginPath()
      ctx.arc(z.x, y, z.r, 0, Math.PI * 2)
      ctx.fillStyle = '#3f6212'
      ctx.fill()
      ctx.strokeStyle = '#d62828'
      ctx.lineWidth = 3
      ctx.stroke()
      this.drawMutationSkin(z, y, z.r)
      return
    }

    const mimic = this.survivors.some(
      (s) => !s.safe && s.hp > 0 && Math.hypot(s.x - z.x, s.y - z.y) < CAMO_MIMIC_RANGE
    )
    if (mimic) {
      // Wears a survivor's look — including a fake health bar — as a decoy.
      ctx.beginPath()
      ctx.arc(z.x, y, z.r, 0, Math.PI * 2)
      ctx.fillStyle = '#e2e8f0'
      ctx.fill()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(z.x - 21, y - z.r - 15, 42, 8)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(z.x - 20, y - z.r - 14, 40, 6)
      return
    }

    // Otherwise it takes on the floor colour, leaving only a faint outline.
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(z.x, y, z.r, 0, Math.PI * 2)
    ctx.fillStyle = this.map.color
    ctx.fill()
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  private drawBug(b: Enemy) {
    const ctx = this.ctx
    this.drawStatusRing(b)
    const flap = Math.sin(b.wobble * 22) * 0.6
    const bodyY = this.textures === 'enhanced' ? b.y - UNIT_LIFT * 2 : b.y
    this.drawReachingHands(b, bodyY, this.enemySkinColor('#ffa41b'), '#8a4b00')
    ctx.save()
    // In the 3D pack the bug floats a little above its ground shadow.
    ctx.translate(b.x, bodyY)
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
    this.drawMutationSkin(b, bodyY, b.r)
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

  /** Floating speech bubble over player 1 during the Hive Mother reveal. */
  private drawRevealBubble() {
    const speaker = this.alivePlayers[0] ?? this.players[0]
    if (!speaker) return
    const ctx = this.ctx
    const text = BOSS_REVEAL_LINE
    ctx.save()
    ctx.font = 'bold 15px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const w = ctx.measureText(text).width + 28
    const h = 34
    const x = speaker.x
    const y = speaker.y - speaker.r - 44
    ctx.globalAlpha = Math.min(1, this.bubbleTimer * 2)
    ctx.fillStyle = 'rgba(8,12,20,0.88)'
    ctx.strokeStyle = '#fb923c'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 10)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 8, y + h / 2)
    ctx.lineTo(x + 8, y + h / 2)
    ctx.lineTo(x, y + h / 2 + 12)
    ctx.closePath()
    ctx.fillStyle = 'rgba(8,12,20,0.88)'
    ctx.fill()
    ctx.fillStyle = '#fde68a'
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  private drawPlayer(p: Player) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(p.x, this.textures === 'enhanced' ? p.y - UNIT_LIFT : p.y)
    if (p.down) ctx.globalAlpha = 0.4

    if (this.isCloaked(p)) {
      // Leaf cloud while Camouflage Blend is running.
      ctx.globalAlpha = 0.55
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + p.abilityActive * 1.6
        const d = p.r + 12 + Math.sin(p.abilityActive * 4 + i) * 5
        ctx.beginPath()
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 7, 4, a, 0, Math.PI * 2)
        ctx.fillStyle = i % 2 ? '#4ade80' : '#a3e635'
        ctx.fill()
      }
    }
    if (p.character.id === 'army-retiree' && p.abilityActive > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, p.r + 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,77,77,0.85)'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    const kick = p.recoil * 5
    ctx.save()
    ctx.rotate(p.angle)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(p.r - 4 - kick, -4, 22, 8)
    ctx.restore()

    drawCharacterSkin(ctx, p.character.id, p.r, p.angle, p.hurtCooldown > 0)
    this.drawPlayerHands(p, kick)

    if (this.players.length > 1) {
      ctx.fillStyle = p.id === 1 ? '#34d399' : '#60a5fa'
      ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(p.down ? `P${p.id} DOWN` : `P${p.id}`, 0, -p.r - 8)
      ctx.textAlign = 'left'
    }
    ctx.restore()
  }

  /**
   * Both fists gripping the weapon along the aim line, snapping backwards for
   * a moment after each shot. Drawn inside the player's translated frame.
   */
  private drawPlayerHands(p: Player, kick: number) {
    const ctx = this.ctx
    const grips: { fwd: number; side: number }[] = [
      { fwd: p.r + 12, side: -3 },
      { fwd: p.r + 1, side: 4 },
    ]
    ctx.save()
    ctx.rotate(p.angle)
    for (const g of grips) {
      const hx = g.fwd - kick
      ctx.beginPath()
      ctx.moveTo(p.r * 0.4, g.side * 1.6)
      ctx.lineTo(hx, g.side)
      ctx.strokeStyle = 'rgba(15,23,42,0.7)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(hx, g.side, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#e8b98a'
      ctx.fill()
      ctx.strokeStyle = '#7c4a21'
      ctx.lineWidth = 1.5
      ctx.stroke()
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
      this.applyWorldTransform()
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
      // Camo stalkers stay off the radar until they break cover.
      if (e.kind === 'camo' && !e.revealed) continue
      ctx.fillStyle = e.kind === 'bug' ? '#ffa41b' : e.kind === 'runner' ? '#ff1e1e' : '#d62828'
      ctx.beginPath()
      ctx.arc(mx + e.x * s, my + e.y * s, e.kind === 'zombie' ? 2.5 : 2, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.boss) {
      ctx.fillStyle = '#f0871b'
      ctx.beginPath()
      ctx.arc(mx + this.boss.x * s, my + this.boss.y * s, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff1a8'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.fillStyle = '#a78bfa'
    for (const t of this.turrets) {
      ctx.beginPath()
      ctx.arc(mx + t.x * s, my + t.y * s, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#7c5c2b'
    for (const b of this.barricades) {
      ctx.fillRect(mx + b.x * s, my + b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s))
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
