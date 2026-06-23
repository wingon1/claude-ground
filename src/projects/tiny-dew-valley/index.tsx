import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import './styles.css'
import { Game } from './engine/game'
import { Overlay } from './ui/Overlay'

const MOVE_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

function GameUI({ game }: { game: Game }) {
  const subscribe = useCallback((cb: () => void) => game.subscribe(cb), [game])
  const getSnapshot = useCallback(() => game.getSnapshot(), [game])
  const ui = useSyncExternalStore(subscribe, getSnapshot)
  return <Overlay game={game} ui={ui} />
}

export default function TinyDewValley() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game, setGame] = useState<Game | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = new Game(canvas)
    setGame(g)
    g.start()

    const onKeyDown = (e: KeyboardEvent) => {
      if (MOVE_KEYS.has(e.key.toLowerCase())) e.preventDefault()
      g.onKeyDown(e)
    }
    const onKeyUp = (e: KeyboardEvent) => g.onKeyUp(e)
    const onResize = () => g.resize()
    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      g.tap(e.clientX - rect.left, e.clientY - rect.top)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('resize', onResize)
    canvas.addEventListener('pointerdown', onPointerDown)
    const ro = new ResizeObserver(() => g.resize())
    ro.observe(canvas)

    return () => {
      g.stop()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="tdv-root">
      <canvas ref={canvasRef} className="tdv-canvas" />
      {game && <GameUI game={game} />}
    </div>
  )
}
