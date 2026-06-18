/* ===========================================================================
 * LevelGenerator.ts — procedural, always-solvable stages for the slide-out +
 * boarding Car Jam.
 *
 * Reverse-parking construction
 * ----------------------------
 * Cars are added by *undoing* an extraction. Each new car is slid into the lot
 * from its exit edge (top for vertical cars, left for horizontal) to a spot
 * whose straight path back to that edge is currently empty — i.e. it could have
 * just driven out that way.
 *
 * Removing cars in reverse insertion order therefore always succeeds: a car's
 * exit lane was clear of the cars present when it was inserted, and every car
 * added afterwards (which might block it) is removed first. The passenger queue
 * is then built by walking that extraction order and emitting each car's colour
 * once per seat — so replaying the order clears the queue. Every level is
 * winnable by construction; the player's job is to find a working order while
 * cars of different sizes jam each other in.
 * ========================================================================= */

import type { CarSpec, LevelSpec, Orient } from './types'

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

type Cfg = { cols: number; rows: number; target: number; colors: number; minLen: number; maxLen: number }

function configFor(level: number): Cfg {
  const L = Math.max(1, Math.min(100, level))
  if (L <= 10) {
    const f = (L - 1) / 9
    return { cols: 4, rows: 4, target: 4 + Math.round(f * 2), colors: 2 + Math.round(f), minLen: 2, maxLen: 2 }
  }
  if (L <= 50) {
    const f = (L - 11) / 39
    return {
      cols: 5,
      rows: 5,
      target: 7 + Math.round(f * 4),
      colors: 3 + Math.round(f),
      minLen: 2,
      maxLen: 3,
    }
  }
  const f = (L - 51) / 49
  return {
    cols: 6,
    rows: 6,
    target: 12 + Math.round(f * 5),
    colors: 4 + Math.round(f * 2),
    minLen: 2,
    maxLen: 4,
  }
}

/** Build one candidate layout (reverse insertion). */
function pack(cfg: Cfg, seed: number): CarSpec[] {
  const rand = mulberry32(seed)
  const pick = (n: number) => Math.floor(rand() * n)
  const { cols: C, rows: R } = cfg
  const occ = new Int16Array(C * R).fill(-1)
  const idx = (c: number, r: number) => r * C + c
  const free = (c: number, r: number) => occ[idx(c, r)] === -1

  const cars: CarSpec[] = []
  const maxAttempts = cfg.target * 120
  let attempts = 0

  while (cars.length < cfg.target && attempts < maxAttempts) {
    attempts++
    const orient: Orient = rand() < 0.5 ? 'h' : 'v'
    const span = orient === 'h' ? C : R
    const maxLen = Math.min(cfg.maxLen, span)
    const length = cfg.minLen + pick(maxLen - cfg.minLen + 1)
    const lane = pick(orient === 'h' ? R : C)

    // valid anchors: final cells empty AND path back to the exit edge empty.
    // Since the car slides in from the edge (anchor 0 side), requiring cells
    // [0 .. anchor+length-1] of the lane to be empty covers both.
    const candidates: number[] = []
    for (let a = 0; a <= span - length; a++) {
      let ok = true
      for (let p = 0; p < a + length; p++) {
        const c = orient === 'h' ? p : lane
        const r = orient === 'h' ? lane : p
        if (!free(c, r)) {
          ok = false
          break
        }
      }
      if (ok) candidates.push(a)
    }
    if (candidates.length === 0) continue

    // prefer deeper spots (away from the edge) to crowd the lot
    candidates.sort((p, q) => q - p)
    const a = candidates[pick(Math.min(candidates.length, 3))]
    const colorIndex = pick(cfg.colors)
    for (let i = 0; i < length; i++) {
      const c = orient === 'h' ? a + i : lane
      const r = orient === 'h' ? lane : a + i
      occ[idx(c, r)] = cars.length
    }
    cars.push({ orient, length, anchor: a, lane, colorIndex })
  }
  return cars
}

export function generateLevel(level: number): LevelSpec {
  const cfg = configFor(level)
  // keep the densest of a few deterministic candidates
  const tries = level <= 10 ? 4 : 10
  let best: CarSpec[] = []
  let bestFill = -1
  for (let k = 0; k < tries; k++) {
    const cars = pack(cfg, (level * 2654435761 + 17 + k * 40503) >>> 0)
    const fill = cars.reduce((s, c) => s + c.length, 0)
    if (fill > bestFill) {
      bestFill = fill
      best = cars
    }
  }

  // extraction order = reverse of insertion; queue = colours per seat
  const order: number[] = []
  for (let i = best.length - 1; i >= 0; i--) order.push(i)
  const queue: number[] = []
  for (const i of order) for (let s = 0; s < best[i].length; s++) queue.push(best[i].colorIndex)

  return { level, cols: cfg.cols, rows: cfg.rows, bays: 3, cars: best, queue, order }
}
