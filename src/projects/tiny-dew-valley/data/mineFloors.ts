import type { Obstacle } from '../types'
import type { MonsterId } from './monsters'
import type { PassiveRarity } from './passives'

export const MINE_MAX_FLOOR = 10

export interface MineFloorDef {
  floor: number
  ores: Partial<Record<Exclude<Obstacle, null>, number>>
  monsters: { id: MonsterId; count: number }[]
  passiveDropChance: number
  rarityChance: Record<PassiveRarity, number>
}

export const MINE_FLOORS: MineFloorDef[] = [
  {
    floor: 1,
    ores: { rock: 8, copper_ore: 2 },
    monsters: [{ id: 'slime', count: 1 }],
    passiveDropChance: 0.03,
    rarityChance: { normal: 0.9, rare: 0.1, epic: 0 },
  },
  {
    floor: 2,
    ores: { rock: 7, copper_ore: 3 },
    monsters: [{ id: 'slime', count: 2 }],
    passiveDropChance: 0.03,
    rarityChance: { normal: 0.9, rare: 0.1, epic: 0 },
  },
  {
    floor: 3,
    ores: { rock: 6, copper_ore: 4 },
    monsters: [{ id: 'slime', count: 3 }],
    passiveDropChance: 0.05,
    rarityChance: { normal: 0.9, rare: 0.1, epic: 0 },
  },
  {
    floor: 4,
    ores: { rock: 5, copper_ore: 4, iron_ore: 1 },
    monsters: [{ id: 'slime', count: 2 }, { id: 'bat', count: 1 }],
    passiveDropChance: 0.05,
    rarityChance: { normal: 0.78, rare: 0.2, epic: 0.02 },
  },
  {
    floor: 5,
    ores: { rock: 5, copper_ore: 3, iron_ore: 2 },
    monsters: [{ id: 'bat', count: 3 }],
    passiveDropChance: 0.07,
    rarityChance: { normal: 0.78, rare: 0.2, epic: 0.02 },
  },
  {
    floor: 6,
    ores: { rock: 4, copper_ore: 2, iron_ore: 4 },
    monsters: [{ id: 'bat', count: 2 }, { id: 'mine_rat', count: 2 }],
    passiveDropChance: 0.07,
    rarityChance: { normal: 0.78, rare: 0.2, epic: 0.02 },
  },
  {
    floor: 7,
    ores: { rock: 4, copper_ore: 1, iron_ore: 5 },
    monsters: [{ id: 'mine_rat', count: 4 }],
    passiveDropChance: 0.09,
    rarityChance: { normal: 0.65, rare: 0.3, epic: 0.05 },
  },
  {
    floor: 8,
    ores: { rock: 3, copper_ore: 1, iron_ore: 6 },
    monsters: [{ id: 'mine_rat', count: 3 }, { id: 'stone_golem', count: 1 }],
    passiveDropChance: 0.09,
    rarityChance: { normal: 0.65, rare: 0.3, epic: 0.05 },
  },
  {
    floor: 9,
    ores: { rock: 3, iron_ore: 7 },
    monsters: [{ id: 'mine_rat', count: 2 }, { id: 'stone_golem', count: 3 }],
    passiveDropChance: 0.12,
    rarityChance: { normal: 0.65, rare: 0.3, epic: 0.05 },
  },
  {
    floor: 10,
    ores: { rock: 2, iron_ore: 8 },
    monsters: [{ id: 'stone_golem', count: 4 }],
    passiveDropChance: 0.15,
    rarityChance: { normal: 0.55, rare: 0.35, epic: 0.1 },
  },
]

export function mineFloorDef(floor: number): MineFloorDef {
  return MINE_FLOORS[Math.max(1, Math.min(MINE_MAX_FLOOR, floor)) - 1]
}
