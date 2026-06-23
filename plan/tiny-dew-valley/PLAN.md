# PLAN — Tiny Dew Valley: 옛 그래픽 유지 + cozy-island 핵심 루프 (재시도)

## 결정 사항
- 이전 시도(통째 클론) 리버트 완료. **TDV의 옛 그래픽/엔진/렌더는 그대로 유지.**
- 게임 규칙만 cozy-island 핵심 루프로 교체. 범위 = **핵심 루프만** (사용자 선택).

## 유지 (그래픽/렌더)
- engine/sprites.ts, engine/world.ts(맵), engine/audio.ts, styles.css 스킨, 절차적 도트 스프라이트, 카메라/파티클/조명(주야 앰비언스는 그래픽으로 유지).

## 교체 (규칙 → cozy-island 핵심)
- 탭 이동: 화면 탭 → 그 지점으로 걸어감 (WASD는 데스크톱 보조).
- 근접 자동작업: 나무·바위·그루터기·잡초·꽃·다 자란 작물 옆에서 멈추면 자동으로 채집/수확 (도구 선택 없음). 스태미나 소모.
- 작물: 밭(soil) 위에서 멈추면 보유 씨앗 자동 심기 → 실시간(초) 성장 → 다 자라면 근접 자동 수확. 물주기 없음.
- 스태미나/취침: 취침 시 최대치 +1, 스태미나 가득. **시간 마감/기절/요일 압박 없음.** (주야 조명은 앰비언스로만)
- 상점: 씨앗 구매 + 아이템 즉시 판매. (도구 업글·출하정산 제거)

## 제거
- 도구/핫바/물뿌리개, 신단/엔딩/마감, NPC 호감도·선물·대화, 제작 작업대/공방, 스프링클러/비료/품질, 출하함/정산.

## 작업 파일
1. types.ts — GameState 간소화
2. engine/save.ts — SAVE_VERSION 상향, 검증 간소화
3. engine/world.ts — 밭(soil) 구역 추가 (FARM)
4. data/shopCatalog.ts — 씨앗만
5. engine/game.ts — 규칙 재작성(렌더 재사용)
6. ui/Overlay.tsx — 탭 조작/HUD/상점/가방/취침/타이틀 재작성
7. index.tsx — 캔버스 탭 핸들러 추가
8. data/{tools,npcs,shrineBundles,crafting}.ts 삭제

## 검증
- tsc -b 0 에러, vite build 성공.
