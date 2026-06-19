// Owns the live level state + persisted progress.

import { SIZE_DEFS, COLOR_KEYS, type ColorKey, type Level, type SizeKey, type Vehicle } from './types'
import { makeGrid, place, type Grid } from './GridLogic'
import { findParkingPlacement } from './LevelGenerator'

export interface ZoneSlot {
  vehicle: Vehicle
  // `vehicle.boarded` holds the count; seq is the order it entered the zone.
  seq: number
  // false while the vehicle is still driving into the slot — it can't board yet.
  arrived: boolean
}

export type Status = 'playing' | 'win' | 'fail'

export interface Progress {
  unlocked: number
  completed: Record<number, boolean>
  sound: boolean
  bestMoves: Record<number, number>
  bestEndless: number
}

export type Mode = 'levels' | 'endless'

const STORAGE_KEY = 'bus-escape:progress:v1'
export const MAX_LEVEL = 100
export const ZONE_SLOTS = 4
export const ENDLESS_SIZE = 7
export const HOLDING_COUNT = 5
const QUEUE_TARGET = 18
const ENDLESS_FILL = 0.6 // starting parking-lot density (looks full, stays playable)

export function loadProgress(): Progress {
  const fallback: Progress = { unlocked: 1, completed: {}, sound: true, bestMoves: {}, bestEndless: 0 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Progress>
    return {
      unlocked: Math.min(MAX_LEVEL, Math.max(1, parsed.unlocked ?? 1)),
      completed: parsed.completed ?? {},
      sound: parsed.sound ?? true,
      bestMoves: parsed.bestMoves ?? {},
      bestEndless: parsed.bestEndless ?? 0,
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
  // Endless mode
  mode: Mode = 'levels'
  holding: Vehicle[] = [] // incoming cars waiting to park
  score = 0
  endlessSeq = 0

  constructor() {
    this.progress = loadProgress()
  }

  loadLevel(lvl: Level): void {
    this.mode = 'levels'
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

  // ---- endless mode ----------------------------------------------------

  private makeIncoming(palette: ColorKey[]): Vehicle {
    const weighted: SizeKey[] = ['car', 'car', 'car', 'bus', 'bus', 'long']
    const sk = weighted[Math.floor(Math.random() * weighted.length)]
    const def = SIZE_DEFS[sk]
    const color = palette[Math.floor(Math.random() * palette.length)]
    return {
      id: this.endlessSeq++, color, size: sk, length: def.length, capacity: def.capacity,
      orientation: 'h', facing: 'right', row: 0, col: 0, boarded: 0,
    }
  }

  startEndless(): void {
    this.mode = 'endless'
    this.size = ENDLESS_SIZE
    this.grid = makeGrid(ENDLESS_SIZE)
    this.vehicles = new Map()
    this.zone = new Array(ZONE_SLOTS).fill(null)
    this.queue = []
    this.holding = []
    this.score = 0
    this.zoneSeq = 0
    this.endlessSeq = 0
    this.moves = 0
    this.status = 'playing'
    this.inputLocked = false
    const palette = COLOR_KEYS.slice(0, 6)
    this.fillLot(palette)
    for (let i = 0; i < HOLDING_COUNT; i++) this.holding.push(this.makeIncoming(palette))
    this.refillQueue()
  }

  // Pre-fill the parking lot with cars (reverse-park insertion → at least one
  // car is always exitable, so the start is never instantly gridlocked).
  private fillLot(palette: ColorKey[]): void {
    const target = Math.floor(this.size * this.size * ENDLESS_FILL)
    let used = 0
    let fails = 0
    while (used < target && fails < 200) {
      const v = this.makeIncoming(palette)
      const pl = findParkingPlacement(this.grid, v.length, Math.random)
      if (!pl) {
        fails++
        continue
      }
      v.orientation = pl.orientation
      v.facing = pl.facing
      v.row = pl.row
      v.col = pl.col
      place(this.grid, v)
      this.vehicles.set(v.id, v)
      used += v.length
      fails = 0
    }
  }

  // Colors currently in play, so spawned passengers are always serveable.
  activeColors(): ColorKey[] {
    const set = new Set<ColorKey>()
    for (const v of this.holding) set.add(v.color)
    for (const v of this.vehicles.values()) set.add(v.color)
    for (const s of this.zone) if (s) set.add(s.vehicle.color)
    return [...set]
  }

  refillQueue(): void {
    // Passengers are drawn from colours actually present in play (grid + zone +
    // holding), weighted by how many cars of each colour exist. A long visible
    // line builds up; if you fill the slots with the wrong colours you can still
    // gridlock (handled as game over).
    const pool: ColorKey[] = []
    for (const v of this.vehicles.values()) pool.push(v.color)
    for (const s of this.zone) if (s) pool.push(s.vehicle.color)
    for (const v of this.holding) pool.push(v.color)
    if (pool.length === 0) return
    while (this.queue.length < QUEUE_TARGET) {
      this.queue.push(pool[Math.floor(Math.random() * pool.length)])
    }
  }

  addIncoming(): void {
    if (this.holding.length >= HOLDING_COUNT) return
    const palette = COLOR_KEYS.slice(0, 6)
    this.holding.push(this.makeIncoming(palette))
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
      if (!s || !s.arrived) continue
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
