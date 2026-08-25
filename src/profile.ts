import type { CharacterId } from './characters'
import { CHARACTERS } from './characters'
import type { PathId } from './missions'
import { MISSIONS } from './missions'
import type { TexturePack } from './theme'
import type { WeaponId } from './weapons'
import { STARTER_WEAPONS, WEAPONS } from './weapons'

const STORAGE_KEY = 'zombie-shooter-profile-v1'

export interface Profile {
  scrap: number
  owned: WeaponId[]
  equipped: WeaponId
  character: CharacterId | null
  /** Second local player's character, used in 2-player co-op. */
  character2: CharacterId | null
  /** Local players sharing the screen. */
  players: 1 | 2
  /** Mission ids already cleared. */
  completed: string[]
  /** Campaign branch the player committed to. */
  path: PathId | null
  /** Chosen render style; null until the intro splash is answered. */
  textures: TexturePack | null
}

const DEFAULT_PROFILE: Profile = {
  scrap: 0,
  owned: [...STARTER_WEAPONS],
  equipped: STARTER_WEAPONS[0],
  character: null,
  character2: null,
  players: 1,
  completed: [],
  path: null,
  textures: null,
}

function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && WEAPONS.some((w) => w.id === value)
}

function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && CHARACTERS.some((c) => c.id === value)
}

function isMissionId(value: unknown): value is string {
  return typeof value === 'string' && MISSIONS.some((m) => m.id === value)
}

function isPathId(value: unknown): value is PathId {
  return value === 'combat' || value === 'rescue'
}

function isTexturePack(value: unknown): value is TexturePack {
  return value === 'classic' || value === 'enhanced'
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE, owned: [...STARTER_WEAPONS], completed: [] }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) throw new Error('bad profile')
    const record = parsed as Record<string, unknown>
    const owned = Array.isArray(record.owned) ? record.owned.filter(isWeaponId) : []
    for (const id of STARTER_WEAPONS) {
      if (!owned.includes(id)) owned.push(id)
    }
    const equipped = isWeaponId(record.equipped) && owned.includes(record.equipped)
      ? record.equipped
      : owned[0]
    return {
      scrap: typeof record.scrap === 'number' && record.scrap >= 0 ? Math.floor(record.scrap) : 0,
      owned,
      equipped,
      character: isCharacterId(record.character) ? record.character : null,
      character2: isCharacterId(record.character2) ? record.character2 : null,
      players: record.players === 2 ? 2 : 1,
      completed: Array.isArray(record.completed) ? record.completed.filter(isMissionId) : [],
      path: isPathId(record.path) ? record.path : null,
      textures: isTexturePack(record.textures) ? record.textures : null,
    }
  } catch {
    return { ...DEFAULT_PROFILE, owned: [...STARTER_WEAPONS], completed: [] }
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // storage unavailable (private mode) — profile stays in memory only
  }
}

// Economy is deliberately tight: premium guns take several successful runs.
export const SCRAP_PER_KILL = 2
export const SCRAP_PER_BUG = 4

export function missionReward(mission: {
  target: number
  survivors: number
  payout: number
  rewardBase?: number
}): number {
  const base = (mission.rewardBase ?? 20) + mission.target * 2 + mission.survivors * 25
  return Math.round(base * mission.payout)
}
