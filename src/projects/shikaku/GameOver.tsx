import { useState } from 'react'
import { TIERS } from './levels'
import { submitScore } from './leaderboard'
import { TIME_ATTACK } from './timeattack/config'
import { playCoins, playTap } from './audio'
import type { TimeAttackResult } from './TimeAttack'

type Props = {
  result: TimeAttackResult
  defaultNickname: string
  deviceId: string
  isBest: boolean
  /** Persist nickname + best score. */
  onSaveMeta: (nickname: string) => void
  onReplay: () => void
  onMenu: () => void
  onViewRanking: (nickname: string) => void
}

export default function GameOver({
  result,
  defaultNickname,
  deviceId,
  isBest,
  onSaveMeta,
  onReplay,
  onMenu,
  onViewRanking,
}: Props) {
  const [nickname, setNickname] = useState(defaultNickname)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [online, setOnline] = useState(false)

  const trimmed = nickname.trim().slice(0, 16)

  const submit = async () => {
    if (!trimmed || submitting) return
    setSubmitting(true)
    playTap()
    onSaveMeta(trimmed)
    const res = await submitScore({
      mode: TIME_ATTACK.mode,
      tier: result.tier,
      nickname: trimmed,
      score: result.score,
      comboMax: result.comboMax,
      solvedCount: result.solvedCount,
      durationSec: TIME_ATTACK.durationSec,
      deviceId,
    })
    setOnline(res.online)
    setSubmitted(true)
    setSubmitting(false)
    playCoins()
  }

  return (
    <div className="sk-modal-back">
      <div className="sk-modal sk-win">
        <div className="sk-burst">⏱️</div>
        <h2>시간 종료!</h2>
        {isBest && <div className="sk-ta-best">🎉 최고 기록 갱신!</div>}

        <div className="sk-ta-result">
          <div className="sk-ta-bigscore">{result.score.toLocaleString()}</div>
          <div className="sk-ta-sub">
            {TIERS[result.tier].label} · {result.solvedCount}판 클리어 · 최고 {result.comboMax} 콤보
          </div>
        </div>

        {submitted ? (
          <>
            <div className="sk-ta-submitted">
              {online ? '랭킹에 등록했어요! 🏆' : '로컬 랭킹에 저장했어요 (오프라인)'}
            </div>
            <div className="sk-win-actions">
              <button className="sk-btn ghost" onClick={onMenu}>
                메뉴
              </button>
              <button className="sk-btn ghost" onClick={onReplay}>
                다시하기
              </button>
              <button className="sk-btn" onClick={() => onViewRanking(trimmed)}>
                랭킹 보기
              </button>
            </div>
          </>
        ) : isBest ? (
          <>
            <input
              className="sk-input"
              value={nickname}
              maxLength={16}
              placeholder="닉네임을 입력해요"
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
            />
            <div className="sk-win-actions">
              <button className="sk-btn ghost" onClick={onReplay}>
                다시하기
              </button>
              <button className="sk-btn" disabled={!trimmed || submitting} onClick={submit}>
                {submitting ? '등록 중…' : '랭킹 등록'}
              </button>
            </div>
            <button className="sk-textlink" onClick={onMenu}>
              메뉴로
            </button>
          </>
        ) : (
          <>
            <div className="sk-ta-note">최고 기록은 아니에요. 다시 도전해봐요! 💪</div>
            <div className="sk-win-actions">
              <button className="sk-btn ghost" onClick={onMenu}>
                메뉴
              </button>
              <button className="sk-btn ghost" onClick={() => onViewRanking(trimmed)}>
                랭킹 보기
              </button>
              <button className="sk-btn" onClick={onReplay}>
                다시하기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
