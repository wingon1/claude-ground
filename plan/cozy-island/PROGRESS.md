# 🏝️ 코지 아일랜드 — 진행 기록 (PROGRESS)

> 각 스텝 완료 후: 한 일 / 영향받은 파일 상태 / 다음 스텝 을 갱신한다.

## 현재 상태
- **단계**: M6 스프라이트시트 파이프라인 계획 수립.
- **브랜치**: `codex/cozy-island-spritesheet-plan`
- **저장 버전**: `SAVE_VERSION = 7`

## 로그

### 2026-06-23 — 플랜 수립
- 한 일: `docs/개발플랜.md`의 예정 후보를 마일스톤(M1~M5)으로 구체화해 `PLAN.md` 작성.
- 영향받은 파일: `plan/cozy-island/PLAN.md`, `plan/cozy-island/PROGRESS.md` 신규 생성.

### 2026-06-23 — UI/그래픽/월드 구조 수정 (사용자 요청 선반영)
- 한 일:
  1. 픽셀 그래픽 퀄리티 업: 나무/바위/덤불 외곽선·음영·이끼·꽃 추가, 잔디 텍스처 개선, 울타리 판자/기둥 디테일, 해변 모래 테두리.
  2. 지역 배치: 텐트(home) **아래**를 기점으로 **시계방향** 나선 확장 (밀→당근→딸기→토마토→감자→닭→소→양봉→광산).
  3. 시작 지역(home) 울타리 제거.
  4. 나무·바위·이끼 등 자연물 = 울타리 **바깥** 열린 땅에만 산포 (forest/quarry 펜 폐기).
  5. 돌바닥(스톤 패스) 제거 → 전체 잔디 + 모래 해안.
  6. 울타리 4면 모두 렌더, 게이트는 home 쪽 1곳.
- 영향받은 파일: `data/worldLayout.json`, `game/layout.ts`, `content.ts`, `render/sprites.ts`,
  `game/Game.ts`, `game/GameState.ts`(SAVE_VERSION 4→5).
- 검증: `npm run build` + eslint 통과. 스파이럴/게이트 배치 수치 검증.

### 2026-06-23 — Codex 작업 준비
- 한 일: `CLAUDE.md`, `README.md`, `cozy-island` 기획서/개발플랜, `plan/cozy-island` 실행 플랜/진행 기록 확인.
- 영향받은 파일: 루트 `AGENTS.md`는 전역 규칙만 담도록 정리, `src/projects/cozy-island/AGENTS.md` 신규 생성, `plan/cozy-island/PLAN.md`와 `PROGRESS.md`의 현재 브랜치/저장 버전 정보 갱신.
- 현재 상태: 프로젝트 ID는 `cozy-island`이며, 사용자가 `coyz-island`라고 말하면 같은 프로젝트로 처리.

### 2026-06-23 — M1 광산 본구현
- 한 일:
  1. `data/mineLevels.json`에 `nodeHp`, `descendRequirement`를 추가하고 3층(수정 갱도)을 확장.
  2. `systems/MineSystem.ts` 신설: 층 설정, 절차적 노드 배치, 채광 드롭, 캔 노드 기록, 하강 조건 처리.
  3. `GameState`에 `mineCurrentFloor`, `mineMinedNodes` 추가, `SAVE_VERSION` 7로 상향.
  4. 광산 노드는 같은 런에서 재스폰하지 않고, 하강 조건 충족 시 안내 토스트 표시.
  5. 하단 메뉴에 "광산" 버튼 추가, 광산 HUD의 "더 깊이" 버튼은 조건 미달 시 탭하면 이유를 토스트로 안내.
- 영향받은 파일: `data/mineLevels.json`, `systems/MineSystem.ts`, `types.ts`, `content.ts`, `game/Game.ts`, `game/GameState.ts`, `index.tsx`.
- 검증: `npm run lint -- src/projects/cozy-island` 통과, `npx tsc --ignoreConfig ... src/projects/cozy-island/index.tsx` 통과. 전체 `npm run build`는 기존 `src/projects/shikaku` 타입 오류로 실패.

### 2026-06-23 — UI/아트 1차 패스
- 한 일:
  1. 홈 구역 기준 아트 바 확립: 나무/텐트/상점/광산 스프라이트를 더 큰 실루엣, 두꺼운 외곽선, 명암 블록 중심으로 교체.
  2. 그림자와 잔디 텍스처 밀도 개선, 해안선/펜 내부 바닥에 블록 레이어 추가.
  3. 하단 메뉴를 핵심 행동 6개(가방/상점/건설/광산/요리/메뉴)로 축소하고 퀘스트/도감/설정은 메뉴 패널로 이동.
  4. 상단 HUD에 첫 활성 퀘스트 진행률을 추가해 다음 행동을 더 명확히 표시.
- 영향받은 파일: `render/sprites.ts`, `game/Game.ts`, `index.tsx`, `src/projects/cozy-island/AGENTS.md`, `plan/cozy-island/PLAN.md`, `PROGRESS.md`.
- 검증: 모바일(390x844)과 데스크톱(900x900) headless Chrome 스크린샷 확인, `npm run lint -- src/projects/cozy-island` 통과, 단독 TypeScript 검사 통과.

### 2026-06-23 — 스프라이트시트 전환 규칙 수립
- 한 일:
  1. 신규 visible object 작업 시, 대상 스프라이트가 없으면 먼저 `spritesheet.png/json`에 추가하고 이후 코드에서 사용하도록 프로젝트 규칙을 추가.
  2. M6 스프라이트시트 파이프라인 마일스톤과 1~3차 제작 대상을 정리.
  3. `docs/spritesheet-inventory.md`에 manifest 규칙과 제작 대상 목록을 추가.
- 영향받은 파일: `src/projects/cozy-island/AGENTS.md`, `src/projects/cozy-island/docs/spritesheet-inventory.md`, `plan/cozy-island/PLAN.md`, `plan/cozy-island/PROGRESS.md`.
- 현재 상태: 아직 실제 sprite sheet 파일/로더는 없음. 다음 단계에서 `assets/`와 `render/spriteSheet.ts`를 만든다.

## 다음 스텝
- [ ] `assets/spritesheet.png`, `assets/spritesheet.json`, `render/spriteSheet.ts` 생성.
- [ ] 홈 구역 핵심 오브젝트부터 sprite sheet 렌더로 전환.
- [ ] 전체 `npm run build` 실패 원인인 `src/projects/shikaku` 기존 타입 오류를 별도 처리.
