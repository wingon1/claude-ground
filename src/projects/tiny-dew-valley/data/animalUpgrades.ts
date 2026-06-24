import balance from './balance.json'

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

const levelDescriptions: Record<string, string> = {
  chicken_speed: '닭농장 생산 대기시간 감소',
  chicken_yield: '달걀 추가 생산 확률 증가',
  cow_speed: '소농장 생산 대기시간 감소',
  cow_yield: '우유 추가 생산 확률 증가',
  pig_speed: '돼지농장 생산 대기시간 감소',
  pig_yield: '베이컨 추가 생산 확률 증가',
}

export const ANIMAL_UPGRADES: AnimalUpgradeDef[] = balance.animals.upgrades.map((upgrade) => ({
  ...upgrade,
  kind: upgrade.kind as AnimalUpgradeKind,
  levelDesc: levelDescriptions[upgrade.id] ?? '',
}))
