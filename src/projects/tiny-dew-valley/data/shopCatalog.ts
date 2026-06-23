import type { ShopEntry } from '../types'
import { DAIRY_UNLOCK_FLAG, cropUnlockFlag } from './unlocks'

// Barnaby's General Store now sells permanent production unlocks first.
// Milk appears after the dairy permit, feeding the butter/cheese chain.
export const SHOP_CATALOG: ShopEntry[] = [
  { itemId: 'seed_parsnip', buyPrice: 80, grantsFlag: cropUnlockFlag('parsnip') },
  { itemId: 'seed_strawberry', buyPrice: 180, grantsFlag: cropUnlockFlag('strawberry') },
  { itemId: 'seed_golden_pumpkin', buyPrice: 360, grantsFlag: cropUnlockFlag('golden_pumpkin') },
  { itemId: 'permit_dairy', buyPrice: 220, grantsFlag: DAIRY_UNLOCK_FLAG },
  { itemId: 'milk', buyPrice: 28, requiresFlag: DAIRY_UNLOCK_FLAG },
]
