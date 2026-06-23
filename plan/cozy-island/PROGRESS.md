# 🏝️ 코지 아일랜드 — 진행 기록 (PROGRESS)

> 각 스텝 완료 후: 한 일 / 영향받은 파일 상태 / 다음 스텝 을 갱신한다.

## 현재 상태
- **단계**: Codex 작업 준비 완료. M1(광산 본구현) 착수 전.
- **브랜치**: `main` (origin/main fast-forward 완료)
- **저장 버전**: `SAVE_VERSION = 6`

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

## 다음 스텝
- [ ] 실기기 시각 확인 후 미세 조정 (자연물 밀도/게이트 위치 등).
- [ ] M1-1: `data/mineLevels.json` 스키마 확정 (층별 광석 가중치·채광 비용·하강 조건).
