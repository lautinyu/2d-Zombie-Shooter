import { characterById } from './characters'
import type { CharacterId } from './characters'
import { drawCharacterSkin } from './skins'
import { playMusic, playSfx, resumeAudio, stopMusic } from './audio'

/** Story crawl shown once the player commits to a run. */
const STORY_LINES = [
  'The year is 2026.',
  'A hyper-aggressive plague has wiped out human civilization.',
  'The air belongs to a mutated species of giant flying bugs carrying the infection.',
  'One sting means certain mutation into a flesh-eating zombie.',
  'You are among the last remnants of humanity...',
]

const STORY_DURATION = 22000

interface Line {
  speaker: string
  text: string
  side: 'left' | 'right'
}

const TYPE_SPEED = 18

function build(): { story: HTMLElement; dialogue: HTMLElement } {
  const host = document.querySelector('#app')
  if (!host) throw new Error('#app container missing')

  const story = document.createElement('div')
  story.id = 'story'
  story.className = 'absolute inset-0 z-40 hidden overflow-hidden bg-black'
  story.innerHTML = `
    <div class="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black"></div>
    <div id="story-viewport" class="absolute inset-0 flex justify-center overflow-hidden">
      <div id="story-crawl" class="max-w-2xl px-8 text-center">
        <h2 class="mb-10 text-4xl font-black tracking-[0.3em] text-orange-500">2 0 2 6</h2>
        ${STORY_LINES.map(
          (l) => `<p class="mb-8 text-2xl leading-relaxed text-slate-200">${l}</p>`
        ).join('')}
        <p class="mt-12 text-sm uppercase tracking-[0.4em] text-emerald-400">Pick up your rifle.</p>
      </div>
    </div>
    <button id="story-skip" class="absolute right-6 top-6 rounded-lg bg-white/10 px-5 py-2 text-sm font-bold text-white ring-1 ring-white/20 hover:bg-white/20">Skip &raquo;</button>
  `
  host.appendChild(story)

  const dialogue = document.createElement('div')
  dialogue.id = 'cutscene'
  dialogue.className =
    'absolute inset-0 z-40 hidden cursor-pointer flex-col justify-end bg-slate-950/95 p-8'
  dialogue.innerHTML = `
    <div class="pointer-events-none absolute inset-x-0 top-16 flex items-end justify-center gap-12">
      <div class="text-center">
        <canvas id="cutscene-portrait" width="140" height="140" class="rounded-2xl bg-black/50 ring-1 ring-emerald-400/40"></canvas>
        <div id="cutscene-portrait-name" class="mt-2 text-sm font-bold text-emerald-300"></div>
      </div>
      <div class="text-center">
        <canvas id="cutscene-survivors" width="260" height="140" class="rounded-2xl bg-black/50 ring-1 ring-sky-400/30"></canvas>
        <div class="mt-2 text-sm font-bold text-sky-300">Survivors of the district</div>
      </div>
    </div>
    <div class="mx-auto w-full max-w-3xl rounded-2xl bg-black/80 p-6 ring-1 ring-orange-400/40">
      <div id="cutscene-speaker" class="text-sm font-black uppercase tracking-widest text-orange-300"></div>
      <p id="cutscene-text" class="mt-2 min-h-[72px] text-lg leading-relaxed text-slate-100"></p>
      <div class="mt-2 text-right text-xs uppercase tracking-widest text-slate-500">Click to continue &raquo;</div>
    </div>
  `
  host.appendChild(dialogue)
  return { story, dialogue }
}

let panels: { story: HTMLElement; dialogue: HTMLElement } | null = null

/** Built on first use: main.ts replaces #app's markup during boot. */
function panelsReady(): { story: HTMLElement; dialogue: HTMLElement } {
  if (!panels) panels = build()
  return panels
}

function show(node: HTMLElement, visible: boolean, display: 'flex' | 'block') {
  node.classList.toggle('hidden', !visible)
  if (visible) node.classList.add(display)
  else node.classList.remove(display)
}

let storyAnimation: Animation | null = null

/** Scrolling lore crawl with a synth drone; resolves when finished or skipped. */
export function playStoryIntro(onDone: () => void) {
  resumeAudio()
  playMusic('story')
  const { story } = panelsReady()
  show(story, true, 'block')
  const crawl = document.getElementById('story-crawl')
  const skip = document.getElementById('story-skip')
  if (!crawl || !skip) throw new Error('story cutscene markup missing')

  const finish = () => {
    storyAnimation?.cancel()
    storyAnimation = null
    skip.removeEventListener('click', finish)
    show(story, false, 'block')
    stopMusic()
    onDone()
  }

  crawl.style.transform = 'translateY(100vh)'
  storyAnimation = crawl.animate(
    [{ transform: 'translateY(100vh)' }, { transform: 'translateY(-110%)' }],
    { duration: STORY_DURATION, easing: 'linear', fill: 'forwards' }
  )
  storyAnimation.onfinish = finish
  skip.addEventListener('click', finish)
}

function bossDialogue(id: CharacterId): Line[] {
  const hero = characterById(id).name
  return [
    {
      speaker: 'Survivor 1',
      text: "It's suicide going in there... The entire district has become a feeding ground. The air is thick with venom.",
      side: 'right',
    },
    {
      speaker: hero,
      text: "We don't have a choice. The scouting drones confirmed it. The source of the airborne plague is nestling deep inside 'The Infected Hive'.",
      side: 'left',
    },
    {
      speaker: 'Survivor 2',
      text: "They say it's not a normal insect. It's a massive, multi-winged abomination. It absorbed the DNA of the first fallen researchers. It controls the local horde like a hive mind!",
      side: 'right',
    },
    {
      speaker: 'Survivor 1',
      text: 'If you fail, the remaining safe zones drop within 24 hours. The swarm is already gathering outside our perimeter.',
      side: 'right',
    },
    {
      speaker: hero,
      text: "Lock the doors, distribute the remaining ammo, and hold this line at all costs. We're going to pull the plug on this swarm right now. Watch the skies.",
      side: 'left',
    },
  ]
}

function drawPortrait(id: CharacterId) {
  const canvas = document.getElementById('cutscene-portrait')
  if (!(canvas instanceof HTMLCanvasElement)) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  drawCharacterSkin(ctx, id, 52, -Math.PI / 2, false)
  ctx.restore()
}

/** Three simple NPC sprites so the hero has someone to talk to. */
function drawSurvivors() {
  const canvas = document.getElementById('cutscene-survivors')
  if (!(canvas instanceof HTMLCanvasElement)) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const spots = [60, 130, 200]
  spots.forEach((x, i) => {
    ctx.save()
    ctx.translate(x, 78 + (i === 1 ? -6 : 0))
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(0, 34, 22, 8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ['#7dd3fc', '#bae6fd', '#38bdf8'][i]
    ctx.beginPath()
    ctx.arc(0, 0, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#0c4a6e'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#0c4a6e'
    ctx.beginPath()
    ctx.arc(-8, -6, 3.5, 0, Math.PI * 2)
    ctx.arc(8, -6, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

/** Typewriter dialogue before the finale; resolves when the last line is read. */
export function playBossDialogue(id: CharacterId, onDone: () => void) {
  resumeAudio()
  playMusic('story')
  const lines = bossDialogue(id)
  const { dialogue } = panelsReady()
  const speakerEl = document.getElementById('cutscene-speaker')
  const textEl = document.getElementById('cutscene-text')
  const nameEl = document.getElementById('cutscene-portrait-name')
  if (!speakerEl || !textEl || !nameEl) throw new Error('dialogue cutscene markup missing')
  const body: HTMLElement = textEl
  const speaker: HTMLElement = speakerEl

  show(dialogue, true, 'flex')
  drawPortrait(id)
  drawSurvivors()
  nameEl.textContent = characterById(id).name

  let index = 0
  let typed = 0
  let timer: number | null = null

  const stopTyping = () => {
    if (timer !== null) window.clearInterval(timer)
    timer = null
  }

  const finish = () => {
    stopTyping()
    dialogue.removeEventListener('click', advance)
    show(dialogue, false, 'flex')
    stopMusic()
    onDone()
  }

  const type = () => {
    const line = lines[index]
    speaker.textContent = line.speaker
    speaker.className = `text-sm font-black uppercase tracking-widest ${
      line.side === 'left' ? 'text-emerald-300' : 'text-sky-300'
    }`
    typed = 0
    body.textContent = ''
    stopTyping()
    timer = window.setInterval(() => {
      typed += 1
      body.textContent = line.text.slice(0, typed)
      if (typed % 2 === 0) playSfx('type')
      if (typed >= line.text.length) stopTyping()
    }, TYPE_SPEED)
  }

  function advance() {
    const line = lines[index]
    if (typed < line.text.length) {
      // First click completes the line instead of skipping it.
      stopTyping()
      typed = line.text.length
      body.textContent = line.text
      return
    }
    index += 1
    if (index >= lines.length) {
      finish()
      return
    }
    type()
  }

  dialogue.addEventListener('click', advance)
  type()
}
