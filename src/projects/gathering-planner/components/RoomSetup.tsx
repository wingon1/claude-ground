import { useMemo, useState } from 'react'
import { holidayName, isHoliday } from '../holidays'
import { setNickname } from '../identity'
import { createRoom, type DateMode, type Room, type VoteMode } from '../store'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isWeekend(day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6
}

/** All 'YYYY-MM-DD' between a and b inclusive (order-independent). */
function expandRange(a: string, b: string): string[] {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  const out: string[] = []
  const d = new Date(lo + 'T00:00:00')
  const end = new Date(hi + 'T00:00:00')
  while (d <= end) {
    out.push(ymd(d.getFullYear(), d.getMonth(), d.getDate()))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const MODES: { key: DateMode; label: string; hint: string }[] = [
  { key: 'single', label: '하루', hint: '한 날짜만 정해요' },
  { key: 'range', label: '기간', hint: '시작~끝 범위를 골라요' },
  { key: 'list', label: '리스트', hint: '가능한 날들을 콕콕 골라요' },
]

type Props = {
  onCreated: (room: Room, nick: string) => void
}

export default function RoomSetup({ onCreated }: Props) {
  const [name, setName] = useState('')
  const [nick, setNick] = useState('')
  const [mode, setMode] = useState<DateMode>('list')
  const [voteMode, setVoteMode] = useState<VoteMode>('multiple')

  const [single, setSingle] = useState<string | null>(null)
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  })
  const [list, setList] = useState<Set<string>>(new Set())
  const [excludeHolidays, setExcludeHolidays] = useState(true)

  const today = new Date()
  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate())
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const candidates = useMemo(() => {
    let days: string[]
    if (mode === 'single') days = single ? [single] : []
    else if (mode === 'range')
      days = range.start && range.end ? expandRange(range.start, range.end) : range.start ? [range.start] : []
    else days = [...list].sort()
    return excludeHolidays ? days.filter((d) => !isHoliday(d) && !isWeekend(d)) : days
  }, [mode, single, range, list, excludeHolidays])

  const candidateSet = useMemo(() => new Set(candidates), [candidates])

  function pick(key: string) {
    if (key < todayKey) return // no past days
    if (excludeHolidays && (isHoliday(key) || isWeekend(key))) return // 공휴일·주말 제외
    if (mode === 'single') {
      setSingle((s) => (s === key ? null : key))
    } else if (mode === 'range') {
      setRange((r) => {
        if (!r.start || (r.start && r.end)) return { start: key, end: null }
        return { start: r.start, end: key }
      })
    } else {
      setList((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }
  }

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const firstDay = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const canCreate = name.trim() && nick.trim() && candidates.length > 0 && !busy

  async function create() {
    if (!canCreate) return
    setBusy(true)
    setErr(null)
    try {
      const finalVoteMode: VoteMode = mode === 'single' ? 'single' : voteMode
      const room = await createRoom({
        name: name.trim(),
        dateMode: mode,
        voteMode: finalVoteMode,
        candidateDates: candidates,
      })
      setNickname(nick.trim())
      onCreated(room, nick.trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : '방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-2xl bg-[#FDFBF7] px-4 py-3 text-sm font-extrabold text-[#6b5b74] shadow-inner outline-none placeholder:text-[#c8bdd0] focus:shadow-[0_0_0_3px_rgba(255,179,198,0.5)]'
  const label = 'mb-1.5 block text-xs font-extrabold text-[#a99bb5]'

  return (
    <div
      className="grid h-full w-full place-items-center overflow-y-auto bg-[#FDFBF7] p-4 text-[#6b5b74]"
      style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      <div className="my-6 w-[min(94vw,460px)] rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(180,160,200,0.3)]">
        <div className="mb-1 text-center text-4xl">🍱</div>
        <h1
          className="mb-1 text-center text-xl font-extrabold"
          style={{ fontFamily: "'Jua', 'Nunito', sans-serif" }}
        >
          새 모임 만들기
        </h1>
        <p className="mb-5 text-center text-xs font-semibold text-[#b3a8bf]">
          모임을 만들고 링크를 공유하면 다 같이 모여요 ✨
        </p>

        {/* ① 모임 이름 */}
        <div className="mb-4">
          <label className={label}>① 모임 이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 6월 팀 회식 🍻"
            maxLength={40}
            className={field}
          />
        </div>

        {/* ② 닉네임 */}
        <div className="mb-4">
          <label className={label}>② 내 닉네임</label>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="뭐라고 부를까요?"
            maxLength={16}
            className={field}
          />
        </div>

        {/* ③ 날짜 설정 */}
        <div className="mb-4">
          <label className={label}>③ 날짜 정하기</label>
          <div className="mb-2 flex gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 rounded-2xl py-2 text-sm font-extrabold transition ${
                  mode === m.key
                    ? 'bg-[#FFD1DC] text-[#7A4A56] shadow-[0_4px_12px_rgba(255,179,198,0.5)]'
                    : 'bg-[#FDFBF7] text-[#b3a8bf] shadow-inner'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mb-2 text-center text-[11px] font-semibold text-[#c1b6cd]">
            {MODES.find((m) => m.key === mode)!.hint}
          </p>

          {/* 공휴일 제외 토글 */}
          <button
            onClick={() => setExcludeHolidays((v) => !v)}
            className="mb-2 flex w-full items-center justify-between rounded-2xl bg-[#FDFBF7] px-3 py-2 shadow-inner"
          >
            <span className="text-xs font-extrabold text-[#7a6f86]">🎌 공휴일·주말 제외하기</span>
            <span
              className={`relative h-5 w-9 rounded-full transition ${
                excludeHolidays ? 'bg-[#8FE3B0]' : 'bg-[#d8d0e0]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  excludeHolidays ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <div className="rounded-2xl bg-[#FDFBF7] p-3 shadow-inner">
            <div className="mb-1 flex items-center justify-between px-1">
              <button
                onClick={() => shift(-1)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#a99bb5] transition hover:bg-white"
              >
                ‹
              </button>
              <div className="text-sm font-extrabold text-[#6b5b74]">
                {view.y} {MONTHS[view.m]}
              </div>
              <button
                onClick={() => shift(1)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#a99bb5] transition hover:bg-white"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`py-1 text-center text-[10px] font-bold ${
                    i === 0 ? 'text-[#e79aa8]' : i === 6 ? 'text-[#93b0e0]' : 'text-[#b3a8bf]'
                  }`}
                >
                  {w}
                </div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={`e${i}`} />
                const key = ymd(view.y, view.m, d)
                const past = key < todayKey
                const hol = holidayName(key)
                const weekend = isWeekend(key)
                const blockedHol = excludeHolidays && !!hol
                const blockedWknd = excludeHolidays && weekend && !hol
                const disabled = past || blockedHol || blockedWknd
                const on = candidateSet.has(key)
                return (
                  <button
                    key={key}
                    disabled={disabled}
                    onClick={() => pick(key)}
                    title={hol ?? (blockedWknd ? '주말' : undefined)}
                    className={`aspect-square rounded-xl text-xs font-bold transition ${
                      past
                        ? 'cursor-not-allowed text-[#d8d0e0]'
                        : blockedHol
                          ? 'cursor-not-allowed bg-[#FFE1E6] text-[#e79aa8] line-through'
                          : blockedWknd
                            ? 'cursor-not-allowed text-[#d8d0e0] line-through'
                            : on
                              ? 'bg-[#FF8FA3] text-white shadow-[0_3px_8px_rgba(255,143,163,0.5)]'
                              : hol
                                ? 'text-[#e79aa8] hover:bg-white'
                                : 'text-[#6b5b74] hover:bg-white'
                    }`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold text-[#a99bb5]">
              {candidates.length > 0 ? `${candidates.length}일 선택됨` : '날짜를 골라주세요'}
            </span>
            {/* 투표 방식 — 하루 모드에선 의미 없어 숨김 */}
            {mode !== 'single' && (
              <button
                onClick={() => setVoteMode((v) => (v === 'single' ? 'multiple' : 'single'))}
                className="flex items-center gap-1.5 rounded-full bg-[#E6E6FA] px-2 py-1 text-[11px] font-extrabold text-[#5f5580]"
                title="참가자 투표 방식"
              >
                <span className={voteMode === 'single' ? 'opacity-100' : 'opacity-40'}>
                  한 개만
                </span>
                <span
                  className={`relative h-4 w-8 rounded-full transition ${
                    voteMode === 'multiple' ? 'bg-[#FFB3C6]' : 'bg-[#C9B8E8]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
                      voteMode === 'multiple' ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </span>
                <span className={voteMode === 'multiple' ? 'opacity-100' : 'opacity-40'}>
                  여러 개
                </span>
              </button>
            )}
          </div>
        </div>

        {err && (
          <p className="mb-3 rounded-2xl bg-[#FFE1E6] px-3 py-2 text-center text-xs font-bold text-[#c05a6e]">
            {err}
          </p>
        )}

        <button
          disabled={!canCreate}
          onClick={create}
          className="w-full rounded-2xl bg-[#FFD1DC] py-3.5 text-base font-extrabold text-[#7A4A56] shadow-[0_8px_20px_rgba(255,179,198,0.55)] transition enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
        >
          {busy ? '만드는 중… ⏳' : '방 만들기 🎉'}
        </button>
      </div>
    </div>
  )
}
