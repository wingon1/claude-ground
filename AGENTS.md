# Codex Notes - claude-ground

## Repository Scope

This repository contains multiple independent projects. Before working, read `CLAUDE.md`; its repository rules also apply to Codex.

Each folder under `src/projects/` or `public/projects/` is an independent project. Do not inspect or copy patterns from unrelated project folders. Use `src/projects/registry.ts` only when registration context is needed.

## Project Plans

For project-specific work, look for the nearest `AGENTS.md` inside that project directory and the matching plan files under `plan/<project-id>/`.

After each completed step in a multi-step task, update the relevant `plan/<project-id>/PROGRESS.md`.

Run `npm run build` and `npm run lint` before finishing implementation work when code changes are made.
