import type { GameState } from '../types'
import { stampStore } from './world'

const KEY = 'tiny-dew-valley-save-v1'
export const SAVE_VERSION = 3

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
      // Refuse unknown/newer saves rather than risk corruption.
      if (data.saveVersion < 1 || data.saveVersion > SAVE_VERSION) return null
      // v1 -> v2: re-stamp the rebuilt, open-front store onto the saved
      // world. Store tiles are never player-modified, so this is safe.
      if (data.saveVersion < 2) stampStore(data.tiles)
      // v2 -> v3: backfill crafting unlock flags added with the workbench.
      const unlockDefaults = {
        seedDiscount: false,
        backpack: false,
        shippingBonus: false,
        fayeStaminaBoost: false,
        workbench: false,
        workshop: false,
      }
      data.unlocks = { ...unlockDefaults, ...(data.unlocks ?? {}) }
      data.saveVersion = SAVE_VERSION
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
