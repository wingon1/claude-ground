# PLAN — Tiny Dew Valley 게임성 교체

목표: TDV의 도트/픽셀 비주얼 정체성(양피지 패널·monospace·픽셀 캔버스)을 유지하면서,
게임 로직을 Cozy Island 루프(탭 이동 + 근접 자동작업 + 스태미나 취침 성장)로 전면 교체.
조작: **탭 이동 + 자동작업 (핫바/도구 제거)** — 권장안 채택.

## 전략
TDV의 엔진은 도구/타일 경작 모델이라 재활용 불가 → Cozy Island의 게임 코드를
TDV 폴더 안으로 **복사(self-contained)** 하고, React 셸만 TDV 스킨으로 재도색.
(레포 규칙상 프로젝트 간 코드 공유 금지 → import가 아닌 복사로 독립성 유지.)

## 단계
1. [기존 제거] TDV의 engine/, ui/, data/, types.ts, index.tsx, styles.css 삭제
2. [게임 이식] cozy-island의 game/ systems/ render/ audio/ utils/ data/ assets/ content.ts types.ts 복사
3. [저장 분리] systems/SaveSystem.ts 의 localStorage KEY → 'tiny-dew-valley-save-v1'
4. [UI 재도색] index.tsx 신규 작성: cozy-island UI 구조 기반 + TDV 팔레트/monospace
   - UI 토큰: panel #f6e9c9 / border #b88a52 / text #4a3422 / accent #7cae4e
   - 루트 배경 #1c2a1c, 폰트 ui-monospace
5. [레지스트리] registry.ts 의 tiny-dew-valley description 갱신 (마감/신단/NPC 문구 제거)
6. [검증] tsc 타입체크 / 빌드

## 비범위
- cozy-island 원본 수정 없음
- 세이브 마이그레이션 없음 (스키마 완전 교체)
