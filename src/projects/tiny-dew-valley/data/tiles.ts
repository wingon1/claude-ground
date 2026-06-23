import type { Obstacle, Terrain } from '../types'

// Centralised tile metadata so new terrains/obstacles only need a data entry.
export const TILE_SIZE = 16 // base pixel size of a tile (pre-scale)

export const TERRAIN_SOLID: Record<Terrain, boolean> = {
  grass: false,
  soil: false,
  tilled: false,
  water: true,
  path: false,
  blocked: true,
}

export const OBSTACLE_SOLID: Record<Exclude<Obstacle, null>, boolean> = {
  weed: false,
  flower: false,
  rock: true,
  tree: true,
  stump: true,
  large_stump: true,
}

// How many axe hits an obstacle needs and what it drops.
export const OBSTACLE_HP: Record<Exclude<Obstacle, null>, number> = {
  weed: 1,
  flower: 1,
  rock: 2,
  tree: 3,
  stump: 2,
  large_stump: 6,
}

export const OBSTACLE_DROP: Record<
  Exclude<Obstacle, null>,
  { itemId: string; qty: number } | null
> = {
  weed: null,
  flower: { itemId: 'daffodil', qty: 1 },
  rock: { itemId: 'stone', qty: 1 },
  tree: { itemId: 'wood', qty: 3 },
  stump: { itemId: 'wood', qty: 2 },
  large_stump: { itemId: 'hardwood', qty: 2 },
}

// Days an unwatered tilled tile survives before reverting to grass.
export const TILLED_REVERT_DAYS = 4
