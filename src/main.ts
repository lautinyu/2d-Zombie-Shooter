import './style.css'
import { Game } from './game'
import type { GameState, Hud } from './game'
import { MISSIONS, missionMapName, missionUnlocked, pathComplete, pathMissions } from './missions'
import type { Mission, PathId } from './missions'
import { RadarChart } from './radar'
import { WEAPONS, weaponById } from './weapons'
import type { Weapon, WeaponId } from './weapons'
import { loadProfile, missionReward, saveProfile } from './profile'
import { CHARACTERS, characterById } from './characters'
import type { CharacterId } from './characters'
import { TEXTURE_PACKS } from './theme'
import type { TexturePack } from './theme'
import { playMusic, resumeAudio, stopMusic } from './audio'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app container missing')

app.innerHTML = `
  <canvas id="scene" class="absolute inset-0 block cursor-none"></canvas>

  <!-- HUD -->
  <div id="hud" class="pointer-events-none absolute inset-0 hidden select-none text-white">
    <div class="absolute left-5 top-5 w-80 space-y-3">
      <div id="player-panels" class="space-y-2"></div>

      <div class="rounded-lg bg-black/60 p-3 ring-1 ring-white/10">
        <div id="mission-name" class="text-sm font-bold text-white">Mission</div>
        <div class="mt-0.5 flex items-center justify-between text-xs text-slate-300">
          <span id="mission-zone">Map</span>
          <span id="kill-text" class="font-mono">0/0</span>
        </div>
        <div class="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div id="mission-bar" class="h-full w-0 rounded-full bg-red-500 transition-[width] duration-200"></div>
        </div>
        <div id="objective-text" class="mt-2 text-xs text-slate-400"></div>
        <div id="survivor-panel" class="mt-3 hidden border-t border-white/10 pt-2">
          <div class="text-xs font-semibold uppercase tracking-wider text-slate-200">Survivors</div>
          <div id="survivor-list" class="mt-1.5 space-y-1.5"></div>
        </div>
      </div>

      <div class="rounded-lg bg-black/60 p-3 ring-1 ring-white/10">
        <div class="flex items-center justify-between">
          <span id="hud-weapon" class="text-sm font-bold text-white">Rusty Pistol</span>
          <span id="hud-scrap" class="font-mono text-xs font-bold text-yellow-300">+0 scrap</span>
        </div>
        <div id="hud-perk" class="mt-0.5 text-xs font-semibold text-sky-300"></div>
      </div>
    </div>

    <div class="absolute left-1/2 top-5 -translate-x-1/2 rounded-md bg-black/50 px-3 py-1 text-xs uppercase tracking-widest text-slate-300">
      <span id="current-zone">The Streets</span>
    </div>

    <div id="boss-bar" class="absolute left-1/2 top-16 hidden w-[min(760px,80vw)] -translate-x-1/2">
      <div class="flex items-baseline justify-between text-xs font-black uppercase tracking-widest">
        <span id="boss-name" class="text-orange-300">The Hive Mother</span>
        <span id="boss-phase" class="text-slate-300"></span>
      </div>
      <div class="mt-1 h-5 w-full overflow-hidden rounded-md bg-black/70 ring-2 ring-orange-500/60">
        <div id="boss-fill" class="h-full w-full bg-gradient-to-r from-orange-500 to-red-600"></div>
      </div>
    </div>

    <div id="hud-controls" class="absolute left-5 bottom-5 rounded-md bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
      WASD / Arrows to move · Mouse to aim · Left click to shoot · R to reload
    </div>
  </div>

  <!-- Intro splash -->
  <div id="intro" class="absolute inset-0 z-30 hidden items-center justify-center bg-slate-950 p-6">
    <div class="w-full max-w-3xl text-center">
      <h1 class="text-5xl font-black tracking-tight text-emerald-400 drop-shadow">ZOMBIE SHOOTER</h1>
      <p class="mt-3 text-sm text-slate-400">Pick a texture pack. Physics, movement and combat are identical &mdash; only the art changes.</p>
      <div id="intro-packs" class="mt-8 grid gap-4 md:grid-cols-2"></div>
      <p class="mt-6 text-xs text-slate-500">You can switch packs any time from the main menu.</p>
    </div>
  </div>

  <!-- Main menu -->
  <div id="menu" class="absolute inset-0 flex items-center justify-center overflow-y-auto bg-slate-950/95 p-6">
    <div class="w-full max-w-4xl">
      <h1 class="text-center text-5xl font-black tracking-tight text-emerald-400 drop-shadow">ZOMBIE SHOOTER</h1>
      <p class="mt-2 text-center text-sm text-slate-400">Top-down survival · pick a mission, clear the zone, get out alive.</p>
      <div class="mt-4 text-center text-sm font-bold text-yellow-300">Scrap: <span id="menu-scrap">0</span></div>
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <button id="lore-btn" class="rounded-lg bg-orange-500/15 px-6 py-2 text-sm font-bold text-orange-300 ring-1 ring-orange-400/40 hover:bg-orange-500/25">Lore / Story</button>
        <button id="shop-btn" class="rounded-lg bg-yellow-500/15 px-6 py-2 text-sm font-bold text-yellow-300 ring-1 ring-yellow-400/40 hover:bg-yellow-500/25">Weapons Shop</button>
        <button id="locker-btn" class="rounded-lg bg-sky-500/15 px-6 py-2 text-sm font-bold text-sky-300 ring-1 ring-sky-400/40 hover:bg-sky-500/25">Locker</button>
        <button id="textures-btn" class="rounded-lg bg-violet-500/15 px-6 py-2 text-sm font-bold text-violet-300 ring-1 ring-violet-400/40 hover:bg-violet-500/25">Texture Pack</button>
      </div>
      <div class="mt-4 flex items-center justify-center gap-2 text-xs">
        <span class="font-semibold uppercase tracking-wider text-slate-400">Players</span>
        <button id="players-1" class="rounded-lg px-4 py-1.5 font-bold">1 Player</button>
        <button id="players-2" class="rounded-lg px-4 py-1.5 font-bold">2 Players</button>
      </div>
      <div class="mt-3 text-center text-xs text-slate-400">
        Equipped: <span id="menu-equipped" class="font-semibold text-emerald-300">Rusty Pistol</span>
        · Survivor: <span id="menu-character" class="font-semibold text-amber-300">—</span>
        <button id="character-btn" class="ml-2 rounded bg-white/10 px-2 py-0.5 font-semibold text-white hover:bg-white/20">Change</button>
      </div>
      <div id="campaign" class="mt-6 space-y-4"></div>
      <div class="mt-8 rounded-lg bg-white/5 p-4 text-xs text-slate-400 ring-1 ring-white/10">
        <span class="font-semibold text-slate-200">Controls:</span>
        WASD or Arrow keys to move · aim with the mouse · left click to shoot (keep running while you fire) · R to reload ·
        <span class="font-mono text-slate-200">E</span> for your character's active ability (Engineer also drops a barricade with <span class="font-mono text-slate-200">Q</span>).
        Each mission loads its own isolated map. Yellow crates restock ammo.
        <span class="font-semibold text-orange-300">Orange Plague Bugs</span> are fast and sting — five stings and you turn.
        <div class="mt-2"><span class="font-semibold text-slate-200">Co-op:</span> Player 2 moves with the Arrow keys, auto-aims at the nearest enemy and fires on its own or with the <span class="font-mono text-slate-200">.</span> key. Their ability is <span class="font-mono text-slate-200">M</span> (barricade <span class="font-mono text-slate-200">,</span>).</div>
      </div>
    </div>
  </div>

  <!-- Lore -->
  <div id="lore" class="absolute inset-0 z-10 hidden items-center justify-center bg-slate-950/95 p-6">
    <div class="w-full max-w-2xl rounded-2xl bg-white/5 p-8 ring-1 ring-orange-400/30">
      <h2 class="text-3xl font-black tracking-tight text-orange-400">THE STORY</h2>
      <p class="mt-5 text-lg leading-relaxed text-slate-200">A mysterious plague has wiped out humanity. The virus doesn't spread by bites&mdash;it spreads from the skies. A mutated species of giant flying bugs carries the infection. Getting stung too many times injects enough venom to kill you and instantly turn you into a zombie.</p>
      <p class="mt-4 text-sm text-slate-400">Plague Bugs are small orange fliers, 1.5x faster than a zombie. Five stings is lethal &mdash; shoot them first.</p>
      <button id="lore-close" class="mt-8 rounded-lg bg-orange-500 px-8 py-3 text-lg font-bold text-orange-950 hover:bg-orange-400">Back to Menu</button>
    </div>
  </div>

  <!-- Character select -->
  <div id="characters" class="absolute inset-0 z-20 hidden items-center justify-center overflow-y-auto bg-slate-950/98 p-6">
    <div class="w-full max-w-4xl">
      <h2 class="text-center text-4xl font-black tracking-tight text-emerald-400">CHOOSE YOUR SURVIVOR</h2>
      <p class="mt-2 text-center text-sm text-slate-400">Each survivor carries a passive that changes how the wasteland treats you.</p>
      <div id="character-slots" class="mt-4 hidden justify-center gap-2 text-xs">
        <button id="slot-1" class="rounded-lg px-4 py-1.5 font-bold">Player 1</button>
        <button id="slot-2" class="rounded-lg px-4 py-1.5 font-bold">Player 2</button>
      </div>
      <div id="character-list" class="mt-8 grid gap-4 md:grid-cols-2"></div>
      <div class="mt-6 text-center">
        <button id="characters-close" class="hidden rounded-lg bg-white/10 px-8 py-3 text-sm font-bold text-white hover:bg-white/20">Back to Menu</button>
      </div>
    </div>
  </div>

  <!-- Shop / Locker -->
  <div id="arsenal" class="absolute inset-0 z-10 hidden items-center justify-center bg-slate-950/97 p-6">
    <div class="w-full max-w-5xl">
      <div class="flex items-baseline justify-between">
        <h2 id="arsenal-title" class="text-3xl font-black tracking-tight text-yellow-400">WEAPONS SHOP</h2>
        <div class="text-sm font-bold text-yellow-300">Scrap: <span id="arsenal-scrap">0</span></div>
      </div>
      <div class="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div id="weapon-list" class="space-y-2"></div>
        <div class="rounded-xl bg-white/5 p-5 ring-1 ring-white/10">
          <div id="detail-name" class="text-xl font-bold text-white">Rusty Pistol</div>
          <p id="detail-desc" class="mt-1 text-xs text-slate-400"></p>
          <div class="mt-4 flex justify-center">
            <canvas id="radar" class="block"></canvas>
          </div>
          <div class="mt-4 rounded-lg bg-black/40 p-3">
            <div id="detail-perk" class="text-sm font-bold text-sky-300">No talent</div>
            <p id="detail-perk-desc" class="mt-1 text-xs text-slate-400"></p>
          </div>
          <button id="detail-action" class="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-400">Equip</button>
          <div id="detail-note" class="mt-2 h-4 text-center text-xs font-semibold text-red-400"></div>
        </div>
      </div>
      <button id="arsenal-close" class="mt-6 rounded-lg bg-white/10 px-8 py-3 text-sm font-bold text-white hover:bg-white/20">Back to Menu</button>
    </div>
  </div>

  <!-- Win -->
  <div id="win" class="absolute inset-0 hidden items-center justify-center bg-emerald-950/90 p-6">
    <div class="text-center">
      <h2 class="text-6xl font-black text-emerald-400">MISSION ACCOMPLISHED!</h2>
      <p id="win-sub" class="mt-3 text-slate-300"></p>
      <p id="win-reward" class="mt-2 text-lg font-bold text-yellow-300"></p>
      <button id="win-btn" class="mt-8 rounded-lg bg-emerald-500 px-8 py-3 text-lg font-bold text-emerald-950 hover:bg-emerald-400">
        Return to Main Menu
      </button>
    </div>
  </div>

  <!-- Lose -->
  <div id="lose" class="absolute inset-0 hidden items-center justify-center bg-red-950/90 p-6">
    <div class="text-center">
      <h2 id="lose-title" class="text-6xl font-black text-red-500">GAME OVER</h2>
      <p id="lose-tagline" class="mt-4 hidden text-2xl font-bold"></p>
      <p id="lose-sub" class="mt-3 text-slate-300"></p>
      <p id="lose-reward" class="mt-2 text-lg font-bold text-yellow-300"></p>
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
const loreScreen = el('lore')
const arsenalScreen = el('arsenal')
const characterScreen = el('characters')
const introScreen = el('intro')

const game = new Game(canvas)
const profile = loadProfile()
const radar = new RadarChart(el<HTMLCanvasElement>('radar'), 280)

const campaignEl = el('campaign')

let currentMission: Mission = MISSIONS[0]

function unlocked(m: Mission) {
  return missionUnlocked(m, profile.completed, profile.path)
}

function missionCard(m: Mission): HTMLElement {
  const done = profile.completed.includes(m.id)
  const open = unlocked(m)
  const card = document.createElement('button')
  card.disabled = !open
  card.className = `group w-full rounded-xl p-4 text-left ring-1 transition ${
    done
      ? 'bg-emerald-500/10 ring-emerald-400/40'
      : open
        ? 'bg-white/5 ring-white/10 hover:bg-emerald-500/10 hover:ring-emerald-400/60'
        : 'cursor-not-allowed bg-black/40 opacity-50 ring-white/5'
  }`
  const badge =
    m.type === 'protect'
      ? `<span class="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">Protect ${m.survivors}</span>`
      : m.type === 'boss'
        ? '<span class="rounded-md bg-orange-500/20 px-2 py-0.5 text-[11px] font-semibold text-orange-300">Boss · 2 phases</span>'
        : `<span class="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">${m.target} kills</span>`
  card.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">${missionMapName(m)}</span>
      ${done ? '<span class="text-[11px] font-bold text-emerald-300">CLEARED</span>' : open ? '' : '<span class="text-[11px] font-bold text-slate-400">LOCKED</span>'}
    </div>
    <div class="mt-1 text-lg font-bold text-white">${m.name}</div>
    <p class="mt-1 text-xs text-slate-400">${m.description}</p>
    <div class="mt-3 flex items-center gap-2">
      ${badge}
      <span class="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-300">${missionReward(m)} scrap</span>
    </div>
  `
  if (open) card.addEventListener('click', () => launch(m))
  return card
}

function branchColumn(path: PathId, title: string, blurb: string): HTMLElement {
  const col = document.createElement('div')
  const committed = profile.path === path
  const finished = pathComplete(path, profile.completed)
  const lockedOut = profile.path !== null && !committed && !pathComplete(profile.path, profile.completed)
  col.className = `rounded-2xl p-4 ring-1 ${
    committed ? 'bg-emerald-500/5 ring-emerald-400/40' : 'bg-white/5 ring-white/10'
  }`
  const status = finished
    ? '<span class="text-[11px] font-bold text-emerald-300">PATH COMPLETE</span>'
    : committed
      ? '<span class="text-[11px] font-bold text-emerald-300">COMMITTED</span>'
      : lockedOut
        ? '<span class="text-[11px] font-bold text-amber-300">LOCKED OUT</span>'
        : ''
  col.innerHTML = `
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-black uppercase tracking-wider text-white">${title}</h3>
      ${status}
    </div>
    <p class="mt-1 text-xs text-slate-400">${blurb}</p>
  `
  const list = document.createElement('div')
  list.className = 'mt-3 space-y-3'
  for (const m of pathMissions(path)) list.appendChild(missionCard(m))
  col.appendChild(list)
  return col
}

function renderCampaign() {
  campaignEl.innerHTML = ''

  const intro = document.createElement('div')
  intro.className = 'grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start'
  const prologue = document.createElement('div')
  prologue.className = 'rounded-2xl bg-white/5 p-4 ring-1 ring-white/10'
  prologue.innerHTML =
    '<h3 class="text-sm font-black uppercase tracking-wider text-white">Prologue</h3><p class="mt-1 text-xs text-slate-400">Clear this to open both branches.</p>'
  const first = document.createElement('div')
  first.className = 'mt-3'
  first.appendChild(missionCard(MISSIONS[0]))
  prologue.appendChild(first)

  const note = document.createElement('div')
  note.className = 'rounded-2xl bg-black/30 p-4 text-xs text-slate-400 ring-1 ring-white/10'
  note.innerHTML = `
    <span class="font-semibold text-slate-200">Campaign paths:</span>
    picking a mission on one branch commits you to it — the other branch stays locked until your
    branch is finished. Branch missions run on their own dedicated maps and pay 40–80% more scrap.
    ${profile.path ? `<div class="mt-2 font-semibold text-emerald-300">Current branch: ${profile.path === 'combat' ? 'Combat Focus' : 'Rescue Focus'}${pathComplete(profile.path, profile.completed) ? ' (complete — both branches open)' : ''}</div>` : ''}
  `
  intro.appendChild(prologue)
  intro.appendChild(note)
  campaignEl.appendChild(intro)

  const branches = document.createElement('div')
  branches.className = 'grid gap-4 md:grid-cols-2'
  branches.appendChild(
    branchColumn('combat', 'Path A · Combat Focus', 'Hunt the horde and break the infected hive.')
  )
  branches.appendChild(
    branchColumn('rescue', 'Path B · Rescue Focus', 'Escort survivors out alive — one death fails the run.')
  )
  campaignEl.appendChild(branches)

  const finale = MISSIONS.find((m) => m.requiresAllPaths)
  if (finale) {
    const wrap = document.createElement('div')
    wrap.className = `rounded-2xl p-4 ring-1 ${
      unlocked(finale) ? 'bg-orange-500/5 ring-orange-400/40' : 'bg-white/5 ring-white/10'
    }`
    wrap.innerHTML =
      '<h3 class="text-sm font-black uppercase tracking-wider text-orange-300">Finale · Boss Fight</h3><p class="mt-1 text-xs text-slate-400">Clear both branches to face the Mutated Alpha Bug that started the plague.</p>'
    const holder = document.createElement('div')
    holder.className = 'mt-3'
    holder.appendChild(missionCard(finale))
    wrap.appendChild(holder)
    campaignEl.appendChild(wrap)
  }
}

const introPacks = el('intro-packs')

function renderIntro() {
  introPacks.innerHTML = ''
  for (const pack of TEXTURE_PACKS) {
    const chosen = profile.textures === pack.id
    const card = document.createElement('button')
    card.className = `rounded-2xl p-6 text-left ring-1 transition ${
      chosen ? 'bg-emerald-500/10 ring-emerald-400/70' : 'bg-white/5 ring-white/10 hover:bg-white/10'
    }`
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xl font-bold text-white">${pack.name}</span>
        ${chosen ? '<span class="text-xs font-bold text-emerald-300">CURRENT</span>' : ''}
      </div>
      <p class="mt-2 text-sm text-slate-400">${pack.blurb}</p>
      <canvas width="320" height="140" class="mt-4 w-full rounded-lg bg-black/40" data-preview="${pack.id}"></canvas>
    `
    card.addEventListener('click', () => {
      resumeAudio()
      setTextures(pack.id)
      show(introScreen, false)
      if (profile.character) show(menu, true)
      else show(characterScreen, true)
      playMusic('menu')
    })
    introPacks.appendChild(card)
    const preview = card.querySelector('canvas')
    if (preview) drawPackPreview(preview, pack.id)
  }
}

/** Tiny side-by-side sample of how the world is drawn in each pack. */
function drawPackPreview(canvasEl: HTMLCanvasElement, pack: TexturePack) {
  const ctx = canvasEl.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#23262a'
  ctx.fillRect(0, 0, 320, 140)

  if (pack === 'enhanced') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(60, 40, 90, 60)
    ctx.fillStyle = '#8b5a2b'
    ctx.beginPath()
    ctx.moveTo(60, 100)
    ctx.lineTo(150, 100)
    ctx.lineTo(166, 116)
    ctx.lineTo(70, 116)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#a5703a'
    ctx.fillRect(70, 34, 96, 66)
    ctx.fillStyle = 'rgba(255,212,121,0.5)'
    ctx.fillRect(84, 48, 20, 22)
    ctx.fillRect(120, 48, 20, 22)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(240, 96, 20, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    const grad = ctx.createRadialGradient(232, 74, 4, 240, 84, 20)
    grad.addColorStop(0, '#7ef7a5')
    grad.addColorStop(1, '#12894a')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(240, 84, 20, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#8b5a2b'
    ctx.fillRect(60, 40, 96, 66)
    ctx.strokeStyle = '#5c3a1c'
    ctx.lineWidth = 3
    ctx.strokeRect(60, 40, 96, 66)
    ctx.fillStyle = '#3ddc84'
    ctx.beginPath()
    ctx.arc(240, 84, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
  }
}

function setTextures(pack: TexturePack) {
  profile.textures = pack
  game.textures = pack
  persist()
}

el('textures-btn').addEventListener('click', () => {
  renderIntro()
  show(menu, false)
  show(introScreen, true)
})

function launch(m: Mission) {
  currentMission = m
  if (m.path && profile.path === null) {
    profile.path = m.path
    persist()
  }
  const roster = [characterById(activeCharacter())]
  if (profile.players === 2) roster.push(characterById(secondCharacter()))
  game.startMission(m, weaponById(profile.equipped), roster)
}

function activeCharacter(): CharacterId {
  return profile.character ?? CHARACTERS[0].id
}

/** Player 2 defaults to a different survivor than player 1. */
function secondCharacter(): CharacterId {
  if (profile.character2 && profile.character2 !== activeCharacter()) return profile.character2
  const other = CHARACTERS.find((c) => c.id !== activeCharacter())
  return other ? other.id : CHARACTERS[0].id
}

const characterList = el('character-list')
const characterSlots = el('character-slots')
let editingSlot: 1 | 2 = 1

function slotButtonClass(active: boolean) {
  return `rounded-lg px-4 py-1.5 font-bold ${
    active ? 'bg-emerald-500 text-emerald-950' : 'bg-white/10 text-slate-300 hover:bg-white/20'
  }`
}

function renderCharacters() {
  characterSlots.classList.toggle('hidden', profile.players !== 2)
  characterSlots.classList.toggle('flex', profile.players === 2)
  if (profile.players === 1) editingSlot = 1
  el('slot-1').className = slotButtonClass(editingSlot === 1)
  el('slot-2').className = slotButtonClass(editingSlot === 2)

  const selectedId = editingSlot === 1 ? profile.character : secondCharacter()
  characterList.innerHTML = ''
  for (const c of CHARACTERS) {
    const chosen = selectedId === c.id
    const card = document.createElement('button')
    card.className = `rounded-xl p-6 text-left ring-1 transition ${
      chosen ? 'bg-emerald-500/10 ring-emerald-400/70' : 'bg-white/5 ring-white/10 hover:bg-white/10'
    }`
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="inline-block h-4 w-4 rounded-full" style="background:${c.color}"></span>
        <span class="text-xl font-bold text-white">${c.name}</span>
        ${chosen ? '<span class="ml-auto text-xs font-bold text-emerald-300">SELECTED</span>' : ''}
      </div>
      <p class="mt-2 text-sm italic text-slate-400">${c.tagline}</p>
      <div class="mt-4 rounded-lg bg-black/40 p-3">
        <div class="text-sm font-bold text-sky-300">Passive: ${c.perkName}</div>
        <p class="mt-1 text-xs text-slate-400">${c.perkDescription}</p>
      </div>
      <div class="mt-2 rounded-lg bg-black/40 p-3">
        <div class="text-sm font-bold text-violet-300">Active [E / M]: ${c.ability.name}</div>
        <p class="mt-1 text-xs text-slate-400">${c.ability.description}</p>
      </div>
    `
    card.addEventListener('click', () => {
      if (editingSlot === 1) profile.character = c.id
      else profile.character2 = c.id
      persist()
      if (profile.players === 2 && editingSlot === 1) {
        editingSlot = 2
        renderCharacters()
        return
      }
      renderCharacters()
      show(characterScreen, false)
      show(menu, true)
    })
    characterList.appendChild(card)
  }
  el<HTMLButtonElement>('characters-close').classList.toggle('hidden', profile.character === null)
}

el('slot-1').addEventListener('click', () => {
  editingSlot = 1
  renderCharacters()
})
el('slot-2').addEventListener('click', () => {
  editingSlot = 2
  renderCharacters()
})

function renderPlayerToggle() {
  el('players-1').className = slotButtonClass(profile.players === 1)
  el('players-2').className = slotButtonClass(profile.players === 2)
}

function setPlayers(count: 1 | 2) {
  profile.players = count
  if (count === 2 && !profile.character2) profile.character2 = secondCharacter()
  persist()
  renderCharacters()
}

el('players-1').addEventListener('click', () => setPlayers(1))
el('players-2').addEventListener('click', () => setPlayers(2))

el('character-btn').addEventListener('click', () => {
  renderCharacters()
  show(menu, false)
  show(characterScreen, true)
})
el('characters-close').addEventListener('click', () => {
  show(characterScreen, false)
  show(menu, true)
})

type ArsenalMode = 'shop' | 'locker'
let arsenalMode: ArsenalMode = 'shop'
let selectedWeapon: Weapon = weaponById(profile.equipped)

const weaponListEl = el('weapon-list')
const detailAction = el<HTMLButtonElement>('detail-action')
const detailNote = el('detail-note')

function owns(id: WeaponId) {
  return profile.owned.includes(id)
}

function persist() {
  saveProfile(profile)
  el('menu-scrap').textContent = `${profile.scrap}`
  el('arsenal-scrap').textContent = `${profile.scrap}`
  el('menu-equipped').textContent = weaponById(profile.equipped).name
  el('menu-character').textContent = profile.character
    ? profile.players === 2
      ? `${characterById(profile.character).name} + ${characterById(secondCharacter()).name}`
      : characterById(profile.character).name
    : 'not chosen'
  renderPlayerToggle()
  renderCampaign()
}

function openArsenal(mode: ArsenalMode) {
  arsenalMode = mode
  el('arsenal-title').textContent = mode === 'shop' ? 'WEAPONS SHOP' : 'EQUIPMENT LOCKER'
  el('arsenal-title').className = `text-3xl font-black tracking-tight ${
    mode === 'shop' ? 'text-yellow-400' : 'text-sky-400'
  }`
  const available = mode === 'shop' ? WEAPONS : WEAPONS.filter((w) => owns(w.id))
  selectedWeapon = available.includes(selectedWeapon) ? selectedWeapon : available[0]
  show(menu, false)
  show(arsenalScreen, true)
  renderArsenal()
}

function renderArsenal() {
  const available = arsenalMode === 'shop' ? WEAPONS : WEAPONS.filter((w) => owns(w.id))
  weaponListEl.innerHTML = ''
  for (const w of available) {
    const owned = owns(w.id)
    const equipped = profile.equipped === w.id
    const active = selectedWeapon.id === w.id
    const row = document.createElement('button')
    row.className = `flex w-full items-center justify-between rounded-xl px-4 py-3 text-left ring-1 transition ${
      active ? 'bg-white/10 ring-emerald-400/70' : 'bg-white/5 ring-white/10 hover:bg-white/10'
    }`
    const status = equipped
      ? '<span class="text-xs font-bold text-emerald-300">EQUIPPED</span>'
      : owned
        ? '<span class="text-xs font-bold text-sky-300">OWNED</span>'
        : `<span class="text-xs font-bold text-yellow-300">${w.price} scrap</span>`
    row.innerHTML = `
      <span class="flex items-center gap-3">
        <span class="inline-block h-3 w-3 rounded-full" style="background:${w.color}"></span>
        <span>
          <span class="block text-sm font-bold text-white">${w.name}</span>
          <span class="block text-xs text-slate-400">${w.perk === 'none' ? 'No talent' : w.perkName}</span>
        </span>
      </span>
      ${status}
    `
    row.addEventListener('click', () => {
      selectedWeapon = w
      renderArsenal()
    })
    weaponListEl.appendChild(row)
  }
  renderDetail()
}

function renderDetail() {
  const w = selectedWeapon
  el('detail-name').textContent = w.name
  el('detail-desc').textContent = w.description
  el('detail-perk').textContent = w.perk === 'none' ? 'No talent' : `Talent: ${w.perkName}`
  el('detail-perk-desc').textContent = w.perkDescription
  radar.setStats(w.radar, w.color)
  detailNote.textContent = ''

  const owned = owns(w.id)
  const equipped = profile.equipped === w.id
  if (equipped) {
    detailAction.textContent = 'Equipped'
    detailAction.disabled = true
    detailAction.className =
      'mt-4 w-full cursor-default rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-slate-300'
  } else if (owned) {
    detailAction.textContent = 'Equip'
    detailAction.disabled = false
    detailAction.className =
      'mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-400'
  } else {
    detailAction.textContent = `Buy — ${w.price} scrap`
    detailAction.disabled = false
    const affordable = profile.scrap >= w.price
    detailAction.className = `mt-4 w-full rounded-lg px-4 py-3 text-sm font-bold ${
      affordable
        ? 'bg-yellow-400 text-yellow-950 hover:bg-yellow-300'
        : 'bg-yellow-500/20 text-yellow-200/70'
    }`
  }
}

detailAction.addEventListener('click', () => {
  const w = selectedWeapon
  if (owns(w.id)) {
    profile.equipped = w.id
  } else if (profile.scrap >= w.price) {
    profile.scrap -= w.price
    profile.owned.push(w.id)
    profile.equipped = w.id
  } else {
    detailNote.textContent = `Need ${w.price - profile.scrap} more scrap.`
    return
  }
  persist()
  renderArsenal()
})

el('shop-btn').addEventListener('click', () => openArsenal('shop'))
el('locker-btn').addEventListener('click', () => openArsenal('locker'))
el('arsenal-close').addEventListener('click', () => {
  show(arsenalScreen, false)
  show(menu, true)
})

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
  if (state !== 'menu') {
    show(loreScreen, false)
    show(arsenalScreen, false)
    show(characterScreen, false)
  }
  canvas.classList.toggle('cursor-none', state === 'playing')
  if (state === 'menu') playMusic('menu')
  if (state === 'won') playMusic('victory')
  if (state === 'lost') playMusic('gameover')
  if (state === 'won') {
    if (!profile.completed.includes(currentMission.id)) profile.completed.push(currentMission.id)
  }
  if (state === 'won' || state === 'lost') {
    const bonus = state === 'won' ? missionReward(currentMission) : 0
    const total = game.scrapEarned + bonus
    profile.scrap += total
    persist()
    const rewardText =
      state === 'won'
        ? `+${total} scrap earned (${game.scrapEarned} from kills, ${bonus} mission bonus)`
        : `+${total} scrap salvaged from kills`
    el(state === 'won' ? 'win-reward' : 'lose-reward').textContent = rewardText
  }
  if (state === 'won') {
    const where = missionMapName(currentMission)
    el('win-sub').textContent =
      currentMission.type === 'boss'
        ? `${currentMission.name} complete — the Mutated Alpha Bug is dead. The hive falls silent.`
        : currentMission.type === 'protect'
        ? `${currentMission.name} complete — all ${currentMission.survivors} survivors extracted from ${where}.`
        : `${currentMission.name} complete — ${currentMission.target} zombies cleared in ${where}.`
    const nexts = currentMission.unlocks.filter((id) => !profile.completed.includes(id))
    el('win-reward').textContent += nexts.length ? ` · New missions unlocked` : ''
  }
  if (state === 'lost') {
    const infected = game.deathCause === 'infection'
    const lostSurvivor = game.deathCause === 'survivor'
    const title = el('lose-title')
    const tagline = el('lose-tagline')
    title.textContent = infected
      ? 'INFECTION OVERWHELM!'
      : lostSurvivor
        ? 'SURVIVOR LOST'
        : 'GAME OVER'
    title.className = `text-6xl font-black ${infected ? 'animate-pulse text-orange-400' : 'text-red-500'}`
    tagline.classList.toggle('hidden', !infected)
    tagline.className = `mt-4 text-2xl font-bold text-orange-300 ${infected ? 'animate-pulse' : 'hidden'}`
    tagline.textContent = infected ? 'You have turned into a zombie.' : ''
    loseScreen.className = `absolute inset-0 flex items-center justify-center p-6 ${
      infected ? 'bg-orange-950/90' : 'bg-red-950/90'
    }`
    const where = missionMapName(currentMission)
    el('lose-sub').textContent = infected
      ? `The venom took hold in ${where} after 5 stings.`
      : lostSurvivor
        ? `A survivor died in ${where}. The escort is over.`
        : `You fell in ${where} with ${game.kills} zombies cleared.`
  }
}

const playerPanels = el('player-panels')
const hudControls = el('hud-controls')
const missionBar = el('mission-bar')
const missionName = el('mission-name')
const missionZone = el('mission-zone')
const killText = el('kill-text')
const objectiveText = el('objective-text')
const survivorPanel = el('survivor-panel')
const survivorList = el('survivor-list')
const currentZone = el('current-zone')
const bossBar = el('boss-bar')
const bossName = el('boss-name')
const bossPhase = el('boss-phase')
const bossFill = el('boss-fill')
const hudWeapon = el('hud-weapon')
const hudPerk = el('hud-perk')
const hudScrap = el('hud-scrap')

function playerPanel(): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'rounded-lg bg-black/60 p-3 ring-1 ring-white/10'
  panel.innerHTML = `
    <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
      <span class="flex items-center gap-2">
        <span class="inline-block h-2.5 w-2.5 rounded-full" data-role="dot"></span>
        <span data-role="name"></span>
        <span class="font-normal normal-case text-slate-400" data-role="character"></span>
      </span>
      <span data-role="hp" class="text-emerald-300"></span>
    </div>
    <div class="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-white/10">
      <div data-role="hp-bar" class="h-full w-full rounded-full bg-emerald-500"></div>
    </div>
    <div class="mt-2 flex items-baseline justify-between">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Ammo</span>
      <span data-role="ammo" class="font-mono text-base font-bold text-amber-200"></span>
    </div>
    <div data-role="reload" class="hidden text-[11px] font-semibold text-amber-400">RELOADING…</div>
    <div data-role="lives" class="hidden text-[11px] font-semibold text-sky-300"></div>
    <div class="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-orange-300">
      <span>Infection</span><span data-role="stings"></span>
    </div>
    <div data-role="pips" class="mt-1 flex gap-1.5"></div>
    <div data-role="ability" class="mt-2 rounded-md bg-white/5 px-2 py-1.5">
      <div class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
        <span data-role="ability-name" class="text-violet-300"></span>
        <span data-role="ability-state" class="font-mono text-slate-300"></span>
      </div>
      <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div data-role="ability-bar" class="h-full w-full rounded-full bg-violet-400"></div>
      </div>
    </div>
  `
  return panel
}

function pick(root: HTMLElement, role: string): HTMLElement {
  const node = root.querySelector<HTMLElement>(`[data-role="${role}"]`)
  if (!node) throw new Error(`missing hud role ${role}`)
  return node
}

function updatePlayerPanels(h: Hud) {
  if (playerPanels.children.length !== h.players.length) {
    playerPanels.innerHTML = ''
    for (const _ of h.players) playerPanels.appendChild(playerPanel())
  }
  h.players.forEach((p, i) => {
    const panel = playerPanels.children[i] as HTMLElement
    const pct = (p.hp / p.maxHp) * 100
    pick(panel, 'dot').style.background = p.color
    pick(panel, 'name').textContent = h.players.length > 1 ? p.name : 'Health'
    pick(panel, 'character').textContent = p.characterName
    pick(panel, 'hp').textContent = p.down ? 'DOWN' : `${p.hp} / ${p.maxHp}`
    const bar = pick(panel, 'hp-bar')
    bar.style.width = `${pct}%`
    bar.className = `h-full rounded-full transition-[width] duration-150 ${
      pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
    }`
    pick(panel, 'ammo').textContent = `${p.mag} / ${p.reserve}`
    pick(panel, 'reload').classList.toggle('hidden', !p.reloading)
    const lives = pick(panel, 'lives')
    lives.classList.toggle('hidden', p.lives <= 0)
    lives.textContent = `Extra lives: ${p.lives}`
    const stings = pick(panel, 'stings')
    stings.textContent = `Stings: ${p.stings}/${h.maxStings}`
    stings.className = `text-[11px] font-semibold ${
      p.stings >= h.maxStings - 1 ? 'animate-pulse text-red-400' : 'text-orange-300'
    }`
    const pips = pick(panel, 'pips')
    if (pips.children.length !== h.maxStings) {
      pips.innerHTML = ''
      for (let s = 0; s < h.maxStings; s++) pips.appendChild(document.createElement('div'))
    }
    Array.from(pips.children).forEach((pip, idx) => {
      pip.className = `h-2 flex-1 rounded-full ${idx < p.stings ? 'bg-orange-400' : 'bg-white/10'}`
    })
    const ab = p.ability
    const ready = ab.cooldown <= 0 && ab.charges !== 0
    pick(panel, 'ability-name').textContent = `${ab.name} [${ab.key}]`
    const extras: string[] = []
    if (ab.charges >= 0) extras.push(`${ab.charges} left`)
    if (ab.barricades > 0) extras.push(`barricade [${p.id === 1 ? 'Q' : ','}]`)
    const suffix = extras.length ? ` · ${extras.join(' · ')}` : ''
    pick(panel, 'ability-state').textContent = ab.active > 0
      ? `ACTIVE ${ab.active.toFixed(1)}s${suffix}`
      : ab.charges === 0
        ? `SPENT${suffix}`
        : ab.cooldown > 0
          ? `${ab.cooldown.toFixed(1)}s${suffix}`
          : `READY${suffix}`
    const abBar = pick(panel, 'ability-bar')
    const charge = ab.active > 0 ? 1 : ab.cooldownTotal ? 1 - ab.cooldown / ab.cooldownTotal : 1
    abBar.style.width = `${Math.max(0, Math.min(1, charge)) * 100}%`
    abBar.className = `h-full rounded-full ${
      ab.active > 0 ? 'bg-emerald-400' : ready ? 'bg-violet-400' : 'bg-slate-500'
    }`

    panel.className = `rounded-lg bg-black/60 p-3 ring-1 ${
      p.down ? 'opacity-60 ring-red-500/50' : 'ring-white/10'
    }`
  })

  hudControls.innerHTML =
    h.players.length > 1
      ? 'P1: WASD · mouse aim · left click to shoot · R reload · E ability · Q barricade<br>P2: Arrow keys · auto-aim · fires automatically or with . · M ability · , barricade'
      : 'WASD / Arrows to move · Mouse to aim · Left click to shoot · R to reload · E ability · Q barricade'
}

game.onHud = (h: Hud) => {
  updatePlayerPanels(h)
  missionName.textContent = h.missionName
  missionZone.textContent = h.mapName
  objectiveText.textContent = h.objective
  currentZone.textContent = h.mapName

  bossBar.classList.toggle('hidden', !h.boss)
  if (h.boss) {
    const pct = (h.boss.hp / h.boss.maxHp) * 100
    bossName.textContent = `${h.boss.name} · Mutated Alpha Bug`
    bossPhase.textContent = `Phase ${h.boss.phase}${h.boss.phase === 2 ? ' · ENRAGED' : ''} — ${h.boss.hp}/${h.boss.maxHp}`
    bossFill.style.width = `${pct}%`
    bossFill.className = `h-full ${
      h.boss.phase === 2 ? 'bg-gradient-to-r from-red-500 to-rose-700 animate-pulse' : 'bg-gradient-to-r from-orange-500 to-red-600'
    }`
  }

  if (h.isProtect) {
    const total = h.survivors.length
    killText.textContent = `Extracted: ${h.extracted}/${total}`
    missionBar.style.width = `${total ? (h.extracted / total) * 100 : 0}%`
  } else {
    killText.textContent = h.boss
      ? `Hive Mother: ${Math.round((h.boss.hp / h.boss.maxHp) * 100)}%`
      : `Zombies Cleared: ${h.kills}/${h.target}`
    missionBar.style.width = h.boss
      ? `${100 - (h.boss.hp / h.boss.maxHp) * 100}%`
      : `${h.target ? (h.kills / h.target) * 100 : 0}%`
  }

  survivorPanel.classList.toggle('hidden', !h.isProtect)
  if (h.isProtect) {
    if (survivorList.children.length !== h.survivors.length) {
      survivorList.innerHTML = ''
      for (let i = 0; i < h.survivors.length; i++) {
        const row = document.createElement('div')
        row.innerHTML =
          '<div class="flex items-center justify-between text-[11px] text-slate-300"><span></span><span></span></div><div class="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div class="h-full w-full rounded-full bg-emerald-500"></div></div>'
        survivorList.appendChild(row)
      }
    }
    h.survivors.forEach((s, i) => {
      const row = survivorList.children[i]
      const labels = row.querySelectorAll('span')
      labels[0].textContent = `Survivor ${i + 1}`
      const pct = (s.hp / s.maxHp) * 100
      labels[1].textContent = s.safe
        ? 'SAFE'
        : `${Math.round(pct)}%${s.moving ? '' : ' · WAITING'}`
      const fill = row.querySelectorAll<HTMLElement>('div')[2]
      fill.style.width = `${pct}%`
      fill.className = `h-full rounded-full ${
        s.safe ? 'bg-sky-400' : pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
      }`
    })
  }

  hudWeapon.textContent = h.weaponName
  hudPerk.textContent = h.perkName ? `Talent: ${h.perkName}` : 'No talent'
  hudScrap.textContent = `+${h.scrap} scrap`
}

el('lore-btn').addEventListener('click', () => {
  show(menu, false)
  show(loreScreen, true)
})
el('lore-close').addEventListener('click', () => {
  show(loreScreen, false)
  show(menu, true)
})

el('win-btn').addEventListener('click', () => game.toMenu())
el('lose-menu-btn').addEventListener('click', () => game.toMenu())
el('retry-btn').addEventListener('click', () => launch(currentMission))

// Autoplay policies: the audio engine only builds its context after a gesture.
window.addEventListener('pointerdown', resumeAudio)
window.addEventListener('keydown', resumeAudio)

persist()
renderDetail()
renderCharacters()
renderIntro()
game.textures = profile.textures ?? 'classic'
game.onStateChange('menu')
stopMusic()
if (!profile.textures) {
  show(menu, false)
  show(introScreen, true)
} else if (!profile.character) {
  show(menu, false)
  show(characterScreen, true)
}
