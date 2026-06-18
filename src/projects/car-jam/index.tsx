import { useEffect, useRef, useState } from 'react'
import { Main } from './engine/Main'
import type { GameState } from './engine/types'

/* ===========================================================================
 * Car Jam — a 3D parking-jam puzzle. This React component is a thin shell: it
 * mounts the self-contained vanilla three.js engine (engine/Main.ts) into a
 * container and renders the portrait HUD on top. All game logic lives in the
 * engine modules (Main / LevelGenerator / Grid / Input / Car / Audio).
 *
 * Layout follows the brief: top 20% = LEVEL + progress, middle 60% = the 3D
 * parking lot, bottom 20% = Restart / Undo controls.
 * ========================================================================= */

export default function CarJam() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Main | null>(null)
  const [s, setS] = useState<GameState>({
    level: 1,
    total: 0,
    remaining: 0,
    status: 'playing',
    muted: false,
    canUndo: false,
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

  const cleared = s.total - s.remaining
  const progress = s.total > 0 ? cleared / s.total : 0

  return (
    <div className="absolute inset-0 select-none overflow-hidden bg-[#3a4368]">
      {/* The three.js canvas fills the whole screen; HUD floats above it. */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* ---- Top band: level + progress (≈20%) ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[20%] flex-col items-center justify-center gap-3 px-6 pt-3">
        <div className="flex items-baseline gap-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
          <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">
            Level
          </span>
          <span className="text-4xl font-black tabular-nums text-white">{s.level}</span>
          <span className="text-sm font-semibold text-white/50">/ 100</span>
        </div>
        <div className="relative h-3 w-full max-w-xs overflow-hidden rounded-full bg-black/30 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-white/60">
          {cleared} / {s.total} cleared
        </span>
      </div>

      {/* ---- Bottom band: controls (≈20%) ---- */}
      <div className="absolute inset-x-0 bottom-0 flex h-[20%] items-center justify-center gap-4 px-6 pb-4">
        <HudButton onClick={() => gameRef.current?.undo()} disabled={!s.canUndo} icon="↩" label="Undo" />
        <HudButton onClick={() => gameRef.current?.restart()} icon="⟳" label="Restart" />
        <HudButton
          onClick={() => gameRef.current?.toggleMute()}
          icon={s.muted ? '🔇' : '🔊'}
          label={s.muted ? 'Muted' : 'Sound'}
        />
      </div>

      {/* ---- Win overlay ---- */}
      {s.status === 'won' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-3xl bg-white/10 px-10 py-9 text-center ring-1 ring-white/20">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-black text-white drop-shadow">Lot Cleared!</h2>
            <p className="text-sm text-white/70">Level {s.level} complete</p>
            {s.level < 100 ? (
              <button
                onClick={() => gameRef.current?.next()}
                className="rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 px-8 py-3 text-lg font-extrabold text-slate-900 shadow-lg transition active:scale-95"
              >
                Next Level →
              </button>
            ) : (
              <p className="text-lg font-bold text-amber-300">
                🏆 All 100 levels complete!
              </p>
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

      {/* Hint, fades out once the player has cleared a car */}
      {cleared === 0 && s.status === 'playing' && (
        <div className="pointer-events-none absolute left-1/2 top-[64%] -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
          Swipe a car along its lane to drive it out
        </div>
      )}
    </div>
  )
}

function HudButton({
  onClick,
  icon,
  label,
  disabled,
}: {
  onClick: () => void
  icon: string
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-20 flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 font-semibold text-white ring-1 ring-white/15 backdrop-blur transition active:scale-95 enabled:hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-[11px] uppercase tracking-wider">{label}</span>
    </button>
  )
}
