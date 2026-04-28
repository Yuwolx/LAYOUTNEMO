"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Eye, Moon, Sun, Trash2, Undo2, Sparkles, RotateCcw, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import type { Zone } from "@/types"
import { useLanguage } from "@/lib/i18n/context"
import { translateSeedZoneLabel, translateSeedCanvasName } from "@/lib/i18n/seed"

interface HeaderProps {
  onCreateBlock: () => void
  onReflect: () => void
  zones: Zone[]
  selectedZone: string | null
  onZoneSelect: (zoneId: string | null) => void
  onManageAreas: () => void
  showRelationships: boolean
  onToggleRelationships: () => void
  showCompletedBlocks: boolean
  onToggleCompletedBlocks: () => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  trashCount: number
  onOpenTrash: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  isAIEnabled: boolean
  onToggleAI: () => void
  currentCanvasName: string
  onOpenCanvasSelector: () => void
  lastSaved: Date
  onReset: () => void
  onOpenAbout: () => void
  onReorderZones?: (orderedZoneIds: string[]) => void
}

export function Header({
  onCreateBlock,
  onReflect,
  zones,
  selectedZone,
  onZoneSelect,
  onManageAreas,
  showRelationships,
  onToggleRelationships,
  showCompletedBlocks,
  onToggleCompletedBlocks,
  isDarkMode,
  onToggleDarkMode,
  trashCount,
  onOpenTrash,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isAIEnabled,
  onToggleAI,
  currentCanvasName,
  onOpenCanvasSelector,
  lastSaved,
  onReset,
  onOpenAbout,
  onReorderZones,
}: HeaderProps) {
  // 결 탭 드래그 정렬 상태.
  // dragZoneId: 지금 잡고 있는 zone
  // dropTargetIdx: "이 인덱스 자리에 들어간다" 의미. 0..zones.length 사이.
  //   예) 3 → 인덱스 2번 zone 과 3번 zone 사이로 들어감.
  //   다른 zone 위에 올리는 게 아니라 zone 들 사이의 갭에 표시되는 게 핵심.
  const [dragZoneId, setDragZoneId] = useState<string | null>(null)
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null)

  const resetZoneDrag = () => {
    setDragZoneId(null)
    setDropTargetIdx(null)
  }

  // FLIP 애니메이션: zones 배열 순서 변경 시, 이전 위치에서 새 위치로 슬라이드.
  // 1) 렌더 직전 prev 위치를 저장
  // 2) 렌더 후 useLayoutEffect 에서 새 위치 측정
  // 3) 각 항목에 (prev - new) 만큼 즉시 translate → 다음 프레임에 0 으로 전환
  const zoneNodeRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const prevZoneRects = useRef<Map<string, DOMRect>>(new Map())
  // 사용자 드롭 시에만 true → 다음 useLayoutEffect 가 FLIP 애니메이션 실행.
  // localStorage hydration 같은 외부 갱신은 조용히 위치만 갱신.
  const animateNextLayoutRef = useRef(false)

  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>()
    zoneNodeRefs.current.forEach((el, id) => {
      if (el) next.set(id, el.getBoundingClientRect())
    })
    if (animateNextLayoutRef.current) {
      prevZoneRects.current.forEach((prev, id) => {
        const cur = next.get(id)
        const el = zoneNodeRefs.current.get(id)
        if (!cur || !el) return
        const dx = prev.left - cur.left
        if (Math.abs(dx) < 1) return
        el.style.transition = "none"
        el.style.transform = `translateX(${dx}px)`
        requestAnimationFrame(() => {
          el.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)"
          el.style.transform = "translateX(0)"
        })
      })
      animateNextLayoutRef.current = false
    }
    prevZoneRects.current = next
  }, [zones])

  const commitZoneDrop = () => {
    if (!onReorderZones || !dragZoneId || dropTargetIdx === null) {
      resetZoneDrag()
      return
    }
    const ids = zones.map((z) => z.id)
    const fromIdx = ids.indexOf(dragZoneId)
    if (fromIdx < 0) {
      resetZoneDrag()
      return
    }
    // splice 순서: 먼저 제거 → 그 다음 삽입. 제거로 뒤 인덱스가 한 칸 당겨지므로 보정.
    const insertIdx = dropTargetIdx > fromIdx ? dropTargetIdx - 1 : dropTargetIdx
    if (insertIdx === fromIdx) {
      resetZoneDrag()
      return
    }
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(insertIdx, 0, dragZoneId)
    // 사용자 드롭일 때만 다음 useLayoutEffect 가 FLIP 애니메이션 실행하도록 표시.
    animateNextLayoutRef.current = true
    onReorderZones(reordered)
    resetZoneDrag()
  }
  const { language, toggleLanguage, t } = useLanguage()
  const formatLastSaved = () => {
    const now = new Date()
    const diff = now.getTime() - lastSaved.getTime()
    const seconds = Math.floor(diff / 1000)

    if (language === "en") {
      if (seconds < 10) return "just now"
      if (seconds < 60) return `${seconds}s ago`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m ago`
      const hours = Math.floor(minutes / 60)
      return `${hours}h ago`
    }

    if (seconds < 10) return "방금 저장됨"
    if (seconds < 60) return `${seconds}초 전`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}분 전`
    const hours = Math.floor(minutes / 60)
    return `${hours}시간 전`
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-sm transition-colors duration-700 ${isDarkMode ? "bg-[#151823]/95" : "bg-[#fafaf9]/95"}`}
    >
      <div className={`border-b transition-colors duration-700 ${isDarkMode ? "border-zinc-800" : "border-border/20"}`}>
        <div className="max-w-[2000px] mx-auto px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 고정 너비 래퍼. 라이트/다크 로고의 원본 aspect ratio 가 달라 헤더 레이아웃이 튀지 않도록 고정. */}
            <div className="h-10 w-[160px] flex items-center shrink-0">
              <Image
                src={isDarkMode ? "/images/lo-logo-dark.png" : "/images/lo-logo.png"}
                alt="LAYOUTNEMO"
                width={200}
                height={50}
                className="max-h-10 w-auto object-contain"
                priority
              />
            </div>
            <button
              onClick={onOpenCanvasSelector}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                isDarkMode
                  ? "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
                  : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              {currentCanvasName}
            </button>
            <button
              onClick={toggleLanguage}
              aria-label={language === "ko" ? "Switch to English" : "한국어로 전환"}
              title={t("header.switchLanguage")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 justify-center min-w-[86px] ${
                isDarkMode
                  ? "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="font-semibold tracking-tight">
                {language === "ko" ? "Aa" : "가"}
              </span>
              <span className="hidden sm:inline text-[11px] opacity-70">
                {t("header.switchLanguage")}
              </span>
            </button>
            <button
              onClick={onOpenAbout}
              aria-label="About LAYOUTNEMO"
              title="About LAYOUTNEMO"
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode
                  ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Info className="w-4 h-4" />
            </button>
            <span
              className={`text-xs inline-block min-w-[72px] ${isDarkMode ? "text-zinc-400" : "text-gray-400"}`}
            >
              {formatLastSaved()}
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleAI}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all font-medium border
                ${
                  isAIEnabled
                    ? isDarkMode
                      ? "bg-blue-600/20 text-blue-300 border-blue-500/30 shadow-[0_6px_20px_rgba(59,130,246,0.22)]"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                    : isDarkMode
                      ? "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                      : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200"
                }
              `}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>

            <Button
              variant="outline"
              size="icon"
              onClick={onReset}
              className={`${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"}`}
              title={t("header.reset")}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                className={`${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"} ${!canUndo ? "opacity-40 cursor-not-allowed" : ""}`}
                title={`${t("header.undo")} (Cmd/Ctrl+Z)`}
              >
                <Undo2 className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                className={`${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"} ${!canRedo ? "opacity-40 cursor-not-allowed" : ""}`}
                title={`${t("header.redo")} (Cmd/Ctrl+Shift+Z)`}
              >
                <Undo2 className="w-4 h-4 scale-x-[-1]" />
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={onOpenTrash}
              className={`relative ${isDarkMode ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700" : "bg-background hover:bg-accent"}`}
            >
              <Trash2 className="w-4 h-4" />
              {trashCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] flex items-center justify-center ${isDarkMode ? "bg-zinc-100 text-zinc-900" : "bg-foreground text-background"}`}
                >
                  {trashCount}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onToggleDarkMode}
              className={
                isDarkMode
                  ? "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 shadow-[0_0_20px_rgba(250,204,21,0.3)]"
                  : "bg-background hover:bg-accent"
              }
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button onClick={onCreateBlock} className="text-sm min-w-[128px]">
              {t("header.createBlock")}
            </Button>

            <Button onClick={onReflect} className="text-sm min-w-[96px] bg-foreground text-background hover:bg-foreground/90">
              {t("header.reflect")}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`border-t border-b transition-colors duration-700 ${isDarkMode ? "border-zinc-600 border-b border-b-zinc-900" : "border-zinc-300 border-b border-b-stone-50"}`}
      >
        <div className="max-w-[2000px] mx-auto px-8 py-2 flex items-center gap-2">
          {/* 결 탭 + 갭 인디케이터. 시각 포인트는 결들 사이 갭. */}
          {zones.map((zone, idx) => {
            const isSelected = selectedZone === zone.id
            const isDragging = dragZoneId === zone.id
            const showIndicatorBefore = dragZoneId && dropTargetIdx === idx
            return (
              <div
                key={zone.id}
                ref={(el) => {
                  if (el) zoneNodeRefs.current.set(zone.id, el)
                  else zoneNodeRefs.current.delete(zone.id)
                }}
                // 드롭 hit 영역을 wrapper div 가 잡아 인디케이터 위에 마우스가 올라가도 안정적.
                onDragOver={(e) => {
                  if (!dragZoneId) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  const rect = e.currentTarget.getBoundingClientRect()
                  const insertBefore = e.clientX < rect.left + rect.width / 2
                  const next = insertBefore ? idx : idx + 1
                  if (dropTargetIdx !== next) setDropTargetIdx(next)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  commitZoneDrop()
                }}
                className="flex items-center"
              >
                {/* 인디케이터: 1px 얇은 막대. 평소엔 0px. 활성 시에도 좁아서 갭만 살짝 벌어진다. */}
                <span
                  aria-hidden
                  className={`inline-block transition-all duration-150 ${
                    showIndicatorBefore
                      ? `w-px h-6 mx-1 ${isDarkMode ? "bg-zinc-100" : "bg-foreground"}`
                      : "w-0 h-6"
                  }`}
                />
                <button
                  draggable
                  onDragStart={(e) => {
                    setDragZoneId(zone.id)
                    setDropTargetIdx(idx)
                    e.dataTransfer.setData("text/plain", zone.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={resetZoneDrag}
                  onClick={() => {
                    if (dragZoneId) return
                    onZoneSelect(isSelected ? null : zone.id)
                  }}
                  className={`
                    px-4 py-1.5 rounded-full text-sm transition-all duration-300 font-light cursor-grab active:cursor-grabbing
                    ${isDragging ? "opacity-40" : ""}
                    ${
                      isSelected
                        ? isDarkMode
                          ? "bg-zinc-100 text-zinc-900 font-normal shadow-sm"
                          : "bg-foreground text-background font-normal shadow-sm"
                        : isDarkMode
                          ? "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    }
                  `}
                >
                  {translateSeedZoneLabel(zone, language)}
                </button>
              </div>
            )
          })}
          {/* 마지막 자리 — 드래그 중에만 hit zone 노출. 충분한 폭으로 안정적. */}
          {dragZoneId && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (dropTargetIdx !== zones.length) setDropTargetIdx(zones.length)
              }}
              onDrop={(e) => {
                e.preventDefault()
                commitZoneDrop()
              }}
              className="flex items-center min-w-[24px]"
            >
              <span
                aria-hidden
                className={`inline-block transition-all duration-150 ${
                  dropTargetIdx === zones.length
                    ? `w-px h-6 mx-1 ${isDarkMode ? "bg-zinc-100" : "bg-foreground"}`
                    : "w-0 h-6"
                }`}
              />
            </div>
          )}

          <button
            onClick={onManageAreas}
            className={`ml-1 px-2 py-1.5 text-xs rounded-full transition-colors ${isDarkMode ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/40"}`}
          >
            {t("header.addFacet")}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onToggleRelationships}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all
                ${
                  showRelationships
                    ? isDarkMode
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-foreground/10 text-foreground"
                    : isDarkMode
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-muted-foreground/60 hover:bg-accent/40"
                }
              `}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showRelationships ? t("header.showRelationships") : t("header.hideRelationships")}</span>
            </button>

            <button
              onClick={onToggleCompletedBlocks}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all
                ${
                  showCompletedBlocks
                    ? isDarkMode
                      ? "bg-zinc-800 text-zinc-200"
                      : "bg-foreground/10 text-foreground"
                    : isDarkMode
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      : "text-muted-foreground/60 hover:bg-accent/40"
                }
              `}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showCompletedBlocks ? t("header.showCompleted") : t("header.hideCompleted")}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
