import type { Obstacle, Terrain, Tile } from '../types'
import { FIELD_PLOTS, FIELD_SIZE } from '../data/fields'

export const WORLD_W = 40
export const WORLD_H = 36

export interface WorldLocations {
  spawn: { x: number; y: number } // tile coords
  bed: { x: number; y: number } // interactive sleep tile (in front of house)
  storeCounter: { x: number; y: number }
  storeStand: { x: number; y: number } // where Barnaby stands
  storeFront: { x: number; y: number } // where player stands to interact
  buildBoard: { x: number; y: number }
  cookingFire: { x: number; y: number }
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
  storeCounter: { x: 24, y: 9 },
  storeStand: { x: 24, y: 8 },
  storeFront: { x: 24, y: 10 },
  buildBoard: { x: 32, y: 12 },
  cookingFire: { x: 33, y: 11 },
  pond: { x: 25, y: 15 },
  woods: { x: 1, y: 8, w: 9, h: 20 },
  square: { x: 16, y: 31 },
}

// Pre-tilled farm field. Crops are auto-planted here when the player idles on
// an empty plot and auto-harvested when ripe — no hoe/watering required.
export const FARM = { x: 31, y: 16, w: FIELD_SIZE, h: FIELD_SIZE }

// Stamps the general store's static structure onto a tiles array.
// The store is an open-front stall: solid back walls, with a walk-in
// interior the player steps into to trade. Safe to re-apply on load
// (the player never tills/plants/builds on these tiles), which lets old
// saves pick up the new layout via migration.
export function stampStore(tiles: Tile[]) {
  // Back walls (the building body, hidden behind the store sprite).
  rect(tiles, 22, 6, 27, 7, (t) => {
    t.terrain = 'blocked'
    t.obstacle = null
    t.cropId = null
  })
  // Open interior + front. No fence here so the player can walk straight in
  // from the village square and up to the counter where Barnaby stands.
  rect(tiles, 22, 8, 27, 9, (t) => {
    t.terrain = 'grass'
    t.obstacle = null
    t.cropId = null
  })
  // Mark every interior/front tile so the shop opens however the player
  // approaches: standing inside, or facing the counter from the square.
  for (let x = 22; x <= 27; x++) {
    tiles[idx(x, 8)].metadata.storeInterior = true
    tiles[idx(x, 9)].metadata.storeCounter = true
  }
}

function stampFields(tiles: Tile[]) {
  for (const plot of FIELD_PLOTS) {
    for (let y = plot.y; y < plot.y + FIELD_SIZE; y++) {
      for (let x = plot.x; x < plot.x + FIELD_SIZE; x++) {
        const t = tiles[idx(x, y)]
        t.terrain = plot.id === 'field_1' ? 'soil' : 'grass'
        clearObstacle(t)
        t.cropId = null
        t.growthStage = 0
        t.metadata.fieldId = plot.id
      }
    }
    const sign = tiles[idx(plot.sign.x, plot.sign.y)]
    sign.terrain = 'grass'
    clearObstacle(sign)
    sign.cropId = null
    sign.metadata.fieldSign = plot.id
  }
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

  // ---- Farmhouse (north-east) ----
  rect(tiles, 29, 6, 33, 8, (t) => (t.terrain = 'blocked'))
  tiles[idx(LOCATIONS.bed.x, LOCATIONS.bed.y)].metadata.bed = true
  tiles[idx(LOCATIONS.bed.x, LOCATIONS.bed.y)].terrain = 'grass'

  // ---- General Store (beside the farmhouse) ----
  stampStore(tiles)

  tiles[idx(LOCATIONS.cookingFire.x, LOCATIONS.cookingFire.y)].terrain = 'grass'
  tiles[idx(LOCATIONS.cookingFire.x, LOCATIONS.cookingFire.y)].metadata.cookingFire = true

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

  // ---- Farm clutter on tillable grass ----
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

  // ---- Plot-based farm fields ----
  stampFields(tiles)

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
