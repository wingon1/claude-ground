import type { Obstacle } from '../types'
import balance from './balance.json'
import type { MonsterId } from './monsters'
import type { PassiveRarity } from './passives'

export const MINE_MAX_FLOOR = balance.mine.maxFloor

export interface MineFloorDef {
  floor: number
  ores: Partial<Record<Exclude<Obstacle, null>, number>>
  monsters: { id: MonsterId; count: number }[]
  passiveDropChance: number
  rarityChance: Record<PassiveRarity, number>
}

export const MINE_FLOORS: MineFloorDef[] = balance.mine.floors.map((floor) => ({
  ...floor,
  ores: floor.ores as Partial<Record<Exclude<Obstacle, null>, number>>,
  monsters: floor.monsters as { id: MonsterId; count: number }[],
  rarityChance: floor.rarityChance as Record<PassiveRarity, number>,
}))

export function mineFloorDef(floor: number): MineFloorDef {
  return MINE_FLOORS[Math.max(1, Math.min(MINE_MAX_FLOOR, floor)) - 1]
}
