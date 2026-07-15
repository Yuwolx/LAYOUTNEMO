---
layout: post
title: "\"잘 됨 근데 왜이리 버벅대지\" — 드래그가 매 프레임 저장하고 있었다"
parent: Devlog
nav_order: 34
tags: [성능, 터치, localStorage]
---

# "잘 됨 근데 왜이리 버벅대지" — 드래그가 매 프레임 저장하고 있었다
{: .no_toc }

**2026-07-15 — 터치 수정 확인 직후 나온 다음 리포트. 원인은 터치 코드가 아니라 저장 경로: 블럭을 드래그하는 동안 매 pointermove 마다 캔버스 전체를 JSON 직렬화해서 localStorage 에 동기로 쓰고 있었다.**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

## 문제

블럭 드래그는 pointermove 마다 blocks 를 갱신한다(부드럽게 따라와야 하니까). 그런데 저장 effect 가 canvases 변경마다 즉시 실행이어서, 드래그 중 초당 수십 번씩:

1. 캔버스 전체(모든 블럭, 메모 본문 포함) `JSON.stringify`
2. `localStorage.setItem` — **메인 스레드를 막는 동기 IO**
3. `setLastSaved(new Date())` — 헤더까지 리렌더

데스크톱에선 티가 덜 났지만 폰에선 프레임이 그대로 밀린다. 클라우드 저장은 처음부터 2초 debounce 였는데, 로컬 저장만 "즉시"였던 것 — localStorage 는 빠르다는 인상 때문에 아무도 의심하지 않던 자리다.

## 해결

로컬 저장을 400ms trailing debounce 로. 드래그 중엔 타이머가 계속 리셋되니 **쓰기 0회**, 손을 떼고 조용해지면 한 번 쓴다. 대신 유실 창구가 생기니 `pagehide` 와 `visibilitychange(hidden)` 에서 대기 중인 저장을 즉시 flush — 새로고침, 홈으로 나가기, 앱 전환, 닫기 전부 커버된다. 최신 상태는 이미 있던 `canvasesRef` 미러로 읽어 stale 스냅샷 문제도 없다.

## 정리

- **"저장은 싸다"는 감각을 프레임 예산으로 다시 재라.** 16ms 안에서 stringify + 동기 IO 는 싸지 않다. 입력 핸들러가 갱신하는 상태에 걸린 effect 는 전부 의심 대상.
- **debounce 를 넣으면 flush 짝을 같이 넣어라.** 지연 저장의 유실 창구는 pagehide/visibilitychange 로 닫는다.
- 남은 후보: 드래그 중 캔버스 전체 리렌더(카드 memo 화)는 이번 조치 후 체감을 보고 결정.

롤백: `release/pre-local-save-debounce`.
