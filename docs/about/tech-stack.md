---
layout: default
title: 기술 스택 & 아키텍처
parent: About
nav_order: 4
---

# 기술 스택 & 아키텍처

## 🧰 기술 스택

### Frontend
- **Next.js 16** (App Router)
- **React 19.2**
- **TypeScript 5**
- **ESLint 9 + eslint-config-next** — Next core-web-vitals 기준 lint

### Styling
- **Tailwind CSS v4**
- **shadcn/ui** (Radix UI 기반 컴포넌트)
- **lucide-react** (아이콘)

### AI
- **OpenAI `gpt-4o-mini`** — 직접 호출 방식
  - Vercel AI Gateway는 결제 카드 요구 이슈로 미사용 (개발 중 전환)

### Storage
- **localStorage** — 현재 `master` 기준 유일한 저장소

### Auth
- **Supabase Auth + Google OAuth** — v2 브랜치에서 실험 중, 현재 제품에는 미포함

---

## 🚀 배포 & 도메인

### 초기 프로토타이핑
- **Vercel v0** — AI 기반 UI 생성으로 초기 UI/기능 구조 빠르게 프로토타이핑
- 이후 GitHub 이관 → VSCode에서 직접 구조 정제

### 운영 배포
- **플랫폼**: [Vercel](https://vercel.com)
- **방식**: GitHub 연동 자동 배포 (`git push` 기반 CI/CD)
- **레포**: [Yuwolx/LAYOUTNEMO](https://github.com/Yuwolx/LAYOUTNEMO)
- **Production Branch**: `master`

### 배포 흐름

```
로컬 개발
  → git push origin master
  → Vercel 자동 빌드
  → Production Deployment
  → https://layoutnemo.com
```

### 도메인

- **서비스 주소**: [layoutnemo.com](https://layoutnemo.com) / [www.layoutnemo.com](https://www.layoutnemo.com)
- **Registrar**: Namecheap
- **HTTPS**: Vercel 자동 적용
- **네임서버**: Namecheap 기본 DNS 유지

**DNS 레코드**:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

### 왜 Vercel인가?

초기에는 EC2 기반 WAS 직접 배포도 검토했지만, 현재 단계에서 **인프라 구성에 리소스를 과투입하는 것은 적절하지 않다**고 판단했습니다. 한정된 시간 안에서 가장 중요한 것은 **서비스 철학의 구현과 검증**이었고, Vercel은 그 빠른 사이클을 지원하기에 충분했습니다.

### AWS 이전이 언제든 가능한 구조

현재 구조는 **도메인 이전성**을 전제로 설계되어 있습니다.

- 도메인은 Namecheap에서 **직접 소유**
- DNS는 Namecheap에서 관리 → 값만 바꾸면 **어느 인프라로든 옮겨갈 수 있음**
- 필요 시 Vercel → AWS EC2/ALB/CloudFront 로 전환 시 도메인은 그대로 사용 가능

단순 배포가 아닌, **"추후 확장과 반복 개선을 전제로 한 기준점"** 으로 도메인을 확보한 선택이었습니다.

---

## 🏛 아키텍처 개요

### 데이터 흐름 (블럭 생성 기준)

```
사용자 입력
  → create-block-dialog
  → /api/ai/create-block
  → OpenAI (gpt-4o-mini)
  → 제목 / 요약 / 결 / 기한 / 시급도 / 태그 / 링크 추출
  → handleCreateBlock() (page.tsx)
  → findSmartPosition() — 현재 viewport 안에서 스마트 배치
  → localStorage 저장
  → Canvas 렌더링
```

`master` 기준으로 스마트 배치는 삭제/갈무리 블럭만 제외하고, 가이드 블럭까지 포함한 화면 위 모든 블럭을 충돌 대상으로 봅니다. 캔버스 기본 배율 90% 를 적용하면서 viewport, drag, drop hit-test 도 같은 배율 기준으로 보정합니다.

### 저장 구조

- `layout_canvases` — 모든 캔버스 데이터
- `layout_current_canvas` — 현재 선택된 캔버스 ID
- `layout_ai_enabled` — AI 보조 토글
- `layout_language` — UI 언어
- **저장 타이밍**: 캔버스/블럭/결 상태 변경 시 즉시 localStorage 반영
- **히스토리**: 블럭 변경 기준 최대 50개까지 Undo 가능
- **마이그레이션**: 오래된 결 id, 구 갈무리 상태, 저장된 가이드 블럭 문구를 로드 시 보정
- **드래그 히스토리**: 드래그 중에는 화면만 갱신하고 mouseup 시 최종 좌표 하나만 Undo 스택에 기록

### 데이터 타입 (핵심만)

```ts
interface WorkBlock {
  id: string
  title: string
  description: string
  detailedNotes?: string
  x: number; y: number
  width: number; height: number
  zone: string                            // 내부 코드명. 블로그 표기는 "결(Facet)"
  urgency?: "stable" | "thinking" | "lingering" | "urgent"
  dueDate?: string
  relatedTo?: string[]
  isCompleted?: boolean
  isDeleted?: boolean
  tag?: string
  url?: string
}

interface CanvasViewport {
  x: number
  y: number
  width: number
  height: number
}
```

시급도 내부 키는 기존 저장 데이터와의 호환을 위해 `stable / thinking / lingering / urgent` 를 유지합니다. 표시 기준은 `thinking=미정(회색)`, `stable=여유(파랑)`, `lingering=진행(초록)`, `urgent=시급(빨강)` 순서로 정리했습니다.

---

## 🔐 데이터 안전

- **로컬 우선** — 로그인 없이도 브라우저에 영구 저장
- **즉시 저장** — 상태 변경 시 localStorage 에 반영
- **히스토리 관리** — 최대 50단계 되돌리기
- **휴지통** — 삭제한 블럭은 10개까지 보관 (복원 가능)
- **갈무리함** — 캔버스에서 잠시 치운 블럭을 별도 모달에서 복원
