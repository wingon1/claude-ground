import { useState } from 'react'
import type { Game, UISnapshot } from '../engine/game'
import { iconURL } from '../engine/sprites'

export function Overlay({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [invSel, setInvSel] = useState<number | null>(null)

  if (ui.phase === 'title') return <TitleScreen game={game} ui={ui} />

  const modalOpen =
    ui.phase === 'shop' ||
    ui.phase === 'build' ||
    ui.phase === 'cook' ||
    ui.phase === 'sleepConfirm' ||
    invOpen
  const canSleep = ui.contextAction === '잠자기'

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
          <div className="tdv-panel tdv-bars">
            <Bar
              cls={ui.stamina <= ui.maxStamina * 0.25 ? 'stam low' : 'stam'}
              value={ui.stamina}
              max={ui.maxStamina}
              label={`⚡ ${ui.stamina}/${ui.maxStamina}`}
            />
          </div>
        </div>
      </div>

      {ui.exhausted && <div className="tdv-exhaust">지쳤어요 — 침대에서 잠을 자요</div>}

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

      {/* Help hint */}
      {!modalOpen && !canSleep && (
        <div className="tdv-deskhint">화면을 탭해 이동 · 시설 근처에서 하단 메뉴가 활성화돼요</div>
      )}

      {/* Context action button (sleep only) */}
      {!modalOpen && canSleep && (
        <button
          className="tdv-action"
          onPointerDown={(e) => {
            e.preventDefault()
            game.requestSleep()
          }}
        >
          잠자기
        </button>
      )}

      <nav className="tdv-bottomnav" aria-label="게임 메뉴">
        <button
          className="tdv-navbtn"
          onClick={() => { setInvOpen(true); setInvSel(null); setMenuOpen(false) }}
        >
          <span>🎒</span>
          <small>가방</small>
        </button>
        <button
          className="tdv-navbtn"
          disabled={!ui.nearStore}
          title={ui.nearStore ? '상점 열기' : '잡화점 가까이에서 활성화돼요'}
          onClick={() => { game.openShop(); setMenuOpen(false) }}
        >
          <span>🛒</span>
          <small>상점</small>
        </button>
        <button
          className="tdv-navbtn"
          disabled={!ui.nearBuild}
          title={ui.nearBuild ? '건설 열기' : '건설 게시판 가까이에서 활성화돼요'}
          onClick={() => { game.openBuild(); setMenuOpen(false) }}
        >
          <span>🔨</span>
          <small>건설</small>
        </button>
        <button
          className="tdv-navbtn"
          disabled={!ui.nearCooking}
          title={ui.nearCooking ? '요리 열기' : '요리 화덕 가까이에서 활성화돼요'}
          onClick={() => { game.openCooking(); setMenuOpen(false) }}
        >
          <span>🍳</span>
          <small>요리</small>
        </button>
        <button className="tdv-navbtn" onClick={() => setMenuOpen((v) => !v)}>
          <span>☰</span>
          <small>메뉴</small>
        </button>
      </nav>

      {/* Modals */}
      {ui.phase === 'shop' && <ShopModal game={game} ui={ui} />}
      {ui.phase === 'build' && <FieldBuildModal game={game} ui={ui} />}
      {ui.phase === 'cook' && <CookingModal game={game} ui={ui} />}
      {ui.phase === 'sleepConfirm' && <SleepConfirm game={game} ui={ui} />}
      {invOpen && ui.phase === 'playing' && (
        <InventoryModal ui={ui} sel={invSel} setSel={setInvSel} onClose={() => setInvOpen(false)} />
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

// ---------------- Title ----------------
function TitleScreen({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-title">
      <div className="tdv-titlecard">
        <h1>🌾 Tiny Dew Valley</h1>
        <div className="tag">탭으로 거닐며 곁에 서면 저절로 일하는 포근한 도트 농장</div>
        <div className="col">
          {ui.hasSave && (
            <button className="tdv-bigbtn gold" onClick={() => game.continueGame()}>이어하기</button>
          )}
          <button className="tdv-bigbtn" onClick={() => game.newGame()}>새 게임</button>
        </div>
        <div className="help">
          화면을 탭하면 그 곳으로 걸어가요. 나무·바위·작물 곁에 서면 도구 없이 자동으로 일해요.<br />
          스태미나를 다 쓰면 침대에서 자고, 깨어나면 최대 스태미나가 +1 늘어나요.
        </div>
      </div>
    </div>
  )
}

// ---------------- Shop ----------------
function ShopModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const sellable = ui.inventory.filter((s) => s.itemId && s.sellPrice > 0)
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeShop()}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🛒 잡화점</h2>
        <div className="sub">씨앗을 사고, 수확물을 팔아 골드를 모아요. (보유 {ui.gold}G)</div>
        <div className="tdv-tabs">
          <button className={`tdv-tab ${tab === 'buy' ? 'on' : ''}`} onClick={() => setTab('buy')}>구매</button>
          <button className={`tdv-tab ${tab === 'sell' ? 'on' : ''}`} onClick={() => setTab('sell')}>판매</button>
        </div>

        {tab === 'buy' && (
          <div className="tdv-grid">
            {ui.shopBuy.map((b) => (
              <div className="tdv-card" key={b.itemId}>
                <img src={iconURL(b.sprite, b.color)} alt={b.name} />
                <div className="nm">{b.name}</div>
                <div className="ds">{b.desc}</div>
                <div className="price">{b.price}G</div>
                <button className="tdv-btn sm" disabled={!b.affordable} onClick={() => game.buyItem(b.itemId)}>사기</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'sell' && (
          <div className="tdv-grid">
            {sellable.length === 0 && <div className="sub">팔 수 있는 물건이 없어요.</div>}
            {sellable.map((s) => (
              <div className="tdv-card" key={s.index}>
                <img src={iconURL(s.sprite, s.color)} alt={s.name} />
                <div className="nm">{s.name} ×{s.qty}</div>
                <div className="price">개당 {s.sellPrice}G</div>
                <div className="tdv-row" style={{ marginTop: 4, gap: 4 }}>
                  <button className="tdv-btn sm gold" onClick={() => game.sellItem(s.index, false)}>1개</button>
                  <button className="tdv-btn sm gold" onClick={() => game.sellItem(s.index, true)}>전부</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeShop()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Inventory ----------------
function InventoryModal({
  ui, sel, setSel, onClose,
}: {
  ui: UISnapshot
  sel: number | null
  setSel: (i: number | null) => void
  onClose: () => void
}) {
  const slot = sel != null ? ui.inventory[sel] : null
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🎒 가방</h2>
        <div className="sub">수확물·자원을 모아 잡화점에서 팔아요.</div>
        <div className="tdv-invgrid">
          {ui.inventory.map((s, i) => (
            <div
              key={i}
              className={`tdv-invslot ${sel === i ? 'on' : ''}`}
              onClick={() => setSel(s.itemId ? i : null)}
            >
              {s.itemId && <img src={iconURL(s.sprite, s.color)} alt={s.name} />}
              {s.itemId && <span className="qty">{s.qty}</span>}
            </div>
          ))}
        </div>
        {slot && slot.itemId && (
          <div className="tdv-detail">
            <div className="nm">{slot.name}</div>
            <div className="ds">{slot.desc}</div>
            <div className="price">개당 {slot.sellPrice}G</div>
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Build ----------------
function BuildModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🔨 건설</h2>
        <div className="sub">골드와 재료를 써서 자동 농장 구역을 넓혀요.</div>
        <div className="tdv-craftlist">
          {ui.buildOptions.map((b) => (
            <div className={`tdv-craft${b.locked ? ' locked' : ''}`} key={b.id}>
              <div className="tdv-crafticon">🌱</div>
              <div className="info">
                <div className="nm">{b.name}</div>
                <div className="ds">{b.desc}</div>
                <div className="mats">
                  <span className={`mat${ui.gold >= b.costGold ? '' : ' miss'}`}>
                    골드 {ui.gold}/{b.costGold}
                  </span>
                  {b.costItems.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>
                      {it.name} {it.have}/{it.need}
                    </span>
                  ))}
                </div>
              </div>
              <div className="act">
                {b.built ? (
                  <span className="owned">완료</span>
                ) : b.locked ? (
                  <span className="lock">순서 필요</span>
                ) : (
                  <button className="tdv-btn gold sm" disabled={!b.canBuild} onClick={() => game.buildField(b.id)}>
                    건설
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

export const LegacyBuildModal = BuildModal

function FieldBuildModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const selected = ui.fieldPlots.find((field) => field.id === ui.selectedFieldId)
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>밭 관리</h2>
        <div className="sub">표지판에 작물을 등록하고, 3칸짜리 줄을 하나씩 구매해요.</div>
        {!selected && <div className="sub">밭 표지판 바로 앞에서 다시 열어주세요.</div>}
        {selected && (
          <div className="tdv-fieldpanel">
            <div className="tdv-fieldhead">
              <strong>{selected.name}</strong>
              <span>{selected.rows}/3줄</span>
            </div>
            <div className="tdv-cropchoices">
              {ui.cropChoices.map((crop) => (
                <button
                  key={crop.id}
                  className={`tdv-cropbtn ${crop.selected ? 'on' : ''}`}
                  disabled={selected.rows <= 0 || !crop.unlocked}
                  onClick={() => game.setFieldCrop(selected.id, crop.id)}
                  title={crop.lockText ?? crop.name}
                >
                  <span style={{ background: crop.color }} />
                  {crop.name}
                  {!crop.unlocked && <small>잠김</small>}
                </button>
              ))}
            </div>
            <div className="tdv-fieldbuy">
              <div>
                <strong>다음 줄 구매</strong>
                <div className="mats">
                  <span className={ui.gold >= selected.costGold ? '' : 'miss'}>골드 {ui.gold}/{selected.costGold}</span>
                  {selected.costItems.map((it) => (
                    <span className={it.ok ? '' : 'miss'} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
                  ))}
                </div>
              </div>
              <button className="tdv-btn gold sm" disabled={!selected.canBuyRow} onClick={() => game.buyFieldRow(selected.id)}>
                구매
              </button>
            </div>
          </div>
        )}
        <div className="tdv-craftlist">
          {ui.fieldPlots.map((field) => (
            <div className={`tdv-craft${field.nextToUnlock || field.rows === 3 ? '' : ' locked'}`} key={field.id}>
              <div className="tdv-crafticon">밭</div>
              <div className="info">
                <div className="nm">{field.name}</div>
                <div className="ds">{field.rows === 0 ? '비활성 밭' : `${field.selectedCropName} 자동 재배`}</div>
                <div className="mats">
                  <span className="mat">해금 {field.rows}/3줄</span>
                  <span className="mat">{field.selected ? '선택됨' : field.nextToUnlock ? '다음 해금' : '대기'}</span>
                </div>
              </div>
              <div className="act">
                {field.rows === 3 ? <span className="owned">완료</span> : <span className="lock">순서 해금</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Cooking ----------------
function CookingModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🍳 요리</h2>
        <div className="sub">재료를 모아 음식과 가공품을 만들어요.</div>
        <div className="tdv-craftlist">
          {ui.cookRecipes.map((r) => (
            <div className={`tdv-craft${r.unlocked ? '' : ' locked'}`} key={r.id}>
              <img src={iconURL(r.outputSprite, r.outputColor)} alt={r.outputName} />
              <div className="info">
                <div className="nm">
                  {r.name}
                  {r.outputQty > 1 && <span className="x"> ×{r.outputQty}</span>}
                </div>
                <div className="ds">{r.desc}</div>
                {!r.unlocked && <div className="lock">{r.lockText}</div>}
                <div className="mats">
                  {r.inputs.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>
                      {it.name} {it.have}/{it.need}
                    </span>
                  ))}
                </div>
              </div>
              <div className="act">
                <button className="tdv-btn gold sm" disabled={!r.canCook} onClick={() => game.cook(r.id)}>
                  만들기
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Sleep ----------------
function SleepConfirm({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-modal-bg" onClick={() => game.cancelSleep()}>
      <div className="tdv-modal" style={{ width: 'min(360px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🛏 잠자기</h2>
        <div className="sub">자고 일어나면 최대 스태미나가 +1 늘어나요. (현재 {ui.maxStamina} → {ui.maxStamina + 1})</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.confirmSleep()}>잘래요</button>
          <button className="tdv-btn ghost" onClick={() => game.cancelSleep()}>아직</button>
        </div>
      </div>
    </div>
  )
}
