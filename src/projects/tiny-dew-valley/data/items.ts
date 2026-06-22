import type { CropQuality, ItemDef } from '../types'
import { CROP_LIST } from './crops'

// Quality multipliers applied to a crop's base sell price.
export const QUALITY_MULT: Record<CropQuality, number> = {
  normal: 1,
  silver: 1.25,
  gold: 1.5,
  perfect: 2,
}

export const QUALITY_LABEL: Record<CropQuality, string> = {
  normal: '',
  silver: 'Silver ',
  gold: 'Gold ',
  perfect: 'Perfect ',
}

export const QUALITY_COLOR: Record<CropQuality, string> = {
  normal: '#cfcfcf',
  silver: '#d8e6f0',
  gold: '#ffd65c',
  perfect: '#9af0c0',
}

export const QUALITIES: CropQuality[] = ['normal', 'silver', 'gold', 'perfect']

// Item id helper for a harvested crop of a given quality.
export function cropItemId(cropId: string, quality: CropQuality): string {
  return `crop_${cropId}_${quality}`
}

const base: ItemDef[] = [
  // ---- Seeds ----
  {
    id: 'seed_parsnip',
    name: 'Parsnip Seeds',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 10,
    description: 'Hardy roots. Grows in 2 days.',
    usable: false,
    giftValue: 5,
    sprite: 'seed_parsnip',
  },
  {
    id: 'seed_strawberry',
    name: 'Strawberry Seeds',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 30,
    description: 'Sweet & generous. Regrows every 2 days.',
    usable: false,
    giftValue: 8,
    sprite: 'seed_strawberry',
  },
  {
    id: 'seed_golden_pumpkin',
    name: 'Golden Pumpkin Seeds',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 75,
    description: 'A rare gourd. Quality varies wildly.',
    usable: false,
    giftValue: 12,
    sprite: 'seed_golden_pumpkin',
  },
  // ---- Materials ----
  {
    id: 'wood',
    name: 'Wood',
    type: 'wood',
    stackable: true,
    maxStack: 99,
    sellPrice: 4,
    description: 'Common timber from trees and stumps.',
    usable: false,
    giftValue: 2,
    sprite: 'wood',
  },
  {
    id: 'hardwood',
    name: 'Hardwood Log',
    type: 'hardwood',
    stackable: true,
    maxStack: 99,
    sellPrice: 25,
    description: 'Dense log from a great stump. The shrine craves these.',
    usable: false,
    giftValue: 6,
    sprite: 'hardwood',
  },
  {
    id: 'stone',
    name: 'Stone',
    type: 'stone',
    stackable: true,
    maxStack: 99,
    sellPrice: 3,
    description: 'A plain rock. Faye finds these dreadfully dull.',
    usable: false,
    giftValue: -8,
    sprite: 'stone',
  },
  // ---- Forage ----
  {
    id: 'daffodil',
    name: 'Wild Daffodil',
    type: 'forage',
    stackable: true,
    maxStack: 99,
    sellPrice: 30,
    description: 'A bright spring bloom. Someone in the woods adores these.',
    usable: false,
    giftValue: 40,
    sprite: 'daffodil',
  },
  // ---- Food / recipes ----
  {
    id: 'herbal_tea',
    name: 'Herbal Tea',
    type: 'food',
    stackable: true,
    maxStack: 99,
    sellPrice: 50,
    description: "Faye's secret brew. Drinking it raises Max Stamina to 130.",
    usable: true,
    staminaRestore: 40,
    giftValue: 20,
    sprite: 'herbal_tea',
  },
]

// Expand crop items per quality.
const cropItems: ItemDef[] = []
for (const crop of CROP_LIST) {
  const qualities: CropQuality[] = crop.rollsQuality
    ? QUALITIES
    : ['normal']
  for (const q of qualities) {
    cropItems.push({
      id: cropItemId(crop.id, q),
      name: `${QUALITY_LABEL[q]}${crop.name}`,
      type: crop.id === 'golden_pumpkin' && q === 'perfect' ? 'offering' : 'crop',
      stackable: true,
      maxStack: 99,
      sellPrice: Math.round(crop.baseSell * QUALITY_MULT[q]),
      description: `A harvested ${crop.name.toLowerCase()}. Tasty and restorative.`,
      usable: true,
      staminaRestore: Math.round(12 + crop.baseSell * 0.08 * QUALITY_MULT[q]),
      giftValue: 14,
      cropId: crop.id,
      quality: q,
      sprite: `crop_${crop.id}`,
    })
  }
}

export const ITEMS: Record<string, ItemDef> = {}
for (const it of [...base, ...cropItems]) ITEMS[it.id] = it

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id]
}
