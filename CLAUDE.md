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

- **시급도 단일 소스**: `lib/constants/urgency.ts`. 색·라벨·의미를 여기서만 정의. 4단계(thinking/stable/lingering/urgent). 강조/선택 색은 이 4색과 안 겹치게(선택=보라, 공지=앰버, 가이드=청록). 캔버스 시각 언어: 색=의미, 질감=동일(링/테두리로 구분하지 않음).
- **i18n**: 한/영 문구는 `lib/i18n/seed.ts` 사전 경유. 하드코딩 금지.
- **드래그 히스토리**: 드래그 중 위치 갱신은 `onUpdateBlock/onBatchUpdateBlocks(..., skipHistory=true)`, 손 뗄 때 최종값 1회만 히스토리 커밋. Undo 한 번에 제자리로.
- **입력은 Pointer Events**: 마우스·터치 단일 경로. `pointerType`으로 분기, `activePointerId`로 멀티터치 가드. `touch-action: none`으로 브라우저 제스처 차단.
- **마이그레이션 없는 동기화**: blocks/canvases 테이블 `metadata`(jsonb)에 신규 플래그 저장(예: 블럭 `pinned`, 캔버스 `deleted` tombstone). 컬럼 추가 없이 기기 간 동기화.
- **동기화 삭제 안전**: `saveCanvas`는 스냅샷 pruning을 하지 않고 metadata 컬럼도 건드리지 않음(tombstone 생존 조건). 블럭/결 삭제는 명시적 `deleteBlocks/deleteZones`, 캔버스 삭제는 tombstone(`deleteCanvas`).
- **정리하기 = 하이브리드**: 연결·기한·위치·격자정렬 제안은 클라이언트 룰(`lib/tidy/rules.ts`, 쿼터 미사용), AI(`tidy-comprehensive`)는 결 오분류+인사이트 전담. 카테고리를 겹치지 않게 유지할 것(중복 제안 방지의 근거). 적용은 체크리스트 일괄 → 히스토리 1커밋.
- **AI 라우트 방어**: `maxDuration` + fetch 타임아웃(환불 시간 확보) + `max_tokens` + 입력 상한. 적용 필드는 클라이언트에서 화이트리스트(x/y/relatedTo/zone/urgency).

## 현재 상태 (2026-07-03 기준)

- **7/2~7/3 이틀간 16회 배포**: 태블릿 터치(실기기 검증 완료) → next 16.2.10 보안 업그레이드 → 정리하기 tombstone 유실 수정 + 결 삭제 재배정 UX → admin/AI 하드닝 → 헤더 가로 스크롤 → 핀치 줌 + 휴대폰 기본 배율 60% → **PWA**(매니페스트+서비스워커+설치 진입점, 실기기 확인 완료) → 캔버스 tombstone + 저장 재시도 → **하이브리드 정리하기**(룰 0초 + AI 축소 + 체크리스트) + 격자 정렬 룰 + 가이드 블럭 청록. 롤백은 각 배포별 `release/pre-*` 브랜치.
- **다음 세션 최우선 (사용자 지정)**: ① **정리하기 "정렬" 대대적 개편** — 격자 스냅(v1)·줄/열 클러스터 정렬(v2) 모두 사용자 판정 "정렬 안 됨". 같은 접근 반복 금지, 결별 오토 레이아웃(전면 재배치) 방향으로 사용자와 합의 후 진행. 진단 질문부터(제안이 떴는지/몇 px 움직였는지). ② **다크 모드 대대적 개편** — 요구사항 미수집, 불만 청취부터. 상세는 에이전트 메모리 `next-session-plan.md`.
- **라이브 확인 대기**: 캔버스 tombstone(기기 A 삭제 → B 부활 안 함), 모으기 겹침 재수정분(master `202c97a`), 정리하기 임계값 감각(유사도 50/기한 D-3/분산 700px).
- **그 외 후보**(블로그 roadmap 참조): 동기화 2차(서버시간 충돌판정 — DB 트리거 마이그레이션 + 실기기 2대 검증 필요), 블럭 템플릿, 통계/인사이트, Capacitor(스토어 입점 원할 때). 미사용 `ai` 패키지는 제거했음(ai@7 업그레이드 항목은 무효였음).
