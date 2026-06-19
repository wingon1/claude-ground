/* ===========================================================================
 * Grid.ts — the pure collision-array logic. Knows nothing about three.js.
 *
 * Cells store the id of the car occupying them, or -1 when empty. All movement
 * legality (how far a car may slide, and whether it can drive off an edge) is
 * answered here so the renderer and input layers stay simple.
 * ========================================================================= */

import type { Orient } from './types'

export type MoveRange = {
  /** Lowest anchor the car can slide to without hitting another car. */
  min: number
  /** Highest anchor the car can slide to without hitting another car. */
  max: number
  /** True when the path to the low (anchor-decreasing) edge is a valid exit. */
  exitMin: boolean
  /** True when the path to the high (anchor-increasing) edge is a valid exit. */
  exitMax: boolean
}

export class Grid {
  readonly size: number
  private cells: Int16Array

  constructor(size: number) {
    this.size = size
    this.cells = new Int16Array(size * size).fill(-1)
  }

  private idx(x: number, z: number) {
    return z * this.size + x
  }

  inBounds(x: number, z: number) {
    return x >= 0 && x < this.size && z >= 0 && z < this.size
  }

  isFree(x: number, z: number) {
    return this.inBounds(x, z) && this.cells[this.idx(x, z)] === -1
  }

  /** The (x,z) of the i-th cell of a car (i in [0, length)). */
  cellAt(orient: Orient, anchor: number, lane: number, i: number): [number, number] {
    return orient === 'h' ? [anchor + i, lane] : [lane, anchor + i]
  }

  occupy(id: number, length: number, orient: Orient, anchor: number, lane: number) {
    for (let i = 0; i < length; i++) {
      const [x, z] = this.cellAt(orient, anchor, lane, i)
      this.cells[this.idx(x, z)] = id
    }
  }

  free(length: number, orient: Orient, anchor: number, lane: number) {
    for (let i = 0; i < length; i++) {
      const [x, z] = this.cellAt(orient, anchor, lane, i)
      if (this.inBounds(x, z)) this.cells[this.idx(x, z)] = -1
    }
  }

  /**
   * How far a car may move along its axis. The car's own cells must already be
   * freed (the caller frees them while a car is "in hand") so the scan treats
   * them as empty.
   */
  range(length: number, orient: Orient, anchor: number, lane: number): MoveRange {
    let min = anchor
    while (true) {
      const [x, z] = this.cellAt(orient, min - 1, lane, 0)
      if (this.isFree(x, z)) min--
      else break
    }
    let max = anchor
    while (true) {
      // the cell just beyond the high end of the car
      const [x, z] =
        orient === 'h' ? [max + length, lane] : [lane, max + length]
      if (this.isFree(x, z)) max++
      else break
    }
    return {
      min,
      max,
      exitMin: false,
      exitMax: max === this.size - length,
    }
  }

  /** True when no cell is occupied — the win condition. */
  isEmpty() {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] !== -1) return false
    return true
  }
}
