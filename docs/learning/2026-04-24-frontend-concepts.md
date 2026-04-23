---
layout: default
title: "2026-04-24 — 프런트 UX/코드 패턴 3가지"
parent: Learning
nav_order: 2
---

# 2026-04-24 — 프런트 UX/코드 패턴 3가지
{: .no_toc }

**i18n 편집 존중 규칙 / 불확정 progress bar / 드래그 원위치 복원**
{: .fs-5 .fw-300 }

---

<details markdown="block">
<summary>목차</summary>
{: .text-delta }
- TOC
{:toc}
</details>

---

오늘 갈무리 UX 재설계 + i18n 도입을 하면서 재미있게 배운 것 세 가지.

---

## 1. i18n 에서 "유저가 편집한 값" 을 어떻게 구분할까

### 문제

기본 시드 데이터(가이드 블럭, 예시 블럭, 기본 결 이름) 는 **언어 따라 번역** 돼야 한다. 하지만 사용자가 그걸 **편집했다면**, 편집본을 존중해야 한다. 영문 모드라고 사용자가 쓴 한국어 제목을 임의로 영문으로 바꾸면 이상하다.

구분 방법을 몇 가지 고민했다.

- **옵션 A**: 스키마에 `isEdited: boolean` 플래그 추가
- **옵션 B**: 스키마에 `i18nKey: string` 저장, 번역은 키 기반
- **옵션 C**: 저장된 값과 원본 한국어를 비교 — **다르면 편집된 것**

### 선택한 방식: C

```ts
function translateSeedField(block, field, language) {
  const seed = SEED_BLOCK_STRINGS[block.id]
  if (!seed) return block[field]

  // 저장된 값이 ko 원본과 정확히 같으면 "편집 안 됨" → 번역
  if (block[field] !== seed[field].ko) {
    return block[field]      // 편집된 것 → 건드리지 않음
  }
  return seed[field][language]
}
```

### 왜 C 인가

- **A (플래그)**: 스키마 확장 필요. 기존 데이터 마이그레이션. 편집 추적 위해 모든 UPDATE 지점에 플래그 세팅 로직 박아야 함. **많이 찔러야 동작함**.
- **B (i18nKey)**: 가장 "정석" 인 방식이긴 하지만, 스키마가 복잡해진다. 단 5개의 기본 블럭을 위해 **모든 블럭에 i18nKey 필드를 달 필요는 없다**.
- **C (비교)**: 추가 필드 0개. 마이그레이션 없음. **저장된 값 자체를 암묵적 키로 쓰는 것**.

### C 의 약점

이론적으로 **사용자가 영문 모드에서 편집하다가 우연히 한국어 원본 문자열을 타이핑** 하면 "편집 안 됨" 으로 오분류된다. 하지만:
- 사용자가 "사용 설명서 (먼저 읽어주세요)" 라는 문자열을 영문 모드에서 손수 타이핑할 확률은 극히 낮음
- 그런 일이 실제로 발생해도 **원본 번역이 다시 나타나는 정도** 라 데이터 손실은 없음

### 교훈

**"완벽한 정답"** 과 **"99% 충분한 답"** 이 있을 때, 99% 답이 스키마 변경을 요구하지 않는다면 그게 이긴다. 프로젝트 규모에 맞는 복잡도를 쓰는 게 실력이다.

---

## 2. 가짜 progress bar 를 쓰지 마라 — 불확정(indeterminate) 디자인

### 문제

Reflect(정리하기) 기능을 구현한 코드에서 이런 패턴을 봤다.

```ts
setProgress(20)
await new Promise(r => setTimeout(r, 800))
setProgress(40)
await new Promise(r => setTimeout(r, 600))
setProgress(70)
// 여기서 실제 OpenAI 호출
```

**진행률이 있는 것처럼 연출** 하기 위해 **일부러 1.4초를 기다리고** 있었다. 실제 분석 작업은 "진행률" 이라는 개념 자체가 성립하지 않는다. OpenAI API 는 **"요청 → 전체 응답"** 의 ↔, 진행률을 돌려주지 않는다.

이런 가짜 진행률은,

1. **사용자 시간을 훔친다** — 실제 API 가 0.5초에 끝나도 1.4초는 무조건 기다림
2. **사용자 신뢰를 잃는다** — "이 앱 뭔가 부자연스러운데?" 하는 무의식적 인상

### 해결: 불확정(indeterminate) 진행률

```
0% ─────────────────────── 100%
    ░▒▓█ (좌→우로 흐름)
```

진행률 바 대신, **끝없이 좌→우로 흐르는 애니메이션** 을 쓴다. 소요 시간을 모를 때의 정답 패턴.

```css
@keyframes indeterminate {
  0%   { left: -35%; }
  100% { left: 100%; }
}
```

```tsx
<div className="w-full bg-muted rounded-full h-2 overflow-hidden relative">
  <div
    className="absolute inset-y-0 w-1/3 bg-foreground/20 rounded-full"
    style={{ animation: "indeterminate 1.4s ease-in-out infinite" }}
  />
</div>
```

### 언제 확정 vs 불확정?

| 상황 | 진행률 바 |
|------|-----------|
| 파일 업로드 (바이트 단위 추적 가능) | ✅ 확정 (0% → 100%) |
| OpenAI API 호출 (응답까지 블랙박스) | ✅ 불확정 (흐름) |
| 로컬 계산 여러 단계 (각 단계 정확한 지속 추정 가능) | ✅ 확정 |
| "AI 분석 중" 처럼 알 수 없음 | ✅ 불확정 |

### 교훈

**소요 시간을 모르면 진행률을 위조하지 마라.** 사용자는 위조를 얼마 안 가 눈치챈다.
**모르는 건 모른다고 표현하는 UI** 가 있다. "흐르는 바" 가 그것.

---

## 3. 드래그 시작 위치 기억해두기 — Undo 없이 원위치 복원

### 문제

갈무리(Archive) 기능에서, 사용자는 블럭을 우하단 박스 아이콘으로 드래그해서 넣는다.
그런데 **꺼냈을 때 원래 위치로 돌아와야** 한다.

가장 소박한 구현:
```ts
// 드래그 끝 → isCompleted: true
onUpdateBlock(id, { isCompleted: true })
```

그런데 블럭 x/y 는 **드래그하는 동안 계속 마우스 따라 움직이고** 있었다. 드래그 끝 시점의 x/y 는 **독 근처 좌표** 다. 여기서 `isCompleted: true` 만 토글하면 x/y 는 독 근처로 저장된 채 남는다. 꺼내면 **독 근처에서 나타난다**. 이상하다.

### 해결

드래그를 **시작하는 순간** 의 x/y 를 state 에 기억했다가, **독에 드롭되는 순간** 그 좌표로 복원한다.

```tsx
const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)

const handleMouseDown = (e, blockId) => {
  const block = blocks.find(b => b.id === blockId)
  setDraggingId(blockId)
  setDragStartPos({ x: block.x, y: block.y })   // ← 시작 위치 기억
}

const handleMouseUp = () => {
  if (droppedOnDock) {
    onUpdateBlock(draggingId, {
      isCompleted: true,
      x: dragStartPos.x,   // ← 시작 위치로 복원
      y: dragStartPos.y,
    })
  }
}
```

### 일반화된 패턴: "가역 드래그(reversible drag)"

드래그는 **의미 있는 종료 지점(accept)** 이 있을 수도, **취소되는 지점(reject)** 이 있을 수도 있다.

- **Accept** — 새 위치 저장 (일반적인 드래그 이동)
- **Reject** — 원래 위치로 되돌림 (실패한 드래그, 특정 drop zone 로 간 경우 등)

Reject 케이스를 위해 **드래그 시작 시점을 항상 기억해두면** 되돌리기 쉽다. Undo 시스템과 비슷하지만, **드래그 세션 단위로만 스냅샷** 을 잡는다. 메모리 부담 없음.

응용:
- **드래그 취소(Esc 키)** — 원래 위치로 복원
- **잘못된 drop zone** — 원래 위치로 복원 후 토스트
- **drag-to-trash** — 휴지통에 넣으면서 취소 가능하도록 원 위치 보관

### 교훈

드래그 UX는 **"어디서 시작해서 어디서 끝났는가"** 를 state 에 보관하고 있으면 훨씬 유연해진다. **현재 위치만 아는 드래그** 는 복원이 불가능하다.

---

## 정리

세 가지 모두 **"이미 만든 기능을 한 단계 더 다듬는 경험"** 이었다.
기본 기능은 동작하고 있었고, 오늘 한 건 **"한 걸음 더"**.

- i18n 은 동작했지만 **사용자 편집을 존중하는 규칙** 이 없었다
- Reflect 는 동작했지만 **가짜 딜레이로 사용자를 기만** 하고 있었다
- 드래그는 동작했지만 **"실패한 드래그를 되돌리는 개념"** 이 없었다

이런 작은 차이들이 모여서 **"그냥 돌아가는 앱"** 과 **"잘 만든 앱"** 을 가른다.
완성은 멀지만, 한 걸음씩 다가간다.

---

_이 노트는 2026-04-24 `feature/local-improvements` 브랜치에서 한 작업 중 일반적인 패턴만 뽑아 정리한 것이다. 특정 프로젝트에 국한되지 않은 내용이라 다른 프런트 프로젝트에서도 재사용 가능하다._
