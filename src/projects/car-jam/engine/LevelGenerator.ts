/* ===========================================================================
 * LevelGenerator.ts — procedural, always-solvable stages 1..100 for the
 * color-boarding Car Jam.
 *
 * Solvability by construction
 * ---------------------------
 * 1. Fill a cols×rows lot with coloured cars, each given a seat count.
 * 2. Produce a *dispatch order* that respects reachability: a car can only
 *    leave the lot when every car in front of it in its column is already gone,
 *    so within each column cars are dispatched front (row 0) to back.
 * 3. Build the passenger queue by concatenating, for each car in that dispatch
 *    order, its colour repeated `seats` times.
 *
 * Replaying that same order — pull each car to a slot, board its passengers,
 * let it leave — always clears the queue, so every level is solvable. The
 * player's puzzle is to *find* a working order using only the few boarding
 * slots as a buffer.
 * ========================================================================= */

import type { CarSpec, LevelSpec } from './types'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Cfg = { cols: number; rows: number; colors: number; slots: number; seatMin: number; seatMax: number }

function configFor(level: number): Cfg {
  const L = Math.max(1, Math.min(100, level))
  if (L <= 10) {
    const f = (L - 1) / 9
    return { cols: 3, rows: 2, colors: 2 + Math.round(f), slots: 3, seatMin: 2, seatMax: 3 }
  }
  if (L <= 50) {
    const f = (L - 11) / 39
    return {
      cols: 4 + Math.round(f),
      rows: 3,
      colors: 3 + Math.round(f * 2),
      slots: 3,
      seatMin: 2,
      seatMax: 4,
    }
  }
  const f = (L - 51) / 49
  return {
    cols: 5 + Math.round(f),
    rows: 3 + Math.round(f),
    colors: 5 + Math.round(f * 2),
    slots: 3,
    seatMin: 3,
    seatMax: 4,
  }
}

export function generateLevel(level: number): LevelSpec {
  const cfg = configFor(level)
  const rand = mulberry32(level * 2654435761 + 7)
  const pick = (n: number) => Math.floor(rand() * n)

  // 1. Fill the lot with cars of random colour + seat count.
  const cars: CarSpec[] = []
  const indexByCell = new Map<number, number>()
  for (let col = 0; col < cfg.cols; col++) {
    for (let row = 0; row < cfg.rows; row++) {
      const seats = cfg.seatMin + pick(cfg.seatMax - cfg.seatMin + 1)
      indexByCell.set(col * 100 + row, cars.length)
      cars.push({ col, row, colorIndex: pick(cfg.colors), seats })
    }
  }

  // 2. Reachability-respecting dispatch order: repeatedly pop the front-most
  //    remaining car of a randomly chosen non-empty column.
  const frontRow = new Array(cfg.cols).fill(0)
  const order: number[] = []
  let remaining = cars.length
  while (remaining > 0) {
    const avail: number[] = []
    for (let col = 0; col < cfg.cols; col++) if (frontRow[col] < cfg.rows) avail.push(col)
    const col = avail[pick(avail.length)]
    order.push(indexByCell.get(col * 100 + frontRow[col])!)
    frontRow[col]++
    remaining--
  }

  // 3. Queue = colours of each car in dispatch order, repeated per seat.
  const queue: number[] = []
  for (const idx of order) for (let s = 0; s < cars[idx].seats; s++) queue.push(cars[idx].colorIndex)

  return { level, cols: cfg.cols, rows: cfg.rows, slots: cfg.slots, cars, queue, order }
}
