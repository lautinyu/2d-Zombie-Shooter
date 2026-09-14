/**
 * Hidden developer cheat entry. There is no button: typing the trigger word on
 * the mission board opens a code prompt, and the right code opens the whole
 * campaign.
 */

/** Typed anywhere on the mission board to summon the prompt. */
const TRIGGER = 'cheat'
const ACCESS_CODE = 'devmode777'
/** Amount of every currency handed out with the unlock. */
export const CHEAT_CURRENCY = 99_999
/** How long a wrong code shakes before the overlay fades away. */
const REJECT_TIME = 900

export interface CheatHooks {
  /** True only while the mission board is the screen in front of the player. */
  active: () => boolean
  /** Clears every mission, stocks the wallet, then redraws the menus. */
  unlockAll: () => void
}

interface Prompt {
  overlay: HTMLElement
  box: HTMLElement
  input: HTMLInputElement
  error: HTMLElement
}

function buildPrompt(): Prompt {
  const overlay = document.createElement('div')
  overlay.className =
    'fixed inset-0 z-50 hidden items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300'

  const box = document.createElement('div')
  box.className =
    'w-[min(420px,90vw)] rounded-2xl bg-slate-950/95 p-6 text-center ring-2 ring-emerald-400/60'
  box.innerHTML = `
    <h3 class="text-sm font-black uppercase tracking-widest text-emerald-300">
      Enter Developer Access Code:
    </h3>
  `

  const input = document.createElement('input')
  input.type = 'password'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.placeholder = '••••••••'
  input.className =
    'mt-4 w-full rounded-xl bg-black/60 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] text-emerald-200 outline-none ring-1 ring-emerald-400/40 focus:ring-emerald-300'

  const error = document.createElement('div')
  error.className = 'mt-3 h-4 text-xs font-black uppercase tracking-widest text-red-400 opacity-0'
  error.textContent = 'Invalid code'

  const hint = document.createElement('div')
  hint.className = 'mt-2 text-[11px] uppercase tracking-widest text-slate-500'
  hint.textContent = 'Enter to confirm · Esc to cancel'

  box.appendChild(input)
  box.appendChild(error)
  box.appendChild(hint)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
  return { overlay, box, input, error }
}

export function bindCheatCodes(hooks: CheatHooks) {
  let prompt: Prompt | null = null
  let open = false
  let typed = ''

  const close = () => {
    if (!prompt) return
    open = false
    prompt.overlay.classList.add('hidden')
    prompt.overlay.classList.remove('flex')
    prompt.overlay.style.opacity = '1'
    prompt.input.value = ''
  }

  const reject = () => {
    if (!prompt) return
    const { box, error, overlay } = prompt
    error.style.opacity = '1'
    box.classList.remove('cheat-shake')
    // Restarting the animation needs a reflow between the two class writes.
    void box.offsetWidth
    box.classList.add('cheat-shake')
    overlay.style.opacity = '0'
    window.setTimeout(() => {
      box.classList.remove('cheat-shake')
      error.style.opacity = '0'
      close()
    }, REJECT_TIME)
  }

  const submit = () => {
    if (!prompt) return
    if (prompt.input.value.trim() !== ACCESS_CODE) {
      reject()
      return
    }
    close()
    hooks.unlockAll()
  }

  const openPrompt = () => {
    if (!prompt) {
      prompt = buildPrompt()
      prompt.input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') submit()
        else if (e.key === 'Escape') close()
      })
      prompt.overlay.addEventListener('click', (e) => {
        if (e.target === prompt?.overlay) close()
      })
    }
    open = true
    typed = ''
    prompt.error.style.opacity = '0'
    prompt.overlay.style.opacity = '1'
    prompt.overlay.classList.remove('hidden')
    prompt.overlay.classList.add('flex')
    prompt.input.value = ''
    prompt.input.focus()
  }

  window.addEventListener('keydown', (e) => {
    if (open || e.ctrlKey || e.metaKey || e.altKey) return
    if (!hooks.active()) {
      typed = ''
      return
    }
    if (e.key.length !== 1) return
    typed = (typed + e.key.toLowerCase()).slice(-TRIGGER.length)
    if (typed === TRIGGER) openPrompt()
  })
}
