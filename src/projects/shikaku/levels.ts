// Level system — data-driven and extensible.
//
// Each level is one integer seed fed to the reverse-partitioning generator.
// The number of levels in a tier is simply the length of its seed array, so
// adding more levels later is a one-line append here — no UI changes needed.

import { generatePuzzle, type Puzzle } from './engine'

export type TierId = 'easy' | 'normal' | 'hard'

export type Tier = {
  id: TierId
  label: string
  rows: number
  cols: number
  /** Coins awarded the first time each level in this tier is cleared. */
  reward: number
}

export const TIERS: Record<TierId, Tier> = {
  easy: { id: 'easy', label: 'Easy', rows: 5, cols: 5, reward: 10 },
  normal: { id: 'normal', label: 'Normal', rows: 7, cols: 7, reward: 20 },
  hard: { id: 'hard', label: 'Hard', rows: 9, cols: 9, reward: 35 },
}

export const TIER_ORDER: TierId[] = ['easy', 'normal', 'hard']

// 50 fixed seeds per tier. Derived deterministically so the set is stable and
// reproducible, while still looking hand-picked. To add levels, append seeds.
function makeSeeds(base: number, count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    // A simple spread so seeds are distinct and well-mixed across the space.
    out.push(((base + i * 2654435761) >>> 0) ^ ((i + 1) * 40503))
  }
  return out
}

export const SEEDS: Record<TierId, number[]> = {
  easy: makeSeeds(0x1a2b3c4d, 50),
  normal: makeSeeds(0x5e6f7a8b, 50),
  hard: makeSeeds(0x9c0d1e2f, 50),
}

export function levelCount(tier: TierId): number {
  return SEEDS[tier].length
}

/** Build the puzzle for a given tier + zero-based level index. */
export function getLevel(tier: TierId, index: number): Puzzle {
  const { rows, cols } = TIERS[tier]
  const seed = SEEDS[tier][index]
  return generatePuzzle(rows, cols, seed)
}
