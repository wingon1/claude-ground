import type { CropDef } from '../types'

// Crop catalogue. Only wheat is unlocked at the start; the rest are opened
// through shop upgrades so the farm grows one production chain at a time.
export const CROPS: Record<string, CropDef> = {
  wheat: {
    id: 'wheat',
    name: '밀',
    seedItemId: 'seed_wheat',
    growDays: 1,
    stages: 3,
    baseSell: 12,
    rollsQuality: false,
    color: '#d9b34c',
  },
  parsnip: {
    id: 'parsnip',
    name: '파스닙',
    seedItemId: 'seed_parsnip',
    growDays: 2,
    stages: 4,
    baseSell: 35,
    rollsQuality: false,
    color: '#e8d27a',
  },
  strawberry: {
    id: 'strawberry',
    name: '딸기',
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
    name: '황금 호박',
    seedItemId: 'seed_golden_pumpkin',
    growDays: 6,
    stages: 6,
    baseSell: 400,
    rollsQuality: true,
    color: '#f2a93b',
  },
}

export const CROP_LIST = Object.values(CROPS)
