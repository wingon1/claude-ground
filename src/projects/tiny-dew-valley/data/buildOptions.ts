import type { BuildOptionDef } from '../types'

export const BUILD_OPTIONS: BuildOptionDef[] = [
  {
    id: 'field_east',
    name: '동쪽 밭 확장',
    description: '자동 파종/수확이 가능한 밭 6칸을 더 엽니다.',
    costGold: 60,
    costItems: [{ itemId: 'wood', qty: 8 }],
    level: 1,
    rect: { x: 23, y: 18, w: 2, h: 3 },
  },
  {
    id: 'field_south',
    name: '아랫밭 정리',
    description: '작물 구역 아래쪽에 밭 12칸을 추가합니다.',
    costGold: 120,
    costItems: [
      { itemId: 'wood', qty: 12 },
      { itemId: 'stone', qty: 4 },
    ],
    level: 2,
    rect: { x: 19, y: 21, w: 6, h: 2 },
  },
  {
    id: 'field_far_east',
    name: '넓은 밭 확장',
    description: '동쪽 빈 땅을 정리해 밭 10칸을 추가합니다.',
    costGold: 220,
    costItems: [
      { itemId: 'wood', qty: 18 },
      { itemId: 'stone', qty: 10 },
    ],
    level: 3,
    rect: { x: 25, y: 18, w: 2, h: 5 },
  },
]
