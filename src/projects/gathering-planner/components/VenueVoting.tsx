import { useMemo, useState } from 'react'
import type { Venue, VenueVote } from '../store'

type Props = {
  venues: Venue[]
  venueVotes: VenueVote[]
  voter: string
  onAdd: (name: string) => void
  onToggleVote: (venueId: string) => void
}

const CARD_TINTS = ['#FFD1DC', '#B9F2E5', '#FFF2B2', '#E6E6FA']

function looksLikeUrl(s: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(s.trim())
}

export default function VenueVoting({
  venues,
  venueVotes,
  voter,
  onAdd,
  onToggleVote,
}: Props) {
  const [input, setInput] = useState('')

  const { counts, mine } = useMemo(() => {
    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const v of venueVotes) {
      counts[v.venue_id] = (counts[v.venue_id] ?? 0) + 1
      if (v.voter === voter) mine.add(v.venue_id)
    }
    return { counts, mine }
  }, [venueVotes, voter])

  const sorted = useMemo(
    () =>
      [...venues].sort(
        (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.name.localeCompare(b.name),
      ),
    [venues, counts],
  )

  function submit() {
    const name = input.trim()
    if (!name) return
    onAdd(name)
    setInput('')
  }

  return (
    <section className="rounded-[24px] bg-white/90 p-4 shadow-[0_10px_28px_rgba(180,160,200,0.22)] backdrop-blur">
      <h2 className="mb-3 text-lg font-extrabold text-[#6b5b74]">🍽️ 어디서 만날까요?</h2>

      <div className="mb-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="가게 이름이나 링크를 적어주세요…"
          maxLength={80}
          className="min-w-0 flex-1 rounded-2xl bg-[#FDFBF7] px-4 py-2.5 text-sm font-semibold text-[#6b5b74] shadow-inner outline-none placeholder:text-[#c8bdd0] focus:shadow-[0_0_0_3px_rgba(255,179,198,0.5)]"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-2xl bg-[#FFD1DC] px-4 py-2.5 text-sm font-extrabold text-[#7A4A56] transition hover:brightness-95 active:scale-95"
        >
          추가
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl bg-[#FDFBF7] py-8 text-center text-sm font-semibold text-[#c1b6cd]">
          아직 후보가 없어요. 첫 장소를 추천해 주세요! 🥢
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((v, i) => {
            const count = counts[v.id] ?? 0
            const voted = mine.has(v.id)
            return (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-2xl p-3 shadow-[0_3px_10px_rgba(180,160,200,0.18)]"
                style={{ backgroundColor: CARD_TINTS[i % CARD_TINTS.length] + '99' }}
              >
                <div className="min-w-0 flex-1">
                  {looksLikeUrl(v.name) ? (
                    <a
                      href={v.name.startsWith('http') ? v.name : `https://${v.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-extrabold text-[#5b7bd6] underline decoration-dotted"
                    >
                      🔗 {v.name}
                    </a>
                  ) : (
                    <div className="truncate text-sm font-extrabold text-[#6b5b74]">
                      {v.name}
                    </div>
                  )}
                  <div className="truncate text-[11px] font-semibold text-[#a99bb5]">
                    {v.created_by} 님 추천
                  </div>
                </div>

                <button
                  onClick={() => onToggleVote(v.id)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-extrabold transition active:scale-90 ${
                    voted
                      ? 'bg-[#FF8FA3] text-white shadow'
                      : 'bg-white/80 text-[#e2607a] hover:bg-white'
                  }`}
                >
                  {voted ? '❤️' : '🤍'} {count}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
