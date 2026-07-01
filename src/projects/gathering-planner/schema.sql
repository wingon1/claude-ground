-- 🍱 회식 다이어리 (Cozy Gathering Planner) — Supabase 셋업
-- ---------------------------------------------------------------------------
-- 사용법:
--   1) https://supabase.com 에서 무료 프로젝트 생성
--   2) Project → SQL Editor 에 이 파일 전체를 붙여넣고 Run
--   3) Project → Settings → API 에서 Project URL 과 anon public key 복사
--   4) GitHub repo → Settings → Secrets and variables → Actions 에 추가:
--        VITE_SUPABASE_URL       = <Project URL>
--        VITE_SUPABASE_ANON_KEY  = <anon public key>
--      (로컬 개발은 프로젝트 루트 .env / .env.local 에 같은 키를 넣으면 됨)
--   * 이 앱은 Supabase 전용입니다. 키가 없으면 로컬로 폴백하지 않고 연결 설정
--     안내 화면을 띄웁니다.
-- ---------------------------------------------------------------------------

-- 방(모임) --------------------------------------------------------------------
-- id = 공유 URL 에 들어가는 짧은 코드. candidate_dates = 투표 대상 후보 날짜들.
-- doodle_snapshot = 낙서 캔버스의 주기적 PNG 스냅샷(늦게 들어온 사람용).
create table if not exists public.gathering_rooms (
  id              text        primary key,
  name            text        not null check (char_length(name) between 1 and 80),
  date_mode       text        not null default 'list'
                    check (date_mode in ('single', 'range', 'list')),
  vote_mode       text        not null default 'multiple'
                    check (vote_mode in ('single', 'multiple')),
  candidate_dates jsonb       not null default '[]'::jsonb,
  doodle_snapshot text,
  created_at      timestamptz not null default now()
);

-- 장소 후보 -----------------------------------------------------------------
create table if not exists public.gathering_venues (
  id          bigint generated always as identity primary key,
  room_id     text        not null references public.gathering_rooms (id) on delete cascade,
  name        text        not null check (char_length(name) between 1 and 200),
  created_by  text        not null default 'anon',
  created_at  timestamptz not null default now()
);

-- 장소 투표(하트). voter = 기기 id 로, (room, venue, voter) 당 1표 토글. ------
create table if not exists public.gathering_venue_votes (
  id         bigint generated always as identity primary key,
  room_id    text        not null references public.gathering_rooms (id) on delete cascade,
  venue_id   bigint      not null references public.gathering_venues (id) on delete cascade,
  voter      text        not null,
  created_at timestamptz not null default now(),
  unique (venue_id, voter)
);

-- 날짜 투표. (room, day, voter) 당 1표. (single 모드는 클라이언트가 강제) -----
-- voter_name = 표시용 닉네임(누가 골랐는지 요약에 사용).
create table if not exists public.gathering_date_votes (
  id         bigint generated always as identity primary key,
  room_id    text        not null references public.gathering_rooms (id) on delete cascade,
  day        date        not null,
  voter      text        not null,
  voter_name text,
  created_at timestamptz not null default now(),
  unique (room_id, day, voter)
);

-- 이미 테이블이 있는 경우를 위한 컬럼 추가(재실행 안전).
alter table public.gathering_date_votes
  add column if not exists voter_name text;

create index if not exists gathering_venues_room_idx
  on public.gathering_venues (room_id);
create index if not exists gathering_venue_votes_room_idx
  on public.gathering_venue_votes (room_id);
create index if not exists gathering_venue_votes_venue_idx
  on public.gathering_venue_votes (venue_id);
create index if not exists gathering_date_votes_room_idx
  on public.gathering_date_votes (room_id);

-- Row Level Security: 인증 없는 캐주얼 앱이라 공개 read + anon insert/delete 허용.
-- (votes 는 토글을 위해 delete 도, rooms 는 스냅샷 저장을 위해 update 도 필요함)
alter table public.gathering_rooms enable row level security;
alter table public.gathering_venues enable row level security;
alter table public.gathering_venue_votes enable row level security;
alter table public.gathering_date_votes enable row level security;

drop policy if exists "gathering rooms read" on public.gathering_rooms;
create policy "gathering rooms read" on public.gathering_rooms for select using (true);
drop policy if exists "gathering rooms insert" on public.gathering_rooms;
create policy "gathering rooms insert" on public.gathering_rooms for insert with check (true);
drop policy if exists "gathering rooms update" on public.gathering_rooms;
create policy "gathering rooms update" on public.gathering_rooms for update using (true) with check (true);

drop policy if exists "gathering venues read" on public.gathering_venues;
create policy "gathering venues read" on public.gathering_venues for select using (true);
drop policy if exists "gathering venues insert" on public.gathering_venues;
create policy "gathering venues insert" on public.gathering_venues for insert with check (true);

drop policy if exists "gathering vvotes read" on public.gathering_venue_votes;
create policy "gathering vvotes read" on public.gathering_venue_votes for select using (true);
drop policy if exists "gathering vvotes insert" on public.gathering_venue_votes;
create policy "gathering vvotes insert" on public.gathering_venue_votes for insert with check (true);
drop policy if exists "gathering vvotes delete" on public.gathering_venue_votes;
create policy "gathering vvotes delete" on public.gathering_venue_votes for delete using (true);

drop policy if exists "gathering dvotes read" on public.gathering_date_votes;
create policy "gathering dvotes read" on public.gathering_date_votes for select using (true);
drop policy if exists "gathering dvotes insert" on public.gathering_date_votes;
create policy "gathering dvotes insert" on public.gathering_date_votes for insert with check (true);
drop policy if exists "gathering dvotes delete" on public.gathering_date_votes;
create policy "gathering dvotes delete" on public.gathering_date_votes for delete using (true);

-- Realtime(Postgres Changes) 활성화: 방/투표/장소 변경을 모든 클라이언트에 즉시 반영.
-- (Doodle 스트로크와 커서는 Broadcast 채널만 쓰므로 publication 이 필요 없음)
alter publication supabase_realtime add table public.gathering_rooms;
alter publication supabase_realtime add table public.gathering_venues;
alter publication supabase_realtime add table public.gathering_venue_votes;
alter publication supabase_realtime add table public.gathering_date_votes;
