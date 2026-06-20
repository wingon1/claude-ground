import { CoinIcon } from './icons'

type Props = {
  reward: number
  hasNext: boolean
  onNext: () => void
  onReplay: () => void
  onMenu: () => void
}

export default function WinOverlay({ reward, hasNext, onNext, onReplay, onMenu }: Props) {
  return (
    <div className="sk-modal-back">
      <div className="sk-modal sk-win">
        <div className="sk-burst">🎉</div>
        <h2>Solved!</h2>
        {reward > 0 && (
          <div className="sk-reward">
            <CoinIcon size={22} />+{reward}
          </div>
        )}
        <div className="sk-win-actions">
          <button className="sk-btn ghost" onClick={onMenu}>
            Menu
          </button>
          <button className="sk-btn ghost" onClick={onReplay}>
            Replay
          </button>
          {hasNext && (
            <button className="sk-btn" onClick={onNext}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
