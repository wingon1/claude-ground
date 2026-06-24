import type { PassiveId, PassiveRarity } from './passives'

export type MonsterId = 'slime' | 'bat' | 'mine_rat' | 'stone_golem'

export interface MonsterDrop {
  itemId: string
  minQty: number
  maxQty: number
  chance: number
}

export interface MonsterDef {
  id: MonsterId
  name: string
  hp: number
  attack: number
  speed: number
  color: string
  accent: string
  passiveDropBonus: number
  passiveWeights?: Partial<Record<PassiveId, number>>
  rarityBonus?: Partial<Record<PassiveRarity, number>>
  drops: MonsterDrop[]
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime: {
    id: 'slime',
    name: '슬라임',
    hp: 3,
    attack: 1,
    speed: 10,
    color: '#5fbf68',
    accent: '#a8f0a8',
    passiveDropBonus: 0,
    passiveWeights: { magnet: 1.3, crop_yield: 1.2 },
    drops: [
      { itemId: 'stone', minQty: 1, maxQty: 1, chance: 1 },
      { itemId: 'copper_ore', minQty: 1, maxQty: 1, chance: 0.18 },
    ],
  },
  bat: {
    id: 'bat',
    name: '박쥐',
    hp: 2,
    attack: 1,
    speed: 18,
    color: '#5c4c72',
    accent: '#b69ad8',
    passiveDropBonus: 0.01,
    passiveWeights: { move_speed: 1.5, cook_speed: 1.15 },
    drops: [
      { itemId: 'stone', minQty: 1, maxQty: 1, chance: 0.7 },
      { itemId: 'iron_ore', minQty: 1, maxQty: 1, chance: 0.12 },
    ],
  },
  mine_rat: {
    id: 'mine_rat',
    name: '광산쥐',
    hp: 4,
    attack: 2,
    speed: 14,
    color: '#8a705e',
    accent: '#d2b099',
    passiveDropBonus: 0.02,
    passiveWeights: { magnet: 1.25, animal_yield: 1.35, stamina_save: 1.2 },
    drops: [
      { itemId: 'stone', minQty: 1, maxQty: 2, chance: 1 },
      { itemId: 'iron_ore', minQty: 1, maxQty: 1, chance: 0.2 },
    ],
  },
  stone_golem: {
    id: 'stone_golem',
    name: '돌골렘',
    hp: 7,
    attack: 2,
    speed: 7,
    color: '#85858d',
    accent: '#d0d0d8',
    passiveDropBonus: 0.03,
    passiveWeights: { attack: 1.45, ore_bonus: 1.5 },
    rarityBonus: { rare: 0.04, epic: 0.02 },
    drops: [
      { itemId: 'stone', minQty: 2, maxQty: 4, chance: 1 },
      { itemId: 'iron_ore', minQty: 1, maxQty: 2, chance: 0.28 },
    ],
  },
}
