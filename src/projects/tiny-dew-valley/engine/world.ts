import type { Obstacle, Terrain, Tile } from '../types'
import { FIELD_PLOTS, FIELD_SIZE } from '../data/fields'

export const WORLD_W = 58
export const WORLD_H = 36

export interface WorldLocations {
  spawn: { x: number; y: number } // tile coords
  bed: { x: number; y: number } // interactive sleep tile (in front of house)
  storeCounter: { x: number; y: number }
  storeStand: { x: number; y: number } // where Barnaby stands
  storeFront: { x: number; y: number } // where player stands to interact
  buildBoard: { x: number; y: number }
  cookingFire: { x: number; y: number }
  mine: { x: number; y: number }
  blacksmith: { x: number; y: number }
  blacksmithNpc: { x: number; y: number }
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
  storeCounter: { x: 18, y: 8 },
  storeStand: { x: 18, y: 7 },
  storeFront: { x: 18, y: 8 },
  buildBoard: { x: 32, y: 12 },
  cookingFire: { x: 33, y: 11 },
  mine: { x: 47, y: 8 },
  blacksmith: { x: 45, y: 16 },
  blacksmithNpc: { x: 49, y: 20 },
  pond: { x: 25, y: 15 },
  woods: { x: 1, y: 8, w: 9, h: 20 },
  square: { x: 16, y: 31 },
}

// Pre-tilled farm field. Crops are auto-planted here when the player idles on
// an empty plot and auto-harvested when ripe — no hoe/watering required.
export const FARM = { x: 31, y: 16, w: FIELD_SIZE, h: FIELD_SIZE }
const TENT_SIDE_PROPS_AREA = { x: 26, y: 7, w: 5, h: 5 }

const NO_WILD_RESPAWN_META = [
  'animalFarm',
  'bed',
  'blacksmith',
  'blacksmithBlock',
  'blacksmithFloor',
  'buildBoard',
  'cookingFire',
  'cookingFireBlock',
  'fieldId',
  'fieldSign',
  'invisibleBlock',
  'mineBoard',
  'mineEntrance',
  'mineWall',
  'storeCounter',
  'storeInterior',
  'tentSideProps',
]

function hasProtectedObject(t: Tile): boolean {
  if (t.terrain === 'blocked') return true
  return NO_WILD_RESPAWN_META.some((key) => t.metadata[key] != null)
}

function clearRespawnMarker(t: Tile) {
  delete t.metadata.respawnAt
  delete t.metadata.respawnKind
}

export function canWildObstacleSpawn(tiles: Tile[], x: number, y: number, padding = 1): boolean {
  if (!inBounds(x, y)) return false
  const center = tiles[idx(x, y)]
  if (center.terrain !== 'grass' || center.cropId || center.obstacle || hasProtectedObject(center)) return false
  for (let ty = y - padding; ty <= y + padding; ty++) {
    for (let tx = x - padding; tx <= x + padding; tx++) {
      if (!inBounds(tx, ty)) return false
      if (hasProtectedObject(tiles[idx(tx, ty)])) return false
    }
  }
  return true
}

export function stampTentSideProps(tiles: Tile[]) {
  rect(
    tiles,
    TENT_SIDE_PROPS_AREA.x,
    TENT_SIDE_PROPS_AREA.y,
    TENT_SIDE_PROPS_AREA.x + TENT_SIDE_PROPS_AREA.w - 1,
    TENT_SIDE_PROPS_AREA.y + TENT_SIDE_PROPS_AREA.h - 1,
    (t) => {
      t.terrain = 'grass'
      clearObstacle(t)
      clearRespawnMarker(t)
      t.cropId = null
      t.growthStage = 0
      t.metadata.tentSideProps = true
    },
  )
}

// Stamps the general store's static structure onto a tiles array.
// Safe to re-apply on load so old saves shed stale hidden collision and
// interaction tiles from previous store positions.
export function stampStore(tiles: Tile[]) {
  const clearStoreTile = (t: Tile) => {
    t.terrain = 'grass'
    t.obstacle = null
    t.cropId = null
    delete t.metadata.invisibleBlock
    delete t.metadata.storeInterior
    delete t.metadata.storeCounter
  }
  rect(tiles, 16, 5, 27, 10, clearStoreTile)

  const left = LOCATIONS.storeStand.x - 2
  const top = LOCATIONS.storeStand.y - 2
  rect(tiles, left, top, left + 5, top + 2, (t) => {
    t.terrain = 'blocked'
    t.obstacle = null
    t.cropId = null
    t.metadata.invisibleBlock = true
  })
  rect(tiles, left, top + 3, left + 5, top + 3, (t) => {
    t.terrain = 'grass'
    t.obstacle = null
    t.cropId = null
    delete t.metadata.invisibleBlock
  })
  for (let x = left; x <= left + 5; x++) {
    tiles[idx(x, top + 3)].metadata.storeCounter = true
  }
}

// Player home. The home is now a small TENT, so its collision footprint is
// smaller than the old farmhouse. Re-applied on load so existing saves shed
// the old 5×3 block. The bed tile (in front, row 9) is left untouched.
export function stampFarmhouse(tiles: Tile[]) {
  // Free the old farmhouse footprint (29–33 × 6–8).
  rect(tiles, 29, 6, 33, 8, (t) => {
    t.terrain = 'grass'
    t.obstacle = null
    t.cropId = null
    delete t.metadata.invisibleBlock
  })
  // Block the tent footprint (30–32 × 7–8).
  rect(tiles, 30, 7, 32, 8, (t) => {
    t.terrain = 'blocked'
    t.obstacle = null
    t.cropId = null
    t.metadata.invisibleBlock = true
  })
  const bed = tiles[idx(LOCATIONS.bed.x, LOCATIONS.bed.y)]
  bed.metadata.bed = true
  bed.terrain = 'grass'
  delete bed.metadata.invisibleBlock
}

export function stampCookingFire(tiles: Tile[], built = true) {
  for (const t of tiles) {
    if (t.metadata.cookingFire === true || t.metadata.cookingFireBlock === true) {
      t.terrain = 'grass'
      t.obstacle = null
      t.cropId = null
      delete t.metadata.cookingFire
      delete t.metadata.cookingFireBlock
    }
  }
  if (!built) return
  rect(tiles, LOCATIONS.cookingFire.x - 1, LOCATIONS.cookingFire.y - 1, LOCATIONS.cookingFire.x + 2, LOCATIONS.cookingFire.y + 2, (t) => {
    t.metadata.cookingFire = true
  })
  rect(tiles, LOCATIONS.cookingFire.x, LOCATIONS.cookingFire.y, LOCATIONS.cookingFire.x + 1, LOCATIONS.cookingFire.y + 1, (t) => {
    t.terrain = 'grass'
    clearObstacle(t)
    t.cropId = null
    t.growthStage = 0
    t.metadata.cookingFire = true
  })
}

export function stampMine(tiles: Tile[], active = false) {
  // Clear the quarry pad so old saves gain a stable mining area.
  rect(tiles, 43, 4, 54, 14, (t) => {
    t.terrain = 'grass'
    clearObstacle(t)
    t.cropId = null
    t.growthStage = 0
    delete t.metadata.mineEntrance
    delete t.metadata.mineWall
    delete t.metadata.mineBoard
    delete t.metadata.mineNode
    delete t.metadata.renewable
  })

  // Cave back wall and entrance silhouette.
  rect(tiles, 45, 4, 51, 6, (t) => {
    t.terrain = 'blocked'
    clearObstacle(t)
    t.cropId = null
    t.metadata.mineWall = true
    t.metadata.invisibleBlock = true
  })
  rect(tiles, 47, 6, 49, 7, (t) => {
    t.terrain = 'blocked'
    clearObstacle(t)
    t.cropId = null
    t.metadata.mineEntrance = true
    t.metadata.invisibleBlock = true
  })
  if (!active) {
    rect(tiles, 47, 7, 49, 8, (t) => {
      t.terrain = 'grass'
      clearObstacle(t)
      t.cropId = null
      t.growthStage = 0
      t.metadata.mineBoard = true
    })
    return
  }
  rect(tiles, 44, 8, 53, 13, (t) => {
    t.terrain = 'grass'
    t.cropId = null
    t.growthStage = 0
    delete t.metadata.invisibleBlock
  })

}

export function stampBlacksmith(tiles: Tile[], active = false) {
  const clearBlacksmithTile = (t: Tile) => {
    t.terrain = 'grass'
    clearObstacle(t)
    t.cropId = null
    t.growthStage = 0
    delete t.metadata.blacksmith
    delete t.metadata.blacksmithBlock
    delete t.metadata.blacksmithFloor
    delete t.metadata.invisibleBlock
  }
  rect(tiles, 37, 5, 43, 11, clearBlacksmithTile)
  rect(tiles, 44, 15, 51, 21, clearBlacksmithTile)
  if (!active) return
  rect(tiles, 45, 16, 49, 19, (t) => {
    t.terrain = 'blocked'
    clearObstacle(t)
    t.cropId = null
    t.growthStage = 0
    t.metadata.blacksmith = true
    t.metadata.blacksmithBlock = true
    t.metadata.invisibleBlock = true
  })
  rect(tiles, 46, 20, 49, 20, (t) => {
    t.terrain = 'grass'
    clearObstacle(t)
    t.cropId = null
    t.growthStage = 0
    t.metadata.blacksmithFloor = true
  })
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

  // ---- Player tent (north-east) ----
  stampFarmhouse(tiles)
  stampTentSideProps(tiles)

  // ---- General Store (beside the farmhouse) ----
  stampStore(tiles)

  stampCookingFire(tiles, false)
  stampMine(tiles, false)
  stampBlacksmith(tiles, false)

  // ---- Western woods: trees, stumps, daffodils, weeds ----
  const w = LOCATIONS.woods
  for (let y = w.y; y < w.y + w.h; y++) {
    for (let x = w.x; x < w.x + w.w; x++) {
      if (!inBounds(x, y)) continue
      const t = tiles[idx(x, y)]
      if (!canWildObstacleSpawn(tiles, x, y)) continue
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
      if (!canWildObstacleSpawn(tiles, x, y)) continue
      const r = Math.random()
      if (r < 0.05) setObstacle(t, 'weed')
      else if (r < 0.065) setObstacle(t, 'stump')
      else if (r < 0.072) setObstacle(t, 'tree')
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
  else if (o === 'iron_ore') t.hp = 9
  else if (o === 'copper_ore') t.hp = 6
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
