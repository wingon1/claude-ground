import type { ShopEntry } from '../types'

// Barnaby's General Store. Buyable seeds + tool upgrades.
export const SHOP_CATALOG: ShopEntry[] = [
  { itemId: 'seed_parsnip', buyPrice: 20 },
  { itemId: 'seed_strawberry', buyPrice: 60 },
  { itemId: 'seed_golden_pumpkin', buyPrice: 150 },
  { itemId: 'copper_can', buyPrice: 500, upgrade: 'copper_can' },
  { itemId: 'backpack', buyPrice: 800, upgrade: 'backpack' },
]

// Seed discount fraction once Barnaby hits 2 hearts.
export const SEED_DISCOUNT = 0.2
// Shipping bonus fraction once Barnaby hits 5 hearts.
export const SHIPPING_BONUS = 0.15
