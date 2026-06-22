import { useRef, useState } from 'react'
import type { Game, UISnapshot } from '../engine/game'
import { iconURL } from '../engine/sprites'

const QUALITY_GLYPH: Record<string, string> = {
  silver: '◇',
  gold: '◆',
  perfect: '★',
}

export function Overlay({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [invSel, setInvSel] = useState<number | null>(null)
  const [shopTab, setShopTab] = useState<'buy' | 'sell'>('buy')

  if (ui.phase === 'title') {
    return <TitleScreen game={game} />
  }

  const modalOpen =
    ui.phase === 'shop' || ui.phase === 'shrine' || ui.phase === 'tally' || ui.phase === 'ending' || ui.phase === 'sleepConfirm' || invOpen

  return (
    <>
      {/* HUD */}
      <div className="tdv-hud">
        <div className="tdv-panel tdv-clock">
          <div className="row big">
            <span>Day {ui.day}</span>
            <span>{ui.clock}</span>
          </div>
          <div className="tdv-period">{ui.period}</div>
          <div className="row">
            <span>💰</span>
            <span className="tdv-gold">{ui.gold}G</span>
          </div>
        </div>

        <div className="tdv-rightcol">
          <div className="tdv-iconbtns">
            <button className="tdv-iconbtn" title="Menu" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            <button className="tdv-iconbtn" title="Backpack" onClick={() => { setInvOpen(true); setInvSel(null) }}>🎒</button>
          </div>
          <div className="tdv-panel tdv-bars">
            <Bar
              cls={ui.stamina <= ui.maxStamina * 0.25 ? 'stam low' : 'stam'}
              value={ui.stamina}
              max={ui.maxStamina}
              label={`⚡ ${ui.stamina}/${ui.maxStamina}`}
            />
            <Bar cls="water" value={ui.water} max={ui.waterMax} label={`💧 ${ui.water}/${ui.waterMax}`} />
          </div>
          <div className="tdv-panel tdv-hearts">
            {ui.npcHearts.map((n) => (
              <div className="tdv-npc-heart" key={n.id}>
                <span className="dot" style={{ background: n.color }} />
                <span>{'♥'.repeat(n.hearts)}{'·'.repeat(n.max - n.hearts)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {ui.exhausted && <div className="tdv-exhaust">EXHAUSTED — half speed</div>}

      {/* Toasts */}
      <div className="tdv-toasts">
        {ui.toasts.map((t) => (
          <div className={`tdv-toast ${t.kind}`} key={t.id}>{t.text}</div>
        ))}
      </div>

      {menuOpen && (
        <div className="tdv-menu">
          <button className="tdv-btn" onClick={() => { game.saveNow(); setMenuOpen(false) }}>💾 Save</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMute()}>{ui.muted ? '🔇 Unmute' : '🔊 Mute'}</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMusic()}>{ui.musicOn ? '🎵 Music On' : '🎵 Music Off'}</button>
          <button
            className="tdv-btn red"
            onClick={() => {
              if (confirm('Delete save and return to title? This cannot be undone.')) {
                game.deleteSaveData()
                location.reload()
              }
            }}
          >🗑 Delete Save</button>
          <button className="tdv-btn ghost" onClick={() => setMenuOpen(false)}>Close</button>
        </div>
      )}

      {/* Hotbar */}
      <div className="tdv-hotbar">
        {ui.tools.map((t, i) => (
          <Slot key={`t${i}`} keyLabel={`${i + 1}`} selected={t.selected} onClick={() => game.selectSlot(i)}>
            <img src={iconURL(t.sprite, t.color)} alt={t.label} />
            {t.extra && <span className="extra">{t.extra}</span>}
          </Slot>
        ))}
        {ui.items.map((it, i) => (
          <Slot
            key={`i${i}`}
            keyLabel={`${i === 4 ? 0 : i + 6}`}
            selected={it.selected}
            empty={it.kind === 'empty'}
            sep={i === 0}
            onClick={() => game.selectSlot(5 + i)}
          >
            {it.id && <img src={iconURL(it.sprite, it.color)} alt={it.label} />}
            {it.id && it.qty != null && <span className="qty">{it.qty}</span>}
          </Slot>
        ))}
      </div>

      {/* Mobile + action controls */}
      {!modalOpen && !ui.dialogue && (
        <>
          <Joystick onVec={(x, y) => game.setMobileVector(x, y)} />
          <div className="tdv-minibtns">
            <button className="tdv-minibtn" onClick={() => game.requestSleep()}><span className="ic">🛏</span></button>
            <button className="tdv-minibtn" onClick={() => { setInvOpen(true); setInvSel(null) }}><span className="ic">🎒</span></button>
          </div>
          <button
            className="tdv-action"
            onPointerDown={(e) => { e.preventDefault(); game.pressAction() }}
          >
            {ui.contextAction ?? 'Act'}
          </button>
        </>
      )}

      {/* Dialogue */}
      {ui.dialogue && (
        <div className="tdv-dialogue" onClick={() => game.pressAction()}>
          <div className="who">
            <span className="dot" style={{ background: ui.dialogue.color }} />
            {ui.dialogue.name}
          </div>
          <div className="txt">{ui.dialogue.text}</div>
          <div className="hint">tap to continue ▸</div>
        </div>
      )}

      {/* Modals */}
      {ui.phase === 'shop' && (
        <ShopModal game={game} ui={ui} tab={shopTab} setTab={setShopTab} />
      )}
      {ui.phase === 'shrine' && <ShrineModal game={game} ui={ui} />}
      {ui.phase === 'sleepConfirm' && <SleepConfirm game={game} />}
      {ui.phase === 'tally' && ui.tally && <TallyModal game={game} ui={ui} />}
      {ui.phase === 'ending' && <EndingModal game={game} ui={ui} />}
      {invOpen && ui.phase === 'playing' && (
        <InventoryModal
          game={game}
          ui={ui}
          sel={invSel}
          setSel={setInvSel}
          onClose={() => setInvOpen(false)}
        />
      )}
    </>
  )
}

function Bar({ cls, value, max, label }: { cls: string; value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="tdv-bar">
      <span className={cls} style={{ width: `${pct}%` }} />
      <label>{label}</label>
    </div>
  )
}

function Slot({
  children,
  keyLabel,
  selected,
  empty,
  sep,
  onClick,
}: {
  children: React.ReactNode
  keyLabel: string
  selected: boolean
  empty?: boolean
  sep?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`tdv-slot${selected ? ' sel' : ''}${empty ? ' empty' : ''}${sep ? ' sep' : ''}`}
      onClick={onClick}
    >
      <span className="key">{keyLabel}</span>
      {children}
    </div>
  )
}

function Joystick({ onVec }: { onVec: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const active = useRef(false)

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const max = r.width / 2
    const len = Math.hypot(dx, dy)
    if (len > max) {
      dx = (dx / len) * max
      dy = (dy / len) * max
    }
    setPos({ x: dx, y: dy })
    const nx = dx / max
    const ny = dy / max
    const dead = 0.25
    onVec(Math.abs(nx) < dead ? 0 : nx, Math.abs(ny) < dead ? 0 : ny)
  }

  return (
    <div
      ref={ref}
      className="tdv-joy"
      onPointerDown={(e) => {
        active.current = true
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        handle(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => { if (active.current) handle(e.clientX, e.clientY) }}
      onPointerUp={() => { active.current = false; setPos({ x: 0, y: 0 }); onVec(0, 0) }}
      onPointerCancel={() => { active.current = false; setPos({ x: 0, y: 0 }); onVec(0, 0) }}
    >
      <div className="stick" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} />
    </div>
  )
}

function TitleScreen({ game }: { game: Game }) {
  const hasSave = game.hasSavedGame()
  return (
    <div className="tdv-title">
      <div className="tdv-titlecard">
        <h1>🌾 Tiny Dew Valley</h1>
        <div className="tag">A cozy farming & life sim. Restore the Shrine by Day 28.</div>
        <div className="col">
          {hasSave && (
            <button className="tdv-bigbtn gold" onClick={() => game.continueGame()}>▶ Continue</button>
          )}
          <button className="tdv-bigbtn" onClick={() => game.newGame()}>🌱 New Game</button>
          {hasSave && (
            <button
              className="tdv-bigbtn ghost"
              onClick={() => { if (confirm('Delete saved game?')) { game.deleteSaveData(); location.reload() } }}
            >🗑 Delete Save</button>
          )}
        </div>
        <div className="help">
          Move: WASD / Arrows or joystick · Tools: keys 1–5 · Items: 6–0<br />
          Act / Interact: Space, E, or the round button<br />
          Till → Plant seeds → Water daily → Harvest → Ship · Sleep to pass the day
        </div>
      </div>
    </div>
  )
}

function ShopModal({
  game,
  ui,
  tab,
  setTab,
}: {
  game: Game
  ui: UISnapshot
  tab: 'buy' | 'sell'
  setTab: (t: 'buy' | 'sell') => void
}) {
  const sellables = ui.inventory.filter((s) => s.itemId && s.sellPrice > 0)
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🛒 General Store</h2>
        <div className="sub">Barnaby: "Welcome! Buy fresh, sell fresh — {ui.gold}G in your purse."</div>
        <div className="tdv-tabs">
          <div className={`tdv-tab${tab === 'buy' ? ' on' : ''}`} onClick={() => setTab('buy')}>Buy</div>
          <div className={`tdv-tab${tab === 'sell' ? ' on' : ''}`} onClick={() => setTab('sell')}>Sell</div>
        </div>
        {tab === 'buy' ? (
          <div className="tdv-grid">
            {ui.shopBuy.map((b) => (
              <div className="tdv-card" key={b.itemId}>
                <img src={iconURL(b.sprite, b.color)} alt={b.name} />
                <div className="nm">{b.name}</div>
                <div className="ds">{b.desc}</div>
                {b.owned ? (
                  <div className="price">Owned</div>
                ) : (
                  <button
                    className="tdv-btn gold"
                    disabled={!b.affordable}
                    onClick={() => game.buyItem(b.itemId)}
                  >{b.price}G</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="tdv-grid">
            {sellables.length === 0 && <div className="sub">Nothing to sell right now.</div>}
            {sellables.map((s) => (
              <div className="tdv-card" key={s.index}>
                <img src={iconURL(s.sprite, s.color)} alt={s.name} />
                <div className="nm">{s.name} ×{s.qty}</div>
                <div className="price">{s.sellPrice}G each</div>
                <div className="tdv-row" style={{ marginTop: 4 }}>
                  <button className="tdv-btn sm" onClick={() => game.sellItem(s.index, false)}>Sell 1</button>
                  <button className="tdv-btn sm gold" onClick={() => game.sellItem(s.index, true)}>All</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>Close</button>
        </div>
      </div>
    </div>
  )
}

function ShrineModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const sh = ui.shrine!
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>⛩ Ancient Shrine</h2>
        <div className="sub">
          {sh.restored
            ? 'The shrine is restored. The valley thanks you.'
            : `Offer all three to restore it. ${sh.daysLeft} day(s) until end of Spring.`}
        </div>
        {sh.reqs.map((r) => (
          <div className={`tdv-req${r.done ? ' done' : ''}`} key={r.key}>
            <span className="ic">{r.icon}</span>
            <div className="info">
              <div className="nm">{r.label} {r.done && '✓'}</div>
              <div className="tdv-reqbar">
                <span style={{ width: `${Math.min(100, (r.have / r.need) * 100)}%` }} />
              </div>
              <div style={{ fontSize: 10, marginTop: 2 }}>{r.have} / {r.need}</div>
            </div>
            {!sh.restored && !r.done && (
              <button
                className="tdv-btn gold sm"
                disabled={r.canDeposit <= 0}
                onClick={() => game.depositShrine(r.key)}
              >Offer {r.canDeposit > 0 ? `×${r.canDeposit}` : ''}</button>
            )}
          </div>
        ))}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>Close</button>
        </div>
      </div>
    </div>
  )
}

function SleepConfirm({ game }: { game: Game }) {
  return (
    <div className="tdv-modal-bg">
      <div className="tdv-modal" style={{ width: 'min(360px, 92vw)', textAlign: 'center' }}>
        <h2 style={{ justifyContent: 'center' }}>🛏 Go to sleep?</h2>
        <div className="sub">Crops watered today will grow overnight, and shipped items are tallied.</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.confirmSleep()}>Sleep</button>
          <button className="tdv-btn ghost" onClick={() => game.cancelSleep()}>Not yet</button>
        </div>
      </div>
    </div>
  )
}

function TallyModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const t = ui.tally!
  const shownTotal = t.items.slice(0, t.shown).reduce((a, b) => a + b.total, 0)
  const done = t.shown >= t.items.length
  return (
    <div className="tdv-modal-bg">
      <div className="tdv-modal tdv-tally">
        <h2>🌙 Overnight Shipping</h2>
        <div className="sub">Day {ui.day} earnings</div>
        {t.items.length === 0 && <div className="sub">Nothing was shipped today.</div>}
        {t.items.slice(0, t.shown).map((it, i) => (
          <div className="line" key={i}>
            <img src={iconURL(it.sprite, it.color)} alt={it.name} />
            <span className="nm">{it.name}</span>
            <span>×{it.qty}</span>
            <span style={{ color: '#a6791f', fontWeight: 800 }}>+{it.total}G</span>
          </div>
        ))}
        <div className="total">
          <span>Total</span>
          <span>+{shownTotal}G</span>
        </div>
        <div className="tdv-row">
          <button className="tdv-btn gold" disabled={!done && t.items.length > 0} onClick={() => game.finishTally()}>
            {done || t.items.length === 0 ? 'Good morning ☀' : '...'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EndingModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const good = ui.ending === 'good'
  return (
    <div className="tdv-modal-bg">
      <div className="tdv-modal tdv-ending" style={{ textAlign: 'center' }}>
        <div className="art">{good ? '🌸⛩🌸' : '🍂⛩🍂'}</div>
        <h2 style={{ justifyContent: 'center' }}>{good ? 'The Shrine Restored!' : 'A Spring Passes'}</h2>
        <div className="sub" style={{ fontSize: 12 }}>{ui.endingText}</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.dismissEnding()}>
            Continue (Endless Mode)
          </button>
        </div>
      </div>
    </div>
  )
}

function InventoryModal({
  game,
  ui,
  sel,
  setSel,
  onClose,
}: {
  game: Game
  ui: UISnapshot
  sel: number | null
  setSel: (n: number | null) => void
  onClose: () => void
}) {
  const item = sel != null ? ui.inventory[sel] : null
  const hasItem = item && item.itemId
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎒 Backpack</h2>
        <div className="sub">
          {ui.nearbyNpc ? `${ui.npcHearts.find((n) => n.id === ui.nearbyNpc)?.name} is nearby — you can gift.` : 'Tap an item to inspect, eat, ship, or gift.'}
        </div>
        <div className="tdv-invgrid">
          {ui.inventory.map((s) => (
            <div
              className={`tdv-invslot${sel === s.index ? ' on' : ''}`}
              key={s.index}
              onClick={() => setSel(s.index)}
            >
              {s.itemId && <img src={iconURL(s.sprite, s.color)} alt={s.name} />}
              {s.itemId && s.quality && QUALITY_GLYPH[s.quality] && (
                <span className="ql">{QUALITY_GLYPH[s.quality]}</span>
              )}
              {s.itemId && <span className="qty">{s.qty}</span>}
            </div>
          ))}
        </div>
        <div className="tdv-detail">
          {hasItem ? (
            <>
              <div className="nm">{item!.name}</div>
              <div className="ds">{item!.desc}</div>
              <div style={{ fontSize: 11 }}>Sells for {item!.sellPrice}G each</div>
              <div className="tdv-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                {item!.usable && (
                  <button className="tdv-btn sm" onClick={() => game.useItem(item!.itemId!)}>🍽 Eat</button>
                )}
                {item!.sellPrice > 0 && (
                  <button className="tdv-btn sm gold" onClick={() => game.shipItem(item!.index, false)}>📦 Ship 1</button>
                )}
                {item!.sellPrice > 0 && (
                  <button className="tdv-btn sm gold" onClick={() => game.shipItem(item!.index, true)}>📦 Ship All</button>
                )}
                {item!.giftable && (
                  <button className="tdv-btn sm" onClick={() => { game.giftItem(item!.index); onClose() }}>🎁 Gift</button>
                )}
              </div>
            </>
          ) : (
            <div className="ds">No item selected.</div>
          )}
        </div>
        <div className="tdv-row">
          {ui.recipes.herbalTea && (
            <button className="tdv-btn" onClick={() => game.brewHerbalTea()}>🍵 Brew Herbal Tea (1 Daffodil)</button>
          )}
          <button className="tdv-btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
