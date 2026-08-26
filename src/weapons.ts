export type WeaponId =
  | 'rusty-pistol'
  | 'old-rifle'
  | 'viper-smg'
  | 'hellfire-shotgun'
  | 'titan-sniper'
  | 'm9-sidearm'
  | 'combat-machete'
  | 'stun-baton'

/** Primaries are the heavy firearms; secondaries are sidearms and melee. */
export type WeaponSlot = 'primary' | 'secondary'

/** Swing profile for melee secondaries, which hit an arc instead of firing. */
export interface MeleeProfile {
  /** How far in front of the player the swing lands. */
  reach: number
  /** Total width of the swing arc, in radians. */
  arc: number
  /** Push applied to everything caught in the swing. */
  knockback: number
  /** Chance per hit to freeze the target solid. */
  stunChance: number
  stunTime: number
}

export type PerkId = 'none' | 'acidic-spray' | 'dragons-breath' | 'armor-piercing'

/** Radar chart axes, scored 1-5. */
export interface RadarStats {
  damage: number
  fireRate: number
  reloadSpeed: number
  ammoCapacity: number
  range: number
}

export interface Weapon {
  id: WeaponId
  name: string
  slot: WeaponSlot
  price: number
  color: string
  perk: PerkId
  perkName: string
  perkDescription: string
  description: string
  radar: RadarStats
  /** Derived combat values used by the simulation. */
  damage: number
  fireInterval: number
  reloadTime: number
  magSize: number
  reserveStart: number
  bulletSpeed: number
  bulletLife: number
  pellets: number
  spread: number
  tracerWidth: number
  /** Fraction of damage a pellet keeps at the very end of its flight. */
  falloff?: number
  /** Never consumes ammo: sidearms with scavenged rounds and melee. */
  infiniteAmmo?: boolean
  /** Present on melee weapons; swings an arc instead of spawning bullets. */
  melee?: MeleeProfile
}

export const RADAR_AXES: { key: keyof RadarStats; label: string }[] = [
  { key: 'damage', label: 'Damage' },
  { key: 'fireRate', label: 'Fire Rate' },
  { key: 'reloadSpeed', label: 'Reload Speed' },
  { key: 'ammoCapacity', label: 'Ammo Capacity' },
  { key: 'range', label: 'Range' },
]

export const WEAPONS: Weapon[] = [
  {
    id: 'rusty-pistol',
    name: 'Rusty Pistol',
    slot: 'secondary',
    price: 0,
    color: '#94a3b8',
    perk: 'none',
    perkName: 'No talent',
    perkDescription: 'A scavenged sidearm. Reliable, unremarkable.',
    description: 'Free starter sidearm with balanced, low-end numbers.',
    radar: { damage: 2, fireRate: 2, reloadSpeed: 3, ammoCapacity: 2, range: 2 },
    damage: 30,
    fireInterval: 0.24,
    reloadTime: 1.2,
    magSize: 12,
    reserveStart: 96,
    bulletSpeed: 820,
    bulletLife: 0.7,
    pellets: 1,
    spread: 0.05,
    tracerWidth: 3,
  },
  {
    id: 'old-rifle',
    name: 'Old Rifle',
    slot: 'primary',
    price: 0,
    color: '#a3a380',
    perk: 'none',
    perkName: 'No talent',
    perkDescription: 'Surplus service rifle. Hits harder, empties slower.',
    description: 'Free starter rifle: more damage and reach, sluggish reload.',
    radar: { damage: 3, fireRate: 2, reloadSpeed: 2, ammoCapacity: 2, range: 4 },
    damage: 45,
    fireInterval: 0.32,
    reloadTime: 1.7,
    magSize: 10,
    reserveStart: 80,
    bulletSpeed: 1000,
    bulletLife: 1.1,
    pellets: 1,
    spread: 0.02,
    tracerWidth: 3,
  },
  {
    id: 'viper-smg',
    name: 'Viper SMG',
    slot: 'primary',
    price: 500,
    color: '#4ade80',
    perk: 'acidic-spray',
    perkName: 'Acidic Spray',
    perkDescription: 'Every 5th bullet coats the target in acid, dealing damage over time.',
    description: 'Blistering fire rate and a deep magazine, weak per-shot damage.',
    radar: { damage: 2, fireRate: 5, reloadSpeed: 4, ammoCapacity: 5, range: 2 },
    damage: 22,
    fireInterval: 0.075,
    reloadTime: 1.0,
    magSize: 35,
    reserveStart: 210,
    bulletSpeed: 880,
    bulletLife: 0.6,
    pellets: 1,
    spread: 0.08,
    tracerWidth: 3,
  },
  {
    id: 'hellfire-shotgun',
    name: 'Hellfire Shotgun',
    slot: 'primary',
    price: 620,
    color: '#fb923c',
    perk: 'dragons-breath',
    perkName: "Dragon's Breath",
    perkDescription: 'Wide blast cone with a 30% chance per pellet to ignite and slow Plague Bugs.',
    description: 'Five-pellet blast cone: lethal point blank, weak at distance.',
    radar: { damage: 5, fireRate: 2, reloadSpeed: 2, ammoCapacity: 2, range: 1 },
    damage: 34,
    fireInterval: 0.62,
    reloadTime: 1.9,
    magSize: 8,
    reserveStart: 64,
    bulletSpeed: 760,
    bulletLife: 0.42,
    pellets: 5,
    spread: 0.28,
    tracerWidth: 4,
    falloff: 0.3,
  },
  {
    id: 'titan-sniper',
    name: 'Titan Sniper',
    slot: 'primary',
    price: 750,
    color: '#60a5fa',
    perk: 'armor-piercing',
    perkName: 'Armor Piercing',
    perkDescription: 'Rounds punch straight through enemies instead of stopping on the first hit.',
    description: 'One shot, one line. Devastating damage and enormous reach.',
    radar: { damage: 5, fireRate: 1, reloadSpeed: 2, ammoCapacity: 1, range: 5 },
    damage: 130,
    fireInterval: 0.95,
    reloadTime: 2.1,
    magSize: 5,
    reserveStart: 40,
    bulletSpeed: 2600,
    bulletLife: 1.6,
    pellets: 1,
    spread: 0.005,
    tracerWidth: 5,
  },
  {
    id: 'm9-sidearm',
    name: 'M9 Sidearm',
    slot: 'secondary',
    price: 0,
    color: '#cbd5e1',
    perk: 'none',
    perkName: 'Scavenged Rounds',
    perkDescription: 'Never runs dry — 9mm is the one thing still lying everywhere.',
    description: 'Free backup handgun: infinite ammo, feeble damage.',
    radar: { damage: 1, fireRate: 3, reloadSpeed: 5, ammoCapacity: 5, range: 2 },
    damage: 18,
    fireInterval: 0.2,
    reloadTime: 0.9,
    magSize: 15,
    reserveStart: 0,
    bulletSpeed: 800,
    bulletLife: 0.65,
    pellets: 1,
    spread: 0.06,
    tracerWidth: 3,
    infiniteAmmo: true,
  },
  {
    id: 'combat-machete',
    name: 'Combat Machete',
    slot: 'secondary',
    price: 260,
    color: '#f87171',
    perk: 'none',
    perkName: 'Cleave',
    perkDescription: 'Each swing cuts every enemy in the arc and shoves them back.',
    description: 'Fast melee blade: no ammo, slices through overlapping zombies.',
    radar: { damage: 3, fireRate: 4, reloadSpeed: 5, ammoCapacity: 5, range: 1 },
    damage: 52,
    fireInterval: 0.34,
    reloadTime: 0,
    magSize: 1,
    reserveStart: 0,
    bulletSpeed: 0,
    bulletLife: 0,
    pellets: 0,
    spread: 0,
    tracerWidth: 0,
    infiniteAmmo: true,
    melee: { reach: 62, arc: Math.PI * 0.75, knockback: 26, stunChance: 0, stunTime: 0 },
  },
  {
    id: 'stun-baton',
    name: 'Stun Baton',
    slot: 'secondary',
    price: 340,
    color: '#38bdf8',
    perk: 'none',
    perkName: 'Overcharge',
    perkDescription: '40% chance per hit to electrocute a target, freezing it for 2 seconds.',
    description: 'Defensive melee baton: no ammo, locks the horde down mid-swing.',
    radar: { damage: 2, fireRate: 3, reloadSpeed: 5, ammoCapacity: 5, range: 1 },
    damage: 34,
    fireInterval: 0.42,
    reloadTime: 0,
    magSize: 1,
    reserveStart: 0,
    bulletSpeed: 0,
    bulletLife: 0,
    pellets: 0,
    spread: 0,
    tracerWidth: 0,
    infiniteAmmo: true,
    melee: { reach: 54, arc: Math.PI * 0.6, knockback: 14, stunChance: 0.4, stunTime: 2 },
  },
]

export const STARTER_WEAPONS: WeaponId[] = ['old-rifle', 'rusty-pistol', 'm9-sidearm']

export function weaponsInSlot(slot: WeaponSlot): Weapon[] {
  return WEAPONS.filter((w) => w.slot === slot)
}

export function weaponById(id: WeaponId): Weapon {
  const w = WEAPONS.find((weapon) => weapon.id === id)
  if (!w) throw new Error(`unknown weapon ${id}`)
  return w
}
