/**
 * CRIMSON HIGHWAY — a standalone retro arcade cabinet that runs as an overlay
 * on top of the campaign. It owns its own canvas, loop, input and high score,
 * and never touches the zombie shooter's state.
 */

import { recordPlay } from './arcadeStats'

const STORE_KEY = 'crimson-highway-highscore-v1'

/** Logical resolution of the cabinet screen; the CSS box scales it to fit. */
const VIEW_W = 480
const VIEW_H = 720

const LANES = 4
const ROAD_MARGIN = 56
const LANE_W = (VIEW_W - ROAD_MARGIN * 2) / LANES

const CAR_W = 44
const CAR_H = 70
const CAR_Y = VIEW_H - 110
/** Lanes per second the car slides at. */
const LANE_SLIDE = 9

const LASER_SPEED = 780
const LASER_INTERVAL = 0.12
const ENEMY_SHOT_SPEED = 300

const SCROLL_SPEED = 460
const SPAWN_INTERVAL = 0.72
const MAX_HITS = 3
/** Score per second at 1x, before the survival multiplier climbs. */
const SCORE_RATE = 100
const MULTIPLIER_STEP = 1

type Phase = 'attract' | 'playing' | 'over'
type FoeKind = 'civilian' | 'biker' | 'barricade'

interface Foe {
  kind: FoeKind
  x: number
  y: number
  w: number
  h: number
  /** Downward speed relative to the road, on top of the scroll. */
  drift: number
  hp: number
  fireTimer: number
  flash: number
}

interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  hostile: boolean
}

interface Blast {
  x: number
  y: number
  life: number
}

export interface ArcadeCabinet {
  open: () => void
  close: () => void
  isOpen: () => boolean
}

function readHighScore(): number {
  const raw = window.localStorage.getItem(STORE_KEY)
  const value = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function laneCenter(lane: number): number {
  return ROAD_MARGIN + LANE_W * (lane + 0.5)
}

/**
 * Builds the cabinet overlay and wires its loop. Nothing runs until open() is
 * called, and close() tears the loop down so the campaign gets the frame back.
 */
export function mountArcade(onQuit: () => void): ArcadeCabinet {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-40 hidden flex-col items-center justify-center bg-black/98 p-4'
  overlay.innerHTML = `
    <div class="flex w-full max-w-[520px] items-center justify-between pb-2">
      <div class="text-xs font-black uppercase tracking-[0.35em] text-rose-400">Crimson Highway</div>
      <button id="arcade-quit" class="rounded-lg bg-rose-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-rose-200 ring-1 ring-rose-400/60 hover:bg-rose-500/35">Quit to Main Menu</button>
    </div>
  `

  const frame = document.createElement('div')
  frame.className = 'rounded-2xl bg-slate-950 p-3 ring-2 ring-rose-500/50 shadow-[0_0_60px_rgba(244,63,94,0.35)]'
  const canvas = document.createElement('canvas')
  canvas.width = VIEW_W
  canvas.height = VIEW_H
  canvas.className = 'block h-[min(78vh,720px)] w-auto rounded-lg bg-black'
  frame.appendChild(canvas)
  overlay.appendChild(frame)

  const legend = document.createElement('div')
  legend.className = 'pt-3 text-center text-[11px] uppercase tracking-[0.25em] text-slate-500'
  legend.textContent = 'A / D or ← → slide lanes · Space fires · Enter inserts coin'
  overlay.appendChild(legend)

  document.body.appendChild(overlay)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('arcade canvas context unavailable')

  let open = false
  let phase: Phase = 'attract'
  let raf = 0
  let last = 0
  let blink = 0

  let lane = 1
  let carX = laneCenter(lane)
  let hits = 0
  let score = 0
  let multiplier = 1
  let multiplierTimer = 0
  let highScore = readHighScore()
  let scroll = 0
  let spawnTimer = 0
  let fireTimer = 0
  let overTimer = 0
  let shake = 0

  let foes: Foe[] = []
  let shots: Shot[] = []
  let blasts: Blast[] = []

  const held = new Set<string>()

  const reset = () => {
    lane = 1
    carX = laneCenter(lane)
    hits = 0
    score = 0
    multiplier = 1
    multiplierTimer = 0
    scroll = 0
    spawnTimer = 0.4
    fireTimer = 0
    overTimer = 0
    shake = 0
    foes = []
    shots = []
    blasts = []
  }

  const gameOver = () => {
    phase = 'over'
    overTimer = 0
    shake = 0.6
    blasts.push({ x: carX, y: CAR_Y, life: 0.7 })
    if (Math.floor(score) > highScore) {
      highScore = Math.floor(score)
      window.localStorage.setItem(STORE_KEY, `${highScore}`)
    }
  }

  const spawnFoe = () => {
    const roll = Math.random()
    const kind: FoeKind = roll < 0.4 ? 'civilian' : roll < 0.75 ? 'biker' : 'barricade'
    const slot = Math.floor(Math.random() * LANES)
    const w = kind === 'barricade' ? LANE_W - 18 : kind === 'biker' ? 34 : 46
    const h = kind === 'barricade' ? 34 : kind === 'biker' ? 54 : 74
    foes.push({
      kind,
      x: laneCenter(slot),
      y: -h,
      w,
      h,
      // Civilians crawl, bikers close in, barricades are dead weight on the road.
      drift: kind === 'civilian' ? -140 : kind === 'biker' ? 90 : 0,
      hp: kind === 'barricade' ? 5 : kind === 'biker' ? 3 : 4,
      fireTimer: 1.1 + Math.random(),
      flash: 0,
    })
  }

  const fireLasers = () => {
    shots.push({ x: carX - 14, y: CAR_Y - CAR_H / 2, vx: 0, vy: -LASER_SPEED, hostile: false })
    shots.push({ x: carX + 14, y: CAR_Y - CAR_H / 2, vx: 0, vy: -LASER_SPEED, hostile: false })
  }

  const hitPlayer = () => {
    hits += 1
    shake = Math.max(shake, 0.35)
    if (hits >= MAX_HITS) gameOver()
  }

  const overlaps = (f: Foe, x: number, y: number, w: number, h: number) =>
    Math.abs(f.x - x) < (f.w + w) / 2 && Math.abs(f.y - y) < (f.h + h) / 2

  const update = (dt: number) => {
    blink += dt
    shake = Math.max(0, shake - dt)
    scroll = (scroll + SCROLL_SPEED * dt) % 80

    if (phase === 'over') {
      overTimer += dt
      for (const b of blasts) b.life -= dt
      blasts = blasts.filter((b) => b.life > 0)
      return
    }
    if (phase !== 'playing') return

    multiplierTimer += dt
    if (multiplierTimer >= 1) {
      multiplierTimer -= 1
      multiplier += MULTIPLIER_STEP
    }
    score += SCORE_RATE * multiplier * dt

    // Lane changes are edge-triggered in the key handler; here the car eases over.
    const targetX = laneCenter(lane)
    const slide = LANE_W * LANE_SLIDE * dt
    carX += Math.max(-slide, Math.min(slide, targetX - carX))

    fireTimer = Math.max(0, fireTimer - dt)
    if (held.has(' ') && fireTimer === 0) {
      fireLasers()
      fireTimer = LASER_INTERVAL
    }

    spawnTimer -= dt
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.26, SPAWN_INTERVAL - multiplier * 0.008)
      spawnFoe()
    }

    for (const f of foes) {
      f.y += (SCROLL_SPEED + f.drift) * dt
      f.flash = Math.max(0, f.flash - dt)
      if (f.kind !== 'biker') continue
      f.fireTimer -= dt
      if (f.fireTimer > 0 || f.y > CAR_Y) continue
      f.fireTimer = 1.5 + Math.random()
      // Bikers strafe the road with side shots that arc in on the car.
      const dir = carX >= f.x ? 1 : -1
      shots.push({
        x: f.x + dir * 18,
        y: f.y,
        vx: dir * ENEMY_SHOT_SPEED * 0.6,
        vy: ENEMY_SHOT_SPEED,
        hostile: true,
      })
    }

    for (const s of shots) {
      s.x += s.vx * dt
      s.y += s.vy * dt
    }

    // Lasers chew through traffic; blocks soak more rounds than riders.
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]
      if (s.hostile) continue
      for (let j = foes.length - 1; j >= 0; j--) {
        const f = foes[j]
        if (!overlaps(f, s.x, s.y, 4, 16)) continue
        f.hp -= 1
        f.flash = 0.1
        shots.splice(i, 1)
        if (f.hp <= 0) {
          blasts.push({ x: f.x, y: f.y, life: 0.35 })
          foes.splice(j, 1)
          score += 120 * multiplier
        }
        break
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]
      if (s.hostile && Math.abs(s.x - carX) < CAR_W / 2 && Math.abs(s.y - CAR_Y) < CAR_H / 2) {
        shots.splice(i, 1)
        blasts.push({ x: s.x, y: s.y, life: 0.25 })
        hitPlayer()
        continue
      }
      if (s.y < -30 || s.y > VIEW_H + 30 || s.x < -30 || s.x > VIEW_W + 30) shots.splice(i, 1)
    }

    for (let i = foes.length - 1; i >= 0; i--) {
      const f = foes[i]
      if (overlaps(f, carX, CAR_Y, CAR_W, CAR_H)) {
        // A crash is instant death, however much armour is left.
        blasts.push({ x: f.x, y: f.y, life: 0.6 })
        foes.splice(i, 1)
        gameOver()
        return
      }
      if (f.y > VIEW_H + 120) foes.splice(i, 1)
    }

    for (const b of blasts) b.life -= dt
    blasts = blasts.filter((b) => b.life > 0)
  }

  const drawRoad = () => {
    ctx.fillStyle = '#0b0709'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // Desert shoulders either side of the asphalt.
    ctx.fillStyle = '#3a2415'
    ctx.fillRect(0, 0, ROAD_MARGIN, VIEW_H)
    ctx.fillRect(VIEW_W - ROAD_MARGIN, 0, ROAD_MARGIN, VIEW_H)
    ctx.fillStyle = 'rgba(250,204,21,0.06)'
    for (let y = ((scroll * 0.6) % 60) - 60; y < VIEW_H; y += 60) {
      ctx.fillRect(10, y, 18, 26)
      ctx.fillRect(VIEW_W - 30, y + 22, 18, 26)
    }

    ctx.fillStyle = '#1b1b20'
    ctx.fillRect(ROAD_MARGIN, 0, VIEW_W - ROAD_MARGIN * 2, VIEW_H)

    ctx.fillStyle = '#f43f5e'
    ctx.fillRect(ROAD_MARGIN - 5, 0, 5, VIEW_H)
    ctx.fillRect(VIEW_W - ROAD_MARGIN, 0, 5, VIEW_H)

    ctx.fillStyle = 'rgba(226,232,240,0.5)'
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_MARGIN + LANE_W * l - 2
      for (let y = scroll - 80; y < VIEW_H; y += 80) ctx.fillRect(x, y, 4, 42)
    }
  }

  const drawCar = () => {
    if (phase === 'over') return
    ctx.save()
    ctx.translate(carX, CAR_Y)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(-CAR_W / 2 - 4, -CAR_H / 2 + 8, 8, 18)
    ctx.fillRect(CAR_W / 2 - 4, -CAR_H / 2 + 8, 8, 18)
    ctx.fillRect(-CAR_W / 2 - 4, CAR_H / 2 - 26, 8, 20)
    ctx.fillRect(CAR_W / 2 - 4, CAR_H / 2 - 26, 8, 20)
    ctx.fillStyle = '#e11d48'
    ctx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H)
    ctx.fillStyle = '#fb7185'
    ctx.fillRect(-CAR_W / 2 + 6, -CAR_H / 2 + 6, CAR_W - 12, 14)
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(-CAR_W / 2 + 8, -6, CAR_W - 16, 18)
    ctx.fillStyle = '#fde68a'
    ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 - 4, 10, 5)
    ctx.fillRect(CAR_W / 2 - 14, -CAR_H / 2 - 4, 10, 5)
    ctx.fillStyle = 'rgba(251,146,60,0.7)'
    const flame = 8 + Math.sin(blink * 40) * 4
    ctx.fillRect(-12, CAR_H / 2, 8, flame)
    ctx.fillRect(4, CAR_H / 2, 8, flame)
    ctx.restore()
  }

  const drawFoe = (f: Foe) => {
    ctx.save()
    ctx.translate(f.x, f.y)
    if (f.flash > 0) ctx.globalAlpha = 0.6
    if (f.kind === 'barricade') {
      ctx.fillStyle = '#a8a29e'
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      ctx.fillStyle = '#f97316'
      for (let i = 0; i < 4; i++) ctx.fillRect(-f.w / 2 + i * (f.w / 4), -f.h / 2, f.w / 8, f.h)
    } else if (f.kind === 'biker') {
      ctx.fillStyle = '#1f2937'
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      ctx.fillStyle = '#facc15'
      ctx.fillRect(-f.w / 2 + 6, -f.h / 2 + 10, f.w - 12, 12)
      ctx.fillStyle = '#f43f5e'
      ctx.fillRect(-f.w / 2 + 8, f.h / 2 - 20, f.w - 16, 12)
    } else {
      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      ctx.fillStyle = '#0ea5e9'
      ctx.fillRect(-f.w / 2 + 6, -f.h / 2 + 8, f.w - 12, 16)
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(-f.w / 2 + 6, f.h / 2 - 24, f.w - 12, 16)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(-f.w / 2 + 4, f.h / 2 - 6, 8, 5)
      ctx.fillRect(f.w / 2 - 12, f.h / 2 - 6, 8, 5)
    }
    ctx.restore()
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
    ctx.font = 'bold 16px ui-monospace, monospace'
    ctx.fillStyle = '#fda4af'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${Math.floor(score)}`, 12, 26)
    ctx.fillStyle = '#fcd34d'
    ctx.fillText(`x${multiplier}`, 12, 46)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#7dd3fc'
    ctx.fillText(`HIGH SCORE ${highScore}`, VIEW_W - 12, 26)
    ctx.fillStyle = '#f87171'
    ctx.fillText(`ARMOR ${'█'.repeat(Math.max(0, MAX_HITS - hits))}`, VIEW_W - 12, 46)
    ctx.restore()
  }

  const render = () => {
    ctx.save()
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14)
    drawRoad()

    for (const f of foes) drawFoe(f)

    for (const s of shots) {
      ctx.fillStyle = s.hostile ? '#facc15' : '#f43f5e'
      ctx.fillRect(s.x - 2, s.y - 10, 4, 20)
    }

    drawCar()

    for (const b of blasts) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, b.life * 1.6)
      ctx.fillStyle = '#fb923c'
      const r = (0.7 - b.life) * 70 + 10
      ctx.fillRect(b.x - r / 2, b.y - r / 2, r, r)
      ctx.restore()
    }
    ctx.restore()

    drawHud()

    if (phase === 'attract') {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('CRIMSON', VIEW_H / 2 - 150, 54, '#f43f5e')
      retroText('HIGHWAY', VIEW_H / 2 - 96, 54, '#fb7185')
      retroText('INSERT COIN', VIEW_H / 2 + 10, 30, '#fcd34d', true)
      retroText('PRESS START  [ENTER / SPACE]', VIEW_H / 2 + 60, 16, '#e2e8f0', true)
      retroText(`HIGH SCORE  ${highScore}`, VIEW_H / 2 + 130, 18, '#7dd3fc')
      retroText('A / D SLIDE  ·  SPACE FIRE', VIEW_H / 2 + 180, 14, '#94a3b8')
    }

    if (phase === 'over') {
      ctx.fillStyle = 'rgba(20,0,6,0.78)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('GAME OVER', VIEW_H / 2 - 60, 52, '#f43f5e', true)
      retroText(`SCORE  ${Math.floor(score)}`, VIEW_H / 2 + 10, 26, '#fcd34d')
      retroText(`HIGH SCORE  ${highScore}`, VIEW_H / 2 + 46, 20, '#7dd3fc')
      if (overTimer > 1.2) retroText('PRESS START TO RACE AGAIN', VIEW_H / 2 + 120, 16, '#e2e8f0', true)
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
    recordPlay('crimson-highway')
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    const key = e.key.toLowerCase()
    // The cabinet swallows its own controls so the campaign never sees them.
    e.stopPropagation()
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) e.preventDefault()
    held.add(key)

    if (key === 'escape') {
      close()
      return
    }
    if (phase !== 'playing') {
      if (key === 'enter' || key === ' ') {
        if (phase === 'attract' || overTimer > 1.2) start()
      }
      return
    }
    if (key === 'a' || key === 'arrowleft') lane = Math.max(0, lane - 1)
    if (key === 'd' || key === 'arrowright') lane = Math.min(LANES - 1, lane + 1)
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (!open) return
    e.stopPropagation()
    held.delete(e.key.toLowerCase())
  }

  function close() {
    if (!open) return
    open = false
    window.cancelAnimationFrame(raf)
    held.clear()
    overlay.classList.add('hidden')
    overlay.classList.remove('flex')
    onQuit()
  }

  overlay.querySelector<HTMLButtonElement>('#arcade-quit')?.addEventListener('click', () => close())
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)

  return {
    open: () => {
      if (open) return
      open = true
      highScore = readHighScore()
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
