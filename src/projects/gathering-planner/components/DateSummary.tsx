import { useMemo } from 'react'
import type { DateVote } from '../store'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function fmt(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = DOW[new Date(y, m - 1, d).getDay()]
  return `${m}/${d}(${dow})`
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
    // Me first, then by name.
    return list.sort((a, b) => {
      if (a.voter === voter) return -1
      if (b.voter === voter) return 1
      return a.name.localeCompare(b.name)
    })
  }, [dateVotes, voter])

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
                      className="rounded-full bg-[#FFF2B2] px-2 py-0.5 text-[11px] font-extrabold text-[#8a7530]"
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
