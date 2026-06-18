import { useEffect, useRef } from 'react'
import { Game } from './Game'

// Self-contained 3D mobile puzzle game. Mounts a vanilla Three.js engine into
// a portrait-locked container; React only manages the lifecycle.
export default function BusEscape() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const game = new Game(host)
    game.start()
    return () => game.dispose()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#10142e',
        touchAction: 'none',
      }}
    />
  )
}
