"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BlockDetailDialog } from "@/components/block-detail-dialog"
import { MoreVertical, Sparkles, Power, ExternalLink, Archive, Pin, Link2, Copy } from "lucide-react"
import type { WorkBlock } from "@/types"
import { URGENCY_META, GUIDE_SHADOW_LIGHT, GUIDE_SHADOW_DARK } from "@/lib/constants/urgency"
import { useLanguage, useT } from "@/lib/i18n/context"
import { translateSeedBlockField } from "@/lib/i18n/seed"

interface WorkBlockCardProps {
  block: WorkBlock
  isDragging: boolean
  visibility: "normal" | "emphasized" | "dimmed"
  onPointerDown: (e: React.PointerEvent) => void
  // Canvas 가 pointerdown 을 선택/연결로 소비했을 때 true 로 세팅. 뒤따르는 click 이
  // 상세 다이얼로그를 열지 않도록 여기서 확인한다.
  suppressClickRef?: React.MutableRefObject<boolean>
  onUpdate: (updates: Partial<WorkBlock>, skipHistory?: boolean) => void
  zones: Array<{ id: string; label: string }>
  isDarkMode: boolean
  isCopyMode?: boolean
  isTossingBack?: boolean
  archiveFlight?: { targetX: number; targetY: number } | null
  isSelected?: boolean
  dimmed?: boolean
  onTogglePin?: () => void
  onCopy?: () => void
  onStartConnect?: () => void
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
  onPointerDown,
  suppressClickRef,
  onUpdate,
  zones,
  isDarkMode,
  isCopyMode = false,
  isTossingBack = false,
  archiveFlight = null,
  isSelected = false,
  dimmed = false,
  onTogglePin,
  onCopy,
  onStartConnect,
}: WorkBlockCardProps) {
  const { language } = useLanguage()
  const t = useT()
  const displayTitle = translateSeedBlockField(block, "title", language) ?? block.title
  const displayNotes = translateSeedBlockField(block, "detailedNotes", language) ?? block.detailedNotes ?? block.description
  const [showDetail, setShowDetail] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const isMovingRef = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const isCompleted = block.isCompleted || false
  const isGuide = block.isGuide || false
  const isAIControl = block.isAIControl || false
  const aiEnabled = block.aiEnabled !== undefined ? block.aiEnabled : false
  const archiveFlightStyle = archiveFlight
    ? ({
        "--archive-x": `${archiveFlight.targetX - block.x}px`,
        "--archive-y": `${archiveFlight.targetY - block.y}px`,
        animation: "archiveFlyToDock 150ms cubic-bezier(0.16, 0.86, 0.22, 1) forwards",
      } as React.CSSProperties)
    : {}

  // 실제 렌더 높이를 측정해 stored block.height 와 동기화.
  // hit-test(연결선 끝점, 독 드롭, 겹침 감지) 가 stored height 를 신뢰하므로 거짓말하지 않게 한다.
  // 주의: skipHistory=true 로 보내야 자동 측정이 undo 스택을 더럽히지 않는다.
  // 주의: 비교 대상은 ref 로 늘 최신 block.height — 클로저가 stale 안 되도록.
  const latestHeightRef = useRef(block.height)
  latestHeightRef.current = block.height
  // onUpdate 는 매 렌더 새로 생성되는 인라인 콜백. effect deps 에 넣으면 매 렌더 재구독되어
  // 측정 → setState → 재렌더가 무한 반복될 수 있다(Maximum update depth). ref 로 최신값만 참조.
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!cardRef.current || isCompleted) return
    const el = cardRef.current
    const measure = () => {
      // offsetHeight = layout 높이. getBoundingClientRect().height 는 조상 transform(scale)이
      // 곱해진 시각적 높이라, 폰(0.6배)에선 실제의 60%가 저장되고 DB 동기화로 기기 간에
      // 퍼졌다 — 겹침 검사·연결선·드롭 판정이 전부 이 값을 신뢰하므로 world 단위여야 한다.
      const measured = Math.round(el.offsetHeight)
      if (measured > 0 && Math.abs(measured - latestHeightRef.current) > 1) {
        onUpdateRef.current({ height: measured }, true)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isCompleted])

  const handlePointerDown = (e: React.PointerEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY }
    isMovingRef.current = false
    // 새 제스처 시작 — 소비 플래그 초기화. onPointerDown 안에서 선택/연결로
    // 소비되면 다시 true 가 되고, 아니면 false 로 남아 정상 클릭이 통과한다.
    if (suppressClickRef) suppressClickRef.current = false
    onPointerDown(e)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx > 5 || dy > 5) {
      isMovingRef.current = true
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // 선택/연결 모드에서 소비된 탭이면 상세 다이얼로그를 열지 않는다.
    if (suppressClickRef?.current) {
      suppressClickRef.current = false
      return
    }
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

    onUpdate({ isCompleted: true })
  }

  return (
    <>
      <div
        ref={cardRef}
        data-block-card
        key={`${block.id}-${isCompleted ? "completed" : "active"}`}
        className={`absolute group select-none ${
          archiveFlight ? "pointer-events-none" : isCopyMode ? "cursor-copy" : isCompleted ? "cursor-grab" : "cursor-move"
        }`}
        style={{
          left: block.x,
          top: block.y,
          width: block.width,
          transformOrigin: "center center",
          ...archiveFlightStyle,
          // 카드 위에서 드래그 시 텍스트가 선택되지 않도록 (모든 브라우저).
          userSelect: "none",
          WebkitUserSelect: "none",
          // iOS 롱프레스 시 뜨는 텍스트/링크 콜아웃 메뉴가 드래그를 방해하지 않도록.
          WebkitTouchCallout: "none",
          // 터치 드래그가 브라우저 스크롤로 새지 않도록.
          touchAction: "none",
          // 활성 블럭은 내용에 맞춰 가변. 완료 블럭은 슬림 바 형태 유지.
          height: isCompleted ? 56 : "auto",
          minHeight: isCompleted ? 56 : 64,
          // line-clamp-5 + 패딩 + 여유. 너무 커지지 않도록 상한.
          maxHeight: isCompleted ? 56 : 260,
          transition: archiveFlight
            ? "none"
            : isTossingBack
              ? "left 420ms cubic-bezier(0.34, 1.35, 0.64, 1), top 420ms cubic-bezier(0.34, 1.35, 0.64, 1)"
              : "none",
          willChange: archiveFlight ? "transform, opacity" : isDragging || isTossingBack ? "transform" : "auto",
          // 선택 시 보라 글로우 — drop-shadow 라 카드 시급도 그림자(inner box-shadow)와 안 겹치고,
          // 둥근 실루엣을 따라 부드러운 후광이 진다. (대표 블럭은 캔버스에선 원래 시급도 색 그대로)
          filter:
            isSelected && !archiveFlight
              ? "drop-shadow(0 0 3px rgba(139,92,246,0.55)) drop-shadow(0 0 10px rgba(139,92,246,0.32))"
              : undefined,
          zIndex: archiveFlight ? 60 : isDragging ? 50 : isSelected ? 40 : visibility === "emphasized" ? 30 : isCompleted ? 5 : 10,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      >
        <div
          className={`
          relative w-full h-full bg-card text-card-foreground border-border/60 rounded-2xl
          hover:shadow-xl hover:border-border
          ${
            // 가이드 블럭은 시급도 색 대신 전용 청록 글로우 — 내 작업이 아니라 앱이 준 설명임을 색으로 구분.
            isGuide
              ? isDarkMode
                ? GUIDE_SHADOW_DARK
                : GUIDE_SHADOW_LIGHT
              : isDarkMode
                ? urgencyShadowsDark[block.urgency || "thinking"]
                : urgencyShadows[block.urgency || "thinking"]
          }
          ${isCompleted ? "opacity-80" : "opacity-100"}
          ${visibility === "emphasized" ? "scale-[1.22] shadow-2xl" : "scale-100"}
          ${visibility === "emphasized" ? "brightness-105" : "brightness-100"}
          ${isDragging ? "shadow-2xl scale-105 border-border cursor-grabbing" : ""}
          ${isCompleted ? "shadow-sm hover:opacity-60 p-3 rounded-lg" : "p-3"}
          ${isAIControl && aiEnabled ? "ring-2 ring-blue-400/30" : ""}
          ${isAIControl && !aiEnabled ? "opacity-60" : ""}
          ${isSelected ? "ring-1 ring-violet-400/70 ring-offset-2 ring-offset-background" : ""}
          transition-all duration-400 ease-out
        `}
          style={{ opacity: dimmed ? 0.4 : undefined }}
        >
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex-1 pr-2 flex items-center gap-2">
              {isAIControl && (
                <div className={`flex-shrink-0 ${aiEnabled ? "text-blue-600" : "text-muted-foreground/40"}`}>
                  {aiEnabled ? <Sparkles className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3
                  className={`font-normal leading-tight text-card-foreground break-words ${isCompleted ? "text-sm truncate mb-0" : "text-[14px] mb-0.5"}`}
                >
                  {displayTitle}
                </h3>
                {!isCompleted && block.dueDate && (
                  <p className="text-[11px] font-light tracking-wide text-card-foreground/70">
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
                    className="opacity-0 group-hover:opacity-100 [@media(any-pointer:coarse)]:opacity-100 transition-opacity h-7 w-7 -mt-1 -mr-1"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
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
                    className="opacity-0 group-hover:opacity-100 [@media(any-pointer:coarse)]:opacity-100 transition-opacity h-7 w-7 -mt-1 -mr-1"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePin?.()
                    }}
                    className="text-muted-foreground font-light"
                  >
                    <Pin className="w-4 h-4 mr-2" />
                    {block.isPinned
                      ? language === "en"
                        ? "Unpin"
                        : "고정 해제"
                      : language === "en"
                        ? "Pin to top"
                        : "대표로 고정"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onStartConnect?.()
                    }}
                    className="text-muted-foreground font-light"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {language === "en" ? "Connect…" : "연결"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onCopy?.()
                    }}
                    className="text-muted-foreground font-light"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {language === "en" ? "Duplicate" : "복사"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCompleteBlock} className="text-muted-foreground font-light">
                    <Archive className="w-4 h-4 mr-2" />
                    {t("action.archive")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {!isCompleted && displayNotes && (
            // 다크 보정: 밝은 글자는 어두운 바닥에서 번져 얇아 보이므로 굵기·불투명도를 한 단계 올림.
            <p
              className={`text-[12px] leading-snug font-light dark:font-medium line-clamp-5 whitespace-pre-wrap ${isAIControl && !aiEnabled ? "text-muted-foreground/50" : "text-card-foreground/80 dark:text-card-foreground"}`}
            >
              {displayNotes}
            </p>
          )}

          {/* 외부 링크 — 본문 바로 아래 별도 행, 우측 정렬. 본문/제목과 같은 레벨로 겹치지 않게. */}
          {!isCompleted && block.url && (
            <div className="flex justify-end mt-1.5">
              <a
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] text-card-foreground/60 hover:text-card-foreground hover:bg-foreground/5 transition-colors"
                title={block.url}
                aria-label={language === "en" ? "Open external link" : "외부 링크 열기"}
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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
