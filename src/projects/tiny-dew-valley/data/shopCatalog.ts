import type { ShopEntry } from '../types'
import {
  CHICKEN_UNLOCK_FLAG,
  DAIRY_UNLOCK_FLAG,
  PIG_UNLOCK_FLAG,
  cropUnlockFlag,
} from './unlocks'
import { ANIMAL_UPGRADES } from './animalUpgrades'

// Barnaby's General Store now sells permanent production unlocks first.
// Animal farm ownership creates fenced farms beside the farmhouse.
export const SHOP_CATALOG: ShopEntry[] = [
  { itemId: 'permit_chicken', buyPrice: 300, grantsFlag: CHICKEN_UNLOCK_FLAG },
  { itemId: 'animal_chicken', buyPrice: 120, animalFarmId: 'chicken', requiresFlag: CHICKEN_UNLOCK_FLAG },
  { itemId: 'seed_strawberry', buyPrice: 650, grantsFlag: cropUnlockFlag('strawberry'), requiresFlag: 'seen:item:toast' },
  { itemId: 'permit_dairy', buyPrice: 1100, grantsFlag: DAIRY_UNLOCK_FLAG, requiresFlag: 'seen:item:strawberry_jam' },
  { itemId: 'animal_cow', buyPrice: 320, animalFarmId: 'cow', requiresFlag: DAIRY_UNLOCK_FLAG },
  { itemId: 'seed_tomato', buyPrice: 1400, grantsFlag: cropUnlockFlag('tomato'), requiresFlag: 'seen:item:strawberry_jam_toast' },
  { itemId: 'seed_corn', buyPrice: 2200, grantsFlag: cropUnlockFlag('corn'), requiresFlag: 'seen:item:pizza' },
  { itemId: 'permit_pig', buyPrice: 2600, grantsFlag: PIG_UNLOCK_FLAG, requiresFlag: DAIRY_UNLOCK_FLAG },
  { itemId: 'animal_pig', buyPrice: 480, animalFarmId: 'pig', requiresFlag: PIG_UNLOCK_FLAG },
  ...ANIMAL_UPGRADES.map((upgrade) => ({
    itemId: upgrade.itemId,
    buyPrice: upgrade.basePrice,
    animalUpgradeId: upgrade.id,
    requiresFlag:
      upgrade.farmId === 'chicken'
        ? CHICKEN_UNLOCK_FLAG
        : upgrade.farmId === 'cow'
          ? DAIRY_UNLOCK_FLAG
          : PIG_UNLOCK_FLAG,
  })),
]
