export type AnimalUpgradeKind = 'speed' | 'yield'

export interface AnimalUpgradeDef {
  id: string
  itemId: string
  farmId: string
  kind: AnimalUpgradeKind
  maxLevel: number
  basePrice: number
  priceStep: number
  levelDesc: string
}

export const ANIMAL_UPGRADES: AnimalUpgradeDef[] = [
  {
    id: 'chicken_speed',
    itemId: 'upgrade_chicken_speed',
    farmId: 'chicken',
    kind: 'speed',
    maxLevel: 3,
    basePrice: 220,
    priceStep: 180,
    levelDesc: '닭농장 생산 대기시간 감소',
  },
  {
    id: 'chicken_yield',
    itemId: 'upgrade_chicken_yield',
    farmId: 'chicken',
    kind: 'yield',
    maxLevel: 3,
    basePrice: 280,
    priceStep: 220,
    levelDesc: '달걀 추가 생산 확률 증가',
  },
  {
    id: 'cow_speed',
    itemId: 'upgrade_cow_speed',
    farmId: 'cow',
    kind: 'speed',
    maxLevel: 3,
    basePrice: 520,
    priceStep: 360,
    levelDesc: '소농장 생산 대기시간 감소',
  },
  {
    id: 'cow_yield',
    itemId: 'upgrade_cow_yield',
    farmId: 'cow',
    kind: 'yield',
    maxLevel: 3,
    basePrice: 640,
    priceStep: 420,
    levelDesc: '우유 추가 생산 확률 증가',
  },
  {
    id: 'pig_speed',
    itemId: 'upgrade_pig_speed',
    farmId: 'pig',
    kind: 'speed',
    maxLevel: 3,
    basePrice: 900,
    priceStep: 520,
    levelDesc: '돼지농장 생산 대기시간 감소',
  },
  {
    id: 'pig_yield',
    itemId: 'upgrade_pig_yield',
    farmId: 'pig',
    kind: 'yield',
    maxLevel: 3,
    basePrice: 1080,
    priceStep: 620,
    levelDesc: '베이컨 추가 생산 확률 증가',
  },
]

