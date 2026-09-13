/**
 * Persistent input state. Movement flags and the shooting flag are separate
 * fields that are only ever written by their own listener, so a mouse press
 * can never clear, reset or pause a movement direction that is being held.
 */
export const keysPressed = {
  // Player 1 movement.
  w: false,
  a: false,
  s: false,
  d: false,
  // Player 2 movement (also drives player 1 in solo play).
  up: false,
  down: false,
  left: false,
  right: false,
  // Mouse fire button, tracked independently of every key above.
  shooting: false,
  // Player 2's own trigger: '.', Numpad 0 or the right Control key.
  shootingP2: false,
  // Held to collect supply crates; shared by both local players.
  interact: false,
  // Per-player retrieve keys: E for player 1, M for player 2.
  interactP1: false,
  interactP2: false,
}

export type MovementKey = 'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right'

/** Maps both the layout key and the physical code onto a movement flag. */
const MOVEMENT: Record<string, MovementKey> = {
  w: 'w',
  a: 'a',
  s: 's',
  d: 'd',
  keyw: 'w',
  keya: 'a',
  keys: 's',
  keyd: 'd',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
}

const SCROLL_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']

/** Player 2 holds any of these to fire without waiting on auto-aim. */
function isP2Trigger(e: KeyboardEvent): boolean {
  const code = e.code.toLowerCase()
  return e.key === '.' || code === 'numpad0' || code === 'controlright'
}

/** One-shot key presses; movement is never routed through these. */
export interface InputActions {
  reload: () => void
  p1Ability: () => void
  p2Ability: () => void
  p1Barricade: () => void
  p2Barricade: () => void
  /** Swap between the primary and secondary weapon slots. */
  p1Switch: () => void
  p2Switch: () => void
  /** Fired once per press so a very short click still sends a bullet. */
  p1Shot: () => void
  p2Shot: () => void
  /** Mouse position in canvas space, updated on every move and press. */
  aim: (x: number, y: number) => void
  /** Presses outside a live mission must not arm the trigger. */
  canShoot: () => boolean
}

function movementFlag(e: KeyboardEvent): MovementKey | undefined {
  return MOVEMENT[e.key.toLowerCase()] ?? MOVEMENT[e.code.toLowerCase()]
}

export function clearInput() {
  for (const key of Object.keys(keysPressed) as (keyof typeof keysPressed)[]) {
    keysPressed[key] = false
  }
}

export function bindInput(canvas: HTMLCanvasElement, actions: InputActions) {
  window.addEventListener('keydown', (e) => {
    const flag = movementFlag(e)
    if (flag) {
      keysPressed[flag] = true
      // Only page scrolling is suppressed; the key state above is already set.
      if (SCROLL_KEYS.includes(e.key.toLowerCase())) e.preventDefault()
      return
    }
    const key = e.key.toLowerCase()
    // Retrieve is a hold, so its flag is set before the repeat guard drops
    // the auto-repeat events.
    if (key === 'e') keysPressed.interactP1 = true
    if (key === 'm') keysPressed.interactP2 = true
    if (isP2Trigger(e)) keysPressed.shootingP2 = true
    if (e.repeat) return
    if (isP2Trigger(e)) actions.p2Shot()
    switch (key) {
      case 'r':
        actions.reload()
        break
      case 'e':
        actions.p1Ability()
        break
      case 'm':
        actions.p2Ability()
        break
      case 'q':
        actions.p1Switch()
        break
      case 'n':
        actions.p2Switch()
        break
      case 'f':
        actions.p1Barricade()
        break
      case 'l':
        actions.p2Barricade()
        break
      case ' ':
        keysPressed.interact = true
        e.preventDefault()
        break
    }
  })

  window.addEventListener('keyup', (e) => {
    const flag = movementFlag(e)
    if (flag) keysPressed[flag] = false
    const key = e.key.toLowerCase()
    if (key === ' ') keysPressed.interact = false
    if (key === 'e') keysPressed.interactP1 = false
    if (key === 'm') keysPressed.interactP2 = false
    if (isP2Trigger(e)) keysPressed.shootingP2 = false
  })

  // A window that loses focus stops receiving keyup, so drop everything.
  window.addEventListener('blur', clearInput)

  const aimAt = (e: MouseEvent | PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    actions.aim(e.clientX - rect.left, e.clientY - rect.top)
  }
  window.addEventListener('mousemove', aimAt)
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !actions.canShoot()) return
    aimAt(e)
    keysPressed.shooting = true
    actions.p1Shot()
  })
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) keysPressed.shooting = false
  })
  window.addEventListener('pointercancel', () => {
    keysPressed.shooting = false
  })
  // Canvas drags and text selection make Chrome swallow keydown while the
  // button is held, which looks exactly like frozen movement.
  canvas.addEventListener('dragstart', (e) => e.preventDefault())
  canvas.addEventListener('selectstart', (e) => e.preventDefault())
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
}
