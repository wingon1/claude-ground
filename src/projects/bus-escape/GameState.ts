// Owns the live level state + persisted progress.

import type { ColorKey, Level, Vehicle } from './types'
import { makeGrid, place, type Grid } from './GridLogic'

export interface ZoneSlot {
  vehicle: Vehicle
  // `vehicle.boarded` holds the count; seq is the order it entered the zone.
  seq: number
}

export type Status = 'playing' | 'win' | 'fail'

export interface Progress {
  unlocked: number
  completed: Record<number, boolean>
  sound: boolean
  bestMoves: Record<number, number>
}

const STORAGE_KEY = 'bus-escape:progress:v1'
export const MAX_LEVEL = 100
export const ZONE_SLOTS = 4

export function loadProgress(): Progress {
  const fallback: Progress = { unlocked: 1, completed: {}, sound: true, bestMoves: {} }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Progress>
    return {
      unlocked: Math.min(MAX_LEVEL, Math.max(1, parsed.unlocked ?? 1)),
      completed: parsed.completed ?? {},
      sound: parsed.sound ?? true,
      bestMoves: parsed.bestMoves ?? {},
    }
  } catch {
    return fallback
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export class GameState {
  level = 1
  size = 6
  grid: Grid = makeGrid(6)
  vehicles = new Map<number, Vehicle>() // still on the grid
  queue: ColorKey[] = []
  zone: (ZoneSlot | null)[] = new Array(ZONE_SLOTS).fill(null)
  solutionOrder: number[] = []
  status: Status = 'playing'
  inputLocked = false
  moves = 0
  zoneSeq = 0
  progress: Progress

  constructor() {
    this.progress = loadProgress()
  }

  loadLevel(lvl: Level): void {
    this.level = lvl.level
    this.size = lvl.size
    this.grid = makeGrid(lvl.size)
    this.vehicles = new Map()
    for (const v of lvl.vehicles) {
      v.boarded = 0
      this.vehicles.set(v.id, v)
      place(this.grid, v)
    }
    this.queue = lvl.queue.slice()
    this.zone = new Array(ZONE_SLOTS).fill(null)
    this.solutionOrder = lvl.solutionOrder.slice()
    this.status = 'playing'
    this.inputLocked = false
    this.moves = 0
    this.zoneSeq = 0
  }

  freeSlotIndex(): number {
    return this.zone.findIndex((s) => s === null)
  }

  zoneCount(): number {
    return this.zone.reduce((n, s) => n + (s ? 1 : 0), 0)
  }

  gridEmpty(): boolean {
    return this.vehicles.size === 0
  }

  isWin(): boolean {
    return this.gridEmpty() && this.queue.length === 0 && this.zoneCount() === 0
  }

  // Pick the best matching zone vehicle for the front passenger (most boarded,
  // then earliest into the zone). Returns null if none can board it.
  matchForFront(): ZoneSlot | null {
    if (this.queue.length === 0) return null
    const color = this.queue[0]
    let best: ZoneSlot | null = null
    for (const s of this.zone) {
      if (!s) continue
      const v = s.vehicle
      if (v.color !== color || v.boarded >= v.capacity) continue
      if (
        !best ||
        v.boarded > best.vehicle.boarded ||
        (v.boarded === best.vehicle.boarded && s.seq < best.seq)
      ) {
        best = s
      }
    }
    return best
  }

  // Gridlock / dead-end detection.
  isGridlock(): boolean {
    if (this.queue.length === 0) return false
    if (this.matchForFront()) return false
    const color = this.queue[0]
    const slotFree = this.freeSlotIndex() !== -1
    // Could the player still bring a matching vehicle in?
    if (slotFree) {
      for (const v of this.vehicles.values()) {
        if (v.color === color) return false
      }
    }
    return true
  }
}
