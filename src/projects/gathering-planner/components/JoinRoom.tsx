import { useState } from 'react'
import { setNickname } from '../identity'
import type { Room } from '../store'

type Props = {
  room: Room
  onJoin: (nick: string) => void
}

export default function JoinRoom({ room, onJoin }: Props) {
  const [nick, setNick] = useState('')

  function join() {
    const n = nick.trim()
    if (!n) return
    setNickname(n)
    onJoin(n)
  }

  return (
    <div
      className="grid h-full w-full place-items-center bg-[#FDFBF7] p-4 text-[#6b5b74]"
      style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
    >
      <div className="w-[min(92vw,380px)] rounded-[28px] bg-white p-7 text-center shadow-[0_24px_60px_rgba(180,160,200,0.3)]">
        <div className="mb-2 text-4xl">🎈</div>
        <p className="text-xs font-extrabold text-[#b3a8bf]">초대받은 모임</p>
        <h1
          className="mt-1 text-xl font-extrabold"
          style={{ fontFamily: "'Jua', 'Nunito', sans-serif" }}
        >
          {room.name}
        </h1>
        <p className="mt-1 text-xs font-semibold text-[#b3a8bf]">
          후보 날짜 {room.candidateDates.length}일 · {room.voteMode === 'single' ? '한 개만' : '여러 개'} 투표
        </p>

        <input
          autoFocus
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          placeholder="닉네임을 정해주세요"
          maxLength={16}
          className="mt-5 w-full rounded-2xl bg-[#FDFBF7] px-4 py-3 text-center text-base font-extrabold text-[#6b5b74] shadow-inner outline-none placeholder:text-[#c8bdd0] focus:shadow-[0_0_0_3px_rgba(255,179,198,0.5)]"
        />
        <button
          disabled={!nick.trim()}
          onClick={join}
          className="mt-4 w-full rounded-2xl bg-[#FFD1DC] py-3 text-base font-extrabold text-[#7A4A56] shadow-[0_6px_16px_rgba(255,179,198,0.5)] transition enabled:hover:brightness-95 enabled:active:scale-95 disabled:opacity-50 disabled:shadow-none"
        >
          모임 참여하기 ✨
        </button>
      </div>
    </div>
  )
}
