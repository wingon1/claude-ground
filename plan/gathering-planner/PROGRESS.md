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

## Next
- Optional: wire real Supabase keys via GitHub Actions secrets to enable
  cross-device realtime (app already falls back to local mode without them).
