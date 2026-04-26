# LAYOUTNEMO

**Make. Connect. Layout.**
만들고, 잇고, 펼쳐놓으세요.

<p align="left">
  <a href="https://layoutnemo.com" target="_blank">
    <img src="https://img.shields.io/badge/live-layoutnemo.com-0b0b0b?style=flat-square" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss" />
</p>

LAYOUTNEMO 는 업무를 리스트·보드에 욱여넣는 대신, **캔버스 위에 자유롭게 펼쳐놓는 사고 공간**입니다.
네모난 블럭을 만들고, 가까이 놓아 잇고, 결(Facet)로 맥락을 나눠 정리합니다.

> 업무가 정리되지 않는 이유는 개인의 관리 능력 문제가 아니라, **업무를 담아낼 구조가 사고 방식과 맞지 않기 때문**입니다.

---

## ✨ Why

기존 업무 관리 도구는 **리스트 / 보드 / 타임라인** 같은 선형 구조를 전제로 합니다.
하지만 실제 사고는 그렇게 단정하지 않아요.

- 하나의 업무가 **여러 맥락에 동시에** 걸쳐 있거나
- 상·하위 관계가 **상황에 따라 계속** 변하거나
- **되돌아가거나 순환**하는 흐름이 많습니다

LAYOUTNEMO 는 이 문제를 **도구의 기능 부족**이 아니라 **구조와 사고 방식의 불일치** 로 재정의합니다. 그래서 먼저 생각을 **그 상태 그대로 펼쳐놓고**, 정리는 그 다음에 와도 된다고 봅니다.

---

## 🧩 Core Concepts

### 🧱 Block
사고의 최소 단위. 할 일, 아이디어, 고민 하나를 담는 네모난 카드. 모든 블럭은 같은 크기이며, 중요도는 색상으로 표현합니다.

### 🏷 Facet (결)
블럭이 가질 수 있는 속성 태그. "기획의 결", "개발의 결" 처럼 맥락을 나누는 기준. 결을 클릭하면 해당 블럭만 강조되고, 나머지는 흐리게 남습니다. **필터가 아니라 렌즈**예요.

### 🔗 Relationship (관계선)
블럭과 블럭 사이를 잇는 선. 두 블럭을 가까이 놓으면 자동으로 연결되고, 선을 클릭하면 끊어집니다. 공간적 배치 자체로 관계를 표현합니다.

### 🎨 Urgency (시급도)
블럭이 머릿속에서 차지하는 무게. 오직 **색상**으로만 표현되며, 4 단계로 나뉩니다.

| 시급도 | 색상 | 의미 |
|--------|------|------|
| **Stable** — 안정 | ⚪ 회색 | 천천히 진행해도 되는 일 |
| **Thinking** — 생각 중 | 🔵 파란색 | 아직 구체화되지 않은 아이디어 |
| **Lingering** — 머물러 있음 | 🟡 노란색 | 미루고 있지만 언젠가 해야 할 일 |
| **Urgent** — 시급 | 🟠 주황색 | 즉시 처리가 필요한 일 |

---

## 🎯 Design Principles

1. **Canvas First** — 정렬보다 **공간적 위치**가 의미를 가진다.
2. **Relationship-oriented** — 블럭은 할 일이 아니라 **사고 단위**. 선은 순서가 아니라 **연결 상태**.
3. **State, not Priority** — 숫자 순위가 아니라 **현재 머릿속의 상태**로 표현.
4. **User Control & Freedom** — AI 는 제안만 한다. 모든 구조적 변화는 **사용자 승인 후** 반영.
5. **Local-first** — 로그인 없이 즉시 사용. 진입 장벽 최소화.

---

## 🤖 AI Design

AI 는 판단하거나 자동화하지 않습니다. 다음 세 가지만 담당합니다.

- **입력 마찰 최소화** — 자연어 입력을 구조화된 블럭으로 보조
- **사고 흐름 단절 방지** — 머리 속 흐름이 끊기지 않게 돕기
- **구조적 제안** — 정리하기(Reflection) 에서 배치 / 연결 / 시급도에 대한 제안

> AI 가 고도화되더라도, **이 도구의 주도권은 항상 사용자에게** 남아있도록 설계되어 있습니다.

AI 버튼을 끄면 모든 비-AI 기능은 정상 작동합니다.

---

## 🏗 Tech Stack

- **Frontend** — Next.js 16 (App Router), React 19.2, TypeScript 5
- **Styling** — Tailwind CSS v4, shadcn/ui, lucide-react
- **AI** — OpenAI `gpt-4o-mini` (직접 호출)
- **Storage** — localStorage (기본)
- **Deploy** — Vercel (GitHub `master` push → 자동 배포)
- **Domain** — [layoutnemo.com](https://layoutnemo.com) (Namecheap)

현재 v1 은 **100% 로컬 기반**이며, v2 (서버 기반 멀티 기기 동기화) 는 설계 완료 후 대기 중입니다.

---

## 🚀 Getting Started

자세한 실행 가이드는 [LOCAL_SETUP.md](./LOCAL_SETUP.md) 참조.

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 파일 생성 (AI 기능 사용 시)
cp .env.example .env.local
# → .env.local 열어서 OPENAI_API_KEY 입력

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 http://localhost:3000 접속
```

---

## 🗂 Project Structure

```
app/
├── api/ai/                  # AI API Routes (create-block, tidy-comprehensive)
├── layout.tsx
└── page.tsx                 # 메인 페이지 (중앙 상태 관리)
components/
├── ui/                      # shadcn/ui
├── canvas.tsx               # 캔버스 (드래그, 연결선)
├── work-block-card.tsx      # 블럭 카드
├── *-dialog.tsx             # 생성 / 상세 / 정리하기 / 영역 관리 / 휴지통 / 캔버스 선택
└── header.tsx
lib/
├── ai/                      # AI 클라이언트, 프롬프트, 타입
└── utils.ts
types/
└── index.ts                 # 전역 TypeScript 타입
```

---

## 📚 Documentation

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — 로컬 실행 & 환경 변수 가이드
- 블로그 ([gh-pages 브랜치](https://github.com/Yuwolx/LAYOUTNEMO/tree/gh-pages)) — 서비스 소개, 개발 일기, 학습 노트

---

## 👤 Role

본 프로젝트는 **1인 개발** 로 다음을 전부 담당했습니다.

- 문제 정의 / 가설 수립 / UX 철학 설계
- 데이터 구조 / AI 개입 범위 정의
- UI 설계 및 직접 구현
- 배포 / 운영 환경 구성

---

## 📮 Contact

**개발자**: 권혁준
**이메일**: <yuwolxx@gmail.com>

---

<sub>© 2025-2026 LAYOUTNEMO. All rights reserved.</sub>
