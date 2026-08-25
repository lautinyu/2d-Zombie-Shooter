export type CharacterId = 'nature-lover' | 'army-retiree' | 'medic' | 'engineer'

export interface Character {
  id: CharacterId
  name: string
  color: string
  tagline: string
  perkName: string
  perkDescription: string
  /** Multiplier applied to enemy vision range. */
  aggroMultiplier: number
  /** Multiplier applied to weapon reload time. */
  reloadMultiplier: number
  /** Multiplier applied to player movement speed. */
  speedMultiplier: number
  /** Revives granted on death, each restoring full health. */
  extraLives: number
  /** Fraction of max health regenerated per regen tick; 0 disables regen. */
  regenFraction: number
  /** Seconds without taking damage before a regen tick lands. */
  regenInterval: number
  /** Deploys an automated turret at the start of the mission. */
  turret: boolean
}

export const CHARACTERS: Character[] = [
  {
    id: 'nature-lover',
    name: 'Nature Lover',
    color: '#34d399',
    tagline: 'Moves like moss. Enemies notice you far too late.',
    perkName: 'Camouflage',
    perkDescription:
      'Zombies and Plague Bugs spot you 30% later — their vision range is cut by 30%.',
    aggroMultiplier: 0.7,
    reloadMultiplier: 1,
    speedMultiplier: 1,
    extraLives: 0,
    regenFraction: 0,
    regenInterval: 0,
    turret: false,
  },
  {
    id: 'army-retiree',
    name: 'Army Retiree',
    color: '#f59e0b',
    tagline: 'Twenty years of drills. Hands never stop moving.',
    perkName: 'Combat Veteran',
    perkDescription:
      'Reloads 25% faster and moves 15% quicker than anyone else in the wasteland.',
    aggroMultiplier: 1,
    reloadMultiplier: 0.75,
    speedMultiplier: 1.15,
    extraLives: 0,
    regenFraction: 0,
    regenInterval: 0,
    turret: false,
  },
  {
    id: 'medic',
    name: 'The Medic',
    color: '#38bdf8',
    tagline: 'Patched up half a city before it fell. Still carrying the kit.',
    perkName: 'Field Triage',
    perkDescription:
      'Starts with one extra life, and regenerates 5% health every 10 seconds spent unharmed.',
    aggroMultiplier: 1,
    reloadMultiplier: 1,
    speedMultiplier: 1,
    extraLives: 1,
    regenFraction: 0.05,
    regenInterval: 10,
    turret: false,
  },
  {
    id: 'engineer',
    name: 'The Engineer',
    color: '#a78bfa',
    tagline: 'Never fights alone — the workshop follows her everywhere.',
    perkName: 'Auto Turret',
    perkDescription:
      'Deploys a stationary turret at mission start that auto-fires weak bullets at the nearest enemy.',
    aggroMultiplier: 1,
    reloadMultiplier: 1,
    speedMultiplier: 1,
    extraLives: 0,
    regenFraction: 0,
    regenInterval: 0,
    turret: true,
  },
]

export function characterById(id: CharacterId): Character {
  const c = CHARACTERS.find((character) => character.id === id)
  if (!c) throw new Error(`unknown character ${id}`)
  return c
}
