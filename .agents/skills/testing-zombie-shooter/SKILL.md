---
name: testing-zombie-shooter
description: How to run, drive and objectively measure the zombie-shooter Vite game in a browser (CDP + playwright-core), including save/profile manipulation, combat instrumentation, and known pitfalls.
---

# Testing the zombie-shooter game

## Environment

- Vite dev server: `http://localhost:5173`, usually kept alive by `/home/ubuntu/keep-vite-alive.sh`.
  If it is not up, start it (`npm run dev`) from the repo root and re-check the port.
- Chrome is driven over CDP on `http://localhost:29229`. `playwright-core` is installed under
  `/home/ubuntu/tools/node_modules`, so run helper scripts from `/home/ubuntu/tools`.
- Always hard-refresh (Ctrl+Shift+R) after editing localStorage or after code changes; Vite HMR does not
  always re-create the `Game` instance.
- Maximize the browser before recording: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

Minimal helper script shape:

```js
import { chromium } from 'playwright-core'
const b = await chromium.connectOverCDP('http://localhost:29229')
const page = b.contexts()[0].pages()[0]
console.log(JSON.stringify(await page.evaluate(() => { /* window.game ... */ })))
await b.close()
```

## Save / profile

- Profile lives in localStorage key `zombie-shooter-profile-v1`.
- Useful fields: `scrap`, `owned[]`, `primary`, `secondary`, `character`, `character2`, `players`,
  `completed[]`, `textures`.
- Unlock content quickly by writing mission ids into `completed` (e.g. `["tutorial","quarantine-1",
  "quarantine-2"]` to reach `quarantine-boss`; two of `quarantine-boss`/`swarm-boss`/`evac-boss` to open
  the `finale`).
- **Always snapshot the profile JSON before touching it and write it back verbatim at the end**, then
  reload and confirm the menu "Loadout:" line and the "Path bosses defeated: n/2" note match the baseline.

## Runtime state worth reading (`window.game`)

`paused`, `reveal` (`pending` | `playing` | `done`), `shake`, `map.id`, `kills`, `barricades`,
`players[0].{x,y,angle,hp,slots,slotIndex,weapon,mag,reserve}`, `enemies[i].{kind,hp,x,y,stun,baseSpeed}`,
`boss.{kind,baseSpeed,cloaked,footprints}`.

## Instrumenting combat (the reliable way)

Polling at 100 ms misses most combat events. Use an in-page `requestAnimationFrame` loop that diffs
per-enemy `hp`/`x`/`y`/`stun` between frames and resolves a promise with the collected events. This is how
to prove, objectively:

- **Melee cleave + knockback**: one swing produces a single frame with ≥2 enemies losing hp, and each
  enemy's distance from the player jumps by ~24–26 px in that same frame.
- **Stun/freeze**: detect a `stun` 0 → >0 transition, then sample until it returns to 0 (expect ~2.0 s) and
  track max positional drift (should be 0 px while frozen).
- **Boss backstab / one-frame burst damage**: only visible frame-by-frame; a HP top-up loop will mask it.

To capture a screenshot at the exact instant of a transient visual (blue stun ring, cloak, etc.), poll from
a node script and call `page.screenshot({path})` the first frame the condition is true — then crop/zoom the
saved PNG with ImageMagick (`convert in.png -crop WxH+X+Y +repage -resize 400% out.png`) to inspect it.

## Pitfalls

- **Enemies wander far away.** After a while the remaining enemies can be 1000+ px off-screen and will not
  path to you, so "hold fire and wait" yields zero hits. Query enemy offsets relative to the player and
  walk toward them (`hold_key` w/a/s/d) before swinging.
- **Enemies frequently end up exactly on top of the player** (distance ~1 px). Melee still hits them, but
  bullets appear to do nothing — do not conclude "shooting is broken" from point-blank overlap; retest at
  range with a clear line of sight (walls block bullets).
- **Aim is easy to get wrong.** The camera scrolls, so screen coordinates go stale fast. Verify by reading
  `players[0].angle` and comparing with `atan2(enemy.y-player.y, enemy.x-player.x)`.
- **You will die a lot while instrumenting.** A page-session-only HP keep-alive
  (`setInterval(() => { game.players[0].hp = game.players[0].maxHp }, 200)`) is the least invasive way to
  survive long measurement runs. It is cleared by any reload — **re-apply it after every retry/reload**, and
  never modify game source.
- Mutations ("Hardened Shell": −30% bullet damage) can slow bullet kills; melee is more deterministic for
  reaching a mission's kill target.
- Bosses in older builds only activated after walking within `BOSS_REVEAL_RANGE` (320 px) of the arena
  centre; newer builds start the dialogue immediately on load. If a boss looks inert, check `game.reveal`
  before reporting a bug.

## Devin Secrets Needed

None.
