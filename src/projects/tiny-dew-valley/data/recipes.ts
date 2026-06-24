import type { RecipeDef } from '../types'
import balance from './balance.json'
import { CHICKEN_UNLOCK_FLAG, DAIRY_UNLOCK_FLAG, PIG_UNLOCK_FLAG, cropUnlockFlag } from './unlocks'

const recipeBalance = Object.fromEntries(balance.recipes.map((recipe) => [recipe.id, recipe]))

const RECIPES_BASE: RecipeDef[] = [
  {
    id: 'flour',
    name: '밀 갈기',
    description: '밀 2개를 갈아 밀가루를 만듭니다.',
    inputs: [{ itemId: 'crop_wheat_normal', qty: 2 }],
    output: { itemId: 'flour', qty: 1 },
    craftSeconds: 6,
  },
  {
    id: 'bread',
    name: '빵 굽기',
    description: '밀가루를 구워 기본 요리인 빵을 만듭니다.',
    inputs: [{ itemId: 'flour', qty: 1 }],
    output: { itemId: 'bread', qty: 1 },
    craftSeconds: 12,
  },
  {
    id: 'toast',
    name: '토스트 굽기',
    description: '빵과 달걀을 구워 든든한 토스트를 만듭니다.',
    inputs: [
      { itemId: 'bread', qty: 1 },
      { itemId: 'egg', qty: 1 },
    ],
    output: { itemId: 'toast', qty: 1 },
    unlockFlag: CHICKEN_UNLOCK_FLAG,
    craftSeconds: 20,
  },
  {
    id: 'tomato_sauce',
    name: '토마토소스 졸이기',
    description: '토마토를 졸여 피자와 고급 요리에 쓰는 소스를 만듭니다.',
    inputs: [{ itemId: 'crop_tomato_normal', qty: 2 }],
    output: { itemId: 'tomato_sauce', qty: 1 },
    unlockFlag: cropUnlockFlag('tomato'),
    craftSeconds: 18,
  },
  {
    id: 'butter',
    name: '버터 만들기',
    description: '우유를 저어 버터를 만듭니다.',
    inputs: [{ itemId: 'milk', qty: 2 }],
    output: { itemId: 'butter', qty: 1 },
    unlockFlag: DAIRY_UNLOCK_FLAG,
    craftSeconds: 18,
  },
  {
    id: 'cheese',
    name: '치즈 숙성',
    description: '우유를 숙성해 치즈를 만듭니다.',
    inputs: [{ itemId: 'milk', qty: 2 }],
    output: { itemId: 'cheese', qty: 1 },
    unlockFlag: DAIRY_UNLOCK_FLAG,
    craftSeconds: 24,
  },
  {
    id: 'strawberry_milk',
    name: '딸기우유 만들기',
    description: '딸기와 우유를 섞어 목장 확장 뒤 바로 만들 수 있는 음료를 만듭니다.',
    inputs: [
      { itemId: 'crop_strawberry_normal', qty: 1 },
      { itemId: 'milk', qty: 1 },
    ],
    output: { itemId: 'strawberry_milk', qty: 1 },
    unlockFlag: cropUnlockFlag('strawberry'),
    craftSeconds: 22,
  },
  {
    id: 'pizza',
    name: '피자 굽기',
    description: '밀가루, 치즈, 토마토소스를 구워 중반 핵심 판매 요리인 피자를 만듭니다.',
    inputs: [
      { itemId: 'flour', qty: 1 },
      { itemId: 'tomato_sauce', qty: 1 },
      { itemId: 'cheese', qty: 1 },
    ],
    output: { itemId: 'pizza', qty: 1 },
    unlockFlag: cropUnlockFlag('tomato'),
    craftSeconds: 40,
  },
  {
    id: 'pastry',
    name: '페스츄리 굽기',
    description: '밀가루와 버터를 조합해 고급 요리를 만듭니다.',
    inputs: [
      { itemId: 'flour', qty: 1 },
      { itemId: 'butter', qty: 1 },
    ],
    output: { itemId: 'pastry', qty: 1 },
    unlockFlag: DAIRY_UNLOCK_FLAG,
    craftSeconds: 42,
  },
  {
    id: 'strawberry_jam',
    name: '딸기쨈 졸이기',
    description: '딸기를 오래 졸여 빵과 유제품 체인에 쓰는 달콤한 쨈을 만듭니다.',
    inputs: [{ itemId: 'crop_strawberry_normal', qty: 2 }],
    output: { itemId: 'strawberry_jam', qty: 1 },
    unlockFlag: cropUnlockFlag('strawberry'),
    craftSeconds: 30,
  },
  {
    id: 'strawberry_jam_toast',
    name: '딸기쨈 토스트 굽기',
    description: '빵, 버터, 딸기쨈을 조합해 딸기 밭과 젖소 농장을 잇는 고급 토스트를 만듭니다.',
    inputs: [
      { itemId: 'bread', qty: 1 },
      { itemId: 'butter', qty: 1 },
      { itemId: 'strawberry_jam', qty: 1 },
    ],
    output: { itemId: 'strawberry_jam_toast', qty: 1 },
    unlockFlag: cropUnlockFlag('strawberry'),
    craftSeconds: 48,
  },
  {
    id: 'butter_corn',
    name: '버터옥수수 굽기',
    description: '옥수수와 버터를 구워 옥수수 밭의 첫 수익 요리를 만듭니다.',
    inputs: [
      { itemId: 'crop_corn_normal', qty: 1 },
      { itemId: 'butter', qty: 1 },
    ],
    output: { itemId: 'butter_corn', qty: 1 },
    unlockFlag: cropUnlockFlag('corn'),
    craftSeconds: 46,
  },
  {
    id: 'corn_pizza',
    name: '콘치즈 피자 굽기',
    description: '피자에 옥수수를 더해 후반에 더 높은 가격을 노리는 고급 요리를 만듭니다.',
    inputs: [
      { itemId: 'flour', qty: 1 },
      { itemId: 'tomato_sauce', qty: 1 },
      { itemId: 'cheese', qty: 1 },
      { itemId: 'crop_corn_normal', qty: 1 },
    ],
    output: { itemId: 'corn_pizza', qty: 1 },
    unlockFlag: cropUnlockFlag('corn'),
    craftSeconds: 68,
  },
  {
    id: 'bacon_toast',
    name: '베이컨 토스트 굽기',
    description: '빵과 베이컨을 조합해 고급 토스트를 만듭니다.',
    inputs: [
      { itemId: 'bread', qty: 1 },
      { itemId: 'bacon', qty: 1 },
    ],
    output: { itemId: 'bacon_toast', qty: 1 },
    unlockFlag: PIG_UNLOCK_FLAG,
    craftSeconds: 36,
  },
  {
    id: 'herbal_tea',
    name: '허브차',
    description: '수선화와 섬유를 우려 스태미나 회복용 차를 만듭니다.',
    inputs: [
      { itemId: 'daffodil', qty: 1 },
      { itemId: 'fiber', qty: 2 },
    ],
    output: { itemId: 'herbal_tea', qty: 1 },
    craftSeconds: 20,
  },
]

export const RECIPES: RecipeDef[] = RECIPES_BASE.map((recipe) => {
  const tuning = recipeBalance[recipe.id]
  return tuning
    ? { ...recipe, craftSeconds: tuning.craftSeconds }
    : recipe
})
