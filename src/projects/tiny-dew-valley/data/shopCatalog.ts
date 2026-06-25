import type { ShopEntry } from '../types'
import { ANIMAL_UPGRADES } from './animalUpgrades'
import balance from './balance.json'
import { BACKPACK_UPGRADE_PRICES, INV_BASE_ROWS, backpackUpgradeFlag } from './gameBalance'

function farmUnlockFlag(farmId: string): string {
  if (farmId === 'chicken') return 'unlock:animal:chicken'
  if (farmId === 'cow') return 'unlock:dairy'
  return 'unlock:animal:pig'
}

// Barnaby's General Store sells permanent production unlocks first.
// Animal upgrade shop entries are generated from the animal upgrade balance.
export const SHOP_CATALOG: ShopEntry[] = [
  ...BACKPACK_UPGRADE_PRICES.map((price, index) => ({
    itemId: `upgrade_backpack_row_${INV_BASE_ROWS + index + 1}`,
    buyPrice: price,
    grantsFlag: backpackUpgradeFlag(index),
    requiresFlag: index > 0 ? backpackUpgradeFlag(index - 1) : undefined,
  })),
  ...balance.shop.entries,
  ...ANIMAL_UPGRADES.map((upgrade) => ({
    itemId: upgrade.itemId,
    buyPrice: upgrade.basePrice,
    animalUpgradeId: upgrade.id,
    requiresFlag: farmUnlockFlag(upgrade.farmId),
  })),
]
