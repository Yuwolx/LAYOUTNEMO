"use client"

import type React from "react"

import { MoreVertical, Trash2, Sparkles, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WorkBlock } from "@/types"
import { useState, useRef } from "react"
import { BlockDetailDialog } from "@/components/block-detail-dialog"

interface WorkBlockCardProps {
  block: WorkBlock
  isDragging: boolean
  visibility: "normal" | "emphasized" | "dimmed"
  onMouseDown: (e: React.MouseEvent) => void
  onUpdate: (updates: Partial<WorkBlock>) => void
  onArchive: () => void
  zones: Array<{ id: string; label: string }>
  isDarkMode: boolean
  isCopyMode?: boolean // Added isCopyMode prop
}

const urgencyShadows = {
  stable: "shadow-[0_4px_18px_rgba(0,0,0,0.12)]",
  thinking: "shadow-[0_6px_24px_rgba(59,130,246,0.45)]",
  lingering: "shadow-[0_6px_24px_rgba(251,191,36,0.5)]",
  urgent: "shadow-[0_6px_26px_rgba(251,146,60,0.55)]",
}

export function WorkBlockCard({
  block,
  isDragging,
  visibility,
  onMouseDown,
  onUpdate,
  onArchive,
  zones,
  isDarkMode,
  isCopyMode = false, // Added isCopyMode with default value
}: WorkBlockCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const isMovingRef = useRef(false)

  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false
  const isAIControl = block.isAIControl || false
  const aiEnabled = block.aiEnabled !== undefined ? block.aiEnabled : false

  const shadowClass = isCompleted ? urgencyShadows.stable : urgencyShadows[block.urgency || "stable"]

  const completedOpacity = isCompleted ? "opacity-80" : "opacity-100"

  const opacityClass = visibility === "dimmed" ? "opacity-25" : completedOpacity
  const scaleClass = visibility === "emphasized" ? "scale-[1.03]" : "scale-100"
  const contrastClass = visibility === "emphasized" ? "brightness-105" : "brightness-100"

  const handleMouseDown = (e: React.MouseEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY }
    isMovingRef.current = false
    onMouseDown(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx > 5 || dy > 5) {
      isMovingRef.current = true
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isMovingRef.current && !isDragging && !isCopyMode) {
      if (isAIControl) {
        // Toggle AI state
        onUpdate({
          aiEnabled: !aiEnabled,
          description: !aiEnabled ? "AI 보조가 켜져 있습니다." : "AI 보조가 꺼져 있습니다.",
        })
      } else {
        setShowDetail(true)
      }
    }
    isMovingRef.current = false
  }

  return (
    <>
      <div
        className={`absolute group ${isCopyMode ? "cursor-copy" : isCompleted ? "cursor-grab" : "cursor-move"}`}
        style={{
          left: block.x,
          top: block.y,
          width: isCompleted ? 340 : block.width, // Increased from 240 to 340 for better fit
          height: isCompleted ? 56 : block.height,
          transition: isDragging ? "none" : "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: isDragging ? 50 : visibility === "emphasized" ? 20 : isCompleted ? 5 : 10,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        <div
          className={`
          w-full h-full bg-white border-border/60 rounded-2xl
          hover:shadow-xl hover:border-border
          ${shadowClass}
          ${opacityClass}
          ${scaleClass}
          ${contrastClass}
          ${isDragging ? "shadow-2xl scale-105 border-border cursor-grabbing" : ""}
          ${isCompleted ? "shadow-sm hover:opacity-60 p-3 rounded-lg" : "p-6"}
          ${isAIControl && aiEnabled ? "ring-2 ring-blue-400/30" : ""}
          ${isAIControl && !aiEnabled ? "opacity-60" : ""}
          transition-all duration-400
        `}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-2 flex items-center gap-2">
              {isAIControl && (
                <div className={`flex-shrink-0 ${aiEnabled ? "text-blue-600" : "text-muted-foreground/40"}`}>
                  {aiEnabled ? <Sparkles className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                </div>
              )}
              <div className="flex-1">
                <h3
                  className={`font-normal leading-snug text-black ${isCompleted ? "text-sm truncate mb-0" : "text-base mb-1.5"}`}
                >
                  {block.title}
                </h3>
                {!isCompleted && (
                  <p className="text-[11px] font-light tracking-wide text-zinc-700 dark:text-zinc-300">
                    {block.dueDate}
                  </p>
                )}
              </div>
            </div>

            {!isCompleted && !isGuide && !isAIControl && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 -mt-1 -mr-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onArchive()
                    }}
                    className="text-muted-foreground font-light"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {!isCompleted && (
            <p
              className={`text-sm leading-relaxed font-light ${isAIControl && !aiEnabled ? "text-muted-foreground/50" : "text-zinc-700 dark:text-zinc-300"} ${isGuide ? "line-clamp-3" : ""}`}
            >
              {block.description}
            </p>
          )}
        </div>
      </div>

      {!isAIControl && (
        <BlockDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          block={block}
          onUpdate={onUpdate}
          zones={zones}
        />
      )}
    </>
  )
}
