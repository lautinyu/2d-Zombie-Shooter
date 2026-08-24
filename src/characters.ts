export type CharacterId = 'nature-lover' | 'army-retiree'

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
}

export const CHARACTERS: Character[] = [
  {
    id: 'nature-lover',
    name: 'Nature Lover',
    color: '#34d399',
    tagline: 'Moves like moss. Enemies notice you far too late.',
    perkName: 'Camouflage',
    perkDescription: 'Zombies and Plague Bugs spot you 30% later — their vision range is cut by 30%.',
    aggroMultiplier: 0.7,
    reloadMultiplier: 1,
    speedMultiplier: 1,
  },
  {
    id: 'army-retiree',
    name: 'Army Retiree',
    color: '#f59e0b',
    tagline: 'Twenty years of drills. Hands never stop moving.',
    perkName: 'Combat Veteran',
    perkDescription: 'Reloads 25% faster and moves 15% quicker than anyone else in the wasteland.',
    aggroMultiplier: 1,
    reloadMultiplier: 0.75,
    speedMultiplier: 1.15,
  },
]

export function characterById(id: CharacterId): Character {
  const c = CHARACTERS.find((character) => character.id === id)
  if (!c) throw new Error(`unknown character ${id}`)
  return c
}
