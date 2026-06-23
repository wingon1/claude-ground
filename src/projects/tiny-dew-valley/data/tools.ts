import type { ToolDef, ToolId } from '../types'

export const TOOLS: Record<ToolId, ToolDef> = {
  hoe: {
    id: 'hoe',
    name: '호미',
    hotbarSlot: 0,
    staminaCost: 3,
    description: '풀밭을 갈아 심을 수 있는 밭으로 만든다.',
  },
  watering_can: {
    id: 'watering_can',
    name: '물뿌리개',
    hotbarSlot: 1,
    staminaCost: 3,
    description: '갈아놓은 밭에 물을 준다. 연못에서 다시 채운다.',
  },
  axe: {
    id: 'axe',
    name: '도끼',
    hotbarSlot: 2,
    staminaCost: 3,
    description: '나무·그루터기·돌을 부숴 목재를 얻는다.',
  },
  scythe: {
    id: 'scythe',
    name: '낫',
    hotbarSlot: 3,
    staminaCost: 0,
    description: '잡초를 즉시 베어낸다. 스태미나 소모 없음.',
  },
  hand: {
    id: 'hand',
    name: '손',
    hotbarSlot: 4,
    staminaCost: 0,
    description: '작물 수확, 채집, 상호작용.',
  },
}

export const TOOL_ORDER: ToolId[] = ['hoe', 'watering_can', 'axe', 'scythe', 'hand']

export const WATER_CAPACITY = { basic: 10, copper: 25 }
