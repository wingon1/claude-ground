# PLAN — 🍱 Cozy Gathering Planner & Doodle Board

Real-time team-dinner (회식) planner + shared doodle board. Supabase backend
(Postgres + Realtime Postgres Changes for votes, Broadcast for strokes), with a
localStorage + BroadcastChannel fallback so it works fully offline in one browser.

## Aesthetic
- Warm Ivory bg `#FDFBF7`; pastel accents Pink `#FFD1DC`, Mint `#B9F2E5`,
  Yellow `#FFF2B2`, Lavender `#E6E6FA`. Rounded-20px, soft shadows, Jua/Nunito.

## Layout
- Desktop split: 60% Doodle Board (left) / 40% Planner sidebar (right).
- Mobile: stacked — planner on top, doodle below.

## Files
- `supabaseClient.ts` — lazy client from `VITE_SUPABASE_URL/ANON_KEY`, null fallback.
- `store.ts` — data layer with two backends behind one interface:
  - Supabase adapter: select all + postgres_changes subscription; broadcast channel for doodle.
  - Local adapter: localStorage state + BroadcastChannel for cross-tab sync.
- `identity.ts` — deviceId (uuid) + nickname in localStorage.
- `index.tsx` — App: nickname gate, split layout, font injection, connection badge.
- `components/DoodleBoard.tsx` — canvas, toolbar (pen/eraser/clear/5 colors), broadcast.
- `components/CalendarVoting.tsx` — monthly calendar, single/multi toggle, heat-map badges.
- `components/VenueVoting.tsx` — add venue, list of cards, heart upvote + counts.
- `schema.sql` — tables, indexes, RLS (public read + anon insert/delete), realtime publication.
- `docs/PROMPT.md` — original prompt; `docs/SPEC.md` — 기획서.

## Data model
- `gathering_venues(id, name, created_by, created_at)`
- `gathering_venue_votes(id, venue_id, voter, created_at)` unique(venue_id, voter)
- `gathering_date_votes(id, day date, voter, created_at)` unique(day, voter)
- Vote counts aggregated client-side (small volume). `voter` = deviceId.

## Realtime
- Postgres Changes on the 3 tables → refetch + notify subscribers.
- Broadcast `gathering_doodle` → stroke segments `{x0,y0,x1,y1,color,size}` + clear.

## Registry
- Add react entry id `gathering-planner`.

## Verify
- `npm run build` (tsc -b + vite) passes. Single/Multi toggle enforces reset in
  single mode. Fast drawing batched via rAF to avoid lag.
