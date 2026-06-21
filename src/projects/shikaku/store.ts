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
  /** Last nickname used on the leaderboard. */
  nickname: string
  /** Anonymous, stable per-device id (for "your best" highlighting). */
  deviceId: string
  /** Personal best time-attack score per tier. */
  bestScores: Record<TierId, number>
}

function emptyProgress(): Record<TierId, boolean[]> {
  const p = {} as Record<TierId, boolean[]>
  for (const t of TIER_ORDER) p[t] = new Array(levelCount(t)).fill(false)
  return p
}

function emptyBest(): Record<TierId, number> {
  const b = {} as Record<TierId, number>
  for (const t of TIER_ORDER) b[t] = 0
  return b
}

function makeDeviceId(): string {
  return 'd_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function defaultState(): SaveState {
  return {
    coins: 0,
    ownedThemes: [DEFAULT_THEME],
    activeTheme: DEFAULT_THEME,
    progress: emptyProgress(),
    sound: true,
    tutorialSeen: false,
    nickname: '',
    deviceId: makeDeviceId(),
    bestScores: emptyBest(),
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
  state.bestScores = { ...emptyBest(), ...(state.bestScores ?? {}) }
  if (!state.deviceId) state.deviceId = makeDeviceId()
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
