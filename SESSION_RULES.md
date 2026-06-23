# Claude Code Session Rules

## Context Management (Most Important)
- **Never accumulate conversation history unnecessarily.** If a task is complete, treat it as closed.
- When context messages exceed ~20% of the window, summarize prior decisions into a single bullet list and discard the raw exchange.
- Do not repeat or re-explain what was already established earlier in the session.
- Avoid verbose confirmations like "Sure! I'll now..." — execute directly.

## Task Execution
- For simple, clearly scoped tasks (single file, one function, rename, one-line fix): **execute immediately without planning.**
- Only produce a plan when the task spans multiple files or involves architectural decisions.
- Do not ask clarifying questions unless the task is genuinely ambiguous. Make a reasonable assumption and state it inline.
- Prefer diffs or targeted edits over full file rewrites.

## Output Format
- Show only what changed. Never reprint unchanged code.
- Use diff format or clearly marked sections (e.g., `// CHANGED`) for edits.
- Keep explanations to 2–3 lines max unless explicitly asked for more.
- No bullet-point summaries after completing a task. Just finish.

## File Analysis
- When analyzing code, read only the relevant file/function/range — not the entire codebase.
- Do not load files speculatively. Only open what is directly needed for the current task.
- If a file has already been read this session, do not re-read it unless it has changed.

## Context Health Targets
- Messages: keep below 20% of context window → use /compact proactively
- Files/Code: target 40–50%
- Free space: maintain at least 30%
- If free space drops below 20%, run /compact before continuing.

## Session Discipline
- Treat each logical task as a unit. When one task ends and another begins, consider /compact.
- Do not carry forward large code blocks in conversation — reference file paths instead.
- If asked to "remember" something for later in the session, store it as a one-line note, not a paragraph.

## Plan Persistence
- At the start of any multi-step task, write the full plan to PLAN.md
- After each completed step, update PROGRESS.md with:
  - What was done
  - Current state of affected files
  - Next step
- If context is reset, always read PLAN.md and PROGRESS.md first before doing anything
