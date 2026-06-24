// Central gameplay balance exports for Tiny Dew Valley.
// Tune numeric economy/progression values in balance.json; keep display copy here.

import balance from './balance.json'

type RewardItem = { itemId: string; qty: number }

const gameplay = balance.gameplay
const cookingFire = balance.cookingFire
const fields = balance.fields
const tutorialReward = Object.fromEntries(balance.tutorialRewards.map((reward) => [reward.id, reward]))

export const INV_SIZE = gameplay.inventorySize
export const WALK_SPEED = gameplay.walkSpeed // art px / sec
export const GAME_MIN_PER_SEC = gameplay.gameMinutesPerSecond // cosmetic day/night only
export const WORK_INTERVAL = gameplay.workInterval // seconds between auto-work hits
export const RESPAWN_SECS = gameplay.respawnSeconds // trees/rocks/stumps regrow after this
export const STAGE_SECS_PER_DAY = gameplay.cropStageSeconds // real seconds per crop "grow day"
export const COOK_BATCH_MAX = gameplay.cookBatchMax
export const START_MAX_STAMINA = gameplay.startMaxStamina

export const COOKING_FIRE_BUILT_FLAG = cookingFire.builtFlag
export const COOKING_FIRE_BUILD_COST = cookingFire.buildCost

export const FIELD_ROW_BASE_GOLD = fields.rowBaseGold
export const FIELD_ROW_GOLD_STEP = fields.rowGoldStep
export const FIELD_ROW_BASE_WOOD = fields.rowBaseWood
export const FIELD_ROW_WOOD_STEP = fields.rowWoodStep

// Stamina costs per auto-work hit.
export const WORK_COST = gameplay.workCost

export const TUTORIAL_REWARDS = [
  {
    id: 'wood5',
    title: '나무 5개 모으기',
    detail: '화로를 만들 첫 재료를 모읍니다.',
    rewardGold: tutorialReward.wood5.rewardGold,
    rewardItems: tutorialReward.wood5.rewardItems as RewardItem[],
    rewardText: tutorialReward.wood5.rewardText,
  },
  {
    id: 'build_fire',
    title: '화로 시작하기',
    detail: '건설탭에서 나무 5개로 화로를 만듭니다.',
    rewardGold: tutorialReward.build_fire.rewardGold,
    rewardItems: tutorialReward.build_fire.rewardItems as RewardItem[],
    rewardText: tutorialReward.build_fire.rewardText,
  },
  {
    id: 'first_bread',
    title: '첫 빵 굽기',
    detail: '밀가루로 첫 빵을 만들어 판매 루프를 시작합니다.',
    rewardGold: tutorialReward.first_bread.rewardGold,
    rewardItems: tutorialReward.first_bread.rewardItems as RewardItem[],
    rewardText: tutorialReward.first_bread.rewardText,
  },
  {
    id: 'first_toast',
    title: '첫 토스트 만들기',
    detail: '빵과 달걀을 조합해 농장 이후의 핵심 상품을 만듭니다.',
    rewardGold: tutorialReward.first_toast.rewardGold,
    rewardItems: tutorialReward.first_toast.rewardItems as RewardItem[],
    rewardText: tutorialReward.first_toast.rewardText,
  },
]

export const ORDER_ITEM_POOL = balance.orders.pool

export const LEGACY_ID_MAP: Record<string, string> = balance.legacyIdMap
