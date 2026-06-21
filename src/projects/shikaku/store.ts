// Persistent meta-game state (coins, owned themes, progress) in localStorage.

import { levelCount, TIER_ORDER, type TierId } from './levels'
import { DEFAULT_THEME, type ThemeId } from './themes'

const KEY = 'shikaku.save.v1'

export type SaveState = {
  coins: number
  ownedThemes: ThemeId[]
  activeTheme: ThemeId
  /** progress[tier][index] === true once that level has been cleared. */
  progress: Record<TierId, boolean[]>
  sound: boolean
  /** True once the first-run tutorial has been shown/dismissed. */
  tutorialSeen: boolean
}

function emptyProgress(): Record<TierId, boolean[]> {
  const p = {} as Record<TierId, boolean[]>
  for (const t of TIER_ORDER) p[t] = new Array(levelCount(t)).fill(false)
  return p
}

export function defaultState(): SaveState {
  return {
    coins: 0,
    ownedThemes: [DEFAULT_THEME],
    activeTheme: DEFAULT_THEME,
    progress: emptyProgress(),
    sound: true,
    tutorialSeen: false,
  }
}

/** Grow/repair progress arrays so they always match the current level counts. */
function reconcile(state: SaveState): SaveState {
  for (const t of TIER_ORDER) {
    const want = levelCount(t)
    const arr = state.progress[t] ?? []
    if (arr.length < want) {
      state.progress[t] = arr.concat(new Array(want - arr.length).fill(false))
    } else {
      state.progress[t] = arr
    }
  }
  if (!state.ownedThemes.includes(DEFAULT_THEME)) state.ownedThemes.push(DEFAULT_THEME)
  return state
}

export function loadState(): SaveState {
  if (typeof localStorage === 'undefined') return defaultState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<SaveState>
    return reconcile({ ...defaultState(), ...parsed, progress: { ...emptyProgress(), ...(parsed.progress ?? {}) } })
  } catch {
    return defaultState()
  }
}

export function saveState(state: SaveState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function clearedCount(state: SaveState, tier: TierId): number {
  return state.progress[tier].filter(Boolean).length
}
