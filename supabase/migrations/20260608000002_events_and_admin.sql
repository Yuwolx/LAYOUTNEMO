-- ============================================================
-- LAYOUTNEMO — Events & Admin
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 1. user_profiles 에 email, is_admin 추가
-- ──────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists email    text,
  add column if not exists is_admin boolean not null default false;

-- 신규 유저 트리거: email 도 함께 저장
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;


-- ──────────────────────────────────────────────────────────
-- 2. is_admin 체크 함수 (RLS 재귀 방지용)
-- ──────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select is_admin from public.user_profiles where id = auth.uid()),
    false
  )
$$;


-- ──────────────────────────────────────────────────────────
-- 3. 관리자 RLS 정책 추가
--    기존 "own *" 정책은 유지하고, 관리자용 read-all 추가
-- ──────────────────────────────────────────────────────────
create policy "admin read all profiles" on public.user_profiles
  for select using (public.is_admin());

create policy "admin read all canvases" on public.canvases
  for select using (public.is_admin());

create policy "admin read all blocks" on public.blocks
  for select using (public.is_admin());

create policy "admin read all zones" on public.zones
  for select using (public.is_admin());


-- ──────────────────────────────────────────────────────────
-- 4. events 테이블
-- ──────────────────────────────────────────────────────────
create table public.events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references public.user_profiles(id) on delete set null,
  name       text        not null,
  -- 'block_created' | 'block_deleted' | 'ai_create_used' | 'ai_tidy_used' | 'session_start'
  payload    jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

create index events_user_id_idx    on public.events(user_id);
create index events_name_idx       on public.events(name);
create index events_created_at_idx on public.events(created_at);

alter table public.events enable row level security;

-- 유저: 본인 이벤트 insert만 가능
create policy "insert own events" on public.events
  for insert with check (auth.uid() = user_id);

-- 관리자: 전체 read
create policy "admin read all events" on public.events
  for select using (public.is_admin());


-- ──────────────────────────────────────────────────────────
-- 5. 관리자 설정 방법
--    SQL Editor 에서 아래 실행 (본인 user id 입력):
--
--    UPDATE public.user_profiles
--    SET is_admin = true
--    WHERE email = 'yuwolxx@gmail.com';
-- ──────────────────────────────────────────────────────────
