# LAYOUT UI Concept

Next.js 16과 React 19를 기반으로 한 현대적인 UI 컴포넌트 라이브러리 프로젝트입니다. shadcn/ui와 Radix UI를 활용하여 접근성과 사용자 경험을 최우선으로 합니다.

## 🚀 주요 기능
- **Next.js 16** - 최신 App Router와 서버 컴포넌트 지원
- **React 19** - 최신 React 기능 활용
- **Tailwind CSS v4** - 현대적인 스타일링 시스템
- **shadcn/ui** - 재사용 가능한 고품질 UI 컴포넌트
- **Radix UI** - 접근성이 뛰어난 기본 컴포넌트
- **TypeScript** - 타입 안정성 보장
- **다크 모드** - next-themes를 통한 테마 전환 지원
- **Supabase** - 데이터베이스 및 인증 통합

## 📦 기술 스택

### 프레임워크 & 라이브러리
- Next.js 16.0.10
- React 19.2.0
- TypeScript 5

### UI 컴포넌트
- Radix UI (다양한 접근성 우선 컴포넌트)
- Lucide React (아이콘)
- Recharts (차트 및 데이터 시각화)
- Embla Carousel (캐러셀)

### 스타일링
- Tailwind CSS v4
- tw-animate-css
- class-variance-authority
- tailwind-merge

### 폼 & 유효성 검사
- React Hook Form
- Zod (스키마 검증)
- @hookform/resolvers

### 기타
- Vercel Analytics
- next-themes (테마 관리)
- date-fns (날짜 처리)
- Sonner (토스트 알림)

## 🛠️ 시작하기

### 필수 요구사항

- Node.js 18+ 
- npm, yarn, 또는 pnpm

### 설치

```bash
# 의존성 설치
npm install
# 또는
yarn install
# 또는
pnpm install
```

### 환경 변수 설정

프로젝트는 다음 환경 변수를 사용합니다:

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# PostgreSQL (Supabase)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NON_POOLING=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=
POSTGRES_HOST=

# OpenAI
OPENAI_API_KEY=
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

### 빌드

```bash
npm run build
```

### 프로덕션 서버 실행

```bash
npm run start
```

## 📂 프로젝트 구조

```
.
├── app/                    # Next.js App Router
│   ├── layout.tsx         # 루트 레이아웃
│   └── globals.css        # 전역 스타일 및 테마 변수
├── components/            
│   └── ui/                # shadcn/ui 컴포넌트
├── hooks/                 # 커스텀 React 훅
│   ├── use-mobile.tsx     # 모바일 감지
│   └── use-toast.ts       # 토스트 알림
├── lib/                   
│   └── utils.ts           # 유틸리티 함수 (cn 등)
└── public/                # 정적 파일
```

## 🎨 사용 가능한 UI 컴포넌트

프로젝트에는 다음 컴포넌트들이 포함되어 있습니다:

- Accordion
- Alert & Alert Dialog
- Avatar
- Button
- Card
- Checkbox
- Collapsible
- Context Menu
- Dialog
- Dropdown Menu
- Hover Card
- Input & Label
- Menubar
- Navigation Menu
- Popover
- Progress
- Radio Group
- Scroll Area
- Select
- Separator
- Slider
- Switch
- Tabs
- Toast
- Toggle & Toggle Group
- Tooltip

## 🎯 개발 가이드

### 새 컴포넌트 추가

```tsx
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return <Button>클릭하세요</Button>
}
```

### 유틸리티 함수 사용

```tsx
import { cn } from "@/lib/utils"

const className = cn(
  "base-class",
  condition && "conditional-class"
)
```

### 다크 모드 토글

프로젝트는 자동으로 시스템 테마를 감지하며, CSS 변수를 통해 라이트/다크 모드를 지원합니다.

## 📝 라이선스

Private

## 🤝 기여

---

## 👤 저자 정보

| 항목 | 정보 |
|------|------|
| **개발자** | 권혁준 |
| **연도** | 2025 |
| **이메일** | yuwolxx@gmail.com |

**Made with ❤️**
