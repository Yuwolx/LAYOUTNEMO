---
layout: post
title: "기술 부채 재방문 — 4주 뒤 다시 보는 청소 결과"
parent: Devlog
nav_order: 8
tags: [리팩터링, 성능, 캔버스]
---

# 기술 부채 재방문
{: .no_toc }

**2026-05-28 — 4월 24일 18개 이슈 청소 이후, 뭐가 해결됐고 뭐가 아직 남았나**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

4월 24일에 바이브 코딩 잔해를 정리하면서 이렇게 썼다.

> "코드 리뷰 결과 이슈가 18개. 오늘 하루 동안 상당수를 치웠다."

'상당수'라는 말이 마음에 걸렸다. 전부가 아니었으니까.

그 뒤로 4주가 지났다. 오늘은 그 이후 무슨 일이 있었는지, 솔직하게 다시 쓴다.

---

## 해결된 것들

### 1. `ignoreBuildErrors` — 완전히 제거됨

4월 24일 당시 가장 먼저 잡은 문제였다. `next.config.mjs` 에서 이 한 줄을 켜는 순간 TypeScript 타입 시스템 전체가 침묵한다는 걸 배웠다. 지금 `next.config.mjs` 는 이렇게 생겼다.

```js
const nextConfig = {
  images: { unoptimized: true },
}
```

타입 에러를 억압하는 옵션이 없다. `ignoreBuildErrors` 도, `ignoreLintErrors` 도 없다. `npm run lint` 를 실제로 돌릴 수 있게 됐다.

### 2. 시급도 라벨 — 단일 소스 정착

4월 24일에 `lib/constants/urgency.ts` 라는 단일 소스를 만들었다. 그 이후 두 달간 이 파일이 제 역할을 했다.

컴포넌트마다 달랐던 라벨이 이제는 하나의 파일에서 나온다. `block-detail-dialog`, `create-block-dialog`, `archive-dialog`, `work-block-card` 전부 같은 source 를 import 한다. "생각 중" 과 "보통" 이 혼용되던 때는 지나갔다.

그리고 이번 사이클에서 라벨 자체를 다시 잡았다.

| 내부 키 | 기존 라벨 | 현재 라벨 | 이유 |
|--------|----------|----------|------|
| `thinking` | 생각 중 | **미정** | "생각 중"은 상태가 아니라 행동. "미정"이 선택의 불확실성을 더 직접적으로 표현 |
| `stable` | 안정 | **여유** | "안정"은 시스템 용어. 유저가 고르는 맥락에서는 "여유 있음"이 자연스러움 |
| `lingering` | 머물러 있음 | **진행** | "머물러 있음"은 해석이 필요. "진행"은 즉시 읽힘 |
| `urgent` | 시급 | **시급** | 그대로 유지 |

새 블럭의 기본값도 `stable`(여유) 에서 `thinking`(미정) 으로 바꿨다. 처음 적는 생각은 대부분 아직 확정되지 않은 것이다.

### 3. 갈무리 UX — 독립적인 공간으로

4월 24일에 설계한 "우하단 아이콘 + 모달" 패턴이 그대로 정착했다. 우하단 박스 아이콘을 누르면 갈무리함이 열리고, 꺼낼 때 원래 자리로 돌아온다. 드롭 감지도 블럭 중심점이 아니라 **블럭과 독의 겹침(overlap)** 기준으로 바뀌어서 실제 감각과 맞아졌다.

### 4. viewport-aware 블럭 배치

새 블럭이 사용자가 지금 보고 있는 화면 밖에 생기는 문제를 잡았다. 기술적으로는 `CanvasViewport` 를 부모 상태로 올려서, 다이얼로그가 현재 pan 과 화면 크기를 알 수 있게 했다. 가이드 블럭도 이제 배치 충돌 감지 대상에 포함된다.

### 5. 기본 배율 0.9, 드래그 Undo

매번 브라우저에서 Cmd-minus 를 누르던 사용자 습관을 제품에 반영했다. `DEFAULT_CANVAS_SCALE = 0.9` 가 캔버스 좌표계 전체에 걸쳐 적용된다. 드래그 이동도 Undo 히스토리에 기록된다. 블럭을 길게 끌어도 Undo 한 번이면 원래 자리다.

### 6. 가이드 블럭 자동 마이그레이션

라벨이나 가이드 문구가 바뀌면, 기존 사용자의 localStorage 에 저장된 가이드 블럭은 예전 내용을 그대로 들고 있다. 위치와 갈무리 상태는 유지하면서 제목·설명·상세 안내·시급도만 최신 seed 기준으로 자동 갱신하도록 했다.

---

## 아직 남은 것들

솔직하게 쓴다.

### 1. API rate limiting 없음 — 가장 위험한 미완

`/api/ai/create-block` 과 `/api/ai/tidy-comprehensive` 두 엔드포인트에 rate limit 이 없다.

지금 이 두 라우트는 요청자를 식별하지도, 횟수를 추적하지도 않는다. 누가 이 URL 을 알고 스크립트로 반복 호출하면, OpenAI 비용이 무한히 나온다.

```ts
export async function POST(req: Request) {
  // ← 여기서 요청자를 확인하거나 횟수를 제한하는 코드가 없다
  const apiKey = process.env.OPENAI_API_KEY
  ...
}
```

v2 에서 Supabase Auth 가 붙으면 Row-Level Security 와 함께 잡을 수 있다. 하지만 현재 로컬 우선 아키텍처에서는 서버 세션이 없으니 구현이 애매하다. 그래도 Vercel 의 IP 기반 미들웨어 rate limit 이라도 넣어야 한다. 아직 안 되어 있다.

### 2. `tidy-comprehensive/route.ts` — 타입 시스템 밖의 섬

`app/api/ai/tidy-comprehensive/route.ts` 를 열면 `any` 가 14개 보인다.

```ts
function analyzeBlockClusters(blocks: any[], zones: any[]) { ... }
function calculateBlockSimilarity(block1: any, block2: any): number { ... }
const regularBlocks = blocks.filter((b: any) => !b.isGuide)
```

나머지 코드베이스는 `WorkBlock`, `Zone` 같은 타입으로 잘 잡혀있는데, 이 파일 하나만 타입 시스템 밖에 있다. `ignoreBuildErrors` 를 제거해서 타입 안전망을 복구했는데, 정작 가장 복잡한 AI 라우트가 그 망을 쓰고 있지 않다.

### 3. `시급도` 텍스트 4곳 미완

라벨 자체는 "미정/여유/진행/시급" 으로 바뀌었다. 그런데 UI 문자열에서 이 기능을 부르는 이름은 아직 "시급도" 다.

- `lib/i18n/dictionary.ts` — `label.urgency: "시급도"`, `reflect.type.urgency: "시급도"`, `reflect.intro.item4: "시급도와 우선순위 검토"` 세 줄
- `lib/i18n/seed.ts` — 가이드 문구 두 곳
- `app/page.tsx` — 초기 가이드 블럭 문구

라벨은 바꿨는데 기능명은 안 바꿨다. 유저가 블럭 상세를 열면 "시급도" 라는 라벨이 보인다. 그 아래에서 고르는 건 "미정/여유/진행/시급" 이다. 같은 개념이 두 이름으로 보인다.

### 4. God Component 두 개

`app/page.tsx` — 769줄. 캔버스 상태, 블럭 CRUD, AI 토글, 캔버스 전환, localStorage 마이그레이션, 키보드 단축키, Undo/Redo 히스토리가 한 파일에 있다.

`components/create-block-dialog.tsx` — 741줄. 수동 입력 폼, AI 응답 표시, 8초 자동 확정, 카운트다운 취소, 포지션 계산, fallback 처리가 한 컴포넌트에 있다.

이 두 파일이 전체 앱에서 변경이 가장 잦다. 크기 때문에 파악이 느리고, 수정할 때마다 의도치 않은 side effect 가 생기는지 확인하는 데 시간이 든다. 당장 기능이 깨지는 건 아니지만, 계속 이 크기로 두면 유지보수 비용이 선형으로 늘어난다.

### 5. `eslint-disable` 두 곳 — 잠재적 race condition

```
/app/page.tsx:389: // eslint-disable-next-line react-hooks/exhaustive-deps
/components/create-block-dialog.tsx:182: // eslint-disable-next-line react-hooks/exhaustive-deps
```

`react-hooks/exhaustive-deps` 를 끄는 건 의존성 배열에 값을 빠뜨렸다는 뜻이다. 빠진 값이 변할 때 effect 가 실행되지 않아서 오래된 값을 보는 closure stale 이 발생할 수 있다. 지금 당장 재현되는 버그는 없지만, 조건이 맞으면 나타나는 종류의 문제다.

### 6. AI 프롬프트와 내부 키 불일치

`tidy-comprehensive/route.ts` 에서 AI 에 블럭 데이터를 전달할 때 이렇게 보낸다.

```
시급도: ${b.urgency}
```

`b.urgency` 는 내부 저장 키인 `thinking`, `stable`, `lingering`, `urgent` 다. 그런데 AI 프롬프트 안에서는 "미정", "여유", "진행", "시급" 이라는 한국어 라벨로 시급도를 설명한다. AI 가 제안을 만들 때 "urgency: thinking 을 lingering 으로 바꿔라" 처럼 내부 키로 응답을 내놓기도 하고 "시급도를 진행으로" 처럼 라벨로 내놓기도 해서, 응답 파싱이 불안정하다.

---

## 지금 상태 한 줄 요약

4월 24일에 "빠르게 뽑은 코드의 잔해"를 치웠다면, 지금은 "빠르게 치운 청소의 잔해"가 남아있다.

전자가 후자보다 위험하다. 하지만 후자도 쌓이면 전자가 된다.

---

## 다음에 할 것

우선순위 기준으로 셋만 고른다.

1. **rate limit 미들웨어** — 비용 리스크가 가장 크다. Vercel Edge Middleware 로 IP 기반 제한부터.
2. **`시급도` 텍스트 4곳 → `상태`로 통일** — 변경 범위가 작고 명확하다. 오늘 고칠 수 있다.
3. **`tidy-comprehensive/route.ts` 타입 정리** — `WorkBlock` 타입 import 해서 `any` 제거.

나머지 두 개 (God Component 분리, eslint-disable 원인 추적) 는 기능에 직접 영향이 없어서 다음 큰 사이클로 넘긴다.

---

_이 글은 2026-04-24 "하루 만에 18개 이슈 치우기" 의 후속편이다. v1 에서 솔직하게 썼던 남은 숙제들이 실제로 어떻게 됐는지 추적한다._
