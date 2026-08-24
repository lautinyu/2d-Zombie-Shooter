import type { ZoneId } from './world'
import { zoneById } from './world'

export interface Mission {
  id: string
  name: string
  zone: ZoneId
  target: number
  description: string
}

export const MISSIONS: Mission[] = [
  {
    id: 'streets-10',
    name: 'Street Sweep',
    zone: 'streets',
    target: 10,
    description: 'Clear 10 zombies in The Streets.',
  },
  {
    id: 'warehouse-20',
    name: 'Warehouse Purge',
    zone: 'warehouse',
    target: 20,
    description: 'Clear 20 zombies in The Warehouse.',
  },
  {
    id: 'streets-30',
    name: 'Last Stand',
    zone: 'streets',
    target: 30,
    description: 'Clear 30 zombies in The Streets. Hordes are thicker here.',
  },
]

export function missionZoneName(m: Mission): string {
  return zoneById(m.zone).name
}
