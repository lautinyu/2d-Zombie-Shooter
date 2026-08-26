export type CharacterId = 'nature-lover' | 'army-retiree' | 'medic' | 'engineer'

export interface Ability {
  name: string
  description: string
  /** Seconds before the ability can be used again. */
  cooldown: number
  /** Seconds the effect stays active; 0 for instant abilities. */
  duration: number
  /** Uses per mission; 0 means unlimited (cooldown gated only). */
  charges: number
}

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
  /** Active ability fired with E (player 1) or M (player 2). */
  ability: Ability
  /** Barricades deployable per mission with Q (player 1) or , (player 2). */
  barricades: number
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
    ability: {
      name: 'Camouflage Blend',
      description:
        'Bursts a cloud of leaves — for 6 seconds every zombie and Plague Bug loses track of you.',
      cooldown: 25,
      duration: 6,
      charges: 0,
    },
    barricades: 0,
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
    ability: {
      name: 'Overdrive',
      description: '5 seconds of 20% extra speed and 1.5x bullet damage.',
      cooldown: 20,
      duration: 5,
      charges: 0,
    },
    barricades: 0,
  },
  {
    id: 'medic',
    name: 'The Medic',
    color: '#38bdf8',
    tagline: 'Patched up half a city before it fell. Still carrying the kit.',
    perkName: 'Field Triage',
    perkDescription: 'Regenerates 5% health every 10 seconds spent unharmed.',
    aggroMultiplier: 1,
    reloadMultiplier: 1,
    speedMultiplier: 1,
    extraLives: 0,
    regenFraction: 0.05,
    regenInterval: 10,
    ability: {
      name: 'Field Medkit',
      description:
        'Drops a medkit — walking over it heals 50% of missing health. Two kits per mission.',
      cooldown: 6,
      duration: 0,
      charges: 2,
    },
    barricades: 0,
  },
  {
    id: 'engineer',
    name: 'The Engineer',
    color: '#a78bfa',
    tagline: 'Never fights alone — the workshop follows her everywhere.',
    perkName: 'Defense Deployment',
    perkDescription:
      'Hand-places auto-turrets and a barricade instead of relying on a random turret drop.',
    aggroMultiplier: 1,
    reloadMultiplier: 1,
    speedMultiplier: 1,
    extraLives: 0,
    regenFraction: 0,
    regenInterval: 0,
    ability: {
      name: 'Defense Deployment',
      description:
        'Drops an auto-turret on the spot — one active at a time, twice per mission. F (P2: ,) drops one barricade.',
      cooldown: 4,
      duration: 0,
      charges: 2,
    },
    barricades: 1,
  },
]

export function characterById(id: CharacterId): Character {
  const c = CHARACTERS.find((character) => character.id === id)
  if (!c) throw new Error(`unknown character ${id}`)
  return c
}
