import type { Obstacle, Tile } from '../types'
import { mineFloorDef } from '../data/mineFloors'
import { MONSTERS } from '../data/monsters'
import { T } from './sprites'
import { idx, setObstacle, WORLD_H, WORLD_W } from './world'
import type { MineMonster } from './gameTypes'

function makeRuntimeTile(x: number, y: number, terrain: Tile['terrain']): Tile {
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

export function buildMineTiles(floor: number): Tile[] {
  const tiles: Tile[] = []
  const floorDef = mineFloorDef(floor)
  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const inside = x >= 20 && x <= 37 && y >= 10 && y <= 24
      const wall = !inside || x === 20 || x === 37 || y === 10 || y === 24
      tiles.push(makeRuntimeTile(x, y, wall ? 'blocked' : 'grass'))
    }
  }
  const exit = tiles[idx(27, 22)]
  exit.metadata.mineExit = true
  const spots: [number, number][] = [
    [23, 12], [27, 12], [33, 12], [35, 15], [22, 16], [28, 16],
    [32, 18], [24, 20], [35, 21], [22, 22], [31, 22],
  ]
  const orePlan: Exclude<Obstacle, null>[] = []
  for (const [obstacle, count] of Object.entries(floorDef.ores)) {
    for (let i = 0; i < (count ?? 0); i++) orePlan.push(obstacle as Exclude<Obstacle, null>)
  }
  spots.forEach(([x, y], i) => {
    const t = tiles[idx(x, y)]
    const ore = orePlan[i] ?? (floor === 10 ? null : 'rock')
    if (!ore) return
    setObstacle(t, ore)
    t.metadata.mineNode = true
  })
  return tiles
}

export function buildMineMonsters(floor: number): MineMonster[] {
  const floorDef = mineFloorDef(floor)
  const spawnTiles: [number, number][] = [
    [22, 12], [25, 13], [31, 13], [35, 14], [23, 17],
    [30, 17], [34, 18], [25, 21], [33, 21], [36, 22],
  ]
  const monsters: MineMonster[] = []
  let cursor = 0
  for (const entry of floorDef.monsters) {
    const def = MONSTERS[entry.id]
    for (let i = 0; i < entry.count; i++) {
      const [tx, ty] = entry.id === 'mine_guardian'
        ? [29, 16]
        : spawnTiles[cursor % spawnTiles.length]
      cursor += 1
      monsters.push({
        uid: `${floor}:${entry.id}:${i}:${cursor}`,
        id: entry.id,
        x: tx * T + T / 2,
        y: ty * T + T,
        hp: def.hp,
        maxHp: def.hp,
        hitT: 0,
        attackT: 0.8 + Math.random() * 0.6,
      })
    }
  }
  return monsters
}
