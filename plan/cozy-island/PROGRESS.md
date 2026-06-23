# 🏝️ 코지 아일랜드 — 진행 기록 (PROGRESS)

> 각 스텝 완료 후: 한 일 / 영향받은 파일 상태 / 다음 스텝 을 갱신한다.

## 현재 상태
- **단계**: M1(광산 본구현) 구현 완료, 검증 중.
- **브랜치**: `codex/cozy-island-mine-loop`
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

## 다음 스텝
- [ ] 실기기/브라우저에서 광산 루프 시각 확인.
- [ ] M2: 던전 플레이 루프 또는 M4: 밸런스 패스 착수.
