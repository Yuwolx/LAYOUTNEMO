# 🔍 CODE REVIEW — 2026-04-24

> `feature/local-improvements` 브랜치 기준 초기 코드베이스 리뷰.
> 이전에 v0 + 바이브 코딩으로 만들어진 4일 데모 버전의 흔적들을 전수조사했다.
> 우선순위(🚨 / ⚠️ / 💡) 로 분류.

---

## 🚨 P0 — 즉시 고쳐야 하는 것 (빌드/타입 안전성 저해)

### 🚨 1. `next.config.mjs` — TypeScript 에러 무시 설정 ⭐ 최악

**파일**: `next.config.mjs`
```js
typescript: {
  ignoreBuildErrors: true,   // ← 이거 진짜 위험함
}
```

**뭐가 문제냐**
- TypeScript 에러가 있어도 **빌드가 통과**함.
- 즉 **타입 안전성이 사실상 없음**. 런타임 가서야 터짐.
- 아래 2번, 3번 같은 명백한 오류들이 이 설정 때문에 빌드 성공함.

**어떻게 고칠까**
```js
typescript: {
  // ignoreBuildErrors: true,  // 제거
}
```
제거하고 빌드 돌려보면 아마 여러 개 터질 거다. **그 에러들을 전부 잡은 뒤** 다시 빌드 성공시키는 게 정상 상태. 설정만 제거하고 "빌드 안 되네" 라고 포기하면 의미 없음.

---

### 🚨 2. `components/work-block-card.tsx:9` — 잘못된 import 경로

```ts
import type { WorkBlock } from "@/types/work-block" // Added import for WorkBlock
```

**뭐가 문제냐**
- `types/` 디렉토리에는 `index.ts` 만 있음. `work-block.ts` 같은 파일 **없음**.
- 다른 모든 컴포넌트는 `@/types` 에서 import 하고 있음 (일관성 깨짐).
- 주석 `// Added import for WorkBlock` 이 붙어있어서 **AI 어시스턴트가 이 경로를 만든 뒤 실제로 파일이 존재하는지 확인 안 함**을 암시함.
- `ignoreBuildErrors: true` 덕에 빌드 통과 중이지만, **런타임 import 실패**하거나 **TypeScript 가 `any` 로 추론**하고 있음.

**수정**
```ts
import type { WorkBlock } from "@/types"
```

---

### 🚨 3. `types/index.ts` — `WorkBlock` 타입 누락 필드

```ts
export interface WorkBlock {
  id: string
  title: string
  // ...
  isAIControl? 는 어디에도 없음
  aiEnabled? 도 없음
}

export interface AIControlBlock extends WorkBlock {
  isAIControl: true
  aiEnabled: boolean
}
```

**뭐가 문제냐**
- `WorkBlock` 에는 `isAIControl`, `aiEnabled` 가 **없는데**, 코드에서는 `block.isAIControl`, `block.aiEnabled` 를 전제로 읽고 있음:
  - `app/page.tsx:291, 331, 332`
  - `components/work-block-card.tsx:54-55, 74, 77, 78`
- 별도 `AIControlBlock` 이 있지만, **실제로는 섞어서** 쓰고 타입 단언 없음.
- 역시 `ignoreBuildErrors` 로 숨겨진 문제.

**수정 방향**
옵션 A — `WorkBlock` 자체에 선택적 필드로 병합:
```ts
export interface WorkBlock {
  // ...기존 필드
  isAIControl?: boolean
  aiEnabled?: boolean
}
// AIControlBlock 제거 (이 파일에선 쓰지 않음)
```

옵션 B — 완전 분리하고 discriminated union 으로:
```ts
type BlockOrAIControl = WorkBlock | AIControlBlock
```
그리고 `if ("isAIControl" in block)` 로 타입 가드.

→ 현재 규모엔 **옵션 A 가 실용적**. 코드 수정 최소.

---

### 🚨 4. 가이드 블럭의 긴급도 설명이 실제 구현과 불일치

**파일**: `app/page.tsx:55-59`

```
• Urgent (빨강): 지금 해야 할 일
• Thinking (주황): 고민이 필요한 일
• Lingering (노랑): 계속 미루고 있는 일
• Stable (초록): 안정적으로 진행 중
```

**실제 구현 색상** (`components/work-block-card.tsx:23-35`):

| urgency | 가이드 블럭의 설명 | 실제 구현 |
|---------|-------------------|-----------|
| stable | 🟢 **초록** | ⚪ 회색 (shadow 기반) |
| thinking | 🟠 **주황** | 🔵 **파란색** `rgb(59,130,246)` |
| lingering | 🟡 **노랑** | 🟡 노랑 `rgb(251,191,36)` ✅ |
| urgent | 🔴 **빨강** | 🟠 **주황색** `rgb(251,146,60)` |

**→ 유저에게 보여주는 공식 설명이 실제 앱 색상과 다름.** 4개 중 3개 틀림.

**수정**: `app/page.tsx` 의 가이드 블럭 텍스트를 **실제 색상에 맞춰** 갱신.

---

### 🚨 5. 시급도 라벨이 컴포넌트마다 다름

**`components/block-detail-dialog.tsx:19-24`** — 하나의 라벨 셋
```ts
stable: "안정적 (회색)"
thinking: "생각 중 (파란색)"
lingering: "머물러 있음 (노란색)"
urgent: "시급함 (주황색)"
```

**`components/create-block-dialog.tsx:343-346`** — 전혀 다른 라벨 셋
```ts
stable  → "안정"
thinking → "보통"        // ← "보통"?? 이건 완전 잘못된 라벨
lingering → "주의"
urgent → "시급"
```

**뭐가 문제냐**
- 같은 `urgency = "thinking"` 을 한 곳에선 **"생각 중"**, 다른 곳에선 **"보통"** 이라고 부름.
- 사용자가 혼란스러움.
- **"보통"** 은 심지어 `thinking` 의 의미와 거리가 먼 라벨 (기획 문서의 "Normal" 단계와 혼동된 흔적).

**수정 방향**

라벨 테이블을 **한 곳에 정의** 하고 import:
```ts
// lib/constants/urgency.ts (신규 파일)
export const URGENCY_LABELS = {
  stable:    { ko: "안정", color: "회색" },
  thinking:  { ko: "생각 중", color: "파란색" },
  lingering: { ko: "머물러 있음", color: "노란색" },
  urgent:    { ko: "시급", color: "주황색" },
} as const
```

모든 컴포넌트에서 이걸 import 해서 사용. 단일 소스.

---

## ⚠️ P1 — 가까운 시일 내 정리 (일관성 / 관리성)

### ⚠️ 6. 바이브 코딩 흔적 — 불필요한 AI 주석

**`components/work-block-card.tsx`**
```ts
Line 9:  import type { WorkBlock } from "@/types/work-block" // Added import for WorkBlock
Line 20: isCopyMode?: boolean // Added isCopyMode prop
Line 46: isCopyMode = false, // Added isCopyMode with default value
```

**뭐가 문제냐**
- 이 주석들은 **AI 어시스턴트가 자기 변경 사항 라벨링한 흔적**. 코드에 전혀 기여하는 정보 없음.
- "what the code does" 가 아니라 "what I added" 를 설명하는 주석 = 의미 없음.
- 프로덕션 코드에 남겨둘 이유 없음.

**수정**: 전부 삭제.

---

### ⚠️ 7. `lib/ai/aiClient.ts` — 거대한 주석 블럭

**파일 최상단 1~48 줄** 가 전부 **예시 코드를 보여주는 주석**.

```
// ============================================
// AI Integration Guide
// ============================================
// GPT API는 반드시 서버 사이드에서 호출해야 합니다.
// ... (48줄 동안 예시 코드가 주석으로 있음)
```

**뭐가 문제냐**
- 이미 실제 구현이 **바로 아래에 있음**. 주석 내용이 **중복**.
- 이런 가이드는 **README 나 docs/** 에 있어야 함. 런타임 모듈 파일에 있을 이유 없음.
- AI 가 생성한 "설명용 주석" 이 그대로 방치된 것.

**수정**: 전체 주석 블럭 삭제 → 파일 첫 줄은 `import ...` 부터.

---

### ⚠️ 8. `lib/ai/types.ts` — `any` 사용

```ts
Line 46: newValue: any
Line 80: currentValue: any
Line 81: suggestedValue: any
```

**뭐가 문제냐**
- 정리하기 제안에서 필드별 변경값을 표현하는 부분. 필드가 `relatedTo`(string[]), `x`/`y`(number), `urgency`(enum), `zone`(string) 등 이질적이라 `any` 로 처리한 듯.
- 하지만 `any` 는 **타입 안전성을 포기한다는 선언**.

**수정 방향**

유니온 타입으로 바꾸기:
```ts
type FieldChangeValue = string | number | string[] | null
```
또는 판별 유니온 사용:
```ts
type FieldChange =
  | { field: "relatedTo"; currentValue: string[]; suggestedValue: string[] }
  | { field: "x" | "y"; currentValue: number; suggestedValue: number }
  | { field: "urgency"; currentValue: Urgency; suggestedValue: Urgency }
  | { field: "zone" | "title" | "description"; currentValue: string; suggestedValue: string }
```
후자가 **진정한 타입 안전**. 런타임 분기에도 도움.

---

### ⚠️ 9. Zone 네이밍 — 블로그 기준과 불일치

**`app/page.tsx:13-18`**
```ts
const initialZones: Zone[] = [
  { id: "planning",    label: "기획" },
  { id: "development", label: "개발" },
  { id: "operations",  label: "운영" },      // 블로그 기준은 "디자인"
  { id: "personal",    label: "개인 생각" }, // 블로그 기준은 "마케팅", "일상"
]
```

**블로그 / ARCHITECTURE.md 의 기본 결 5개** (ARCHITECTURE 에 선언됨):
```
기획 / 개발 / 디자인 / 마케팅 / 일상
```

**뭐가 문제냐**
- 코드의 기본 Zone 과 설계 문서의 "기본 결 시드" 가 다름.
- v2 아키텍처에서 맞추기로 했는데, **v1 단계에서도 미리 맞춰두는 게** 마이그레이션 비용을 줄임.
- "운영" / "개인 생각" 은 원래 이 서비스가 겨냥한 결 네이밍도 아님 (기획 방향 참조).

**수정**: `initialZones` 를 `기획 / 개발 / 디자인 / 마케팅 / 일상` 5개로 교체.
색상도 Tailwind 디자인 토큰 쪽으로 정리하면 더 좋음 (아래 11번 참조).

---

### ⚠️ 10. 다크모드 하드코딩 색상

**`components/work-block-card.tsx`**
```
Line 121: bg-white border-border/60
Line 143: text-black
Line 148: text-zinc-700
Line 205: text-zinc-700
```

**`components/header.tsx:93`**
```
bg-white text-gray-900 border-gray-200
```

**뭐가 문제냐**
- `bg-white`, `text-black`, `text-zinc-700` 은 **다크모드를 고려하지 않은** 하드코딩.
- 다크모드에서 블럭 카드의 텍스트 가독성이 떨어질 가능성.
- Tailwind v4 에선 `bg-background`, `text-foreground` 같은 **시맨틱 토큰** 을 써야 다크모드에서 자동 반전됨.

**수정**:
- `bg-white` → `bg-card` 또는 `bg-background`
- `text-black` → `text-foreground`
- `text-zinc-700` → `text-muted-foreground` 또는 `text-foreground/80`
- 꼭 특정 색이 필요하면 `dark:` 변형 추가: `bg-white dark:bg-zinc-900`

---

### ⚠️ 11. Zone 색상 — rgba 하드코딩

**`app/page.tsx:13-18`**
```ts
color: "rgba(147, 197, 253, 0.1)"  // 매직 넘버
color: "rgba(167, 243, 208, 0.1)"
color: "rgba(254, 215, 170, 0.1)"
color: "rgba(221, 214, 254, 0.1)"
```

**뭐가 문제냐**
- 의미를 알 수 없는 RGB 숫자.
- 변경이 어렵고, Tailwind 디자인 시스템과 동떨어짐.

**수정 방향**: 상수로 이름 짓기 또는 Tailwind 팔레트 활용:
```ts
color: "bg-blue-100/10"    // or 디자인 토큰 이름
```

---

### ⚠️ 12. Undo 히스토리 — 전체 canvases 배열을 50개 복사

**`app/page.tsx:239, 297-317`**
```ts
const [history, setHistory] = useState<CanvasType[][]>([[getDefaultCanvas()]])
```

**뭐가 문제냐**
- 매 action 마다 **전체 canvases 배열의 deep-copy 수준 스냅샷** 을 쌓음.
- 캔버스가 여러 개이고 블럭이 많아지면 **메모리 소비가 빠르게 증가**.
- 50개 제한이 있지만, 그래도 낭비.

**수정 방향**

- 현재 캔버스의 **blocks 배열만** 저장하고 canvas meta 는 참조 유지
- 또는 **change-based history** (immer patches, redux-style actions) 사용
- 작은 규모에선 현재가 허용 범위이긴 함 — 🟡 **긴급하지 않음**. 리팩터링 시 개선 대상.

---

### ⚠️ 13. 패키지 매니저 혼용 — lockfile 두 개

```
package-lock.json (157KB)
pnpm-lock.yaml (96B)
```

**뭐가 문제냐**
- npm / pnpm 둘 다 쓰면 **의존성 버전이 어긋날 수 있음**.
- 96B 짜리 pnpm-lock 은 거의 비어있는 상태 — 과거 시도의 흔적.
- CI 에서 어느 쪽을 쓸지 혼란.

**수정**: **하나만 선택해서 유지.** `npm install` 쓰고 계시니 npm 고정:
```bash
rm pnpm-lock.yaml
# 그리고 .gitignore 에 pnpm-lock.yaml 추가 해도 OK
```

---

## 💡 P2 — 여유 있을 때 정리 (스타일 / 관습)

### 💡 14. `readme.md` 파일명

관례상 **`README.md` (대문자)**. GitHub 은 어느 쪽이든 인식하지만, 대문자가 표준.
```bash
git mv readme.md README.md
```

### 💡 15. 개발자 개인정보 프로덕션 블럭에 포함

**`app/page.tsx:111-119`** (developer-info guide block):
```
📧 이메일: yuwolxx@gmail.com
👨‍💻 개발자: 권혁준
```

의도적이라면 OK. 단:
- "연락 원하면 피드백" 같은 문구로 **공식화** 하거나
- **Footer 로 옮기는** 걸 추천 (가이드 블럭에 박혀있는 건 좀 어색함)

### 💡 16. 가이드 블럭들 — 삭제 가능 여부

`isGuide: true` 블럭 3개 (사용설명서 / 단축키 / 개발자 정보) 가 하드코딩으로 시드됨.
- 사용자가 지워도 새로 띄우면 **다시 나타나는지** 확인 필요
- 한 번 닫으면 다시 안 뜨는 게 UX 적으로 좋음 (localStorage 플래그로 관리 필요)

### 💡 17. `components/ui/` — shadcn 컴포넌트 전수 정리 여부

shadcn 이 설치해준 UI 컴포넌트가 많지만, 실제로 쓰는 건 일부. tree-shaking 덕에 번들에는 포함 안 되지만, **레포 뎁스가 깊어 보이는** 단점. 유지 OK.

### 💡 18. 테스트 전무

`package.json` 의 `scripts` 에 `test` 가 없음. 지금은 규모가 작아 생략 가능하지만, 리팩터링 시 중요 플로우만이라도 E2E (Playwright) 로 최소 보증하는 걸 권장.

---

## 📋 정리 — 권장 작업 순서

아래 순서로 진행하면 **점점 위험이 줄어드는 방향**으로 정리됨.

### 1단계: 타입 안전망 복구 (0.5일)
- [ ] **#1** `ignoreBuildErrors` 제거
- [ ] **#2** 잘못된 import 경로 수정
- [ ] **#3** `WorkBlock` 에 `isAIControl`, `aiEnabled` 필드 추가
- [ ] `npm run build` 통과 확인

### 2단계: 거짓말 고치기 (0.5일)
- [ ] **#4** 가이드 블럭 색상 설명 실제 구현에 맞춤
- [ ] **#5** 시급도 라벨 통일 (`lib/constants/urgency.ts` 신설)

### 3단계: 설계 문서와 정합 (0.5일)
- [ ] **#9** Zone 기본 5개 → 기획/개발/디자인/마케팅/일상

### 4단계: 청소 (반나절)
- [ ] **#6** AI 주석 전부 제거
- [ ] **#7** `aiClient.ts` 최상단 가이드 주석 제거
- [ ] **#8** `any` 제거 또는 판별 유니온 도입
- [ ] **#10** 하드코딩 색상 → 시맨틱 토큰
- [ ] **#11** Zone 색상 정리
- [ ] **#13** pnpm-lock.yaml 제거
- [ ] **#14** `readme.md` → `README.md`

### 5단계: 구조 개선 (옵션)
- [ ] **#12** Undo 히스토리 최적화
- [ ] **#15~18** 나머지

---

## 💬 종합 평가

> 4일짜리 데모 버전 치고 **핵심 UX 는 충분히 완성도 있게 구현됨**. 드래그·자동 연결·정리하기·AI 토글 등 "서비스의 영혼" 에 해당하는 부분은 기능한다.
>
> 다만 **타입 안전성을 빌드에서 꺼둔 것** 이 가장 큰 부채다. `ignoreBuildErrors` 하나가 이 파일 전체 리뷰의 절반을 책임진다 — 껐다가 켜면 위에 나열한 문제들이 전부 빌드 에러로 드러날 가능성.
>
> **바이브 코딩의 흔적** (AI 가 쓴 설명 주석, 실제와 거짓말하는 가이드 텍스트, 일관성 없는 라벨) 이 곳곳에 있음. 한 번 깨끗이 청소하고 가면, 이후 기능 개발 속도가 눈에 띄게 올라갈 것.

---

_이 리뷰는 2026-04-24 Claude 가 수행했으며, 구현 관련 판단은 사용자의 최종 승인을 전제로 한다._
