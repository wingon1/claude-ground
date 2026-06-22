import type { CropDef } from '../types'

// Data-driven crop catalogue. Add a new crop here + its seed item in items.ts
// and it flows through planting, growth, harvest and selling automatically.
export const CROPS: Record<string, CropDef> = {
  parsnip: {
    id: 'parsnip',
    name: 'Parsnip',
    seedItemId: 'seed_parsnip',
    growDays: 2,
    stages: 4,
    baseSell: 35,
    rollsQuality: false,
    color: '#e8d27a',
  },
  strawberry: {
    id: 'strawberry',
    name: 'Strawberry',
    seedItemId: 'seed_strawberry',
    growDays: 4,
    stages: 5,
    baseSell: 80,
    regrowDays: 2,
    rollsQuality: false,
    color: '#e8506e',
  },
  golden_pumpkin: {
    id: 'golden_pumpkin',
    name: 'Golden Pumpkin',
    seedItemId: 'seed_golden_pumpkin',
    growDays: 6,
    stages: 6,
    baseSell: 400,
    rollsQuality: true,
    color: '#f2a93b',
  },
}

export const CROP_LIST = Object.values(CROPS)
