// Solution-based procedural generator using reverse-parking insertion.
//
// Algorithm:
//   1. Start from an empty grid.
//   2. Repeatedly insert a vehicle by "sliding it in" from an edge: its body
//      cells AND the cells between its front edge and that border must be empty.
//      The vehicle faces toward the border it entered from.
//   3. The valid exit (solution) order is the REVERSE of the insertion order:
//      a vehicle's forward path was clear when inserted, and only later
//      insertions can block it, so removing in reverse always keeps it clear.
//   4. Build the passenger queue from the solution order + capacities so the
//      level is solvable while still applying boarding-zone slot pressure.
//   5. Validate with an internal solver simulation; regenerate on failure.

import {
  SIZE_DEFS,
  COLOR_KEYS,
  type ColorKey,
  type Facing,
  type Level,
  type Orientation,
  type SizeKey,
  type Vehicle,
} from './types'
import {
  makeGrid,
  place,
  remove,
  exitClear,
  bodyEmpty,
  frontPath,
  type Grid,
} from './GridLogic'

// ---- deterministic-ish RNG (mulberry32) so a level id is reproducible ----
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface BandParams {
  size: number
  sizes: SizeKey[]
  colorCount: number
  occupancy: number // target fraction of cells filled
}

function paramsFor(level: number): BandParams {
  // Intro
  if (level <= 15) {
    const colorCount = level <= 3 ? 2 : level <= 8 ? 3 : 4
    const occupancy = 0.3 + (level / 15) * 0.18
    return { size: 6, sizes: ['car'], colorCount, occupancy }
  }
  // Intermediate
  if (level <= 45) {
    const occupancy = 0.46 + ((level - 15) / 30) * 0.16
    return { size: 7, sizes: ['car', 'bus'], colorCount: 4, occupancy }
  }
  // Hard
  if (level <= 80) {
    const occupancy = 0.6 + ((level - 45) / 35) * 0.18
    return { size: 8, sizes: ['car', 'bus', 'long'], colorCount: 4, occupancy }
  }
  // Expert
  const occupancy = 0.8 + ((level - 80) / 20) * 0.15
  return { size: 9, sizes: ['car', 'bus', 'long'], colorCount: 4, occupancy }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length) % arr.length]
}

interface Placement {
  orientation: Orientation
  facing: Facing
  row: number
  col: number
}

// Enumerate every legal slide-in placement for a given size, then pick one.
function findPlacement(g: Grid, length: number, rand: () => number): Placement | null {
  const candidates: Placement[] = []
  const N = g.size
  const probe: Vehicle = {
    id: -1, color: 'red', size: 'car', length, capacity: 0,
    orientation: 'h', facing: 'right', row: 0, col: 0, boarded: 0,
  }

  // Horizontal lanes
  for (let row = 0; row < N; row++) {
    for (let col = 0; col + length <= N; col++) {
      probe.orientation = 'h'
      probe.row = row
      probe.col = col
      if (!bodyEmpty(g, probe)) continue
      // facing right: slides in from the right border
      probe.facing = 'right'
      if (frontPath(g, probe).every((p) => g.cells[p.r * N + p.c] === -1)) {
        candidates.push({ orientation: 'h', facing: 'right', row, col })
      }
      // facing left: slides in from the left border
      probe.facing = 'left'
      if (frontPath(g, probe).every((p) => g.cells[p.r * N + p.c] === -1)) {
        candidates.push({ orientation: 'h', facing: 'left', row, col })
      }
    }
  }
  // Vertical lanes
  for (let col = 0; col < N; col++) {
    for (let row = 0; row + length <= N; row++) {
      probe.orientation = 'v'
      probe.row = row
      probe.col = col
      if (!bodyEmpty(g, probe)) continue
      probe.facing = 'down'
      if (frontPath(g, probe).every((p) => g.cells[p.r * N + p.c] === -1)) {
        candidates.push({ orientation: 'v', facing: 'down', row, col })
      }
      probe.facing = 'up'
      if (frontPath(g, probe).every((p) => g.cells[p.r * N + p.c] === -1)) {
        candidates.push({ orientation: 'v', facing: 'up', row, col })
      }
    }
  }

  if (candidates.length === 0) return null
  return pick(candidates, rand)
}

function chooseSize(sizes: SizeKey[], rand: () => number): SizeKey {
  // Bias toward smaller vehicles so boards stay readable; allow big ones too.
  const weighted: SizeKey[] = []
  for (const s of sizes) {
    const w = s === 'car' ? 3 : s === 'bus' ? 2 : 1
    for (let i = 0; i < w; i++) weighted.push(s)
  }
  return pick(weighted, rand)
}

function buildVehicles(p: BandParams, rand: () => number): Vehicle[] {
  const g = makeGrid(p.size)
  const palette = COLOR_KEYS.slice(0, p.colorCount)
  const targetCells = Math.floor(p.size * p.size * p.occupancy)
  const vehicles: Vehicle[] = []
  let usedCells = 0
  let id = 0
  let fails = 0
  const maxFails = 220

  while (usedCells < targetCells && fails < maxFails) {
    const sizeKey = chooseSize(p.sizes, rand)
    const def = SIZE_DEFS[sizeKey]
    const placement = findPlacement(g, def.length, rand)
    if (!placement) {
      fails++
      continue
    }
    const v: Vehicle = {
      id: id++,
      color: pick(palette, rand),
      size: sizeKey,
      length: def.length,
      capacity: def.capacity,
      orientation: placement.orientation,
      facing: placement.facing,
      row: placement.row,
      col: placement.col,
      boarded: 0,
    }
    place(g, v)
    vehicles.push(v)
    usedCells += def.length
    fails = 0
  }

  return vehicles
}

// Build the passenger queue. Vehicles enter the boarding zone in solution order;
// we keep at most one *active* (unfinished) vehicle per color at a time so the
// boarding rule is unambiguous, and interleave colors across the up-to-4 active
// vehicles to create controlled slot pressure.
function buildQueue(solutionVehicles: Vehicle[], rand: () => number): ColorKey[] {
  interface Slot { color: ColorKey; remaining: number }
  const zone: Slot[] = []
  const queue: ColorKey[] = []
  let ptr = 0
  const n = solutionVehicles.length
  let guard = 0

  while (ptr < n || zone.length > 0) {
    // Bring in vehicles (in solution order) while a slot is free and no vehicle
    // of the same color is currently active.
    while (
      zone.length < 4 &&
      ptr < n &&
      !zone.some((z) => z.color === solutionVehicles[ptr].color)
    ) {
      const v = solutionVehicles[ptr++]
      zone.push({ color: v.color, remaining: v.capacity })
    }
    if (zone.length === 0) break

    const active = zone.filter((z) => z.remaining > 0)
    const choice = active[Math.floor(rand() * active.length) % active.length]
    queue.push(choice.color)
    choice.remaining--
    if (choice.remaining === 0) {
      zone.splice(zone.indexOf(choice), 1)
    }

    if (++guard > 500000) break
  }

  return queue
}

// Independent solver: verify the level fully resolves with no gridlock, using
// only forward exits, a 4-slot boarding zone, and exact-capacity departures.
export function solve(level: Level): boolean {
  const g = makeGrid(level.size)
  const byId = new Map<number, Vehicle>()
  for (const v of level.vehicles) {
    place(g, v)
    byId.set(v.id, v)
  }

  interface ZoneV { v: Vehicle; boarded: number; seq: number }
  const zone: ZoneV[] = []
  const queue = level.queue
  let qi = 0
  let nextExit = 0
  let seq = 0
  let safety = 0
  const totalCap = level.vehicles.reduce((s, v) => s + v.capacity, 0)
  if (totalCap !== queue.length) return false

  const boardFront = (): void => {
    while (qi < queue.length) {
      const c = queue[qi]
      let best: ZoneV | null = null
      for (const z of zone) {
        if (z.v.color !== c || z.boarded >= z.v.capacity) continue
        if (!best || z.boarded > best.boarded || (z.boarded === best.boarded && z.seq < best.seq)) {
          best = z
        }
      }
      if (!best) break
      best.boarded++
      qi++
      if (best.boarded >= best.v.capacity) zone.splice(zone.indexOf(best), 1)
    }
  }

  while (true) {
    if (++safety > 2000000) return false
    boardFront()

    if (qi >= queue.length && zone.length === 0 && nextExit >= level.solutionOrder.length) {
      return true
    }

    let progressed = false
    if (zone.length < 4 && nextExit < level.solutionOrder.length) {
      const v = byId.get(level.solutionOrder[nextExit])
      if (v && exitClear(g, v)) {
        remove(g, v)
        zone.push({ v, boarded: 0, seq: seq++ })
        nextExit++
        progressed = true
      }
    }

    if (!progressed) {
      // No boarding happened and no vehicle could be parked -> stuck.
      return false
    }
  }
}

export function generateLevel(level: number): Level {
  const baseSeed = level * 2654435761
  for (let attempt = 0; attempt < 400; attempt++) {
    const rand = rng(baseSeed + attempt * 0x9e3779b1)
    const p = paramsFor(level)
    const vehicles = buildVehicles(p, rand)
    if (vehicles.length < 2) continue

    // Solution order = reverse of insertion order.
    const solutionOrder = vehicles.map((v) => v.id).reverse()
    const solutionVehicles = solutionOrder.map((id) => vehicles.find((v) => v.id === id)!)

    // Sanity: grid is solvable by forward exits in solution order.
    const g = makeGrid(p.size)
    for (const v of vehicles) place(g, v)
    let gridOk = true
    for (const v of solutionVehicles) {
      if (!exitClear(g, v)) {
        gridOk = false
        break
      }
      remove(g, v)
    }
    if (!gridOk) continue

    const queue = buildQueue(solutionVehicles, rand)
    const candidate: Level = {
      level,
      size: p.size,
      vehicles: vehicles.map((v) => ({ ...v, boarded: 0 })),
      queue,
      solutionOrder,
    }
    if (solve(candidate)) return candidate
  }

  // Extremely defensive fallback: a trivial, always-solvable 2-car level.
  return fallbackLevel(level)
}

function fallbackLevel(level: number): Level {
  const size = 6
  const vehicles: Vehicle[] = [
    { id: 0, color: 'red', size: 'car', length: 2, capacity: 4, orientation: 'h', facing: 'right', row: 1, col: 0, boarded: 0 },
    { id: 1, color: 'blue', size: 'car', length: 2, capacity: 4, orientation: 'h', facing: 'right', row: 3, col: 0, boarded: 0 },
  ]
  const queue: ColorKey[] = [
    'red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue',
  ]
  return { level, size, vehicles, queue, solutionOrder: [1, 0] }
}
