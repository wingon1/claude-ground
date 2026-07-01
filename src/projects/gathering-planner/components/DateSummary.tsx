import { useMemo } from 'react'
import type { DateVote } from '../store'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function fmt(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = DOW[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${dow})`
}

/** Light yellow → deeper amber as the person's day-count grows (subtle). */
function chipColor(count: number, max: number): string {
  const t = max > 0 ? count / max : 0
  const r = Math.round(255 - 13 * t)
  const g = Math.round(247 - 47 * t)
  const b = Math.round(204 - 114 * t)
  return `rgb(${r}, ${g}, ${b})`
}

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

  const maxDays = people.reduce((m, p) => Math.max(m, p.days.length), 1)

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
                      style={{ backgroundColor: chipColor(p.days.length, maxDays) }}
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
