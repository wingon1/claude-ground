import type { GameState } from '../types'

const KEY = 'tiny-dew-valley-save-v1'
// v4: cozy-island-style core loop (tap-to-move, auto-work, sleep-to-grow).
// v5: gated build/cooking menus plus construction-driven field expansion.
// v6: plot signs, row-by-row land purchases, assigned auto-replant crops.
// The state shape changed completely, so older saves are dropped on load.
export const SAVE_VERSION = 6

export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) != null
  } catch {
    return false
  }
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

// Returns a validated state, or null if missing/corrupt/incompatible.
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as GameState
    if (!data || typeof data !== 'object') return null
    if (
      data.saveVersion !== SAVE_VERSION ||
      !Array.isArray(data.tiles) ||
      !Array.isArray(data.inventory) ||
      typeof data.gold !== 'number' ||
      !data.player
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
