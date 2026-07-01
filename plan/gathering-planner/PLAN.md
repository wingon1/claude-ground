# PLAN — 🍱 Cozy Gathering Planner & Doodle Board (Rooms revision)

Real-time team-gathering planner + shared doodle board. Supabase-only backend
(Postgres + Realtime Postgres Changes for votes, Broadcast for strokes & cursors).

## Rooms model (this revision)
- Base URL (no room code) → host **creates a room**: ① 모임 이름 ② 닉네임 ③ 날짜 설정.
- Date setup (host defines both): candidate dates via **하루 / 기간 / 리스트**, plus
  **투표 방식**(한 개만 / 여러 개).
- After creation → shareable URL `#/p/gathering-planner/<code>`. Joiners open it,
  set their own nickname, and land in the room.
- All data (venues, votes, date-votes, doodle, cursors) scoped per room.
- **Live cursors**: broadcast each user's mouse (normalized 0..1) + nickname label.
- **Doodle persistence**: periodic canvas **snapshot** saved to the room so late
  joiners see the current picture. Strokes stay Broadcast (low latency).
- **"모두지우기"**: commented out (temporarily disabled).

## Aesthetic
- Warm Ivory bg `#FDFBF7`; pastel accents Pink `#FFD1DC`, Mint `#B9F2E5`,
  Yellow `#FFF2B2`, Lavender `#E6E6FA`. Borderless (shadows/color), Jua/Nunito.

## Data model (schema.sql)
- `gathering_rooms(id text pk, name, date_mode, vote_mode, candidate_dates jsonb,
  doodle_snapshot text, created_at)`
- add `room_id text` to venues / venue_votes / date_votes (+ indexes, RLS, update
  policy on rooms for snapshot, publication).

## Files
- `store.ts` — `createRoom`, `fetchRoom`, `getRoomStore(room)` (scoped realtime,
  doodle + cursor broadcast, snapshot load/save). Normalized strokes.
- `components/RoomSetup.tsx` — host wizard (name, nickname, date setup, vote rule).
- `components/JoinRoom.tsx` — nickname gate showing room name + share link.
- `components/Cursors.tsx` — overlay rendering remote cursors + nicknames.
- `components/DoodleBoard.tsx` — normalized strokes, snapshot, cursor send, clear off.
- `components/CalendarVoting.tsx` — candidate-constrained voting; rule from room.
- `index.tsx` — room-code routing (setup / join / room); config error kept.

## Verify
- build + eslint; Playwright screenshots of setup wizard, join screen, room
  (dummy keys → UI renders; cross-client realtime needs real Supabase, noted).
