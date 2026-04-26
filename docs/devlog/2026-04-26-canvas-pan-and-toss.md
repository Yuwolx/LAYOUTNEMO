---
layout: default
title: "캔버스를 손에 쥐다 — 스페이스바 팬, 연결 토스, 사이즈 다이어트"
parent: Devlog
nav_order: 6
---

# 캔버스를 손에 쥐다
{: .no_toc }

**2026-04-26 — 피그마식 팬, Shift 토스 제스처, 블럭 사이즈 절반으로**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

오늘 작업의 한 줄 요약: **캔버스를 처음으로 "내 손 위 종이" 처럼 다룰 수 있게 됐다.**

데모 버전(2025-12-21)에서는 줌/팬을 한 번 넣었다가 좌표 변환 비용과 코너 케이스 때문에 빼버렸다. 그 결과 캔버스는 고정된 한 화면이었고, 블럭 한 줄에 3개밖에 안 들어가는 답답함이 누적됐다. 오늘은 그 두 가지를 같이 풀었다.

---

## 1. 스페이스바로 캔버스 잡기 — 피그마 방식

데모에서 뺐던 줌/팬 중에서 **팬만** 부활시켰다. 줌은 의도적으로 보류 — 좌표 변환 비용 + 시각 위계가 흐트러지는 부작용 + 본질적으로 필요한가에 대한 의문 때문.

### 피그마와 시프트?

처음에 "시프트 클릭으로 이동" 으로 잘못 기억하고 있었는데, 실제 피그마는 **스페이스바 + 드래그** 다. 캔버스 도구 사용자가 가장 많이 익숙해진 제스처. 그대로 따라가기로 했다.

```ts
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.code === "Space" && !isEditable(e.target)) {
    e.preventDefault()
    setIsSpacePressed(true)
  }
}
```

### 입력 필드 안에서는 무시

스페이스를 가로채면 블럭 제목 편집 중 공백을 입력 못 하게 된다. `isEditable` 헬퍼로 input/textarea/contenteditable 안에서는 키 이벤트를 무시한다. 이건 다른 단축키들도 부분적으로 가지고 있던 문제라서 같이 정리했다 (자세한 건 아래).

### 좌표는 transform 으로

블럭들의 `block.x`, `block.y` 는 그대로 두고, **wrapper 에 `translate3d(panX, panY, 0)`** 만 적용했다. 블럭 내부 좌표 체계는 손대지 않으니 모든 hit-test 가 그대로 동작한다.

```tsx
<div style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}>
  {/* 블럭들 + 관계선 SVG 모두 여기 안 */}
</div>
```

다만 한 가지 보정 필요: 블럭 드래그 시 마우스 좌표는 화면좌표(pan 포함), block.x 는 world 좌표(pan 제외). 그래서 offset 계산할 때 pan 을 한 번 빼주고, 이동 시점에 다시 pan 을 빼서 world 로 환원한다.

```ts
// 드래그 시작
setOffset({
  x: e.clientX - (block.x + pan.x),
  y: e.clientY - (block.y + pan.y),
})
// 드래그 중
const newX = e.clientX - offset.x - pan.x
```

배경 도트 패턴도 `backgroundPosition` 으로 같이 흐르게 해서 "캔버스가 따라온다" 는 환상을 깨지 않게 했다.

### 윈도우 blur 에서 자동 리셋

스페이스를 누른 채 alt-tab 하면 keyup 이벤트를 못 받고 영영 팬 모드에 갇힌다. `window.blur` 에서 강제로 리셋하는 안전망을 깔았다. 이런 건 평소엔 필요 없어 보이지만 한 번 빠지면 "왜 이래?" 의 원인을 못 찾아서 짜증나는 카테고리.

---

## 2. Shift 토스 — 한 가지 동작에 두 의도가 있을 때

테스트 중 발견한 흥미로운 UX 충돌:

- **현재 동작**: 블럭 A 를 드래그해서 B 위에 놓으면 → 연결되고, A 는 놓은 자리에 머무른다.
- **어떤 유저의 기대**: 블럭 A 를 드래그해서 B 에 갖다 대면 → 연결되고, A 는 **원래 자리로 자동 복귀** 한다.

전자는 "블럭 위에 블럭 쌓기" 같은 의도적 레이아웃을 가능하게 한다. 후자는 "툭 던져서 연결만 만들고 싶다" 의도를 빠르게 처리한다. 둘 다 합리적이고, 같은 제스처에 다른 의도가 있다.

### 임계값으로 자동 분기? — 안 됨

처음엔 "드롭 시 50% 이상 겹치면 토스, 30~50% 겹치면 머물기" 같은 자동 분기를 고민했다. 하지만 임계값을 어디에 두든 누군가의 의도와 어긋난다. 50% 이상 겹쳐서 의도적으로 쌓고 싶은 사람도 있다.

### 모디파이어 키 분기 — 결정

**기본 = 머무름. Shift 누른 채 드롭 = 토스.** 캔버스 도구의 "Shift = 보조 동작" 관행에도 부합. 의도가 명시적이고 애매함이 없다. 발견성 문제는 단축키 가이드 + Shift 누른 동안의 시각 힌트로 보강 (시각 힌트는 다음 사이클).

```ts
const handleMouseUp = (e: MouseEvent) => {
  const tossBack = e.shiftKey
  // ...
  if (tossBack && dragStartPos) {
    draggingUpdates.x = dragStartPos.x
    draggingUpdates.y = dragStartPos.y
  }
}
```

### 복귀 애니메이션이 너무 급함

처음 구현은 그냥 위치를 즉시 dragStartPos 로 세팅했다. 결과: **순간이동**. 토스했다는 느낌이 아니라 그냥 사라졌다 나타나는 느낌. 사용자 표현: *"섹시하지 못해, 너무 급하게 훅 들어아"*.

해결: **해당 블럭만 일시적으로 left/top transition 켜기**.

```ts
const [tossingBackId, setTossingBackId] = useState<string | null>(null)

// 토스 시점
setTossingBackId(draggingId)
window.setTimeout(() => setTossingBackId(null), 480)
```

```tsx
<div style={{
  transition: isTossingBack
    ? "left 420ms cubic-bezier(0.34, 1.35, 0.64, 1), top 420ms cubic-bezier(0.34, 1.35, 0.64, 1)"
    : "none",
}}>
```

Cubic bezier `(0.34, 1.35, 0.64, 1)` 은 살짝 오버슛하는 곡선 — 도착 지점 근처에서 한 번 통통 튕기듯 안착한다. 이게 "툭 던졌다가 제자리로 톡 돌아오는" 물리감을 만든다.

평소엔 transition 이 없는 이유는 드래그 중 left/top 이 매 프레임 바뀌는데 거기에 transition 이 걸리면 마우스를 못 따라가서 끊긴다. 토스 순간만 켜고 끝나면 끄는 패턴.

---

## 3. 사이즈 다이어트 — 한 화면에 더 많이

기존 기본 블럭 360×160. 1920 가로에 한 줄 3개. 너무 답답했다.

여러 단계로 줄이며 사용자 피드백 받음:

| 단계 | 가로×세로 | 반응 |
|------|----------|------|
| 360×160 | 원래 | "한 화면에 몇 개가 안 들어가" |
| 240×120 | 1차 | "느낌 좋네 근데 좀 더" |
| 200×96 | 2차 | "더 작게" |
| 176×96 | 3차 | "아 직전으로 돌려줘 ㅋㅋ" |

→ **200×96 으로 안착.** 한 줄에 7~8개. 내용이 길면 line-clamp-3 까지 자동으로 늘어나는 가변 세로.

세로 가변은 그냥 `height: auto` 로 두면 되는데 문제는 **hit-test 정확도**. 갈무리 드롭 판정과 블럭 겹침 감지가 모두 stored `block.height` 를 신뢰한다. stored 값이 실제 렌더 높이와 다르면 라인이 카드 밖에 그려지거나, 드롭이 어긋난다.

해결: ResizeObserver 로 실제 렌더 높이를 측정해 stored height 와 동기화.

```ts
const measure = () => {
  const measured = Math.round(el.getBoundingClientRect().height)
  if (Math.abs(measured - latestHeightRef.current) > 1) {
    onUpdate({ height: measured }, true) // skipHistory
  }
}
const ro = new ResizeObserver(measure)
ro.observe(el)
```

여기서 두 가지 함정에 빠졌다 (Learning 노트에 자세히).

---

## 4. 연결 임계값 — 닿지도 않았는데 이어지는 문제

연결 로직에 `TOLERANCE = 30` 이 있었다. 두 블럭의 bounding box 가 30px 씩 확장된 후 겹침을 검사. 즉 **블럭 사이 60px 가 떠 있어도** "가까이 있다" 로 보고 연결됐다.

테스터 반응: *"닿지도 않았는데 자동 연결되는 거 싫어요."*

`TOLERANCE = 0` 으로 변경. 이제 **실제로 겹쳐야** 연결. 여전히 빠른 제스처(블럭을 살짝 부딪히고 떼는)로 연결을 만들 수 있고, 의도하지 않은 연결도 사라진다.

---

## 5. 라인 시각 — "그림자 영역으로 나뉜 것 같다"

라인 두께/색을 여러 번 조정했다. 사용자 피드백 흐름이 흥미로워서 기록.

**1차** — 단일 두꺼운 underglow 레이어 + 본선:
```
"두꺼운 underlayer + 본선 두 겹"
```
→ *"못생겼어"*

**2차** — 단일 본선 + SVG `feGaussianBlur` 필터:
```svg
<filter><feGaussianBlur stdDeviation="1.6" /></filter>
```
→ *"halo 존재감이 약해"*

**3차** — 본선 알파만 블러 + flood color 로 색 입혀서 발광체 효과:
```svg
<filter>
  <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
  <feFlood floodColor="#ffffff" floodOpacity="0.7" />
  <feComposite in2="blur" operator="in" />
  <feMerge>...</feMerge>
</filter>
```
→ 형광등 같은 부드러운 외광. *"이제 좀 빛나네"*

**4차** — 본선 더 얇게(0.6px) + halo 2단계(near + far) 로 진짜 발광체:
```svg
<feGaussianBlur stdDeviation="1.8" /> <!-- near, 코어 -->
<feGaussianBlur stdDeviation="6" />   <!-- far, 외광 -->
```
→ 다크 모드는 흰빛 halo, 라이트 모드는 warm gray halo. *"좋다 좋아"*

이 모든 게 SVG 필터로 표현 가능하다는 게 신기했다. CSS box-shadow 의 SVG 버전.

---

## 6. 다크 모드 stable 그림자가 안 보이는 문제

테스터: *"안정(회색) 블럭이 화이트 모드에선 그림자 보이는데 다크모드에선 안 보여요. 사라진 거예요?"*

**색 때문에 안 보이는 거였다.**

```ts
// stable 시급도
shadowDark: "shadow-[0_4px_18px_rgba(0,0,0,0.45)]" // 검정 그림자
```

다크 모드 배경 `#151823` 도 거의 검정. **검정 위 검정 그림자라 묻혀버린다.** 다른 시급도(파랑/노랑/주황)는 컬러라 다크에서도 보이는 거였고.

수정: 다크 모드의 stable 만 흰색 계열 부드러운 광으로.

```ts
shadowDark: "shadow-[0_4px_20px_rgba(255,255,255,0.10)]"
```

배경에 묻힌 게 아니라 색이 안 보이는 거였다는 걸 명확히 가르쳐준 좋은 버그 리포트였다.

---

## 7. 기타 잡은 버그들

### 단축키가 텍스트 입력 가로채기

`Cmd/Ctrl + Z` 핸들러가 input/textarea 안에서도 발동했다. 블럭 제목 편집 중 텍스트 undo 하려고 하면 캔버스 전체가 undo 됐다. `isEditable` 검사 추가로 텍스트 편집 중에는 브라우저 기본 동작에 양보.

### ResizeObserver 가 undo 스택 더럽힘

자동 측정으로 호출하는 `onUpdate({ height })` 가 `saveToHistory` 경유 → 매 측정마다 undo 스택에 새 스냅샷. **블럭이 한 번 렌더될 때마다 undo 한 번**. 사용자가 `Cmd+Z` 누르면 의미 없는 height 변경만 되돌리는 사태.

해결: `onUpdate` 시그니처에 `skipHistory` 옵션 추가, 자동 측정은 항상 skipHistory=true.

### useEffect 클로저 stale 이슈

같은 측정 로직에 또 다른 함정. 첫 측정 후 block.height 상태는 갱신되지만, useEffect 안 measure 함수의 클로저는 옛 block 을 참조한다. 다음 측정에서 잘못된 비교를 함.

`latestHeightRef` 로 매 렌더마다 ref 갱신 → 클로저가 ref 를 통해 항상 최신값 비교.

```ts
const latestHeightRef = useRef(block.height)
latestHeightRef.current = block.height
```

세 가지 모두 사용자 입장에서는 안 보이지만, 안 잡으면 다른 문제로 모습을 바꿔서 나타나는 류.

---

## 정리 — 오늘의 패턴

오늘 한 일들의 공통점:

1. **충돌하는 두 의도는 모디파이어로 분기** — Shift 토스
2. **stored 값 vs 렌더 값의 차이는 명시적으로 동기화** — ResizeObserver
3. **버그가 "사라졌다" 로 보이면 색 / 위치 / 임계값을 의심** — stable 그림자
4. **CSS 한계는 SVG 가 풀어준다** — feGaussianBlur 발광체
5. **자동 동작은 임계값 0 부터 시작** — 연결 TOLERANCE 30 → 0

캔버스가 처음으로 **"가지고 노는 표면"** 같아졌다. 데모 시점에는 고정된 한 화면이었고, 그 위에서 블럭이 답답하게 컸다. 오늘 이후로는 자유롭게 펼치고, 줄여 담고, 던져 잇는 도구.

다음 사이클에서 풀고 싶은 것 — Shift 누른 동안 시각 힌트(드래그 중 시작점 표시), Esc 로 드래그 취소, 그리고 v2 아키텍처 첫 발(Supabase 셋업).

---

_이 글은 `feature/canvas-navigation` 브랜치에서 한 작업을 회고한 기록입니다. PR #2 로 master 에 머지됨._
