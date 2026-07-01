import { useEffect, useState } from 'react'
import CalendarVoting from './components/CalendarVoting'
import DoodleBoard from './components/DoodleBoard'
import VenueVoting from './components/VenueVoting'
import { getDeviceId, getNickname, setNickname } from './identity'
import { emptyState, getStore, type PlannerState, type VoteMode } from './store'

const MODE_KEY = 'gathering.voteMode.v1'

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

function NicknameGate({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#FDFBF7]/80 backdrop-blur">
      <div className="w-[min(90vw,360px)] rounded-[28px] bg-white p-6 text-center shadow-[0_20px_50px_rgba(180,160,200,0.35)] ring-1 ring-[#f0e8df]">
        <div className="mb-2 text-4xl">🍱</div>
        <h1 className="text-xl font-extrabold text-[#6b5b74]">함께 모여요!</h1>
        <p className="mt-1 text-sm font-semibold text-[#a99bb5]">
          뭐라고 부르면 될까요?
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onDone(name.trim())}
          placeholder="닉네임"
          maxLength={16}
          className="mt-4 w-full rounded-2xl bg-[#FDFBF7] px-4 py-3 text-center text-base font-extrabold text-[#6b5b74] outline-none ring-1 ring-[#efe7de] placeholder:text-[#c8bdd0] focus:ring-2 focus:ring-[#FFB3C6]"
        />
        <button
          disabled={!name.trim()}
          onClick={() => onDone(name.trim())}
          className="mt-4 w-full rounded-2xl bg-[#FFD1DC] py-3 text-base font-extrabold text-[#7A4A56] transition enabled:hover:brightness-95 enabled:active:scale-95 disabled:opacity-50"
        >
          시작하기 ✨
        </button>
      </div>
    </div>
  )
}

export default function GatheringPlanner() {
  useFonts()
  const store = getStore()
  const voter = getDeviceId()

  const [nick, setNick] = useState<string | null>(() => getNickname())
  const [state, setState] = useState<PlannerState>(emptyState)
  const [mode, setMode] = useState<VoteMode>(
    () => (localStorage.getItem(MODE_KEY) as VoteMode) || 'multiple',
  )

  // Load initial state and subscribe to realtime updates.
  useEffect(() => {
    let alive = true
    store.load().then((s) => alive && setState(s))
    const unsub = store.subscribe((s) => alive && setState(s))
    return () => {
      alive = false
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function chooseMode(m: VoteMode) {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
    // Enforce single-choice immediately: keep only this voter's most recent pick.
    if (m === 'single') {
      const mine = state.dateVotes.filter((d) => d.voter === voter)
      if (mine.length > 1) {
        // Drop all but the last, one delete at a time via the toggle.
        for (const d of mine.slice(0, -1)) store.toggleDateVote(d.day, voter, 'multiple')
      }
    }
  }

  if (!nick) {
    return (
      <div style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}>
        <NicknameGate
          onDone={(n) => {
            setNickname(n)
            setNick(n)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full flex-col bg-[#FDFBF7] text-[#6b5b74]"
      style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍱</span>
          <h1
            className="text-lg font-extrabold sm:text-xl"
            style={{ fontFamily: "'Jua', 'Nunito', sans-serif" }}
          >
            회식 다이어리
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
              store.online
                ? 'bg-[#B9F2E5] text-[#356055]'
                : 'bg-[#FFF2B2] text-[#8a7530]'
            }`}
            title={
              store.online
                ? '실시간으로 모두와 연결됨'
                : '로컬 모드 (같은 브라우저 탭끼리 동기화)'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                store.online ? 'bg-[#2fae87]' : 'bg-[#c9a227]'
              }`}
            />
            {store.online ? '실시간' : '로컬'}
          </span>
          <span className="rounded-full bg-[#E6E6FA] px-2.5 py-1 text-[11px] font-extrabold text-[#5f5580]">
            {nick}
          </span>
        </div>
      </header>

      {/* Split view: doodle (60%) | planner (40%). Stacks on mobile. */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0 lg:flex-row lg:gap-4 lg:p-4 lg:pt-0">
        {/* Doodle — first on desktop (left), second on mobile (below planner) */}
        <div className="order-2 min-h-[320px] flex-1 lg:order-1 lg:min-h-0 lg:basis-[60%]">
          <DoodleBoard />
        </div>

        {/* Planner sidebar */}
        <div className="order-1 flex flex-col gap-3 overflow-y-auto lg:order-2 lg:basis-[40%] lg:pr-1">
          <CalendarVoting
            dateVotes={state.dateVotes}
            voter={voter}
            mode={mode}
            onModeChange={chooseMode}
            onToggleDate={(day) => store.toggleDateVote(day, voter, mode)}
          />
          <VenueVoting
            venues={state.venues}
            venueVotes={state.venueVotes}
            voter={voter}
            onAdd={(name) => store.addVenue(name, nick)}
            onToggleVote={(id) => store.toggleVenueVote(id, voter)}
          />
        </div>
      </main>
    </div>
  )
}
