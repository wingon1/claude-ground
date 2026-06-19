import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const GROUPS = [
  { difficulty: '5x5', count: 50, seed: 22000 },
  { difficulty: '6x6', count: 50, seed: 32000 },
  { difficulty: '7x7', count: 50, seed: 42000 },
]

const signature = `// moledoku-levels:${JSON.stringify({ version: 1, groups: GROUPS })}`
const force = process.argv.includes('--force')
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/projects/cat-region-puzzle/generatedLevels.ts',
)

if (!force) {
  try {
    const current = await readFile(outputPath, 'utf8')
    if (current.startsWith(signature)) {
      console.log('Moledoku levels already generated')
      process.exit(0)
    }
  } catch {
    // Missing generated file; continue and create it.
  }
}

function makeRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffle(items, rng) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = out[i]
    out[i] = out[j]
    out[j] = temp
  }
  return out
}

function coordKey(coord) {
  return `${coord.row}:${coord.col}`
}

function sizeForDifficulty(difficulty) {
  if (difficulty === '5x5') return 5
  if (difficulty === '6x6') return 6
  return 7
}

function createSolution(size, rng) {
  const columns = Array.from({ length: size }, (_, index) => index)
  return shuffle(columns, rng).map((col, row) => ({ row, col }))
}

function createRegionTargets(size, rng) {
  const total = size * size
  const maxRegionSize = Math.ceil(total * 0.46)
  const minDistinctSizes = Math.max(3, Math.ceil(size * 0.6))

  for (let attempt = 0; attempt < 500; attempt++) {
    const cuts = new Set()
    while (cuts.size < size - 1) {
      cuts.add(1 + Math.floor(rng() * (total - 1)))
    }

    const sortedCuts = [0, ...[...cuts].sort((a, b) => a - b), total]
    const targets = Array.from({ length: size }, (_, index) => {
      return sortedCuts[index + 1] - sortedCuts[index]
    })

    const largest = Math.max(...targets)
    const distinctSizes = new Set(targets).size
    if (largest <= maxRegionSize && distinctSizes >= minDistinctSizes) {
      return shuffle(targets, rng)
    }
  }

  const targets = Array.from({ length: size }, () => 1)
  let remaining = total - size
  while (remaining > 0) {
    const candidates = targets
      .map((target, index) => ({ target, index }))
      .filter((item) => item.target < maxRegionSize)
    const selected = candidates[Math.floor(rng() * candidates.length)]
    selected.target += 1
    targets[selected.index] += 1
    remaining -= 1
  }

  return shuffle(targets, rng)
}

function createRegions(size, solution, rng) {
  const targetSizes = createRegionTargets(size, rng)
  const regions = Array.from({ length: size }, () => Array.from({ length: size }).fill(-1))
  const regionSizes = Array.from({ length: size }).fill(0)

  for (let regionId = 0; regionId < size; regionId++) {
    const seed = solution[regionId]
    regions[seed.row][seed.col] = regionId
    regionSizes[regionId] = 1
  }

  let unassigned = size * size - size

  while (unassigned > 0) {
    const options = []

    for (let regionId = 0; regionId < size; regionId++) {
      if (regionSizes[regionId] >= targetSizes[regionId]) continue

      const cells = []
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

function getRegionCells(level, regionId) {
  const cells = []
  for (let row = 0; row < level.size; row++) {
    for (let col = 0; col < level.size; col++) {
      if (level.regions[row][col] === regionId) cells.push({ row, col })
    }
  }
  return cells
}

function validateRegionConnectivity(level) {
  for (let regionId = 0; regionId < level.size; regionId++) {
    const cells = getRegionCells(level, regionId)
    if (cells.length === 0) return false

    const cellKeys = new Set(cells.map(coordKey))
    const seen = new Set()
    const queue = [cells[0]]
    seen.add(coordKey(cells[0]))

    while (queue.length > 0) {
      const current = queue.shift()
      for (const [dr, dc] of DIRECTIONS) {
        const next = { row: current.row + dr, col: current.col + dc }
        const key = coordKey(next)
        if (cellKeys.has(key) && !seen.has(key)) {
          seen.add(key)
          queue.push(next)
        }
      }
    }

    if (seen.size !== cells.length) return false
  }

  return true
}

function validateSolution(level) {
  const rows = new Set()
  const cols = new Set()
  const regions = new Set()

  for (const mole of level.solution) {
    rows.add(mole.row)
    cols.add(mole.col)
    regions.add(level.regions[mole.row][mole.col])
  }

  return rows.size === level.size && cols.size === level.size && regions.size === level.size
}

function solveLevel(level, limit = 2) {
  const usedColumns = new Set()
  const usedRegions = new Set()
  let count = 0

  const place = (row) => {
    if (count >= limit) return
    if (row === level.size) {
      if (usedRegions.size === level.size) count += 1
      return
    }

    for (let col = 0; col < level.size; col++) {
      const regionId = level.regions[row][col]
      if (usedColumns.has(col) || usedRegions.has(regionId)) continue

      usedColumns.add(col)
      usedRegions.add(regionId)
      place(row + 1)
      usedColumns.delete(col)
      usedRegions.delete(regionId)

      if (count >= limit) return
    }
  }

  place(0)
  return count
}

function validateLevel(level) {
  return validateSolution(level) && validateRegionConnectivity(level) && solveLevel(level, 2) === 1
}

function createLevel(id, difficulty, seed) {
  const size = sizeForDifficulty(difficulty)
  const rng = makeRng(seed)

  for (let attempt = 0; attempt < 80000; attempt++) {
    const solution = createSolution(size, rng)
    const regions = createRegions(size, solution, rng)
    if (!regions) continue

    const level = {
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

function buildLevelPack() {
  const levels = []

  for (const group of GROUPS) {
    for (let index = 0; index < group.count; index++) {
      levels.push(createLevel(levels.length + 1, group.difficulty, group.seed + index * 97))
    }
  }

  return levels
}

const levels = buildLevelPack()
const summary = {
  total: levels.length,
  five: levels.filter((level) => level.difficulty === '5x5').length,
  six: levels.filter((level) => level.difficulty === '6x6').length,
  seven: levels.filter((level) => level.difficulty === '7x7').length,
  unique: levels.every((level) => solveLevel(level, 2) === 1),
  noLocks: levels.every((level) => level.lockedCats.length === 0),
}

const output = `${signature}
import type { Level } from './gameLogic'

export const generatedLevels = ${JSON.stringify(levels)} satisfies Level[]

export const generatedLevelPackSummary = ${JSON.stringify(summary, null, 2)} as const
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, output)

console.log(
  `Generated ${summary.total} Moledoku levels (${summary.five}/${summary.six}/${summary.seven})`,
)
