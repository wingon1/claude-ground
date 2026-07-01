import { useMemo, useState } from 'react'
import type { Venue, VenueVote } from '../store'

type Props = {
  venues: Venue[]
  venueVotes: VenueVote[]
  voter: string
  onAdd: (name: string) => void
  onDelete: (venueId: string) => void
  onToggleVote: (venueId: string) => void
}

const CARD_TINTS = ['#FFD1DC', '#B9F2E5', '#FFF2B2', '#E6E6FA']

function looksLikeUrl(s: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(s.trim())
}

function href(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`
}

/**
 * A pasted map share (e.g. Naver) looks like:
 *   [네이버지도]
 *   가게 이름
 *   주소 …
 *   https://naver.me/xxxx
 * Parse it into { title, address, url } so it renders nicely. Returns null for a
 * plain single-line entry.
 */
function parseVenue(raw: string): { title: string; address: string; url: string | null } | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length <= 1) return null
  const url = lines.find((l) => looksLikeUrl(l)) ?? null
  const info = lines.filter((l) => l !== url && !/^\[.*\]$/.test(l))
  if (info.length === 0) return null
  return { title: info[0], address: info.slice(1).join(' '), url }
}

export default function VenueVoting({
  venues,
  venueVotes,
  voter,
  onAdd,
  onDelete,
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
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="가게 이름·링크, 또는 지도 공유를 붙여넣기…"
          maxLength={200}
          rows={2}
          className="min-w-0 flex-1 resize-none rounded-2xl bg-[#FDFBF7] px-4 py-2.5 text-sm font-semibold text-[#6b5b74] shadow-inner outline-none placeholder:text-[#c8bdd0] focus:shadow-[0_0_0_3px_rgba(255,179,198,0.5)]"
        />
        <button
          onClick={submit}
          className="shrink-0 self-stretch rounded-2xl bg-[#FFD1DC] px-4 text-sm font-extrabold text-[#7A4A56] transition hover:brightness-95 active:scale-95"
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
            const parsed = parseVenue(v.name)
            return (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-2xl p-3 shadow-[0_3px_10px_rgba(180,160,200,0.18)]"
                style={{ backgroundColor: CARD_TINTS[i % CARD_TINTS.length] + '99' }}
              >
                <div className="min-w-0 flex-1">
                  {parsed ? (
                    <>
                      <div className="truncate text-sm font-extrabold text-[#6b5b74]">
                        {parsed.title}
                      </div>
                      {parsed.address && (
                        <div className="truncate text-[11px] font-semibold text-[#8a7f96]">
                          {parsed.address}
                        </div>
                      )}
                      {parsed.url && (
                        <a
                          href={href(parsed.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-[11px] font-extrabold text-[#5b7bd6] underline decoration-dotted"
                        >
                          🔗 지도 열기
                        </a>
                      )}
                    </>
                  ) : looksLikeUrl(v.name) ? (
                    <a
                      href={href(v.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-extrabold text-[#5b7bd6] underline decoration-dotted"
                    >
                      🔗 {v.name}
                    </a>
                  ) : (
                    <div className="truncate text-sm font-extrabold text-[#6b5b74]">{v.name}</div>
                  )}
                  <div className="truncate text-[11px] font-semibold text-[#a99bb5]">
                    {v.created_by} 님 추천
                  </div>
                </div>

                <button
                  onClick={() => onToggleVote(v.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-extrabold transition active:scale-90 ${
                    voted
                      ? 'bg-[#FF8FA3] text-white shadow'
                      : 'bg-white/80 text-[#e2607a] hover:bg-white'
                  }`}
                >
                  {voted ? '❤️' : '🤍'} {count}
                </button>
                <button
                  onClick={() => {
                    if (confirm('이 장소를 삭제할까요?')) onDelete(v.id)
                  }}
                  title="삭제"
                  aria-label="삭제"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/60 text-xs font-extrabold text-[#b3a8bf] transition hover:bg-white hover:text-[#e2607a] active:scale-90"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
