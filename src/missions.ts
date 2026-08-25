import type { MapId } from './maps'
import { mapById } from './maps'

export type MissionType = 'hunt' | 'hive' | 'protect' | 'boss'
export type PathId = 'quarantine' | 'swarm' | 'evac'
export type BossKind = 'hive-mother' | 'runner-alpha' | 'camo-stalker' | 'brood-matron'

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
export function missionUnlocked(m: Mission, completed: string[]): boolean {
  if (m.requiresPathBosses) return bossesDefeated(completed) >= BOSSES_REQUIRED
  const prereqs = MISSIONS.filter((other) => other.unlocks.includes(m.id))
  if (prereqs.length && !prereqs.some((p) => completed.includes(p.id))) return false
  return true
}
