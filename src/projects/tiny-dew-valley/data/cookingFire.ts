import type { CostItem } from '../types'

export interface CookingFireUpgrade {
  level: number
  costGold: number
  costItems: CostItem[]
}

export const COOKING_FIRE_BASE_SLOTS = 2
export const COOKING_FIRE_SLOTS_PER_LEVEL = 2
export const COOKING_FIRE_MAX_LEVEL = 4

export const COOKING_FIRE_UPGRADES: CookingFireUpgrade[] = [
  { level: 2, costGold: 180, costItems: [{ itemId: 'stone', qty: 12 }] },
  {
    level: 3,
    costGold: 420,
    costItems: [
      { itemId: 'stone', qty: 24 },
      { itemId: 'wood', qty: 18 },
    ],
  },
  {
    level: 4,
    costGold: 760,
    costItems: [
      { itemId: 'stone', qty: 40 },
      { itemId: 'hardwood', qty: 6 },
    ],
  },
]
