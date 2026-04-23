# 📦 DEMO_LEGACY — LAYOUTNEMO 데모 버전 기록

> 이 파일은 **LAYOUTNEMO의 데모 버전(2025-12-18 ~ 12-21 4일 프로젝트)**에 대한 기록입니다.
> **블로그에 올라갈 용도**: "데모 버전 회고" 성격의 글. 과거의 발자취, 초기 기획과 현실의 갭을 보여주는 추억용 문서.
> 블로그 배포 제외 (`_config.yml`의 exclude에 포함).
>
> **⚠️ 이 안의 내용은 "과거" 입니다.** 앞으로 가져갈 현재/미래의 기준은 `WORKSPACE.md`를 보세요.
>
> - Notion 원문(7개 문서) 전체 수록
> - 당시 기획/구현/배포 상태 그대로 보존
> - 이후 바뀐 결정은 각 섹션 말미의 **"이후 바뀐 점"** 블록에 기록

---

## 📚 수록된 원문 목록

1. [서비스 설명 (Service Description)](#1-서비스-설명-service-description)
2. [개발 후기](#2-개발-후기)
3. [데이터 구조 (설계 청사진)](#3-데이터-구조-설계-청사진)
4. [정리하기 기능 + 수정 가이드](#4-정리하기-기능--수정-가이드)
5. [시행 로그 — UI 개발 과정](#5-시행-로그--ui-개발-과정)
6. [전체 파일 구조 & 핵심 파일 해설](#6-전체-파일-구조--핵심-파일-해설)
7. [도메인 & 배포 운영](#7-도메인--배포-운영)

---

## 1. 서비스 설명 (Service Description)

> **출처**: 초기 서비스 설명 문서 (Notion)
> **서비스명 표기 당시**: "LAYOUT" (이후 LAYOUTNEMO로 통일)

### 서비스 철학 6가지 (당시 기획)

1. **생각의 흐름을 그대로 표현** — 화이트보드+포스트잇 느낌, 자유 배치
2. **관계 중심 사고** — 블럭 간 선으로 의존성/흐름 시각화
3. **영역(Zone)으로 맥락 분리** — 디자인/개발/마케팅 등 역할별 색상 구분
4. **시급도 기반 우선순위** — 5단계 (Urgent/Normal/Thinking/Stable/Lingering)
5. **AI 보조, 선택적** — 끌 수 있음, 사용자가 통제권
6. **로컬 우선, 클라우드 선택** — localStorage 기본, Google OAuth 시 Supabase 동기화

### 시급도 5단계 — **기획 의도**

| 단계 | 이름 | 설명 | 색상 (기획) |
|------|------|------|-----|
| 1 | Urgent (긴급) | 즉시 처리 필요 | 🔴 빨간색 |
| 2 | Normal (보통) | 일반 업무 | 🔵 파란색 |
| 3 | Thinking (고민중) | 아직 구체화되지 않은 아이디어 | 🟣 보라색 |
| 4 | Stable (안정) | 천천히 진행 가능 | ⚪ 회색 |
| 5 | Lingering (방치) | 미루고 있지만 언젠가 해야 | 🟠 주황색 |

### 핵심 기능 (당시 문서 기준)

- 업무 블럭 관리(드래그앤드롭, 자동 연결, 선 클릭 삭제, Alt+클릭 복사)
- AI 기능(스마트 블럭 생성, 정리하기, ON/OFF)
- 다중 캔버스, 키보드 단축키, 검색/필터, 자동저장, 휴지통, JSON/MD 내보내기
- 영역 관리, 다크모드

### 사용 시나리오 (당시 문서 기준)

- 프로젝트 관리자: 여러 프로젝트를 캔버스별로 분리
- 개발자: 기능 개발 플로우 시각화
- 디자이너: 디자인 단계를 캔버스에 배치
- 개인 사용자: 일상/개인 프로젝트 분리

### 향후 계획 (당시 문서 기준)

1. ✅ 구글 소셜 로그인
2. 협업 기능 (공유 링크, 실시간 동기화)
3. 모바일 앱
4. 블럭 템플릿
5. 반복 업무 자동 생성
6. 통계 및 인사이트

### 📍 이후 바뀐 점

- **서비스명**: "LAYOUT" → **LAYOUTNEMO** 로 공식 통일
- **시급도**: **5단계 기획 → 4단계로 축소 구현** (`normal` 제외)
- **시급도 색상**: 기획의 색상과 실제 구현 색상이 다름 (아래 표 참조)
- **타겟 섹션**: 블로그에선 생략 (모두에게 바치는 서비스로)

---

## 2. 개발 후기

> **출처**: 초기 개발 후기 문서 (Notion)
> **프로젝트 기간: 12/18(목) – 12/21(일)** — 약 4일

### 1. 프로젝트 배경과 접근 방식

- **이전 프로젝트에서의 학습**: 기획부터 배포까지 한 서비스를 완주하는 데 필요한 최소 시간을 가늠함
- **이번 선택**: 구현 속도보다 **기획 밀도**에 무게. 목요일 오후 대부분을 기획에 투자
- **아이디어 도출 방식**: 문제 해석 과정 속에서 아이디어가 뒤따라 오는 흐름

### 2. 기획 단계에서의 문제 정의 방식

"기업 업무에 도움이 되는 AI 기반 서비스" 라는 문장 자체를 분해.

검토 질문:
- "업무에 도움"이 어떤 형태로 나뉘는가
- 효율 개선뿐 아니라 사고 정리/아이디어 생산/자본 운영/구성원 스트레스 등으로 확장 가능한가
- AI 개입이 가장 자연스러운 지점은 어디인가

**결론**: 문제를 '업무 성과 향상'이 아니라 **"업무를 정리하고 인식하는 과정에서 발생하는 사고 비용"**으로 좁힘.

### 3. 업무 관리가 아닌, 업무 사고의 문제 ⭐ (핵심 철학)

> 노션·지라 같은 도구는 업무를 테이블/보드/타임라인으로 정리해주지만, **그 구조 자체가 사용자의 실제 사고 방식과 어긋나 있다**고 느꼈다.

- 업무는 상위→하위 단방향으로 정리되지만, 머릿속에서는:
  - 하나의 업무가 여러 맥락에 걸쳐 있거나
  - 여러 상위 개념에 동시에 속해 있거나
  - 순환 구조를 이루기도 한다

**핵심 판단**:
> 업무가 정리되지 않는 이유는 **개인의 정리 능력 문제가 아니라, 업무를 담아낼 구조가 사고 방식과 맞지 않기 때문**이다.

### 4. AI를 도입한 이유와 역할 정의 ⭐

- AI는 "대신 판단하는 존재"가 아니라 **"사용자의 사고 흐름이 단절되지 않도록 돕는 보조 장치"**
- 마찰은 최소화하되, **판단은 사용자에게 남김**
- **AI 온·오프 구조**: "쓰지 않음"도 하나의 선택지가 되어야 함

### 5. 구현 방식과 개발 과정

- **1단계 (v0)**: Vercel v0로 기본 기능/UI 구조 빠르게 생성
- **2단계 (VSCode)**: GitHub로 이관 → 직접 코드 조정, 인터랙션 개선, AI 프롬프트 고도화
- **바이브 코딩 성찰**: 초기 구조엔 효과적, 서비스 철학 유지엔 직접 정제 필요
- **로그인 기능 제외**: 현재 단계에서 서비스 가치 기여도 기준

### 6. 배포와 현재 시점

- **도메인 별도 구매** — 단순 배포가 아닌 "추후 확장과 반복 개선을 전제로 한 기준점"
- **EC2/WAS 검토 후 제외** — 인프라 과투입 부적절
- **최종**: 구매 도메인 + GitHub + Vercel

### 7. 한계 인식과 이후 방향 ⭐

- 현재 LAYOUT은 "사고 공간 개념을 검증하기 위한 첫 구현물"

**바이브 코딩 총평**:
> 구현 범위가 확장되었음에도 **코드 구조에 대한 본질적 이해 없이는 서비스의 안정적 확장과 운영이 어렵다**.

**개발자의 역할 재정의**:
> 개발자의 역할은 판단을 대신하는 것이 아니라, 판단이 실제로 유지될 수 있도록 **구현 단계에서 구조적 안정성을 확보하는 역할**.

### 📍 이후 바뀐 점

_(개발 후기는 "과거의 시점"을 그대로 담은 문서라 바뀔 게 없음. Devlog 첫 글로 재구성해서 게시 예정)_

---

## 3. 데이터 구조 (설계 청사진)

> **출처**: Notion "데이터 구조" 문서
> **주의**: 이 문서는 **설계 청사진(이상형)**. 실제 구현된 코드와는 갭이 있음 (아래 "이후 바뀐 점" 참조).

### 🏛 최상위 구조 (설계안)

```json
{
  "user": { ... },
  "areas": [ ... ],
  "blocks": [ ... ],
  "uiState": { ... },
  "aiMeta": { ... }
}
```

**세 가지 원칙**:
1. 보이는 데이터 / 안 보이는 데이터 분리
2. AI 판단 결과 ≠ 사용자 확정 값
3. 로컬 저장 그대로 JSON 직렬화 가능

### 👤 User (설계안)

```json
{ "id": "local", "rolePreset": "PM", "createdAt": "...", "lastOpenedAt": "..." }
```

### 🗂 Area (설계안 — "영역 = 관점")

```json
{
  "id": "area-1", "name": "기획", "color": "#6B7280",
  "order": 1, "isPreset": true, "isActive": true, "createdAt": "..."
}
```

- `isActive`: 삭제 대신 비활성화 → 사고 기록 보존
- 영역 삭제해도 블럭은 사라지지 않음

### 🧱 Block (설계안)

```json
{
  "id": "block-101", "title": "결제 플로우 다시 생각하기",
  "dueDate": "2025-12-23", "summary": "모바일 결제 단계에서 이탈 원인 재검토",
  "areaId": "area-1", "position": { "x": 420, "y": 260 },
  "sizeLevel": 3, "shadowColor": "#374151",
  "createdAt": "...", "updatedAt": "...", "lastInteractedAt": "..."
}
```

**🔴 철학 — 보이는 것 vs 안 보이는 것** (설계 문서 원문)

| 화면에 **보이는** 필드 | 화면에 **안 보이는** 필드 (AI 전용) |
|------|------|
| title, dueDate, summary | AI 점수 |
| 크기 (sizeLevel) + 그림자 (shadowColor) | 중요도 판단 근거 |

> **AI는 많이 알지만, 사용자는 선택만 한다.**

### 📏 중요도 표현 — **설계안 (구현 실패)**

```json
"sizeLevel": 1 | 2 | 3 | 4 | 5
```

- 크기 = **인지적 무게** (설계 의도)
- ❌ "우선순위" / ⭕ "머릿속에서 차지하는 자리" — 시각적 위계 이론 기반

### 🤖 AI 메타 정보 (설계안)

```json
"aiMeta": {
  "blockScores": {
    "block-101": {
      "importanceScore": 0.82, "avoidanceScore": 0.64,
      "relatedBlocks": ["block-088"], "suggestedAreaId": "area-1"
    }
  },
  "lastAnalysisAt": "..."
}
```

### 🧹 정리하기 (설계안)

```json
"uiState": {
  "pendingSuggestions": [
    {
      "type": "MOVE_BLOCK", "blockId": "block-101",
      "from": { "x": 420, "y": 260 }, "to": { "x": 220, "y": 180 },
      "reason": "유사한 블럭과 자주 함께 다뤄졌어요."
    }
  ]
}
```

### ⭐ 이 구조의 가장 큰 장점 (설계 원문)

> **데이터 구조 자체가 이 서비스의 철학을 강제하고 있다.**

### 📍 이후 바뀐 점 (**매우 중요**)

실제 `master` 브랜치 코드 (`types/index.ts`)와 비교:

| 항목 | 설계 청사진 | 실제 구현 |
|------|--------------|-----------|
| 영역 필드명 | `areaId` | **`zone`** |
| 블럭 설명 필드 | `summary` | **`description`** + `detailedNotes` |
| 크기 표현 | `sizeLevel` (1~5) | **`width`/`height` 직접 저장** — sizeLevel 자체가 없음 |
| 상태 관리 | `aiMeta`, `uiState` 최상위 | **`Canvas` + localStorage 2키 (`layout_canvases`, `layout_current_canvas`)** |
| 시급도 단계 수 | — (표현되지 않음) | **4단계 `stable/thinking/lingering/urgent`** |

→ **"크기 기반 중요도 표현(sizeLevel)"은 구현에 실패**. 블럭은 모두 동일 크기 (360px 고정).
→ 따라서 **블로그에서는 이 설계안을 언급하지 않음**. 단, Devlog에서 "설계 vs 구현 갭" 글감으로 재활용 가능.

---

## 4. 정리하기 기능 + 수정 가이드

> **출처**: Notion "정리하기 버튼" + "정리하기 수정 가이드" 문서 통합

### 📂 관련 파일 구조 (당시)

```
정리하기 기능
├── components/reflection-dialog.tsx       # UI 및 사용자 인터랙션
├── app/api/ai/tidy-comprehensive/route.ts # AI 분석 로직 및 API
├── lib/ai/prompts.ts                      # AI 프롬프트 템플릿
├── lib/ai/types.ts                        # TypeScript 타입 정의
└── lib/ai/aiClient.ts                     # API 호출 클라이언트
```

### 🧩 핵심 역할

- **reflection-dialog.tsx**: UI & 플로우 (`startComprehensiveAnalysis`, `handleAccept`, `handleReject`)
- **tidy-comprehensive/route.ts**: 사전 분석 + OpenAI 호출
  - `analyzeBlockClusters()`: 영역별/시급도별 그룹화 + 분산도 계산
  - `calculateBlockSimilarity()`: 제목(30) + 영역(20) + 시급도(10) + 거리(최대 40)
  - 연결 누락 감지 임계값: **유사도 > 50** (상위 5개 AI 전달)
  - OpenAI 설정: `gpt-4o-mini`, `temperature: 0.6`, `response_format: json_object`

### 프롬프트 3단계 (당시)

1. **컨텍스트 이해** — 블럭 내용, 선후 관계, 작업 흐름 추론
2. **패턴 발견** — 분산 문제, 고립 블럭, 영역 불일치, 시급도 역전
3. **우선순위 결정** — High / Medium / Low

**제안 타입**: `connection` / `position` / `urgency` / `zone`

### 🎛 수정 가이드 요약 (당시)

- **프롬프트**: 분석 깊이, 우선순위 기준, 제안 타입 추가, 톤, 제안 수
- **임계값**: 유사도 가중치, 연결 제안 임계값(50), 분산도 기준
- **성능**: temperature, 모델 변경, 대기 시간

### 📍 이후 바뀐 점

- 시급도가 **4단계로 축소**되었으므로, 프롬프트 내 `urgency` 제안 타입도 4단계 기준으로 작동해야 함
- 블로그에는 **사용자 시점 설명만** 노출. 프롬프트/파일 경로/임계값은 비공개.

---

## 5. 시행 로그 — UI 개발 과정

> **출처**: Notion "시행 로그" 문서
> **각 기능별 시행착오 → 해결** 기록

### 주요 시행착오 요약

1. **다크모드 로고 + 전환 속도 동기화** (기본 UI 개선)
2. **휴지통 시스템** ("잠시 치워두기" → "삭제", 10개 제한)
3. **Undo 구현** ⚡: 드래그 중 모든 좌표 기록 → `skipHistory` 플래그로 mouseup 시만 저장, 최대 50개
4. **연결선 클릭 삭제** ⚡: 개별 업데이트의 race condition → `onBatchUpdateBlocks` 도입
5. **블럭 자동 연결 개선** ⚡: 중심점 → 가장자리 → **실제 겹침 감지**
6. **AI 기능 통합** ⚡: Vercel AI Gateway 결제 카드 요구 → OpenAI API 직접 호출
   - **프롬프트 최적화** ⚡: AI 창작 방지 → 5단계 프로세스 + temperature 0.3
   - **AI 토글 시스템**
7. **정리하기 (Reflection Dialog)** ⚡: accept/reject 후 자동 fetch 무한 루프 → 자동 fetch 제거
8. **줌/팬 기능 시도 → 롤백** ⚡⚡: 좌표 변환 복잡도로 모든 기능 고장 → 전체 제거
9. **캔버스 관리, 키보드 단축키, 검색/복사, 자동저장, 내보내기, 필터링** — 정상 유지
10. **블럭 복사 모드 전환** (`isCopyMode`)

### 🎓 주요 학습 포인트 (원문)

1. 복잡한 상태 관리 시 **batch 업데이트의 중요성**
2. **좌표 변환 로직의 복잡도**가 다른 기능에 미치는 영향
3. **AI 프롬프트 엔지니어링**의 중요성 (명확한 제약 조건 필요)
4. 기능 추가 시 **기존 기능과의 충돌 가능성** 고려 필요

### 📍 이후 바뀐 점

- **Devlog 에피소드 3개 선정** (앞으로 블로그에 글로 작성 예정):
  - **#6 줌/팬을 넣었다 뺀 이야기** ⭐
  - **#5 프롬프트 5단계 프레임워크** (AI 창작 방지)
  - **#2 race condition → batch update** (연결선 삭제)

---

## 6. 전체 파일 구조 & 핵심 파일 해설

> **출처**: Notion "파일 구조" 문서

### 🗂 디렉토리 트리 (당시)

```
layout-ui/
├── app/                      # Next.js App Router
│   ├── api/ai/              # AI API 엔드포인트
│   ├── layout.tsx, page.tsx, globals.css
├── components/              # React 컴포넌트
│   ├── ui/                  # shadcn/ui
│   ├── canvas.tsx, work-block-card.tsx, header.tsx
│   └── [다이얼로그들]
├── lib/                     # ai/, utils.ts
├── types/                   # TS 타입
├── public/                  # 정적 파일
└── .env.local
```

### 🔑 핵심 파일 (당시)

| 파일 | 줄수 | 역할 |
|------|------|------|
| `app/page.tsx` | 1000+ | 중앙 상태 관리 + 비즈니스 로직 |
| `components/canvas.tsx` | 500+ | 드래그앤드롭, 연결선 렌더링, 완료 영역 |
| `components/work-block-card.tsx` | 400+ | 블럭 시각화, 동적 크기(120~400px) |
| `components/create-block-dialog.tsx` | 600+ | AI 블럭 생성 3단계 |
| `components/reflection-dialog.tsx` | 400+ | AI 정리하기 다단계 분석 |
| `app/api/ai/create-block/route.ts` | — | 블럭 생성 API |
| `app/api/ai/tidy-comprehensive/route.ts` | — | 정리하기 API |
| `lib/ai/aiClient.ts` | — | OpenAI 클라이언트 래퍼 |
| `types/index.ts` | — | WorkBlock, Canvas 타입 |
| `components/header.tsx` | — | 헤더 (영역/연결/다크모드/정리하기/Undo) |

### 🔠 당시 타입 정의 (Notion 원문)

```ts
interface WorkBlock {
  id: string; title: string; description: string; detailedNotes?: string
  x: number; y: number; width: number; height: number
  zone: string
  urgency: "stable" | "normal" | "thinking" | "lingering" | "urgent"  // ← 5단계
  dueDate?: string; relatedTo: string[]; isCompleted: boolean
  isDeleted: boolean; originalState?: { ... }
}
interface Canvas {
  id: string; name: string; blocks: WorkBlock[]; zones: Zone[]
  createdAt: number; updatedAt: number
}
```

### 🎨 당시 시급도 매핑 (Notion 원문)

| urgency | 색상 | 아이콘 |
|---------|------|--------|
| stable | 회색 | Leaf |
| normal | 파란색 | Circle |
| thinking | 보라색 | Brain |
| lingering | 주황색 | Clock |
| urgent | 빨간색 | AlertCircle |

### 📐 주요 수치 (당시)

- 블럭: **너비 360px 고정**, 높이 120~400px 자동, 세부 3줄
- 완료 영역: 감지 600x800px, 시각 400x600px 점선 박스

### 🔄 데이터 흐름 (당시)

```
사용자 입력 → create-block-dialog → /api/ai/create-block → OpenAI → handleCreateBlock → findOptimalPosition → localStorage → Canvas
```

### 💾 localStorage (당시)

- `layout_canvases`: 모든 캔버스
- `layout_current_canvas`: 현재 선택 ID
- 30초 자동 저장, 히스토리 50개

### 📍 이후 바뀐 점 (**master 브랜치 실측 기준**)

실제 `types/index.ts`를 확인한 결과:

```ts
urgency?: "stable" | "thinking" | "lingering" | "urgent"   // ← 4단계로 축소됨 (normal 제외)
```

- **`work-block-card.tsx` 파일 자체가 현재 master에 없음** (삭제되었거나 이름 변경) — 블럭 렌더링은 다른 곳으로 옮겨짐
- **색상 매핑도 달라짐** — 아래 "실제 구현 현실 (4단계 시급도)" 섹션 참조

---

## 7. 도메인 & 배포 운영

> **출처**: Notion "LAYOUT NEMO 도메인 & 배포 운영 정리" 문서

### 1️⃣ 도메인 기본 정보

- **도메인명**: `layoutnemo.com`
- **Registrar**: **Namecheap**
- **구매 계정 ID**: `yuwolxx` 🔒 (내부 정보 — 블로그 공개 금지)
- **상태**: 활성화 ✅ / WHOIS Privacy ✅ / 자동 갱신 ✅

### 2️⃣ DNS / 도메인 연결

- **DNS 관리 위치**: Namecheap → Advanced DNS
- **네임서버**: Namecheap 기본 DNS (Cloudflare/Route53 이전 없음)

**DNS 레코드**:

| Type | Host | Value |
|------|------|-------|
| A Record | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

### 3️⃣ 배포 구조

- **플랫폼**: Vercel
- **방식**: GitHub 연동 자동 배포 (`git push` 기반)
- **레포**: `Yuwolx/LAYOUTNEMO` (원문에는 `Yuwolx/LAYOUT`로 표기됐으나 실제는 `LAYOUTNEMO` — 원문 표기 오기로 확인)
- **Production Branch**: `master`

### 4️⃣ 서비스 상태

- ✅ https://layoutnemo.com / https://www.layoutnemo.com 정상 접속
- ✅ HTTPS 자동 적용
- ✅ vercel.app 주소 외부 노출 없음

### 5️⃣ 관리 가이드

- **코드 수정 & 배포**: `master` push → 자동 반영
- **도메인 갱신**: Namecheap 계정에서 관리 (자동 결제)
- **AWS 이전 시**: 도메인 그대로 + DNS 값만 변경

### 🔒 절대 공유 금지

- Auth / EPP Code (도메인 이전 키)
- Namecheap 계정 비밀번호
- 결제 정보

### 📝 한 줄 요약 (원문)

> **layoutnemo.com은 Namecheap에서 구매한 내 자산이며, 현재는 Vercel + GitHub 자동 배포 구조로 운영 중이고, 언제든 AWS로 이전 가능한 상태다.**

### 📍 이후 바뀐 점

- 원문의 레포명 표기 `Yuwolx/LAYOUT` 은 실제와 다름. 실제 레포는 `Yuwolx/LAYOUTNEMO`.
- 나머지 운영 구조는 현재도 동일.

---

## 📅 데모 프로젝트 타임라인

- **2025-12-18 (목)** 프로젝트 시작 — 기획 단계
- **2025-12-19 (금)** — 기획 마무리 + 개발 시작
- **2025-12-20 (토)** — 주요 기능 구현
- **2025-12-21 (일)** — 배포 완료 (https://layoutnemo.com)
- 이후 Namecheap 도메인 구매, Vercel 연동

---

## 🎨 참고 — 데모 버전 기획의 "이상형" 색상 vs 실제 구현 색상

| 시급도 | 기획 (5단계) | 실제 구현 (4단계) |
|--------|-------------|-------------------|
| stable | ⚪ 회색 | ⚪ **회색** `rgb(156,163,175)` (라벨: "안정적") |
| normal | 🔵 파랑 | **❌ 제외됨** |
| thinking | 🟣 보라 | 🔵 **파란색** `rgb(59,130,246)` (라벨: "생각 중" / "보통" 혼용) |
| lingering | 🟠 주황 | 🟡 **노란색** `rgb(251,191,36)` (라벨: "머물러 있음" / "주의" 혼용) |
| urgent | 🔴 빨강 | 🟠 **주황색** `rgb(251,146,60)` (라벨: "시급함" / "시급" 혼용) |

→ **현재 운영 중인 구현 기준 = `WORKSPACE.md` 참조**
