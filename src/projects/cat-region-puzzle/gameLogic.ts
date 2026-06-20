export type Difficulty = '5x5' | '6x6' | '7x7' | '8x8' | '9x9'

export type Coord = {
  row: number
  col: number
}

export type Level = {
  id: number
  size: number
  difficulty: Difficulty
  regions: number[][]
  solution: Coord[]
  lockedCats: Coord[]
}

export type CellState = 'empty' | 'cat' | 'mark'

export type Board = CellState[][]

export type ConflictReason = 'row' | 'column' | 'region' | 'locked'

export type SolveResult = {
  count: number
  firstSolution: Coord[]
}

const ORTHOGONAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

export function coordKey(coord: Coord): string {
  return `${coord.row}:${coord.col}`
}

export function createBoard(level: Level): Board {
  const board = Array.from({ length: level.size }, () =>
    Array.from<CellState>({ length: level.size }).fill('empty'),
  )

  for (const cat of level.lockedCats) {
    board[cat.row][cat.col] = 'cat'
  }

  return board
}

export function isLocked(level: Level, row: number, col: number): boolean {
  return level.lockedCats.some((cat) => cat.row === row && cat.col === col)
}

export function isSolutionCell(level: Level, row: number, col: number): boolean {
  return level.solution.some((cat) => cat.row === row && cat.col === col)
}

export function getCats(board: Board): Coord[] {
  const cats: Coord[] = []
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] === 'cat') cats.push({ row, col })
    }
  }
  return cats
}

export function getRegionCells(level: Level, regionId: number): Coord[] {
  const cells: Coord[] = []
  for (let row = 0; row < level.size; row++) {
    for (let col = 0; col < level.size; col++) {
      if (level.regions[row][col] === regionId) cells.push({ row, col })
    }
  }
  return cells
}

export function getConflicts(
  board: Board,
  level: Level,
  row: number,
  col: number,
): ConflictReason[] {
  if (isLocked(level, row, col)) return ['locked']

  const reasons = new Set<ConflictReason>()
  const regionId = level.regions[row][col]

  for (const cat of getCats(board)) {
    if (cat.row === row && cat.col === col) continue
    if (cat.row === row) reasons.add('row')
    if (cat.col === col) reasons.add('column')
    if (level.regions[cat.row][cat.col] === regionId) reasons.add('region')
  }

  return [...reasons]
}

export function canPlaceCat(board: Board, level: Level, row: number, col: number): boolean {
  return board[row][col] !== 'cat' && getConflicts(board, level, row, col).length === 0
}

export function checkWin(board: Board, level: Level): boolean {
  const cats = getCats(board)
  if (cats.length !== level.size) return false

  const rows = new Set<number>()
  const cols = new Set<number>()
  const regions = new Set<number>()

  for (const cat of cats) {
    rows.add(cat.row)
    cols.add(cat.col)
    regions.add(level.regions[cat.row][cat.col])
  }

  if (rows.size !== level.size || cols.size !== level.size || regions.size !== level.size) {
    return false
  }

  return true
}

export function validateRegionConnectivity(level: Level): boolean {
  for (let regionId = 0; regionId < level.size; regionId++) {
    const cells = getRegionCells(level, regionId)
    if (cells.length === 0) return false

    const cellKeys = new Set(cells.map(coordKey))
    const seen = new Set<string>()
    const queue = [cells[0]]
    seen.add(coordKey(cells[0]))

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const [dr, dc] of ORTHOGONAL) {
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

export function validateLevelShape(level: Level): boolean {
  if (level.size < 4) return false
  if (level.regions.length !== level.size) return false
  if (level.solution.length !== level.size) return false

  for (const row of level.regions) {
    if (row.length !== level.size) return false
    for (const regionId of row) {
      if (!Number.isInteger(regionId) || regionId < 0 || regionId >= level.size) return false
    }
  }

  return true
}

export function validateSolution(level: Level): boolean {
  if (!validateLevelShape(level)) return false

  const rows = new Set<number>()
  const cols = new Set<number>()
  const regions = new Set<number>()

  for (const cat of level.solution) {
    if (cat.row < 0 || cat.row >= level.size || cat.col < 0 || cat.col >= level.size) {
      return false
    }
    rows.add(cat.row)
    cols.add(cat.col)
    regions.add(level.regions[cat.row][cat.col])
  }

  if (rows.size !== level.size || cols.size !== level.size || regions.size !== level.size) {
    return false
  }

  return level.lockedCats.every((cat) => isSolutionCell(level, cat.row, cat.col))
}

export function solveLevel(level: Level, limit = 2): SolveResult {
  const lockedByRow = new Map<number, Coord>()
  const usedColumns = new Set<number>()
  const usedRegions = new Set<number>()
  const placed: Coord[] = []
  let count = 0
  let firstSolution: Coord[] = []

  for (const cat of level.lockedCats) {
    const regionId = level.regions[cat.row][cat.col]
    if (lockedByRow.has(cat.row) || usedColumns.has(cat.col) || usedRegions.has(regionId)) {
      return { count: 0, firstSolution: [] }
    }

    lockedByRow.set(cat.row, cat)
    usedColumns.add(cat.col)
    usedRegions.add(regionId)
    placed.push(cat)
  }

  const place = (row: number) => {
    if (count >= limit) return
    if (row === level.size) {
      if (usedRegions.size === level.size) {
        count += 1
        if (firstSolution.length === 0) firstSolution = [...placed]
      }
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
      placed.push({ row, col })
      place(row + 1)
      placed.pop()
      usedColumns.delete(col)
      usedRegions.delete(regionId)

      if (count >= limit) return
    }
  }

  place(0)
  return { count, firstSolution }
}

export function validateLevel(level: Level): boolean {
  if (!validateSolution(level)) return false
  if (!validateRegionConnectivity(level)) return false
  return solveLevel(level, 2).count === 1
}
