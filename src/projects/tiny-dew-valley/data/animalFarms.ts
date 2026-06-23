import {
  CHICKEN_UNLOCK_FLAG,
  DAIRY_UNLOCK_FLAG,
  PIG_UNLOCK_FLAG,
} from './unlocks'

export interface AnimalFarmDef {
  id: string
  name: string
  animalItemId: string
  unlockFlag: string
  productItemId: string
  productQty: number
  dropSeconds: number
  animalBasePrice: number
  animalPriceStep: number
  x: number
  y: number
  w: number
  h: number
  color: string
}

export const ANIMAL_FARMS: AnimalFarmDef[] = [
  {
    id: 'chicken',
    name: '닭농장',
    animalItemId: 'animal_chicken',
    unlockFlag: CHICKEN_UNLOCK_FLAG,
    productItemId: 'egg',
    productQty: 1,
    dropSeconds: 5,
    animalBasePrice: 90,
    animalPriceStep: 45,
    x: 36,
    y: 6,
    w: 7,
    h: 6,
    color: '#f0c85a',
  },
  {
    id: 'cow',
    name: '소농장',
    animalItemId: 'animal_cow',
    unlockFlag: DAIRY_UNLOCK_FLAG,
    productItemId: 'milk',
    productQty: 1,
    dropSeconds: 7,
    animalBasePrice: 180,
    animalPriceStep: 90,
    x: 36,
    y: 13,
    w: 7,
    h: 6,
    color: '#e9e2d2',
  },
  {
    id: 'pig',
    name: '돼지농장',
    animalItemId: 'animal_pig',
    unlockFlag: PIG_UNLOCK_FLAG,
    productItemId: 'bacon',
    productQty: 1,
    dropSeconds: 9,
    animalBasePrice: 280,
    animalPriceStep: 140,
    x: 36,
    y: 20,
    w: 7,
    h: 6,
    color: '#e89aa8',
  },
]
