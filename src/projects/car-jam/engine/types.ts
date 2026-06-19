/* Shared types for the Car Jam engine. */

export type Orient = 'h' | 'v'

/** A single car's logical placement on the grid. */
export type CarSpec = {
  length: number // 2 = sedan, 3 = truck/bus
  orient: Orient
  anchor: number // index of the car's lowest occupied cell along its axis
  lane: number // the fixed cross-axis coordinate
  colorIndex: number
}

export type LevelSpec = {
  level: number
  size: number
  cars: CarSpec[]
}

/** Snapshot pushed to the React HUD. */
export type GameState = {
  level: number
  total: number
  remaining: number
  status: 'playing' | 'won'
  muted: boolean
  canUndo: boolean
}
