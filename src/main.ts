import './style.css'
import { Game } from './game'
import type { GameState, Hud } from './game'
import { MISSIONS, missionZoneName } from './missions'
import type { Mission } from './missions'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app container missing')

app.innerHTML = `
  <canvas id="scene" class="absolute inset-0 block cursor-none"></canvas>

  <!-- HUD -->
  <div id="hud" class="pointer-events-none absolute inset-0 hidden select-none text-white">
    <div class="absolute left-5 top-5 w-80 space-y-3">
      <div class="rounded-lg bg-black/60 p-3 ring-1 ring-white/10">
        <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <span>Health</span><span id="hp-text">100 / 100</span>
        </div>
        <div class="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div id="hp-bar" class="h-full w-full rounded-full bg-emerald-500 transition-[width] duration-150"></div>
        </div>
        <div class="mt-3 flex items-baseline justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-amber-300">Ammo</span>
          <span id="ammo-text" class="font-mono text-lg font-bold text-amber-200">15 / 90</span>
        </div>
        <div id="reload-text" class="hidden text-xs font-semibold text-amber-400">RELOADING…</div>
      </div>

      <div class="rounded-lg bg-black/60 p-3 ring-1 ring-white/10">
        <div id="mission-name" class="text-sm font-bold text-white">Mission</div>
        <div class="mt-0.5 flex items-center justify-between text-xs text-slate-300">
          <span id="mission-zone">Zone</span>
          <span id="kill-text" class="font-mono">0/0</span>
        </div>
        <div class="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div id="mission-bar" class="h-full w-0 rounded-full bg-red-500 transition-[width] duration-200"></div>
        </div>
        <div id="zone-warning" class="mt-2 hidden text-xs font-semibold text-amber-400"></div>
      </div>
    </div>

    <div class="absolute left-1/2 top-5 -translate-x-1/2 rounded-md bg-black/50 px-3 py-1 text-xs uppercase tracking-widest text-slate-300">
      <span id="current-zone">The Streets</span>
    </div>

    <div class="absolute left-5 bottom-5 rounded-md bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
      WASD / Arrows to move · Mouse to aim · Left click to shoot · R to reload
    </div>
  </div>

  <!-- Main menu -->
  <div id="menu" class="absolute inset-0 flex items-center justify-center bg-slate-950/95 p-6">
    <div class="w-full max-w-3xl">
      <h1 class="text-center text-5xl font-black tracking-tight text-emerald-400 drop-shadow">ZOMBIE SHOOTER</h1>
      <p class="mt-2 text-center text-sm text-slate-400">Top-down survival · pick a mission, clear the zone, get out alive.</p>
      <div id="mission-list" class="mt-8 grid gap-4 sm:grid-cols-3"></div>
      <div class="mt-8 rounded-lg bg-white/5 p-4 text-xs text-slate-400 ring-1 ring-white/10">
        <span class="font-semibold text-slate-200">Controls:</span>
        WASD or Arrow keys to move · aim with the mouse · left click to shoot · R to reload.
        Kills only count inside the mission zone. Yellow crates restock ammo.
      </div>
    </div>
  </div>

  <!-- Win -->
  <div id="win" class="absolute inset-0 hidden items-center justify-center bg-emerald-950/90 p-6">
    <div class="text-center">
      <h2 class="text-6xl font-black text-emerald-400">MISSION ACCOMPLISHED!</h2>
      <p id="win-sub" class="mt-3 text-slate-300"></p>
      <button id="win-btn" class="mt-8 rounded-lg bg-emerald-500 px-8 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400">
        Return to Main Menu
      </button>
    </div>
  </div>

  <!-- Lose -->
  <div id="lose" class="absolute inset-0 hidden items-center justify-center bg-red-950/90 p-6">
    <div class="text-center">
      <h2 class="text-6xl font-black text-red-500">GAME OVER</h2>
      <p id="lose-sub" class="mt-3 text-slate-300"></p>
      <div class="mt-8 flex items-center justify-center gap-4">
        <button id="retry-btn" class="rounded-lg bg-red-500 px-8 py-3 text-lg font-bold text-white hover:bg-red-400">Try Again</button>
        <button id="lose-menu-btn" class="rounded-lg bg-white/10 px-8 py-3 text-lg font-bold text-white hover:bg-white/20">Main Menu</button>
      </div>
    </div>
  </div>
`

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw new Error(`missing element #${id}`)
  return node as T
}

const canvas = el<HTMLCanvasElement>('scene')
const hud = el('hud')
const menu = el('menu')
const winScreen = el('win')
const loseScreen = el('lose')

const game = new Game(canvas)

const missionList = el('mission-list')
for (const m of MISSIONS) {
  const card = document.createElement('button')
  card.className =
    'group rounded-xl bg-white/5 p-5 text-left ring-1 ring-white/10 transition hover:bg-emerald-500/10 hover:ring-emerald-400/60'
  card.innerHTML = `
    <div class="text-xs font-semibold uppercase tracking-wider text-emerald-400">${missionZoneName(m)}</div>
    <div class="mt-1 text-xl font-bold text-white">${m.name}</div>
    <p class="mt-2 text-sm text-slate-400">${m.description}</p>
    <div class="mt-4 inline-block rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">Target: ${m.target} zombies</div>
    <div class="mt-4 text-sm font-bold text-emerald-400 opacity-0 transition group-hover:opacity-100">Accept mission →</div>
  `
  card.addEventListener('click', () => launch(m))
  missionList.appendChild(card)
}

let currentMission: Mission = MISSIONS[0]

function launch(m: Mission) {
  currentMission = m
  game.startMission(m)
}

function show(node: HTMLElement, visible: boolean, display: 'flex' | 'block' = 'flex') {
  node.classList.toggle('hidden', !visible)
  if (visible) node.classList.add(display)
  else node.classList.remove(display)
}

game.onStateChange = (state: GameState) => {
  show(hud, state === 'playing', 'block')
  show(menu, state === 'menu')
  show(winScreen, state === 'won')
  show(loseScreen, state === 'lost')
  canvas.classList.toggle('cursor-none', state === 'playing')
  if (state === 'won') {
    el('win-sub').textContent = `${currentMission.name} complete — ${currentMission.target} zombies cleared in ${missionZoneName(currentMission)}.`
  }
  if (state === 'lost') {
    el('lose-sub').textContent = `You fell in ${missionZoneName(currentMission)} with ${game.kills} / ${currentMission.target} zombies cleared.`
  }
}

const hpBar = el('hp-bar')
const hpText = el('hp-text')
const ammoText = el('ammo-text')
const reloadText = el('reload-text')
const missionBar = el('mission-bar')
const missionName = el('mission-name')
const missionZone = el('mission-zone')
const killText = el('kill-text')
const zoneWarning = el('zone-warning')
const currentZone = el('current-zone')

game.onHud = (h: Hud) => {
  const hpPct = (h.hp / h.maxHp) * 100
  hpBar.style.width = `${hpPct}%`
  hpBar.className = `h-full rounded-full transition-[width] duration-150 ${
    hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
  }`
  hpText.textContent = `${h.hp} / ${h.maxHp}`
  ammoText.textContent = `${h.mag} / ${h.reserve}`
  reloadText.classList.toggle('hidden', !h.reloading)
  missionName.textContent = h.missionName
  missionZone.textContent = h.zoneName
  killText.textContent = `Zombies Cleared: ${h.kills}/${h.target}`
  missionBar.style.width = `${h.target ? (h.kills / h.target) * 100 : 0}%`
  currentZone.textContent = h.currentZoneName
  zoneWarning.classList.toggle('hidden', h.inMissionZone)
  zoneWarning.textContent = h.inMissionZone ? '' : `Head to ${h.zoneName} — kills outside it don't count.`
}

el('win-btn').addEventListener('click', () => game.toMenu())
el('lose-menu-btn').addEventListener('click', () => game.toMenu())
el('retry-btn').addEventListener('click', () => launch(currentMission))

game.onStateChange('menu')
