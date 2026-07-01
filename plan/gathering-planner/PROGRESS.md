# PROGRESS — 🍱 Gathering Planner

## Done
- Scaffolded project under `src/projects/gathering-planner/`.
- `supabaseClient.ts` — lazy client from env, null fallback.
- `identity.ts` — deviceId + nickname in localStorage, per-id pastel colour.
- `store.ts` — one `PlannerStore` interface, two backends:
  - Supabase: select-all + `postgres_changes` subscription; Broadcast channel
    `gathering_doodle` for strokes/clear.
  - Local: localStorage state + `BroadcastChannel` cross-tab sync + doodle bus.
  - Single-choice enforced in `toggleDateVote` (deletes voter's other dates).
- Components: `DoodleBoard` (canvas + toolbar + coalesced-event strokes),
  `CalendarVoting` (month grid, single/multi toggle, pastel heat-map + ❤️ badges),
  `VenueVoting` (add, sorted cards, heart toggle, auto-link).
- `index.tsx` — nickname gate, font injection, 60/40 split (stacks on mobile),
  connection badge (실시간/로컬).
- `schema.sql` — tables + indexes + RLS (public read, anon insert/delete) +
  realtime publication.
- `docs/PROMPT.md`, `docs/SPEC.md`.
- Registered in `registry.ts` (id `gathering-planner`).

## Verified
- `npm install` (deps were missing) → `npm run build` passes (tsc -b + vite).
- `eslint` clean on the project.
- Playwright render (local backend): desktop split + mobile stack both correct;
  doodle stroke draws, venue add works, calendar renders. No page/JS errors.

## Follow-up (revision)
- **Borderless UI:** removed outline `ring-*` borders across cards/inputs/cells;
  sections now read via soft drop-shadows + subtle bg tints. Only kept the ring
  on the selected palette colour; "my date" uses a soft pink glow shadow.
- **Full-screen doodle:** canvas is now a full-viewport layer (z-20) you can draw
  over everything, calendar included. Added a `손`(select) tool that makes the
  canvas click-through so the planner beneath stays usable; `펜/지우개` capture.
  Toolbar floats top-center on desktop, bottom-center on mobile.
- **Supabase-only:** removed the localStorage/BroadcastChannel fallback entirely.
  `getStore()` throws when keys are absent; the app shows a `연결 설정이 필요해요`
  config screen instead of running disconnected.
- Verified: build + eslint clean; Playwright confirms drawing over the calendar
  on desktop & mobile, and the config-error screen when keys are absent.

## Follow-up (rooms revision)
- **Rooms:** base URL → `RoomSetup` wizard (모임 이름 → 닉네임 → 날짜 설정:
  하루/기간/리스트 + 투표 방식). Room persisted in new `gathering_rooms` table;
  shareable link `#/p/gathering-planner/<code>`. Joiners → `JoinRoom` nickname gate.
- **Scoping:** venues/venue_votes/date_votes now carry `room_id`; all queries +
  postgres_changes filtered per room. Broadcast channel `gathering_rt:<room>`.
- **Live cursors:** `Cursors.tsx` broadcasts each user's normalized mouse + nick,
  renders remote pointers, prunes stale (5s).
- **Doodle persistence:** normalized (0..1) strokes; periodic PNG snapshot saved to
  the room row so late joiners load the current picture. Eraser = destination-out
  (transparent) since the canvas overlays the UI.
- **Clear All:** commented out (temporarily disabled) per request.
- **Supabase-only** error screen kept; no local fallback.
- Verified: build + eslint clean; Playwright (Supabase REST mocked) confirms the
  setup wizard, join screen, and room view (desktop + mobile) with drawing over
  the calendar. Cross-client realtime/cursors need a real Supabase instance.

## Follow-up 2 (UX polish)
- **하단 요약(DateSummary):** 참가자별로 고른 날짜를 칩으로 요약. 이를 위해
  `gathering_date_votes.voter_name` 컬럼 추가(스키마 `add column if not exists`),
  `toggleDateVote(day, voter, name)` 로 닉네임 기록.
- **모바일 팔레트 가로 배치:** 툴바를 한 줄(`flex-nowrap`)로, 모바일은 툴 이모지를
  숨겨 5색 팔레트가 한 줄에 다 보이도록.
- **툴 라벨 명확화:** 손→조작, 펜→그리기 (+툴팁 설명).
- **공휴일 제외:** `holidays.ts`(2026~2027 정적 표) + RoomSetup 토글(기본 ON).
  켜면 후보에서 공휴일 제외 + 달력 취소선.
- Verified: build + eslint clean; Playwright(REST mock)로 공휴일 취소선, 하단 요약,
  새 툴 라벨, 모바일 팔레트 가로 표시 확인.
- ⚠️ 기존 Supabase DB 는 `alter table public.gathering_date_votes add column if not
  exists voter_name text;` 를 한 번 실행해야 요약 이름이 저장됨.

## Follow-up 3 (presence)
- **접속자 표시:** Supabase Realtime **Presence** 를 방 채널에 추가. 각 클라이언트가
  `{id,nick,color}` 를 track, presence sync 로 접속자 목록 갱신.
- `OnlineUsers.tsx` — 헤더에 다른 접속자 닉네임 카드를 겹친 스택으로 표시(최대 3 + "+N").
  모바일에선 초대링크를 아이콘만 표시해 공간 확보.
- 스키마 변경 없음(Presence 는 DB 미사용). build + eslint clean; 목 데이터로 스택
  스타일 확인 후 실데이터 연결.

## Next
- Optional: wire real Supabase keys via GitHub Actions secrets to enable
  cross-device realtime (app already falls back to local mode without them).
