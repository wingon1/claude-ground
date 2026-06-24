import { useRef, useState } from 'react'
import type { Game } from '../engine/game'
import type { UISnapshot } from '../engine/uiSnapshot'
import { iconURL } from '../engine/sprites'
import { ITEMS } from '../data/items'

// Pixel-art icon, used everywhere emoji used to be.
function Ic({ k, cls }: { k: string; cls?: string }) {
  return <img className={`tdv-ic${cls ? ' ' + cls : ''}`} src={iconURL(k)} alt="" aria-hidden="true" draggable={false} />
}

export function Overlay({ game, ui }: { game: Game; ui: UISnapshot }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [invOpen, setInvOpen] = useState(false)
  const [invSel, setInvSel] = useState<number | null>(null)
  const [objectiveOpen, setObjectiveOpen] = useState(false)
  const [hiddenObjectiveKey, setHiddenObjectiveKey] = useState<string | null>(null)
  const [settingsTapCount, setSettingsTapCount] = useState(0)
  const [weatherTipOpen, setWeatherTipOpen] = useState(false)
  const weatherTipTimer = useRef<number | null>(null)
  const testMode = settingsTapCount >= 5

  if (ui.phase === 'title') return <TitleScreen game={game} ui={ui} />

  const modalOpen =
    ui.phase === 'shop' ||
    ui.phase === 'build' ||
    ui.phase === 'blacksmith' ||
    ui.phase === 'blacksmithBuy' ||
    ui.phase === 'cook' ||
    ui.phase === 'seed' ||
    ui.phase === 'order' ||
    ui.phase === 'sleepConfirm' ||
    menuOpen ||
    invOpen ||
    objectiveOpen
  const hasContextAction = ui.contextActions.length > 0
  const objectiveKey = ui.objective ? `${ui.objective.title}:${ui.objective.detail}` : null
  const objectivePinned = !!ui.objective && hiddenObjectiveKey !== objectiveKey
  const showWeatherTip = () => {
    if (!ui.weather) return
    if (weatherTipTimer.current != null) window.clearTimeout(weatherTipTimer.current)
    setWeatherTipOpen(true)
    weatherTipTimer.current = window.setTimeout(() => setWeatherTipOpen(false), 1000)
  }

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
            <Ic k="ui_coin" cls="sm" />
            <span className="tdv-gold">{ui.gold}G</span>
          </div>
          {ui.weather && (
            <button
              className="tdv-weather"
              type="button"
              title={ui.weather.desc}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                showWeatherTip()
              }}
            >
              <span>{ui.weather.icon}</span>
              <b>{ui.weather.name}</b>
            </button>
          )}
          {ui.weather && weatherTipOpen && (
            <div className="tdv-weather-pop">
              <b>{ui.weather.name}</b>
              <span>{ui.weather.desc}</span>
            </div>
          )}
        </div>

        <div className="tdv-rightcol">
          <div className="tdv-panel tdv-bars">
            <Bar
              cls={ui.stamina <= ui.maxStamina * 0.25 ? 'stam low' : 'stam'}
              value={ui.stamina}
              max={ui.maxStamina}
              iconKey="ui_bolt"
              text={`${ui.stamina}/${ui.maxStamina}`}
            />
          </div>
        </div>
      </div>

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
                else if (action.id === 'blacksmith') game.openBlacksmith()
                else if (action.id === 'blacksmithBuy') game.openBlacksmithBuy()
                else if (action.id === 'mineEnter') game.enterMine()
                else if (action.id === 'mineExit') game.exitMine()
                else if (action.id === 'mineDown') game.descendMine()
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
          <span><Ic k="backpack" /></span>
          <small>가방</small>
        </button>
        <button
          className="tdv-navbtn"
          title="건설 열기"
          onClick={() => { game.openBuild(); setMenuOpen(false) }}
        >
          <span><Ic k="ui_hammer" /></span>
          <small>건설</small>
        </button>
        <button
          className="tdv-navbtn"
          title="목표 보기"
          onClick={() => { setObjectiveOpen(true); setMenuOpen(false) }}
        >
          <span><Ic k="ui_target" /></span>
          <small>목표</small>
        </button>
        <button
          className="tdv-navbtn"
          title="설정 열기"
          onClick={() => {
            setSettingsTapCount((count) => Math.min(5, count + 1))
            setMenuOpen(true)
            setInvOpen(false)
            setObjectiveOpen(false)
          }}
        >
          <span><Ic k="ui_settings" /></span>
          <small>설정</small>
        </button>
      </nav>

      {/* Modals */}
      {ui.phase === 'shop' && <ShopModal game={game} ui={ui} />}
      {ui.phase === 'build' && <BuildModal game={game} ui={ui} />}
      {ui.phase === 'blacksmithBuy' && <BlacksmithBuyModal game={game} ui={ui} />}
      {ui.phase === 'blacksmith' && <BlacksmithModal game={game} ui={ui} />}
      {ui.phase === 'cook' && <CookingModal game={game} ui={ui} />}
      {ui.phase === 'seed' && <SeedModal game={game} ui={ui} />}
      {ui.phase === 'order' && <OrderModal game={game} ui={ui} />}
      {ui.phase === 'sleepConfirm' && <SleepConfirm game={game} ui={ui} />}
      {menuOpen && ui.phase === 'playing' && (
        <SettingsModal
          game={game}
          ui={ui}
          testMode={testMode}
          onSecretTap={() => setSettingsTapCount((count) => Math.min(5, count + 1))}
          onClose={() => setMenuOpen(false)}
        />
      )}
      {invOpen && ui.phase === 'playing' && (
        <InventoryModal game={game} ui={ui} sel={invSel} setSel={setInvSel} onClose={() => setInvOpen(false)} />
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
  const progress = Number.isFinite(objective.progress) ? Math.max(0, objective.progress) : 0
  const max = Number.isFinite(objective.max) && objective.max > 0 ? objective.max : 1
  return Math.max(0, Math.min(100, Math.round((progress / max) * 100)))
}

function ObjectiveProgressBar({ objective }: { objective: UISnapshot['objective'] }) {
  const progress = objectiveProgress(objective)
  return (
    <div className={`bar${progress <= 0 ? ' empty' : ''}`}>
      <span style={{ transform: `scaleX(${progress / 100})` }} />
    </div>
  )
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
  if (pinned) {
    return (
      <div className="tdv-objective pinned">
        <div className="compact">
          <div className="title">{objective.title}</div>
          <div className="progress">{objective.progress}/{objective.max}</div>
          <button className="close" onClick={onClose} aria-label="목표 숨기기">×</button>
        </div>
        <ObjectiveProgressBar objective={objective} />
      </div>
    )
  }
  return (
    <div className="tdv-objective inline">
      <div className="head">
        <div className="label">목표</div>
      </div>
      <div className="title">{objective.title}</div>
      <div className="detail">{objective.detail}</div>
      <ObjectiveProgressBar objective={objective} />
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
        <h2><Ic k="ui_target" /> 목표</h2>
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

function SettingsModal({
  game,
  ui,
  testMode,
  onSecretTap,
  onClose,
}: {
  game: Game
  ui: UISnapshot
  testMode: boolean
  onSecretTap: () => void
  onClose: () => void
}) {
  const testItems = Object.values(ITEMS).filter((item) => item.type !== 'misc')
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal" style={{ width: 'min(360px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2>
          <button className="tdv-title-secret" onClick={onSecretTap} aria-label="설정">
            <Ic k="ui_settings" /> 설정
          </button>
        </h2>
        <div className="sub">저장, 소리, 이동 복구를 관리합니다.</div>
        <div className="tdv-settings-list">
          <button className="tdv-btn" onClick={() => { game.saveNow(); onClose() }}><Ic k="ui_save" cls="sm" /> 저장</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMute()}><Ic k={ui.muted ? 'ui_mute' : 'ui_sound'} cls="sm" /> {ui.muted ? '음소거 해제' : '음소거'}</button>
          <button className="tdv-btn ghost" onClick={() => game.toggleMusic()}><Ic k="ui_music" cls="sm" /> {ui.musicOn ? '음악 켜짐' : '음악 꺼짐'}</button>
          <button className="tdv-btn gold" onClick={() => { game.unstuckPlayer(); onClose() }}>벗어나기</button>
          <button
            className="tdv-btn red"
            onClick={() => {
              if (confirm('저장을 삭제하고 타이틀로 돌아갈까요? 되돌릴 수 없어요.')) {
                game.deleteSaveData()
                location.reload()
              }
            }}
          ><Ic k="ui_trash" cls="sm" /> 저장 삭제</button>
        </div>
        {testMode && (
          <div className="tdv-test-panel">
            {testItems.map((item) => (
              <button className="tdv-test-btn" key={item.id} onClick={() => game.grantTestItem(item.id, 10)}>
                +10 {item.name}
              </button>
            ))}
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

function Bar({ cls, value, max, iconKey, text }: { cls: string; value: number; max: number; iconKey?: string; text: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="tdv-bar">
      <span className={cls} style={{ width: `${pct}%` }} />
      <label>{iconKey && <Ic k={iconKey} cls="sm" />}{text}</label>
    </div>
  )
}

// ---------------- Title ----------------
function TitleScreen({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-title">
      <div className="tdv-titlecard">
        <h1><Ic k="ui_wheat" cls="big" /> Tiny Dew Valley</h1>
        <div className="tag">탭으로 거닐며 곁에 서면 저절로 일하는 포근한 도트 농장</div>
        <div className="col">
          {ui.hasSave && (
            <button className="tdv-bigbtn gold" onClick={() => game.continueGame()}>이어하기</button>
          )}
          <button className="tdv-bigbtn" onClick={() => game.newGame()}>새 게임</button>
        </div>
        <div className="help">
          화면을 탭하면 그 곳으로 걸어가요. 나무·바위·작물 곁에 서면 도구 등급에 맞춰 자동으로 일해요.<br />
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
        <h2><Ic k="ui_basket" /> 잡화점</h2>
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
  game, ui, sel, setSel, onClose,
}: {
  game: Game
  ui: UISnapshot
  sel: number | null
  setSel: (i: number | null) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'items' | 'passives'>('items')
  const slot = sel != null ? ui.inventory[sel] : null
  return (
    <div className="tdv-modal-bg" onClick={onClose}>
      <div className="tdv-modal" onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="backpack" /> {'\uAC00\uBC29'}</h2>
        <div className="sub">수확물·자원을 모아 잡화점에서 팔아요.</div>
        <div className="tdv-tabs">
          <button className={`tdv-tab ${tab === 'items' ? 'on' : ''}`} onClick={() => setTab('items')}>{'\uC544\uC774\uD15C'}</button>
          <button className={`tdv-tab ${tab === 'passives' ? 'on' : ''}`} onClick={() => setTab('passives')}>{'\uD328\uC2DC\uBE0C'}</button>
        </div>
        {tab === 'items' && (
          <>
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
            <div className="price">{'\uAC1C\uB2F9'} {slot.sellPrice}G</div>
          </div>
        )}
          </>
        )}
        {tab === 'passives' && (
          <div className="tdv-passive-panel">
            <div className="tdv-passive-slots">
              {ui.passiveSlots.map((slot) => (
                <button
                  key={slot.index}
                  className={`tdv-passive-slot ${slot.unlocked ? '' : 'locked'}`}
                  disabled={!slot.unlocked || !slot.passive}
                  onClick={() => game.unequipPassive(slot.index)}
                >
                  {slot.unlocked ? (
                    slot.passive ? (
                      <>
                        <strong>{slot.passive.name}</strong>
                        <span>{slot.passive.rarityLabel} {slot.passive.effectText}</span>
                      </>
                    ) : <span>{'\uBE48 \uC2AC\uB86F'}</span>
                  ) : <span>{'\uC7A0\uAE40'}</span>}
                </button>
              ))}
            </div>
            <div className="tdv-craftlist">
              {ui.passives.length === 0 && <div className="sub">{'\uBAAC\uC2A4\uD130\uB97C \uCC98\uCE58\uD558\uBA74 \uD328\uC2DC\uBE0C\uB97C \uC5BB\uC744 \uC218 \uC788\uC5B4\uC694.'}</div>}
              {ui.passives.map((passive) => (
                <div className={`tdv-craft passive ${passive.equipped ? 'equipped' : ''}`} key={passive.key}>
                  <div className={`tdv-passive-badge ${passive.rarity}`}>{passive.rarityLabel}</div>
                  <div className="info">
                    <div className="nm">{passive.name} <span className="x">x{passive.qty}</span></div>
                    <div className="ds">{passive.desc}</div>
                    <div className="mats"><span className="mat">{passive.effectText}</span></div>
                  </div>
                  <div className="act">
                    <button
                      className="tdv-btn gold sm"
                      disabled={passive.equipped || ui.passiveSlotCount <= 0}
                      onClick={() => game.equipPassive(passive.id, passive.rarity)}
                    >
                      {passive.equipped ? '\uC7A5\uCC29\uC911' : '\uC7A5\uCC29'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
  const nextField = ui.fieldPlots.find((field) => field.nextToUnlock && field.rows < 3)
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="ui_hammer" /> 건설</h2>
        <div className="sub">화로, 동물농장, 밭 확장을 한 곳에서 관리해요. 밭의 씨앗은 푯말 근처에서 바꿔요.</div>
        <div className="tdv-craftlist">
          <div className="tdv-craft">
            <div className="tdv-crafticon"><Ic k="ui_fire" /></div>
            <div className="info">
              <div className="nm">{ui.cookingFire.built ? `화로대 Lv.${ui.cookingFire.level}` : '화로 제작'}</div>
              <div className="ds">{ui.cookingFire.built ? `요리 작업칸 ${ui.cookingFire.slots}칸 사용 가능` : '나무 5개로 첫 요리 화로를 만듭니다.'}</div>
              {ui.cookingFire.nextSlots ? (
                <div className="mats">
                  <span className={`mat${ui.gold >= ui.cookingFire.costGold ? '' : ' miss'}`}>골드 {ui.gold}/{ui.cookingFire.costGold}</span>
                  {ui.cookingFire.costItems.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
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
                  {permit.costItems.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
                  ))}
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
          {nextField ? (
            <div className="tdv-craft" key={nextField.id}>
              <div className="tdv-crafticon">밭</div>
              <div className="info">
                <div className="nm">밭 확장</div>
                <div className="ds">{nextField.selectedCropName} 자동 재배 구역을 한 줄 넓힙니다.</div>
                <div className="mats">
                  <span className="mat">해금 {nextField.rows}/3줄</span>
                  <span className={`mat${ui.gold >= nextField.costGold ? '' : ' miss'}`}>골드 {ui.gold}/{nextField.costGold}</span>
                  {nextField.costItems.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
                  ))}
                </div>
              </div>
              <div className="act">
                <button className="tdv-btn gold sm" disabled={!nextField.canBuyRow} onClick={() => game.buyFieldRow(nextField.id)}>
                  확장
                </button>
              </div>
            </div>
          ) : (
            <div className="tdv-craft locked">
              <div className="tdv-crafticon">밭</div>
              <div className="info">
                <div className="nm">밭 확장</div>
                <div className="ds">모든 밭 확장이 완료되었습니다.</div>
                <div className="mats"><span className="mat">완료</span></div>
              </div>
              <div className="act"><span className="owned">완료</span></div>
            </div>
          )}
        </div>
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
        <h2><Ic k="ui_sprout" /> 씨앗 변경</h2>
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
  const orders = ui.orders.length ? ui.orders : ui.order ? [ui.order] : []
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeOrder()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="ui_receipt" /> 오늘의 주문</h2>
        <div className="sub">상점 주인이 매일 필요한 요리를 주문합니다. 가능한 주문부터 골라 납품하세요.</div>
        {orders.length === 0 && (
          <div className="tdv-order-empty">
            첫 빵을 만들어 보면 주문을 받을 수 있어요.
          </div>
        )}
        {orders.length > 0 && (
          <div className="tdv-order-list">
            {orders.map((order) => (
              <div className={`tdv-order-card ${order.completed ? 'done' : ''}`} key={order.slot}>
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
                <button className="tdv-btn gold sm" disabled={!order.canComplete} onClick={() => game.completeOrder(order.slot)}>
                  납품
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="tdv-row">
          <button className="tdv-btn ghost" onClick={() => game.closeOrder()}>닫기</button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Blacksmith ----------------
function BlacksmithBuyModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="sword" /> 대장간 구매</h2>
        <div className="sub">광산 탐험에 필요한 장비를 살 수 있어요. 도구 강화는 별도 메뉴에서 진행합니다.</div>
        <div className="tdv-grid">
          {ui.blacksmithBuy.map((b) => (
            <div className={`tdv-card${b.owned ? ' locked' : ''}`} key={b.itemId}>
              <img src={iconURL(b.sprite, b.color)} alt={b.name} />
              <div className="nm">{b.name}</div>
              <div className="ds">{b.desc}</div>
              <div className="price">{b.price}G</div>
              {b.owned ? (
                <span className="owned">보유중</span>
              ) : (
                <button className="tdv-btn sm" disabled={!b.affordable} onClick={() => game.buyBlacksmithItem(b.itemId)}>
                  구매
                </button>
              )}
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

function BlacksmithModal({ game, ui }: { game: Game; ui: UISnapshot }) {
  return (
    <div className="tdv-modal-bg" onClick={() => game.closeModal()}>
      <div className="tdv-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="pickaxe" /> 대장간</h2>
        <div className="sub">광산에서 얻은 돌과 광석으로 낫과 곡괭이를 강화합니다.</div>
        <div className="tdv-craftlist">
          {ui.toolUpgrades.map((tool) => (
            <div className={`tdv-craft${tool.maxed ? ' locked' : ''}`} key={tool.toolId}>
              <img src={iconURL(tool.sprite)} alt={tool.name} />
              <div className="info">
                <div className="nm">{tool.name}</div>
                <div className="ds">
                  현재 타격력 {tool.damage}{tool.nextName ? ` · ${tool.nextName} 타격력 ${tool.nextDamage}` : ' · 최대 등급'}
                </div>
                <div className="mats">
                  {!tool.maxed && <span className={`mat${ui.gold >= tool.costGold ? '' : ' miss'}`}>골드 {ui.gold}/{tool.costGold}</span>}
                  {tool.costItems.map((it) => (
                    <span className={`mat${it.ok ? '' : ' miss'}`} key={it.itemId}>{it.name} {it.have}/{it.need}</span>
                  ))}
                </div>
              </div>
              <div className="act">
                {tool.maxed ? (
                  <span className="owned">완료</span>
                ) : (
                  <button className="tdv-btn gold sm" disabled={!tool.canUpgrade} onClick={() => game.upgradeTool(tool.toolId)}>
                    강화
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
      <div className="tdv-modal tdv-cook-modal" style={{ width: 'min(420px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <h2><Ic k="ui_pan" /> 요리</h2>
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
        <div className="tdv-row tdv-modal-actions">
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
        <h2><Ic k="ui_bed" /> 잠자기</h2>
        <div className="sub">자고 일어나면 최대 스태미나가 +1 늘어나요. (현재 {ui.maxStamina} → {ui.maxStamina + 1})</div>
        <div className="tdv-row">
          <button className="tdv-btn gold" onClick={() => game.confirmSleep()}>잘래요</button>
          <button className="tdv-btn ghost" onClick={() => game.cancelSleep()}>아직</button>
        </div>
      </div>
    </div>
  )
}
