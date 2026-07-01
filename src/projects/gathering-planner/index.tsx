import { useEffect, useState } from 'react'
import CalendarVoting from './components/CalendarVoting'
import Cursors from './components/Cursors'
import DateSummary from './components/DateSummary'
import DoodleBoard from './components/DoodleBoard'
import JoinRoom from './components/JoinRoom'
import OnlineUsers from './components/OnlineUsers'
import RoomSetup from './components/RoomSetup'
import VenueVoting from './components/VenueVoting'
import { colorForId, getDeviceId, getNickname } from './identity'
import { emptyState, fetchRoom, getRoomStore, hasSupabase, type PlannerState, type Room } from './store'

/** Inject the cute rounded fonts once (self-contained; no index.html edits). */
function useFonts() {
  useEffect(() => {
    const id = 'gathering-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Jua&family=Nunito:wght@600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])
}

const HASH_PREFIX = '#/p/gathering-planner'

function readRoomCode(): string | null {
  const m = window.location.hash.match(/^#\/p\/gathering-planner\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

const centered =
  'grid h-full w-full place-items-center bg-[#FDFBF7] p-6 text-center text-[#6b5b74]'
const fontStyle = { fontFamily: "'Nunito', system-ui, sans-serif" } as const

/** Shown when Supabase keys are missing — the app is Supabase-only by design. */
function ConfigError() {
  return (
    <div className={centered} style={fontStyle}>
      <div className="w-[min(90vw,420px)] rounded-[28px] bg-white p-7 shadow-[0_20px_50px_rgba(180,160,200,0.3)]">
        <div className="mb-2 text-4xl">🔌</div>
        <h1 className="text-xl font-extrabold">연결 설정이 필요해요</h1>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#a99bb5]">
          이 앱은 Supabase 실시간 백엔드로만 동작합니다. 아래 환경변수를 설정해 주세요.
        </p>
        <div className="mt-4 rounded-2xl bg-[#FDFBF7] p-3 text-left text-xs font-bold text-[#7a6f86] shadow-inner">
          <div>VITE_SUPABASE_URL</div>
          <div>VITE_SUPABASE_ANON_KEY</div>
        </div>
        <p className="mt-3 text-xs font-semibold text-[#c1b6cd]">
          <code>schema.sql</code> 을 Supabase SQL Editor 에 실행한 뒤, 키를 설정하고
          새로고침하세요.
        </p>
      </div>
    </div>
  )
}

function Notice({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className={centered} style={fontStyle}>
      <div className="w-[min(90vw,380px)] rounded-[28px] bg-white p-7 shadow-[0_20px_50px_rgba(180,160,200,0.3)]">
        <div className="mb-2 text-4xl">{emoji}</div>
        <h1 className="text-lg font-extrabold">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-[#a99bb5]">{desc}</p>
        <button
          onClick={() => (window.location.hash = HASH_PREFIX)}
          className="mt-5 rounded-2xl bg-[#FFD1DC] px-5 py-2.5 text-sm font-extrabold text-[#7A4A56] shadow-[0_6px_16px_rgba(255,179,198,0.5)] transition hover:brightness-95 active:scale-95"
        >
          새 모임 만들기 🎉
        </button>
      </div>
    </div>
  )
}

function ShareButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked */
        }
      }}
      className="shrink-0 whitespace-nowrap rounded-full bg-[#B9F2E5] px-2.5 py-1.5 text-[11px] font-extrabold text-[#2f7466] shadow-[0_4px_14px_rgba(180,160,200,0.22)] transition hover:brightness-95 active:scale-95"
    >
      {copied ? (
        '복사됨 ✓'
      ) : (
        <>
          🔗<span className="hidden sm:inline"> 초대링크</span>
        </>
      )}
    </button>
  )
}

export default function GatheringPlanner() {
  useFonts()

  const configured = hasSupabase
  const voter = getDeviceId()

  const [nick, setNick] = useState<string | null>(() => getNickname())
  const [roomCode, setRoomCode] = useState<string | null>(() => readRoomCode())
  const [room, setRoom] = useState<Room | null>(null)
  const [loadErr, setLoadErr] = useState<'notfound' | 'error' | null>(null)
  const [state, setState] = useState<PlannerState>(emptyState)

  // Track the room code in the URL hash.
  useEffect(() => {
    const onHash = () => setRoomCode(readRoomCode())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Fetch the room whenever the code changes to one we don't already hold.
  useEffect(() => {
    if (!configured || !roomCode) return
    if (room && room.id === roomCode) return
    let alive = true
    fetchRoom(roomCode)
      .then((r) => {
        if (!alive) return
        if (r) {
          setRoom(r)
          setLoadErr(null)
        } else setLoadErr('notfound')
      })
      .catch(() => alive && setLoadErr('error'))
    return () => {
      alive = false
    }
  }, [configured, roomCode, room])

  // Load + subscribe to this room's planner state.
  useEffect(() => {
    if (!room) return
    let alive = true
    const store = getRoomStore(room)
    store.load().then((s) => alive && setState(s)).catch(() => {})
    const unsub = store.subscribe((s) => alive && setState(s))
    return () => {
      alive = false
      unsub()
    }
  }, [room])

  if (!configured) return <ConfigError />

  // Base URL → host creates a room.
  if (!roomCode) {
    return (
      <RoomSetup
        onCreated={(created, name) => {
          setRoom(created)
          setNick(name)
          window.location.hash = `${HASH_PREFIX}/${created.id}`
        }}
      />
    )
  }

  if (loadErr === 'notfound')
    return <Notice emoji="🕳️" title="모임을 찾을 수 없어요" desc="링크가 만료되었거나 잘못되었어요." />
  if (loadErr === 'error')
    return <Notice emoji="😵" title="불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />
  if (!room)
    return (
      <div className={centered} style={fontStyle}>
        <div className="animate-pulse text-lg font-extrabold text-[#c1b6cd]">불러오는 중… 🍡</div>
      </div>
    )

  if (!nick) return <JoinRoom room={room} onJoin={setNick} />

  const store = getRoomStore(room)

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#FDFBF7] text-[#6b5b74]"
      style={fontStyle}
    >
      {/* Paper background lines (full bleed) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(#f4f0ea, #f4f0ea 1px, transparent 1px, transparent 30px)',
        }}
      />

      {/* Planner layer — sits beneath the canvas so you can doodle over it. */}
      <div className="absolute inset-0 z-10 overflow-y-auto">
        <div className="mx-auto flex max-w-[440px] flex-col gap-3 px-3 pb-28 pt-20 lg:ml-auto lg:mr-4 lg:max-w-[400px] lg:pb-6 lg:pt-28">
          <CalendarVoting
            candidateDates={room.candidateDates}
            dateVotes={state.dateVotes}
            voter={voter}
            voteMode={room.voteMode}
            onToggleDate={(day) => store.toggleDateVote(day, voter, nick)}
          />
          <VenueVoting
            venues={state.venues}
            venueVotes={state.venueVotes}
            voter={voter}
            onAdd={(name) => store.addVenue(name, nick)}
            onToggleVote={(id) => store.toggleVenueVote(id, voter)}
          />
          <DateSummary dateVotes={state.dateVotes} voter={voter} />
        </div>
      </div>

      {/* Full-screen doodle canvas (z-20) + floating toolbar (z-30) */}
      <DoodleBoard store={store} />

      {/* Live cursors overlay (z-40, non-interactive) */}
      <Cursors store={store} meId={voter} nick={nick} color={colorForId(voter)} />

      {/* Header (topmost, but its bar lets drawing pass through) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_4px_14px_rgba(180,160,200,0.22)] backdrop-blur">
          <span className="text-xl">🍱</span>
          <h1
            className="truncate text-base font-extrabold sm:text-lg"
            style={{ fontFamily: "'Jua', 'Nunito', sans-serif" }}
          >
            {room.name}
          </h1>
        </div>
        <div className="pointer-events-auto flex min-w-0 shrink items-center gap-2">
          <OnlineUsers store={store} me={{ id: voter, nick, color: colorForId(voter) }} />
          <ShareButton />
          <span className="shrink-0 rounded-full bg-[#E6E6FA] px-2.5 py-1.5 text-[11px] font-extrabold text-[#5f5580] shadow-[0_4px_14px_rgba(180,160,200,0.22)]">
            {nick}
          </span>
        </div>
      </header>
    </div>
  )
}
