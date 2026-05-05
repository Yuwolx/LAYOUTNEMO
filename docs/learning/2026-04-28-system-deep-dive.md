---
layout: post
title: "2026-04-28 — LAYOUTNEMO 시스템 처음부터 끝까지 (PM 학습용)"
parent: Learning
nav_order: 4
---

# LAYOUTNEMO 시스템 처음부터 끝까지
{: .no_toc }

**PM/대표 학습용 — 실제 동작 흐름을 머릿속에 그릴 수 있게. 솔직하게.**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

> **이 글은 내부 학습용입니다.** 외부 공개돼도 상관없게 썼지만, 마케팅 톤은 아니에요. 임시방편, 기술 부채, 확신 없는 결정 그대로 적었습니다. "여긴 좀 지저분해" 같은 표현이 보이면 그게 사실입니다.

---

## 1. 서비스 개요 (왜 만들었는가)

### 풀고 싶은 문제

업무 / 사고 정리 도구는 두 부류로 갈립니다.

- **리스트형** (노션 todo, 일반 to-do 앱) — 줄을 세움. 우선순위는 위에서 아래.
- **보드형** (트렐로, 칸반) — 칼럼으로 나눔. "할 일 / 진행 / 완료" 같은 상태로 분리.

둘 다 정돈된 결과를 보여주는 데에 능합니다. **정돈되기 전의 사고**를 담는 데에는 못합니다.

머릿속에서 일어나는 건 보통 이렇습니다 — "이거랑 저거랑 어딘가 비슷한데 어떻게 연결되는지 아직 모르겠다", "이건 시급하긴 한데 아이디어가 덜 익었다", "여러 결의 일들이 동시에 굴러간다". 이 상태를 줄로 세우거나 칼럼에 넣는 순간, 정돈하지 않고 미루는 것 자체가 죄책감이 됩니다.

LAYOUTNEMO 는 **정돈되지 않은 사고의 흐름 그대로** 캔버스 위에 펼쳐놓는 도구입니다. 결로 나누되 칸막이를 치지 않고, 가까이 두면 자동으로 잇고, "시급" 만이 아니라 "생각 중" / "머물러 있음" 같은 사고 상태도 색으로 표현합니다.

### 핵심 철학

1. **사고 상태로서의 업무** — 업무는 "할 것 / 한 것" 의 이분법이 아니라 머릿속에서 다양한 상태를 거칩니다. 시급도(stable / thinking / lingering / urgent) 4단계는 그 중 가장 중요한 것을 뽑은 것.
2. **공간 = 의미** — 두 블럭이 가까이 있으면 = 관련 있음. 떨어져 있으면 = 관련 없음. 명시적으로 "이 둘을 연결" 버튼 누르지 않아도 됨.
3. **AI 개입 최소화** — AI 는 도와주되 강제하지 않음. 토글 가능, 응답 검증 가능, 자동 반영도 8초 안에 취소 가능. AI 가 끄여 있어도 모든 핵심 기능 동작.
4. **로컬 우선** — 첫 인상은 가입 없이 바로. 데이터는 일단 브라우저에. 나중에 필요할 때 로그인.

### 차별점

| 도구 | 핵심 메타포 | LAYOUTNEMO 와의 차이 |
|---|---|---|
| 노션 | 페이지/리스트 | 우리는 캔버스. 정돈된 결과보다 정돈 전 흐름. |
| 트렐로 | 칼럼/카드 | 우리는 칸막이 없음. 같은 결의 블럭을 또렷하게 만 보여주는 시선 필터. |
| Miro | 화이트보드 | Miro 는 시각적 자유도 위주. 우리는 사고 상태(시급도) + 자동 연결 + AI 보조가 핵심. |
| Linear | 이슈 트래킹 | Linear 는 정돈된 워크플로우. 우리는 정돈 전 단계. |

가장 가까운 친척은 Miro 지만 도구의 **목적**이 다릅니다. Miro 는 협업 회의용, 우리는 개인 사고용.

---

## 2. 시스템 아키텍처 한눈에 보기

### 다이어그램

```
                       ┌───────────────────────────┐
                       │        브라우저 (CSR)        │
                       │  Next.js 16 + React 19    │
                       │  Tailwind v4 + shadcn/ui  │
                       │                           │
                       │  ┌─────────────────────┐  │
                       │  │ localStorage         │  │
                       │  │ - layout_canvases    │  │
                       │  │ - layout_ai_enabled  │  │
                       │  │ - layout_language    │  │
                       │  └─────────────────────┘  │
                       └────────────┬──────────────┘
                                    │ HTTPS
                                    │ (Vercel CDN)
                                    ▼
                       ┌───────────────────────────┐
                       │      Vercel Edge / Server   │
                       │   (같은 Next.js 프로젝트)    │
                       │                           │
                       │  /api/ai/create-block     │
                       │  /api/ai/tidy-comprehensive│
                       │                           │
                       │  Server-only: OPENAI_API_KEY│
                       └────────────┬──────────────┘
                                    │ HTTPS
                                    ▼
                       ┌───────────────────────────┐
                       │   OpenAI Chat Completions  │
                       │       gpt-4o-mini          │
                       │   response_format=json     │
                       └───────────────────────────┘

           ─── 아직 없음 / Phase 2 ───────────────────────

                       ┌───────────────────────────┐
                       │      Supabase (계획)        │
                       │  - Auth (Google OAuth)    │
                       │  - Postgres + RLS         │
                       │  - Realtime (다기기 sync)   │
                       └───────────────────────────┘
```

**중요**: 위 다이어그램에서 Supabase 부분은 **현재 동작하지 않습니다**. `feature/auth-google` 브랜치에 코드만 있고 master 에 머지 안 됨. 외부 셋업도 절반(URL/anon key 만 받아둠, Google OAuth provider 활성화 미완).

### 각 컴포넌트 역할

**브라우저 (Next.js 클라이언트)**
- 모든 사용자 데이터의 **유일한 저장소** 가 현재 localStorage. "백엔드 DB" 가 없음.
- React state(`useState`) + localStorage 영속화 패턴. 새로고침 시 localStorage 에서 복원.
- 모든 "비즈니스 로직"(블럭 생성, 연결, 갈무리, 결 관리, undo/redo) 이 클라이언트 사이드.

**Vercel 서버 (Next.js API routes)**
- 두 개의 API 라우트만 존재. 모두 **OpenAI 프록시 용도**.
- 이유: API 키를 클라이언트에 노출하면 안 되니까 서버에서 한 번 받아 OpenAI 로 전달.
- 데이터를 저장하거나 사용자별로 처리하는 로직 없음.

**OpenAI**
- 블럭 생성 보조 (자연어 → 제목/요약/결/시급도/태그/링크)
- 정리하기 분석 (블럭 배치 / 그룹 제안)
- gpt-4o-mini 고정. 비용/속도/JSON mode 지원의 균형.

**Supabase (계획만)**
- ARCHITECTURE.md 에 v2 설계 문서로 존재.
- 코드 일부는 `feature/auth-google` 에 있음.
- 활성화는 Phase 2 작업으로 미뤄둠.

### 기술 스택과 선택 이유

| 기술 | 이유 (솔직하게) |
|---|---|
| **Next.js 16** | App Router 가 SSR/CSR 섞기 편하고, API routes 가 한 프로젝트에서 같이 가니까 단순. v0/Vercel 템플릿이 이걸 쓰니까 따라간 부분도 있음. |
| **React 19.2** | Next.js 가 이걸 요구해서. 19 의 새 hook 들 거의 안 씀. |
| **TypeScript 5** | 안 쓸 이유가 없음. 한 번은 `ignoreBuildErrors: true` 가 켜져 있어 9개 타입 에러를 숨기고 있었음 (지금은 끔). |
| **Tailwind CSS v4** | 빠른 스타일링. 미세한 디자인 차이를 임의값(`text-[13px]`, `bg-[#151823]`) 으로 자주 박아둠. 디자인 시스템화 안 되어 있음 — **기술 부채**. |
| **shadcn/ui** | 컴포넌트 직접 갖다 쓰는 방식이라 Radix 의존성만 있고 나머지는 우리 거. 다이얼로그 / 드롭다운 / 토스트(sonner) 등 사용. |
| **Vercel** | Next.js 와 zero-config. 도메인 연결, preview 배포, env 관리 다 됨. 다른 옵션 진지하게 고민 안 함. |
| **Namecheap** | 이미 도메인 있어서. www 서브도메인 SSL 셋업이 안 끝나서 사파리에서 안 열리는 이슈 있음 (작성 시점 미해결). |
| **OpenAI gpt-4o-mini** | 빠르고 싸고 JSON mode 지원. 응답 품질 충분. 다른 모델(Anthropic 등) 평가 안 함. |
| **Supabase (계획)** | Auth + Postgres + Realtime + RLS 한 번에 처리. v2 가면 어차피 다 필요. |
| **lucide-react** | 아이콘. shadcn 도 이거 씀. |
| **zod** | AI 응답 런타임 검증용. types 만 믿으면 안 되니까. |
| **sonner** | 토스트. 가볍고 예쁨. |

### 배포 환경

- **master 브랜치 → Vercel 자동 배포** → https://layoutnemo.com
- **gh-pages 브랜치 → GitHub Pages** → https://yuwolx.github.io/LAYOUTNEMO/ (블로그)
- **develop 브랜치** — 통합 점검용. 보통 master 와 같음.
- **feature/* 브랜치** — 작업 단위. PR 로 master 에 머지.

환경변수는 두 곳:
- **로컬**: `.env.local` (gitignored)
- **Vercel Settings → Environment Variables**

`OPENAI_API_KEY` 하나만 현재 필수. Supabase 키는 코드만 있고 사용 안 됨.

---

## 3. 데이터 모델 (DB 구조)

### 솔직한 한 줄

**현재 DB 가 없습니다.** localStorage 가 DB 입니다. 아래는 localStorage 에 저장되는 JSON 의 구조입니다.

### localStorage 키 목록

| 키 | 형식 | 용도 |
|---|---|---|
| `layout_canvases` | `Canvas[]` JSON | 모든 캔버스 + 그 안의 블럭/결 데이터 |
| `layout_current_canvas` | `string` | 현재 활성 캔버스 ID |
| `layout_ai_enabled` | `"true" / "false"` | AI 보조 토글 상태 |
| `layout_language` | `"ko" / "en"` | UI 언어 |

핵심 데이터는 `layout_canvases` 한 키에 다 들어있습니다. 캔버스 여러 개 + 각 캔버스의 블럭들 + 결들 = 모두 한 JSON 트리.

### 타입 정의 (types/index.ts 발췌)

```ts
export interface Canvas {
  id: string         // 예: "main"
  name: string       // 사용자가 짓는 이름
  blocks: WorkBlock[]
  zones: Zone[]      // 결(facet) 정의
  createdAt: number  // ms timestamp
  updatedAt: number
}

export interface WorkBlock {
  id: string
  title: string
  description: string
  x: number          // 캔버스 좌표 (world coord, pan 영향 X)
  y: number
  width: number
  height: number
  zone: string       // Zone.id 참조
  urgency?: "stable" | "thinking" | "lingering" | "urgent"
  dueDate?: string   // YYYY-MM-DD
  relatedTo?: string[]  // 다른 블럭 id 들 (양방향)
  isGuide?: boolean
  isCompleted?: boolean   // = 갈무리됨
  isDeleted?: boolean
  deletedAt?: number      // 휴지통 (10개 한도)
  detailedNotes?: string
  isAIControl?: boolean   // 가이드 블럭 중 AI 토글용 특수 블럭
  aiEnabled?: boolean
  url?: string            // 외부 링크 (선택)
  tag?: string            // 태그 (선택, [TAG] 로 표시)
  originalState?: { ... } // 갈무리 전 크기/시급도 백업 (현재 사실상 안 씀)
}

export interface Zone {
  id: string         // 예: "planning", "development"
  label: string      // 표시 이름
  color: string      // CSS 색
}
```

### 관계 (외래 키 같은 것)

- `WorkBlock.zone` → `Zone.id` (참조 무결성 강제 X — 코드에서 신경)
- `WorkBlock.relatedTo: string[]` → 다른 `WorkBlock.id` 들. **양방향 동기화는 코드 책임** (Canvas component 의 mouseUp 핸들러에서 양쪽 다 업데이트). DB 처럼 한 쪽만 적어두는 게 아님.

### 특이한 설계 결정

**1. 캔버스 단위로 묶음**
- 처음엔 `blocks` 만 따로 저장하려 했지만, 캔버스 여러 개 지원이 늘면서 Canvas 라는 그릇으로 묶음.
- 한 Canvas 객체 안에 그 캔버스의 모든 블럭/결 포함. localStorage 한 키에 전체.

**2. Undo 스냅샷**
- `app/page.tsx` 의 `history: { canvasId, blocks }[]`.
- 옛 버전: `CanvasType[][]` — 모든 캔버스 전체를 매번 스냅샷 → 메모리 부담.
- 현재: 변경된 캔버스의 blocks 만 저장. 50개 한도.
- **확신 없는 부분**: zones 변경(결 이름 수정 등) 은 undo 안 됨. 의도인지 누락인지 모호.

**3. 갈무리 = isCompleted=true**
- 별도 archive 컬렉션이 아니라 같은 blocks 배열에 flag 만 다름.
- ArchiveDialog 가 `blocks.filter(isCompleted)` 로 추려냄.
- 휴지통과 다른 메커니즘: 휴지통은 `isDeleted` flag + 10개 한도 + 자동 정리.

**4. 가이드 블럭은 시드 데이터**
- "사용 설명서" / "단축키" 가이드 블럭 두 개는 프로젝트 코드에 하드코딩(`app/page.tsx` 의 `initialBlocks`).
- 새 사용자에 자동 노출.
- i18n 번역은 `lib/i18n/seed.ts` 의 `SEED_BLOCK_STRINGS` 에 한/영 페어로.
- **사용자가 편집했는지 감지**: 저장된 값과 시드의 ko 원본 값 비교. 다르면 "편집됨" → 번역 안 함.

### 인덱스 전략

**없음.** localStorage 라 인덱스 개념 없음. 모든 검색은 `Array.find` / `.filter`.
- 블럭 100개 정도면 부드럽게 동작.
- 1000개 넘어가면 느려질 가능성. 아직 한 번도 그런 사용자 없어서 측정 안 함.

v2(Supabase) 가면 RLS 로 user_id 인덱스 + 캔버스 id 인덱스 정도 필요. 설계는 ARCHITECTURE.md 참조.

---

## 4. API 엔드포인트 전체 목록

### 솔직한 한 줄

**API 라우트가 두 개뿐입니다.** REST 라기엔 너무 작고, "서버사이드 OpenAI 프록시" 가 정확한 표현.

### 엔드포인트

| 메서드 | 경로 | 역할 | 응답 시간 |
|---|---|---|---|
| POST | `/api/ai/create-block` | 자연어 한 줄 → 블럭 메타데이터 추출 | 1-3초 |
| POST | `/api/ai/tidy-comprehensive` | 캔버스 전체 분석 → 정리 제안 | 3-8초 |

이 외 `/auth/callback/route.ts` 가 `feature/auth-google` 브랜치에 있지만 master 에 미머지.

### 인증/인가

**현재 없음.** 두 라우트 모두 익명 호출 가능. Vercel 의 기본 rate limit 만 있음.

배포된 layoutnemo.com 에 누가 직접 curl 로 `/api/ai/create-block` 때리면 우리 OpenAI 키로 응답이 옴. **잠재적 abuse 벡터** — 아직 제한 없음.

미래 (Supabase 도입 후): JWT 검사 + per-user rate limit + entitlements 확인.

### 응답 형식 표준

**성공:**
```json
{
  "title": "디자인 시안 검토",
  "summary": "디자인팀 시안 검토 후 피드백 정리",
  "suggestedZone": "design",
  "zoneReason": "디자인 키워드가 명시되어 있어요",
  "suggestedDueDate": "2026-04-30",
  "suggestedUrgency": "urgent",
  "suggestedUrl": "https://figma.com/abc",
  "suggestedTag": null
}
```

**실패:**
```json
{
  "error": {
    "code": "missing_api_key",
    "message": "OPENAI_API_KEY is not configured."
  }
}
```

`code` 는 `"missing_api_key" | "upstream_error" | "invalid_response" | "network_error"` 중 하나. 클라이언트가 이걸 보고 사용자에게 한/영 메시지로 토스트 띄움.

### 외부 API

**OpenAI Chat Completions**
- URL: `https://api.openai.com/v1/chat/completions`
- 모델: `gpt-4o-mini`
- temperature: 0.3 (create-block) / 0.6 (tidy)
- response_format: `{ type: "json_object" }` — JSON 보장
- 인증: `Authorization: Bearer ${OPENAI_API_KEY}`

응답 후 우리는 항상 `zod.safeParse` 로 한 번 더 검증. JSON mode 가 보장한다지만 신뢰하지 않음.

---

## 5. 핵심 사용자 시나리오 3가지

### 시나리오 1 — 새 블럭 만들기 (AI 켬)

**사용자 입장**: 헤더 우측 "새 블럭 만들기" 버튼 클릭 → 다이얼로그 → "디자인 시안 검토 [LAYOUT] https://figma.com/abc 내일까지 급해" 입력 → "다음" 클릭 → AI 가 정리한 미리보기 → 8초 카운트다운 → 자동 생성.

**단계별 흐름:**

1. **UI 동작**
   - `Header` 의 "새 블럭 만들기" 버튼 클릭 → `setIsCreateDialogOpen(true)`
   - `CreateBlockDialog` 가 mount, step 은 `"input"` 상태
   - AI 켬 분기 — 한 줄 입력칸 + "다음" 버튼만

2. **HTTP 요청**
   ```
   POST /api/ai/create-block
   Content-Type: application/json
   
   {
     "userInput": "디자인 시안 검토 [LAYOUT] https://figma.com/abc 내일까지 급해",
     "existingBlocks": [],
     "zones": [{"id":"planning","label":"기획"}, ...],
     "language": "ko"
   }
   ```

3. **백엔드 처리** (`app/api/ai/create-block/route.ts`)
   - `req.json()` 시도. 실패 시 `400 invalid_response` 반환.
   - `OPENAI_API_KEY` 확인. 없으면 `503 missing_api_key` 반환.
   - `CREATE_BLOCK_PROMPT` 에 `{USER_INPUT}`, `{TODAY_DATE}`, `{AREA_LIST}` 치환.
   - `language === "en"` 이면 영문 출력 지시문 추가.
   - OpenAI 호출. 실패 시 `502 upstream_error` 반환.
   - 응답에서 `data.choices[0].message.content` 추출 → `JSON.parse`.
   - `zod.safeParse(createBlockAIOutputSchema)`. 실패 시 `502 invalid_response`.
   - **zone 정규화**: AI 가 zone label 로 응답해도 우리 입력의 zones 배열에서 매칭해 id 로 변환.

4. **DB SQL**
   - **없음.** 이 라우트는 어떤 DB 도 건드리지 않음. 순수 OpenAI 프록시.

5. **응답**
   ```json
   {
     "title": "디자인 시안 검토",
     "summary": "LAYOUT 프로젝트 디자인 시안 검토 후 피드백 정리",
     "suggestedZone": "design",
     "zoneReason": "디자인 시안 검토 업무로 디자인 결에 적합",
     "suggestedDueDate": "2026-04-29",
     "suggestedUrgency": "urgent",
     "suggestedUrl": "https://figma.com/abc",
     "suggestedTag": "LAYOUT"
   }
   ```

6. **프론트 갱신**
   - `CreateBlockDialog.handleInitialSubmit` 가 응답 받음.
   - 각 필드 state 에 setter 호출 (`setTitle`, `setSummary`, `setSelectedZone`, `setUrgency`, `setDueDate`, `setUrl`, `setTag`, `setAiZoneReason`).
   - `setStep("preview")` → preview UI 로 전환.
   - `setAutoConfirmAt(Date.now() + 8000)` → 카운트다운 시작.
   - useEffect 가 `setTimeout(autoCommitBlock, remaining)` + `setInterval(updateCounter, 200ms)` 등록.
   - 8초 동안 사용자 무응답 → `autoCommitBlock` 실행.
   - `findSmartPosition()` 으로 좌표 계산 (같은 zone 의 다른 블럭 근처 / 빈 공간).
   - `onCreateBlock(newBlock)` 호출 → page.tsx 의 `handleCreateBlock` → `saveToHistory(newBlocks)` → `setCanvases` 갱신 → useEffect 가 localStorage 저장.
   - 다이얼로그 닫힘. 캔버스에 새 블럭 등장.

**여기서 좀 지저분한 부분**:
- AI 응답 후 자동 반영 카운트다운이 useEffect deps 에 `autoConfirmAt` 만 있고 `autoCommitBlock` 함수는 클로저로 캡쳐. 사용자가 카운트다운 도중 인풋 수정하면 `cancelAutoConfirm` 이 먼저 동작해서 stale 클로저 호출 안 되지만, 인터랙션 캡쳐 누락 시나리오에서 stale 데이터로 commit 될 가능성 낮게나마 있음. 아직 버그 본 적은 없음.

### 시나리오 2 — 블럭 간 연결 만들기

**사용자 입장**: 캔버스의 블럭 A 를 잡고 드래그 → 블럭 B 위에 살짝 겹쳐 놓음 → 마우스 떼면 두 블럭 사이에 곡선이 나타남.

**단계별 흐름:**

1. **UI 동작 — 드래그 시작**
   - `WorkBlockCard` 의 onMouseDown → `Canvas.handleMouseDown(blockId)` 호출.
   - `setDraggingId(blockId)`, `setOffset({ x: clientX - block.x - pan.x, ... })`
   - `setDragStartPos({ x: block.x, y: block.y })` — 토스 복귀용.

2. **드래그 중**
   - useEffect 가 `mousemove` 윈도우 리스너 등록.
   - 매 mousemove → `onUpdateBlock(draggingId, { x, y }, true)` (skipHistory=true).
   - `handleUpdateBlock` 이 `setBlocks(newBlocks)` — undo 스택은 안 건드림.
   - 매 프레임 React re-render. 블럭 위치 갱신. 관계선 SVG 도 새 좌표로 다시 그려짐.

3. **드래그 끝 — mouseUp**
   - `Canvas` 의 `handleMouseUp` 실행.
   - 갈무리 독에 떨어졌나 검사: 블럭의 화면좌표 vs `[data-archive-dock]` 의 `getBoundingClientRect()` overlap.
     - 떨어졌으면 `onUpdateBlock(id, { isCompleted: true, x: dragStartPos.x, y: dragStartPos.y })`. 좌표 복원해서 꺼낼 때 원래 자리로.
   - 아니면 다른 블럭과 실제로 겹쳤나 검사: `b.x..b.x+w`, `b.y..b.y+h` 박스 교차.
     - 겹친 블럭들 = `overlappingBlocks`.
     - `newConnections` = `overlappingBlocks` 중 아직 연결 안 된 것들.
     - **양방향 동기화**: 드래그한 블럭의 `relatedTo` 에 추가 + 각 상대 블럭의 `relatedTo` 에도 추가.
     - `e.shiftKey` 면 = 토스 모드: `dragStartPos` 로 복귀 좌표 같이 update.
     - `onBatchUpdateBlocks(updates)` 호출 — 한 번의 history 스냅샷으로.

4. **DB SQL**
   - 없음. localStorage 만 갱신.

5. **응답**
   - 함수 호출이라 응답 개념 X.
   - `setBlocks` 후 React re-render → `Canvas.renderRelationshipLines()` 가 새 `relatedTo` 보고 SVG path 그림.

6. **프론트 갱신**
   - `Canvas` 안의 SVG `<g>` 에 `<path>` 가 추가됨.
   - 곡선 d 속성: `clipToRect` 로 두 블럭 가장자리에서 끊고, 수직 normal 벡터로 약간 휜 베지어.
   - `feGaussianBlur` 필터 (`#lineGlowDark` / `#lineGlowLight`) 로 외곽광.
   - 새 라인은 `lineFadeIn` 키프레임으로 220ms fade-in.

**확신 없는 부분**:
- TOLERANCE 가 한 번 30 이었다가 0 으로 바뀜 (사용자 피드백). 0 이 정확한지 4-8 정도 두는 게 사용감 더 좋을지 아직 안 확신.
- 양방향 `relatedTo` 동기화 — 코드 책임이라 한쪽만 업데이트되는 버그 가능성 항상 있음. 데이터 손상 시 절단 자동 복구 로직 없음.

### 시나리오 3 — 처음 켜고 자기 데이터 불러오기

**사용자 입장**: layoutnemo.com 접속. 새로고침 한 번 하고 잠깐 검은 화면 → 익숙한 캔버스가 옛 그대로 등장.

**단계별 흐름:**

1. **HTML 받음**
   - Vercel CDN → 정적 HTML + JS 번들 (Next.js 빌드 산출물).
   - `<title>LAYOUTNEMO — 캔버스 위 사고 공간</title>` (Accept-Language 따라 영문 분기).
   - favicon: `app/icon.svg` (라이트/다크 자동 전환).

2. **JS 실행 시작**
   - React 마운트. `app/page.tsx` 의 `Page` 컴포넌트 렌더 시작.
   - `useState(getDefaultCanvas())` 로 초기 state — **기본 가이드 블럭 + 예시 블럭들**.
   - 동시에 `useState(false)` 로 `isClient = false`.

3. **첫 렌더 — 사용자에게 안 보임**
   - `if (!isClient) return <빈 배경 div />`
   - 사용자 눈에는 빈 배경(다크/라이트 색만) 만 보임. **약 100-300ms.**
   - 이건 의도된 동작: 아래 4단계에서 localStorage 로드 직전이라, 옛 default 데이터를 보여주면 "옛 위치 → 저장 위치 점프" 가 보임. 그래서 첫 렌더는 빈 배경.

4. **useEffect (mount once)**
   - `setIsClient(true)`.
   - `loadCanvases()` — `localStorage.getItem("layout_canvases")` JSON.parse → `migrateCanvas` 통과.
     - migrateCanvas: 옛 zone id ("personal" → "daily" 등) 매핑 + 갈무리 블럭 originalState 복구.
   - `setCanvases(loaded)`, `setCurrentCanvasId(loaded.id)`.
   - history 첫 스냅샷 등록.
   - LanguageProvider, AuthProvider(현재 비활성), darkMode 등 다른 useEffect 들이 같이 발동.

5. **DB SQL**
   - 없음. localStorage 만 읽음.

6. **두 번째 렌더 — 진짜 화면**
   - `isClient = true` 라 본문 렌더.
   - Header (로고 / 캔버스 이름 / 결 버튼 / 도구 / AI 토글 / 새 블럭 만들기 / 정리하기).
   - Canvas (블럭 카드들 + 관계선 SVG + 갈무리 독).
   - 블럭 카드 마운트 시 `WorkBlockCard` 의 ResizeObserver 가 실제 렌더 높이 측정 → stored `block.height` 와 다르면 `onUpdate({ height }, skipHistory=true)` 로 동기화. (hit-test 정확도 위해.)
   - 관계선이 `lineFadeIn` 으로 부드럽게 등장.

**여기서 좀 지저분한 부분**:
- `migrateCanvas` 가 "옛 데이터 마이그레이션" 코드라 시간이 가면 더 누적될 가능성. 현재는 zone id 매핑 + 갈무리 originalState 복구 두 가지.
- localStorage 가 가득 차면? 5MB 한도. 아직 한 번도 본 적 없지만 1000개 블럭+이미지 첨부 들어가면 위험. 처리 X.

---

## 6. AI 개입 부분

### 어떤 AI 기능

**1. 블럭 생성 보조** (POST `/api/ai/create-block`)
- 자연어 한 줄 → 제목 / 1줄 요약 / 결 / 시급도 / 기한 / 태그 / 외부 링크 자동 추출.
- 사용자가 8초 안에 응답 안 하면 자동 반영 (취소 가능).

**2. 정리하기 (Reflect)** (POST `/api/ai/tidy-comprehensive`)
- 캔버스의 모든 블럭을 분석.
- 같은 태그/결 묶음, 위치 분산도, 잠재 연결 후보 등을 사전 계산해서 프롬프트에 같이 보냄.
- AI 가 위치/연결/결/시급도 변경 제안을 우선순위 순으로 최대 6개 반환.
- 사용자가 한 번에 하나씩 수락/거절. 수락한 것만 적용.

### 어디서 어떻게 호출

- **클라이언트 (`lib/ai/aiClient.ts`)**: fetch 로 우리 API 라우트 호출. 실패 시 `AIError` throw.
- **서버 (`app/api/ai/*/route.ts`)**: OpenAI Chat Completions 호출. 응답 zod 검증 후 반환.
- **호출 측 컴포넌트 (`components/create-block-dialog.tsx`, `components/reflection-dialog.tsx`)**: 결과 받아서 UI 갱신. 실패 시 토스트 + fallback (mockCreateBlockOutput 키워드 추론).

### 입력/출력 구조

블럭 생성 입력:
```ts
{
  userInput: string
  existingBlocks: { id, title, zone, urgency }[]
  zones: { id, label }[]
  language: "ko" | "en"
}
```

블럭 생성 출력:
```ts
{
  title: string
  summary: string
  suggestedZone: string  // zone id
  zoneReason: string
  suggestedDueDate: string | null  // YYYY-MM-DD
  suggestedUrgency: "stable" | "thinking" | "lingering" | "urgent"
  suggestedUrl?: string | null
  suggestedTag?: string | null
}
```

정리하기 입력:
```ts
{
  blocks: { id, title, description, zone, urgency, x, y, relatedTo, isCompleted, tag }[]
  zones: { id, label }[]
  language: "ko" | "en"
}
```

정리하기 출력:
```ts
{
  stage: { stage, message, progress }
  analysis: {
    totalBlocks, completedBlocks,
    zoneDistribution, connectionIssues,
    positionIssues, urgencyIssues,
    overallHealth, insight
  }
  suggestions: [{
    id, type, priority,
    blockIds, question,
    changes: [{ blockId, field, currentValue, suggestedValue, reason }]
  }]
}
```

### 사용자 승인 흐름

블럭 생성:
1. AI 응답 → preview UI 에 자동 채움.
2. 8초 카운트다운 시작. 사용자 인터랙션 시 즉시 취소.
3. 자동 반영 / 사용자 명시 확인 / 사용자 편집 후 확인 — 셋 다 같은 `onCreateBlock` 호출로 수렴.

정리하기:
1. AI 응답 → 첫 번째 제안 표시.
2. 사용자 [수락 / 건너뛰기] 선택.
3. 수락 시 `applyChanges` 가 해당 블럭 수정 후 `onUpdateBlocks` 호출.
4. 다음 제안으로 진행. 끝까지 가면 결과 요약.

### 우선순위 로직 (정리하기)

`calculateBlockSimilarity` 가중치:
| 신호 | 점수 |
|---|---|
| 같은 태그 | +60 |
| 같은 결 | +25 |
| 제목/설명 토큰 매칭 | 최대 +20 |
| 같은 시급도 | +5 |
| 위치 근접 | 최대 +15 |

50점 이상 페어를 "잠재 연결 후보" 로 프롬프트에 동봉. AI 가 그 위에서 제안 작성.

### 솔직한 한 줄

**AI 의존도는 의도적으로 낮게 유지.** 핵심 가치(블럭 생성, 결로 분류, 자동 연결, 갈무리, 정리하기)는 AI 끄고도 모두 동작. AI 는 "빠르게 채워주는" 보조일 뿐.

---

## 7. 보안과 데이터 처리

### 솔직한 한 줄

**현재 인증 시스템이 없습니다.** 모든 데이터가 사용자 브라우저의 localStorage. 다른 사용자가 내 데이터에 접근할 방법 자체가 없음 — 한 기기 / 한 브라우저 / 한 도메인 안에서만 격리.

### 인증 흐름 (현재 — 없음)

`feature/auth-google` 브랜치에 코드가 있지만 master 미머지. 활성화되면:
- Supabase Auth 의 Google OAuth.
- `supabase.auth.signInWithOAuth({ provider: "google" })`.
- 콜백 라우트 `/auth/callback` 이 코드 → 세션 쿠키 교환.
- 세션은 httpOnly 쿠키. 클라이언트 JS 에서 직접 못 봄.
- `AuthProvider` 가 mount 시 `getSession()` + `onAuthStateChange` 구독.

### 데이터 격리 (현재)

- localStorage 는 origin 별로 격리. layoutnemo.com 의 localStorage 는 layoutnemo.com 외에서 못 읽음.
- 같은 도메인 안에서는 모든 사용자 = 같은 데이터 풀. 가족이 같은 컴퓨터/같은 브라우저 쓰면 데이터 공유됨.

미래 (Supabase + RLS):
- 모든 테이블에 `user_id` 컬럼 + RLS 정책 `auth.uid() = user_id`.
- 다른 사용자 row 에 SELECT/UPDATE 시도해도 0 rows 반환.

### 민감한 데이터

**저장하는 민감 데이터**:
- 사용자가 블럭 본문 / 메모에 적은 내용. 프라이버시 책임은 사용자.
- 외부 링크 URL.
- 마감일.

**사용자 신원 정보** — 현재 0. (이메일도 없음)

**API 키** (`OPENAI_API_KEY`) — 서버 환경변수. 클라이언트 노출 X. Vercel Environment Variables 에 저장.

**서비스 안의 비밀** — 거의 없음. 가이드 텍스트, 시드 데이터 모두 공개돼도 무방.

---

## 8. 운영과 모니터링

### 배포 환경

- **production**: master → Vercel 자동 배포 → https://layoutnemo.com
- **preview**: 모든 PR 마다 Vercel 이 자동 preview 배포.
- **블로그**: gh-pages → GitHub Pages.

### 모니터링/로그

**거의 없음.**
- Vercel 대시보드에서 기본 함수 호출 / 에러 / 트래픽 로그 볼 수 있음. 그게 전부.
- Sentry / Datadog 같은 APM 없음.
- 사용자 분석(GA, Mixpanel) 없음.
- `console.error` 가 떴다 사라지는 게 우리가 가진 디버깅 정보의 전부.

`@vercel/analytics` 가 코드에 import 되어 있으나 주석처리. 아직 활성화 안 함.

### 백업

- localStorage 는 사용자 기기에. **백업 X**. 사용자가 브라우저 데이터 지우면 사라짐.
- 코드는 GitHub 에. 그게 백업.
- DB 가 없으므로 DB 백업 X.

미래 (Supabase): Supabase Pro 플랜은 자동 7일 백업. 무료 플랜은 백업 X — 직접 pg_dump 스케줄 필요.

### 알림 / 인시던트 대응

**아직 없음.** 사이트가 다운돼도 우리가 모름. 사용자가 알려주거나 우리가 우연히 발견.

---

## 9. 알려진 제약사항과 향후 개선 계획

### 임시방편 / 기술 부채

**1. localStorage 만이 데이터 저장소**
- 다기기 동기화 불가. 한 기기에서만 데이터 유지.
- 5MB 한도. 큰 캔버스는 위험.
- 브라우저 데이터 삭제 = 데이터 손실.
- **계획**: Supabase 로 옮기는 v2 작업. ARCHITECTURE.md 에 설계만 있음.

**2. 인증 없음**
- 누구든 layoutnemo.com 의 AI 라우트 직접 호출 가능 → 우리 OpenAI 비용으로 응답.
- **rate limit 도 없음**. 누가 의도적으로 abuse 하면 비용 폭주.
- **계획**: Phase 2 에서 Supabase Auth + per-user rate limit + entitlements (무료 = AI 차단 / 유료 = 크레딧 기반).

**3. AI 응답 검증의 한계**
- zod 로 구조 검증은 함. 의미적 검증은 안 함 — AI 가 헛소리 zone 을 추천해도 통과.
- 개선 여지 있지만 우선순위 낮음.

**4. relationship line `relatedTo` 양방향 동기화는 코드 책임**
- 한 쪽만 업데이트되는 버그가 발생할 위험 항상 있음. 현재 본 적은 없지만 자동 정합성 검사도 없음.
- **계획**: v2 에서 `block_relations` 별도 테이블로 빼면 자연스럽게 풀림.

**5. 캔버스 스케일/줌 없음**
- 데모 버전에 줌 있었다가 뺐음 (좌표 변환 비용 + 시각 위계 흐트러짐).
- 큰 캔버스에서 멀리서 보는 게 안 됨. 팬으로만 이동.

**6. 모바일 대응 안 함**
- Touch 이벤트 미지원. 모바일에선 사실상 불가.
- 화면 크기 적응도 안 됨 (max-w-2000 고정).

**7. `ignoreBuildErrors: true` 가 한 번 켜져 있던 흔적**
- 이미 끔. 그때 9개 타입 에러를 숨기고 있었음.
- 비슷한 함정이 또 있을 수 있다는 걸 잊지 말아야 함.

**8. Tailwind 임의값 남발**
- `text-[13px]`, `bg-[#151823]` 등이 흩어져 있음. 디자인 토큰화 안 됨.
- 한 번 정리할 때가 곧 옴.

**9. 가이드 블럭 한국어/영어 번역이 시드와 인라인 코드 양쪽에 있음**
- `lib/i18n/seed.ts` 와 `app/page.tsx` 의 `initialBlocks` 가 같은 텍스트 두 번 적힘. 갱신 시 둘 다 손대야 함.
- 이유: edit-detection 위해 시드의 ko 원본을 비교 기준으로 써야 해서. 분리 어려움.

**10. AI prompt 가 모듈화 안 됨**
- 한 파일(`lib/ai/prompts.ts`) 에 두 개의 큰 프롬프트가 한 줄짜리 const 로. 부분 재사용 X.
- 영문/한글 지시문이 라우트마다 중복 작성.

**11. 가이드 detailedNotes 가 길어질수록 i18n 동기화 비용 증가**
- 언젠가 가이드를 마크다운 파일로 빼는 게 나을 듯.

### 사용자 늘면 개선해야 할 부분

| 사용자 수 | 우선 처리할 것 |
|---|---|
| 100 | AI 라우트 rate limit. Vercel Edge Middleware 로 IP 기반. |
| 500 | Supabase Auth + 데이터 sync. v2 본격. |
| 5,000 | 결제 / entitlements. 유료 티어 진입. |
| 20,000+ | DB 인덱스 / 캐싱 / 모니터링 (Sentry 등). |

### 확신 없는 설계 결정

**1. Tag 를 `string` (단일) 로 한 것**
- 처음엔 `tags: string[]` 으로 갈까 했는데 카드에 표시할 자리 부족 + 사용자 인지 부담.
- 하나만 두면 "한 블럭은 한 프로젝트" 의 깔끔함.
- 단점: 한 블럭이 두 프로젝트에 걸치면 표현 어려움. 사용자 피드백 보고 결정 필요.

**2. Undo 가 zones 변경은 안 잡는 것**
- 의도였는지 누락이었는지 모호. `handleUpdateZones` 가 `saveToHistory` 를 안 거침.
- 사용자가 "결을 실수로 지웠는데 undo 가 안 돼" 같은 피드백 주면 그때 결정.

**3. 갈무리를 `isCompleted` flag 로 한 것**
- `isArchived` 가 더 이름이 정확하지만 처음엔 "완료" 메타포라 isCompleted 로 박힘.
- 코드 곳곳에서 `isCompleted` 로 분기 → 이름 바꾸려면 큰 작업.
- 그대로 두는 중. 코멘트로 "= 갈무리됨" 명시.

**4. v2 아키텍처 선택**
- Supabase 가 정말 맞나? Convex / PlanetScale / Neon 등 대안 진지하게 비교 안 함.
- Supabase 의 Auth+Postgres+Realtime+RLS 한 패키지가 매력적이라 그쪽으로 굳힘.
- 잘못된 선택일 가능성 — Realtime 의 latency/limit, RLS 정책 설계 복잡도 등 실제 부딪혀봐야 앎.

---

## 끝

이 글은 작성 시점(2026-04-28) 기준입니다. v2(Supabase) 작업이 본격 시작되면 큰 부분이 바뀝니다.

**한 줄 요약**: 현재 LAYOUTNEMO 는 클라이언트사이드 단일 페이지 앱 + OpenAI 프록시 두 개. 데이터 저장소는 localStorage. v2 에서 Supabase 로 옮길 계획이지만 아직 안 함. AI 는 도와주는 보조이고 끄도 모든 핵심 기능 동작.

이 시스템의 가장 큰 강점은 **로컬-퍼스트라 빠르고 단순**. 가장 큰 약점은 **다기기 동기화 안 되고 인증 없음**. v2 가 그 약점을 풀러 가는 작업.

---

_작성: 2026-04-28 / `feature/block-link-and-tags` 머지 직후 / 시스템 전체를 한 번 정리하는 의미로._
