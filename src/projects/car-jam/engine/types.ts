/* Shared types for the Car Jam (slide-out + color-boarding) engine. */

export type Orient = 'h' | 'v'

/**
 * A car in the lot. Occupies `length` contiguous cells along its axis.
 *  - 'h' (horizontal): cells (anchor..anchor+length-1, lane), exits LEFT
 *  - 'v' (vertical):   cells (lane, anchor..anchor+length-1), exits UP
 * `length` doubles as the seat count (passengers it carries).
 */
export type CarSpec = {
  orient: Orient
  length: number
  anchor: number
  lane: number
  colorIndex: number
}

export type LevelSpec = {
  level: number
  cols: number
  rows: number
  bays: number
  cars: CarSpec[]
  /** Queue of passenger colour indices, front of line first. */
  queue: number[]
  /** A guaranteed-winnable extraction order: indices into `cars`. */
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
