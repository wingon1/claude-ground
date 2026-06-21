-- Shikaku 타임어택 랭킹보드 — Supabase 셋업
-- ---------------------------------------------------------------------------
-- 사용법:
--   1) https://supabase.com 에서 무료 프로젝트 생성
--   2) Project → SQL Editor 에 이 파일 전체를 붙여넣고 Run
--   3) Project → Settings → API 에서 Project URL 과 anon public key 복사
--   4) GitHub repo → Settings → Secrets and variables → Actions 에 추가:
--        VITE_SUPABASE_URL       = <Project URL>
--        VITE_SUPABASE_ANON_KEY  = <anon public key>
--      (로컬 개발은 프로젝트 루트 .env 에 같은 키를 넣으면 됨)
--   * 키가 없으면 게임은 자동으로 '로컬(localStorage) 랭킹'으로 동작함.
-- ---------------------------------------------------------------------------

create table if not exists public.shikaku_scores (
  id            bigint generated always as identity primary key,
  mode          text        not null default 'timeattack',
  tier          text        not null check (tier in ('easy','normal','hard')),
  nickname      text        not null check (char_length(nickname) between 1 and 16),
  score         int         not null check (score >= 0),
  combo_max     int         not null default 0,
  solved_count  int         not null default 0,
  duration_sec  int         not null default 60,
  device_id     text,
  created_at    timestamptz not null default now()
);

-- 랭킹 조회(모드+난이도별 점수 내림차순) 가속
create index if not exists shikaku_scores_rank_idx
  on public.shikaku_scores (mode, tier, score desc);

-- Row Level Security: 누구나 읽기, 검증된 행만 삽입 허용 (수정/삭제는 불가)
alter table public.shikaku_scores enable row level security;

drop policy if exists "shikaku read all" on public.shikaku_scores;
create policy "shikaku read all"
  on public.shikaku_scores for select
  using (true);

drop policy if exists "shikaku insert any" on public.shikaku_scores;
create policy "shikaku insert any"
  on public.shikaku_scores for insert
  with check (char_length(nickname) between 1 and 16 and score >= 0);

-- 참고: 공개 anon 키 특성상 클라이언트가 점수를 위조할 수 있음(캐주얼 게임 허용 범위).
-- 더 엄격히 하려면 Edge Function 으로 점수 검증 후 service-role 로 insert 하도록 확장.
