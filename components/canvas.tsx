"use client"

import type React from "react"
import type { JSX } from "react"
import { useRef, useState, useEffect } from "react"
import { WorkBlockCard } from "@/components/work-block-card"
import type { WorkBlock, Zone } from "@/types"

interface CanvasProps {
  blocks: WorkBlock[]
  zones: Zone[]
  selectedZone: string | null
  showRelationships: boolean
  showCompletedBlocks: boolean
  onUpdateBlock: (id: string, updates: Partial<WorkBlock>, skipHistory?: boolean) => void
  onBatchUpdateBlocks: (updates: Array<{ id: string; updates: Partial<WorkBlock> }>) => void
  onCopyBlock: (sourceBlockId: string) => void
  onArchiveBlock: (id: string) => void
  isDarkMode: boolean
  previewBlock?: Partial<WorkBlock> | null // Add preview block prop
}

// 독 아이콘 drop 감지 여유 (픽셀). 아이콘 bounds 주변 이 값만큼 확장해서 hit test.
const ARCHIVE_DROP_PADDING = 40

export function Canvas({
  blocks,
  zones,
  selectedZone,
  showRelationships,
  showCompletedBlocks,
  onUpdateBlock,
  onBatchUpdateBlocks,
  onCopyBlock,
  onArchiveBlock,
  isDarkMode,
  previewBlock, // Receive preview block
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  // 드래그 시작 시점의 블럭 좌표. 독으로 드롭해서 갈무리될 때 이 좌표로 복원해 꺼낼 때 원래 자리로 돌려놓는다.
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [isCopyMode, setIsCopyMode] = useState(false)
  // Shift 토스 복귀 애니메이션 — 해당 블럭만 일시적으로 left/top 트랜지션을 켠다.
  const [tossingBackId, setTossingBackId] = useState<string | null>(null)
  // 피그마식 팬: 스페이스바 누른 채 드래그하면 캔버스 전체가 따라온다.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null)

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
      }
    }
    const handleBlur = () => {
      // 윈도우 포커스 잃으면 키 떼는 이벤트를 못 받을 수 있으니 안전하게 리셋.
      setIsSpacePressed(false)
      setIsPanning(false)
      panStartRef.current = null
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

    const handleMove = (e: MouseEvent) => {
      const start = panStartRef.current
      if (!start) return
      setPan({
        x: start.panX + (e.clientX - start.mouseX),
        y: start.panY + (e.clientY - start.mouseY),
      })
    }
    const handleUp = () => {
      setIsPanning(false)
      panStartRef.current = null
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [isPanning])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!isSpacePressed) return
    if (e.button !== 0) return
    e.preventDefault()
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsPanning(true)
  }

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (isSpacePressed) return // 스페이스 누른 상태면 블럭이 아니라 캔버스 팬을 우선.

    const block = blocks.find((b) => b.id === blockId)
    if (!block) return

    if (isCopyMode) {
      onCopyBlock(blockId)
      return
    }

    setDraggingId(blockId)
    // 블럭은 transform 된 wrapper 안에 그려지므로 화면상 위치는 block.x + pan.x.
    // offset 을 화면좌표 기준으로 잡고, move 시점에 다시 pan 을 빼서 world 좌표로 환원.
    setOffset({
      x: e.clientX - (block.x + pan.x),
      y: e.clientY - (block.y + pan.y),
    })
    setDragStartPos({ x: block.x, y: block.y })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId) {
        const newX = e.clientX - offset.x - pan.x
        const newY = e.clientY - offset.y - pan.y

        onUpdateBlock(
          draggingId,
          {
            x: newX,
            y: newY,
          },
          true,
        )
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (draggingId && canvasRef.current) {
        const block = blocks.find((b) => b.id === draggingId)
        if (!block) {
          setDraggingId(null)
          setDragStartPos(null)
          return
        }

        const canvasRect = canvasRef.current.getBoundingClientRect()

        // 독 아이콘 bounds 와 블럭 bounds 의 겹침 여부로 판별. 블럭의 어느 부분이든 닿으면 OK.
        const dockEl = typeof document !== "undefined" ? document.querySelector("[data-archive-dock]") : null
        const dockRect = dockEl?.getBoundingClientRect()

        // 블럭은 pan 만큼 transform 된 wrapper 안에 있으니 화면좌표 계산에 pan 보정.
        const blockClient = {
          left: canvasRect.left + block.x + pan.x,
          right: canvasRect.left + block.x + block.width + pan.x,
          top: canvasRect.top + block.y + pan.y,
          bottom: canvasRect.top + block.y + block.height + pan.y,
        }

        const droppedOnDock = Boolean(
          dockRect &&
            !(
              blockClient.right < dockRect.left - ARCHIVE_DROP_PADDING ||
              blockClient.left > dockRect.right + ARCHIVE_DROP_PADDING ||
              blockClient.bottom < dockRect.top - ARCHIVE_DROP_PADDING ||
              blockClient.top > dockRect.bottom + ARCHIVE_DROP_PADDING
            ),
        )

        if (droppedOnDock && !block.isCompleted && !block.isGuide) {
          // 갈무리 — 드래그 시작 위치로 x/y 복원해 꺼낼 때 원래 자리에서 나타나도록.
          const restoreX = dragStartPos?.x ?? block.x
          const restoreY = dragStartPos?.y ?? block.y
          onUpdateBlock(draggingId, { isCompleted: true, x: restoreX, y: restoreY })
          setDraggingId(null)
          setDragStartPos(null)
          return
        }

        if (!block.isCompleted && !block.isGuide) {
          // Shift 누른 채 드롭 = "연결 토스" 제스처. 연결만 만들고 원위치로 튕겨 돌아간다.
          const tossBack = e.shiftKey

          // 실제로 겹쳐야 연결. 가까이 있다고 자동 연결하지 않음.
          const overlappingBlocks = blocks.filter((b) => {
            if (b.id === draggingId || b.isCompleted || b.isGuide) return false

            const horizontalOverlap = block.x + block.width > b.x && block.x < b.x + b.width
            const verticalOverlap = block.y + block.height > b.y && block.y < b.y + b.height

            return horizontalOverlap && verticalOverlap
          })

          if (overlappingBlocks.length > 0) {
            const updates: Array<{ id: string; updates: Partial<WorkBlock> }> = []

            const currentRelations = new Set(block.relatedTo || [])
            const overlappingIds = overlappingBlocks.map((b) => b.id)

            const newConnections = overlappingIds.filter((id) => !currentRelations.has(id))

            // 드래그된 블럭 업데이트 — 토스면 원위치 복원 같이.
            const draggingUpdates: Partial<WorkBlock> = {}
            if (newConnections.length > 0) {
              draggingUpdates.relatedTo = [...currentRelations, ...newConnections]
            }
            if (tossBack && dragStartPos) {
              draggingUpdates.x = dragStartPos.x
              draggingUpdates.y = dragStartPos.y
            }
            if (Object.keys(draggingUpdates).length > 0) {
              updates.push({ id: draggingId, updates: draggingUpdates })
            }

            // 상대 블럭의 relatedTo 도 양방향으로 동기화 (새 연결만).
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

            if (updates.length > 0) {
              if (tossBack) {
                // 부드러운 복귀 애니메이션 — 해당 블럭 wrapper 의 transition 을 잠시 켜둔다.
                setTossingBackId(draggingId)
                window.setTimeout(() => setTossingBackId(null), 480)
              }
              onBatchUpdateBlocks(updates)
              setDraggingId(null)
              setDragStartPos(null)
              return
            }
          }
        }
      }
      setDraggingId(null)
      setDragStartPos(null)
    }

    if (draggingId) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
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

    const baseOpacity = 0.6

    blocks.forEach((block) => {
      if (block.isCompleted) return
      if (!block.relatedTo || block.relatedTo.length === 0) return

      block.relatedTo.forEach((relatedId) => {
        const pairKey = [block.id, relatedId].sort().join("-")
        if (processedPairs.has(pairKey)) return
        processedPairs.add(pairKey)

        const relatedBlock = blocks.find((b) => b.id === relatedId)
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
            <path d={d} stroke="transparent" strokeWidth="24" fill="none" strokeLinecap="round" />
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
  const completedBlocks = blocks.filter((b) => b.isCompleted)

  const zonesArray = zones.map((z) => ({ id: z.id, label: z.label }))

  return (
    <div
      ref={canvasRef}
      onMouseDown={handleCanvasMouseDown}
      className={`fixed inset-0 top-[104px] overflow-hidden transition-colors duration-700 ${
        isDarkMode ? (selectedZone ? "bg-zinc-800" : "bg-zinc-900") : selectedZone ? "bg-[#f5f5f4]" : "bg-[#fafaf9]"
      }`}
      style={{
        backgroundImage: isDarkMode
          ? "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)"
          : "radial-gradient(circle, rgba(0,0,0,0.015) 1px, transparent 1px)",
        // pan 만큼 배경 도트도 함께 흘러야 자연스럽다.
        backgroundSize: "48px 48px",
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : isCopyMode ? "copy" : "default",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
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
            onMouseDown={(e) => handleMouseDown(e, block.id)}
            onUpdate={(updates, skipHistory) => onUpdateBlock(block.id, updates, skipHistory)}
            onArchive={() => onArchiveBlock(block.id)}
            zones={zonesArray}
            isDarkMode={isDarkMode}
            isCopyMode={isCopyMode}
            isTossingBack={tossingBackId === block.id}
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

      {showCompletedBlocks && (
        <div className="relative" style={{ zIndex: 5 }}>
          {completedBlocks.map((block) => (
            <WorkBlockCard
              key={block.id}
              block={block}
              isDragging={draggingId === block.id}
              visibility="normal"
              onMouseDown={(e) => handleMouseDown(e, block.id)}
              onUpdate={(updates, skipHistory) => onUpdateBlock(block.id, updates, skipHistory)}
              onArchive={() => onArchiveBlock(block.id)}
              zones={zonesArray}
              isDarkMode={isDarkMode}
              isCopyMode={isCopyMode}
            isTossingBack={tossingBackId === block.id}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
