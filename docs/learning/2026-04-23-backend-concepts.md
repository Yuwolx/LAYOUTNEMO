---
layout: default
title: "2026-04-23 — 백엔드 아키텍처 기본 개념"
parent: Learning
nav_order: 1
---

# 2026-04-23 — 백엔드 아키텍처 기본 개념
{: .no_toc }

**v2 아키텍처를 설계하면서 새로 알게 되었거나 구체적으로 이해한 개념들.**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

## 1. Row-Level Security (RLS)

### 뭐하는 건지

**"이 DB 로우를 누가 볼 수 있는지" 를 DB 레벨에서 강제하는 권한 규칙.**

일반적인 방식은 백엔드 코드에서 **"이 유저가 이 데이터 주인인가?"** 를 조건문으로 체크한다. 그런데 이 로직이 **한 군데라도 빠뜨리면 데이터가 새나간다.**

RLS 는 **Postgres 자체** 에 "너는 이 조건 맞을 때만 이 테이블의 로우를 볼 수 있어" 를 박아두는 방식. 백엔드 코드가 실수해도 DB 가 막는다.

### Supabase 에서

Supabase 는 Auth 가 붙어있어서 `auth.uid()` 라는 함수로 현재 요청 보낸 유저 id 를 알 수 있다. 정책 예시:

```sql
create policy "canvas_owner_all"
  on public.canvases
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

이 정책 걸면 **어떤 클라이언트가 와도** `user_id = auth.uid()` 인 로우만 SELECT / UPDATE / DELETE 할 수 있다. 남의 데이터는 **존재 자체가 안 보인다.**

### 왜 좋은 건지

- **API 레이어가 날아가도** DB 가 방어선.
- 프런트에서 실수로 `SELECT *` 같은 쿼리를 쏴도 자기 데이터만 나옴.
- 개발자가 검증 로직을 빼먹어도 **보안 회귀가 일어나지 않음.**

### 주의할 점

- RLS 가 **활성화되어 있어야** 작동한다 (`ENABLE ROW LEVEL SECURITY`). 활성화 안 하고 정책만 쓰면 의미 없음.
- **service_role 키** 로 접속하면 RLS 를 우회한다. 이게 장점이자 함정.
  - 서버 사이드에서 관리자 작업 시 편리
  - 하지만 service_role 키가 **클라이언트에 노출되면** 전체 DB 뚫림

### 테스트 필수

다른 유저 계정으로 로그인해서 **남의 데이터가 진짜로 안 보이는지** 반드시 확인해야 한다. 이게 RLS 회귀 테스트의 핵심.

---

## 2. 엔타이틀먼트 (Entitlements)

### 뭐하는 건지

**"이 유저가 뭘 쓸 수 있는지" 를 관리하는 패턴.**

흔히 "플랜", "구독", "권한" 이라고 부르는 것들인데, SaaS 에선 이걸 한 테이블로 관리하는 게 보통이다.

```sql
create table entitlements (
  user_id uuid primary key,
  plan text,                  -- 'free' | 'credit' | 'subscription' | 'admin'
  canvas_limit int,
  ai_enabled boolean,
  credits int,
  subscription_expires_at timestamptz
);
```

### 왜 별도 테이블로 두는가

`auth.users` 에 때려박아도 되지만:
- auth 스키마는 Supabase 가 관리하는 영역. 직접 수정하면 업그레이드 시 깨짐.
- **변경 빈도** 가 다르다. 유저 정보는 거의 안 바뀌지만, 엔타이틀먼트는 결제할 때마다 바뀜.
- **확장성**. 나중에 플랜 추가하거나 한도 조정할 때 이 테이블만 건드리면 됨.

### "훅만 남긴다" 의 의미

당장 결제 시스템 붙일 수 없을 때 쓰는 전략이다.

- 테이블과 컬럼은 **지금** 만든다.
- 실제 값을 채우는 로직(Stripe 웹훅 등)은 **나중에**.
- 모든 유저는 기본값 `plan='free'` 로 생성됨.
- **스키마 마이그레이션이 필요 없음** — 나중에 결제 붙일 때 INSERT/UPDATE 로직만 추가.

### 트리거로 기본값 강제

```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.init_entitlements();
```

신규 가입 시 자동으로 `entitlements` 로우 생성. **"auth.users 에만 로우 있고 entitlements 는 없는" 불일치 상태가 애초에 불가능**하게 만드는 게 좋은 스키마 설계.

---

## 3. 소프트 삭제 (Soft Delete)

### 뭐하는 건지

**진짜로 DELETE 하지 않고 `deleted_at` 타임스탬프를 찍어서 "삭제됨" 상태로 표시.**

```sql
blocks (
  ...
  deleted_at timestamptz  -- NULL = 살아있음, 값 있음 = 삭제됨
)
```

조회 시 `WHERE deleted_at IS NULL` 조건을 붙이면 "살아있는" 것만 나옴.

### 왜 좋은지

- **복원 쉬움** — `UPDATE SET deleted_at = NULL` 한 줄.
- **관계 보존** — 삭제된 블럭을 참조하는 다른 블럭(관계선 등)이 깨지지 않음.
- **휴지통 기능** 이 공짜로 구현됨.

### 주의할 점

- **쿼리마다** `deleted_at IS NULL` 조건 안 붙이면 유령 데이터 튀어나옴.
  - 해결: **partial index** 를 `WHERE deleted_at IS NULL` 로 걸기 → 쿼리 플랜에서 자동 최적화
- **완전 삭제가 필요한 경우** (GDPR 등) 별도 정리 작업 필요.
- 휴지통 한도 관리 (예: 10개까지) → 쿼리로 오래된 것 자동 완전 삭제.

### `deleted_at` vs `is_deleted` bool

- bool 만 쓰면 "언제 삭제됐는지" 정보 손실.
- **타임스탬프** 는 **"삭제된 지 30일 지난 건 완전 삭제"** 같은 정책 쉽게 구현 가능.
- 저장 비용 거의 동일 (NULL 은 공간 안 먹음).

→ **`deleted_at` 타임스탬프가 거의 항상 정답.**

---

## 4. Last Write Wins (LWW)

### 뭐하는 건지

**"두 클라이언트가 동시에 같은 레코드를 수정했을 때, 나중에 도착한 쪽이 이긴다."**

충돌 해결 정책 중 가장 단순한 방식.

### 작동 방식

각 로우에 `updated_at timestamptz` 를 두고:

- 클라이언트 A: 22:00:10 에 수정 완료
- 클라이언트 B: 22:00:15 에 수정 완료
- → B 의 데이터가 최종으로 유지됨 (A 의 변경은 덮어씌워짐)

### 한계

- A 의 변경이 **조용히 사라진다.** 사용자에게 알려주지 않으면 "내가 한 수정이 왜 없지?" 가 됨.
- 동시 편집이 잦은 시나리오(구글 독스 수준) 에서는 부적절.

### CRDT 와의 비교

- **CRDT (Conflict-free Replicated Data Types)**: 두 변경을 **병합** 할 수 있는 자료구조. 둘 다 살린다.
- 복잡도 훨씬 높음. 라이브러리 도입 필요 (Yjs, Automerge 등).
- LAYOUTNEMO 같은 **개인용 도구** 는 동시 편집이 드물어서 LWW 로 충분.

### 결론

- **개인용 / 팀 작은 규모**: LWW + 낙관적 UI + 서버 반영 후 UI 보정.
- **다중 사용자 동시 편집**: CRDT 검토.

---

## 5. 낙관적 UI (Optimistic UI)

### 뭐하는 건지

**서버 응답 기다리지 않고 UI 를 먼저 업데이트.**

```
유저가 블럭 이동
  → UI 즉시 반영 (낙관적)
  → 백그라운드로 서버에 PATCH
  → 성공: 아무 일 없음
  → 실패: UI 되돌리고 에러 토스트
```

### 왜 쓰나

- **체감 속도** 가 미친 듯이 빠름. 네트워크 200ms 도 안 느껴짐.
- 서비스 UX 품질 차이가 이걸로 많이 갈림.

### 구현 핵심

- **롤백 전략** 필수 — 실패 시 원복할 이전 상태 기억해둬야 함.
- **재시도 큐** — 일시적 네트워크 실패에는 자동 재시도.
- **토스트 알림** — 실패를 조용히 덮으면 사용자가 데이터 손실을 모름.

### React 에서

```tsx
const [blocks, setBlocks] = useState<Block[]>([])

async function moveBlock(id, x, y) {
  const prev = blocks
  setBlocks(bs => bs.map(b => b.id === id ? { ...b, x, y } : b))  // 낙관적 업데이트

  try {
    await supabase.from('blocks').update({ x, y }).eq('id', id)
  } catch (err) {
    setBlocks(prev)  // 롤백
    toast.error("저장 실패. 다시 시도합니다.")
  }
}
```

---

## 6. Rate Limiting 다층화

### 뭐하는 건지

**API 호출을 시간 창 별로 여러 단계로 제한.**

단일 한도만 걸면(예: "월 300회") **악의적 폭주** 방어가 안 됨.
- 공격자가 1분에 300번 다 태우고 끝 → 정상 사용자 한 달간 0회

### 다층 예시

```
분당:   5회   (버스트 방지)
시간당: 30회  (중기 보호)
일간:   100회 (일일 예산)
월간:   1000회 (전체 예산)
```

4단계 전부 통과해야 호출 허용. 어느 하나라도 걸리면 HTTP 429.

### 구현 — 슬라이딩 윈도우

```sql
-- "지난 60초 사이 요청 수"
select count(*) from ai_consumption_log
where user_id = $1
  and created_at > now() - interval '1 minute';
```

각 단계별로 이런 쿼리 → 한도 초과면 거부.

### Redis 없이도 가능

- 정확히는 Redis 같은 빠른 저장소가 이상적.
- Supabase Postgres 도 인덱스 잘 걸면 충분 (소규모 기준).
- 규모 커지면 **Upstash Redis** 같은 서버리스 옵션.

### 응답 헤더

```
HTTP 429 Too Many Requests
Retry-After: 45
```

클라이언트가 언제 재시도할지 알 수 있게 헤더 포함. 친절한 API 기본.

---

## 7. DB 마이그레이션 (with Supabase CLI)

### 뭐하는 건지

**스키마 변경을 `.sql` 파일로 버전 관리해서 재현 가능하게 만드는 것.**

프로덕션 DB 에서 직접 `ALTER TABLE` 치는 건 **무조건 하면 안 되는 일**. 이유:

- 바뀐 내용이 **Git 에 안 남음** → 다른 환경 동기화 불가
- 실수하면 롤백 절차 없음
- 팀원과 공유 불가

### Supabase CLI 워크플로우

```bash
# 1. 새 마이그레이션 파일 생성
supabase migration new add_entitlements_table

# → supabase/migrations/20260423120000_add_entitlements_table.sql 생성됨

# 2. SQL 작성
# (파일 열어서 CREATE TABLE ... 쓰기)

# 3. 로컬에서 미리 테스트
supabase db reset  # 로컬 DB 에 모든 마이그레이션 재적용

# 4. 프로덕션 반영
supabase db push
```

### 네이밍 규칙

- 파일명에 **타임스탬프** 가 들어가서 순서 보장됨.
- 타임스탬프 + 설명: `20260423120000_add_entitlements_table.sql`
- 의미 있는 이름: `_create_blocks_table.sql`, `_add_is_preset_column.sql`

### 주의

- **기존 마이그레이션 파일 수정 금지.** 이미 프로덕션에 적용된 파일을 고치면 다른 환경이 어긋남.
- 새 변경은 **새 마이그레이션 파일로.**
- 컬럼 삭제는 **deprecated 기간** 을 둬서 backward-compatible 하게.

---

## 8. Service Role Key 보안

### 뭐하는 건지

Supabase 는 두 종류 키를 준다:

- **`anon key`** — 클라이언트에 노출 가능. RLS 정책 따라 권한 제한.
- **`service_role key`** — **RLS 를 우회**. 전체 DB 접근 가능.

### 왜 위험한지

service_role 키가 공개되면:

- 모든 유저 데이터 조회 가능
- 모든 테이블 조작 가능
- RLS 정책이 **무의미해짐**

Git, 블로그, 클라이언트 번들, 스크린샷 어디에도 **절대 노출되면 안 됨.**

### 노출되는 흔한 경로

1. **`NEXT_PUBLIC_` 접두사 실수** — Next.js 는 이 접두사 붙은 env 를 클라이언트 번들에 포함시킴. `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 는 즉사.
2. **`.env.local` Git 커밋** — `.gitignore` 에 빠져있으면 실수 가능.
3. **스크린샷/영상 공유** — 터미널에 `echo $SUPABASE_SERVICE_ROLE_KEY` 같은 거 했다가 찍힘.
4. **로그에 노출** — 에러 메시지에 env 전체 덤프되면…

### 안전한 사용법

- **서버 전용 파일** 에서만 import: `lib/supabase/server.ts`
- 파일 상단에 **큰 주석으로 경고**:
  ```ts
  // ⚠️ DO NOT IMPORT THIS FROM CLIENT CODE
  // This file uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
  ```
- **CI 체크** — git hook 이나 pre-commit 에서 `SERVICE_ROLE` 문자열 감지
- **노출된 걸 알게 되면** — 즉시 Supabase 대시보드에서 키 재생성

---

## 9. 트리거 (Postgres Trigger)

### 뭐하는 건지

**"어떤 테이블에 이벤트가 일어나면 자동으로 실행되는 함수."**

```sql
create trigger canvases_seed_zones
  after insert on public.canvases
  for each row
  execute function public.seed_default_zones();
```

→ `canvases` 에 INSERT 되면 자동으로 `seed_default_zones()` 실행.

### 왜 좋은지

- **원자성** — 캔버스 생성과 기본 결 생성이 **같은 트랜잭션** 에서 일어남. 중간에 실패하면 둘 다 롤백.
- **클라이언트 코드 단순** — 클라이언트는 "캔버스 하나 만들어" 만 하면 됨. 기본 결 삽입을 클라이언트가 챙길 필요 없음.
- **일관성** — DB 차원에서 보장되므로, **어느 경로로 캔버스를 만들든** 기본 결이 붙는다.

### 주의

- **디버깅 어려움** — 트리거가 조용히 실행되므로, 의도치 않은 동작 시 추적이 힘듦.
- **성능** — 트리거가 무거운 작업 하면 INSERT 응답이 느려짐.
- **`SECURITY DEFINER`** 옵션 이해 필요 — 트리거 함수가 **정의자(superuser) 권한** 으로 실행되게 할 때 쓰는데, 잘못 쓰면 권한 우회 가능.

### 쓸지 말지 판단

- **"데이터 일관성이 깨지면 안 되는 작업"** → 트리거 OK.
- **"복잡한 비즈니스 로직"** → 백엔드 코드에서 명시적으로.

---

## 10. 실시간 구독 (Supabase Realtime)

### 뭐하는 건지

**DB 테이블의 변경(INSERT / UPDATE / DELETE)을 WebSocket 으로 실시간 푸시.**

```ts
supabase
  .channel('blocks-changes')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'blocks', filter: `canvas_id=eq.${canvasId}` },
      payload => {
        // 다른 탭/기기의 변경이 여기 들어옴
        syncLocalState(payload)
      })
  .subscribe()
```

### 원리

- Postgres 의 **WAL (Write-Ahead Log)** 을 Supabase 가 읽어서 WebSocket 으로 구독자에게 브로드캐스트.
- 클라이언트는 WebSocket 연결만 열어두면 DB 변경 즉시 수신.

### 언제 쓰나

- **멀티 기기 동기화** (LAYOUTNEMO 케이스)
- **공동 편집**
- **라이브 대시보드**

### 한계 (Supabase 무료 티어)

- **200 동시 연결** 제한 — 유저당 탭 여러 개 열면 금방 참.
- 트래픽이 WAL 로그 크기와 관련 — 너무 큰 테이블은 부담.

### RLS 와의 상호작용

- Realtime 구독도 **RLS 를 통과해야** 이벤트가 전달됨.
- 따라서 RLS 정책을 제대로 걸어두면 남의 데이터 변경 이벤트는 애초에 안 옴. 👍

---

## 정리

이 10가지 개념을 오늘 한꺼번에 만났다. 각각은 이전에 들어본 적 있지만, **"실제로 내 서비스 설계에서 어떻게 조합되는지"** 를 구체적으로 본 건 처음이다.

특히 인상적이었던 건:

- **RLS + service_role 의 조합** — DB 가 스스로 방어선이 된다는 개념.
- **엔타이틀먼트의 훅 설계** — 결제 전에 스키마만 미리 만들어두는 전략.
- **트리거로 기본값 강제** — 불일치 상태가 애초에 불가능하게 만드는 설계.

아직 구현 안 해본 개념이 많아서, 실제 코드 치면서 뭐가 깨지는지 더 알게 될 것 같다. 그때 이 노트에 **"실제로 해보니까…"** 를 덧붙여야지.

---

_이 노트는 LAYOUTNEMO v2 아키텍처 설계 중(2026-04-23) 새롭게 정리한 개념들이다. 실제 설계 결정은 `ARCHITECTURE.md` (작업용, 비공개) 에 있다._
