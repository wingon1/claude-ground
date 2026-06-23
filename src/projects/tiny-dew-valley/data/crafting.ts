// Data-driven crafting. A workbench (built from wood) unlocks tier-1 recipes;
// expanding it into a workshop unlocks tier-2. Add a recipe here and it flows
// through the craft menu, the craft() logic and the snapshot automatically.

// Station required: 0 = none (bootstrap), 1 = workbench, 2 = workshop.
export type CraftStation = 0 | 1 | 2

export interface CraftInput {
  itemId: string
  qty: number
}

export interface CraftRecipe {
  id: string
  name: string
  sprite: string
  color?: string
  desc: string
  station: CraftStation
  inputs: CraftInput[]
  /** Item recipes produce an inventory item. */
  output?: { itemId: string; qty: number }
  /** Unlock recipes flip a one-time progression flag instead. */
  unlock?: 'workbench' | 'workshop'
}

export const RECIPES: CraftRecipe[] = [
  {
    id: 'workbench',
    name: '작업대',
    sprite: 'workbench',
    desc: '나무로 짠 작업대. 만들면 더 많은 제작법이 열려요.',
    station: 0,
    inputs: [{ itemId: 'wood', qty: 15 }],
    unlock: 'workbench',
  },
  {
    id: 'fertilizer',
    name: '비료',
    sprite: 'fertilizer',
    desc: '갈아놓은 밭에 뿌리면 물 준 작물이 더 빨리 자라요.',
    station: 1,
    inputs: [
      { itemId: 'fiber', qty: 2 },
      { itemId: 'wood', qty: 1 },
    ],
    output: { itemId: 'fertilizer', qty: 2 },
  },
  {
    id: 'sprinkler',
    name: '스프링클러',
    sprite: 'sprinkler',
    desc: '밭에 설치하면 매일 아침 상하좌우 칸에 자동으로 물을 줘요.',
    station: 1,
    inputs: [
      { itemId: 'wood', qty: 5 },
      { itemId: 'stone', qty: 3 },
    ],
    output: { itemId: 'sprinkler', qty: 1 },
  },
  {
    id: 'workshop',
    name: '작업장 확장',
    sprite: 'workbench',
    color: '#caa05a',
    desc: '작업대를 작업장으로 키워 고급 제작법을 열어요.',
    station: 1,
    inputs: [
      { itemId: 'hardwood', qty: 8 },
      { itemId: 'stone', qty: 12 },
    ],
    unlock: 'workshop',
  },
  {
    id: 'sprinkler_quality',
    name: '고급 스프링클러',
    sprite: 'sprinkler_quality',
    color: '#ffd65c',
    desc: '주변 8칸에 물을 주고 비료 효과까지 더해요.',
    station: 2,
    inputs: [
      { itemId: 'hardwood', qty: 4 },
      { itemId: 'stone', qty: 6 },
    ],
    output: { itemId: 'sprinkler_quality', qty: 1 },
  },
  {
    id: 'fertilizer_deluxe',
    name: '황금 비료',
    sprite: 'fertilizer_deluxe',
    color: '#ffd65c',
    desc: '작물을 한 단계 더 빨리 키우고 품질까지 끌어올려요.',
    station: 2,
    inputs: [
      { itemId: 'fiber', qty: 3 },
      { itemId: 'hardwood', qty: 1 },
      { itemId: 'daffodil', qty: 1 },
    ],
    output: { itemId: 'fertilizer_deluxe', qty: 2 },
  },
]

export const RECIPE_MAP: Record<string, CraftRecipe> = {}
for (const r of RECIPES) RECIPE_MAP[r.id] = r
