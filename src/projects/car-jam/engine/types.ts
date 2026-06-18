/* Shared types for the Car Jam (color-boarding) engine. */

/** A car parked in the lot: a colour and a number of seats to fill. */
export type CarSpec = {
  col: number
  row: number // 0 = front of its column (nearest the boarding lane)
  colorIndex: number
  seats: number
}

export type LevelSpec = {
  level: number
  cols: number
  rows: number
  slots: number
  cars: CarSpec[]
  /** Queue of passenger colour indices, front of line first. */
  queue: number[]
  /** A guaranteed-winnable dispatch order: indices into `cars`. */
  order: number[]
}

/** Snapshot pushed to the React HUD. */
export type GameState = {
  level: number
  queueTotal: number
  queueLeft: number
  status: 'playing' | 'won' | 'stuck'
  muted: boolean
}
