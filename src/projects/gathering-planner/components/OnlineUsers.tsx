import { useEffect, useState } from 'react'
import type { Presence, RoomStore } from '../store'

const MAX_SHOWN = 3

/**
 * Overlapping stack of nickname cards for everyone currently connected
 * (via Supabase Realtime Presence). My own card is excluded — the header
 * already shows my nickname separately.
 */
export default function OnlineUsers({ store, me }: { store: RoomStore; me: Presence }) {
  const [users, setUsers] = useState<Presence[]>([])

  useEffect(() => {
    return store.connectPresence(me, setUsers)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, me.id, me.nick, me.color])

  const others = users.filter((u) => u.id !== me.id)
  if (others.length === 0) return null

  const shown = others.slice(0, MAX_SHOWN)
  const extra = others.length - shown.length

  return (
    <div className="pointer-events-auto flex items-center pl-2.5" title={`접속 중 ${others.length}명`}>
      {shown.map((u, i) => (
        <span
          key={u.id}
          className="max-w-[80px] truncate rounded-full px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-[0_4px_14px_rgba(180,160,200,0.28)] ring-2 ring-white"
          style={{ backgroundColor: u.color, marginLeft: i === 0 ? 0 : -10, zIndex: MAX_SHOWN - i }}
        >
          {u.nick}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="rounded-full bg-[#c9b8e8] px-2 py-1.5 text-[11px] font-extrabold text-white ring-2 ring-white"
          style={{ marginLeft: -10 }}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
