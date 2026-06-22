import type { Obstacle, Terrain, Tile } from '../types'

export const WORLD_W = 40
export const WORLD_H = 36

export interface WorldLocations {
  spawn: { x: number; y: number } // tile coords
  bed: { x: number; y: number } // interactive sleep tile (in front of house)
  storeCounter: { x: number; y: number }
  storeStand: { x: number; y: number } // where Barnaby stands
  storeFront: { x: number; y: number } // where player stands to interact
  shrine: { x: number; y: number } // interactive shrine tile
  pond: { x: number; y: number }
  woods: { x: number; y: number; w: number; h: number }
  square: { x: number; y: number } // village square center
}

export function idx(x: number, y: number): number {
  return y * WORLD_W + x
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H
}

function makeTile(x: number, y: number, terrain: Terrain): Tile {
  return {
    x,
    y,
    terrain,
    cropId: null,
    growthStage: 0,
    wateredToday: false,
    wateredYesterday: false,
    daysUnwatered: 0,
    obstacle: null,
    hasFertilizer: false,
    metadata: {},
  }
}

function rect(
  tiles: Tile[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: (t: Tile) => void,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inBounds(x, y)) fn(tiles[idx(x, y)])
    }
  }
}

export const LOCATIONS: WorldLocations = {
  spawn: { x: 31, y: 11 },
  bed: { x: 31, y: 9 },
  storeCounter: { x: 16, y: 29 },
  storeStand: { x: 16, y: 28 },
  storeFront: { x: 16, y: 30 },
  shrine: { x: 20, y: 5 },
  pond: { x: 25, y: 15 },
  woods: { x: 1, y: 8, w: 9, h: 20 },
  square: { x: 16, y: 31 },
}

// Builds the initial farm + village world.
export function generateWorld(): Tile[] {
  const tiles: Tile[] = []
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      tiles.push(makeTile(x, y, 'grass'))
    }
  }

  // Solid border (cliff/fence).
  rect(tiles, 0, 0, WORLD_W - 1, 0, (t) => (t.terrain = 'blocked'))
  rect(tiles, 0, WORLD_H - 1, WORLD_W - 1, WORLD_H - 1, (t) => (t.terrain = 'blocked'))
  rect(tiles, 0, 0, 0, WORLD_H - 1, (t) => (t.terrain = 'blocked'))
  rect(tiles, WORLD_W - 1, 0, WORLD_W - 1, WORLD_H - 1, (t) => (t.terrain = 'blocked'))

  // ---- Pond (water, with collision) ----
  const p = LOCATIONS.pond
  rect(tiles, p.x - 1, p.y - 1, p.x + 1, p.y + 1, (t) => (t.terrain = 'water'))
  tiles[idx(p.x - 2, p.y)].terrain = 'water'
  tiles[idx(p.x + 2, p.y)].terrain = 'water'

  // ---- Farmhouse (north-east) ----
  rect(tiles, 29, 6, 33, 8, (t) => (t.terrain = 'blocked'))
  tiles[idx(LOCATIONS.bed.x, LOCATIONS.bed.y)].metadata.bed = true
  tiles[idx(LOCATIONS.bed.x, LOCATIONS.bed.y)].terrain = 'path'

  // ---- General Store (south) ----
  // Back walls (blocked), an open interior floor row where Barnaby stands,
  // and a counter row the player interacts across.
  rect(tiles, 14, 26, 19, 27, (t) => (t.terrain = 'blocked'))
  rect(tiles, 14, 28, 19, 28, (t) => (t.terrain = 'path')) // interior floor
  rect(tiles, 14, 29, 19, 29, (t) => (t.terrain = 'blocked')) // counter
  tiles[idx(16, 29)].terrain = 'path' // front entrance gap
  // mark all counter tiles (incl. entrance path) so interaction works from any approach
  for (let x = 14; x <= 19; x++) tiles[idx(x, 29)].metadata.storeCounter = true
  // mark interior floor so shop opens when player is inside
  for (let x = 14; x <= 19; x++) tiles[idx(x, 28)].metadata.storeInterior = true

  // ---- Village square paths (south) ----
  rect(tiles, 12, 30, 24, 33, (t) => {
    if (t.terrain === 'grass') t.terrain = 'path'
  })
  rect(tiles, 16, 11, 16, 30, (t) => {
    if (t.terrain === 'grass') t.terrain = 'path'
  })

  // ---- Shrine (north) ----
  rect(tiles, 19, 2, 21, 4, (t) => (t.terrain = 'blocked'))
  const s = LOCATIONS.shrine
  tiles[idx(s.x, s.y)].terrain = 'path'
  tiles[idx(s.x, s.y)].metadata.shrine = true

  // ---- Western woods: trees, stumps, daffodils, weeds ----
  const w = LOCATIONS.woods
  for (let y = w.y; y < w.y + w.h; y++) {
    for (let x = w.x; x < w.x + w.w; x++) {
      if (!inBounds(x, y)) continue
      const t = tiles[idx(x, y)]
      if (t.terrain !== 'grass') continue
      const r = Math.random()
      if (r < 0.28) setObstacle(t, 'tree')
      else if (r < 0.33) setObstacle(t, 'weed')
      else if (r < 0.36) setObstacle(t, 'flower')
    }
  }
  // A handful of renewable large stumps in a clearing.
  const stumpSpots = [
    [4, 10],
    [6, 13],
    [3, 17],
    [7, 20],
    [5, 24],
  ]
  for (const [sx, sy] of stumpSpots) {
    const t = tiles[idx(sx, sy)]
    t.terrain = 'grass'
    setObstacle(t, 'large_stump')
    t.metadata.renewable = true
  }

  // ---- Farm clutter (east of the path) on tillable grass ----
  for (let y = 4; y < 26; y++) {
    for (let x = 18; x < 38; x++) {
      const t = tiles[idx(x, y)]
      if (t.terrain !== 'grass' || t.obstacle) continue
      const r = Math.random()
      if (r < 0.05) setObstacle(t, 'weed')
      else if (r < 0.075) setObstacle(t, 'rock')
      else if (r < 0.085) setObstacle(t, 'stump')
      else if (r < 0.092) setObstacle(t, 'tree')
    }
  }
  // Keep the spawn & near-house area clear.
  rect(tiles, 29, 9, 34, 14, (t) => {
    if (t.obstacle) clearObstacle(t)
  })

  return tiles
}

function setObstacle(t: Tile, o: Exclude<Obstacle, null>) {
  t.obstacle = o
  if (o === 'large_stump') t.hp = 6
  else if (o === 'tree') t.hp = 3
  else if (o === 'rock') t.hp = 2
  else if (o === 'stump') t.hp = 2
  else t.hp = 1
}

export function clearObstacle(t: Tile) {
  t.obstacle = null
  t.hp = undefined
}

export { setObstacle }
