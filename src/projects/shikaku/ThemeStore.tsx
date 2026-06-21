import type { SaveState } from './store'
import { THEME_ORDER, THEMES, type ThemeId } from './themes'
import { CloseIcon, CoinIcon, SoundOffIcon, SoundOnIcon } from './icons'

type Props = {
  state: SaveState
  onBuy: (id: ThemeId) => void
  onEquip: (id: ThemeId) => void
  onToggleSound: () => void
  onClose: () => void
}

export default function ThemeStore({ state, onBuy, onEquip, onToggleSound, onClose }: Props) {
  return (
    <div className="sk-modal-back" onClick={onClose}>
      <div className="sk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sk-modal-head">
          <h2>테마 상점</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="sk-coin">
              <CoinIcon size={18} />
              {state.coins}
            </span>
            <button className="sk-iconbtn" onClick={onClose} aria-label="Close">
              <CloseIcon size={22} />
            </button>
          </div>
        </div>

        {THEME_ORDER.map((id) => {
          const theme = THEMES[id]
          const owned = state.ownedThemes.includes(id)
          const equipped = state.activeTheme === id
          const affordable = state.coins >= theme.cost
          return (
            <div className="sk-theme-card" key={id}>
              <div className="sk-swatches">
                {theme.swatch.map((s, i) => (
                  <span key={i} className="sk-swatch" style={{ background: s }} />
                ))}
              </div>
              <div className="sk-theme-info">
                <strong>{theme.name}</strong>
                <span>
                  {owned ? (equipped ? '사용 중' : '보유 중') : `${theme.cost} 코인`}
                </span>
              </div>
              {equipped ? (
                <button className="sk-btn equipped" disabled>
                  사용 중
                </button>
              ) : owned ? (
                <button className="sk-btn ghost" onClick={() => onEquip(id)}>
                  적용하기
                </button>
              ) : (
                <button className="sk-btn" disabled={!affordable} onClick={() => onBuy(id)}>
                  구매하기
                </button>
              )}
            </div>
          )
        })}

        <div className="sk-toggle-row">
          <span>소리</span>
          <button className="sk-iconbtn" onClick={onToggleSound} aria-label="소리 켜기/끄기">
            {state.sound ? <SoundOnIcon size={22} /> : <SoundOffIcon size={22} />}
          </button>
        </div>
      </div>
    </div>
  )
}
