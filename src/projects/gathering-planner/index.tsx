import { useEffect, useState } from 'react'
import CalendarVoting from './components/CalendarVoting'
import DoodleBoard from './components/DoodleBoard'
import VenueVoting from './components/VenueVoting'
import { getDeviceId, getNickname, setNickname } from './identity'
import { emptyState, getStore, type PlannerState, type VoteMode } from './store'
import { hasSupabase } from './supabaseClient'

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

/** Shown when Supabase keys are missing — the app is Supabase-only by design. */
function ConfigError() {
  return (
    <div
      className="grid h-full w-full place-items-center bg-[#FDFBF7] p-6 text-center"
      style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      <div className="w-[min(90vw,420px)] rounded-[28px] bg-white p-7 shadow-[0_20px_50px_rgba(180,160,200,0.3)]">
        <div className="mb-2 text-4xl">🔌</div>
        <h1 className="text-xl font-extrabold text-[#6b5b74]">연결 설정이 필요해요</h1>
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

function NicknameGate({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#FDFBF7]/80 backdrop-blur">
      <div className="w-[min(90vw,360px)] rounded-[28px] bg-white p-6 text-center shadow-[0_20px_50px_rgba(180,160,200,0.35)]">
        <div className="mb-2 text-4xl">🍱</div>
        <h1 className="text-xl font-extrabold text-[#6b5b74]">함께 모여요!</h1>
        <p className="mt-1 text-sm font-semibold text-[#a99bb5]">뭐라고 부르면 될까요?</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && onDone(name.trim())}
          placeholder="닉네임"
          maxLength={16}
          className="mt-4 w-full rounded-2xl bg-[#FDFBF7] px-4 py-3 text-center text-base font-extrabold text-[#6b5b74] shadow-inner outline-none placeholder:text-[#c8bdd0] focus:shadow-[0_0_0_3px_rgba(255,179,198,0.5)]"
        />
        <button
          disabled={!name.trim()}
          onClick={() => onDone(name.trim())}
          className="mt-4 w-full rounded-2xl bg-[#FFD1DC] py-3 text-base font-extrabold text-[#7A4A56] shadow-[0_6px_16px_rgba(255,179,198,0.5)] transition enabled:hover:brightness-95 enabled:active:scale-95 disabled:opacity-50 disabled:shadow-none"
        >
          시작하기 ✨
        </button>
      </div>
    </div>
  )
}

export default function GatheringPlanner() {
  useFonts()

  const [nick, setNick] = useState<string | null>(() => getNickname())
  const [state, setState] = useState<PlannerState>(emptyState)
  const [mode, setMode] = useState<VoteMode>(
    () => (localStorage.getItem(MODE_KEY) as VoteMode) || 'multiple',
  )

  // Supabase-only: no keys → configuration error (no silent local fallback).
  const configured = hasSupabase
  const voter = getDeviceId()

  // Load initial state and subscribe to realtime updates.
  useEffect(() => {
    if (!configured) return
    let alive = true
    const store = getStore()
    store.load().then((s) => alive && setState(s)).catch(() => {})
    const unsub = store.subscribe((s) => alive && setState(s))
    return () => {
      alive = false
      unsub()
    }
  }, [configured])

  if (!configured) return <ConfigError />

  const store = getStore()

  function chooseMode(m: VoteMode) {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
    // Enforce single-choice immediately: keep only this voter's most recent pick.
    if (m === 'single') {
      const mine = state.dateVotes.filter((d) => d.voter === voter)
      for (const d of mine.slice(0, -1)) store.toggleDateVote(d.day, voter, 'multiple')
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
      className="relative h-full w-full overflow-hidden bg-[#FDFBF7] text-[#6b5b74]"
      style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      {/* Paper background lines (full bleed) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(#f4f0ea, #f4f0ea 1px, transparent 1px, transparent 30px)',
        }}
      />

      {/* Planner layer — sits beneath the canvas so you can doodle over it.
          Scrollable; clicks reach it whenever the doodle tool is "손"(select). */}
      <div className="absolute inset-0 z-10 overflow-y-auto">
        <div className="mx-auto flex max-w-[440px] flex-col gap-3 px-3 pb-28 pt-20 lg:ml-auto lg:mr-4 lg:max-w-[400px] lg:pb-6 lg:pt-28">
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
      </div>

      {/* Full-screen doodle canvas (z-20) + floating toolbar (z-30) */}
      <DoodleBoard />

      {/* Header (topmost, but its bar lets drawing pass through) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_4px_14px_rgba(180,160,200,0.22)] backdrop-blur">
          <span className="text-xl">🍱</span>
          <h1
            className="text-base font-extrabold sm:text-lg"
            style={{ fontFamily: "'Jua', 'Nunito', sans-serif" }}
          >
            회식 다이어리
          </h1>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1.5 text-[11px] font-extrabold text-[#356055] shadow-[0_4px_14px_rgba(180,160,200,0.22)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2fae87]" /> 실시간
          </span>
          <span className="rounded-full bg-[#E6E6FA] px-2.5 py-1.5 text-[11px] font-extrabold text-[#5f5580] shadow-[0_4px_14px_rgba(180,160,200,0.22)]">
            {nick}
          </span>
        </div>
      </header>
    </div>
  )
}
