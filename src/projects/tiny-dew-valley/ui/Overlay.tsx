import { useRef, useState } from 'react'
import type { Game, UISnapshot } from '../engine/game'
import { iconURL } from '../engine/sprites'

const QUALITY_GLYPH: Record<string, string> = {
  silver: '◇',
  gold: '◆',
  perfect: '★',
}

// 터치(모바일) 환경에서만 가상 조작 버튼을 노출한다.
function detectTouch(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  return coarse || 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function Overlay({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [invSel, setInvSel] = useState<number | null>(null)
  const [shopTab, setShopTab] = useState<'buy' | 'sell'>('buy')
  const [isTouch] = useState(detectTouch)

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
            <span>{ui.day}일째</span>
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
            <button className="tdv-iconbtn" title="메뉴" onClick={() => setMenuOpen((v) => !v)}>☰</button>
            <button className="tdv-iconbtn" title="가방" onClick={() => { setInvOpen(true); setInvSel(null) }}>🎒</button>
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

      {ui.exhausted && <div className="tdv-exhaust">기진맥진 — 이동 속도 절반</div>}

      {/* Toasts */}
      <div className="tdv-toasts">
        {ui.toasts.map((t) => (
          <div className={`tdv-toast ${t.kind}`} key={t.id}>{t.text}</div>
        ))}
      </div>

      {menuOpen && (
        <div className="tdv-menu">
          <button className="tdv-btn" onClick={() => { game.saveNow(); setMenuOpen(false) }}>💾 저장</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMute()}>{ui.muted ? '🔇 음소거 해제' : '🔊 음소거'}</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMusic()}>{ui.musicOn ? '🎵 음악 켜짐' : '🎵 음악 꺼짐'}</button>
          <button
            className="tdv-btn red"
            onClick={() => {
              if (confirm('저장을 삭제하고 타이틀로 돌아갈까요? 되돌릴 수 없어요.')) {
                game.deleteSaveData()
                location.reload()
              }
            }}
          >🗑 저장 삭제</button>
          <button className="tdv-btn ghost" onClick={() => setMenuOpen(false)}>닫기</button>
        </div>
      )}

      {/* Hotbar */}
      <div className="tdv-hotbar">
        {ui.tools.map((t, i) => (
          <Slot key={`t${i}`} keyLabel={`${i + 1}`} selected={t.selected} cap={t.label} onClick={() => game.selectSlot(i)}>
            <img src={iconURL(t.sprite, t.color)} alt={t.label} />
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

      {/* 데스크톱: 상호작용 안내 */}
      {!isTouch && !modalOpen && !ui.dialogue && ui.contextAction && (
        <div className="tdv-deskhint">
          <kbd>Space</kbd> / <kbd>E</kbd> · {ui.contextAction}
        </div>
      )}

      {/* 모바일 전용 조작 버튼 */}
      {isTouch && !modalOpen && !ui.dialogue && (
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
            {ui.contextAction ?? '행동'}
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
          <div className="hint">눌러서 계속 ▸</div>
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
  cap,
  onClick,
}: {
  children: React.ReactNode
  keyLabel: string
  selected: boolean
  empty?: boolean
  sep?: boolean
  cap?: string
  onClick: () => void
}) {
  return (
    <div
      className={`tdv-slot${selected ? ' sel' : ''}${empty ? ' empty' : ''}${sep ? ' sep' : ''}`}
      onClick={onClick}
    >
      <span className="key">{keyLabel}</span>
      {children}
      {cap && <span className="cap">{cap}</span>}
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
        <div className="tag">아늑한 농사 & 생활 시뮬레이션. 28일째까지 신단을 복원하세요.</div>
        <div className="col">
          {hasSave && (
            <button className="tdv-bigbtn gold" onClick={() => game.continueGame()}>▶ 이어하기</button>
          )}
          <button className="tdv-bigbtn" onClick={() => game.newGame()}>🌱 새 게임</button>
          {hasSave && (
            <button
              className="tdv-bigbtn ghost"
              onClick={() => { if (confirm('저장된 게임을 삭제할까요?')) { game.deleteSaveData(); location.reload() } }}
            >🗑 저장 삭제</button>
          )}
        </div>
        <div className="help">
          이동: WASD / 방향키 또는 조이스틱 · 농기구: 1–5 키 · 아이템: 6–0 키<br />
          행동 / 상호작용: Space, E, 또는 둥근 버튼<br />
          밭 갈기 → 씨앗 심기 → 매일 물 주기 → 수확 → 출하 · 잠을 자면 하루가 지나요
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
        <h2>🛒 잡화점</h2>
        <div className="sub">바나비: "어서 오게! 신선하게 사고 신선하게 팔게나 — 지갑엔 {ui.gold}G."</div>
        <div className="tdv-tabs">
          <div className={`tdv-tab${tab === 'buy' ? ' on' : ''}`} onClick={() => setTab('buy')}>구매</div>
          <div className={`tdv-tab${tab === 'sell' ? ' on' : ''}`} onClick={() => setTab('sell')}>판매</div>
        </div>
        {tab === 'buy' ? (
          <div className="tdv-grid">
            {ui.shopBuy.map((b) => (
              <div className="tdv-card" key={b.itemId}>
                <img src={iconURL(b.sprite, b.color)} alt={b.name} />
                <div className="nm">{b.name}</div>
                <div className="ds">{b.desc}</div>
                {b.owned ? (
                  <div className="price">보유 중</div>
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
            {sellables.length === 0 && <div className="sub">지금 팔 물건이 없어요.</div>}
            {sellables.map((s) => (
              <div className="tdv-card" key={s.index}>
                <img src={iconURL(s.sprite, s.color)} alt={s.name} />
                <div className="nm">{s.name} ×{s.qty}</div>
                <div className="price">개당 {s.sellPrice}G</div>
                <div className="tdv-row" style={{ marginTop: 4 }}>
                  <button className="tdv-btn sm" onClick={() => game.sellItem(s.index, false)}>1개 판매</button>
                  <button className="tdv-btn sm gold" onClick={() => game.sellItem(s.index, true)}>전부</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
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
        <h2>⛩ 고대 신단</h2>
        <div className="sub">
          {sh.restored
            ? '신단이 복원되었어요. 골짜기가 당신에게 감사를 전해요.'
            : `세 가지를 모두 바쳐 복원하세요. 봄이 끝나기까지 ${sh.daysLeft}일 남았어요.`}
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
              >바치기 {r.canDeposit > 0 ? `×${r.canDeposit}` : ''}</button>
            )}
          </div>
        ))}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

function SleepConfirm({ game }: { game: Game }) {
  return (
    <div className="tdv-modal-bg">
      <div className="tdv-modal" style={{ width: 'min(360px, 92vw)', textAlign: 'center' }}>
        <h2 style={{ justifyContent: 'center' }}>🛏 잠자리에 들까요?</h2>
        <div className="sub">오늘 물을 준 작물은 밤사이 자라고, 출하한 물건은 정산돼요.</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.confirmSleep()}>잠자기</button>
          <button className="tdv-btn ghost" onClick={() => game.cancelSleep()}>아직</button>
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
        <h2>🌙 밤사이 출하 정산</h2>
        <div className="sub">{ui.day}일째 수입</div>
        {t.items.length === 0 && <div className="sub">오늘은 출하한 물건이 없어요.</div>}
        {t.items.slice(0, t.shown).map((it, i) => (
          <div className="line" key={i}>
            <img src={iconURL(it.sprite, it.color)} alt={it.name} />
            <span className="nm">{it.name}</span>
            <span>×{it.qty}</span>
            <span style={{ color: '#a6791f', fontWeight: 800 }}>+{it.total}G</span>
          </div>
        ))}
        <div className="total">
          <span>합계</span>
          <span>+{shownTotal}G</span>
        </div>
        <div className="tdv-row">
          <button className="tdv-btn gold" disabled={!done && t.items.length > 0} onClick={() => game.finishTally()}>
            {done || t.items.length === 0 ? '좋은 아침 ☀' : '...'}
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
        <h2 style={{ justifyContent: 'center' }}>{good ? '신단 복원 완료!' : '봄이 지나가고'}</h2>
        <div className="sub" style={{ fontSize: 12 }}>{ui.endingText}</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.dismissEnding()}>
            계속하기 (끝없는 모드)
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
  const nearbyName = ui.npcHearts.find((n) => n.id === ui.nearbyNpc)?.name
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎒 가방</h2>
        <div className="sub">
          {nearbyName ? `${nearbyName}이(가) 근처에 있어요 — 선물할 수 있어요.` : '아이템을 눌러 살펴보고, 먹고, 출하하거나 선물하세요.'}
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
              <div style={{ fontSize: 11 }}>개당 {item!.sellPrice}G에 판매</div>
              <div className="tdv-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                {item!.usable && (
                  <button className="tdv-btn sm" onClick={() => game.useItem(item!.itemId!)}>🍽 먹기</button>
                )}
                {item!.sellPrice > 0 && (
                  <button className="tdv-btn sm gold" onClick={() => game.shipItem(item!.index, false)}>📦 1개 출하</button>
                )}
                {item!.sellPrice > 0 && (
                  <button className="tdv-btn sm gold" onClick={() => game.shipItem(item!.index, true)}>📦 전부 출하</button>
                )}
                {item!.giftable && (
                  <button className="tdv-btn sm" onClick={() => { game.giftItem(item!.index); onClose() }}>🎁 선물</button>
                )}
              </div>
            </>
          ) : (
            <div className="ds">선택된 아이템이 없어요.</div>
          )}
        </div>
        <div className="tdv-row">
          {ui.recipes.herbalTea && (
            <button className="tdv-btn" onClick={() => game.brewHerbalTea()}>🍵 허브차 끓이기 (수선화 1개)</button>
          )}
          <button className="tdv-btn ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
