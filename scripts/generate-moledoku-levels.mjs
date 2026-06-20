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
  { difficulty: '8x8', count: 30, seed: 52000 },
  { difficulty: '9x9', count: 30, seed: 62000 },
]

const DIFFICULTY_RULES = {
  '5x5': {
    minSolutions: 2,
    maxSolutions: 10,
    maxSolutionsWithoutSmallRegions: 10,
    minSmallRegions: 1,
    maxSmallRegions: 3,
    smallRegionBudget: 50,
    singletonBudget: 14,
  },
  '6x6': {
    minSolutions: 2,
    maxSolutions: 10,
    maxSolutionsWithoutSmallRegions: 24,
    minSmallRegions: 0,
    maxSmallRegions: 2,
    smallRegionBudget: 50,
    singletonBudget: 6,
  },
  '7x7': {
    minSolutions: 2,
    maxSolutions: 12,
    maxSolutionsWithoutSmallRegions: 36,
    minSmallRegions: 0,
    maxSmallRegions: 1,
    smallRegionBudget: 50,
    singletonBudget: 3,
  },
  // 8x8/9x9: ~70% of stages get a foothold small region (forced, moderately
  // tight solution count) so they stay doable; the remaining ~30% have no
  // small region (budget exhausted) and lean on the bigger board for
  // difficulty, with a generous cap so they still generate quickly.
  '8x8': {
    minSolutions: 2,
    maxSolutions: 40,
    maxSolutionsWithoutSmallRegions: 400,
    minSmallRegions: 1,
    maxSmallRegions: 1,
    smallRegionBudget: 21,
    singletonBudget: 9,
  },
  '9x9': {
    minSolutions: 2,
    maxSolutions: 150,
    maxSolutionsWithoutSmallRegions: 2000,
    minSmallRegions: 1,
    maxSmallRegions: 1,
    smallRegionBudget: 21,
    singletonBudget: 9,
  },
}

const signature = `// moledoku-levels:${JSON.stringify({ version: 12, groups: GROUPS, rules: DIFFICULTY_RULES })}`
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
  if (difficulty === '7x7') return 7
  if (difficulty === '8x8') return 8
  return 9
}

function createSolution(size, rng) {
  const columns = Array.from({ length: size }, (_, index) => index)
  return shuffle(columns, rng).map((col, row) => ({ row, col }))
}

function pickSmallRegionSize(rng, allowSingleton) {
  const candidates = allowSingleton ? [1, 2, 3, 4] : [2, 3, 4]
  return candidates[Math.floor(rng() * candidates.length)]
}

function createRegionTargets(size, rng, rules, allowSingleton, allowSmallRegion) {
  const total = size * size
  const maxRegionSize = Math.ceil(total * 0.46)
  const minDistinctSizes = Math.max(3, Math.ceil(size * 0.6))
  const singletonLimit = allowSingleton ? 1 : 0
  const minSmallRegions = allowSmallRegion ? rules.minSmallRegions : 0
  const maxSmallRegions = allowSmallRegion ? rules.maxSmallRegions : 0

  // Region size targets are the first difficulty gate:
  // 5x5 may keep a few small areas, while larger boards prefer fewer small hints.
  // Small areas and 1-cell areas both use per-difficulty budgets to avoid repetition.
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
    const smallRegionCount = targets.filter((target) => target <= 4).length
    const singletonCount = targets.filter((target) => target === 1).length
    if (
      largest <= maxRegionSize &&
      distinctSizes >= minDistinctSizes &&
      singletonCount <= singletonLimit &&
      smallRegionCount >= minSmallRegions &&
      smallRegionCount <= maxSmallRegions
    ) {
      return shuffle(targets, rng)
    }
  }

  const targets = Array.from({ length: size }, () => 5)
  let smallRegions = 0
  let remaining = total - size * 5

  while (smallRegions < minSmallRegions) {
    const index = smallRegions
    const smallSize = pickSmallRegionSize(rng, allowSingleton && smallRegions === 0)
    targets[index] = smallSize
    remaining += 5 - smallSize
    smallRegions += 1
  }

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

function createRegions(size, solution, rng, rules, allowSingleton, allowSmallRegion) {
  const targetSizes = createRegionTargets(size, rng, rules, allowSingleton, allowSmallRegion)
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

  return (
    rows.size === level.size &&
    cols.size === level.size &&
    regions.size === level.size &&
    level.lockedCats.every((cat) => {
      return level.solution.some((mole) => mole.row === cat.row && mole.col === cat.col)
    })
  )
}

function countSingletonRegions(level) {
  const counts = Array.from({ length: level.size }).fill(0)

  for (const row of level.regions) {
    for (const regionId of row) {
      counts[regionId] += 1
    }
  }

  return counts.filter((count) => count === 1).length
}

function countSmallRegions(level) {
  const counts = Array.from({ length: level.size }).fill(0)

  for (const row of level.regions) {
    for (const regionId of row) {
      counts[regionId] += 1
    }
  }

  return counts.filter((count) => count <= 4).length
}

function canonicalRegionFingerprint(regions) {
  const labels = new Map()
  let nextLabel = 0

  return regions
    .map((row) =>
      row
        .map((regionId) => {
          if (!labels.has(regionId)) {
            labels.set(regionId, nextLabel)
            nextLabel += 1
          }
          return labels.get(regionId)
        })
        .join(','),
    )
    .join('|')
}

function solveLevel(level, limit = 2) {
  const lockedByRow = new Map()
  const usedColumns = new Set()
  const usedRegions = new Set()
  let count = 0

  for (const mole of level.lockedCats) {
    const regionId = level.regions[mole.row][mole.col]
    if (lockedByRow.has(mole.row) || usedColumns.has(mole.col) || usedRegions.has(regionId)) {
      return 0
    }

    lockedByRow.set(mole.row, mole)
    usedColumns.add(mole.col)
    usedRegions.add(regionId)
  }

  const place = (row) => {
    if (count >= limit) return
    if (row === level.size) {
      if (usedRegions.size === level.size) count += 1
      return
    }

    if (lockedByRow.has(row)) {
      place(row + 1)
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

function validateLevel(level, rules, allowSingleton, allowSmallRegion, usedFingerprints) {
  if (level.lockedCats.length > 0) return false
  if (!validateSolution(level) || !validateRegionConnectivity(level)) return false

  const singletonCount = countSingletonRegions(level)
  const smallRegionCount = countSmallRegions(level)
  const minSmallRegions = allowSmallRegion ? rules.minSmallRegions : 0
  const maxSmallRegions = allowSmallRegion ? rules.maxSmallRegions : 0
  if (singletonCount > (allowSingleton ? 1 : 0)) return false
  if (smallRegionCount < minSmallRegions || smallRegionCount > maxSmallRegions) return false

  // Difficulty is controlled by bounded ambiguity instead of fixed moles.
  // Too many solutions feels like guessing; one unique solution pushes the generator
  // back toward obvious 1-cell regions. Each difficulty keeps a narrow solution range.
  const maxSolutions =
    smallRegionCount === 0 ? rules.maxSolutionsWithoutSmallRegions : rules.maxSolutions
  const solutionCount = solveLevel(level, maxSolutions + 1)
  if (solutionCount < rules.minSolutions || solutionCount > maxSolutions) return false

  const fingerprint = canonicalRegionFingerprint(level.regions)
  return !usedFingerprints.has(fingerprint)
}

function createLevel(id, difficulty, seed, allowSingleton, allowSmallRegion, usedFingerprints) {
  const size = sizeForDifficulty(difficulty)
  const rules = DIFFICULTY_RULES[difficulty]

  for (let seedVariant = 0; seedVariant < 360; seedVariant++) {
    const rng = makeRng(seed + seedVariant * 1000003)

    for (let attempt = 0; attempt < 16000; attempt++) {
      const solution = createSolution(size, rng)
      const regions = createRegions(size, solution, rng, rules, allowSingleton, allowSmallRegion)
      if (!regions) continue

      const level = {
        id,
        size,
        difficulty,
        regions,
        solution,
        lockedCats: [],
      }

      if (validateLevel(level, rules, allowSingleton, allowSmallRegion, usedFingerprints)) return level
    }
  }

  throw new Error(`Unable to generate level ${id}`)
}

function buildLevelPack() {
  const levels = []

  for (const group of GROUPS) {
    const rules = DIFFICULTY_RULES[group.difficulty]
    const usedFingerprints = new Set()
    let singletonLevels = 0
    let smallRegionLevels = 0

    for (let index = 0; index < group.count; index++) {
      const levelId = levels.length + 1
      const allowSingleton = singletonLevels < rules.singletonBudget
      const allowSmallRegion = smallRegionLevels < rules.smallRegionBudget
      const level = createLevel(
        levelId,
        group.difficulty,
        group.seed + index * 97,
        allowSingleton,
        allowSmallRegion,
        usedFingerprints,
      )

      if (countSingletonRegions(level) > 0) singletonLevels += 1
      if (countSmallRegions(level) > 0) smallRegionLevels += 1
      usedFingerprints.add(canonicalRegionFingerprint(level.regions))
      levels.push(level)
      if (force) console.log(`Generated level ${levelId} (${group.difficulty})`)
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
  eight: levels.filter((level) => level.difficulty === '8x8').length,
  nine: levels.filter((level) => level.difficulty === '9x9').length,
  noLocks: levels.every((level) => level.lockedCats.length === 0),
  singletonCounts: levels.reduce(
    (counts, level) => {
      const singletonCount = countSingletonRegions(level)
      counts[singletonCount] = (counts[singletonCount] ?? 0) + 1
      return counts
    },
    {},
  ),
  smallRegionCounts: levels.reduce(
    (counts, level) => {
      const smallRegionCount = countSmallRegions(level)
      counts[smallRegionCount] = (counts[smallRegionCount] ?? 0) + 1
      return counts
    },
    {},
  ),
  solutionCounts: levels.reduce(
    (counts, level) => {
      const solutionCount = solveLevel(level, DIFFICULTY_RULES[level.difficulty].maxSolutions + 1)
      counts[solutionCount] = (counts[solutionCount] ?? 0) + 1
      return counts
    },
    {},
  ),
  difficultyRules: DIFFICULTY_RULES,
}

const output = `${signature}
import type { Level } from './gameLogic'

export const generatedLevels = ${JSON.stringify(levels)} satisfies Level[]

export const generatedLevelPackSummary = ${JSON.stringify(summary, null, 2)} as const
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, output)

console.log(
  `Generated ${summary.total} Moledoku levels (${summary.five}/${summary.six}/${summary.seven}/${summary.eight}/${summary.nine})`,
)
