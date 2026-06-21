// Time-attack tuning — one place to tweak everything (extensible).

export const TIME_ATTACK = {
  /** Round length in seconds. 우선 60초, 언제든 변경 가능. */
  durationSec: 60,
  /** 다음 정답까지 이 시간(초)을 넘기면 콤보가 끊긴다. */
  comboWindowSec: 6,
  /** 콤보 1당 점수 배수 증가량 (combo 0 → x1, combo 2 → x2 …). */
  comboStep: 0.5,
  points: {
    /** 정답 사각형 하나당 기본 점수. */
    perRectBase: 10,
    /** 사각형 칸 수(넓이)당 추가 점수. */
    perAreaBonus: 2,
    /** 보드 하나를 완성했을 때 보너스. */
    boardClearBonus: 50,
  },
  /** 점수 레코드의 모드 식별자 (향후 다른 모드 확장용). */
  mode: 'timeattack' as const,
  /** 랭킹보드에 보여줄 상위 인원 수. */
  topN: 20,
} as const

/** 정답 사각형 하나의 점수 = (기본 + 넓이보너스) × 콤보배수. */
export function scoreForRect(area: number, combo: number): number {
  const { perRectBase, perAreaBonus } = TIME_ATTACK.points
  const mult = 1 + combo * TIME_ATTACK.comboStep
  return Math.floor((perRectBase + area * perAreaBonus) * mult)
}
