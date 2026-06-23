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
  tomato: {
    id: 'tomato',
    name: '토마토',
    seedItemId: 'seed_tomato',
    growDays: 2,
    stages: 4,
    baseSell: 45,
    rollsQuality: false,
    color: '#e64b42',
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
  corn: {
    id: 'corn',
    name: '옥수수',
    seedItemId: 'seed_corn',
    growDays: 5,
    stages: 6,
    baseSell: 120,
    regrowDays: 3,
    rollsQuality: false,
    color: '#f0c84b',
  },
}

export const CROP_LIST = Object.values(CROPS)
