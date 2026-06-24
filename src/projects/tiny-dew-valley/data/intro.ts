import { WORLD_LORE } from './worldLore'

export const INTRO_STEPS = [
  {
    id: 'newspaper',
    kind: 'newspaper',
    headline: '민트초코 제조 미수범 탈옥',
    dateLine: `금지령 ${WORLD_LORE.yearsSinceBan}년째, 수도 외곽 교도소`,
    suspectLabel: '모자이크 처리된 수배 사진',
    articleLead:
      '당국은 지난밤 민트초코 제조 미수 혐의로 수감 중이던 인물이 감시망을 피해 탈옥했다고 발표했다.',
    readableCrime:
      '확인된 혐의: 주거지에서 민트향 추출물, 카카오 가루, 유제품을 조합해 금지 식품을 만들려 한 정황.',
    articleTail:
      '수색대는 인근 마을과 산길을 봉쇄했으나, 용의자는 아직 발견되지 않았다.',
  },
  {
    id: 'arrival',
    kind: 'arrival',
    location: '이름 없는 숲의 끝',
    lines: [
      '여기까지는 못 찾겠지.',
      '어, 저기 텐트가 있네.',
      '당분간 저기서 살아야겠다.',
      '그리고 언젠가... 전설의 민트초코를 만들어 먹겠어.',
    ],
  },
] as const

export const INTRO_ARRIVAL_LINES = INTRO_STEPS[1].lines

export type IntroStep = (typeof INTRO_STEPS)[number]
