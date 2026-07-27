# CLAUDE.md

이 파일은 새 세션의 에이전트가 가장 먼저 읽는 운영 지침이다. 제품 개요·개념은 [README.md](./README.md), 할 일 목록은 [블로그 roadmap](https://yuwolx.github.io/LAYOUTNEMO/docs/roadmap/)에 있다. 여기엔 **코드만 봐선 안 보이는 운영·관례·현재 상태**만 적는다.

## 한 줄 요약

캔버스 위에 네모 블럭을 펼쳐 사고를 정리하는 도구. Next.js 16(App Router) + React 19.2 + TS5 + Tailwind v4, Supabase(Auth+DB), OpenAI. `master` 푸시 → Vercel 자동 배포(layoutnemo.com).

## 개발 환경 (Windows)

- 셸은 PowerShell. **Node가 PATH에 없다** — 명령 앞에 붙일 것: `$env:Path = "C:\Program Files\nodejs;" + $env:Path`
- 검증: `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build`. 커밋 전 항상. (기존 lint warning 2개 = page.tsx unused eslint-disable, 무시 가능)
- **런타임 상호작용(터치·드래그·제스처)의 "감각"은 로컬에서 검증 불가**, 그러나 포인터 **상태 머신 로직**은 vitest(jsdom)로 선제 검증된다 — `tests/canvas-select-mode.test.tsx`. 터치 로직을 고치면 테스트도 같이 추가할 것. 실제 감각은 배포 후 기기 테스트.

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

## 현재 상태 (2026-07-27 기준)

- **동기화 알림 = 조용한 헤더 아이콘으로 교체 배포** (7/27, 롤백 `release/pre-quiet-sync-status`): 성공은 헤더 구름 아이콘(펄스/회색/앰버 CloudOff)으로만, 토스트는 예외(백업·실패)에만. 같이 들어간 내구성 수정: pagehide 시 클라우드 flush(오프라인 편집 오판 제거), `last_synced_at` 은 dirty 아닐 때만 기록(침묵 유실 차단), `flushCloudSave` in-flight 직렬화(스냅샷 순서 역전 차단). 실기기 확인 대기: 다른 기기 접속 시 패널 안 뜨는지·아이콘 감각·하드 킬 백업 토스트.

- **정리하기 "위치 정돈" = 제자리 스냅으로 확정** (7/10 사용자 판정 "이거다", master `acbb364`): 군집분석(CLUSTER_CUT 160) → 군집별 제자리 스냅(밴드 유지, 가장 가까운 열 슬롯) → 군집 간 강체 분리 → 최종 전수 겹침 검사(하나라도 겹치면 제안 폐기). **이 설계를 다시 갈아엎지 말 것 — 튜닝만.** 폐기 이력(격자스냅 v1·라인정렬 v2·통짜 그리드·k-means 등)은 메모리 `next-session-plan.md` 참조.
- **다크 모드 = One Dark 배포 완료** + 잔손질(zinc → One Dark 통일, 본문 dark:font-medium) 머지됨. 교훈: 코드에디터 주석색은 앱 본문엔 흐림, 다크 본문은 굵기 한 단계 up(halation 보정).
- **7/9~7/12 그 외 배포**: i18n OS/브라우저 언어 자동감지 + 영어 누수 전수 제거 → **유료화 1단계** Polar 구독 웹훅(plan pro/free) → og:image → **유료화 2단계** 무료 캔버스 1개 제한(`lib/constants/plans.ts`) + 가이드 블럭 영어 번역 수복 + PWA 가로 터치(viewport-fit=cover) → UX 감사 일괄 수정(영어 누수 4곳·유료화 카피 2곳·가로 다이얼로그). 롤백은 각 배포별 `release/pre-*` 브랜치, devlog는 gh-pages에 작성 완료.
- **라이브 확인 대기**: 캔버스 tombstone(기기 A 삭제 → B 부활 안 함), 모으기 겹침 재수정분(master `202c97a`), 유료화 캔버스 제한 실사용 감각.
- **다음 후보**(블로그 roadmap 참조): 유료화 다음 단계(결제 플로우/pro 혜택 확장), 동기화 2차(서버시간 충돌판정 — DB 트리거 마이그레이션 + 실기기 2대 검증 필요), 블럭 템플릿, 통계/인사이트, Capacitor(스토어 입점 원할 때).
