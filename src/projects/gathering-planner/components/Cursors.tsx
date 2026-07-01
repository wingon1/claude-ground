import { useEffect, useRef, useState } from 'react'
import type { Cursor, RoomStore } from '../store'

type Props = {
  store: RoomStore
  meId: string
  nick: string
  color: string
}

type Live = Cursor & { seen: number }

const STALE_MS = 5000
const SEND_MS = 40 // throttle: ~25 updates/sec

/**
 * Renders every other participant's mouse as a little pointer + nickname label,
 * and broadcasts our own position. Full-screen, non-interactive overlay.
 */
export default function Cursors({ store, meId, nick, color }: Props) {
  const [cursors, setCursors] = useState<Record<string, Live>>({})
  const lastSent = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Receive remote cursors; prune the ones that went quiet.
  useEffect(() => {
    const disconnect = store.connectCursors(
      (c) => {
        if (c.id === meId) return
        setCursors((prev) => ({ ...prev, [c.id]: { ...c, seen: Date.now() } }))
      },
      (id) => setCursors((prev) => (prev[id] ? drop(prev, id) : prev)),
    )
    const prune = setInterval(() => {
      const cutoff = Date.now() - STALE_MS
      setCursors((prev) => {
        const next: Record<string, Live> = {}
        let changed = false
        for (const [id, c] of Object.entries(prev)) {
          if (c.seen >= cutoff) next[id] = c
          else changed = true
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => {
      disconnect()
      clearInterval(prune)
    }
  }, [store, meId])

  // Broadcast our own cursor (throttled); announce leave on unmount.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const now = performance.now()
      if (now - lastSent.current < SEND_MS) return
      // Normalize to the 16:9 stage (this overlay), not the window, so cursors
      // line up for everyone. Ignore movement outside the stage.
      const rect = boxRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      if (x < 0 || x > 1 || y < 0 || y > 1) return
      lastSent.current = now
      store.sendCursor({ id: meId, nick, color, x, y })
    }
    window.addEventListener('pointermove', onMove)
    const announceLeave = () => store.sendCursorLeave(meId)
    window.addEventListener('beforeunload', announceLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('beforeunload', announceLeave)
      announceLeave()
    }
  }, [store, meId, nick, color])

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {Object.values(cursors).map((c) => (
        <div
          key={c.id}
          className="absolute -translate-y-1 transition-[left,top] duration-75 ease-linear"
          style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" className="drop-shadow">
            <path
              d="M4 2 L4 19 L9 14 L12.5 22 L15.5 20.5 L12 13 L19 13 Z"
              fill={c.color}
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="ml-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white shadow"
            style={{ backgroundColor: c.color }}
          >
            {c.nick}
          </span>
        </div>
      ))}
    </div>
  )
}

function drop(obj: Record<string, Live>, id: string): Record<string, Live> {
  const next = { ...obj }
  delete next[id]
  return next
}
