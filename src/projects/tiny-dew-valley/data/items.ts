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
  silver: '실버 ',
  gold: '골드 ',
  perfect: '퍼펙트 ',
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
    name: '파스닙 씨앗',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 10,
    description: '튼튼한 뿌리채소. 2일이면 자란다.',
    usable: false,
    giftValue: 5,
    sprite: 'seed_parsnip',
  },
  {
    id: 'seed_strawberry',
    name: '딸기 씨앗',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 30,
    description: '달콤하고 넉넉하다. 2일마다 다시 열린다.',
    usable: false,
    giftValue: 8,
    sprite: 'seed_strawberry',
  },
  {
    id: 'seed_golden_pumpkin',
    name: '황금 호박 씨앗',
    type: 'seed',
    stackable: true,
    maxStack: 99,
    sellPrice: 75,
    description: '희귀한 박. 품질이 크게 갈린다.',
    usable: false,
    giftValue: 12,
    sprite: 'seed_golden_pumpkin',
  },
  // ---- Materials ----
  {
    id: 'wood',
    name: '나무',
    type: 'wood',
    stackable: true,
    maxStack: 99,
    sellPrice: 4,
    description: '나무와 그루터기에서 나오는 흔한 목재.',
    usable: false,
    giftValue: 2,
    sprite: 'wood',
  },
  {
    id: 'hardwood',
    name: '단단한 통나무',
    type: 'hardwood',
    stackable: true,
    maxStack: 99,
    sellPrice: 25,
    description: '거대한 그루터기에서 나오는 단단한 통나무. 신단이 원한다.',
    usable: false,
    giftValue: 6,
    sprite: 'hardwood',
  },
  {
    id: 'stone',
    name: '돌',
    type: 'stone',
    stackable: true,
    maxStack: 99,
    sellPrice: 3,
    description: '평범한 돌멩이. 페이는 이런 걸 지루해한다.',
    usable: false,
    giftValue: -8,
    sprite: 'stone',
  },
  {
    id: 'fiber',
    name: '섬유',
    type: 'material',
    stackable: true,
    maxStack: 99,
    sellPrice: 2,
    description: '잡초를 베면 얻는 질긴 섬유. 비료 재료로 쓰인다.',
    usable: false,
    giftValue: 1,
    sprite: 'fiber',
  },
  // ---- Crafted placeables ----
  {
    id: 'fertilizer',
    name: '비료',
    type: 'placeable',
    stackable: true,
    maxStack: 99,
    sellPrice: 8,
    description: '갈아놓은 밭에 뿌리면 물 준 작물이 더 빨리 자란다.',
    usable: false,
    giftValue: 2,
    sprite: 'fertilizer',
  },
  {
    id: 'fertilizer_deluxe',
    name: '황금 비료',
    type: 'placeable',
    stackable: true,
    maxStack: 99,
    sellPrice: 30,
    description: '작물을 더 빨리 키우고 품질까지 올려주는 고급 비료.',
    usable: false,
    giftValue: 5,
    sprite: 'fertilizer_deluxe',
  },
  {
    id: 'sprinkler',
    name: '스프링클러',
    type: 'placeable',
    stackable: true,
    maxStack: 99,
    sellPrice: 40,
    description: '갈아놓은 밭에 설치하면 매일 아침 상하좌우 칸에 물을 준다.',
    usable: false,
    giftValue: 3,
    sprite: 'sprinkler',
  },
  {
    id: 'sprinkler_quality',
    name: '고급 스프링클러',
    type: 'placeable',
    stackable: true,
    maxStack: 99,
    sellPrice: 120,
    description: '주변 8칸에 물을 주고 비료 효과까지 더하는 스프링클러.',
    usable: false,
    giftValue: 6,
    sprite: 'sprinkler_quality',
  },
  // ---- Forage ----
  {
    id: 'daffodil',
    name: '야생 수선화',
    type: 'forage',
    stackable: true,
    maxStack: 99,
    sellPrice: 30,
    description: '밝은 봄꽃. 숲속의 누군가가 무척 좋아한다.',
    usable: false,
    giftValue: 40,
    sprite: 'daffodil',
  },
  // ---- Food / recipes ----
  {
    id: 'herbal_tea',
    name: '허브차',
    type: 'food',
    stackable: true,
    maxStack: 99,
    sellPrice: 50,
    description: '페이의 비밀 차. 마시면 최대 스태미나가 130이 된다.',
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
      description: `수확한 ${crop.name}. 맛있고 기운을 북돋아 준다.`,
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
