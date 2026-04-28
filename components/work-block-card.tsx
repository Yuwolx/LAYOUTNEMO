"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BlockDetailDialog } from "@/components/block-detail-dialog"
import { MoreVertical, Trash2, Sparkles, Power } from "lucide-react"
import type { WorkBlock } from "@/types"
import { URGENCY_META } from "@/lib/constants/urgency"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedBlockField } from "@/lib/i18n/seed"

interface WorkBlockCardProps {
  block: WorkBlock
  isDragging: boolean
  visibility: "normal" | "emphasized" | "dimmed"
  onMouseDown: (e: React.MouseEvent) => void
  onUpdate: (updates: Partial<WorkBlock>, skipHistory?: boolean) => void
  onArchive: () => void
  zones: Array<{ id: string; label: string }>
  isDarkMode: boolean
  isCopyMode?: boolean
  isTossingBack?: boolean
}

const urgencyShadows = {
  stable: URGENCY_META.stable.shadowLight,
  thinking: URGENCY_META.thinking.shadowLight,
  lingering: URGENCY_META.lingering.shadowLight,
  urgent: URGENCY_META.urgent.shadowLight,
}

const urgencyShadowsDark = {
  stable: URGENCY_META.stable.shadowDark,
  thinking: URGENCY_META.thinking.shadowDark,
  lingering: URGENCY_META.lingering.shadowDark,
  urgent: URGENCY_META.urgent.shadowDark,
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
  isCopyMode = false,
  isTossingBack = false,
}: WorkBlockCardProps) {
  const { language } = useLanguage()
  const t = useT()
  const displayTitle = translateSeedBlockField(block, "title", language) ?? block.title
  const displayDescription = translateSeedBlockField(block, "description", language) ?? block.description
  const [showDetail, setShowDetail] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const isMovingRef = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false
  const isAIControl = block.isAIControl || false
  const aiEnabled = block.aiEnabled !== undefined ? block.aiEnabled : false

  // 실제 렌더 높이를 측정해 stored block.height 와 동기화.
  // hit-test(연결선 끝점, 독 드롭, 겹침 감지) 가 stored height 를 신뢰하므로 거짓말하지 않게 한다.
  // 주의: skipHistory=true 로 보내야 자동 측정이 undo 스택을 더럽히지 않는다.
  // 주의: 비교 대상은 ref 로 늘 최신 block.height — 클로저가 stale 안 되도록.
  const latestHeightRef = useRef(block.height)
  latestHeightRef.current = block.height

  useEffect(() => {
    if (!cardRef.current || isCompleted) return
    const el = cardRef.current
    const measure = () => {
      const measured = Math.round(el.getBoundingClientRect().height)
      if (measured > 0 && Math.abs(measured - latestHeightRef.current) > 1) {
        onUpdate({ height: measured }, true)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isCompleted, onUpdate])

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

  const handleCompleteBlock = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    const dropdown = e.currentTarget.closest('[role="menu"]')
    if (dropdown) {
      const button = dropdown.previousElementSibling as HTMLElement
      button?.click()
    }

    onUpdate({ isCompleted: true, relatedTo: [] })
  }

  return (
    <>
      <div
        ref={cardRef}
        key={`${block.id}-${isCompleted ? "completed" : "active"}`}
        className={`absolute group select-none ${isCopyMode ? "cursor-copy" : isCompleted ? "cursor-grab" : "cursor-move"}`}
        style={{
          left: block.x,
          top: block.y,
          width: block.width,
          // 카드 위에서 드래그 시 텍스트가 선택되지 않도록 (모든 브라우저).
          userSelect: "none",
          WebkitUserSelect: "none",
          // 활성 블럭은 내용에 맞춰 가변. 완료 블럭은 슬림 바 형태 유지.
          height: isCompleted ? 56 : "auto",
          minHeight: isCompleted ? 56 : 64,
          // line-clamp-3 + 패딩 + 여유. 너무 커지지 않도록 상한.
          maxHeight: isCompleted ? 56 : 200,
          // 평소엔 transition 없음(드래그 시 끊김 방지). Shift 토스 복귀 동안만 부드럽게 미끄러진다.
          transition: isTossingBack
            ? "left 420ms cubic-bezier(0.34, 1.35, 0.64, 1), top 420ms cubic-bezier(0.34, 1.35, 0.64, 1)"
            : "none",
          zIndex: isDragging ? 50 : visibility === "emphasized" ? 20 : isCompleted ? 5 : 10,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        <div
          className={`
          w-full h-full bg-card text-card-foreground border-border/60 rounded-2xl
          hover:shadow-xl hover:border-border
          ${isDarkMode ? urgencyShadowsDark[block.urgency || "stable"] : urgencyShadows[block.urgency || "stable"]}
          ${isCompleted ? "opacity-80" : "opacity-100"}
          ${visibility === "emphasized" ? "scale-[1.12] shadow-2xl" : "scale-100"}
          ${visibility === "emphasized" ? "brightness-105" : "brightness-100"}
          ${isDragging ? "shadow-2xl scale-105 border-border cursor-grabbing" : ""}
          ${isCompleted ? "shadow-sm hover:opacity-60 p-3 rounded-lg" : "p-3"}
          ${isAIControl && aiEnabled ? "ring-2 ring-blue-400/30" : ""}
          ${isAIControl && !aiEnabled ? "opacity-60" : ""}
          transition-all duration-400
        `}
        >
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1 pr-2 flex items-center gap-2">
              {isAIControl && (
                <div className={`flex-shrink-0 ${aiEnabled ? "text-blue-600" : "text-muted-foreground/40"}`}>
                  {aiEnabled ? <Sparkles className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                </div>
              )}
              <div className="flex-1">
                <h3
                  className={`font-normal leading-tight text-card-foreground ${isCompleted ? "text-sm truncate mb-0" : "text-[13px] mb-0.5"}`}
                >
                  {displayTitle}
                </h3>
                {!isCompleted && block.dueDate && (
                  <p className="text-[10px] font-light tracking-wide text-card-foreground/70">
                    {block.dueDate}
                  </p>
                )}
              </div>
            </div>

            {isCompleted && !isGuide && (
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
                <DropdownMenuContent align="end"></DropdownMenuContent>
              </DropdownMenu>
            )}

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
                  <DropdownMenuItem onClick={handleCompleteBlock} className="text-muted-foreground font-light">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("action.archive")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onArchive()
                    }}
                    className="text-muted-foreground font-light"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("action.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {!isCompleted && (
            <p
              className={`text-[11px] leading-snug font-light line-clamp-3 ${isAIControl && !aiEnabled ? "text-muted-foreground/50" : "text-card-foreground/80"}`}
            >
              {displayDescription}
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
