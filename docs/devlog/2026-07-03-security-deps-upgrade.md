---
layout: post
title: "audit 15줄의 경고 — Next.js 16.2.10 보안 업그레이드"
parent: Devlog
nav_order: 17
tags: [보안, 의존성, Next.js, npm-audit]
---

# audit 15줄의 경고 — Next.js 16.2.10 보안 업그레이드
{: .no_toc }

**2026-07-03 — 로드맵에 "검토"로 적어 둔 항목을 열어 보니 고심각도가 줄줄이 나왔다. 미루던 의존성 업그레이드를 처리했다.**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

## 무슨 일이 있었나

로드맵에 "Next.js 보안 패치 버전 업그레이드 검토"가 한동안 걸려 있었다. 오늘 다음 작업을 정하려고 `npm audit`를 돌려 보니, "검토"라고 미뤄 둘 상태가 아니었다.

```
next  9.3.4-canary.0 - 16.3.0-canary.5   Severity: high
  - HTTP request smuggling in rewrites
  - Middleware / Proxy bypass in App Router (incomplete fix follow-up)
  - XSS in App Router applications using CSP nonces
  - Middleware redirects can be cache-poisoned
  ... (15건+)
lodash  <=4.17.23                        Severity: high (prototype pollution 등 3건)
ws      8.0.0 - 8.20.1                   Severity: high (uninitialized memory disclosure)
```

쓰고 있던 next 16.0.10에 걸리는 고심각도 권고가 15건 넘게 쌓여 있었고, lodash·ws도 고심각도였다. request smuggling과 미들웨어 우회는 인증·라우팅 경계를 건드리는 종류라 그냥 둘 수 없었다.

---

## 어떻게 풀었나

작업 자체는 단순하다. 확인을 어디까지 하느냐의 문제였다.

```
// 해결: next 16.0.10 → 16.2.10 (+ eslint-config-next 동반), 나머지는 npm audit fix
npm install next@16.2.10 eslint-config-next@16.2.10
npm audit fix        # lodash 4.18.1, ws 8.21.0
```

마이너 두 단계라도 프레임워크 업그레이드라, 평소 QA(tsc → lint → build)에 **프로덕션 서버 부팅 확인**을 더했다. 빌드가 성공해도 런타임에서 죽는 경우가 있어서다. `npm start` 후 HTTP 200까지 보고 마무리. 코드 변경은 없고 `package.json`·`package-lock.json`만 바뀌었다.

일부러 남긴 것도 있다.

- **ai SDK 체인** — 수정판이 `ai@7` 메이저 업그레이드(breaking change)다. AI 생성·정리하기 전체를 재검증해야 하므로 보안 패치에 끼워 넣지 않고 다음 사이클로 분리했다.
- **next 내부 번들 postcss** — 저심각도인 데다 next가 고정해 둔 버전이라 `--force` 없이는 못 건드린다. next 쪽 패치를 기다린다.

---

## 정리

- **"업그레이드 검토"는 로드맵에 적어 두는 순간부터 늙는다.** 권고는 계속 쌓이는데 항목은 그대로라, 가끔 `npm audit`로 실제 상태를 다시 재야 한다.
- **보안 패치와 breaking change를 한 배에 태우지 않는다.** 오늘 안전하게 올릴 수 있는 것(next 마이너, lodash, ws)과 재검증이 필요한 것(ai@7)을 분리했기에 당일 배포가 가능했다.
- **프레임워크 업그레이드는 빌드 성공 + 부팅 확인까지.** 코드 한 줄 안 바뀌어도 런타임은 별개다.

롤백 지점은 `release/pre-security-deps`.
