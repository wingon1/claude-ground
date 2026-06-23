import {
  CHICKEN_UNLOCK_FLAG,
  DAIRY_UNLOCK_FLAG,
  PIG_UNLOCK_FLAG,
} from './unlocks'

export interface AnimalFarmDef {
  id: string
  name: string
  unlockFlag: string
  productItemId: string
  productQty: number
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
    unlockFlag: CHICKEN_UNLOCK_FLAG,
    productItemId: 'egg',
    productQty: 2,
    x: 36,
    y: 6,
    w: 7,
    h: 6,
    color: '#f0c85a',
  },
  {
    id: 'cow',
    name: '소농장',
    unlockFlag: DAIRY_UNLOCK_FLAG,
    productItemId: 'milk',
    productQty: 2,
    x: 36,
    y: 13,
    w: 7,
    h: 6,
    color: '#e9e2d2',
  },
  {
    id: 'pig',
    name: '돼지농장',
    unlockFlag: PIG_UNLOCK_FLAG,
    productItemId: 'bacon',
    productQty: 1,
    x: 36,
    y: 20,
    w: 7,
    h: 6,
    color: '#e89aa8',
  },
]
