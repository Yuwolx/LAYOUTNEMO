/**
 * 2026-09 피드백 1차 반영분의 포인터 상태 머신 검증.
 *
 * - 휠 클릭(가운데 버튼) 드래그 = 캔버스 팬. 블럭 위에서 시작해도 팬. 우클릭은 여전히 무시.
 * - Shift 누른 채 갈무리함에 드롭 = 갈무리 대신 바로 삭제(onDeleteBlock). Shift 없으면 갈무리.
 * - 가이드 블럭도 갈무리함 드롭이 먹는다 (예전엔 isGuide 가드로 영구 거주).
 *
 * jsdom 은 getBoundingClientRect 가 전부 0 이라, 갈무리함 요소만 DOM 에 있으면
 * 어떤 드롭도 "갈무리함 위" 로 판정된다 — 독 판정 자체가 아니라 그 뒤의 분기를 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { Canvas } from "@/components/canvas"
import { LanguageProvider } from "@/lib/i18n/context"
import type { WorkBlock, Zone } from "@/types"

const ZONES: Zone[] = [{ id: "z1", label: "결1", color: "#eee" }]

const makeBlock = (id: string, title: string, x: number, extra: Partial<WorkBlock> = {}): WorkBlock => ({
  id,
  title,
  x,
  y: 0,
  width: 200,
  height: 100,
  zone: "z1",
  ...extra,
})

const pointer = (
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  opts: {
    pointerId: number
    pointerType?: string
    clientX?: number
    clientY?: number
    button?: number
    shiftKey?: boolean
  },
) => {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { button: 0, pointerType: "mouse", clientX: 0, clientY: 0, shiftKey: false, ...opts })
  return ev
}

function setup(opts: { withDock?: boolean; withDelete?: boolean; blocks?: WorkBlock[] } = {}) {
  const onUpdateBlock = vi.fn()
  const onBatchUpdateBlocks = vi.fn()
  const onCopyBlock = vi.fn()
  const onDeleteBlock = vi.fn()
  const blocks = opts.blocks ?? [makeBlock("a", "블럭 A", 0), makeBlock("b", "블럭 B", 600)]
  if (opts.withDock) {
    const dock = document.createElement("button")
    dock.setAttribute("data-archive-dock", "")
    document.body.appendChild(dock)
  }
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
        onDeleteBlock={opts.withDelete === false ? undefined : onDeleteBlock}
        isDarkMode={false}
      />
    </LanguageProvider>,
  )
  const card = (title: string) => {
    const el = screen.getByText(title).closest("[data-block-card]")
    if (!el) throw new Error(`card not found: ${title}`)
    return el as HTMLElement
  }
  // 팬 결과는 transform 된 내부 래퍼에 나타난다.
  const stage = () => {
    const el = document.querySelector('[style*="translate3d"]') as HTMLElement | null
    if (!el) throw new Error("stage not found")
    return el
  }
  const canvasRoot = () => stage().parentElement as HTMLElement
  const panOf = () => {
    const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(stage().style.transform)
    if (!m) throw new Error(`unexpected transform: ${stage().style.transform}`)
    return { x: Number(m[1]), y: Number(m[2]) }
  }
  return { onUpdateBlock, onBatchUpdateBlocks, onDeleteBlock, card, canvasRoot, panOf }
}

beforeEach(() => {
  localStorage.setItem("layout_language", "ko")
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.querySelectorAll("[data-archive-dock]").forEach((el) => el.remove())
})

describe("휠 클릭(가운데 버튼) 팬", () => {
  it("빈 캔버스에서 가운데 버튼 드래그 = 팬", () => {
    const { canvasRoot, panOf } = setup()
    const start = panOf()

    fireEvent(canvasRoot(), pointer("pointerdown", { pointerId: 11, button: 1, clientX: 100, clientY: 100 }))
    fireEvent(window, pointer("pointermove", { pointerId: 11, button: 1, clientX: 150, clientY: 120 }))

    expect(panOf()).toEqual({ x: start.x + 50, y: start.y + 20 })
    fireEvent(window, pointer("pointerup", { pointerId: 11, button: 1, clientX: 150, clientY: 120 }))
  })

  it("블럭 위에서 시작한 가운데 버튼 드래그도 팬이고, 블럭은 움직이지 않는다", () => {
    const { card, canvasRoot, panOf, onUpdateBlock } = setup()
    const start = panOf()

    fireEvent(card("블럭 A"), pointer("pointerdown", { pointerId: 12, button: 1, clientX: 10, clientY: 10 }))
    fireEvent(window, pointer("pointermove", { pointerId: 12, button: 1, clientX: 40, clientY: 10 }))

    expect(panOf()).toEqual({ x: start.x + 30, y: start.y })
    expect(onUpdateBlock).not.toHaveBeenCalled()
    fireEvent(window, pointer("pointerup", { pointerId: 12, button: 1, clientX: 40, clientY: 10 }))
    expect(canvasRoot()).toBeTruthy()
  })

  it("손을 떼면 포인터가 풀려 다음 블럭 드래그가 정상", () => {
    const { card, canvasRoot, onUpdateBlock } = setup()

    fireEvent(canvasRoot(), pointer("pointerdown", { pointerId: 13, button: 1, clientX: 100, clientY: 100 }))
    fireEvent(window, pointer("pointermove", { pointerId: 13, button: 1, clientX: 160, clientY: 100 }))
    fireEvent(window, pointer("pointerup", { pointerId: 13, button: 1, clientX: 160, clientY: 100 }))

    const b = card("블럭 B")
    fireEvent(b, pointer("pointerdown", { pointerId: 14, clientX: 300, clientY: 300 }))
    fireEvent(window, pointer("pointermove", { pointerId: 14, clientX: 340, clientY: 300 }))
    fireEvent(window, pointer("pointerup", { pointerId: 14, clientX: 340, clientY: 300 }))

    expect(onUpdateBlock).toHaveBeenCalledWith("b", expect.objectContaining({ x: expect.any(Number) }), true)
  })

  it("우클릭(button 2)은 여전히 팬하지 않는다", () => {
    const { canvasRoot, panOf } = setup()
    const start = panOf()

    fireEvent(canvasRoot(), pointer("pointerdown", { pointerId: 15, button: 2, clientX: 100, clientY: 100 }))
    fireEvent(window, pointer("pointermove", { pointerId: 15, button: 2, clientX: 200, clientY: 200 }))

    expect(panOf()).toEqual(start)
  })
})

describe("갈무리함 드롭", () => {
  const dragToDock = (el: HTMLElement, pointerId: number, shiftKey: boolean) => {
    fireEvent(el, pointer("pointerdown", { pointerId, clientX: 10, clientY: 10 }))
    fireEvent(window, pointer("pointermove", { pointerId, clientX: 60, clientY: 60 }))
    fireEvent(window, pointer("pointerup", { pointerId, clientX: 60, clientY: 60, shiftKey }))
  }

  it("Shift 없이 드롭 = 갈무리(isCompleted), 삭제 콜백은 호출 안 됨", async () => {
    const { card, onUpdateBlock, onDeleteBlock } = setup({ withDock: true })

    dragToDock(card("블럭 A"), 21, false)

    await waitFor(() =>
      expect(onUpdateBlock).toHaveBeenCalledWith("a", expect.objectContaining({ isCompleted: true })),
    )
    expect(onDeleteBlock).not.toHaveBeenCalled()
  })

  it("Shift 누른 채 드롭 = 바로 삭제, 갈무리는 안 함", async () => {
    const { card, onUpdateBlock, onDeleteBlock } = setup({ withDock: true })

    dragToDock(card("블럭 A"), 22, true)

    await waitFor(() => expect(onDeleteBlock).toHaveBeenCalledWith("a"))
    const archived = onUpdateBlock.mock.calls.some(
      ([id, updates]) => id === "a" && (updates as Partial<WorkBlock>).isCompleted === true,
    )
    expect(archived).toBe(false)
  })

  it("onDeleteBlock 이 없으면 Shift 여도 갈무리로 폴백", async () => {
    const { card, onUpdateBlock } = setup({ withDock: true, withDelete: false })

    dragToDock(card("블럭 A"), 23, true)

    await waitFor(() =>
      expect(onUpdateBlock).toHaveBeenCalledWith("a", expect.objectContaining({ isCompleted: true })),
    )
  })

  it("가이드 블럭도 갈무리함 드롭으로 갈무리된다", async () => {
    const { card, onUpdateBlock } = setup({
      withDock: true,
      blocks: [makeBlock("g", "사용 설명서", 0, { isGuide: true }), makeBlock("b", "블럭 B", 600)],
    })

    dragToDock(card("사용 설명서"), 24, false)

    await waitFor(() =>
      expect(onUpdateBlock).toHaveBeenCalledWith("g", expect.objectContaining({ isCompleted: true })),
    )
  })
})
