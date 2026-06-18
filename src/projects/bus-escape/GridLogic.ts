// Grid occupancy + strict forward-only clearance checks.

import type { Vehicle } from './types'

export interface Grid {
  size: number
  cells: Int16Array // value = vehicle id, or -1 for empty
}

export function makeGrid(size: number): Grid {
  const cells = new Int16Array(size * size)
  cells.fill(-1)
  return { size, cells }
}

function idx(g: Grid, r: number, c: number): number {
  return r * g.size + c
}

export function inBounds(g: Grid, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < g.size && c < g.size
}

export function cellsOf(v: Vehicle): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = []
  for (let i = 0; i < v.length; i++) {
    if (v.orientation === 'h') out.push({ r: v.row, c: v.col + i })
    else out.push({ r: v.row + i, c: v.col })
  }
  return out
}

export function bodyFits(g: Grid, v: Vehicle): boolean {
  for (const { r, c } of cellsOf(v)) {
    if (!inBounds(g, r, c)) return false
  }
  return true
}

export function bodyEmpty(g: Grid, v: Vehicle): boolean {
  for (const { r, c } of cellsOf(v)) {
    if (!inBounds(g, r, c)) return false
    if (g.cells[idx(g, r, c)] !== -1) return false
  }
  return true
}

export function place(g: Grid, v: Vehicle): void {
  for (const { r, c } of cellsOf(v)) g.cells[idx(g, r, c)] = v.id
}

export function remove(g: Grid, v: Vehicle): void {
  for (const { r, c } of cellsOf(v)) g.cells[idx(g, r, c)] = -1
}

// Cells in front of the vehicle, from its front edge out to the grid border,
// ordered nearest-first.
export function frontPath(g: Grid, v: Vehicle): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = []
  if (v.facing === 'right') {
    for (let c = v.col + v.length; c < g.size; c++) out.push({ r: v.row, c })
  } else if (v.facing === 'left') {
    for (let c = v.col - 1; c >= 0; c--) out.push({ r: v.row, c })
  } else if (v.facing === 'down') {
    for (let r = v.row + v.length; r < g.size; r++) out.push({ r, c: v.col })
  } else {
    for (let r = v.row - 1; r >= 0; r--) out.push({ r, c: v.col })
  }
  return out
}

// Strict, grid-based: the vehicle may exit only if EVERY forward cell is empty.
export function exitClear(g: Grid, v: Vehicle): boolean {
  for (const { r, c } of frontPath(g, v)) {
    if (g.cells[idx(g, r, c)] !== -1) return false
  }
  return true
}

// Number of clear cells in front before hitting a blocker (for the bump anim).
export function clearAhead(g: Grid, v: Vehicle): number {
  let d = 0
  for (const { r, c } of frontPath(g, v)) {
    if (g.cells[idx(g, r, c)] !== -1) return d
    d++
  }
  return d
}
