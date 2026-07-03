"use client"

import type React from "react"
import type { JSX } from "react"
import { useRef, useState, useEffect } from "react"
import { WorkBlockCard } from "@/components/work-block-card"
import type { CanvasViewport, WorkBlock, Zone } from "@/types"
import { URGENCY_KEYS, URGENCY_META, URGENCY_RGB, NOTICE_RGB } from "@/lib/constants/urgency"
import { Pin, X } from "lucide-react"

interface CanvasProps {
  blocks: WorkBlock[]
  zones: Zone[]
  selectedZone: string | null
  showRelationships: boolean
  onUpdateBlock: (id: string, updates: Partial<WorkBlock>, skipHistory?: boolean) => void
  onBatchUpdateBlocks: (updates: Array<{ id: string; updates: Partial<WorkBlock> }>, skipHistory?: boolean) => void
  onCopyBlock: (sourceBlockId: string) => void
  isDarkMode: boolean
  previewBlock?: Partial<WorkBlock> | null // Add preview block prop
  onViewportChange?: (viewport: CanvasViewport) => void
  /** 블럭 검색에서 "이동" 시 해당 블럭을 화면 중앙으로 팬. nonce 가 바뀔 때마다 재이동. */
  focusRequest?: { blockId: string; nonce: number } | null
  /** 대표(공지) 블럭 고정 토글. */
  onTogglePin?: (blockId: string) => void
  /** 대표 배너 클릭 시 해당 블럭 상세 열기. */
  onOpenDetail?: (blockId: string) => void
}

// 우하단 갈무리함 drop 감지 여유. 아이콘 가장자리 주변까지 자연스럽게 받아준다.
const ARCHIVE_DROP_PADDING = 40
const ARCHIVE_FLIGHT_MS = 150
// 브라우저 Cmd/Ctrl - 한 단계와 비슷한 초기 캔버스 배율.
const DEFAULT_CANVAS_SCALE = 0.9

type ArchiveFlight = {
  id: string
  targetX: number
  targetY: number
  restoreX: number
  restoreY: number
}

export function Canvas({
  blocks,
  zones,
  selectedZone,
  showRelationships,
  onUpdateBlock,
  onBatchUpdateBlocks,
  onCopyBlock,
  isDarkMode,
  previewBlock, // Receive preview block
  onViewportChange,
  focusRequest,
  onTogglePin,
  onOpenDetail,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // 드래그 시작 시점의 블럭 좌표. Shift 토스/갈무리 드롭 시 원래 자리로 돌려놓는 데 쓴다.
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [isCopyMode, setIsCopyMode] = useState(false)
  // Shift 토스 — 연결 + 원위치 복귀 시 해당 블럭만 일시적으로 left/top transition 켠다.
  const [tossingBackId, setTossingBackId] = useState<string | null>(null)
  // 피그마식 팬: 스페이스바 누른 채 드래그하면 캔버스 전체가 따라온다.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null)
  const [archiveFlight, setArchiveFlight] = useState<ArchiveFlight | null>(null)
  const archiveFlightTimerRef = useRef<number | null>(null)
  // 멀티 선택: 선택된 블럭 id 집합 + 진행 중인 마퀴(박스 선택) 사각형(화면 좌표, 캔버스 기준).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null)
  // 터치 선택 모드 — 켜지면 탭으로 블럭 선택 토글, 빈 곳 드래그로 마퀴 (Ctrl 대체).
  const [touchSelectMode, setTouchSelectMode] = useState(false)
  // 연결 모드 — ⋮ 메뉴 '연결' 시 소스 블럭 id 를 담고, 다음에 탭한 블럭과 이어준다 (Shift 드롭 대체).
  const [connectingId, setConnectingId] = useState<string | null>(null)
  // 그룹 드래그(선택 블럭 같이 이동) 진행 중일 때, 시작 시점의 각 블럭 좌표.
  const groupDragRef = useRef<{ starts: Map<string, { x: number; y: number }> } | null>(null)
  // 진행 중인 포인터(마우스/터치/펜) id. 멀티터치에서 두 번째 손가락이 드래그를 방해하지 않게,
  // 그리고 한 번에 하나의 인터랙션만 돌도록 가드로 쓴다.
  const activePointerIdRef = useRef<number | null>(null)
  // pointerdown 을 선택/연결로 "소비"했을 때 true. 뒤따르는 click(상세 다이얼로그 열기)을
  // 억제하는 신호. preventDefault 로는 click 이 막히지 않아 카드로 이 ref 를 넘겨 판별한다.
  const suppressClickRef = useRef(false)

  useEffect(() => {
    return () => {
      if (archiveFlightTimerRef.current !== null) {
        window.clearTimeout(archiveFlightTimerRef.current)
      }
    }
  }, [])

  // 특정 블럭을 화면 중앙으로 팬. 검색 "이동" + 대표 배너 클릭에서 공용.
  // screen = pan + world*scale (transformOrigin 0 0) → pan = viewportCenter - blockCenter*scale
  const focusOnBlock = (blockId: string) => {
    const target = blocks.find((b) => b.id === blockId)
    if (!target || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const blockCenterX = (target.x + target.width / 2) * DEFAULT_CANVAS_SCALE
    const blockCenterY = (target.y + target.height / 2) * DEFAULT_CANVAS_SCALE
    setPan({ x: rect.width / 2 - blockCenterX, y: rect.height / 2 - blockCenterY })
  }

  useEffect(() => {
    if (focusRequest) focusOnBlock(focusRequest.blockId)
    // nonce 가 바뀔 때만 실행 (같은 블럭 재검색도 다시 이동). blocks 는 그 시점 최신값.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce])

  useEffect(() => {
    if (!onViewportChange) return

    const reportViewport = () => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      onViewportChange({
        x: -pan.x / DEFAULT_CANVAS_SCALE,
        y: -pan.y / DEFAULT_CANVAS_SCALE,
        width: rect.width / DEFAULT_CANVAS_SCALE,
        height: rect.height / DEFAULT_CANVAS_SCALE,
      })
    }

    reportViewport()
    window.addEventListener("resize", reportViewport)
    return () => window.removeEventListener("resize", reportViewport)
  }, [onViewportChange, pan.x, pan.y])

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        setIsCopyMode(true)
      }
      if (e.code === "Space" && !isEditable(e.target)) {
        // 입력 필드 밖에서 스페이스 누르면 페이지 스크롤 등 기본동작 막고 팬 모드 진입.
        e.preventDefault()
        setIsSpacePressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) {
        setIsCopyMode(false)
      }
      if (e.code === "Space") {
        setIsSpacePressed(false)
        setIsPanning(false)
        panStartRef.current = null
        // 팬이 pointerup 없이 끝나도(스페이스를 버튼보다 먼저 뗀 경우) 진행중 포인터를
        // 비워준다. 안 그러면 activePointerIdRef 가 남아 이후 모든 인터랙션이 막힌다.
        activePointerIdRef.current = null
      }
    }
    const handleBlur = () => {
      // 윈도우 포커스 잃으면 키/포인터 떼는 이벤트를 못 받을 수 있으니 안전하게 리셋.
      setIsSpacePressed(false)
      setIsPanning(false)
      setIsCopyMode(false) // alt 가 stuck 된 상태로 남아 클릭 시 복제되는 버그 방지.
      panStartRef.current = null
      // 진행중이던 팬/드래그/마퀴를 안전하게 종료. activePointerIdRef 가 남으면 캔버스가
      // 영구 잠기고, draggingId 가 남으면 복귀 시 블럭이 커서에 붙는다.
      activePointerIdRef.current = null
      setDraggingId(null)
      setDragStartPos(null)
      groupDragRef.current = null
      setMarquee(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleBlur)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleBlur)
    }
  }, [])

  useEffect(() => {
    if (!isPanning) return

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      const start = panStartRef.current
      if (!start) return
      setPan({
        x: start.panX + (e.clientX - start.mouseX),
        y: start.panY + (e.clientY - start.mouseY),
      })
    }
    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      setIsPanning(false)
      panStartRef.current = null
      activePointerIdRef.current = null
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }
  }, [isPanning])

  // Ctrl/Cmd + 드래그(또는 터치 선택 모드) 마퀴 선택.
  useEffect(() => {
    if (!marquee) return
    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      setMarquee((m) => (m ? { ...m, curX: e.clientX - rect.left, curY: e.clientY - rect.top } : m))
    }
    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      const x0 = Math.min(marquee.startX, marquee.curX)
      const x1 = Math.max(marquee.startX, marquee.curX)
      const y0 = Math.min(marquee.startY, marquee.curY)
      const y1 = Math.max(marquee.startY, marquee.curY)
      // 클릭 수준의 작은 드래그는 무시.
      if (x1 - x0 >= 4 || y1 - y0 >= 4) {
        // 화면(캔버스 기준) → 월드 좌표 (transformOrigin 0 0: screen = pan + world*scale)
        const wx0 = (x0 - pan.x) / DEFAULT_CANVAS_SCALE
        const wx1 = (x1 - pan.x) / DEFAULT_CANVAS_SCALE
        const wy0 = (y0 - pan.y) / DEFAULT_CANVAS_SCALE
        const wy1 = (y1 - pan.y) / DEFAULT_CANVAS_SCALE
        const hits = blocks
          .filter(
            (b) =>
              !b.isCompleted &&
              !b.isGuide &&
              b.x < wx1 &&
              b.x + b.width > wx0 &&
              b.y < wy1 &&
              b.y + b.height > wy0,
          )
          .map((b) => b.id)
        setSelectedIds(new Set(hits))
      }
      setMarquee(null)
      activePointerIdRef.current = null
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleUp)
    }
  }, [marquee, pan.x, pan.y, blocks])

  // 선택 상태 키보드: Esc 해제 / Delete·Backspace 로 선택 블럭 일괄 갈무리.
  useEffect(() => {
    if (selectedIds.size === 0) return
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      if (e.key === "Escape") {
        setSelectedIds(new Set())
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        onBatchUpdateBlocks(Array.from(selectedIds).map((id) => ({ id, updates: { isCompleted: true } })))
        setSelectedIds(new Set())
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectedIds, onBatchUpdateBlocks])

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (activePointerIdRef.current !== null) return // 이미 다른 포인터가 인터랙션 중

    // 연결 모드 중 빈 곳을 누르면 취소.
    if (connectingId && !(e.target as HTMLElement).closest?.("[data-block-card]")) {
      setConnectingId(null)
      return
    }

    // 스페이스 팬(마우스)은 대상(블럭/빈곳) 상관없이 최우선.
    if (isSpacePressed) {
      e.preventDefault()
      panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y }
      activePointerIdRef.current = e.pointerId
      setIsPanning(true)
      return
    }

    // 아래(마퀴/팬/선택 해제)는 블럭이 아닌 빈 캔버스에서 시작할 때만.
    if ((e.target as HTMLElement).closest?.("[data-block-card]")) return

    // Ctrl/Cmd + 드래그 → 마퀴(박스) 선택 (마우스). 터치 선택 모드는 아래 touchMarqueeMode.
    if (e.ctrlKey || e.metaKey || (e.pointerType === "touch" && touchSelectMode)) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      e.preventDefault()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      activePointerIdRef.current = e.pointerId
      setMarquee({ startX: sx, startY: sy, curX: sx, curY: sy })
      return
    }

    // 터치: 빈 곳 한 손가락 드래그 → 팬. (선택은 유지 — 팬으로 훑어보다 잃지 않도록)
    if (e.pointerType === "touch") {
      panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y }
      activePointerIdRef.current = e.pointerId
      setIsPanning(true)
      return
    }

    // 마우스: 빈 곳 클릭 → 선택 해제.
    if (selectedIds.size > 0) setSelectedIds(new Set())
  }

  const handlePointerDown = (e: React.PointerEvent, blockId: string) => {
    if (isSpacePressed) return // 스페이스 누른 상태면 블럭이 아니라 캔버스 팬을 우선.
    if (activePointerIdRef.current !== null) return // 이미 다른 포인터가 인터랙션 중

    // 연결 모드: 다른 블럭을 탭하면 두 블럭을 이어주고 모드 종료 (같은 블럭이면 취소).
    if (connectingId) {
      e.preventDefault()
      if (blockId !== connectingId) {
        const source = blocks.find((b) => b.id === connectingId)
        const target = blocks.find((b) => b.id === blockId)
        if (source && target) {
          const sRel = new Set(source.relatedTo || [])
          sRel.add(blockId)
          const tRel = new Set(target.relatedTo || [])
          tRel.add(connectingId)
          onBatchUpdateBlocks([
            { id: connectingId, updates: { relatedTo: Array.from(sRel) } },
            { id: blockId, updates: { relatedTo: Array.from(tRel) } },
          ])
        }
      }
      setConnectingId(null)
      suppressClickRef.current = true // 연결 완료 탭이 상세 다이얼로그를 열지 않도록
      return
    }

    // 선택 토글: 마우스 Ctrl/Cmd 클릭 또는 터치 선택 모드 탭 (드래그하지 않음).
    if (e.ctrlKey || e.metaKey || (e.pointerType === "touch" && touchSelectMode)) {
      e.preventDefault()
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(blockId)) next.delete(blockId)
        else next.add(blockId)
        return next
      })
      suppressClickRef.current = true // 선택 토글 탭이 상세 다이얼로그를 열지 않도록
      return
    }

    const block = blocks.find((b) => b.id === blockId)
    if (!block) return

    // event-time 의 alt 키 상태를 우선 신뢰. state(isCopyMode) 만 보면
    // alt-keydown 이벤트가 누락되거나(blur 등) 정리되지 않은 채 stuck 된 경우
    // 일반 클릭에도 복제가 발생할 수 있다.
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      onCopyBlock(blockId)
      return
    }

    // 선택된 블럭(2개 이상)을 드래그하면 선택 전체가 같이 이동한다 (그룹 드래그).
    if (selectedIds.size > 1 && selectedIds.has(blockId)) {
      const starts = new Map<string, { x: number; y: number }>()
      blocks.forEach((b) => {
        if (selectedIds.has(b.id) && !b.isCompleted && !b.isGuide) starts.set(b.id, { x: b.x, y: b.y })
      })
      groupDragRef.current = { starts }
    } else {
      groupDragRef.current = null
      // 선택에 없는 블럭을 평범하게 누르면 기존 선택을 해제한다 (단일 드래그 흐름 유지).
      if (selectedIds.size > 0 && !selectedIds.has(blockId)) {
        setSelectedIds(new Set())
      }
    }

    activePointerIdRef.current = e.pointerId
    setDraggingId(blockId)
    // 블럭은 transform 된 wrapper 안에 그려지므로 화면상 위치는 block.x * scale + pan.x.
    // offset 을 화면좌표 기준으로 잡고, move 시점에 다시 pan/scale 을 빼서 world 좌표로 환원.
    setOffset({
      x: e.clientX - (block.x * DEFAULT_CANVAS_SCALE + pan.x),
      y: e.clientY - (block.y * DEFAULT_CANVAS_SCALE + pan.y),
    })
    setDragStartPos({ x: block.x, y: block.y })
  }

  useEffect(() => {
    const hasMovedFromStart = (block: WorkBlock) =>
      Boolean(
        dragStartPos &&
          (Math.abs(block.x - dragStartPos.x) > 0.5 || Math.abs(block.y - dragStartPos.y) > 0.5),
      )

    const handleMouseMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      if (draggingId) {
        const newX = (e.clientX - offset.x - pan.x) / DEFAULT_CANVAS_SCALE
        const newY = (e.clientY - offset.y - pan.y) / DEFAULT_CANVAS_SCALE

        const group = groupDragRef.current
        if (group && dragStartPos) {
          // 앵커 블럭이 움직인 만큼 선택 전체를 같이 이동 (드래그 중엔 히스토리 없이).
          const dx = newX - dragStartPos.x
          const dy = newY - dragStartPos.y
          const updates = Array.from(group.starts.entries()).map(([id, s]) => ({
            id,
            updates: { x: s.x + dx, y: s.y + dy },
          }))
          onBatchUpdateBlocks(updates, true)
        } else {
          onUpdateBlock(draggingId, { x: newX, y: newY }, true)
        }
      }
    }

    const handleMouseUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return
      activePointerIdRef.current = null
      if (draggingId) {
        // 그룹 드래그 — 아카이브/연결 로직 없이 최종 위치만 한 번 히스토리에 커밋.
        if (groupDragRef.current) {
          const anchor = blocks.find((b) => b.id === draggingId)
          if (anchor && hasMovedFromStart(anchor)) {
            const finalUpdates = Array.from(groupDragRef.current.starts.keys())
              .map((id) => {
                const b = blocks.find((x) => x.id === id)
                return b ? { id, updates: { x: b.x, y: b.y } } : null
              })
              .filter((u): u is { id: string; updates: { x: number; y: number } } => u !== null)
            onBatchUpdateBlocks(finalUpdates, false)
          }
          groupDragRef.current = null
          setDraggingId(null)
          setDragStartPos(null)
          return
        }

        const block = blocks.find((b) => b.id === draggingId)
        if (!block) {
          setDraggingId(null)
          setDragStartPos(null)
          return
        }

        if (!block.isCompleted && !block.isGuide) {
          const canvasRect = canvasRef.current?.getBoundingClientRect()
          const dockEl = typeof document !== "undefined" ? document.querySelector("[data-archive-dock]") : null
          const dockRect = dockEl?.getBoundingClientRect()
          const blockRect = {
            left: (canvasRect?.left ?? 0) + block.x * DEFAULT_CANVAS_SCALE + pan.x,
            right: (canvasRect?.left ?? 0) + (block.x + block.width) * DEFAULT_CANVAS_SCALE + pan.x,
            top: (canvasRect?.top ?? 0) + block.y * DEFAULT_CANVAS_SCALE + pan.y,
            bottom: (canvasRect?.top ?? 0) + (block.y + block.height) * DEFAULT_CANVAS_SCALE + pan.y,
          }
          const droppedOnArchiveDock = Boolean(
            dockRect &&
              !(
                blockRect.right < dockRect.left - ARCHIVE_DROP_PADDING ||
                blockRect.left > dockRect.right + ARCHIVE_DROP_PADDING ||
                blockRect.bottom < dockRect.top - ARCHIVE_DROP_PADDING ||
                blockRect.top > dockRect.bottom + ARCHIVE_DROP_PADDING
              ),
          )

          if (droppedOnArchiveDock) {
            const restoreX = dragStartPos?.x ?? block.x
            const restoreY = dragStartPos?.y ?? block.y
            const nextFlight: ArchiveFlight = {
              id: draggingId,
              targetX:
                ((dockRect?.left ?? 0) + (dockRect?.width ?? 0) / 2 - (canvasRect?.left ?? 0) - pan.x) /
                  DEFAULT_CANVAS_SCALE -
                block.width / 2,
              targetY:
                ((dockRect?.top ?? 0) + (dockRect?.height ?? 0) / 2 - (canvasRect?.top ?? 0) - pan.y) /
                  DEFAULT_CANVAS_SCALE -
                block.height / 2,
              restoreX,
              restoreY,
            }

            if (archiveFlightTimerRef.current !== null) {
              window.clearTimeout(archiveFlightTimerRef.current)
            }

            setArchiveFlight(nextFlight)
            setDraggingId(null)
            setDragStartPos(null)

            archiveFlightTimerRef.current = window.setTimeout(() => {
              onUpdateBlock(nextFlight.id, {
                isCompleted: true,
                x: nextFlight.restoreX,
                y: nextFlight.restoreY,
              })
              setArchiveFlight((current) => (current?.id === nextFlight.id ? null : current))
              archiveFlightTimerRef.current = null
            }, ARCHIVE_FLIGHT_MS)
            return
          }

          // 연결은 Shift 누른 채 드롭한 경우에만. 그 외 드롭은 단순 위치 이동(쌓기 가능).
          if (e.shiftKey) {
            // Shift 드롭 = 토스 — 겹친 블럭과 연결 형성 + 원위치로 부드럽게 복귀.
            const overlappingBlocks = blocks.filter((b) => {
              if (b.id === draggingId || b.isCompleted || b.isGuide) return false
              const horizontalOverlap = block.x + block.width > b.x && block.x < b.x + b.width
              const verticalOverlap = block.y + block.height > b.y && block.y < b.y + b.height
              return horizontalOverlap && verticalOverlap
            })

            const currentRelations = new Set(block.relatedTo || [])
            const newConnections =
              overlappingBlocks.length > 0
                ? overlappingBlocks.map((b) => b.id).filter((id) => !currentRelations.has(id))
                : []

            // 드래그된 블럭 — 무조건 원위치로 복귀 (Shift 의 의도). 연결 페어가 있으면 같이 갱신.
            if (dragStartPos) {
              const draggingUpdates: Partial<WorkBlock> = {
                x: dragStartPos.x,
                y: dragStartPos.y,
              }
              if (newConnections.length > 0) {
                draggingUpdates.relatedTo = [...currentRelations, ...newConnections]
              }
              const updates: Array<{ id: string; updates: Partial<WorkBlock> }> = [
                { id: draggingId, updates: draggingUpdates },
              ]
              // 양방향 동기화 — 상대 블럭의 relatedTo 에도 추가.
              overlappingBlocks.forEach((nearby) => {
                if (!newConnections.includes(nearby.id)) return
                const nearbyRelations = new Set(nearby.relatedTo || [])
                if (!nearbyRelations.has(block.id)) {
                  nearbyRelations.add(block.id)
                  updates.push({
                    id: nearby.id,
                    updates: { relatedTo: Array.from(nearbyRelations) },
                  })
                }
              })
              // 부드러운 복귀 애니메이션 — wrapper 의 transition 을 잠시 켠다.
              setTossingBackId(draggingId)
              window.setTimeout(() => setTossingBackId(null), 480)
              onBatchUpdateBlocks(updates)
              setDraggingId(null)
              setDragStartPos(null)
              return
            }
          }
        }

        // 평범한 드롭은 드래그 중 skipHistory 로 위치만 갱신하고,
        // 마우스를 놓는 순간 최종 좌표 하나만 히스토리에 남긴다.
        if (hasMovedFromStart(block)) {
          onUpdateBlock(draggingId, { x: block.x, y: block.y })
        }
      }
      setDraggingId(null)
      setDragStartPos(null)
    }

    if (draggingId) {
      window.addEventListener("pointermove", handleMouseMove)
      window.addEventListener("pointerup", handleMouseUp)
      window.addEventListener("pointercancel", handleMouseUp)
    }

    return () => {
      window.removeEventListener("pointermove", handleMouseMove)
      window.removeEventListener("pointerup", handleMouseUp)
      window.removeEventListener("pointercancel", handleMouseUp)
    }
  }, [draggingId, offset, pan, dragStartPos, onUpdateBlock, onBatchUpdateBlocks, blocks])

  const getBlockVisibility = (block: WorkBlock) => {
    if (!selectedZone) return "normal"
    return block.zone === selectedZone ? "emphasized" : "dimmed"
  }

  const handleLineClick = (e: React.MouseEvent, blockId: string, relatedId: string) => {
    e.stopPropagation()
    e.preventDefault()

    const block = blocks.find((b) => b.id === blockId)
    const relatedBlock = blocks.find((b) => b.id === relatedId)

    if (!block || !relatedBlock) return

    const updates: Array<{ id: string; updates: Partial<WorkBlock> }> = []

    if (block.relatedTo) {
      const newRelatedTo = block.relatedTo.filter((id) => id !== relatedId)
      updates.push({ id: blockId, updates: { relatedTo: newRelatedTo } })
    }

    if (relatedBlock.relatedTo) {
      const newRelatedTo = relatedBlock.relatedTo.filter((id) => id !== blockId)
      updates.push({
        id: relatedId,
        updates: { relatedTo: newRelatedTo },
      })
    }

    onBatchUpdateBlocks(updates)
  }

  const renderRelationshipLines = () => {
    if (!showRelationships) return null

    const linesToRender: JSX.Element[] = []
    const processedPairs = new Set<string>()
    // id → block 조회 맵. 아래 중첩 루프에서 blocks.find(O(n)) 대신 O(1) 조회로 O(n²) 를 O(n) 으로.
    const byId = new Map(blocks.map((b) => [b.id, b]))

    const baseOpacity = 0.6

    blocks.forEach((block) => {
      if (block.isCompleted) return
      if (!block.relatedTo || block.relatedTo.length === 0) return

      block.relatedTo.forEach((relatedId) => {
        const pairKey = [block.id, relatedId].sort().join("-")
        if (processedPairs.has(pairKey)) return
        processedPairs.add(pairKey)

        const relatedBlock = byId.get(relatedId)
        if (!relatedBlock || relatedBlock.isCompleted) return

        const bothInSelectedZone = selectedZone && block.zone === selectedZone && relatedBlock.zone === selectedZone
        const oneInSelectedZone = selectedZone && (block.zone === selectedZone || relatedBlock.zone === selectedZone)
        const crossZone = block.zone !== relatedBlock.zone

        let opacity = baseOpacity
        if (selectedZone) {
          if (bothInSelectedZone) {
            opacity = 0.85
          } else if (oneInSelectedZone) {
            opacity = 0.6
          } else if (crossZone) {
            opacity = 0.35
          }
        } else if (crossZone) {
          opacity = 0.45
        }

        // 블럭 사각형 가장자리에서 끊기. 중심-중심 라인이 블럭 안을 가로지르지 않도록.
        const c1x = block.x + block.width / 2
        const c1y = block.y + block.height / 2
        const c2x = relatedBlock.x + relatedBlock.width / 2
        const c2y = relatedBlock.y + relatedBlock.height / 2

        const clipToRect = (
          cx: number,
          cy: number,
          w: number,
          h: number,
          tx: number,
          ty: number,
        ): { x: number; y: number } => {
          const ddx = tx - cx
          const ddy = ty - cy
          if (ddx === 0 && ddy === 0) return { x: cx, y: cy }
          const sx = ddx === 0 ? Infinity : (w / 2) / Math.abs(ddx)
          const sy = ddy === 0 ? Infinity : (h / 2) / Math.abs(ddy)
          const s = Math.min(sx, sy)
          return { x: cx + ddx * s, y: cy + ddy * s }
        }

        const start = clipToRect(c1x, c1y, block.width, block.height, c2x, c2y)
        const end = clipToRect(c2x, c2y, relatedBlock.width, relatedBlock.height, c1x, c1y)

        const dx = end.x - start.x
        const dy = end.y - start.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // 너무 짧으면(블럭이 거의 닿아있거나 겹침) 곡선 그리지 않음. 시각적 노이즈만 됨.
        if (distance < 8) return

        // 라인에 수직인 방향으로 곡률 줘서 위/아래 어느 방향이든 자연스럽게.
        const nx = -dy / distance
        const ny = dx / distance
        const bow = Math.min(distance * 0.12, 40)
        const cpX = (start.x + end.x) / 2 + nx * bow
        const cpY = (start.y + end.y) / 2 + ny * bow

        const d = `M ${start.x} ${start.y} Q ${cpX} ${cpY} ${end.x} ${end.y}`

        linesToRender.push(
          <g
            key={pairKey}
            className="group cursor-pointer"
            onClick={(e) => handleLineClick(e, block.id, relatedId)}
            style={{ pointerEvents: "auto", animation: "lineFadeIn 220ms ease-out" }}
          >
            {/* hit-area: 클릭 잘 잡히도록 두꺼운 투명 라인 */}
            <path d={d} stroke="transparent" strokeWidth="30" fill="none" strokeLinecap="round" />
            {/* 본선 — 블럭의 box-shadow 와 같은 결의 부드러운 외곽광. svg filter 로 처리. */}
            <path
              d={d}
              stroke="currentColor"
              strokeWidth="0.6"
              fill="none"
              className={`transition-[stroke-width,color] duration-200 group-hover:stroke-[1.4] ${
                isDarkMode
                  ? "text-white group-hover:text-white"
                  : "text-stone-600 group-hover:text-stone-800"
              }`}
              style={{ opacity, filter: `url(#${isDarkMode ? "lineGlowDark" : "lineGlowLight"})` }}
              strokeLinecap="round"
              pointerEvents="none"
            />
          </g>,
        )
      })
    })

    return linesToRender
  }

  const activeBlocks = blocks.filter((b) => !b.isCompleted)
  const zonesArray = zones.map((z) => ({ id: z.id, label: z.label }))
  // 대표(공지) 블럭 — 캔버스당 1개. 캔버스 상단 배너로 노출.
  const pinnedBlock = blocks.find((b) => b.isPinned && !b.isCompleted && !b.isDeleted)

  // 선택 일괄 동작.
  const applyUrgencyToSelection = (urgency: WorkBlock["urgency"]) => {
    if (selectedIds.size === 0) return
    onBatchUpdateBlocks(Array.from(selectedIds).map((id) => ({ id, updates: { urgency } })))
  }
  const archiveSelection = () => {
    if (selectedIds.size === 0) return
    onBatchUpdateBlocks(Array.from(selectedIds).map((id) => ({ id, updates: { isCompleted: true } })))
    setSelectedIds(new Set())
  }

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      className={`fixed inset-0 top-[104px] overflow-hidden transition-colors duration-700 ${
        isDarkMode ? (selectedZone ? "bg-zinc-800" : "bg-zinc-900") : selectedZone ? "bg-[#f5f5f4]" : "bg-[#fafaf9]"
      }`}
      style={{
        backgroundImage: isDarkMode
          ? "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)"
          : "radial-gradient(circle, rgba(0,0,0,0.015) 1px, transparent 1px)",
        // pan 만큼 배경 도트도 함께 흘러야 자연스럽다.
        backgroundSize: `${48 * DEFAULT_CANVAS_SCALE}px ${48 * DEFAULT_CANVAS_SCALE}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : isCopyMode ? "copy" : "default",
        // 터치가 브라우저 스크롤/줌으로 새지 않고 캔버스 팬/드래그에 쓰이도록.
        touchAction: "none",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${DEFAULT_CANVAS_SCALE})`,
          transformOrigin: "0 0",
          // 팬 중에는 transition 없이 즉각 반응. 손 떼면 OS 가 한 프레임 보간하도록.
          willChange: isPanning ? "transform" : "auto",
        }}
      >
      <svg
        className="absolute inset-0"
        style={{ zIndex: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
      >
        <defs>
          {/* 라인 외곽광 — 본선의 알파만 블러 → 색을 따로 입혀서 발광체처럼 보이게.
              라이트 모드는 본선과 어울리는 따뜻한 회갈색 halo, 다크 모드는 백색 halo. */}
          {/* 두 단계 halo: 좁은 밝은 코어 + 넓고 부드러운 외광. 진짜 발광체처럼 보이게. */}
          <filter id="lineGlowLight" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.6" in="SourceAlpha" result="blurNear" />
            <feGaussianBlur stdDeviation="5" in="SourceAlpha" result="blurFar" />
            <feFlood floodColor="#a8a29e" floodOpacity="1" result="haloColor" />
            <feComposite in="haloColor" in2="blurNear" operator="in" result="haloNear" />
            <feComposite in="haloColor" in2="blurFar" operator="in" result="haloFar" />
            <feMerge>
              <feMergeNode in="haloFar" />
              <feMergeNode in="haloNear" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lineGlowDark" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.8" in="SourceAlpha" result="blurNear" />
            <feGaussianBlur stdDeviation="6" in="SourceAlpha" result="blurFar" />
            <feFlood floodColor="#ffffff" floodOpacity="1" result="haloColor" />
            <feComposite in="haloColor" in2="blurNear" operator="in" result="haloNear" />
            <feComposite in="haloColor" in2="blurFar" operator="in" result="haloFar" />
            <feMerge>
              <feMergeNode in="haloFar" />
              <feMergeNode in="haloNear" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g style={{ pointerEvents: "auto" }}>{renderRelationshipLines()}</g>
      </svg>

      <div className="relative" style={{ zIndex: 10 }}>
        {activeBlocks.map((block) => (
          <WorkBlockCard
            key={block.id}
            block={block}
            isDragging={draggingId === block.id}
            visibility={getBlockVisibility(block)}
            onPointerDown={(e) => handlePointerDown(e, block.id)}
            suppressClickRef={suppressClickRef}
            onUpdate={(updates, skipHistory) => onUpdateBlock(block.id, updates, skipHistory)}
            zones={zonesArray}
            isDarkMode={isDarkMode}
            isCopyMode={isCopyMode}
            isTossingBack={tossingBackId === block.id}
            isSelected={selectedIds.has(block.id) || block.id === connectingId}
            dimmed={selectedIds.size > 0 && !selectedIds.has(block.id)}
            onTogglePin={onTogglePin ? () => onTogglePin(block.id) : undefined}
            onCopy={() => onCopyBlock(block.id)}
            onStartConnect={() => setConnectingId(block.id)}
            archiveFlight={
              archiveFlight?.id === block.id
                ? {
                    targetX: archiveFlight.targetX,
                    targetY: archiveFlight.targetY,
                  }
                : null
            }
          />
        ))}

        {previewBlock && (
          <div
            className="absolute animate-pulse"
            style={{
              left: previewBlock.x,
              top: previewBlock.y,
              width: previewBlock.width,
              height: previewBlock.height,
              zIndex: 100,
            }}
          >
            <div
              className={`w-full h-full rounded-lg border-4 border-dashed ${
                isDarkMode ? "border-blue-400 bg-blue-950/30" : "border-blue-500 bg-blue-50/50"
              } flex items-center justify-center`}
            >
              <div className="text-center p-4">
                <p className={`font-medium mb-1 ${isDarkMode ? "text-blue-300" : "text-blue-700"}`}>
                  {previewBlock.title}
                </p>
                <p className={`text-xs ${isDarkMode ? "text-blue-400/70" : "text-blue-600/70"}`}>
                  이 위치에 생성됩니다
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>

      {/* 대표(공지) 블럭 배너 — 캔버스 상단(헤더 아래)에 고정. 팬/줌 무관. 클릭 시 상세 열림. */}
      {pinnedBlock && (
        <div className="absolute left-1/2 top-7 z-[70] w-[min(90%,420px)] -translate-x-1/2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail?.(pinnedBlock.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onOpenDetail?.(pinnedBlock.id)
              }
            }}
            title={pinnedBlock.title}
            className={`flex cursor-pointer items-center gap-4 rounded-2xl px-3.5 py-2.5 transition-all active:scale-[0.99] ${
              isDarkMode
                ? "bg-zinc-800/95 text-zinc-100 hover:bg-zinc-800"
                : "bg-white/95 text-gray-900 hover:bg-white"
            }`}
            style={{ boxShadow: `0 0 16px rgba(${NOTICE_RGB}, 0.5)` }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px]"
              style={{
                borderColor: `rgba(${NOTICE_RGB}, 0.85)`,
                boxShadow: `0 0 9px rgba(${NOTICE_RGB}, 0.5)`,
              }}
            >
              <Pin className="h-4 w-4 -rotate-45" style={{ color: `rgb(${NOTICE_RGB})` }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{pinnedBlock.title || "제목 없음"}</div>
              {(pinnedBlock.detailedNotes || pinnedBlock.description) && (
                <div className={`truncate text-xs leading-tight ${isDarkMode ? "text-zinc-400" : "text-gray-500"}`}>
                  {pinnedBlock.detailedNotes || pinnedBlock.description}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin?.(pinnedBlock.id)
              }}
              className={`shrink-0 rounded-full p-1.5 transition-colors ${
                isDarkMode ? "text-zinc-400 hover:bg-white/10" : "text-gray-400 hover:bg-black/5"
              }`}
              aria-label="고정 해제"
              title="고정 해제"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 터치 전용: 선택 모드 토글 (마우스는 Ctrl 로 대체됨).
          hover:none(주 입력이 hover 불가)이 아니라 any-pointer:coarse(터치스크린 존재)로 판정 —
          태블릿에 마우스만 연결하면(키보드 없음) hover:hover 가 되어 버튼이 사라지는데
          Ctrl 도 없어 멀티 선택 수단이 전무해지는 구멍을 막는다. 터치 랩탑도 손가락만으로 선택 가능. */}
      <button
        onClick={() => {
          setTouchSelectMode((v) => {
            if (v) setSelectedIds(new Set()) // 끌 때 선택 해제
            return !v
          })
        }}
        className={`absolute bottom-5 left-5 z-[75] hidden rounded-full border px-4 py-2.5 text-xs font-medium shadow-md transition-colors [@media(any-pointer:coarse)]:block ${
          touchSelectMode
            ? "border-violet-600 bg-violet-600 text-white"
            : isDarkMode
              ? "border-zinc-700 bg-zinc-800 text-zinc-200"
              : "border-gray-200 bg-white text-gray-700"
        }`}
      >
        {touchSelectMode ? "선택 모드 ✕" : "선택 모드"}
      </button>

      {/* 연결 모드 안내 */}
      {connectingId && (
        <div className="absolute bottom-5 left-1/2 z-[80] -translate-x-1/2">
          <div
            className={`flex items-center gap-3 rounded-full border px-4 py-2 text-xs shadow-md ${
              isDarkMode ? "border-zinc-700 bg-zinc-800 text-zinc-100" : "border-gray-200 bg-white text-gray-800"
            }`}
          >
            <span>연결할 블럭을 탭하세요</span>
            <button
              onClick={() => setConnectingId(null)}
              className="rounded-full px-2 py-0.5 font-medium text-violet-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Ctrl+드래그 마퀴(박스 선택) 사각형 */}
      {marquee && (
        <div
          className="pointer-events-none absolute z-[80] rounded-sm border border-violet-500 bg-violet-500/10"
          style={{
            left: Math.min(marquee.startX, marquee.curX),
            top: Math.min(marquee.startY, marquee.curY),
            width: Math.abs(marquee.curX - marquee.startX),
            height: Math.abs(marquee.curY - marquee.startY),
          }}
        />
      )}

      {/* 선택 일괄 툴바 */}
      {selectedIds.size > 0 && (
        <div className="absolute left-1/2 top-4 z-[90] -translate-x-1/2">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg ${
              isDarkMode ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-white border-gray-200 text-gray-800"
            }`}
          >
            <span className="text-xs font-medium tabular-nums">{selectedIds.size}개 선택</span>
            <span className={`h-4 w-px ${isDarkMode ? "bg-zinc-700" : "bg-gray-200"}`} />
            <div className="flex items-center gap-1">
              {URGENCY_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => applyUrgencyToSelection(key)}
                  title={URGENCY_META[key].label}
                  aria-label={URGENCY_META[key].label}
                  className="h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110"
                  style={{ backgroundColor: `rgb(${URGENCY_RGB[key]})` }}
                />
              ))}
            </div>
            <span className={`h-4 w-px ${isDarkMode ? "bg-zinc-700" : "bg-gray-200"}`} />
            <button
              onClick={archiveSelection}
              className="rounded-full px-2 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
            >
              갈무리
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className={`rounded-full px-2 py-0.5 text-xs hover:bg-black/5 dark:hover:bg-white/10 ${
                isDarkMode ? "text-zinc-400" : "text-gray-400"
              }`}
            >
              해제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
