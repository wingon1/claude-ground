# 초기 프롬프트

> this is new project
> You can refer to the use of Supabase in the Mole Sudoku project, if applicable.

## 🍱 Complete, Polished Real-Time "Cute Gathering Planner & Doodle Board" Web App (Supabase Edition)

팀 회식/모임 계획을 위한, 실시간 협업이 되는 완성형 미니 SaaS. 날짜/장소 투표
시스템과 실시간 공유 낙서 보드를 귀엽고 다이어리 같은 감성으로 결합한다.

- **Vibe:** 공유 디지털 스크랩북 / 귀여운 다이어리.
- **Palette:** Ivory `#FDFBF7`, Pink `#FFD1DC`, Mint `#B9F2E5`, Yellow `#FFF2B2`, Lavender `#E6E6FA`.
- **Stack:** React + Vite + TailwindCSS, 백엔드는 **Supabase 전용**
  (Postgres + Realtime Postgres Changes for 투표, Broadcast for 낙서 스트로크).
- **Layout:** 데스크톱 좌 60% 낙서보드 / 우 40% 플래너, 모바일은 세로 스택.
- **Zero-auth:** 익명 닉네임(localStorage) + 기기 id 를 투표 키로 사용.
