---
layout: default
title: "2026-04-26 — SVG 발광체, 캔버스 팬 좌표, ResizeObserver 함정"
parent: Learning
nav_order: 3
---

# 2026-04-26 — SVG 발광체, 캔버스 팬 좌표, ResizeObserver 함정
{: .no_toc }

**feGaussianBlur 2단계 halo / world vs screen 좌표 / 클로저 stale + undo 오염**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

오늘 캔버스 작업에서 뽑아낸, 다른 프로젝트에서도 재사용 가능한 패턴 세 가지.

---

## 1. SVG 로 선이 진짜 빛나게 — feGaussianBlur 2단계 halo

### 문제

CSS `box-shadow` 는 사각형/원형에는 잘 먹지만, **임의의 SVG path** 에는 그대로 못 쓴다. SVG 곡선을 따라 부드럽게 빛이 뿜어져 나오는 효과 — 네온 사인 같은 — 를 만드려면 SVG 필터를 써야 한다.

### 단순한 1단계 halo — 약함

가장 흔한 시도:
```svg
<filter id="glow">
  <feGaussianBlur stdDeviation="2" />
  <feMerge>
    <feMergeNode in="blur" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

이러면 본선 위에 약간 흐릿한 복사본이 겹치는 정도. **"halo 가 있는 줄 모르겠는" 수준.** 발광체가 아니라 그냥 선이 약간 두꺼워 보이는 느낌이다.

### 2단계 halo — 진짜 발광체

핵심 인사이트: **진짜 발광체는 가까운 밝은 코어 + 멀리 부드럽게 퍼지는 외광** 이 겹쳐서 만들어진다. 두 개의 blur 를 다른 stdDeviation 으로 쌓으면 된다.

```svg
<filter id="lineGlowDark" x="-100%" y="-100%" width="300%" height="300%">
  <!-- near halo: 본선 둘레 좁게 밝게 -->
  <feGaussianBlur stdDeviation="1.8" in="SourceAlpha" result="blurNear" />
  <!-- far halo: 멀리 부드럽게 퍼지는 외광 -->
  <feGaussianBlur stdDeviation="6" in="SourceAlpha" result="blurFar" />

  <!-- halo 색을 본선 색과 다르게: 발광 효과의 핵심 -->
  <feFlood floodColor="#ffffff" floodOpacity="1" result="haloColor" />

  <!-- 각 blur 알파 영역에 halo 색 입히기 -->
  <feComposite in="haloColor" in2="blurNear" operator="in" result="haloNear" />
  <feComposite in="haloColor" in2="blurFar" operator="in" result="haloFar" />

  <!-- 쌓는 순서: 멀리부터 → 가까이 → 본선 -->
  <feMerge>
    <feMergeNode in="haloFar" />
    <feMergeNode in="haloNear" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

### 핵심 원리

1. **`in="SourceAlpha"`** — 색이 아닌 알파 채널만 블러. 그래야 다음 단계에서 색을 새로 입힐 수 있다. 컬러 SourceGraphic 을 블러하면 원래 색이 흐려진 결과만 나옴.

2. **`feFlood + feComposite operator="in"`** — flood 가 만든 단색 사각형을 blur 알파 모양으로 마스킹. 결과: blur 모양으로 자른 단색.

3. **filter 영역 확장** (`width="300%"`) — 기본 `width="100%"` 면 외광이 본선 영역 밖에서 잘린다.

4. **stack 순서** — 가장 멀리 퍼지는 layer 가 맨 아래, 본선이 맨 위.

### 다크 vs 라이트

같은 필터를 두 번 정의해서 모드별로 색을 다르게:
- **다크**: 흰빛 halo (배경이 어두우니 흰빛이 빛나 보임)
- **라이트**: warm gray halo (흰 배경에 흰 halo 는 안 보이니 본선과 어울리는 중간톤)

```tsx
<path filter={`url(#${isDarkMode ? "lineGlowDark" : "lineGlowLight"})`} />
```

### 교훈

**임의의 형태에 발광 효과는 SVG 필터의 `feGaussianBlur` + `feFlood` + `feComposite` 조합.** 1단계로는 약하다. **near + far 2단계로 쌓아야 진짜 발광체로 읽힌다.** CSS 의 `box-shadow` 가 못 하는 영역.

---

## 2. 캔버스 팬 — world 좌표와 screen 좌표 헷갈리지 않기

### 문제

피그마식 팬(스페이스바 + 드래그)을 구현할 때, 가장 흔한 실수는 **블럭 좌표 체계를 건드리는 것** 이다.

- world 좌표: 블럭이 캔버스 안에서 가지는 위치 (`block.x`, `block.y`)
- screen 좌표: 마우스 이벤트가 알려주는 화면 위 픽셀 (`e.clientX`)

팬을 적용하면 같은 world 좌표라도 화면 위에선 다른 위치에 보인다. 두 좌표계를 섞기 시작하면 드래그가 이상하게 끊긴다.

### 안 되는 방법 — 블럭 좌표를 직접 갱신

```ts
// 팬 시 모든 블럭의 x/y 에 panDelta 더하기
blocks.forEach(b => onUpdate(b.id, { x: b.x + dx, y: b.y + dy }))
```

비효율적이고, undo 스택이 의미 없는 변경으로 가득 차고, hit-test 로직이 다 어긋난다.

### 되는 방법 — wrapper transform 한 번만

```tsx
<div style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}>
  {/* 모든 블럭 + 관계선 SVG 가 여기 안에 */}
</div>
```

블럭은 여전히 자기 world 좌표(`block.x`)에 있다. wrapper 만 시각적으로 이동. 모든 hit-test (블럭 겹침, 관계선 그리기) 가 그대로 동작.

### 단, 마우스 이벤트는 보정 필요

블럭 드래그 시 마우스 좌표(screen)와 블럭 좌표(world)를 변환해야 함:

```ts
// 드래그 시작: 마우스가 블럭의 어디를 잡았는지 (offset) 계산
// block.x + pan.x 가 블럭의 화면상 위치
setOffset({
  x: e.clientX - (block.x + pan.x),
  y: e.clientY - (block.y + pan.y),
})

// 드래그 중: 마우스 화면좌표 → 블럭 world 좌표
const newX = e.clientX - offset.x - pan.x
const newY = e.clientY - offset.y - pan.y
```

핵심 관계식:
```
block.world.x + pan.x = block.screen.x
```

마우스 이벤트는 항상 screen, 블럭 좌표는 항상 world. 변환은 `pan` 빼고 더하기만.

### 배경도 같이 흘러야 함

블럭만 따라 움직이고 배경 도트가 가만히 있으면 팬했다는 환상이 깨진다. CSS `background-position` 으로 같이 보정:

```ts
backgroundPosition: `${pan.x}px ${pan.y}px`
```

### 추가: 입력 필드 안에서는 팬 무시

스페이스를 가로채면 텍스트 편집 중 공백을 못 친다. `isEditable` 헬퍼:

```ts
const isEditable = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
}
```

### 교훈

**팬은 좌표 시스템을 늘리는 게 아니라 시각 변환을 하나 추가하는 것.** wrapper 에 `transform: translate` 한 번 + 마우스 이벤트 보정만. 블럭 데이터는 손대지 않는다.

---

## 3. ResizeObserver 가 undo 스택을 더럽힌 이유 — 그리고 클로저 stale 함정

### 배경

블럭 카드를 가변 높이(content-driven)로 바꾸면서, **stored `block.height` 와 실제 렌더 높이를 동기화** 해야 했다. hit-test (블럭 겹침 감지, 관계선 끝점 계산) 가 stored height 를 신뢰하기 때문.

```tsx
useEffect(() => {
  const measure = () => {
    const measured = Math.round(el.getBoundingClientRect().height)
    if (Math.abs(measured - block.height) > 1) {
      onUpdate({ height: measured })
    }
  }
  measure()
  const ro = new ResizeObserver(measure)
  ro.observe(el)
  return () => ro.disconnect()
}, [...])
```

이 코드에 **두 가지 함정** 이 있었다.

### 함정 1: undo 스택 오염

`onUpdate` 가 내부적으로 `saveToHistory` 를 호출하는 구조였다. 자동 측정으로 `onUpdate({ height: measured })` 를 부르면 → 매 measure 마다 undo 스택에 새 스냅샷.

결과: 사용자가 `Cmd+Z` 를 누르면 의미 없는 height 변경만 되돌려짐. 진짜 작업이 undo 되려면 수십 번 눌러야 함.

해결: `onUpdate` 시그니처에 `skipHistory` 옵션 추가, 자동 측정은 항상 skipHistory=true.

```ts
onUpdate: (updates: Partial<WorkBlock>, skipHistory?: boolean) => void

// 측정에서:
onUpdate({ height: measured }, true)
```

### 함정 2: 클로저 stale

useEffect 안의 `measure` 함수는 effect 가 처음 실행될 때 캡쳐된 `block` 을 참조한다. 첫 측정 후 React 가 re-render 해서 `block.height` 가 갱신돼도 — useEffect 가 다시 실행되지 않으면 `measure` 안의 `block.height` 는 옛값.

증상: 한 번 측정 후 ResizeObserver 가 다시 발화하면, 비교가 옛 block.height 기준으로 되어 잘못된 결정을 함.

### 해결 — ref 로 항상 최신값 참조

```ts
const latestHeightRef = useRef(block.height)
latestHeightRef.current = block.height // 매 렌더마다 갱신

useEffect(() => {
  const measure = () => {
    const measured = Math.round(el.getBoundingClientRect().height)
    if (Math.abs(measured - latestHeightRef.current) > 1) {
      onUpdate({ height: measured }, true)
    }
  }
  // ...
}, [isCompleted, onUpdate])
```

`latestHeightRef.current` 는 객체 참조라서 클로저에서도 항상 최신값을 본다. effect deps 를 좁게 유지하면서도 stale 데이터를 피하는 패턴.

### 일반화: "자동 동기화 루프" 의 두 함정

자동으로 state 와 DOM 사이를 동기화하는 모든 패턴 (ResizeObserver, IntersectionObserver, MutationObserver 등) 에서 같은 두 가지가 반복된다:

1. **history/state 오염** — 자동 동기화는 사용자 행동이 아니므로 history 에 들어가면 안 됨. skipHistory 같은 명시적 escape hatch 필요.
2. **클로저 stale** — observer callback 은 effect 등록 시점에 캡쳐됨. ref 로 우회.

이 두 함정을 알고 가면 다음번엔 처음부터 피할 수 있다.

### 교훈

**자동 측정/동기화 코드는 "history 에 안 남기" + "ref 로 최신값 참조" 두 안전망을 깔고 시작한다.** 한쪽만 빼먹으면 사용자에게는 안 보이지만 다른 문제(undo 가 이상함, 라인이 살짝 어긋남)로 변장해서 나타난다.

---

## 정리

| 패턴 | 핵심 |
|------|------|
| SVG 발광체 | `feGaussianBlur(SourceAlpha) + feFlood + feComposite` 2단계 stack |
| 캔버스 팬 | wrapper transform + 마우스 이벤트만 pan 보정. 블럭 좌표는 불변 |
| 자동 측정 | skipHistory + latestRef 두 안전망 |

세 가지 모두 **"표면적으로는 기능이 동작하지만, 한 꺼풀 들추면 새는" 카테고리.** 안 잡으면 사용자가 막연히 "뭔가 어색해" 정도로만 느끼고 끝나는데, 잡고 나면 갑자기 견고해진다.

---

_이 노트는 2026-04-26 `feature/canvas-navigation` 브랜치 작업 중 일반적인 패턴만 추려 정리한 것._
