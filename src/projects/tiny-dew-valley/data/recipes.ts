import type { RecipeDef } from '../types'
import { DAIRY_UNLOCK_FLAG } from './unlocks'

export const RECIPES: RecipeDef[] = [
  {
    id: 'flour',
    name: '밀 갈기',
    description: '밀 2개를 갈아 밀가루를 만듭니다.',
    inputs: [{ itemId: 'crop_wheat_normal', qty: 2 }],
    output: { itemId: 'flour', qty: 1 },
    craftSeconds: 6,
    difficulty: 1,
  },
  {
    id: 'bread',
    name: '빵 굽기',
    description: '밀가루를 구워 기본 요리인 빵을 만듭니다.',
    inputs: [{ itemId: 'flour', qty: 1 }],
    output: { itemId: 'bread', qty: 1 },
    craftSeconds: 12,
    difficulty: 1,
  },
  {
    id: 'butter',
    name: '버터 만들기',
    description: '우유를 저어 버터를 만듭니다.',
    inputs: [{ itemId: 'milk', qty: 2 }],
    output: { itemId: 'butter', qty: 1 },
    unlockFlag: DAIRY_UNLOCK_FLAG,
    craftSeconds: 18,
    difficulty: 2,
  },
  {
    id: 'cheese',
    name: '치즈 숙성',
    description: '우유를 숙성해 치즈를 만듭니다.',
    inputs: [{ itemId: 'milk', qty: 2 }],
    output: { itemId: 'cheese', qty: 1 },
    unlockFlag: DAIRY_UNLOCK_FLAG,
    craftSeconds: 24,
    difficulty: 2,
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
    difficulty: 4,
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
    difficulty: 2,
  },
]
