# 로컬 환경 설정 가이드

LAYOUTNEMO 를 로컬에서 실행하고 개발하기 위한 전 과정.

---

## 📋 사전 준비

- **Node.js 20 이상** (권장 20 LTS 이상)
  - 버전 확인: `node -v`
- **npm** (Node.js 설치 시 자동 포함)
- (선택) **OpenAI API 키** — AI 기능 사용 시에만 필요

---

## 🚀 빠른 시작 (TL;DR)

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 파일 생성
cp .env.example .env.local
# → .env.local 열어서 OPENAI_API_KEY 입력

# 3. 개발 서버 실행
npm run dev

# 4. 브라우저에서 http://localhost:3000 접속
```

---

## 1. 의존성 설치

```bash
npm install
```

- `node_modules/` 디렉토리가 생성됩니다.
- Next.js 16, React 19, Radix UI, Tailwind CSS v4, OpenAI SDK 등을 받습니다.
- 최초 설치는 1~3분 정도 소요됩니다.

---

## 2. 환경 변수 설정

### 2-1. `.env.local` 파일 생성

프로젝트 루트에 있는 **`.env.example`** 을 복사해서 `.env.local` 을 만드세요:

```bash
cp .env.example .env.local
```

Windows PowerShell 에서는:

```powershell
Copy-Item .env.example .env.local
```

### 2-2. 실제 값 입력

`.env.local` 을 에디터로 열고, 플레이스홀더를 실제 값으로 교체하세요:

```env
OPENAI_API_KEY=sk-proj-진짜키입력
```

### 2-3. `.env.local` 은 커밋되지 않음

- `.gitignore` 에 포함되어 있어서 Git 에 올라가지 않습니다.
- **팀원과 공유할 템플릿** 은 `.env.example` 이며, 실제 값 없이 키 이름만 남깁니다.

---

## 3. OpenAI API 키 발급 & 관리

### 3-1. 키 발급

1. https://platform.openai.com 로그인
2. https://platform.openai.com/api-keys 이동
3. **"Create new secret key"** 클릭
4. 이름 지정 (예: `layoutnemo-local`)
5. 생성된 키를 **즉시 복사** → `.env.local` 에 붙여넣기

### 3-2. ⚠️ 잃어버린 키는 복구 불가능

**OpenAI 정책상 발급 시점에만 전체 키가 표시됩니다.**

- 대시보드에서는 **일부만 마스킹되어 보입니다** (예: `sk-proj-...abc123`).
- 전체 키를 다시 보는 방법은 **없습니다.**
- 잃어버렸다면:
  1. https://platform.openai.com/api-keys 에서 기존 키 **Revoke**
  2. **Create new secret key** 로 새로 발급
  3. `.env.local` 의 값 교체 + **서버 재시작** (`Ctrl+C` → `npm run dev`)

### 3-3. 사용량 / 비용

현재 사용 모델: **`gpt-4o-mini`**

| 항목 | 비용 (2026-04 기준) |
|------|---------------------|
| 입력 토큰 | $0.15 / 1M tokens |
| 출력 토큰 | $0.60 / 1M tokens |
| 블럭 하나 AI 생성 | 약 $0.0001 ~ $0.0003 |
| 정리하기 한 번 | 약 $0.001 ~ $0.002 |

일반적 개인 사용 기준 **월 $1 ~ $5** 정도.

> 💰 OpenAI 대시보드 **Usage Limits** 에 `$10/월 Soft`, `$20/월 Hard` 설정 권장. 버그로 폭주해도 자동 차단됩니다.

### 3-4. AI 없이도 실행 가능

- `OPENAI_API_KEY` 없이 `npm run dev` 해도 앱은 정상 켜집니다.
- 헤더의 AI 토글을 OFF 로 두면 블럭 수동 생성/편집/드래그/연결/완료 등 모든 비-AI 기능 정상 작동.
- AI 버튼을 누르거나 "정리하기" 를 실행하는 순간만 401/500 응답이 나옵니다.

---

## 4. 개발 서버 실행

### 4-1. 기본 실행

```bash
npm run dev
```

출력 예시:
```
▲ Next.js 16.0.10
- Local:        http://localhost:3000
- Environments: .env.local
- Ready in 2.3s
```

브라우저에서 **http://localhost:3000** 접속.

### 4-2. 포트 변경

3000 번이 이미 사용 중이면:

```bash
npm run dev -- -p 3001
```

### 4-3. 서버 종료

터미널에서 `Ctrl + C`

### 4-4. 환경 변수 변경 시

`.env.local` 값을 바꿨다면 **개발 서버를 재시작** 해야 반영됩니다.

```bash
# Ctrl+C 로 종료 후
npm run dev
```

---

## 5. 빌드 & 프로덕션 실행

```bash
# 타입 체크 + 번들링
npm run build

# 빌드된 앱 실행 (포트 3000)
npm start
```

- `npm run build` 가 깨끗이 통과해야 Vercel 에서도 배포 성공.
- 배포 전 로컬에서 한 번 확인하는 습관을 들이세요.

---

## 6. 린트

```bash
npm run lint
```

ESLint 규칙으로 코드 검사. CI 에서도 실행되므로 커밋 전 확인 권장.

---

## 7. 데이터 저장

현재 단계 (v1) 는 **100% 로컬 기반**:

- 모든 데이터는 브라우저 **localStorage** 에 저장
  - `layout_canvases` — 모든 캔버스 데이터
  - `layout_current_canvas` — 현재 선택된 캔버스 ID
- 백엔드 서버 / DB 불필요
- **브라우저 캐시/데이터를 지우면 사라지므로 주의**
- 여러 기기 동기화는 **v2 아키텍처** 에서 지원 예정

### 데이터 초기화하고 싶을 때

1. 개발자 도구 (F12) → **Application** 탭
2. **Storage → Local Storage → `http://localhost:3000`** 선택
3. 오른쪽 키들 전부 삭제
4. 페이지 새로고침 → 튜토리얼/예시 블럭이 다시 보임

---

## 8. 문제 해결

### 🐛 "localStorage is not defined"
- Next.js SSR 환경에서 일시적으로 나는 로그. 이미 `typeof window` 가드가 있어서 런타임 영향 없음.

### 🐛 예시 블럭이 안 보임
- localStorage 에 이전 데이터가 남아있어서. 위 **"데이터 초기화"** 절차 수행.

### 🐛 AI 기능이 작동 안 함
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. `OPENAI_API_KEY` 값이 `sk-proj-` 로 시작하는지 확인
3. 개발 서버를 **재시작** (`Ctrl+C` → `npm run dev`)
4. 브라우저 DevTools **Network** 탭에서 `/api/ai/...` 요청의 응답 확인

### 🐛 `Module not found` / `Cannot find package`
- `node_modules` 가 손상됐을 수 있음. 초기화:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### 🐛 포트 충돌
```bash
npm run dev -- -p 3001
```

---

## 9. Vercel 배포 (참고)

현재 운영 중인 배포 파이프라인:

- GitHub `master` 브랜치 push → Vercel 이 자동 빌드 및 배포
- 배포 주소: https://layoutnemo.com
- Vercel 대시보드에서 `OPENAI_API_KEY` 환경 변수 별도 등록되어 있음

**새 환경 변수 추가 시**:
1. Vercel 프로젝트 → Settings → Environment Variables
2. Production / Preview / Development 환경 선택
3. 저장 후 **재배포 필요**

---

## 10. 관련 문서

- `readme.md` — 프로젝트 개요
- `ARCHITECTURE.md` — v2 (서버 기반 멀티 기기 동기화) 설계 문서 *(gh-pages 브랜치)*
- `.env.example` — 환경 변수 템플릿
