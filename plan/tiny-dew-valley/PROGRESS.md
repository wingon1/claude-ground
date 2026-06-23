# PROGRESS — Tiny Dew Valley: 옛 그래픽 유지 + cozy-island 핵심 루프

## 완료
- [x] 이전 "통째 클론" 시도 리버트 (옛 그래픽/엔진/렌더 복구)
- [x] types.ts — GameState 간소화 (tools/npc/shrine/물/시간마감 필드 제거)
- [x] engine/save.ts — SAVE_VERSION 4, 검증 간소화
- [x] engine/world.ts — 밭(soil) 구역 FARM 추가
- [x] data/shopCatalog.ts — 씨앗만 / data의 tools·npcs·shrineBundles·crafting 삭제
- [x] engine/game.ts — 규칙 전면 재작성, **렌더링/스프라이트/월드/조명은 옛 것 그대로 재사용**
      · 탭 이동 + 막히면 자동 정지(stuck 처리)
      · 근접 자동작업(나무/바위/그루터기/잡초/꽃/다 자란 작물) — 도구 없음
      · 밭 위에서 씨앗 자동 심기 → 실시간 성장 → 자동 수확(재생 작물 포함)
      · 나무·바위·그루터기 일정 시간 후 리스폰
      · 스태미나 소모, 침대에서 취침 → 최대치 +1 (시간마감/기절 없음)
      · 상점: 씨앗 구매 + 즉시 판매
- [x] ui/Overlay.tsx — 탭 조작용 HUD/상점/가방/취침/타이틀 (TDV CSS 스킨 재사용)
- [x] index.tsx — 캔버스 탭→이동 핸들러
- [x] registry.ts — 설명 갱신
- [x] 검증: tsc -b 0 에러, vite build 성공 (47.9KB JS / 12KB CSS)

## 현재 상태
- 그래픽/도트/조명/스프라이트 = 원작 Tiny Dew Valley 그대로.
- 플레이 = cozy-island 핵심 루프(탭 이동·근접 자동작업·취침 성장).

## 남은 일 / 검토 필요
- 사용자 플레이테스트 후 밸런스(작물 성장 속도, 스태미나, 리스폰 시간) 미세 조정.
- 머지는 사용자 확인 후 진행(전면 재작성이라 보류).
