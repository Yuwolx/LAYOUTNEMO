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
}

const COMPLETION_ZONE_WIDTH = 400
const COMPLETION_ZONE_HEIGHT = 600
const COMPLETED_BLOCK_WIDTH = 340
const COMPLETED_BLOCK_HEIGHT = 56
const COMPLETED_BLOCK_SPACING = 8
const COMPLETION_PADDING = 30

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
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isCopyMode, setIsCopyMode] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) {
        setIsCopyMode(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey && !e.metaKey) {
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
    if (isCopyMode) {
      const block = blocks.find((b) => b.id === blockId)
      if (!block || block.isGuide) return

      onCopyBlock(blockId)
      return
    }

    const block = blocks.find((b) => b.id === blockId)
    if (!block) return

    setDraggingId(blockId)
    setOffset({
      x: e.clientX - block.x,
      y: e.clientY - block.y,
    })
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
        if (!block || block.isGuide) return

        const TOLERANCE = 20 // pixels of tolerance for connection detection

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
            updates.push({
              id: draggingId,
              updates: { relatedTo: [...currentRelations, ...newConnections] },
            })

            overlappingBlocks.forEach((nearby) => {
              const nearbyRelations = new Set(nearby.relatedTo || [])
              if (!nearbyRelations.has(block.id)) {
                updates.push({
                  id: nearby.id,
                  updates: { relatedTo: [...nearbyRelations, block.id] },
                })
              }
            })

            onBatchUpdateBlocks(updates)
          }
        }
      }
      setDraggingId(null)
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
    if (!showRelationships || (!selectedZone && blocks.length > 10)) return null

    const linesToRender: JSX.Element[] = []
    const processedPairs = new Set<string>()

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

        let opacity = 0.2
        if (selectedZone) {
          if (bothInSelectedZone) {
            opacity = 0.4
          } else if (oneInSelectedZone) {
            opacity = 0.15
          } else {
            return
          }
        } else {
          opacity = crossZone ? 0.12 : 0.25
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
              strokeWidth="20"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY - curve} ${x2} ${y2}`}
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className={`transition-all duration-200 group-hover:stroke-[4] ${
                isDarkMode ? "text-zinc-600 group-hover:text-zinc-400" : "text-stone-400 group-hover:text-stone-600"
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
      {showCompletedBlocks && (
        <div
          className={`absolute bottom-0 right-0 border-2 border-dashed rounded-tl-xl pointer-events-none ${
            isDarkMode ? "border-zinc-700/60 bg-zinc-800/20" : "border-stone-300/40 bg-stone-100/20"
          }`}
          style={{
            width: `${COMPLETION_ZONE_WIDTH}px`,
            height: `${COMPLETION_ZONE_HEIGHT}px`,
            zIndex: 1,
          }}
        >
          <div
            className={`absolute top-4 left-4 text-sm font-light ${isDarkMode ? "text-zinc-400" : "text-stone-400"}`}
          >
            완료된 업무
          </div>
        </div>
      )}

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
