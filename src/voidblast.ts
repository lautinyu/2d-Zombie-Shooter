/**
 * VOID BLAST — a second standalone arcade cabinet: a Space Invaders style rail
 * shooter that runs as an overlay with its own canvas, loop, input and high
 * score, fully isolated from the campaign.
 */

const STORE_KEY = 'void-blast-highscore-v1'

const VIEW_W = 480
const VIEW_H = 720

const SHIP_W = 40
const SHIP_H = 26
const SHIP_Y = VIEW_H - 54
const SHIP_SPEED = 340

const LASER_SPEED = 720
const LASER_INTERVAL = 0.22
const ALIEN_SHOT_SPEED = 260

const COLS = 8
const ROWS = 4
const ALIEN_W = 34
const ALIEN_H = 24
const GRID_GAP_X = 14
const GRID_GAP_Y = 20
const GRID_TOP = 90
/** Horizontal speed of the formation on wave 1; each wave adds to it. */
const BASE_DRIFT = 34
const DESCEND_STEP = 18
/** Aliens are a breach the moment they touch the player's rail. */
const RAIL_Y = SHIP_Y - SHIP_H
const MAX_HITS = 3

type Phase = 'attract' | 'playing' | 'over'

interface Alien {
  col: number
  row: number
  x: number
  y: number
  alive: boolean
  flash: number
}

interface Shot {
  x: number
  y: number
  vy: number
  hostile: boolean
}

interface Blast {
  x: number
  y: number
  life: number
}

export interface VoidBlastCabinet {
  open: () => void
  close: () => void
  isOpen: () => boolean
}

function readHighScore(): number {
  const raw = window.localStorage.getItem(STORE_KEY)
  const value = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function mountVoidBlast(onQuit: () => void): VoidBlastCabinet {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-40 hidden flex-col items-center justify-center bg-black/98 p-4'
  overlay.innerHTML = `
    <div class="flex w-full max-w-[520px] items-center justify-between pb-2">
      <div class="text-xs font-black uppercase tracking-[0.35em] text-fuchsia-400">Void Blast</div>
      <button id="voidblast-quit" class="rounded-lg bg-fuchsia-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-fuchsia-200 ring-1 ring-fuchsia-400/60 hover:bg-fuchsia-500/35">Quit to Main Menu</button>
    </div>
  `

  const frame = document.createElement('div')
  frame.className =
    'rounded-2xl bg-slate-950 p-3 ring-2 ring-fuchsia-500/50 shadow-[0_0_60px_rgba(217,70,239,0.35)]'
  const canvas = document.createElement('canvas')
  canvas.width = VIEW_W
  canvas.height = VIEW_H
  canvas.className = 'block h-[min(78vh,720px)] w-auto rounded-lg bg-black'
  frame.appendChild(canvas)
  overlay.appendChild(frame)

  const legend = document.createElement('div')
  legend.className = 'pt-3 text-center text-[11px] uppercase tracking-[0.25em] text-slate-500'
  legend.textContent = 'A / D or ← → move rail · Space fires · Enter inserts coin'
  overlay.appendChild(legend)

  document.body.appendChild(overlay)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('void blast canvas context unavailable')

  let open = false
  let phase: Phase = 'attract'
  let raf = 0
  let last = 0
  let blink = 0

  let shipX = VIEW_W / 2
  let hits = 0
  let score = 0
  let wave = 1
  let highScore = readHighScore()
  let fireTimer = 0
  let overTimer = 0
  let shake = 0
  let drift = BASE_DRIFT
  let dir = 1
  let alienFireTimer = 1

  const held = new Set<string>()

  let aliens: Alien[] = []
  let shots: Shot[] = []
  let blasts: Blast[] = []

  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * VIEW_W,
    y: Math.random() * VIEW_H,
    speed: 12 + Math.random() * 60,
  }))

  const buildWave = () => {
    const gridW = COLS * ALIEN_W + (COLS - 1) * GRID_GAP_X
    const startX = (VIEW_W - gridW) / 2 + ALIEN_W / 2
    aliens = []
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        aliens.push({
          col,
          row,
          x: startX + col * (ALIEN_W + GRID_GAP_X),
          y: GRID_TOP + row * (ALIEN_H + GRID_GAP_Y),
          alive: true,
          flash: 0,
        })
      }
    }
    dir = 1
    drift = BASE_DRIFT + (wave - 1) * 12
    alienFireTimer = 1
  }

  const reset = () => {
    shipX = VIEW_W / 2
    hits = 0
    score = 0
    wave = 1
    fireTimer = 0
    overTimer = 0
    shake = 0
    shots = []
    blasts = []
    buildWave()
  }

  const gameOver = () => {
    phase = 'over'
    overTimer = 0
    shake = 0.6
    blasts.push({ x: shipX, y: SHIP_Y, life: 0.7 })
    if (Math.floor(score) > highScore) {
      highScore = Math.floor(score)
      window.localStorage.setItem(STORE_KEY, `${highScore}`)
    }
  }

  const hitPlayer = () => {
    hits += 1
    shake = Math.max(shake, 0.35)
    if (hits >= MAX_HITS) gameOver()
  }

  const update = (dt: number) => {
    blink += dt
    shake = Math.max(0, shake - dt)
    for (const s of stars) {
      s.y += s.speed * dt
      if (s.y > VIEW_H) {
        s.y = -2
        s.x = Math.random() * VIEW_W
      }
    }

    if (phase === 'over') {
      overTimer += dt
      for (const b of blasts) b.life -= dt
      blasts = blasts.filter((b) => b.life > 0)
      return
    }
    if (phase !== 'playing') return

    const left = held.has('a') || held.has('arrowleft')
    const right = held.has('d') || held.has('arrowright')
    if (left !== right) shipX += (right ? 1 : -1) * SHIP_SPEED * dt
    shipX = Math.max(SHIP_W / 2 + 6, Math.min(VIEW_W - SHIP_W / 2 - 6, shipX))

    fireTimer = Math.max(0, fireTimer - dt)
    if (held.has(' ') && fireTimer === 0) {
      shots.push({ x: shipX, y: SHIP_Y - SHIP_H, vy: -LASER_SPEED, hostile: false })
      fireTimer = LASER_INTERVAL
    }

    // The formation marches sideways and drops a step at each wall, speeding up
    // as its ranks thin out.
    const living = aliens.filter((a) => a.alive)
    const pace = drift * (1 + (1 - living.length / aliens.length) * 1.8)
    let bounce = false
    for (const a of living) {
      a.x += dir * pace * dt
      a.flash = Math.max(0, a.flash - dt)
      if (a.x < ALIEN_W / 2 + 8 || a.x > VIEW_W - ALIEN_W / 2 - 8) bounce = true
    }
    if (bounce) {
      dir *= -1
      for (const a of living) a.y += DESCEND_STEP
    }

    alienFireTimer -= dt
    if (alienFireTimer <= 0 && living.length > 0) {
      alienFireTimer = Math.max(0.24, 1.1 - wave * 0.08)
      const shooter = living[Math.floor(Math.random() * living.length)]
      shots.push({ x: shooter.x, y: shooter.y + ALIEN_H / 2, vy: ALIEN_SHOT_SPEED, hostile: true })
    }

    for (const s of shots) s.y += s.vy * dt

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]
      if (s.hostile) {
        if (Math.abs(s.x - shipX) < SHIP_W / 2 && Math.abs(s.y - SHIP_Y) < SHIP_H) {
          shots.splice(i, 1)
          blasts.push({ x: s.x, y: s.y, life: 0.25 })
          hitPlayer()
          continue
        }
      } else {
        let struck = false
        for (const a of living) {
          if (!a.alive) continue
          if (Math.abs(a.x - s.x) > ALIEN_W / 2 || Math.abs(a.y - s.y) > ALIEN_H / 2) continue
          a.alive = false
          a.flash = 0.1
          blasts.push({ x: a.x, y: a.y, life: 0.3 })
          score += (ROWS - a.row) * 25 * wave
          struck = true
          break
        }
        if (struck) {
          shots.splice(i, 1)
          continue
        }
      }
      if (s.y < -20 || s.y > VIEW_H + 20) shots.splice(i, 1)
    }

    if (living.some((a) => a.alive && a.y + ALIEN_H / 2 >= RAIL_Y)) {
      gameOver()
      return
    }

    if (!aliens.some((a) => a.alive)) {
      wave += 1
      score += 500 * wave
      buildWave()
    }

    for (const b of blasts) b.life -= dt
    blasts = blasts.filter((b) => b.life > 0)
  }

  const drawShip = () => {
    if (phase === 'over') return
    ctx.save()
    ctx.translate(shipX, SHIP_Y)
    ctx.fillStyle = '#22d3ee'
    ctx.fillRect(-SHIP_W / 2, -4, SHIP_W, 12)
    ctx.fillRect(-10, -SHIP_H, 20, 16)
    ctx.fillStyle = '#a5f3fc'
    ctx.fillRect(-4, -SHIP_H - 6, 8, 8)
    ctx.fillStyle = '#0e7490'
    ctx.fillRect(-SHIP_W / 2, 8, 10, 6)
    ctx.fillRect(SHIP_W / 2 - 10, 8, 10, 6)
    ctx.fillStyle = 'rgba(250,204,21,0.75)'
    const flame = 5 + Math.sin(blink * 42) * 3
    ctx.fillRect(-6, 14, 12, flame)
    ctx.restore()
  }

  const drawAlien = (a: Alien) => {
    ctx.save()
    ctx.translate(a.x, a.y)
    const tint = a.row === 0 ? '#f472b6' : a.row === 1 ? '#c084fc' : a.row === 2 ? '#818cf8' : '#4ade80'
    ctx.fillStyle = tint
    const wobble = Math.floor(blink * 4) % 2 === 0 ? 0 : 3
    ctx.fillRect(-ALIEN_W / 2 + 4, -ALIEN_H / 2, ALIEN_W - 8, ALIEN_H - 8)
    ctx.fillRect(-ALIEN_W / 2, -ALIEN_H / 2 + 6, ALIEN_W, 8)
    ctx.fillRect(-ALIEN_W / 2, ALIEN_H / 2 - 8, 8, 8 - wobble)
    ctx.fillRect(ALIEN_W / 2 - 8, ALIEN_H / 2 - 8, 8, 8 - wobble)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(-8, -ALIEN_H / 2 + 5, 5, 5)
    ctx.fillRect(3, -ALIEN_H / 2 + 5, 5, 5)
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
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0abfc'
    ctx.fillText(`SCORE ${Math.floor(score)}`, 12, 26)
    ctx.fillStyle = '#fcd34d'
    ctx.fillText(`WAVE ${wave}`, 12, 46)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#7dd3fc'
    ctx.fillText(`HIGH SCORE ${highScore}`, VIEW_W - 12, 26)
    ctx.fillStyle = '#f87171'
    ctx.fillText(`SHIELDS ${'█'.repeat(Math.max(0, MAX_HITS - hits))}`, VIEW_W - 12, 46)
    ctx.restore()
  }

  const render = () => {
    ctx.fillStyle = '#04030a'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    ctx.save()
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14)

    ctx.fillStyle = 'rgba(226,232,240,0.55)'
    for (const s of stars) ctx.fillRect(s.x, s.y, 2, 2)

    ctx.fillStyle = 'rgba(217,70,239,0.55)'
    ctx.fillRect(0, RAIL_Y + 6, VIEW_W, 2)

    for (const a of aliens) if (a.alive) drawAlien(a)

    for (const s of shots) {
      ctx.fillStyle = s.hostile ? '#f472b6' : '#22d3ee'
      ctx.fillRect(s.x - 2, s.y - 9, 4, 18)
    }

    drawShip()

    for (const b of blasts) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, b.life * 1.8)
      ctx.fillStyle = '#fde68a'
      const r = (0.7 - b.life) * 60 + 10
      ctx.fillRect(b.x - r / 2, b.y - r / 2, r, r)
      ctx.restore()
    }
    ctx.restore()

    drawHud()

    if (phase === 'attract') {
      ctx.fillStyle = 'rgba(0,0,0,0.74)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('VOID', VIEW_H / 2 - 150, 58, '#e879f9')
      retroText('BLAST', VIEW_H / 2 - 92, 58, '#22d3ee')
      retroText('INSERT COIN', VIEW_H / 2 + 10, 30, '#fcd34d', true)
      retroText('PRESS START  [ENTER / SPACE]', VIEW_H / 2 + 60, 16, '#e2e8f0', true)
      retroText(`HIGH SCORE  ${highScore}`, VIEW_H / 2 + 130, 18, '#7dd3fc')
      retroText('A / D MOVE  ·  SPACE FIRE', VIEW_H / 2 + 180, 14, '#94a3b8')
    }

    if (phase === 'over') {
      ctx.fillStyle = 'rgba(10,0,20,0.8)'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      retroText('GAME OVER', VIEW_H / 2 - 60, 52, '#e879f9', true)
      retroText(`SCORE  ${Math.floor(score)}`, VIEW_H / 2 + 10, 26, '#fcd34d')
      retroText(`HIGH SCORE  ${highScore}`, VIEW_H / 2 + 46, 20, '#7dd3fc')
      if (overTimer > 1.2) retroText('PRESS START TO PLAY AGAIN', VIEW_H / 2 + 120, 16, '#e2e8f0', true)
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
    if (phase !== 'playing' && (key === 'enter' || key === ' ')) {
      if (phase === 'attract' || overTimer > 1.2) start()
    }
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

  overlay.querySelector<HTMLButtonElement>('#voidblast-quit')?.addEventListener('click', () => close())
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
