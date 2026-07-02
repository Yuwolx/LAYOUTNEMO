---
name: qa
description: Verify the LAYOUTNEMO build before committing or shipping — runs TypeScript typecheck, ESLint, production build, and a dev-server boot check, then reports pass/fail. Use whenever the user says "QA", "검증", "확인해줘", "빌드 되나 봐", or before any commit/merge/push.
---

# QA 검증

LAYOUTNEMO는 Next.js(App Router) + TypeScript 프로젝트다. 커밋·머지·푸시 전에 이 순서로 검증하고 결과를 표로 보고한다.

## 실행 순서

Node가 PATH에 없을 수 있으므로 항상 앞에 붙인다: `$env:Path = "C:\Program Files\nodejs;" + $env:Path` (PowerShell) 또는 bash에서 상응 처리.

1. **타입 체크** — `npx tsc --noEmit` → 에러 0 이어야 통과
2. **린트** — `npm run lint` → 에러 0 (기존 warning 2개는 무시 가능: page.tsx unused eslint-disable)
3. **프로덕션 빌드** — `npm run build` → 성공해야 함 (가장 확실한 검증)
4. **부팅 확인** — dev 서버가 이미 떠 있으면 `Invoke-WebRequest http://localhost:3000` 로 HTTP 200 확인. 안 떠 있으면 이 단계는 생략하고 빌드 성공으로 갈음.

## 보고 형식

각 단계 통과/실패를 표로. 하나라도 실패하면 **정확한 에러 출력을 그대로** 보여주고, 절대 "통과"라고 얼버무리지 않는다. 실패 시 원인 파일:라인을 짚는다.

## 주의

- 이 프로젝트는 터치/제스처 등 **런타임 상호작용은 로컬에서 검증 불가** — tsc/lint/build까지만 보장되고 실제 감각은 기기 테스트가 필요하다는 점을 명시할 것.
