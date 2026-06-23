import type { ShopEntry } from '../types'
import {
  CHICKEN_UNLOCK_FLAG,
  DAIRY_UNLOCK_FLAG,
  PIG_UNLOCK_FLAG,
  cropUnlockFlag,
} from './unlocks'

// Barnaby's General Store now sells permanent production unlocks first.
// Animal farm ownership creates fenced farms beside the farmhouse.
export const SHOP_CATALOG: ShopEntry[] = [
  { itemId: 'seed_parsnip', buyPrice: 80, grantsFlag: cropUnlockFlag('parsnip') },
  { itemId: 'seed_strawberry', buyPrice: 180, grantsFlag: cropUnlockFlag('strawberry') },
  { itemId: 'seed_golden_pumpkin', buyPrice: 360, grantsFlag: cropUnlockFlag('golden_pumpkin') },
  { itemId: 'permit_chicken', buyPrice: 160, grantsFlag: CHICKEN_UNLOCK_FLAG },
  { itemId: 'animal_chicken', buyPrice: 90, animalFarmId: 'chicken', requiresFlag: CHICKEN_UNLOCK_FLAG },
  { itemId: 'permit_dairy', buyPrice: 320, grantsFlag: DAIRY_UNLOCK_FLAG, requiresFlag: CHICKEN_UNLOCK_FLAG },
  { itemId: 'animal_cow', buyPrice: 180, animalFarmId: 'cow', requiresFlag: DAIRY_UNLOCK_FLAG },
  { itemId: 'permit_pig', buyPrice: 520, grantsFlag: PIG_UNLOCK_FLAG, requiresFlag: DAIRY_UNLOCK_FLAG },
  { itemId: 'animal_pig', buyPrice: 280, animalFarmId: 'pig', requiresFlag: PIG_UNLOCK_FLAG },
]
