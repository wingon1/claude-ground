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
6. Sprite art style is pastel, detailed, and low-contrast: no heavy outlines, no fake drop shadows under sprites, and no mixed outline/no-outline treatment. Use colored edge pixels and interior detail to separate forms. Keep the shop at least twice the visual footprint of the tent.

## Current Next Step

Extend sprite-sheet coverage to crops, animals, mine interior, and remaining visible objects before wiring new code paths.
