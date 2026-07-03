---
layout: post
title: "검토가 열어 본 뚜껑 — 권한 상승, 오픈 리다이렉트, 잠기는 캔버스, 태블릿 헤더"
parent: Devlog
nav_order: 16
tags: [보안, RLS, 동기화, 반응형, 코드리뷰]
---

# 검토가 열어 본 뚜껑 — 권한 상승, 오픈 리다이렉트, 잠기는 캔버스, 태블릿 헤더
{: .no_toc }

**2026-07-03 — 터치를 붙인 김에 한 번 크게 훑었더니, 서로 무관한 층위에서 문제가 같이 나왔다.**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

## 무슨 일이 있었나

[태블릿 터치 지원](2026-07-02-touch-support.md)을 막 올린 참이었다. 새 코드가 들어갔으니, 배포 전에 **보안·동기화·기능·성능**을 한 번 넓게 검토했다. "이 정도면 됐다"가 아니라 "터질 곳은 어디인가"를 찾는 쪽으로.

결과는 예상보다 컸다. 서로 상관없어 보이는 네 층위에서 문제가 같이 튀어나왔다 — 브라우저에서 누구나 관리자가 될 수 있는 **RLS 구멍**, 로그인 직후 낯선 사이트로 보내는 **오픈 리다이렉트**, 결을 지우면 캔버스 저장이 통째로 죽는 **동기화 버그**, 팬 도중 화면을 벗어나면 **영영 잠기는 캔버스**. 여기에 태블릿에서 로그인하면 상단바가 깨지는 것까지.

크리티컬한 것부터 순서대로 잡았다.

---

## 1. 누구나 관리자가 될 수 있었다 (RLS)

가장 위험했다. `user_profiles`의 정책이 이랬다.

```sql
-- 문제: FOR ALL 에 USING 만 있으면 WITH CHECK 가 USING 을 물려받아 UPDATE 까지 열린다
create policy "own profile" on public.user_profiles
  for all using (auth.uid() = id);
```

`FOR ALL`은 SELECT·INSERT·UPDATE·DELETE 전부를 뜻하고, `WITH CHECK`를 안 적으면 `USING`을 그대로 물려받는다. 즉 **로그인한 유저가 브라우저 콘솔에서 자기 행을 UPDATE**할 수 있었다.

```js
supabase.from('user_profiles').update({ is_admin: true }).eq('id', myId)   // 관리자 승격
supabase.from('user_profiles').update({ plan: 'pro' })                     // 무제한 AI
supabase.from('user_profiles').update({ ai_create_used: 0 })              // 쿼터 리셋
```

`is_admin: true`가 되면 관리자용 "전체 읽기" 정책이 열려 **다른 모든 유저의 데이터**까지 보였다. 쿼터 시스템과 멀티테넌트 격리가 한 줄에 같이 뚫려 있던 셈이다.

해결은 정책을 쪼개는 것. 클라이언트가 실제로 필요한 건 **본인 프로필 읽기**와 **최초 생성**뿐이라, 그 둘만 열고 UPDATE는 닫았다. 쿼터 변경은 이미 `SECURITY DEFINER` 함수로만 돌고, 관리자 지정은 서버에서만 한다.

```sql
-- 해결: 읽기 + "제약된" 삽입만. 권한/쿼터 컬럼은 기본값으로만 넣을 수 있게 고정
create policy "read own profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "insert own profile" on public.user_profiles
  for insert with check (
    auth.uid() = id and plan = 'free' and is_admin = false
    and ai_create_used = 0 and ai_tidy_used = 0
  );
```

이건 코드 배포와 무관하게 DB에 바로 적용되는 변경이라, 먼저 라이브에서 프로필·캔버스 로드가 정상인지 확인하고 넘어갔다.

---

## 2. 백슬래시 하나로 뚫린 리다이렉트

OAuth 콜백은 로그인 뒤 `?next=` 경로로 보내준다. 방어는 이랬다.

```js
// 문제: 원본 문자열 검사 — new URL 이 백슬래시를 슬래시로 정규화해 우회된다
const nextParam = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/"
// "/\evil.com" → 검사 통과 → new URL(...) 이 https://evil.com/ 로 정규화
```

`//evil.com`은 막지만 `/\evil.com`은 통과한다. 문제는 안전성을 **문자열 모양**으로 판단했다는 것. 정답은 파싱된 결과를 보는 것이다.

```js
// 해결: 해석된 URL 의 오리진을 비교한다
const dest = new URL(raw, url.origin)
const nextParam = dest.origin === url.origin ? dest.pathname + dest.search : "/"
```

---

## 3. 결을 지우면 저장이 통째로 죽었다

결(zone)을 삭제하면 DB는 그 결에 속한 블럭의 `zone_id`를 `null`로 바꾼다(`on delete set null`). 그런데 **로컬 상태의 블럭은 삭제된 결 id를 그대로 물고 있었다.**

```
// 문제: 결 삭제 → DB 는 zone_id=null, 로컬 블럭은 삭제된 id 유지
//       → 2초 뒤 autosave 가 죽은 zone_id 로 블럭을 upsert
//       → FK 위반 → "Failed to save blocks" → 그 캔버스의 블럭 저장이 전부 죽음
```

한 번 어긋나면 재로그인 전까지 조용히 저장이 안 됐다. 해결은 삭제 시 로컬도 DB와 같은 상태로 맞추는 것.

```js
// 해결: 삭제된 결을 가리키던 블럭을 로컬에서도 "미분류"로 비운다
blocks: canvas.blocks.map((b) => (removedSet.has(b.zone) ? { ...b, zone: "" } : b))
```

로컬 상태와 DB 제약이 어긋나면 저장이 부분 실패가 아니라 **전체 실패**로 번진다는 걸 다시 확인했다.

---

## 4. 팬을 하다 화면을 벗어나면 캔버스가 잠겼다

터치 코드의 멀티터치 가드에서 나왔다. 한 번에 하나의 인터랙션만 돌도록 `activePointerId`로 잠그는데, **팬이 정상적으로 끝나지 않는 경로**에서 이 잠금이 안 풀렸다.

```
// 문제: 팬 도중 창 blur(탭 전환·알림) 또는 Space 를 버튼보다 먼저 뗌
//       → 팬 리스너는 정리되는데 activePointerIdRef 는 남음
//       → 이후 모든 pointerdown 이 "이미 다른 포인터가 잡음"에서 막힘 → 영구 잠김
```

특히 태블릿에서 한 손가락 팬 중 앱 전환이 흔해 위험했다. 해결은 팬/드래그 teardown 자리에서 포인터 상태까지 같이 비우는 것.

```js
// 해결: blur/keyup 에서 진행중 인터랙션을 안전하게 종료
activePointerIdRef.current = null
setDraggingId(null); setDragStartPos(null); setMarquee(null)
```

---

## 5. 선택 모드 탭이 상세창을 같이 열었다

선택 모드에서 블럭을 탭하면 `pointerdown`을 "선택 토글"로 소비하고 끝냈는데, 상세창이 같이 떴다.

```
// 문제: pointerdown 을 소비(preventDefault)해도 뒤따르는 click 은 안 막힌다
//       → 카드의 click 핸들러가 상세 다이얼로그를 연다
```

`preventDefault`는 기본 동작을 막을 뿐, 브라우저가 이어서 쏘는 `click` 이벤트는 별개다. 소비했다는 신호를 카드로 넘겨 그 다음 클릭 한 번을 건너뛰게 했다.

```js
// 해결: 공유 ref 로 "이번 탭은 소비됨" 을 전달, click 에서 건너뜀
if (suppressClickRef?.current) { suppressClickRef.current = false; return }
```

---

## 6. 로그인하면 상단바가 깨졌다 (태블릿)

배포 뒤 태블릿에서 로그인하니 상단바가 못생기게 줄바꿈됐다. 원인은 **로그인 상태의 넓어진 프로필 버튼**이었다 — 로그아웃 땐 작은 로그인 버튼인데, 로그인하면 아바타+이름 알약이 되면서 폭이 늘고, 거기에 고정 최소폭 버튼들이 겹쳐 한 줄을 넘겼다.

```
// 문제: 로그인 시 넓어지는 AuthButton + 고정 min-width 버튼들
//       → 태블릿 폭에서 한 줄에 못 들어가 줄바꿈
```

데스크톱은 그대로 두고, 그 아래 폭에서만 단계적으로 좁혔다.

```html
<!-- 해결: 좁으면 내용폭, 넓으면 고정 / 비필수는 단계적으로 숨김 -->
min-w-0 lg:min-w-[128px]     <!-- 최소폭은 데스크톱에서만 -->
hidden lg:inline-block       <!-- 마지막 저장시각: 태블릿 이하 숨김 -->
hidden sm:inline             <!-- 유저 이름·로고 글자: 폰에선 아바타/아이콘만 -->
```

가장 넓어지는 상태(로그인)를 기준으로 설계해야 한다는 걸 놓쳤던 거다.

---

## 정리

한 번 크게 검토하니, 서로 상관없는 층위에서 문제가 같이 나왔다. 공통점은 전부 **"평소엔 안 보이다가 특정 조건에서 터지는" 것**들이었다는 점이다.

배운 것:

- **RLS `FOR ALL`은 `USING`만 쓰면 UPDATE까지 열린다.** 읽기·쓰기 정책을 나누고, 쓰기는 `WITH CHECK`로 좁혀라.
- **URL 안전성을 문자열 모양으로 판단하지 마라.** 파싱된 오리진을 비교해야 정규화 우회를 막는다.
- **로컬 상태와 DB 제약이 어긋나면 저장이 통째로 죽는다.** 삭제 같은 파생 변경은 양쪽을 함께 맞춰야 한다.
- **이벤트를 소비해도 브라우저의 다음 이벤트(click)는 따로 막아야 한다.**
- **반응형은 "가장 넓어지는 상태"를 기준으로.** 여기선 로그인이 그 상태였다.

터치·헤더처럼 **로컬에선 컴파일·빌드까지만 검증되는** 것들은 실기기에서 마저 확인해야 한다. 롤백은 배포 직전 상태를 백업해둔 `release/pre-security-touch`·`release/pre-responsive-header`로 언제든 되돌릴 수 있게 해뒀다. 기능을 늘리는 것만큼, 늘린 뒤 **한 번 크게 뚜껑을 열어 보는 일**도 개발의 일부다.
