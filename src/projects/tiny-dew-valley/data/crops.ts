import type { CropDef } from '../types'
import balance from './balance.json'

const cropBalance = balance.crops

// Crop catalogue. Only wheat is unlocked at the start; the rest are opened
// through shop upgrades so the farm grows one production chain at a time.
export const CROPS: Record<string, CropDef> = {
  wheat: {
    id: 'wheat',
    name: '밀',
    seedItemId: 'seed_wheat',
    growDays: cropBalance.wheat.growDays,
    stages: 3,
    baseSell: cropBalance.wheat.baseSell,
    rollsQuality: false,
    color: '#d9b34c',
  },
  tomato: {
    id: 'tomato',
    name: '토마토',
    seedItemId: 'seed_tomato',
    growDays: cropBalance.tomato.growDays,
    stages: 4,
    baseSell: cropBalance.tomato.baseSell,
    rollsQuality: false,
    color: '#e64b42',
  },
  strawberry: {
    id: 'strawberry',
    name: '딸기',
    seedItemId: 'seed_strawberry',
    growDays: cropBalance.strawberry.growDays,
    stages: 5,
    baseSell: cropBalance.strawberry.baseSell,
    regrowDays: cropBalance.strawberry.regrowDays,
    rollsQuality: false,
    color: '#e8506e',
  },
  corn: {
    id: 'corn',
    name: '옥수수',
    seedItemId: 'seed_corn',
    growDays: cropBalance.corn.growDays,
    stages: 6,
    baseSell: cropBalance.corn.baseSell,
    regrowDays: cropBalance.corn.regrowDays,
    rollsQuality: false,
    color: '#f0c84b',
  },
}

export const CROP_LIST = Object.values(CROPS)
