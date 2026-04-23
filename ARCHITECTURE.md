# 🏛 ARCHITECTURE — LAYOUTNEMO v2 설계 문서

> 멀티 기기 동기화를 위한 서버 전환 설계.
> **Vercel + Supabase** 스택으로 진행하며 EC2는 사용하지 않음.
> 블로그 배포 제외 (`_config.yml` 의 `exclude` 에 포함).

---

## 🎯 목표

1. **소셜 로그인 + 멀티 기기 동기화** — 노션처럼 아무 웹에서나 접속해 내 블럭/결 보기
2. **게스트 사용 유지** — 로그인 없이도 localStorage 로 바로 사용 가능 (현재 경험 보존)
3. **Vercel 배포 유지** — EC2 도입 없이 가능한 범위에서 설계
4. **AI 엔드포인트 유지** — 별도 AI 서버 분리 불필요

---

## 🏗 전체 스택 결정

### 선택

```
Browser
  ├─ Next.js 16 (UI)
  └─ @supabase/supabase-js (인증, 읽기, 실시간 구독)
       ↓
Vercel
  ├─ Next.js App Router (SSR / Static)
  ├─ API Routes
  │    ├─ /api/ai/create-block      (유지)
  │    └─ /api/ai/tidy-comprehensive (유지)
  └─ Server Actions
       └─ 블럭 / 캔버스 / 결 CRUD
            ↓ (service_role key 로 서버 측 호출)
Supabase
  ├─ Auth         : 이미 활성 (Google OAuth)
  ├─ Postgres     : canvases, zones, blocks, block_relations, ai_usage
  ├─ Realtime     : 다른 기기/탭 변경 푸시
  └─ Row-Level Security (RLS)
            ↑
OpenAI (외부)
  └─ gpt-4o-mini
```

### EC2 도입 시점 (지금 아님)

- Vercel Function 동시성 한도에 부딪힐 때 (동접 수천 명 규모)
- 자체 ML 모델을 Python 서버로 호스팅할 때
- 1분 이상의 백그라운드 작업 필요 시 (Vercel 10초 제한)

**현 단계에선 Vercel + Supabase 로 충분.**

---

## 🗄 데이터베이스 ERD

### 테이블 개요

| 테이블 | 설명 |
|--------|------|
| `auth.users` | Supabase 제공. 건드리지 않음. |
| `public.canvases` | 캔버스 (유저당 N개) |
| `public.zones` | 결(Facet) — 캔버스 종속 |
| `public.blocks` | 블럭 |
| `public.block_relations` | 블럭 간 관계선 (m:n) |
| `public.entitlements` | 유저별 플랜 / 리소스 한도 / 크레딧 (과금 hook) |
| `public.ai_consumption_log` | AI 호출 이력 (rate limit + 종량제 과금) |

### 관계

```
auth.users 1 ─── ∞ canvases
canvases   1 ─── ∞ zones
canvases   1 ─── ∞ blocks
zones      1 ─── ∞ blocks          (nullable, zone 삭제 시 SET NULL)
blocks     m ─── n block_relations  (m:n)
auth.users 1 ─── 1 entitlements
auth.users 1 ─── ∞ ai_consumption_log
```

### 전체 DDL

```sql
-- ──────────────────────────────────────────
-- 1. canvases
-- ──────────────────────────────────────────
create table public.canvases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default '메인 캔버스',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                    -- soft delete (휴지통)
  is_public  boolean not null default false, -- 공유 hook (이번 범위에선 비활성)
  share_token text                           -- 공유 hook (이번 범위에선 비활성)
);
create index canvases_user_idx
  on public.canvases(user_id)
  where deleted_at is null;

-- ──────────────────────────────────────────
-- 2. zones (결 / Facet)
--    캔버스 단위 독립 (현재 구현 유지)
--    캔버스 생성 시 기본 결 5개 자동 시드 (트리거로 처리)
-- ──────────────────────────────────────────
create table public.zones (
  id         uuid primary key default gen_random_uuid(),
  canvas_id  uuid not null references public.canvases(id) on delete cascade,
  label      text not null,
  color      text not null,
  "order"    int not null default 0,
  is_preset  boolean not null default false,   -- 기본 시드 여부
  created_at timestamptz not null default now()
);
create index zones_canvas_idx on public.zones(canvas_id);

-- 기본 결 시드 트리거
create or replace function public.seed_default_zones()
returns trigger
language plpgsql
as $$
begin
  insert into public.zones (canvas_id, label, color, "order", is_preset) values
    (new.id, '기획',     '#6366F1', 1, true),   -- 인디고
    (new.id, '개발',     '#10B981', 2, true),   -- 에메랄드
    (new.id, '디자인',   '#EC4899', 3, true),   -- 핑크
    (new.id, '마케팅',   '#F59E0B', 4, true),   -- 앰버
    (new.id, '일상',     '#64748B', 5, true);   -- 슬레이트
  return new;
end;
$$;

create trigger canvases_seed_zones
  after insert on public.canvases
  for each row
  execute function public.seed_default_zones();

-- ──────────────────────────────────────────
-- 3. blocks
-- ──────────────────────────────────────────
create table public.blocks (
  id             uuid primary key default gen_random_uuid(),
  canvas_id      uuid not null references public.canvases(id) on delete cascade,
  zone_id        uuid references public.zones(id) on delete set null,

  title          text not null,
  description    text,
  detailed_notes text,

  x              int not null default 0,
  y              int not null default 0,
  width          int not null default 360,
  height         int not null default 120,

  urgency        text not null default 'stable'
                  check (urgency in ('stable','thinking','lingering','urgent')),
  due_date       date,

  is_guide       boolean not null default false,

  completed_at   timestamptz,   -- NULL = 미완료
  deleted_at     timestamptz,   -- NULL = 미삭제 (휴지통)

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index blocks_canvas_idx on public.blocks(canvas_id) where deleted_at is null;
create index blocks_zone_idx   on public.blocks(zone_id);

-- ──────────────────────────────────────────
-- 4. block_relations (관계선)
--    무방향 엣지. (a.id < b.id) 제약으로 중복 방지.
-- ──────────────────────────────────────────
create table public.block_relations (
  block_a_id uuid not null references public.blocks(id) on delete cascade,
  block_b_id uuid not null references public.blocks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (block_a_id, block_b_id),
  check (block_a_id < block_b_id)
);
create index relations_a_idx on public.block_relations(block_a_id);
create index relations_b_idx on public.block_relations(block_b_id);

-- ──────────────────────────────────────────
-- 5. entitlements (유저별 권한 / 리소스 한도)
--    결제 시스템 붙기 전까지 모든 유저는 기본값(프리).
--    프리 = AI 비활성 + 캔버스 1개.
-- ──────────────────────────────────────────
create table public.entitlements (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  plan           text not null default 'free'
                  check (plan in ('free','credit','subscription','admin')),
  canvas_limit   int  not null default 1,        -- 프리: 1, 구독: 많이, 어드민: 무제한
  ai_enabled     boolean not null default false, -- 프리는 false
  credits        int  not null default 0,        -- 종량제 토큰 잔액
  subscription_expires_at timestamptz,           -- 구독 만료 (향후 결제 붙으면 채움)
  updated_at     timestamptz not null default now()
);

-- 신규 가입 시 기본 row 자동 생성 트리거
create or replace function public.init_entitlements()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.entitlements (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.init_entitlements();

-- ──────────────────────────────────────────
-- 6. ai_consumption_log (AI 사용 이력)
--    rate limit 계산 + 종량제 과금 추적용.
-- ──────────────────────────────────────────
create table public.ai_consumption_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,    -- 'create-block' / 'tidy-comprehensive'
  tokens_used int,              -- OpenAI 응답의 usage.total_tokens
  credits_used int  not null default 1,  -- 종량제 차감 단위
  created_at  timestamptz not null default now()
);
create index ai_log_user_time_idx on public.ai_consumption_log(user_id, created_at desc);
```

### ERD 요약 테이블

| 테이블 | PK | 주요 FK | 주요 필드 | 인덱스 |
|--------|-----|---------|----------|--------|
| canvases | id | user_id → auth.users | name, deleted_at, is_public, share_token | (user_id) WHERE deleted_at IS NULL |
| zones | id | canvas_id → canvases | label, color, "order", is_preset | (canvas_id) |
| blocks | id | canvas_id, zone_id | title, x/y, urgency, due_date, completed_at, deleted_at | (canvas_id) WHERE deleted_at IS NULL, (zone_id) |
| block_relations | (a,b) | block_a_id, block_b_id → blocks | created_at | (a), (b) |
| entitlements | user_id | user_id → auth.users | plan, canvas_limit, ai_enabled, credits, subscription_expires_at | (user_id) PK |
| ai_consumption_log | id | user_id → auth.users | endpoint, tokens_used, credits_used, created_at | (user_id, created_at DESC) |

---

## 🔐 Row-Level Security (RLS)

**원칙**: 유저는 자기 데이터만 접근 가능. 조인으로 소유권을 거슬러 올라가 검증.

```sql
-- 모든 테이블 RLS 활성화
alter table public.canvases           enable row level security;
alter table public.zones              enable row level security;
alter table public.blocks             enable row level security;
alter table public.block_relations    enable row level security;
alter table public.entitlements       enable row level security;
alter table public.ai_consumption_log enable row level security;

-- 1) canvases: 소유자만
create policy "canvas_owner_all"
  on public.canvases
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) zones: 부모 canvas 소유자만
create policy "zone_via_canvas"
  on public.zones
  for all
  using (exists (
    select 1 from public.canvases c
    where c.id = canvas_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.canvases c
    where c.id = canvas_id and c.user_id = auth.uid()
  ));

-- 3) blocks: 부모 canvas 소유자만
create policy "block_via_canvas"
  on public.blocks
  for all
  using (exists (
    select 1 from public.canvases c
    where c.id = canvas_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.canvases c
    where c.id = canvas_id and c.user_id = auth.uid()
  ));

-- 4) block_relations: 양쪽 block 모두 본인 소유
create policy "relation_via_blocks"
  on public.block_relations
  for all
  using (exists (
    select 1 from public.blocks ba
    join public.canvases c on c.id = ba.canvas_id
    where ba.id = block_a_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.blocks ba
    join public.canvases c on c.id = ba.canvas_id
    where ba.id = block_a_id and c.user_id = auth.uid()
  ));

-- 5) entitlements: 본인 레코드만 SELECT. INSERT/UPDATE/DELETE 는 서비스 역할만.
create policy "entitlements_self_read"
  on public.entitlements
  for select
  using (user_id = auth.uid());
-- (INSERT / UPDATE / DELETE 는 정책 없음 → 클라이언트 차단, service_role 서버에서만 조작)

-- 6) ai_consumption_log: 본인 기록만 SELECT. INSERT 는 서버만.
create policy "ai_log_self_read"
  on public.ai_consumption_log
  for select
  using (user_id = auth.uid());
```

---

## ⚙️ 12개 설계 질문에 대한 결정

### 데이터 모델

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| 1 | 관계선 JSON 배열 vs 테이블 | **별도 테이블 `block_relations`** | 양방향 조회, 삭제, 정합성 모두 유리. JSON 배열은 FK 제약이 안 걸려 정합성 깨지기 쉬움. |
| 2 | zones 캔버스 독립 vs 유저 전역 | **캔버스 독립 + 캔버스 생성 시 기본 결 시드** | 현재 코드 구조 유지. 빈 캔버스가 아니라 기본 결이 채워진 상태로 시작 (UX 연속성). |
| 3 | 완료 처리 `isCompleted` bool vs `completed_at` timestamptz | **`completed_at` 타임스탬프 (NULL = 미완료)** | 언제 완료했는지 정보까지 얻음. 저장 비용 동일. 통계/인사이트에 유리. |
| 4 | 휴지통 소프트 삭제 vs 별도 테이블 | **소프트 삭제 (`deleted_at`)** | 복원 쿼리 단순. 10개 제한은 정렬+LIMIT 로 처리. 별도 테이블 마이그레이션 비용 대비 이득 없음. |
| 5 | Undo 히스토리 서버 vs 클라이언트 | **클라이언트 세션에만 유지** | 히스토리 50개 × 유저 수 = DB 폭증. 브라우저 닫으면 의미 없음. 로컬 상태로 충분. |

### 동기화 정책

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| 6 | 게스트 → 로그인 마이그레이션 | **서버에 데이터 없으면 자동 복사. 있으면 유저에게 선택 (병합/덮어쓰기/버리기) 다이얼로그** | 자동 덮어쓰기는 손실 위험. 자동 병합은 ID 충돌. 비어있을 땐 복사가 가장 안전. |
| 7 | 충돌 해결 LWW vs CRDT | **Last Write Wins + 낙관적 UI** | 개인 도구 성격상 동시 편집이 드묾. CRDT는 오버엔지니어링. Supabase Realtime + `updated_at` 비교로 충분. |
| 8 | 오프라인 지원 (PWA) | **이번 범위 제외** | localStorage 캐시만 유지해서 일시적 오프라인에는 대응. 정식 PWA 전환은 별도 로드맵. |

### 인증 / 권한

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| 9 | 공유 기능 | **스키마에 훅만 남김 (`is_public`, `share_token`). 이번 범위에선 비활성** | 로드맵에 협업 기능 예정. 컬럼 추가만 지금 해두면 나중에 마이그레이션 불필요. |
| 10 | 조직 / 팀 | **스키마 반영 없음** | 개인 도구 지향. 필요 시 나중에 `organizations` / `memberships` 테이블 추가하는 식으로 확장. |

### AI

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| 11 | AI 사용량 제한 | **프리 유저는 AI 전면 비활성 (유료 전환 전까지)** 상세는 "💰 과금 & 엔타이틀먼트" 섹션 | 유료 모델 구축 전까지 OpenAI 비용 부담 불가 |
| 12 | 프롬프트 히스토리 저장 | **저장 X (MVP)** | 프라이버시, DB 부담. 디버깅은 Vercel 함수 로그로 충분. |

---

## 🔄 동기화 & 데이터 흐름

### 로그인 상태 분기

```
┌───────────────────────────┐
│  유저 상태 판단            │
└───────────────────────────┘
         │
    ┌────┴─────┐
    ▼          ▼
 게스트     로그인 완료
    │          │
    ▼          ▼
 localStorage  Supabase
  (현재 동작)  (신규)
```

### 마이그레이션 다이얼로그 (게스트 → 로그인)

로그인 완료 시점에 아래 플로우:

1. Supabase 에서 내 캔버스/블럭 수 조회
2. **서버에 데이터 0개** → localStorage 데이터 자동 업로드, 로컬 비움
3. **서버에 데이터 ≥ 1개 AND localStorage 데이터 ≥ 1개** → **선택 다이얼로그**
   - 🟦 "서버 데이터 그대로 쓰기" (로컬 비움)
   - 🟩 "로컬 데이터를 서버에 덮어쓰기"
   - 🟨 "로컬 데이터를 새 캔버스로 병합" ← 기본 추천
   - 🟥 "로컬 데이터 버리기"
4. **서버 ≥ 1, 로컬 0개** → 바로 서버 데이터 표시

### 실시간 동기화 (Supabase Realtime)

- 브라우저는 자기 소유 `canvases` / `blocks` / `zones` 테이블의 변경을 구독.
- 다른 기기에서 블럭 편집 → 현재 창에 수 초 내 반영.
- Optimistic UI: 로컬 상태 먼저 업데이트 → 서버 응답으로 정합 조정.
- 충돌 시 **`updated_at` 이 최신인 쪽이 승리** (Last Write Wins).

### AI 호출 흐름 (기존 유지)

```
브라우저
  → POST /api/ai/create-block
  → (Vercel) route.ts:
      1. Auth 확인 (supabase.auth.getUser())
      2. ai_usage 월 한도 체크
      3. OpenAI 호출
      4. 응답 파싱
      5. blocks 테이블 INSERT
      6. ai_usage 카운터 +1
  → 반환
```

---

## 📁 새로 추가될 코드 구조

```
app/
├── api/
│   └── ai/
│       ├── create-block/route.ts        ← 기존 + Supabase 쓰기
│       └── tidy-comprehensive/route.ts  ← 기존 + Supabase 읽기/쓰기
├── auth/
│   ├── callback/route.ts                ← OAuth 콜백 (Supabase SSR 패턴)
│   └── sign-in/page.tsx                 ← 로그인 페이지
└── page.tsx                             ← 기존, 쓰기 경로만 교체

lib/
├── supabase/
│   ├── client.ts                        ← 브라우저용 클라이언트
│   ├── server.ts                        ← API Route / Server Action 용
│   └── middleware.ts                    ← 세션 갱신
├── db/
│   ├── canvases.ts                      ← DAL: 캔버스 CRUD
│   ├── blocks.ts                        ← DAL: 블럭 CRUD
│   ├── zones.ts                         ← DAL: 결 CRUD
│   └── relations.ts                     ← DAL: 관계선 CRUD
├── sync/
│   ├── migrate-guest-data.ts            ← 게스트→로그인 마이그레이션
│   ├── realtime.ts                      ← Realtime 구독 관리
│   └── local-cache.ts                   ← localStorage 캐시 레이어
└── ai/
    ├── aiClient.ts                      ← 기존 유지
    ├── prompts.ts                       ← 기존 유지
    └── rate-limit.ts                    ← 신규: 월 한도 체크

types/
└── db.ts                                ← Supabase 스키마 자동 생성 타입
```

---

## 🌱 환경 변수 (Vercel + Supabase)

### 추가해야 할 것

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...        # ⚠️ 서버 전용. 노출 절대 금지. NEXT_PUBLIC_ 접두사 금지.
ADMIN_USER_IDS=uuid1,uuid2               # 테스트 계정 (AI 우회)
SENTRY_DSN=https://...                   # 에러 추적 (Phase 2~3)
SENTRY_AUTH_TOKEN=...                    # 소스맵 업로드용
```

### 이미 있는 것

```
OPENAI_API_KEY=sk-proj-...
```

### 보안 주의

- 모든 `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY` / `SENTRY_AUTH_TOKEN` 은 **`NEXT_PUBLIC_` 접두사 절대 금지**
- Vercel 환경 변수에서만 관리. Git 커밋 금지.
- `lib/supabase/server.ts` 같은 서버 전용 파일에서만 import

### Vercel 측 설정

- Environment Variables 에 위 4개 추가
- Production / Preview / Development 환경별 분기 가능

---

## 🔨 구현 로드맵 (단계별)

### Phase 0 — 설계 확정 (지금)
- [x] 스택 결정
- [x] ERD 초안 (7개 테이블: canvases / zones / blocks / block_relations / entitlements / ai_consumption_log / ai_usage는 삭제)
- [x] RLS 정책 (6개 테이블)
- [x] #2 zones 범위 확정 — 캔버스 독립 + 기본 5개 시드 (기획/개발/디자인/마케팅/일상)
- [x] 과금 정책 확정 — 프리 유저 AI 비활성, 크레딧/구독 모델 훅 추가
- [x] 보안/비용/UX/법무 결정사항 정리 (SEC / COST / OBS / UX / LEGAL / TEST / OPS)
- [x] 피드백 이메일 주소 확정: `yuwolxx@gmail.com`

### Phase 1 — 인프라 구축
- [ ] Supabase 프로젝트 생성 (또는 기존 프로젝트 활용)
- [ ] Supabase CLI 세팅 + `supabase/migrations/0001_init.sql` 로 DDL 관리
- [ ] RLS 정책 적용
- [ ] 환경 변수 Vercel 등록 (Supabase URL/키, `ADMIN_USER_IDS`, `OPENAI_API_KEY` 등)
- [ ] 사용자 본인 uuid 를 `ADMIN_USER_IDS` 에 추가 (개발 중 AI 사용 가능하게)

### Phase 2 — 데이터 접근 계층
- [ ] `lib/supabase/{client,server}.ts` 작성
- [ ] `lib/db/*.ts` DAL 작성
- [ ] Supabase 스키마로 TypeScript 타입 자동 생성 (`supabase gen types`)

### Phase 3 — 읽기 경로 전환
- [ ] 로그인 유저의 캔버스 조회를 Supabase 로 교체
- [ ] `page.tsx` 의 localStorage 읽기를 조건부 분기

### Phase 4 — 쓰기 경로 전환
- [ ] 블럭 CRUD 를 Server Action 또는 API Route 로 교체
- [ ] Optimistic UI 유지

### Phase 5 — 게스트 마이그레이션
- [ ] 로그인 직후 마이그레이션 다이얼로그
- [ ] 4가지 선택지 구현

### Phase 6 — 실시간 동기화
- [ ] Supabase Realtime 구독
- [ ] 충돌 해결 (LWW)

### Phase 7 — AI 엔타이틀먼트 & Rate Limit
- [ ] 엔타이틀먼트 체크 미들웨어 (AI 엔드포인트 진입점)
- [ ] `ADMIN_USER_IDS` 우회 로직
- [ ] 다층 rate limit (`ai_consumption_log` 슬라이딩 윈도우)
- [ ] HTTP 402 / 429 응답 + 프론트 안내 (업그레이드 유도 기본 배너)
- [ ] Vercel Analytics / Sentry 도입

### Phase 8 — 검증 및 마무리
- [ ] 2개 기기 동시 접속 테스트
- [ ] **RLS 뚫림 점검** (다른 유저 계정으로 타인 데이터 조회 시도 → 0건)
- [ ] 게스트 모드 회귀 없음 확인
- [ ] 법적 문서 (Terms / Privacy Policy) 한국어 초안 작성
- [ ] Supabase 무료 티어 한도 모니터링 체크리스트 작성
- [ ] 수동 백업 절차 문서화

---

## 🚫 의도적으로 배제한 것 (현재 범위)

- **EC2 도입** — 현 규모에서 불필요
- **별도 AI 서버 분리** — OpenAI 호출은 Vercel API Route 로 충분
- **CRDT 기반 충돌 해결** — 개인 도구 규모에서 오버엔지니어링
- **PWA / 오프라인 모드** — 별도 로드맵
- **조직/팀 모델** — 현재 서비스 방향 아님
- **프롬프트 히스토리 DB 저장** — 프라이버시 + 비용
- **서버 Undo 히스토리 저장** — 데이터 폭증, 세션 종료 시 무의미
- **결제 시스템 (Stripe / 토스페이먼츠) 실연동** — 스키마 훅만 두고 구현은 수익화 시점
- **광고 기반 프리 AI** — 광고 SDK 붙일 수준 되면 재검토
- **i18n / 다국어** — 문자열 한 곳에 모으는 규칙만 지킴
- **Audit log / block_history** — 향후 고급 기능 시
- **데이터 import** — export 는 유지, import 는 향후
- **민감 블럭 AI 제외 플래그** — 향후

---

## 💰 과금 & 엔타이틀먼트 (Entitlements)

### 핵심 원칙

> **"프리 유저는 AI 를 쓸 수 없다. AI 를 쓰려면 돈을 낸다."**

OpenAI API 비용은 사용자 수에 비례해서 터지기 때문에, **광고 등 기본 수익이 확보되기 전까지** 프리 유저에게 AI 를 열어줄 수 없음. 대신 **종량제 크레딧** 또는 **구독** 을 구매한 유저에게만 허용.

### 플랜별 제공 범위

| 플랜 | 캔버스 한도 | AI 활성 | 크레딧 | 가격 (추후 결정) |
|------|-------------|---------|--------|------------------|
| **free** | 1개 | ❌ | 0 | 무료 |
| **credit** | 1개 | ✅ (크레딧 차감) | 구매한 만큼 | 종량제 (예: 1000크레딧 / 9,900원 등) |
| **subscription** | 많이 (예: 10개) | ✅ (월 한도 내) | 월 리필 | 월 구독 (예: 월 9,900원) |
| **admin** | 무제한 | ✅ (무제한) | N/A | — |

→ 위 수치(한도/가격)는 모두 **실제 결제 붙일 때 확정**. 지금은 스키마 훅과 정책만 세움.

### 현재 단계 (결제 시스템 미구축)

- **모든 신규 가입자는 `plan = 'free'`** 자동 지정 (트리거로 처리)
- AI 엔드포인트 진입 시 첫 검증: `entitlements.ai_enabled = true` AND (`plan IN ('subscription','admin')` OR `credits > 0`)
- 조건 미충족 시 **HTTP 402 Payment Required** 응답 + 프론트에서 "AI 기능은 크레딧/구독 구매가 필요합니다" 안내 (업그레이드 유도 UI 는 향후 고도화)

### 어드민 / 테스터 우회

개발/테스트용으로 **본인 계정은 AI 를 써야 함**. 방법:

- 환경 변수 `ADMIN_USER_IDS` = 쉼표 구분 uuid 목록
- 서버에서 `auth.uid()` 가 이 목록에 있으면 엔타이틀먼트 무시하고 AI 허용
- Phase 1 Supabase 세팅 직후, 사용자 본인의 uuid 를 이 env 에 추가

### 캔버스 생성 한도 체크

클라이언트에서 "새 캔버스" 버튼 눌렀을 때:

```ts
const { data: ent } = await supabase.from('entitlements').select('canvas_limit').single()
const { count }    = await supabase.from('canvases').select('*', { count: 'exact', head: true }).is('deleted_at', null)
if (count >= ent.canvas_limit) throw UpgradeRequired
```

### AI 호출 한도 체크 (서버)

```ts
// app/api/ai/create-block/route.ts 의사 코드
const user = await getUser(req)
if (!user) return 401
if (isAdmin(user.id)) { /* bypass */ }
else {
  const ent = await getEntitlement(user.id)
  if (!ent.ai_enabled) return 402
  // multi-tier rate limit 확인 (분/시/일)
  // 구독이면 월 한도, 크레딧이면 credits > 0
}
```

### 과금 hook 만 남기고 미구현

- Stripe/토스페이먼츠 연동 → 미구현
- 크레딧 구매 UI → 미구현
- 구독 생애주기 (결제 성공 → `plan='subscription'` 으로 UPDATE) → 미구현
- 웹훅 엔드포인트 → 미구현

**→ 스키마 `entitlements` + `ai_consumption_log` 테이블만 지금 만든다.** 이후 결제 붙이면 그 테이블을 UPDATE 하는 로직만 추가하면 됨 (스키마 변경 없음).

### 광고 기반 프리 AI (먼 훗날 옵션)

광고 수익이 붙으면 **광고 1회 시청 = AI 1회 사용** 같은 모델도 가능. `ai_consumption_log` 에 `source = 'ad'` 컬럼 추가하는 식. 지금 범위 제외.

---

## 🔐 보안 / 비용 / 운영 결정사항

Phase 0 의 ARCHITECTURE 레벨 점검으로 도출된 20개 이슈에 대한 결정. 사용자가 AI 기능 유료화 외에는 Claude 의견으로 진행 지시.

### 🔒 보안

#### SEC-1. Service Role Key 관리 원칙 (필수)

- **`SUPABASE_SERVICE_ROLE_KEY`** 는 **서버 전용**.
- ❌ **`NEXT_PUBLIC_` 접두사 금지** — 클라이언트 번들 노출 시 전체 DB 접근 가능.
- ❌ **git 커밋 금지** — `.env.local` 은 반드시 `.gitignore`.
- ✅ Vercel 환경 변수에서만 관리.
- ✅ `lib/supabase/server.ts` 에서만 import. 파일 최상단에 큰 주석으로 경고 기재.

#### SEC-2. OpenAI 데이터 전송 고지

- 서비스 약관 / 개인정보처리방침에 **"AI 기능 사용 시 블럭 내용이 OpenAI 서버로 전송됨"** 명시 필수.
- 향후 블럭별 `isSensitive` 플래그로 "이 블럭은 AI 컨텍스트 제외" 옵션 추가 (향후 고도화).

#### SEC-3. 계정 삭제 / 탈퇴

- **설계에는 포함**: `on delete cascade` 덕에 auth.users 삭제 시 모든 데이터 자동 삭제.
- **UI/API 는 Phase 8 이후**: `POST /api/account/delete` 엔드포인트 + 확인 다이얼로그.
- 법적 요구(GDPR, 한국 개인정보보호법) 대응 **필수 기능** 이지만 정식 런칭 전까지 완료하면 OK.

#### SEC-4. 민감 파일 .gitignore 점검

- `.env*.local`, `.supabase/`, `node_modules/` 등은 이미 `.gitignore` 되어 있음 (확인 완료).
- CI 에서 `git log --all -S "SUPABASE_SERVICE_ROLE_KEY"` 같은 후크로 과거 유출 감지 (향후).

### 💸 비용 / 한도

#### COST-1. 다층 Rate Limit (AI 엔드포인트)

단일 월간 한도만으로는 악의적/버그 폭주 방어 불가. **분/시/일/월 4단계**:

| 단위 | 프리 | 크레딧 | 구독 | 어드민 |
|------|------|--------|------|--------|
| 분 | 0 | 5 | 10 | ∞ |
| 시간 | 0 | 30 | 60 | ∞ |
| 일 | 0 | 100 | 200 | ∞ |
| 월 | 0 | credits 잔액 | 1000 | ∞ |

- 구현: `ai_consumption_log` 의 `created_at` 로 슬라이딩 윈도우 쿼리
- 초과 시 HTTP 429 + Retry-After 헤더

#### COST-2. OpenAI 대시보드 하드 리밋

- OpenAI 측 `Usage limits` 에 **$10/월 Soft limit, $20/월 Hard limit** 설정 (초기)
- 하드 리밋 도달 시 자동 차단됨

#### COST-3. Supabase 무료 티어 주의

- **500MB DB / 50K MAU / 200 realtime conns / 2GB 대역폭 / 1주 비활성 시 일시정지**
- 초기 1~2달 은 **주 1회 이상 접속** 으로 일시정지 회피
- 한도 근접 시 경보: 월 1회 수동 확인 (Phase 8)

#### COST-4. Vercel Hobby → Pro 전환 기준

- **Hobby (무료) 상업적 사용 금지.** 현재 비수익 단계에선 문제 없음.
- 다음 조건 만족 시 Pro ($20/월) 전환:
  - 유료 플랜 판매 개시 (수익화)
  - 또는 월 방문자 10만 초과
  - 또는 Function 한도 초과 빈발

### 📊 모니터링 / 관찰 가능성

#### OBS-1. 에러 추적 — Sentry 무료 티어

- **Sentry** (5K errors/month 무료)
- `@sentry/nextjs` 설치 후 `instrumentation.ts` 로 설정
- `console.error` 자동 포착 + manual `Sentry.captureException(err)`
- Phase 2~3 쯤 도입

#### OBS-2. 사용 패턴 — Vercel Analytics

- **`@vercel/analytics` 이미 `package.json` 에 설치되어 있음** (master 확인)
- `app/layout.tsx` 에 `<Analytics />` 추가만 하면 활성화
- 핵심 이벤트는 `track()` 으로 커스텀 이벤트: `block_created`, `ai_toggled`, `reflection_accepted`
- Phase 3 쯤 활성화

#### OBS-3. DB 마이그레이션 버전 관리 — Supabase CLI

- `supabase/migrations/` 디렉토리에 타임스탬프 기반 `.sql` 파일로 관리
- 워크플로우:
  1. 로컬에서 `supabase migration new <name>` 으로 파일 생성
  2. SQL 작성
  3. `supabase db push` 로 production 반영
- **프로덕션에서 Supabase Dashboard 로 직접 ALTER 금지** — 반드시 마이그레이션 파일로.
- Phase 1 에 CLI 세팅 포함

### 🎨 UX 정책

#### UX-1. 네트워크 실패 UX

- Optimistic UI 기본. 서버 실패 시:
  - **`sonner` 토스트** (이미 설치)로 "잠시 후 다시 시도합니다" 표시
  - **재시도 큐**: 3회까지 exponential backoff 로 자동 재시도
  - 5회 연속 실패 시 상단 배너 "서버 연결 끊김" + 수동 재시도 버튼

#### UX-2. 로그아웃 시 로컬 캐시 클리어

- **로그아웃 이벤트 핸들러**에서 `localStorage.removeItem('layout_canvases')` 등 수행
- 이유: 공용 PC / 다른 사람이 내 블럭 볼 수 있는 위험 제거
- 이후 게스트 모드로 전환 — 새로 시작하는 것처럼 보임

#### UX-3. 빈 상태 — 첫 캔버스 튜토리얼 블럭

신규 가입자의 첫 캔버스에 기본 결 5개 + **튜토리얼 블럭 3개** 자동 시드:

```
블럭 1: "더블클릭으로 블럭을 편집하세요"       (urgency=stable, 기본 결 '일상')
블럭 2: "블럭을 가까이 놓으면 자동 연결됩니다"   (urgency=stable)
블럭 3: "완료 영역으로 드래그하면 완료 처리"    (urgency=stable)
```

- 블럭에 `is_guide = true` (이미 master 코드에 있는 플래그)
- 유저가 삭제하면 사라짐 (다시 안 생김)
- 구현: `seed_default_zones` 트리거 바로 뒤에 `seed_guide_blocks` 트리거 하나 더

### ⚖️ 법무 / 정책

#### LEGAL-1. 법적 문서 — 런칭 전 필수

**수익화 전에도** 개인정보 받으면 (로그인/블럭 저장) 필요:

- 서비스 이용약관 (Terms of Service)
- 개인정보처리방침 (Privacy Policy)
- 쿠키 고지

**이번 범위**: **템플릿 기반 한국어 초안을 `docs/legal/` 로 작성**. Phase 8 이전에 완료.
참고: notion.so, linear.app 약관 구조 참고. 생성 AI 로 초안 뽑고 사용자 검토.

정식 서비스 런칭 / 유료화 시점엔 **변호사 검토 권장**.

### 🧪 테스트

#### TEST-1. RLS 보안 회귀 테스트 (Phase 8 필수)

- 다른 유저 계정으로 로그인해서 타인 캔버스/블럭 조회 시도 → **반드시 0건** 이어야 함
- 간단한 노드 스크립트 `scripts/test-rls.ts` 로 수동 검증 가능
- 향후 Playwright E2E 에 포함

#### TEST-2. 단위 테스트 — Vitest (선택)

- 현재 프로젝트에 테스트 없음. 도입은 **Phase 5 이후** (코어 로직 안정화 이후)
- 우선순위: DAL 단위 테스트 > 컴포넌트 테스트

### 📣 피드백 / 운영

#### OPS-1. 피드백 채널

- **초기 방법**: Home / footer 에 "피드백 보내기" 링크 → `mailto:` 로 이메일 오픈
- **이메일 주소**: **`yuwolxx@gmail.com`** (master `app/page.tsx` 의 "개발자 정보" 블럭에서 확인됨)
- 후일 간단한 피드백 폼 (Supabase `feedback` 테이블에 저장) 으로 업그레이드

#### OPS-2. 수동 백업 (Phase 8)

- Supabase 자동 백업은 있음 (무료 티어 확인 필요)
- 추가 안전장치: **월 1회 수동** Supabase Dashboard → Database → Backups → download
- 자동화는 향후

#### OPS-3. 데이터 이주권 — Export 유지 / Import 미구현

- 기존 **JSON / Markdown export** 기능은 Phase 3 전환 시 Supabase 기반으로 재구현
- **Import 기능은 이번 범위 제외** — 향후 고도화

### 🌐 기타 (현재 범위 제외)

아래는 **문서에만 명시하고 후순위로**:

- **i18n (다국어)** — UI 문자열을 `lib/i18n/ko.ts` 같은 한 곳에 모아두기만. 실제 i18n 전환은 향후.
- **PWA / 오프라인 모드** — Phase 외.
- **Audit log / `block_history` 테이블** — 향후 복구 기능 추가 시.
- **Import 기능 (JSON → DB)** — 향후.
- **민감 블럭 AI 컨텍스트 제외 플래그** — 향후.
- **접근성 (a11y)** — 현재 shadcn/ui 기본 수준 유지. 정식 런칭 전 점검 필요.
- **SEO 메타 태그** — Phase 7 쯤 `app/layout.tsx` 에 기본 메타 추가.
- **조직 / 팀 모델** — 기존 결정대로 반영 없음.

---

## ✅ 확정된 사용자 의사결정

### ~~Q1. 결(Zone/Facet)의 범위~~ → 확정

- **방식**: 🅰️ 캔버스 독립 + 캔버스 생성 시 **기본 결 5개 자동 시드**
- **기본 결**: `기획 / 개발 / 디자인 / 마케팅 / 일상`
- **구현**: Postgres 트리거 `canvases_seed_zones` → `public.seed_default_zones()` 함수가 `AFTER INSERT ON canvases` 시점에 자동으로 zones 5개 삽입
- **플래그**: `zones.is_preset BOOLEAN` 으로 기본 시드인지 유저 커스텀인지 구분 → 나중에 "기본 결만 복원" 같은 기능에 활용 가능
- **유저 재정의 가능**: 유저가 시드된 결을 수정/삭제해도 무방 (일반 zones 로 동일 취급)

---

## 📚 관련 문서

- [WORKSPACE.md](./WORKSPACE.md) — 블로그 공식 기준
- [DEMO_LEGACY.md](./DEMO_LEGACY.md) — 데모 버전 기록
- [About / 기술 스택]({{ site.baseurl }}/docs/about/tech-stack/) — 현재(v1) 스택

---

## 🗒 설계 이력

| 날짜 | 작업 |
|------|------|
| 2026-04-23 | ARCHITECTURE.md 초안. 스택 결정 (Vercel + Supabase, EC2 X). ERD / RLS / 12개 질문 결정 정리. |
| 2026-04-23 | Q1 확정: 결은 캔버스 독립 + 기본 5개 시드 (기획/개발/디자인/마케팅/일상). Postgres 트리거로 구현. |
| 2026-04-23 | 과금 구조 확정: 프리 유저 AI 전면 비활성 / 크레딧·구독 모델 훅 추가 / 어드민 env 우회 / 실결제 미구현 |
| 2026-04-23 | 20개 아키텍처 이슈 점검 후 결정: SEC/COST/OBS/UX/LEGAL/TEST/OPS 각 항목 정책 수립 |
| 2026-04-23 | ai_usage 테이블 제거, entitlements + ai_consumption_log 로 대체 |
| 2026-04-23 | 피드백 이메일 확정: yuwolxx@gmail.com (master 의 개발자 정보 블럭에서 확인) |
