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

## Next
- Optional: wire real Supabase keys via GitHub Actions secrets to enable
  cross-device realtime (app already falls back to local mode without them).
