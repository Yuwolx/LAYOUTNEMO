-- ============================================================
-- LAYOUTNEMO — Initial Schema
-- ============================================================
-- 실행 위치: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- 0. 공통 updated_at 자동 갱신 트리거 함수
-- ──────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ──────────────────────────────────────────────────────────
-- 1. user_profiles
--    auth.users 와 1:1. 구독 플랜 / AI 사용량 관리.
-- ──────────────────────────────────────────────────────────
create table public.user_profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  plan                 text        not null default 'free',
  -- AI 블록 생성 월 사용량 (무료 플랜 제한용)
  ai_create_used       int         not null default 0,
  ai_create_reset_at   timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  -- 확장 여지: stripe_customer_id, trial_ends_at 등
  metadata             jsonb       not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint user_profiles_plan_check check (plan in ('free', 'pro'))
);

create trigger set_updated_at_user_profiles
  before update on public.user_profiles
  for each row execute function public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 2. canvases
--    유저별 캔버스 목록. 무료=1개 제한은 앱 레이어에서 처리.
-- ──────────────────────────────────────────────────────────
create table public.canvases (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.user_profiles(id) on delete cascade,
  name        text        not null default '내 캔버스',
  position    int         not null default 0,  -- 탭 순서
  -- 확장 여지: is_archived, shared_with, thumbnail_url 등
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index canvases_user_id_idx on public.canvases(user_id);

create trigger set_updated_at_canvases
  before update on public.canvases
  for each row execute function public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 3. zones  (결 / Facet)
-- ──────────────────────────────────────────────────────────
create table public.zones (
  id          uuid        primary key default gen_random_uuid(),
  canvas_id   uuid        not null references public.canvases(id) on delete cascade,
  user_id     uuid        not null references public.user_profiles(id) on delete cascade,
  label       text        not null,
  color       text        not null default 'rgba(148,163,184,0.15)',
  position    int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index zones_canvas_id_idx on public.zones(canvas_id);
create index zones_user_id_idx   on public.zones(user_id);

create trigger set_updated_at_zones
  before update on public.zones
  for each row execute function public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 4. blocks  (작업 블럭)
-- ──────────────────────────────────────────────────────────
create table public.blocks (
  id           uuid        primary key default gen_random_uuid(),
  canvas_id    uuid        not null references public.canvases(id) on delete cascade,
  user_id      uuid        not null references public.user_profiles(id) on delete cascade,
  zone_id      uuid        references public.zones(id) on delete set null,

  -- 콘텐츠
  title        text        not null,
  description  text,
  notes        text,

  -- 캔버스 위치 / 크기
  x            float       not null default 0,
  y            float       not null default 0,
  width        float       not null default 280,
  height       float       not null default 116,

  -- 상태
  urgency      text        not null default 'thinking',
  due_date     date,
  url          text,
  related_to   uuid[]      not null default '{}',  -- 연결된 블럭 ID 배열

  -- 플래그
  is_guide      bool        not null default false,
  is_completed  bool        not null default false,
  is_deleted    bool        not null default false,
  deleted_at    timestamptz,

  -- 확장 여지: tags text[], ai_generated bool, source_url 등
  metadata      jsonb       not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint blocks_urgency_check check (urgency in ('stable', 'thinking', 'lingering', 'urgent'))
);

create index blocks_canvas_id_idx  on public.blocks(canvas_id);
create index blocks_user_id_idx    on public.blocks(user_id);
create index blocks_zone_id_idx    on public.blocks(zone_id);
create index blocks_urgency_idx    on public.blocks(urgency);
create index blocks_is_deleted_idx on public.blocks(is_deleted);

create trigger set_updated_at_blocks
  before update on public.blocks
  for each row execute function public.set_updated_at();


-- ──────────────────────────────────────────────────────────
-- 5. Row Level Security (RLS)
--    모든 테이블: 본인 데이터만 접근 가능
-- ──────────────────────────────────────────────────────────
alter table public.user_profiles enable row level security;
alter table public.canvases      enable row level security;
alter table public.zones         enable row level security;
alter table public.blocks        enable row level security;

-- user_profiles
create policy "own profile" on public.user_profiles
  for all using (auth.uid() = id);

-- canvases
create policy "own canvases" on public.canvases
  for all using (auth.uid() = user_id);

-- zones
create policy "own zones" on public.zones
  for all using (auth.uid() = user_id);

-- blocks
create policy "own blocks" on public.blocks
  for all using (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────
-- 6. 신규 유저 자동 프로필 생성 트리거
--    Google 로그인 완료 → auth.users insert → user_profiles 자동 생성
-- ──────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
