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
| 2026-04-23 | [v2 아키텍처를 결정한 날 — 게스트 전용에서 멀티 기기 동기화로]({{ site.baseurl }}/docs/devlog/2026-04-23-v2-architecture-decision/) | ✅ 공개 |

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
