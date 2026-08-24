export type WeaponId = 'rusty-pistol' | 'old-rifle' | 'viper-smg' | 'hellfire-shotgun' | 'titan-sniper'

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
    price: 450,
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
    price: 700,
    color: '#fb923c',
    perk: 'dragons-breath',
    perkName: "Dragon's Breath",
    perkDescription: 'Wide blast cone with a 30% chance per pellet to ignite and slow Plague Bugs.',
    description: 'Eight-pellet cone that shreds anything at close range.',
    radar: { damage: 5, fireRate: 2, reloadSpeed: 2, ammoCapacity: 2, range: 1 },
    damage: 20,
    fireInterval: 0.62,
    reloadTime: 1.9,
    magSize: 8,
    reserveStart: 64,
    bulletSpeed: 760,
    bulletLife: 0.32,
    pellets: 8,
    spread: 0.34,
    tracerWidth: 4,
  },
  {
    id: 'titan-sniper',
    name: 'Titan Sniper',
    price: 900,
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
    bulletSpeed: 1600,
    bulletLife: 1.6,
    pellets: 1,
    spread: 0.005,
    tracerWidth: 5,
  },
]

export const STARTER_WEAPONS: WeaponId[] = ['rusty-pistol', 'old-rifle']

export function weaponById(id: WeaponId): Weapon {
  const w = WEAPONS.find((weapon) => weapon.id === id)
  if (!w) throw new Error(`unknown weapon ${id}`)
  return w
}
