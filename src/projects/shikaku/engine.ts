// Shikaku core engine — pure, framework-free.
//
// A Shikaku puzzle is an R×C grid with a set of numbered clues. The solver must
// divide the whole grid into axis-aligned rectangles such that every rectangle
// contains exactly one clue and the rectangle's area equals that clue's number.

export type Clue = { r: number; c: number; value: number }

export type Puzzle = {
  rows: number
  cols: number
  clues: Clue[]
}

/** An inclusive rectangle on the grid (top-left .. bottom-right). */
export type Rect = {
  r0: number
  c0: number
  r1: number
  c1: number
}

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — deterministic so levels are reproducible.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Rect helpers
// ---------------------------------------------------------------------------

export function normalizeRect(a: { r: number; c: number }, b: { r: number; c: number }): Rect {
  return {
    r0: Math.min(a.r, b.r),
    c0: Math.min(a.c, b.c),
    r1: Math.max(a.r, b.r),
    c1: Math.max(a.c, b.c),
  }
}

export function rectArea(rect: Rect): number {
  return (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1)
}

export function rectContainsCell(rect: Rect, r: number, c: number): boolean {
  return r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.r1 < b.r0 || a.r0 > b.r1 || a.c1 < b.c0 || a.c0 > b.c1)
}

export function cluesInRect(rect: Rect, clues: Clue[]): Clue[] {
  return clues.filter((cl) => rectContainsCell(rect, cl.r, cl.c))
}

export function rectKey(rect: Rect): string {
  return `${rect.r0},${rect.c0},${rect.r1},${rect.c1}`
}

// ---------------------------------------------------------------------------
// Validation — the "universal truth" win check.
//
// IMPORTANT: this never compares the player's rectangles to any generator seed
// geometry. It only checks the rules, so alternative valid solutions are
// accepted and players can never be soft-locked.
// ---------------------------------------------------------------------------

export type ValidationResult = {
  solved: boolean
  /** Cells covered by exactly one rect (used for "all covered" check). */
  covered: number
  /** True if no cell is covered by more than one rect. */
  noOverlap: boolean
}

export function validateSolution(puzzle: Puzzle, rects: Rect[]): ValidationResult {
  const { rows, cols, clues } = puzzle
  const coverCount = new Array(rows * cols).fill(0)
  let noOverlap = true

  for (const rect of rects) {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        const idx = r * cols + c
        coverCount[idx]++
        if (coverCount[idx] > 1) noOverlap = false
      }
    }
  }

  let covered = 0
  let allCoveredOnce = true
  for (let i = 0; i < coverCount.length; i++) {
    if (coverCount[i] === 1) covered++
    else allCoveredOnce = false
  }

  // Every rect must contain exactly one clue, and its area must equal that clue.
  let everyRectOk = true
  for (const rect of rects) {
    const cs = cluesInRect(rect, clues)
    if (cs.length !== 1 || rectArea(rect) !== cs[0].value) {
      everyRectOk = false
      break
    }
  }

  const solved = allCoveredOnce && noOverlap && everyRectOk && rects.length === clues.length

  return { solved, covered, noOverlap }
}

// ---------------------------------------------------------------------------
// Reverse-partitioning generator (authoring/derivation only).
//
// Start from an empty grid and repeatedly carve a random rectangle out of the
// remaining free space until the whole grid is partitioned into non-overlapping
// rectangles. Each carved rectangle becomes one clue (its area), placed in a
// random cell inside it. A clean full partition is mathematically guaranteed to
// be a solvable Shikaku.
// ---------------------------------------------------------------------------

const MAX_PART_SIDE = 4 // cap rectangle side length to keep puzzles readable
const MAX_PART_AREA = 9 // cap area so clue numbers stay friendly

type Region = Rect & { value: number }

function tryPartition(rows: number, cols: number, rand: () => number): Region[] | null {
  const occupied = new Array(rows * cols).fill(false)
  const regions: Region[] = []
  let remaining = rows * cols
  let guard = rows * cols * 50

  while (remaining > 0) {
    if (guard-- <= 0) return null

    // Find the first free cell (scan order keeps the free space contiguous-ish,
    // which makes full partitions easy to complete).
    let r0 = -1
    let c0 = -1
    for (let i = 0; i < occupied.length && r0 < 0; i++) {
      if (!occupied[i]) {
        r0 = Math.floor(i / cols)
        c0 = i % cols
      }
    }
    if (r0 < 0) break

    // Max width: free run to the right on this row.
    let maxW = 0
    while (c0 + maxW < cols && !occupied[r0 * cols + c0 + maxW]) maxW++
    maxW = Math.min(maxW, MAX_PART_SIDE)

    // Pick a width, then the max height for which that full width stays free.
    const w = 1 + Math.floor(rand() * maxW)

    let maxH = 0
    heightLoop: while (r0 + maxH < rows && maxH < MAX_PART_SIDE) {
      for (let c = c0; c < c0 + w; c++) {
        if (occupied[(r0 + maxH) * cols + c]) break heightLoop
      }
      maxH++
    }
    if (maxH === 0) maxH = 1

    // Constrain height so area stays within the friendly cap.
    const hCap = Math.max(1, Math.floor(MAX_PART_AREA / w))
    const h = 1 + Math.floor(rand() * Math.min(maxH, hCap))

    const r1 = r0 + h - 1
    const c1 = c0 + w - 1
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) occupied[r * cols + c] = true
    }
    remaining -= w * h
    regions.push({ r0, c0, r1, c1, value: w * h })
  }

  return remaining === 0 ? regions : null
}

export function generatePuzzle(rows: number, cols: number, seed: number): Puzzle {
  // Retry with derived sub-seeds until a clean full partition is produced.
  for (let attempt = 0; attempt < 200; attempt++) {
    const rand = mulberry32((seed ^ (attempt * 0x9e3779b1)) >>> 0)
    const regions = tryPartition(rows, cols, rand)
    if (regions) {
      const clues: Clue[] = regions.map((reg) => {
        const w = reg.c1 - reg.c0 + 1
        const h = reg.r1 - reg.r0 + 1
        const off = Math.floor(rand() * (w * h))
        const dr = Math.floor(off / w)
        const dc = off % w
        return { r: reg.r0 + dr, c: reg.c0 + dc, value: reg.value }
      })
      return { rows, cols, clues }
    }
  }
  // Extremely unlikely fallback: trivial 1×1 partition (every cell a clue of 1).
  const clues: Clue[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) clues.push({ r, c, value: 1 })
  }
  return { rows, cols, clues }
}

// ---------------------------------------------------------------------------
// Solver — finds one valid solution. Used by Hint and Magic Wand so they work
// on the universal truth, independent of how the level was authored.
// ---------------------------------------------------------------------------

/** All rectangles that contain exactly the given clue and match its area. */
export function candidateRectsForClue(puzzle: Puzzle, clue: Clue): Rect[] {
  const { rows, cols, clues } = puzzle
  const out: Rect[] = []
  const area = clue.value
  for (let w = 1; w <= cols; w++) {
    if (area % w !== 0) continue
    const h = area / w
    if (h > rows) continue
    // top-left positions such that the rect covers (clue.r, clue.c)
    for (let r0 = Math.max(0, clue.r - h + 1); r0 <= Math.min(clue.r, rows - h); r0++) {
      for (let c0 = Math.max(0, clue.c - w + 1); c0 <= Math.min(clue.c, cols - w); c0++) {
        const rect: Rect = { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 }
        if (cluesInRect(rect, clues).length === 1) out.push(rect)
      }
    }
  }
  return out
}

/**
 * Backtracking solver. Returns a map from clue index to its solved Rect, or
 * null if (somehow) unsolvable. Honours `fixed` rects already placed by the
 * player so Hint/Wand suggest completions consistent with the current board.
 */
export function solvePuzzle(puzzle: Puzzle, fixed?: Map<number, Rect>): Map<number, Rect> | null {
  const { rows, cols, clues } = puzzle
  const cover = new Array(rows * cols).fill(false)
  const result = new Map<number, Rect>()

  const place = (rect: Rect, on: boolean) => {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) cover[r * cols + c] = on
    }
  }
  const fits = (rect: Rect) => {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) if (cover[r * cols + c]) return false
    }
    return true
  }

  // Pre-place fixed rects.
  if (fixed) {
    for (const [idx, rect] of fixed) {
      if (!fits(rect)) return null
      place(rect, true)
      result.set(idx, rect)
    }
  }

  // Order clues by fewest candidates first (most-constrained heuristic).
  const order = clues
    .map((_, i) => i)
    .filter((i) => !result.has(i))
    .map((i) => ({ i, cands: candidateRectsForClue(puzzle, clues[i]) }))
    .sort((a, b) => a.cands.length - b.cands.length)

  const dfs = (k: number): boolean => {
    if (k === order.length) {
      // All clues placed; a full partition means every cell is covered.
      return cover.every(Boolean)
    }
    const { i, cands } = order[k]
    for (const rect of cands) {
      if (!fits(rect)) continue
      place(rect, true)
      result.set(i, rect)
      if (dfs(k + 1)) return true
      result.delete(i)
      place(rect, false)
    }
    return false
  }

  return dfs(0) ? result : null
}
