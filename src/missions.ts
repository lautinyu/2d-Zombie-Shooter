import type { MapId } from './maps'
import { mapById } from './maps'

export type MissionType =
  | 'hunt'
  | 'hive'
  | 'protect'
  | 'boss'
  | 'hold'
  | 'generator'
  | 'overgrowth'
  | 'supply'
  | 'race'

/**
 * Chapter 1 is the outbreak, chapter 2 the arctic Project Horizon arc and
 * chapter 3 the equatorial jungle the plague actually came from.
 */
export type ChapterId = 1 | 2 | 3

export interface ChapterInfo {
  id: ChapterId
  title: string
  blurb: string
}

export const CHAPTERS: ChapterInfo[] = [
  {
    id: 1,
    title: 'Chapter 1: The Outbreak',
    blurb: 'The city, the swarm and the hive that started it all.',
  },
  {
    id: 2,
    title: 'Chapter 2: Project Horizon',
    blurb:
      'The frozen corporate lab 200 miles north. Everything here is tougher, and it pays in Frozen Data Chips.',
  },
  {
    id: 3,
    title: 'Chapter 3: The Primeval Canopy',
    blurb:
      'The equatorial nesting grounds. Moss-caked infected carry double health, and the ruins pay in Ancient Amber.',
  },
]

/** Chapter 2 mutations are hardened by the cold. */
export const CH2_HP_SCALE = 1.5
export const CH2_DAMAGE_SCALE = 1.3

/** Jungle infected are twice as tough as their chapter 1 kin. */
export const CH3_HP_SCALE = 2
export const CH3_DAMAGE_SCALE = 1.3

/** Chapter 2 opens once the Hive Mother is dead. */
export const CHAPTER_2_GATE = 'finale'
/** Chapter 3 opens once the Cryo-Stalker closes chapter 2. */
export const CHAPTER_3_GATE = 'ch2-boss'
export type PathId = 'quarantine' | 'swarm' | 'evac'
export type BossKind =
  | 'hive-mother'
  | 'runner-alpha'
  | 'camo-stalker'
  | 'brood-matron'
  | 'cryo-stalker'

/** Path bosses; clearing two of them opens the Hive Mother finale. */
export const PATH_BOSS_IDS = ['quarantine-boss', 'swarm-boss', 'evac-boss']
export const BOSSES_REQUIRED = 2

export interface PathInfo {
  id: PathId
  title: string
  blurb: string
}

export const PATHS: PathInfo[] = [
  {
    id: 'quarantine',
    title: 'The Quarantine Zone',
    blurb: 'Pure zombie waves in claustrophobic city alleys. Ends with the Runner Alpha.',
  },
  {
    id: 'swarm',
    title: 'The Swarm Skies',
    blurb: 'Wide open rooftops swarming with Plague Bugs. Ends with the Brood Matron.',
  },
  {
    id: 'evac',
    title: 'The Evacuation Route',
    blurb: 'Escort work along the barricaded highway. Ends with the Camo Stalker.',
  },
]

export interface Mission {
  id: string
  name: string
  map: MapId
  type: MissionType
  /** Kills needed for hunt/hive missions. */
  target: number
  /** Friendly NPCs to escort on protect missions. */
  survivors: number
  description: string
  objective: string
  /** Which branch the mission belongs to; null for shared campaign nodes. */
  path: PathId | null
  /** Missions unlocked once this one is cleared. */
  unlocks: string[]
  /** Payout multiplier — branch missions pay noticeably better. */
  payout: number
  /** Which boss entity spawns on a boss mission. */
  boss?: BossKind
  /** Flat payout base, for missions whose difficulty isn't a kill count. */
  rewardBase?: number
  /** The finale only opens once enough path bosses are dead. */
  requiresPathBosses?: boolean
  /** Which chapter's mission board the entry belongs to. */
  chapter: ChapterId
  /** Seconds to survive on 'hold' missions. */
  holdTime?: number
  /** Generator hit points on 'generator' missions. */
  generatorHp?: number
  /** Spore Hives to destroy on 'overgrowth' missions. */
  hives?: number
  /** Supply crates to collect on 'supply' missions. */
  crates?: number
}

export const MISSIONS: Mission[] = [
  {
    id: 'tutorial',
    name: 'First Light',
    map: 'streets',
    type: 'hunt',
    target: 8,
    survivors: 0,
    description: 'Wake up in The Streets and prove you can still hold a gun.',
    objective: 'Clear 8 infected.',
    path: null,
    unlocks: ['quarantine-1', 'swarm-1', 'evac-1'],
    payout: 1,
    chapter: 1,
  },

  // Path 1 — The Quarantine Zone
  {
    id: 'quarantine-1',
    name: 'Alley Sweep',
    map: 'alley',
    type: 'hunt',
    target: 16,
    survivors: 0,
    description: 'The alleys behind the quarantine line are packed shoulder to shoulder.',
    objective: 'Clear 16 infected in the alleys.',
    path: 'quarantine',
    unlocks: ['quarantine-2'],
    payout: 1.4,
    chapter: 1,
  },
  {
    id: 'quarantine-2',
    name: 'Warehouse Purge',
    map: 'warehouse',
    type: 'hunt',
    target: 24,
    survivors: 0,
    description: 'The quarantine depot is overrun. Thin them out room by room.',
    objective: 'Clear 24 infected.',
    path: 'quarantine',
    unlocks: ['quarantine-boss'],
    payout: 1.7,
    chapter: 1,
  },
  {
    id: 'quarantine-boss',
    name: 'The Runner Alpha',
    map: 'deadend',
    type: 'boss',
    target: 1,
    survivors: 0,
    description: 'Something sprints across the walls of a debris-choked dead end.',
    objective: 'Kill the Runner Alpha. She leaps obstacles and screams for her pack.',
    path: 'quarantine',
    unlocks: [],
    payout: 2.4,
    rewardBase: 100,
    boss: 'runner-alpha',
    chapter: 1,
  },

  // Path 2 — The Swarm Skies
  {
    id: 'swarm-1',
    name: 'Rooftop Landing',
    map: 'rooftop',
    type: 'hive',
    target: 20,
    survivors: 0,
    description: 'The swarm nests above the city. Take the roofs back.',
    objective: 'Clear 20 fliers and stragglers on the rooftops.',
    path: 'swarm',
    unlocks: ['swarm-2'],
    payout: 1.4,
    chapter: 1,
  },
  {
    id: 'swarm-2',
    name: 'Skyline Blackout',
    map: 'rooftop',
    type: 'hive',
    target: 28,
    survivors: 0,
    description: 'The sky is thick with wings. Hold the roofline until it clears.',
    objective: 'Clear 28 hive dwellers — bugs are everywhere.',
    path: 'swarm',
    unlocks: ['swarm-boss'],
    payout: 1.7,
    chapter: 1,
  },
  {
    id: 'swarm-boss',
    name: 'The Brood Matron',
    map: 'rooftop',
    type: 'boss',
    target: 1,
    survivors: 0,
    description: 'A smaller kin of the Hive Mother rules the skyline.',
    objective: 'Kill the Brood Matron. She rings the roof with venom and hatches brood.',
    path: 'swarm',
    unlocks: [],
    payout: 2.4,
    rewardBase: 100,
    boss: 'brood-matron',
    chapter: 1,
  },

  // Path 3 — The Evacuation Route
  {
    id: 'evac-1',
    name: 'Highway Convoy',
    map: 'highway',
    type: 'protect',
    target: 0,
    survivors: 2,
    description: 'Two survivors are pinned between barriers on the evac highway.',
    objective: 'Escort 2 survivors to extraction — stay close or they hold position. If one dies, you fail.',
    path: 'evac',
    unlocks: ['evac-2'],
    payout: 1.4,
    chapter: 1,
  },
  {
    id: 'evac-2',
    name: 'Ridgeline Evac',
    map: 'refuge',
    type: 'protect',
    target: 0,
    survivors: 3,
    description: 'A family holed up at the refuge needs an escort to the ridge.',
    objective: 'Escort 3 survivors to extraction — stay close or they hold position. If one dies, you fail.',
    path: 'evac',
    unlocks: ['evac-boss'],
    payout: 1.7,
    chapter: 1,
  },
  {
    id: 'evac-boss',
    name: 'The Camo Stalker',
    map: 'fogward',
    type: 'boss',
    target: 1,
    survivors: 0,
    description: 'One last survivor is waiting in the fogged-in loading dock. Allegedly.',
    objective: 'Kill the Camo Stalker. She vanishes for seconds at a time and backstabs.',
    path: 'evac',
    unlocks: [],
    payout: 2.4,
    rewardBase: 100,
    boss: 'camo-stalker',
    chapter: 1,
  },

  // Finale — opens once both branches are cleared
  {
    id: 'finale',
    name: 'The Hive Mother',
    map: 'hive',
    type: 'boss',
    target: 1,
    survivors: 0,
    description: 'The Mutated Alpha Bug that seeded the plague is awake at the bottom of the hive.',
    objective: 'Kill the Hive Mother. She rings the chamber with venom and calls her brood.',
    path: null,
    unlocks: [],
    payout: 3,
    rewardBase: 140,
    requiresPathBosses: true,
    boss: 'hive-mother',
    chapter: 1,
  },

  // Chapter 2 — Project Horizon, 200 miles north
  {
    id: 'ch2-1',
    name: 'Glacier Approach',
    map: 'glacier',
    type: 'hunt',
    target: 22,
    survivors: 0,
    description: 'The transport dies a mile short of the facility. Walk the rest through the ice.',
    objective: 'Clear 22 cold-weather mutations on the approach.',
    path: null,
    unlocks: ['ch2-2'],
    payout: 1,
    rewardBase: 30,
    chapter: 2,
  },
  {
    id: 'ch2-2',
    name: 'Hold the Line',
    map: 'cryolab',
    type: 'hold',
    target: 0,
    survivors: 0,
    description: 'The cryo lab seals behind you and the vents start emptying into the room.',
    objective: 'Survive 2 minutes in the sealed lab. The waves never stop.',
    path: null,
    unlocks: ['ch2-3'],
    payout: 1.3,
    rewardBase: 40,
    holdTime: 120,
    chapter: 2,
  },
  {
    id: 'ch2-3',
    name: 'Defend the Generator Camp',
    map: 'camp',
    type: 'generator',
    target: 26,
    survivors: 0,
    description: 'The camp runs on one generator. Lose it and everyone here freezes.',
    objective: 'Break the assault — 26 kills. If the generator falls, the camp dies with it.',
    path: null,
    unlocks: ['ch2-4'],
    payout: 1.5,
    rewardBase: 45,
    generatorHp: 1200,
    chapter: 2,
  },
  {
    id: 'ch2-4',
    name: 'Deep Freeze Lockdown',
    map: 'cryolab',
    type: 'hold',
    target: 0,
    survivors: 0,
    description: 'Facility security locks the lab down with you inside it. Again. Worse.',
    objective: 'Survive 2 minutes as the lockdown floods the chamber.',
    path: null,
    // The boss stays reachable straight from here so older saves that already
    // cleared the lockdown are not walled off by the new stages.
    unlocks: ['ch2-5', 'ch2-boss'],
    payout: 1.8,
    rewardBase: 55,
    holdTime: 120,
    chapter: 2,
  },
  {
    id: 'ch2-5',
    name: 'The Abandoned Lab',
    map: 'abandonedlab',
    type: 'hunt',
    target: 30,
    survivors: 0,
    description:
      'The research wing was evacuated first. Whatever the staff left behind never stopped moving.',
    objective: 'Clear 30 cold-weather mutations through the lab wing.',
    path: null,
    unlocks: ['ch2-6'],
    payout: 1.6,
    rewardBase: 50,
    chapter: 2,
  },
  {
    id: 'ch2-6',
    name: 'Sub-Zero Concourse',
    map: 'concourse',
    type: 'hunt',
    target: 34,
    survivors: 0,
    description:
      'The concourse links every wing of Project Horizon, and the whole facility is walking down it.',
    objective: 'Clear 34 infected and hold the transit concourse.',
    path: null,
    unlocks: ['ch2-boss'],
    payout: 1.7,
    rewardBase: 55,
    chapter: 2,
  },
  {
    id: 'ch2-boss',
    name: 'The Cryo-Stalker Infusion',
    map: 'frozencore',
    type: 'boss',
    target: 1,
    survivors: 0,
    description:
      'The frost core holds something the researchers never managed to keep frozen.',
    objective: 'Kill the Cryo-Stalker before it adapts any further.',
    path: null,
    unlocks: [],
    payout: 2,
    rewardBase: 70,
    boss: 'cryo-stalker',
    chapter: 2,
  },

  // Chapter 3 — The Primeval Canopy, at the equator
  {
    id: 'ch3-1',
    name: 'Destroy the Hive Overgrowth',
    map: 'canopy',
    type: 'overgrowth',
    target: 0,
    survivors: 0,
    description:
      'Three egg sacks the size of trucks pulse in the hollow, hatching bugs faster than you can burn them.',
    objective: 'Destroy all 3 Spore Hives while the brood keeps pouring out.',
    path: null,
    unlocks: ['ch3-2'],
    payout: 1.4,
    rewardBase: 60,
    hives: 3,
    chapter: 3,
  },
  {
    id: 'ch3-2',
    name: 'Supply Drop Retrieval Run',
    map: 'thicket',
    type: 'supply',
    target: 0,
    survivors: 0,
    description:
      'The drop scattered four crates across the thicket. The canopy is too thick to fly a second pass.',
    objective:
      'Find all 4 supply crates and hold E (player 2: M) beside each one to haul it out.',
    path: null,
    unlocks: ['ch3-3'],
    payout: 1.6,
    rewardBase: 70,
    crates: 4,
    chapter: 3,
  },
  {
    id: 'ch3-3',
    name: 'The Extraction Race',
    map: 'valley',
    type: 'race',
    target: 0,
    survivors: 0,
    description:
      'The hatch at the far end of the sunken valley is already open. Everything in the jungle knows it.',
    objective: 'Fight down the valley and reach the extraction hatch. Mud slows you; nothing else does.',
    path: null,
    unlocks: ['ch3-4'],
    payout: 2,
    rewardBase: 90,
    chapter: 3,
  },
  {
    id: 'ch3-4',
    name: 'Toxic Marshlands',
    map: 'marshlands',
    type: 'hunt',
    target: 32,
    survivors: 0,
    description:
      'The basin south of the hollow is half swamp, and everything that drowned in it got back up.',
    objective: 'Clear 32 infected across the marsh. The mud is everywhere here.',
    path: null,
    unlocks: ['ch3-5'],
    payout: 2.1,
    rewardBase: 95,
    chapter: 3,
  },
  {
    id: 'ch3-5',
    name: 'Canopy Infiltration',
    map: 'infiltration',
    type: 'hive',
    target: 36,
    survivors: 0,
    description:
      'Root-choked temple corridors run under the canopy, and the brood nests in every one of them.',
    objective: 'Push through the ruins and clear 36 of the brood.',
    path: null,
    unlocks: [],
    payout: 2.3,
    rewardBase: 105,
    chapter: 3,
  },
]

export function missionById(id: string): Mission {
  const m = MISSIONS.find((mm) => mm.id === id)
  if (!m) throw new Error(`unknown mission ${id}`)
  return m
}

export function missionMapName(m: Mission): string {
  return mapById(m.map).name
}

export function pathMissions(path: PathId): Mission[] {
  return MISSIONS.filter((m) => m.path === path)
}

export function pathComplete(path: PathId, completed: string[]): boolean {
  return pathMissions(path).every((m) => completed.includes(m.id))
}

export function bossesDefeated(completed: string[]): number {
  return PATH_BOSS_IDS.filter((id) => completed.includes(id)).length
}

/**
 * A mission is playable once every mission that unlocks it is cleared. All
 * three paths stay open in parallel; the finale needs two path bosses dead.
 */
export function chapterMissions(chapter: ChapterId): Mission[] {
  return MISSIONS.filter((m) => m.chapter === chapter)
}

/** Chapter 2 travel opens the moment the Hive Mother is dead. */
export function chapterTwoUnlocked(completed: string[]): boolean {
  return completed.includes(CHAPTER_2_GATE)
}

/** Chapter 3 travel opens the moment the Cryo-Stalker is dead. */
export function chapterThreeUnlocked(completed: string[]): boolean {
  return completed.includes(CHAPTER_3_GATE)
}

export function chapterUnlocked(chapter: ChapterId, completed: string[]): boolean {
  if (chapter === 2) return chapterTwoUnlocked(completed)
  if (chapter === 3) return chapterThreeUnlocked(completed)
  return true
}

export function missionUnlocked(m: Mission, completed: string[]): boolean {
  if (!chapterUnlocked(m.chapter, completed)) return false
  if (m.requiresPathBosses) return bossesDefeated(completed) >= BOSSES_REQUIRED
  const prereqs = MISSIONS.filter((other) => other.unlocks.includes(m.id))
  if (prereqs.length && !prereqs.some((p) => completed.includes(p.id))) return false
  return true
}
