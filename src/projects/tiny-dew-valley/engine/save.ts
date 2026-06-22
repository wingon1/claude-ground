import type { GameState } from '../types'
import { stampStore } from './world'

const KEY = 'tiny-dew-valley-save-v1'
export const SAVE_VERSION = 2

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
    // Minimal shape validation; bail to a fresh game if anything is off.
    if (
      !Array.isArray(data.tiles) ||
      !Array.isArray(data.inventory) ||
      typeof data.gold !== 'number' ||
      typeof data.day !== 'number' ||
      !data.player
    ) {
      return null
    }
    if (data.saveVersion !== SAVE_VERSION) {
      // v1 -> v2: re-stamp the rebuilt, open-front store onto the saved
      // world. The store tiles are never player-modified, so this safely
      // upgrades old saves without losing farm progress.
      if (data.saveVersion === 1) {
        stampStore(data.tiles)
        data.saveVersion = SAVE_VERSION
      } else {
        // Unknown/newer version: refuse rather than risk corruption.
        return null
      }
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
