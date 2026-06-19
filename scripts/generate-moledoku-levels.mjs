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

const signature = `// moledoku-levels:${JSON.stringify({ version: 4, groups: GROUPS })}`
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

const BASE_REGION_PATTERNS = {
  5: [
    [0, 1, 1, 2, 2],
    [1, 1, 2, 2, 4],
    [1, 3, 2, 3, 4],
    [3, 3, 3, 3, 4],
    [3, 3, 4, 4, 4],
  ],
  6: [
    [0, 1, 2, 2, 3, 3],
    [1, 1, 2, 3, 3, 4],
    [1, 2, 2, 3, 4, 4],
    [1, 2, 3, 3, 4, 5],
    [4, 4, 4, 4, 4, 5],
    [4, 5, 5, 5, 5, 5],
  ],
  7: [
    [0, 1, 1, 3, 6, 6, 6],
    [1, 1, 2, 3, 3, 5, 6],
    [1, 2, 2, 3, 5, 5, 6],
    [2, 2, 3, 3, 5, 5, 6],
    [4, 4, 4, 4, 4, 5, 6],
    [6, 6, 6, 5, 5, 5, 6],
    [6, 6, 6, 6, 6, 6, 6],
  ],
}

function cloneRegions(regions) {
  return regions.map((row) => [...row])
}

function transformCoord(coord, size, transformId) {
  const last = size - 1
  const { row, col } = coord

  if (transformId === 1) return { row: col, col: last - row }
  if (transformId === 2) return { row: last - row, col: last - col }
  if (transformId === 3) return { row: last - col, col: row }
  if (transformId === 4) return { row, col: last - col }
  if (transformId === 5) return { row: last - row, col }
  if (transformId === 6) return { row: col, col: row }
  if (transformId === 7) return { row: last - col, col: last - row }
  return { row, col }
}

function transformRegions(regions, transformId) {
  const size = regions.length
  const transformed = Array.from({ length: size }, () => Array.from({ length: size }).fill(0))

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const next = transformCoord({ row, col }, size, transformId)
      transformed[next.row][next.col] = regions[row][col]
    }
  }

  return transformed
}

function relabelRegions(regions, rng) {
  const labels = shuffle(
    Array.from({ length: regions.length }, (_, index) => index),
    rng,
  )

  return regions.map((row) => row.map((regionId) => labels[regionId]))
}

function createPatternSolution(size, transformId) {
  return Array.from({ length: size }, (_, index) => {
    return transformCoord({ row: index, col: index }, size, transformId)
  })
}

function getNeighborRegionIds(regions, row, col) {
  const size = regions.length
  const regionIds = new Set()
  const currentRegionId = regions[row][col]

  for (const [dr, dc] of DIRECTIONS) {
    const nextRow = row + dr
    const nextCol = col + dc
    if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue
    const regionId = regions[nextRow][nextCol]
    if (regionId !== currentRegionId) regionIds.add(regionId)
  }

  return [...regionIds]
}

function varyRegions(regions, solution, rng) {
  let current = cloneRegions(regions)
  const size = current.length
  const solutionKeys = new Set(solution.map(coordKey))

  for (let step = 0; step < 160; step++) {
    const row = Math.floor(rng() * size)
    const col = Math.floor(rng() * size)
    if (solutionKeys.has(coordKey({ row, col }))) continue

    const neighborRegionIds = getNeighborRegionIds(current, row, col)
    if (neighborRegionIds.length === 0) continue

    const next = cloneRegions(current)
    next[row][col] = neighborRegionIds[Math.floor(rng() * neighborRegionIds.length)]

    const level = {
      id: 0,
      size,
      difficulty: `${size}x${size}`,
      regions: next,
      solution,
      lockedCats: [],
    }

    if (validateLevel(level)) current = next
  }

  return current
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

function countTinyRegions(level) {
  const counts = Array.from({ length: level.size }).fill(0)

  for (const row of level.regions) {
    for (const regionId of row) {
      counts[regionId] += 1
    }
  }

  return counts.filter((count) => count <= 3).length
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
  return (
    countSingletonRegions(level) <= 1 &&
    countTinyRegions(level) === 1 &&
    countSmallRegions(level) === 1 &&
    validateSolution(level) &&
    validateRegionConnectivity(level) &&
    solveLevel(level, 2) === 1
  )
}

function createLevel(id, difficulty, seed) {
  const size = sizeForDifficulty(difficulty)

  for (let seedVariant = 0; seedVariant < 80; seedVariant++) {
    const rng = makeRng(seed + seedVariant * 1000003)
    const transformId = Math.floor(rng() * 8)
    const solution = createPatternSolution(size, transformId)
    const baseRegions = relabelRegions(
      transformRegions(BASE_REGION_PATTERNS[size], transformId),
      rng,
    )
    const regions = varyRegions(baseRegions, solution, rng)

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
      const levelId = levels.length + 1
      levels.push(createLevel(levelId, group.difficulty, group.seed + index * 97))
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
  unique: levels.every((level) => solveLevel(level, 2) === 1),
  singletonLimited: levels.every((level) => countSingletonRegions(level) <= 1),
  tinyRegionRequired: levels.every((level) => countTinyRegions(level) === 1),
  smallRegionLimited: levels.every((level) => countSmallRegions(level) === 1),
  smallRegionCounts: levels.reduce(
    (counts, level) => {
      const smallRegionCount = countSmallRegions(level)
      counts[smallRegionCount] = (counts[smallRegionCount] ?? 0) + 1
      return counts
    },
    {},
  ),
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
