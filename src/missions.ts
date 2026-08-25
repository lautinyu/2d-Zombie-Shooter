import type { MapId } from './maps'
import { mapById } from './maps'

export type MissionType = 'hunt' | 'hive' | 'protect'
export type PathId = 'combat' | 'rescue'

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
    unlocks: ['combat-1', 'rescue-1'],
    payout: 1,
  },

  // Path A — combat
  {
    id: 'combat-1',
    name: 'Warehouse Purge',
    map: 'warehouse',
    type: 'hunt',
    target: 18,
    survivors: 0,
    description: 'The warehouse is packed wall to wall. Thin them out.',
    objective: 'Clear 18 infected.',
    path: 'combat',
    unlocks: ['combat-2'],
    payout: 1.4,
  },
  {
    id: 'combat-2',
    name: 'Hive Breaker',
    map: 'hive',
    type: 'hive',
    target: 26,
    survivors: 0,
    description: 'Descend into the hive where the Plague Bugs are bred.',
    objective: 'Clear 26 hive dwellers — bugs are everywhere.',
    path: 'combat',
    unlocks: [],
    payout: 1.8,
  },

  // Path B — rescue
  {
    id: 'rescue-1',
    name: 'Two Left Standing',
    map: 'streets',
    type: 'protect',
    target: 0,
    survivors: 2,
    description: 'Two survivors are pinned down in The Streets. Walk them out.',
    objective: 'Escort 2 survivors to extraction — stay close or they hold position. If one dies, you fail.',
    path: 'rescue',
    unlocks: ['rescue-2'],
    payout: 1.4,
  },
  {
    id: 'rescue-2',
    name: 'Ridgeline Evac',
    map: 'refuge',
    type: 'protect',
    target: 0,
    survivors: 3,
    description: 'A family holed up at the refuge needs an escort to the ridge.',
    objective: 'Escort 3 survivors to extraction — stay close or they hold position. If one dies, you fail.',
    path: 'rescue',
    unlocks: [],
    payout: 1.8,
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

/**
 * A mission is playable when every mission that unlocks it is cleared and the
 * player's committed branch (if any) still allows it.
 */
export function missionUnlocked(
  m: Mission,
  completed: string[],
  path: PathId | null
): boolean {
  const prereqs = MISSIONS.filter((other) => other.unlocks.includes(m.id))
  if (prereqs.length && !prereqs.some((p) => completed.includes(p.id))) return false
  if (m.path && path && m.path !== path && !pathComplete(path, completed)) return false
  return true
}
