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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        setIsCopyMode(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) {
        setIsCopyMode(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    const block = blocks.find((b) => b.id === blockId)
    if (!block) return

    if (isCopyMode) {
      onCopyBlock(blockId)
      return
    }

    setDraggingId(blockId)
    setOffset({
      x: e.clientX - block.x,
      y: e.clientY - block.y,
    })
    setDragStartPos({ x: block.x, y: block.y })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId) {
        const newX = e.clientX - offset.x
        const newY = e.clientY - offset.y

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

    const handleMouseUp = () => {
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

        const blockClient = {
          left: canvasRect.left + block.x,
          right: canvasRect.left + block.x + block.width,
          top: canvasRect.top + block.y,
          bottom: canvasRect.top + block.y + block.height,
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
          setDragStartPos(null)
          return
        }

        if (!block.isCompleted && !block.isGuide) {
          const TOLERANCE = 30

          const overlappingBlocks = blocks.filter((b) => {
            if (b.id === draggingId || b.isCompleted || b.isGuide) return false

            const block1 = {
              left: block.x - TOLERANCE,
              right: block.x + block.width + TOLERANCE,
              top: block.y - TOLERANCE,
              bottom: block.y + block.height + TOLERANCE,
            }
            const block2 = {
              left: b.x,
              right: b.x + b.width,
              top: b.y,
              bottom: b.y + b.height,
            }

            const horizontalOverlap = block1.right > block2.left && block1.left < block2.right
            const verticalOverlap = block1.bottom > block2.top && block1.top < block2.bottom

            return horizontalOverlap && verticalOverlap
          })

          if (overlappingBlocks.length > 0) {
            const updates: Array<{ id: string; updates: Partial<WorkBlock> }> = []

            const currentRelations = new Set(block.relatedTo || [])
            const overlappingIds = overlappingBlocks.map((b) => b.id)

            const newConnections = overlappingIds.filter((id) => !currentRelations.has(id))

            if (newConnections.length > 0) {
              const updatedRelations = [...currentRelations, ...newConnections]

              updates.push({
                id: draggingId,
                updates: { relatedTo: updatedRelations },
              })

              overlappingBlocks.forEach((nearby) => {
                const nearbyRelations = new Set(nearby.relatedTo || [])
                if (!nearbyRelations.has(block.id)) {
                  nearbyRelations.add(block.id)
                  updates.push({
                    id: nearby.id,
                    updates: { relatedTo: Array.from(nearbyRelations) },
                  })
                }
              })

              onBatchUpdateBlocks(updates)
              setDraggingId(null)
      setDragStartPos(null)
              return
            }
          }

          onUpdateBlock(draggingId, {
            x: block.x,
            y: block.y,
          })
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
  }, [draggingId, offset, onUpdateBlock, onBatchUpdateBlocks, blocks])

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

    const baseOpacity = 0.3

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
            opacity = 0.6
          } else if (oneInSelectedZone) {
            opacity = 0.35
          } else if (crossZone) {
            opacity = 0.2
          }
        } else if (crossZone) {
          opacity = 0.25
        }

        const x1 = block.x + block.width / 2
        const y1 = block.y + block.height / 2
        const x2 = relatedBlock.x + relatedBlock.width / 2
        const y2 = relatedBlock.y + relatedBlock.height / 2

        const dx = x2 - x1
        const dy = y2 - y1
        const distance = Math.sqrt(dx * dx + dy * dy)

        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        const curve = Math.min(distance * 0.15, 80)

        linesToRender.push(
          <g
            key={pairKey}
            className="group cursor-pointer"
            onClick={(e) => handleLineClick(e, block.id, relatedId)}
            style={{ pointerEvents: "auto" }}
          >
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY - curve} ${x2} ${y2}`}
              stroke="transparent"
              strokeWidth="24"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY - curve} ${x2} ${y2}`}
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className={`transition-all duration-200 group-hover:stroke-[4] ${
                isDarkMode ? "text-zinc-300 group-hover:text-zinc-100" : "text-stone-400 group-hover:text-stone-600"
              }`}
              style={{ opacity }}
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
      className={`fixed inset-0 top-[140px] overflow-hidden transition-colors duration-700 ${
        isDarkMode ? (selectedZone ? "bg-zinc-800" : "bg-zinc-900") : selectedZone ? "bg-[#f5f5f4]" : "bg-[#fafaf9]"
      }`}
      style={{
        backgroundImage: isDarkMode
          ? "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)"
          : "radial-gradient(circle, rgba(0,0,0,0.015) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        cursor: isCopyMode ? "copy" : "default",
      }}
    >
      <svg className="absolute inset-0" style={{ zIndex: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
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
            onUpdate={(updates) => onUpdateBlock(block.id, updates)}
            onArchive={() => onArchiveBlock(block.id)}
            zones={zonesArray}
            isDarkMode={isDarkMode}
            isCopyMode={isCopyMode}
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
              onUpdate={(updates) => onUpdateBlock(block.id, updates)}
              onArchive={() => onArchiveBlock(block.id)}
              zones={zonesArray}
              isDarkMode={isDarkMode}
              isCopyMode={isCopyMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
