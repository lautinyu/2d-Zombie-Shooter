/**
 * Shared damage budget for every area-of-effect attack — boss slams, flame
 * zones and industrial turret beams alike. AoE never bursts: it lands as
 * fixed ticks spaced by an internal cooldown, and one cycle of standing in a
 * single hazard can never cost more than AOE_MAX_CYCLE_DAMAGE.
 */

/** Damage of a single AoE tick. */
export const AOE_TICK_DAMAGE = 7
/** Ticks in one full cycle: 7 x 5 = 35 damage. */
export const AOE_MAX_TICKS = 5
export const AOE_MAX_CYCLE_DAMAGE = AOE_TICK_DAMAGE * AOE_MAX_TICKS
/** Seconds a target is immune after an AoE tick lands on it. */
export const AOE_TICK_COOLDOWN = 0.45

interface TickState {
  ticks: number
  timer: number
}

/**
 * Per-target tick bookkeeping for one hazard. Targets are held weakly so
 * dead entities drop out on their own.
 */
export class AoeTicker<T extends object> {
  private readonly state = new WeakMap<T, TickState>()

  /** Damage owed to `target` this frame; 0 while on cooldown or capped. */
  tick(target: T, dt: number): number {
    let entry = this.state.get(target)
    if (!entry) {
      entry = { ticks: 0, timer: 0 }
      this.state.set(target, entry)
    }
    entry.timer -= dt
    if (entry.ticks >= AOE_MAX_TICKS || entry.timer > 0) return 0
    entry.ticks += 1
    entry.timer = AOE_TICK_COOLDOWN
    return AOE_TICK_DAMAGE
  }

  /** Ends the cycle, so leaving and re-entering the hazard starts fresh. */
  reset(target: T): void {
    this.state.delete(target)
  }
}

/** Splits a one-shot AoE hit into whole ticks, clamped to the cycle cap. */
export function aoeTickCount(total: number): number {
  const capped = Math.min(total, AOE_MAX_CYCLE_DAMAGE)
  return Math.max(1, Math.round(capped / AOE_TICK_DAMAGE))
}
