# CLAUDE.md

이 파일은 새 세션의 에이전트가 가장 먼저 읽는 운영 지침이다. 제품 개요·개념은 [README.md](./README.md), 할 일 목록은 [블로그 roadmap](https://yuwolx.github.io/LAYOUTNEMO/docs/roadmap/)에 있다. 여기엔 **코드만 봐선 안 보이는 운영·관례·현재 상태**만 적는다.

## 한 줄 요약

캔버스 위에 네모 블럭을 펼쳐 사고를 정리하는 도구. Next.js 16(App Router) + React 19.2 + TS5 + Tailwind v4, Supabase(Auth+DB), OpenAI. `master` 푸시 → Vercel 자동 배포(layoutnemo.com).

## 개발 환경 (Windows)

- 셸은 PowerShell. **Node가 PATH에 없다** — 명령 앞에 붙일 것: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`
- 검증: `npx tsc --noEmit` → `npm run lint` → `npm run build`. 커밋 전 항상. (기존 lint warning 2개 = page.tsx unused eslint-disable, 무시 가능)
- **런타임 상호작용(터치·드래그·제스처)은 로컬에서 검증 불가** — tsc/lint/build까지만 보장. 실제 감각은 배포 후 기기 테스트.

## Git & 배포 워크플로

- 작업은 **feature 브랜치**에서. `master` 직접 푸시는 배포이므로 사용자가 명시적으로 지시할 때만.
- 배포 절차: **현재 master를 `release/pre-<feature>` 로 백업 푸시 → feature를 `--no-ff` 머지 → master 푸시**. 롤백은 이 release 브랜치로.
- **블로그는 `gh-pages` 브랜치**(Jekyll, 메인 코드와 분리). 항상 `git worktree add`로 작업. devlog(`docs/devlog/YYYY-MM-DD-슬러그.md`) + `docs/roadmap.md` + `docs/devlog/index.md`를 같이 갱신. 사용자 지침: **기능 배포 시 블로그 상시 업데이트.**
- 원격 브랜치 삭제 등 파괴적 작업은 목록을 명시해 승인받고 진행.

## 스킬 (`.claude/skills/`)

- `/qa` — tsc + lint + build + 부팅 검증
- `/blog` — gh-pages devlog + 로드맵 + 인덱스 갱신 후 푸시
- `/ship` — master 백업 → feature 머지 → 푸시
- 사용자가 `/이름`으로 부르거나, 요청이 맞으면 자동 발동.

## 코드 관례 (반드시 지킬 것)

- **시급도 단일 소스**: `lib/constants/urgency.ts`. 색·라벨·의미를 여기서만 정의. 4단계(thinking/stable/lingering/urgent). 강조/선택 색은 이 4색과 안 겹치게(선택=보라, 공지=앰버).
- **i18n**: 한/영 문구는 `lib/i18n/seed.ts` 사전 경유. 하드코딩 금지.
- **드래그 히스토리**: 드래그 중 위치 갱신은 `onUpdateBlock/onBatchUpdateBlocks(..., skipHistory=true)`, 손 뗄 때 최종값 1회만 히스토리 커밋. Undo 한 번에 제자리로.
- **입력은 Pointer Events**: 마우스·터치 단일 경로. `pointerType`으로 분기, `activePointerId`로 멀티터치 가드. `touch-action: none`으로 브라우저 제스처 차단.
- **마이그레이션 없는 동기화**: blocks 테이블 `metadata`(jsonb)에 신규 플래그 저장(예: `pinned`). 컬럼 추가 없이 기기 간 동기화.
- **동기화 삭제 안전**: `saveCanvas`는 스냅샷 pruning을 하지 않음(오래된 탭이 새 블럭 지우는 것 방지). 삭제는 명시적 `deleteBlocks/deleteZones`로만.

## 현재 상태 (2026-07-02 기준)

- **태블릿 터치 지원**을 방금 master에 머지·배포함(Pointer Events, 한 손가락 팬, ⋮ 메뉴 연결/복사, 선택 모드 토글). **실기기 미검증** — 태블릿에서 감각 확인 필요. 문제 시 `release/pre-touch`(d40fa4c)로 롤백.
- **다음 후보**(블로그 roadmap 참조): 터치 후속(핀치 줌 + 휴대폰 반응형 레이아웃), 정리하기 삭제 블럭 보존 강화, 결 삭제 시 블럭 재배정 UX, Next.js 보안 패치 업그레이드. 동시 편집 대비 동기화 견고성(tombstone/서버시간 충돌판정)은 그 다음 큰 덩어리.
