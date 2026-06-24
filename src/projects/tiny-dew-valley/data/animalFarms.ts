import {
  CHICKEN_UNLOCK_FLAG,
  DAIRY_UNLOCK_FLAG,
  PIG_UNLOCK_FLAG,
} from './unlocks'
import balance from './balance.json'

export const ANIMAL_FARM_MAX_ANIMALS = balance.animals.maxAnimals

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

const farmBalance = Object.fromEntries(balance.animals.farms.map((farm) => [farm.id, farm]))

function farm(id: string) {
  const value = farmBalance[id]
  if (!value) throw new Error(`Missing animal farm balance: ${id}`)
  return value
}

export const ANIMAL_FARMS: AnimalFarmDef[] = [
  {
    ...farm('chicken'),
    name: '닭농장',
    animalItemId: 'animal_chicken',
    unlockFlag: CHICKEN_UNLOCK_FLAG,
    color: '#f0c85a',
  },
  {
    ...farm('cow'),
    name: '소농장',
    animalItemId: 'animal_cow',
    unlockFlag: DAIRY_UNLOCK_FLAG,
    color: '#e9e2d2',
  },
  {
    ...farm('pig'),
    name: '돼지농장',
    animalItemId: 'animal_pig',
    unlockFlag: PIG_UNLOCK_FLAG,
    color: '#e89aa8',
  },
]
