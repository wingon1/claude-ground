// Bus Escape: Traffic Jam — shared types & constants.
// Independent project: no shared code with other works in this repo.

export type ColorKey = 'red' | 'blue' | 'green' | 'yellow' | 'orange'
export type Orientation = 'h' | 'v'
export type Facing = 'up' | 'down' | 'left' | 'right'
export type SizeKey = 'car' | 'bus' | 'long'

export interface SizeDef {
  size: SizeKey
  length: number
  capacity: number
}

export const SIZE_DEFS: Record<SizeKey, SizeDef> = {
  car: { size: 'car', length: 2, capacity: 4 },
  bus: { size: 'bus', length: 3, capacity: 6 },
  long: { size: 'long', length: 4, capacity: 10 },
}

export const COLOR_KEYS: ColorKey[] = ['red', 'blue', 'green', 'yellow', 'orange']

export const COLOR_HEX: Record<ColorKey, number> = {
  red: 0xff5a5a,
  blue: 0x4f86ff,
  green: 0x42cf6b,
  yellow: 0xffcf3a,
  orange: 0xff8c2a,
}

// Slightly darker shade used for accents / roof.
export const COLOR_DARK: Record<ColorKey, number> = {
  red: 0xd03b3b,
  blue: 0x305fcc,
  green: 0x2aa450,
  yellow: 0xd9a700,
  orange: 0xd96a12,
}

export interface Vehicle {
  id: number
  color: ColorKey
  size: SizeKey
  length: number
  capacity: number
  orientation: Orientation
  facing: Facing
  // top-left cell of the vehicle on the grid.
  row: number
  col: number
  // runtime boarding progress (used once parked in the boarding zone).
  boarded: number
}

export interface Level {
  level: number
  size: number
  vehicles: Vehicle[]
  queue: ColorKey[]
  solutionOrder: number[] // vehicle ids, in the order they may legally exit
}

export function cloneVehicle(v: Vehicle): Vehicle {
  return { ...v }
}
