# Codex Notes - cozy-island

## Start Here

For this project, treat `coyz-island` as `cozy-island`.

Read these files before starting multi-step work:

- `../../../CLAUDE.md`
- `docs/기획서.md`
- `docs/개발플랜.md`
- `../../../plan/cozy-island/PLAN.md`
- `../../../plan/cozy-island/PROGRESS.md`

## Working Rules

1. Keep balance and content data-driven through `data/*.json`.
2. If save shape changes, bump `SAVE_VERSION` in `game/GameState.ts` and update plan/progress docs.
3. Keep rendering in square pixel-dot style; avoid curves and gradients.
4. After each completed plan step, update `../../../plan/cozy-island/PROGRESS.md`.

## Current Next Step

M1 is the priority: implement the mine loop. Start with `data/mineLevels.json` schema confirmation, then add mine state/system/render/UX and save integration.
