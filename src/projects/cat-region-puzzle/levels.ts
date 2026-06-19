import type { Coord, Difficulty, Level } from './gameLogic'
import { solveLevel, validateLevel } from './gameLogic'

type Rng = () => number

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

function makeRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = out[i]
    out[i] = out[j]
    out[j] = temp
  }
  return out
}

function createSolution(size: number, rng: Rng): Coord[] | null {
  const columns = Array.from({ length: size }, (_, index) => index)

  for (let attempt = 0; attempt < 5000; attempt++) {
    const candidate = shuffle(columns, rng)
    let valid = true
    for (let row = 1; row < size; row++) {
      if (Math.abs(candidate[row] - candidate[row - 1]) <= 1) {
        valid = false
        break
      }
    }
    if (valid) return candidate.map((col, row) => ({ row, col }))
  }

  return null
}

function createRegions(size: number, solution: Coord[], rng: Rng): number[][] | null {
  const targetSizes = createRegionTargets(size, rng)
  const regions: number[][] = Array.from({ length: size }, () =>
    Array.from<number>({ length: size }).fill(-1),
  )
  const regionSizes = Array.from<number>({ length: size }).fill(0)

  for (let regionId = 0; regionId < size; regionId++) {
    const seed = solution[regionId]
    regions[seed.row][seed.col] = regionId
    regionSizes[regionId] = 1
  }

  let unassigned = size * size - size

  while (unassigned > 0) {
    const options: { regionId: number; cells: Coord[]; size: number }[] = []

    for (let regionId = 0; regionId < size; regionId++) {
      if (regionSizes[regionId] >= targetSizes[regionId]) continue

      const cells: Coord[] = []
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (regions[row][col] !== regionId) continue

          for (const [dr, dc] of DIRECTIONS) {
            const nextRow = row + dr
            const nextCol = col + dc
            if (
              nextRow >= 0 &&
              nextRow < size &&
              nextCol >= 0 &&
              nextCol < size &&
              regions[nextRow][nextCol] === -1
            ) {
              cells.push({ row: nextRow, col: nextCol })
            }
          }
        }
      }

      if (cells.length > 0) {
        options.push({
          regionId,
          cells,
          size: targetSizes[regionId] - regionSizes[regionId],
        })
      }
    }

    if (options.length === 0) return null

    const largestNeed = Math.max(...options.map((option) => option.size))
    const growing = options.filter((option) => option.size >= largestNeed - 1)
    const selected = growing[Math.floor(rng() * growing.length)]
    const cell = selected.cells[Math.floor(rng() * selected.cells.length)]
    regions[cell.row][cell.col] = selected.regionId
    regionSizes[selected.regionId] += 1
    unassigned -= 1
  }

  return regions
}

function createRegionTargets(size: number, rng: Rng): number[] {
  const targetsBySize: Record<number, number[]> = {
    4: [1, 2, 3, 10],
    5: [1, 2, 3, 8, 11],
    6: [1, 2, 3, 6, 10, 14],
  }

  return shuffle(targetsBySize[size], rng)
}

function sizeForDifficulty(difficulty: Difficulty): number {
  if (difficulty === 'normal') return 4
  if (difficulty === 'hard') return 5
  return 6
}

function createLevel(id: number, difficulty: Difficulty, seed: number): Level {
  const size = sizeForDifficulty(difficulty)
  const rng = makeRng(seed)

  for (let attempt = 0; attempt < 80000; attempt++) {
    const solution = createSolution(size, rng)
    if (!solution) continue

    const regions = createRegions(size, solution, rng)
    if (!regions) continue

    const level: Level = {
      id,
      size,
      difficulty,
      regions,
      solution,
      lockedCats: [],
    }

    if (validateLevel(level)) return level
  }

  throw new Error(`Unable to generate level ${id}`)
}

function buildLevelPack(): Level[] {
  const levels: Level[] = []
  const groups: { difficulty: Difficulty; count: number; seed: number }[] = [
    { difficulty: 'normal', count: 10, seed: 12000 },
    { difficulty: 'hard', count: 10, seed: 22000 },
    { difficulty: 'ultra', count: 10, seed: 32000 },
  ]

  for (const group of groups) {
    for (let index = 0; index < group.count; index++) {
      levels.push(createLevel(levels.length + 1, group.difficulty, group.seed + index * 97))
    }
  }

  return levels
}

export const levels = buildLevelPack()

export const levelPackSummary = {
  total: levels.length,
  normal: levels.filter((level) => level.difficulty === 'normal').length,
  hard: levels.filter((level) => level.difficulty === 'hard').length,
  ultra: levels.filter((level) => level.difficulty === 'ultra').length,
  uniqueSolutions: levels.every((level) => solveLevel(level, 2).count === 1),
  noLocks: levels.every((level) => level.lockedCats.length === 0),
}
