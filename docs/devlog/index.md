---
layout: default
title: Devlog
nav_order: 3
has_children: true
---

# 📓 Devlog

LAYOUTNEMO를 만들면서 마주친 문제, 선택, 삽질, 배운 것을 기록합니다.
시간순으로 쌓이는 개발 일기이자, 같은 실수를 두 번 하지 않기 위한 공개 메모장입니다.

## 📌 글 목록

### 🎞 데모 회고 시리즈 (2025-12-21 데모 버전 기준)

| 편 | 제목 | 상태 |
|----|------|------|
| **1편** | [LAYOUTNEMO는 어떻게 시작되었나 — 4일의 기획과 개발 후기]({{ site.baseurl }}/docs/devlog/2025-12-21-how-layoutnemo-started/) | ✅ 공개 |
| **2편** | [기획 vs 구현의 갭 — 5단계에서 4단계로, sizeLevel의 실종]({{ site.baseurl }}/docs/devlog/2025-12-21-demo-design-vs-reality/) | ✅ 공개 |
| **3편** | [4일의 타임라인 — 12/18 ~ 12/21 하루하루]({{ site.baseurl }}/docs/devlog/2025-12-21-demo-four-days-timeline/) | ✅ 공개 |

### 🏛 아키텍처 / 설계

| 날짜 | 제목 | 상태 |
|------|------|------|
| 2026-07-15 | [지난 글에서 자랑한 코드가 터치를 죽이고 있었다 — 회귀, 그리고 처음 생긴 테스트]({{ site.baseurl }}/docs/devlog/2026-07-15-touch-select-regression-tests/) | ✅ 공개 |
| 2026-07-12 | [진상 유저 시뮬레이션 — 배포 직후 걸리는 것들을 먼저 걸어보기]({{ site.baseurl }}/docs/devlog/2026-07-12-user-audit-batch/) | ✅ 공개 |
| 2026-07-12 | [인식 영역이 손가락보다 위에 있다 — PWA 가로 버그, 풀려버린 번역, 캔버스 1개]({{ site.baseurl }}/docs/devlog/2026-07-12-canvas-limit-i18n-pwa-touch/) | ✅ 공개 |
| 2026-07-10 | [여덟 번 갈아엎은 정렬 — 재배치가 아니라 제자리 스냅이었다]({{ site.baseurl }}/docs/devlog/2026-07-10-tidy-position-saga/) | ✅ 공개 |
| 2026-07-10 | [쿼터를 아끼는 버튼, 블러 안 되던 상단바, 태블릿 세 가지 — 잔손질 묶음]({{ site.baseurl }}/docs/devlog/2026-07-10-optin-blur-touch/) | ✅ 공개 |
| 2026-07-09 | [헤더와 캔버스 사이, 세 가지 색 — 다크 이음새와 아이콘 은유]({{ site.baseurl }}/docs/devlog/2026-07-09-dark-seams-and-icons/) | ✅ 공개 |
| 2026-07-09 | [완성해 놓고 잠가두기 — 개인 인사이트와 마스터 계정]({{ site.baseurl }}/docs/devlog/2026-07-09-personal-insights-and-master/) | ✅ 공개 |
| 2026-07-09 | [숫자 4개짜리 대시보드를 분석 도구로 — 코호트, 퍼널, 그리고 KST 함정]({{ site.baseurl }}/docs/devlog/2026-07-09-admin-dashboard-analytics/) | ✅ 공개 |
| 2026-07-08 | [다크 모드를 One Dark 로 — 원본을 베끼면 안 되는 이유]({{ site.baseurl }}/docs/devlog/2026-07-08-dark-mode-onedark/) | ✅ 공개 |
| 2026-07-03 | [AI 를 기다리지 않는 정리하기 — 룰과 AI 의 역할 분담]({{ site.baseurl }}/docs/devlog/2026-07-03-tidy-hybrid/) | ✅ 공개 |
| 2026-07-03 | [지운 캔버스가 돌아오는 문 — tombstone 과 재시도]({{ site.baseurl }}/docs/devlog/2026-07-03-sync-robustness/) | ✅ 공개 |
| 2026-07-03 | [없는 걸 업그레이드할 뻔했다 — 안 쓰는 의존성과 눈 감은 기한]({{ site.baseurl }}/docs/devlog/2026-07-03-ai-dep-and-tidy-input/) | ✅ 공개 |
| 2026-07-03 | [홈 화면에 자리 하나 — 스토어 없이 앱이 되는 법 (PWA)]({{ site.baseurl }}/docs/devlog/2026-07-03-pwa/) | ✅ 공개 |
| 2026-07-03 | [두 손가락을 위한 자리 — 핀치 줌과 다시 살아난 배율]({{ site.baseurl }}/docs/devlog/2026-07-03-pinch-zoom/) | ✅ 공개 |
| 2026-07-03 | [영원히 사는 쿠키와 겹치는 헤더 — 하드닝 묶음과 실기기 피드백]({{ site.baseurl }}/docs/devlog/2026-07-03-hardening-and-header-scroll/) | ✅ 공개 |
| 2026-07-03 | [수락 버튼이 지우고 있던 것들 — 정리하기 tombstone 유실과 결 삭제 재배정]({{ site.baseurl }}/docs/devlog/2026-07-03-tidy-tombstone-and-facet-reassign/) | ✅ 공개 |
| 2026-07-03 | [audit 15줄의 경고 — Next.js 16.2.10 보안 업그레이드]({{ site.baseurl }}/docs/devlog/2026-07-03-security-deps-upgrade/) | ✅ 공개 |
| 2026-07-03 | [검토가 열어 본 뚜껑 — 권한 상승, 오픈 리다이렉트, 잠기는 캔버스, 태블릿 헤더]({{ site.baseurl }}/docs/devlog/2026-07-03-review-driven-fixes/) | ✅ 공개 |
| 2026-07-02 | [손가락 하나로 — 태블릿 터치 지원]({{ site.baseurl }}/docs/devlog/2026-07-02-touch-support/) | ✅ 공개 |
| 2026-07-02 | [여러 개를 한 번에, 하나를 위로 — 멀티 선택과 대표 블럭]({{ site.baseurl }}/docs/devlog/2026-07-02-multi-select-and-pin/) | ✅ 공개 |
| 2026-07-01 | [있는데 안 이어져 있던 것들 — AI 한도, 빠진 사용량 집계, 첫 인사]({{ site.baseurl }}/docs/devlog/2026-07-01-quota-and-missing-analytics/) | ✅ 공개 |
| 2026-06-29 | [멀티 디바이스 동기화에서 블럭이 사라지는 문제를 줄이기]({{ site.baseurl }}/docs/devlog/2026-06-29-sync-pruning-fix/) | ✅ 공개 |
| 2026-06-09 | [로그인·DB 코드, 지금 점검하고 가기]({{ site.baseurl }}/docs/devlog/2026-06-09-auth-db-code-review/) | ✅ 공개 |
| 2026-06-09 | [v2 배포 직후 패치 — 설정 실수, 보안 구멍, 이중 저장]({{ site.baseurl }}/docs/devlog/2026-06-09-v2-first-patch/) | ✅ 공개 |
| 2026-06-08 | [v2 완성 — 로그인, 동기화, 관리자 대시보드, 그리고 메모]({{ site.baseurl }}/docs/devlog/2026-06-08-v2-complete/) | ✅ 공개 |
| 2026-04-23 | [v2 아키텍처를 결정한 날 — 게스트 전용에서 멀티 기기 동기화로]({{ site.baseurl }}/docs/devlog/2026-04-23-v2-architecture-decision/) | ✅ 공개 |

### 🧹 리팩터링 / 클린업

| 날짜 | 제목 | 상태 |
|------|------|------|
| 2026-05-28 | [기술 부채 재방문 — 4주 뒤 다시 보는 청소 결과]({{ site.baseurl }}/docs/devlog/2026-05-28-code-debt-revisit/) | ✅ 공개 |
| 2026-05-28 | [새 블럭은 지금 보는 곳에 — viewport-aware 배치와 기본 배율 조정]({{ site.baseurl }}/docs/devlog/2026-05-28-viewport-aware-placement-and-scale/) | ✅ 공개 |
| 2026-04-24 | [하루 만에 18개 이슈 치우기 — 바이브 코딩 잔해 정리 & 갈무리 UX]({{ site.baseurl }}/docs/devlog/2026-04-24-cleanup-and-archive/) | ✅ 공개 |
| 2026-04-26 | [캔버스를 손에 쥐다 — 스페이스바 팬, 연결 토스, 사이즈 다이어트]({{ site.baseurl }}/docs/devlog/2026-04-26-canvas-pan-and-toss/) | ✅ 공개 |

### 🛠 기술 에피소드

| 날짜 | 제목 | 상태 |
|------|------|------|
| 예정 | 줌/팬을 넣었다 뺀 이야기 — Feature Creep과 좌표 변환의 비용 | 📝 작성 예정 |
| 예정 | 프롬프트가 창작을 시작할 때 — 사용자 입력을 지키는 5단계 프레임워크 | 📝 작성 예정 |
| 예정 | race condition을 batch update로 잡기 — 연결선 삭제 사례 | 📝 작성 예정 |

---

## Devlog 작성 규칙

- 파일명: `YYYY-MM-DD-제목-슬러그.md`
- Front matter의 `nav_order`는 최신 글이 위로 오도록 숫자 설정
- 길이보다 **한 주제를 명확히** 전하는 게 우선
- 코드 스니펫은 문제 + 해결 2단계로
