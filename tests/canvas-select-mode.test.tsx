/**
 * 캔버스 포인터 상태 머신 회귀 테스트.
 *
 * 배경: 2042bba 에서 선택 모드 탭을 "arming" 방식으로 바꾸며 pointerup 리스너가
 * draggingId 일 때만 등록되는 회귀가 생겼다 — 선택 탭이 토글 대신 상세를 열고,
 * activePointerIdRef 가 남아 이후 모든 터치가 먹통. 실기기 없이도 이 상태 머신은
 * 순수 JS 라서 jsdom 으로 검증 가능하다. 배포 전 반드시 `npm test`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Canvas } from "@/components/canvas"
import { LanguageProvider } from "@/lib/i18n/context"
import type { WorkBlock, Zone } from "@/types"

const ZONES: Zone[] = [{ id: "z1", label: "결1", color: "#eee" }]

const makeBlock = (id: string, title: string, x: number): WorkBlock => ({
  id,
  title,
  x,
  y: 0,
  width: 200,
  height: 100,
  zone: "z1",
})

// 포인터 이벤트 헬퍼 — jsdom 엔 PointerEvent 가 없어 plain Event 에 속성을 얹는다.
// React(루트 위임)와 window 리스너 모두 bubbles 로 도달한다.
const pointer = (
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  opts: { pointerId: number; pointerType?: string; clientX?: number; clientY?: number },
) => {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { button: 0, pointerType: "touch", clientX: 0, clientY: 0, ...opts })
  return ev
}

function setup() {
  const onUpdateBlock = vi.fn()
  const onBatchUpdateBlocks = vi.fn()
  const onCopyBlock = vi.fn()
  const blocks = [makeBlock("a", "블럭 A", 0), makeBlock("b", "블럭 B", 600)]
  render(
    <LanguageProvider>
      <Canvas
        blocks={blocks}
        zones={ZONES}
        selectedZone={null}
        showRelationships={false}
        onUpdateBlock={onUpdateBlock}
        onBatchUpdateBlocks={onBatchUpdateBlocks}
        onCopyBlock={onCopyBlock}
        isDarkMode={false}
      />
    </LanguageProvider>,
  )
  const card = (title: string) => {
    const el = screen.getByText(title).closest("[data-block-card]")
    if (!el) throw new Error(`card not found: ${title}`)
    return el as HTMLElement
  }
  const enableSelectMode = () => fireEvent.click(screen.getByText("선택 모드"))
  // 선택 링 클래스는 래퍼가 아니라 안쪽 Card 요소에 붙는다.
  const isSelected = (title: string) => card(title).querySelector('[class*="ring-violet-400"]') !== null
  return { onUpdateBlock, onBatchUpdateBlocks, card, enableSelectMode, isSelected }
}

// 탭 = down → up → (브라우저가 이어서 쏘는) click 까지 재현해야 상세 열림 여부를 검증할 수 있다.
function tap(el: HTMLElement, pointerId: number, pointerType = "touch") {
  fireEvent(el, pointer("pointerdown", { pointerId, pointerType, clientX: 10, clientY: 10 }))
  fireEvent(el, pointer("pointerup", { pointerId, pointerType, clientX: 10, clientY: 10 }))
  fireEvent.click(el)
}

beforeEach(() => {
  localStorage.setItem("layout_language", "ko")
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe("선택 모드 탭", () => {
  it("터치 탭이 상세를 열지 않고 선택을 토글한다", () => {
    const { card, enableSelectMode, isSelected } = setup()
    enableSelectMode()

    tap(card("블럭 A"), 5)

    expect(isSelected("블럭 A")).toBe(true) // 선택됨
    expect(screen.queryByRole("dialog")).toBeNull() // 상세 안 열림

    // 한 번 더 탭 = 선택 해제
    tap(card("블럭 A"), 6)
    expect(isSelected("블럭 A")).toBe(false)
  })

  it("마우스 클릭도 선택 모드를 존중한다 (마우스 전용 태블릿)", () => {
    const { card, enableSelectMode, isSelected } = setup()
    enableSelectMode()

    tap(card("블럭 A"), 1, "mouse")

    expect(isSelected("블럭 A")).toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("탭 후 포인터가 잠기지 않는다 — 다음 블럭 드래그가 동작한다", () => {
    const { card, enableSelectMode, onUpdateBlock } = setup()
    enableSelectMode()

    // 선행 탭 (구버전에선 여기서 activePointerIdRef 가 영구히 남았다)
    tap(card("블럭 A"), 5)

    // 새 포인터로 블럭 B 드래그: 임계값(5px) 초과 이동 → 드래그 승격 → 위치 갱신
    const b = card("블럭 B")
    fireEvent(b, pointer("pointerdown", { pointerId: 7, clientX: 300, clientY: 300 }))
    fireEvent(window, pointer("pointermove", { pointerId: 7, clientX: 340, clientY: 300 }))
    fireEvent(window, pointer("pointermove", { pointerId: 7, clientX: 360, clientY: 300 }))
    fireEvent(window, pointer("pointerup", { pointerId: 7, clientX: 360, clientY: 300 }))

    expect(onUpdateBlock).toHaveBeenCalledWith("b", expect.objectContaining({ x: expect.any(Number) }), true)
  })

  it("pointercancel 로 끊긴 탭(회전 등)은 토글하지 않고, 이후 인터랙션도 정상", () => {
    const { card, enableSelectMode, onUpdateBlock, isSelected } = setup()
    enableSelectMode()

    const a = card("블럭 A")
    fireEvent(a, pointer("pointerdown", { pointerId: 9, clientX: 10, clientY: 10 }))
    fireEvent(window, pointer("pointercancel", { pointerId: 9 }))

    expect(isSelected("블럭 A")).toBe(false) // 중단된 탭은 토글 아님

    // 포인터 잠금 없이 드래그 정상
    const b = card("블럭 B")
    fireEvent(b, pointer("pointerdown", { pointerId: 10, clientX: 300, clientY: 300 }))
    fireEvent(window, pointer("pointermove", { pointerId: 10, clientX: 340, clientY: 300 }))
    fireEvent(window, pointer("pointermove", { pointerId: 10, clientX: 360, clientY: 300 }))
    fireEvent(window, pointer("pointerup", { pointerId: 10, clientX: 360, clientY: 300 }))

    expect(onUpdateBlock).toHaveBeenCalledWith("b", expect.objectContaining({ x: expect.any(Number) }), true)
  })
})
