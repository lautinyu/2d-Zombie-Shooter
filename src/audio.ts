import type { Weapon } from './weapons'

interface SoundProfile {
  startFreq: number
  endFreq: number
  duration: number
  type: OscillatorType
  gain: number
}

const PROFILES: Record<string, SoundProfile> = {
  'rusty-pistol': { startFreq: 320, endFreq: 90, duration: 0.09, type: 'square', gain: 0.12 },
  'old-rifle': { startFreq: 420, endFreq: 70, duration: 0.13, type: 'sawtooth', gain: 0.14 },
  'viper-smg': { startFreq: 540, endFreq: 180, duration: 0.05, type: 'square', gain: 0.08 },
  'hellfire-shotgun': { startFreq: 220, endFreq: 40, duration: 0.24, type: 'sawtooth', gain: 0.18 },
  'titan-sniper': { startFreq: 700, endFreq: 45, duration: 0.34, type: 'triangle', gain: 0.2 },
}

let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (context) return context
  const Ctor = window.AudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

export function playShot(weapon: Weapon) {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const profile = PROFILES[weapon.id] ?? PROFILES['rusty-pistol']
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = profile.type
  osc.frequency.setValueAtTime(profile.startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(profile.endFreq, now + profile.duration)
  gain.gain.setValueAtTime(profile.gain, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + profile.duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + profile.duration)
}
