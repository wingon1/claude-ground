import { useMemo } from 'react'
import type { DateVote } from '../store'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function fmt(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = DOW[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${dow})`
}

// Colour a date chip by how popular that date is: most-picked → orange,
// second-most → yellow, the rest → light yellow.
const TOP_COLOR = '#FCC26D' // 주황
const SECOND_COLOR = '#FCE38A' // 노랑
const REST_COLOR = '#FFF3C4' // 연노랑

type Person = { voter: string; name: string; days: string[] }

/** Bottom panel: who is available on which dates. */
export default function DateSummary({ dateVotes, voter }: { dateVotes: DateVote[]; voter: string }) {
  const people = useMemo(() => {
    const map = new Map<string, Person>()
    for (const v of dateVotes) {
      const p = map.get(v.voter) ?? { voter: v.voter, name: v.name || '익명', days: [] }
      if (v.name) p.name = v.name
      p.days.push(v.day)
      map.set(v.voter, p)
    }
    const list = [...map.values()]
    list.forEach((p) => p.days.sort())
    // Most available days first.
    return list.sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name))
  }, [dateVotes])

  // Per-date popularity → chip colour tier (by how many people picked each date).
  const colorOf = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const v of dateVotes) counts[v.day] = (counts[v.day] ?? 0) + 1
    const distinct = [...new Set(Object.values(counts))].sort((a, b) => b - a)
    const top = distinct[0]
    const second = distinct[1]
    return (day: string): string => {
      const c = counts[day] ?? 0
      if (c === top) return TOP_COLOR
      if (c === second) return SECOND_COLOR
      return REST_COLOR
    }
  }, [dateVotes])

  return (
    <section className="rounded-[24px] bg-white/90 p-4 shadow-[0_10px_28px_rgba(180,160,200,0.22)] backdrop-blur">
      <h2 className="mb-3 text-lg font-extrabold text-[#6b5b74]">🙋 누가 언제 되나요?</h2>

      {people.length === 0 ? (
        <div className="rounded-2xl bg-[#FDFBF7] py-6 text-center text-sm font-semibold text-[#c1b6cd]">
          아직 아무도 날짜를 고르지 않았어요 🗓️
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {people.map((p) => {
            const isMe = p.voter === voter
            return (
              <li key={p.voter} className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-[#6b5b74]">
                  {p.name}
                  {isMe && <span className="ml-1 text-[11px] font-bold text-[#e2607a]">(나)</span>}
                  <span className="ml-1.5 text-[11px] font-bold text-[#b3a8bf]">
                    {p.days.length}일
                  </span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {p.days.map((d) => (
                    <span
                      key={d}
                      className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-[#8a7530]"
                      style={{ backgroundColor: colorOf(d) }}
                    >
                      {fmt(d)}
                    </span>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
