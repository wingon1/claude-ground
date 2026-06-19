/* ===========================================================================
 * LevelGenerator.ts — procedural, 100% solvable stages 1..100.
 *
 * Reverse-parking algorithm
 * -------------------------
 * Levels are built by *undoing* a solution rather than authoring a puzzle and
 * hoping it's solvable. We add cars one at a time; each new car is placed at a
 * position from which the straight path to the single forward exit edge is
 * currently empty (i.e. it could have just driven in from that edge).
 *
 * Insertion order is the reverse of a valid solution: removing cars in
 * last-in-first-out order always succeeds, because a car's exit path was clear
 * when it was inserted and every car added *after* it (which might block that
 * path) is removed first. Hence every generated level is guaranteed solvable.
 *
 * Difficulty uses a hard early ramp, then high-density plateaus. The one-way
 * exit rule is stricter than the old two-edge escape rule, so target counts are
 * tuned lower than a fully edge-open board.
 * ========================================================================= */

import type { CarSpec, LevelSpec, Orient } from './types'

/** A small seeded PRNG so a given level always generates the same layout. */
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

type Cfg = { size: number; target: number; truckProb: number }

/** Aggressive early ramp, then high-density plateaus for stable late play. */
function configFor(level: number): Cfg {
  const L = Math.max(1, Math.min(100, level))
  if (L <= 15) {
    const f = (L - 1) / 14 // 0..1
    return { size: 6, target: 8 + Math.round(f * 4), truckProb: 0.12 + f * 0.1 }
  }
  if (L <= 55) {
    return { size: 7, target: 17, truckProb: 0.34 }
  }
  return {
    size: 8,
    target: 23,
    truckProb: 0.42,
  }
}

/** Pack a single candidate layout from a given seed. */
function packCandidate(cfg: Cfg, seed: number): CarSpec[] {
  const rand = mulberry32(seed)
  const N = cfg.size
  const occ = new Int16Array(N * N).fill(-1)

  const idx = (x: number, z: number) => z * N + x
  const free = (x: number, z: number) =>
    x >= 0 && x < N && z >= 0 && z < N && occ[idx(x, z)] === -1
  const cellAt = (o: Orient, a: number, lane: number, i: number): [number, number] =>
    o === 'h' ? [a + i, lane] : [lane, a + i]

  const cars: CarSpec[] = []
  let colorIndex = Math.floor(rand() * 8)

  // Cap attempts so dense levels terminate even when the lot is nearly full.
  // Dense lots reject most random (orient, lane, edge) combos, so give the
  // packing loop a generous budget to actually reach the target car count.
  const maxAttempts = cfg.target * 700
  let attempts = 0

  while (cars.length < cfg.target && attempts < maxAttempts) {
    attempts++
    const length =
      N >= 6 && rand() < cfg.truckProb && N - 3 >= 0 ? 3 : 2
    const orient: Orient = rand() < 0.5 ? 'h' : 'v'
    const lane = Math.floor(rand() * N)

    // Collect anchors where the car fits AND its path to the single exit edge is clear.
    const candidates: number[] = []
    for (let a = 0; a <= N - length; a++) {
      // final cells must be empty
      let fits = true
      for (let i = 0; i < length; i++) {
        const [x, z] = cellAt(orient, a, lane, i)
        if (!free(x, z)) {
          fits = false
          break
        }
      }
      if (!fits) continue

      // path to the high edge must be empty; low-edge exits are not valid
      let clear = true
      for (let p = a + length; p < N; p++) {
        const [x, z] = cellAt(orient, p, lane, 0)
        if (!free(x, z)) {
          clear = false
          break
        }
      }
      if (clear) candidates.push(a)
    }

    if (candidates.length === 0) continue

    // Prefer deeper positions (away from the entry edge) to crowd the interior.
    candidates.sort((p, q) => {
      const dp = N - length - p
      const dq = N - length - q
      return dq - dp
    })
    const pick = candidates[Math.floor(rand() * Math.min(candidates.length, 2))]

    const id = cars.length
    for (let i = 0; i < length; i++) {
      const [x, z] = cellAt(orient, pick, lane, i)
      occ[idx(x, z)] = id
    }
    cars.push({ length, orient, anchor: pick, lane, colorIndex: colorIndex % 8 })
    colorIndex++
  }

  return cars
}

export function generateLevel(level: number): LevelSpec {
  const cfg = configFor(level)
  // Reverse-packing is seed-sensitive: some seeds paint into a low-density
  // corner. Generate several deterministic candidates and keep the densest so
  // late levels reliably approach a full lot. More tries for harder levels.
  const tries = level <= 15 ? 18 : level <= 55 ? 28 : 36
  let best: CarSpec[] = []
  let bestFill = -1
  for (let k = 0; k < tries; k++) {
    const seed = (level * 2654435761 + 12345 + k * 40503) >>> 0
    const cars = packCandidate(cfg, seed)
    const fill = cars.reduce((a, c) => a + c.length, 0)
    if (fill > bestFill) {
      bestFill = fill
      best = cars
    }
  }
  return { level, size: cfg.size, cars: best }
}
