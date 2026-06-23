import type { GameState } from '../types'
import { newGameState, SAVE_VERSION } from '../game/GameState'

const KEY = 'tiny-dew-valley-save-v1'

export function saveState(s: GameState) {
  try {
    s.lastSaved = Date.now()
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage full / unavailable — ignore
  }
}

export function loadState(): { state: GameState; offlineSeconds: number } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GameState>
    if (!parsed || typeof parsed !== 'object') return null
    // Older layouts stored entity positions that no longer fit the island map — start fresh.
    if (parsed.version !== SAVE_VERSION) return null
    const fresh = newGameState()
    // Shallow-merge onto a fresh state so new fields get defaults (forward-compatible).
    const state: GameState = {
      ...fresh,
      ...parsed,
      version: SAVE_VERSION,
      counters: { ...fresh.counters, ...(parsed.counters || {}) },
      itemTotals: { ...(parsed.itemTotals || {}) },
      craftTotals: { ...(parsed.craftTotals || {}) },
      seenItems: { ...(parsed.seenItems || {}) },
      quests: { ...(parsed.quests || {}) },
      buildings: { ...fresh.buildings, ...(parsed.buildings || {}) },
      audio: { ...fresh.audio, ...(parsed.audio || {}) },
    }
    const offlineSeconds = parsed.lastSaved
      ? Math.max(0, Math.min(8 * 3600, (Date.now() - parsed.lastSaved) / 1000))
      : 0
    return { state, offlineSeconds }
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
