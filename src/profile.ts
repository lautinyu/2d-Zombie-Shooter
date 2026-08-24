import type { WeaponId } from './weapons'
import { STARTER_WEAPONS, WEAPONS } from './weapons'

const STORAGE_KEY = 'zombie-shooter-profile-v1'

export interface Profile {
  scrap: number
  owned: WeaponId[]
  equipped: WeaponId
}

const DEFAULT_PROFILE: Profile = {
  scrap: 0,
  owned: [...STARTER_WEAPONS],
  equipped: STARTER_WEAPONS[0],
}

function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && WEAPONS.some((w) => w.id === value)
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

export const SCRAP_PER_KILL = 12
export const SCRAP_PER_BUG = 20

export function missionReward(target: number): number {
  return 100 + target * 10
}
