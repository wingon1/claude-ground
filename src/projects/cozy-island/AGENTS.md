# Codex Notes - cozy-island

## Start Here

For this project, treat `coyz-island` as `cozy-island`.

Read these files before starting multi-step work:

- `../../../CLAUDE.md`
- `docs/기획서.md`
- `docs/개발플랜.md`
- `docs/spritesheet-inventory.md`
- `../../../plan/cozy-island/PLAN.md`
- `../../../plan/cozy-island/PROGRESS.md`

## Working Rules

1. Keep balance and content data-driven through `data/*.json`.
2. If save shape changes, bump `SAVE_VERSION` in `game/GameState.ts` and update plan/progress docs.
3. Keep rendering in square pixel-dot style; avoid curves and gradients.
4. After each completed plan step, update `../../../plan/cozy-island/PROGRESS.md`.
5. Prefer sprite-sheet assets for visible world objects and UI icons. If an implementation needs a visible object that is not in the sprite sheet yet, create or extend the sprite sheet and manifest first, then use it from code. Do not add new one-off code-drawn sprites unless it is a temporary fallback explicitly documented in `plan/cozy-island/PROGRESS.md`.

## Current Next Step

Move world art to a sprite-sheet pipeline: define the full required asset inventory, create `assets/spritesheet.png` and `assets/spritesheet.json`, add a loader/renderer, then replace code-drawn sprites in priority order.
