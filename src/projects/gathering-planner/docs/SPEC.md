# 기획서 — 🍱 회식 다이어리 (Gathering Planner & Doodle Board)

## 목적
팀 회식/모임을 정할 때 "언제/어디서"를 함께 투표하고, 옆에서 낙서로 분위기를
띄우는 실시간 협업 보드.

## 화면 구성
- **헤더:** 타이틀, 연결 상태 배지(실시간/로컬), 내 닉네임.
- **낙서 보드 (좌 60%):** 흰 스케치 종이 캔버스 + 플로팅 툴바
  (Pen / Eraser / Clear All / 5색 팔레트: Red·Blue·Green·Yellow·Black).
- **플래너 (우 40%):**
  - **날짜 투표:** 월간 달력, `하나만/여러개` 토글, 표수만큼 진해지는 파스텔
    히트맵과 ❤️배지, 내가 고른 날은 핑크 테두리.
  - **장소 투표:** 입력창+추가 버튼, 둥근 카드 리스트, 하트 업보트/카운트,
    링크는 자동으로 클릭 가능하게 렌더.
- 모바일에서는 플래너가 위, 낙서 보드가 아래로 세로 스택.

## 실시간 동기화
- **투표/장소:** Supabase Postgres Changes 로 모든 클라이언트에 즉시 반영.
- **낙서:** Supabase Broadcast 채널(`gathering_doodle`)로 스트로크
  `{x0,y0,x1,y1,color,size}` 를 저지연 전송(디스크에 픽셀을 쓰지 않음).
- 키가 없으면 **로컬 모드**로 자동 폴백: localStorage + BroadcastChannel 로
  같은 브라우저의 탭들끼리 동기화되어 오프라인에서도 완전 동작.

## 데이터 모델
- `gathering_venues(id, name, created_by, created_at)`
- `gathering_venue_votes(id, venue_id, voter, created_at)` — unique(venue_id, voter)
- `gathering_date_votes(id, day, voter, created_at)` — unique(day, voter)
- `voter` = 기기 id(uuid, localStorage). 표는 토글/중복 제거의 키.

## 규칙
- **하나만(single):** 새 날짜를 고르면 내 기존 날짜 표는 제거되고 하나만 유지.
  여러개→하나만 전환 시 내 표가 여러 개면 마지막 하나만 남김.
- **여러개(multiple):** 가능한 날을 모두 선택.
- 같은 항목을 다시 누르면 표 취소(토글).

## 아키텍처
- `index.tsx` (App), `components/{DoodleBoard,CalendarVoting,VenueVoting}.tsx`,
  `store.ts`(2-백엔드 데이터 레이어), `supabaseClient.ts`, `identity.ts`,
  `schema.sql`(테이블·RLS·publication).
- 상태는 React hooks + store 구독. 낙서는 브라우저 pointer + coalesced events 로
  빠른 스트로크도 매끄럽게.
