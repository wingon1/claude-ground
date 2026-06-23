# PROGRESS — Tiny Dew Valley 게임성 교체

## 완료
- [x] 1. 기존 TDV 게임 코드 제거: engine/ ui/ data/(구) types.ts(구) index.tsx(구) styles.css 삭제
- [x] 2. Cozy Island 게임 코드 이식(복사): game/ systems/ render/ audio/ utils/ data/ assets/ content.ts types.ts
- [x] 3. 저장 분리: systems/SaveSystem.ts KEY → 'tiny-dew-valley-save-v1'
- [x] 4. index.tsx 신규 작성 — Cozy Island UI 와이어링 유지, TDV 양피지 팔레트 + monospace 로 재도색
       (UI: panel #f6e9c9 / border #b88a52 / accent #7cae4e, 루트 배경 #1c2a1c)
- [x] 5. registry.ts tiny-dew-valley description 갱신 (마감/신단/NPC 문구 제거, 탭이동·자동작업·취침성장 강조)
- [x] 6. 검증: `tsc -b` 통과(에러 0), `vite build` 성공 (tiny-dew-valley 청크 107KB)

## 현재 상태
- tiny-dew-valley = Cozy Island 게임 루프(탭 이동 + 근접 자동작업 + 스태미나 취침 성장)를
  TDV 양피지/monospace UI 스킨으로 입힌 self-contained 프로젝트.
- 도구·타일경작·물탱크·시간마감(Day28)·고대신단·엔딩·NPC호감도 전부 제거됨.
- 골드+젬, 작물별 밭 구매, 동물, 요리, 건설, 상점, 퀘스트, 광산, 도감 포함.

## 다음 단계 (선택)
- 실제 플레이 테스트(모바일 탭/핀치 줌) 후 밸런스 미세 조정.
- 필요 시 월드 스프라이트를 TDV 고유 톤으로 추가 차별화(현재는 Cozy Island 도트 톤 재사용).
