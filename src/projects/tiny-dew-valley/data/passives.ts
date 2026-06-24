export type PassiveRarity = 'normal' | 'rare' | 'epic'

export type PassiveId =
  | 'move_speed'
  | 'magnet'
  | 'animal_yield'
  | 'crop_yield'
  | 'attack'
  | 'ore_bonus'
  | 'cook_speed'
  | 'stamina_save'

export interface PassiveDef {
  id: PassiveId
  name: string
  description: string
  unit: 'percent' | 'tile' | 'flat'
  values: Record<PassiveRarity, number>
}

export const PASSIVE_RARITIES: PassiveRarity[] = ['normal', 'rare', 'epic']

export const PASSIVE_RARITY_LABEL: Record<PassiveRarity, string> = {
  normal: '노멀',
  rare: '레어',
  epic: '에픽',
}

export const PASSIVE_RARITY_WEIGHT: Record<PassiveRarity, number> = {
  normal: 1,
  rare: 2,
  epic: 3,
}

export const PASSIVES: PassiveDef[] = [
  {
    id: 'move_speed',
    name: '바람걸음',
    description: '이동속도가 증가합니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.18 },
  },
  {
    id: 'magnet',
    name: '자석',
    description: '근처 바닥 아이템을 자동으로 획득합니다.',
    unit: 'tile',
    values: { normal: 1, rare: 2, epic: 3 },
  },
  {
    id: 'animal_yield',
    name: '따뜻한 종',
    description: '동물 생산품이 추가로 나올 확률이 증가합니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.18 },
  },
  {
    id: 'crop_yield',
    name: '풍요의 씨앗',
    description: '작물 수확 시 추가 수확 확률이 증가합니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.18 },
  },
  {
    id: 'attack',
    name: '금 간 검날',
    description: '몬스터에게 주는 피해가 증가합니다.',
    unit: 'flat',
    values: { normal: 1, rare: 2, epic: 4 },
  },
  {
    id: 'ore_bonus',
    name: '광부의 부적',
    description: '광석과 돌을 추가로 얻을 확률이 증가합니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.18 },
  },
  {
    id: 'cook_speed',
    name: '은빛 톱니',
    description: '요리 시간이 줄어듭니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.18 },
  },
  {
    id: 'stamina_save',
    name: '가벼운 손잡이',
    description: '작업 스태미나 소모를 줄일 확률이 증가합니다.',
    unit: 'percent',
    values: { normal: 0.05, rare: 0.1, epic: 0.15 },
  },
]

export function passiveDef(id: string): PassiveDef | undefined {
  return PASSIVES.find((passive) => passive.id === id)
}

export function passiveValueText(passive: PassiveDef, rarity: PassiveRarity): string {
  const value = passive.values[rarity]
  if (passive.unit === 'percent') return `+${Math.round(value * 100)}%`
  if (passive.unit === 'tile') return `+${value}칸`
  return `+${value}`
}
