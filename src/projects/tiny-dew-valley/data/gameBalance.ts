// Central gameplay balance constants for Tiny Dew Valley.
// Keep knobs here when they are likely to change during content tuning.

export const INV_SIZE = 24
export const WALK_SPEED = 74 // art px / sec
export const GAME_MIN_PER_SEC = 1200 / 240 // cosmetic day/night only
export const WORK_INTERVAL = 0.42 // seconds between auto-work hits
export const RESPAWN_SECS = 80 // trees/rocks/stumps regrow after this
export const STAGE_SECS_PER_DAY = 22 // real seconds per crop "grow day"
export const COOK_BATCH_MAX = 20
export const START_MAX_STAMINA = 20

export const COOKING_FIRE_BUILT_FLAG = 'build:cookingFire'
export const COOKING_FIRE_BUILD_COST = [{ itemId: 'wood', qty: 5 }]

export const FIELD_ROW_BASE_GOLD = 45
export const FIELD_ROW_GOLD_STEP = 35
export const FIELD_ROW_BASE_WOOD = 6
export const FIELD_ROW_WOOD_STEP = 4

// Stamina costs per auto-work hit.
export const WORK_COST = { chop: 1, harvest: 1, plant: 1 }

export const TUTORIAL_REWARDS = [
  {
    id: 'wood5',
    title: '나무 5개 모으기',
    detail: '화로를 만들 첫 재료를 모읍니다.',
    rewardGold: 20,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '20G',
  },
  {
    id: 'build_fire',
    title: '화로 제작하기',
    detail: '건설탭에서 나무 5개로 화로를 만듭니다.',
    rewardGold: 0,
    rewardItems: [{ itemId: 'crop_wheat_normal', qty: 2 }],
    rewardText: '밀 2개',
  },
  {
    id: 'first_bread',
    title: '첫 빵 굽기',
    detail: '밀가루로 첫 빵을 만들어 판매 루프를 시작합니다.',
    rewardGold: 80,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '80G',
  },
  {
    id: 'first_toast',
    title: '첫 토스트 만들기',
    detail: '빵과 달걀을 조합해 닭장 이후의 핵심 상품을 만듭니다.',
    rewardGold: 150,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '150G',
  },
]

export const ORDER_ITEM_POOL = [
  { itemId: 'bread', minQty: 2, maxQty: 4, hint: '빵 주문은 닭장 자금을 모으기 좋아요.' },
  { itemId: 'toast', minQty: 1, maxQty: 3, hint: '토스트 수익으로 딸기 재배권을 노려보세요.' },
  { itemId: 'strawberry_jam', minQty: 1, maxQty: 3, hint: '딸기쨈은 다음 목장 확장의 징검다리예요.' },
  { itemId: 'strawberry_milk', minQty: 1, maxQty: 2, hint: '우유 라인을 돌리면 고급 디저트가 빨라져요.' },
  { itemId: 'strawberry_jam_toast', minQty: 1, maxQty: 2, hint: '딸기쨈 토스트 다음은 토마토와 피자예요.' },
  { itemId: 'pizza', minQty: 1, maxQty: 2, hint: '피자 수익으로 옥수수 후반 라인을 열어보세요.' },
  { itemId: 'butter_corn', minQty: 1, maxQty: 2, hint: '옥수수는 후반 요리의 좋은 보조 재료예요.' },
  { itemId: 'corn_pizza', minQty: 1, maxQty: 2, hint: '콘치즈 피자는 후반 주문 보상이 큽니다.' },
  { itemId: 'bacon_toast', minQty: 1, maxQty: 2, hint: '돼지농장까지 열면 베이컨 주문도 준비해보세요.' },
]

export const LEGACY_ID_MAP: Record<string, string> = {
  parsnip: 'tomato',
  golden_pumpkin: 'corn',
  seed_parsnip: 'seed_tomato',
  seed_golden_pumpkin: 'seed_corn',
  crop_parsnip_normal: 'crop_tomato_normal',
  crop_golden_pumpkin_normal: 'crop_corn_normal',
  crop_golden_pumpkin_silver: 'crop_corn_normal',
  crop_golden_pumpkin_gold: 'crop_corn_normal',
  crop_golden_pumpkin_perfect: 'crop_corn_normal',
  parsnip_soup: 'tomato_sauce',
  cream_stew: 'pizza',
  pumpkin_soup: 'butter_corn',
  pumpkin_pie: 'corn_pizza',
}
