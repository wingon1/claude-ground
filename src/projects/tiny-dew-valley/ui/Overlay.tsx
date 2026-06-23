import { useState } from 'react'
import type { Game, UISnapshot } from '../engine/game'
import { iconURL } from '../engine/sprites'

export function Overlay({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [invSel, setInvSel] = useState<number | null>(null)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [hiddenObjectiveKey, setHiddenObjectiveKey] = useState<string | null>(null)

  if (ui.phase === 'title') return <TitleScreen game={game} ui={ui} />

  const modalOpen =
    ui.phase === 'shop' ||
    ui.phase === 'build' ||
    ui.phase === 'cook' ||
    ui.phase === 'seed' ||
    ui.phase === 'order' ||
    ui.phase === 'sleepConfirm' ||
    invOpen ||
    objectiveOpen
  const hasContextAction = ui.contextActions.length > 0
  const objectiveKey = ui.objective ? `${ui.objective.title}:${ui.objective.detail}` : null
  const objectivePinned = !!ui.objective && hiddenObjectiveKey !== objectiveKey

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

      {!modalOpen && objectivePinned && ui.objective && (
        <ObjectiveCard
          objective={ui.objective}
          pinned
          onClose={() => setHiddenObjectiveKey(objectiveKey)}
        />
      )}

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
      {!modalOpen && !hasContextAction && (
        <div className="tdv-deskhint">화면을 탭해 이동 · 시설 근처에서 하단 메뉴가 활성화돼요</div>
      )}

      {/* Context action buttons */}
      {!modalOpen && hasContextAction && (
        <div className="tdv-actions">
          {ui.contextActions.map((action) => (
            <button
              className="tdv-action"
              key={action.id}
              onPointerDown={(e) => {
                e.preventDefault()
                if (action.id === 'sleep') game.requestSleep()
                else if (action.id === 'animal') game.collectAnimalProduct()
                else if (action.id === 'seed') game.openSeedSelect()
                else if (action.id === 'shop') game.openShop()
                else if (action.id === 'cook') game.openCooking()
                else if (action.id === 'order') game.openOrder()
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
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
          title="건설 열기"
          onClick={() => { game.openBuild(); setMenuOpen(false) }}
        >
          <span>🔨</span>
          <small>건설</small>
        </button>
        <button
          className="tdv-navbtn"
          title="목표 보기"
          onClick={() => { setObjectiveOpen(true); setMenuOpen(false) }}
        >
          <span>🎯</span>
          <small>목표</small>
        </button>
      </nav>

      {/* Modals */}
      {ui.phase === 'shop' && <ShopModal game={game} ui={ui} />}
      {ui.phase === 'build' && <BuildModal game={game} ui={ui} />}
      {ui.phase === 'cook' && <CookingModal game={game} ui={ui} />}
      {ui.phase === 'seed' && <SeedModal game={game} ui={ui} />}
      {ui.phase === 'order' && <OrderModal game={game} ui={ui} />}
      {ui.phase === 'sleepConfirm' && <SleepConfirm game={game} ui={ui} />}
      {invOpen && ui.phase === 'playing' && (
        <InventoryModal ui={ui} sel={invSel} setSel={setInvSel} onClose={() => setInvOpen(false)} />
      )}
      {objectiveOpen && ui.phase === 'playing' && (
        <ObjectiveModal
          ui={ui}
          onPin={() => {
            setHiddenObjectiveKey(null)
            setObjectiveOpen(false)
          }}
          onClose={() => setObjectiveOpen(false)}
        />
      )}
    </>
  )
}

function objectiveProgress(objective: UISnapshot['objective']) {
  if (!objective) return 0
  return Math.min(100, Math.round((objective.progress / Math.max(1, objective.max)) * 100))
}

function ObjectiveCard({
  objective,
  pinned,
  onClose,
}: {
  objective: NonNullable<UISnapshot['objective']>
  pinned?: boolean
  onClose?: () => void
}) {
  return (
    <div className={`tdv-objective ${pinned ? 'pinned' : 'inline'}`}>
      <div className="head">
        <div className="label">목표</div>
        {pinned && <button className="close" onClick={onClose} aria-label="목표 숨기기">×</button>}
      </div>
      <div className="title">{objective.title}</div>
      <div className="detail">{objective.detail}</div>
      <div className="bar">
        <span style={{ width: `${objectiveProgress(objective)}%` }} />
      </div>
    </div>
  )
}

function ObjectiveModal({
  ui,
  onPin,
  onClose,
}: {
  ui: UISnapshot
  onPin: () => void
  onClose: () => void
}) {
  const activeObjectives = ui.objectives.filter((objective) => !objective.claimed && !objective.current)
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal tdv-objective-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🎯 목표</h2>
        <div className="sub">현재 목표를 확인하고 상단에 다시 고정할 수 있어요.</div>
        {ui.objective && (
          <button className="tdv-objective-row current" onClick={onPin}>
            <ObjectiveCard objective={ui.objective} />
            <span className="pin">상단 고정</span>
          </button>
        )}
        {activeObjectives.length > 0 ? (
          <div className="tdv-objective-list">
            {activeObjectives.map((objective) => (
              <button
                className={`tdv-objective-row ${objective.current ? 'current' : ''}`}
                key={objective.id}
                onClick={onPin}
              >
                <ObjectiveCard objective={objective} />
                <span className={objective.claimed ? 'done' : objective.completed ? 'ready' : 'pin'}>
                  {objective.claimed ? '보상 완료' : objective.completed ? `보상 ${objective.rewardText}` : `보상 ${objective.rewardText}`}
                </span>
              </button>
            ))}
          </div>
        ) : !ui.objective && (
          <div className="sub">진행 중인 목표가 없어요.</div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
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
  const [tab, setTab] = useState<'build' | 'farm'>('build')
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🔨 건설</h2>
        <div className="sub">건설과 농장 확장을 관리해요. 밭의 씨앗은 푯말 근처에서 바꿔요.</div>
        <div className="tdv-tabs">
          <button className={`tdv-tab ${tab === 'build' ? 'on' : ''}`} onClick={() => setTab('build')}>건설</button>
          <button className={`tdv-tab ${tab === 'farm' ? 'on' : ''}`} onClick={() => setTab('farm')}>농장</button>
        </div>
        {tab === 'build' && (
          <div className="tdv-craftlist">
            <div className="tdv-craft">
              <div className="tdv-crafticon">🔥</div>
              <div className="info">
                <div className="nm">{ui.cookingFire.built ? `화로대 Lv.${ui.cookingFire.level}` : '화로 제작'}</div>
                <div className="ds">{ui.cookingFire.built ? `요리 작업칸 ${ui.cookingFire.slots}칸 사용 가능` : '나무 5개로 첫 요리 화로를 만듭니다.'}</div>
                {ui.cookingFire.nextSlots ? (
                  <div className="mats">
                    <span className={`mat${ui.gold >= ui.cookingFire.costGold ? '' : ' miss'}`}>
                      골드 {ui.gold}/{ui.cookingFire.costGold}
                    </span>
                    {ui.cookingFire.costItems.map((it) => (
                      <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>
                        {it.name} {it.have}/{it.need}
                      </span>
                    ))}
                    <span className="mat">칸 {ui.cookingFire.slots} → {ui.cookingFire.nextSlots}</span>
                  </div>
                ) : (
                  <div className="mats"><span className="mat">최대 레벨</span></div>
                )}
              </div>
              <div className="act">
                {ui.cookingFire.nextSlots ? (
                  <button className="tdv-btn gold sm" disabled={!ui.cookingFire.canUpgrade} onClick={() => game.upgradeCookingFire()}>
                    {ui.cookingFire.built ? '업그레이드' : '제작'}
                  </button>
                ) : (
                  <span className="owned">완료</span>
                )}
              </div>
            </div>
            {ui.buildPermits.map((permit) => (
              <div className={`tdv-craft${permit.locked ? ' locked' : ''}`} key={permit.itemId}>
                <img src={iconURL(permit.sprite)} alt={permit.name} />
                <div className="info">
                  <div className="nm">{permit.name}</div>
                  <div className="ds">{permit.desc}</div>
                  <div className="mats">
                    <span className={`mat${ui.gold >= permit.price ? '' : ' miss'}`}>골드 {ui.gold}/{permit.price}</span>
                    {permit.locked && <span className="mat miss">이전 농장 필요</span>}
                  </div>
                </div>
                <div className="act">
                  {permit.built ? (
                    <span className="owned">완료</span>
                  ) : permit.locked ? (
                    <span className="lock">잠김</span>
                  ) : (
                    <button className="tdv-btn gold sm" disabled={!permit.affordable} onClick={() => game.buyBuildPermit(permit.itemId)}>
                      건설
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'farm' && (
          <div className="tdv-craftlist">
            {ui.fieldPlots.map((field) => (
              <div className={`tdv-craft${field.nextToUnlock || field.rows === 3 ? '' : ' locked'}`} key={field.id}>
                <div className="tdv-crafticon">밭</div>
                <div className="info">
                  <div className="nm">{field.name}</div>
                  <div className="ds">{field.rows === 0 ? '비활성 밭' : `${field.selectedCropName} 자동 재배`}</div>
                  <div className="mats">
                    <span className="mat">해금 {field.rows}/3줄</span>
                    <span className={`mat${ui.gold >= field.costGold ? '' : ' miss'}`}>골드 {ui.gold}/{field.costGold}</span>
                    {field.costItems.map((it) => (
                      <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
                    ))}
                  </div>
                </div>
                <div className="act">
                  {field.rows === 3 ? (
                    <span className="owned">완료</span>
                  ) : (
                    <button className="tdv-btn gold sm" disabled={!field.canBuyRow} onClick={() => game.buyFieldRow(field.id)}>
                      구매
                    </button>
                  )}
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

function SeedModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const selected = ui.fieldPlots.find((field) => field.id === ui.selectedFieldId)
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🌱 씨앗 변경</h2>
        <div className="sub">상점에서 구매한 재배권만 선택할 수 있어요.</div>
        {!selected && <div className="sub">밭 푯말 가까이에서 열어주세요.</div>}
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
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeModal()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

function OrderModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const order = ui.order
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeOrder()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🧾 오늘의 주문</h2>
        <div className="sub">상점 주인이 매일 하나씩 필요한 요리를 주문합니다.</div>
        {!order && (
          <div className="tdv-order-empty">
            첫 빵을 만들어 보면 주문을 받을 수 있어요.
          </div>
        )}
        {order && (
          <div className={`tdv-order-card ${order.completed ? 'done' : ''}`}>
            <img src={iconURL(order.sprite, order.color)} alt={order.itemName} />
            <div className="info">
              <div className="nm">{order.itemName} ×{order.qty}</div>
              <div className="ds">{order.hint}</div>
              <div className="mats">
                <span className={`mat${order.have >= order.qty ? '' : ' miss'}`}>보유 {order.have}/{order.qty}</span>
                <span className="mat">보상 {order.rewardGold}G</span>
                {order.completed && <span className="mat">완료</span>}
              </div>
            </div>
            <button className="tdv-btn gold sm" disabled={!order.canComplete} onClick={() => game.completeOrder()}>
              납품
            </button>
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeOrder()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Cooking ----------------
function CookingModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  const fmtTime = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds))
    const m = Math.floor(s / 60)
    const r = s % 60
    return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
  }
  const maxCookSlots = ui.cookingFire.maxLevel * 2
  const slots = Array.from({ length: maxCookSlots }, (_, i) => ({
    index: i,
    active: i < ui.cookingFire.slots,
    job: ui.cookQueue[i],
  }))
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>🍳 요리</h2>
        <div className="sub">같은 음식은 한 칸에서 최대 20개까지 묶어 조리돼요.</div>
        <div className="tdv-cookslots">
          {slots.map(({ index, active, job }) => (
            <div className={`tdv-cookslot${active ? '' : ' locked'}${job ? ' filled' : ''}`} key={index}>
              {job ? (
                <>
                  <img src={iconURL(job.outputSprite, job.outputColor)} alt={job.outputName} />
                  <span className="qty">×{job.remainingQty}</span>
                  <div className="bar"><span style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
                  <small>{fmtTime(job.totalRemainingSecs)}</small>
                </>
              ) : active ? (
                <span className="empty">빈칸</span>
              ) : (
                <span className="lock">잠김</span>
              )}
            </div>
          ))}
        </div>
        <div className="tdv-craftlist">
          {ui.cookRecipes.map((r) => (
            <div className={`tdv-craft${r.unlocked ? '' : ' locked'}${r.mystery ? ' mystery' : ''}`} key={r.id}>
              {r.mystery ? <div className="tdv-crafticon">?</div> : (
                <img src={iconURL(r.outputSprite, r.outputColor)} alt={r.outputName} />
              )}
              <div className="info">
                <div className="nm">
                  {r.name}
                  {r.outputQty > 1 && <span className="x"> ×{r.outputQty}</span>}
                </div>
                <div className="ds">{r.desc}</div>
                {!r.unlocked && <div className="lock">{r.lockText}</div>}
                {!r.mystery && <div className="mats">
                  <span className="mat">난이도 {r.difficulty}</span>
                  <span className="mat">시간 {fmtTime(r.craftSeconds)} × 개수</span>
                  <span className="mat">판매 {r.sellPrice}G</span>
                  <span className="mat">최대 {r.maxCookQty}개</span>
                  {r.inputs.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>
                      {it.name} {it.have}/{it.need}
                    </span>
                  ))}
                </div>}
              </div>
              {!r.mystery && <div className="act">
                <button className="tdv-btn gold sm" disabled={!r.canCook} onClick={() => game.cook(r.id, 1)}>
                  1개
                </button>
                <button className="tdv-btn gold sm" disabled={!r.canCook || r.maxCookQty <= 1} onClick={() => game.cook(r.id, r.maxCookQty)}>
                  ×{r.maxCookQty}
                </button>
              </div>}
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
