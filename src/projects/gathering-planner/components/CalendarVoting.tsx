import { useMemo, useState } from 'react'
import type { DateVote, VoteMode } from '../store'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Pastel lavender→pink heat colour that deepens with the vote count. */
function heatStyle(count: number, max: number): React.CSSProperties {
  if (count === 0) return { backgroundColor: '#FDFBF7' }
  const t = max > 0 ? count / max : 0
  const r = Math.round(230 + t * 25)
  const g = Math.round(230 - t * 20)
  const b = Math.round(250 - t * 30)
  return { backgroundColor: `rgb(${r}, ${g}, ${b})` }
}

type Props = {
  candidateDates: string[]
  dateVotes: DateVote[]
  voter: string
  voteMode: VoteMode
  onToggleDate: (day: string) => void
}

export default function CalendarVoting({
  candidateDates,
  dateVotes,
  voter,
  voteMode,
  onToggleDate,
}: Props) {
  const today = new Date()
  const candidateSet = useMemo(() => new Set(candidateDates), [candidateDates])

  // Start on the month of the earliest candidate date (fall back to today).
  const [view, setView] = useState(() => {
    const first = [...candidateDates].sort()[0]
    if (first) {
      const [y, m] = first.split('-').map(Number)
      return { y, m: m - 1 }
    }
    return { y: today.getFullYear(), m: today.getMonth() }
  })

  const { counts, mine, max } = useMemo(() => {
    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const v of dateVotes) {
      counts[v.day] = (counts[v.day] ?? 0) + 1
      if (v.voter === voter) mine.add(v.day)
    }
    const max = Object.values(counts).reduce((a, b) => Math.max(a, b), 0)
    return { counts, mine, max }
  }, [dateVotes, voter])

  const firstDay = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const todayKey = ymd(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <section className="rounded-[24px] bg-white/90 p-4 shadow-[0_10px_28px_rgba(180,160,200,0.22)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-[#6b5b74]">📅 언제 만날까요?</h2>
        <span className="rounded-full bg-[#E6E6FA] px-2.5 py-1 text-[11px] font-extrabold text-[#5f5580]">
          {voteMode === 'single' ? '한 개만 투표' : '여러 개 투표'}
        </span>
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={() => shift(-1)}
          className="grid h-8 w-8 place-items-center rounded-full text-[#a99bb5] transition hover:bg-[#F3EFEA]"
        >
          ‹
        </button>
        <div className="text-base font-extrabold text-[#6b5b74]">
          {view.y} {MONTHS[view.m]}
        </div>
        <button
          onClick={() => shift(1)}
          className="grid h-8 w-8 place-items-center rounded-full text-[#a99bb5] transition hover:bg-[#F3EFEA]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 text-center text-xs font-bold ${
              i === 0 ? 'text-[#e79aa8]' : i === 6 ? 'text-[#93b0e0]' : 'text-[#b3a8bf]'
            }`}
          >
            {w}
          </div>
        ))}

        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const key = ymd(view.y, view.m, d)
          const isCandidate = candidateSet.has(key)
          const count = counts[key] ?? 0
          const isMine = mine.has(key)
          const isToday = key === todayKey

          // Non-candidate days are shown faint and are not votable.
          if (!isCandidate) {
            return (
              <div
                key={key}
                className="relative grid aspect-square place-items-center rounded-2xl text-sm font-bold text-[#d8d0e0]"
              >
                {d}
              </div>
            )
          }

          return (
            <button
              key={key}
              onClick={() => onToggleDate(key)}
              style={{
                ...heatStyle(count, max),
                boxShadow:
                  count > 0
                    ? '0 2px 6px rgba(180,160,200,0.2)'
                    : '0 2px 8px rgba(180,160,200,0.28)',
              }}
              className={`relative aspect-square rounded-2xl text-sm font-bold transition hover:brightness-95 ${
                isToday ? 'text-[#e2607a]' : 'text-[#6b5b74]'
              }`}
            >
              <span className="absolute left-1.5 top-1">{d}</span>
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-white/80 px-1 text-[10px] font-extrabold leading-4 text-[#e2607a] shadow-sm">
                {isMine ? '❤️' : '🤍'}
                {count > 0 ? count : ''}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs font-semibold text-[#b3a8bf]">
        {voteMode === 'single'
          ? '가능한 날 하루를 골라주세요 🌸'
          : '가능한 날을 모두 눌러주세요 ✨'}
      </p>
    </section>
  )
}
