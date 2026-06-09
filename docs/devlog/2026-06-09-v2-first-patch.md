---
layout: post
title: "v2 배포 직후 패치 — 설정 실수, 보안 구멍, 이중 저장"
parent: Devlog
nav_order: 10
---

# v2 배포 직후 패치
{: .no_toc }

**2026-06-09 — 코드는 맞았고 설정이 틀렸다**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

## 시작하며

배포 버튼을 누르고 30분 후, 로그인이 터졌다.

코드를 아무리 봐도 문제가 없었다. 로컬에서는 멀쩡하게 돌아갔다. 결국 범인은 Vercel 환경변수에 엉뚱한 값이 들어있던 것이었다. 그리고 그 과정에서 보안 구멍도 하나 발견했다.

이 포스트는 배포 직후 24시간 동안 발생한 버그들의 기록이다.

---

## 1. Supabase URL이 다른 프로젝트 것이었다

### 증상

로그인 버튼을 누르면 Safari가 **"서버를 찾을 수 없음"** 화면을 띄웠다.

### 원인

Vercel의 `NEXT_PUBLIC_SUPABASE_URL` 환경변수에 설정된 값이 이 프로젝트 것이 아니었다. 과거에 테스트하다 버린 다른 Supabase 프로젝트의 URL이 그대로 남아있었다.

```
# Vercel에 설정되어 있던 값 (잘못됨)
NEXT_PUBLIC_SUPABASE_URL=https://shuhkwudlibcbveheftg.supabase.co

# 실제 이 프로젝트의 URL
NEXT_PUBLIC_SUPABASE_URL=https://pwxmtjwjlqdkgzisakqg.supabase.co
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`도 마찬가지였다. 잘못된 프로젝트의 키가 설정되어 있었다.

### 교훈

환경변수는 배포 전에 반드시 프로덕션에서 직접 확인해야 한다. 로컬 `.env.local`이 맞다고 Vercel도 맞다는 보장이 없다.

---

## 2. Google OAuth 콜백이 localhost로 돌아왔다

### 증상

URL을 고치고 다시 로그인을 시도했더니, Google 인증 후 `localhost:3000`으로 리다이렉트됐다.

### 원인

Supabase 대시보드 → Authentication → URL Configuration에 프로덕션 콜백 URL을 추가하지 않았다.

Supabase는 OAuth 인증 후 허용된 리다이렉트 URL 목록 안의 주소로만 돌려보낸다. 등록하지 않은 URL은 기본값인 `localhost:3000`으로 처리된다.

### 수정

Supabase 대시보드에 아래 URL을 추가했다.

```
https://www.layoutnemo.com/auth/callback
```

코드가 아닌 대시보드 설정 문제였다.

---

## 3. 로그인 성공인데 UI는 여전히 "로그인" 버튼

### 증상

Google 인증을 마치고 돌아왔는데 헤더의 로그인 버튼이 그대로 남아있었다. 로그인이 된 건지 안 된 건지 알 수 없었다.

### 원인

`NEXT_PUBLIC_SUPABASE_ANON_KEY`도 잘못된 값이었다. URL은 고쳤지만 키가 아직 엉뚱한 프로젝트 것이라 세션 쿠키를 제대로 발급받지 못했다.

URL이랑 키가 **두 환경변수 모두** 맞아야 정상 동작한다. 하나만 고치면 반쪽짜리 에러가 난다.

---

## 4. 관리자 대시보드 새로고침하면 로그인 초기화

### 증상

`/admin`에 로그인하면 대시보드가 보인다. 새로고침하면 다시 로그인 폼이 뜬다.

### 원인

admin 세션 쿠키를 `path: "/admin"`으로 발급했더니, `/api/admin/auth` 요청에 쿠키가 전송되지 않았다.

브라우저는 쿠키의 `path`가 요청 URL의 접두사일 때만 쿠키를 보낸다. `/api/admin/auth`는 `/admin`의 하위 경로가 아니기 때문에 쿠키가 없다고 판단하고 인증 실패를 반환했다.

```typescript
// 잘못된 설정
cookieStore.set(COOKIE, token, { path: "/admin" })

// 수정 후
cookieStore.set(COOKIE, token, { path: "/" })
```

---

## 5. 관리자 대시보드 유저 수가 0명

### 증상

분명히 로그인한 유저가 있는데 관리자 대시보드에 유저 수가 0으로 표시됐다.

### 원인

클라이언트 컴포넌트에서 일반 anon key로 Supabase를 직접 쿼리하고 있었다. `user_profiles` 테이블은 RLS(Row Level Security)로 보호되어 있어서, anon key로는 자기 자신의 row만 읽을 수 있다. 관리자라도 anon key를 쓰면 RLS에 막힌다.

### 수정

쿼리를 서버 사이드 API 라우트로 옮기고, service role key를 사용하도록 했다.

```typescript
// app/api/admin/stats/route.ts
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY  // RLS 우회
  return createClient(url, key, { auth: { persistSession: false } })
}
```

`SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_` 접두사를 붙이면 안 된다. 브라우저에 노출되면 RLS 전체가 무력화된다. 서버 전용 환경변수로 관리해야 한다.

---

## 6. Open Redirect 취약점

코드 리뷰 중에 발견했다. 로그인 실패와는 무관하지만, 그냥 넘어갈 수 없었다.

### 문제

`/auth/callback` 라우트에서 `next` 파라미터를 그대로 `new URL()`에 넘겼다.

```typescript
// 기존 코드
const next = url.searchParams.get("next") ?? "/"
return NextResponse.redirect(new URL(next, url.origin))
```

`next` 값이 `//evil.com`이면 브라우저는 이를 `https://evil.com`으로 해석한다. 인증 후 외부 사이트로 리다이렉트되는 피싱 공격에 활용될 수 있다.

```
# 공격 시나리오
https://layoutnemo.com/auth/callback?next=//evil.com/steal-token
```

### 수정

경로가 `/`로 시작하고 `//`로는 시작하지 않는 경우만 허용하도록 검증을 추가했다.

```typescript
const nextRaw = url.searchParams.get("next") ?? "/"
const nextParam = nextRaw.startsWith("/") && !nextRaw.startsWith("//")
  ? nextRaw
  : "/"
return NextResponse.redirect(new URL(nextParam, url.origin))
```

발견 즉시 수정했다.

---

## 7. 블럭 수정마다 Supabase에 두 번 저장

### 문제

`saveToHistory` 함수를 살펴봤더니 Supabase 저장이 두 번 일어나고 있었다.

1. `persistCanvasNow(nextCanvas)` — 즉시 저장
2. `setCanvases(...)` → `canvases` 상태 변경 → `useEffect` 2초 디바운스 저장

블럭을 하나 이동하면 Supabase write가 두 번 나간다. 평소엔 문제없지만 낭비다.

### 수정

`saveToHistory`에서 즉시 저장 호출을 제거했다. `useEffect`의 2초 디바운스가 모든 상태 변경을 커버하기 때문에 충분하다. 탭을 닫더라도 localStorage에는 이미 저장되어 있어서 데이터 손실이 없다.

`handleCreateCanvas`의 즉시 저장은 그대로 남겨뒀다. 새 캔버스는 `canvases` 배열에 없는 상태에서 만들어지기 때문에, 디바운스만 믿으면 2초 안에 탭을 닫을 경우 서버에 등록이 안 될 수 있다.

---

## 정리

배포 후 하루 동안 발생한 버그 7개 중 코드 버그는 사실상 없었다. 설정 누락 4개, 설계 실수 1개, 보안 취약점 1개, 성능 낭비 1개.

**설정 실수를 잡는 가장 빠른 방법은 배포 직후 직접 써보는 것**이다. 테스트 계정으로 로그인해보고, 관리자 페이지 새로고침해보고, 네트워크 탭 열어서 요청이 어디로 가는지 확인하는 것. 자동화된 테스트가 잡아주지 못하는 영역이다.
