import { clearedCount, type SaveState } from './store'
import { levelCount, TIER_ORDER, TIERS, type TierId } from './levels'
import { CheckIcon, CoinIcon, GearIcon } from './icons'

type Props = {
  state: SaveState
  activeTier: TierId
  onSelectTier: (t: TierId) => void
  onPlay: (tier: TierId, index: number) => void
  onOpenStore: () => void
  onPlayTimeAttack: (tier: TierId) => void
  onOpenRanking: () => void
}

export default function LevelSelect({
  state,
  activeTier,
  onSelectTier,
  onPlay,
  onOpenStore,
  onPlayTimeAttack,
  onOpenRanking,
}: Props) {
  const count = levelCount(activeTier)
  return (
    <div className="sk-app">
      <div className="sk-header">
        <span className="sk-title" style={{ textAlign: 'left', paddingLeft: 4 }}>
          🧩 Shikaku
        </span>
        <span className="sk-coin">
          <CoinIcon size={18} />
          {state.coins}
        </span>
        <button className="sk-iconbtn" onClick={onOpenStore} aria-label="Store & Settings">
          <GearIcon size={22} />
        </button>
      </div>

      <div className="sk-hero">
        <h1>포근한 네모 퍼즐</h1>
        <p>숫자 크기에 맞춰 사각형으로 나눠봐요!</p>
      </div>

      <div className="sk-mode-row">
        <button className="sk-mode-btn primary" onClick={() => onPlayTimeAttack(activeTier)}>
          <span className="sk-mode-emoji">⚡</span>
          <span>
            타임어택 시작
            <small>{TIERS[activeTier].label} · 60초 점수내기</small>
          </span>
        </button>
        <button className="sk-mode-btn" onClick={onOpenRanking} aria-label="랭킹">
          <span className="sk-mode-emoji">🏆</span>
        </button>
      </div>

      <div className="sk-tier-tabs">
        {TIER_ORDER.map((t) => {
          const tier = TIERS[t]
          return (
            <button
              key={t}
              className={`sk-tier-tab${t === activeTier ? ' active' : ''}`}
              onClick={() => onSelectTier(t)}
            >
              {tier.label}
              <small>
                {clearedCount(state, t)}/{levelCount(t)}
              </small>
            </button>
          )
        })}
      </div>

      <div className="sk-grid">
        {Array.from({ length: count }, (_, i) => {
          const cleared = state.progress[activeTier][i]
          return (
            <button
              key={i}
              className={`sk-tile${cleared ? ' cleared' : ''}`}
              onClick={() => onPlay(activeTier, i)}
            >
              {i + 1}
              {cleared && (
                <span className="sk-tile-check">
                  <CheckIcon size={14} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
