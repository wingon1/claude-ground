import { useEffect, useReducer, useRef, useState } from 'react'
import { Game } from './game/Game'
import type { ContextAction } from './game/Game'
import type { GameEvent } from './game/EventBus'
import {
  Animals, Buildings, Crops, ItemMap, MineLevels, Recipes, Shops,
} from './content'
import { invCount, meetsCondition, sellPriceOf } from './game/GameState'
import type { GameState } from './types'
import { activeQuests, questProgress } from './systems/QuestSystem'

type PanelId = 'inventory' | 'shop' | 'build' | 'cooking' | 'quests' | 'collection' | 'settings' | 'mine' | null

type Toast = { id: number; text: string; kind: string }

const UI = {
  panel: '#fff6e6',
  border: '#caa56e',
  text: '#5a4632',
  accent: '#e0884a',
  good: '#5aa84a',
  bad: '#d35a4a',
}

export default function CozyIsland() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game] = useState<Game>(() => { const g = new Game(); g.start(); return g })
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [panel, setPanel] = useState<PanelId>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [ctxActions, setCtxActions] = useState<ContextAction[]>([])
  const [celebrate, setCelebrate] = useState<{ value: number } | null>(null)
  const [questFlash, setQuestFlash] = useState<string | null>(null)
  const panelRef = useRef<PanelId>(null)

  useEffect(() => { panelRef.current = panel }, [panel])

  useEffect(() => {
    let toastSeq = 1
    const off = game.bus.on((e: GameEvent) => {
      if (e.t === 'state') force()
      else if (e.t === 'toast') {
        const id = toastSeq++
        setToasts((prev) => [...prev.slice(-3), { id, text: e.text, kind: e.kind || 'info' }])
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2200)
      } else if (e.t === 'maxStaminaUp') {
        setCelebrate({ value: e.value })
        setTimeout(() => setCelebrate(null), 2400)
        force()
      } else if (e.t === 'quest') {
        setQuestFlash(e.name)
        setTimeout(() => setQuestFlash(null), 2200)
        force()
      } else if (e.t === 'openPanel') {
        setPanel(e.panel as PanelId)
      }
    })

    // canvas + loop
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let dpr = Math.min(2, window.devicePixelRatio || 1)
    let ctxKey = ''

    const resize = () => {
      const wrap = wrapRef.current!
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      game.resize(w, h)
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      game.update(dt)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      game.render(ctx)
      // poll context bar (changes as the player walks; not a state event)
      const acts = game.getContext()
      const key = acts.map((a) => a.id + (a.enabled ? '1' : '0')).join(',') + '|' + game.getMode()
      if (key !== ctxKey) { ctxKey = key; setCtxActions(acts) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onDown = (ev: PointerEvent) => {
      if (panelRef.current) return
      const rect = canvas.getBoundingClientRect()
      game.tap(ev.clientX - rect.left, ev.clientY - rect.top)
    }
    canvas.addEventListener('pointerdown', onDown)

    const onVis = () => { if (document.hidden) game.persist(true) }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onDown)
      document.removeEventListener('visibilitychange', onVis)
      off()
      game.persist(true)
      game.audio.dispose()
    }
  }, [game])

  const s = game?.state

  const openPanel = (p: PanelId) => {
    game?.audio.resume()
    game?.audio.sfx('uiOpen')
    setPanel(p)
  }
  const closePanel = () => { game?.audio.sfx('uiClose'); setPanel(null) }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#2f6b4f',
      display: 'flex', justifyContent: 'center', alignItems: 'stretch',
      fontFamily: '"Galmuri11", system-ui, sans-serif', touchAction: 'none', userSelect: 'none',
    }}>
      <div ref={wrapRef} style={{
        position: 'relative', width: 'min(100vw, 480px)', height: '100%',
        overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.4)', background: '#7cc25b',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0, imageRendering: 'pixelated' }} />

        {s && <Hud s={s} />}

        {/* quest flash */}
        {questFlash && (
          <div style={{
            position: 'absolute', top: 74, left: '50%', transform: 'translateX(-50%)',
            background: UI.good, color: '#fff', padding: '6px 14px', borderRadius: 14,
            fontWeight: 700, fontSize: 13, boxShadow: '0 3px 0 rgba(0,0,0,0.2)', zIndex: 20,
          }}>✓ 퀘스트 완료! {questFlash}</div>
        )}

        {/* toasts */}
        <div style={{ position: 'absolute', top: 110, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 25, pointerEvents: 'none' }}>
          {toasts.map((t) => (
            <div key={t.id} style={{
              background: t.kind === 'good' ? UI.good : t.kind === 'bad' ? UI.bad : '#4a6fa5',
              color: '#fff', padding: '6px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              boxShadow: '0 3px 0 rgba(0,0,0,0.18)',
            }}>{t.text}</div>
          ))}
        </div>

        {/* context action bar */}
        {!panel && ctxActions.length > 0 && game?.getMode() === 'island' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 76, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 18, padding: '0 8px', flexWrap: 'wrap' }}>
            {ctxActions.map((a) => (
              <button key={a.id} disabled={!a.enabled} onClick={() => game?.doContext(a.id)}
                style={{
                  background: a.enabled ? UI.panel : '#d9cdb8', color: UI.text,
                  border: `2px solid ${UI.border}`, borderRadius: 14, padding: '8px 14px',
                  fontWeight: 700, fontSize: 14, opacity: a.enabled ? 1 : 0.7,
                  boxShadow: '0 3px 0 rgba(0,0,0,0.18)', cursor: a.enabled ? 'pointer' : 'default',
                }}>
                {a.emoji} {a.label}{!a.enabled && a.reason ? ` · ${a.reason}` : ''}
              </button>
            ))}
          </div>
        )}

        {/* mine exit/descend bar */}
        {game?.getMode() === 'mine' && !panel && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'flex', justifyContent: 'center', gap: 8, zIndex: 18 }}>
            <button onClick={() => game.exitMine()} style={mineBtn}>🪜 나가기</button>
            <div style={{ ...mineBtn, background: '#3a3340', color: '#fff' }}>지하 {game.mineFloor}층</div>
            {game.mineFloor < game.mineFloorMax() && (
              <button onClick={() => game.descend()} style={mineBtn}>⬇️ 더 깊이</button>
            )}
          </div>
        )}

        {/* bottom menu */}
        {game?.getMode() === 'island' && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 64,
            background: 'rgba(255,246,230,0.96)', borderTop: `2px solid ${UI.border}`,
            display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 15,
          }}>
            <MenuBtn emoji="🎒" label="가방" onClick={() => openPanel('inventory')} />
            <MenuBtn emoji="🛒" label="상점" onClick={() => openPanel('shop')} />
            <MenuBtn emoji="🔨" label="건설" onClick={() => openPanel('build')} />
            <MenuBtn emoji="🍳" label="요리" onClick={() => openPanel('cooking')} />
            <MenuBtn emoji="📜" label="퀘스트" onClick={() => openPanel('quests')} />
            <MenuBtn emoji="📖" label="도감" onClick={() => openPanel('collection')} />
            <MenuBtn emoji="⚙️" label="설정" onClick={() => openPanel('settings')} />
          </div>
        )}

        {/* celebration */}
        {celebrate && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 40, pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(255,246,230,0.97)', border: `3px solid ${UI.accent}`, borderRadius: 20,
              padding: '20px 26px', textAlign: 'center', color: UI.text, boxShadow: '0 6px 0 rgba(0,0,0,0.2)',
              animation: 'ci-pop 0.4s ease',
            }}>
              <div style={{ fontSize: 34 }}>🌅✨</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6 }}>잘 잤어요!</div>
              <div style={{ marginTop: 4, fontSize: 15 }}>최대 스태미나 +1 → <b>{celebrate.value}</b></div>
            </div>
          </div>
        )}

        {/* panels */}
        {panel && s && game && (
          <Panel title={panelTitle(panel)} onClose={closePanel}>
            {panel === 'inventory' && <InventoryPanel s={s} />}
            {panel === 'shop' && <ShopPanel game={game} s={s} />}
            {panel === 'build' && <BuildPanel game={game} s={s} />}
            {panel === 'cooking' && <CookingPanel game={game} s={s} />}
            {panel === 'quests' && <QuestPanel s={s} />}
            {panel === 'collection' && <CollectionPanel s={s} />}
            {panel === 'settings' && <SettingsPanel game={game} s={s} />}
            {panel === 'mine' && <MineInfoPanel game={game} />}
          </Panel>
        )}
      </div>
      <style>{`@keyframes ci-pop {0%{transform:scale(0.6);opacity:0}100%{transform:scale(1);opacity:1}}
        .ci-scroll::-webkit-scrollbar{width:8px}
        .ci-scroll::-webkit-scrollbar-thumb{background:${UI.border};border-radius:4px}`}</style>
    </div>
  )
}

const mineBtn: React.CSSProperties = {
  background: UI.panel, color: UI.text, border: `2px solid ${UI.border}`, borderRadius: 14,
  padding: '8px 14px', fontWeight: 700, fontSize: 14, boxShadow: '0 3px 0 rgba(0,0,0,0.18)', cursor: 'pointer',
}

function panelTitle(p: PanelId): string {
  switch (p) {
    case 'inventory': return '🎒 가방'
    case 'shop': return '🛒 상점'
    case 'build': return '🔨 건설'
    case 'cooking': return '🍳 요리'
    case 'quests': return '📜 퀘스트'
    case 'collection': return '📖 도감'
    case 'settings': return '⚙️ 설정'
    case 'mine': return '⛏️ 광산'
    default: return ''
  }
}

// ---------- HUD ----------
function Hud({ s }: { s: GameState }) {
  const pct = s.maxStamina > 0 ? s.stamina / s.maxStamina : 0
  const barColor = pct <= 0 ? '#d35a4a' : pct < 0.3 ? '#e8a23a' : '#5aa84a'
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 10px', zIndex: 16, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Pill>💰 {s.gold}</Pill>
        <Pill>💎 {s.gems}</Pill>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{
        marginTop: 6, background: 'rgba(255,246,230,0.95)', borderRadius: 12, padding: '5px 10px',
        border: '2px solid #caa56e', maxWidth: 220,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#5a4632' }}>
          <span>⚡ 스태미나</span><span>{s.stamina} / {s.maxStamina}</span>
        </div>
        <div style={{ marginTop: 3, height: 9, background: '#e3d4ba', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct * 100}%`, height: '100%', background: barColor, transition: 'width 0.2s' }} />
        </div>
      </div>
    </div>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,246,230,0.95)', border: '2px solid #caa56e', borderRadius: 12,
      padding: '4px 10px', fontWeight: 700, fontSize: 13, color: '#5a4632',
    }}>{children}</div>
  )
}

function MenuBtn({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 1, color: '#5a4632', cursor: 'pointer', padding: 2,
    }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

// ---------- Panel shell ----------
function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,24,16,0.45)', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: UI.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, border: `2px solid ${UI.border}`,
        maxHeight: '78%', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `2px solid ${UI.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: UI.text }}>{title}</span>
          <button onClick={onClose} style={{ background: UI.bad, color: '#fff', border: 'none', borderRadius: 10, width: 30, height: 30, fontWeight: 800, cursor: 'pointer' }}>✕</button>
        </div>
        <div className="ci-scroll" style={{ overflowY: 'auto', padding: 14, color: UI.text }}>{children}</div>
      </div>
    </div>
  )
}

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? UI.accent : '#cdbfa6', color: '#fff', border: 'none', borderRadius: 10,
    padding: '7px 12px', fontWeight: 700, fontSize: 13, cursor: enabled ? 'pointer' : 'default',
    boxShadow: enabled ? '0 2px 0 rgba(0,0,0,0.18)' : 'none',
  }
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px dashed #e0cfa8' }}>{children}</div>
}

// ---------- Inventory ----------
function InventoryPanel({ s }: { s: GameState }) {
  if (s.inventory.length === 0) return <Empty text="아직 아무것도 없어요. 나무나 바위를 캐 보세요!" />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {s.inventory.map((e) => {
        const it = ItemMap[e.itemId]
        return (
          <div key={e.itemId} style={{ background: '#fffdf6', border: `2px solid ${UI.border}`, borderRadius: 12, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 26 }}>{it?.emoji}</div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{it?.name}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: UI.accent }}>×{e.count}</div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Shop ----------
function ShopPanel({ game, s }: { game: Game; s: GameState }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const sellable = s.inventory.filter((e) => {
    const it = ItemMap[e.itemId]
    return it && Shops.sellableCategories.includes(it.category)
  })
  return (
    <div>
      <SectionTitle>밭 늘리기</SectionTitle>
      <Row>
        <span style={{ fontSize: 24 }}>🟫</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>농장 밭 ({s.plots.length}개 보유)</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>구입 시 {cropName(s.selectedCropId)} 자동 재배</div>
        </div>
        <button style={btnStyle(s.gold >= game.plotCost())} onClick={() => { game.buyPlot(); force() }}>💰 {game.plotCost()}</button>
      </Row>

      <SectionTitle>심을 작물 고르기</SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Crops.map((c) => {
          const unlocked = game.isCropUnlocked(c.id)
          const sel = s.selectedCropId === c.id
          return (
            <button key={c.id} disabled={!unlocked} onClick={() => { game.setSelectedCrop(c.id); force() }}
              style={{
                background: sel ? UI.good : unlocked ? '#fffdf6' : '#e3d8c2', color: sel ? '#fff' : UI.text,
                border: `2px solid ${UI.border}`, borderRadius: 10, padding: '6px 10px', fontWeight: 700,
                fontSize: 12, cursor: unlocked ? 'pointer' : 'default',
              }}>
              {ItemMap[c.yield.itemId]?.emoji} {c.name}{!unlocked ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      <SectionTitle>동물</SectionTitle>
      {Animals.map((a) => (
        <Row key={a.id}>
          <span style={{ fontSize: 24 }}>{a.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{a.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{ItemMap[a.product.itemId]?.name} 생산 · {a.requiredBuilding === 'chicken_coop' ? '닭장 필요' : ''}</div>
          </div>
          <button style={btnStyle(s.gold >= a.purchaseCost)} onClick={() => { game.buyAnimal(a.id); force() }}>💰 {a.purchaseCost}</button>
        </Row>
      ))}

      <SectionTitle>팔기</SectionTitle>
      {sellable.length === 0 && <div style={{ fontSize: 12, opacity: 0.7, padding: '6px 0' }}>팔 수 있는 물건이 없어요.</div>}
      {sellable.map((e) => {
        const it = ItemMap[e.itemId]
        return (
          <Row key={e.itemId}>
            <span style={{ fontSize: 22 }}>{it.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.name} ×{e.count}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>개당 {sellPriceOf(e.itemId)}골드</div>
            </div>
            <button style={btnStyle(true)} onClick={() => { game.sell(e.itemId, 1); force() }}>1개</button>
            <button style={btnStyle(true)} onClick={() => { game.sell(e.itemId, e.count); force() }}>전부</button>
          </Row>
        )
      })}
      {sellable.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['resource', 'crop', 'animal', 'food', 'ore'].map((cat) => (
            <button key={cat} style={btnStyle(true)} onClick={() => { game.sellAll(cat); force() }}>{catLabel(cat)} 모두 팔기</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Build ----------
function BuildPanel({ game, s }: { game: Game; s: GameState }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  return (
    <div>
      {Buildings.map((b) => {
        const bs = s.buildings[b.id]
        const upCost = game.upgradeCost(b.id)
        const condOk = meetsCondition(s, b.unlockCondition)
        return (
          <Row key={b.id}>
            <span style={{ fontSize: 26 }}>{b.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{b.name} {bs.built ? `Lv.${bs.level}` : ''}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {!bs.built
                  ? (condOk ? costText(b.buildCost) : unlockText(b.unlockCondition))
                  : (upCost ? `업그레이드: ${costText(upCost)}` : '최고 레벨')}
              </div>
            </div>
            {!bs.built
              ? <button style={btnStyle(condOk && game.canAfford(b.buildCost))} onClick={() => { game.build(b.id); force() }}>짓기</button>
              : (upCost ? <button style={btnStyle(game.canAfford(upCost))} onClick={() => { game.upgrade(b.id); force() }}>강화</button> : <span style={{ fontSize: 18 }}>⭐</span>)}
          </Row>
        )
      })}
    </div>
  )
}

// ---------- Cooking ----------
function CookingPanel({ game, s }: { game: Game; s: GameState }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const unlocked = s.buildings['cooking_fire']?.built
  if (!unlocked) return <Empty text="요리 화덕을 먼저 지어야 해요. (건설 메뉴)" />
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 8 }}>요리 슬롯 {s.cookQueue.length} / {game.cookSlots()} 사용 중</div>
      {s.cookQueue.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {s.cookQueue.map((j, i) => {
            const r = Recipes.find((x) => x.id === j.recipeId)!
            const remain = Math.max(0, j.doneAt - s.gameTime)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                <span style={{ fontSize: 20 }}>{r.emoji}</span>
                <span style={{ flex: 1 }}>{r.name} 조리 중…</span>
                <span style={{ fontWeight: 700 }}>{remain.toFixed(0)}초</span>
              </div>
            )
          })}
        </div>
      )}
      {Recipes.map((r) => {
        const seen = meetsCondition(s, r.unlockCondition) || s.recipesDiscovered.includes(r.id)
        if (!seen) return null
        const can = game.canCook(r.id)
        return (
          <Row key={r.id}>
            <span style={{ fontSize: 24 }}>{r.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>
                {r.inputs.map((i) => `${ItemMap[i.itemId]?.name} ${invCount(s, i.itemId)}/${i.amount}`).join(', ')} · {r.craftSeconds}초
              </div>
            </div>
            <button style={btnStyle(can)} onClick={() => { game.cook(r.id); force() }}>만들기</button>
          </Row>
        )
      })}
    </div>
  )
}

// ---------- Quests ----------
function QuestPanel({ s }: { s: GameState }) {
  const active = activeQuests(s)
  const doneCount = Object.values(s.quests).filter((q) => q.done).length
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 8, opacity: 0.85 }}>완료 {doneCount}개</div>
      {active.length === 0 && <Empty text="모든 퀘스트를 끝냈어요! 멋져요 🎉" />}
      {active.map((q) => {
        const prog = Math.min(questProgress(s, q), q.objective.target)
        return (
          <div key={q.id} style={{ background: '#fffdf6', border: `2px solid ${UI.border}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{q.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{q.desc}</div>
            <div style={{ marginTop: 6, height: 8, background: '#e3d4ba', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${(prog / q.objective.target) * 100}%`, height: '100%', background: UI.good }} />
            </div>
            <div style={{ fontSize: 11, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>{prog} / {q.objective.target}</span>
              <span>보상: {rewardText(q.reward)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Collection ----------
function CollectionPanel({ s }: { s: GameState }) {
  return (
    <div>
      <SectionTitle>발견한 아이템</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {Object.values(ItemMap).map((it) => {
          const seen = s.seenItems[it.id]
          return (
            <div key={it.id} style={{ textAlign: 'center', opacity: seen ? 1 : 0.3, fontSize: 22 }}>
              <div>{seen ? it.emoji : '❔'}</div>
              <div style={{ fontSize: 9, fontWeight: 700 }}>{seen ? it.name : '???'}</div>
            </div>
          )
        })}
      </div>
      <SectionTitle>발견한 레시피</SectionTitle>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Recipes.map((r) => {
          const found = s.recipesDiscovered.includes(r.id)
          return (
            <div key={r.id} style={{ textAlign: 'center', opacity: found ? 1 : 0.35, fontSize: 22 }}>
              <div>{found ? r.emoji : '❔'}</div>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{found ? r.name : '???'}</div>
            </div>
          )
        })}
      </div>
      <SectionTitle>기록</SectionTitle>
      <div style={{ fontSize: 12, lineHeight: 1.8 }}>
        🌳 나무 벤 횟수: {s.counters.treeChop}<br />
        ⛏️ 캔 바위/광석: {s.counters.rockMine + s.counters.oreMine}<br />
        🌾 수확 횟수: {s.counters.harvest}<br />
        😴 잠든 횟수: {s.counters.sleeps}<br />
        💰 총 판매액: {s.counters.totalSalesGold}<br />
        ⚡ 최대 스태미나: {s.maxStamina}
      </div>
    </div>
  )
}

// ---------- Mine info ----------
function MineInfoPanel({ game }: { game: Game }) {
  return (
    <div>
      <Empty text="광산 입구로 걸어가서 '광산 들어가기'를 누르세요." />
      <div style={{ fontSize: 12 }}>최고 도달 층: 지하 {game.state.mineDeepestFloor}층 / {MineLevels.floors.length}층</div>
    </div>
  )
}

// ---------- Settings ----------
function SettingsPanel({ game, s }: { game: Game; s: GameState }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const a = s.audio
  const set = (patch: Partial<typeof a>) => { game.setAudioSettings({ ...a, ...patch }); force() }
  return (
    <div>
      <SectionTitle>소리</SectionTitle>
      <Slider label="전체" value={a.master} onChange={(v) => set({ master: v })} />
      <Slider label="배경음" value={a.bgm} onChange={(v) => set({ bgm: v })} />
      <Slider label="효과음" value={a.sfx} onChange={(v) => set({ sfx: v })} />
      <Row>
        <span style={{ flex: 1, fontWeight: 700 }}>음소거</span>
        <button style={btnStyle(true)} onClick={() => set({ muted: !a.muted })}>{a.muted ? '🔇 켜기' : '🔊 끄기'}</button>
      </Row>
      <SectionTitle>저장</SectionTitle>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnStyle(true)} onClick={() => { game.persist(true); force() }}>💾 지금 저장</button>
        <button style={{ ...btnStyle(true), background: UI.bad }} onClick={() => {
          if (confirm('정말 처음부터 다시 시작할까요? 모든 진행이 사라져요.')) game.resetGame()
        }}>🗑️ 초기화</button>
      </div>
      <div style={{ marginTop: 14, fontSize: 11, opacity: 0.7, lineHeight: 1.6 }}>
        화면을 탭하면 그 곳으로 이동해요. 나무·바위·작물 곁에 서면 자동으로 일을 시작해요.
        스태미나를 모두 쓰면 텐트에서 잘 수 있고, 자고 나면 최대 스태미나가 +1 늘어나요.
      </div>
    </div>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row>
      <span style={{ width: 56, fontWeight: 700 }}>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 34, textAlign: 'right' }}>{Math.round(value * 100)}</span>
    </Row>
  )
}

// ---------- small helpers ----------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 800, fontSize: 14, color: UI.accent, margin: '12px 0 4px' }}>{children}</div>
}
function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: 13, opacity: 0.75 }}>{text}</div>
}
function cropName(id: string): string {
  return Crops.find((c) => c.id === id)?.name || id
}
function catLabel(cat: string): string {
  return { resource: '자원', crop: '작물', animal: '축산물', food: '음식', ore: '광물' }[cat] || cat
}
function costText(cost?: { gold?: number; items?: { itemId: string; amount: number }[] }): string {
  if (!cost) return '무료'
  const parts: string[] = []
  if (cost.gold) parts.push(`💰${cost.gold}`)
  if (cost.items) for (const it of cost.items) parts.push(`${ItemMap[it.itemId]?.emoji || ''}${it.amount}`)
  return parts.join(' ')
}
function unlockText(c?: { requiredTotalHarvestCount?: number; requiredMaxStamina?: number }): string {
  if (!c) return '잠김'
  if (c.requiredMaxStamina) return `🔒 최대 스태미나 ${c.requiredMaxStamina} 필요`
  if (c.requiredTotalHarvestCount) return `🔒 수확 ${c.requiredTotalHarvestCount}회 필요`
  return '🔒 잠김'
}
function rewardText(r: { gold?: number; gems?: number; items?: { itemId: string; amount: number }[] }): string {
  const parts: string[] = []
  if (r.gold) parts.push(`💰${r.gold}`)
  if (r.gems) parts.push(`💎${r.gems}`)
  if (r.items) for (const it of r.items) parts.push(`${ItemMap[it.itemId]?.emoji || ''}${it.amount}`)
  return parts.join(' ') || '-'
}
