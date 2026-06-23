import type { RecipeDef } from '../types'

export const RECIPES: RecipeDef[] = [
  {
    id: 'herbal_tea',
    name: '허브차',
    description: '야생 수선화와 섬유를 우려 만든 향긋한 차. 팔거나 이후 퀘스트 재료로 씁니다.',
    inputs: [
      { itemId: 'daffodil', qty: 1 },
      { itemId: 'fiber', qty: 2 },
    ],
    output: { itemId: 'herbal_tea', qty: 1 },
  },
]
