import type { CostItem } from '../types'

export const ACT2_FLAGS = {
  mineGuardianCleared: 'mine:boss:10:cleared',
  suspiciousSeedFound: 'story:act2:suspicious_seed_found',
  suspiciousSeedIdentified: 'story:act2:suspicious_seed_identified',
  greenhouseBuilt: 'story:act2:greenhouse_built',
  germinationResearchDone: 'story:act2:germination_research_done',
  propagationResearchDone: 'story:act2:propagation_research_done',
} as const

export const ACT2_ITEMS = {
  suspiciousSeed: 'seed_suspicious',
  unstableMintSeed: 'seed_mint_unstable',
  unstableMintLeaf: 'mint_leaf_unstable',
  fragrantMintLeaf: 'mint_leaf_fragrant',
  coldMintLeaf: 'mint_leaf_cold',
  legendaryMintLeaf: 'mint_leaf_legendary',
  legendaryMintChocolate: 'legendary_mint_chocolate',
} as const

export type Act2StageId =
  | 'identify_suspicious_seed'
  | 'build_secret_greenhouse'
  | 'germination_research'
  | 'propagation_research'
  | 'stabilize_mint'
  | 'craft_legendary_mint_chocolate'

export interface Act2StageDef {
  id: Act2StageId
  title: string
  detail: string
  requiredFlag?: string
  completedFlag: string
  requiredItems?: CostItem[]
  unlocksHint: string
}

export const ACT2_STAGES: Act2StageDef[] = [
  {
    id: 'identify_suspicious_seed',
    title: '수상한 씨앗 감정하기',
    detail: '그냥 밭에 심지 말고, 씨앗의 정체를 알아낼 사람을 찾으세요.',
    requiredFlag: ACT2_FLAGS.suspiciousSeedFound,
    completedFlag: ACT2_FLAGS.suspiciousSeedIdentified,
    unlocksHint: '비밀 온실 건설',
  },
  {
    id: 'build_secret_greenhouse',
    title: '비밀 온실 준비하기',
    detail: '수상한 씨앗을 안전하게 다룰 전용 공간을 만드세요.',
    requiredFlag: ACT2_FLAGS.suspiciousSeedIdentified,
    completedFlag: ACT2_FLAGS.greenhouseBuilt,
    requiredItems: [
      { itemId: 'wood', qty: 80 },
      { itemId: 'stone', qty: 60 },
      { itemId: 'iron_ore', qty: 20 },
    ],
    unlocksHint: '발아 실험',
  },
  {
    id: 'germination_research',
    title: '발아 실험하기',
    detail: '원종을 직접 소비하지 않고 불안정한 민트 씨앗을 만들어낼 방법을 찾으세요.',
    requiredFlag: ACT2_FLAGS.greenhouseBuilt,
    completedFlag: ACT2_FLAGS.germinationResearchDone,
    requiredItems: [
      { itemId: 'milk', qty: 4 },
      { itemId: 'crop_corn_normal', qty: 4 },
      { itemId: 'iron_ore', qty: 8 },
    ],
    unlocksHint: '민트 씨앗 증식',
  },
  {
    id: 'propagation_research',
    title: '민트 증식 연구하기',
    detail: '실패 부산물도 가치 있게 쓰이도록 반복 가능한 증식 루프를 여세요.',
    requiredFlag: ACT2_FLAGS.germinationResearchDone,
    completedFlag: ACT2_FLAGS.propagationResearchDone,
    requiredItems: [
      { itemId: 'crop_strawberry_normal', qty: 6 },
      { itemId: 'butter', qty: 3 },
      { itemId: 'copper_ore', qty: 12 },
    ],
    unlocksHint: '민트 품질 안정화',
  },
  {
    id: 'stabilize_mint',
    title: '민트 품질 안정화하기',
    detail: '불안정한 민트를 향긋한 민트, 차가운 민트, 전설의 민트로 단계별 안정화하세요.',
    requiredFlag: ACT2_FLAGS.propagationResearchDone,
    completedFlag: 'story:act2:mint_stabilized',
    unlocksHint: '전설의 민트초코 제작',
  },
  {
    id: 'craft_legendary_mint_chocolate',
    title: '전설의 민트초코 만들기',
    detail: '복원한 민트와 고급 축산/요리 재료를 조합해 최종 목표를 완성하세요.',
    requiredFlag: 'story:act2:mint_stabilized',
    completedFlag: 'story:act2:legendary_mint_chocolate_done',
    unlocksHint: '2막 엔드 목표',
  },
]

export function firstAvailableAct2Stage(flags: Record<string, string | number | boolean>): Act2StageDef | null {
  for (const stage of ACT2_STAGES) {
    if (stage.requiredFlag && flags[stage.requiredFlag] !== true) continue
    if (flags[stage.completedFlag] === true) continue
    return stage
  }
  return null
}
