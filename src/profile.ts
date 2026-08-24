import type { CharacterId } from './characters'
import { CHARACTERS } from './characters'
import type { WeaponId } from './weapons'
import { STARTER_WEAPONS, WEAPONS } from './weapons'

const STORAGE_KEY = 'zombie-shooter-profile-v1'

export interface Profile {
  scrap: number
  owned: WeaponId[]
  equipped: WeaponId
  character: CharacterId | null
}

const DEFAULT_PROFILE: Profile = {
  scrap: 0,
  owned: [...STARTER_WEAPONS],
  equipped: STARTER_WEAPONS[0],
  character: null,
}

function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && WEAPONS.some((w) => w.id === value)
}

function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && CHARACTERS.some((c) => c.id === value)
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE, owned: [...STARTER_WEAPONS] }
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
    }
  } catch {
    return { ...DEFAULT_PROFILE, owned: [...STARTER_WEAPONS] }
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

export function missionReward(target: number): number {
  return 20 + target * 2
}
