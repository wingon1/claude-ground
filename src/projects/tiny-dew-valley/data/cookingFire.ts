import type { CostItem } from '../types'
import balance from './balance.json'

export interface CookingFireUpgrade {
  level: number
  costGold: number
  costItems: CostItem[]
}

export const COOKING_FIRE_BASE_SLOTS = balance.cookingFire.baseSlots
export const COOKING_FIRE_SLOTS_PER_LEVEL = balance.cookingFire.slotsPerLevel
export const COOKING_FIRE_MAX_LEVEL = balance.cookingFire.maxLevel

export const COOKING_FIRE_UPGRADES: CookingFireUpgrade[] = balance.cookingFire.upgrades
