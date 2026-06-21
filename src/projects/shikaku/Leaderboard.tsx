import { useEffect, useState } from 'react'
import { TIER_ORDER, TIERS, type TierId } from './levels'
import { flushPending, topScores, type RankRow } from './leaderboard'
import { TIME_ATTACK } from './timeattack/config'
import { CloseIcon } from './icons'

type Props = {
  initialTier: TierId
  deviceId: string
  onClose: () => void
  /** When set, this freshly submitted row is highlighted even before refetch. */
  highlightScore?: number
}

export default function Leaderboard({ initialTier, deviceId, onClose, highlightScore }: Props) {
  const [tier, setTier] = useState<TierId>(initialTier)
  const [data, setData] = useState<{ tier: TierId; rows: RankRow[]; online: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    // Push any offline-queued scores first, then load the (now current) board.
    flushPending()
      .catch(() => {})
      .then(() => topScores({ mode: TIME_ATTACK.mode, tier, limit: TIME_ATTACK.topN }))
      .then((res) => {
        if (alive) setData({ tier, rows: res.rows, online: res.online })
      })
    return () => {
      alive = false
    }
  }, [tier])

  const fresh = data && data.tier === tier
  const loading = !fresh
  const rows = fresh ? data.rows : []
  const online = fresh ? data.online : true

  // Highlight only the player's single best row (first matching).
  const myIndex = rows.findIndex(
    (r) => r.deviceId === deviceId && (highlightScore === undefined || r.score === highlightScore),
  )

  return (
    <div className="sk-modal-back" onClick={onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-head">
          <h2>
            🏆 랭킹{' '}
            <span className={`sk-lb-badge${online ? ' on' : ''}`}>{online ? '온라인' : '로컬'}</span>
          </h2>
          <button className="sk-iconbtn" onClick={onClose} aria-label="닫기">
            <CloseIcon size={22} />
          </button>
        </div>

        <div className="sk-tier-tabs">
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              className={`sk-tier-tab${t === tier ? ' active' : ''}`}
              onClick={() => setTier(t)}
            >
              {TIERS[t].label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="sk-lb-empty">불러오는 중이에요…</p>
        ) : rows.length === 0 ? (
          <p className="sk-lb-empty">아직 기록이 없어요. 첫 주인공이 되어봐요! ✨</p>
        ) : (
          <div className="sk-lb-list">
            {rows.map((r, i) => {
              const isMine = i === myIndex
              return (
                <div className={`sk-lb-row${isMine ? ' mine' : ''}`} key={`${i}-${r.createdAt}`}>
                  <span className="sk-lb-rank">{i + 1}</span>
                  <span className="sk-lb-name">{r.nickname}</span>
                  <span className="sk-lb-meta">{r.solvedCount}판</span>
                  <span className="sk-lb-score">{r.score.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
