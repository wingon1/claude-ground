# CLAUDE.md — claude-ground

## 이 레포의 성격

이 레포는 **여러 독립 작업물의 모음**이다.
`src/projects/` 및 `public/projects/` 안에 있는 각 폴더는 완전히 별개의 프로젝트다.

## 신규 작업물 시작 전 반드시 확인

> **경고: 신규 작업물을 만들 때 기존 작업물의 스타일·디자인·로직을 절대 참고하지 말 것.**

- 기존 프로젝트 폴더(`src/projects/`, `public/projects/`)는 **열어보지도 말 것.** 신규 작업물과 무관하다.
- 스타일, 색상, 레이아웃, 애니메이션, 컴포넌트 구조 등 **모든 디자인·구현 결정을 독립적으로** 내려야 한다.
- 기존 작업물에서 패턴을 가져오거나, 유사하게 맞추거나, 통일감을 주려는 시도를 하지 말 것.
- 기존 코드를 수정하거나 공통 로직으로 추출하는 작업은 **명시적으로 요청받은 경우에만** 수행한다.
- 유일하게 참고할 파일은 `src/projects/registry.ts` (등록 방법 확인용) 뿐이다.

## 레포 전체 구조 요약

```
src/projects/<id>/        ← React(TSX) 작업물
public/projects/<id>/     ← 정적(HTML/JS) 작업물
src/projects/registry.ts  ← 갤러리 카드 등록 파일 (공통 인프라)
plan/<id>/PLAN.md         ← plan
plan/<id>/PROGRESS.md     ← plan progress
```

새 작업물 추가 방법은 `README.md` 참고.

## Claude Code Session Rules

### Context Management (Most Important)
- **Never accumulate conversation history unnecessarily.** If a task is complete, treat it as closed.
- When context messages exceed ~20% of the window, summarize prior decisions into a single bullet list and discard the raw exchange.
- Do not repeat or re-explain what was already established earlier in the session.
- Avoid verbose confirmations like "Sure! I'll now..." — execute directly.

### Task Execution
- For simple, clearly scoped tasks (single file, one function, rename, one-line fix): **execute immediately without planning.**
- Only produce a plan when the task spans multiple files or involves architectural decisions.
- Do not ask clarifying questions unless the task is genuinely ambiguous. Make a reasonable assumption and state it inline.
- Prefer diffs or targeted edits over full file rewrites.

### Output Format
- Show only what changed. Never reprint unchanged code.
- Use diff format or clearly marked sections (e.g., `// CHANGED`) for edits.
- Keep explanations to 2–3 lines max unless explicitly asked for more.
- No bullet-point summaries after completing a task. Just finish.

### File Analysis
- When analyzing code, read only the relevant file/function/range — not the entire codebase.
- Do not load files speculatively. Only open what is directly needed for the current task.
- If a file has already been read this session, do not re-read it unless it has changed.

### Context Health Targets
- Messages: keep below 20% of context window → use /compact proactively
- Files/Code: target 40–50%
- Free space: maintain at least 30%
- If free space drops below 20%, run /compact before continuing.

### Session Discipline
- Treat each logical task as a unit. When one task ends and another begins, consider /compact.
- Do not carry forward large code blocks in conversation — reference file paths instead.
- If asked to "remember" something for later in the session, store it as a one-line note, not a paragraph.

### Plan Persistence
- At the start of any multi-step task, write the full plan to PLAN.md
- After each completed step, update PROGRESS.md with:
  - What was done
  - Current state of affected files
  - Next step
- If context is reset, always read PLAN.md and PROGRESS.md first before doing anything
