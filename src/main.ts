import './style.css'
import { Game } from './game'
import type { GameState, Hud } from './game'
import { MISSIONS, missionZoneName } from './missions'
import type { Mission } from './missions'
import { RadarChart } from './radar'
import { WEAPONS, weaponById } from './weapons'
import type { Weapon, WeaponId } from './weapons'
import { loadProfile, missionReward, saveProfile } from './profile'

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

        <div class="mt-3 border-t border-white/10 pt-2">
          <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-orange-300">
            <span>Infection</span><span id="sting-text">Stings: 0/5</span>
          </div>
          <div id="sting-pips" class="mt-1.5 flex gap-1.5"></div>
        </div>
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

    <div class="absolute left-5 bottom-5 rounded-md bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
      WASD / Arrows to move · Mouse to aim · Left click to shoot · R to reload
    </div>
  </div>

  <!-- Main menu -->
  <div id="menu" class="absolute inset-0 flex items-center justify-center bg-slate-950/95 p-6">
    <div class="w-full max-w-3xl">
      <h1 class="text-center text-5xl font-black tracking-tight text-emerald-400 drop-shadow">ZOMBIE SHOOTER</h1>
      <p class="mt-2 text-center text-sm text-slate-400">Top-down survival · pick a mission, clear the zone, get out alive.</p>
      <div class="mt-4 text-center text-sm font-bold text-yellow-300">Scrap: <span id="menu-scrap">0</span></div>
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <button id="lore-btn" class="rounded-lg bg-orange-500/15 px-6 py-2 text-sm font-bold text-orange-300 ring-1 ring-orange-400/40 hover:bg-orange-500/25">Lore / Story</button>
        <button id="shop-btn" class="rounded-lg bg-yellow-500/15 px-6 py-2 text-sm font-bold text-yellow-300 ring-1 ring-yellow-400/40 hover:bg-yellow-500/25">Weapons Shop</button>
        <button id="locker-btn" class="rounded-lg bg-sky-500/15 px-6 py-2 text-sm font-bold text-sky-300 ring-1 ring-sky-400/40 hover:bg-sky-500/25">Locker</button>
      </div>
      <div class="mt-3 text-center text-xs text-slate-400">Equipped: <span id="menu-equipped" class="font-semibold text-emerald-300">Rusty Pistol</span></div>
      <div id="mission-list" class="mt-6 grid gap-4 sm:grid-cols-3"></div>
      <div class="mt-8 rounded-lg bg-white/5 p-4 text-xs text-slate-400 ring-1 ring-white/10">
        <span class="font-semibold text-slate-200">Controls:</span>
        WASD or Arrow keys to move · aim with the mouse · left click to shoot · R to reload.
        Kills only count inside the mission zone. Yellow crates restock ammo.
        <span class="font-semibold text-orange-300">Orange Plague Bugs</span> are fast and sting — five stings and you turn.
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

const game = new Game(canvas)
const profile = loadProfile()
const radar = new RadarChart(el<HTMLCanvasElement>('radar'), 280)

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
  game.startMission(m, weaponById(profile.equipped))
}

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
  }
  canvas.classList.toggle('cursor-none', state === 'playing')
  if (state === 'won' || state === 'lost') {
    const bonus = state === 'won' ? missionReward(currentMission.target) : 0
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
    el('win-sub').textContent = `${currentMission.name} complete — ${currentMission.target} zombies cleared in ${missionZoneName(currentMission)}.`
  }
  if (state === 'lost') {
    const infected = game.deathCause === 'infection'
    const title = el('lose-title')
    const tagline = el('lose-tagline')
    title.textContent = infected ? 'INFECTION OVERWHELM!' : 'GAME OVER'
    title.className = `text-6xl font-black ${infected ? 'animate-pulse text-orange-400' : 'text-red-500'}`
    tagline.classList.toggle('hidden', !infected)
    tagline.className = `mt-4 text-2xl font-bold text-orange-300 ${infected ? 'animate-pulse' : 'hidden'}`
    tagline.textContent = infected ? 'You have turned into a zombie.' : ''
    loseScreen.className = `absolute inset-0 flex items-center justify-center p-6 ${
      infected ? 'bg-orange-950/90' : 'bg-red-950/90'
    }`
    el('lose-sub').textContent = infected
      ? `The venom took hold in ${missionZoneName(currentMission)} after 5 stings — ${game.kills} / ${currentMission.target} cleared.`
      : `You fell in ${missionZoneName(currentMission)} with ${game.kills} / ${currentMission.target} zombies cleared.`
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
const stingText = el('sting-text')
const stingPips = el('sting-pips')
const hudWeapon = el('hud-weapon')
const hudPerk = el('hud-perk')
const hudScrap = el('hud-scrap')

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

  stingText.textContent = `Stings: ${h.stings}/${h.maxStings}`
  stingText.className = `text-xs font-semibold ${h.stings >= h.maxStings - 1 ? 'animate-pulse text-red-400' : 'text-orange-300'}`
  if (stingPips.children.length !== h.maxStings) {
    stingPips.innerHTML = ''
    for (let i = 0; i < h.maxStings; i++) {
      const pip = document.createElement('div')
      stingPips.appendChild(pip)
    }
  }
  Array.from(stingPips.children).forEach((pip, i) => {
    pip.className = `h-2.5 flex-1 rounded-full ${i < h.stings ? 'bg-orange-400' : 'bg-white/10'}`
  })

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

persist()
renderDetail()
game.onStateChange('menu')
