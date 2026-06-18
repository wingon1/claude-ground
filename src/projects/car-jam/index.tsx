import { useEffect, useRef, useState } from 'react'
import { Main } from './engine/Main'
import type { GameState } from './engine/types'

/* ===========================================================================
 * Car Jam — a 3D colour-boarding puzzle (Bus Jam style). Tap a car to pull it
 * out of the jammed lot onto a boarding slot; the passenger at the front of the
 * queue boards any slotted car of their colour, and a full car drives off.
 * Clear the queue to win.
 *
 * This React component is a thin shell over the self-contained three.js engine
 * (engine/Main.ts). HUD on top: top = level + queue progress, bottom = Restart.
 * ========================================================================= */

export default function CarJam() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Main | null>(null)
  const [s, setS] = useState<GameState>({
    level: 1,
    queueTotal: 0,
    queueLeft: 0,
    status: 'playing',
    muted: false,
  })

  useEffect(() => {
    if (!mountRef.current) return
    const game = new Main(mountRef.current, setS)
    gameRef.current = game
    const ro = game.observeResize()
    return () => {
      ro.disconnect()
      game.dispose()
      gameRef.current = null
    }
  }, [])

  const boarded = s.queueTotal - s.queueLeft
  const progress = s.queueTotal > 0 ? boarded / s.queueTotal : 0

  return (
    <div className="absolute inset-0 touch-none select-none overflow-hidden bg-[#3a4368]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* ---- Top band: level + queue progress ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-2.5 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-baseline gap-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">Level</span>
          <span className="text-4xl font-black tabular-nums text-white">{s.level}</span>
          <span className="text-sm font-semibold text-white/50">/ 100</span>
        </div>
        <div className="relative h-3 w-full max-w-xs overflow-hidden rounded-full bg-black/30 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
          <span aria-hidden>🧍</span> {s.queueLeft} waiting · {boarded}/{s.queueTotal} boarded
        </span>
      </div>

      {/* ---- Bottom band: controls ---- */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <HudButton onClick={() => gameRef.current?.restart()} icon="⟳" label="Restart" />
        <HudButton
          onClick={() => gameRef.current?.toggleMute()}
          icon={s.muted ? '🔇' : '🔊'}
          label={s.muted ? 'Muted' : 'Sound'}
        />
      </div>

      {/* ---- Stuck overlay ---- */}
      {s.status === 'stuck' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-white/10 px-10 py-9 text-center ring-1 ring-white/20">
            <div className="text-6xl">🚧</div>
            <h2 className="text-2xl font-black text-white drop-shadow">No moves left</h2>
            <p className="max-w-[15rem] text-sm text-white/70">
              Every boarding slot is taken by a car the front passenger can't board.
            </p>
            <button
              onClick={() => gameRef.current?.restart()}
              className="rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 px-8 py-3 text-lg font-extrabold text-slate-900 shadow-lg transition active:scale-95"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* ---- Win overlay ---- */}
      {s.status === 'won' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-white/10 px-10 py-9 text-center ring-1 ring-white/20">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-black text-white drop-shadow">Everyone's aboard!</h2>
            <p className="text-sm text-white/70">Level {s.level} complete</p>
            {s.level < 100 ? (
              <button
                onClick={() => gameRef.current?.next()}
                className="rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 px-8 py-3 text-lg font-extrabold text-slate-900 shadow-lg transition active:scale-95"
              >
                Next Level →
              </button>
            ) : (
              <p className="text-lg font-bold text-amber-300">🏆 All 100 levels complete!</p>
            )}
            <button
              onClick={() => gameRef.current?.restart()}
              className="text-sm font-semibold text-white/60 underline-offset-2 hover:underline"
            >
              Replay level
            </button>
          </div>
        </div>
      )}

      {/* Hint on the first level */}
      {s.level === 1 && s.status === 'playing' && boarded === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[70%] -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-center text-xs font-medium text-white/85 backdrop-blur">
          Tap a car to pull it out — passengers board the matching colour
        </div>
      )}
    </div>
  )
}

function HudButton({ onClick, icon, label }: { onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-20 flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 font-semibold text-white ring-1 ring-white/15 backdrop-blur transition active:scale-95 hover:bg-white/20"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[11px] uppercase tracking-wider">{label}</span>
    </button>
  )
}
