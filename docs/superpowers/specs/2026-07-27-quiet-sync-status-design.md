# 조용한 동기화 상태 표시 (quiet sync status)

2026-07-27 · 사용자 승인된 설계

## 문제

다른 기기로 접속할 때마다 top-center sonner 토스트("클라우드 내용을 불러왔어요" + 설명, 8초)가
화면 중앙 패널처럼 떠서 거슬린다. 원인은 두 겹:

1. 폰에서 편집 직후 앱을 닫으면 2초 debounce가 못 돌아 `layout_last_synced_at`이 갱신되지 않고,
   다음 부트 때 "오프라인 편집이 있었다"고 오판해 백업 토스트가 반복해서 뜬다.
2. 동기화 성공을 토스트로 알리는 것 자체가 업계 패턴(Notion/Docs/iCloud: 성공은 무음)과 어긋난다.

## 설계

**원칙: 성공은 조용히(상태 표시), 예외만 알림(토스트).**

### 1. 헤더 동기화 상태 아이콘 (신규)

- 위치: 헤더 오른쪽 그룹, AuthButton 바로 앞. 로그인 상태에서만 렌더. 모든 기기 폭에서 노출.
- 상태 3가지:
  - `syncing`: Cloud 아이콘 + 은은한 펄스(투명도) — 편집~클라우드 저장 완료 사이, 부트 병합 중
  - `synced`: Cloud 아이콘, 저채도 회색 정지 (기존 헤더 아이콘 톤)
  - `error`: CloudOff 아이콘, 앰버 (공지=앰버 관례와 일치, 시급도 4색과 안 겹침)
- 탭/클릭 시 마지막 동기화 시각을 짧은 토스트(2초, 설명 없음)로 표시. 데스크톱은 title 툴팁도.

### 2. 상태 배선 (app/page.tsx)

- `syncStatus: "syncing" | "synced" | "error"` + `lastSyncedAt: Date | null` 상태 추가.
- 전이: cloudDirty 세팅(편집) → syncing / flushCloudSave 성공 → synced(+시각) /
  실패 → error / 부트 클라우드 병합 시작 → syncing, 완료 → synced.
- 경합 가드: 저장 성공 콜백에서 `cloudDirtyRef`가 다시 서 있으면 synced로 내리지 않음.

### 3. pagehide 클라우드 flush (오판 근본 해소)

- 기존 pagehide/visibilitychange(hidden) 핸들러에서 로컬 flush만 하던 것을,
  `cloudDirtyRef`가 서 있으면 debounce 타이머를 걷고 `flushCloudSave()`도 즉시 호출.
- 편집이 제때 클라우드에 도착 → `last_synced_at` 갱신 → 다음 부트의 백업 오판이 사라진다.
  (백로그 "pagehide 클라우드 flush" 항목 해소)

### 4. 토스트 다이어트

- "클라우드 내용을 불러왔어요"(8초): 진짜 백업이 일어난 예외에만 유지.
  문구를 실제 상황에 맞게 수정("로그아웃 중" 표현 제거), 지속시간 단축(5초).
- "클라우드 저장이 재개됐어요": 제거 — 아이콘이 앰버→회색으로 복귀하는 것으로 대체.
- 실패 토스트(에러 2종): 유지.

### 5. 관례

- 문구는 `lib/i18n/dictionary.ts` 사전 경유 (`header.sync*` 키).
- 상대시간 포맷은 header의 `formatLastSaved` 로직을 일반화해 재사용.
- 검증: tsc → lint → vitest → build. 상태 전이는 수동 확인(실기기 감각은 배포 후).
