# 🏝️ 코지 아일랜드 — 진행 기록 (PROGRESS)

> 각 스텝 완료 후: 한 일 / 영향받은 파일 상태 / 다음 스텝 을 갱신한다.

## 현재 상태
- **단계**: M6 1차 sprite sheet 파스텔 스타일 재작업 완료.
- **브랜치**: `codex/cozy-island-pastel-sprites`
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

### 2026-06-23 — 스프라이트시트 파일/로더 생성
- 한 일:
  1. `assets/spritesheet.png` 생성: 1차 대상 초안(player, 홈 건물, 주요 자원, 밀밭, UI 아이콘)을 투명 PNG로 배치.
  2. `assets/spritesheet.json` 생성: 각 sprite id의 rect, anchor, scale, tags 정의.
  3. `render/spriteSheet.ts` 신설: manifest 접근, 이미지 preload, `drawSprite()`, 누락 sprite 경고/fallback 반환.
- 영향받은 파일: `src/projects/cozy-island/assets/spritesheet.png`, `spritesheet.json`, `render/spriteSheet.ts`, `plan/cozy-island/PLAN.md`, `PROGRESS.md`.
- 검증: PNG 육안 확인, `npm run lint -- src/projects/cozy-island` 통과, `spriteSheet.ts` 단독 TypeScript 검사 통과(`vite/client` 타입 포함).

### 2026-06-23 — 홈 구역 sprite sheet 렌더 전환
- 한 일:
  1. `render/sprites.ts`에서 플레이어, 나무, 바위, 덤불, 광석, 텐트, 상점, 요리불, 창고, 광산 입구를 `drawSprite()` 우선 렌더로 전환.
  2. 시트 이미지가 아직 로드되지 않았거나 sprite id가 없으면 기존 코드 도트 렌더로 fallback되도록 유지.
  3. 플레이어 시트 프레임을 더 큰 3px 기준으로 재생성해 화면 내 크기와 발 기준 정렬을 수정.
- 영향받은 파일: `render/sprites.ts`, `assets/spritesheet.png`, `plan/cozy-island/PLAN.md`, `PROGRESS.md`.
- 검증: 모바일 headless Chrome 스크린샷 확인, 누락 sprite 콘솔 경고 없음.

### 2026-06-23 — 1차 sprite sheet 파스텔 스타일 재작업
- 한 일:
  1. 사용자 레퍼런스 이미지 기준으로 1차 sprite sheet를 파스텔 저대비 스타일로 재생성.
  2. 시트 내 무거운 외곽선과 오브젝트 바닥 그림자를 제거하고, 컬러 경계 픽셀과 내부 디테일로 형태를 구분하도록 정리.
  3. 텐트/상점/창고/광산/자원/밀밭 프레임을 키워 더 많은 픽셀로 세부 묘사를 추가.
  4. `building.shop.lv1`을 160x96으로 확대해 `building.tent.lv1`(80x88)보다 2배 이상 큰 시각적 면적으로 조정.
  5. 시트 로딩 중에는 기존 코드 fallback이 잠깐 보이지 않도록 `drawSprite()`의 로딩 반환 경로를 조정.
- 영향받은 파일: `src/projects/cozy-island/assets/spritesheet.png`, `spritesheet.json`, `render/spriteSheet.ts`, `docs/spritesheet-inventory.md`, `src/projects/cozy-island/AGENTS.md`, `plan/cozy-island/PLAN.md`, `PROGRESS.md`.
- 검증: 모바일 headless Chrome 스크린샷으로 홈 구역 상점/텐트/플레이어 렌더 확인, sprite 관련 콘솔 경고 없음. `npm run lint -- src/projects/cozy-island` 통과, 단독 TypeScript 검사 통과. 전체 `npm run build`는 기존 `src/projects/shikaku` 타입/의존성 오류로 실패.

## 다음 스텝
- [ ] 밭/동물/광산 내부 sprite sheet 제작 및 렌더 전환.
- [ ] 전체 `npm run build` 실패 원인인 `src/projects/shikaku` 기존 타입 오류를 별도 처리.
